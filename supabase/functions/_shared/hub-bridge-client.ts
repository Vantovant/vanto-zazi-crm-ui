// Shared VantoOS Maytapi hub bridge client (Phase B shadow mode).
// Signs outbound calls exactly like suite-bridge-selftest T1-T6.
// Reads SUITE_BRIDGE_SECRET_GETWELL_GROW, falls back to SUITE_BRIDGE_SECRET.
// All calls are best-effort: missing config or hub errors do NOT block local flow.

const APP_KEY = "getwell_grow";
const HUB_URL = Deno.env.get("VANTOOS_HUB_URL") ?? "";
const SECRET = Deno.env.get("SUITE_BRIDGE_SECRET_GETWELL_GROW") ??
  Deno.env.get("SUITE_BRIDGE_SECRET") ?? "";
const ENFORCE = (Deno.env.get("MAYTAPI_HUB_ENFORCE") ?? "false").toLowerCase() === "true";

const enc = new TextEncoder();

export { ENFORCE };

export interface DncResult {
  allowed: boolean;
  reason?: string;
  cooldown_seconds?: number;
  blocked_until?: string;
}

export interface HubDecision {
  action: string;
  allowed?: boolean;
  reason?: string;
  error?: string;
  ms?: number;
  ts: string;
}

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function callHub(action: string, body: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  json: any;
  ms: number;
}> {
  const envelope = JSON.stringify({ action, body });
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const sig = await hmac(SECRET, `${timestamp}.${nonce}.${APP_KEY}.${envelope}`);
  const t0 = performance.now();
  try {
    const res = await fetch(`${HUB_URL}/functions/v1/maytapi-hub-bridge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-app": APP_KEY,
        "x-bridge-timestamp": timestamp,
        "x-bridge-nonce": nonce,
        "x-bridge-signature": sig,
      },
      body: envelope,
    });
    const raw = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {
      json = { raw };
    }
    return { ok: res.ok, status: res.status, json, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      json: { error: (e as Error).message },
      ms: Math.round(performance.now() - t0),
    };
  }
}

export function hubReady(): boolean {
  return Boolean(HUB_URL && SECRET);
}

export async function dncCheck(
  phone: string,
  eventClass: "marketing" | "transactional" | "broadcast" = "marketing",
): Promise<{ result: DncResult; decision: HubDecision } | null> {
  if (!hubReady()) return null;
  const ts = new Date().toISOString();
  const res = await callHub("dnc_check", { phone, event_class: eventClass });
  const decision: HubDecision = {
    action: "dnc_check",
    allowed: res.json?.allowed,
    reason: res.json?.reason,
    error: res.ok ? undefined : (res.json?.error ?? `http_${res.status}`),
    ms: res.ms,
    ts,
  };
  const result: DncResult = {
    allowed: res.json?.allowed === true,
    reason: res.json?.reason,
    cooldown_seconds: res.json?.cooldown_seconds,
    blocked_until: res.json?.blocked_until,
  };
  return { result, decision };
}

export interface SendRecordedOpts {
  spoke_event_id: string;
  phone: string;
  campaign_type: string;
  maytapi_message_id?: string;
  status: "sent" | "delivered" | "read" | "failed";
  sent_at?: string;
  metadata?: Record<string, unknown>;
}

export async function sendRecorded(opts: SendRecordedOpts): Promise<HubDecision | null> {
  if (!hubReady()) return null;
  const ts = new Date().toISOString();
  const res = await callHub("send_recorded", {
    spoke_event_id: opts.spoke_event_id,
    phone: opts.phone,
    campaign_type: opts.campaign_type,
    maytapi_message_id: opts.maytapi_message_id ?? null,
    status: opts.status,
    sent_at: opts.sent_at ?? ts,
    metadata: opts.metadata ?? {},
  });
  return {
    action: "send_recorded",
    allowed: res.ok,
    reason: res.json?.recorded ? "recorded" : undefined,
    error: res.ok ? undefined : (res.json?.error ?? `http_${res.status}`),
    ms: res.ms,
    ts,
  };
}

export interface InboundStopOpts {
  phone: string;
  keyword: string;
  message_id: string;
  received_at: string;
}

export async function inboundStop(opts: InboundStopOpts): Promise<HubDecision | null> {
  if (!hubReady()) return null;
  const ts = new Date().toISOString();
  const res = await callHub("inbound_stop", {
    phone: opts.phone,
    keyword: opts.keyword,
    message_id: opts.message_id,
    received_at: opts.received_at,
  });
  return {
    action: "inbound_stop",
    allowed: res.ok,
    reason: res.json?.dnc ? "dnc_recorded" : undefined,
    error: res.ok ? undefined : (res.json?.error ?? `http_${res.status}`),
    ms: res.ms,
    ts,
  };
}
