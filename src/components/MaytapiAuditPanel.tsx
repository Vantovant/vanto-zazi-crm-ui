import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, ShieldCheck, Filter, ArrowUpDown, Inbox,
  Link2, Ban, MailOpen, Mail, Clock, Database, Download, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * MAYTAPI AUDIT PANEL — H5 (read-only admin viewer)
 *
 * Surfaces `public.maytapi_gate_audit` rows with strict privacy:
 *   - actions allowed: linked, ignored, marked_read, marked_unread
 *   - never displays raw phone, full message body, or webhook payload
 *   - phone_last4 only (already enforced by validate_maytapi_gate_audit trigger)
 *   - actor / linked contact resolved to display name when safely available
 *
 * H5 SCOPE LOCKS:
 *   - No delete / cleanup / cron added
 *   - No mutation of any table
 *   - No reply box, AI suggestion, auto-reply, Send All, send path change
 *   - No edits to maytapi_messages, maytapi_inbound_unmatched, contacts.*,
 *     zazi_actions, prospector_send_log
 *
 * Server-side guarantee: RLS on maytapi_gate_audit allows SELECT only when
 * has_role(auth.uid(), 'admin'). Any non-admin call returns zero rows.
 */

type AuditAction = 'linked' | 'ignored' | 'marked_read' | 'marked_unread';

