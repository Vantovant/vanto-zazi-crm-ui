import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Download, ShieldAlert, Users, GitBranch, AlertTriangle, UserPlus, X } from 'lucide-react';

type ResolutionStatus = 'unresolved' | 'ready_to_create' | 'created' | 'skipped';

const OWNER_ID = 'b8028d7d-6a08-45ef-a369-b438c440bea3';

interface ContactLite {
  id: string;
  full_name: string;
  aplgo_id: string;
  sponsor_name: string;
  parent_contact_id: string | null;
  tree_depth: number | null;
  leg: string;
  user_id: string;
}

type MatchStatus = 'exact_match' | 'ambiguous' | 'missing';
type PreviewStatus =
  | 'safe_preview'
  | 'missing_parent'
  | 'ambiguous_parent'
  | 'self_match_risk'
  | 'depth_risk'
  | 'cycle_risk';

interface SponsorRow {
  sponsor_id: string;
  child_count: number;
  status: MatchStatus;
  matched_name: string;
  matched_aplgo_id: string;
  sample_children: string[];
  recommended_action: string;
}

interface PreviewRow {
  child_id: string;
  child_name: string;
  child_aplgo_id: string;
  sponsor_id: string;
  proposed_parent_name: string;
  proposed_parent_aplgo_id: string;
  proposed_leg: string;
  current_tree_depth: number;
  proposed_tree_depth: number | string;
  status: PreviewStatus;
  issue_reason: string;
}

const norm = (s: string) => (s || '').trim();

