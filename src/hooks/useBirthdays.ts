import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import { safeMerge } from '@/utils/contactNormalization';
import { auditRepaired } from '@/utils/birthdaySendability';
import type { BirthdayRow } from '@/utils/birthdayParser';

export interface BirthdayEntry {
  pasted_phone?: string;
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
  // Batch/date-range provenance (added for duplicate-avoidance upgrade)
  import_range_start?: string | null;
  import_range_end?: string | null;
  import_batch_label?: string | null;
  // Joined from contact
  phone_number?: string;
  phone_normalized?: string | null;
  country?: string;
  opt_out?: boolean;
}

/** Range metadata for a Smart Paste batch — purely for labeling/audit, not a filter on the dedup check. */
export interface ImportRange {
  start: string | null; // YYYY-MM-DD
  end: string | null; // YYYY-MM-DD
  label?: string | null;
}

/** Result of checking one parsed row against everything already in this cycle_year. */
export interface DuplicateCheck {
  isDuplicate: boolean;
  existingStatus?: string;
  existingBatchLabel?: string | null;
}

export function useBirthdays() {
  const { user } = useAuth();
  const { contacts, updateContact, addContact } = useCrm();
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
      // Fetch opt-out + normalized phone for matched contacts in one query.
      const ids = Array.from(new Set(data.map((b: any) => b.contact_id).filter(Boolean)));
      let metaById: Record<string, { opt_out: boolean; phone_normalized: string | null }> = {};
      if (ids.length > 0) {
        const { data: meta } = await supabase
          .from('contacts')
          .select('id, auto_send_opt_out, phone_normalized')
          .in('id', ids as string[]);
        (meta || []).forEach((m: any) => {
          metaById[String(m.id)] = {
            opt_out: Boolean(m.auto_send_opt_out),
            phone_normalized: m.phone_normalized ?? null,
          };
        });
      }
      const enriched = data.map((b: any) => {
        const contact = b.contact_id
          ? contacts.find(c => String(c.id) === b.contact_id)
          : null;
        const meta = b.contact_id ? metaById[b.contact_id] : undefined;
        return {
          ...b,
          phone_number: contact?.PhoneNumber || '',
          phone_normalized: meta?.phone_normalized ?? null,
          country: contact?.Country || '',
          opt_out: meta?.opt_out ?? false,
        };
      });
      setBirthdays(enriched);
    }
    setLoading(false);
  }, [user, contacts]);

  useEffect(() => { fetchBirthdays(); }, [fetchBirthdays]);

  /**
   * Duplicate-avoidance check (upgrade). Matches parsed rows against everything
   * already imported this cycle_year — by associate_id first, falling back to
   * full_name + birth_date_text for rows with no APLGO ID. Deliberately checks
   * the WHOLE cycle_year regardless of the batch's date range, since the same
   * person can appear in overlapping/adjacent APLGO exports (e.g. a late-July
   * pull and an early-August pull both catching the same birthday).
   *
   * Call this BEFORE importBirthdays so the paste preview can show what's new
   * vs. already present, and let the operator exclude duplicates from the import.
   */
  const findDuplicates = useCallback(async (rows: BirthdayRow[]): Promise<DuplicateCheck[]> => {
    if (!user || rows.length === 0) return rows.map(() => ({ isDuplicate: false }));

    const cycle_year = new Date().getFullYear();
    const { data } = await supabase
      .from('contact_birthdays')
      .select('associate_id, full_name, birth_date_text, status, import_batch_label')
      .eq('user_id', user.id)
      .eq('cycle_year', cycle_year);

    const byAssociate = new Map<string, { status: string; label?: string | null }>();
    const byNameDate = new Map<string, { status: string; label?: string | null }>();
    (data || []).forEach((r: any) => {
      const entry = { status: r.status, label: r.import_batch_label };
      if (r.associate_id) byAssociate.set(String(r.associate_id), entry);
      const key = `${(r.full_name || '').trim().toLowerCase()}|${(r.birth_date_text || '').trim().toLowerCase()}`;
      byNameDate.set(key, entry);
    });

    return rows.map((row) => {
      let hit: { status: string; label?: string | null } | undefined;
      if (row.associateId && byAssociate.has(row.associateId)) {
        hit = byAssociate.get(row.associateId);
      } else {
        const key = `${(row.fullName || '').trim().toLowerCase()}|${(row.birthDateText || '').trim().toLowerCase()}`;
        hit = byNameDate.get(key);
      }
      return hit
        ? { isDuplicate: true, existingStatus: hit.status, existingBatchLabel: hit.label }
        : { isDuplicate: false };
    });
  }, [user]);

  const importBirthdays = useCallback(async (rows: BirthdayRow[], range?: ImportRange) => {
    if (!user) return { imported: 0, matched: 0, unmatched: 0, created: 0, skippedDuplicates: 0 };

    let matched = 0;
    let unmatched = 0;
    let created = 0;
    const phoneBackfills: Array<{ id: string; phone: string }> = [];

    // First pass: for unmatched rows with a phone, create a minimal contact
    // and pre-link the birthday. Never duplicates an existing APLGO ID match.
    type PreparedRow = { row: BirthdayRow; contactId: string | null };
    const prepared: PreparedRow[] = [];
    for (const row of rows) {
      const existing = row.associateId
        ? contacts.find(c => c.APLGoID === row.associateId)
        : null;

      if (existing) {
        matched++;
        // Phase 0 phone backfill: if paste includes phone and contact has no phone.
        if (row.phone) {
          const merged = safeMerge(
            { phone_number: (existing.PhoneNumber || '').trim() },
            { phone_number: row.phone.trim() },
          );
          if (merged.phone_number && !(existing.PhoneNumber || '').trim()) {
            phoneBackfills.push({ id: String(existing.id), phone: String(merged.phone_number) });
          }
        }
        prepared.push({ row, contactId: String(existing.id) });
        continue;
      }

      // Unmatched. Auto-create a contact only if a phone was pasted (otherwise
      // there's nothing useful to seed). Anything else stays as an unmatched row.
      if (row.phone && row.fullName) {
        const res = await addContact({
          FullName: row.fullName,
          PhoneNumber: row.phone.trim(),
          APLGoID: row.associateId || '',
        } as any);
        const newId = (res as any)?.data?.id;
        if (newId) {
          created++;
          matched++;
          prepared.push({ row, contactId: String(newId) });
          continue;
        }
      }
      unmatched++;
      prepared.push({ row, contactId: null });
    }

    const formatLocal = (d: Date | null) => {
      if (!d) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const inserts = prepared.map(({ row, contactId }) => ({
      user_id: user.id,
      contact_id: contactId,
      associate_id: row.associateId,
      full_name: row.fullName,
      first_name: row.firstName,
      level: row.level,
      birth_date_text: row.birthDateText,
      birth_date: formatLocal(row.birthDate),
      when_to_congratulate: row.whenToCongratulate,
      congratulate_by_date: formatLocal(row.congratulateByDate),
      status: contactId ? 'not_congratulated' : 'unmatched',
      cycle_year: new Date().getFullYear(),
      pasted_phone: (row.phone || '').trim(),
      import_range_start: range?.start || null,
      import_range_end: range?.end || null,
      import_batch_label: range?.label || null,
    }));

    if (inserts.length > 0) {
      await supabase.from('contact_birthdays').insert(inserts as any);
    }

    // Apply phone backfills (never overwrites existing — guarded above).
    for (const bf of phoneBackfills) {
      await updateContact(bf.id, { PhoneNumber: bf.phone } as any);
    }

    if (inserts.length > 0) await fetchBirthdays();

    return { imported: inserts.length, matched, unmatched, created, skippedDuplicates: 0 };
  }, [user, contacts, fetchBirthdays, updateContact, addContact]);

  const linkContact = useCallback(async (birthdayId: string, contactId: string) => {
    await supabase
      .from('contact_birthdays')
      .update({ contact_id: contactId, status: 'not_congratulated' } as any)
      .eq('id', birthdayId);

    // Apply pasted_phone to the freshly linked contact via safeMerge (never overwrite).
    const entry = birthdays.find(b => b.id === birthdayId);
    const contact = contacts.find(c => String(c.id) === contactId);
    const pasted = (entry as any)?.pasted_phone?.trim?.() || '';
    if (entry && contact && pasted && !(contact.PhoneNumber || '').trim()) {
      await updateContact(String(contact.id), { PhoneNumber: pasted } as any);
      auditRepaired(birthdayId, entry.full_name, pasted, 'link+pasted_phone');
    }
    await fetchBirthdays();
  }, [fetchBirthdays, birthdays, contacts, updateContact]);

  /**
   * Bulk repair: copy pasted_phone → contact.PhoneNumber for every birthday
   * whose linked contact still has no phone. safeMerge is enforced by guard.
   * Returns the number of contacts repaired.
   */
  const repairPhonesFromBirthdays = useCallback(async (): Promise<number> => {
    let repaired = 0;
    for (const b of birthdays) {
      const pasted = ((b as any).pasted_phone || '').trim();
      if (!pasted || !b.contact_id) continue;
      const contact = contacts.find(c => String(c.id) === b.contact_id);
      if (!contact) continue;
      if ((contact.PhoneNumber || '').trim()) continue;
      const ok = await updateContact(String(contact.id), { PhoneNumber: pasted } as any);
      if (ok) {
        repaired++;
        auditRepaired(b.id, b.full_name, pasted, 'bulk_repair_from_birthdays');
      }
    }
    if (repaired > 0) await fetchBirthdays();
    return repaired;
  }, [birthdays, contacts, updateContact, fetchBirthdays]);

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
    findDuplicates,
    markCongratulated,
    updateStatus,
    deleteBirthday,
    clearAll,
    testToday,
    restoreOriginalDate,
    linkContact,
    repairPhonesFromBirthdays,
    refetch: fetchBirthdays,
  };
}
