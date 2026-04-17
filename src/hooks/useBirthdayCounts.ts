import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { classifyBirthdayEntry } from '@/utils/birthdayParser';

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
      .select('congratulate_by_date, birth_date, birth_date_text, status')
      .eq('user_id', user.id)
      .eq('cycle_year', new Date().getFullYear())
      .neq('status', 'congratulated');

    if (!data) return;

    let today = 0, tomorrow = 0, thisWeek = 0, overdue = 0;

    for (const b of data) {
      const timing = classifyBirthdayEntry(b as any);
      if (timing === 'today') today++;
      else if (timing === 'tomorrow') tomorrow++;
      else if (timing === 'this_week') thisWeek++;
      else if (timing === 'past') overdue++;
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
