/**
 * Shared contact normalization utilities.
 * Must match the DB functions normalize_phone() and normalize_email() exactly.
 */

/** Strip everything except digits. Returns null-equivalent empty string if no digits. */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length > 0 ? digits : null;
}

/** Lowercase + trim. Returns null if empty. */
export function normalizeEmail(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Safe merge rules: merge incoming into existing.
 * - Never overwrite a non-empty field with empty.
 * - AdditionalNotes: append with timestamp if both non-empty.
 */
export function safeMerge(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, incomingVal] of Object.entries(incoming)) {
    const existingVal = existing[key];
    const inStr = String(incomingVal ?? '').trim();
    const exStr = String(existingVal ?? '').trim();

    if (!inStr) {
      // Never overwrite with empty
      continue;
    }

    if (key === 'additional_notes' || key === 'AdditionalNotes') {
      if (exStr && inStr && exStr !== inStr) {
        result[key] = `${exStr}\n\n--- Merged ${new Date().toISOString().split('T')[0]} ---\n${inStr}`;
      } else if (inStr) {
        result[key] = inStr;
      }
      continue;
    }

    // For workflow fields, only update if incoming is non-empty (already checked above)
    result[key] = incomingVal;
  }

  return result;
}
