import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X, MessageCircle, Copy, Check, ExternalLink, Send,
  Loader2, Sparkles, Crown, Heart, Briefcase, Award,
  ChevronLeft, ChevronRight, Users, Zap, ShieldAlert,
} from 'lucide-react';
import aplgoLogo from '@/assets/aplgo-logo.png';
import type { Prospect } from '@/data/mockData';
import { generateGreeting } from '@/utils/templateMerge';
import { buildWhatsAppUrl } from '@/utils/whatsappPhone';
import { useContactActivities } from '@/hooks/useContactActivities';
import { useCrm } from '@/contexts/CrmContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { normalizeActivityMonth, getActivityEntryKey } from '@/utils/monthlyActivityKey';
import {
  useMaytapiAppreciationSend,
  gateReasonLabel,
  type GateBlockReason,
} from '@/hooks/useMaytapiAppreciationSend';

export type AppreciationTone = 'warm' | 'royal' | 'leadership' | 'professional';

interface ActivityOrder {
  id: string;
  contactId: string | null;
  contactName: string;
  amount: number;
  product: string;
  dedupe_key?: string | null;
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
  onAppreciated?: (info: {
    contactId: string | null;
    aplgoId: string | null;
    month: string;
    monthKey: string;
    entryKey: string;
  }) => void;
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

  // ── MP1 (Maytapi pilot) state ────────────────────────────────────────────
  const { gate, evaluateGate, send: sendViaMaytapi, refreshGate } = useMaytapiAppreciationSend();
  const [mp1GateReason, setMp1GateReason] = useState<GateBlockReason | undefined>(undefined);
  const [mp1GateDetail, setMp1GateDetail] = useState<string | undefined>(undefined);
  const [mp1Allowed, setMp1Allowed] = useState(false);
  const [mp1Confirming, setMp1Confirming] = useState(false);
  const [mp1Sending, setMp1Sending] = useState(false);
  const [mp1Error, setMp1Error] = useState<string | null>(null);
  const [mp1Success, setMp1Success] = useState<string | null>(null);

