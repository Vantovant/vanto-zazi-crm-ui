import { useEffect, useState } from 'react';
import { Loader2, Inbox, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProspectorProposalCard, type ProspectorProposal } from './ProspectorProposalCard';

/**
 * Prospector Inbox — Phase D.0 (READ-ONLY)
 * Admin/owner only. SELECT-only. No writes, no status changes, no sends.
 */
export function ProspectorInbox() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<ProspectorProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Admin check (mirrors TeamDashboard pattern)
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

  // Fetch drafts (SELECT only)
  useEffect(() => {
    if (!isAdmin || !user) return;
    let cancelled = false;
    const fetchDrafts = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: rows, error: err } = await supabase
          .from('zazi_actions')
          .select('id, contact_id, status, movement_stage, leadership_need, belief_risk, recommended_tone, reason_for_message, next_best_business_action, expected_next_step, proposed_message, supervisor_quality_score, supervisor_safety, supervisor_grounding, supervisor_cultural_fit, supervisor_clarity, supervisor_relevance, supervisor_tone_fit, supervisor_leadership_fit, supervisor_block_reason, evidence, created_at')
          .eq('user_id', user.id)
          .eq('status', 'draft');
        if (err) throw err;

        const contactIds = Array.from(new Set((rows || []).map((r: any) => r.contact_id).filter(Boolean)));
        let contactMap: Record<string, { full_name: string; phone_number: string }> = {};
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

        // Sort: blocked first, belief_risk desc, supervisor_quality_score asc (nulls last), created_at desc
        enriched.sort((a, b) => {
          const aBlock = a.supervisor_block_reason ? 1 : 0;
          const bBlock = b.supervisor_block_reason ? 1 : 0;
          if (aBlock !== bBlock) return bBlock - aBlock;
          if (a.belief_risk !== b.belief_risk) return b.belief_risk - a.belief_risk;
          const aQ = a.supervisor_quality_score ?? 999;
          const bQ = b.supervisor_quality_score ?? 999;
          if (aQ !== bQ) return aQ - bQ;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        if (!cancelled) setProposals(enriched);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load drafts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDrafts();
    return () => { cancelled = true; };
  }, [isAdmin, user]);

  // Hide entirely from non-admins
  if (isAdmin === null) return null;
  if (isAdmin === false) return null;

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-white">Prospector Inbox</h3>
          <span className="text-[10px] uppercase tracking-wide bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded border border-violet-500/30">
            Admin only · Shadow mode
          </span>
        </div>
        <div className="text-xs text-slate-400">
          {proposals.length} draft{proposals.length === 1 ? '' : 's'} · Read-only review
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading drafts...
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && proposals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Inbox className="w-10 h-10 text-slate-600 mb-2" />
          <div className="text-sm text-slate-400">No Prospector drafts yet. Run a manual admin shadow scan first.</div>
        </div>
      )}

      {!loading && !error && proposals.length > 0 && (
        <div className="space-y-3">
          {proposals.map((p) => (
            <ProspectorProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      )}
    </div>
  );
}
