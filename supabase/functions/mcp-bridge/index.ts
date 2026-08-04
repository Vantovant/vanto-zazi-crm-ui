import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mcp-token',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Timing-safe string compare — same convention already used in
// _shared/secret-verify.ts elsewhere in this repo.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  const len = Math.max(ab.length, bb.length)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // ---- Fail-closed auth: missing/wrong token -> 401. No fallback "system" path. ----
  const expected = Deno.env.get('MCP_BRIDGE_TOKEN')
  const provided = req.headers.get('x-mcp-token')
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const action = String(body.action ?? '')

  // MCP tools operate on behalf of a single configured account (same
  // DEFAULT_OWNER_EMAIL / ZAZI_DEFAULT_OWNER_EMAIL convention already used
  // by crm-webhook), NOT across every tenant in this multi-user app. This is
  // a deliberate scoping choice: the service-role key bypasses RLS entirely,
  // so without this the bridge could read/write any user's data.
  async function resolveOwnerUserId(): Promise<string | null> {
    const email = (
      Deno.env.get('DEFAULT_OWNER_EMAIL') ??
      Deno.env.get('ZAZI_DEFAULT_OWNER_EMAIL') ??
      ''
    ).toLowerCase().trim()
    if (!email) return null
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()
    return data?.id ?? null
  }

  try {
    switch (action) {
      case 'list_contacts': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) {
          return json({ error: 'owner_not_configured', message: 'Set DEFAULT_OWNER_EMAIL secret on this function.' }, 500)
        }

        const leadType = body.lead_type ? String(body.lead_type) : null
        const temperature = body.lead_temperature ? String(body.lead_temperature) : null
        const registrationStatus = body.registration_status ? String(body.registration_status) : null
        const search = body.search ? String(body.search) : null
        const limit = Number.isInteger(Number(body.limit)) && Number(body.limit) > 0
          ? Math.min(Number(body.limit), 100) : 25

        let query = supabase.from('contacts')
          .select('id, full_name, phone_number, phone_normalized, email_address, lead_type, lead_temperature, registration_status, communication_status, assigned_to, next_action, updated_at')
          .eq('user_id', ownerId)
          .order('updated_at', { ascending: false })
          .limit(limit)
        if (leadType) query = query.eq('lead_type', leadType)
        if (temperature) query = query.eq('lead_temperature', temperature)
        if (registrationStatus) query = query.eq('registration_status', registrationStatus)
        if (search) query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%,email_address.ilike.%${search}%`)

        const { data, error } = await query
        if (error) throw error
        return json({ ok: true, count: data?.length ?? 0, contacts: data ?? [] })
      }

      case 'get_contact': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        const contactId = body.contact_id ? String(body.contact_id) : null
        const phone = body.phone_normalized ? String(body.phone_normalized) : null
        if (!contactId && !phone) return json({ error: 'contact_id_or_phone_normalized_required' }, 400)

        let query = supabase.from('contacts').select('*').eq('user_id', ownerId).limit(1)
        query = contactId ? query.eq('id', contactId) : query.eq('phone_normalized', phone)
        const { data: contact, error } = await query.maybeSingle()
        if (error) throw error
        if (!contact) return json({ error: 'contact_not_found' }, 404)

        const { data: recentActivity } = await supabase
          .from('contact_activities')
          .select('activity_type, summary, notes, next_action, created_at')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(10)

        return json({ ok: true, contact, recent_activity: recentActivity ?? [] })
      }

      case 'update_contact': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        const contactId = String(body.contact_id ?? '')
        if (!contactId) return json({ error: 'contact_id_required' }, 400)

        // Only fields explicitly provided are changed. lead_type / lead_temperature /
        // registration_status / communication_status are FREE TEXT at the DB level in
        // this app (their CHECK constraints were dropped in migration
        // 20260210103356_68eb302b...sql) — accepted as provided, not coerced into a
        // hardcoded enum that could reject legitimate values the app itself uses
        // (e.g. "Expired", "Registered_Nopurchase" appear elsewhere in this codebase).
        // Phone number is intentionally NOT editable here — avoids colliding with
        // duplicate-detection / phone_normalized matching; use the app UI for that.
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        const allowed = [
          'full_name', 'email_address', 'lead_type', 'lead_temperature',
          'registration_status', 'communication_status', 'assigned_to',
          'next_action', 'sponsor_name', 'city', 'province', 'country',
        ]
        for (const key of allowed) {
          if (body[key] !== undefined) {
            updates[key] = typeof body[key] === 'string' ? (body[key] as string).trim() : body[key]
          }
        }
        if (Object.keys(updates).length === 1) return json({ error: 'no_updatable_fields_provided' }, 400)

        const { data, error } = await supabase
          .from('contacts')
          .update(updates)
          .eq('id', contactId)
          .eq('user_id', ownerId)
          .select('id, full_name, email_address, lead_type, lead_temperature, registration_status, communication_status, assigned_to, next_action, updated_at')
          .single()
        if (error) throw error
        return json({ ok: true, contact: data })
      }

      case 'add_contact_note': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        const contactId = String(body.contact_id ?? '')
        const note = String(body.note ?? '').trim()
        if (!contactId) return json({ error: 'contact_id_required' }, 400)
        if (!note) return json({ error: 'note_required' }, 400)

        const { data: contact, error: cErr } = await supabase
          .from('contacts').select('id').eq('id', contactId).eq('user_id', ownerId).maybeSingle()
        if (cErr) throw cErr
        if (!contact) return json({ error: 'contact_not_found' }, 404)

        // Strictly additive — inserts a new contact_activities row, never edits
        // or overwrites any existing activity entry.
        const { data: inserted, error } = await supabase.from('contact_activities').insert({
          user_id: ownerId,
          contact_id: contactId,
          activity_type: 'note',
          summary: 'Note added via Claude/MCP',
          notes: note,
          next_action: '',
        }).select('id, created_at').single()
        if (error) throw error

        return json({ ok: true, contact_id: contactId, activity_id: inserted.id, created_at: inserted.created_at })
      }

      case 'list_orders': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        const status = body.status ? String(body.status) : null
        const contactId = body.contact_id ? String(body.contact_id) : null
        const limit = Number.isInteger(Number(body.limit)) && Number(body.limit) > 0
          ? Math.min(Number(body.limit), 100) : 25

        // Read-only by design — order creation/editing is not exposed via MCP.
        let query = supabase.from('orders')
          .select('id, order_id, contact_id, contact_name, product, quantity, amount, status, order_date, badges')
          .eq('user_id', ownerId)
          .order('order_date', { ascending: false })
          .limit(limit)
        if (status) query = query.eq('status', status)
        if (contactId) query = query.eq('contact_id', contactId)

        const { data, error } = await query
        if (error) throw error
        return json({ ok: true, count: data?.length ?? 0, orders: data ?? [] })
      }

      case 'get_prospector_status': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        // Read-only — never touches zazi_actions, never sends anything.
        const { data: actions, error: aErr } = await supabase
          .from('zazi_actions').select('status').eq('user_id', ownerId)
        if (aErr) throw aErr
        const counts: Record<string, number> = {}
        for (const row of actions ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1

        const { data: pending, error: pErr } = await supabase
          .from('zazi_actions')
          .select('id, contact_id, status, movement_stage, created_at')
          .eq('user_id', ownerId)
          .in('status', ['draft', 'proposed'])
          .order('created_at', { ascending: false })
          .limit(20)
        if (pErr) throw pErr

        return json({ ok: true, counts_by_status: counts, pending_review: pending ?? [] })
      }

      default:
        return json({ error: 'unknown_action', action }, 400)
    }
  } catch (e) {
    console.error('mcp-bridge error', action, e)
    return json({ error: 'internal_error', message: (e as Error).message }, 500)
  }
})
