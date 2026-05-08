// Phase Auto-Send — Phase 1 SHADOW MODE scanner.
//
// HARD RULES (enforced in code):
//   - Never calls maytapi-send-1to1.
//   - Never writes to contact_activities, contact_birthdays, orders, or any
//     "Done"/"sent" status anywhere.
//   - Only writes rows into public.auto_send_shadow_log.
//   - Idempotent on (user_id, lane, dedupe_key) via DB unique index.
//
// Lanes:
//   A. birthday      — eligible if today (SAST) within ±7 of birth_date and not congratulated this cycle_year.
//   B. appreciation  — entry-scoped: one shadow row per Activity order (purchase_type='Activity') in current month
//                      that does not yet have a Done marker.
//
// Gates evaluated (block_reason returned if blocked):
//   master_off, lane_off, opted_out, no_phone, not_verified_downline_or_allowlisted,
//   already_done, daily_cap_reached, per_contact_24h, quiet_hours, already_shadow_logged
//
// Auth: requires Authorization Bearer of the calling user. Service-role used only
// for the shadow-log insert (RLS has no INSERT policy).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VERIFIED_AUTO = new Set(['Purchase_Status', 'Purchase_Nostatus', 'Customer', 'Distributor']);
const VERIFIED_NEEDS_REG = new Set(['Registered_Nopurchase']);
const VERIFIED_REG_OK = new Set(['Registered', 'Activated']);

function isVerifiedDownline(c: { aplgo_id?: string; lead_type?: string; registration_status?: string }) {
  if (!(c.aplgo_id || '').trim()) return false;
  const lt = (c.lead_type || '').trim();
  if (VERIFIED_AUTO.has(lt)) return true;
  if (VERIFIED_NEEDS_REG.has(lt)) return VERIFIED_REG_OK.has((c.registration_status || '').trim());
  return false;
}

function sastNow(): { hour: number; ymd: string; year: number; ym: string } {
  const now = new Date();
  // SAST = UTC+2, no DST
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const y = sast.getUTCFullYear();
  const m = String(sast.getUTCMonth() + 1).padStart(2, '0');
  const d = String(sast.getUTCDate()).padStart(2, '0');
  return { hour: sast.getUTCHours(), ymd: `${y}-${m}-${d}`, year: y, ym: `${y}-${m}` };
}

