// shiplogic-backfill
//
// On-demand historical shipment sync. Calls Shiplogic's real API
// (GET /shipments, paginated with limit/offset) and upserts each shipment into
// public.shipments, matching by waybill_number.
//
// Called from the "Sync history" button on the Deliveries page, so it requires
// a signed-in caller: the JWT is validated in code and every row written is
// attributed to that user (or to the matched contact's owner).
//
// Purely additive: writes only to shipments / contact_activities / inventory.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  pick,
  addressToText,
  productSummaryOf,
  matchContact,
  applyInventoryForShipment,
} from '../_shared/shiplogic-shared.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const API_BASE = (Deno.env.get('SHIPLOGIC_API_BASE') ?? 'https://api.shiplogic.com/v2').replace(/\/+$/, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('SHIPLOGIC_API_KEY') ?? '';
  if (!apiKey) {
    return json({ ok: false, error: 'shiplogic_api_key_not_configured' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return json({ ok: false, error: 'unauthorized', reason: 'missing_authorization_header' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const callerId = userData?.user?.id;
  if (userErr || !callerId) return json({ ok: false, error: 'unauthorized', reason: 'invalid_token' }, 401);

  let body: Record<string, any> = {};
  try {
    body = req.headers.get('content-length') === '0' ? {} : await req.json();
  } catch {
    body = {};
  }

  const days = Math.max(1, Math.min(Number(body.days) || 30, 365));
  const pageSize = Math.max(1, Math.min(Number(body.page_size) || 100, 250));
  const maxPages = Math.max(1, Math.min(Number(body.max_pages) || 10, 50));
  const dryRun = body.dry_run === true;

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const summary = {
    ok: true,
    dry_run: dryRun,
    days,
    fetched: 0,
    created: 0,
    updated: 0,
    linked_to_contact: 0,
    unlinked: 0,
    stock_notes: [] as string[],
    errors: [] as string[],
  };

  try {
    for (let page = 0; page < maxPages; page++) {
      const url = new URL(`${API_BASE}/shipments`);
      url.searchParams.set('limit', String(pageSize));
      url.searchParams.set('offset', String(page * pageSize));
      url.searchParams.set('start_date', from.toISOString().slice(0, 10));
      url.searchParams.set('end_date', to.toISOString().slice(0, 10));

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });

      if (!res.ok) {
        const text = await res.text();
        summary.errors.push(`Shiplogic API ${res.status}: ${text.slice(0, 300)}`);
        break;
      }

      const payload = await res.json();
      const list: any[] = Array.isArray(payload)
        ? payload
        : (payload.shipments ?? payload.results ?? payload.data ?? []);

      if (!Array.isArray(list) || list.length === 0) break;
      summary.fetched += list.length;

      for (const d of list) {
        const waybill = pick(d, ['tracking_reference', 'waybill_number', 'waybill', 'short_tracking_reference']);
        if (!waybill) continue;

        const status = (pick(d, ['status', 'shipment_status', 'tracking_status']) || 'unknown').toLowerCase();
        const collection = addressToText(d.collection_address ?? d.collection?.address);
        const delivery = addressToText(d.delivery_address ?? d.delivery?.address);
        const serviceLevel = pick(d, ['service_level_code', 'service_level', 'service_level_name']);
        const courierRef = pick(d, ['courier_reference', 'routing_code', 'customer_reference', 'provider_reference']);
        const earliest = pick(d, ['estimated_delivery_from', 'earliest_delivery_date', 'delivery_date']);
        const productSummary = productSummaryOf(d);

        const { data: existing } = await admin
          .from('shipments')
          .select('id, user_id, contact_id, status, inventory_applied')
          .eq('waybill_number', waybill)
          .maybeSingle();

        let contactId = (existing?.contact_id as string | null) ?? null;
        let ownerId = (existing?.user_id as string | undefined) ?? undefined;
        if (!contactId) {
          const m = await matchContact(admin, d);
          contactId = m.contactId;
          ownerId = ownerId ?? m.userId ?? undefined;
        }
        ownerId = ownerId ?? callerId;

        if (contactId) summary.linked_to_contact++;
        else summary.unlinked++;

        const patch: Record<string, unknown> = {
          status,
          last_status_update: new Date().toISOString(),
          raw: d,
        };
        if (collection) patch.collection_address = collection;
        if (delivery) patch.delivery_address = delivery;
        if (serviceLevel) patch.service_level = serviceLevel;
        if (courierRef) patch.courier_reference = courierRef;
        if (productSummary) patch.product_summary = productSummary;
        if (earliest) patch.earliest_delivery_date = earliest.slice(0, 10);

        if (dryRun) {
          if (existing) summary.updated++; else summary.created++;
          continue;
        }

        if (existing?.id) {
          if (contactId && !existing.contact_id) patch.contact_id = contactId;
          const { error } = await admin.from('shipments').update(patch).eq('id', existing.id);
          if (error) { summary.errors.push(`${waybill}: ${error.message}`); continue; }
          summary.updated++;
        } else {
          // Historical shipments are pulled once — deduct stock on first insert only.
          const inv = productSummary
            ? await applyInventoryForShipment(admin, { userId: ownerId, productSummary })
            : { applied: false, note: '', decremented: [], skipped: [] };
          if (inv.note) summary.stock_notes.push(`${waybill}: ${inv.note}`);

          const { error } = await admin.from('shipments').insert({
            user_id: ownerId,
            waybill_number: waybill,
            contact_id: contactId,
            inventory_applied: inv.applied,
            inventory_note: inv.note,
            ...patch,
          });
          if (error) { summary.errors.push(`${waybill}: ${error.message}`); continue; }
          summary.created++;

          if (contactId) {
            await admin.from('contact_activities').insert({
              user_id: ownerId,
              contact_id: contactId,
              activity_type: 'Delivery Update',
              summary: `Shipment ${waybill} imported from courier history: ${status}`,
              notes: [
                productSummary ? `Products: ${productSummary}` : '',
                delivery ? `Delivery address: ${delivery}` : '',
                inv.note,
              ].filter(Boolean).join('\n'),
              next_action: '',
            });
          }
        }
      }

      if (list.length < pageSize) break;
    }
  } catch (err) {
    summary.errors.push(String(err));
  }

  return json(summary, 200);
});
