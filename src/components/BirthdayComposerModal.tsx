import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X, Copy, Check, ExternalLink, Send, ChevronLeft, ChevronRight,
  Heart, Crown, Briefcase, Award, Loader2, Cake,
} from 'lucide-react';
import { buildWhatsAppUrl } from '@/utils/whatsappPhone';
import { useContactActivities } from '@/hooks/useContactActivities';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { BirthdayEntry } from '@/hooks/useBirthdays';

export type BirthdayTone = 'warm' | 'royal' | 'spiritual' | 'professional';

interface BirthdayComposerModalProps {
  entries: BirthdayEntry[];
  initialIndex?: number;
  onClose: () => void;
  onCongratulated?: (id: string) => void;
}

const APLGO_BRAND_URL = 'https://crm.onlinecourseformlm.com/aplgo.html';

const TONE_CONFIG: Record<BirthdayTone, { label: string; icon: typeof Heart; color: string; description: string }> = {
  warm: { label: 'Warm', icon: Heart, color: 'text-rose-400', description: 'Friendly and heartfelt' },
  royal: { label: 'Royal', icon: Crown, color: 'text-amber-400', description: 'Celebratory and majestic' },
  spiritual: { label: 'Spiritual', icon: Cake, color: 'text-violet-400', description: 'Uplifting and graceful' },
  professional: { label: 'Professional', icon: Award, color: 'text-blue-400', description: 'Simple and respectful' },
};

function buildBirthdayMessage(
  entry: BirthdayEntry,
  tone: BirthdayTone,
  senderName: string,
  senderEmail: string,
): string {
  const firstName = entry.first_name || entry.full_name.split(' ')[0];
  const fullName = entry.full_name;
  const level = entry.level ? `\nYour level: ${entry.level}` : '';
  const birthdayDate = entry.birth_date_text || '';

  const messages: Record<BirthdayTone, string> = {
    warm: `Hi ${firstName} 🎉\n\nHappy Birthday to you! 🎂\n\nWishing you joy, strength, favor, and a beautiful year ahead.\n\nMay this new season bring growth, peace, and great grace into your life.${level}\n\nEnjoy your special day! 🌟`,
    royal: `${fullName} 👑🎂\n\nToday we celebrate YOU!\n\nHappy Birthday — you are royalty, and this day marks another year of greatness.\n\nMay your new year be filled with abundance, favor, and extraordinary blessings.${level}\n\nCrown up. It's YOUR day! 🎉🏆`,
    spiritual: `Dear ${firstName} 🕊️\n\nHappy Blessed Birthday! 🎂\n\nMay the Lord pour out His favor, protection, and wisdom upon you this new year.\n\nYou are a blessing to everyone around you. May this season bring divine connections, growth, and peace beyond understanding.${level}\n\nCelebrate with gratitude — the best is yet to come. 🙏✨`,
    professional: `Hi ${fullName},\n\nHappy Birthday! 🎂\n\nWishing you a wonderful celebration and a year filled with success, growth, and good health.${level}\n\nKind regards`,
  };

  const body = messages[tone];
  const signature = senderName ? `\n\n— ${senderName}${senderEmail ? `\n${senderEmail}` : ''}` : '';
  return `${APLGO_BRAND_URL}\n\n${body}${signature}`;
}

export function BirthdayComposerModal({
  entries,
  initialIndex = 0,
  onClose,
  onCongratulated,
}: BirthdayComposerModalProps) {
  const { user } = useAuth();
  const { logActivity } = useContactActivities();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [tone, setTone] = useState<BirthdayTone>('warm');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  const entry = entries[currentIndex];
  const isBulk = entries.length > 1;

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('display_name, email').eq('id', user.id).single()
      .then(({ data }) => {
        setSenderName(data?.display_name || '');
        setSenderEmail(data?.email || user.email || '');
      });
  }, [user]);

  const message = useMemo(() => {
    if (!entry) return '';
    return buildBirthdayMessage(entry, tone, senderName, senderEmail);
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
    if (!entry?.phone_number) return;
    const url = buildWhatsAppUrl(entry.phone_number, entry.country, editedMessage);
    if (url) window.open(url, '_blank');
  }, [entry, editedMessage]);

  const handleSendAndLog = useCallback(async () => {
    if (!entry) return;
    setLogging(true);

    if (entry.contact_id) {
      await logActivity({
        contact_id: entry.contact_id,
        activity_type: 'whatsapp',
        summary: 'Sent birthday message',
        notes: `Birthday: ${entry.birth_date_text} | ID: ${entry.associate_id || 'N/A'} | When: ${entry.when_to_congratulate || 'N/A'}`,
      });
    }

    if (entry.phone_number) {
      const url = buildWhatsAppUrl(entry.phone_number, entry.country, editedMessage);
      if (url) window.open(url, '_blank');
    }

    setLogging(false);
    setLogSuccess(true);
    onCongratulated?.(entry.id);

    if (isBulk && currentIndex < entries.length - 1) {
      setTimeout(() => setCurrentIndex(i => i + 1), 600);
    }
  }, [entry, editedMessage, logActivity, isBulk, currentIndex, entries.length, onCongratulated]);

  if (!entry) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Cake className="w-5 h-5 text-pink-400" />
            <h2 className="text-base font-semibold text-white">Birthday Message</h2>
            {isBulk && (
              <span className="text-xs text-slate-400 ml-2">{currentIndex + 1} / {entries.length}</span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Person info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500/30 to-rose-500/30 flex items-center justify-center text-white font-semibold">
              {entry.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{entry.full_name}</p>
              <p className="text-xs text-slate-400">
                🎂 {entry.birth_date_text || 'Unknown date'}
                {entry.associate_id && ` · ID: ${entry.associate_id}`}
                {entry.level && ` · Level ${entry.level}`}
              </p>
              {entry.when_to_congratulate && (
                <p className="text-xs text-pink-400 mt-0.5">⏰ {entry.when_to_congratulate}</p>
              )}
            </div>
          </div>

          {/* Tone picker */}
          <div className="flex gap-2">
            {(Object.entries(TONE_CONFIG) as [BirthdayTone, typeof TONE_CONFIG.warm][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button key={key} type="button" onClick={() => setTone(key)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-lg border text-xs transition-all ${
                    tone === key
                      ? 'border-pink-500 bg-pink-500/10 text-white'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Message */}
          <textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            rows={10}
            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/40 resize-none"
          />

          {/* Status badges */}
          {logSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">Logged & marked congratulated!</span>
            </div>
          )}

          {!entry.phone_number && entry.status !== 'unmatched' && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              No phone number — copy message to send manually.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700 flex items-center justify-between">
          {isBulk && (
            <div className="flex gap-1">
              <button type="button" onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <button type="button" onClick={() => setCurrentIndex(i => Math.min(entries.length - 1, i + 1))} disabled={currentIndex === entries.length - 1}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
          <div className={`flex gap-2 ${isBulk ? '' : 'ml-auto'}`}>
            <button type="button" onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button type="button" onClick={handleSendAndLog} disabled={logging}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium">
              {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send & Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
