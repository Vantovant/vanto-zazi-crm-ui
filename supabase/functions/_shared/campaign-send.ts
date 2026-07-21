// Shared choke-point sender for automated campaigns (Birthday / Activation / Zoom).
// NOT to be reused for MP1/prospector paths — those go through maytapi-send-1to1.
// Enforces: kill-switch, per-tick cap, 6h cooldown per phone, dry-run mode.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAYTAPI_PRODUCT_ID = Deno.env.get("MAYTAPI_PRODUCT_ID") ?? "";
const MAYTAPI_PHONE_ID = Deno.env.get("MAYTAPI_PHONE_ID") ?? "";
const MAYTAPI_TOKEN = Deno.env.get("MAYTAPI_API_TOKEN") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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

    await admin.from(opts.table).update({ status: "executing", attempts: (row.attempts ?? 0) + 1, last_attempt_at: new Date().toISOString() }).eq("id", row.id);

    const send = await sendMaytapi(phone, body);
    if (!send.ok) {
      results.failed++;
      await admin.from(opts.table).update({ status: "failed", error: send.error ?? "unknown" }).eq("id", row.id);
      results.rows.push({ id: row.id, status: "failed", error: send.error });
      continue;
    }
    results.sent++;
    await admin.from(opts.table).update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: send.msgId ?? null, error: null }).eq("id", row.id);
    results.rows.push({ id: row.id, status: "sent", msgId: send.msgId });
  }
  return results;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
