import { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, Eye, Phone } from 'lucide-react';

interface SupervisorScores {
  safety?: number | null;
  grounding?: number | null;
  cultural_fit?: number | null;
  clarity?: number | null;
  relevance?: number | null;
  tone_fit?: number | null;
  leadership_fit?: number | null;
  overall?: number | null;
}

export interface ProspectorProposal {
  id: string;
  contact_id: string | null;
  contact_name: string;
  contact_phone: string;
  status: string;
  movement_stage: string;
  leadership_need: string;
  belief_risk: number;
  recommended_tone: string;
  reason_for_message: string;
  next_best_business_action: string;
  expected_next_step: string;
  proposed_message: string;
  supervisor_quality_score: number | null;
  supervisor_safety: number | null;
  supervisor_grounding: number | null;
  supervisor_cultural_fit: number | null;
  supervisor_clarity: number | null;
  supervisor_relevance: number | null;
  supervisor_tone_fit: number | null;
  supervisor_leadership_fit: number | null;
  supervisor_block_reason: string | null;
  evidence: any;
  created_at: string;
}

const stageColor: Record<string, string> = {
  expired: 'bg-red-500/20 text-red-300 border-red-500/30',
  registered_nopurchase: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  purchase_nostatus: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  purchase_status: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  upgraded: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  builder: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  future_leader: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
};

const scoreColor = (n: number | null | undefined) => {
  if (n == null) return 'text-slate-500';
  if (n >= 75) return 'text-emerald-400';
  if (n >= 60) return 'text-amber-400';
  return 'text-red-400';
};

function ScoreCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-slate-900/60 rounded-md px-2 py-1.5 border border-slate-800">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-sm font-semibold ${scoreColor(value)}`}>
        {value == null ? '—' : value}
      </div>
    </div>
  );
}

