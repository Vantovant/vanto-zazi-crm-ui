// Push a single CRM contact to VantoOS hub so sister apps (e.g. email)
// can locate the same person. Signed with SUITE_BRIDGE_SECRET like the
// existing suite-bridge-spoke, but this is an OUTBOUND-only helper
// triggered manually from the Contact Drawer.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_KEY = "getwell_grow";
const enc = new TextEncoder();

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("SUITE_BRIDGE_SECRET_GETWELL_GROW")
    ?? Deno.env.get("SUITE_BRIDGE_SECRET") ?? "";
  const hubUrl = Deno.env.get("VANTOOS_HUB_URL") ?? "";
  if (!secret || !hubUrl) return json({ error: "hub_not_configured" }, 500);

  // Verify caller is a signed-in user of this app
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let payload: { contact_id?: string } = {};
  try { payload = await req.json(); } catch { /* */ }
  if (!payload.contact_id) return json({ error: "contact_id_required" }, 400);

  const { data: contact, error: cErr } = await admin
    .from("contacts")
    .select("*")
    .eq("id", payload.contact_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (cErr || !contact) return json({ error: "contact_not_found" }, 404);

  const contactPayload = {
    id: contact.id,
    external_id: contact.id,
    full_name: contact.full_name,
    first_name: (contact.full_name ?? "").split(" ")[0] || null,
    phone_e164: contact.phone_normalized || contact.phone_number || null,
    email: contact.email_normalized || contact.email_address || null,
    country: contact.country || null,
    city: contact.city || null,
    lead_type: contact.lead_type || null,
    temperature: contact.lead_temperature || null,
    aplgo_id: contact.aplgo_id || null,
    sponsor_name: contact.sponsor_name || null,
    salutation_title: contact.salutation_title || null,
    updated_at: new Date().toISOString(),
  };
  const body = {
    kind: "contact_upsert",
    source_app: APP_KEY,
    ...contactPayload,
    contact: contactPayload,
  };

  // Sign over the INNER body (matches suite-bridge-spoke postBackToHub contract).
  const innerStr = JSON.stringify(body);
  const httpBody = JSON.stringify({ action: "receive", body });
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const sig = await hmacHex(secret, `${ts}.${nonce}.${APP_KEY}.${innerStr}`);
  const target = new URL("/functions/v1/suite-bridge-hub", hubUrl).toString();

  let resp: Response;
  try {
    resp = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-app": APP_KEY,
        "x-bridge-timestamp": ts,
        "x-bridge-nonce": nonce,
        "x-bridge-signature": sig,
      },
      body: httpBody,
    });
  } catch (e) {
    return json({ ok: false, error: "hub_unreachable", detail: String(e) }, 502);
  }

  const text = await resp.text();
  if (!resp.ok) {
    return json({ ok: false, error: "hub_rejected", status: resp.status, body: text }, 502);
  }

  return json({ ok: true, app: APP_KEY, synced_at: new Date().toISOString(), hub_status: resp.status });
});
