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
} from 'lucide-react';
import { DataStatusBanner } from '../components/DataStatusBanner';
import { useCrm } from '@/contexts/CrmContext';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

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

  const stats = useMemo(() => ({
    totalProspects: prospects.length,
    hotLeads: prospects.filter(p => p.LeadTemperature === 'Hot').length,
    warmLeads: prospects.filter(p => p.LeadTemperature === 'Warm').length,
    coldLeads: prospects.filter(p => p.LeadTemperature === 'Cold').length,
    registered: prospects.filter(p => p.RegistrationStatus === 'Registered' || p.RegistrationStatus === 'Activated').length,
  }), [prospects]);

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
      id: o.id,
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

  return (
    <div className="space-y-6">
      <DataStatusBanner dbActive={dbActive} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Loading...' : 'Welcome back. Here\'s your daily overview.'}
          </p>
        </div>
        <div className="text-sm text-slate-400">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
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

      {/* Main Grid */}
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
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => navigate('/contacts')}>
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
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => navigate('/contacts')}>
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
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => navigate('/contacts')}>
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
                    <tr key={prospect.id} className="hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => navigate('/contacts')}>
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
                  <div key={`${activity.type}-${activity.id}`} className="px-4 py-3.5 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => navigate('/contacts')}>
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
    </div>
  );
}
