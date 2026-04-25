import { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, Eye, Phone, Check, Pencil, X, Clock, Undo2, Loader2, Send, Lock } from 'lucide-react';

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
  approved_at?: string | null;
  approved_by?: string | null;
  snoozed_until?: string | null;
  snooze_reason?: string | null;
  sent_at?: string | null;
  maytapi_message_id?: string | null;
}

export type ProposalAction =
  | { type: 'approve' }
  | { type: 'undo_approve' }
  | { type: 'edit_save'; newMessage: string; reason?: string }
  | { type: 'reject'; reason: string }
  | { type: 'snooze'; until: string; label: string }
  | { type: 'unsnooze' }
  | { type: 'send_whatsapp' };

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

const REJECT_REASONS = [
  { id: 'wrong_tone', label: 'Wrong tone' },
  { id: 'wrong_need', label: 'Wrong leadership need' },
  { id: 'bad_grounding', label: 'Bad grounding / unsupported claim' },
  { id: 'not_now', label: 'Not the right time' },
  { id: 'pressure', label: 'Feels like pressure' },
  { id: 'duplicate', label: 'Duplicate / already handled' },
  { id: 'other', label: 'Other' },
];

const SNOOZE_OPTIONS = [
  { id: 'tomorrow', label: 'Tomorrow', hours: 24 },
  { id: '3d', label: '3 days', hours: 72 },
  { id: '7d', label: '7 days', hours: 168 },
];

function approvalGate(p: ProspectorProposal): { ok: boolean; reason?: string } {
  if (p.supervisor_block_reason) return { ok: false, reason: 'Supervisor blocked this draft.' };
  if (p.supervisor_quality_score == null) return { ok: false, reason: 'Not yet scored by Supervisor.' };
  if ((p.supervisor_safety ?? 0) < 70) return { ok: false, reason: 'Safety score below 70.' };
  if ((p.supervisor_leadership_fit ?? 0) < 60) return { ok: false, reason: 'Leadership fit below 60.' };
  if ((p.supervisor_quality_score ?? 0) < 60) return { ok: false, reason: 'Overall quality below 60.' };
  return { ok: true };
}

interface Props {
  proposal: ProspectorProposal;
  onAction: (action: ProposalAction) => Promise<void> | void;
  busy?: boolean;
}