export function SponsorIdReview() {
  const { user, loading: authLoading } = useAuth();
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<Record<string, ResolutionStatus>>({});
  const [createTarget, setCreateTarget] = useState<{ sponsor_id: string; child_count: number } | null>(null);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Fetch in pages — Supabase default 1000 cap.
      let from = 0;
      const pageSize = 1000;
      const all: ContactLite[] = [];
      // safety cap 20k
      while (from < 20000) {
        const { data, error: e } = await supabase
          .from('contacts')
          .select('id, full_name, aplgo_id, sponsor_name, parent_contact_id, tree_depth, leg, user_id')
          .range(from, from + pageSize - 1);
        if (e) {
          if (!cancelled) setError(e.message);
          break;
        }
        if (!data || data.length === 0) break;
        all.push(...(data as ContactLite[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      if (!cancelled) {
        setContacts(all);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, reloadTick]);

  // ---- Build aplgo_id index ----
  const aplgoIndex = useMemo(() => {
    const map = new Map<string, ContactLite[]>();
    for (const c of contacts) {
      const k = norm(c.aplgo_id);
      if (!k) continue;
      const arr = map.get(k) || [];
      arr.push(c);
      map.set(k, arr);
    }
    return map;
  }, [contacts]);

  // ---- Summary cards ----
  const summary = useMemo(() => {
    const total = contacts.length;
    const withSponsor = contacts.filter((c) => norm(c.sponsor_name)).length;
    const blank = total - withSponsor;
    const distinctSponsors = new Set<string>();
    for (const c of contacts) {
      const s = norm(c.sponsor_name);
      if (s) distinctSponsors.add(s);
    }

    let exact = 0;
    let multi = 0;
    let missing = 0;
    let selfRisk = 0;
    for (const sid of distinctSponsors) {
      const matches = aplgoIndex.get(sid) || [];
      if (matches.length === 1) exact++;
      else if (matches.length > 1) multi++;
      else missing++;
      // self-match risk: any contact whose own aplgo_id == its own sponsor_name
      // counted across contacts below
    }
    for (const c of contacts) {
      if (norm(c.sponsor_name) && norm(c.aplgo_id) && norm(c.sponsor_name) === norm(c.aplgo_id)) {
        selfRisk++;
      }
    }
    const alreadyParented = contacts.filter((c) => c.parent_contact_id).length;

    return {
      total,
      withSponsor,
      blank,
      distinctSponsors: distinctSponsors.size,
      exact,
      multi,
      missing,
      selfRisk,
      alreadyParented,
    };
  }, [contacts, aplgoIndex]);

  // ---- Missing Uplines table ----
  const sponsorRows: SponsorRow[] = useMemo(() => {
    const bySponsor = new Map<string, ContactLite[]>();
    for (const c of contacts) {
      const s = norm(c.sponsor_name);
      if (!s) continue;
      const arr = bySponsor.get(s) || [];
      arr.push(c);
      bySponsor.set(s, arr);
    }
    const rows: SponsorRow[] = [];
    for (const [sid, children] of bySponsor.entries()) {
      const matches = aplgoIndex.get(sid) || [];
      let status: MatchStatus;
      let matched_name = '';
      let matched_aplgo_id = '';
      let action = '';
      if (matches.length === 1) {
        status = 'exact_match';
        matched_name = matches[0].full_name;
        matched_aplgo_id = matches[0].aplgo_id;
        action = 'safe to link later';
      } else if (matches.length > 1) {
        status = 'ambiguous';
        action = 'ambiguous, manual review required';
      } else {
        status = 'missing';
        action = 'needs upline contact imported';
      }
      rows.push({
        sponsor_id: sid,
        child_count: children.length,
        status,
        matched_name,
        matched_aplgo_id,
        sample_children: children.slice(0, 3).map((c) => c.full_name),
        recommended_action: action,
      });
    }
    rows.sort((a, b) => b.child_count - a.child_count);
    return rows;
  }, [contacts, aplgoIndex]);

  // ---- Parent linking preview ----
  const previewRows: PreviewRow[] = useMemo(() => {
    const out: PreviewRow[] = [];
    for (const c of contacts) {
      const sid = norm(c.sponsor_name);
      if (!sid) continue;
      const matches = aplgoIndex.get(sid) || [];
      const currDepth = c.tree_depth ?? 0;

      let status: PreviewStatus = 'safe_preview';
      let reason = '';
      let parentName = '';
      let parentAplgo = '';
      let proposedDepth: number | string = '';

      if (matches.length === 0) {
        status = 'missing_parent';
        reason = 'No contact with matching aplgo_id';
      } else if (matches.length > 1) {
        status = 'ambiguous_parent';
        reason = `${matches.length} contacts share this aplgo_id`;
      } else {
        const p = matches[0];
        parentName = p.full_name;
        parentAplgo = p.aplgo_id;
        if (p.id === c.id) {
          status = 'self_match_risk';
          reason = 'Sponsor ID matches the contact itself';
        } else if ((p.tree_depth ?? 0) >= 13) {
          status = 'depth_risk';
          reason = `Parent depth is ${p.tree_depth} (max 13)`;
          proposedDepth = (p.tree_depth ?? 0) + 1;
        } else {
          // cycle risk: walk parent's ancestors, see if c.id appears
          let walker: string | null = p.parent_contact_id;
          let hops = 0;
          let cycle = false;
          while (walker && hops < 14) {
            if (walker === c.id) {
              cycle = true;
              break;
            }
            const next = contacts.find((x) => x.id === walker);
            walker = next ? next.parent_contact_id : null;
            hops++;
          }
          if (cycle) {
            status = 'cycle_risk';
            reason = 'Linking would create a cycle';
          } else {
            proposedDepth = (p.tree_depth ?? 0) + 1;
            reason = '';
          }
        }
      }

      out.push({
        child_id: c.id,
        child_name: c.full_name,
        child_aplgo_id: c.aplgo_id,
        sponsor_id: sid,
        proposed_parent_name: parentName,
        proposed_parent_aplgo_id: parentAplgo,
        proposed_leg: c.leg || '',
        current_tree_depth: currDepth,
        proposed_tree_depth: proposedDepth === '' ? currDepth : proposedDepth,
        status,
        issue_reason: reason,
      });
    }
    return out;
  }, [contacts, aplgoIndex]);

  const previewCounts = useMemo(() => {
    const c: Record<PreviewStatus, number> = {
      safe_preview: 0,
      missing_parent: 0,
      ambiguous_parent: 0,
      self_match_risk: 0,
      depth_risk: 0,
      cycle_risk: 0,
    };
    for (const r of previewRows) c[r.status]++;
    return c;
  }, [previewRows]);

  // ---- Lineage Consistency Checks ----
  const checks = useMemo(() => {
    const idMap = new Map(contacts.map((c) => [c.id, c]));
    const invalidLeg: ContactLite[] = [];
    const badDepth: ContactLite[] = [];
    const orphanParent: ContactLite[] = [];
    const crossUserParent: ContactLite[] = [];
    const cycle: ContactLite[] = [];
    const depthMismatch: ContactLite[] = [];
    const nullParentBadDepth: ContactLite[] = [];
    const dupParentLeg: ContactLite[] = [];

    const parentLegSeen = new Map<string, ContactLite[]>();

    for (const c of contacts) {
      if (!['L', 'R', ''].includes(c.leg || '')) invalidLeg.push(c);
      const td = c.tree_depth ?? 0;
      if (td < 0 || td > 13) badDepth.push(c);
      if (c.parent_contact_id) {
        const p = idMap.get(c.parent_contact_id);
        if (!p) {
          orphanParent.push(c);
        } else {
          if (p.user_id !== c.user_id) crossUserParent.push(c);
          if ((p.tree_depth ?? 0) + 1 !== td) depthMismatch.push(c);
          // cycle walk
          let walker: string | null = p.parent_contact_id;
          let hops = 0;
          while (walker && hops < 14) {
            if (walker === c.id) {
              cycle.push(c);
              break;
            }
            const next = idMap.get(walker);
            walker = next ? next.parent_contact_id : null;
            hops++;
          }
          // dup parent+leg
          const k = `${c.parent_contact_id}|${c.leg}`;
          if (c.leg) {
            const arr = parentLegSeen.get(k) || [];
            arr.push(c);
            parentLegSeen.set(k, arr);
          }
        }
      } else {
        if (td !== 0) nullParentBadDepth.push(c);
      }
    }
    for (const arr of parentLegSeen.values()) {
      if (arr.length > 1) dupParentLeg.push(...arr);
    }

    return {
      invalidLeg,
      badDepth,
      orphanParent,
      crossUserParent,
      cycle,
      depthMismatch,
      nullParentBadDepth,
      dupParentLeg,
    };
  }, [contacts]);

  // ---- CSV export ----
  const exportCsv = () => {
    const headers = [
      'child_contact_name',
      'child_aplgo_id',
      'sponsor_id',
      'match_status',
      'proposed_parent_name',
      'proposed_parent_aplgo_id',
      'current_tree_depth',
      'proposed_tree_depth',
      'proposed_leg',
      'issue_reason',
    ];
    const escape = (v: string | number) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(',')];
    for (const r of previewRows) {
      lines.push(
        [
          r.child_name,
          r.child_aplgo_id,
          r.sponsor_id,
          r.status,
          r.proposed_parent_name,
          r.proposed_parent_aplgo_id,
          r.current_tree_depth,
          r.proposed_tree_depth,
          r.proposed_leg,
          r.issue_reason,
        ]
          .map(escape)
          .join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sponsor-preview-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Missing uplines (derived from sponsorRows) ----
  const missingRows = useMemo(() => sponsorRows.filter((r) => r.status === 'missing'), [sponsorRows]);

  const exportMissingCsv = () => {
    const headers = ['sponsor_id', 'child_count', 'sample_child_names', 'recommended_placeholder_name', 'status'];
    const escape = (v: string | number) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(',')];
    for (const r of missingRows) {
      lines.push(
        [
          r.sponsor_id,
          r.child_count,
          r.sample_children.join('; '),
          `Upline ${r.sponsor_id}`,
          resolutionStatus[r.sponsor_id] || 'unresolved',
        ]
          .map(escape)
          .join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-uplines-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Create placeholder upline contact (one-by-one, no child writes) ----
  const handleCreateUpline = async () => {
    if (!createTarget || !user) return;
    const sid = norm(createTarget.sponsor_id);
    if (!sid) {
      setError('Sponsor ID is blank.');
      return;
    }
    const isMissing = missingRows.some((r) => r.sponsor_id === sid);
    if (!isMissing) {
      setError('Sponsor ID is not in the missing list (refresh and retry).');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      // Duplicate guard: live re-check against DB for this user
      const { data: existing, error: checkErr } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('aplgo_id', sid)
        .limit(1);
      if (checkErr) throw checkErr;
      if (existing && existing.length > 0) {
        setError(`A contact with aplgo_id ${sid} already exists. Refreshing.`);
        setReloadTick((t) => t + 1);
        setCreateTarget(null);
        setCreating(false);
        return;
      }
      const fullName = norm(createName) || `Upline ${sid}`;
      const noteTag = `[I2C missing upline placeholder] Created from Sponsor Review for sponsor_id ${sid}`;
      const { error: insErr } = await supabase.from('contacts').insert({
        user_id: user.id,
        full_name: fullName,
        aplgo_id: sid,
        sponsor_name: '',
        leg: '',
        tree_depth: 0,
        parent_contact_id: null,
        additional_notes: noteTag,
      });
      if (insErr) throw insErr;
      setResolutionStatus((s) => ({ ...s, [sid]: 'created' }));
      setCreateTarget(null);
      setCreateName('');
      setReloadTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (user.id !== OWNER_ID) {
    return (
      <div className="p-6 text-center text-slate-400">
        <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-amber-400" />
        Admin only.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-teal-400" />
            Sponsor ID Review
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Read-only audit. No parent links, depth, or leg values are written.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={loading || previewRows.length === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 disabled:opacity-40 text-sm"
        >
          <Download className="w-4 h-4" />
          Export sponsor preview CSV
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Loading contacts…</div>
      ) : (
        <>
          {/* Summary cards */}
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Stat label="Total contacts" value={summary.total} />
              <Stat label="With sponsor_name" value={summary.withSponsor} />
              <Stat label="Blank sponsor" value={summary.blank} />
              <Stat label="Distinct sponsor IDs" value={summary.distinctSponsors} />
              <Stat label="Exact aplgo_id match" value={summary.exact} tone="good" />
              <Stat label="Ambiguous (multi-match)" value={summary.multi} tone="warn" />
              <Stat label="Missing (no match)" value={summary.missing} tone="warn" />
              <Stat label="Self-match risks" value={summary.selfRisk} tone="bad" />
              <Stat label="Already parented" value={summary.alreadyParented} />
            </div>
          </section>

          {/* Missing Uplines */}
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">
              Missing Uplines ({sponsorRows.length})
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <Th>Sponsor ID</Th>
                    <Th>Children</Th>
                    <Th>Status</Th>
                    <Th>Matched contact</Th>
                    <Th>Matched aplgo_id</Th>
                    <Th>Sample children</Th>
                    <Th>Recommended action</Th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {sponsorRows.slice(0, 200).map((r) => (
                    <tr key={r.sponsor_id} className="border-t border-slate-800">
                      <Td mono>{r.sponsor_id}</Td>
                      <Td>{r.child_count}</Td>
                      <Td>
                        <StatusBadge status={r.status} />
                      </Td>
                      <Td>{r.matched_name || '—'}</Td>
                      <Td mono>{r.matched_aplgo_id || '—'}</Td>
                      <Td>{r.sample_children.join(', ') || '—'}</Td>
                      <Td>{r.recommended_action}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sponsorRows.length > 200 && (
                <div className="p-2 text-xs text-slate-500 text-center">
                  Showing first 200 of {sponsorRows.length}. Use CSV export for full list.
                </div>
              )}
            </div>
          </section>

          {/* Missing Upline Resolution */}
          <section>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                Missing Upline Resolution ({missingRows.length})
              </h2>
              <button
                type="button"
                onClick={exportMissingCsv}
                disabled={missingRows.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export missing uplines CSV
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Creates a placeholder upline contact only. No child contacts are linked. No parent_contact_id, tree_depth, or leg is written on children.
            </p>
            {missingRows.length === 0 ? (
              <div className="text-sm text-slate-400 p-4 rounded-lg border border-slate-800 bg-slate-900/40">
                No missing sponsor IDs.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <Th>Sponsor ID</Th>
                      <Th>Children</Th>
                      <Th>Sample children</Th>
                      <Th>Recommended action</Th>
                      <Th>Resolution</Th>
                      <Th>Action</Th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {missingRows.slice(0, 200).map((r) => {
                      const rs = resolutionStatus[r.sponsor_id] || 'unresolved';
                      return (
                        <tr key={r.sponsor_id} className="border-t border-slate-800">
                          <Td mono>{r.sponsor_id}</Td>
                          <Td>{r.child_count}</Td>
                          <Td>{r.sample_children.join(', ') || '—'}</Td>
                          <Td>needs upline contact imported</Td>
                          <Td>
                            <ResolutionBadge status={rs} />
                          </Td>
                          <Td>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setCreateName('');
                                  setCreateTarget({ sponsor_id: r.sponsor_id, child_count: r.child_count });
                                }}
                                disabled={rs === 'created'}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 disabled:opacity-40 text-xs"
                              >
                                <UserPlus className="w-3 h-3" />
                                Create upline contact
                              </button>
                              {rs !== 'created' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setResolutionStatus((s) => ({ ...s, [r.sponsor_id]: 'skipped' }))
                                  }
                                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-xs"
                                >
                                  Skip
                                </button>
                              )}
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {missingRows.length > 200 && (
                  <div className="p-2 text-xs text-slate-500 text-center">
                    Showing first 200 of {missingRows.length}. Use CSV export for full list.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Parent Linking Preview */}
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">
              Parent Linking Preview ({previewRows.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
              <Stat label="Safe" value={previewCounts.safe_preview} tone="good" />
              <Stat label="Missing parent" value={previewCounts.missing_parent} tone="warn" />
              <Stat label="Ambiguous" value={previewCounts.ambiguous_parent} tone="warn" />
              <Stat label="Self-match" value={previewCounts.self_match_risk} tone="bad" />
              <Stat label="Depth risk" value={previewCounts.depth_risk} tone="bad" />
              <Stat label="Cycle risk" value={previewCounts.cycle_risk} tone="bad" />
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <Th>Child</Th>
                    <Th>Child aplgo</Th>
                    <Th>Sponsor ID</Th>
                    <Th>Proposed parent</Th>
                    <Th>Parent aplgo</Th>
                    <Th>Leg</Th>
                    <Th>Curr depth</Th>
                    <Th>Proposed depth</Th>
                    <Th>Status</Th>
                    <Th>Reason</Th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {previewRows.slice(0, 200).map((r) => (
                    <tr key={r.child_id} className="border-t border-slate-800">
                      <Td>{r.child_name}</Td>
                      <Td mono>{r.child_aplgo_id || '—'}</Td>
                      <Td mono>{r.sponsor_id}</Td>
                      <Td>{r.proposed_parent_name || '—'}</Td>
                      <Td mono>{r.proposed_parent_aplgo_id || '—'}</Td>
                      <Td>{r.proposed_leg || '—'}</Td>
                      <Td>{r.current_tree_depth}</Td>
                      <Td>{String(r.proposed_tree_depth)}</Td>
                      <Td>
                        <PreviewBadge status={r.status} />
                      </Td>
                      <Td>{r.issue_reason || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > 200 && (
                <div className="p-2 text-xs text-slate-500 text-center">
                  Showing first 200 of {previewRows.length}. Use CSV export for full list.
                </div>
              )}
            </div>
          </section>

          {/* Lineage Consistency Checks */}
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">
              Lineage Consistency Checks
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Check label="Invalid leg" value={checks.invalidLeg.length} />
              <Check label="Depth out of 0–13" value={checks.badDepth.length} />
              <Check label="Parent missing" value={checks.orphanParent.length} />
              <Check label="Parent cross-user" value={checks.crossUserParent.length} />
              <Check label="Cycle risk" value={checks.cycle.length} />
              <Check label="Depth mismatch" value={checks.depthMismatch.length} />
              <Check label="Null parent, depth ≠ 0" value={checks.nullParentBadDepth.length} />
              <Check label="Dup parent + leg" value={checks.dupParentLeg.length} />
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Read-only. No automatic fixes are applied.
            </p>
          </section>
        </>
      )}

      {/* Create Upline Confirmation Modal */}
      {createTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-400" />
                Create upline contact
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCreateTarget(null);
                  setCreateName('');
                }}
                className="text-slate-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              You are about to create a placeholder upline contact for sponsor ID{' '}
              <span className="font-mono text-teal-300">{createTarget.sponsor_id}</span>. This will
              NOT link child contacts yet ({createTarget.child_count} child
              {createTarget.child_count === 1 ? '' : 'ren'}).
            </p>
            <label className="block text-xs text-slate-400 mb-1">
              Optional upline name (leave blank to use “Upline {createTarget.sponsor_id}”)
            </label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={`Upline ${createTarget.sponsor_id}`}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white text-sm mb-4"
            />
            <div className="text-xs text-slate-500 mb-4 space-y-1">
              <div>• aplgo_id will be set to <span className="font-mono">{createTarget.sponsor_id}</span></div>
              <div>• parent_contact_id: null • tree_depth: 0 • leg: empty</div>
              <div>• Tagged in additional_notes as I2C placeholder</div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreateTarget(null);
                  setCreateName('');
                }}
                disabled={creating}
                className="px-3 py-2 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 text-sm disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateUpline}
                disabled={creating}
                className="px-3 py-2 rounded bg-teal-500 text-white hover:bg-teal-600 text-sm disabled:opacity-40"
              >
                {creating ? 'Creating…' : 'Confirm create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'warn'
      ? 'text-amber-300'
      : tone === 'bad'
      ? 'text-red-300'
      : 'text-white';
  return (
    <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-3 py-2">
      <div className="text-xs text-slate-400 truncate">{label}</div>
      <div className={`text-xl font-semibold ${toneClass}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function Check({ label, value }: { label: string; value: number }) {
  const tone = value === 0 ? 'text-emerald-300' : 'text-amber-300';
  return (
    <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-3 py-2 flex items-center gap-2">
      <Users className="w-4 h-4 text-slate-500" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-400 truncate">{label}</div>
        <div className={`text-base font-semibold ${tone}`}>{value}</div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2 font-medium whitespace-nowrap">{children}</th>;
}
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`px-3 py-2 ${mono ? 'font-mono text-xs' : ''} whitespace-nowrap max-w-[240px] truncate`}>
      {children}
    </td>
  );
}
function StatusBadge({ status }: { status: MatchStatus }) {
  const map = {
    exact_match: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    ambiguous: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    missing: 'bg-slate-700/30 text-slate-300 border-slate-600',
  };
  return <span className={`px-2 py-0.5 rounded border text-xs ${map[status]}`}>{status}</span>;
}
function PreviewBadge({ status }: { status: PreviewStatus }) {
  const map: Record<PreviewStatus, string> = {
    safe_preview: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    missing_parent: 'bg-slate-700/30 text-slate-300 border-slate-600',
    ambiguous_parent: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    self_match_risk: 'bg-red-500/10 text-red-300 border-red-500/30',
    depth_risk: 'bg-red-500/10 text-red-300 border-red-500/30',
    cycle_risk: 'bg-red-500/10 text-red-300 border-red-500/30',
  };
  return <span className={`px-2 py-0.5 rounded border text-xs ${map[status]}`}>{status}</span>;
}
