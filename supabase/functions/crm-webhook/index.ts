import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyWebhookSecret } from "../_shared/secret-verify.ts";
import {
  hashEmail,
  hashPhone,
  safePayloadSummary,
} from "../_shared/redact.ts";
import {
  checkIdempotency,
  recordIdempotency,
} from "../_shared/idempotency.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-timestamp, x-idempotency-key, x-supabase-client-platform, x-supabase-client-platform-version, x-user-email, x-owner-email",
};

const SCOPE = "crm-webhook";
const RATE_LIMIT_PER_MIN = 60;

/**
 * Resolves a local Zazi user UUID from an email address.
 * NEVER trust external UUIDs — always resolve locally.
 */
async function resolveLocalUserId(supabase: any, email: string): Promise<string | null> {
  const norm = (email ?? "").toLowerCase().trim();
  if (!norm) return null;

  // 1) Try profiles first
  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", norm)
    .limit(1)
    .maybeSingle();

  if (prof?.id) return prof.id;

  // 2) If profile is missing but the Auth user exists, create the profile automatically
  try {
    const { data: authRes } = await supabase.auth.admin.getUserByEmail(norm);
    const userId = authRes?.user?.id;

    if (userId) {
      await supabase.from("profiles").upsert(
        { id: userId, email: norm, full_name: norm },
        { onConflict: "id" }
      );
      return userId;
    }
  } catch (_) {
    // ignore and fall through
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Authenticate via shared webhook secret (dual-secret rotation) ──────
  const incomingSecret = req.headers.get("x-webhook-secret");
  const secretVersion = verifyWebhookSecret(incomingSecret);
  if (secretVersion === "invalid") {
    console.warn(JSON.stringify({ scope: SCOPE, evt: "auth_fail", reason: "invalid_secret" }));
    return new Response(JSON.stringify({ error: "Unauthorized: invalid webhook secret" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Replay protection via timestamp header ─────────────────────────────
  const tsHeader = req.headers.get("x-webhook-timestamp");
  if (!tsHeader) {
    return new Response(JSON.stringify({ error: "Missing x-webhook-timestamp header" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const tsSeconds = Number(tsHeader);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const MAX_DRIFT_SECONDS = 120; // 2 minutes
  if (Number.isNaN(tsSeconds) || tsSeconds > nowSeconds + 5 || (nowSeconds - tsSeconds) > MAX_DRIFT_SECONDS) {
    return new Response(JSON.stringify({ error: "Request expired or invalid timestamp" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Use service role key so RLS is bypassed for webhook writes ──────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const action = body?.action;

    // ── Resolve local user by email — NEVER trust external user_id ──────
    const emailFromBody =
      body?.email ?? body?.user_email ?? body?.owner_email ?? body?.ownerEmail ?? null;
    const emailFromHeader =
      req.headers.get("x-user-email") ?? req.headers.get("x-owner-email") ?? null;
    const fallbackEmail =
      Deno.env.get("DEFAULT_OWNER_EMAIL") ??
      Deno.env.get("ZAZI_DEFAULT_OWNER_EMAIL") ??
      "vanto@onlinecourseformlm.com";

    const email = emailFromBody ?? emailFromHeader ?? fallbackEmail;

    if (!email) {
      return new Response(
        JSON.stringify({
          error: "email is required to resolve local user",
          hint:
            "Send body.email OR header x-user-email/x-owner-email, or set DEFAULT_OWNER_EMAIL on this function.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Rate limit (per hashed email identity) ─────────────────────────
    const identityHash = await hashEmail(email);
    const rl = await checkRateLimit(supabase, SCOPE, identityHash, RATE_LIMIT_PER_MIN, 60);
    if (!rl.allowed) {
      console.warn(JSON.stringify({ scope: SCOPE, evt: "rate_limited", identity_hash: identityHash, retry_after: rl.retryAfterSeconds }));
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", retry_after_seconds: rl.retryAfterSeconds }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfterSeconds),
          },
        },
      );
    }

    // ── Idempotency check (caller may send x-idempotency-key) ──────────
    const idemKey = req.headers.get("x-idempotency-key");
    const idem = await checkIdempotency(supabase, SCOPE, idemKey, body);
    if (idem?.hit) {
      return new Response(JSON.stringify(idem.body), {
        status: idem.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Safe, redacted request log ─────────────────────────────────────
    const safeSummary = await safePayloadSummary(body);
    console.log(JSON.stringify({
      scope: SCOPE,
      evt: "request",
      secret_version: secretVersion,
      identity_hash: identityHash,
      ...safeSummary,
    }));

    const localUserId = await resolveLocalUserId(supabase, email);

    if (!localUserId) {
      return new Response(
        JSON.stringify({ error: `Could not resolve/create local user for email: ${email}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Helper to persist idempotency on every terminal response.
    const finalize = async (status: number, payload: Record<string, unknown>) => {
      if (idem && !idem.hit) {
        await recordIdempotency(supabase, SCOPE, idem.key, idem.requestHash, status, payload);
      }
      return new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    if (action === "sync_contacts") {
      const { contacts: waContacts } = body;

      if (!Array.isArray(waContacts) || waContacts.length === 0) {
        return finalize(400, { error: "No contacts provided" });
      }

      const { data: existing } = await supabase
        .from("contacts")
        .select("id, full_name, phone_number")
        .eq("user_id", localUserId);

      const existingByPhone = new Map(
        (existing || []).map((c: any) => [c.phone_number.replace(/\s/g, ""), c])
      );

      const created: string[] = [];
      const matched: string[] = [];
      const errors: string[] = [];

      for (const wa of waContacts) {
        const phone = (wa.phone || "").replace(/\s/g, "");
        const name = wa.name || "Unknown";

        if (!phone) continue;
        if (name.includes(",") || name.includes("📌") || name.includes("👥")) continue;

        const match = existingByPhone.get(phone);
        if (match) {
          matched.push(match.full_name);
        } else {
          const { error: insertErr } = await supabase.from("contacts").insert({
            user_id: localUserId,
            assigned_to: localUserId,
            full_name: name,
            phone_number: phone,
            email_address: wa.email || "",
            lead_type: wa.lead_type || "Prospect",
            lead_temperature: wa.lead_temperature || "Warm",
            communication_status: "New",
            country: wa.country || "South Africa",
            additional_notes: wa.notes || "Imported via CRM Webhook",
          });

          if (insertErr) {
            errors.push(`${name}: ${insertErr.message}`);
          } else {
            created.push(name);
          }
        }
      }

      return finalize(200, {
        success: true,
        resolved_user_id: localUserId,
        created: created.length,
        matched: matched.length,
        errors,
        total: waContacts.length,
        created_names: created,
        matched_names: matched,
      });
    }

    // ── ACTION: log_chat ──────────────────────────────────────────────────
    if (action === "log_chat") {
      const { phone, name, message_preview } = body;

      if (!phone) {
        return finalize(400, { error: "phone is required" });
      }

      const cleanPhone = phone.replace(/\s/g, "");

      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, full_name")
        .eq("user_id", localUserId)
        .eq("phone_number", cleanPhone)
        .limit(1);

      const contact = contacts?.[0];

      await supabase.from("contact_activities").insert({
        user_id: localUserId,
        contact_id: contact?.id || null,
        activity_type: "whatsapp",
        summary: `WhatsApp chat with ${contact?.full_name || name || cleanPhone}`,
        notes: message_preview || "",
      });

      return finalize(200, {
        success: true,
        resolved_user_id: localUserId,
        contact_id: contact?.id || null,
        contact_name: contact?.full_name || null,
      });
    }

    // ── ACTION: upsert_contact ────────────────────────────────────────────
    if (action === "upsert_contact") {
      const { contact } = body;

      if (!contact?.full_name) {
        return finalize(400, { error: "contact.full_name is required" });
      }

      const phone = (contact.phone_number || "").replace(/\s/g, "");

      let existingId: string | null = null;
      if (phone) {
        const { data: found } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", localUserId)
          .eq("phone_number", phone)
          .limit(1);
        existingId = found?.[0]?.id || null;
      }

      const contactData = {
        user_id: localUserId,
        assigned_to: localUserId,
        full_name: contact.full_name,
        phone_number: phone,
        email_address: contact.email_address || "",
        lead_type: contact.lead_type || "Prospect",
        lead_temperature: contact.lead_temperature || "Warm",
        communication_status: contact.communication_status || "New",
        country: contact.country || "South Africa",
        city: contact.city || "",
        additional_notes: contact.additional_notes || "",
        aplgo_id: contact.aplgo_id || "",
        sponsor_name: contact.sponsor_name || "",
      };

      if (existingId) {
        const { error } = await supabase
          .from("contacts")
          .update(contactData)
          .eq("id", existingId);

        if (error) {
          return finalize(500, { error: error.message });
        }
        return finalize(200, {
          success: true,
          action: "updated",
          contact_id: existingId,
          resolved_user_id: localUserId,
        });
      } else {
        const { data: inserted, error } = await supabase
          .from("contacts")
          .insert(contactData)
          .select("id")
          .single();

        if (error) {
          return finalize(500, { error: error.message });
        }
        return finalize(200, {
          success: true,
          action: "created",
          contact_id: inserted.id,
          resolved_user_id: localUserId,
        });
      }
    }

    return finalize(400, { error: "Unknown action" });
  } catch (err) {
    console.error("crm-webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
