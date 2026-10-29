import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Phone, MessageCircle, ExternalLink, Search, Loader2, PhoneOff, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import { ContactDrawer } from '@/components/ContactDrawer';
import type { Prospect } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  CALL_OUTCOMES, CallCard, dedupeCards, formatLocalPhone, intlDigits, isNoiseNote, isPhoneOnly, sortCards, talkAbout,
} from '@/lib/callSheets';

type Settings = { min_level: number; max_level: number };
type HistoryLine = { at: string; text: string };
type Filter = 'all' | 'open' | 'new' | 'steady' | 'little' | 'notcalled';

const db = supabase as any;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });

export function CallSheets() {
  const { user } = useAuth();
  const { contacts } = useCrm();
  const [settings, setSettings] = useState<Settings>({ min_level: 1, max_level: 5 });
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

  // Settings row: created on first load
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await db.from('call_sheet_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (data) setSettings({ min_level: data.min_level, max_level: data.max_level });
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
  }, []);

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

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-4 p-3 sm:p-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Call Sheets</h1>
        <p className="text-sm text-muted-foreground">Phone your team level by level, record each call, and see what to talk about.</p>
      </header>

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
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader><SheetTitle>{card.full_name}</SheetTitle></SheetHeader>
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
        <Button asChild><a href={`https://wa.me/${intlDigits(card.phone_number)}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Open in WhatsApp</a></Button>
      </SheetContent>
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
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader><SheetTitle>Link …{row.phone_last4} to a contact</SheetTitle></SheetHeader>
        <Input className="my-3" placeholder="Search name or number" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="space-y-1">
          {results.map((r) => (
            <Button key={r.id} variant="outline" className="w-full justify-between" onClick={() => link(r.id)}>
              <span>{r.full_name}</span><span className="text-muted-foreground">{formatLocalPhone(r.phone_number)}</span>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
