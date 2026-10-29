// Pure helpers for the Call Sheets page (tested in callSheets.test.ts).

export const CALL_OUTCOMES = ['Answered', 'No answer', 'Call back', 'Wrong number', 'Not interested'] as const;

export type CallCard = {
  id: string;
  full_name: string;
  phone_number: string;
  phone_normalized: string | null;
  city: string;
  province: string;
  go_status: string;
  leg: string;
  level: string;
  aplgo_id: string;
  lead_type: string;
  auto_send_opt_out: boolean;
  enrolled_on: string | null;
  activated_on: string | null;
  next_action: string;
  additional_notes: string;
  created_at: string;
  last_call_at: string | null;
  last_call_outcome: string | null;
  called_today: boolean;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_inbound_preview: string | null;
  unanswered_inbound: boolean;
  orders_last_60d: number;
  last_order_at: string | null;
  bucket: 'open' | 'new' | 'steady' | 'little';
};

/** Format a phone as 0xx xxx xxxx for SA numbers; otherwise return digits as typed. */
export function formatLocalPhone(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  let local = d;
  if (d.startsWith('27') && d.length === 11) local = '0' + d.slice(2);
  else if (d.length === 9) local = '0' + d;
  if (local.length === 10 && local.startsWith('0')) {
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return String(raw ?? '').trim();
}

/** International digits for wa.me / tel links. */
export function intlDigits(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 10) return '27' + d.slice(1);
  if (d.length === 9) return '27' + d;
  return d;
}

export function isPhoneOnly(c: Pick<CallCard, 'auto_send_opt_out' | 'additional_notes'>): boolean {
  if (c.auto_send_opt_out) return true;
  return /(no|not|don'?t|doesn'?t|does not|do not)\s+(want\s+)?(any\s+)?whats\s?app/i.test(c.additional_notes || '');
}

/** Skip auto-generated appreciation messages and the "October VIP" tag note. */
export function isNoiseNote(text: string): boolean {
  return /october vip/i.test(text) || /appreciation|thank you for your (monthly )?activity|auto[- ]?sent/i.test(text);
}

export function talkAbout(c: CallCard): string[] {
  const out: string[] = [];
  if (c.unanswered_inbound) out.push(`Reply to their WhatsApp: "${(c.last_inbound_preview ?? '').slice(0, 80)}"`);
  if (/(promised|outstanding|waiting)/i.test(c.next_action || '')) out.push(`Follow up the promise: ${c.next_action}`);
  if (c.last_call_outcome === 'Call back') out.push('They asked for a call back');
  if (c.bucket === 'new') out.push('Welcome call');
  if (Number(c.orders_last_60d) > 0) out.push('Thank them for their recent orders');
  if (c.next_action && !/(promised|outstanding|waiting)/i.test(c.next_action)) out.push(c.next_action);
  if (!out.length) out.push('Check in and ask how they are doing');
  return out;
}

export function isNewJoiner(c: CallCard): boolean {
  return c.bucket === 'new';
}

/** One card per person: drop later rows that share aplgo_id or phone with an earlier row. */
export function dedupeCards<T extends { id: string; aplgo_id?: string | null; phone_normalized?: string | null }>(rows: T[]): T[] {
  const seenA = new Set<string>();
  const seenP = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const a = (r.aplgo_id || '').trim();
    const p = (r.phone_normalized || '').trim();
    if ((a && seenA.has(a)) || (p && seenP.has(p))) continue;
    if (a) seenA.add(a);
    if (p) seenP.add(p);
    out.push(r);
  }
  return out;
}

const BUCKET_ORDER = { open: 0, new: 1, steady: 2, little: 3 } as const;
export function sortCards(rows: CallCard[]): CallCard[] {
  return [...rows].sort((a, b) => {
    const d = BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
    if (d) return d;
    if (a.bucket === 'new') {
      const da = a.activated_on || a.enrolled_on || a.created_at;
      const db = b.activated_on || b.enrolled_on || b.created_at;
      return String(db).localeCompare(String(da));
    }
    return a.full_name.localeCompare(b.full_name);
  });
}
