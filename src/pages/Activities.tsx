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
  Search,
  Target,
  DollarSign,
  Crown,
  Filter,
  Users,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { LogActivityModal } from '../components/LogActivityModal';
import { ActivityGoalsModal } from '../components/ActivityGoalsModal';
import { ContactDrawer } from '../components/ContactDrawer';
import { MessageTemplatePicker } from '../components/MessageTemplatePicker';
import { ActivityAppreciationModal } from '../components/ActivityAppreciationModal';
import { ProspectorInbox } from '../components/ProspectorInbox';
import { useCrm } from '@/contexts/CrmContext';
import { useContactActivities, type ContactActivity } from '@/hooks/useContactActivities';
import { useActivityGoals } from '@/hooks/useActivityGoals';
import { useWaitingRoom, ISSUE_TYPE_LABELS } from '@/hooks/useWaitingRoom';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import type { Prospect } from '@/data/mockData';
import {
  normalizeActivityMonth,
  monthLabel,
  appreciationStatusKey,
  extractAppreciationMonth,
  compareMonthKeys,
} from '@/utils/monthlyActivityKey';

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

interface ActivityAppreciationOrder {
  id: string;
  contactId: string | null;
  contactName: string;
  amount: number;
  product: string;
}

interface ActivityAppreciationEntry {
  contact: Prospect;
  order: ActivityAppreciationOrder;
  month: string;
}

function normalizeActivityAppreciationOrder(order: {
  id: string | number;
  contactId?: string | null;
  contactName?: string;
  amount?: number;
  product?: string;
}): ActivityAppreciationOrder {
  return {
    id: String(order.id),
    contactId: order.contactId ?? null,
    contactName: order.contactName ?? '',
    amount: order.amount ?? 0,
    product: order.product ?? '',
  };
}

