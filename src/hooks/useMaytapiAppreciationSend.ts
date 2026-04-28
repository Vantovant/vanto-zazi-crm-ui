/**
 * MP1 — Maytapi appreciation send (one-by-one, human-approved, admin-only).
 *
 * STRICT PILOT RULES (do not relax without explicit approval):
 *   - One entry, one click, one Maytapi send.
 *   - Reuses locked `maytapi-send-1to1` edge function. Never modifies it.
 *   - Frontend NEVER writes prospector_send_log (the edge function does).
 *   - Done marker (`[maytapi_message:<id>]`) only after Maytapi returns ok=true.
 *   - Failure keeps the entry Pending and surfaces the reason. No auto-retry.
 *   - Duplicate-send blocked by THREE layers:
 *       1. existing contact_activities Done marker for the same entry key
 *       2. existing zazi_actions row whose evidence.mp1.entry_key matches
 *       3. locked function's own sent_at / maytapi_message_id guard
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const APLGO_BRAND_URL = 'https://crm.onlinecourseformlm.com/aplgo.html';

export interface MaytapiGateState {
  // Settings & identity
  isAdmin: boolean;
  maytapiEnabled: boolean;
  allowlist: string[];
  dailyCap: number;
  loading: boolean;
}

export type GateBlockReason =
  | 'not_admin'
  | 'maytapi_disabled'
  | 'unmatched_contact'
  | 'opted_out'
  | 'no_phone'
  | 'phone_not_allowlisted'
  | 'already_done'
  | 'already_in_progress'
  | 'daily_cap_reached'
  | 'message_format_invalid';

export interface GateResult {
  allowed: boolean;
  reason?: GateBlockReason;
  detail?: string;
}

export interface SendArgs {
  contactId: string;          // UUID of matched contact
  contactName: string;
  phoneNormalized: string;    // digits-only, ≥9
  communicationStatus: string;
  monthKey: string;           // "YYYY-MM"
  entryKey: string;           // e.g. "oid:<uuid>"
  finalMessage: string;       // already includes branded URL first line + Vanto signature
}

export interface SendResult {
  ok: boolean;
  maytapi_message_id?: string | null;
  error_code?: string | null;
  http_status?: number | null;
  reason?: string;
}

const MP1_MODE = 'monthly_activity_appreciation_mp1';

export function useMaytapiAppreciationSend() {
  const { user } = useAuth();

  const [gate, setGate] = useState<MaytapiGateState>({
    isAdmin: false,
    maytapiEnabled: false,
    allowlist: [],
    dailyCap: 100,
    loading: true,
  });

  // Load admin role + integration settings once per user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) setGate((g) => ({ ...g, loading: false }));
        return;
      }
      const [{ data: roleRow }, { data: settings }] = await Promise.all([
        (supabase.from('user_roles') as any)
          .select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle(),
        (supabase.from('integration_settings') as any)
          .select('maytapi_enabled, maytapi_phone_allowlist, daily_send_cap')
          .eq('user_id', user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setGate({
        isAdmin: !!roleRow,
        maytapiEnabled: !!settings?.maytapi_enabled,
        allowlist: Array.isArray(settings?.maytapi_phone_allowlist)
          ? (settings.maytapi_phone_allowlist as string[])
          : [],
        dailyCap: typeof settings?.daily_send_cap === 'number' ? settings.daily_send_cap : 100,
        loading: false,
      });
    })();
    return () => { cancelled = true; };
  }, [user]);

  /** Verify branded-URL first line + Vanto signature presence (mirrors locked function check). */
  const verifyFirstTouch = useCallback((message: string): boolean => {
    if (!message) return false;
    const firstLine = (message.split('\n')[0] || '').trim();
    return (
      firstLine === APLGO_BRAND_URL
      && message.includes('— Vanto')
      && message.includes('vanto@onlinecourseformlm.com')
    );
  }, []);

  /**
   * Synchronous-ish gate evaluator (some checks need DB; expose as async).
   * Returns the FIRST blocking reason. Caller disables the button + shows tooltip.
   */
  const evaluateGate = useCallback(async (args: SendArgs): Promise<GateResult> => {
    if (!user) return { allowed: false, reason: 'not_admin' };
    if (!gate.isAdmin) return { allowed: false, reason: 'not_admin' };
    if (!gate.maytapiEnabled) return { allowed: false, reason: 'maytapi_disabled' };

    // Contact must be UUID-shaped (gate.contactId already enforced by caller, but double-check)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.contactId);
    if (!isUuid) return { allowed: false, reason: 'unmatched_contact' };

    if ((args.communicationStatus || '').trim() === 'Unsubscribed') {
      return { allowed: false, reason: 'opted_out' };
    }

    const phone = (args.phoneNormalized || '').replace(/[^0-9]/g, '');
    if (!phone || phone.length < 9) return { allowed: false, reason: 'no_phone' };

    if (gate.allowlist.length === 0 || !gate.allowlist.includes(phone)) {
      return { allowed: false, reason: 'phone_not_allowlisted' };
    }

    if (!verifyFirstTouch(args.finalMessage)) {
      return { allowed: false, reason: 'message_format_invalid' };
    }

    // Done marker check (any existing log row with this entry's marker)
    const markerNeedle = `[monthly_activity_appreciation_entry:${args.entryKey}]`;
    const { data: existingDone } = await (supabase.from('contact_activities') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('contact_id', args.contactId)
      .ilike('summary', `%${markerNeedle}%`)
      .limit(1)
      .maybeSingle();
    if (existingDone?.id) return { allowed: false, reason: 'already_done' };

    // Existing zazi_actions row for this entry that is approved or sent (not failed)
    const { data: existingActions } = await (supabase.from('zazi_actions') as any)
      .select('id, status, sent_at')
      .eq('user_id', user.id)
      .eq('contact_id', args.contactId)
      .filter('evidence->mp1->>entry_key', 'eq', args.entryKey)
      .in('status', ['approved', 'sent']);
    if (existingActions && existingActions.length > 0) {
      return { allowed: false, reason: 'already_in_progress' };
    }

    // Daily cap — count today's successful MP1 prospector_send_log rows (read-only check)
    // (Frontend does NOT write prospector_send_log; we only read for the cap.)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count: todayCount } = await (supabase.from('prospector_send_log') as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('mode', MP1_MODE)
      .eq('request_status', 'ok')
      .gte('attempted_at', startOfDay.toISOString());
    if ((todayCount ?? 0) >= gate.dailyCap) {
      return { allowed: false, reason: 'daily_cap_reached', detail: `${todayCount}/${gate.dailyCap}` };
    }

    return { allowed: true };
  }, [user, gate, verifyFirstTouch]);

  /**
   * Performs the full MP1 send sequence:
   *   1. Re-evaluate gates (race-safe).
   *   2. Insert one zazi_actions row (approved, supervisor-bypass evidence).
   *   3. Invoke locked maytapi-send-1to1 with { zazi_action_id, test_mode: true }.
   *   4. On success: write Done marker. On failure: mark zazi_actions row failed.
   */
  const send = useCallback(async (args: SendArgs): Promise<SendResult> => {
    if (!user) return { ok: false, reason: 'not_authenticated' };

    const recheck = await evaluateGate(args);
    if (!recheck.allowed) return { ok: false, reason: recheck.reason || 'blocked' };

    // 1. Insert zazi_actions row (passing supervisor scores per H.2.a)
    const evidence = {
      mp1: {
        entry_key: args.entryKey,
        month: args.monthKey,
        source: 'monthly_activity_push',
        human_approved: true,
        supervisor_bypass: 'manual_appreciation',
        approved_at_client: new Date().toISOString(),
      },
    };
    const nowIso = new Date().toISOString();
    const { data: actionRow, error: insertErr } = await (supabase.from('zazi_actions') as any)
      .insert({
        user_id: user.id,
        contact_id: args.contactId,
        channel: 'whatsapp',
        status: 'approved',
        approved_by: user.id,
        approved_at: nowIso,
        proposed_message: args.finalMessage,
        expected_next_step: 'monthly_activity_appreciation_sent',
        next_best_business_action: 'await_reply',
        reason_for_message: 'Manual monthly activity appreciation (MP1)',
        recommended_tone: 'warm',
        leadership_need: '',
        movement_stage: '',
        belief_risk: 0,
        supervisor_quality_score: 100,
        supervisor_safety: 100,
        supervisor_leadership_fit: 100,
        supervisor_tone_fit: 100,
        supervisor_relevance: 100,
        supervisor_clarity: 100,
        supervisor_grounding: 100,
        supervisor_cultural_fit: 100,
        evidence,
      })
      .select('id')
      .single();

    if (insertErr || !actionRow?.id) {
      return { ok: false, reason: `zazi_actions_insert_failed: ${insertErr?.message || 'unknown'}` };
    }
    const zaziActionId: string = actionRow.id;

    // 2. Invoke the locked send function
    const { data: invokeData, error: invokeErr } = await supabase.functions.invoke(
      'maytapi-send-1to1',
      { body: { zazi_action_id: zaziActionId, test_mode: true } },
    );

    // Network/transport error
    if (invokeErr) {
      // Mark the action failed so a retry can create a fresh row (gate 8 only blocks 'approved'/'sent')
      await (supabase.from('zazi_actions') as any)
        .update({
          status: 'draft',
          evidence: { ...evidence, mp1: { ...evidence.mp1, failed_at: new Date().toISOString(), failure_kind: 'invoke_error', failure_detail: invokeErr.message } },
        })
        .eq('id', zaziActionId);
      return { ok: false, reason: `invoke_error: ${invokeErr.message}` };
    }

    const okFromFn = !!(invokeData && (invokeData as any).ok && (invokeData as any).sent !== false);
    const messageId: string | null = (invokeData as any)?.maytapi_response?.message_id
      || (invokeData as any)?.message_id
      || null;

    if (!okFromFn) {
      const errCode = (invokeData as any)?.error_code || (invokeData as any)?.error || 'unknown_error';
      const httpStatus = (invokeData as any)?.http_status ?? null;
      // Reset action row so user can retry without hitting the duplicate gate
      await (supabase.from('zazi_actions') as any)
        .update({
          status: 'draft',
          evidence: {
            ...evidence,
            mp1: {
              ...evidence.mp1,
              failed_at: new Date().toISOString(),
              failure_kind: 'maytapi_failure',
              failure_code: errCode,
              http_status: httpStatus,
            },
          },
        })
        .eq('id', zaziActionId);
      return { ok: false, error_code: errCode, http_status: httpStatus, reason: errCode };
    }

    // 3. Success — write Done marker (entry stays Pending until this row exists)
    const monthMarker = `[monthly_activity_appreciation:${args.monthKey}]`;
    const entryMarker = `[monthly_activity_appreciation_entry:${args.entryKey}]`;
    const msgMarker = messageId ? `[maytapi_message:${messageId}]` : '';
    await (supabase.from('contact_activities') as any).insert({
      user_id: user.id,
      contact_id: args.contactId,
      activity_type: 'whatsapp',
      summary: `Sent monthly activity appreciation message via Maytapi — Month: ${args.monthKey} | ${monthMarker} ${entryMarker} ${msgMarker}`.trim(),
      notes: `${args.finalMessage}\n\n${monthMarker} ${entryMarker} ${msgMarker}`.trim(),
      next_action: '',
    });

    return { ok: true, maytapi_message_id: messageId };
  }, [user, evaluateGate]);

  return { gate, evaluateGate, send, verifyFirstTouch };
}

/** UI helper: human-readable label for a gate block reason. */
export function gateReasonLabel(reason?: GateBlockReason, detail?: string): string {
  switch (reason) {
    case 'not_admin': return 'Admin only';
    case 'maytapi_disabled': return 'Maytapi disabled in settings';
    case 'unmatched_contact': return 'Unmatched contact — link first';
    case 'opted_out': return 'Contact opted out (Unsubscribed)';
    case 'no_phone': return 'No valid phone number';
    case 'phone_not_allowlisted': return 'Phone not on test allowlist (pilot)';
    case 'already_done': return 'Already marked Done';
    case 'already_in_progress': return 'Send already in progress / completed';
    case 'daily_cap_reached': return `Daily cap reached${detail ? ` (${detail})` : ''}`;
    case 'message_format_invalid': return 'Message format invalid (branded URL + Vanto signature required)';
    default: return 'Send blocked';
  }
}
