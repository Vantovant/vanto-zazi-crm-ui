import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { pushOutboundEvent } from '@/hooks/useOutboundWebhook';

export interface ContactActivity {
  id: string;
  user_id: string;
  contact_id: string | null;
  activity_type: string;
  summary: string;
  notes: string;
  next_action: string;
  created_at: string;
}

export function useContactActivities() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase.from('contact_activities') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) setActivities(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const logActivity = useCallback(async (params: {
    contact_id?: string;
    activity_type: string;
    summary: string;
    notes?: string;
    next_action?: string;
  }) => {
    if (!user) return false;
    const { error } = await (supabase.from('contact_activities') as any).insert({
      user_id: user.id,
      contact_id: params.contact_id || null,
      activity_type: params.activity_type,
      summary: params.summary,
      notes: params.notes || '',
      next_action: params.next_action || '',
    });
    if (!error) {
      await fetchActivities();
      pushOutboundEvent('activity.created', {
        contact_id: params.contact_id || null,
        activity_type: params.activity_type,
        summary: params.summary,
        notes: params.notes || '',
      });
      return true;
    }
    console.error('Log activity error:', error);
    return false;
  }, [user, fetchActivities]);

  // Calculate days since last activity for a contact
  const daysSinceLastActivity = useCallback((contactId: string): number | null => {
    const contactActivities = activities.filter(a => a.contact_id === contactId);
    if (contactActivities.length === 0) return null;
    const latest = new Date(contactActivities[0].created_at);
    const now = new Date();
    return Math.floor((now.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24));
  }, [activities]);

  // Get activities for a specific contact
  const getContactActivities = useCallback((contactId: string) => {
    return activities.filter(a => a.contact_id === contactId);
  }, [activities]);

  // Get neglected contacts (no activity in X days)
  const getNeglectedContacts = useCallback((days: number = 7) => {
    const contactMap = new Map<string, Date>();
    for (const a of activities) {
      if (!a.contact_id) continue;
      const existing = contactMap.get(a.contact_id);
      const d = new Date(a.created_at);
      if (!existing || d > existing) contactMap.set(a.contact_id, d);
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const neglected: { contact_id: string; lastActivity: Date; daysSince: number }[] = [];
    contactMap.forEach((date, cid) => {
      if (date < cutoff) {
        neglected.push({
          contact_id: cid,
          lastActivity: date,
          daysSince: Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)),
        });
      }
    });
    return neglected.sort((a, b) => b.daysSince - a.daysSince);
  }, [activities]);

  return {
    activities,
    loading,
    logActivity,
    daysSinceLastActivity,
    getContactActivities,
    getNeglectedContacts,
    refetch: fetchActivities,
  };
}
