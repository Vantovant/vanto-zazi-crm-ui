import { useCallback, useEffect, useMemo, useState } from 'react';
import { Phone, MessageCircle, ExternalLink, Search, Loader2, PhoneOff, Link2, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import { ContactDrawer } from '@/components/ContactDrawer';
import type { Prospect } from '@/data/mockData';
import { Button, Input, Textarea, Badge, Sheet, Toaster, toast } from '@/components/callsheets/ui';
import {
  CALL_OUTCOMES, CallCard, dedupeCards, formatLocalPhone, intlDigits, isNoiseNote, isPhoneOnly, sortCards, talkAbout,
} from '@/lib/callSheets';

type Settings = { min_level: number; max_level: number; new_days: number; steady_days: number; export_fresh_days: number };
const DEFAULT_SETTINGS: Settings = { min_level: 1, max_level: 5, new_days: 30, steady_days: 60, export_fresh_days: 45 };
type HistoryLine = { at: string; text: string };
type Filter = 'all' | 'open' | 'new' | 'steady' | 'little' | 'notcalled';

const db = supabase as any;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });

export function CallSheets() {
  const { user } = useAuth();
  const { contacts } = useCrm();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [cards, setCards] = useState<CallCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(1);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<Record<string, HistoryLine[]>>({});
  const [needsLevel, setNeedsLevel] = useState<any[]>([]);
  const [unmatched, setUnmatched] = useState<any[]>([]);
  const [waFor, setWaFor] = useState<CallCard | null>(null);
  const [openContact, setOpenContact] = useState<Prospect | null>(null);
  const [linkFor, setLinkFor] = useState<any | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState<Settings>(DEFAULT_SETTINGS);
  const [stale, setStale] = useState<any[]>([]);
  const [outside, setOutside] = useState<any[]>([]);

  // Settings row: created on first load
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await db.from('call_sheet_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (data) setSettings({
        min_level: data.min_level, max_level: data.max_level, new_days: data.new_days,
        steady_days: data.steady_days, export_fresh_days: data.export_fresh_days ?? 45,
      });
      else await db.from('call_sheet_settings').insert({ user_id: user.id });
    })();
  }, [user]);

  const loadCards = useCallback(async () => {
    const { data, error } = await db.from('call_sheet_cards').select('*').limit(2000);
    if (error) toast.error(`Could not load call sheets: ${error.message}`);
    setCards(dedupeCards((data ?? []) as CallCard[]));
    setLoading(false);
  }, []);

  const loadNeedsLevel = useCallback(async () => {
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    const { data } = await db.from('contacts')
      .select('id,full_name,phone_number,city,aplgo_id,level,leg,lead_type,created_at')
      .or(`aplgo_id.neq.,created_at.gte.${since}`)
      .neq('lead_type', 'Expired').limit(1000);
    setNeedsLevel((data ?? []).filter((c: any) => !/^\s*\d{1,2}\s*$/.test(c.level || '')));
    const { data: hi } = await db.from('contacts').select('id,full_name,level').not('level', 'is', null).neq('level', '').limit(5000);
    setOutside((hi ?? []).filter((c: any) => /^\s*\d+\s*$/.test(c.level) && Number(c.level) > 12));
  }, []);

  // Contacts at the current level who are not in the latest export (review only)
  const cardIdsKey = cards.map((c) => c.id).join(',');
  const loadStale = useCallback(async () => {
    const shown = new Set(cardIdsKey ? cardIdsKey.split(',') : []);
    const { data } = await db.from('contacts')
      .select('id,full_name,phone_number,go_status,lead_type,level,aplgo_id,phone_normalized,updated_at')
      .in('level', [String(level), ` ${level}`, `${level} `]).limit(2000);
    const seen = new Set<string>();
    const shownKeys = new Set(cards.map((c) => c.aplgo_id || c.phone_normalized || c.id));
    const rows = (data ?? []).filter((c: any) => {
      if (shown.has(c.id)) return false;
      const k = c.aplgo_id || c.phone_normalized || c.id;
      if (shownKeys.has(k) || seen.has(k)) return false;
      seen.add(k); return true;
    });
    const ids = rows.map((r: any) => r.id);
    const last: Record<string, string> = {};
    for (let i = 0; i < ids.length; i += 200) {
      const { data: o } = await db.from('orders').select('contact_id,order_date').in('contact_id', ids.slice(i, i + 200));
      for (const r of o ?? []) if (!last[r.contact_id] || r.order_date > last[r.contact_id]) last[r.contact_id] = r.order_date;
    }
    setStale(rows.map((r: any) => ({ ...r, last_order: last[r.id] })).sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || '')));
  }, [level, cardIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadStale(); }, [loadStale]);

  const loadUnmatched = useCallback(async () => {
    const { data } = await db.from('maytapi_inbound_unmatched')
      .select('id,phone_last4,last_seen_at,message_count,last_body_preview,status')
      .eq('status', 'open').order('last_seen_at', { ascending: false }).limit(50);
    setUnmatched(data ?? []);
  }, []);

  useEffect(() => { loadCards(); loadNeedsLevel(); loadUnmatched(); }, [loadCards, loadNeedsLevel, loadUnmatched]);

  // Live, read-only subscriptions
  useEffect(() => {
    const ch = supabase.channel(`call-sheets-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maytapi_messages' }, () => { loadCards(); loadUnmatched(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_activities' }, () => loadCards())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadCards, loadUnmatched]);

  const levels = useMemo(() => {
    const out: number[] = [];
    for (let i = settings.min_level; i <= settings.max_level; i++) out.push(i);
    return out;
  }, [settings]);
  useEffect(() => { if (!levels.includes(level)) setLevel(levels[0] ?? 1); }, [levels, level]);

  const tabCards = useMemo(() => cards.filter((c) => Number(c.level) === level), [cards, level]);
  const counts = useMemo(() => ({
    all: tabCards.length,
    open: tabCards.filter((c) => c.bucket === 'open').length,
    new: tabCards.filter((c) => c.bucket === 'new').length,
    steady: tabCards.filter((c) => c.bucket === 'steady').length,
    little: tabCards.filter((c) => c.bucket === 'little').length,
    notcalled: tabCards.filter((c) => !c.called_today).length,
  }), [tabCards]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    return sortCards(tabCards.filter((c) => {
      if (filter === 'notcalled' && c.called_today) return false;
      if (filter !== 'all' && filter !== 'notcalled' && c.bucket !== filter) return false;
      if (!q) return true;
      return c.full_name.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q)
        || (qd.length >= 3 && (c.phone_normalized || '').includes(qd.replace(/^0/, '')));
    }));
  }, [tabCards, filter, search]);

  // History lines for the visible tab
  const idsKey = tabCards.map((c) => c.id).join(',');
  const loadHistory = useCallback(async () => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (!ids.length) return;
    const [acts, ords, msgs] = await Promise.all([
      db.from('contact_activities').select('contact_id,created_at,summary,notes,activity_type').in('contact_id', ids).order('created_at', { ascending: false }).limit(1500),
      db.from('orders').select('contact_id,order_date,product,amount').in('contact_id', ids).order('order_date', { ascending: false }).limit(800),
      db.from('maytapi_messages').select('contact_id,received_at,direction,body,body_preview').in('contact_id', ids).order('received_at', { ascending: false }).limit(800),
    ]);
    const map: Record<string, HistoryLine[]> = {};
    const push = (id: string, l: HistoryLine) => { (map[id] ||= []).push(l); };
    for (const a of acts.data ?? []) {
      const t = [a.summary, a.notes].filter(Boolean).join(' — ');
      if (!t || isNoiseNote(t)) continue;
      push(a.contact_id, { at: a.created_at, text: a.activity_type === 'call' ? `Call: ${t}` : t });
    }
    for (const o of ords.data ?? []) push(o.contact_id, { at: o.order_date, text: `Order: ${o.product} (R${Number(o.amount).toFixed(0)})` });
    for (const m of msgs.data ?? []) {
      const b = (m.body || m.body_preview || '').trim();
      if (!b || isNoiseNote(b)) continue;
      push(m.contact_id, { at: m.received_at, text: `${m.direction === 'inbound' ? 'WhatsApp from them' : 'WhatsApp sent'}: ${b.slice(0, 90)}` });
    }
    for (const k of Object.keys(map)) map[k] = map[k].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 6);
    setHistory(map);
  }, [idsKey]);
  useEffect(() => { loadHistory(); }, [loadHistory, cards]);

  const calledToday = counts.all - counts.notcalled;

  const setLevelLeg = async (id: string, patch: { level?: string; leg?: string }) => {
    const { error } = await db.from('contacts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast.error(`Could not update: ${error.message}`);
    toast.success('Updated');
    loadNeedsLevel(); loadCards();
  };

  const openProspect = (id: string) => {
    const p = contacts.find((c) => String(c.id) === id);
    if (p) setOpenContact(p); else toast.error('Contact not loaded yet');
  };

  const saveSettings = async () => {
    if (!user) return;
    const s = draft;
    if (s.min_level < 1 || s.max_level > 12 || s.min_level > s.max_level) return toast.error('Levels must be 1 to 12, min not above max');
    if ([s.new_days, s.steady_days, s.export_fresh_days].some((n) => !(n >= 1))) return toast.error('Day values must be 1 or more');
    const { error } = await db.from('call_sheet_settings').upsert({ user_id: user.id, ...s, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return toast.error(`Settings not saved: ${error.message}`);
    setSettings(s); setShowSettings(false); toast.success('Settings saved');
    loadCards();
  };

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-4 p-3 sm:p-4">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Call Sheets</h1>
          <Button size="sm" variant="ghost" aria-label="Call sheet settings" onClick={() => { setDraft(settings); setShowSettings((v) => !v); }}><Settings2 className="h-5 w-5" /></Button>
        </div>
        <p className="text-sm text-muted-foreground">Phone your team level by level, record each call, and see what to talk about.</p>
      </header>

      {showSettings && (
        <section className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3 text-sm sm:grid-cols-3">
          {([['min_level', 'Min level', 1, 12], ['max_level', 'Max level', 1, 12], ['new_days', 'New-joiner days', 1, 365], ['steady_days', 'Steady-buyer days', 1, 365], ['export_fresh_days', 'Export freshness (days)', 1, 365]] as [keyof Settings, string, number, number][]).map(([k, label, mn, mx]) => (
            <label key={k} className="space-y-1">
              <span className="text-muted-foreground">{label}</span>
              <Input type="number" min={mn} max={mx} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} />
            </label>
          ))}
          <div className="col-span-full flex gap-2">
            <Button size="sm" onClick={saveSettings}>Save settings</Button>
            <Button size="sm" variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
          </div>
        </section>
      )}

      {outside.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-2 font-semibold text-foreground">Outside the range ({outside.length})</h2>
          <p className="mb-1 text-xs text-muted-foreground">Level above 12. Left as is.</p>
          {outside.map((c) => (
            <div key={c.id} className="flex justify-between gap-2 text-sm">
              <span className="text-foreground">{c.full_name || 'No name'} · Level {String(c.level).trim()}</span>
              <button className="text-xs text-primary underline" onClick={() => openProspect(c.id)}>Open contact</button>
            </div>
          ))}
        </section>
      )}

      {needsLevel.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-2 font-semibold text-foreground">Needs a level ({needsLevel.length})</h2>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {needsLevel.map((c) => (
              <div key={c.id} className="rounded-md border border-border p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{c.full_name || 'No name'} <span className="text-muted-foreground">{formatLocalPhone(c.phone_number)}</span></span>
                  <button className="text-xs text-primary underline" onClick={() => openProspect(c.id)}>Open contact</button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <Button key={n} size="sm" variant="outline" className="h-7 px-2" onClick={() => setLevelLeg(c.id, { level: String(n) })}>{n}</Button>
                  ))}
                  <Button size="sm" variant={c.leg === 'L' ? 'default' : 'outline'} className="h-7" onClick={() => setLevelLeg(c.id, { leg: 'L' })}>Left</Button>
                  <Button size="sm" variant={c.leg === 'R' ? 'default' : 'outline'} className="h-7" onClick={() => setLevelLeg(c.id, { leg: 'R' })}>Right</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
        {levels.map((l) => (
          <Button key={l} role="tab" aria-selected={l === level} size="sm" variant={l === level ? 'default' : 'outline'} onClick={() => setLevel(l)}>
            Level {l} ({cards.filter((c) => Number(c.level) === l).length})
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {([['all', 'All'], ['open', 'Open questions'], ['new', 'New joiners'], ['steady', 'Steady buyers'], ['little', 'Little history'], ['notcalled', 'Not called today']] as [Filter, string][]).map(([k, label]) => (
          <Badge key={k} variant={filter === k ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setFilter(k)}>{label} ({counts[k]})</Badge>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, number or town" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="whitespace-nowrap text-sm text-muted-foreground" data-testid="progress">Called today: {calledToday} of {counts.all}</span>
      </div>

      {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /> : (
        <div className="space-y-3">
          {visible.length === 0 && <p className="text-center text-sm text-muted-foreground">No people here.</p>}
          {visible.map((c) => (
            <CallCardView key={c.id} c={c} lines={history[c.id] ?? []} onWhatsApp={() => setWaFor(c)} onSaved={() => { loadCards(); }} />
          ))}
        </div>
      )}

      <details className="rounded-lg border border-border bg-card p-3" data-testid="not-in-export">
        <summary className="cursor-pointer font-semibold text-foreground">Not in the latest export ({stale.length})</summary>
        <p className="mt-1 text-xs text-muted-foreground">For review only. These people are not changed.</p>
        <div className="mt-2 max-h-96 space-y-1 overflow-y-auto text-sm">
          {stale.map((c) => (
            <div key={c.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1">
              <span className="text-foreground">{c.full_name || 'No name'} <span className="text-muted-foreground">{formatLocalPhone(c.phone_number)}</span></span>
              <span className="text-xs text-muted-foreground">{[c.go_status, c.lead_type, c.last_order ? `Last order ${fmtDate(c.last_order)}` : 'No orders'].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
        </div>
      </details>

      {unmatched.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-2 font-semibold text-foreground">Unmatched numbers ({unmatched.length})</h2>
          <div className="space-y-2">
            {unmatched.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground">…{u.phone_last4} · {u.message_count} msg · <span className="text-muted-foreground">{(u.last_body_preview || '').slice(0, 50)}</span></span>
                <Button size="sm" variant="outline" onClick={() => setLinkFor(u)}><Link2 className="mr-1 h-3 w-3" />Link to contact</Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {waFor && <WhatsAppDrawer card={waFor} onClose={() => { setWaFor(null); loadCards(); }} />}
      {linkFor && <LinkUnmatched row={linkFor} userId={user?.id} onClose={() => { setLinkFor(null); loadUnmatched(); loadCards(); }} />}
      <Toaster />
      {openContact && <ContactDrawer prospect={openContact} onClose={() => setOpenContact(null)} />}
    </div>
  );
}

function CallCardView({ c, lines, onWhatsApp, onSaved }: { c: CallCard; lines: HistoryLine[]; onWhatsApp: () => void; onSaved: () => void }) {
  const [outcome, setOutcome] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const phoneOnly = isPhoneOnly(c);
  const local = formatLocalPhone(c.phone_number);

  const save = async () => {
    if (!outcome) return toast.error('Choose an outcome first');
    setSaving(true);
    const { data, error } = await db.rpc('save_call', {
      p_contact_id: c.id, p_outcome: outcome, p_notes: notes, p_next_action: nextAction, p_follow_up_on: followUp || null,
    });
    setSaving(false);
    if (error) return toast.error(`Call not saved: ${error.message}`);
    const activityId = data as string;
    setOutcome(''); setNotes(''); setNextAction(''); setFollowUp('');
    onSaved();
    toast.success('Call saved', {
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: async () => {
          const { error: e } = await db.from('contact_activities').delete().eq('id', activityId);
          if (e) toast.error(`Undo failed: ${e.message}`); else { toast.success('Call removed'); onSaved(); }
        },
      },
    });
  };

  return (
    <article className="space-y-3 rounded-lg border border-border bg-card p-3 shadow-sm" data-testid="call-card" data-bucket={c.bucket}>
      {c.lead_type === 'Expired' && (
        <div className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">Tagged Expired in CRM</div>
      )}
      {phoneOnly && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-2 py-1 text-sm font-medium text-destructive">
          <PhoneOff className="h-4 w-4" /> No WhatsApp. Phone only.
        </div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground">{c.full_name}</h3>
        <a href={`tel:+${intlDigits(c.phone_number)}`} className="select-all font-mono text-primary underline"><Phone className="mr-1 inline h-4 w-4" />{local}</a>
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        {c.go_status && <Badge variant="secondary">{c.go_status}</Badge>}
        {c.leg && <Badge variant="secondary">{c.leg === 'L' ? 'Left' : c.leg === 'R' ? 'Right' : c.leg}</Badge>}
        {c.city && <Badge variant="secondary">{c.city}</Badge>}
        {c.aplgo_id && <Badge variant="outline">APLGO {c.aplgo_id}</Badge>}
        {c.bucket === 'open' && <Badge className="bg-accent text-accent-foreground">Open question</Badge>}
        {c.bucket === 'new' && <Badge className="bg-primary text-primary-foreground">New</Badge>}
        {c.called_today && <Badge variant="outline">Called today</Badge>}
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">What has happened</h4>
        {lines.length ? (
          <ul className="mt-1 space-y-0.5 text-sm text-foreground">
            {lines.map((l, i) => <li key={i}><span className="text-muted-foreground">{fmtDate(l.at)}</span> · {l.text}</li>)}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No history yet</p>}
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Talk about</h4>
        <ul className="mt-1 list-disc pl-5 text-sm text-foreground">{talkAbout(c).map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>
      {!phoneOnly && (
        <Button size="sm" variant="outline" onClick={onWhatsApp}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>
      )}
      <div className="space-y-2 rounded-md border border-border p-2">
        <div className="flex flex-wrap gap-1">
          {CALL_OUTCOMES.map((o) => (
            <Button key={o} size="sm" variant={outcome === o ? 'default' : 'outline'} className="h-7" onClick={() => setOutcome(o)}>{o}</Button>
          ))}
        </div>
        <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <div className="flex flex-wrap gap-2">
          <Input className="flex-1" placeholder="Next action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
          <Input className="w-40" type="date" aria-label="Follow-up date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          <Button onClick={save} disabled={saving || !outcome}>{saving ? 'Saving…' : 'Save call'}</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Last call: {c.last_call_at ? `${fmtDate(c.last_call_at)}, ${c.last_call_outcome ?? ''}` : 'never'}
      </p>
    </article>
  );
}

function WhatsAppDrawer({ card, onClose }: { card: CallCard; onClose: () => void }) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const load = useCallback(async () => {
    const { data } = await db.from('maytapi_messages').select('id,direction,body,body_preview,media_type,received_at,conversation_key')
      .eq('contact_id', card.id).order('received_at', { ascending: false }).limit(30);
    const rows = (data ?? []).reverse();
    setMsgs(rows);
    const keys = Array.from(new Set(rows.map((r: any) => r.conversation_key).filter(Boolean)));
    for (const k of keys) await db.rpc('mark_maytapi_thread_read', { p_conversation_key: k });
  }, [card.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`call-wa-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'maytapi_messages', filter: `contact_id=eq.${card.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [card.id, load]);

  let lastDay = '';
  return (
    <Sheet title={card.full_name} onClose={onClose}>
        <div className="flex-1 space-y-2 overflow-y-auto py-2">
          {msgs.length === 0 && <p className="text-sm text-muted-foreground">No WhatsApp messages stored for this person.</p>}
          {msgs.map((m) => {
            const day = new Date(m.received_at).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
            const sep = day !== lastDay; lastDay = day;
            const text = (m.body || m.body_preview || '').trim()
              || (m.media_type ? (/audio|ptt|voice/i.test(m.media_type) ? '[Voice note]' : /image/i.test(m.media_type) ? '[Image]' : `[${m.media_type}]`) : '[Empty]');
            return (
              <div key={m.id}>
                {sep && <div className="my-2 text-center text-xs text-muted-foreground">{day}</div>}
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.direction === 'inbound' ? 'bg-muted text-foreground' : 'ml-auto bg-primary text-primary-foreground'}`}>
                  {text}
                  <div className="mt-1 text-[10px] opacity-70">{new Date(m.received_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            );
          })}
        </div>
        <a className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" href={`https://wa.me/${intlDigits(card.phone_number)}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Open in WhatsApp</a>
    </Sheet>
  );
}

