import { useState, useMemo, useCallback, useEffect } from 'react';
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
  Mail,
  PenLine,
  BookOpen,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { BirthdayPanel } from '@/components/BirthdayPanel';
import { MaytapiInbox } from '@/components/MaytapiInbox';
import { useAuth } from '@/contexts/AuthContext';
import { LogActivityModal } from '../components/LogActivityModal';
import { AddFollowUpModal } from '../components/AddFollowUpModal';
import { MessageTemplatePicker } from '../components/MessageTemplatePicker';
import { useCrm } from '@/contexts/CrmContext';
import { useContactActivities } from '@/hooks/useContactActivities';
import { supabase } from '@/integrations/supabase/client';
import { buildWhatsAppUrl } from '@/utils/whatsappPhone';
import type { Prospect } from '@/data/mockData';

const temperatureColors: Record<string, string> = {
  Hot: 'bg-rose-500',
  Warm: 'bg-amber-500',
  Cold: 'bg-sky-500',
};

const activityTypeIcons: Record<string, string> = {
  whatsapp: '💬',
  call: '📞',
  email: '📧',
  meeting: '🤝',
  note: '📝',
  birthday: '🎂',
  appreciation: '🌟',
  followup: '🔔',
};

export function WhatsApp() {
  const { contacts } = useCrm();
  const { user } = useAuth();
  const { logActivity, getContactActivities, daysSinceLastActivity } = useContactActivities();
  const [activeTab, setActiveTab] = useState<'contacts' | 'birthdays' | 'maytapi'>('contacts');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { if (!cancelled) setIsAdmin(false); return; }
      const { data } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => { cancelled = true; };
  }, [user]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [suggestedMsg, setSuggestedMsg] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const [manualMsg, setManualMsg] = useState('');
  const [manualCopied, setManualCopied] = useState(false);
  const [msgMode, setMsgMode] = useState<'ai' | 'manual'>('ai');
  const [showHistory, setShowHistory] = useState(true);

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
    ? contacts.find(c => String(c.id) === selectedContactId) || null
    : null;

  const contactActivities = useMemo(() => {
    if (!selectedContact) return [];
    return getContactActivities(String(selectedContact.id)).slice(0, 15);
  }, [selectedContact, getContactActivities]);

  const daysSince = selectedContact ? daysSinceLastActivity(String(selectedContact.id)) : null;

  const handleSelectContact = useCallback((contact: Prospect) => {
    setSelectedContactId(String(contact.id));
    setSuggestedMsg('');
    setManualMsg('');
    setMsgMode('ai');
  }, []);

  const handleOpenWhatsApp = useCallback(async (prefilledMsg?: string) => {
    if (!selectedContact) return;
    const url = buildWhatsAppUrl(selectedContact.PhoneNumber, selectedContact.Country, prefilledMsg);
    if (!url) return;
    
    const msgSummary = prefilledMsg
      ? `Sent WhatsApp message to ${selectedContact.FullName}`
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

  const handleSendManual = useCallback(async () => {
    if (!selectedContact || !manualMsg.trim()) return;
    await handleOpenWhatsApp(manualMsg.trim());
    setManualMsg('');
  }, [selectedContact, manualMsg, handleOpenWhatsApp]);

  return (
    <div className="min-h-[calc(100vh-56px-48px)] md:h-[calc(100vh-56px-48px)] flex flex-col">
      {/* Tab bar — wraps on mobile so all tabs stay visible */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2 px-1">
        <button type="button" onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'contacts' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}>
          <MessageCircle className="w-4 h-4" />
          Contacts
        </button>
        <button type="button" onClick={() => setActiveTab('birthdays')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'birthdays' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}>
          <Cake className="w-4 h-4" />
          Birthdays
        </button>
        {isAdmin && (
          <button type="button" onClick={() => setActiveTab('maytapi')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'maytapi' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            title="Admin only — Vanto's Maytapi WhatsApp number">
            <MessageCircle className="w-4 h-4" />
            <span className="whitespace-nowrap">Maytapi Inbox</span>
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
              H1
            </span>
          </button>
        )}
      </div>

      {activeTab === 'maytapi' ? (
        <div className="flex-1 overflow-hidden px-1 flex flex-col">
          <MaytapiInbox />
        </div>
      ) : activeTab === 'birthdays' ? (
        <div className="flex-1 overflow-y-auto px-1">
          <BirthdayPanel />
        </div>
      ) : (
    <div className="flex-1 flex flex-col md:flex-row rounded-xl overflow-hidden border border-slate-700 bg-slate-800/30 min-h-[60vh]">
      {/* Contact List - Left Panel (full width on mobile, hidden when contact selected) */}
      <div className={`${selectedContactId ? 'hidden md:flex' : 'flex'} w-full md:w-80 md:border-r border-slate-700 flex-col bg-slate-800/50 shrink-0`}>
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
          {filteredContacts.map((contact) => {
            const isSelected = String(contact.id) === selectedContactId;
            return (
            <div
              key={contact.id}
              onClick={() => handleSelectContact(contact)}
              className={`flex items-start gap-3 p-3 cursor-pointer transition-all border-l-3 ${
                isSelected
                  ? 'bg-green-500/10 border-l-green-500 border-b border-slate-700/50'
                  : 'hover:bg-slate-700/30 border-l-transparent border-b border-slate-700/50'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-xs ${
                  isSelected ? 'bg-gradient-to-br from-green-600 to-green-700' : 'bg-gradient-to-br from-slate-600 to-slate-700'
                }`}>
                  {contact.FullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${temperatureColors[contact.LeadTemperature] || 'bg-slate-500'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-green-300' : 'text-white'}`}>{contact.FullName}</p>
                <p className="text-xs text-slate-500 truncate">{contact.PhoneNumber}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-400">
                    {contact.LeadType}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-400">
                    {contact.CommunicationStatus}
                  </span>
                </div>
              </div>
            </div>
            );
          })}

          {filteredContacts.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-slate-500 text-sm">No contacts with phone numbers found</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Communication Workbench */}
      {selectedContact ? (
        <div className="flex-1 flex flex-col bg-slate-900/50 min-w-0">
          {/* Mobile Back button */}
          <button
            type="button"
            onClick={() => setSelectedContactId(null)}
            className="md:hidden flex items-center gap-2 px-4 py-2 text-sm text-slate-300 bg-slate-800/70 border-b border-slate-700 hover:bg-slate-700"
          >
            ← Back to contacts
          </button>
          {/* Header with actions */}
          <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {selectedContact.FullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{selectedContact.FullName}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{selectedContact.PhoneNumber}</span>
                    {daysSince !== null && (
                      <span className={`${daysSince > 7 ? 'text-rose-400' : 'text-slate-500'}`}>
                        · {daysSince}d since last activity
                      </span>
                    )}
                    {daysSince === null && <span className="text-amber-400">· Never contacted</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <button type="button" onClick={() => setShowLogActivity(true)}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors">
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Log Activity</span>
                </button>
                <button type="button" onClick={() => setShowFollowUp(true)}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-lg transition-colors">
                  <Bell className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Follow-up</span>
                </button>
                <button type="button" onClick={handleCopyNumber}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                  title="Copy phone number">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={() => handleOpenWhatsApp()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Open WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4 max-w-2xl">

              {/* === QUICK ACTIONS === */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <button type="button" onClick={() => handleOpenWhatsApp()}
                    className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-[11px] font-medium">WhatsApp</span>
                  </button>
                  <button type="button" onClick={async () => {
                    if (!selectedContact) return;
                    window.open(`tel:${selectedContact.PhoneNumber}`, '_blank');
                    await logActivity({
                      contact_id: String(selectedContact.id),
                      activity_type: 'call',
                      summary: `Called ${selectedContact.FullName}`,
                    });
                  }}
                    className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-400 transition-colors">
                    <Phone className="w-5 h-5" />
                    <span className="text-[11px] font-medium">Call</span>
                  </button>
                  <button type="button" onClick={async () => {
                    if (!selectedContact?.EmailAddress) return;
                    window.open(`mailto:${selectedContact.EmailAddress}`, '_blank');
                    await logActivity({
                      contact_id: String(selectedContact.id),
                      activity_type: 'email',
                      summary: `Emailed ${selectedContact.FullName}`,
                    });
                  }}
                    className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl border transition-colors ${
                      selectedContact.EmailAddress
                        ? 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 text-sky-400'
                        : 'bg-slate-700/30 border-slate-600/30 text-slate-600 cursor-not-allowed'
                    }`}>
                    <Mail className="w-5 h-5" />
                    <span className="text-[11px] font-medium">Email</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setShowTemplatePicker(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-green-400 text-xs font-medium transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp Template
                  </button>
                  <button type="button" onClick={() => {
                    // For email templates, open template picker with email channel
                    setShowTemplatePicker(true);
                  }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-sky-400 text-xs font-medium transition-colors">
                    <Mail className="w-3.5 h-3.5" />
                    Email Template
                  </button>
                </div>
              </div>

              {/* === MESSAGING WORKBENCH === */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                {/* Messaging Tabs */}
                <div className="flex border-b border-slate-700">
                  <button type="button" onClick={() => setMsgMode('ai')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                      msgMode === 'ai' ? 'bg-violet-500/15 text-violet-300 border-b-2 border-violet-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                    }`}>
                    <Sparkles className="w-3.5 h-3.5" /> AI Message
                  </button>
                  <button type="button" onClick={() => setMsgMode('manual')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                      msgMode === 'manual' ? 'bg-teal-500/15 text-teal-300 border-b-2 border-teal-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                    }`}>
                    <PenLine className="w-3.5 h-3.5" /> Manual
                  </button>
                </div>

                {/* AI Message Content */}
                {msgMode === 'ai' && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-violet-400">AI-generated contextual message for {selectedContact.FullName}</p>
                      <button type="button" onClick={handleSuggestMessage} disabled={msgLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                        {msgLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {suggestedMsg ? 'Regenerate' : 'Generate'}
                      </button>
                    </div>
                    {msgLoading ? (
                      <div className="flex items-center gap-2 text-violet-400 py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Crafting the perfect message...</span>
                      </div>
                    ) : suggestedMsg ? (
                      <div>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap mb-3 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">{suggestedMsg}</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => {
                            navigator.clipboard.writeText(suggestedMsg);
                            setMsgCopied(true);
                            setTimeout(() => setMsgCopied(false), 2000);
                          }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors">
                            {msgCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {msgCopied ? 'Copied!' : 'Copy'}
                          </button>
                          <button type="button" onClick={() => handleOpenWhatsApp(suggestedMsg)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors">
                            <Send className="w-3 h-3" /> Send via WhatsApp
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 py-3">Click "Generate" to create a smart, contextual WhatsApp message.</p>
                    )}
                  </div>
                )}

                {/* Manual Message Content */}
                {msgMode === 'manual' && (
                  <div className="p-4">
                    <p className="text-xs text-teal-400 mb-3">Write your own message to {selectedContact.FullName}</p>
                    <textarea
                      value={manualMsg}
                      onChange={(e) => setManualMsg(e.target.value)}
                      placeholder={`Hi ${selectedContact.FullName.split(' ')[0]}, ...`}
                      rows={4}
                      className="w-full px-3 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500 resize-none"
                    />
                    <div className="flex gap-2 mt-3">
                      <button type="button" onClick={() => {
                        if (!manualMsg.trim()) return;
                        navigator.clipboard.writeText(manualMsg);
                        setManualCopied(true);
                        setTimeout(() => setManualCopied(false), 2000);
                      }} disabled={!manualMsg.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 rounded-lg transition-colors">
                        {manualCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {manualCopied ? 'Copied!' : 'Copy'}
                      </button>
                      <button type="button" onClick={handleSendManual} disabled={!manualMsg.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg transition-colors">
                        <Send className="w-3 h-3" /> Send via WhatsApp
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* === CONTACT INFO + STATUS === */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Contact Details */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact Details</h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm text-slate-300">{selectedContact.PhoneNumber}</span>
                    </div>
                    {selectedContact.EmailAddress && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-sm text-slate-300">{selectedContact.EmailAddress}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Location:</span>
                      <span className="text-slate-300">{selectedContact.City}{selectedContact.Province ? `, ${selectedContact.Province}` : ''}{selectedContact.Country ? `, ${selectedContact.Country}` : ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        selectedContact.LeadTemperature === 'Hot' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                        selectedContact.LeadTemperature === 'Warm' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                        'bg-sky-500/20 text-sky-400 border-sky-500/30'
                      }`}>{selectedContact.LeadTemperature}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-slate-700/50 text-slate-300 border-slate-600">{selectedContact.LeadType}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-slate-700/50 text-slate-300 border-slate-600">{selectedContact.RegistrationStatus}</span>
                      {selectedContact.GOStatus && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-400 border-amber-500/30">{selectedContact.GOStatus}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions & Status */}
                <div className="space-y-3">
                  {selectedContact.ActionTaken && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Last Action</h3>
                      <p className="text-sm text-slate-300">{selectedContact.ActionTaken}</p>
                    </div>
                  )}
                  {selectedContact.NextAction && (
                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1.5">Next Action</h3>
                      <p className="text-sm text-teal-300">{selectedContact.NextAction}</p>
                      {selectedContact.MeetingTime && (
                        <p className="text-xs text-teal-400/70 mt-1">📅 {selectedContact.MeetingTime}</p>
                      )}
                    </div>
                  )}
                  {selectedContact.AdditionalNotes && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Notes</h3>
                      <p className="text-sm text-slate-400">{selectedContact.AdditionalNotes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* === ACTIVITY HISTORY === */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Activity</h3>
                    <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">{contactActivities.length}</span>
                  </div>
                  {showHistory ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {showHistory && (
                  <div className="border-t border-slate-700/50">
                    {contactActivities.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs text-slate-500">No activity logged yet for this contact.</p>
                        <button type="button" onClick={() => setShowLogActivity(true)}
                          className="text-xs text-teal-400 hover:text-teal-300 mt-2 inline-flex items-center gap-1">
                          <ClipboardList className="w-3 h-3" /> Log first activity
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-700/30 max-h-64 overflow-y-auto">
                        {contactActivities.map(a => (
                          <div key={a.id} className="px-4 py-2.5 flex items-start gap-3">
                            <span className="text-base shrink-0 mt-0.5">{activityTypeIcons[a.activity_type] || '📌'}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-slate-300 truncate">{a.summary}</p>
                              {a.notes && <p className="text-[11px] text-slate-500 truncate mt-0.5">{a.notes}</p>}
                              {a.next_action && <p className="text-[11px] text-teal-400/70 truncate mt-0.5">→ {a.next_action}</p>}
                            </div>
                            <span className="text-[10px] text-slate-600 whitespace-nowrap shrink-0">
                              {new Date(a.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-slate-900/30">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Select a contact to start messaging</p>
            <p className="text-slate-600 text-xs mt-1">Click any contact on the left to open the communication workbench</p>
          </div>
        </div>
      )}

      {showLogActivity && selectedContact && (
        <LogActivityModal
          onClose={() => setShowLogActivity(false)}
          prefillContactName={selectedContact.FullName}
        />
      )}
      {showFollowUp && selectedContact && (
        <AddFollowUpModal
          onClose={() => setShowFollowUp(false)}
          prefillContactName={selectedContact.FullName}
        />
      )}
      {showTemplatePicker && selectedContact && (
        <MessageTemplatePicker
          contact={selectedContact}
          channel="whatsapp"
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
    </div>
      )}
    </div>
  );
}
