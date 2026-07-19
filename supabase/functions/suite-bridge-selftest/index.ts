// Temporary self-test: signs a ping as "vantoos" using SUITE_BRIDGE_SECRET
// and calls the local suite-bridge-spoke function. Admin-only.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const enc = new TextEncoder();
async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: role } = await admin.from("user_roles").select("role")
    .eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
  if (!role) return new Response(JSON.stringify({ error: "admin required" }), { status: 403, headers: cors });

  const secret = Deno.env.get("SUITE_BRIDGE_SECRET");
  if (!secret) return new Response(JSON.stringify({ error: "missing SUITE_BRIDGE_SECRET" }), { status: 500, headers: cors });

  const APP_KEY = "getwell_grow";
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const body = JSON.stringify({ kind: "ping" });
  const sig = await hmac(secret, `${ts}.${nonce}.${APP_KEY}.${body}`);

  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/suite-bridge-spoke`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-app": "vantoos",
      "x-bridge-timestamp": ts,
      "x-bridge-nonce": nonce,
      "x-bridge-signature": sig,
    },
    body,
  });
  const text = await res.text();
  return new Response(JSON.stringify({
    handshake_status: res.status,
    handshake_body: (() => { try { return JSON.parse(text); } catch { return text; } })(),
    signed_as: "vantoos",
    app_key: APP_KEY,
  }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
