import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WaitingRoomEntry {
  id: string;
  user_id: string;
  contact_id: string;
  issue_type: string;
  issue_note: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export const ISSUE_TYPES = [
  { value: 'whatsapp_not_working', label: 'WhatsApp not working' },
  { value: 'wrong_email', label: 'Wrong email' },
  { value: 'wrong_phone', label: 'Wrong phone number' },
  { value: 'missing_contact_info', label: 'Missing details' },
  { value: 'duplicate_review', label: 'Duplicate review' },
  { value: 'wrong_aplgo_id', label: 'Wrong APLGO ID' },
  { value: 'follow_up_correction', label: 'Need follow-up correction' },
  { value: 'other', label: 'Other' },
] as const;

export const ISSUE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ISSUE_TYPES.map(t => [t.value, t.label])
);

export function useWaitingRoom() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WaitingRoomEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase.from('contact_waiting_room') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setEntries(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const addToWaitingRoom = useCallback(async (params: {
    contact_id: string;
    issue_type: string;
    issue_note: string;
    priority?: string;
  }) => {
    if (!user) return false;
    const { error } = await (supabase.from('contact_waiting_room') as any).insert({
      user_id: user.id,
      contact_id: params.contact_id,
      issue_type: params.issue_type,
      issue_note: params.issue_note,
      priority: params.priority || 'medium',
      status: 'open',
    });
    if (!error) { await fetchEntries(); return true; }
    console.error('Add to waiting room error:', error);
    return false;
  }, [user, fetchEntries]);

  const updateEntry = useCallback(async (id: string, updates: Partial<Pick<WaitingRoomEntry, 'status' | 'issue_type' | 'issue_note' | 'priority'>>) => {
    if (!user) return false;
    const { error } = await (supabase.from('contact_waiting_room') as any)
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);
    if (!error) { await fetchEntries(); return true; }
    return false;
  }, [user, fetchEntries]);

  const removeEntry = useCallback(async (id: string) => {
    if (!user) return false;
    const { error } = await (supabase.from('contact_waiting_room') as any)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (!error) { await fetchEntries(); return true; }
    return false;
  }, [user, fetchEntries]);

  const getEntryForContact = useCallback((contactId: string) => {
    return entries.find(e => e.contact_id === contactId && e.status !== 'resolved');
  }, [entries]);

  const openEntries = entries.filter(e => e.status !== 'resolved');
  const resolvedEntries = entries.filter(e => e.status === 'resolved');
  const highPriorityEntries = openEntries.filter(e => e.priority === 'high');

  return {
    entries,
    openEntries,
    resolvedEntries,
    highPriorityEntries,
    loading,
    addToWaitingRoom,
    updateEntry,
    removeEntry,
    getEntryForContact,
    refetch: fetchEntries,
  };
}
