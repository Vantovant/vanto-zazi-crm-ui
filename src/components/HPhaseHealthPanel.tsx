// H7 — H-Phase Health Panel
// Admin-only, READ-ONLY diagnostics + static regression checklist + handover summary.
// SELECT-only queries. No mutations. No webhook simulation. No raw phone / phone_hash /
// message body / payload / secrets are surfaced anywhere in this component.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, FileText, ShieldCheck } from 'lucide-react';

interface Props {
  isAdmin: boolean;
}

interface HealthCounts {
  matched_conversations: number;
  unread_inbound: number;
  unmatched_open: number;
  unmatched_linked: number;
  unmatched_ignored: number;
  audit_rows: number;
  latest_inbound_at: string | null;
  latest_audit_at: string | null;
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '—';
  }
}

function relAge(ts: string | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function webhookStatus(latest: string | null): { label: string; tone: 'ok' | 'warn' | 'cold' } {
  if (!latest) return { label: 'No inbound seen', tone: 'cold' };
  const ageH = (Date.now() - new Date(latest).getTime()) / 3600000;
  if (ageH < 6) return { label: 'Receiving (recent)', tone: 'ok' };
  if (ageH < 48) return { label: 'Quiet (>6h)', tone: 'warn' };
  return { label: 'Stale (>48h)', tone: 'cold' };
}

const CHECKLIST: { phase: string; items: string[] }[] = [
  {
    phase: 'H1 — Inbox shell',
    items: ['Maytapi Inbox tab visible', 'Admin-only access enforced', 'Read-only surface'],
  },
  {
    phase: 'H2 — Inbound memory',
    items: ['Matched inbound saved', 'Unknown numbers do NOT enter main conversation history', 'No auto-create contacts'],
  },
  {
    phase: 'H2A — Unknown isolation',
    items: ['Unknown numbers remain masked (last4 only)', 'No unknown body stored in main conversation history'],
  },
  {
    phase: 'H3 — Unmatched gate',
    items: ['Gate shows open / linked / ignored', 'Link-to-contact works', 'Ignore works'],
  },
  {
    phase: 'H3A — Linked propagation',
    items: ['Linked unknown number routes future inbound to linked contact', 'No old history backfilled'],
  },
  {
    phase: 'H4 — Read state & search',
    items: ['Unread counts visible', 'Mark read works', 'Mark unread works', 'Search by name / message / last4 works', 'Mobile layout stable'],
  },
  {
    phase: 'H5 — Audit visibility',
    items: ['Audit tab visible', 'Filters work', 'Retention summary visible', 'No cleanup / delete / cron'],
  },
  {
    phase: 'H6 — Audit polish + export',
    items: ['Audit row detail drawer opens', 'Redacted CSV export works', 'Filter presets work', 'Mobile layout works'],
  },
];

const HARD_NO_LIST = [
  'No auto-reply',
  'No AI suggestions in inbox',
  'No Send All',
  'No cron / scheduled jobs',
  'No production flip from this UI',
  'No mutation of contacts.lead_type / leg / parent_contact_id / tree_depth',
  'No reply box added',
  'No new send path',
];

export function HPhaseHealthPanel({ isAdmin }: Props) {
  const [counts, setCounts] = useState<HealthCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState(true);
  const [showHandover, setShowHandover] = useState(false);

  async function load() {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      // SELECT-only. RLS already restricts these tables to admins.
      const [
        msgsCount,
        unread,
        openUm,
        linkedUm,
        ignoredUm,
        auditCount,
        latestMsg,
        latestAudit,
        convKeys,
      ] = await Promise.all([
        supabase.from('maytapi_messages').select('id', { count: 'exact', head: true }),
        supabase.from('maytapi_messages').select('id', { count: 'exact', head: true }).eq('direction', 'inbound').is('read_at', null),
        supabase.from('maytapi_inbound_unmatched').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('maytapi_inbound_unmatched').select('id', { count: 'exact', head: true }).eq('status', 'linked'),
        supabase.from('maytapi_inbound_unmatched').select('id', { count: 'exact', head: true }).eq('status', 'ignored'),
        supabase.from('maytapi_gate_audit').select('id', { count: 'exact', head: true }),
        supabase.from('maytapi_messages').select('received_at').eq('direction', 'inbound').order('received_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('maytapi_gate_audit').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('maytapi_messages').select('conversation_key').not('contact_id', 'is', null).limit(1000),
      ]);

      const distinctConvs = new Set((convKeys.data || []).map((r: any) => r.conversation_key)).size;

      setCounts({
        matched_conversations: distinctConvs,
        unread_inbound: unread.count ?? 0,
        unmatched_open: openUm.count ?? 0,
        unmatched_linked: linkedUm.count ?? 0,
        unmatched_ignored: ignoredUm.count ?? 0,
        audit_rows: auditCount.count ?? 0,
        latest_inbound_at: (latestMsg.data as any)?.received_at ?? null,
        latest_audit_at: (latestAudit.data as any)?.created_at ?? null,
      });

      // Suppress unused var lint
      void msgsCount;
    } catch (e: any) {
      setError(e?.message || 'Failed to load health metrics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 text-sm text-slate-400">
        Admin only.
      </div>
    );
  }

  const wh = webhookStatus(counts?.latest_inbound_at ?? null);
  const whTone =
    wh.tone === 'ok'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      : wh.tone === 'warn'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      : 'bg-slate-700/40 border-slate-600 text-slate-300';

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-300" />
          <h3 className="text-sm font-semibold text-slate-100">H-Phase Health</h3>
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">read-only</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Counts grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat label="Matched conversations" value={counts?.matched_conversations} />
        <Stat label="Unread inbound" value={counts?.unread_inbound} tone={counts && counts.unread_inbound > 0 ? 'warn' : undefined} />
        <Stat label="Audit rows" value={counts?.audit_rows} />
        <Stat label="Unmatched · open" value={counts?.unmatched_open} tone={counts && counts.unmatched_open > 0 ? 'warn' : undefined} />
        <Stat label="Unmatched · linked" value={counts?.unmatched_linked} />
        <Stat label="Unmatched · ignored" value={counts?.unmatched_ignored} />
      </div>

      {/* Timestamps + webhook freshness */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="p-3 rounded-md border border-slate-700 bg-slate-800/60">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Latest inbound</div>
          <div className="text-sm text-slate-100">{fmt(counts?.latest_inbound_at ?? null)}</div>
          <div className="text-[11px] text-slate-400">{relAge(counts?.latest_inbound_at ?? null)}</div>
        </div>
        <div className="p-3 rounded-md border border-slate-700 bg-slate-800/60">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Latest audit event</div>
          <div className="text-sm text-slate-100">{fmt(counts?.latest_audit_at ?? null)}</div>
          <div className="text-[11px] text-slate-400">{relAge(counts?.latest_audit_at ?? null)}</div>
        </div>
      </div>

      <div className={`p-3 rounded-md border text-xs flex items-center gap-2 ${whTone}`}>
        <ShieldCheck className="w-4 h-4" />
        Webhook status (heuristic from latest inbound): <strong className="ml-1">{wh.label}</strong>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <FlagRow label="Redacted CSV export available" value={true} />
        <FlagRow label="Mobile layout verified (manual)" value={true} />
      </div>

      {/* Checklist */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/40">
        <button
          onClick={() => setShowChecklist(s => !s)}
          className="w-full flex items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-sm font-medium text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            Regression checklist (H1–H6)
          </span>
          <span className="text-[11px] text-slate-400">{showChecklist ? 'Hide' : 'Show'}</span>
        </button>
        {showChecklist && (
          <div className="px-3 pb-3 space-y-3">
            {CHECKLIST.map(group => (
              <div key={group.phase}>
                <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">{group.phase}</div>
                <ul className="space-y-1">
                  {group.items.map(it => (
                    <li key={it} className="text-xs text-slate-200 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-[11px] text-slate-500 italic">
              Static checklist only. This panel does NOT mutate data, send WhatsApp, trigger webhooks, or create contacts.
            </p>
          </div>
        )}
      </div>

      {/* Handover summary */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/40">
        <button
          onClick={() => setShowHandover(s => !s)}
          className="w-full flex items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-sm font-medium text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-300" />
            Handover summary
          </span>
          <span className="text-[11px] text-slate-400">{showHandover ? 'Hide' : 'Show'}</span>
        </button>
        {showHandover && (
          <div className="px-3 pb-3 text-xs text-slate-300 space-y-2">
            <p>
              H1–H6 deliver the Maytapi Inbox foundation: matched-conversation memory, unknown-number isolation,
              an unmatched gate (link / ignore), linked-gate propagation, read/unread + search, audit visibility,
              and audit UX polish with a redacted manual CSV export.
            </p>
            <div>
              <strong className="text-slate-100">Tables:</strong> maytapi_messages, maytapi_inbound_unmatched, maytapi_gate_audit.
            </div>
            <div>
              <strong className="text-slate-100">Edge functions:</strong> maytapi-inbound (write path), maytapi-send-1to1 (locked send path — do not touch).
            </div>
            <div>
              <strong className="text-slate-100">Privacy rules:</strong> matched contacts only in main history · unknown numbers masked to last4 ·
              no unknown body in main history · audit CSV redacted (no raw phone, no phone_hash, no body, no payload, no secrets).
            </div>
            <div>
              <strong className="text-slate-100">Hard NO list:</strong>
              <ul className="list-disc ml-5 mt-1 space-y-0.5">
                {HARD_NO_LIST.map(x => <li key={x}>{x}</li>)}
              </ul>
            </div>
            <div>
              <strong className="text-slate-100">Recommended next:</strong> I1 binary tree schema → I2 tree visualizer → J1 conversation intelligence
              (only after the inbox map is fully stable). Not implemented in H7.
            </div>
            <p className="text-[11px] text-slate-500 italic">
              Full developer handover: <code>docs/H_Phase_Handover_2026-04-26.md</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | undefined; tone?: 'warn' }) {
  const toneClass = tone === 'warn'
    ? 'border-amber-500/30 bg-amber-500/5'
    : 'border-slate-700 bg-slate-800/60';
  return (
    <div className={`p-3 rounded-md border ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-semibold text-slate-100">{value ?? '—'}</div>
    </div>
  );
}

function FlagRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="p-3 rounded-md border border-slate-700 bg-slate-800/60 text-xs flex items-center justify-between">
      <span className="text-slate-300">{label}</span>
      <span className={value ? 'text-emerald-300' : 'text-slate-400'}>{value ? 'Yes' : 'No'}</span>
    </div>
  );
}
