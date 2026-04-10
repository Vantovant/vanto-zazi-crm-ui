import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Clock,
  AlertTriangle,
  MessageCircle,
  Phone,
  Calendar,
  FileText,
  CheckCircle,
  Sparkles,
  Loader2,
  UserX,
  Zap,
  Mail,
  Settings,
  Target,
  DollarSign,
  Crown,
  Filter,
  Users,
} from 'lucide-react';
import { LogActivityModal } from '../components/LogActivityModal';
import { ActivityGoalsModal } from '../components/ActivityGoalsModal';
import { ContactDrawer } from '../components/ContactDrawer';
import { MessageTemplatePicker } from '../components/MessageTemplatePicker';
import { ActivityAppreciationModal } from '../components/ActivityAppreciationModal';
import { useCrm } from '@/contexts/CrmContext';
import { useContactActivities } from '@/hooks/useContactActivities';
import { useActivityGoals } from '@/hooks/useActivityGoals';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import type { Prospect } from '@/data/mockData';

const activityTypeIcons: Record<string, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  call: Phone,
  meeting: Calendar,
  note: FileText,
  registration: CheckCircle,
};

const activityTypeColors: Record<string, string> = {
  whatsapp: 'bg-green-500/20 text-green-400',
  call: 'bg-cyan-500/20 text-cyan-400',
  meeting: 'bg-violet-500/20 text-violet-400',
  note: 'bg-slate-500/20 text-slate-400',
  registration: 'bg-emerald-500/20 text-emerald-400',
};

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function Activities() {
  const { contacts, orders } = useCrm();
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
  const [templatePicker, setTemplatePicker] = useState<{ contact: Prospect; channel: 'whatsapp' | 'email'; mergeOverrides?: Record<string, string> } | null>(null);
  
  const { activities, loading, getNeglectedContacts, getActivitiesToday, getActivitiesThisWeek } = useContactActivities();
  const { goals } = useActivityGoals();
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [goalsPeriod, setGoalsPeriod] = useState<'today' | 'week'>('today');

  // Activity Appreciation state
  const [appreciationEntries, setAppreciationEntries] = useState<{ contact: Prospect; order: any; month: string }[] | null>(null);
  const [appreciationIndex, setAppreciationIndex] = useState(0);
  const [appreciatedIds, setAppreciatedIds] = useState<Set<string>>(new Set());
  const [activityPaidFilter, setActivityPaidFilter] = useState<'all' | 'not_appreciated' | 'appreciated'>('all');
  const [selectedActivityRows, setSelectedActivityRows] = useState<Set<string>>(new Set());

  // Detect appreciated contacts from activity log
  const appreciatedFromLog = useMemo(() => {
    const ids = new Set<string>();
    for (const a of activities) {
      if (a.activity_type === 'whatsapp' && a.summary?.includes('activity appreciation')) {
        if (a.contact_id) ids.add(a.contact_id);
      }
    }
    return ids;
  }, [activities]);

  const allAppreciatedIds = useMemo(() => {
    const combined = new Set(appreciatedFromLog);
    appreciatedIds.forEach(id => combined.add(id));
    return combined;
  }, [appreciatedFromLog, appreciatedIds]);

  const LEAD_TYPE_ORDER = ['Prospect', 'Registered_Nopurchase', 'Purchase_Nostatus', 'Purchase_Status', 'Expired', 'Customer', 'Distributor'] as const;
  const LEAD_TYPE_LABELS: Record<string, string> = {
    Prospect: 'Prospects',
    Registered_Nopurchase: 'Registered – No Purchase',
    Purchase_Nostatus: 'Purchased – No Status',
    Purchase_Status: 'Purchased – Active',
    Expired: 'Expired',
    Customer: 'Customers',
    Distributor: 'Distributors',
  };
  const [leadTypeFilter, setLeadTypeFilter] = useState<string>('All');

  const leadTypeSortOrder = (lt: string | undefined) => {
    const idx = LEAD_TYPE_ORDER.indexOf(lt as any);
    return idx === -1 ? 99 : idx;
  };

  // Sort helper: lead type first, then Leg 1 before Leg 2
  const contactSortKey = (c: Prospect | undefined) => {
    if (!c) return [99, 99];
    const leg = c.AssignedTo === 'Manager_Leg_1' ? 0 : c.AssignedTo === 'Manager_Leg_2' ? 1 : 2;
    return [leadTypeSortOrder(c.LeadType), leg];
  };

  /** Group a sorted array by LeadType, preserving order */
  function groupByLeadType<T extends { LeadType?: string }>(items: T[]): { type: string; label: string; items: T[] }[] {
    const groups: { type: string; label: string; items: T[] }[] = [];
    for (const item of items) {
      const lt = item.LeadType || 'Unknown';
      const last = groups[groups.length - 1];
      if (last && last.type === lt) { last.items.push(item); }
      else { groups.push({ type: lt, label: LEAD_TYPE_LABELS[lt] || lt, items: [item] }); }
    }
    return groups;
  }

  // Neglected contacts (no activity in 7+ days), sorted by lead type then leg
  const neglectedContacts = useMemo(() => {
    const neglected = getNeglectedContacts(7);
    return neglected.map(n => {
      const contact = contacts.find(c => String(c.id) === n.contact_id);
      return { ...n, contact };
    }).filter(n => n.contact)
      .filter(n => leadTypeFilter === 'All' || n.contact?.LeadType === leadTypeFilter)
      .sort((a, b) => {
        const [aLt, aLeg] = contactSortKey(a.contact);
        const [bLt, bLeg] = contactSortKey(b.contact);
        return aLt - bLt || aLeg - bLeg;
      });
  }, [getNeglectedContacts, contacts, leadTypeFilter]);

  // Contacts with zero activity ever, sorted by lead type then leg
  const neverContactedList = useMemo(() => {
    const contactsWithActivity = new Set(activities.map(a => a.contact_id).filter(Boolean));
    return contacts
      .filter(c => !contactsWithActivity.has(String(c.id)))
      .filter(c => leadTypeFilter === 'All' || c.LeadType === leadTypeFilter)
      .sort((a, b) => {
        const [aLt, aLeg] = contactSortKey(a);
        const [bLt, bLeg] = contactSortKey(b);
        return aLt - bLt || aLeg - bLeg;
      })
      .slice(0, 20);
  }, [contacts, activities, leadTypeFilter]);

  const handleAIAnalysis = async () => {
    setAiLoading(true);
    setAiInsight('');

    const crmSummary = {
      totalContacts: contacts.length,
      totalActivities: activities.length,
      neglectedCount: neglectedContacts.length,
      neverContactedCount: neverContactedList.length,
      neglectedNames: neglectedContacts.slice(0, 10).map(n => ({
        name: n.contact?.FullName,
        daysSince: n.daysSince,
        temperature: n.contact?.LeadTemperature,
      })),
      neverContacted: neverContactedList.slice(0, 10).map(c => ({
        name: c.FullName,
        temperature: c.LeadTemperature,
        leadType: c.LeadType,
      })),
      recentActivities: activities.slice(0, 15).map(a => ({
        type: a.activity_type,
        summary: a.summary,
        date: a.created_at,
      })),
    };

    try {
      const resp = await supabase.functions.invoke('zazi-copilot', {
        body: {
          action: 'business_insight',
          message: `Analyze my relationship management health. I have ${neglectedContacts.length} neglected contacts (no activity in 7+ days) and ${neverContactedList.length} contacts I've never interacted with. Give me a prioritized action plan with specific names and what I should do for each. Focus on Hot leads first, then Warm. Be specific and actionable.`,
          crmSummary,
        },
      });

      if (resp.error) throw resp.error;

      // Parse SSE stream
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
      setAiInsight(result || 'No insights available at this time.');
    } catch (e) {
      console.error('AI analysis error:', e);
      setAiInsight('Unable to generate AI insights. Please try again.');
    }
    setAiLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Activities</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {activities.length} activities logged · {neglectedContacts.length} contacts need attention
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Lead Type Filter */}
          <select
            value={leadTypeFilter}
            onChange={e => setLeadTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          >
            <option value="All">All Lead Types</option>
            {LEAD_TYPE_ORDER.map(lt => (
              <option key={lt} value={lt}>{lt.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const topNeglected = neglectedContacts[0]?.contact || neverContactedList[0];
              if (topNeglected) {
                setTemplatePicker({ contact: topNeglected, channel: 'whatsapp' });
              }
            }}
            disabled={neglectedContacts.length === 0 && neverContactedList.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Zap className="w-4 h-4" />
            Suggested Outreach
          </button>
          <button
            type="button"
            onClick={handleAIAnalysis}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Relationship Check
          </button>
          <button
            type="button"
            onClick={() => setShowLogActivity(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log Activity
          </button>
        </div>
      </div>

      {/* AI Insight Panel */}
      {(aiInsight || aiLoading) && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h3 className="font-semibold text-violet-300">ZAZI Relationship Intelligence</h3>
          </div>
          {aiLoading ? (
            <div className="flex items-center gap-2 text-violet-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Analyzing your relationship health...</span>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none text-slate-300">
              <ReactMarkdown>{aiInsight}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Mobile: Activity Goals First | Desktop: 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity Goals & Progress — MOBILE FIRST */}
        <div className="order-1 lg:order-3 bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-teal-400" />
              <h3 className="font-semibold text-white">Activity Goals</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-900 rounded-lg p-0.5 text-xs">
                <button type="button" onClick={() => setGoalsPeriod('today')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${goalsPeriod === 'today' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  Today
                </button>
                <button type="button" onClick={() => setGoalsPeriod('week')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${goalsPeriod === 'week' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  This Week
                </button>
              </div>
              <button type="button" onClick={() => setShowGoalsModal(true)} className="p-1 rounded text-slate-400 hover:text-teal-400 hover:bg-slate-700 transition-colors" title="Set Goals">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {(() => {
              const periodActivities = goalsPeriod === 'today' ? getActivitiesToday() : getActivitiesThisWeek();
              const multiplier = goalsPeriod === 'week' ? 7 : 1;
              const metrics = [
                { type: 'whatsapp', label: 'WhatsApp', goal: goals.daily_whatsapp_goal * multiplier, icon: MessageCircle, color: 'bg-green-500', trackColor: 'bg-green-500/20', textColor: 'text-green-400' },
                { type: 'email', label: 'Email', goal: goals.daily_email_goal * multiplier, icon: Mail, color: 'bg-violet-500', trackColor: 'bg-violet-500/20', textColor: 'text-violet-400' },
                { type: 'call', label: 'Calls', goal: goals.daily_call_goal * multiplier, icon: Phone, color: 'bg-cyan-500', trackColor: 'bg-cyan-500/20', textColor: 'text-cyan-400' },
              ];
              return metrics.map(({ type, label, goal, icon: Icon, color, trackColor, textColor }) => {
                const count = periodActivities.filter(a => a.activity_type === type).length;
                const pct = Math.min(100, Math.round((count / goal) * 100));
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${textColor}`} />
                        <span className="text-sm text-slate-300">{label}</span>
                      </div>
                      <span className={`text-sm font-semibold ${count >= goal ? 'text-emerald-400' : 'text-white'}`}>
                        {count} / {goal}
                      </span>
                    </div>
                    <div className={`w-full h-2 rounded-full ${trackColor}`}>
                      <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Needs Attention — order 2 on mobile */}
        <div className="order-2 bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-white">Needs Attention</h3>
            <span className="ml-auto text-xs text-amber-400 font-medium">{neglectedContacts.length}</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {neglectedContacts.length === 0 ? (
              <div className="p-5 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">All contacts are up to date!</p>
              </div>
            ) : groupByLeadType(neglectedContacts.map(n => ({ ...n, LeadType: n.contact?.LeadType }))).map(group => (
              <div key={group.type}>
                <div className="px-5 py-2 bg-slate-700/40 border-y border-slate-700/50 sticky top-0 z-10">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">{group.label}</span>
                  <span className="ml-2 text-[10px] text-slate-500">{group.items.length}</span>
                </div>
                {group.items.map((item) => (
                  <div key={item.contact_id} className="px-5 py-3 hover:bg-slate-700/30 transition-colors border-b border-slate-700/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setDrawerContactId(item.contact_id)}>
                        <p className="text-sm font-medium text-white">{item.contact?.FullName}</p>
                        {item.contact?.AssignedTo === 'Manager_Leg_1' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400">L1</span>
                        )}
                        {item.contact?.AssignedTo === 'Manager_Leg_2' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">L2</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.contact && (
                          <>
                            <button type="button" onClick={() => item.contact && setTemplatePicker({ contact: item.contact, channel: 'whatsapp' })}
                              className="p-1 rounded text-green-400 hover:bg-green-500/20 transition-colors" title="Send WhatsApp">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => item.contact && setTemplatePicker({ contact: item.contact, channel: 'email' })}
                              className="p-1 rounded text-violet-400 hover:bg-violet-500/20 transition-colors" title="Send Email">
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <span className="text-xs font-medium text-amber-400 ml-1">{item.daysSince}d ago</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.contact?.LeadTemperature}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Never Contacted — order 3 on mobile */}
        <div className="order-3 lg:order-2 bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
            <UserX className="w-4 h-4 text-rose-400" />
            <h3 className="font-semibold text-white">Never Contacted</h3>
            <span className="ml-auto text-xs text-rose-400 font-medium">{neverContactedList.length}</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {neverContactedList.length === 0 ? (
              <div className="p-5 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">All contacts have been reached!</p>
              </div>
            ) : groupByLeadType(neverContactedList).map(group => (
              <div key={group.type}>
                <div className="px-5 py-2 bg-slate-700/40 border-y border-slate-700/50 sticky top-0 z-10">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">{group.label}</span>
                  <span className="ml-2 text-[10px] text-slate-500">{group.items.length}</span>
                </div>
                {group.items.map((contact) => (
                  <div key={contact.id} className="px-5 py-3 hover:bg-slate-700/30 transition-colors border-b border-slate-700/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setDrawerContactId(String(contact.id))}>
                        <p className="text-sm font-medium text-white">{contact.FullName}</p>
                        {contact.AssignedTo === 'Manager_Leg_1' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400">L1</span>
                        )}
                        {contact.AssignedTo === 'Manager_Leg_2' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">L2</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setTemplatePicker({ contact, channel: 'whatsapp' })}
                          className="p-1 rounded text-green-400 hover:bg-green-500/20 transition-colors" title="Send WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => setTemplatePicker({ contact, channel: 'email' })}
                          className="p-1 rounded text-violet-400 hover:bg-violet-500/20 transition-colors" title="Send Email">
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {contact.LeadTemperature} · {contact.NextAction || 'No action set'}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Paid This Month */}
      {(() => {
        const activityOrders = orders.filter(o => o.source === 'monthly-activity-paste');
        // Group by month (product contains "Monthly Activity - March 2026")
        const monthGroups = new Map<string, typeof activityOrders>();
        for (const o of activityOrders) {
          const month = o.product.replace('Monthly Activity - ', '') || 'Unknown';
          const arr = monthGroups.get(month) || [];
          arr.push(o);
          monthGroups.set(month, arr);
        }
        const latestMonth = Array.from(monthGroups.keys()).pop() || '';
        const latestOrders = monthGroups.get(latestMonth) || [];

        return (
          <div className="bg-slate-800/50 border border-emerald-500/20 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <h3 className="font-semibold text-white">
                {latestMonth ? `Activity Paid — ${latestMonth}` : 'Activity Paid'}
              </h3>
              <span className="ml-auto text-xs text-emerald-400 font-medium">{latestOrders.length}</span>
            </div>
            {latestOrders.length === 0 ? (
              <div className="p-8 text-center">
                <DollarSign className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400 mb-1">No activity purchases imported yet.</p>
                <p className="text-xs text-slate-500">Go to <span className="text-emerald-400 font-medium">Orders → Monthly Activity</span> to paste a report.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-700/50">
                {latestOrders.map((order) => {
                  const contact = contacts.find(c => String(c.id) === order.contactId);
                  return (
                    <div key={order.id} className="px-5 py-3 hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => order.contactId && setDrawerContactId(order.contactId)}>
                          <p className="text-sm font-medium text-white">{order.contactName}</p>
                          {contact?.APLGoID && <span className="text-xs text-slate-500 font-mono">{contact.APLGoID}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-emerald-400">R{order.amount.toLocaleString()}</span>
                          {contact && (
                            <button
                              type="button"
                              onClick={() => setTemplatePicker({
                                contact,
                                channel: 'whatsapp',
                                mergeOverrides: {
                                  amount: String(order.amount),
                                  month: latestMonth,
                                },
                              })}
                              className="p-1.5 rounded text-green-400 hover:bg-green-500/20 transition-colors"
                              title="Send Thank-You"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {contact?.Level && <span>Level: {contact.Level}</span>}
                        {contact?.Leg && <span>Leg: {contact.Leg}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="font-semibold text-white">Activity Timeline</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-slate-500 mx-auto animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No activities logged yet. Use "Log Activity" to record your first interaction.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {activities.slice(0, 50).map((activity) => {
              const Icon = activityTypeIcons[activity.activity_type] || FileText;
              const colorClass = activityTypeColors[activity.activity_type] || 'bg-slate-500/20 text-slate-400';
              const contact = contacts.find(c => String(c.id) === activity.contact_id);
              return (
                <div key={activity.id} className="px-5 py-4 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => activity.contact_id && setDrawerContactId(activity.contact_id)}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colorClass} mt-0.5`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-teal-400">{contact?.FullName || 'Unknown Contact'}</p>
                        <span className="text-xs text-slate-500 whitespace-nowrap ml-3">{formatTimeAgo(activity.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-300 mt-0.5">{activity.summary}</p>
                      {activity.notes && (
                        <p className="text-xs text-slate-500 mt-1">{activity.notes}</p>
                      )}
                      {activity.next_action && (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Next: {activity.next_action}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showLogActivity && (
        <LogActivityModal onClose={() => setShowLogActivity(false)} />
      )}

      {showGoalsModal && (
        <ActivityGoalsModal onClose={() => setShowGoalsModal(false)} />
      )}

      {drawerContactId && (() => {
        const c = contacts.find(ct => String(ct.id) === drawerContactId);
        return c ? <ContactDrawer prospect={c} onClose={() => setDrawerContactId(null)} onOpenTemplatePicker={(channel) => {
          if (c) setTemplatePicker({ contact: c, channel });
          setDrawerContactId(null);
        }} /> : null;
      })()}

      {templatePicker && (
        <MessageTemplatePicker
          contact={templatePicker.contact}
          channel={templatePicker.channel}
          onClose={() => setTemplatePicker(null)}
        />
      )}
    </div>
  );
}
