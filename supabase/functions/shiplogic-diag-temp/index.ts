import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const key = Deno.env.get('SHIPLOGIC_API_KEY') ?? ''
  const fingerprint = key ? `${key.slice(0, 6)}…${key.slice(-4)} (len ${key.length})` : 'MISSING'
  const results: unknown[] = []
  for (const url of ['https://api.shiplogic.com/shipments?limit=1', 'https://api.shiplogic.com/v2/shipments?limit=1']) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      })
      results.push({ url, status: r.status, body: (await r.text()).slice(0, 800) })
    } catch (e) {
      results.push({ url, error: String(e) })
    }
  }
  return new Response(JSON.stringify({ fingerprint, results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
