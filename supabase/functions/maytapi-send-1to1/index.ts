// Phase E.0 — Maytapi send 1-on-1 (admin-only, single approved row, controlled test)
// Phase E.2 — Adds non-blocking observability into prospector_send_log.
// Phase E.5 — Bounded retry on transient Maytapi failures + safe error classification.
// HARD GUARDS: no batching, no cron, no contact_activities writes outside flag, no contacts.lead_type writes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { hashPhone, hashPayload, contentLength } from '../_shared/redact.ts';

// E.2 helper — fire-and-forget log insert. Must NEVER throw or block the send path.
async function logSendAttempt(
  admin: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await admin.from('prospector_send_log').insert(row);
    if (error) {
      console.warn('[maytapi-send-1to1] prospector_send_log insert failed (non-blocking):', error.message);
    }
  } catch (e) {
    console.warn('[maytapi-send-1to1] prospector_send_log insert threw (non-blocking):', (e as Error).message);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRANDED_URL = 'https://crm.onlinecourseformlm.com/aplgo.html';
const BRANDED_MEDIA_IMAGE = 'https://crm.onlinecourseformlm.com/images/aplgo-og-card.jpg';

// E.5 — retry/backoff policy (server-side only)
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 400, 1200];          // attempt 1 immediate, then ~400ms, ~1200ms
const TOTAL_TIME_BUDGET_MS = 12_000;         // hard wall-clock cap
const PER_ATTEMPT_TIMEOUT_MS = 8_000;        // upper bound per fetch
const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);

type ErrorClass = 'transient' | 'permanent' | 'timeout' | 'network' | 'none';
type SafeErrorCode =
  | 'network_error' | 'timeout' | 'rate_limited'
  | 'maytapi_5xx' | 'maytapi_4xx' | 'maytapi_error' | 'unknown_error';

interface AttemptOutcome {
  ok: boolean;
  status: number | null;
  responseJson: any | null;
  responseText: string;
  networkError: string | null;
  timedOut: boolean;
  errorClass: ErrorClass;
  shouldRetry: boolean;
  safeErrorCode: SafeErrorCode | null;
}

function classifyMaytapiFailure(params: {
  status: number | null;
  networkError: string | null;
  timedOut: boolean;
  responseJson: any | null;
}): { errorClass: ErrorClass; shouldRetry: boolean; safeErrorCode: SafeErrorCode | null } {
  const { status, networkError, timedOut, responseJson } = params;

  if (timedOut) return { errorClass: 'timeout', shouldRetry: true, safeErrorCode: 'timeout' };
  if (networkError) return { errorClass: 'network', shouldRetry: true, safeErrorCode: 'network_error' };

  if (status == null) {
    return { errorClass: 'network', shouldRetry: true, safeErrorCode: 'network_error' };
  }
  if (status === 429) return { errorClass: 'transient', shouldRetry: true, safeErrorCode: 'rate_limited' };
  if (TRANSIENT_HTTP.has(status)) {
    return {
      errorClass: 'transient',
      shouldRetry: true,
      safeErrorCode: status >= 500 ? 'maytapi_5xx' : 'maytapi_error',
    };
  }
  if (status >= 400 && status < 500) {
    return { errorClass: 'permanent', shouldRetry: false, safeErrorCode: 'maytapi_4xx' };
  }
  if (status >= 500) {
    // unexpected 5xx not in transient list — treat as permanent to avoid loops
    return { errorClass: 'permanent', shouldRetry: false, safeErrorCode: 'maytapi_5xx' };
  }
  // 2xx but maytapi_success=false
  if (responseJson && responseJson.success === false) {
    return { errorClass: 'permanent', shouldRetry: false, safeErrorCode: 'maytapi_error' };
  }
  return { errorClass: 'none', shouldRetry: false, safeErrorCode: null };
}