export function ProspectorProposalCard({ proposal }: { proposal: ProspectorProposal }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const blocked = !!proposal.supervisor_block_reason;
  const stageCls = stageColor[proposal.movement_stage] || 'bg-slate-700/40 text-slate-300 border-slate-700';

  const detector = proposal.evidence?.detector || {};
  const reasoner = proposal.evidence?.reasoner || {};
  const composer = proposal.evidence?.composer || {};

  return (
    <div className={`bg-slate-800/60 border rounded-xl p-4 ${blocked ? 'border-red-500/40' : 'border-slate-700'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-semibold text-white truncate">{proposal.contact_name || 'Unknown contact'}</h4>
            <span className="text-[10px] uppercase tracking-wide bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded border border-slate-600">
              SHADOW DRAFT — NOT SENT
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-slate-900/80 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
              <Eye className="w-3 h-3" /> Read-only review
            </span>
          </div>
          {proposal.contact_phone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <Phone className="w-3 h-3" />
              {proposal.contact_phone}
            </div>
          )}
        </div>

        {/* Quality score pill */}
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Supervisor Shadow Score</div>
          <div className={`text-2xl font-bold ${scoreColor(proposal.supervisor_quality_score)}`}>
            {proposal.supervisor_quality_score ?? '—'}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${stageCls}`}>
          stage: {proposal.movement_stage || '—'}
        </span>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-teal-500/15 text-teal-300 border-teal-500/30">
          need: {proposal.leadership_need || '—'}
        </span>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-slate-700/40 text-slate-300 border-slate-600">
          tone: {proposal.recommended_tone || '—'}
        </span>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
          proposal.belief_risk >= 70 ? 'bg-red-500/15 text-red-300 border-red-500/30'
          : proposal.belief_risk >= 40 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
        }`}>
          belief risk: {proposal.belief_risk}
        </span>
      </div>

      {/* Block warning */}
      {blocked && (
        <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <ShieldAlert className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-red-300">Needs review before approval phase</div>
            <div className="text-xs text-red-200/80 mt-0.5">{proposal.supervisor_block_reason}</div>
          </div>
        </div>
      )}

      {/* Reason / next step grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-xs">
        <div className="bg-slate-900/40 rounded-md p-2 border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 mb-0.5">Reason for Message</div>
          <div className="text-slate-300">{proposal.reason_for_message || '—'}</div>
        </div>
        <div className="bg-slate-900/40 rounded-md p-2 border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 mb-0.5">Next Best Action</div>
          <div className="text-slate-300">{proposal.next_best_business_action || '—'}</div>
        </div>
        <div className="bg-slate-900/40 rounded-md p-2 border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 mb-0.5">Expected Next Step</div>
          <div className="text-slate-300">{proposal.expected_next_step || '—'}</div>
        </div>
      </div>

      {/* Proposed message */}
      <div className="mt-3 bg-slate-900/60 border border-slate-700 rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Proposed Message</div>
        <div className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
          {proposal.proposed_message || <span className="text-slate-500 italic">No message drafted</span>}
        </div>
      </div>

      {/* 7-axis breakdown */}
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">7-Axis Supervisor Breakdown</div>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5">
          <ScoreCell label="Safety" value={proposal.supervisor_safety} />
          <ScoreCell label="Grounding" value={proposal.supervisor_grounding} />
          <ScoreCell label="Cultural" value={proposal.supervisor_cultural_fit} />
          <ScoreCell label="Clarity" value={proposal.supervisor_clarity} />
          <ScoreCell label="Relevance" value={proposal.supervisor_relevance} />
          <ScoreCell label="Tone" value={proposal.supervisor_tone_fit} />
          <ScoreCell label="Leadership" value={proposal.supervisor_leadership_fit} />
        </div>
      </div>

      {/* Evidence accordion */}
      <button
        type="button"
        onClick={() => setShowEvidence((s) => !s)}
        className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
      >
        {showEvidence ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {showEvidence ? 'Hide evidence' : 'Show evidence'}
      </button>
      {showEvidence && (
        <div className="mt-2 bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
          <div>
            <div className="text-[10px] uppercase text-slate-500 mb-1">Detector</div>
            <ul className="text-slate-300 space-y-0.5">
              <li><span className="text-slate-500">signals:</span> {Array.isArray(detector.signals) && detector.signals.length ? detector.signals.join(', ') : '—'}</li>
              <li><span className="text-slate-500">health_score:</span> {detector.health_score ?? '—'}</li>
              <li><span className="text-slate-500">last_inbound_at:</span> {detector.last_inbound_at ?? '—'}</li>
              <li><span className="text-slate-500">last_outbound_at:</span> {detector.last_outbound_at ?? '—'}</li>
              <li><span className="text-slate-500">last_order_at:</span> {detector.last_order_at ?? '—'}</li>
              <li><span className="text-slate-500">monthly_pv_status:</span> {detector.monthly_pv_status ?? '—'}</li>
              <li><span className="text-slate-500">days_since_activity:</span> {detector.days_since_activity ?? '—'}</li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500 mb-1">Reasoner</div>
            <ul className="text-slate-300 space-y-0.5">
              <li><span className="text-slate-500">stage_rule:</span> {reasoner.stage_rule ?? '—'}</li>
              <li><span className="text-slate-500">selected_reason:</span> {reasoner.selected_reason ?? '—'}</li>
              <li><span className="text-slate-500">alternatives:</span> {Array.isArray(reasoner.alternatives_considered) ? reasoner.alternatives_considered.join(', ') : '—'}</li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500 mb-1">Composer</div>
            <ul className="text-slate-300 space-y-0.5">
              <li><span className="text-slate-500">template_or_pattern_used:</span> {composer.template_or_pattern_used ?? '—'}</li>
              <li><span className="text-slate-500">knowledge_used:</span> {Array.isArray(composer.knowledge_used) && composer.knowledge_used.length ? composer.knowledge_used.join(', ') : '—'}</li>
              <li><span className="text-slate-500">safety_constraints_applied:</span> {Array.isArray(composer.safety_constraints_applied) && composer.safety_constraints_applied.length ? composer.safety_constraints_applied.join(', ') : '—'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
