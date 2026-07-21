import { useEffect, useState } from "react";
import { AlertTriangle, Play, Pause, Save, RefreshCw, Send, X } from "lucide-react";
import {
  useCampaignRecipients, runTick, loadCampaignSettings, saveCampaignSettings,
  type CampaignTable,
} from "@/hooks/useCampaignRecipients";

type TickFn = "birthday-campaign-tick" | "activation-campaign-tick" | "zoom-campaign-tick";

interface Props {
  title: string;
  description: string;
  table: CampaignTable;
  tickFn: TickFn;
  campaignKey: "birthday" | "activation" | "zoom";
  accent: string; // tailwind color hex-like class prefix, e.g. "pink"
  children?: React.ReactNode; // extra actions above table (e.g. import CSV)
}

export function CampaignModule({ title, description, table, tickFn, campaignKey, accent, children }: Props) {
  const { rows, loading, stats, refetch, remove, skip } = useCampaignRecipients(table);
  const [settings, setSettings] = useState<any>({ enabled: false, daily_cap: 40, per_tick_cap: 10 });
  const [savingSettings, setSavingSettings] = useState(false);
  const [running, setRunning] = useState<null | "dry" | "live">(null);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => { loadCampaignSettings(campaignKey).then(setSettings); }, [campaignKey]);

  const saveSettings = async () => {
    setSavingSettings(true);
    await saveCampaignSettings(campaignKey, {
      enabled: settings.enabled,
      daily_cap: Number(settings.daily_cap),
      per_tick_cap: Number(settings.per_tick_cap),
    });
    setSavingSettings(false);
  };

  const runNow = async (dryRun: boolean) => {
    setRunning(dryRun ? "dry" : "live");
    const { data, error } = await runTick(tickFn, { dry_run: dryRun });
    setLastResult(error ? { error: error.message } : data);
    setRunning(null);
    refetch();
  };

  const statCards = [
    { label: "Queued", value: stats.queued, color: "text-slate-200" },
    { label: "Sent", value: stats.sent, color: "text-emerald-400" },
    { label: "Delivered", value: stats.delivered, color: "text-blue-400" },
    { label: "Read", value: stats.read, color: "text-violet-400" },
    { label: "Replied", value: stats.replied, color: "text-amber-400" },
    { label: "Failed", value: stats.failed, color: "text-rose-400" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full bg-${accent}-500`} />
            {title}
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">{description}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button type="button" onClick={() => runNow(true)} disabled={running !== null}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg">
            <Play className="w-4 h-4" /> {running === "dry" ? "Running…" : "Dry-run tick"}
          </button>
          <button type="button" onClick={() => runNow(false)} disabled={running !== null || !settings.enabled}
            title={!settings.enabled ? "Enable the campaign first" : "Send now"}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm bg-${accent}-600 hover:bg-${accent}-500 disabled:opacity-40 text-white rounded-lg font-medium`}>
            <Send className="w-4 h-4" /> {running === "live" ? "Sending…" : "Run tick now"}
          </button>
        </div>
      </div>

      {/* Kill switch + caps */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={!!settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            className="w-4 h-4" />
          {settings.enabled ? <span className="text-emerald-400 font-medium">ENABLED</span> : <span className="text-rose-400 font-medium">DISABLED (kill switch)</span>}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Daily cap
          <input type="number" min={0} max={500} value={settings.daily_cap}
            onChange={(e) => setSettings({ ...settings, daily_cap: e.target.value })}
            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Per-tick cap
          <input type="number" min={0} max={100} value={settings.per_tick_cap}
            onChange={(e) => setSettings({ ...settings, per_tick_cap: e.target.value })}
            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white" />
        </label>
        <button type="button" onClick={saveSettings} disabled={savingSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded ml-auto">
          <Save className="w-4 h-4" /> {savingSettings ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {children}

      {lastResult && (
        <div className={`rounded-xl border p-3 text-sm ${lastResult.error ? "bg-rose-500/10 border-rose-500/30 text-rose-300" : lastResult.blocked ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"}`}>
          {lastResult.error && <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {lastResult.error}</div>}
          {lastResult.blocked && <div>Blocked: {lastResult.blocked}</div>}
          {!lastResult.error && !lastResult.blocked && (
            <div>
              {lastResult.dryRun ? "Dry-run" : "Send"} complete — processed {lastResult.processed}, sent {lastResult.sent}, skipped {lastResult.skipped}, failed {lastResult.failed}.
            </div>
          )}
        </div>
      )}

      {/* Recipients table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Recipients ({rows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Sent</th>
                <th className="px-4 py-2 text-left">Reply</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No recipients yet.</td></tr>}
              {rows.map(r => (
                <tr key={r.id} className="border-t border-slate-700/50 hover:bg-slate-900/30">
                  <td className="px-4 py-2 text-slate-200">{r.name || r.first_name || "—"}</td>
                  <td className="px-4 py-2 text-slate-400 font-mono text-xs">{r.phone_normalized}</td>
                  <td className="px-4 py-2">
                    <StatusBadge row={r} />
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">{r.sent_at ? new Date(r.sent_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2 text-xs text-amber-300 max-w-xs truncate">{r.reply_preview ?? (r.replied_at ? "(reply)" : "—")}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {r.status === "queued" && (
                        <button type="button" onClick={() => skip(r.id)} className="p-1 hover:bg-slate-700 rounded" title="Skip">
                          <Pause className="w-4 h-4 text-slate-400" />
                        </button>
                      )}
                      <button type="button" onClick={() => remove(r.id)} className="p-1 hover:bg-slate-700 rounded" title="Delete">
                        <X className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ row }: { row: any }) {
  if (row.replied_at) return <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded">replied</span>;
  if (row.read_at)    return <span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded">read</span>;
  if (row.delivered_at) return <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded">delivered</span>;
  if (row.status === "sent") return <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 rounded">sent</span>;
  if (row.status === "failed") return <span className="px-2 py-0.5 text-xs bg-rose-500/20 text-rose-300 rounded">failed</span>;
  if (row.status === "skipped") return <span className="px-2 py-0.5 text-xs bg-slate-500/20 text-slate-400 rounded">skipped</span>;
  return <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">{row.status}</span>;
}
