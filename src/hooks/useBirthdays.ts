import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import type { BirthdayRow } from '@/utils/birthdayParser';

export interface BirthdayEntry {
  id: string;
  contact_id: string | null;
  associate_id: string;
  full_name: string;
  first_name: string;
  level: string;
  birth_date_text: string;
  birth_date: string | null;
  when_to_congratulate: string;
  congratulate_by_date: string | null;
  message_style: string;
  status: string;
  congratulated_at: string | null;
  cycle_year: number;
  created_at: string;
  // Joined from contact
  phone_number?: string;
  country?: string;
}

export function useBirthdays() {
  const { user } = useAuth();
  const { contacts } = useCrm();
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBirthdays = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('contact_birthdays')
      .select('*')
      .eq('user_id', user.id)
      .eq('cycle_year', new Date().getFullYear())
      .order('birth_date', { ascending: true, nullsFirst: false });

    if (data) {
      // Enrich with contact phone data
      const enriched = data.map((b: any) => {
        const contact = b.contact_id
          ? contacts.find(c => String(c.id) === b.contact_id)
          : null;
        return {
          ...b,
          phone_number: contact?.PhoneNumber || '',
          country: contact?.Country || '',
        };
      });
      setBirthdays(enriched);
    }
    setLoading(false);
  }, [user, contacts]);

  useEffect(() => { fetchBirthdays(); }, [fetchBirthdays]);

  const importBirthdays = useCallback(async (rows: BirthdayRow[]) => {
    if (!user) return { imported: 0, matched: 0, unmatched: 0 };

    let matched = 0;
    let unmatched = 0;

    const inserts = rows.map(row => {
      // Match by APLGoID
      const contact = row.associateId
        ? contacts.find(c => c.APLGoID === row.associateId)
        : null;

      if (contact) matched++;
      else unmatched++;

      return {
        user_id: user.id,
        contact_id: contact ? String(contact.id) : null,
        associate_id: row.associateId,
        full_name: row.fullName,
        first_name: row.firstName,
        level: row.level,
        birth_date_text: row.birthDateText,
        birth_date: row.birthDate ? row.birthDate.toISOString().split('T')[0] : null,
        when_to_congratulate: row.whenToCongratulate,
        congratulate_by_date: row.congratulateByDate ? row.congratulateByDate.toISOString().split('T')[0] : null,
        status: contact ? 'not_congratulated' : 'unmatched',
        cycle_year: new Date().getFullYear(),
      };
    });

    if (inserts.length > 0) {
      await supabase.from('contact_birthdays').insert(inserts as any);
      await fetchBirthdays();
    }

    return { imported: inserts.length, matched, unmatched };
  }, [user, contacts, fetchBirthdays]);

  const markCongratulated = useCallback(async (id: string) => {
    await supabase
      .from('contact_birthdays')
      .update({ status: 'congratulated', congratulated_at: new Date().toISOString() } as any)
      .eq('id', id);
    await fetchBirthdays();
  }, [fetchBirthdays]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    await supabase
      .from('contact_birthdays')
      .update({ status } as any)
      .eq('id', id);
    await fetchBirthdays();
  }, [fetchBirthdays]);

  const deleteBirthday = useCallback(async (id: string) => {
    await supabase.from('contact_birthdays').delete().eq('id', id);
    await fetchBirthdays();
  }, [fetchBirthdays]);

  const clearAll = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('contact_birthdays')
      .delete()
      .eq('user_id', user.id)
      .eq('cycle_year', new Date().getFullYear());
    await fetchBirthdays();
  }, [user, fetchBirthdays]);

  return {
    birthdays,
    loading,
    importBirthdays,
    markCongratulated,
    updateStatus,
    deleteBirthday,
    clearAll,
    refetch: fetchBirthdays,
  };
}