async function attemptMaytapiSend(
  sendUrl: string,
  apiToken: string,
  payload: Record<string, unknown>,
  perAttemptTimeoutMs: number,
): Promise<AttemptOutcome> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), perAttemptTimeoutMs);
  let status: number | null = null;
  let responseText = '';
  let responseJson: any = null;
  let networkError: string | null = null;
  let timedOut = false;

  try {
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-maytapi-key': apiToken },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    status = res.status;
    responseText = await res.text();
    try { responseJson = JSON.parse(responseText); } catch { /* keep text */ }
    const ok = res.ok && (responseJson?.success === true);
    if (ok) {
      return {
        ok: true, status, responseJson, responseText,
        networkError: null, timedOut: false,
        errorClass: 'none', shouldRetry: false, safeErrorCode: null,
      };
    }
    const c = classifyMaytapiFailure({ status, networkError: null, timedOut: false, responseJson });
    return { ok: false, status, responseJson, responseText, networkError: null, timedOut: false, ...c };
  } catch (e) {
    const msg = (e as Error).message || 'fetch failed';
    if ((e as any)?.name === 'AbortError' || /aborted/i.test(msg)) {
      timedOut = true;
    } else {
      networkError = msg;
    }
    const c = classifyMaytapiFailure({ status: null, networkError, timedOut, responseJson: null });
    return { ok: false, status: null, responseJson: null, responseText: '', networkError, timedOut, ...c };
  } finally {
    clearTimeout(t);
  }
}

function normalizePhoneForMaytapi(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 9) return null;
  return digits;
}

function verifyFirstTouchFormat(message: string): { ok: boolean; reason?: string } {
  if (!message) return { ok: false, reason: 'empty message' };
  const lines = message.split('\n');
  const firstLine = (lines[0] || '').trim();
  if (firstLine !== BRANDED_URL) return { ok: false, reason: 'first line is not the branded URL' };
  if (!message.includes('— Vanto')) return { ok: false, reason: 'signature missing' };
  if (!message.includes('vanto@onlinecourseformlm.com')) return { ok: false, reason: 'signature email missing' };
  return { ok: true };
}

