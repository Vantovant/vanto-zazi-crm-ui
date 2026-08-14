import { useState, useCallback, useEffect } from 'react';
import { X, Send, Loader2, Check, AlertTriangle, ShieldAlert, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MonthlyActivityAppreciationModalProps {
  monthKey: string; // "2026-08"
  monthLabel: string; // "August 2026"
  onClose: () => void;
}

interface Attempt {
  month: string;
  order_id: string;
  contact_id?: string;
  contact_name?: string;
  entry_key?: string;
  amount?: number;
  source?: string;
  preview?: string;
  would_send?: boolean;
  skipped?: string;
  shared_with?: string;
  ok?: boolean;
  message_id?: string | null;
  reason?: string;
}

interface RunResult {
  ok: boolean;
  dry_run: boolean;
  candidates: number;
  sent: number;
  skipped: number;
  daily_cap: number;
  sent_today_before_this_run: number;
  attempts: Attempt[];
  error?: string;
  blocked?: string;
}

const SKIP_LABELS: Record<string, string> = {
  already_sent: 'Already sent',
  no_contact_matched: 'No contact matched',
  contact_not_found: 'Contact not found',
  opted_out: 'Opted out / unsubscribed',
  no_phone: 'No phone on file',
  phone_shared_with_another_identity: 'Phone shared with another identity',
  daily_cap_reached: "Today's cap reached — will send tomorrow",
};

export function MonthlyActivityAppreciationModal({ monthKey, monthLabel, onClose }: MonthlyActivityAppreciationModalProps) {
  const [preview, setPreview] = useState<RunResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<RunResult | null>(null);
  const [error, setError] = useState('');

  const runDryRun = useCallback(async () => {
    setLoadingPreview(true);
    setError('');
    const { data, error: fnErr } = await supabase.functions.invoke('send-activity-appreciation', {
      body: { month: monthKey, dry_run: true },
    });
    setLoadingPreview(false);
    if (fnErr) {
      setError(fnErr.message || 'Failed to load preview.');
      return;
    }
    if (!data?.ok) {
      setError(data?.error || data?.blocked || 'Preview call did not succeed.');
      setPreview(data || null);
      return;
    }
    setPreview(data as RunResult);
  }, [monthKey]);

  useEffect(() => { runDryRun(); }, [runDryRun]);

  const handleSend = useCallback(async () => {
    setSending(true);
    setError('');
    const { data, error: fnErr } = await supabase.functions.invoke('send-activity-appreciation', {
      body: { month: monthKey, dry_run: false },
    });
    setSending(false);
    if (fnErr) {
      setError(fnErr.message || 'Send failed.');
      return;
    }
    if (!data?.ok) {
      setError(data?.error || data?.blocked || 'Send did not succeed — nothing sent.');
      return;
    }
    setSendResult(data as RunResult);
    // Refresh the preview so counts (already-sent, remaining today) reflect what just happened.
    await runDryRun();
  }, [monthKey, runDryRun]);

  const wouldSend = preview?.attempts?.filter(a => a.would_send) || [];
  const skippedAttempts = preview?.attempts?.filter(a => a.skipped) || [];
  const remainingToday = preview ? Math.max(0, preview.daily_cap - preview.sent_today_before_this_run) : 0;
  const willSendCountToday = Math.min(wouldSend.length, remainingToday);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" />
              Monthly Activity Appreciation — {monthLabel}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              One-by-one via Maytapi · capped at {preview?.daily_cap ?? 20}/day · randomized 8–20s pacing
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">{error}</div>
          )}

          {loadingPreview ? (
            <div className="text-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Loading preview…</p>
            </div>
          ) : preview ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-center">
                  <div className="text-lg font-bold text-white">{preview.candidates}</div>
                  <div className="text-[11px] text-slate-400">Total this month</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-lg font-bold text-emerald-300">{wouldSend.length}</div>
                  <div className="text-[11px] text-slate-400">Ready to send</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="text-lg font-bold text-amber-300">{preview.sent_today_before_this_run}/{preview.daily_cap}</div>
                  <div className="text-[11px] text-slate-400">Sent today already</div>
                </div>
                <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-center">
                  <div className="text-lg font-bold text-sky-300">{willSendCountToday}</div>
                  <div className="text-[11px] text-slate-400">Will send if you click now</div>
                </div>
              </div>

              {willSendCountToday < wouldSend.length && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {wouldSend.length - willSendCountToday} more are eligible but will roll over to tomorrow's cap — come back and click Send again after today's batch.
                </div>
              )}

              {skippedAttempts.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                  <p className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    {skippedAttempts.length} skipped (not counted in "Will send")
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {skippedAttempts.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{a.contact_name || a.order_id}</span>
                        <span className="text-amber-400">{SKIP_LABELS[a.skipped || ''] || a.skipped}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-slate-300 mb-2">Preview — first message as an example</p>
                {wouldSend.length === 0 ? (
                  <div className="text-center py-6 text-sm text-slate-500">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                    Nothing eligible to send right now.
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                    {wouldSend[0].preview}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <div className="px-3 py-2 bg-slate-800 text-xs font-medium text-slate-300">
                  Recipients ready to send ({wouldSend.length})
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-800">
                  {wouldSend.map((a, i) => (
                    <div key={i} className="px-3 py-1.5 flex items-center justify-between text-xs">
                      <span className="text-slate-200">{a.contact_name}</span>
                      <span className="text-emerald-400 font-medium">R{Number(a.amount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {sendResult && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
                  <Check className="w-4 h-4 inline mr-1.5" />
                  Sent {sendResult.sent} just now · {sendResult.skipped} skipped this run. Today's total: {sendResult.sent_today_before_this_run + sendResult.sent}/{sendResult.daily_cap}.
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
          <button type="button" onClick={runDryRun} disabled={loadingPreview || sending}
            className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50">
            Refresh preview
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
              Close
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || loadingPreview || willSendCountToday === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : `Send Today's Batch (${willSendCountToday})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
