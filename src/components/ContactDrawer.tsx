import { useState, useCallback, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Calendar,
  CheckCircle,
  User,
  Briefcase,
  Target,
  Clock,
  AlertCircle,
  Pencil,
  Award,
  Loader2,
  Save,
  Sparkles,
  Copy,
  Check,
  Send,
  Crown,
} from 'lucide-react';
import type { Prospect } from '../data/mockData';
import { EditContactModal } from './EditContactModal';
import { AddToWaitingRoomModal } from './AddToWaitingRoomModal';
import { useCrm } from '@/contexts/CrmContext';
import { supabase } from '@/integrations/supabase/client';
import { useContactActivities, type ContactActivity } from '@/hooks/useContactActivities';
import { useWaitingRoom, ISSUE_TYPE_LABELS } from '@/hooks/useWaitingRoom';
import { buildWhatsAppUrl } from '@/utils/whatsappPhone';

interface ContactDrawerProps {
  prospect: Prospect;
  onClose: () => void;
  onOpenTemplatePicker?: (channel: 'whatsapp' | 'email') => void;
  onOpenActivityAppreciation?: (contact: Prospect, activity: ContactActivity) => void;
}

const isActivityAppreciationLog = (activity: ContactActivity) => (
  activity.activity_type === 'whatsapp' && activity.summary?.toLowerCase().includes('activity appreciation')
);

const temperatureColors: Record<string, string> = {
  Hot: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  Warm: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  Cold: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
};

const leadTypeColors: Record<string, string> = {
  Prospect: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  Registered_Nopurchase: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  Purchase_Nostatus: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
  Purchase_Status: 'bg-violet-500/20 text-violet-400 border-violet-500/40',
  Expired: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
};

const regStatusColors: Record<string, string> = {
  Registered: 'bg-violet-500/20 text-violet-400',
  'Not Registered': 'bg-slate-600/30 text-slate-400',
  Activated: 'bg-emerald-500/20 text-emerald-400',
};

