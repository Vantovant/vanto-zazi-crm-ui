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
} from 'lucide-react';
import { todaysFocus, recentActivities } from '../data/mockData';
import { DataStatusBanner } from '../components/DataStatusBanner';
import { useCrm } from '@/contexts/CrmContext';

function useDashboardStats() {
  const { contacts: prospects, dbActive } = useCrm();
  return {
    dbActive,
    stats: {
      totalProspects: prospects.length,
      hotLeads: prospects.filter(p => p.LeadTemperature === 'Hot').length,
      warmLeads: prospects.filter(p => p.LeadTemperature === 'Warm').length,
      coldLeads: prospects.filter(p => p.LeadTemperature === 'Cold').length,
      registered: prospects.filter(p => p.RegistrationStatus === 'Registered' || p.RegistrationStatus === 'Activated').length,
    },
    recentProspects: prospects.slice(0, 5),
  };
}

const kpiCardsMeta = [
  { label: 'Total Prospects', key: 'totalProspects' as const, icon: Users, color: 'bg-slate-600' },
  { label: 'Hot Leads', key: 'hotLeads' as const, icon: Flame, color: 'bg-rose-500' },
  { label: 'Warm Leads', key: 'warmLeads' as const, icon: Thermometer, color: 'bg-amber-500' },
  { label: 'Cold Leads', key: 'coldLeads' as const, icon: Snowflake, color: 'bg-sky-500' },
  { label: 'Registered', key: 'registered' as const, icon: UserCheck, color: 'bg-emerald-500' },
];

const activityIcons: Record<string, typeof Phone> = {
  whatsapp: MessageCircle,
  call: Phone,
  meeting: Calendar,
  registration: CheckCircle,
};

const activityColors: Record<string, string> = {
  whatsapp: 'bg-green-500/20 text-green-400',
  call: 'bg-cyan-500/20 text-cyan-400',
  meeting: 'bg-violet-500/20 text-violet-400',
  registration: 'bg-emerald-500/20 text-emerald-400',
};

const temperatureColors: Record<string, string> = {
  Hot: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  Warm: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Cold: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

export function Dashboard() {
  const { dbActive, stats, recentProspects } = useDashboardStats();

  return (
    <div className="space-y-6">
      {/* Data Status Banner */}
      <DataStatusBanner dbActive={dbActive} />

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">Welcome back. Here's your daily overview.</p>
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
                  {todaysFocus.followUps.length}
                </span>
              </div>
              <div className="divide-y divide-slate-700/50">
                {todaysFocus.followUps.map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer">
                    <p className="text-sm font-medium text-slate-200">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.action}</p>
                    <span className={`inline-block mt-1.5 text-xs font-medium px-1.5 py-0.5 rounded border ${temperatureColors[item.temperature]}`}>
                      {item.temperature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scheduled Meetings */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Meetings Today</h3>
                <span className="text-xs font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                  {todaysFocus.meetings.length}
                </span>
              </div>
              <div className="divide-y divide-slate-700/50">
                {todaysFocus.meetings.map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-200">{item.name}</p>
                      <span className="text-xs font-semibold text-teal-400">{item.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.type}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hot Leads Needing Action */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Hot Leads</h3>
                <span className="text-xs font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                  {todaysFocus.hotLeadsNeedingAction.length}
                </span>
              </div>
              <div className="divide-y divide-slate-700/50">
                {todaysFocus.hotLeadsNeedingAction.map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer">
                    <p className="text-sm font-medium text-slate-200">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.status}</p>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {item.daysSinceContact === 0 ? 'Today' : `${item.daysSinceContact}d ago`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Prospects Table */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden mt-6">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-white">Recent Prospects</h3>
              <button type="button" className="text-xs font-medium text-teal-400 hover:text-teal-300 flex items-center gap-1">
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
                  {recentProspects.map((prospect) => (
                    <tr key={prospect.id} className="hover:bg-slate-700/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-200">{prospect.FullName}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{prospect.PhoneNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${temperatureColors[prospect.LeadTemperature]}`}>
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
              {recentActivities.map((activity) => {
                const Icon = activityIcons[activity.type];
                const colorClass = activityColors[activity.type];
                return (
                  <div key={activity.id} className="px-4 py-3.5 hover:bg-slate-700/30 transition-colors cursor-pointer">
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
              <button type="button" className="w-full text-center text-xs font-medium text-teal-400 hover:text-teal-300">
                View All Activity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