export function Activities() {
  const { contacts, orders } = useCrm();
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
  const [templatePicker, setTemplatePicker] = useState<{ contact: Prospect; channel: 'whatsapp' | 'email'; mergeOverrides?: Record<string, string> } | null>(null);
  
  const { activities, loading, getNeglectedContacts, getActivitiesToday, getActivitiesThisWeek } = useContactActivities();
  const { goals } = useActivityGoals();
  const { openEntries: waitingRoomOpen, resolvedEntries: waitingRoomResolved, highPriorityEntries: waitingRoomHigh, updateEntry, removeEntry, loading: wrLoading } = useWaitingRoom();
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [goalsPeriod, setGoalsPeriod] = useState<'today' | 'week'>('today');
  const [wrFilter, setWrFilter] = useState<'all' | 'high' | 'resolved'>('all');

  // Activity Appreciation state — month-scoped (M1)
  const [appreciationEntries, setAppreciationEntries] = useState<ActivityAppreciationEntry[] | null>(null);
  const [appreciationIndex, setAppreciationIndex] = useState(0);
  // Optimistic month-scoped marks: keys = appreciationStatusKey(monthKey, contactId|aplgoId)
  const [appreciatedKeys, setAppreciatedKeys] = useState<Set<string>>(new Set());
  const [activityPaidFilter, setActivityPaidFilter] = useState<'all' | 'not_appreciated' | 'appreciated'>('all');
  const [selectedActivityRows, setSelectedActivityRows] = useState<Set<string>>(new Set());
  const [activityPaidSearch, setActivityPaidSearch] = useState('');
  // Selected month for the Activity Paid section. "" = use latest available.
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');


  // Detect appreciated (contact, month) pairs from activity log.
  // Status is now MONTH-SCOPED — last month's "Done" never bleeds into this month.
  const appreciatedKeysFromLog = useMemo(() => {
    const keys = new Set<string>();
    for (const a of activities) {
      if (a.activity_type !== 'whatsapp') continue;
      if (!a.summary || !/activity appreciation/i.test(a.summary)) continue;
      const monthKey = extractAppreciationMonth(a);
      if (!monthKey) continue;
      if (a.contact_id) keys.add(appreciationStatusKey(monthKey, a.contact_id));
      // Also index by APLGoID parsed from summary so fallback contacts (no contact_id) still flip to Done.
      const aplgoMatch = a.summary.match(/User ID:\s*([A-Za-z0-9_-]+)/i);
      if (aplgoMatch && aplgoMatch[1] && aplgoMatch[1] !== 'N/A') {
        keys.add(appreciationStatusKey(monthKey, aplgoMatch[1]));
      }
    }
    return keys;
  }, [activities]);

  const isAppreciatedFor = useCallback((monthKey: string, contactId: string | null | undefined, aplgoId?: string | null) => {
    if (!monthKey) return false;
    if (contactId) {
      const k = appreciationStatusKey(monthKey, contactId);
      if (appreciatedKeysFromLog.has(k) || appreciatedKeys.has(k)) return true;
    }
    if (aplgoId) {
      const k = appreciationStatusKey(monthKey, aplgoId);
      if (appreciatedKeysFromLog.has(k) || appreciatedKeys.has(k)) return true;
    }
    return false;
  }, [appreciatedKeysFromLog, appreciatedKeys]);


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

  // --- Activity Paid Section (reusable for mobile + desktop) ---
  const renderActivityPaidSection = () => {
    const activityOrders = orders.filter(o => o.source === 'monthly-activity-paste');
    // Group by canonical YYYY-MM key, but keep a display label per group.
    const monthGroups = new Map<string, { label: string; orders: typeof activityOrders }>();
    for (const o of activityOrders) {
      const rawLabel = (o.product || '').replace(/^Monthly Activity\s*-\s*/i, '').trim() || 'Unknown';
      const key = normalizeActivityMonth(rawLabel) || rawLabel; // fallback so unparseable labels still group
      const display = monthLabel(rawLabel) || rawLabel;
      const bucket = monthGroups.get(key) || { label: display, orders: [] };
      bucket.orders.push(o);
      monthGroups.set(key, bucket);
    }
    // Sort month keys chronologically (newest first for the dropdown).
    const monthOptions = Array.from(monthGroups.entries())
      .sort((a, b) => compareMonthKeys(b[0], a[0]))
      .map(([key, v]) => ({ key, label: v.label, count: v.orders.length }));

    const effectiveMonthKey = selectedMonthKey && monthGroups.has(selectedMonthKey)
      ? selectedMonthKey
      : (monthOptions[0]?.key || '');
    const monthBucket = effectiveMonthKey ? monthGroups.get(effectiveMonthKey) : undefined;
    const latestMonth = monthBucket?.label || '';
    const latestMonthKey = effectiveMonthKey;
    const latestOrders = monthBucket?.orders || [];

    const filteredOrders = latestOrders.filter(order => {
      const cId = order.contactId;
      const contact = cId ? contacts.find(c => String(c.id) === cId) : undefined;
      const aplgo = contact?.APLGoID || '';
      const isAppreciated = isAppreciatedFor(latestMonthKey, cId, aplgo);
      // Status filter
      if (activityPaidFilter === 'appreciated' && !isAppreciated) return false;
      if (activityPaidFilter === 'not_appreciated' && isAppreciated) return false;
      // Name search filter
      if (activityPaidSearch.trim()) {
        const q = activityPaidSearch.trim().toLowerCase();
        const nameMatch = order.contactName.toLowerCase().includes(q);
        const idMatch = aplgo.toLowerCase().includes(q);
        if (!nameMatch && !idMatch) return false;
      }
      return true;
    });

    const appreciatedCount = latestOrders.filter(o => {
      const contact = o.contactId ? contacts.find(c => String(c.id) === o.contactId) : undefined;
      return isAppreciatedFor(latestMonthKey, o.contactId, contact?.APLGoID);
    }).length;
    const notAppreciatedCount = latestOrders.length - appreciatedCount;

    const handleOpenSingleAppreciation = (order: typeof latestOrders[0], contactOrFallback: Prospect) => {
      setAppreciationEntries([{ contact: contactOrFallback, order: normalizeActivityAppreciationOrder(order), month: latestMonth }]);
      setAppreciationIndex(0);
    };

    const handleBulkAppreciation = () => {
      const entries: ActivityAppreciationEntry[] = [];
      for (const order of filteredOrders) {
        const contact = contacts.find(c => String(c.id) === order.contactId);
        const fallback = { id: order.id, FullName: order.contactName, PhoneNumber: '', LeadTemperature: '', LeadType: '', AssignedTo: '' } as unknown as Prospect;
        if (!selectedActivityRows.size || selectedActivityRows.has(String(order.id))) {
          entries.push({ contact: contact || fallback, order: normalizeActivityAppreciationOrder(order), month: latestMonth });
        }
      }
      if (entries.length > 0) {
        setAppreciationEntries(entries);
        setAppreciationIndex(0);
      }
    };

    const toggleSelect = (id: string) => {
      setSelectedActivityRows(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const toggleSelectAll = () => {
      if (selectedActivityRows.size === filteredOrders.length) {
        setSelectedActivityRows(new Set());
      } else {
        setSelectedActivityRows(new Set(filteredOrders.map(o => String(o.id))));
      }
    };

    return (
      <div className="bg-slate-800/50 border border-emerald-500/20 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-700">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Crown className="w-4 h-4 text-emerald-400" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                {latestMonth ? `Activity Paid — ${latestMonth}` : 'Activity Paid'}
              </h3>
              <span className="text-xs text-emerald-400 font-medium">{latestOrders.length}</span>
              {monthOptions.length > 0 && (
                <select
                  value={effectiveMonthKey}
                  onChange={e => { setSelectedMonthKey(e.target.value); setSelectedActivityRows(new Set()); }}
                  className="ml-1 px-2 py-1 text-[11px] bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  title="Select activity month"
                >
                  {monthOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label} ({opt.count})</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-slate-900 rounded-lg p-0.5 text-[10px]">
                <button type="button" onClick={() => { setActivityPaidFilter('all'); setSelectedActivityRows(new Set()); }}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${activityPaidFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  All ({latestOrders.length})
                </button>
                <button type="button" onClick={() => { setActivityPaidFilter('not_appreciated'); setSelectedActivityRows(new Set()); }}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${activityPaidFilter === 'not_appreciated' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  Not Yet ({notAppreciatedCount})
                </button>
                <button type="button" onClick={() => { setActivityPaidFilter('appreciated'); setSelectedActivityRows(new Set()); }}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${activityPaidFilter === 'appreciated' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  Done ({appreciatedCount})
                </button>
              </div>
              {filteredOrders.length > 0 && (
                <button type="button" onClick={handleBulkAppreciation}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                  <Users className="w-3 h-3" />
                  {selectedActivityRows.size > 0
                    ? `Appreciate ${selectedActivityRows.size} Selected`
                    : `Appreciate All ${filteredOrders.length}`}
                </button>
              )}
            </div>
            </div>
          </div>
          {/* Search input */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={activityPaidSearch}
              onChange={e => { setActivityPaidSearch(e.target.value); setSelectedActivityRows(new Set()); }}
              placeholder="Search by name or ID..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>
        {latestOrders.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <DollarSign className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-1">No activity purchases imported yet.</p>
            <p className="text-xs text-slate-500">Go to <span className="text-emerald-400 font-medium">Orders → Monthly Activity</span> to paste a report.</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              {activityPaidFilter === 'appreciated' ? 'No appreciated contacts yet.' : 'All contacts have been appreciated! 🎉'}
            </p>
          </div>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <div className="px-3 sm:px-5 py-2 bg-slate-700/30 border-b border-slate-700/50 flex items-center gap-2 sm:gap-3 text-xs sticky top-0 z-10">
              <input type="checkbox" checked={selectedActivityRows.size === filteredOrders.length && filteredOrders.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40 w-3.5 h-3.5" />
              <span className="text-slate-400">Select all</span>
              <span className="ml-auto text-slate-500 hidden sm:inline">Name</span>
              <span className="w-20 text-right text-slate-500 hidden sm:inline">Amount</span>
              <span className="w-16 text-center text-slate-500 hidden sm:inline">Status</span>
              <span className="w-8 hidden sm:inline" />
            </div>
            <div className="divide-y divide-slate-700/50">
              {filteredOrders.map((order) => {
                const contact = contacts.find(c => String(c.id) === order.contactId);
                const isAppreciated = isAppreciatedFor(latestMonthKey, order.contactId, contact?.APLGoID);
                // Build fallback contact for appreciation when no linked contact
                const fallbackContact = (contact || {
                  id: order.id,
                  FullName: order.contactName,
                  PhoneNumber: '',
                  LeadTemperature: '',
                  LeadType: '',
                  AssignedTo: '',
                } as unknown) as Prospect;

                return (
                  <div key={order.id} className="px-3 sm:px-5 py-3 hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <input type="checkbox" checked={selectedActivityRows.has(String(order.id))}
                        onChange={() => toggleSelect(String(order.id))}
                        className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40 w-3.5 h-3.5 shrink-0" />
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => order.contactId && setDrawerContactId(order.contactId)}>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{order.contactName}</p>
                          {contact?.APLGoID && <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">{contact.APLGoID}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                          {contact?.Level && <span>Level: {contact.Level}</span>}
                          {contact?.Leg && <span>Leg: {contact.Leg}</span>}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-emerald-400 shrink-0">R{order.amount.toLocaleString()}</span>
                      <span className={`hidden sm:inline shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isAppreciated ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {isAppreciated ? '✓ Done' : 'Pending'}
                      </span>
                      {/* Crown button — ALWAYS visible */}
                      <button
                        type="button"
                        onClick={() => handleOpenSingleAppreciation(order, fallbackContact)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0"
                        title="👑 Send Activity Appreciation"
                      >
                        <Crown className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
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

      {/* ZAZI AI PROSPECTOR — admin-only inbox (component self-hides for non-admins) */}
      <ProspectorInbox />

      {/* Activity Paid This Month — MOBILE: show before grid for visibility */}
      <div className="block lg:hidden">
        {renderActivityPaidSection()}
      </div>

      {/* ── Waiting Room / To-Do List ── */}
      {(() => {
        const wrItems = wrFilter === 'resolved' ? waitingRoomResolved
          : wrFilter === 'high' ? waitingRoomHigh
          : waitingRoomOpen;
        const priorityColors: Record<string, string> = {
          high: 'bg-rose-500/20 text-rose-400',
          medium: 'bg-amber-500/20 text-amber-400',
          low: 'bg-slate-600/30 text-slate-400',
        };
        return (
          <div className="bg-slate-800/50 border border-amber-500/20 rounded-xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-700">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <h3 className="font-semibold text-white text-sm sm:text-base">To-Do Waiting Room</h3>
                  {waitingRoomOpen.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                      {waitingRoomOpen.length}
                    </span>
                  )}
                </div>
                <div className="flex bg-slate-900 rounded-lg p-0.5 text-[10px]">
                  <button type="button" onClick={() => setWrFilter('all')}
                    className={`px-2 py-1 rounded-md font-medium transition-colors ${wrFilter === 'all' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    Open ({waitingRoomOpen.length})
                  </button>
                  <button type="button" onClick={() => setWrFilter('high')}
                    className={`px-2 py-1 rounded-md font-medium transition-colors ${wrFilter === 'high' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    High ({waitingRoomHigh.length})
                  </button>
                  <button type="button" onClick={() => setWrFilter('resolved')}
                    className={`px-2 py-1 rounded-md font-medium transition-colors ${wrFilter === 'resolved' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    Resolved ({waitingRoomResolved.length})
                  </button>
                </div>
              </div>
            </div>
            {wrLoading ? (
              <div className="p-6 text-center"><Loader2 className="w-6 h-6 text-slate-500 mx-auto animate-spin" /></div>
            ) : wrItems.length === 0 ? (
              <div className="p-6 sm:p-8 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm text-slate-400">
                  {wrFilter === 'resolved' ? 'No resolved items yet.' : 'No contacts in the waiting room. 🎉'}
                </p>
              </div>
            ) : (
              <div className="max-h-[24rem] overflow-y-auto divide-y divide-slate-700/50">
                {wrItems.map(entry => {
                  const contact = contacts.find(c => String(c.id) === entry.contact_id);
                  return (
                    <div key={entry.id} className="px-3 sm:px-5 py-3 hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDrawerContactId(entry.contact_id)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white truncate">{contact?.FullName || 'Unknown'}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityColors[entry.priority] || priorityColors.medium}`}>
                              {entry.priority}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                              {ISSUE_TYPE_LABELS[entry.issue_type] || entry.issue_type}
                            </span>
                          </div>
                          {entry.issue_note && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{entry.issue_note}</p>
                          )}
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-600">
                            {contact?.PhoneNumber && <span>📞 {contact.PhoneNumber}</span>}
                            {contact?.EmailAddress && <span>✉️ {contact.EmailAddress}</span>}
                            <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {entry.status !== 'resolved' && (
                          <button type="button" onClick={() => updateEntry(entry.id, { status: 'resolved' })}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0"
                            title="Mark Resolved">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button type="button" onClick={() => removeEntry(entry.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors shrink-0"
                          title="Remove">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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

      {/* Activity Paid — Desktop only (mobile shown above) */}
      <div className="hidden lg:block">
        {renderActivityPaidSection()}
      </div>

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

      {appreciationEntries && appreciationEntries.length > 0 && (
        <ActivityAppreciationModal
          entries={appreciationEntries}
          initialIndex={appreciationIndex}
          onClose={() => { setAppreciationEntries(null); setSelectedActivityRows(new Set()); }}
          onAppreciated={(contactId) => setAppreciatedIds(prev => new Set(prev).add(contactId))}
        />
      )}
    </div>
  );
}
