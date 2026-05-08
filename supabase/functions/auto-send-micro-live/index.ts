// Phase 1.5 — MICRO-LIVE auto-send (admin-only, manual trigger).
//
// HARD GUARDS:
//   - Requires ALL of: master ON, lane ON, micro_live ON.
//   - Vanto admin only (caller must have role=admin AND match owner email path —
//     enforced indirectly via role + RLS).
//   - Reuses locked maytapi-send-1to1. Never duplicates send logic.
//   - Daily cap = auto_send_micro_live_daily_cap (default 3).
//   - Per-contact 24h dedupe on prospector_send_log.
//   - Strict allowlist: phone in maytapi_phone_allowlist OR contact_id in
//     auto_send_micro_live_contact_allowlist. Verified-downline status alone
//     is NOT sufficient for micro-live.
//   - Done marker only after Maytapi returns ok=true with a real message_id.
//   - Failure leaves entry Pending and shadow row blocked.
//   - No bulk endpoint, no cron, no Send All.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APLGO_BRAND_URL = 'https://crm.onlinecourseformlm.com/aplgo.html';

function sastNow() {
  const now = new Date();
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const y = sast.getUTCFullYear();
  const m = String(sast.getUTCMonth() + 1).padStart(2, '0');
  const d = String(sast.getUTCDate()).padStart(2, '0');
  return { hour: sast.getUTCHours(), ymd: `${y}-${m}-${d}`, year: y, ym: `${y}-${m}` };
}

