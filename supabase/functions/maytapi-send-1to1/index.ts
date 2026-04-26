// Phase E.0 — Maytapi send 1-on-1 (admin-only, single approved row, controlled test)
// Phase E.2 — Adds non-blocking observability into prospector_send_log.
// HARD GUARDS: no batching, no cron, no contact_activities writes, no contacts.lead_type writes.
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

function normalizePhoneForMaytapi(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 9) return null;
  // Maytapi expects international format without +
  return digits;
}

function verifyFirstTouchFormat(message: string): { ok: boolean; reason?: string } {
  if (!message) return { ok: false, reason: 'empty message' };
  const lines = message.split('\n');
  const firstLine = (lines[0] || '').trim();
  if (firstLine !== BRANDED_URL) {
    return { ok: false, reason: 'first line is not the branded URL' };
  }
  if (!message.includes('— Vanto')) {
    return { ok: false, reason: 'signature missing' };
  }
  if (!message.includes('vanto@onlinecourseformlm.com')) {
    return { ok: false, reason: 'signature email missing' };
  }
  return { ok: true };
}

// Phase E.0.2.1 — Build Maytapi `media` caption for first-touch.
// Caption structure (URL MUST be at the TOP):
//   <BRANDED_URL>
//
//   <body>
//
//   — Vanto
//   vanto@onlinecourseformlm.com
//
// The stored proposed_message already follows this format (verified by
// verifyFirstTouchFormat). We pass it through verbatim — no reordering —
// to guarantee the link stays as the first line of the caption.
function buildFirstTouchMediaCaption(proposedMessage: string): string {
  // Normalize trailing whitespace only; preserve URL-at-top ordering exactly.
  const caption = proposedMessage.replace(/\s+$/, '');
  // Defensive: ensure URL is on line 1 and not duplicated later in the body.
  const lines = caption.split('\n');
  const firstLine = (lines[0] || '').trim();
  if (firstLine !== BRANDED_URL) {
    // Should never happen — verifyFirstTouchFormat runs before this.
    // Force-prepend to satisfy the invariant.
    return `${BRANDED_URL}\n\n${caption}`;
  }
  // Strip any duplicate occurrences of the URL after line 1.
  const head = lines[0];
  const tailRaw = lines.slice(1).join('\n');
  const tail = tailRaw.split(BRANDED_URL).join('').replace(/\n{3,}/g, '\n\n');
  return `${head}\n${tail}`.replace(/\s+$/, '');
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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

    // ---- Input ----
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
      // E.2 — log blocked attempt (eligibility gate failed)
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

    // ---- Send via Maytapi sendMessage (type="media" — image card with caption, no "Forwarded") ----
    // Phase E.0.2: switched from type="link" (caused "Forwarded" label) to type="media".
    //   - `message` carries the IMAGE URL (Maytapi attaches as image).
    //   - `text` carries the caption: body + branded page URL + signature.
    const caption = buildFirstTouchMediaCaption(row.proposed_message);
    if (!caption.includes(BRANDED_URL)) {
      return new Response(JSON.stringify({
        error: 'Built caption is missing the branded page URL',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sendUrl = `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`;
    let upstream: Response;
    let upstreamJson: any = null;
    let upstreamText = '';
    let networkError: string | null = null;

    try {
      upstream = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-maytapi-key': apiToken,
        },
        body: JSON.stringify({
          to_number: phone,
          type: 'media',
          message: BRANDED_MEDIA_IMAGE,
          text: caption,
        }),
      });
      upstreamText = await upstream.text();
      try { upstreamJson = JSON.parse(upstreamText); } catch { /* keep text */ }
    } catch (e) {
      networkError = (e as Error).message;
    }


    const sanitizedResponse = upstreamJson ? {
      success: upstreamJson.success ?? null,
      message_id: upstreamJson.data?.msgId ?? upstreamJson.data?.id ?? null,
      type: upstreamJson.data?.type ?? null,
      message: upstreamJson.message ?? null,
    } : { raw_excerpt: upstreamText.slice(0, 300) };

    const success = !networkError && upstream! && upstream.ok && (upstreamJson?.success === true);
    const messageId = upstreamJson?.data?.msgId || upstreamJson?.data?.id || null;

    // E.2 — compute safe metadata for prospector_send_log (no raw PII).
    const phoneHash = await hashPhone(phone);
    const payloadHash = await hashPayload({ to: phone, type: 'media', text: caption, image: BRANDED_MEDIA_IMAGE });
    const captionLength = contentLength(caption);
    const respondedAt = new Date().toISOString();

    if (!success) {
      // Failure path — DO NOT mark sent
      const evidence = (row.evidence as any) || {};
      const newEvidence = {
        ...evidence,
        transport: {
          ...(evidence.transport || {}),
          last_error: networkError || `HTTP ${upstream?.status} ${upstreamText.slice(0, 200)}`,
          failed_at: new Date().toISOString(),
          test_mode: true,
          maytapi_response: sanitizedResponse,
        },
      };
      await admin.from('zazi_actions').update({ evidence: newEvidence })
        .eq('id', zazi_action_id);

      // E.2 — log fail attempt (non-blocking)
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
        response_status_code: upstream?.status ?? null,
        error_code: networkError ? 'network_error' : 'maytapi_error',
        phone_hash: phoneHash,
        content_length: captionLength,
        metadata: {
          maytapi_success: upstreamJson?.success ?? null,
          maytapi_message_field: typeof upstreamJson?.message === 'string' ? upstreamJson.message.slice(0, 80) : null,
        },
      });

      return new Response(JSON.stringify({
        ok: false,
        sent: false,
        http_status: upstream?.status ?? null,
        network_error: networkError,
        maytapi_response: sanitizedResponse,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Success path — update only this zazi_actions row
    const evidence = (row.evidence as any) || {};
    const newEvidence = {
      ...evidence,
      transport: {
        ...(evidence.transport || {}),
        maytapi_response: sanitizedResponse,
        sent_by: callerId,
        sent_at: new Date().toISOString(),
        preview_expected: true, // type="media" → image card with caption, no "Forwarded" label
        send_type: 'media',
        branded_url: BRANDED_URL,
        branded_media_image: BRANDED_MEDIA_IMAGE,
        test_mode: true,
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

    // E.2 — log ok attempt (non-blocking)
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
      response_status_code: upstream?.status ?? null,
      phone_hash: phoneHash,
      content_length: captionLength,
      metadata: { sent_by: callerId },
    });

    // E.3 — optional safe activity write, gated by per-user feature flag.
    // Hard rules: no raw caption/body/phone/email; idempotent per zazi_action_id;
    // never block the send response if anything fails.
    try {
      const { data: settings } = await admin
        .from('integration_settings')
        .select('prospector_write_activity_on_send')
        .eq('user_id', row.user_id)
        .maybeSingle();

      if (settings?.prospector_write_activity_on_send === true) {
        const marker = `zazi_action_id=${zazi_action_id}`;
        const { data: existing } = await admin
          .from('contact_activities')
          .select('id')
          .eq('user_id', row.user_id)
          .ilike('notes', `%${marker}%`)
          .limit(1)
          .maybeSingle();

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
      maytapi_response: sanitizedResponse,
      test_mode: true,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
