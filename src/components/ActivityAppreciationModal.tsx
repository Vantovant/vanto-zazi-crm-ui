import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X, MessageCircle, Copy, Check, ExternalLink, Send,
  Loader2, Sparkles, Crown, Heart, Briefcase, Award,
  ChevronLeft, ChevronRight, Users,
} from 'lucide-react';
import aplgoLogo from '@/assets/aplgo-logo.png';
import type { Prospect } from '@/data/mockData';
import { generateGreeting } from '@/utils/templateMerge';
import { buildWhatsAppUrl } from '@/utils/whatsappPhone';
import { useContactActivities } from '@/hooks/useContactActivities';
import { useCrm } from '@/contexts/CrmContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { normalizeActivityMonth } from '@/utils/monthlyActivityKey';

export type AppreciationTone = 'warm' | 'royal' | 'leadership' | 'professional';

interface ActivityOrder {
  id: string;
  contactId: string | null;
  contactName: string;
  amount: number;
  product: string;
}

interface SingleEntry {
  contact: Prospect;
  order: ActivityOrder;
  month: string;
}

interface ActivityAppreciationModalProps {
  entries: SingleEntry[];
  initialIndex?: number;
  onClose: () => void;
  onAppreciated?: (info: { contactId: string | null; aplgoId: string | null; month: string; monthKey: string }) => void;
}

const APLGO_BRAND_URL = 'https://crm.onlinecourseformlm.com/aplgo.html';

const TONE_CONFIG: Record<AppreciationTone, { label: string; icon: typeof Heart; color: string; description: string }> = {
  warm: { label: 'Warm', icon: Heart, color: 'text-rose-400', description: 'Friendly and heartfelt' },
  royal: { label: 'Royal', icon: Crown, color: 'text-amber-400', description: 'Celebratory and majestic' },
  leadership: { label: 'Leadership', icon: Briefcase, color: 'text-teal-400', description: 'Motivational and empowering' },
  professional: { label: 'Professional', icon: Award, color: 'text-blue-400', description: 'Simple and respectful' },
};

function buildMessage(
  entry: SingleEntry,
  tone: AppreciationTone,
  senderName: string,
  senderEmail: string,
): string {
  const greeting = generateGreeting(entry.contact);
  const amount = `R${entry.order.amount.toLocaleString()}`;
  const month = entry.month;
  const level = entry.contact.Level || '';
  const leg = entry.contact.Leg || '';

  const levelLine = level ? `\nYour level: ${level}${leg ? ` | Leg: ${leg}` : ''}` : '';

  const messages: Record<AppreciationTone, string> = {
    warm: `Hi ${greeting} 💛\n\nThank you so much for your activity for ${month}.\n\nYour commitment of ${amount} means the world. We see you, we value you, and we appreciate every step you take on this journey.${levelLine}\n\nKeep shining — you are doing something beautiful. 🌟`,
    royal: `${greeting} 👑\n\nWe celebrate YOU today!\n\nYour activity for ${month} — ${amount} — is a testament to your greatness. You are royalty in this business, and your consistency crowns you.${levelLine}\n\nKeep rising. The throne is yours. 🏆`,
    leadership: `${greeting} 🔥\n\nYour activity for ${month} of ${amount} speaks volumes about your leadership.\n\nYou are not just building a business — you are building a legacy. Your team watches, and your consistency inspires.${levelLine}\n\nStay the course. Leaders like you change everything. 💪`,
    professional: `Hi ${greeting},\n\nThank you for your activity payment of ${amount} for ${month}.\n\nYour consistency and dedication are highly valued. We appreciate your continued commitment to growth.${levelLine}\n\nKind regards`,
  };

  const body = messages[tone];
  const signature = senderName ? `\n\n— ${senderName}${senderEmail ? `\n${senderEmail}` : ''}` : '';
  return `${APLGO_BRAND_URL}\n\n${body}${signature}`;
}