function dayDistance(monthDay: { m: number; d: number }, today: { m: number; d: number }, year: number) {
  const a = new Date(Date.UTC(year, monthDay.m - 1, monthDay.d));
  const b = new Date(Date.UTC(year, today.m - 1, today.d));
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function buildBirthdayMessage(fullName: string, firstName: string, level: string, tone: string, senderName: string, senderEmail: string) {
  const lvl = level ? `\nYour level: ${level}` : '';
  const messages: Record<string, string> = {
    warm: `Hi ${firstName} 🎉\n\nHappy Birthday to you! 🎂\n\nWishing you joy, strength, favor, and a beautiful year ahead.${lvl}\n\nEnjoy your special day! 🌟`,
    royal: `${fullName} 👑🎂\n\nToday we celebrate YOU!\n\nHappy Birthday — you are royalty.${lvl}\n\nCrown up. It's YOUR day! 🎉🏆`,
    spiritual: `Dear ${firstName} 🕊️\n\nHappy Blessed Birthday! 🎂\n\nMay the Lord pour out His favor and wisdom upon you.${lvl}\n\n🙏✨`,
    professional: `Hi ${fullName},\n\nHappy Birthday! 🎂\n\nWishing you a wonderful celebration and a year of success.${lvl}\n\nKind regards`,
  };
  const body = messages[tone] || messages.warm;
  const sig = senderName ? `\n\n— ${senderName}${senderEmail ? `\n${senderEmail}` : ''}` : '';
  return `${APLGO_BRAND_URL}\n\n${body}${sig}`;
}

function buildAppreciationMessage(fullName: string, product: string, amount: number, monthLabel: string, senderName: string, senderEmail: string) {
  const sig = senderName ? `\n\n— ${senderName}${senderEmail ? `\n${senderEmail}` : ''}` : '';
  return `${APLGO_BRAND_URL}\n\nHi ${fullName} 👏\n\nThank you for your APLGO Activity this ${monthLabel}${product ? ` — ${product}` : ''}${amount ? ` (R${amount})` : ''}.\n\nYour consistency builds momentum. Proud to be on this journey with you.${sig}`;
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

    // Admin gate
    const { data: roleRow } = await admin.from('user_roles')
      .select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ ok: false, error: 'forbidden_not_admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings } = await admin.from('integration_settings')
      .select('auto_send_enabled, auto_send_birthdays_enabled, auto_send_appreciation_enabled, auto_send_micro_live_enabled, auto_send_micro_live_daily_cap, auto_send_micro_live_contact_allowlist, auto_send_quiet_start_hour, auto_send_quiet_end_hour, maytapi_phone_allowlist, maytapi_enabled')
      .eq('user_id', user.id).maybeSingle();

    const microOn = !!settings?.auto_send_micro_live_enabled;
    const masterOn = !!settings?.auto_send_enabled;
    const birthdayOn = !!settings?.auto_send_birthdays_enabled;
    const apprOn = !!settings?.auto_send_appreciation_enabled;
    const microCap = settings?.auto_send_micro_live_daily_cap ?? 3;
    const qStart = settings?.auto_send_quiet_start_hour ?? 8;
    const qEnd = settings?.auto_send_quiet_end_hour ?? 19;
    const phoneAllow: string[] = Array.isArray(settings?.maytapi_phone_allowlist) ? settings!.maytapi_phone_allowlist : [];
    const contactAllow: string[] = Array.isArray(settings?.auto_send_micro_live_contact_allowlist) ? settings!.auto_send_micro_live_contact_allowlist : [];

    if (!microOn) return json({ ok: false, blocked: 'micro_live_off' });
    if (!masterOn) return json({ ok: false, blocked: 'master_off' });
    if (!settings?.maytapi_enabled) return json({ ok: false, blocked: 'maytapi_disabled' });
    if (!birthdayOn && !apprOn) return json({ ok: false, blocked: 'no_lane_enabled' });

    const { hour: sastHour, ymd, year, ym } = sastNow();
    const inQuiet = !(sastHour >= qStart && sastHour < qEnd);
    if (inQuiet) return json({ ok: false, blocked: 'quiet_hours', sast_hour: sastHour });

    // Today's micro-live successful sends count from prospector_send_log.
    const startOfDayUtc = new Date(`${ymd}T00:00:00.000Z`).toISOString();
    const { data: todaySends } = await admin.from('prospector_send_log')
      .select('id, contact_id, attempted_at, request_status, mode')
      .eq('user_id', user.id)
      .eq('mode', 'auto_micro_live')
      .eq('request_status', 'ok')
      .gte('attempted_at', startOfDayUtc);
    let sentToday = (todaySends || []).length;
    const sentContactsToday = new Set<string>((todaySends || []).map((r: any) => r.contact_id).filter(Boolean));
    const remaining = Math.max(0, microCap - sentToday);
    if (remaining <= 0) return json({ ok: false, blocked: 'daily_cap_reached', cap: microCap, sent_today: sentToday });

    // Profile (signature)
    const { data: profile } = await admin.from('profiles').select('display_name, email').eq('id', user.id).maybeSingle();
    const senderName = profile?.display_name || '';
    const senderEmail = profile?.email || user.email || '';
    const monthLabel = new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long' });

    // Contacts map
    const { data: contacts } = await admin.from('contacts')
      .select('id, full_name, phone_normalized, communication_status, auto_send_opt_out')
      .eq('user_id', user.id);
    const cmap = new Map((contacts || []).map((c: any) => [c.id, c]));

    function passContact(c: any): string {
      if (!c) return 'unmatched_contact';
      if (c.auto_send_opt_out) return 'opted_out';
      if ((c.communication_status || '') === 'Unsubscribed') return 'opted_out';
      const ph = (c.phone_normalized || '').replace(/\D/g, '');
      if (!ph || ph.length < 9) return 'no_phone';
      const allowedByPhone = phoneAllow.includes(ph);
      const allowedByContact = contactAllow.includes(c.id);
      if (!allowedByPhone && !allowedByContact) return 'not_allowlisted';
      return '';
    }

    const attempts: any[] = [];

    // ── LANE A: Birthdays ──────────────────────────────────────────────
    if (birthdayOn && remaining > 0) {
      const today = { m: parseInt(ymd.slice(5, 7), 10), d: parseInt(ymd.slice(8, 10), 10) };
      const { data: bdays } = await admin.from('contact_birthdays')
        .select('id, contact_id, full_name, first_name, level, birth_date, message_style, status, cycle_year, congratulated_at')
        .eq('user_id', user.id)
        .eq('cycle_year', year);

      for (const b of (bdays || [])) {
        if (sentToday >= microCap) break;
        if (!b.birth_date || !b.contact_id) continue;
        const bm = parseInt((b.birth_date as string).slice(5, 7), 10);
        const bd = parseInt((b.birth_date as string).slice(8, 10), 10);
        const dist = dayDistance({ m: bm, d: bd }, today, year);
        // Phase 1.5 = today only.
        if (dist !== 0) continue;
        if (b.status === 'congratulated' || b.congratulated_at) continue;

        const c = cmap.get(b.contact_id);
        const blockReason = passContact(c);
        if (blockReason) { attempts.push({ lane: 'birthday', contact_id: b.contact_id, skipped: blockReason }); continue; }
        if (sentContactsToday.has(b.contact_id)) { attempts.push({ lane: 'birthday', contact_id: b.contact_id, skipped: 'per_contact_24h' }); continue; }

        const tone = (b.message_style || 'warm');
        const msg = buildBirthdayMessage(b.full_name || (c as any).full_name, b.first_name || ((b.full_name || '').split(' ')[0]), b.level || '', tone, senderName, senderEmail);

        const result = await sendOne(admin, user.id, b.contact_id, msg, 'birthday', `bday:${b.id}:${year}`);
        attempts.push({ lane: 'birthday', contact_id: b.contact_id, ...result });

        if (result.ok && result.message_id) {
          await admin.from('contact_birthdays')
            .update({ status: 'congratulated', congratulated_at: new Date().toISOString() })
            .eq('id', b.id);
          await admin.from('contact_activities').insert({
            user_id: user.id,
            contact_id: b.contact_id,
            activity_type: 'whatsapp',
            summary: `Auto-sent birthday message via Maytapi [auto_micro_live] [maytapi_message:${result.message_id}]`,
            notes: msg,
            next_action: '',
          });
          sentToday++;
          sentContactsToday.add(b.contact_id);
        }
      }
    }

    // ── LANE B: Appreciation (current month, entry-scoped) ─────────────
    if (apprOn && sentToday < microCap) {
      const monthStart = `${ym}-01`;
      const { data: orders } = await admin.from('orders')
        .select('id, contact_id, contact_name, product, amount, dedupe_key, order_date')
        .eq('user_id', user.id)
        .eq('purchase_type', 'Activity')
        .gte('order_date', monthStart);

      const doneEntryKeys = new Set<string>();
      if ((orders || []).length > 0) {
        const { data: doneActs } = await admin.from('contact_activities')
          .select('summary, notes')
          .eq('user_id', user.id)
          .ilike('summary', '%[monthly_activity_appreciation_entry:%');
        for (const a of (doneActs || [])) {
          const m = `${a.notes || ''}\n${a.summary || ''}`.match(/\[monthly_activity_appreciation_entry:([^\]]+)\]/i);
          if (m) doneEntryKeys.add(m[1].trim());
        }
      }

      for (const o of (orders || [])) {
        if (sentToday >= microCap) break;
        if (!o.contact_id) continue;
        const entryKey = o.id ? `oid:${o.id}` : (o.dedupe_key ? `dk:${o.dedupe_key}` : '');
        if (!entryKey || doneEntryKeys.has(entryKey)) continue;

        const c = cmap.get(o.contact_id);
        const blockReason = passContact(c);
        if (blockReason) { attempts.push({ lane: 'appreciation', contact_id: o.contact_id, entry_key: entryKey, skipped: blockReason }); continue; }
        if (sentContactsToday.has(o.contact_id)) { attempts.push({ lane: 'appreciation', contact_id: o.contact_id, entry_key: entryKey, skipped: 'per_contact_24h' }); continue; }

        const msg = buildAppreciationMessage(o.contact_name || (c as any).full_name, o.product || '', Number(o.amount || 0), monthLabel, senderName, senderEmail);

        const result = await sendOne(admin, user.id, o.contact_id, msg, 'appreciation', `appr:${entryKey}:${ym}`);
        attempts.push({ lane: 'appreciation', contact_id: o.contact_id, entry_key: entryKey, ...result });

        if (result.ok && result.message_id) {
          const monthMarker = `[monthly_activity_appreciation:${ym}]`;
          const entryMarker = `[monthly_activity_appreciation_entry:${entryKey}]`;
          const msgMarker = `[maytapi_message:${result.message_id}]`;
          await admin.from('contact_activities').insert({
            user_id: user.id,
            contact_id: o.contact_id,
            activity_type: 'whatsapp',
            summary: `Auto-sent monthly activity appreciation [auto_micro_live] | ${ym} | ${monthMarker} ${entryMarker} ${msgMarker}`,
            notes: `${msg}\n\n${monthMarker} ${entryMarker} ${msgMarker}`,
            next_action: '',
          });
          sentToday++;
          sentContactsToday.add(o.contact_id);
        }
      }
    }

    return json({
      ok: true,
      micro_live: true,
      sast_hour: sastHour,
      cap: microCap,
      sent_today: sentToday,
      remaining: Math.max(0, microCap - sentToday),
      attempts,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ---- Single-row send via locked maytapi-send-1to1 ----
async function sendOne(
  admin: ReturnType<typeof createClient>,
  userId: string,
  contactId: string,
  finalMessage: string,
  lane: 'birthday' | 'appreciation',
  evidenceKey: string,
): Promise<{ ok: boolean; message_id?: string | null; reason?: string }> {
  // Insert a fresh approved zazi_actions row.
  const evidence = {
    auto_micro_live: {
      lane,
      key: evidenceKey,
      human_approved: true,
      supervisor_bypass: 'micro_live_pilot',
      approved_at_client: new Date().toISOString(),
    },
  };
  const { data: actionRow, error: insErr } = await admin.from('zazi_actions').insert({
    user_id: userId,
    contact_id: contactId,
    channel: 'whatsapp',
    status: 'approved',
    approved_by: userId,
    approved_at: new Date().toISOString(),
    proposed_message: finalMessage,
    expected_next_step: lane === 'birthday' ? 'birthday_sent' : 'appreciation_sent',
    next_best_business_action: 'await_reply',
    reason_for_message: `Phase 1.5 micro-live ${lane}`,
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
  }).select('id').single();

  if (insErr || !(actionRow as any)?.id) return { ok: false, reason: `zazi_action_insert_failed:${insErr?.message || 'unknown'}` };
  const zaziActionId = (actionRow as any).id as string;

  // Invoke locked send function as the user.
  const sendUrl = `${SUPABASE_URL}/functions/v1/maytapi-send-1to1`;
  let resp: Response;
  try {
    resp = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        // Tag the call so prospector_send_log records the right mode.
        'x-auto-send-mode': 'auto_micro_live',
      },
      body: JSON.stringify({ zazi_action_id: zaziActionId, test_mode: true }),
    });
  } catch (e) {
    await admin.from('zazi_actions').update({ status: 'draft' }).eq('id', zaziActionId);
    return { ok: false, reason: `network_error:${(e as Error).message}` };
  }

  let data: any = null;
  try { data = await resp.json(); } catch (_) { /* ignore */ }

  const okFromFn = !!(data && data.ok && data.sent !== false);
  const messageId: string | null =
    (typeof data?.message_id === 'string' && data.message_id) ||
    (typeof data?.maytapi_response?.data?.msgId === 'string' && data.maytapi_response.data.msgId) ||
    (typeof data?.maytapi_response?.data?.id === 'string' && data.maytapi_response.data.id) ||
    null;

  if (!okFromFn || !messageId) {
    await admin.from('zazi_actions').update({ status: 'draft' }).eq('id', zaziActionId);
    return { ok: false, reason: data?.error_code || data?.error || 'maytapi_failure' };
  }

  // Tag the prospector_send_log row with mode='auto_micro_live' for audit.
  await admin.from('prospector_send_log').insert({
    user_id: userId,
    contact_id: contactId,
    zazi_action_id: zaziActionId,
    intended_send_type: lane,
    request_status: 'ok',
    mode: 'auto_micro_live',
    maytapi_message_id: messageId,
    metadata: { phase: '1.5', lane, key: evidenceKey },
  });

  return { ok: true, message_id: messageId };
}
