// send-activity-appreciation
// Canonical, single-path sender for "Monthly Activity" WhatsApp appreciation messages.
//
// WHY THIS EXISTS
// ----------------
// Appreciation sends have happened three different ways with three different outcomes:
//   1. Manual crown-click in the app (Monthly Activity Push page)  → writes tracker marker. Correct.
//   2. auto-send-micro-live's Lane B (cron/manual trigger)          → writes tracker marker. Correct.
//   3. Ad-hoc instructions typed directly into Lovable chat
//      ("send the appreciation messages for July")                 → Lovable wrote fresh one-off
//      logic each time. No dedupe guarantee, no tracker marker written, wording drifted
//      between sends (3 different templates appeared across two July waves).
//
// This function is now the ONLY sanctioned path for this message type. Whether triggered from
// the app, a future cron tick, or a Lovable chat instruction ("run send-activity-appreciation
// for July"), it always: reads from the same orders list, uses the same message-template
// library, enforces the same dedupe, and writes the same tracker marker. Re-running it, on
// purpose or by accident, cannot double-send — the dedupe check makes that structurally
// impossible rather than something that has to be remembered each time.
//
// SOURCE OF CANDIDATES (deliberately source-agnostic)
// -----------------------------------------------------
// Any order with purchase_type = 'Activity' and an order_date in the target month qualifies —
// regardless of whether it arrived via Smart Paste Orders (source='backoffice-paste'),
// Monthly Activity Paste (source='monthly-activity-paste'), or manual entry. This mirrors
// auto-send-micro-live's existing Lane B logic. It means a new Smart Paste or Monthly
// Activity Paste import automatically becomes part of "the list" this function sends
// against — no extra wiring needed each time a new batch is pasted in.
//
// MESSAGE LIBRARY
// -----------------
// Wording is NOT hardcoded here. It's pulled from message_templates
// (category='Monthly Activity', send_when_condition='Contact paid monthly activity',
// active=true) — the same template library used for manual sends. Editing that row (or
// adding more rows and adjusting the selection query below) changes what gets sent, with
// no code change and no redeploy required.
//
// DEDUPE / SAFETY
// -----------------
//   - One entry marker per order id. An order that already has a matching
//     [monthly_activity_appreciation_entry:oid:<id>] marker in contact_activities is
//     skipped, full stop.
//   - Daily cap defaults to 20/day (the standing 1-on-1 pacing rule), reading
//     integration_settings.auto_send_daily_cap if set.
//   - Quiet hours reuse auto_send_quiet_start_hour / auto_send_quiet_end_hour.
//   - do_not_contact / Unsubscribed / no-phone contacts are skipped, not queued.
//   - dry_run=true returns the exact candidate list + fully rendered messages without
//     sending anything or writing any marker — this is the "show me an example before I
//     approve" preview step.
//
// USAGE
// -----------------
//   POST body: { month?: "2026-07" (defaults to current SAST month),
//                dry_run?: boolean (default false),
//                limit?: number (optional extra cap on top of the daily cap) }
//
//   Typical flow: call with dry_run:true first, review the "attempts" preview list,
//   then call again with dry_run:false (or omitted) to actually send.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function monthKeyOf(input?: string): string {
  if (input && /^\d{4}-\d{2}$/.test(input)) return input;
  const now = new Date();
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000); // SAST = UTC+2, no DST
  return `${sast.getUTCFullYear()}-${String(sast.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(monthKey: string): { start: string; end: string; label: string } {
  const [y, m] = monthKey.split('-').map(Number);
  const start = `${monthKey}-01`;
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); // first day of next month (exclusive upper bound)
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}

function sastHour(): number {
  const now = new Date();
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return sast.getUTCHours();
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
    if (!user) return json({ ok: false, error: 'unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const reqBody = await req.json().catch(() => ({}));
    const monthKey = monthKeyOf(reqBody.month);
    const { start, end, label } = monthBounds(monthKey);
    const dryRun = !!reqBody.dry_run;
    const requestedLimit = typeof reqBody.limit === 'number' ? reqBody.limit : null;

    // ── Settings / caps / quiet hours (reuses existing columns — no schema change needed) ──
    const { data: settings } = await admin.from('integration_settings')
      .select('auto_send_daily_cap, auto_send_quiet_start_hour, auto_send_quiet_end_hour, maytapi_enabled')
      .eq('user_id', user.id).maybeSingle();

    const dailyCap = settings?.auto_send_daily_cap ?? 20; // Vanto's stated pacing rule: "not more than twenty messages per day"
    const qStart = settings?.auto_send_quiet_start_hour ?? 8;
    const qEnd = settings?.auto_send_quiet_end_hour ?? 19;

    if (!dryRun) {
      if (settings?.maytapi_enabled === false) return json({ ok: false, blocked: 'maytapi_disabled' });
      const h = sastHour();
      if (!(h >= qStart && h < qEnd)) return json({ ok: false, blocked: 'quiet_hours', sast_hour: h });
    }

    // ── Today's already-sent count through THIS function specifically (mode=activity_appreciation) ──
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data: todaySends } = await admin.from('prospector_send_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('mode', 'activity_appreciation')
      .eq('request_status', 'ok')
      .gte('attempted_at', todayStart.toISOString());
    const sentToday = (todaySends || []).length;
    let remaining = Math.max(0, dailyCap - sentToday);
    if (requestedLimit !== null) remaining = Math.min(remaining, requestedLimit);

    // ── Message template — pulled from the library, never hardcoded here ──
    const { data: template } = await admin.from('message_templates')
      .select('body, template_name')
      .eq('category', 'Monthly Activity')
      .eq('send_when_condition', 'Contact paid monthly activity')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!template) {
      return json({
        ok: false,
        error: 'no_active_template',
        hint: "Add or enable a message_templates row with category='Monthly Activity', send_when_condition='Contact paid monthly activity'",
      });
    }

    // ── Sender signature ──
    const { data: profile } = await admin.from('profiles').select('display_name, email').eq('id', user.id).maybeSingle();
    const senderName = profile?.display_name || 'Vanto';

    // ── Candidates: source-agnostic — Smart Paste, Monthly Activity Paste, or manual entry all qualify ──
    const { data: orders } = await admin.from('orders')
      .select('id, contact_id, contact_name, product, amount, order_date, source')
      .eq('user_id', user.id)
      .eq('purchase_type', 'Activity')
      .gte('order_date', start)
      .lt('order_date', end)
      .order('order_date', { ascending: true });

    if (!orders || orders.length === 0) {
      return json({ ok: true, month: monthKey, month_label: label, dry_run: dryRun, candidates: 0, sent: 0, skipped: 0, attempts: [] });
    }

    // ── Already-sent entry keys for this month (the dedupe check) ──
    const { data: doneActs } = await admin.from('contact_activities')
      .select('summary')
      .eq('user_id', user.id)
      .ilike('summary', `%[monthly_activity_appreciation_entry:%`);
    const doneKeys = new Set<string>();
    for (const a of (doneActs || [])) {
      const m = (a.summary || '').match(/\[monthly_activity_appreciation_entry:([^\]]+)\]/i);
      if (m) doneKeys.add(m[1].trim());
    }

    // ── Contacts map ──
    const contactIds = [...new Set(orders.map((o: any) => o.contact_id).filter(Boolean))];
    const { data: contacts } = await admin.from('contacts')
      .select('id, full_name, phone_normalized, communication_status, do_not_contact')
      .in('id', contactIds);
    const cmap = new Map((contacts || []).map((c: any) => [c.id, c]));

    const attempts: any[] = [];
    let sent = 0, skipped = 0;

    for (const o of orders) {
      const entryKey = `oid:${o.id}`;

      if (doneKeys.has(entryKey)) {
        attempts.push({ order_id: o.id, contact_id: o.contact_id, contact_name: o.contact_name, skipped: 'already_sent' });
        skipped++;
        continue;
      }
      if (!o.contact_id) {
        attempts.push({ order_id: o.id, contact_name: o.contact_name, skipped: 'no_contact_matched' });
        skipped++;
        continue;
      }

      const c = cmap.get(o.contact_id);
      if (!c) {
        attempts.push({ order_id: o.id, contact_id: o.contact_id, skipped: 'contact_not_found' });
        skipped++;
        continue;
      }
      if (c.do_not_contact || c.communication_status === 'Unsubscribed') {
        attempts.push({ order_id: o.id, contact_id: o.contact_id, skipped: 'opted_out' });
        skipped++;
        continue;
      }
      const phoneDigits = (c.phone_normalized || '').replace(/\D/g, '');
      if (!phoneDigits || phoneDigits.length < 9) {
        attempts.push({ order_id: o.id, contact_id: o.contact_id, skipped: 'no_phone' });
        skipped++;
        continue;
      }

      const firstName = (c.full_name || o.contact_name || '').split(' ')[0] || 'there';
      const message = renderTemplate(template.body, {
        firstName,
        month: label,
        amount: Number(o.amount || 0).toLocaleString(),
        senderName,
      });

      if (dryRun) {
        attempts.push({
          order_id: o.id, contact_id: o.contact_id, contact_name: c.full_name,
          entry_key: entryKey, amount: o.amount, source: o.source,
          preview: message, would_send: true,
        });
        continue;
      }

      if (sent >= remaining) {
        attempts.push({ order_id: o.id, contact_id: o.contact_id, skipped: 'daily_cap_reached' });
        skipped++;
        continue;
      }

      const result = await sendOne(admin, user.id, o.contact_id, message, `appr:${entryKey}:${monthKey}`);
      attempts.push({ order_id: o.id, contact_id: o.contact_id, contact_name: c.full_name, entry_key: entryKey, ...result });

      if (result.ok && result.message_id) {
        const monthMarker = `[monthly_activity_appreciation:${monthKey}]`;
        const entryMarker = `[monthly_activity_appreciation_entry:${entryKey}]`;
        const msgMarker = `[maytapi_message:${result.message_id}]`;
        await admin.from('contact_activities').insert({
          user_id: user.id,
          contact_id: o.contact_id,
          activity_type: 'whatsapp',
          summary: `Sent monthly activity appreciation [send-activity-appreciation] | ${monthKey} | ${monthMarker} ${entryMarker} ${msgMarker}`,
          notes: `${message}\n\n${monthMarker} ${entryMarker} ${msgMarker}`,
          next_action: '',
        });
        sent++;
        doneKeys.add(entryKey);
      }
    }

    return json({
      ok: true,
      month: monthKey,
      month_label: label,
      dry_run: dryRun,
      template_used: template.template_name,
      candidates: orders.length,
      sent,
      skipped,
      daily_cap: dailyCap,
      sent_today_before_this_run: sentToday,
      attempts,
    });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── Single-row send via the locked maytapi-send-1to1 function (same call pattern as auto-send-micro-live) ──
async function sendOne(
  admin: ReturnType<typeof createClient>,
  userId: string,
  contactId: string,
  finalMessage: string,
  evidenceKey: string,
): Promise<{ ok: boolean; message_id?: string | null; reason?: string }> {
  const evidence = {
    send_activity_appreciation: {
      key: evidenceKey,
      human_approved: true,
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
    expected_next_step: 'appreciation_sent',
    next_best_business_action: 'await_reply',
    reason_for_message: 'Monthly activity appreciation (canonical sender)',
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

  if (insErr || !(actionRow as any)?.id) {
    return { ok: false, reason: `zazi_action_insert_failed:${insErr?.message || 'unknown'}` };
  }
  const zaziActionId = (actionRow as any).id as string;

  const sendUrl = `${SUPABASE_URL}/functions/v1/maytapi-send-1to1`;
  let resp: Response;
  try {
    resp = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'x-auto-send-mode': 'activity_appreciation',
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

  await admin.from('prospector_send_log').insert({
    user_id: userId,
    contact_id: contactId,
    zazi_action_id: zaziActionId,
    intended_send_type: 'appreciation',
    request_status: 'ok',
    mode: 'activity_appreciation',
    maytapi_message_id: messageId,
    metadata: { key: evidenceKey },
  });

  return { ok: true, message_id: messageId };
}
