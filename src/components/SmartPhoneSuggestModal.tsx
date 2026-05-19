import { useState, useEffect, useMemo } from 'react';
import { X, Phone, Search, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import { normalizePhone } from '@/utils/contactNormalization';
import type { BirthdayEntry } from '@/hooks/useBirthdays';

interface Suggestion {
  phone: string;
  source: string;
  detail: string;
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

export function SmartPhoneSuggestModal({ entry, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { contacts, updateContact } = useCrm();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [manual, setManual] = useState('');
  const [saving, setSaving] = useState(false);

  const tokens = useMemo(() => nameTokens(entry.full_name), [entry.full_name]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      const found = new Map<string, Suggestion>();
      const push = (raw: string, source: string, detail: string) => {
        const norm = normalizePhone(raw);
        if (!norm || norm.length < 9) return;
        if (!found.has(norm)) found.set(norm, { phone: raw.trim(), source, detail });
      };

      // 1) Contacts with similar name and a phone
      contacts.forEach(c => {
        if (String(c.id) === entry.contact_id) return;
        const nm = (c.FullName || '').toLowerCase();
        const hit = tokens.some(t => nm.includes(t));
        if (hit && c.PhoneNumber) push(c.PhoneNumber, 'CRM contact', c.FullName || '');
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
          if (c?.PhoneNumber) push(c.PhoneNumber, 'Order', o.contact_name);
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
          if (r.recovered_phone) push(r.recovered_phone, `Rescue · ${r.source_table}`, r.recovered_full_name);
        });
      } catch {}

      // 4) Maytapi inbox (admin-only RLS; ignore failures gracefully)
      try {
        const { data: mt } = await supabase
          .from('maytapi_messages')
          .select('phone_e164, body_preview')
          .ilike('body_preview', `%${tokens[0] || entry.full_name}%`)
          .limit(10);
        (mt || []).forEach(m => {
          if (m.phone_e164) push(m.phone_e164, 'Maytapi inbox', m.body_preview || '');
        });
      } catch {}

      if (!cancelled) {
        setSuggestions([...found.values()]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, contacts, entry, tokens]);

  const handleSave = async (phone: string) => {
    if (!entry.contact_id) return;
    setSaving(true);
    await updateContact(entry.contact_id, { PhoneNumber: phone } as any);
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-white">Add phone — {entry.full_name}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">Suggested numbers</span>
              {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
            </div>
            {!loading && suggestions.length === 0 && (
              <div className="text-xs text-slate-500 py-2">No matches found across orders, contacts, rescue queue, or inbox.</div>
            )}
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
                  <div className="min-w-0">
                    <div className="text-sm text-white font-mono">{s.phone}</div>
                    <div className="text-[11px] text-slate-400 truncate">{s.source} · {s.detail}</div>
                  </div>
                  <button
                    type="button"
                    disabled={saving || !entry.contact_id}
                    onClick={() => handleSave(s.phone)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md"
                  >
                    <Check className="w-3 h-3" /> Use
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-700 pt-3">
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Or enter manually</label>
            <div className="flex gap-2">
              <input
                value={manual}
                onChange={e => setManual(e.target.value)}
                placeholder="+27…"
                className="flex-1 px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40"
              />
              <button
                type="button"
                disabled={!manual.trim() || saving || !entry.contact_id}
                onClick={() => handleSave(manual.trim())}
                className="px-3 py-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-lg"
              >
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">Nothing is saved until you confirm.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
