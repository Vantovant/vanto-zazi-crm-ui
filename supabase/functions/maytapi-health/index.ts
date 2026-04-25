// Phase E.0 — Maytapi health check (admin-only, no sending)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid JWT' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from('user_roles').select('role').eq('user_id', callerId).eq('role', 'admin').maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const productId = Deno.env.get('MAYTAPI_PRODUCT_ID');
    const phoneId = Deno.env.get('MAYTAPI_PHONE_ID');
    const apiToken = Deno.env.get('MAYTAPI_API_TOKEN');

    const secretsReport = {
      MAYTAPI_PRODUCT_ID: !!productId,
      MAYTAPI_PHONE_ID: !!phoneId,
      MAYTAPI_API_TOKEN: !!apiToken,
    };

    if (!productId || !phoneId || !apiToken) {
      return new Response(JSON.stringify({
        ok: false, secrets: secretsReport, error: 'One or more Maytapi secrets missing',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Maytapi status endpoint: https://api.maytapi.com/api/{productId}/{phoneId}/status
    const statusUrl = `https://api.maytapi.com/api/${productId}/${phoneId}/status`;
    let upstream: Response;
    try {
      upstream = await fetch(statusUrl, { headers: { 'x-maytapi-key': apiToken } });
    } catch (e) {
      return new Response(JSON.stringify({
        ok: false, secrets: secretsReport, error: `Network error to Maytapi: ${(e as Error).message}`,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const upstreamText = await upstream.text();
    let upstreamJson: any = null;
    try { upstreamJson = JSON.parse(upstreamText); } catch { /* keep as text */ }

    // Sanitize — never echo token
    const sanitized = upstreamJson ? {
      success: upstreamJson.success ?? null,
      status: upstreamJson.data?.status ?? upstreamJson.status ?? null,
      number: upstreamJson.data?.number ? `***${String(upstreamJson.data.number).slice(-4)}` : null,
      type: upstreamJson.data?.type ?? null,
      message: upstreamJson.message ?? null,
    } : { raw_excerpt: upstreamText.slice(0, 200) };

    return new Response(JSON.stringify({
      ok: upstream.ok && (upstreamJson?.success !== false),
      http_status: upstream.status,
      secrets: secretsReport,
      maytapi: sanitized,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
