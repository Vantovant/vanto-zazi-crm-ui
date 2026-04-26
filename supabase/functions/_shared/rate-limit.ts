// supabase/functions/_shared/rate-limit.ts
//
// Ad-hoc per-identity rate limiter backed by webhook_rate_limit_buckets.
// NOTE: backend lacks dedicated rate-limit primitives — this is best-effort
// DB-bucket counting, not production-grade.
// Default: 60 requests / 60s per hashed identity.

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  windowStart: string;
}

export async function checkRateLimit(
  supabase: any,
  scope: string,
  identityHash: string,
  limit = 60,
  windowSeconds = 60,
): Promise<RateLimitDecision> {
  if (!identityHash) {
    return { allowed: true, remaining: limit, retryAfterSeconds: 0, windowStart: "" };
  }

  const now = new Date();
  // Floor to start of the current window.
  const windowStartMs =
    Math.floor(now.getTime() / (windowSeconds * 1000)) * (windowSeconds * 1000);
  const windowStart = new Date(windowStartMs).toISOString();

  // Best-effort upsert + increment. We read first, then upsert.
  const { data: existing } = await supabase
    .from("webhook_rate_limit_buckets")
    .select("request_count")
    .eq("scope", scope)
    .eq("identity", identityHash)
    .eq("window_start", windowStart)
    .maybeSingle();

  const current = existing?.request_count ?? 0;
  const next = current + 1;

  try {
    await supabase.from("webhook_rate_limit_buckets").upsert(
      {
        scope,
        identity: identityHash,
        window_start: windowStart,
        request_count: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scope,identity,window_start" },
    );
  } catch (e) {
    console.warn("[rate-limit] bucket update failed (fail-open):", (e as Error).message);
    return { allowed: true, remaining: limit, retryAfterSeconds: 0, windowStart };
  }

  if (next > limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((windowStartMs + windowSeconds * 1000 - now.getTime()) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter, windowStart };
  }
  return {
    allowed: true,
    remaining: Math.max(0, limit - next),
    retryAfterSeconds: 0,
    windowStart,
  };
}
