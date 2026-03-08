import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Prospect } from '@/data/mockData';
import { pushOutboundEvent } from '@/hooks/useOutboundWebhook';
import { normalizePhone, normalizeEmail } from '@/utils/contactNormalization';

// DB row type
interface ContactRow {
  id: string;
  user_id: string;
  date_captured: string;
  full_name: string;
  phone_number: string;
  email_address: string;
  city: string;
  province: string;
  state: string;
  country: string;
  lead_temperature: string;
  communication_status: string;
  registration_status: string;
  lead_type: string;
  interest_level: string;
  focus_area: string;
  lead_path: string;
  sponsor_name: string;
  assigned_to: string;
  action_taken: string;
  next_action: string;
  meeting_time: string;
  aplgo_id: string;
  associate_status: string;
  additional_notes: string;
  go_status: string;
  salutation_title: string;
}

function rowToProspect(row: ContactRow): Prospect {
  return {
    id: row.id as unknown as number, // keep compatible with existing UI
    DateCaptured: row.date_captured,
    FullName: row.full_name,
    PhoneNumber: row.phone_number,
    EmailAddress: row.email_address,
    City: row.city,
    Province: row.province,
    State: row.state,
    Country: row.country,
    LeadTemperature: row.lead_temperature as Prospect['LeadTemperature'],
    CommunicationStatus: row.communication_status as Prospect['CommunicationStatus'],
    RegistrationStatus: row.registration_status as Prospect['RegistrationStatus'],
    LeadType: row.lead_type as Prospect['LeadType'],
    InterestLevel: row.interest_level as Prospect['InterestLevel'],
    FocusArea: row.focus_area as Prospect['FocusArea'],
    LeadPath: row.lead_path as Prospect['LeadPath'],
    SponsorName: row.sponsor_name,
    AssignedTo: row.assigned_to,
    ActionTaken: row.action_taken,
    NextAction: row.next_action,
    MeetingTime: row.meeting_time,
    APLGoID: row.aplgo_id,
    AssociateStatus: row.associate_status,
    AdditionalNotes: row.additional_notes,
    GOStatus: row.go_status,
  };
}

function prospectToInsert(p: Omit<Prospect, 'id'>, userId: string) {
  return {
    user_id: userId,
    date_captured: p.DateCaptured || new Date().toISOString().split('T')[0],
    full_name: p.FullName,
    phone_number: p.PhoneNumber || '',
    email_address: p.EmailAddress || '',
    city: p.City || '',
    province: p.Province || '',
    state: p.State || '',
    country: p.Country || 'South Africa',
    lead_temperature: p.LeadTemperature || 'Warm',
    communication_status: p.CommunicationStatus || 'New',
    registration_status: p.RegistrationStatus || 'Not Registered',
    lead_type: p.LeadType || 'Prospect',
    interest_level: p.InterestLevel || 'Medium',
    focus_area: p.FocusArea || 'Health Transformation',
    lead_path: p.LeadPath || 'Not sure yet',
    sponsor_name: p.SponsorName || '',
    assigned_to: p.AssignedTo || '',
    action_taken: p.ActionTaken || '',
    next_action: p.NextAction || '',
    meeting_time: p.MeetingTime || '',
    aplgo_id: p.APLGoID || '',
    associate_status: p.AssociateStatus || '',
    additional_notes: p.AdditionalNotes || '',
    go_status: p.GOStatus || '',
  };
}