function dayDistance(monthDay: { m: number; d: number }, today: { m: number; d: number }, year: number): number {
  const a = new Date(Date.UTC(year, monthDay.m - 1, monthDay.d));
  const b = new Date(Date.UTC(year, today.m - 1, today.d));
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Settings
    const { data: settings } = await admin.from('integration_settings')
      .select('auto_send_enabled, auto_send_birthdays_enabled, auto_send_appreciation_enabled, auto_send_daily_cap, auto_send_quiet_start_hour, auto_send_quiet_end_hour, maytapi_phone_allowlist')
      .eq('user_id', user.id).maybeSingle();

    const masterOn = !!settings?.auto_send_enabled;
    const birthdayOn = !!settings?.auto_send_birthdays_enabled;
    const apprOn = !!settings?.auto_send_appreciation_enabled;
    const dailyCap = settings?.auto_send_daily_cap ?? 10;
    const qStart = settings?.auto_send_quiet_start_hour ?? 8;
    const qEnd = settings?.auto_send_quiet_end_hour ?? 19;
    const allowlist: string[] = Array.isArray(settings?.maytapi_phone_allowlist) ? settings!.maytapi_phone_allowlist : [];

    const { hour: sastHour, ymd, year, ym } = sastNow();
    const inQuietHours = !(sastHour >= qStart && sastHour < qEnd);

    // 2. Pull contacts (for joins)
    const { data: contacts } = await admin.from('contacts')
      .select('id, full_name, phone_normalized, aplgo_id, lead_type, registration_status, communication_status, auto_send_opt_out')
      .eq('user_id', user.id);
    const contactMap = new Map((contacts || []).map((c: any) => [c.id, c]));

    // 3. Today's shadow rows count (for daily cap)
    const startOfDayUtc = new Date(`${ymd}T00:00:00.000Z`).toISOString();
    const { data: todayRows } = await admin.from('auto_send_shadow_log')
      .select('id, contact_id, eligibility, would_send_at')
      .eq('user_id', user.id)
      .gte('would_send_at', startOfDayUtc);
    const eligibleTodayCount = (todayRows || []).filter((r: any) => r.eligibility === 'eligible').length;

    const last24hByContact = new Set<string>();
    const cutoff24h = Date.now() - 24 * 3600 * 1000;
    (todayRows || []).forEach((r: any) => {
      if (r.eligibility === 'eligible' && r.contact_id && new Date(r.would_send_at).getTime() >= cutoff24h) {
        last24hByContact.add(r.contact_id);
      }
    });

    const shadowRows: any[] = [];
    let runningEligible = eligibleTodayCount;

    function evaluateGates(c: any, lane: 'birthday' | 'appreciation', alreadyDone: boolean) {
      if (!masterOn) return 'master_off';
      if (lane === 'birthday' && !birthdayOn) return 'lane_off';
      if (lane === 'appreciation' && !apprOn) return 'lane_off';
      if (!c) return 'unmatched_contact';
      if (c.auto_send_opt_out) return 'opted_out';
      if ((c.communication_status || '') === 'Unsubscribed') return 'opted_out';
      const phone = (c.phone_normalized || '').replace(/\D/g, '');
      if (!phone || phone.length < 9) return 'no_phone';
      const cleared = allowlist.includes(phone) || isVerifiedDownline(c);
      if (!cleared) return 'not_verified_downline_or_allowlisted';
      if (alreadyDone) return 'already_done';
      if (last24hByContact.has(c.id)) return 'per_contact_24h';
      if (inQuietHours) return 'quiet_hours';
      if (runningEligible >= dailyCap) return 'daily_cap_reached';
      return '';
    }

    // ─── Lane A: Birthdays ────────────────────────────────────────────
    const today = { m: parseInt(ymd.slice(5, 7), 10), d: parseInt(ymd.slice(8, 10), 10) };
    const { data: bdays } = await admin.from('contact_birthdays')
      .select('id, contact_id, full_name, birth_date, message_style, status, cycle_year, congratulated_at')
      .eq('user_id', user.id)
      .eq('cycle_year', year);

    for (const b of (bdays || [])) {
      if (!b.birth_date) continue;
      const bm = parseInt((b.birth_date as string).slice(5, 7), 10);
      const bd = parseInt((b.birth_date as string).slice(8, 10), 10);
      const dist = dayDistance({ m: bm, d: bd }, today, year);
      if (dist < -7 || dist > 7) continue;

      const c = b.contact_id ? contactMap.get(b.contact_id) : null;
      const dedupe = `auto:birthday:${b.contact_id || b.id}:${year}`;
      const alreadyDone = b.status === 'congratulated' || !!b.congratulated_at;
      const reason = evaluateGates(c, 'birthday', alreadyDone);
      const eligibility = reason ? 'blocked' : 'eligible';
      if (eligibility === 'eligible') runningEligible++;

      shadowRows.push({
        user_id: user.id,
        lane: 'birthday',
        contact_id: b.contact_id || null,
        contact_name: b.full_name || (c?.full_name ?? ''),
        entry_key: '',
        cycle_key: String(year),
        dedupe_key: dedupe,
        eligibility,
        block_reason: reason,
        message_style: b.message_style || 'warm',
        gates: { dist_days: dist, sast_hour: sastHour, in_quiet_hours: inQuietHours, daily_cap: dailyCap },
      });
    }

    // ─── Lane B: Appreciation (entry-scoped, current month) ──────────
    const monthStart = `${ym}-01`;
    const { data: orders } = await admin.from('orders')
      .select('id, contact_id, contact_name, product, amount, dedupe_key, order_date')
      .eq('user_id', user.id)
      .eq('purchase_type', 'Activity')
      .gte('order_date', monthStart);

    let doneEntryKeys = new Set<string>();
    if ((orders || []).length > 0) {
      const { data: doneActs } = await admin.from('contact_activities')
        .select('summary, notes')
        .eq('user_id', user.id)
        .ilike('summary', '%[monthly_activity_appreciation_entry:%');
      for (const a of (doneActs || [])) {
        const hay = `${a.notes || ''}\n${a.summary || ''}`;
        const m = hay.match(/\[monthly_activity_appreciation_entry:([^\]]+)\]/i);
        if (m) doneEntryKeys.add(m[1].trim());
      }
    }

    for (const o of (orders || [])) {
      const entryKey = o.id ? `oid:${o.id}` : (o.dedupe_key ? `dk:${o.dedupe_key}` : '');
      if (!entryKey) continue;
      const c = o.contact_id ? contactMap.get(o.contact_id) : null;
      const dedupe = `auto:appreciation:${entryKey}:${ym}`;
      const alreadyDone = doneEntryKeys.has(entryKey);
      const reason = evaluateGates(c, 'appreciation', alreadyDone);
      const eligibility = reason ? 'blocked' : 'eligible';
      if (eligibility === 'eligible') runningEligible++;

      shadowRows.push({
        user_id: user.id,
        lane: 'appreciation',
        contact_id: o.contact_id || null,
        contact_name: o.contact_name || (c?.full_name ?? ''),
        entry_key: entryKey,
        cycle_key: ym,
        dedupe_key: dedupe,
        eligibility,
        block_reason: reason,
        message_style: '',
        gates: { sast_hour: sastHour, in_quiet_hours: inQuietHours, daily_cap: dailyCap, product: o.product, amount: o.amount },
      });
    }

    // 4. Insert with on-conflict do-nothing (idempotent on dedupe_key per lane).
    let inserted = 0;
    for (const row of shadowRows) {
      const { error, count } = await admin.from('auto_send_shadow_log')
        .upsert(row, { onConflict: 'user_id,lane,dedupe_key', ignoreDuplicates: true, count: 'exact' });
      if (!error && (count ?? 0) > 0) inserted++;
    }

    return new Response(JSON.stringify({
      ok: true,
      shadow_mode: true,
      no_sends_called: true,
      master_on: masterOn,
      birthday_on: birthdayOn,
      appreciation_on: apprOn,
      sast_hour: sastHour,
      in_quiet_hours: inQuietHours,
      daily_cap: dailyCap,
      eligible_today_before: eligibleTodayCount,
      candidates_evaluated: shadowRows.length,
      shadow_rows_inserted: inserted,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
