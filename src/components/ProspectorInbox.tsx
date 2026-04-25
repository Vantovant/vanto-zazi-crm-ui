import { useEffect, useMemo, useState } from 'react';
import { Loader2, Inbox, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProspectorProposalCard, type ProspectorProposal, type ProposalAction } from './ProspectorProposalCard';

type FilterKey = 'draft_review' | 'draft' | 'approved' | 'sent' | 'rejected' | 'snoozed' | 'needs_review' | 'all';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'draft_review', label: 'Draft + Needs Review' },
  { key: 'draft', label: 'Draft' },
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'approved', label: 'Approved (not sent)' },
  { key: 'sent', label: 'Sent' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

/**
 * Prospector Inbox — Phase D.1
 * Admin/owner only. Approve/Edit/Reject/Snooze writes status only on zazi_actions.
 * NO Maytapi send. NO contact_activities writes. NO contacts.lead_type writes.
 */
export function ProspectorInbox() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<ProspectorProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('draft_review');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Admin check
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) { if (!cancelled) setIsAdmin(false); return; }
      const { data } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    };
    check();
    return () => { cancelled = true; };
  }, [user]);

  const fetchProposals = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: err } = await supabase
        .from('zazi_actions')
        .select('id, contact_id, status, movement_stage, leadership_need, belief_risk, recommended_tone, reason_for_message, next_best_business_action, expected_next_step, proposed_message, supervisor_quality_score, supervisor_safety, supervisor_grounding, supervisor_cultural_fit, supervisor_clarity, supervisor_relevance, supervisor_tone_fit, supervisor_leadership_fit, supervisor_block_reason, evidence, created_at, approved_at, approved_by, snoozed_until, snooze_reason, sent_at, maytapi_message_id' as any)
        .eq('user_id', user.id);
      if (err) throw err;

      const contactIds = Array.from(new Set((rows || []).map((r: any) => r.contact_id).filter(Boolean)));
      const contactMap: Record<string, { full_name: string; phone_number: string }> = {};
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, full_name, phone_number')
          .in('id', contactIds);
        (contacts || []).forEach((c: any) => {
          contactMap[c.id] = { full_name: c.full_name, phone_number: c.phone_number };
        });
      }

      const enriched: ProspectorProposal[] = (rows || []).map((r: any) => ({
        ...r,
        contact_name: r.contact_id ? (contactMap[r.contact_id]?.full_name || 'Unknown contact') : 'Unknown contact',
        contact_phone: r.contact_id ? (contactMap[r.contact_id]?.phone_number || '') : '',
      }));

      enriched.sort((a, b) => {
        // Sent rows last
        const aSent = a.status === 'sent' || !!a.sent_at ? 1 : 0;
        const bSent = b.status === 'sent' || !!b.sent_at ? 1 : 0;
        if (aSent !== bSent) return aSent - bSent;
        const aBlock = a.supervisor_block_reason ? 1 : 0;
        const bBlock = b.supervisor_block_reason ? 1 : 0;
        if (aBlock !== bBlock) return bBlock - aBlock;
        if (a.belief_risk !== b.belief_risk) return b.belief_risk - a.belief_risk;
        const aQ = a.supervisor_quality_score ?? 999;
        const bQ = b.supervisor_quality_score ?? 999;
        if (aQ !== bQ) return aQ - bQ;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setProposals(enriched);
    } catch (e: any) {
      setError(e?.message || 'Failed to load drafts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || !user) return;
    fetchProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user]);

  const filtered = useMemo(() => {
    return proposals.filter((p) => {
      const isSent = p.status === 'sent' || !!p.sent_at;
      const needsReview = p.status === 'draft' && !!p.supervisor_block_reason;
      switch (filter) {
        case 'draft_review': return p.status === 'draft';
        case 'draft': return p.status === 'draft' && !p.supervisor_block_reason;
        case 'needs_review': return needsReview;
        case 'approved': return p.status === 'approved' && !isSent;
        case 'sent': return isSent;
        case 'rejected': return p.status === 'rejected';
        case 'snoozed': return p.status === 'snoozed';
        case 'all': return true;
        default: return true;
      }
    });
  }, [proposals, filter]);

  const counts = useMemo(() => ({
    draft: proposals.filter((p) => p.status === 'draft').length,
    approved: proposals.filter((p) => p.status === 'approved' && !p.sent_at).length,
    sent: proposals.filter((p) => p.status === 'sent' || !!p.sent_at).length,
    rejected: proposals.filter((p) => p.status === 'rejected').length,
    snoozed: proposals.filter((p) => p.status === 'snoozed').length,
    needs_review: proposals.filter((p) => p.status === 'draft' && !!p.supervisor_block_reason).length,
  }), [proposals]);

  // ---- D.1.1 action handler — calls admin-only edge function (no direct table writes) ----
  // ---- E.1: send_whatsapp invokes the already-tested maytapi-send-1to1 (test_mode=true) ----
  const handleAction = async (proposal: ProspectorProposal, action: ProposalAction) => {
    if (!user || !isAdmin) return;
    setBusyId(proposal.id);
    setError(null);
    try {
      // E.1 — one-by-one send via existing maytapi-send-1to1 (no batch, no cron)
      if (action.type === 'send_whatsapp') {
        // Hard client-side gate (server enforces too)
        const okGate = proposal.status === 'approved'
          && !proposal.sent_at
          && !proposal.maytapi_message_id
          && !proposal.supervisor_block_reason
          && (proposal.supervisor_quality_score ?? 0) >= 60
          && (proposal.supervisor_safety ?? 0) >= 70
          && (proposal.supervisor_leadership_fit ?? 0) >= 60;
        if (!okGate) throw new Error('Send blocked: row is not eligible.');

        const { data, error: fnErr } = await supabase.functions.invoke('maytapi-send-1to1', {
          body: { zazi_action_id: proposal.id, test_mode: true },
        });
        if (fnErr) throw fnErr;
        if (data && (data as any).error) throw new Error((data as any).error);
        await fetchProposals();
        return;
      }

      let payload: Record<string, unknown> = { id: proposal.id };
      if (action.type === 'approve') payload = { ...payload, type: 'approve' };
      else if (action.type === 'undo_approve') payload = { ...payload, type: 'undo_approve' };
      else if (action.type === 'edit_save') payload = { ...payload, type: 'edit_save', new_message: action.newMessage, reason: action.reason };
      else if (action.type === 'reject') payload = { ...payload, type: 'reject', reason: action.reason };
      else if (action.type === 'snooze') payload = { ...payload, type: 'snooze', until: action.until, label: action.label };
      else if (action.type === 'unsnooze') payload = { ...payload, type: 'unsnooze' };

      const { data, error: fnErr } = await supabase.functions.invoke('zazi-prospector-action', {
        body: payload,
      });
      if (fnErr) throw fnErr;
      if (data && (data as any).error) throw new Error((data as any).error);

      await fetchProposals();
    } catch (e: any) {
      setError(e?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  if (isAdmin === null) return null;
  if (isAdmin === false) return null;

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-white">Prospector Inbox</h3>
          <span className="text-[10px] uppercase tracking-wide bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded border border-violet-500/30">
            Admin only · Approval workflow · No send yet
          </span>
        </div>
        <div className="text-xs text-slate-400">
          {counts.draft} draft · {counts.needs_review} needs review · {counts.approved} approved · {counts.sent} sent · {counts.snoozed} snoozed · {counts.rejected} rejected
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              filter === f.key
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >{f.label}</button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading drafts...
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 mb-3">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Inbox className="w-10 h-10 text-slate-600 mb-2" />
          <div className="text-sm text-slate-400">
            {proposals.length === 0
              ? 'No Prospector drafts yet. Run a manual admin shadow scan first.'
              : 'No drafts match this filter.'}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((p) => (
            <ProspectorProposalCard
              key={p.id}
              proposal={p}
              busy={busyId === p.id}
              onAction={(action) => handleAction(p, action)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
