// supabase/functions/_shared/secret-verify.ts
//
// Dual-secret verification with timing-safe comparison.
// Supports primary (WEBHOOK_SECRET) and rotation (WEBHOOK_SECRET_NEXT).

function timingSafeEqual(a: string, b: string): boolean {
  // Always compare byte-by-byte over a fixed length to avoid timing leaks.
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export type SecretVersion = "primary" | "next" | "invalid";

export function verifyWebhookSecret(provided: string | null): SecretVersion {
  if (!provided) return "invalid";
  const primary = Deno.env.get("WEBHOOK_SECRET") ?? "";
  const next = Deno.env.get("WEBHOOK_SECRET_NEXT") ?? "";

  if (primary && timingSafeEqual(provided, primary)) return "primary";
  if (next && timingSafeEqual(provided, next)) return "next";
  return "invalid";
}
