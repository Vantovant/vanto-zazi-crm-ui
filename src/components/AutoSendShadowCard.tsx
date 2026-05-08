/**
 * Phase Auto-Send — Phase 1 SHADOW MODE + Phase 1.5 MICRO-LIVE PILOT.
 *
 * Hard guarantees:
 *   - Card mounts admin-only (Vanto). Defense-in-depth: Micro-Live block has
 *     its OWN admin gate; non-admin sees a read-only "Admin Only" label.
 *   - Shadow scan never invokes maytapi-send-1to1 and never writes Done markers.
 *   - Micro-Live Run button is DISABLED unless every gate passes; the button
 *     label dynamically explains the current blocker.
 *   - Pre-flight summary modal must be confirmed ("CONFIRM MICRO-LIVE") before
 *     any real send is triggered.
 *   - Per-attempt failure reasons are surfaced in "Last Micro-Live Attempt Results".
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldAlert, Play, RefreshCw, Zap, AlertTriangle, X } from 'lucide-react';
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
  auto_send_quiet_start_hour: number;
  auto_send_quiet_end_hour: number;
}

interface MicroLiveSend {
  id: string;
  contact_id: string | null;
  intended_send_type: string;
  maytapi_message_id: string | null;
  attempted_at: string;
  request_status: string;
}

interface MicroAttempt {
  lane: string;
  contact_id?: string;
  contact_name?: string;
  entry_key?: string;
  skipped?: string;
  reason?: string;
  ok?: boolean;
  message_id?: string | null;
  at?: string;
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

function sastHourNow() {
  const sast = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return sast.getUTCHours();
}

export function AutoSendShadowCard() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<AutoSettings | null>(null);
  const [rows, setRows] = useState<ShadowRow[]>([]);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');
  const [capDraft, setCapDraft] = useState('10');
  const [microCapDraft, setMicroCapDraft] = useState('3');
  const [allowDraft, setAllowDraft] = useState('');
  const [microSends, setMicroSends] = useState<MicroLiveSend[]>([]);
  const [microRunning, setMicroRunning] = useState(false);
  const [microResult, setMicroResult] = useState<string>('');
  const [microSentToday, setMicroSentToday] = useState(0);
  const [lastAttempts, setLastAttempts] = useState<MicroAttempt[]>([]);
  const [showPreflight, setShowPreflight] = useState(false);
  const [preflightConfirm, setPreflightConfirm] = useState('');

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
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const [{ data: s }, { data: r }, { data: mSends }, { data: cs }] = await Promise.all([
      (supabase.from('integration_settings') as any)
        .select('auto_send_enabled, auto_send_birthdays_enabled, auto_send_appreciation_enabled, auto_send_daily_cap, auto_send_micro_live_enabled, auto_send_micro_live_daily_cap, auto_send_micro_live_contact_allowlist, auto_send_quiet_start_hour, auto_send_quiet_end_hour')
        .eq('user_id', user.id).maybeSingle(),
      (supabase.from('auto_send_shadow_log') as any)
        .select('id, lane, contact_name, entry_key, cycle_key, dedupe_key, eligibility, block_reason, would_send_at, message_style')
        .eq('user_id', user.id)
        .order('would_send_at', { ascending: false })
        .limit(50),
      (supabase.from('prospector_send_log') as any)
        .select('id, contact_id, intended_send_type, maytapi_message_id, attempted_at, request_status')
        .eq('user_id', user.id)
        .eq('mode', 'auto_micro_live')
        .order('attempted_at', { ascending: false })
        .limit(10),
      (supabase.from('contacts') as any)
        .select('id, full_name')
        .eq('user_id', user.id),
    ]);
    const allow: string[] = Array.isArray(s?.auto_send_micro_live_contact_allowlist) ? s.auto_send_micro_live_contact_allowlist : [];
    setSettings({
      auto_send_enabled: !!s?.auto_send_enabled,
      auto_send_birthdays_enabled: !!s?.auto_send_birthdays_enabled,
      auto_send_appreciation_enabled: !!s?.auto_send_appreciation_enabled,
      auto_send_daily_cap: typeof s?.auto_send_daily_cap === 'number' ? s.auto_send_daily_cap : 10,
      auto_send_micro_live_enabled: !!s?.auto_send_micro_live_enabled,
      auto_send_micro_live_daily_cap: typeof s?.auto_send_micro_live_daily_cap === 'number' ? s.auto_send_micro_live_daily_cap : 3,
      auto_send_micro_live_contact_allowlist: allow,
      auto_send_quiet_start_hour: typeof s?.auto_send_quiet_start_hour === 'number' ? s.auto_send_quiet_start_hour : 8,
      auto_send_quiet_end_hour: typeof s?.auto_send_quiet_end_hour === 'number' ? s.auto_send_quiet_end_hour : 19,
    });
    setCapDraft(String(s?.auto_send_daily_cap ?? 10));
    setMicroCapDraft(String(s?.auto_send_micro_live_daily_cap ?? 3));
    setAllowDraft(allow.join(', '));
    setRows((r as ShadowRow[]) || []);
    const sends = (mSends as MicroLiveSend[]) || [];
    setMicroSends(sends);
    setMicroSentToday(sends.filter(x => x.request_status === 'ok' && new Date(x.attempted_at) >= startOfDay).length);
    const nameMap: Record<string, string> = {};
    for (const c of (cs as any[]) || []) nameMap[c.id] = c.full_name || '';
    setContactNames(nameMap);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const updateSetting = async (patch: Partial<AutoSettings>) => {
    if (!user || !settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await (supabase.from('integration_settings') as any).update(patch).eq('user_id', user.id);
  };

  // ── Pre-flight gate: compute blocker reason for the Run button ──
  const remaining = settings ? Math.max(0, settings.auto_send_micro_live_daily_cap - microSentToday) : 0;
  const blocker = useMemo(() => {
    if (!settings) return 'loading';
    if (!settings.auto_send_enabled) return 'Enable Master first';
    if (!settings.auto_send_birthdays_enabled && !settings.auto_send_appreciation_enabled) return 'Enable a lane';
    if (!settings.auto_send_micro_live_enabled) return 'MICRO-LIVE OFF';
    if (settings.auto_send_micro_live_daily_cap < 1) return 'Cap invalid';
    if (settings.auto_send_micro_live_contact_allowlist.length === 0) return 'Add allowlist first';
    const h = sastHourNow();
    if (!(h >= settings.auto_send_quiet_start_hour && h < settings.auto_send_quiet_end_hour)) return 'Quiet hours blocked';
    if (remaining <= 0) return 'Daily cap reached';
    return '';
  }, [settings, remaining]);

  const openPreflight = () => {
    if (blocker) return;
    setPreflightConfirm('');
    setShowPreflight(true);
  };

  const runMicroLive = async () => {
    setShowPreflight(false);
    setMicroRunning(true);
    setMicroResult('');
    setLastAttempts([]);
    const { data, error } = await supabase.functions.invoke('auto-send-micro-live');
    setMicroRunning(false);
    if (error) {
      setMicroResult(`Error: ${error.message}`);
    } else if (data?.blocked) {
      setMicroResult(`Blocked: ${data.blocked}`);
    } else {
      const sent = data?.sent_today ?? 0;
      const att: MicroAttempt[] = Array.isArray(data?.attempts) ? data.attempts : [];
      const stamped = att.map((a) => ({
        ...a,
        contact_name: a.contact_id ? (contactNames[a.contact_id] || a.contact_id.slice(0, 8)) : '—',
        at: new Date().toISOString(),
      }));
      setLastAttempts(stamped);
      setMicroResult(`Done. Sent today: ${sent}/${data?.cap ?? 3}. Attempts: ${att.length}.`);
    }
    load();
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

  const lanesLabel = [
    settings.auto_send_birthdays_enabled ? 'Birthday' : null,
    settings.auto_send_appreciation_enabled ? 'Appreciation' : null,
  ].filter(Boolean).join(' / ') || 'None';

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

      {/* ─────────── Phase 1.5 — MICRO-LIVE PILOT (admin-only inner gate) ─────────── */}
      {isAdmin ? (
        <div className="border-2 border-red-500/60 bg-red-950/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-400" />
              <h3 className="text-sm font-bold text-red-200">Phase 1.5 — MICRO-LIVE PILOT</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-500/20 text-red-200 border border-red-500/40 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              MAX {settings.auto_send_micro_live_daily_cap} — ALLOWLIST ONLY
            </span>
          </div>
          <p className="text-[11px] text-red-200/80">
            Sends REAL WhatsApp messages. Requires Master + Lane + MICRO-LIVE all ON, and contact must be on phone allowlist OR contact-ID allowlist.
            Birthdays: today only. Appreciation: each Activity entry, current month, not yet Done.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Toggle label="MICRO-LIVE enabled" checked={settings.auto_send_micro_live_enabled}
              onChange={(v) => updateSetting({ auto_send_micro_live_enabled: v })} />
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
              <div className="text-sm text-white">Micro-live cap</div>
              <div className="flex gap-2 items-center">
                <input type="number" min={1} max={10} value={microCapDraft}
                  onChange={(e) => setMicroCapDraft(e.target.value)}
                  className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white" />
                <button
                  onClick={() => updateSetting({ auto_send_micro_live_daily_cap: Math.max(1, Math.min(10, parseInt(microCapDraft, 10) || 3)) })}
                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded">Save</button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/50 rounded-lg space-y-1">
            <div className="text-xs text-slate-300">Contact-ID allowlist (comma-separated UUIDs)</div>
            <div className="flex gap-2">
              <input type="text" value={allowDraft} onChange={(e) => setAllowDraft(e.target.value)}
                placeholder="uuid, uuid, uuid"
                className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white font-mono" />
              <button
                onClick={() => {
                  const ids = allowDraft.split(',').map(s => s.trim()).filter(s => /^[0-9a-f-]{36}$/i.test(s));
                  updateSetting({ auto_send_micro_live_contact_allowlist: ids });
                  setAllowDraft(ids.join(', '));
                }}
                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded">Save</button>
            </div>
            <div className="text-[10px] text-slate-500">{settings.auto_send_micro_live_contact_allowlist.length} contact(s) allowlisted. Phone allowlist also accepted.</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={openPreflight} disabled={microRunning || !!blocker}
              title={blocker || 'Open pre-flight summary'}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
              {microRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {blocker || 'Run Micro-Live Now'}
            </button>
            <span className="text-xs text-slate-300">
              Sent today: <strong className="text-white">{microSentToday}</strong> / {settings.auto_send_micro_live_daily_cap}
              {' · '}Remaining: <strong className="text-white">{remaining}</strong>
            </span>
            {microResult && <span className="text-xs text-amber-300">{microResult}</span>}
          </div>

          {/* Last Micro-Live Attempt Results */}
          {lastAttempts.length > 0 && (
            <div className="bg-slate-900/60 rounded-lg p-3 space-y-1">
              <div className="text-xs font-semibold text-white mb-1">Last Micro-Live Attempt Results</div>
              {lastAttempts.map((a, i) => {
                const reason = a.skipped || a.reason;
                const ok = a.ok && a.message_id;
                return (
                  <div key={i} className="text-[11px] flex justify-between gap-2 px-2 py-1 bg-slate-950/50 rounded">
                    <span className="text-slate-300">
                      <span className="font-mono text-slate-500">{a.lane}</span>
                      {' · '}
                      <span className="text-slate-200">{a.contact_name}</span>
                      {a.entry_key && <span className="text-slate-500 font-mono"> · {a.entry_key}</span>}
                    </span>
                    <span className={ok ? 'text-emerald-400' : 'text-amber-300'}>
                      {ok ? `sent (${(a.message_id || '').slice(0, 10)})` : (reason || 'unknown')}
                    </span>
                    <span className="text-slate-500 whitespace-nowrap">{a.at ? new Date(a.at).toLocaleTimeString() : ''}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-slate-300 mb-1">Last 10 micro-live sends (audit)</div>
            {microSends.length === 0 ? (
              <div className="text-[11px] text-slate-500 italic">No micro-live sends yet.</div>
            ) : (
              <div className="space-y-1">
                {microSends.map(s => (
                  <div key={s.id} className="text-[11px] text-slate-400 flex justify-between gap-2 px-2 py-1 bg-slate-900/50 rounded">
                    <span className="font-mono truncate">
                      {s.intended_send_type} · {s.contact_id ? (contactNames[s.contact_id] || s.contact_id.slice(0,8)) : '—'}
                    </span>
                    <span className={s.request_status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{s.request_status}</span>
                    <span className="text-slate-500">{new Date(s.attempted_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="border-2 border-slate-700 bg-slate-900/40 rounded-xl p-4 text-center">
          <div className="text-sm font-semibold text-slate-300">Micro-Live Pilot: Admin Only</div>
          <div className="text-[11px] text-slate-500 mt-1">Sign in as the Vanto admin to access live sending controls.</div>
        </div>
      )}

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

      {/* ─────────── PRE-FLIGHT MODAL ─────────── */}
      {showPreflight && settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowPreflight(false)}>
          <div className="bg-slate-900 border-2 border-red-500 rounded-xl max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Pre-flight: MICRO-LIVE
              </h3>
              <button onClick={() => setShowPreflight(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-sm text-slate-200 space-y-1">
              <p>You are about to send up to <strong className="text-white">{remaining}</strong> real WhatsApp messages today.</p>
              <ul className="text-xs text-slate-300 list-disc pl-5">
                <li>Lane(s): <strong className="text-white">{lanesLabel}</strong></li>
                <li>Allowlisted contacts: <strong className="text-white">{settings.auto_send_micro_live_contact_allowlist.length}</strong></li>
                <li>Cap: <strong className="text-white">{settings.auto_send_micro_live_daily_cap}</strong> · Sent today: <strong className="text-white">{microSentToday}</strong> · Remaining: <strong className="text-white">{remaining}</strong></li>
                <li>Quiet hours: {settings.auto_send_quiet_start_hour}:00–{settings.auto_send_quiet_end_hour}:00 SAST</li>
              </ul>
              <p className="text-[11px] text-red-300 mt-2">This cannot be bulk undo. Type <strong>CONFIRM MICRO-LIVE</strong> below.</p>
            </div>
            <input type="text" value={preflightConfirm}
              onChange={(e) => setPreflightConfirm(e.target.value)}
              placeholder="CONFIRM MICRO-LIVE"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white font-mono" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowPreflight(false)}
                className="px-3 py-2 text-sm text-slate-300 hover:text-white">Cancel</button>
              <button onClick={runMicroLive} disabled={preflightConfirm.trim() !== 'CONFIRM MICRO-LIVE'}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded disabled:opacity-40 disabled:cursor-not-allowed">
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
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
