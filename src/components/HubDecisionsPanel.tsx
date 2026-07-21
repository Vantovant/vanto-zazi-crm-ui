import { useEffect, useMemo, useState } from 'react';
import { Loader2, Radio, ShieldAlert, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type CampaignKey = 'birthday' | 'activation' | 'zoom';

interface HubDecisionRow {
  id: string;
  campaign: CampaignKey;
  phone_normalized: string;
  status: string;
  hub_decision: Record<string, unknown> | null;
  created_at: string;
  sent_at: string | null;
}

const CAMPAIGN_TABLES: { key: CampaignKey; table: string; label: string }[] = [
  { key: 'birthday', table: 'birthday_campaign_recipients', label: 'Birthday' },
  { key: 'activation', table: 'activation_campaign_recipients', label: 'Activation' },
  { key: 'zoom', table: 'zoom_campaign_recipients', label: 'Zoom' },
];

function last4(phone: string): string {
  const s = (phone ?? '').replace(/\D/g, '');
  return s.slice(-4);
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function HubDecisionsPanel({ isAdmin }: { isAdmin: boolean | null }) {
  const [rows, setRows] = useState<HubDecisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | CampaignKey>('all');

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    const all: HubDecisionRow[] = [];
    for (const { key, table, label } of CAMPAIGN_TABLES) {
      const { data, error } = await (supabase.from(table as any) as any)
        .select('id, phone_normalized, status, hub_decision, created_at, sent_at')
        .not('hub_decision', 'is', null)
        .order('sent_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) continue;
      (data ?? []).forEach((r: any) => {
        all.push({ ...r, campaign: key });
      });
    }
    all.sort((a, b) => {
      const ta = new Date(a.sent_at ?? a.created_at).getTime();
      const tb = new Date(b.sent_at ?? b.created_at).getTime();
      return tb - ta;
    });
    setRows(all);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter(r => r.campaign === filter);
  }, [rows, filter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const blocked = rows.filter(r => (r.hub_decision as any)?.allowed === false).length;
    const allowed = rows.filter(r => (r.hub_decision as any)?.allowed === true).length;
    const errors = rows.filter(r => (r.hub_decision as any)?.error).length;
    return { total, blocked, allowed, errors };
  }, [rows]);

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking access…
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-slate-300">
        Hub decisions are admin-only.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Total decisions', val: stats.total, icon: Radio, cls: 'text-blue-300 bg-blue-500/10 border-blue-500/30' },
          { label: 'Allowed', val: stats.allowed, icon: CheckCircle2, cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
          { label: 'Blocked', val: stats.blocked, icon: ShieldAlert, cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
          { label: 'Hub errors', val: stats.errors, icon: XCircle, cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30' },
        ].map(s => (
          <div key={s.label} className={`rounded-md border p-2.5 ${s.cls}`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-80">
              <s.icon className="w-3 h-3" /> {s.label}
            </div>
            <div className="text-lg font-semibold leading-none mt-1">{s.val}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'all', label: 'All campaigns' },
          { id: 'birthday', label: 'Birthday' },
          { id: 'activation', label: 'Activation' },
          { id: 'zoom', label: 'Zoom' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id as any)}
            className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
              filter === t.id
                ? 'bg-slate-100 text-slate-900 border-slate-100 font-medium'
                : 'bg-slate-900/40 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto text-[11px] px-2.5 py-1 rounded border border-slate-700 bg-slate-900/40 text-slate-300 hover:text-slate-100 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="rounded-lg border border-slate-700/70 bg-slate-900/30 overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading hub decisions…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-slate-300">
            <Radio className="w-7 h-7 text-slate-500 mb-2" />
            <p>No hub decisions logged yet.</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Shadow-mode decisions appear once campaign sends reach the VantoOS hub.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wide text-[10px]">
                <tr>
                  <th className="px-3 py-2 font-medium">Campaign</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Latency</th>
                  <th className="px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map(r => {
                  const d = (r.hub_decision ?? {}) as any;
                  const action = d.action ?? 'unknown';
                  const allowed = d.allowed;
                  const reason = d.reason ?? d.error ?? '—';
                  return (
                    <tr key={`${r.campaign}-${r.id}`} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2 capitalize text-slate-200">{r.campaign}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">••••{last4(r.phone_normalized)}</td>
                      <td className="px-3 py-2 text-slate-300">{action}</td>
                      <td className="px-3 py-2">
                        {allowed === true ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="w-3 h-3" /> allowed</span>
                        ) : allowed === false ? (
                          <span className="inline-flex items-center gap-1 text-amber-300"><ShieldAlert className="w-3 h-3" /> blocked</span>
                        ) : d.error ? (
                          <span className="inline-flex items-center gap-1 text-rose-300"><XCircle className="w-3 h-3" /> error</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-400 max-w-[200px] truncate" title={reason}>{reason}</td>
                      <td className="px-3 py-2 text-slate-400">{typeof d.ms === 'number' ? `${d.ms}ms` : '—'}</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap"><Clock className="w-3 h-3 inline mr-1" />{relTime(r.sent_at ?? r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