export function ActivityAppreciationModal({
  entries,
  initialIndex = 0,
  onClose,
  onAppreciated,
}: ActivityAppreciationModalProps) {
  const { user } = useAuth();
  const { logActivity } = useContactActivities();
  const { updateContact } = useCrm();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [tone, setTone] = useState<AppreciationTone>('warm');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  const entry = entries[currentIndex];
  const isBulk = entries.length > 1;

  // Fetch sender profile
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('display_name, email').eq('id', user.id).single()
      .then(({ data }) => {
        setSenderName(data?.display_name || user.user_metadata?.display_name || '');
        setSenderEmail(data?.email || user.email || '');
      });
  }, [user]);

  const message = useMemo(() => {
    if (!entry) return '';
    return buildMessage(entry, tone, senderName, senderEmail);
  }, [entry, tone, senderName, senderEmail]);

  const [editedMessage, setEditedMessage] = useState('');
  useEffect(() => {
    setEditedMessage(message);
    setLogSuccess(false);
    setCopied(false);
  }, [message, currentIndex]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editedMessage]);

  const handleOpenWhatsApp = useCallback(() => {
    if (!entry) return;
    const url = buildWhatsAppUrl(entry.contact.PhoneNumber, entry.contact.Country, editedMessage);
    if (url) {
      window.open(url, '_blank');
    }
  }, [entry, editedMessage]);

  const handleSendAndLog = useCallback(async () => {
    if (!entry) return;
    const whatsappUrl = buildWhatsAppUrl(entry.contact.PhoneNumber, entry.contact.Country, editedMessage);
    if (!whatsappUrl) return;
    setLogging(true);
    const monthKey = normalizeActivityMonth(entry.month);
    const aplgoId = (entry.contact.APLGoID || '').toString().trim() || null;
    const contactIdRaw = entry.contact.id ? String(entry.contact.id) : '';
    // Only pass a real contact_id (UUID-shaped); fallback rows use the order id and must NOT be logged as a contact link.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactIdRaw);
    const contactIdForLog = isUuid ? contactIdRaw : undefined;

    // Machine-readable marker so month-scoped status detection is exact.
    const marker = monthKey ? ` [monthly_activity_appreciation:${monthKey}]` : '';
    await logActivity({
      contact_id: contactIdForLog,
      activity_type: 'whatsapp',
      summary: `Sent monthly activity appreciation message — Month: ${entry.month} | Amount: R${entry.order.amount.toLocaleString()} | User ID: ${aplgoId || 'N/A'}${marker}`,
      notes: `${editedMessage}\n\n${marker.trim()}`,
    });
    if (contactIdForLog) {
      await updateContact(contactIdForLog, {
        ActionTaken: `Activity Appreciation sent for ${entry.month} (${new Date().toLocaleDateString()})`,
      } as any);
    }
    window.open(whatsappUrl, '_blank');
    setLogging(false);
    setLogSuccess(true);
    onAppreciated?.({
      contactId: contactIdForLog || null,
      aplgoId,
      month: entry.month,
      monthKey,
    });

    // Auto-advance in bulk mode
    if (isBulk && currentIndex < entries.length - 1) {
      setTimeout(() => {
        setCurrentIndex(i => i + 1);
      }, 1500);
    }
  }, [entry, editedMessage, logActivity, updateContact, onAppreciated, isBulk, currentIndex, entries.length]);

  if (!entry) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img src={aplgoLogo} alt="APLGO" className="h-6 sm:h-8 w-auto object-contain shrink-0" />
              <div className="h-6 sm:h-8 w-px bg-slate-700 shrink-0 hidden sm:block" />
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-emerald-500/20 shrink-0">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-lg font-semibold text-white truncate">Activity Appreciation</h2>
                <p className="text-xs text-slate-400 truncate">
                  {isBulk ? `${currentIndex + 1} of ${entries.length} · ` : ''}
                  {entry.contact.FullName} · {entry.month}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contact Info Bar */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-500/5 border-b border-slate-700/50">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
              <div><span className="text-slate-500">Name</span><p className="text-white font-medium mt-0.5 truncate">{entry.contact.FullName}</p></div>
              <div><span className="text-slate-500">Amount</span><p className="text-emerald-400 font-bold mt-0.5">R{entry.order.amount.toLocaleString()}</p></div>
              <div><span className="text-slate-500">Month</span><p className="text-white font-medium mt-0.5">{entry.month}</p></div>
              <div><span className="text-slate-500">User ID</span><p className="text-white font-medium mt-0.5 font-mono text-[11px] truncate">{entry.contact.APLGoID || '—'}</p></div>
              {entry.contact.Level && (
                <div><span className="text-slate-500">Level</span><p className="text-white font-medium mt-0.5">{entry.contact.Level}</p></div>
              )}
              {entry.contact.Leg && (
                <div><span className="text-slate-500">Leg</span><p className="text-white font-medium mt-0.5">{entry.contact.Leg}</p></div>
              )}
            </div>
          </div>

          {logSuccess ? (
            <div className="p-8 sm:p-12 text-center">
              <Check className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-medium text-sm sm:text-base">Appreciation sent & logged!</p>
              {isBulk && currentIndex < entries.length - 1 && (
                <p className="text-xs text-slate-400 mt-2">Moving to next person...</p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4">
              {/* Tone Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Message Tone</label>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {(Object.entries(TONE_CONFIG) as [AppreciationTone, typeof TONE_CONFIG['warm']][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    const isActive = tone === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTone(key)}
                        className={`flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-lg border text-[10px] sm:text-xs font-medium transition-colors ${
                          isActive
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? cfg.color : 'text-slate-500'}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editable Message */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Message</label>
                <textarea
                  value={editedMessage}
                  onChange={e => setEditedMessage(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y sm:rows-10"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 sm:pt-2">
                <button type="button" onClick={handleCopy}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button type="button" onClick={handleOpenWhatsApp}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  WhatsApp
                </button>
                <button type="button" onClick={handleSendAndLog} disabled={logging}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                  {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send & Log
                </button>
              </div>
            </div>
          )}

          {/* Bulk Navigation Footer */}
          {isBulk && (
            <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-slate-700 flex items-center justify-between shrink-0">
              <button type="button" disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(i => i - 1)}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-200 rounded-lg transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Users className="w-3.5 h-3.5" />
                {currentIndex + 1} / {entries.length}
              </div>
              <button type="button" disabled={currentIndex >= entries.length - 1}
                onClick={() => setCurrentIndex(i => i + 1)}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-200 rounded-lg transition-colors">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
