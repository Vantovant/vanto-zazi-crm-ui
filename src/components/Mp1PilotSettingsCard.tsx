/**
 * MP1 Pilot Settings Card — Admin-only.
 *
 * STRICT SCOPE (do not extend without explicit approval):
 *   - Reads/writes ONLY these columns on integration_settings for the current admin user:
 *       maytapi_enabled (boolean)
 *       maytapi_phone_allowlist (text[])  — hard cap 5, digits-only, no '+', no spaces
 *       daily_send_cap (integer)          — clamp 1..100 for pilot safety
 *   - Never invokes maytapi-send-1to1.
 *   - Never invokes any send path. No queue, no cron, no automation.
 *   - Never exposes API tokens, webhook secrets, or Supabase keys.
 *   - Every save writes a user_activity audit row (who/what/old/new/timestamp).
 *   - Visible only when the parent page has already gated to OWNER_ID + admin role.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, ShieldCheck, AlertCircle, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const OWNER_ID = 'b8028d7d-6a08-45ef-a369-b438c440bea3';
const MAX_ALLOWLIST = 5;
const MIN_PHONE_DIGITS = 9;
const MAX_PHONE_DIGITS = 15; // E.164 max
const CAP_MIN = 1;
const CAP_MAX = 100;

interface SettingsState {
  maytapiEnabled: boolean;
  allowlist: string[];
  dailyCap: number;
}

function normalizePhone(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function Mp1PilotSettingsCard() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<SettingsState>({
    maytapiEnabled: false,
    allowlist: [],
    dailyCap: 100,
  });
  const [newPhone, setNewPhone] = useState('');
  const [capDraft, setCapDraft] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  // Verify admin role (defence-in-depth alongside OWNER_ID gate on parent page).
  // Wait for AuthContext to finish hydrating before deciding, so a hard reload
  // does not cause a "no user yet -> isAdmin=false" race that hides the card.
  useEffect(() => {
    if (authLoading) return; // wait for session hydration
    let cancelled = false;
    (async () => {
      if (!user) { if (!cancelled) setIsAdmin(false); return; }
      const { data } = await (supabase.from('user_roles') as any)
        .select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => { cancelled = true; };
  }, [authLoading, user?.id]);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase.from('integration_settings') as any)
      .select('maytapi_enabled, maytapi_phone_allowlist, daily_send_cap')
      .eq('user_id', user.id)
      .maybeSingle();
    const next: SettingsState = {
      maytapiEnabled: !!data?.maytapi_enabled,
      allowlist: Array.isArray(data?.maytapi_phone_allowlist)
        ? (data.maytapi_phone_allowlist as string[])
        : [],
      dailyCap: typeof data?.daily_send_cap === 'number' ? data.daily_send_cap : 100,
    };
    setState(next);
    setCapDraft(String(next.dailyCap));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const flash = (msg: string) => {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(null), 2000);
  };

  const writeAudit = useCallback(async (
    field: 'maytapi_enabled' | 'maytapi_phone_allowlist' | 'daily_send_cap',
    oldValue: unknown,
    newValue: unknown,
  ) => {
    if (!user) return;
    await (supabase.from('user_activity') as any).insert({
      user_id: user.id,
      action: 'mp1_pilot_settings_changed',
      page: '/team',
      metadata: {
        field,
        old_value: oldValue,
        new_value: newValue,
        actor_user_id: user.id,
        changed_at: new Date().toISOString(),
      },
    });
  }, [user]);

  const updateField = useCallback(async (
    patch: Partial<{ maytapi_enabled: boolean; maytapi_phone_allowlist: string[]; daily_send_cap: number }>,
    auditField: 'maytapi_enabled' | 'maytapi_phone_allowlist' | 'daily_send_cap',
    oldValue: unknown,
    newValue: unknown,
  ): Promise<boolean> => {
    if (!user) return false;
    setSaving(true);
    setError(null);
    const { error: upErr } = await (supabase.from('integration_settings') as any)
      .update(patch)
      .eq('user_id', user.id);
    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return false;
    }
    await writeAudit(auditField, oldValue, newValue);
    return true;
  }, [user, writeAudit]);

  const handleToggleMaytapi = async () => {
    const old = state.maytapiEnabled;
    const next = !old;
    const ok = await updateField({ maytapi_enabled: next }, 'maytapi_enabled', old, next);
    if (ok) {
      setState((s) => ({ ...s, maytapiEnabled: next }));
      flash(next ? 'Maytapi enabled' : 'Maytapi disabled');
    }
  };

  const handleAddPhone = async () => {
    setError(null);
    const digits = normalizePhone(newPhone);
    if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
      setError(`Phone must be ${MIN_PHONE_DIGITS}–${MAX_PHONE_DIGITS} digits (no '+', no spaces).`);
      return;
    }
    if (state.allowlist.includes(digits)) {
      setError('Phone already in allowlist.');
      return;
    }
    if (state.allowlist.length >= MAX_ALLOWLIST) {
      setError(`Allowlist hard cap is ${MAX_ALLOWLIST} numbers for MP1 pilot.`);
      return;
    }
    const old = state.allowlist;
    const next = [...old, digits];
    const ok = await updateField({ maytapi_phone_allowlist: next }, 'maytapi_phone_allowlist', old, next);
    if (ok) {
      setState((s) => ({ ...s, allowlist: next }));
      setNewPhone('');
      flash(`Added ${digits}`);
    }
  };

  const handleRemovePhone = async (phone: string) => {
    const old = state.allowlist;
    const next = old.filter((p) => p !== phone);
    const ok = await updateField({ maytapi_phone_allowlist: next }, 'maytapi_phone_allowlist', old, next);
    if (ok) {
      setState((s) => ({ ...s, allowlist: next }));
      flash(`Removed ${phone}`);
    }
  };

  const handleSaveCap = async () => {
    setError(null);
    const parsed = Number.parseInt(capDraft, 10);
    if (!Number.isFinite(parsed) || parsed < CAP_MIN || parsed > CAP_MAX) {
      setError(`Daily cap must be an integer between ${CAP_MIN} and ${CAP_MAX}.`);
      return;
    }
    const old = state.dailyCap;
    if (parsed === old) { flash('No change'); return; }
    const ok = await updateField({ daily_send_cap: parsed }, 'daily_send_cap', old, parsed);
    if (ok) {
      setState((s) => ({ ...s, dailyCap: parsed }));
      flash(`Daily cap set to ${parsed}`);
    }
  };

  // Defence-in-depth: wait for auth hydration, then gate to OWNER + admin.
  if (authLoading) return null;
  if (!user || user.id !== OWNER_ID) return null;
  if (isAdmin === null) {
    return (
      <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-5">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking MP1 Pilot Settings access…
        </div>
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            MP1 Pilot Settings — Maytapi
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Admin-only controls. Each save is audited. No send is triggered from this card.
          </p>
        </div>
        {savedFlash && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Check className="w-3 h-3" /> {savedFlash}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <>
          {/* Maytapi enabled toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-white">Maytapi enabled</div>
              <div className="text-xs text-slate-400">
                Master switch. When OFF, the pilot Send via Maytapi button stays disabled.
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleMaytapi}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                state.maytapiEnabled ? 'bg-emerald-500' : 'bg-slate-600'
              } disabled:opacity-50`}
              aria-label="Toggle Maytapi"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  state.maytapiEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Allowlist */}
          <div className="p-3 bg-slate-900/50 rounded-lg space-y-3">
            <div>
              <div className="text-sm font-medium text-white">
                Phone allowlist ({state.allowlist.length}/{MAX_ALLOWLIST})
              </div>
              <div className="text-xs text-slate-400">
                Digits-only, no '+', no spaces. Example: <code className="text-slate-300">27821234567</code>
              </div>
              {/* MP1.2 — Verified downline notice. Read-only, informational. */}
              <div className="mt-2 px-2.5 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-md text-[11px] text-emerald-200 flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>Verified CRM downlines</strong> are cleared for reviewed one-by-one Maytapi sending without manual allowlist entry.
                  A verified downline must have an APLGo&nbsp;ID, RegistrationStatus of <em>Registered</em> or <em>Activated</em>, and a non-prospect LeadType.
                  This allowlist remains for testing &amp; exceptions only — it never sends, and it never bulk-adds anyone.
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="27821234567"
                disabled={saving || state.allowlist.length >= MAX_ALLOWLIST}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddPhone}
                disabled={saving || !newPhone.trim() || state.allowlist.length >= MAX_ALLOWLIST}
                className="flex items-center gap-1 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {state.allowlist.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Allowlist is empty. The Send via Maytapi button will stay disabled.
              </p>
            ) : (
              <ul className="space-y-1">
                {state.allowlist.map((phone) => (
                  <li
                    key={phone}
                    className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-md text-sm"
                  >
                    <span className="font-mono text-slate-200">{phone}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePhone(phone)}
                      disabled={saving}
                      className="text-red-400 hover:text-red-300 disabled:opacity-50"
                      aria-label={`Remove ${phone}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Daily cap */}
          <div className="p-3 bg-slate-900/50 rounded-lg space-y-2">
            <div>
              <div className="text-sm font-medium text-white">Daily send cap</div>
              <div className="text-xs text-slate-400">
                Max successful MP1 sends per day. Pilot recommendation: <strong>1</strong> for first live test.
                Allowed range: {CAP_MIN}–{CAP_MAX}.
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={CAP_MIN}
                max={CAP_MAX}
                value={capDraft}
                onChange={(e) => setCapDraft(e.target.value)}
                disabled={saving}
                className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSaveCap}
                disabled={saving || capDraft === String(state.dailyCap)}
                className="px-3 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50"
              >
                Save cap
              </button>
              <span className="text-xs text-slate-500">Current: {state.dailyCap}</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 border-t border-slate-700/50 pt-3">
            This card never triggers a Maytapi send. It only edits gating settings. The locked
            <code className="mx-1 text-slate-400">maytapi-send-1to1</code> function is unchanged.
          </div>
        </>
      )}
    </div>
  );
}