export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbActive, setDbActive] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('date_captured', { ascending: false });

    if (error) {
      console.error('Error fetching contacts:', error);
      setDbActive(false);
    } else {
      setContacts((data as ContactRow[]).map(rowToProspect));
      setDbActive(true);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const addContact = async (prospect: Omit<Prospect, 'id'>): Promise<{ data?: any; error?: string }> => {
    if (!user) return { error: 'Not authenticated' };
    const { data, error } = await supabase
      .from('contacts')
      .insert(prospectToInsert(prospect, user.id))
      .select()
      .single();
    if (error) {
      console.error('Error adding contact:', error);
      if (error.code === '23505') {
        return { error: 'duplicate' };
      }
      return { error: error.message };
    }
    await fetchContacts();
    pushOutboundEvent('contact.created', { ...prospectToInsert(prospect, user.id), id: (data as { id: string }).id });
    return { data };
  };

  const updateContact = async (id: string, updates: Partial<Prospect>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.FullName !== undefined) dbUpdates.full_name = updates.FullName;
    if (updates.PhoneNumber !== undefined) dbUpdates.phone_number = updates.PhoneNumber;
    if (updates.EmailAddress !== undefined) dbUpdates.email_address = updates.EmailAddress;
    if (updates.City !== undefined) dbUpdates.city = updates.City;
    if (updates.Province !== undefined) dbUpdates.province = updates.Province;
    if (updates.State !== undefined) dbUpdates.state = updates.State;
    if (updates.Country !== undefined) dbUpdates.country = updates.Country;
    if (updates.LeadTemperature !== undefined) dbUpdates.lead_temperature = updates.LeadTemperature;
    if (updates.CommunicationStatus !== undefined) dbUpdates.communication_status = updates.CommunicationStatus;
    if (updates.RegistrationStatus !== undefined) dbUpdates.registration_status = updates.RegistrationStatus;
    if (updates.LeadType !== undefined) dbUpdates.lead_type = updates.LeadType;
    if (updates.InterestLevel !== undefined) dbUpdates.interest_level = updates.InterestLevel;
    if (updates.FocusArea !== undefined) dbUpdates.focus_area = updates.FocusArea;
    if (updates.LeadPath !== undefined) dbUpdates.lead_path = updates.LeadPath;
    if (updates.SponsorName !== undefined) dbUpdates.sponsor_name = updates.SponsorName;
    if (updates.AssignedTo !== undefined) dbUpdates.assigned_to = updates.AssignedTo;
    if (updates.ActionTaken !== undefined) dbUpdates.action_taken = updates.ActionTaken;
    if (updates.NextAction !== undefined) dbUpdates.next_action = updates.NextAction;
    if (updates.MeetingTime !== undefined) dbUpdates.meeting_time = updates.MeetingTime;
    if (updates.APLGoID !== undefined) dbUpdates.aplgo_id = updates.APLGoID;
    if (updates.AssociateStatus !== undefined) dbUpdates.associate_status = updates.AssociateStatus;
    if (updates.AdditionalNotes !== undefined) dbUpdates.additional_notes = updates.AdditionalNotes;
    if (updates.DateCaptured !== undefined) dbUpdates.date_captured = updates.DateCaptured;
    if (updates.GOStatus !== undefined) dbUpdates.go_status = updates.GOStatus;

    const { error } = await supabase.from('contacts').update(dbUpdates).eq('id', id);
    if (error) {
      console.error('Error updating contact:', error);
      if (error.code === '23505') {
        return 'duplicate' as any;
      }
      return false;
    }
    await fetchContacts();
    pushOutboundEvent('contact.updated', { id, ...dbUpdates });
    return true;
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) {
      console.error('Error deleting contact:', error);
      return false;
    }
    await fetchContacts();
    return true;
  };

  /** Check for duplicate contact by normalized phone or email. Returns matching contact or null. */
  const checkDuplicate = async (phone: string, email: string, excludeId?: string) => {
    if (!user) return null;
    const normPhone = normalizePhone(phone);
    const normEmail = normalizeEmail(email);

    if (!normPhone && !normEmail) return null;

    // Build query for phone OR email match
    let query = supabase.from('contacts').select('*');

    if (normPhone && normEmail) {
      query = query.or(`phone_normalized.eq.${normPhone},email_normalized.eq.${normEmail}`);
    } else if (normPhone) {
      query = query.eq('phone_normalized', normPhone);
    } else if (normEmail) {
      query = query.eq('email_normalized', normEmail);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

    // Filter out current record if editing
    const matches = excludeId ? data.filter((r: any) => r.id !== excludeId) : data;
    if (matches.length === 0) return null;

    const match = matches[0] as any;
    const matchType = normPhone && match.phone_normalized === normPhone ? 'phone' : 'email';
    const matchValue = matchType === 'phone' ? phone : email;

    return { contact: match, matchType: matchType as 'phone' | 'email', matchValue };
  };

  return { contacts, loading, dbActive, addContact, updateContact, deleteContact, refetch: fetchContacts, checkDuplicate };
}
