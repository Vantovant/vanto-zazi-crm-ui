import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import { safeMerge } from '@/utils/contactNormalization';
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
  const { contacts, updateContact } = useCrm();
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
    const phoneBackfills: Array<{ id: string; phone: string }> = [];

    const inserts = rows.map(row => {
      // Match by APLGoID
      const contact = row.associateId
        ? contacts.find(c => c.APLGoID === row.associateId)
        : null;

      if (contact) matched++;
      else unmatched++;

      // Phase 0 phone backfill: if paste includes phone and contact has no phone, safeMerge it in.
      if (contact && row.phone) {
        const merged = safeMerge(
          { phone_number: (contact.PhoneNumber || '').trim() },
          { phone_number: row.phone.trim() },
        );
        if (merged.phone_number && !(contact.PhoneNumber || '').trim()) {
          phoneBackfills.push({ id: String(contact.id), phone: String(merged.phone_number) });
        }
      }

      // Format date as local YYYY-MM-DD to avoid UTC timezone shift
      const formatLocal = (d: Date | null) => {
        if (!d) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      return {
        user_id: user.id,
        contact_id: contact ? String(contact.id) : null,
        associate_id: row.associateId,
        full_name: row.fullName,
        first_name: row.firstName,
        level: row.level,
        birth_date_text: row.birthDateText,
        birth_date: formatLocal(row.birthDate),
        when_to_congratulate: row.whenToCongratulate,
        congratulate_by_date: formatLocal(row.congratulateByDate),
        status: contact ? 'not_congratulated' : 'unmatched',
        cycle_year: new Date().getFullYear(),
      };
    });

    if (inserts.length > 0) {
      await supabase.from('contact_birthdays').insert(inserts as any);
    }

    // Apply phone backfills (never overwrites existing — guarded above).
    for (const bf of phoneBackfills) {
      await updateContact(bf.id, { PhoneNumber: bf.phone } as any);
    }

    if (inserts.length > 0) await fetchBirthdays();

    return { imported: inserts.length, matched, unmatched };
  }, [user, contacts, fetchBirthdays, updateContact]);

  const linkContact = useCallback(async (birthdayId: string, contactId: string) => {
    await supabase
      .from('contact_birthdays')
      .update({ contact_id: contactId, status: 'not_congratulated' } as any)
      .eq('id', birthdayId);
    await fetchBirthdays();
  }, [fetchBirthdays]);

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

  const testToday = useCallback(async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const entry = birthdays.find(b => b.id === id);
    if (!entry) return;
    // Save original only if not already in test mode
    const updates: Record<string, any> = { congratulate_by_date: today };
    if (!(entry as any).original_congratulate_by_date) {
      updates.original_congratulate_by_date = entry.congratulate_by_date || entry.birth_date || today;
    }
    await supabase.from('contact_birthdays').update(updates as any).eq('id', id);
    await fetchBirthdays();
  }, [birthdays, fetchBirthdays]);

  const restoreOriginalDate = useCallback(async (id: string) => {
    const entry = birthdays.find(b => b.id === id) as any;
    if (!entry?.original_congratulate_by_date) return;
    await supabase.from('contact_birthdays').update({
      congratulate_by_date: entry.original_congratulate_by_date,
      original_congratulate_by_date: null,
    } as any).eq('id', id);
    await fetchBirthdays();
  }, [birthdays, fetchBirthdays]);

  return {
    birthdays,
    loading,
    importBirthdays,
    markCongratulated,
    updateStatus,
    deleteBirthday,
    clearAll,
    testToday,
    restoreOriginalDate,
    linkContact,
    refetch: fetchBirthdays,
  };
}
