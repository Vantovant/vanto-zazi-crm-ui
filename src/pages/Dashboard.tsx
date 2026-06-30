import {
  Users,
  Flame,
  Thermometer,
  Snowflake,
  UserCheck,
  Phone,
  MessageCircle,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  ShoppingCart,
  Newspaper,
  Sparkles,
  Loader2,
  RefreshCw,
  Cake,
  ArrowLeft,
  Home,
} from 'lucide-react';
import { DataStatusBanner } from '../components/DataStatusBanner';
import { ContactDrawer } from '../components/ContactDrawer';
import { useCrm } from '@/contexts/CrmContext';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState, useCallback } from 'react';
import { useContactActivities } from '@/hooks/useContactActivities';
import { useBirthdayCounts } from '@/hooks/useBirthdayCounts';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

const kpiCardsMeta = [
  { label: 'Total Prospects', key: 'totalProspects' as const, icon: Users, color: 'bg-slate-600' },
  { label: 'Hot Leads', key: 'hotLeads' as const, icon: Flame, color: 'bg-rose-500' },
  { label: 'Warm Leads', key: 'warmLeads' as const, icon: Thermometer, color: 'bg-amber-500' },
  { label: 'Cold Leads', key: 'coldLeads' as const, icon: Snowflake, color: 'bg-sky-500' },
  { label: 'Registered', key: 'registered' as const, icon: UserCheck, color: 'bg-emerald-500' },
];

