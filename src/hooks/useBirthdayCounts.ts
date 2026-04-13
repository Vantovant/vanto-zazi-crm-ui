import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface BirthdayCounts {
  today: number;
  tomorrow: number;
  thisWeek: number;
  pending: number;
  overdue: number;
  total: number;
}

export function useBirthdayCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<BirthdayCounts>({ today: 0, tomorrow: 0, thisWeek: 0, pending: 0, overdue: 0, total: 0 });

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('contact_birthdays')
      .select('congratulate_by_date, birth_date, status')
      .eq('user_id', user.id)
      .eq('cycle_year', new Date().getFullYear())
      .neq('status', 'congratulated');

    if (!data) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let today = 0, tomorrow = 0, thisWeek = 0, overdue = 0;

    for (const b of data) {
      const raw = b.congratulate_by_date || b.birth_date;
      if (!raw) continue;
      const d = new Date(raw);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((d.getTime() - now.getTime()) / 86400000);

      if (diff < 0) overdue++;
      else if (diff === 0) today++;
      else if (diff === 1) tomorrow++;
      else if (diff <= 7) thisWeek++;
    }

    setCounts({
      today,
      tomorrow,
      thisWeek,
      pending: data.length,
      overdue,
      total: data.length,
    });
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  return { counts, refetch: fetch };
}
