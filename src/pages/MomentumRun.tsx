import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import { supabase } from '@/integrations/supabase/client';
import { MessageTemplatePicker } from '@/components/MessageTemplatePicker';
import {
  Flame, Target, Users, Calendar, ChevronRight, CheckCircle2, Circle,
  TrendingUp, Phone, MessageCircle, Mail, Clock, Zap, Trophy
} from 'lucide-react';

/* ── 90-Day Config ── */
const START_DATE = new Date('2026-03-30');
const END_DATE = new Date('2026-06-27');
const PHASES = [
  { id: 1, name: 'Pre-Launch — Whisper Campaign', days: [1, 3], color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: '🤫' },
  { id: 2, name: 'Launch — 70-in-10', days: [4, 13], color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: '🚀' },
  { id: 3, name: 'Post-Launch Momentum', days: [14, 30], color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: '⚡' },
  { id: 4, name: 'Building & Duplicating', days: [31, 60], color: 'bg-teal-500/20 text-teal-300 border-teal-500/30', icon: '🏗️' },
  { id: 5, name: 'Scaling & Closing', days: [61, 90], color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: '🏆' },
];

const DAILY_TARGETS: Record<number, { conversations: number; followUps: number; presentations: number }> = {
  1: { conversations: 7, followUps: 0, presentations: 0 },
  2: { conversations: 20, followUps: 7, presentations: 7 },
  3: { conversations: 5, followUps: 3, presentations: 1 },
  4: { conversations: 5, followUps: 5, presentations: 2 },
  5: { conversations: 7, followUps: 5, presentations: 3 },
};

const LEAD_TYPE_PHASE_MAP: Record<string, number[]> = {
  Prospect: [1, 2],
  Registered_Nopurchase: [3, 4],
  Purchase_Nostatus: [3, 4],
  Purchase_Status: [4, 5],
  Expired: [3],
  Customer: [4, 5],
};

