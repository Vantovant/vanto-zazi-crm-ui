// Shared helpers for the Shiplogic (The Courier Guy) integration.
//
// Used by both `shiplogic-webhook` (live tracking events) and
// `shiplogic-backfill` (on-demand historical pull from Shiplogic's API), so the
// two paths cannot drift apart on how they read a payload, match a contact, or
// touch inventory.
//
// Purely additive: writes only to public.shipments, public.contact_activities
// and public.inventory (stock_quantity decrement only).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function pick(obj: Record<string, any> | null | undefined, keys: string[]): string {
  if (!obj) return '';
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

export function addressToText(a: any): string {
  if (!a) return '';
  if (typeof a === 'string') return a;
  const parts = [
    a.company, a.street_address, a.local_area, a.city, a.zone, a.code, a.country,
  ].filter((p) => typeof p === 'string' && p.trim());
  return parts.join(', ');
}

/** Best-effort product summary from a Shiplogic shipment object. */
export function productSummaryOf(d: Record<string, any>): string {
  if (Array.isArray(d.parcels) && d.parcels.length) {
    const names = d.parcels
      .map((p: any) => pick(p, ['parcel_description', 'description']))
      .filter(Boolean);
    if (names.length) return names.join(' + ');
  }
  return pick(d, ['product_summary', 'description', 'customer_reference']);
}

export interface ContactMatch {
  contactId: string | null;
  userId: string | null;
}

/**
 * Match a shipment to a CRM contact by the DELIVERY party's phone (last 9
 * digits) then email. Read-only against contacts — never writes to them.
 */
export async function matchContact(
  admin: SupabaseClient,
  d: Record<string, any>,
): Promise<ContactMatch> {
  const deliverySources = [
    d.delivery_address,
    d.delivery_contact,
    d.delivery?.contact,
    d.delivery?.address,
    d,
  ].filter(Boolean) as Record<string, any>[];

  let rawPhone = '';
  let email = '';
  for (const src of deliverySources) {
    if (!rawPhone) rawPhone = pick(src, ['phone', 'telephone_number', 'mobile_number']);
    if (!email) email = pick(src, ['email', 'email_address']).toLowerCase();
  }

  const digits = rawPhone.replace(/\D/g, '');
  const last9 = digits.slice(-9);

  if (last9.length === 9) {
    const { data } = await admin
      .from('contacts')
      .select('id, user_id')
      .like('phone_normalized', `%${last9}`)
      .limit(1);
    if (data && data.length) return { contactId: data[0].id, userId: data[0].user_id };
  }

  if (email) {
    const { data } = await admin
      .from('contacts')
      .select('id, user_id')
      .eq('email_normalized', email)
      .limit(1);
    if (data && data.length) return { contactId: data[0].id, userId: data[0].user_id };
  }

  return { contactId: null, userId: null };
}

/** Resolve the owning account for a shipment when no contact matched. */
export async function resolveOwnerUserId(
  admin: SupabaseClient,
  preferred?: string | null,
): Promise<string | null> {
  if (preferred) return preferred;
  const fromEnv = Deno.env.get('SHIPLOGIC_DEFAULT_USER_ID') ?? '';
  if (fromEnv) return fromEnv;
  const { data } = await admin
    .from('profiles')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

interface ParsedProduct {
  token: string;
  qty: number;
}

/**
 * Split a free-text product summary such as "GRW + SLD + 2x STP" into product
 * tokens with quantities. Conservative on purpose — anything it cannot read
 * cleanly is returned as-is and later skipped rather than guessed at.
 */
export function parseProductSummary(summary: string): ParsedProduct[] {
  if (!summary || !summary.trim()) return [];
  return summary
    .split(/[+,;/&\n]+/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      // "2x GRW", "2 x GRW", "GRW x2", "GRW (2)"
      let qty = 1;
      let token = raw;
      const lead = token.match(/^(\d{1,3})\s*[xX*]?\s+(.*)$/);
      const trail = token.match(/^(.*?)\s*[xX*]\s*(\d{1,3})$/);
      const paren = token.match(/^(.*?)\s*\((\d{1,3})\)$/);
      if (lead) { qty = Number(lead[1]); token = lead[2]; }
      else if (trail) { token = trail[1]; qty = Number(trail[2]); }
      else if (paren) { token = paren[1]; qty = Number(paren[2]); }
      return { token: token.trim(), qty: Math.max(1, Math.min(qty, 500)) };
    })
    .filter((p) => p.token.length > 0);
}

export interface InventoryResult {
  applied: boolean;
  note: string;
  decremented: Array<{ product_name: string; qty: number; new_quantity: number }>;
  skipped: string[];
}

/**
 * Decrement inventory for the products mentioned in a shipment's product
 * summary. Only exact (case-insensitive) product_name matches are actioned —
 * an ambiguous or unknown token is skipped and reported so the operator can
 * handle it manually. Never creates inventory rows and never goes below zero.
 */
export async function applyInventoryForShipment(
  admin: SupabaseClient,
  args: { userId: string; productSummary: string },
): Promise<InventoryResult> {
  const parsed = parseProductSummary(args.productSummary);
  if (!parsed.length) {
    return { applied: false, note: 'No product summary on this shipment — stock not adjusted.', decremented: [], skipped: [] };
  }

  const { data: rows, error } = await admin
    .from('inventory')
    .select('id, product_name, stock_quantity')
    .eq('user_id', args.userId);
  if (error) {
    return { applied: false, note: `Could not read inventory: ${error.message}`, decremented: [], skipped: parsed.map((p) => p.token) };
  }

  const byName = new Map<string, { id: string; product_name: string; stock_quantity: number }>();
  for (const r of rows ?? []) byName.set(String(r.product_name).trim().toLowerCase(), r as any);

  const decremented: InventoryResult['decremented'] = [];
  const skipped: string[] = [];

  for (const p of parsed) {
    const key = p.token.toLowerCase();
    const row = byName.get(key);
    if (!row) { skipped.push(p.token); continue; }
    const next = Math.max(0, Number(row.stock_quantity ?? 0) - p.qty);
    const { error: updErr } = await admin
      .from('inventory')
      .update({ stock_quantity: next, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updErr) { skipped.push(p.token); continue; }
    row.stock_quantity = next;
    decremented.push({ product_name: row.product_name, qty: p.qty, new_quantity: next });
  }

  const noteParts: string[] = [];
  if (decremented.length) {
    noteParts.push(`Stock deducted: ${decremented.map((d) => `${d.product_name} -${d.qty} (now ${d.new_quantity})`).join(', ')}`);
  }
  if (skipped.length) {
    noteParts.push(`Not matched to a tracked product, handle manually: ${skipped.join(', ')}`);
  }

  return {
    applied: decremented.length > 0,
    note: noteParts.join(' | '),
    decremented,
    skipped,
  };
}
