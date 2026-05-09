// Phone Rescue Promote/Reject + Retry Eligibility — admin-only.
//
// HARD LOCKS:
//  - Never overwrites a non-empty contacts.phone_number (verified phones safe).
//  - No Maytapi sends. No zazi_actions writes.
//  - Promotion writes contacts.phone_number ONLY if currently empty.
//  - Audit row appended to phone_rescue_candidates.audit jsonb.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const { data: roles } = await admin.from('user_roles')
      .select('role').eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { candidate_id, action, override_phone } = body as { candidate_id: string; action: 'promote' | 'reject' | 'retry'; override_phone?: string };

    if (!candidate_id || !['promote', 'reject', 'retry'].includes(action)) {
      return new Response(JSON.stringify({ ok: false, error: 'bad_request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: cand } = await admin.from('phone_rescue_candidates')
      .select('*').eq('id', candidate_id).eq('user_id', user.id).maybeSingle();
    if (!cand) {
      return new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const audit = Array.isArray(cand.audit) ? [...cand.audit] : [];

    if (action === 'reject') {
      audit.push({ ts: new Date().toISOString(), action: 'rejected', by: user.id });
      await admin.from('phone_rescue_candidates').update({
        status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: user.id, audit,
      }).eq('id', candidate_id);
      return new Response(JSON.stringify({ ok: true, action: 'rejected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'promote') {
      const newPhone = (override_phone || cand.recovered_phone || '').replace(/\D/g, '');
      if (!newPhone || newPhone.length < 9) {
        return new Response(JSON.stringify({ ok: false, error: 'no_phone_to_promote' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!cand.contact_id) {
        return new Response(JSON.stringify({ ok: false, error: 'no_contact_to_link' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Read current contact phone
      const { data: contact } = await admin.from('contacts')
        .select('id, phone_number, full_name').eq('id', cand.contact_id).eq('user_id', user.id).maybeSingle();
      if (!contact) {
        return new Response(JSON.stringify({ ok: false, error: 'contact_not_found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const existingDigits = (contact.phone_number || '').replace(/\D/g, '');
      if (existingDigits.length >= 9) {
        // SAFETY: never overwrite verified phone
        audit.push({ ts: new Date().toISOString(), action: 'blocked_existing_phone', existing: contact.phone_number, attempted: newPhone, by: user.id });
        await admin.from('phone_rescue_candidates').update({
          status: 'duplicate_conflict', audit,
        }).eq('id', candidate_id);
        return new Response(JSON.stringify({ ok: false, error: 'existing_phone_present', existing: contact.phone_number }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updErr } = await admin.from('contacts')
        .update({ phone_number: newPhone })
        .eq('id', cand.contact_id).eq('user_id', user.id);
      if (updErr) throw updErr;

      audit.push({
        ts: new Date().toISOString(), action: 'promoted',
        old_phone: contact.phone_number || '', new_phone: newPhone,
        source: cand.source_table, method: cand.match_method, by: user.id,
      });
      await admin.from('phone_rescue_candidates').update({
        status: 'promoted', resolved_at: new Date().toISOString(), resolved_by: user.id, audit,
      }).eq('id', candidate_id);

      return new Response(JSON.stringify({ ok: true, action: 'promoted', contact_id: cand.contact_id, new_phone: newPhone }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // action === 'retry' → invoke shadow scan again to re-evaluate
    audit.push({ ts: new Date().toISOString(), action: 'retry_requested', by: user.id });
    await admin.from('phone_rescue_candidates').update({ audit }).eq('id', candidate_id);

    const r = await fetch(`${SUPABASE_URL}/functions/v1/auto-send-shadow-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') || '',
      },
    });
    const scanResult = await r.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: true, action: 'retry', scan: scanResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
