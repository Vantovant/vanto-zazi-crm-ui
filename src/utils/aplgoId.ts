/**
 * APLGO ID sanitizer.
 *
 * Business rule: APLGO ID is a digits-only business identity field.
 * Any non-digit characters (labels like "new!", spaces, "ID:", "APLGO ", etc.)
 * MUST be stripped before matching, insert, update, paste matching, or Copilot lookup.
 *
 * Mirrors the database trigger sanitize_contact_aplgo_id() so client and DB
 * always agree on the canonical stored value.
 */
export function sanitizeAplgoId(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).replace(/[^0-9]/g, '');
}