const temperatureColors: Record<string, string> = {
  Hot: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  Warm: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Cold: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { contacts: prospects, orders, dbActive, contactsLoading, ordersLoading } = useCrm();
  const { activities, getNeglectedContacts } = useContactActivities();
  const { counts: bdCounts } = useBirthdayCounts();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [newsContent, setNewsContent] = useState('');
  const [newsLoading, setNewsLoading] = useState(false);

  const selectedProspect = useMemo(() => {
    if (!selectedContactId) return null;
    return prospects.find(p => String(p.id) === selectedContactId) || null;
  }, [selectedContactId, prospects]);

  const stats = useMemo(() => ({
    totalProspects: prospects.length,
    hotLeads: prospects.filter(p => p.LeadTemperature === 'Hot').length,
    warmLeads: prospects.filter(p => p.LeadTemperature === 'Warm').length,
    coldLeads: prospects.filter(p => p.LeadTemperature === 'Cold').length,
    registered: prospects.filter(p => p.RegistrationStatus === 'Registered' || p.RegistrationStatus === 'Activated').length,
  }), [prospects]);

  const orderStats = useMemo(() => {
    const totalRevenue = orders.reduce((s, o) => s + o.amount, 0);
    const paidTotal = orders.filter(o => ['Paid', 'Delivered', 'Activated'].includes(o.status)).reduce((s, o) => s + o.amount, 0);
    const pendingTotal = orders.filter(o => o.status === 'Pending').reduce((s, o) => s + o.amount, 0);
    const activityPV = orders.filter(o => o.purchaseType === 'Activity').reduce((s, o) => s + (o.pvAmount || 0), 0);
    const upgradePV = orders.filter(o => o.purchaseType === 'Upgrade').reduce((s, o) => s + (o.pvAmount || 0), 0);
    return { totalRevenue, paidTotal, pendingTotal, activityPV, upgradePV, count: orders.length };
  }, [orders]);

  const recentProspects = prospects.slice(0, 5);

  // Derive follow-ups from contacts with NextAction set
  const followUps = useMemo(() => {
    return prospects
      .filter(p => p.NextAction && p.NextAction.trim() !== '')
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        name: p.FullName,
        action: p.NextAction,
        temperature: p.LeadTemperature,
      }));
  }, [prospects]);

  // Derive meetings from contacts with MeetingTime set
  const meetings = useMemo(() => {
    return prospects
      .filter(p => p.MeetingTime && p.MeetingTime.trim() !== '')
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        name: p.FullName,
        time: p.MeetingTime,
        type: p.FocusArea || 'Meeting',
      }));
  }, [prospects]);

  // Hot leads needing action
  const hotLeadsNeedingAction = useMemo(() => {
    return prospects
      .filter(p => p.LeadTemperature === 'Hot' && p.CommunicationStatus !== 'Completed')
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        name: p.FullName,
        status: p.CommunicationStatus || 'Needs Contact',
        nextAction: p.NextAction || 'No action set',
      }));
  }, [prospects]);

  // Recent orders for activity feed
  const recentOrderActivity = useMemo(() => {
    return orders.slice(0, 4).map(o => ({
      id: o.contactId || o.id,
      type: 'order' as const,
      contact: o.contactName,
      description: `${o.product} — R${o.amount.toLocaleString()} (${o.status})`,
      time: o.orderDate,
    }));
  }, [orders]);

  // Recent contacts added for activity feed
  const recentContactActivity = useMemo(() => {
    return prospects.slice(0, 3).map(p => ({
      id: p.id,
      type: (p.ActionTaken?.toLowerCase().includes('whatsapp') ? 'whatsapp'
        : p.ActionTaken?.toLowerCase().includes('call') ? 'call'
        : p.ActionTaken?.toLowerCase().includes('meeting') ? 'meeting'
        : 'note') as 'whatsapp' | 'call' | 'meeting' | 'note',
      contact: p.FullName,
      description: p.ActionTaken || `Added as ${p.LeadType}`,
      time: p.DateCaptured,
    }));
  }, [prospects]);

  // Merge and sort recent activity
  const recentActivity = useMemo(() => {
    const all = [...recentOrderActivity, ...recentContactActivity];
    return all.slice(0, 6);
  }, [recentOrderActivity, recentContactActivity]);

  const activityIcons: Record<string, typeof Phone> = {
    whatsapp: MessageCircle,
    call: Phone,
    meeting: Calendar,
    order: ShoppingCart,
    note: CheckCircle,
  };

  const activityColors: Record<string, string> = {
    whatsapp: 'bg-green-500/20 text-green-400',
    call: 'bg-cyan-500/20 text-cyan-400',
    meeting: 'bg-violet-500/20 text-violet-400',
    order: 'bg-teal-500/20 text-teal-400',
    note: 'bg-slate-500/20 text-slate-400',
  };

  const loading = contactsLoading || ordersLoading;

  const neglectedContacts = useMemo(() => getNeglectedContacts(7), [getNeglectedContacts]);

  const handleGenerateNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsContent('');

    const crmSummary = {
      totalContacts: prospects.length,
      hotLeads: prospects.filter(p => p.LeadTemperature === 'Hot').length,
      warmLeads: prospects.filter(p => p.LeadTemperature === 'Warm').length,
      registered: prospects.filter(p => p.RegistrationStatus === 'Registered' || p.RegistrationStatus === 'Activated').length,
      totalOrders: orders.length,
      totalActivities: activities.length,
      neglectedCount: neglectedContacts.length,
      recentActivities: activities.slice(0, 10).map(a => ({
        type: a.activity_type, summary: a.summary, date: a.created_at,
      })),
      recentOrders: orders.slice(0, 5).map(o => ({
        product: o.product, amount: o.amount, contact: o.contactName, status: o.status, date: o.orderDate,
      })),
      topProspects: prospects.slice(0, 5).map(p => ({
        name: p.FullName, temperature: p.LeadTemperature, type: p.LeadType, status: p.RegistrationStatus,
      })),
    };

    try {
      const resp = await supabase.functions.invoke('zazi-copilot', {
        body: {
          action: 'business_insight',
          message: `You are ZAZI Mail — an AI journalist for this CRM user. Write a short, engaging news briefing (like a newsletter) covering:

1. **📊 CRM Activity Digest** — What's happened recently: contacts added, activities logged, orders placed. Highlight key numbers.
2. **🏆 Team Milestones** — Any contacts that got registered, activated, or upgraded. Celebrate wins.
3. **💡 MLM Growth Tip** — One actionable APLGO/network marketing tip for today.
4. **🚀 Platform Update** — Mention that ZAZI AI now suggests WhatsApp messages, tracks relationship health, and logs activities with timestamps.
5. **⚠️ Action Required** — Neglected contacts or hot leads that need attention.

Keep it punchy, motivational, and formatted with emojis and headers. Max 300 words. Use the user's real CRM data provided.`,
          crmSummary,
        },
      });

      if (resp.error) throw resp.error;

      const text = typeof resp.data === 'string' ? resp.data : await new Response(resp.data).text();
      let result = '';
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') break;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) result += content;
        } catch {}
      }
      setNewsContent(result || 'No news available at this time.');
    } catch (e) {
      console.error('News generation error:', e);
      setNewsContent('Unable to generate news briefing. Please try again.');
    }
    setNewsLoading(false);
  }, [prospects, orders, activities, neglectedContacts]);
  return (
    <div className="space-y-6">
      <DataStatusBanner dbActive={dbActive} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Loading...' : 'Welcome back. Here\'s your daily overview.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition"
            title="Back to GetWell Grow homepage"
          >
            <ArrowLeft className="w-4 h-4" /> Back to homepage
          </a>
          <div className="hidden sm:block text-sm text-slate-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCardsMeta.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`${kpi.color} p-2 rounded-lg`}>
                <kpi.icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stats[kpi.key]}</p>
            <p className="text-xs font-medium text-slate-400 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Order Revenue Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-teal-500/20 p-1.5 rounded-lg">
              <ShoppingCart className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <span className="text-xs font-medium text-slate-400">Total Orders</span>
          </div>
          <p className="text-xl font-bold text-white">{orderStats.count}</p>
          <p className="text-xs text-slate-500 mt-0.5">R{orderStats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-cyan-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-cyan-500/20 p-1.5 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="text-xs font-medium text-cyan-400">Paid</span>
          </div>
          <p className="text-xl font-bold text-cyan-300">R{orderStats.paidTotal.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-amber-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-amber-500/20 p-1.5 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xs font-medium text-amber-400">Pending</span>
          </div>
          <p className="text-xl font-bold text-amber-300">R{orderStats.pendingTotal.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-teal-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-teal-500/20 p-1.5 rounded-lg">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <span className="text-xs font-medium text-teal-400">Activity PV</span>
          </div>
          <p className="text-xl font-bold text-teal-300">{orderStats.activityPV.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-violet-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-violet-500/20 p-1.5 rounded-lg">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-xs font-medium text-violet-400">Upgrade PV</span>
          </div>
          <p className="text-xl font-bold text-violet-300">{orderStats.upgradePV.toLocaleString()}</p>
        </div>
      </div>

      {/* Birthday Notification Widget */}
      {bdCounts.pending > 0 && (
        <div className="bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-pink-500/20">
                <Cake className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Birthday Reminders</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {bdCounts.pending} birthday{bdCounts.pending !== 1 ? 's' : ''} need{bdCounts.pending === 1 ? 's' : ''} attention
                </p>
              </div>
            </div>
            <button type="button" onClick={() => navigate('/whatsapp')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors">
              <Cake className="w-3.5 h-3.5" />
              Open Birthdays
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3 mt-3">
            {[
              { label: '🎉 Today', count: bdCounts.today, color: 'text-rose-400' },
              { label: '⏰ Tomorrow', count: bdCounts.tomorrow, color: 'text-amber-400' },
              { label: '📅 This Week', count: bdCounts.thisWeek, color: 'text-blue-400' },
              { label: '⚠️ Overdue', count: bdCounts.overdue, color: 'text-red-400' },
            ].map(n => (
              <div key={n.label} className="text-center">
                <p className={`text-lg font-bold ${n.color}`}>{n.count}</p>
                <p className="text-xs text-slate-500">{n.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ZAZI Mail — AI News Briefing */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/20">
              <Newspaper className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">ZAZI Mail</h3>
              <p className="text-xs text-slate-500">Your AI news journalist</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerateNews}
            disabled={newsLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {newsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {newsContent ? 'Refresh' : 'Get Briefing'}
          </button>
        </div>
        {newsLoading ? (
          <div className="p-6 flex items-center gap-3 text-violet-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">ZAZI is writing your briefing...</span>
          </div>
        ) : newsContent ? (
          <div className="p-5 prose prose-sm prose-invert max-w-none text-slate-300 max-h-80 overflow-y-auto">
            <ReactMarkdown>{newsContent}</ReactMarkdown>
          </div>
        ) : (
          <div className="p-6 text-center">
            <Sparkles className="w-8 h-8 text-violet-500/50 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Click <span className="text-violet-400 font-medium">"Get Briefing"</span> for your personalized CRM news, team milestones, and growth tips.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Focus - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            Today's Focus
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Follow-ups Due */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Follow-ups Due</h3>
                <span className="text-xs font-medium text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
                  {followUps.length}
                </span>
              </div>
              <div className="divide-y divide-slate-700/50">
                {followUps.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-slate-500">No follow-ups pending</p>
                  </div>
                ) : followUps.map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelectedContactId(String(item.id))}>
                    <p className="text-sm font-medium text-slate-200">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.action}</p>
                    <span className={`inline-block mt-1.5 text-xs font-medium px-1.5 py-0.5 rounded border ${temperatureColors[item.temperature] || ''}`}>
                      {item.temperature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scheduled Meetings */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Meetings</h3>
                <span className="text-xs font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                  {meetings.length}
                </span>
              </div>
              <div className="divide-y divide-slate-700/50">
                {meetings.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-slate-500">No meetings scheduled</p>
                  </div>
                ) : meetings.map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelectedContactId(String(item.id))}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-200">{item.name}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.type}</p>
                    <p className="text-xs text-teal-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{item.time}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hot Leads Needing Action */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Hot Leads</h3>
                <span className="text-xs font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                  {hotLeadsNeedingAction.length}
                </span>
              </div>
              <div className="divide-y divide-slate-700/50">
                {hotLeadsNeedingAction.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-slate-500">No hot leads needing action</p>
                  </div>
                ) : hotLeadsNeedingAction.map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelectedContactId(String(item.id))}>
                    <p className="text-sm font-medium text-slate-200">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.status}</p>
                    <p className="text-xs text-amber-400 mt-1">{item.nextAction}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Prospects Table */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden mt-6">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-white">Recent Prospects</h3>
              <button
                type="button"
                onClick={() => navigate('/contacts')}
                className="text-xs font-medium text-teal-400 hover:text-teal-300 flex items-center gap-1"
              >
                View All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Phone</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Temp</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Type</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Focus</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {recentProspects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        No contacts yet. Add your first contact to get started.
                      </td>
                    </tr>
                  ) : recentProspects.map((prospect) => (
                    <tr key={prospect.id} className="hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelectedContactId(String(prospect.id))}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-200">{prospect.FullName}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{prospect.PhoneNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${temperatureColors[prospect.LeadTemperature] || ''}`}>
                          {prospect.LeadTemperature}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{prospect.LeadType}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{prospect.FocusArea}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{prospect.NextAction || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Activity Feed - Right column */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="divide-y divide-slate-700/50">
              {recentActivity.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-slate-500">No recent activity. Start by adding contacts or orders.</p>
                </div>
              ) : recentActivity.map((activity) => {
                const Icon = activityIcons[activity.type] || CheckCircle;
                const colorClass = activityColors[activity.type] || 'bg-slate-500/20 text-slate-400';
                return (
                  <div key={`${activity.type}-${activity.id}`} className="px-4 py-3.5 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelectedContactId(String(activity.id))}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200">{activity.contact}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{activity.description}</p>
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{activity.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 bg-slate-800 border-t border-slate-700">
              <button
                type="button"
                onClick={() => navigate('/activities')}
                className="w-full text-center text-xs font-medium text-teal-400 hover:text-teal-300"
              >
                View All Activity
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedProspect && (
        <ContactDrawer
          prospect={selectedProspect}
          onClose={() => setSelectedContactId(null)}
        />
      )}
    </div>
  );
}
