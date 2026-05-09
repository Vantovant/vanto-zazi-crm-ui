import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, RefreshCw, Check, X, Search, AlertTriangle, Loader2 } from 'lucide-react';

const OWNER_ID = 'b8028d7d-6a08-45ef-a369-b438c440bea3';

interface RescueRow {
  id: string;
  shadow_log_id: string | null;
  contact_id: string | null;
  lane: string;
  contact_name: string;
  old_phone: string;
  recovered_phone: string;
  recovered_full_name: string;
  recovered_aplgo_id: string;
  source_table: string;
  match_method: string;
  confidence: string;
  status: string;
  audit: any;
  created_at: string;
  resolved_at: string | null;
}

const TABS = [
  { key: 'recovered_auto', label: 'Recovered automatically' },
  { key: 'needs_review', label: 'Needs manual review' },
  { key: 'duplicate_conflict', label: 'Duplicate conflicts' },
  { key: 'orphan_birthday', label: 'Orphan birthdays' },
  { key: 'repaired_today', label: 'Repaired today' },
] as const;

export function PhoneRescueDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.id === OWNER_ID;
  const [rows, setRows] = useState<RescueRow[]>([]);
  const [tab, setTab] = useState<typeof TABS[number]['key']>('recovered_auto');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('phone_rescue_candidates')
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(500);
    setRows((data || []) as RescueRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  if (!isAdmin) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Phone className="w-4 h-4" /> Phone Rescue: Admin Only
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const filtered = rows.filter((r) => {
    if (tab === 'repaired_today') return r.status === 'promoted' && (r.resolved_at || '').slice(0, 10) === today;
    return r.status === tab;
  });

  const counts = TABS.reduce((acc, t) => {
    if (t.key === 'repaired_today') {
      acc[t.key] = rows.filter(r => r.status === 'promoted' && (r.resolved_at || '').slice(0, 10) === today).length;
    } else {
      acc[t.key] = rows.filter(r => r.status === t.key).length;
    }
    return acc;
  }, {} as Record<string, number>);

  async function runScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('phone-rescue-scan', { body: {} });
      setScanResult(error ? { error: error.message } : data);
      await fetchRows();
    } finally {
      setScanning(false);
    }
  }

  async function act(candidateId: string, action: 'promote' | 'reject' | 'retry') {
    setActing(candidateId + ':' + action);
    try {
      const { data, error } = await supabase.functions.invoke('phone-rescue-promote', {
        body: { candidate_id: candidateId, action },
      });
      if (error) alert(error.message);
      else if (!data?.ok) alert(data?.error || 'Action failed');
      await fetchRows();
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="bg-slate-900 border border-teal-700/40 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-teal-400" />
          <h3 className="text-white font-semibold">Phone Rescue + Auto-Link Repair</h3>
        </div>
        <button
          onClick={runScan} disabled={scanning}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Phone Rescue Scan
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Scans recent shadow rows blocked by <code className="text-slate-300">no_phone</code> or <code className="text-slate-300">unmatched_contact</code> across contacts, orders, activities, Maytapi inbox, and import history. Verified phone numbers are never overwritten.
      </p>

      {scanResult && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono overflow-x-auto">
          {JSON.stringify(scanResult)}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs rounded-t-lg ${tab === t.key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t.label} <span className="ml-1 text-slate-500">({counts[t.key] || 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-500 text-sm py-6 text-center">No rows in this category.</div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map((r) => (
            <div key={r.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-white font-medium">{r.contact_name || '(no name)'}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Lane: <span className="text-slate-200">{r.lane}</span> · Source: <span className="text-slate-200">{r.source_table || '—'}</span> · Method: <span className="text-slate-200">{r.match_method || '—'}</span> · Confidence: <span className={r.confidence === 'high' ? 'text-emerald-400' : r.confidence === 'medium' ? 'text-amber-400' : 'text-slate-400'}>{r.confidence}</span>
                  </div>
                  <div className="mt-1 text-xs">
                    <span className="text-slate-500">Old:</span> <span className="text-slate-300 font-mono">{r.old_phone || '—'}</span>
                    <span className="mx-2 text-slate-600">→</span>
                    <span className="text-slate-500">Recovered:</span> <span className="text-emerald-300 font-mono">{r.recovered_phone || '—'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.status !== 'promoted' && r.status !== 'rejected' && r.recovered_phone && r.contact_id && (
                    <button
                      onClick={() => act(r.id, 'promote')}
                      disabled={acting === r.id + ':promote'}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs px-2 py-1 rounded"
                    >
                      <Check className="w-3 h-3" /> Promote
                    </button>
                  )}
                  {r.status !== 'rejected' && r.status !== 'promoted' && (
                    <button
                      onClick={() => act(r.id, 'reject')}
                      disabled={acting === r.id + ':reject'}
                      className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded"
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                  )}
                  <button
                    onClick={() => act(r.id, 'retry')}
                    disabled={acting === r.id + ':retry'}
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2 py-1 rounded"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry Eligibility
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1"
                  >
                    {expanded === r.id ? 'Hide' : 'Audit'}
                  </button>
                </div>
              </div>
              {r.status === 'duplicate_conflict' && (
                <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" /> Multiple possible matches — review before promoting.
                </div>
              )}
              {expanded === r.id && (
                <pre className="mt-2 bg-black/40 border border-slate-800 rounded p-2 text-[10px] text-slate-300 overflow-x-auto">
                  {JSON.stringify(r.audit, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
