import { useEffect, useState } from 'react';
import { Loader2, FileText, ShieldCheck, Inbox } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * ZAZI AI PROSPECTOR — E.4 Admin Read-Only Send Audit Panel
 * Shows latest prospector_send_log + matching contact_activities row
 * for a given zazi_action_id. NO writes. Admin-only by parent gating.
 * Safe metadata only: never displays raw phone/email/caption/message body.
 */

type SendLogRow = {
  id: string;
  mode: string;
  intended_send_type: string;
  request_status: string;
  response_status_code: number | null;
  maytapi_message_id: string | null;
  content_length: number | null;
  attempted_at: string;
  error_code: string | null;
  metadata: Record<string, any> | null;
};

type ActivityRow = {
  id: string;
  activity_type: string;
  created_at: string;
};

interface Props {
  zaziActionId: string;
  contactId: string | null;
  /** Only render if true. Parent (Inbox) already gates by admin. */
  enabled: boolean;
  /** Hint: card is in sent state — pre-loads on mount to avoid extra clicks. */
  preload?: boolean;
}

const truncate = (s: string | null | undefined, n = 12) =>
  !s ? '—' : s.length <= n + 3 ? s : `${s.slice(0, n)}…`;

export function ProspectorSendAuditPanel({ zaziActionId, contactId, enabled, preload }: Props) {
  const [open, setOpen] = useState(!!preload);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [log, setLog] = useState<SendLogRow | null>(null);
  const [harnessOnly, setHarnessOnly] = useState(false);
  const [harnessExcluded, setHarnessExcluded] = useState(false);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHarness = (r: SendLogRow): boolean => {
    const m = r.metadata;
    if (!m || typeof m !== 'object') return false;
    return m.harness === true || m.harness === 'true';
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // E.7 — fetch latest few rows for this action and pick the latest non-harness one.
      // Harness rows (metadata.harness=true) are simulation logs and must NEVER replace
      // the real send proof in the audit panel.
      const { data: logs, error: logErr } = await supabase
        .from('prospector_send_log' as any)
        .select('id, mode, intended_send_type, request_status, response_status_code, maytapi_message_id, content_length, attempted_at, error_code, metadata')
        .eq('zazi_action_id', zaziActionId)
        .order('attempted_at', { ascending: false })
        .limit(5);
      if (logErr) throw logErr;

      const rows = ((logs as any[]) || []) as SendLogRow[];
      const realRow = rows.find((r) => !isHarness(r)) || null;
      const anyHarness = rows.some((r) => isHarness(r));

      setLog(realRow);
      setHarnessOnly(rows.length > 0 && !realRow && anyHarness);
      setHarnessExcluded(!!realRow && anyHarness);

      // Matching activity by exact zazi_action_id token
      let actQuery = supabase
        .from('contact_activities')
        .select('id, activity_type, created_at')
        .ilike('notes', `%zazi_action_id=${zaziActionId} |%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (contactId) actQuery = actQuery.eq('contact_id', contactId);
      const { data: acts, error: actErr } = await actQuery;
      if (actErr) throw actErr;
      setActivity(((acts as any[]) || [])[0] || null);

      setLoaded(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to load audit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    if (open && !loaded && !loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, enabled]);

  if (!enabled) return null;

  const statusCls =
    log?.request_status === 'ok'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : log?.request_status === 'blocked'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : log?.request_status
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : 'bg-slate-700/40 text-slate-400 border-slate-600';

  return (
    <div className="mt-3 border border-slate-700/70 rounded-lg bg-slate-900/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/50 rounded-lg"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
          Send Log <span className="text-[10px] uppercase tracking-wide text-slate-500">admin · read-only</span>
        </span>
        <span className="text-[10px] text-slate-500">{open ? 'hide' : 'show'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading audit…
            </div>
          )}

          {!loading && error && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Send log block */}
              {log ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
                  <div>
                    <div className="text-slate-500">Status</div>
                    <span className={`inline-block px-1.5 py-0.5 rounded border ${statusCls}`}>
                      {log.request_status}
                      {log.response_status_code ? ` · ${log.response_status_code}` : ''}
                    </span>
                  </div>
                  <div>
                    <div className="text-slate-500">Mode</div>
                    <span className="text-slate-200">{log.mode}</span>
                  </div>
                  <div>
                    <div className="text-slate-500">Transport</div>
                    <span className="text-slate-200">Maytapi · {log.intended_send_type}</span>
                  </div>
                  <div>
                    <div className="text-slate-500">Maytapi msg</div>
                    <span className="text-slate-200 font-mono" title={log.maytapi_message_id || ''}>
                      {truncate(log.maytapi_message_id, 14)}
                    </span>
                  </div>
                  <div>
                    <div className="text-slate-500">Content length</div>
                    <span className="text-slate-200">{log.content_length ?? '—'}</span>
                  </div>
                  <div>
                    <div className="text-slate-500">Attempted</div>
                    <span className="text-slate-200">{new Date(log.attempted_at).toLocaleString()}</span>
                  </div>
                  {log.error_code && (
                    <div className="col-span-2 sm:col-span-3">
                      <div className="text-slate-500">Error</div>
                      <span className="text-red-300">{log.error_code}</span>
                    </div>
                  )}
                </div>
              ) : harnessOnly ? (
                <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                  <Inbox className="w-3 h-3" /> Harness test log only — no real Maytapi send log yet.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Inbox className="w-3 h-3" /> No send log yet (pre-E.2 row, or never sent).
                </div>
              )}

              {harnessExcluded && log && (
                <div className="text-[10px] text-amber-400/80 italic">
                  Harness log excluded from live send proof.
                </div>
              )}

              {/* Activity block */}
              <div className="flex items-center gap-2 text-[11px] pt-1 border-t border-slate-800">
                <FileText className="w-3 h-3 text-slate-500" />
                <span className="text-slate-500">Activity:</span>
                {activity ? (
                  <span className="text-emerald-300">
                    logged ({activity.activity_type}) · {new Date(activity.created_at).toLocaleString()}
                    <span className="text-slate-500 font-mono ml-1">{truncate(activity.id, 8)}</span>
                  </span>
                ) : (
                  <span className="text-slate-400">not logged (flag off or no match)</span>
                )}
              </div>

              <div className="text-[10px] text-slate-500 italic">
                Safe metadata only — no message body, caption, phone or email stored.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
