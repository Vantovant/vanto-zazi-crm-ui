import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Phone, Search, Loader2, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import { normalizePhone } from '@/utils/contactNormalization';
import { auditRepaired, type Confidence } from '@/utils/birthdaySendability';
import type { BirthdayEntry } from '@/hooks/useBirthdays';

interface Suggestion {
  phone: string;
  source: string;
  detail: string;
  confidence: Confidence;
}

interface Props {
  entry: BirthdayEntry;
  onClose: () => void;
  onSaved: () => void;
}

function nameTokens(name: string): string[] {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);
}

const CONF_BADGE: Record<Confidence, string> = {
  high: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  medium: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

export function SmartPhoneSuggestModal({ entry, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { contacts, updateContact } = useCrm();
  const [loading, setLoading] = useState(true);
  const [rawSuggestions, setRawSuggestions] = useState<Suggestion[]>([]);
  const [manual, setManual] = useState('');
  const [saving, setSaving] = useState(false);
  const [dupWarning, setDupWarning] = useState<{ phone: string; ownerName: string; source: string } | null>(null);
  const manualRef = useRef<HTMLInputElement>(null);

  const tokens = useMemo(() => nameTokens(entry.full_name), [entry.full_name]);
  const entryFullLower = entry.full_name.toLowerCase().trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      // Track per-phone hits so we can promote confidence when multiple sources agree
      const hits = new Map<string, Suggestion>();
      const push = (raw: string, source: string, detail: string, baseConf: Confidence) => {
        const norm = normalizePhone(raw);
        if (!norm || norm.length < 9) return;
        const existing = hits.get(norm);
        if (existing) {
          // Multi-source agreement → promote to high
          existing.confidence = 'high';
          existing.detail = `${existing.detail} · also ${source}`;
          return;
        }
        hits.set(norm, { phone: raw.trim(), source, detail, confidence: baseConf });
      };

      // 1) Contacts with similar name and a phone
      contacts.forEach(c => {
        if (String(c.id) === entry.contact_id) return;
        const nm = (c.FullName || '').toLowerCase();
        if (!c.PhoneNumber) return;
        if (nm === entryFullLower) push(c.PhoneNumber, 'CRM contact', c.FullName || '', 'high');
        else if (tokens.some(t => nm.includes(t))) push(c.PhoneNumber, 'CRM contact', c.FullName || '', 'medium');
      });

      // 2) Orders by name
      try {
        const { data: orderRows } = await supabase
          .from('orders')
          .select('contact_name, contact_id')
          .eq('user_id', user.id)
          .ilike('contact_name', `%${tokens[0] || entry.full_name}%`)
          .limit(20);
        (orderRows || []).forEach(o => {
          if (!o.contact_id) return;
          const c = contacts.find(cc => String(cc.id) === o.contact_id);
          if (c?.PhoneNumber) push(c.PhoneNumber, 'Order', o.contact_name, 'medium');
        });
      } catch {}

      // 3) phone_rescue_candidates
      try {
        const { data: rescue } = await supabase
          .from('phone_rescue_candidates')
          .select('recovered_phone, recovered_full_name, source_table, confidence')
          .eq('user_id', user.id)
          .ilike('recovered_full_name', `%${tokens[0] || entry.full_name}%`)
          .limit(20);
        (rescue || []).forEach(r => {
          if (!r.recovered_phone) return;
          const c: Confidence = r.confidence === 'high' ? 'high' : r.confidence === 'medium' ? 'medium' : 'low';
          push(r.recovered_phone, `Rescue · ${r.source_table}`, r.recovered_full_name, c);
        });
      } catch {}

      // 4) Maytapi inbox — body text matches are weak by default
      try {
        const { data: mt } = await supabase
          .from('maytapi_messages')
          .select('phone_e164, body_preview')
          .ilike('body_preview', `%${tokens[0] || entry.full_name}%`)
          .limit(10);
        (mt || []).forEach(m => {
          if (m.phone_e164) push(m.phone_e164, 'Maytapi inbox', m.body_preview || '', 'low');
        });
      } catch {}

      if (!cancelled) {
        setRawSuggestions([...hits.values()]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, contacts, entry, tokens, entryFullLower]);

  // Only auto-suggest High + Medium; Low collapsed under a toggle.
  const [showLow, setShowLow] = useState(false);
  const suggestions = useMemo(() => {
    const ordered = [...rawSuggestions].sort((a, b) => {
      const rank = (c: Confidence) => (c === 'high' ? 0 : c === 'medium' ? 1 : 2);
      return rank(a.confidence) - rank(b.confidence);
    });
    return showLow ? ordered : ordered.filter(s => s.confidence !== 'low');
  }, [rawSuggestions, showLow]);
  const lowCount = rawSuggestions.filter(s => s.confidence === 'low').length;

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Auto-focus manual input for fast keyboard repair flow
  useEffect(() => { manualRef.current?.focus(); }, []);

  const checkDuplicatePhone = (rawPhone: string): { ownerName: string; source: string } | null => {
    const norm = normalizePhone(rawPhone);
    if (!norm) return null;
    const owner = contacts.find(c => {
      if (String(c.id) === entry.contact_id) return false;
      const cn = normalizePhone(c.PhoneNumber || '');
      return cn && cn === norm;
    });
    return owner ? { ownerName: owner.FullName || '(unnamed)', source: 'CRM contact' } : null;
  };

  const performSave = async (phone: string, source: string) => {
    if (!entry.contact_id) return;
    setSaving(true);
    await updateContact(entry.contact_id, { PhoneNumber: phone } as any);
    auditRepaired(entry.id, entry.full_name, phone, source, user?.email || undefined);
    setSaving(false);
    onSaved();
    onClose();
  };

  const handleSave = (phone: string, source: string) => {
    const dup = checkDuplicatePhone(phone);
    if (dup) { setDupWarning({ phone, ownerName: dup.ownerName, source }); return; }
    void performSave(phone, source);
  };

  const handleManualKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && manual.trim()) {
      e.preventDefault();
      handleSave(manual.trim(), 'Manual entry');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-slate-900 border border-slate-700 sm:rounded-xl rounded-t-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            <Phone className="w-4 h-4 text-pink-400 shrink-0" />
            <h3 className="text-sm font-semibold text-white truncate">Add phone — {entry.full_name}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded" title="Esc">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">Suggested numbers</span>
              {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
            </div>
            {!loading && suggestions.length === 0 && (
              <div className="text-xs text-slate-500 py-2">
                No high/medium-confidence matches.
                {lowCount > 0 && (
                  <button onClick={() => setShowLow(true)} className="ml-1 text-sky-400 hover:underline">
                    Show {lowCount} low-confidence
                  </button>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-mono truncate">{s.phone}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CONF_BADGE[s.confidence]}`}>
                        {s.confidence === 'high' ? 'High' : s.confidence === 'medium' ? 'Medium' : 'Low'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{s.source} · {s.detail}</div>
                  </div>
                  <button
                    type="button"
                    disabled={saving || !entry.contact_id}
                    onClick={() => handleSave(s.phone, s.source)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md shrink-0"
                  >
                    <Check className="w-3 h-3" /> Use
                  </button>
                </div>
              ))}
            </div>
            {!loading && lowCount > 0 && !showLow && suggestions.length > 0 && (
              <button onClick={() => setShowLow(true)} className="mt-2 text-[11px] text-sky-400 hover:underline">
                + Show {lowCount} low-confidence suggestion{lowCount > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {/* Sticky footer — manual entry + dup warning */}
        <div className="border-t border-slate-700 p-3 bg-slate-900 sticky bottom-0 space-y-2">
          {dupWarning && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] text-amber-100">
                <div className="font-medium">Phone already linked</div>
                <div className="text-amber-200/80">
                  {dupWarning.phone} is already on <span className="font-medium">{dupWarning.ownerName}</span>.
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setDupWarning(null)} className="px-2 py-1 text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-200 rounded">
                  Cancel
                </button>
                <button onClick={() => { const d = dupWarning; setDupWarning(null); void performSave(d.phone, d.source); }}
                  className="px-2 py-1 text-[11px] bg-amber-600 hover:bg-amber-500 text-white rounded">
                  Save anyway
                </button>
              </div>
            </div>
          )}
          <label className="text-[11px] font-medium text-slate-400 block">Enter manually · Enter to save · Esc to close</label>
          <div className="flex gap-2">
            <input
              ref={manualRef}
              value={manual}
              onChange={e => setManual(e.target.value)}
              onKeyDown={handleManualKey}
              placeholder="+27…"
              className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40"
            />
            <button
              type="button"
              disabled={!manual.trim() || saving || !entry.contact_id}
              onClick={() => handleSave(manual.trim(), 'Manual entry')}
              className="px-3 py-2 text-xs font-medium bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-lg"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
