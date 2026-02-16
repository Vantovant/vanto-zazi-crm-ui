import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useActivityTracker() {
  const { user } = useAuth();
  const location = useLocation();
  const lastPage = useRef('');

  useEffect(() => {
    if (!user) return;
    const page = location.pathname;
    if (page === lastPage.current) return;
    lastPage.current = page;

    (supabase.from('user_activity') as any).insert({
      user_id: user.id,
      action: 'page_view',
      page,
      metadata: {},
    }).then(({ error }: { error: any }) => {
      if (error) console.error('Activity track error:', error.message);
    });
  }, [location.pathname, user]);

  const trackAction = async (action: string, page: string, metadata: Record<string, unknown> = {}) => {
    if (!user) return;
    await (supabase.from('user_activity') as any).insert({
      user_id: user.id,
      action,
      page,
      metadata,
    });
  };

  return { trackAction };
}
