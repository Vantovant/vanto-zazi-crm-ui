// Runs T1-T6 acceptance tests against VantoOS maytapi-hub-bridge. Admin-only.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HUB_URL = "https://zsvaqtlomgofwqkpwxeh.supabase.co/functions/v1/maytapi-hub-bridge";
const APP_KEY = "getwell_grow";
const enc = new TextEncoder();

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function callHub(action: string, body: Record<string, unknown>, secret: string, badSig = false) {
  const envelope = JSON.stringify({ action, body });
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  let signature = await hmac(secret, `${timestamp}.${nonce}.${APP_KEY}.${envelope}`);
  if (badSig) signature = signature.slice(0, -1) + (signature.slice(-1) === "0" ? "1" : "0");
  const t0 = performance.now();
  const res = await fetch(HUB_URL, {
    method: "POST",
    headers: {
      "x-bridge-app": APP_KEY,
      "x-bridge-timestamp": timestamp,
      "x-bridge-nonce": nonce,
      "x-bridge-signature": signature,
      "Content-Type": "application/json",
    },
    body: envelope,
  });
  const raw = await res.text();
  let json: any = null;
  try { json = JSON.parse(raw); } catch { /* leave null */ }
  return { status: res.status, json, raw, ms: Math.round(performance.now() - t0) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: role } = await admin.from("user_roles").select("role")
    .eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
  if (!role) {
    return new Response(JSON.stringify({ error: "admin required" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const secret = Deno.env.get("SUITE_BRIDGE_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "SUITE_BRIDGE_SECRET missing" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const testPhone = "+27999000" + String(Math.floor(1000 + Math.random() * 8999));
  const spokeEventId = `gwg-acc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const results: Record<string, any> = {};

  const t1 = await callHub("ping", {}, secret);
  results.T1_ping_valid = {
    pass: t1.status === 200 && t1.json?.ok === true && t1.json?.hub === "maytapi-hub-bridge",
    expect: "200 ok:true hub:maytapi-hub-bridge",
    ...t1,
  };

  const t2 = await callHub("ping", {}, secret, true);
  results.T2_ping_bad_sig = {
    pass: t2.status === 401 && t2.json?.error === "bad_signature",
    expect: "401 bad_signature",
    ...t2,
  };

  const t3 = await callHub("dnc_check", { phone: testPhone, event_class: "marketing" }, secret);
  results.T3_dnc_check_fresh = {
    pass: t3.status === 200 && t3.json?.allowed === true && t3.json?.cooldown_seconds === 21600,
    expect: "allowed:true cooldown_seconds:21600",
    ...t3,
  };

  const t4 = await callHub("send_recorded", {
    spoke_event_id: spokeEventId,
    phone: testPhone,
    campaign_type: "birthday",
    maytapi_message_id: `test_${spokeEventId}`,
    status: "sent",
    sent_at: new Date().toISOString(),
    metadata: { source: "hub-bridge-acceptance" },
  }, secret);
  results.T4_send_recorded = {
    pass: t4.status === 200 && t4.json?.recorded === true,
    expect: "recorded:true",
    ...t4,
  };

  const t5 = await callHub("dnc_check", { phone: testPhone, event_class: "marketing" }, secret);
  results.T5_dnc_check_cooldown = {
    pass: t5.status === 200 && t5.json?.allowed === false && t5.json?.reason === "cooldown" && !!t5.json?.blocked_until,
    expect: "allowed:false reason:cooldown blocked_until set",
    ...t5,
  };

  const t6a = await callHub("inbound_stop", {
    phone: testPhone,
    keyword: "STOP",
    message_id: `test_stop_${spokeEventId}`,
    received_at: new Date().toISOString(),
  }, secret);
  const t6b = await callHub("dnc_check", { phone: testPhone, event_class: "marketing" }, secret);
  results.T6_inbound_stop_then_dnc = {
    pass: t6a.status === 200 && t6a.json?.dnc === true &&
          t6b.status === 200 && t6b.json?.allowed === false && t6b.json?.reason === "dnc:stop_keyword",
    expect: "inbound_stop dnc:true, then dnc_check reason:dnc:stop_keyword",
    stop: t6a,
    check: t6b,
  };

  const passed = Object.values(results).filter((r: any) => r.pass).length;
  const total = Object.keys(results).length;

  return new Response(JSON.stringify({
    summary: {
      overall: passed === total ? "CLEAN" : "HOLD",
      passed, total, failed: total - passed,
      test_phone: testPhone,
      spoke_event_id: spokeEventId,
      ran_at: new Date().toISOString(),
    },
    results,
  }, null, 2), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
