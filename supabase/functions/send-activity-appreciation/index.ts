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
//   - Shared-phone guard: if the phone number on file for a contact also belongs to a
//     DIFFERENT identity (different aplgo_id/name — e.g. a downline registered using
//     someone else's phone), the send is skipped and flagged rather than risking a
//     message reaching the wrong person under the wrong name.
//   - Daily cap defaults to 20/day (the standing 1-on-1 pacing rule), reading
//     integration_settings.auto_send_daily_cap if set.
//   - Quiet hours reuse auto_send_quiet_start_hour / auto_send_quiet_end_hour.
//   - Opted-out (auto_send_opt_out) / Unsubscribed / no-phone contacts are skipped, not queued.
//   - dry_run=true returns the exact candidate list + fully rendered messages without
//     sending anything or writing any marker — this is the "show me an example before I
//     approve" preview step.
//
// USAGE
// -----------------
//   POST body: { month?: "2026-07" (defaults to current SAST month),
//                months?: ["2026-07", "2026-08"] (use instead of "month" when a single
//                  paste covers more than one month — each month is still tracked and
//                  marked independently, this just avoids two separate calls),
//                dry_run?: boolean (default false),
//                limit?: number (optional extra cap on top of the daily cap) }
//
//   Typical flow: call with dry_run:true first, review the "attempts" preview list
//   (check especially for "phone_shared_with_another_identity" skips — those need a
//   human decision, not an automatic send), then call again with dry_run:false to
//   actually send.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// maytapi-send-1to1 hard-enforces this exact format on every message it sends
// (see verifyFirstTouchFormat in that function) — these are not configurable per-call.
const MAYTAPI_BRANDED_URL = 'https://crm.onlinecourseformlm.com/aplgo.html';
const MAYTAPI_REQUIRED_SENDER_EMAIL = 'vanto@onlinecourseformlm.com';

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
    // Accepts either a single month ("month": "2026-07") or multiple in one call
    // ("months": ["2026-07", "2026-08"]) — for when a paste covers more than one
    // month at once. Each month is still processed and marked independently;
    // this just avoids needing two separate calls for one paste.
    const monthKeys: string[] = Array.isArray(reqBody.months) && reqBody.months.length > 0
      ? reqBody.months.map((m: string) => monthKeyOf(m))
      : [monthKeyOf(reqBody.month)];
    const dryRun = !!reqBody.dry_run;
    const requestedLimit = typeof reqBody.limit === 'number' ? reqBody.limit : null;

    // ── Settings / caps / quiet hours (shared across all requested months) ──
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
    // Shared across all months in this call — the cap is a daily pacing limit, not a per-month one.
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

    // ── Already-sent entry keys — global, not month-scoped, since entry keys are order-id-based
    //    (a single fetch covers dedupe for every month requested in this call) ──
    const { data: doneActs, error: doneActsErr } = await admin.from('contact_activities')
      .select('summary')
      .eq('user_id', user.id)
      .ilike('summary', `%[monthly_activity_appreciation_entry:%`);
    if (doneActsErr) return json({ ok: false, error: 'dedupe_lookup_failed', details: doneActsErr.message });
    const doneKeys = new Set<string>();
    for (const a of (doneActs || [])) {
      const m = (a.summary || '').match(/\[monthly_activity_appreciation_entry:([^\]]+)\]/i);
      if (m) doneKeys.add(m[1].trim());
    }

    const attempts: any[] = [];
    const perMonth: any[] = [];
    let totalCandidates = 0, sent = 0, skipped = 0;

    for (const monthKey of monthKeys) {
      const { start, end, label } = monthBounds(monthKey);

      // ── Candidates for this month: source-agnostic — Smart Paste, Monthly Activity Paste,
      //    or manual entry all qualify, as long as purchase_type='Activity' ──
      const { data: orders, error: ordersErr } = await admin.from('orders')
        .select('id, contact_id, contact_name, product, amount, order_date, source')
        .eq('user_id', user.id)
        .eq('purchase_type', 'Activity')
        .gte('order_date', start)
        .lt('order_date', end)
        .order('order_date', { ascending: true });

      if (ordersErr) return json({ ok: false, error: 'orders_fetch_failed', month: monthKey, details: ordersErr.message });

      if (!orders || orders.length === 0) {
        perMonth.push({ month: monthKey, month_label: label, candidates: 0, sent: 0, skipped: 0 });
        continue;
      }
      totalCandidates += orders.length;

      // ── Contacts map for this month's candidates (chunked + error-checked: a silently-swallowed
      //     error here previously made every non-deduped order look like "contact_not_found") ──
      const contactIds = [...new Set(orders.map((o: any) => o.contact_id).filter(Boolean))];
      const cmap = new Map<string, any>();
      const contactFetchErrors: string[] = [];
      const CHUNK = 50;
      for (let i = 0; i < contactIds.length; i += CHUNK) {
        const chunk = contactIds.slice(i, i + CHUNK);
        const { data: contactsChunk, error: contactsErr } = await admin.from('contacts')
          .select('id, full_name, phone_normalized, communication_status, auto_send_opt_out, aplgo_id')
          .in('id', chunk);
        if (contactsErr) {
          contactFetchErrors.push(contactsErr.message);
          continue;
        }
        for (const c of (contactsChunk || [])) cmap.set(c.id, c);
      }
      if (contactFetchErrors.length > 0) {
        return json({ ok: false, error: 'contacts_fetch_failed', month: monthKey, details: contactFetchErrors });
      }

      // ── Shared-phone guard ──
      // People sometimes register a downline using their own phone (or someone else's) —
      // the number on file then belongs to more than one distinct identity (different
      // aplgo_id / different name). Sending under one contact's name to a phone that's
      // actually someone else's device is worse than leaving them Pending, so any phone
      // shared across contacts with a *different* aplgo_id is flagged and skipped rather
      // than sent to automatically. This checks against the full contacts table, not just
      // this month's candidates, since the collision may involve a contact outside this batch.
      const candidatePhones = [...new Set(
        Array.from(cmap.values()).map((c: any) => (c.phone_normalized || '').trim()).filter(Boolean)
      )];
      const phoneOwners = new Map<string, Set<string>>(); // phone -> set of "name (aplgo_id)"
      if (candidatePhones.length > 0) {
        for (let i = 0; i < candidatePhones.length; i += 50) {
          const chunk = candidatePhones.slice(i, i + 50);
          const { data: overlap } = await admin.from('contacts')
            .select('phone_normalized, full_name, aplgo_id')
            .in('phone_normalized', chunk);
          for (const row of (overlap || [])) {
            const key = row.phone_normalized;
            const identity = `${row.full_name || 'unknown'} (${row.aplgo_id || 'no-id'})`;
            if (!phoneOwners.has(key)) phoneOwners.set(key, new Set());
            phoneOwners.get(key)!.add(identity);
          }
        }
      }
      function phoneCollision(c: any): string | null {
        const owners = phoneOwners.get((c.phone_normalized || '').trim());
        if (!owners || owners.size <= 1) return null;
        const distinctIds = new Set([...owners].map((o) => o.split('(').pop()));
        if (distinctIds.size <= 1) return null; // same person, duplicate row — not a collision
        return [...owners].join(' / ');
      }

      let monthSent = 0, monthSkipped = 0;

      for (const o of orders) {
        const entryKey = `oid:${o.id}`;

        if (doneKeys.has(entryKey)) {
          attempts.push({ month: monthKey, order_id: o.id, contact_id: o.contact_id, contact_name: o.contact_name, skipped: 'already_sent' });
          skipped++; monthSkipped++;
          continue;
        }
        if (!o.contact_id) {
          attempts.push({ month: monthKey, order_id: o.id, contact_name: o.contact_name, skipped: 'no_contact_matched' });
          skipped++; monthSkipped++;
          continue;
        }

        const c = cmap.get(o.contact_id);
        if (!c) {
          attempts.push({ month: monthKey, order_id: o.id, contact_id: o.contact_id, skipped: 'contact_not_found' });
          skipped++; monthSkipped++;
          continue;
        }
        if (c.auto_send_opt_out || c.communication_status === 'Unsubscribed') {
          attempts.push({ month: monthKey, order_id: o.id, contact_id: o.contact_id, skipped: 'opted_out' });
          skipped++; monthSkipped++;
          continue;
        }
        const phoneDigits = (c.phone_normalized || '').replace(/\D/g, '');
        if (!phoneDigits || phoneDigits.length < 9) {
          attempts.push({ month: monthKey, order_id: o.id, contact_id: o.contact_id, skipped: 'no_phone' });
          skipped++; monthSkipped++;
          continue;
        }
        const collision = phoneCollision(c);
        if (collision) {
          attempts.push({ month: monthKey, order_id: o.id, contact_id: o.contact_id, contact_name: c.full_name, skipped: 'phone_shared_with_another_identity', shared_with: collision });
          skipped++; monthSkipped++;
          continue;
        }

        const firstName = (c.full_name || o.contact_name || '').split(' ')[0] || 'there';
        const bodyText = renderTemplate(template.body, {
          firstName,
          month: label,
          amount: Number(o.amount || 0).toLocaleString(),
          senderName,
        });
        // maytapi-send-1to1 hard-requires this exact format (verifyFirstTouchFormat):
        // first line = the branded URL exactly, plus a signature containing "— Vanto"
        // and "vanto@onlinecourseformlm.com". The message_templates library entry stays
        // clean and human-editable; this wrapper is applied only at send time so what's
        // shown in dry_run preview is exactly what will actually go out.
        const message = `${MAYTAPI_BRANDED_URL}\n\n${bodyText}\n\n— Vanto\n${MAYTAPI_REQUIRED_SENDER_EMAIL}`;

        if (dryRun) {
          attempts.push({
            month: monthKey, order_id: o.id, contact_id: o.contact_id, contact_name: c.full_name,
            entry_key: entryKey, amount: o.amount, source: o.source,
            preview: message, would_send: true,
            note: 'This will send as a media message (branded APLGO image) via maytapi-send-1to1, not plain text — that function enforces this format for every send.',
          });
          continue;
        }

        if (sent >= remaining) {
          attempts.push({ month: monthKey, order_id: o.id, contact_id: o.contact_id, skipped: 'daily_cap_reached' });
          skipped++; monthSkipped++;
          continue;
        }

        const result = await sendOne(admin, authHeader, user.id, o.contact_id, message, `appr:${entryKey}:${monthKey}`);
        attempts.push({ month: monthKey, order_id: o.id, contact_id: o.contact_id, contact_name: c.full_name, entry_key: entryKey, ...result });

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
          sent++; monthSent++;
          doneKeys.add(entryKey);
        }
      }

      perMonth.push({ month: monthKey, month_label: label, candidates: orders.length, sent: monthSent, skipped: monthSkipped });
    }

    return json({
      ok: true,
      months: monthKeys,
      dry_run: dryRun,
      template_used: template.template_name,
      candidates: totalCandidates,
      sent,
      skipped,
      daily_cap: dailyCap,
      sent_today_before_this_run: sentToday,
      per_month: perMonth,
      attempts,
    });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── Single-row send via the locked maytapi-send-1to1 function ──
// IMPORTANT: maytapi-send-1to1 validates a real user session via auth.getUser(token),
// then checks that user has the 'admin' role in user_roles. It does NOT accept the
// service-role key as a bearer token — passing that causes an "Invalid JWT" rejection
// (this was caught and fixed after the first live send attempt failed exactly this way).
// The caller's own Authorization header must be forwarded through.
async function sendOne(
  admin: ReturnType<typeof createClient>,
  callerAuthHeader: string,
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
        Authorization: callerAuthHeader,
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