type AuditRow = {
  id: string;
  action: string;
  actor_user_id: string;
  user_id: string;
  gate_id: string | null;
  linked_contact_id: string | null;
  phone_last4: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type SortOrder = 'newest' | 'oldest';

const ACTION_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  linked:        { label: 'Linked',         icon: Link2,    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  ignored:       { label: 'Ignored',        icon: Ban,      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  marked_read:   { label: 'Marked read',    icon: MailOpen, cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  marked_unread: { label: 'Marked unread',  icon: Mail,     cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40' },
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Safe metadata renderer — only allow known scalar fields, never leak payloads. */
function safeMeta(meta: Record<string, unknown>): string {
  if (!meta || typeof meta !== 'object') return '';
  const parts: string[] = [];
  if (typeof meta.message_count === 'number') parts.push(`${meta.message_count} msg(s)`);
  if (typeof meta.thread_count === 'number') parts.push(`${meta.thread_count} thread row(s)`);
  return parts.join(' · ');
}

export function MaytapiAuditPanel({ isAdmin }: { isAdmin: boolean | null }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [contactNames, setContactNames] = useState<Record<string, string>>({});

  // Filters
  const [fAction, setFAction] = useState<'all' | AuditAction>('all');
  const [fFrom, setFFrom] = useState<string>('');
  const [fTo, setFTo] = useState<string>('');
  const [fLast4, setFLast4] = useState<string>('');
  const [fContact, setFContact] = useState<string>('');
  const [fActor, setFActor] = useState<string>('');
  const [order, setOrder] = useState<SortOrder>('newest');

  const loadAudit = async () => {
    setLoading(true);
    let q = supabase
      .from('maytapi_gate_audit' as any)
      .select('id,action,actor_user_id,user_id,gate_id,linked_contact_id,phone_last4,metadata,created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    const { data } = await q;
    const all = (data ?? []) as unknown as AuditRow[];
    setRows(all);

    // Resolve actor display names (profiles RLS allows authenticated reads)
    const actorIds = Array.from(new Set(all.map(r => r.actor_user_id).filter(Boolean)));
    const contactIds = Array.from(new Set(
      all.map(r => r.linked_contact_id).filter(Boolean) as string[]
    ));

    const [{ data: profs }, { data: cs }] = await Promise.all([
      actorIds.length
        ? supabase.from('profiles').select('id,display_name,email').in('id', actorIds)
        : Promise.resolve({ data: [] as any[] }),
      contactIds.length
        ? supabase.from('contacts').select('id,full_name').in('id', contactIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const aMap: Record<string, string> = {};
    (profs ?? []).forEach((p: any) => {
      aMap[p.id] = p.display_name || p.email || p.id.slice(0, 8);
    });
    setActorNames(aMap);

    const cMap: Record<string, string> = {};
    (cs ?? []).forEach((c: any) => { cMap[c.id] = c.full_name; });
    setContactNames(cMap);

    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Apply filters client-side (audit table is small + capped at 1000 rows)
  const filtered = useMemo(() => {
    let out = rows.filter(r => ACTION_META[r.action] !== undefined);
    if (fAction !== 'all') out = out.filter(r => r.action === fAction);
    if (fLast4.trim()) {
      const q = fLast4.trim();
      out = out.filter(r => (r.phone_last4 ?? '').includes(q));
    }
    if (fContact.trim()) {
      const q = fContact.trim().toLowerCase();
      out = out.filter(r => {
        const name = r.linked_contact_id ? (contactNames[r.linked_contact_id] ?? '').toLowerCase() : '';
        return name.includes(q);
      });
    }
    if (fActor.trim()) {
      const q = fActor.trim().toLowerCase();
      out = out.filter(r => (actorNames[r.actor_user_id] ?? '').toLowerCase().includes(q));
    }
    if (fFrom) {
      const ts = new Date(fFrom).getTime();
      out = out.filter(r => new Date(r.created_at).getTime() >= ts);
    }
    if (fTo) {
      const ts = new Date(fTo).getTime() + 24 * 3600 * 1000; // inclusive end-of-day
      out = out.filter(r => new Date(r.created_at).getTime() <= ts);
    }
    out.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return order === 'newest' ? db - da : da - db;
    });
    return out;
  }, [rows, fAction, fLast4, fContact, fActor, fFrom, fTo, order, actorNames, contactNames]);

  // Retention summary (all rows, not filtered)
  const retention = useMemo(() => {
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    let total = 0, d30 = 0, d90 = 0, d180 = 0;
    for (const r of rows) {
      if (!ACTION_META[r.action]) continue;
      total++;
      const age = now - new Date(r.created_at).getTime();
      if (age > 30 * day) d30++;
      if (age > 90 * day) d90++;
      if (age > 180 * day) d180++;
    }
    return { total, d30, d90, d180 };
  }, [rows]);

  const resetFilters = () => {
    setFAction('all'); setFFrom(''); setFTo(''); setFLast4('');
    setFContact(''); setFActor(''); setOrder('newest');
  };

  // Detail drawer
  const [detail, setDetail] = useState<AuditRow | null>(null);

  // Filter presets — only mutate visible filter state
  const applyPreset = (preset: 'today' | '7d' | '30d' | 'linked' | 'ignored' | 'read') => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === 'today') {
      setFFrom(iso(today)); setFTo(iso(today));
    } else if (preset === '7d') {
      const from = new Date(today); from.setDate(from.getDate() - 6);
      setFFrom(iso(from)); setFTo(iso(today));
    } else if (preset === '30d') {
      const from = new Date(today); from.setDate(from.getDate() - 29);
      setFFrom(iso(from)); setFTo(iso(today));
    } else if (preset === 'linked') {
      setFAction('linked');
    } else if (preset === 'ignored') {
      setFAction('ignored');
    } else if (preset === 'read') {
      // Visual hint — switch to marked_read; user can flip to marked_unread via Action dropdown
      setFAction('marked_read');
    }
  };

  // Manual redacted CSV export — current filtered rows only.
  // No raw phone, no phone_hash, no message body, no payload, no secrets, no IDs.
  const exportFilteredCsv = () => {
    if (filtered.length === 0) {
      alert('No audit records to export for this filter.');
      return;
    }
    const header = [
      'action',
      'actor_display_name',
      'linked_contact_name',
      'phone_last4',
      'created_at',
      'safe_metadata_summary',
    ];
    const esc = (v: string) => {
      const s = (v ?? '').toString();
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of filtered) {
      const actor = actorNames[r.actor_user_id] ?? '';
      const linked = r.linked_contact_id ? (contactNames[r.linked_contact_id] ?? '') : '';
      lines.push([
        esc(ACTION_META[r.action]?.label ?? r.action),
        esc(actor),
        esc(linked),
        esc(r.phone_last4 ? `••••${r.phone_last4}` : ''),
        esc(new Date(r.created_at).toISOString()),
        esc(safeMeta(r.metadata)),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `maytapi-audit-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center p-10 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking access…
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <ShieldCheck className="w-8 h-8 text-slate-500 mb-2" />
        <p className="text-sm text-slate-300">Maytapi Audit is admin-only.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col mt-3 mx-2 sm:mx-4 mb-4 gap-3 min-h-0">
      {/* Retention summary */}
      <section className="rounded-lg border border-slate-700/70 bg-slate-800/40">
        <div className="px-3 py-2 border-b border-slate-700/70 text-[11px] uppercase tracking-wide text-slate-500 font-medium flex items-center gap-2 flex-wrap">
          <Database className="w-3.5 h-3.5" /> Retention summary — all audit records, not affected by filters
          <span className="ml-auto text-[10px] normal-case text-slate-500">No auto-cleanup · counts only</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
          {[
            { label: 'Total audit rows', val: retention.total },
            { label: 'Older than 30 days', val: retention.d30 },
            { label: 'Older than 90 days', val: retention.d90 },
            { label: 'Older than 180 days', val: retention.d180 },
          ].map(s => (
            <div key={s.label} className="rounded-md border border-slate-700/60 bg-slate-900/40 p-2.5">
              <div className="text-lg font-semibold text-slate-100 leading-none">{s.val}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="px-3 pb-3 -mt-1">
          <p className="text-[11px] text-slate-500">
            Recommended retention: keep <span className="text-slate-300">180 days</span> of audit history,
            then archive older rows. Cleanup is intentionally not enabled in H5 — propose for H6.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-lg border border-slate-700/70 bg-slate-800/40">
        <div className="px-3 py-2 border-b border-slate-700/70 text-[11px] uppercase tracking-wide text-slate-500 font-medium flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5" /> Filters
          <button
            onClick={() => setOrder(o => o === 'newest' ? 'oldest' : 'newest')}
            className="ml-auto inline-flex items-center gap-1 text-[10px] normal-case px-2 py-1 rounded border border-slate-700 bg-slate-900/40 text-slate-300 hover:text-slate-100"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-3 h-3" />
            {order === 'newest' ? 'Newest first' : 'Oldest first'}
          </button>
          <button
            onClick={resetFilters}
            className="text-[10px] normal-case px-2 py-1 rounded border border-slate-700 bg-slate-900/40 text-slate-400 hover:text-slate-200"
          >
            Reset
          </button>
          {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
          <label className="text-[11px] text-slate-400">
            Action
            <select
              value={fAction}
              onChange={e => setFAction(e.target.value as any)}
              className="mt-1 w-full px-2 py-1.5 text-sm bg-slate-950 border border-slate-600 rounded-md text-slate-100"
            >
              <option value="all">All</option>
              <option value="linked">Linked</option>
              <option value="ignored">Ignored</option>
              <option value="marked_read">Marked read</option>
              <option value="marked_unread">Marked unread</option>
            </select>
          </label>
          <label className="text-[11px] text-slate-400">
            From
            <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 text-sm bg-slate-950 border border-slate-600 rounded-md text-slate-100" />
          </label>
          <label className="text-[11px] text-slate-400">
            To
            <input type="date" value={fTo} onChange={e => setFTo(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 text-sm bg-slate-950 border border-slate-600 rounded-md text-slate-100" />
          </label>
          <label className="text-[11px] text-slate-400">
            Phone last4
            <input
              inputMode="numeric"
              maxLength={4}
              value={fLast4}
              onChange={e => setFLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 4321"
              className="mt-1 w-full px-2 py-1.5 text-sm bg-slate-950 border border-slate-600 rounded-md text-slate-100 placeholder:text-slate-500 font-mono"
            />
          </label>
          <label className="text-[11px] text-slate-400">
            Linked contact name
            <input value={fContact} onChange={e => setFContact(e.target.value)} placeholder="contact name…"
              className="mt-1 w-full px-2 py-1.5 text-sm bg-slate-950 border border-slate-600 rounded-md text-slate-100 placeholder:text-slate-500" />
          </label>
          <label className="text-[11px] text-slate-400">
            Actor (admin)
            <input value={fActor} onChange={e => setFActor(e.target.value)} placeholder="admin name…"
              className="mt-1 w-full px-2 py-1.5 text-sm bg-slate-950 border border-slate-600 rounded-md text-slate-100 placeholder:text-slate-500" />
          </label>
        </div>
        {/* Filter presets — visible filter changes only, no backend, no mutation */}
        <div className="px-3 pb-3 -mt-1 flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 self-center mr-1">Presets:</span>
          {[
            { id: 'today',   label: 'Today' },
            { id: '7d',      label: 'Last 7 days' },
            { id: '30d',     label: 'Last 30 days' },
            { id: 'linked',  label: 'Linked only' },
            { id: 'ignored', label: 'Ignored only' },
            { id: 'read',    label: 'Read actions' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id as any)}
              className="text-[11px] px-2 py-1 rounded border border-slate-700 bg-slate-900/40 text-slate-300 hover:text-slate-100 hover:border-slate-500"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>
      <section className="flex-1 rounded-lg border border-slate-700/70 bg-slate-800/30 overflow-hidden flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-slate-700/70 bg-slate-900/40 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Audit records</span>
            <span className="text-[12px] text-slate-200 mt-0.5">
              Showing <span className="font-semibold text-emerald-300">{filtered.length}</span> of{' '}
              <span className="font-semibold text-slate-100">{rows.length}</span> audit records
              {(fAction !== 'all' || fLast4 || fContact || fActor || fFrom || fTo) && (
                <span className="text-slate-500"> · filtered</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={exportFilteredCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export the currently filtered audit records as a redacted CSV"
            >
              <Download className="w-3 h-3" /> Export filtered audit CSV
            </button>
            {(fAction !== 'all' || fLast4 || fContact || fActor || fFrom || fTo) && (
              <button
                onClick={resetFilters}
                className="text-[11px] px-2 py-1 rounded border border-slate-600 bg-slate-800 text-slate-200 hover:text-white hover:border-slate-500"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center p-10 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading audit records…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <Inbox className="w-8 h-8 text-slate-500 mb-2" />
              <p className="text-sm text-slate-300">No audit records yet</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Link, ignore, or mark-read/unread actions will appear here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <Filter className="w-8 h-8 text-slate-500 mb-2" />
              <p className="text-sm text-slate-200 font-medium">No records found for this filter.</p>
              <p className="text-[12px] text-slate-400 mt-1">
                {rows.length} total audit record{rows.length === 1 ? '' : 's'} exist.
                Choose <span className="text-slate-200 font-medium">All</span> to view everything.
              </p>
              <button
                onClick={resetFilters}
                className="mt-3 text-[12px] px-3 py-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5 p-3 sm:p-4 pb-32">
              {filtered.map(r => {
                const meta = ACTION_META[r.action];
                const Icon = meta.icon;
                const actor = actorNames[r.actor_user_id] ?? r.actor_user_id.slice(0, 8);
                const linked = r.linked_contact_id ? contactNames[r.linked_contact_id] : null;
                const summary = safeMeta(r.metadata);
                return (
                  <li
                    key={r.id}
                    className="rounded-lg border border-slate-600/70 bg-slate-900/70 shadow-sm hover:border-slate-500 hover:bg-slate-900 transition-colors p-3 sm:p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border shrink-0 font-medium ${meta.cls}`}>
                          <Icon className="w-3.5 h-3.5" /> {meta.label}
                        </span>
                        <div className="min-w-0 text-sm text-slate-100 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-slate-400">by</span>
                            <span className="font-semibold text-slate-50 truncate">{actor}</span>
                            {r.phone_last4 && (
                              <>
                                <span className="text-slate-600">·</span>
                                <span className="font-mono text-slate-100 bg-slate-800/80 px-1.5 py-0.5 rounded text-xs">••••{r.phone_last4}</span>
                              </>
                            )}
                            {linked && (
                              <>
                                <span className="text-slate-600">→</span>
                                <span className="text-emerald-300 font-medium truncate">{linked}</span>
                              </>
                            )}
                          </div>
                          {summary && (
                            <div className="text-[12px] text-slate-400 mt-1.5">{summary}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0 sm:flex-col sm:items-end sm:gap-0.5">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className="font-medium text-slate-300">{relTime(r.created_at)}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{new Date(r.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