function getDayNumber(): number {
  const now = new Date();
  const diff = Math.floor((now.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.min(90, diff));
}

function getCurrentPhase(day: number) {
  return PHASES.find(p => day >= p.days[0] && day <= p.days[1]) || PHASES[0];
}

function getDaysRemaining(): number {
  const now = new Date();
  return Math.max(0, Math.ceil((END_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function MomentumRun() {
  const { user } = useAuth();
  const { contacts } = useCrm();
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  const [templateContact, setTemplateContact] = useState<any>(null);

  const dayNumber = getDayNumber();
  const currentPhase = getCurrentPhase(dayNumber);
  const targets = DAILY_TARGETS[currentPhase.id];
  const daysRemaining = getDaysRemaining();
  const progressPct = Math.round((dayNumber / 90) * 100);

  // Fetch today's activities
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('contact_activities')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .then(({ data }) => { if (data) setTodayActivities(data); });
  }, [user]);

  // Count today's activities
  const todayCounts = useMemo(() => {
    const wa = todayActivities.filter(a => a.activity_type === 'whatsapp').length;
    const email = todayActivities.filter(a => a.activity_type === 'email').length;
    const call = todayActivities.filter(a => a.activity_type === 'call').length;
    return { conversations: wa + email + call, followUps: todayActivities.filter(a => a.summary?.toLowerCase().includes('follow')).length, presentations: todayActivities.filter(a => a.summary?.toLowerCase().includes('present')).length };
  }, [todayActivities]);

  // Contacts for current phase
  const phaseContacts = useMemo(() => {
    return contacts.filter(c => {
      const phases = LEAD_TYPE_PHASE_MAP[c.LeadType] || [];
      return phases.includes(currentPhase.id);
    }).sort((a, b) => {
      const tempOrder: Record<string, number> = { Hot: 0, Warm: 1, Cold: 2 };
      return (tempOrder[a.LeadTemperature] || 2) - (tempOrder[b.LeadTemperature] || 2);
    });
  }, [contacts, currentPhase.id]);

  // Group by lead type
  const groupedContacts = useMemo(() => {
    const groups: Record<string, typeof phaseContacts> = {};
    for (const c of phaseContacts) {
      const lt = c.LeadType || 'Other';
      if (!groups[lt]) groups[lt] = [];
      groups[lt].push(c);
    }
    return groups;
  }, [phaseContacts]);

  const handleContactAction = useCallback((contact: any) => {
    setTemplateContact(contact);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flame className="w-7 h-7 text-orange-400" />
            90-Day Momentum Run
          </h1>
          <p className="text-slate-400 text-sm mt-1">RESET & RISE • "No zero days. Even 1% counts."</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-teal-400">Day {dayNumber}</p>
            <p className="text-xs text-slate-400">{daysRemaining} days remaining</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300 font-medium">Overall Progress</span>
          <span className="text-sm font-bold text-teal-400">{progressPct}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3">
          <div className="bg-gradient-to-r from-teal-500 to-emerald-400 h-3 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        {/* Phase indicators */}
        <div className="flex mt-3 gap-1">
          {PHASES.map(p => (
            <div key={p.id} className={`flex-1 text-center text-[10px] px-1 py-1.5 rounded border ${p.id === currentPhase.id ? p.color + ' font-bold' : 'text-slate-500 border-slate-700'}`}>
              {p.icon} {p.name.split('—')[0].trim()}
            </div>
          ))}
        </div>
      </div>

      {/* Current Phase Card */}
      <div className={`rounded-xl p-5 border ${currentPhase.color}`}>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="text-xl">{currentPhase.icon}</span>
          Phase {currentPhase.id}: {currentPhase.name}
        </h2>
        <p className="text-sm mt-2 opacity-80">
          Days {currentPhase.days[0]}–{currentPhase.days[1]} • {phaseContacts.length} contacts in focus
        </p>
      </div>

      {/* Today's Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ScoreCard icon={<MessageCircle className="w-5 h-5" />} label="Conversations" current={todayCounts.conversations} target={targets.conversations} color="text-teal-400" />
        <ScoreCard icon={<Phone className="w-5 h-5" />} label="Follow-ups" current={todayCounts.followUps} target={targets.followUps} color="text-amber-400" />
        <ScoreCard icon={<Target className="w-5 h-5" />} label="Presentations" current={todayCounts.presentations} target={targets.presentations} color="text-purple-400" />
      </div>

      {/* Daily Priorities */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Today's Top 3 Priorities
        </h3>
        <div className="space-y-2">
          {currentPhase.id === 1 && (
            <>
              <PriorityItem text={`Send Whisper messages to ${Math.min(7, phaseContacts.length)} A-List contacts`} done={todayCounts.conversations >= 7} />
              <PriorityItem text="Track responses — categorize as Ready, Curious, or Not Now" done={false} />
              <PriorityItem text="DO NOT present. Create curiosity only." done={false} />
            </>
          )}
          {currentPhase.id === 2 && (
            <>
              <PriorityItem text="Execute 7 presentations today (Zoom, 1-on-1, 3-way calls)" done={todayCounts.presentations >= 7} />
              <PriorityItem text={`Send ${targets.conversations}+ invitations to fill calendar`} done={todayCounts.conversations >= targets.conversations} />
              <PriorityItem text="Immediate post-presentation closing questions" done={false} />
            </>
          )}
          {currentPhase.id === 3 && (
            <>
              <PriorityItem text="Follow up on all launch conversations" done={todayCounts.followUps >= 3} />
              <PriorityItem text="Activate Registered contacts — first purchase push" done={false} />
              <PriorityItem text="Reactivate Expired members with personal outreach" done={false} />
            </>
          )}
          {currentPhase.id === 4 && (
            <>
              <PriorityItem text="Train new team members on duplication" done={false} />
              <PriorityItem text={`Complete ${targets.followUps} follow-ups with warm leads`} done={todayCounts.followUps >= targets.followUps} />
              <PriorityItem text={`Execute ${targets.presentations} presentations`} done={todayCounts.presentations >= targets.presentations} />
            </>
          )}
          {currentPhase.id === 5 && (
            <>
              <PriorityItem text="Final push — close remaining warm leads" done={false} />
              <PriorityItem text={`${targets.conversations} conversations + ${targets.presentations} presentations`} done={todayCounts.conversations >= targets.conversations} />
              <PriorityItem text="Celebrate wins and prepare for next 90-day run" done={false} />
            </>
          )}
        </div>
      </div>

      {/* Contact Queue */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-teal-400" />
          Phase {currentPhase.id} Contact Queue ({phaseContacts.length})
        </h3>
        {Object.entries(groupedContacts).map(([lt, group]) => (
          <div key={lt} className="mb-4">
            <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider">{lt.replace(/_/g, ' ')} ({group.length})</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {group.slice(0, 10).map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleContactAction(c)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-left transition-colors"
                >
                  <div>
                    <span className="text-sm text-white">{c.FullName}</span>
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${c.LeadTemperature === 'Hot' ? 'bg-red-500/20 text-red-300' : c.LeadTemperature === 'Warm' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>
                      {c.LeadTemperature}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              ))}
              {group.length > 10 && (
                <p className="text-xs text-slate-500 text-center py-1">+{group.length - 10} more</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Review (show on Sundays or Day 7, 14, 21...) */}
      {dayNumber % 7 === 0 && (
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-5 border border-amber-500/20">
          <h3 className="text-amber-300 font-bold flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5" />
            Weekly Review — Week {Math.ceil(dayNumber / 7)}
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>1️⃣ What worked this week?</li>
            <li>2️⃣ What slowed you down?</li>
            <li>3️⃣ What will you improve next week?</li>
            <li>4️⃣ Conversations started vs target</li>
            <li>5️⃣ Follow-ups done vs target</li>
            <li>6️⃣ Presentations done vs target</li>
          </ul>
        </div>
      )}

      {/* Focus Rule Footer */}
      <div className="text-center py-4">
        <p className="text-amber-400 font-bold italic text-lg">"No zero days. Even 1% counts."</p>
        <p className="text-slate-500 text-xs mt-1">RESET & RISE by M.A. Baloyi</p>
      </div>

      {/* Template Picker Modal */}
      {templateContact && (
        <MessageTemplatePicker
          contact={templateContact}
          onClose={() => setTemplateContact(null)}
        />
      )}
    </div>
  );
}

function ScoreCard({ icon, label, current, target, color }: { icon: React.ReactNode; label: string; current: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className={`${color}`}>{icon}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{current}<span className="text-slate-500 text-sm font-normal">/{target}</span></p>
      <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
        <div className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PriorityItem({ text, done }: { text: string; done: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {done ? <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" /> : <Circle className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />}
      <span className={`text-sm ${done ? 'text-emerald-300 line-through' : 'text-slate-300'}`}>{text}</span>
    </div>
  );
}
