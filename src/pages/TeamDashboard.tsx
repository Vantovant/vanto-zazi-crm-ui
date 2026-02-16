import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  Activity,
  BarChart3,
  Clock,
  RefreshCw,
  Sparkles,
  UserCheck,
  ShoppingCart,
  Eye,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface UserStat {
  userId: string;
  displayName: string;
  joinedAt: string;
  lastActive: string | null;
  totalActions: number;
  contactsCreated: number;
  ordersCreated: number;
  pagesVisited: string[];
  pageFrequency: Record<string, number>;
}

export function TeamDashboard() {
  const [stats, setStats] = useState<UserStat[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-analytics', {
        body: { action: 'stats' },
      });
      if (error) throw error;
      setStats(data.stats || []);
    } catch (e) {
      console.error('Failed to load team stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiSummary = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-analytics', {
        body: { action: 'ai_summary' },
      });
      if (error) throw error;
      setStats(data.stats || []);
      setAiSummary(data.aiSummary || '');
    } catch (e) {
      console.error('Failed to load AI summary:', e);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const timeSince = (d: string | null) => {
    if (!d) return 'Never';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const totalTesters = stats.length;
  const activeTesters = stats.filter(s => s.totalActions > 0).length;
  const totalContacts = stats.reduce((sum, s) => sum + s.contactsCreated, 0);
  const totalOrders = stats.reduce((sum, s) => sum + s.ordersCreated, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-400" />
            Tester Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">Monitor tester activity & get AI-powered UX feedback</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={fetchAiSummary}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${aiLoading ? 'animate-pulse' : ''}`} />
            {aiLoading ? 'Analyzing...' : 'ZAZI UX Report'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Users className="w-4 h-4" />
            Total Testers
          </div>
          <p className="text-2xl font-bold text-white">{totalTesters}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Activity className="w-4 h-4" />
            Active Testers
          </div>
          <p className="text-2xl font-bold text-teal-400">{activeTesters}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <UserCheck className="w-4 h-4" />
            Contacts Created
          </div>
          <p className="text-2xl font-bold text-white">{totalContacts}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <ShoppingCart className="w-4 h-4" />
            Orders Created
          </div>
          <p className="text-2xl font-bold text-white">{totalOrders}</p>
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-teal-400 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            ZAZI UX Feedback Report
          </h3>
          <div className="prose prose-invert prose-sm max-w-none text-slate-300">
            <ReactMarkdown>{aiSummary}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Tester Table */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white">Tester Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase">
                <th className="px-4 py-3 text-left">Tester</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-left">Last Active</th>
                <th className="px-4 py-3 text-center">Actions</th>
                <th className="px-4 py-3 text-center">Contacts</th>
                <th className="px-4 py-3 text-center">Orders</th>
                <th className="px-4 py-3 text-left">Pages Visited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading tester data...
                  </td>
                </tr>
              ) : stats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No testers have signed up yet. Share your app link to get started.
                  </td>
                </tr>
              ) : (
                stats.map((s) => (
                  <tr key={s.userId} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-xs font-semibold">
                          {s.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-white font-medium">{s.displayName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(s.joinedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        s.lastActive && Date.now() - new Date(s.lastActive).getTime() < 3600000
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {timeSince(s.lastActive)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-white">{s.totalActions}</td>
                    <td className="px-4 py-3 text-center text-white">{s.contactsCreated}</td>
                    <td className="px-4 py-3 text-center text-white">{s.ordersCreated}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.pagesVisited.slice(0, 4).map(p => (
                          <span key={p} className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">
                            {p.replace('/', '') || 'home'}
                          </span>
                        ))}
                        {s.pagesVisited.length > 4 && (
                          <span className="text-xs text-slate-500">+{s.pagesVisited.length - 4}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