export function ContactDrawer({ prospect: initialProspect, onClose, onOpenTemplatePicker, onOpenActivityAppreciation }: ContactDrawerProps) {
  const { contacts, updateContact } = useCrm();
  const { logActivity, getContactActivities } = useContactActivities();
  const { getEntryForContact, addToWaitingRoom, updateEntry, removeEntry } = useWaitingRoom();
  const [showEdit, setShowEdit] = useState(false);
  const [showWaitingRoomModal, setShowWaitingRoomModal] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [suggestedMsg, setSuggestedMsg] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);

  // Always use latest contact data from context
  const prospect = contacts.find(c => String(c.id) === String(initialProspect.id)) || initialProspect;
  const waitingRoomEntry = getEntryForContact(String(prospect.id));

  const initials = prospect.FullName.split(' ').map(n => n[0]).join('');
  const contactActivities = getContactActivities(String(prospect.id));

  useEffect(() => {
    setNotesValue(prospect.AdditionalNotes || '');
  }, [prospect.AdditionalNotes]);

  const handleSaveNotes = useCallback(async () => {
    setNotesSaving(true);
    await updateContact(String(prospect.id), { AdditionalNotes: notesValue } as any);
    setNotesSaving(false);
  }, [prospect.id, notesValue, updateContact]);

  const handleWhatsApp = useCallback(async (prefilledMsg?: string) => {
    const url = buildWhatsAppUrl(prospect.PhoneNumber, prospect.Country, prefilledMsg);
    if (url) {
      const msgSummary = prefilledMsg
        ? `Sent AI-suggested WhatsApp message to ${prospect.FullName}`
        : `Opened WhatsApp chat with ${prospect.FullName}`;
      await logActivity({
        contact_id: String(prospect.id),
        activity_type: 'whatsapp',
        summary: msgSummary,
        notes: prefilledMsg || '',
      });
      window.open(url, '_blank');
    }
  }, [prospect, logActivity]);

  const handleSuggestMessage = useCallback(async () => {
    setMsgLoading(true);
    setSuggestedMsg('');
    try {
      const contactData = {
        name: prospect.FullName,
        temperature: prospect.LeadTemperature,
        type: prospect.LeadType,
        status: prospect.CommunicationStatus,
        registrationStatus: prospect.RegistrationStatus,
        focusArea: prospect.FocusArea,
        leadPath: prospect.LeadPath,
        lastAction: prospect.ActionTaken,
        nextAction: prospect.NextAction,
        notes: prospect.AdditionalNotes,
        goStatus: prospect.GOStatus,
      };
      const resp = await supabase.functions.invoke('zazi-copilot', {
        body: {
          action: 'suggest_message',
          message: `Generate a ready-to-send WhatsApp message for this contact.`,
          contactData,
          contactId: String(prospect.id),
        },
      });
      if (resp.error) throw resp.error;
      const text = typeof resp.data === 'string' ? resp.data : await new Response(resp.data).text();
      let result = '';
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') break;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) result += content;
        } catch {}
      }
      setSuggestedMsg(result.trim());
    } catch (e) {
      console.error('Suggest message error:', e);
      setSuggestedMsg('Could not generate a message. Please try again.');
    }
    setMsgLoading(false);
  }, [prospect]);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-screen w-full sm:w-[680px] sm:max-w-[90vw] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <h2 className="font-semibold text-white text-lg">Contact Details</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-teal-400 hover:bg-teal-500/10 transition-colors text-sm font-medium"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Two Column Layout */}
        <div className="flex-1 overflow-y-auto sm:flex sm:flex-row flex-col">
          {/* LEFT COLUMN - Contact Summary */}
          <div className="sm:w-[280px] sm:min-w-[280px] sm:border-r border-b sm:border-b-0 border-slate-700 sm:overflow-y-auto">
            {/* Profile Header */}
            <div className="p-6 border-b border-slate-700/50">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl mb-4">
                  {initials}
                </div>
                <h3 className="text-xl font-semibold text-white">{prospect.FullName}</h3>
                {prospect.SalutationTitle && prospect.SalutationTitle !== 'None' && (
                  <span className="text-xs font-medium text-teal-400 mt-0.5">{prospect.SalutationTitle}</span>
                )}
                <p className="text-sm text-slate-400 mt-1">{prospect.City}, {prospect.Province}</p>

                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${temperatureColors[prospect.LeadTemperature] || ''}`}>
                    {prospect.LeadTemperature}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${leadTypeColors[prospect.LeadType] || ''}`}>
                    {prospect.LeadType}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${regStatusColors[prospect.RegistrationStatus] || ''}`}>
                    {prospect.RegistrationStatus}
                  </span>
                  {prospect.GOStatus && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      GO: {prospect.GOStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="px-4 border-b border-slate-700/50">
              <div className="grid grid-cols-3 gap-2 pb-3">
                <button type="button" onClick={() => handleWhatsApp()} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">WhatsApp</span>
                </button>
                <button type="button" onClick={async () => {
                  if (prospect.PhoneNumber) {
                    await logActivity({
                      contact_id: String(prospect.id),
                      activity_type: 'call',
                      summary: `Called ${prospect.FullName}`,
                    });
                    window.open(`tel:${prospect.PhoneNumber}`);
                  }
                }} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors">
                  <Phone className="w-5 h-5" />
                  <span className="text-xs font-medium">Call</span>
                </button>
                <button type="button" onClick={async () => {
                  if (prospect.EmailAddress) {
                    await logActivity({
                      contact_id: String(prospect.id),
                      activity_type: 'email',
                      summary: `Sent email to ${prospect.FullName}`,
                    });
                    window.open(`mailto:${prospect.EmailAddress}`);
                  }
                }} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 transition-colors">
                  <Mail className="w-5 h-5" />
                  <span className="text-xs font-medium">Email</span>
                </button>
              </div>
              {onOpenTemplatePicker && (
                <div className="grid grid-cols-2 gap-2 pb-4">
                  <button type="button" onClick={() => onOpenTemplatePicker('whatsapp')}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-green-500/5 border border-green-500/20 hover:bg-green-500/15 text-green-400 transition-colors text-xs font-medium">
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp Template
                  </button>
                  <button type="button" onClick={() => onOpenTemplatePicker('email')}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-violet-500/5 border border-violet-500/20 hover:bg-violet-500/15 text-violet-400 transition-colors text-xs font-medium">
                    <Mail className="w-3.5 h-3.5" />
                    Email Template
                  </button>
                </div>
              )}
            </div>

            {/* Waiting Room Status / Action */}
            <div className="px-4 pb-3">
              {waitingRoomEntry ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-300">In Waiting Room</span>
                    </div>
                    <button type="button" onClick={() => removeEntry(waitingRoomEntry.id)}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-medium">Remove</button>
                  </div>
                  <p className="text-[11px] text-slate-400">{ISSUE_TYPE_LABELS[waitingRoomEntry.issue_type] || waitingRoomEntry.issue_type}</p>
                  {waitingRoomEntry.issue_note && <p className="text-[10px] text-slate-500 mt-0.5">{waitingRoomEntry.issue_note}</p>}
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => updateEntry(waitingRoomEntry.id, { status: 'resolved' })}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors">
                      <CheckCircle className="w-3 h-3" /> Mark Resolved
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowWaitingRoomModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/15 text-amber-400 transition-colors text-xs font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Send to Waiting Room
                </button>
              )}
            </div>

            {/* Contact Information */}
            <div className="p-4 space-y-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Info</h4>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-medium text-slate-200 truncate">{prospect.PhoneNumber || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-medium text-slate-200 truncate">{prospect.EmailAddress || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm font-medium text-slate-200">{prospect.City}, {prospect.Province}</p>
                  </div>
                </div>
              </div>

              {/* MLM Details */}
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-4">Business Details</h4>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Target className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Focus Area</p>
                    <p className="text-sm font-medium text-slate-200">{prospect.FocusArea}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Lead Path</p>
                    <p className="text-sm font-medium text-slate-200">{prospect.LeadPath}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Sponsor</p>
                    <p className="text-sm font-medium text-slate-200">{prospect.SponsorName || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Leg</p>
                    <p className="text-sm font-medium text-slate-200">{prospect.Leg || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Award className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Level</p>
                    <p className="text-sm font-medium text-slate-200">{prospect.Level || '—'}</p>
                  </div>
                </div>

                {prospect.GOStatus && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                      <Award className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">GO Status</p>
                      <p className="text-sm font-medium text-amber-400">{prospect.GOStatus}</p>
                    </div>
                  </div>
                )}

                {prospect.APLGoID && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">APL ID</p>
                      <p className="text-sm font-medium text-emerald-400">{prospect.APLGoID}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Next Action */}
              {prospect.NextAction && (
                <>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-4">Next Action</h4>
                  <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                    <p className="text-sm font-medium text-teal-400">{prospect.NextAction}</p>
                    {prospect.MeetingTime && (
                      <p className="text-xs text-teal-400/70 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {prospect.MeetingTime}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Activity & Notes */}
          <div className="flex-1 flex flex-col sm:overflow-hidden min-h-[400px] pb-8 sm:pb-0">
            {/* Activity Header */}
            <div className="px-6 py-4 border-b border-slate-700/50">
              <h4 className="font-semibold text-white">Activity & Notes</h4>
            </div>

            <div className="flex-1 sm:overflow-y-auto p-6 space-y-4">
              {/* AI Message Suggestion */}
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <h5 className="text-xs font-semibold text-violet-300 uppercase">AI Message</h5>
                  </div>
                  <button
                    type="button"
                    onClick={handleSuggestMessage}
                    disabled={msgLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {msgLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {suggestedMsg ? 'Regenerate' : 'Suggest Message'}
                  </button>
                </div>
                {msgLoading ? (
                  <div className="flex items-center gap-2 text-violet-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Crafting the perfect message...</span>
                  </div>
                ) : suggestedMsg ? (
                  <div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap mb-3">{suggestedMsg}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(suggestedMsg);
                          setMsgCopied(true);
                          setTimeout(() => setMsgCopied(false), 2000);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                      >
                        {msgCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {msgCopied ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWhatsApp(suggestedMsg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        Send via WhatsApp
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-violet-400/70">Click "Suggest Message" to generate a smart, contextual WhatsApp message for {prospect.FullName}.</p>
                )}
              </div>

              {/* Next Action */}
              {prospect.NextAction && (
                <div className="bg-teal-500/10 rounded-lg border border-teal-500/20 p-4">
                  <h5 className="text-xs font-semibold text-teal-400 uppercase mb-2">Next Action</h5>
                  <p className="text-sm text-teal-300">{prospect.NextAction}</p>
                  {prospect.MeetingTime && (
                    <p className="text-xs text-teal-400/70 mt-1">📅 {prospect.MeetingTime}</p>
                  )}
                </div>
              )}

              {/* Activity Timeline */}
              <div>
                <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Activity History</h5>
                {contactActivities.length === 0 ? (
                  <div className="bg-slate-800/30 rounded-lg border border-dashed border-slate-700 p-4">
                    <p className="text-sm text-slate-500 italic">No activities logged yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {contactActivities.slice(0, 20).map((a) => {
                      const canOpenOriginalAppreciation = isActivityAppreciationLog(a) && Boolean(onOpenActivityAppreciation);

                      return (
                        <div key={a.id} className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-teal-400 capitalize">{a.activity_type}</span>
                            <span className="text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-slate-300 mt-1">{a.summary}</p>
                          {a.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section - Editable */}
            <div className="border-t border-slate-700 p-4 pb-20 sm:pb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</h4>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={notesSaving || notesValue === (prospect.AdditionalNotes || '')}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  {notesSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save Notes
                </button>
              </div>
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Add notes about this contact..."
                rows={4}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500 resize-y"
              />
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <EditContactModal
          prospect={prospect}
          onClose={() => setShowEdit(false)}
          onSaved={() => {}}
        />
      )}

      {showWaitingRoomModal && (
        <AddToWaitingRoomModal
          contactName={prospect.FullName}
          onClose={() => setShowWaitingRoomModal(false)}
          onSubmit={async (data) => {
            const ok = await addToWaitingRoom({
              contact_id: String(prospect.id),
              ...data,
            });
            if (ok) {
              await logActivity({
                contact_id: String(prospect.id),
                activity_type: 'note',
                summary: `Added to waiting room: ${ISSUE_TYPE_LABELS[data.issue_type] || data.issue_type}`,
                notes: data.issue_note,
              });
            }
            setShowWaitingRoomModal(false);
          }}
        />
      )}
    </>
  );
}
