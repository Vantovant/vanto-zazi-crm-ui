import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MessageTemplate {
  id: string;
  channel: 'whatsapp' | 'email';
  category: string;
  template_name: string;
  send_when_condition: string;
  subject: string;
  body: string;
  merge_fields_supported: string[];
  active: boolean;
  sort_order: number;
}

export const TEMPLATE_CATEGORIES = [
  'Welcome', 'Activation', 'Onboarding', 'Training', 'Orders',
  'Monthly Activity', 'Inactivity', 'Expiry', 'Rank', 'Events',
  'Commissions', 'Appreciation', 'Reactivation',
] as const;

export function useMessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from('message_templates') as any)
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (!error && data) setTemplates(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const getByChannel = useCallback((channel: 'whatsapp' | 'email') => {
    return templates.filter(t => t.channel === channel);
  }, [templates]);

  const getByCategory = useCallback((category: string) => {
    return templates.filter(t => t.category === category);
  }, [templates]);

  const getCategoriesForChannel = useCallback((channel: 'whatsapp' | 'email') => {
    const cats = new Set(templates.filter(t => t.channel === channel).map(t => t.category));
    return TEMPLATE_CATEGORIES.filter(c => cats.has(c));
  }, [templates]);

  return { templates, loading, getByChannel, getByCategory, getCategoriesForChannel, refetch: fetchTemplates };
}
