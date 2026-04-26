// supabase/functions/_shared/redact.ts
//
// PII redaction helpers for ZAZI AI PROSPECTOR backbone.
// Rule: never write raw phone, raw email, raw message body, or raw private
// payloads into logs/tables. Only safe metadata.

const enc = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePhone(raw: string): string {
  return (raw ?? "").replace(/[^0-9]/g, "");
}

function normalizeEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

export async function hashPhone(raw: string): Promise<string> {
  const norm = normalizePhone(raw);
  if (!norm) return "";
  return (await sha256Hex(`phone:${norm}`)).slice(0, 32);
}

export async function hashEmail(raw: string): Promise<string> {
  const norm = normalizeEmail(raw);
  if (!norm) return "";
  return (await sha256Hex(`email:${norm}`)).slice(0, 32);
}

export async function hashPayload(payload: unknown): Promise<string> {
  const str = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  return (await sha256Hex(`payload:${str}`)).slice(0, 32);
}

export function contentLength(payload: unknown): number {
  if (payload == null) return 0;
  const str = typeof payload === "string" ? payload : JSON.stringify(payload);
  return str.length;
}

/**
 * Build a safe summary of an inbound webhook payload for logging.
 * Strips raw PII and message bodies — keeps only counts, hashes, and shape.
 */
export async function safePayloadSummary(body: any): Promise<Record<string, unknown>> {
  const summary: Record<string, unknown> = {
    action: body?.action ?? null,
    has_email: Boolean(body?.email ?? body?.user_email ?? body?.owner_email),
    content_length: contentLength(body),
    payload_hash: await hashPayload(body),
  };

  if (body?.email || body?.user_email || body?.owner_email) {
    summary.email_hash = await hashEmail(
      body.email ?? body.user_email ?? body.owner_email,
    );
  }
  if (body?.phone) {
    summary.phone_hash = await hashPhone(body.phone);
    summary.phone_present = true;
  }
  if (body?.contact?.phone_number) {
    summary.contact_phone_hash = await hashPhone(body.contact.phone_number);
  }
  if (body?.contact?.email_address) {
    summary.contact_email_hash = await hashEmail(body.contact.email_address);
  }
  if (Array.isArray(body?.contacts)) {
    summary.contacts_count = body.contacts.length;
  }
  if (typeof body?.message_preview === "string") {
    summary.message_preview_length = body.message_preview.length;
  }
  return summary;
}
