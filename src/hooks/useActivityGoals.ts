import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivityGoals {
  daily_whatsapp_goal: number;
  daily_email_goal: number;
  daily_call_goal: number;
}

const DEFAULT_GOALS: ActivityGoals = {
  daily_whatsapp_goal: 10,
  daily_email_goal: 10,
  daily_call_goal: 5,
};

export function useActivityGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<ActivityGoals>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase.from('activity_goals') as any)
      .select('daily_whatsapp_goal, daily_email_goal, daily_call_goal')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setGoals({
        daily_whatsapp_goal: data.daily_whatsapp_goal,
        daily_email_goal: data.daily_email_goal,
        daily_call_goal: data.daily_call_goal,
      });
    } else if (!data) {
      // Upsert defaults
      await (supabase.from('activity_goals') as any).upsert({
        user_id: user.id,
        ...DEFAULT_GOALS,
      }, { onConflict: 'user_id' });
      setGoals(DEFAULT_GOALS);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const updateGoals = useCallback(async (newGoals: ActivityGoals) => {
    if (!user) return false;
    const { error } = await (supabase.from('activity_goals') as any).upsert({
      user_id: user.id,
      ...newGoals,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (!error) {
      setGoals(newGoals);
      return true;
    }
    console.error('Update goals error:', error);
    return false;
  }, [user]);

  return { goals, loading, updateGoals, refetch: fetchGoals };
}