function buildFirstTouchMediaCaption(proposedMessage: string): string {
  const caption = proposedMessage.replace(/\s+$/, '');
  const lines = caption.split('\n');
  const firstLine = (lines[0] || '').trim();
  if (firstLine !== BRANDED_URL) return `${BRANDED_URL}\n\n${caption}`;
  const head = lines[0];
  const tailRaw = lines.slice(1).join('\n');
  const tail = tailRaw.split(BRANDED_URL).join('').replace(/\n{3,}/g, '\n\n');
  return `${head}\n${tail}`.replace(/\s+$/, '');
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const invocationStart = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ---- Admin JWT check ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid JWT' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from('user_roles').select('role').eq('user_id', callerId).eq('role', 'admin').maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Input (E.6: simulation flags removed; live function accepts only zazi_action_id + test_mode) ----
    const body = await req.json().catch(() => ({}));
    const { zazi_action_id, test_mode } = body || {};
    if (!zazi_action_id || typeof zazi_action_id !== 'string') {
      return new Response(JSON.stringify({ error: 'zazi_action_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (test_mode !== true) {
      return new Response(JSON.stringify({
        error: 'Phase E.0 requires test_mode=true. Batch/autonomous send not allowed.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- Load row ----
    const { data: row, error: rowErr } = await admin
      .from('zazi_actions').select('*').eq('id', zazi_action_id).maybeSingle();
    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: 'zazi_action not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Hard guards ----
    const failures: string[] = [];
    if (row.status !== 'approved') failures.push(`status must be 'approved' (got '${row.status}')`);
    if (!row.approved_by) failures.push('approved_by is null');
    if (!row.approved_at) failures.push('approved_at is null');
    if (!row.proposed_message) failures.push('proposed_message is null/empty');
    if ((row.supervisor_quality_score ?? 0) < 60) failures.push('supervisor_quality_score < 60');
    if ((row.supervisor_safety ?? 0) < 70) failures.push('supervisor_safety < 70');
    if ((row.supervisor_leadership_fit ?? 0) < 60) failures.push('supervisor_leadership_fit < 60');
    if (row.supervisor_block_reason) failures.push(`supervisor_block_reason set: ${row.supervisor_block_reason}`);
    if (row.sent_at) failures.push('sent_at already populated');
    if (row.maytapi_message_id) failures.push('maytapi_message_id already populated');
    if (!row.contact_id) failures.push('contact_id is null');

    if (failures.length > 0) {
      await logSendAttempt(admin, {
        user_id: row.user_id,
        contact_id: row.contact_id ?? null,
        zazi_action_id,
        attempted_at: new Date().toISOString(),
        responded_at: new Date().toISOString(),
        mode: 'test',
        intended_send_type: 'media',
        request_status: 'blocked',
        error_code: 'eligibility_failed',
        metadata: { failure_count: failures.length, first_failure: failures[0] ?? null },
      });
      return new Response(JSON.stringify({ error: 'Send guards failed', failures }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Contact phone ----
    const { data: contact } = await admin
      .from('contacts').select('id, full_name, phone_number, phone_normalized')
      .eq('id', row.contact_id).maybeSingle();
    if (!contact) {
      return new Response(JSON.stringify({ error: 'contact not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const phone = normalizePhoneForMaytapi(contact.phone_normalized || contact.phone_number || '');
    if (!phone) {
      return new Response(JSON.stringify({ error: 'contact has no valid phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- First-touch link preview rule ----
    const fmt = verifyFirstTouchFormat(row.proposed_message);
    if (!fmt.ok) {
      return new Response(JSON.stringify({
        error: `First-touch format check failed: ${fmt.reason}`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- Maytapi creds ----
    const productId = Deno.env.get('MAYTAPI_PRODUCT_ID');
    const phoneId = Deno.env.get('MAYTAPI_PHONE_ID');
    const apiToken = Deno.env.get('MAYTAPI_API_TOKEN');
    if (!productId || !phoneId || !apiToken) {
      return new Response(JSON.stringify({ error: 'Maytapi secrets missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const caption = buildFirstTouchMediaCaption(row.proposed_message);
    if (!caption.includes(BRANDED_URL)) {
      return new Response(JSON.stringify({
        error: 'Built caption is missing the branded page URL',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sendUrl = `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`;
    const payload = {
      to_number: phone,
      type: 'media',
      message: BRANDED_MEDIA_IMAGE,
      text: caption,
    };

    // E.5 — bounded retry loop (E.6: no synthetic simulation flags; live function only)
    let attempts = 0;
    let last: AttemptOutcome | null = null;
    let timeBudgetExhausted = false;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const wait = BACKOFF_MS[i] || 0;
      if (wait > 0) {
        if (Date.now() - invocationStart + wait > TOTAL_TIME_BUDGET_MS) {
          timeBudgetExhausted = true;
          break;
        }
        await new Promise((r) => setTimeout(r, wait));
      }
      const remaining = TOTAL_TIME_BUDGET_MS - (Date.now() - invocationStart);
      if (remaining <= 250) { timeBudgetExhausted = true; break; }
      const perAttempt = Math.min(PER_ATTEMPT_TIMEOUT_MS, remaining - 100);

      attempts = i + 1;
      last = await attemptMaytapiSend(sendUrl, apiToken, payload, perAttempt);

      if (last.ok) break;
      if (!last.shouldRetry) break;
      if (i === MAX_ATTEMPTS - 1) break;
    }

    const phoneHash = await hashPhone(phone);
    const payloadHash = await hashPayload({ to: phone, type: 'media', text: caption, image: BRANDED_MEDIA_IMAGE });
    const captionLength = contentLength(caption);
    const respondedAt = new Date().toISOString();

    const success = !!last?.ok;
    const messageId = last?.responseJson?.data?.msgId || last?.responseJson?.data?.id || null;
    const sanitizedResponse = last?.responseJson ? {
      success: last.responseJson.success ?? null,
      message_id: last.responseJson.data?.msgId ?? last.responseJson.data?.id ?? null,
      type: last.responseJson.data?.type ?? null,
      message: last.responseJson.message ?? null,
    } : { raw_excerpt: (last?.responseText || '').slice(0, 300) };

    if (!success) {
      // Failure path — DO NOT mark sent. ONE log row only.
      const evidence = (row.evidence as any) || {};
      const newEvidence = {
        ...evidence,
        transport: {
          ...(evidence.transport || {}),
          last_error: last?.networkError || (last?.timedOut ? 'timeout' : `HTTP ${last?.status ?? 'n/a'}`),
          failed_at: new Date().toISOString(),
          test_mode: true,
          retry_attempts: attempts,
          error_class: last?.errorClass ?? 'unknown',
        },
      };
      await admin.from('zazi_actions').update({ evidence: newEvidence }).eq('id', zazi_action_id);

      const safeErr: SafeErrorCode = last?.safeErrorCode ?? (timeBudgetExhausted ? 'timeout' : 'unknown_error');

      await logSendAttempt(admin, {
        user_id: row.user_id,
        contact_id: row.contact_id,
        zazi_action_id,
        attempted_at: new Date().toISOString(),
        responded_at: respondedAt,
        mode: 'test',
        intended_send_type: 'media',
        request_status: 'fail',
        payload_hash: payloadHash,
        response_status_code: last?.status ?? null,
        error_code: safeErr,
        phone_hash: phoneHash,
        content_length: captionLength,
        metadata: {
          retry_attempts: attempts,
          final_attempt: attempts,
          error_class: last?.errorClass ?? 'unknown',
          transient_or_permanent: last?.shouldRetry ? 'transient' : 'permanent',
          last_status: last?.status ?? null,
          time_budget_exhausted: timeBudgetExhausted,
          maytapi_success: last?.responseJson?.success ?? null,
        },
      });

      return new Response(JSON.stringify({
        ok: false, sent: false,
        http_status: last?.status ?? null,
        network_error: last?.networkError ?? null,
        timed_out: !!last?.timedOut,
        retry_attempts: attempts,
        error_class: last?.errorClass ?? 'unknown',
        error_code: safeErr,
        time_budget_exhausted: timeBudgetExhausted,
        maytapi_response: sanitizedResponse,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Success path
    const evidence = (row.evidence as any) || {};
    const newEvidence = {
      ...evidence,
      transport: {
        ...(evidence.transport || {}),
        maytapi_response: sanitizedResponse,
        sent_by: callerId,
        sent_at: new Date().toISOString(),
        preview_expected: true,
        send_type: 'media',
        branded_url: BRANDED_URL,
        branded_media_image: BRANDED_MEDIA_IMAGE,
        test_mode: true,
        retry_attempts: attempts,
      },
    };

    const { error: updErr } = await admin.from('zazi_actions').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      maytapi_message_id: messageId,
      evidence: newEvidence,
    }).eq('id', zazi_action_id);

    if (updErr) {
      return new Response(JSON.stringify({
        ok: false, sent_but_db_update_failed: true, db_error: updErr.message,
        maytapi_response: sanitizedResponse, message_id: messageId,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await logSendAttempt(admin, {
      user_id: row.user_id,
      contact_id: row.contact_id,
      zazi_action_id,
      attempted_at: new Date().toISOString(),
      responded_at: respondedAt,
      mode: 'test',
      intended_send_type: 'media',
      maytapi_message_id: messageId,
      request_status: 'ok',
      payload_hash: payloadHash,
      response_status_code: last?.status ?? null,
      phone_hash: phoneHash,
      content_length: captionLength,
      metadata: {
        sent_by: callerId,
        retry_attempts: attempts,
        final_attempt: attempts,
        error_class: attempts > 1 ? 'transient_recovered' : 'none',
      },
    });

    // E.3 — optional safe activity write, gated by per-user feature flag.
    try {
      const { data: settings } = await admin
        .from('integration_settings')
        .select('prospector_write_activity_on_send')
        .eq('user_id', row.user_id)
        .maybeSingle();

      if (settings?.prospector_write_activity_on_send === true) {
        const marker = `zazi_action_id=${zazi_action_id}`;
        const boundedMarker = `${marker} |`;
        let existingQuery = admin
          .from('contact_activities')
          .select('id')
          .eq('user_id', row.user_id)
          .or(`notes.ilike.%${boundedMarker}%,notes.ilike.%${marker}`);
        if (row.contact_id) existingQuery = existingQuery.eq('contact_id', row.contact_id);
        const { data: existing } = await existingQuery.limit(1).maybeSingle();

        if (!existing) {
          const safeNotes = [
            'source=zazi_ai_prospector',
            'transport=maytapi',
            'mode=test',
            'intended_send_type=media',
            marker,
            messageId ? `maytapi_message_id=${messageId}` : null,
            `content_length=${captionLength}`,
            `phone_hash=${phoneHash}`,
          ].filter(Boolean).join(' | ');

          const { error: actErr } = await admin.from('contact_activities').insert({
            user_id: row.user_id,
            contact_id: row.contact_id,
            activity_type: 'whatsapp',
            summary: 'Zazi AI Prospector outbound WhatsApp sent via Maytapi (test mode).',
            notes: safeNotes,
            next_action: '',
          });
          if (actErr) {
            console.warn('[maytapi-send-1to1] contact_activities insert failed (non-blocking):', actErr.message);
          }
        }
      }
    } catch (e) {
      console.warn('[maytapi-send-1to1] E.3 activity write threw (non-blocking):', (e as Error).message);
    }

    return new Response(JSON.stringify({
      ok: true, sent: true,
      zazi_action_id, message_id: messageId,
      retry_attempts: attempts,
      maytapi_response: sanitizedResponse,
      test_mode: true,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