export function ProspectorProposalCard({ proposal, onAction, busy = false }: Props) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'reject' | 'snooze'>('view');
  const [editText, setEditText] = useState(proposal.proposed_message || '');
  const [editReason, setEditReason] = useState('');
  const [rejectReason, setRejectReason] = useState<string>('wrong_tone');
  const [rejectNote, setRejectNote] = useState('');
  const [customSnoozeDate, setCustomSnoozeDate] = useState('');

  const blocked = !!proposal.supervisor_block_reason;
  const stageCls = stageColor[proposal.movement_stage] || 'bg-slate-700/40 text-slate-300 border-slate-700';
  const detector = proposal.evidence?.detector || {};
  const reasoner = proposal.evidence?.reasoner || {};
  const composer = proposal.evidence?.composer || {};
  const gate = approvalGate(proposal);

  const status = proposal.status;
  const statusBadge = (() => {
    if (status === 'approved') return { text: 'APPROVED — NOT SENT', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' };
    if (status === 'rejected') return { text: 'REJECTED — WILL NOT SEND', cls: 'bg-red-500/15 text-red-300 border-red-500/40' };
    if (status === 'snoozed') return { text: 'SNOOZED — NOT ACTIVE', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40' };
    if (blocked) return { text: 'NEEDS REVIEW', cls: 'bg-red-500/15 text-red-300 border-red-500/40' };
    return { text: 'SHADOW DRAFT — NOT SENT', cls: 'bg-slate-700/60 text-slate-300 border-slate-600' };
  })();

  const cardBorder = status === 'approved' ? 'border-emerald-500/40'
    : status === 'rejected' ? 'border-red-500/30 opacity-70'
    : status === 'snoozed' ? 'border-blue-500/30'
    : blocked ? 'border-red-500/40'
    : 'border-slate-700';

  const handleSnooze = (hours: number, label: string) => {
    const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    onAction({ type: 'snooze', until, label });
    setMode('view');
  };

  const handleCustomSnooze = () => {
    if (!customSnoozeDate) return;
    const until = new Date(customSnoozeDate).toISOString();
    onAction({ type: 'snooze', until, label: 'custom' });
    setMode('view');
    setCustomSnoozeDate('');
  };

  return (
    <div className={`bg-slate-800/60 border rounded-xl p-4 ${cardBorder}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-semibold text-white truncate">{proposal.contact_name || 'Unknown contact'}</h4>
            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${statusBadge.cls}`}>
              {statusBadge.text}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-slate-900/80 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
              <Eye className="w-3 h-3" /> Admin review
            </span>
          </div>
          {proposal.contact_phone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <Phone className="w-3 h-3" />
              {proposal.contact_phone}
            </div>
          )}
          {status === 'snoozed' && proposal.snoozed_until && (
            <div className="text-xs text-blue-300 mt-1">Snoozed until {new Date(proposal.snoozed_until).toLocaleString()}</div>
          )}
          {status === 'approved' && proposal.approved_at && (
            <div className="text-xs text-emerald-300 mt-1">Approved {new Date(proposal.approved_at).toLocaleString()} — NOT SENT YET</div>
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
            <div className="text-xs font-semibold text-red-300">Supervisor review failed. Fix or reject this draft.</div>
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

      {/* Proposed message (or edit field) */}
      <div className="mt-3 bg-slate-900/60 border border-slate-700 rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Proposed Message</div>
        {mode === 'edit' ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={6}
              className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <input
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Edit reason (optional)"
              className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-slate-200"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setMode('view'); setEditText(proposal.proposed_message || ''); setEditReason(''); }}
                className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
                disabled={busy}
              >Cancel</button>
              <button
                onClick={async () => {
                  await onAction({ type: 'edit_save', newMessage: editText, reason: editReason });
                  setMode('view');
                  setEditReason('');
                }}
                className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded inline-flex items-center gap-1"
                disabled={busy || !editText.trim() || editText === proposal.proposed_message}
              >{busy && <Loader2 className="w-3 h-3 animate-spin" />} Save edit (stays draft)</button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
            {proposal.proposed_message || <span className="text-slate-500 italic">No message drafted</span>}
          </div>
        )}
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

      {/* Reject panel */}
      {mode === 'reject' && (
        <div className="mt-3 bg-red-500/5 border border-red-500/30 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-red-200">Reason for rejection</div>
          <select
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200"
          >
            {REJECT_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <input
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Optional note"
            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-slate-200"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setMode('view')} className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded" disabled={busy}>Cancel</button>
            <button
              onClick={async () => {
                await onAction({ type: 'reject', reason: rejectNote ? `${rejectReason}: ${rejectNote}` : rejectReason });
                setMode('view');
              }}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded inline-flex items-center gap-1"
              disabled={busy}
            >{busy && <Loader2 className="w-3 h-3 animate-spin" />} Confirm reject</button>
          </div>
        </div>
      )}

      {/* Snooze panel */}
      {mode === 'snooze' && (
        <div className="mt-3 bg-blue-500/5 border border-blue-500/30 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-blue-200">Snooze until</div>
          <div className="flex flex-wrap gap-2">
            {SNOOZE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleSnooze(opt.hours, opt.label)}
                className="px-3 py-1 text-xs bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-100 rounded"
                disabled={busy}
              >{opt.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={customSnoozeDate}
              onChange={(e) => setCustomSnoozeDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md p-1.5 text-xs text-slate-200"
            />
            <button
              onClick={handleCustomSnooze}
              disabled={busy || !customSnoozeDate}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
            >Snooze custom</button>
            <button onClick={() => setMode('view')} className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded ml-auto">Cancel</button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {mode === 'view' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {status === 'draft' && (
            <>
              <button
                onClick={() => onAction({ type: 'approve' })}
                disabled={busy || !gate.ok}
                title={gate.ok ? 'Approve for future Maytapi send (NOT sent yet)' : gate.reason}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
              </button>
              <button
                onClick={() => { setEditText(proposal.proposed_message || ''); setMode('edit'); }}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-violet-600/80 hover:bg-violet-600 text-white rounded"
              ><Pencil className="w-3 h-3" /> Edit</button>
              <button
                onClick={() => setMode('reject')}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-600/80 hover:bg-red-600 text-white rounded"
              ><X className="w-3 h-3" /> Reject</button>
              <button
                onClick={() => setMode('snooze')}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600/80 hover:bg-blue-600 text-white rounded"
              ><Clock className="w-3 h-3" /> Snooze</button>
              {!gate.ok && (
                <span className="text-[11px] text-amber-300">{gate.reason}</span>
              )}
            </>
          )}
          {status === 'approved' && (
            <>
              <span className="text-xs text-emerald-300 font-medium">Approved for future Maytapi send — NOT SENT YET</span>
              <button
                onClick={() => onAction({ type: 'undo_approve' })}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-100 rounded ml-auto"
              ><Undo2 className="w-3 h-3" /> Undo approval</button>
            </>
          )}
          {status === 'snoozed' && (
            <>
              <span className="text-xs text-blue-300">Snoozed{proposal.snooze_reason ? ` (${proposal.snooze_reason})` : ''}</span>
              <button
                onClick={() => onAction({ type: 'unsnooze' })}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-100 rounded ml-auto"
              ><Undo2 className="w-3 h-3" /> Move back to draft</button>
            </>
          )}
          {status === 'rejected' && (
            <span className="text-xs text-red-300">Rejected — feedback stored for Phase L learning loop</span>
          )}
        </div>
      )}

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
          {(proposal.evidence?.feedback || proposal.evidence?.ui_edit) && (
            <div>
              <div className="text-[10px] uppercase text-slate-500 mb-1">Reviewer Feedback / Edits</div>
              <pre className="text-[11px] text-slate-300 whitespace-pre-wrap">{JSON.stringify({ feedback: proposal.evidence?.feedback, ui_edit: proposal.evidence?.ui_edit }, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
