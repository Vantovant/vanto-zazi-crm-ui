import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Phone,
  ExternalLink,
  MessageCircle,
  ClipboardList,
  Bell,
  Copy,
  Check,
  Sparkles,
  Loader2,
  Send,
  Cake,
} from 'lucide-react';
import { BirthdayPanel } from '@/components/BirthdayPanel';
import { LogActivityModal } from '../components/LogActivityModal';
import { AddFollowUpModal } from '../components/AddFollowUpModal';
import { useCrm } from '@/contexts/CrmContext';
import { useContactActivities } from '@/hooks/useContactActivities';
import { supabase } from '@/integrations/supabase/client';
import { buildWhatsAppUrl } from '@/utils/whatsappPhone';

const temperatureColors: Record<string, string> = {
  Hot: 'bg-rose-500',
  Warm: 'bg-amber-500',
  Cold: 'bg-sky-500',
};

export function WhatsApp() {
  const { contacts } = useCrm();
  const { logActivity } = useContactActivities();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [suggestedMsg, setSuggestedMsg] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);

  const contactsWithPhone = useMemo(() => {
    return contacts.filter(c => c.PhoneNumber && c.PhoneNumber.trim() !== '');
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contactsWithPhone;
    const query = searchQuery.toLowerCase();
    return contactsWithPhone.filter(
      (c) =>
        c.FullName.toLowerCase().includes(query) ||
        c.PhoneNumber.toLowerCase().includes(query)
    );
  }, [searchQuery, contactsWithPhone]);

  const selectedContact = selectedContactId
    ? contacts.find(c => String(c.id) === selectedContactId)
    : filteredContacts[0] || null;

  const handleOpenWhatsApp = useCallback(async (prefilledMsg?: string) => {
    if (!selectedContact) return;
    const url = buildWhatsAppUrl(selectedContact.PhoneNumber, selectedContact.Country, prefilledMsg);
    if (!url) return;
    
    // Log the WhatsApp activity with timestamp
    const msgSummary = prefilledMsg
      ? `Sent AI-suggested WhatsApp message to ${selectedContact.FullName}`
      : `Opened WhatsApp chat with ${selectedContact.FullName}`;
    await logActivity({
      contact_id: String(selectedContact.id),
      activity_type: 'whatsapp',
      summary: msgSummary,
      notes: prefilledMsg || '',
    });

    window.open(url, '_blank');
  }, [selectedContact, logActivity]);

  const handleSuggestMessage = useCallback(async () => {
    if (!selectedContact) return;
    setMsgLoading(true);
    setSuggestedMsg('');

    try {
      const contactData = {
        name: selectedContact.FullName,
        temperature: selectedContact.LeadTemperature,
        type: selectedContact.LeadType,
        status: selectedContact.CommunicationStatus,
        registrationStatus: selectedContact.RegistrationStatus,
        focusArea: selectedContact.FocusArea,
        leadPath: selectedContact.LeadPath,
        lastAction: selectedContact.ActionTaken,
        nextAction: selectedContact.NextAction,
        notes: selectedContact.AdditionalNotes,
        goStatus: selectedContact.GOStatus,
      };

      const resp = await supabase.functions.invoke('zazi-copilot', {
        body: {
          action: 'contact_analysis',
          message: `Generate a ready-to-send WhatsApp message for this contact. The message should be natural, friendly, and contextual based on their status and where they are in the journey. Keep it short (2-4 sentences max). Do NOT include any analysis — only output the message text itself, nothing else. No markdown, no quotes, just the plain message.`,
          contactData,
          contactId: String(selectedContact.id),
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
  }, [selectedContact]);

  const handleCopyNumber = useCallback(() => {
    if (!selectedContact) return;
    navigator.clipboard.writeText(selectedContact.PhoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [selectedContact]);

  return (
    <div className="h-[calc(100vh-56px-48px)] flex rounded-xl overflow-hidden border border-slate-700 bg-slate-800/30">
      {/* Contact List - Left Panel */}
      <div className="w-80 border-r border-slate-700 flex flex-col bg-slate-800/50">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              WhatsApp
            </h2>
            <span className="text-xs text-slate-500">{contactsWithPhone.length} contacts</span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => { setSelectedContactId(String(contact.id)); setSuggestedMsg(''); }}
              className={`flex items-start gap-3 p-4 cursor-pointer transition-colors border-b border-slate-700/50 ${
                String(selectedContact?.id) === String(contact.id)
                  ? 'bg-slate-700/50'
                  : 'hover:bg-slate-700/30'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold text-sm">
                  {contact.FullName.split(' ').map(n => n[0]).join('')}
                </div>
                <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ${temperatureColors[contact.LeadTemperature] || 'bg-slate-500'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{contact.FullName}</p>
                <p className="text-xs text-slate-500 truncate">{contact.PhoneNumber}</p>
                {contact.NextAction && (
                  <p className="text-xs text-slate-400 truncate mt-1">{contact.NextAction}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                    {contact.LeadType}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                    {contact.CommunicationStatus}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {filteredContacts.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-slate-500 text-sm">No contacts with phone numbers found</p>
            </div>
          )}
        </div>
      </div>

      {/* Contact Detail - Right Panel */}
      {selectedContact ? (
        <div className="flex-1 flex flex-col bg-slate-900/50">
          {/* Header */}
          <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold text-sm">
                    {selectedContact.FullName.split(' ').map(n => n[0]).join('')}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{selectedContact.FullName}</p>
                  <p className="text-xs text-slate-400">{selectedContact.PhoneNumber}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogActivity(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span className="hidden xl:inline">Log Activity</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFollowUp(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-lg transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  <span className="hidden xl:inline">Add Follow-up</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                  title="Copy phone number (use if WhatsApp link is blocked)"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden xl:inline">{copied ? 'Copied!' : 'Copy #'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenWhatsApp()}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden xl:inline">Open in WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-md mx-auto space-y-6">
              {/* AI Message Suggestion */}
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-violet-300">AI Message</h3>
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
                        onClick={() => handleOpenWhatsApp(suggestedMsg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        Send via WhatsApp
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-violet-400/70">Click "Suggest Message" to generate a smart, contextual WhatsApp message for {selectedContact.FullName}.</p>
                )}
              </div>

              {/* Contact Info Card */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white">Contact Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-300">{selectedContact.PhoneNumber}</span>
                  </div>
                  {selectedContact.EmailAddress && (
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-300">{selectedContact.EmailAddress}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">Location:</span>
                    <span className="text-sm text-slate-300">{selectedContact.City}{selectedContact.Province ? `, ${selectedContact.Province}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">Lead:</span>
                    <span className="text-sm text-slate-300">{selectedContact.LeadTemperature} · {selectedContact.LeadType}</span>
                  </div>
                </div>
              </div>

              {/* Latest Action */}
              {selectedContact.ActionTaken && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-2">Last Action</h3>
                  <p className="text-sm text-slate-300">{selectedContact.ActionTaken}</p>
                </div>
              )}

              {/* Next Action */}
              {selectedContact.NextAction && (
                <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-teal-400 mb-2">Next Action</h3>
                  <p className="text-sm text-teal-300">{selectedContact.NextAction}</p>
                  {selectedContact.MeetingTime && (
                    <p className="text-xs text-teal-400/70 mt-2">📅 {selectedContact.MeetingTime}</p>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedContact.AdditionalNotes && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-2">Notes</h3>
                  <p className="text-sm text-slate-400">{selectedContact.AdditionalNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-900/30">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Select a contact to view details</p>
          </div>
        </div>
      )}

      {showLogActivity && (
        <LogActivityModal
          onClose={() => setShowLogActivity(false)}
          prefillContactName={selectedContact?.FullName}
        />
      )}
      {showFollowUp && (
        <AddFollowUpModal
          onClose={() => setShowFollowUp(false)}
          prefillContactName={selectedContact?.FullName}
        />
      )}
    </div>
  );
}
