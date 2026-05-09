// Phone Rescue Scan — recovers missing phones for shadow rows blocked by
// `no_phone` or `unmatched_contact`. Searches contacts, orders, contact_activities,
// maytapi_messages/inbound_unmatched, and import_audit. NEVER overwrites a
// non-empty contacts.phone_number; just creates phone_rescue_candidates rows.
//
// HARD LOCKS:
//  - No Maytapi sends. No zazi_actions/prospector_send_log writes.
//  - No contact mutations here (promotion happens in phone-rescue-promote).
//  - Multi-match → status='needs_review'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function digits(s: any): string {
  return String(s ?? '').replace(/\D/g, '');
}
function normName(s: any): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function trigramSim(a: string, b: string): number {
  const tri = (s: string) => {
    const p = `  ${s}  `;
    const set = new Set<string>();
    for (let i = 0; i < p.length - 2; i++) set.add(p.slice(i, i + 3));
    return set;
  };
  const A = tri(a), B = tri(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Admin-only
    const { data: roles } = await admin.from('user_roles')
      .select('role').eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Pull blocked shadow rows (recent — last 14 days)
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: blocked } = await admin.from('auto_send_shadow_log')
      .select('id, lane, contact_id, contact_name, entry_key, block_reason, would_send_at')
      .eq('user_id', user.id)
      .in('block_reason', ['no_phone', 'unmatched_contact'])
      .gte('would_send_at', since);

    if (!blocked || blocked.length === 0) {
      return new Response(JSON.stringify({ ok: true, evaluated: 0, candidates: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Pull lookup datasets (scoped to this user)
    const [{ data: contacts }, { data: orders }, { data: maytapiMsgs }, { data: maytapiUnmatched }, { data: importRows }] = await Promise.all([
      admin.from('contacts')
        .select('id, full_name, phone_number, phone_normalized, aplgo_id, sponsor_name, leg, level')
        .eq('user_id', user.id),
      admin.from('orders')
        .select('contact_id, contact_name')
        .eq('user_id', user.id),
      admin.from('maytapi_messages')
        .select('contact_id, phone_e164, phone_last4').eq('user_id', user.id).limit(2000),
      admin.from('maytapi_inbound_unmatched')
        .select('phone_last4, last_body_preview, status').eq('user_id', user.id),
      admin.from('import_audit')
        .select('incoming_full_name, incoming_phone, incoming_aplgo_id, matched_contact_id')
        .eq('user_id', user.id).limit(5000),
    ]);

    const contactById = new Map((contacts || []).map((c: any) => [c.id, c]));
    const contactsArr = (contacts || []) as any[];

    // existing contact already-skipped names (filter out the blocked one itself)
    const blockedContactIds = new Set(blocked.map(b => b.contact_id).filter(Boolean));

    // Already-existing candidates so we don't duplicate
    const { data: existing } = await admin.from('phone_rescue_candidates')
      .select('shadow_log_id').eq('user_id', user.id).in('status', ['recovered_auto', 'needs_review', 'orphan_birthday', 'duplicate_conflict']);
    const seenShadow = new Set((existing || []).map((r: any) => r.shadow_log_id));

    let candidatesCreated = 0;
    let recoveredAuto = 0, needsReview = 0, orphan = 0;

    for (const b of blocked) {
      if (seenShadow.has(b.id)) continue;

      const contact = b.contact_id ? contactById.get(b.contact_id) : null;
      const targetName = normName(contact?.full_name || b.contact_name);
      const targetAplgo = digits(contact?.aplgo_id);
      const matches: Array<{ phone: string; full_name: string; aplgo_id: string; source: string; method: string; confidence: 'high' | 'medium' | 'low' }> = [];

      // Match cascade
      // 1) APLGO ID across contacts
      if (targetAplgo) {
        for (const c of contactsArr) {
          if (c.id === contact?.id) continue;
          if (digits(c.aplgo_id) === targetAplgo && digits(c.phone_normalized)) {
            matches.push({ phone: c.phone_normalized, full_name: c.full_name, aplgo_id: c.aplgo_id, source: 'contacts', method: 'aplgo_id', confidence: 'high' });
          }
        }
        for (const r of (importRows || [])) {
          if (digits(r.incoming_aplgo_id) === targetAplgo && digits(r.incoming_phone)) {
            matches.push({ phone: digits(r.incoming_phone), full_name: r.incoming_full_name || '', aplgo_id: r.incoming_aplgo_id || '', source: 'import_audit', method: 'aplgo_id', confidence: 'high' });
          }
        }
      }

      // 2) Exact name across contacts (with phone)
      if (targetName) {
        for (const c of contactsArr) {
          if (c.id === contact?.id) continue;
          if (normName(c.full_name) === targetName && digits(c.phone_normalized)) {
            matches.push({ phone: c.phone_normalized, full_name: c.full_name, aplgo_id: c.aplgo_id || '', source: 'contacts', method: 'full_name_exact', confidence: 'high' });
          }
        }
        // import_audit
        for (const r of (importRows || [])) {
          if (normName(r.incoming_full_name) === targetName && digits(r.incoming_phone)) {
            matches.push({ phone: digits(r.incoming_phone), full_name: r.incoming_full_name || '', aplgo_id: r.incoming_aplgo_id || '', source: 'import_audit', method: 'full_name_exact', confidence: 'high' });
          }
        }
        // orders → joined contact (gives us hint that contact_name appears)
        for (const o of (orders || [])) {
          if (normName(o.contact_name) === targetName && o.contact_id) {
            const oc = contactById.get(o.contact_id) as any;
            if (oc && digits(oc.phone_normalized) && oc.id !== contact?.id) {
              matches.push({ phone: oc.phone_normalized, full_name: oc.full_name, aplgo_id: oc.aplgo_id || '', source: 'orders', method: 'order_owner', confidence: 'high' });
            }
          }
        }
      }

      // 3) Fuzzy name (only if no high-confidence yet)
      if (matches.length === 0 && targetName) {
        for (const c of contactsArr) {
          if (c.id === contact?.id) continue;
          if (!digits(c.phone_normalized)) continue;
          const sim = trigramSim(targetName, normName(c.full_name));
          if (sim >= 0.85) {
            matches.push({ phone: c.phone_normalized, full_name: c.full_name, aplgo_id: c.aplgo_id || '', source: 'contacts', method: 'full_name_fuzzy', confidence: 'medium' });
          }
        }
      }

      // 4) Sponsor + leg + level (very weak — medium only)
      if (matches.length === 0 && contact?.sponsor_name) {
        for (const c of contactsArr) {
          if (c.id === contact.id) continue;
          if (
            normName(c.sponsor_name) === normName(contact.sponsor_name) &&
            (c.leg || '') === (contact.leg || '') &&
            (c.level || '') === (contact.level || '') &&
            digits(c.phone_normalized) &&
            normName(c.full_name) === targetName
          ) {
            matches.push({ phone: c.phone_normalized, full_name: c.full_name, aplgo_id: c.aplgo_id || '', source: 'contacts', method: 'sponsor_leg', confidence: 'medium' });
          }
        }
      }

      // 5) Maytapi last4 if we already have any partial phone hint
      const partialLast4 = digits(contact?.phone_number).slice(-4);
      if (partialLast4 && partialLast4.length === 4) {
        for (const m of (maytapiMsgs || [])) {
          if ((m.phone_last4 || '') === partialLast4 && m.phone_e164) {
            matches.push({ phone: digits(m.phone_e164), full_name: '', aplgo_id: '', source: 'maytapi_messages', method: 'whatsapp_last4', confidence: 'medium' });
          }
        }
      }

      // Deduplicate by phone, keep highest confidence first
      const order = { high: 0, medium: 1, low: 2 } as const;
      matches.sort((a, b) => order[a.confidence] - order[b.confidence]);
      const uniqByPhone = new Map<string, typeof matches[number]>();
      for (const m of matches) {
        const k = digits(m.phone);
        if (!k || k.length < 9) continue;
        if (!uniqByPhone.has(k)) uniqByPhone.set(k, m);
      }
      const unique = Array.from(uniqByPhone.values());

      let status = 'needs_review';
      let chosen: typeof matches[number] | null = null;

      if (unique.length === 0) {
        status = b.lane === 'birthday' ? 'orphan_birthday' : 'needs_review';
        orphan += b.lane === 'birthday' ? 1 : 0;
        if (b.lane !== 'birthday') needsReview++;
      } else if (unique.length === 1 && unique[0].confidence === 'high') {
        status = 'recovered_auto';
        chosen = unique[0];
        recoveredAuto++;
      } else if (unique.length === 1) {
        status = 'needs_review';
        chosen = unique[0];
        needsReview++;
      } else {
        // multiple → conflict
        status = 'duplicate_conflict';
        chosen = unique[0];
        needsReview++;
      }

      const audit = [{
        ts: new Date().toISOString(),
        action: 'scan',
        old_phone: contact?.phone_number || '',
        candidates: unique.map(u => ({ phone: u.phone, source: u.source, method: u.method, confidence: u.confidence })),
      }];

      const { error: insErr } = await admin.from('phone_rescue_candidates').insert({
        user_id: user.id,
        shadow_log_id: b.id,
        contact_id: b.contact_id,
        lane: b.lane,
        entry_key: b.entry_key || '',
        contact_name: b.contact_name || contact?.full_name || '',
        old_phone: contact?.phone_number || '',
        recovered_phone: chosen?.phone || '',
        recovered_full_name: chosen?.full_name || '',
        recovered_aplgo_id: chosen?.aplgo_id || '',
        source_table: chosen?.source || '',
        match_method: chosen?.method || '',
        confidence: chosen?.confidence || 'low',
        status,
        audit,
      });
      if (!insErr) candidatesCreated++;
    }

    return new Response(JSON.stringify({
      ok: true,
      no_sends_called: true,
      no_contact_mutations: true,
      evaluated: blocked.length,
      candidates_created: candidatesCreated,
      recovered_auto: recoveredAuto,
      needs_review: needsReview,
      orphan_birthdays: orphan,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
