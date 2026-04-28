/**
 * Month-scoped helpers for Monthly Activity Appreciation (M1).
 *
 * Goal: status (Done / Pending) is per-month, never lifetime.
 *
 * Canonical month key: "YYYY-MM" (e.g. "2026-04").
 * Display label: "Month YYYY"  (e.g. "April 2026").
 *
 * Inputs we accept:
 *   - "April 2026"
 *   - "Apr 2026"
 *   - "2026-04"
 *   - "Monthly Activity - April 2026"
 *   - Date / ISO string (falls back to month of date)
 */

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const MONTH_INDEX: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  MONTH_NAMES.forEach((name, i) => {
    m[name.toLowerCase()] = i;
    m[name.slice(0, 3).toLowerCase()] = i;
  });
  return m;
})();

/** Returns canonical "YYYY-MM" or empty string. */
export function normalizeActivityMonth(input: string | Date | null | undefined): string {
  if (!input) return '';
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return '';
    return `${input.getFullYear()}-${String(input.getMonth() + 1).padStart(2, '0')}`;
  }
  const raw = String(input).trim();
  if (!raw) return '';

  // Strip common prefix
  const cleaned = raw.replace(/^Monthly Activity\s*-\s*/i, '').trim();

  // YYYY-MM (allow YYYY-MM-DD too)
  const ymd = cleaned.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (ymd) {
    const y = ymd[1];
    const m = String(parseInt(ymd[2], 10)).padStart(2, '0');
    return `${y}-${m}`;
  }

  // "Month YYYY" or "Mon YYYY"
  const named = cleaned.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (named) {
    const idx = MONTH_INDEX[named[1].toLowerCase()];
    if (idx !== undefined) {
      return `${named[2]}-${String(idx + 1).padStart(2, '0')}`;
    }
  }

  // Last resort: try Date parse
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return '';
}

/** Returns "April 2026" for any accepted month input, or empty string. */
export function monthLabel(input: string | Date | null | undefined): string {
  const key = normalizeActivityMonth(input);
  if (!key) return '';
  const [y, m] = key.split('-');
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return '';
  return `${MONTH_NAMES[idx]} ${y}`;
}

/** Composite key used to look up appreciation status for a given month + person. */
export function appreciationStatusKey(
  monthInput: string | Date | null | undefined,
  contactIdOrAplgoId: string | null | undefined,
): string {
  const month = normalizeActivityMonth(monthInput);
  const id = (contactIdOrAplgoId || '').toString().trim().toLowerCase();
  if (!month || !id) return '';
  return `${month}::${id}`;
}

/**
 * Try to extract a normalized month key from a contact_activities log row.
 *
 * Recognizes (in priority order):
 *   1. Machine marker in notes:  [monthly_activity_appreciation:2026-04]
 *   2. Machine marker in summary: same pattern
 *   3. Human format in summary: "...appreciation ... — April 2026" or "Month: April 2026"
 *
 * Returns "" if no month can be parsed.
 */
export function extractAppreciationMonth(activity: {
  summary?: string | null;
  notes?: string | null;
}): string {
  const haystack = `${activity.notes || ''}\n${activity.summary || ''}`;

  const marker = haystack.match(/\[monthly_activity_appreciation:(\d{4}-\d{2})\]/i);
  if (marker) return normalizeActivityMonth(marker[1]);

  // "Month: April 2026"
  const labeled = haystack.match(/Month:\s*([A-Za-z]+\s+\d{4})/i);
  if (labeled) {
    const k = normalizeActivityMonth(labeled[1]);
    if (k) return k;
  }

  // em-dash or hyphen separated trailing label e.g. "appreciation — April 2026"
  const trailing = haystack.match(/appreciation[^A-Za-z0-9]*[—\-:]\s*([A-Za-z]+\s+\d{4})/i);
  if (trailing) {
    const k = normalizeActivityMonth(trailing[1]);
    if (k) return k;
  }

  // Any "Month YYYY" mention as last fallback (only if "appreciation" appears)
  if (/appreciation/i.test(haystack)) {
    const any = haystack.match(/\b([A-Za-z]+\s+\d{4})\b/);
    if (any) {
      const k = normalizeActivityMonth(any[1]);
      if (k) return k;
    }
  }

  return '';
}

/** Sort comparator (ascending) for month keys "YYYY-MM". */
export function compareMonthKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
