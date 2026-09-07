// shiplogic-webhook
//
// Receives shipment tracking events from Shiplogic (the API behind The Courier Guy).
// Purely additive: writes only to public.shipments and public.contact_activities.
//
// Verification: Shiplogic lets you configure a shared secret / custom header on the
// webhook subscription. If SHIPLOGIC_WEBHOOK_SECRET is set we require it to match one
// of the accepted carriers (header or body). If it is not set, we accept the POST
// (Shiplogic subscriptions without a secret configured) but log a warning.
//
// Always returns 200 fast on accepted payloads — Shiplogic retries on non-2xx.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { applyInventoryForShipment } from '../_shared/shiplogic-shared.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function pick(obj: Record<string, any> | null | undefined, keys: string[]): string {
  if (!obj) return '';
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

function addressToText(a: any): string {
  if (!a) return '';
  if (typeof a === 'string') return a;
  const parts = [
    a.company, a.street_address, a.local_area, a.city, a.zone, a.code, a.country,
  ].filter((p) => typeof p === 'string' && p.trim());
  return parts.join(', ');
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // --- shared secret verification (only enforced when configured) ---
  const expected = Deno.env.get('SHIPLOGIC_WEBHOOK_SECRET') ?? '';
  if (expected) {
    const auth = req.headers.get('authorization') ?? '';
    const provided =
      req.headers.get('x-shiplogic-signature') ??
      req.headers.get('x-shiplogic-secret') ??
      req.headers.get('x-webhook-secret') ??
      (auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '') ??
      '';
    const bodySecret = typeof payload.secret === 'string' ? payload.secret : '';
    const ok =
      (provided && timingSafeEqual(provided, expected)) ||
      (bodySecret && timingSafeEqual(bodySecret, expected));
    if (!ok) {
      console.warn('[shiplogic-webhook] rejected: secret mismatch');
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
  } else {
    console.warn('[shiplogic-webhook] SHIPLOGIC_WEBHOOK_SECRET not set — accepting unverified POST');
  }

  // Shiplogic nests the shipment under `data` (sometimes `shipment`), but tolerate flat too.
  const d: Record<string, any> =
    (payload.data && typeof payload.data === 'object' ? payload.data : null) ??
    (payload.shipment && typeof payload.shipment === 'object' ? payload.shipment : null) ??
    payload;

  const waybill = pick(d, ['tracking_reference', 'waybill_number', 'waybill', 'short_tracking_reference'])
    || pick(payload, ['tracking_reference', 'waybill_number', 'waybill']);
  const status = (pick(d, ['status', 'shipment_status', 'tracking_status'])
    || pick(payload, ['status', 'event', 'event_type'])
    || 'unknown').toLowerCase();

  if (!waybill) {
    console.warn('[shiplogic-webhook] payload without tracking reference — ignored');
    // 200 so Shiplogic does not retry an unusable payload forever.
    return json({ ok: true, ignored: 'missing_tracking_reference' }, 200);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const work = async () => {
    try {
      const { data: existing } = await admin
        .from('shipments')
        .select('id, user_id, contact_id, status')
        .eq('waybill_number', waybill)
        .maybeSingle();

      const productSummary = Array.isArray(d.parcels)
        ? d.parcels.map((p: any) => pick(p, ['parcel_description', 'description', 'submitted_length_cm'])).filter(Boolean).join(' + ')
        : pick(d, ['product_summary', 'description', 'customer_reference']);

      const patch: Record<string, unknown> = {
        status,
        last_status_update: new Date().toISOString(),
        raw: payload,
      };
      const collection = addressToText(d.collection_address ?? d.collection?.address);
      const delivery = addressToText(d.delivery_address ?? d.delivery?.address);
      const serviceLevel = pick(d, ['service_level_code', 'service_level', 'service_level_name']);
      const courierRef = pick(d, ['courier_reference', 'routing_code', 'customer_reference', 'provider_reference']);
      const earliest = pick(d, ['estimated_delivery_from', 'earliest_delivery_date', 'delivery_date']);

      if (collection) patch.collection_address = collection;
      if (delivery) patch.delivery_address = delivery;
      if (serviceLevel) patch.service_level = serviceLevel;
      if (courierRef) patch.courier_reference = courierRef;
      if (productSummary) patch.product_summary = productSummary;
      if (earliest) patch.earliest_delivery_date = earliest.slice(0, 10);

      let shipmentUserId = existing?.user_id as string | undefined;
      let contactId = (existing?.contact_id as string | null) ?? null;

      // Try to match a contact by delivery phone / email when not already linked.
      if (!contactId) {
        const rawPhone = pick(d.delivery_address ?? d.delivery?.contact ?? d, ['phone', 'telephone_number', 'mobile_number'])
          || pick(d.delivery?.contact ?? {}, ['phone']);
        const email = pick(d.delivery_address ?? d.delivery?.contact ?? d, ['email', 'email_address']).toLowerCase();
        const digits = rawPhone.replace(/\D/g, '');
        const last9 = digits.slice(-9);

        if (last9.length === 9) {
          const { data: byPhone } = await admin
            .from('contacts')
            .select('id, user_id')
            .like('phone_normalized', `%${last9}`)
            .limit(1);
          if (byPhone && byPhone.length) {
            contactId = byPhone[0].id;
            shipmentUserId = shipmentUserId ?? byPhone[0].user_id;
          }
        }
        if (!contactId && email) {
          const { data: byEmail } = await admin
            .from('contacts')
            .select('id, user_id')
            .eq('email_normalized', email)
            .limit(1);
          if (byEmail && byEmail.length) {
            contactId = byEmail[0].id;
            shipmentUserId = shipmentUserId ?? byEmail[0].user_id;
          }
        }
      }

      if (!shipmentUserId) {
        shipmentUserId = Deno.env.get('SHIPLOGIC_DEFAULT_USER_ID') ?? '';
      }
      if (!shipmentUserId) {
        // Last resort: attribute to the oldest profile (single-operator install).
        const { data: prof } = await admin
          .from('profiles')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1);
        shipmentUserId = prof?.[0]?.id;
      }
      if (!shipmentUserId) {
        console.error('[shiplogic-webhook] cannot resolve owner user_id — skipping write');
        return;
      }

      let shipmentId = existing?.id as string | undefined;
      let stockNote = '';
      if (shipmentId) {
        if (contactId && !existing?.contact_id) patch.contact_id = contactId;
        const { error } = await admin.from('shipments').update(patch).eq('id', shipmentId);
        if (error) console.error('[shiplogic-webhook] update failed:', error.message);
      } else {
        // First time we see this waybill: deduct the shipped products from
        // offline inventory. Unrecognised products are skipped, never guessed.
        const inv = productSummary
          ? await applyInventoryForShipment(admin, { userId: shipmentUserId, productSummary })
          : { applied: false, note: '', decremented: [], skipped: [] };
        stockNote = inv.note;

        const { data: inserted, error } = await admin
          .from('shipments')
          .insert({
            user_id: shipmentUserId,
            waybill_number: waybill,
            contact_id: contactId,
            inventory_applied: inv.applied,
            inventory_note: inv.note,
            ...patch,
          })
          .select('id')
          .single();
        if (error) console.error('[shiplogic-webhook] insert failed:', error.message);
        shipmentId = inserted?.id;
      }

      // Append an activity note on the linked contact (existing CRM pattern).
      if (contactId && existing?.status !== status) {
        const { error: actErr } = await admin.from('contact_activities').insert({
          user_id: shipmentUserId,
          contact_id: contactId,
          activity_type: 'Delivery Update',
          summary: `Shipment ${waybill} status updated: ${status}`,
          notes: [
            serviceLevel ? `Service level: ${serviceLevel}` : '',
            courierRef ? `Courier reference: ${courierRef}` : '',
            delivery ? `Delivery address: ${delivery}` : '',
            stockNote,
          ].filter(Boolean).join('\n'),
          next_action: '',
        });
        if (actErr) console.warn('[shiplogic-webhook] activity insert failed (non-blocking):', actErr.message);
      }
    } catch (err) {
      console.error('[shiplogic-webhook] processing error:', err);
    }
  };

  // Respond immediately; finish the DB work in the background.
  // @ts-ignore - available in the Supabase edge runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(work());
  } else {
    await work();
  }

  return json({ ok: true, waybill, status }, 200);
});
