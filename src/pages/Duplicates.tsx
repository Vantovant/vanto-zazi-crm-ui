import { useState, useEffect, useCallback } from 'react';
import { GitMerge, Loader2, CheckCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import { DataStatusBanner } from '@/components/DataStatusBanner';

interface DuplicateContact {
  id: string;
  full_name: string;
  phone_number: string;
  email_address: string;
  phone_normalized: string | null;
  email_normalized: string | null;
  lead_type: string;
  registration_status: string;
  go_status: string;
  additional_notes: string;
  updated_at: string;
  created_at: string;
  [key: string]: unknown;
}

interface DuplicateGroup {
  key_type: 'phone' | 'email';
  key_value: string;
  contacts: DuplicateContact[];
}

export function Duplicates() {
  const { user } = useAuth();
  const { dbActive, refetchContacts } = useCrm();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<{ group: string; success: boolean } | null>(null);

  const fetchDuplicates = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch all contacts for this user with normalized fields
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.error('Error fetching contacts for duplicates:', error);
      setLoading(false);
      return;
    }

    const contacts = data as DuplicateContact[];

    // Group by phone_normalized
    const phoneMap = new Map<string, DuplicateContact[]>();
    const emailMap = new Map<string, DuplicateContact[]>();

    for (const c of contacts) {
      if (c.phone_normalized) {
        const existing = phoneMap.get(c.phone_normalized) || [];
        existing.push(c);
        phoneMap.set(c.phone_normalized, existing);
      }
      if (c.email_normalized) {
        const existing = emailMap.get(c.email_normalized) || [];
        existing.push(c);
        emailMap.set(c.email_normalized, existing);
      }
    }

    const result: DuplicateGroup[] = [];
    const seenIds = new Set<string>();

    for (const [key, contacts] of phoneMap) {
      if (contacts.length > 1) {
        result.push({ key_type: 'phone', key_value: key, contacts });
        for (const c of contacts) seenIds.add(c.id);
      }
    }

    for (const [key, contacts] of emailMap) {
      if (contacts.length > 1) {
        // Only add if not already covered by phone group
        const allCovered = contacts.every(c => seenIds.has(c.id));
        if (!allCovered) {
          result.push({ key_type: 'email', key_value: key, contacts });
        }
      }
    }

    setGroups(result);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDuplicates(); }, [fetchDuplicates]);

  const handleMerge = async (group: DuplicateGroup, primaryId: string) => {
    if (!user) return;
    const groupKey = `${group.key_type}:${group.key_value}`;
    setMerging(groupKey);

    const primary = group.contacts.find(c => c.id === primaryId);
    const secondaries = group.contacts.filter(c => c.id !== primaryId);
    if (!primary || secondaries.length === 0) return;

    // Build merged values: keep primary if non-empty, else take from secondary
    const mergeFields = [
      'full_name', 'phone_number', 'email_address', 'city', 'province', 'state', 'country',
      'lead_temperature', 'communication_status', 'registration_status', 'lead_type',
      'interest_level', 'focus_area', 'lead_path', 'sponsor_name', 'assigned_to',
      'action_taken', 'next_action', 'meeting_time', 'aplgo_id', 'associate_status',
      'go_status',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of mergeFields) {
      const primaryVal = String(primary[field] ?? '').trim();
      if (!primaryVal) {
        for (const sec of secondaries) {
          const secVal = String(sec[field] ?? '').trim();
          if (secVal) { updates[field] = secVal; break; }
        }
      }
    }

    // Merge notes with timestamps
    let mergedNotes = String(primary.additional_notes || '').trim();
    for (const sec of secondaries) {
      const secNotes = String(sec.additional_notes || '').trim();
      if (secNotes && secNotes !== mergedNotes) {
        mergedNotes += `\n\n--- Merged from ${sec.full_name} (${new Date().toISOString().split('T')[0]}) ---\n${secNotes}`;
      }
    }
    if (mergedNotes !== String(primary.additional_notes || '').trim()) {
      updates.additional_notes = mergedNotes;
    }

    // Update primary
    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase.from('contacts').update(updates).eq('id', primaryId);
      if (updateErr) {
        console.error('Merge update error:', updateErr);
        setMerging(null);
        return;
      }
    }

    // Delete secondaries
    const secondaryIds = secondaries.map(s => s.id);
    for (const id of secondaryIds) {
      await supabase.from('contacts').delete().eq('id', id);
    }

    // Log merge
    await supabase.from('merge_log').insert({
      user_id: user.id,
      primary_id: primaryId,
      merged_ids: secondaryIds,
      key_type: group.key_type,
      key_value: group.key_value,
    } as any);

    setMergeResult({ group: groupKey, success: true });
    setMerging(null);
    await refetchContacts();
    await fetchDuplicates();
  };

  const totalDuplicateContacts = groups.reduce((sum, g) => sum + g.contacts.length - 1, 0);

  return (
    <div className="space-y-4">
      <DataStatusBanner dbActive={dbActive} />

      <div>
        <h1 className="text-2xl font-semibold text-white">Resolve Duplicates</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {loading ? 'Scanning...' : groups.length === 0
            ? 'No duplicates found — your contacts are clean!'
            : `${groups.length} duplicate group${groups.length > 1 ? 's' : ''} found (${totalDuplicateContacts} extra record${totalDuplicateContacts > 1 ? 's' : ''})`
          }
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="py-16 text-center bg-slate-800/50 border border-slate-700 rounded-xl">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-white font-medium">All clear!</p>
          <p className="text-sm text-slate-400 mt-1">No duplicate contacts detected.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const groupKey = `${group.key_type}:${group.key_value}`;
            const isExpanded = expandedGroup === groupKey;
            const isMerging = merging === groupKey;

            return (
              <div key={groupKey} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedGroup(isExpanded ? null : groupKey)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {group.contacts.length} contacts share{' '}
                        <span className="text-amber-400">{group.key_type}</span>:{' '}
                        <span className="font-mono text-xs text-slate-300">{group.key_value}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {group.contacts.map(c => c.full_name).join(' • ')}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-3">
                    <p className="text-xs text-slate-400">Select the primary record to keep. Data from other records will be merged in.</p>
                    {group.contacts.map((contact, idx) => (
                      <div key={contact.id} className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{contact.full_name}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                            <span>📞 {contact.phone_number || '—'}</span>
                            <span>✉️ {contact.email_address || '—'}</span>
                            <span>{contact.lead_type}</span>
                            <span>{contact.registration_status}</span>
                            {contact.go_status && <span>GO: {contact.go_status}</span>}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Created: {new Date(contact.created_at).toLocaleDateString()} · Updated: {new Date(contact.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMerge(group, contact.id)}
                          disabled={isMerging}
                          className="flex items-center gap-1.5 px-3 py-2 ml-3 text-xs font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
                        >
                          {isMerging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
                          Keep This
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
