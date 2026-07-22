// Shared choke-point sender for automated campaigns (Birthday / Activation / Zoom).
// NOT to be reused for MP1/prospector paths — those go through maytapi-send-1to1.
// Enforces: kill-switch, per-tick cap, 6h cooldown per phone, dry-run mode.
// Phase B: calls VantoOS hub dnc_check before send and send_recorded after send
// (shadow mode unless MAYTAPI_HUB_ENFORCE=true).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dncCheck, ENFORCE, sendRecorded } from "./hub-bridge-client.ts";

const MAYTAPI_PRODUCT_ID = Deno.env.get("MAYTAPI_PRODUCT_ID") ?? "";
const MAYTAPI_PHONE_ID = Deno.env.get("MAYTAPI_PHONE_ID") ?? "";
const MAYTAPI_TOKEN = Deno.env.get("MAYTAPI_API_TOKEN") ?? "";
const HASH_SALT = Deno.env.get("MAYTAPI_HASH_SALT") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function hmacHex(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function previewBody(text: string | null): string | null {
  if (!text) return null;
  return text.length > 140 ? text.slice(0, 140) + "…" : text;
}

// Mirror outbound campaign sends into maytapi_messages so the app's Maytapi
// Inbox shows the full two-way thread (outbound + inbound replies). Best-effort
// — must never break the send path.
async function mirrorOutboundToInbox(params: {
  userId: string;
  contactId: string | null;
  phoneNorm: string;
  body: string;
  msgId?: string;
  sentAt: string;
  campaignKey: string;
}) {
  try {
    if (!HASH_SALT || !params.phoneNorm) return;
    const phHash = await hmacHex(HASH_SALT, params.phoneNorm);
    const last4 = params.phoneNorm.length >= 4 ? params.phoneNorm.slice(-4) : params.phoneNorm;
    await admin.from("maytapi_messages").insert({
      user_id: params.userId,
      contact_id: params.contactId,
      direction: "outbound",
      maytapi_message_id: params.msgId ?? null,
      phone_hash: phHash,
      phone_e164: params.phoneNorm,
      phone_last4: last4,
      conversation_key: phHash,
      body: params.body,
      body_preview: previewBody(params.body),
      status: "sent",
      received_at: params.sentAt,
      raw: { source: "campaign", campaign: params.campaignKey, msg_id: params.msgId ?? null },
    });
  } catch (_e) {
    // swallow (duplicates, missing salt, etc.) — never block sends
  }
}

export interface TickOptions {
  campaignKey: "birthday" | "activation" | "zoom";
  table: string;
  buildBody: (row: any) => string;
  extraFilter?: (q: any) => any;
  dryRun?: boolean;
  cap?: number;
  forceIds?: string[];
}

interface KillSettings {
  enabled: boolean;
  daily_cap: number;
  per_tick_cap: number;
}

async function loadKillSwitch(campaign: string): Promise<KillSettings> {
  const { data } = await admin
    .from("campaign_settings")
    .select("enabled, daily_cap, per_tick_cap")
    .eq("campaign_key", campaign)
    .maybeSingle();
  return {
    enabled: (data as any)?.enabled === true,
    daily_cap: Number((data as any)?.daily_cap ?? 40),
    per_tick_cap: Number((data as any)?.per_tick_cap ?? 10),
  };
}

async function sentToday(table: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .gte("sent_at", since.toISOString());
  return count ?? 0;
}

async function inCooldown(phone: string, table: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from(table)
    .select("id")
    .eq("phone_normalized", phone)
    .gt("sent_at", cutoff)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function sendMaytapi(to: string, message: string): Promise<{ ok: boolean; msgId?: string; error?: string }> {
  if (!MAYTAPI_PRODUCT_ID || !MAYTAPI_PHONE_ID || !MAYTAPI_TOKEN) {
    return { ok: false, error: "maytapi_env_missing" };
  }
  try {
    const url = `https://api.maytapi.com/api/${MAYTAPI_PRODUCT_ID}/${MAYTAPI_PHONE_ID}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-maytapi-key": MAYTAPI_TOKEN },
      body: JSON.stringify({ to_number: to, type: "text", message }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) {
      return { ok: false, error: body?.message ?? `http_${res.status}` };
    }
    const msgId = body?.data?.msgId ?? body?.data?.id ?? body?.msgId ?? null;
    return { ok: true, msgId: msgId ?? undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function runCampaignTick(opts: TickOptions) {
  const kill = await loadKillSwitch(opts.campaignKey);
  const results = { campaign: opts.campaignKey, dryRun: !!opts.dryRun, processed: 0, sent: 0, skipped: 0, failed: 0, blocked: null as string | null, rows: [] as any[] };

  if (!kill.enabled && !opts.dryRun && !opts.forceIds?.length) {
    results.blocked = "kill_switch_disabled";
    return results;
  }

  const daySent = await sentToday(opts.table);
  const remainingDay = Math.max(0, kill.daily_cap - daySent);
  const cap = Math.min(opts.cap ?? kill.per_tick_cap, remainingDay || 999);
  if (cap === 0 && !opts.forceIds?.length) {
    results.blocked = "daily_cap_reached";
    return results;
  }

  let query = admin.from(opts.table).select("*").eq("status", "queued").order("created_at", { ascending: true }).limit(cap);
  if (opts.forceIds?.length) {
    query = admin.from(opts.table).select("*").in("id", opts.forceIds);
  } else if (opts.extraFilter) {
    query = opts.extraFilter(query);
  }
  const { data: rows, error } = await query;
  if (error) return { ...results, blocked: "query_error: " + error.message };

  for (const row of rows ?? []) {
    results.processed++;
    const phone = (row as any).phone_normalized;
    if (!phone || phone.length < 8) { results.skipped++; results.rows.push({ id: row.id, status: "skipped", reason: "invalid_phone" }); continue; }
    if (await inCooldown(phone, opts.table)) { results.skipped++; results.rows.push({ id: row.id, status: "skipped", reason: "cooldown_6h" }); continue; }

    const body = opts.buildBody(row);
    if (opts.dryRun) {
      results.rows.push({ id: row.id, status: "dry_run", preview: body.slice(0, 80) });
      continue;
    }

    // Phase B: ask VantoOS hub if this phone is allowed for marketing sends.
    let hubDecision: any = null;
    const dnc = await dncCheck(phone, "marketing");
    if (dnc) {
      hubDecision = dnc.decision;
      if (ENFORCE && dnc.result.allowed === false) {
        results.skipped++;
        await admin.from(opts.table).update({ status: "skipped", hub_decision: hubDecision, error: `hub:${dnc.result.reason}` }).eq("id", row.id);
        results.rows.push({ id: row.id, status: "skipped", reason: `hub:${dnc.result.reason}`, hub: hubDecision });
        continue;
      }
    }

    await admin.from(opts.table).update({ status: "executing", attempts: (row.attempts ?? 0) + 1, last_attempt_at: new Date().toISOString() }).eq("id", row.id);

    const send = await sendMaytapi(phone, body);
    if (!send.ok) {
      results.failed++;
      await admin.from(opts.table).update({ status: "failed", error: send.error ?? "unknown", hub_decision: hubDecision }).eq("id", row.id);
      results.rows.push({ id: row.id, status: "failed", error: send.error, hub: hubDecision });
      continue;
    }
    results.sent++;
    const sentAt = new Date().toISOString();
    await mirrorOutboundToInbox({
      userId: (row as any).user_id,
      contactId: (row as any).contact_id ?? null,
      phoneNorm: phone,
      body,
      msgId: send.msgId,
      sentAt,
      campaignKey: opts.campaignKey,
    });
    const recorded = await sendRecorded({
      spoke_event_id: row.id,
      phone,
      campaign_type: opts.campaignKey,
      maytapi_message_id: send.msgId,
      status: "sent",
      sent_at: sentAt,
      metadata: { table: opts.table },
    });
    if (recorded) hubDecision = recorded;
    await admin.from(opts.table).update({ status: "sent", sent_at: sentAt, provider_message_id: send.msgId ?? null, error: null, hub_decision: hubDecision }).eq("id", row.id);
    results.rows.push({ id: row.id, status: "sent", msgId: send.msgId, hub: hubDecision });
  }
  return results;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