function LinkUnmatched({ row, userId, onClose }: { row: any; userId?: string; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  useEffect(() => {
    const t = q.trim();
    if (!t) { setResults([]); return; }
    let cancel = false;
    db.from('contacts').select('id,full_name,phone_number').or(`full_name.ilike.%${t}%,phone_number.ilike.%${t}%`).limit(10)
      .then(({ data }: any) => { if (!cancel) setResults(data ?? []); });
    return () => { cancel = true; };
  }, [q]);
  const link = async (contactId: string) => {
    if (!userId) return;
    const { error } = await db.from('maytapi_inbound_unmatched').update({
      status: 'linked', linked_contact_id: contactId, linked_at: new Date().toISOString(), linked_by: userId,
    }).eq('id', row.id);
    if (error) return toast.error(`Link failed: ${error.message}`);
    toast.success('Linked');
    onClose();
  };
  return (
    <Sheet title={`Link …${row.phone_last4} to a contact`} onClose={onClose}>
        <Input className="my-3" placeholder="Search name or number" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="space-y-1">
          {results.map((r) => (
            <Button key={r.id} variant="outline" className="w-full justify-between" onClick={() => link(r.id)}>
              <span>{r.full_name}</span><span className="text-muted-foreground">{formatLocalPhone(r.phone_number)}</span>
            </Button>
          ))}
        </div>
    </Sheet>
  );
}
