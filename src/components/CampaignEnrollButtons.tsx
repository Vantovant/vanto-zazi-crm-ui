import { useState } from 'react';
import { Cake, Zap, Video, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Prospect } from '../data/mockData';
import { formatWhatsAppPhone } from '@/utils/whatsappPhone';

type CampaignKind = 'birthday' | 'activation' | 'zoom';
type State = 'idle' | 'loading' | 'done' | 'error';

interface Props {
  prospect: Prospect;
}

export function CampaignEnrollButtons({ prospect }: Props) {
  const [state, setState] = useState<Record<CampaignKind, State>>({
    birthday: 'idle', activation: 'idle', zoom: 'idle',
  });
  const [errors, setErrors] = useState<Record<CampaignKind, string | null>>({
    birthday: null, activation: null, zoom: null,
  });

  const set = (k: CampaignKind, s: State, err: string | null = null) => {
    setState(prev => ({ ...prev, [k]: s }));
    setErrors(prev => ({ ...prev, [k]: err }));
  };

  const phone = formatWhatsAppPhone(prospect.PhoneNumber, prospect.Country);
  const firstName = (prospect.FullName || '').split(' ')[0] || null;

  const requireAuth = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error('Sign-in required');
    return data.user.id;
  };

  const enrollBirthday = async () => {
    try {
      set('birthday', 'loading');
      if (!phone) throw new Error('Missing valid phone');
      const user_id = await requireAuth();
      // Try to fetch birth_date from contact_birthdays for this contact
      let birth_date: string | null = null;
      const { data: bd } = await supabase
        .from('contact_birthdays')
        .select('birth_date')
        .eq('contact_id', String(prospect.id))
        .maybeSingle();
      birth_date = (bd as any)?.birth_date ?? null;
      const { error } = await supabase.from('birthday_campaign_recipients').insert({
        user_id,
        contact_id: String(prospect.id),
        name: prospect.FullName,
        first_name: firstName,
        phone_normalized: phone,
        email: prospect.EmailAddress || null,
        birth_date,
        cycle_year: new Date().getFullYear(),
        tone: 'warm',
        status: 'queued',
      } as any);
      if (error) throw error;
      set('birthday', 'done');
    } catch (e: any) {
      set('birthday', 'error', e.message || 'Failed');
    }
  };

  const enrollActivation = async () => {
    try {
      set('activation', 'loading');
      if (!phone) throw new Error('Missing valid phone');
      const user_id = await requireAuth();
      const { error } = await supabase.from('activation_campaign_recipients').insert({
        user_id,
        contact_id: String(prospect.id),
        member_id: prospect.APLGoID || null,
        name: prospect.FullName,
        first_name: firstName,
        phone_normalized: phone,
        email: prospect.EmailAddress || null,
        sponsor_name: prospect.SponsorName || null,
        status: 'queued',
      } as any);
      if (error) throw error;
      set('activation', 'done');
    } catch (e: any) {
      set('activation', 'error', e.message || 'Failed');
    }
  };

  const enrollZoom = async () => {
    try {
      set('zoom', 'loading');
      if (!phone) throw new Error('Missing valid phone');
      const event_name = window.prompt('Zoom event name?', 'Wellness Business Overview');
      if (!event_name) { set('zoom', 'idle'); return; }
      const event_date = window.prompt('Event date & time (ISO, e.g. 2026-07-25T18:00:00Z)?');
      if (!event_date) { set('zoom', 'idle'); return; }
      const zoom_url = window.prompt('Zoom URL?');
      if (!zoom_url) { set('zoom', 'idle'); return; }
      const user_id = await requireAuth();
      const event_id = `zoom_${new Date(event_date).getTime()}_${event_name.slice(0, 20).replace(/\s+/g, '_')}`;
      const { error } = await supabase.from('zoom_campaign_recipients').insert({
        user_id,
        contact_id: String(prospect.id),
        event_id,
        event_name,
        event_date,
        zoom_url,
        member_id: prospect.APLGoID || null,
        name: prospect.FullName,
        first_name: firstName,
        phone_normalized: phone,
        email: prospect.EmailAddress || null,
        reminder_stage: 't_minus_48h',
        status: 'queued',
      } as any);
      if (error) throw error;
      set('zoom', 'done');
    } catch (e: any) {
      set('zoom', 'error', e.message || 'Failed');
    }
  };

  const Btn = ({
    kind, label, Icon, color, onClick,
  }: {
    kind: CampaignKind; label: string; Icon: typeof Cake; color: string; onClick: () => void;
  }) => {
    const s = state[kind];
    const err = errors[kind];
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={s === 'loading' || s === 'done'}
        title={err || label}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors text-xs font-medium ${color} ${s === 'done' ? 'opacity-70' : ''}`}
      >
        {s === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" />
          : s === 'done' ? <Check className="w-4 h-4" />
          : s === 'error' ? <AlertCircle className="w-4 h-4" />
          : <Icon className="w-4 h-4" />}
        <span className="text-[11px] leading-tight text-center">
          {s === 'done' ? 'Added' : s === 'error' ? 'Retry' : label}
        </span>
      </button>
    );
  };

  return (
    <div className="px-4 pb-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Add to Campaign
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Btn kind="birthday" label="Birthday" Icon={Cake} onClick={enrollBirthday}
          color="bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/30 text-pink-300" />
        <Btn kind="activation" label="Activation" Icon={Zap} onClick={enrollActivation}
          color="bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30 text-orange-300" />
        <Btn kind="zoom" label="Zoom Invite" Icon={Video} onClick={enrollZoom}
          color="bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 text-sky-300" />
      </div>
      {(errors.birthday || errors.activation || errors.zoom) && (
        <p className="mt-1 text-[10px] text-rose-400">
          {errors.birthday || errors.activation || errors.zoom}
        </p>
      )}
    </div>
  );
}
