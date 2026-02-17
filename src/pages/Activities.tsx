import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { LogActivityModal } from '../components/LogActivityModal';
import { useCrm } from '@/contexts/CrmContext';
import { useContactActivities } from '@/hooks/useContactActivities';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

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
  const [showLogActivity, setShowLogActivity] = useState(false);
  const { contacts } = useCrm();
  const { activities, loading, getNeglectedContacts } = useContactActivities();
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Neglected contacts (no activity in 7+ days)
  const neglectedContacts = useMemo(() => {
    const neglected = getNeglectedContacts(7);
    return neglected.map(n => {
      const contact = contacts.find(c => String(c.id) === n.contact_id);
      return { ...n, contact };
    }).filter(n => n.contact);
  }, [getNeglectedContacts, contacts]);

  // Contacts with zero activity ever
  const neverContactedList = useMemo(() => {
    const contactsWithActivity = new Set(activities.map(a => a.contact_id).filter(Boolean));
    return contacts.filter(c => !contactsWithActivity.has(String(c.id))).slice(0, 10);
  }, [contacts, activities]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Activities</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {activities.length} activities logged · {neglectedContacts.length} contacts need attention
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Neglected Contacts Alert */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-white">Needs Attention</h3>
            <span className="ml-auto text-xs text-amber-400 font-medium">{neglectedContacts.length}</span>
          </div>
          <div className="divide-y divide-slate-700/50 max-h-80 overflow-y-auto">
            {neglectedContacts.length === 0 ? (
              <div className="p-5 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">All contacts are up to date!</p>
              </div>
            ) : neglectedContacts.map((item) => (
              <div key={item.contact_id} className="px-5 py-3 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{item.contact?.FullName}</p>
                  <span className="text-xs font-medium text-amber-400">{item.daysSince}d ago</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.contact?.LeadTemperature} · {item.contact?.LeadType}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Never Contacted */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
            <UserX className="w-4 h-4 text-rose-400" />
            <h3 className="font-semibold text-white">Never Contacted</h3>
            <span className="ml-auto text-xs text-rose-400 font-medium">{neverContactedList.length}</span>
          </div>
          <div className="divide-y divide-slate-700/50 max-h-80 overflow-y-auto">
            {neverContactedList.length === 0 ? (
              <div className="p-5 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">All contacts have been reached!</p>
              </div>
            ) : neverContactedList.map((contact) => (
              <div key={contact.id} className="px-5 py-3 hover:bg-slate-700/30 transition-colors">
                <p className="text-sm font-medium text-white">{contact.FullName}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {contact.LeadTemperature} · {contact.NextAction || 'No action set'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Stats */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">Activity Summary</h3>
          </div>
          <div className="p-5 space-y-3">
            {['whatsapp', 'call', 'meeting', 'note', 'registration'].map((type) => {
              const count = activities.filter(a => a.activity_type === type).length;
              const Icon = activityTypeIcons[type] || FileText;
              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${activityTypeColors[type]}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm text-slate-300 capitalize">{type}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
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
                <div key={activity.id} className="px-5 py-4 hover:bg-slate-700/30 transition-colors">
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
    </div>
  );
}