  // MP1.1 — small allowlist convenience helper state. NEVER triggers a send,
  // NEVER calls maytapi-send-1to1, NEVER creates zazi_actions, NEVER auto-imports.
  const [mp11Working, setMp11Working] = useState(false);
  const [mp11Error, setMp11Error] = useState<string | null>(null);
  const [mp11Flash, setMp11Flash] = useState<string | null>(null);
  const MP11_MAX_ALLOWLIST = 5;

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
    setMp1Error(null);
    setMp1Success(null);
  }, [message, currentIndex]);

  // Compute current entry's MP1 args + run gate evaluation reactively.
  const mp1Args = useMemo(() => {
    if (!entry) return null;
    const monthKey = normalizeActivityMonth(entry.month);
    const entryKey = getActivityEntryKey(entry.order, entry.contact);
    const contactIdRaw = entry.contact.id ? String(entry.contact.id) : '';
    const phoneNormalized = String((entry.contact as any).phone_normalized || (entry.contact as any).PhoneNumber || '')
      .replace(/[^0-9]/g, '');
    return {
      contactId: contactIdRaw,
      contactName: entry.contact.FullName || '',
      phoneNormalized,
      communicationStatus: String((entry.contact as any).CommunicationStatus || ''),
      monthKey,
      entryKey,
      finalMessage: editedMessage,
    };
  }, [entry, editedMessage]);

  useEffect(() => {
    if (!mp1Args || gate.loading) {
      setMp1Allowed(false);
      setMp1GateReason(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await evaluateGate(mp1Args);
      if (cancelled) return;
      setMp1Allowed(r.allowed);
      setMp1GateReason(r.reason);
      setMp1GateDetail(r.detail);
    })();
    return () => { cancelled = true; };
  }, [mp1Args, gate, evaluateGate]);

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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactIdRaw);
    const contactIdForLog = isUuid ? contactIdRaw : undefined;

    const entryKey = getActivityEntryKey(entry.order, entry.contact);
    const monthMarker = monthKey ? ` [monthly_activity_appreciation:${monthKey}]` : '';
    const entryMarker = entryKey ? ` [monthly_activity_appreciation_entry:${entryKey}]` : '';
    await logActivity({
      contact_id: contactIdForLog,
      activity_type: 'whatsapp',
      summary: `Sent monthly activity appreciation message — Month: ${entry.month} | Amount: R${entry.order.amount.toLocaleString()} | User ID: ${aplgoId || 'N/A'}${monthMarker}${entryMarker}`,
      notes: `${editedMessage}\n\n${monthMarker.trim()} ${entryMarker.trim()}`.trim(),
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
      entryKey,
    });

    if (isBulk && currentIndex < entries.length - 1) {
      setTimeout(() => {
        setCurrentIndex(i => i + 1);
      }, 1500);
    }
  }, [entry, editedMessage, logActivity, updateContact, onAppreciated, isBulk, currentIndex, entries.length]);

  // ── MP1 confirm + send ──────────────────────────────────────────────────
  const handleMp1Confirm = useCallback(async () => {
    if (!entry || !mp1Args) return;
    setMp1Sending(true);
    setMp1Error(null);
    const result = await sendViaMaytapi(mp1Args);
    setMp1Sending(false);
    setMp1Confirming(false);
    if (!result.ok) {
      setMp1Error(result.reason || result.error_code || 'send_failed');
      return;
    }
    setMp1Success(result.maytapi_message_id || 'sent');
    onAppreciated?.({
      contactId: mp1Args.contactId,
      aplgoId: (entry.contact.APLGoID || '').toString().trim() || null,
      month: entry.month,
      monthKey: mp1Args.monthKey,
      entryKey: mp1Args.entryKey,
    });
    if (isBulk && currentIndex < entries.length - 1) {
      setTimeout(() => setCurrentIndex(i => i + 1), 1500);
    }
  }, [entry, mp1Args, sendViaMaytapi, onAppreciated, isBulk, currentIndex, entries.length]);

  // ── MP1.1 — Allowlist convenience helpers ───────────────────────────────
  // Strict scope: ONLY the current entry's phone, ONLY this admin's
  // integration_settings.maytapi_phone_allowlist column, hard cap 5,
  // every change writes a user_activity audit row.
  // Hard rules: no bulk add, no downline import, no order import, no Send,
  // no Maytapi call, no zazi_actions write, no daily_send_cap change.
  const mp11WriteAudit = useCallback(async (
    action: 'mp11_allowlist_add_current' | 'mp11_allowlist_replace_with_current',
    oldList: string[],
    newList: string[],
    phoneLast4: string,
  ) => {
    if (!user) return;
    await (supabase.from('user_activity') as any).insert({
      user_id: user.id,
      action,
      page: '/activity-appreciation-modal',
      metadata: {
        // Only last 4 digits in audit metadata to avoid leaking full phones.
        phone_last4: phoneLast4,
        old_count: oldList.length,
        new_count: newList.length,
        contact_id: mp1Args?.contactId || null,
        entry_key: mp1Args?.entryKey || null,
        actor_user_id: user.id,
        changed_at: new Date().toISOString(),
      },
    });
  }, [user, mp1Args]);

  const mp11AddCurrentToAllowlist = useCallback(async () => {
    setMp11Error(null); setMp11Flash(null);
    if (!user || !mp1Args) return;
    if (!gate.isAdmin) { setMp11Error('Admin only.'); return; }
    const phone = mp1Args.phoneNormalized;
    if (!phone || phone.length < 9) { setMp11Error('No valid phone for this contact.'); return; }
    if (gate.allowlist.includes(phone)) { setMp11Flash('Already on allowlist.'); return; }
    if (gate.allowlist.length >= MP11_MAX_ALLOWLIST) {
      setMp11Error(`Allowlist full (${MP11_MAX_ALLOWLIST}). Remove one number first.`);
      return;
    }
    setMp11Working(true);
    const next = [...gate.allowlist, phone];
    const { error: upErr } = await (supabase.from('integration_settings') as any)
      .update({ maytapi_phone_allowlist: next })
      .eq('user_id', user.id);
    if (upErr) {
      setMp11Working(false);
      setMp11Error(upErr.message);
      return;
    }
    await mp11WriteAudit('mp11_allowlist_add_current', gate.allowlist, next, phone.slice(-4));
    await refreshGate();
    setMp11Working(false);
    setMp11Flash(`Added ****${phone.slice(-4)}`);
  }, [user, mp1Args, gate, refreshGate, mp11WriteAudit]);

  const mp11ReplaceAllowlistWithCurrent = useCallback(async () => {
    setMp11Error(null); setMp11Flash(null);
    if (!user || !mp1Args) return;
    if (!gate.isAdmin) { setMp11Error('Admin only.'); return; }
    const phone = mp1Args.phoneNormalized;
    if (!phone || phone.length < 9) { setMp11Error('No valid phone for this contact.'); return; }
    if (gate.allowlist.length === 1 && gate.allowlist[0] === phone) {
      setMp11Flash('Already the only number.');
      return;
    }
    setMp11Working(true);
    const next = [phone]; // hard cap respected: length 1 ≤ 5
    const { error: upErr } = await (supabase.from('integration_settings') as any)
      .update({ maytapi_phone_allowlist: next })
      .eq('user_id', user.id);
    if (upErr) {
      setMp11Working(false);
      setMp11Error(upErr.message);
      return;
    }
    await mp11WriteAudit('mp11_allowlist_replace_with_current', gate.allowlist, next, phone.slice(-4));
    await refreshGate();
    setMp11Working(false);
    setMp11Flash(`Allowlist replaced — only ****${phone.slice(-4)} now.`);
  }, [user, mp1Args, gate, refreshGate, mp11WriteAudit]);

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

              {/* MP1 — Send via Maytapi (pilot, one-by-one). Always shown once gate has loaded;
                   disabled with reason when blocked (admin-only, Maytapi disabled, allowlist, etc.). */}
              {!gate.loading && (
                <div className="pt-2 border-t border-slate-700/60 mt-1 space-y-2">
                  {/* MP1.1 — Allowlist convenience helper.
                      Visible to admins only, only acts on the CURRENT contact's phone,
                      cannot bulk-add, cannot import downlines or orders, never sends. */}
                  {gate.isAdmin && mp1Args && !mp1Success && (
                    (() => {
                      const phone = mp1Args.phoneNormalized;
                      const last4 = phone ? phone.slice(-4) : '';
                      const onList = !!phone && gate.allowlist.includes(phone);
                      const listFull = gate.allowlist.length >= MP11_MAX_ALLOWLIST;
                      return (
                        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5 text-[11px] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-slate-300">
                              <span className="text-slate-500">This contact's phone: </span>
                              <span className="font-mono text-white">{phone ? `****${last4}` : '— no valid phone —'}</span>
                            </div>
                            <div className="text-slate-500">
                              Allowlist {gate.allowlist.length}/{MP11_MAX_ALLOWLIST}
                            </div>
                          </div>
                          {phone && (
                            onList ? (
                              <p className="text-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3" /> This phone is already on the allowlist.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  disabled={mp11Working || listFull}
                                  onClick={mp11AddCurrentToAllowlist}
                                  title={listFull ? `Allowlist full — remove one number first` : 'Add only this contact to the allowlist'}
                                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-purple-600/80 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                                >
                                  {mp11Working ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />}
                                  {listFull ? 'Allowlist full — remove one' : 'Add this phone to allowlist'}
                                </button>
                                <button
                                  type="button"
                                  disabled={mp11Working}
                                  onClick={mp11ReplaceAllowlistWithCurrent}
                                  title="Clear allowlist and add only this contact"
                                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-100 rounded-md transition-colors"
                                >
                                  {mp11Working ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                  Replace allowlist with this contact only
                                </button>
                              </div>
                            )
                          )}
                          {mp11Flash && (
                            <p className="text-emerald-300">{mp11Flash}</p>
                          )}
                          {mp11Error && (
                            <p className="text-rose-300">{mp11Error}</p>
                          )}
                          <p className="text-[10px] text-slate-500">
                            Helper only edits your allowlist. It never sends a message, never calls Maytapi,
                            and never adds any other contact. Send via Maytapi still requires manual review and confirmation below.
                          </p>
                        </div>
                      );
                    })()
                  )}
                  {mp1Success ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-purple-500/15 border border-purple-500/30 rounded-lg text-purple-200">
                      <Check className="w-4 h-4 text-purple-300" />
                      Sent via Maytapi · msg <span className="font-mono text-[11px]">{mp1Success.slice(-10)}</span>
                    </div>
                  ) : (
                    <button
                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-purple-500/15 border border-purple-500/30 rounded-lg text-purple-200">
                      <Check className="w-4 h-4 text-purple-300" />
                      Sent via Maytapi · msg <span className="font-mono text-[11px]">{mp1Success.slice(-10)}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!mp1Allowed || mp1Sending || gate.loading}
                      onClick={() => { setMp1Error(null); setMp1Confirming(true); }}
                      title={!mp1Allowed ? gateReasonLabel(mp1GateReason, mp1GateDetail) : 'Send this entry directly via Maytapi'}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      {mp1Sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {mp1Sending ? 'Sending via Maytapi…' : 'Send via Maytapi (pilot)'}
                    </button>
                  )}
                  {!mp1Allowed && !mp1Success && !gate.loading && (
                    <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      {gateReasonLabel(mp1GateReason, mp1GateDetail)}
                    </p>
                  )}
                  {mp1Error && (
                    <p className="mt-1.5 text-[11px] text-rose-300 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      Send failed: {mp1Error}. Entry stays Pending — try again later.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MP1 — Confirm dialog */}
          {mp1Confirming && entry && mp1Args && (
            <>
              <div className="fixed inset-0 bg-black/70 z-[60]" onClick={() => !mp1Sending && setMp1Confirming(false)} />
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-purple-500/40 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-semibold text-white">Confirm Maytapi send</h3>
                  </div>
                  <div className="text-xs text-slate-300 space-y-1.5 bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                    <div><span className="text-slate-500">Contact:</span> <span className="text-white font-medium">{mp1Args.contactName}</span></div>
                    <div><span className="text-slate-500">Phone:</span> <span className="font-mono text-white">****{mp1Args.phoneNormalized.slice(-4)}</span></div>
                    <div><span className="text-slate-500">Entry:</span> <span className="font-mono text-white">…{mp1Args.entryKey.slice(-12)}</span></div>
                    <div><span className="text-slate-500">Month:</span> <span className="text-white">{mp1Args.monthKey}</span></div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Final message preview</label>
                    <pre className="text-[11px] whitespace-pre-wrap bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 max-h-48 overflow-y-auto">{mp1Args.finalMessage}</pre>
                  </div>
                  <p className="text-[11px] text-amber-300/90 flex items-start gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
                    This will send ONE WhatsApp message via Maytapi to the masked number above. No retry, no queue.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button type="button" disabled={mp1Sending}
                      onClick={() => setMp1Confirming(false)}
                      className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded-lg">
                      Cancel
                    </button>
                    <button type="button" disabled={mp1Sending}
                      onClick={handleMp1Confirm}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg">
                      {mp1Sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {mp1Sending ? 'Sending…' : 'Confirm send'}
                    </button>
                  </div>
                </div>
              </div>
            </>
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
