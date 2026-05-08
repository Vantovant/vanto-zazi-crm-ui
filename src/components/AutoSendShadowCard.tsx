/**
 * Phase Auto-Send — Phase 1 SHADOW MODE.
 *
 * Admin-only card that:
 *   - Shows + edits auto-send settings (master, lane toggles, daily cap).
 *   - Lists recent rows from auto_send_shadow_log.
 *   - Has a "Run shadow scan now" button that invokes the scanner edge function.
 *
 * Hard guarantees:
 *   - Never invokes maytapi-send-1to1.
 *   - Never writes contact_activities or contact_birthdays.
 *   - Banner clearly states SHADOW MODE — NO SENDS.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldAlert, Play, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const OWNER_ID = 'b8028d7d-6a08-45ef-a369-b438c440bea3';

interface AutoSettings {
  auto_send_enabled: boolean;
  auto_send_birthdays_enabled: boolean;
  auto_send_appreciation_enabled: boolean;
  auto_send_daily_cap: number;
  auto_send_micro_live_enabled: boolean;
  auto_send_micro_live_daily_cap: number;
  auto_send_micro_live_contact_allowlist: string[];
}

interface MicroLiveSend {
  id: string;
  contact_id: string | null;
  intended_send_type: string;
  maytapi_message_id: string | null;
  attempted_at: string;
  request_status: string;
}

interface ShadowRow {
  id: string;
  lane: string;
  contact_name: string;
  entry_key: string;
  cycle_key: string;
  dedupe_key: string;
  eligibility: string;
  block_reason: string;
  would_send_at: string;
  message_style: string;
}

export function AutoSendShadowCard() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<AutoSettings | null>(null);
  const [rows, setRows] = useState<ShadowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');
  const [capDraft, setCapDraft] = useState('10');

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const { data } = await (supabase.from('user_roles') as any)
        .select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [authLoading, user?.id]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: s }, { data: r }] = await Promise.all([
      (supabase.from('integration_settings') as any)
        .select('auto_send_enabled, auto_send_birthdays_enabled, auto_send_appreciation_enabled, auto_send_daily_cap')
        .eq('user_id', user.id).maybeSingle(),
      (supabase.from('auto_send_shadow_log') as any)
        .select('id, lane, contact_name, entry_key, cycle_key, dedupe_key, eligibility, block_reason, would_send_at, message_style')
        .eq('user_id', user.id)
        .order('would_send_at', { ascending: false })
        .limit(50),
    ]);
    setSettings({
      auto_send_enabled: !!s?.auto_send_enabled,
      auto_send_birthdays_enabled: !!s?.auto_send_birthdays_enabled,
      auto_send_appreciation_enabled: !!s?.auto_send_appreciation_enabled,
      auto_send_daily_cap: typeof s?.auto_send_daily_cap === 'number' ? s.auto_send_daily_cap : 10,
    });
    setCapDraft(String(s?.auto_send_daily_cap ?? 10));
    setRows((r as ShadowRow[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const updateSetting = async (patch: Partial<AutoSettings>) => {
    if (!user || !settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await (supabase.from('integration_settings') as any).update(patch).eq('user_id', user.id);
  };

  const runScan = async () => {
    setScanning(true);
    setLastResult('');
    const { data, error } = await supabase.functions.invoke('auto-send-shadow-scan');
    setScanning(false);
    if (error) {
      setLastResult(`Error: ${error.message}`);
    } else {
      setLastResult(`Scanned. Evaluated ${data?.candidates_evaluated ?? 0}, inserted ${data?.shadow_rows_inserted ?? 0}. Quiet hours: ${data?.in_quiet_hours ? 'YES' : 'no'}.`);
      load();
    }
  };

  if (authLoading) return null;
  if (!user || user.id !== OWNER_ID || isAdmin === false) return null;
  if (!settings) {
    return (
      <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-5">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading auto-send settings…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            Auto-Send — Phase 1 (Shadow)
          </h2>
          <p className="text-xs text-slate-400 mt-1">Admin only · Vanto only.</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
          SHADOW MODE — NO SENDS
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Toggle label="Master auto-send" checked={settings.auto_send_enabled}
          onChange={(v) => updateSetting({ auto_send_enabled: v })} />
        <Toggle label="Birthday lane" checked={settings.auto_send_birthdays_enabled}
          onChange={(v) => updateSetting({ auto_send_birthdays_enabled: v })} />
        <Toggle label="Appreciation lane" checked={settings.auto_send_appreciation_enabled}
          onChange={(v) => updateSetting({ auto_send_appreciation_enabled: v })} />
        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
          <div className="text-sm text-white">Daily cap</div>
          <div className="flex gap-2 items-center">
            <input type="number" min={1} max={100} value={capDraft}
              onChange={(e) => setCapDraft(e.target.value)}
              className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white" />
            <button
              onClick={() => updateSetting({ auto_send_daily_cap: Math.max(1, Math.min(100, parseInt(capDraft, 10) || 10)) })}
              className="text-xs px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded">Save</button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={runScan} disabled={scanning}
          className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg disabled:opacity-50">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run shadow scan now
        </button>
        <button onClick={load} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
        {lastResult && <span className="text-xs text-slate-400">{lastResult}</span>}
      </div>

      <div className="border-t border-slate-700/50 pt-3">
        <div className="text-sm font-medium text-white mb-2">Recent shadow rows ({rows.length})</div>
        {loading ? (
          <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-slate-500 italic">No shadow rows yet. Run a scan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="text-left py-1 px-2">Lane</th>
                  <th className="text-left py-1 px-2">Contact</th>
                  <th className="text-left py-1 px-2">Cycle</th>
                  <th className="text-left py-1 px-2">Entry key</th>
                  <th className="text-left py-1 px-2">Result</th>
                  <th className="text-left py-1 px-2">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50">
                    <td className="py-1 px-2 text-slate-300">{r.lane}</td>
                    <td className="py-1 px-2 text-slate-200">{r.contact_name || '—'}</td>
                    <td className="py-1 px-2 text-slate-400">{r.cycle_key}</td>
                    <td className="py-1 px-2 text-slate-500 font-mono truncate max-w-[160px]">{r.entry_key || '—'}</td>
                    <td className="py-1 px-2">
                      {r.eligibility === 'eligible'
                        ? <span className="text-emerald-400">eligible</span>
                        : <span className="text-amber-300">blocked: {r.block_reason}</span>}
                    </td>
                    <td className="py-1 px-2 text-slate-500">{new Date(r.would_send_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-[11px] text-slate-500 border-t border-slate-700/50 pt-3">
        Shadow scan only writes to <code className="text-slate-400">auto_send_shadow_log</code>. It never calls
        <code className="mx-1 text-slate-400">maytapi-send-1to1</code>, never marks birthdays congratulated,
        and never writes appreciation Done markers.
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
      <span className="text-sm text-white">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
