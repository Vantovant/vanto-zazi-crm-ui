// supabase/functions/_shared/idempotency.ts
//
// Idempotency helper backed by webhook_idempotency_keys table.
// Same x-idempotency-key within 24h → returns cached response, no double-write.

import { hashPayload } from "./redact.ts";

export interface IdempotencyHit {
  hit: true;
  status: number;
  body: Record<string, unknown>;
}
export interface IdempotencyMiss {
  hit: false;
  key: string;
  requestHash: string;
}
export type IdempotencyResult = IdempotencyHit | IdempotencyMiss;

/**
 * Check whether this idempotency key has been seen in the last 24h.
 * If yes → return the stored response so the caller can replay it.
 * If no  → caller proceeds, then calls `recordIdempotency` to persist.
 */
export async function checkIdempotency(
  supabase: any,
  scope: string,
  key: string | null,
  body: unknown,
): Promise<IdempotencyResult | null> {
  if (!key) return null;
  const requestHash = await hashPayload(body);

  const { data } = await supabase
    .from("webhook_idempotency_keys")
    .select("response_status, response_summary, expires_at")
    .eq("scope", scope)
    .eq("idempotency_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (data) {
    return {
      hit: true,
      status: data.response_status ?? 200,
      body: { ...(data.response_summary ?? {}), idempotent_replay: true },
    };
  }
  return { hit: false, key, requestHash };
}

export async function recordIdempotency(
  supabase: any,
  scope: string,
  key: string,
  requestHash: string,
  status: number,
  responseSummary: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("webhook_idempotency_keys").upsert(
      {
        scope,
        idempotency_key: key,
        request_hash: requestHash,
        response_status: status,
        response_summary: responseSummary,
      },
      { onConflict: "scope,idempotency_key" },
    );
  } catch (e) {
    // Idempotency persistence must never break the main flow.
    console.warn("[idempotency] persist failed (non-fatal):", (e as Error).message);
  }
}
