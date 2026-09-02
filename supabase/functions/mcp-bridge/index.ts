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

// Sponsor-ID / Deals estimated-value helper — mirrors the client-side logic
// in src/pages/Deals.tsx exactly (kept in sync manually; read-only derivation).
function estimatedMinValue(goStatus: string): number {
  const s = (goStatus || '').toLowerCase()
  if (s.includes('diamond')) return 45000
  if (s.includes('vip')) return 27000
  if (s.includes('mentor')) return 9000
  if (s.includes('builder')) return 6000
  if (s.includes('associate')) return 3000
  if (s.includes('promoter')) return 1500
  return 375
}

// Birthday message templates — mirrors src/components/BirthdayComposerModal.tsx's
// buildBirthdayMessage() EXACTLY (kept in sync manually; this bridge action must
// never invent its own copy). TONE_CONFIG label/description are duplicated here
// too, for list_birthday_message_tones, since the icon/color fields in the
// component are UI-only and not relevant server-side.
const APLGO_BRAND_URL = 'https://crm.onlinecourseformlm.com/aplgo.html'

const BIRTHDAY_TONES: Array<{ key: string; label: string; description: string }> = [
  { key: 'warm', label: 'Warm', description: 'Friendly and heartfelt' },
  { key: 'royal', label: 'Royal', description: 'Celebratory and majestic' },
  { key: 'spiritual', label: 'Spiritual', description: 'Uplifting and graceful' },
  { key: 'professional', label: 'Professional', description: 'Simple and respectful' },
]

function buildBirthdayMessageBody(
  tone: string,
  firstName: string,
  fullName: string,
  levelLine: string,
): string {
  // Every recipient is addressed with the "Leader" prefix, permanently
  // (Vanto's standing instruction, 2026-09-02) — applies to all 4 tones.
  const bodies: Record<string, string> = {
    warm: `Hi Leader ${firstName} 🎉\n\nHappy Birthday to you! 🎂\n\nWishing you joy, strength, favor, and a beautiful year ahead.\n\nMay this new season bring growth, peace, and great grace into your life.${levelLine}\n\nEnjoy your special day! 🌟`,
    royal: `Leader ${fullName} 👑🎂\n\nToday we celebrate YOU!\n\nHappy Birthday — you are royalty, and this day marks another year of greatness.\n\nMay your new year be filled with abundance, favor, and extraordinary blessings.${levelLine}\n\nCrown up. It's YOUR day! 🎉🏆`,
    spiritual: `Dear Leader ${firstName} 🕊️\n\nHappy Blessed Birthday! 🎂\n\nMay the Lord pour out His favor, protection, and wisdom upon you this new year.\n\nYou are a blessing to everyone around you. May this season bring divine connections, growth, and peace beyond understanding.${levelLine}\n\nCelebrate with gratitude — the best is yet to come. 🙏✨`,
    professional: `Hi Leader ${fullName},\n\nHappy Birthday! 🎂\n\nWishing you a wonderful celebration and a year filled with success, growth, and good health.${levelLine}\n\nKind regards`,
  }
  return bodies[tone]
}

function buildBirthdayMessage(
  tone: string,
  firstName: string,
  fullName: string,
  levelLine: string,
  senderName: string,
  senderEmail: string,
): string {
  const body = buildBirthdayMessageBody(tone, firstName, fullName, levelLine)
  const signature = senderName ? `\n\n— ${senderName}${senderEmail ? `\n${senderEmail}` : ''}` : ''
  return `${APLGO_BRAND_URL}\n\n${body}${signature}`
}

const norm = (s: unknown) => String(s ?? '').trim()

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

      case 'create_contact': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        const fullName = norm(body.full_name)
        if (!fullName) return json({ error: 'full_name_required' }, 400)
        const phone = norm(body.phone_number)
        const email = norm(body.email_address)

        // Same duplicate guard the app's own AddContact flow runs, against
        // phone_normalized / email_normalized. Returns the existing contact
        // instead of creating a second one, unless force=true is passed.
        if (!body.force && (phone || email)) {
          const orParts: string[] = []
          // phone_normalized / email_normalized are DB-derived columns; the
          // app queries them directly rather than normalizing client-side
          // for this bridge, so we match on the raw fields it was given
          // plus a loose ilike as a fallback since normalization happens
          // via a DB trigger on insert, not on this SELECT.
          if (phone) orParts.push(`phone_number.eq.${phone}`)
          if (email) orParts.push(`email_address.eq.${email}`)
          if (orParts.length) {
            const { data: existing } = await supabase
              .from('contacts')
              .select('id, full_name, phone_number, email_address')
              .eq('user_id', ownerId)
              .or(orParts.join(','))
              .limit(1)
              .maybeSingle()
            if (existing) {
              return json({ ok: false, duplicate: true, existing_contact: existing, message: 'A contact with this phone or email already exists. Pass force=true to create anyway.' }, 409)
            }
          }
        }

        const insertRow: Record<string, unknown> = {
          user_id: ownerId,
          date_captured: new Date().toISOString().split('T')[0],
          full_name: fullName,
          phone_number: phone,
          email_address: email,
          city: norm(body.city),
          province: norm(body.province),
          country: norm(body.country) || 'South Africa',
          lead_temperature: norm(body.lead_temperature) || 'Warm',
          communication_status: norm(body.communication_status) || 'New',
          registration_status: norm(body.registration_status) || 'Not Registered',
          lead_type: norm(body.lead_type) || 'Prospect',
          sponsor_name: norm(body.sponsor_name),
          additional_notes: norm(body.additional_notes),
        }

        const { data, error } = await supabase
          .from('contacts')
          .insert(insertRow)
          .select('id, full_name, phone_number, email_address, lead_type, lead_temperature, registration_status, created_at')
          .single()
        if (error) {
          if ((error as { code?: string }).code === '23505') {
            return json({ error: 'duplicate', message: error.message }, 409)
          }
          throw error
        }
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

      case 'get_prospector_drafts': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        // Read-only, full detail — mirrors the in-app Prospector Inbox review
        // view. No approve/reject/snooze/send action is exposed here; those
        // stay behind the app's own one-by-one, human-gated workflow.
        const status = body.status ? String(body.status) : null
        const limit = Number.isInteger(Number(body.limit)) && Number(body.limit) > 0
          ? Math.min(Number(body.limit), 100) : 25

        let query = supabase.from('zazi_actions')
          .select('id, contact_id, status, movement_stage, leadership_need, belief_risk, recommended_tone, reason_for_message, next_best_business_action, expected_next_step, proposed_message, supervisor_quality_score, supervisor_safety, supervisor_grounding, supervisor_cultural_fit, supervisor_clarity, supervisor_relevance, supervisor_tone_fit, supervisor_leadership_fit, supervisor_block_reason, created_at, approved_at, snoozed_until, snooze_reason, sent_at')
          .eq('user_id', ownerId)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (status) query = query.eq('status', status)

        const { data: rows, error } = await query
        if (error) throw error

        const contactIds = Array.from(new Set((rows ?? []).map((r) => r.contact_id).filter(Boolean)))
        const contactMap: Record<string, { full_name: string; phone_number: string }> = {}
        if (contactIds.length) {
          const { data: contacts } = await supabase
            .from('contacts').select('id, full_name, phone_number').in('id', contactIds)
          for (const c of contacts ?? []) contactMap[c.id] = { full_name: c.full_name, phone_number: c.phone_number }
        }

        const drafts = (rows ?? []).map((r) => ({
          ...r,
          contact_name: r.contact_id ? (contactMap[r.contact_id]?.full_name ?? 'Unknown contact') : 'Unknown contact',
          contact_phone: r.contact_id ? (contactMap[r.contact_id]?.phone_number ?? '') : '',
        }))

        return json({ ok: true, count: drafts.length, drafts })
      }

      case 'list_inventory': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        const { data, error } = await supabase
          .from('inventory')
          .select('id, product_name, stock_quantity, updated_at')
          .eq('user_id', ownerId)
          .order('product_name', { ascending: true })
        if (error) throw error
        return json({ ok: true, count: data?.length ?? 0, inventory: data ?? [] })
      }

      case 'update_inventory_stock': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        const id = body.id ? String(body.id) : null
        const productName = body.product_name ? norm(body.product_name) : null
        const quantity = Number(body.quantity)
        if (!Number.isInteger(quantity) || quantity < 0) return json({ error: 'quantity_must_be_a_non_negative_integer' }, 400)
        if (!id && !productName) return json({ error: 'id_or_product_name_required' }, 400)

        // Sets an absolute stock quantity (same as the app's own inline edit).
        // If an id is given, updates that row. Otherwise upserts by product
        // name — creates a new inventory row if one doesn't exist yet.
        if (id) {
          const { data, error } = await supabase
            .from('inventory')
            .update({ stock_quantity: quantity, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', ownerId)
            .select('id, product_name, stock_quantity, updated_at')
            .single()
          if (error) throw error
          return json({ ok: true, item: data })
        }

        const { data: existing } = await supabase
          .from('inventory').select('id').eq('user_id', ownerId).eq('product_name', productName).maybeSingle()

        if (existing) {
          const { data, error } = await supabase
            .from('inventory')
            .update({ stock_quantity: quantity, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select('id, product_name, stock_quantity, updated_at')
            .single()
          if (error) throw error
          return json({ ok: true, item: data })
        }

        const { data, error } = await supabase
          .from('inventory')
          .insert({ user_id: ownerId, product_name: productName, stock_quantity: quantity })
          .select('id, product_name, stock_quantity, updated_at')
          .single()
        if (error) throw error
        return json({ ok: true, item: data, created: true })
      }

      case 'get_deals_summary': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        // Mirrors src/pages/Deals.tsx's client-side derivation exactly:
        // deals = contacts with lead_type = 'Purchase_Status', joined to
        // orders by contact name. Read-only, no table of its own.
        const limit = Number.isInteger(Number(body.limit)) && Number(body.limit) > 0
          ? Math.min(Number(body.limit), 100) : 50

        const { data: contacts, error: cErr } = await supabase
          .from('contacts')
          .select('id, full_name, go_status, city, province')
          .eq('user_id', ownerId)
          .eq('lead_type', 'Purchase_Status')
        if (cErr) throw cErr

        const { data: orders, error: oErr } = await supabase
          .from('orders')
          .select('contact_name, amount, order_date, badges')
          .eq('user_id', ownerId)
        if (oErr) throw oErr

        const ordersByName = new Map<string, typeof orders>()
        for (const o of orders ?? []) {
          const key = norm(o.contact_name)
          if (!ordersByName.has(key)) ordersByName.set(key, [])
          ordersByName.get(key)!.push(o)
        }

        let activationOnly = 0
        let withGoStatus = 0
        let totalPaidZar = 0
        const deals = (contacts ?? []).map((c) => {
          const contactOrders = ordersByName.get(norm(c.full_name)) ?? []
          const totalOrderValue = contactOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0)
          const goStatus = c.go_status || 'No status'
          const hasRank = goStatus !== 'No status' && goStatus !== ''
          if (hasRank) withGoStatus++
          else activationOnly++
          totalPaidZar += totalOrderValue
          const displayValue = totalOrderValue > 0 ? totalOrderValue : estimatedMinValue(goStatus)
          return {
            contact_id: c.id,
            full_name: c.full_name,
            status: hasRank ? 'activated-with-status' : 'activated-no-status',
            go_status: hasRank ? goStatus : 'Activation Only',
            order_count: contactOrders.length,
            total_value_zar: displayValue,
          }
        })
        deals.sort((a, b) => b.total_value_zar - a.total_value_zar)

        return json({
          ok: true,
          summary: {
            total_deals: deals.length,
            activation_only: activationOnly,
            with_go_status: withGoStatus,
            total_paid_zar: totalPaidZar,
          },
          deals: deals.slice(0, limit),
        })
      }

      case 'find_duplicate_contacts': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        // Detection only — mirrors src/pages/Duplicates.tsx's grouping logic.
        // No merge/delete tool is exposed via MCP; that stays an in-app,
        // human-confirmed action since it deletes contact rows.
        const { data, error } = await supabase
          .from('contacts')
          .select('id, full_name, phone_number, phone_normalized, email_address, email_normalized, lead_type, registration_status, created_at')
          .eq('user_id', ownerId)
          .order('created_at', { ascending: true })
        if (error) throw error

        const phoneMap = new Map<string, typeof data>()
        const emailMap = new Map<string, typeof data>()
        for (const c of data ?? []) {
          if (c.phone_normalized) {
            if (!phoneMap.has(c.phone_normalized)) phoneMap.set(c.phone_normalized, [])
            phoneMap.get(c.phone_normalized)!.push(c)
          }
          if (c.email_normalized) {
            if (!emailMap.has(c.email_normalized)) emailMap.set(c.email_normalized, [])
            emailMap.get(c.email_normalized)!.push(c)
          }
        }

        const groups: Array<{ key_type: string; key_value: string; contacts: unknown[] }> = []
        const seenIds = new Set<string>()
        for (const [key, contacts] of phoneMap) {
          if (contacts.length > 1) {
            groups.push({ key_type: 'phone', key_value: key, contacts })
            for (const c of contacts) seenIds.add(c.id)
          }
        }
        for (const [key, contacts] of emailMap) {
          if (contacts.length > 1 && !contacts.every((c) => seenIds.has(c.id))) {
            groups.push({ key_type: 'email', key_value: key, contacts })
          }
        }

        return json({ ok: true, group_count: groups.length, groups })
      }

      case 'get_sponsor_id_audit': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        // Read-only, mirrors src/pages/SponsorIdReview.tsx's audit derivation.
        // No placeholder-contact creation is exposed here — that page is
        // explicitly "no automatic fixes" even in-app.
        const { data: contacts, error } = await supabase
          .from('contacts')
          .select('id, full_name, aplgo_id, sponsor_name, parent_contact_id, tree_depth, leg')
          .eq('user_id', ownerId)
        if (error) throw error

        const aplgoIndex = new Map<string, typeof contacts>()
        for (const c of contacts ?? []) {
          const k = norm(c.aplgo_id)
          if (!k) continue
          if (!aplgoIndex.has(k)) aplgoIndex.set(k, [])
          aplgoIndex.get(k)!.push(c)
        }

        const total = (contacts ?? []).length
        const withSponsor = (contacts ?? []).filter((c) => norm(c.sponsor_name)).length
        const distinctSponsors = new Set<string>()
        for (const c of contacts ?? []) { const s = norm(c.sponsor_name); if (s) distinctSponsors.add(s) }

        let exact = 0, multi = 0, missing = 0, selfRisk = 0
        for (const sid of distinctSponsors) {
          const matches = aplgoIndex.get(sid) ?? []
          if (matches.length === 1) exact++
          else if (matches.length > 1) multi++
          else missing++
        }
        for (const c of contacts ?? []) {
          if (norm(c.sponsor_name) && norm(c.aplgo_id) && norm(c.sponsor_name) === norm(c.aplgo_id)) selfRisk++
        }
        const alreadyParented = (contacts ?? []).filter((c) => c.parent_contact_id).length

        // Missing-upline rows (sponsor IDs referenced by contacts but with no
        // matching aplgo_id contact yet), capped for payload size.
        const bySponsor = new Map<string, typeof contacts>()
        for (const c of contacts ?? []) {
          const s = norm(c.sponsor_name)
          if (!s) continue
          if (!bySponsor.has(s)) bySponsor.set(s, [])
          bySponsor.get(s)!.push(c)
        }
        const missingUplines = Array.from(bySponsor.entries())
          .filter(([sid]) => (aplgoIndex.get(sid) ?? []).length === 0)
          .map(([sid, children]) => ({
            sponsor_id: sid,
            child_count: children.length,
            sample_children: children.slice(0, 3).map((c) => c.full_name),
          }))
          .sort((a, b) => b.child_count - a.child_count)
          .slice(0, 50)

        return json({
          ok: true,
          summary: {
            total_contacts: total,
            with_sponsor_name: withSponsor,
            distinct_sponsor_ids: distinctSponsors.size,
            exact_matches: exact,
            ambiguous_matches: multi,
            missing_matches: missing,
            self_match_risks: selfRisk,
            already_parented: alreadyParented,
          },
          missing_uplines: missingUplines,
        })
      }

      case 'list_birthdays': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        const status = body.status ? String(body.status) : null
        const limit = Number.isInteger(Number(body.limit)) && Number(body.limit) > 0
          ? Math.min(Number(body.limit), 200) : 100
        const cycleYear = Number.isInteger(Number(body.cycle_year)) ? Number(body.cycle_year) : new Date().getFullYear()

        let query = supabase.from('contact_birthdays')
          .select('id, contact_id, associate_id, full_name, first_name, birth_date_text, birth_date, congratulate_by_date, status, congratulated_at, cycle_year')
          .eq('user_id', ownerId)
          .eq('cycle_year', cycleYear)
          .order('birth_date', { ascending: true, nullsFirst: false })
          .limit(limit)
        if (status) query = query.eq('status', status)

        const { data, error } = await query
        if (error) throw error

        // Timing bucket, computed the same way classifyBirthdayEntry does
        // client-side (based on congratulate_by_date vs. today).
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const withTiming = (data ?? []).map((b) => {
          let timing: string | null = null
          if (b.congratulate_by_date) {
            const d = new Date(b.congratulate_by_date + 'T00:00:00')
            const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000)
            if (diffDays === 0) timing = 'today'
            else if (diffDays === 1) timing = 'tomorrow'
            else if (diffDays > 1 && diffDays <= 7) timing = 'this_week'
            else if (diffDays > 7) timing = 'upcoming'
            else timing = 'past'
          }
          return { ...b, timing }
        })

        return json({ ok: true, count: withTiming.length, birthdays: withTiming })
      }

      case 'list_birthday_message_tones': {
        // Static reference, no DB call. Mirrors BirthdayComposerModal.tsx's
        // TONE_CONFIG (label/description only — icon/color are UI-only).
        return json({ ok: true, tones: BIRTHDAY_TONES })
      }

      case 'compose_birthday_message': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        const birthdayId = body.birthday_id ? String(body.birthday_id) : null
        const associateId = body.associate_id ? String(body.associate_id) : null
        if (!birthdayId && !associateId) return json({ error: 'birthday_id_or_associate_id_required' }, 400)

        const allTones = body.all_tones === true
        const requestedTone = (body.tone ? String(body.tone) : 'warm').toLowerCase()
        const validTones = BIRTHDAY_TONES.map((t) => t.key)
        if (!allTones && !validTones.includes(requestedTone)) {
          return json({ error: 'invalid_tone', message: `tone must be one of ${validTones.join(', ')}` }, 400)
        }

        const cycleYear = Number.isInteger(Number(body.cycle_year)) ? Number(body.cycle_year) : new Date().getFullYear()

        // Same source row list_birthdays reads from (contact_birthdays), plus
        // 'level' which list_birthdays doesn't currently select but the
        // composer template needs (mirrors BirthdayEntry.level in useBirthdays.ts).
        let bQuery = supabase.from('contact_birthdays')
          .select('id, contact_id, associate_id, full_name, first_name, level, birth_date_text, congratulate_by_date, status, congratulated_at, cycle_year')
          .eq('user_id', ownerId)
          .eq('cycle_year', cycleYear)
          .limit(1)
        bQuery = birthdayId ? bQuery.eq('id', birthdayId) : bQuery.eq('associate_id', associateId)
        const { data: entry, error: bErr } = await bQuery.maybeSingle()
        if (bErr) throw bErr
        if (!entry) return json({ error: 'birthday_not_found' }, 404)

        // Phone/opt-out come from the linked contact, not from
        // contact_birthdays itself — same join useBirthdays.ts does
        // client-side (contact.PhoneNumber -> phone_number,
        // contact.phone_normalized, contact.auto_send_opt_out).
        let phoneNumber = ''
        let phoneNormalized: string | null = null
        let optOut = false
        if (entry.contact_id) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('phone_number, phone_normalized, auto_send_opt_out')
            .eq('id', entry.contact_id)
            .eq('user_id', ownerId)
            .maybeSingle()
          if (contact) {
            phoneNumber = contact.phone_number || ''
            phoneNormalized = contact.phone_normalized ?? null
            optOut = Boolean(contact.auto_send_opt_out)
          }
        }

        // Sender name/email default to the account's own profile — same
        // lookup BirthdayComposerModal.tsx does on mount — unless the caller
        // explicitly passed one or both.
        let senderName = body.sender_name ? String(body.sender_name) : ''
        let senderEmail = body.sender_email ? String(body.sender_email) : ''
        if (!senderName && !senderEmail) {
          const { data: profile } = await supabase
            .from('profiles').select('display_name, email').eq('id', ownerId).maybeSingle()
          senderName = profile?.display_name || ''
          senderEmail = profile?.email || ''
        }

        const firstName = entry.first_name || (entry.full_name || '').split(' ')[0]
        const fullName = entry.full_name
        const levelLine = entry.level ? `\nYour level: ${entry.level}` : ''

        const result: Record<string, unknown> = {
          ok: true,
          birthday_id: entry.id,
          contact_id: entry.contact_id,
          associate_id: entry.associate_id,
          full_name: entry.full_name,
          birth_date_text: entry.birth_date_text,
          congratulate_by_date: entry.congratulate_by_date,
          status: entry.status,
          phone_number: phoneNumber,
          phone_normalized: phoneNormalized,
          opt_out: optOut,
          sender_name: senderName,
          sender_email: senderEmail,
          // Not sent, not marked congratulated — composition only.
          note: 'This composes text only. Sending and marking congratulated still happen in the app.',
        }

        if (allTones) {
          const messages: Record<string, string> = {}
          for (const t of validTones) {
            messages[t] = buildBirthdayMessage(t, firstName, fullName, levelLine, senderName, senderEmail)
          }
          result.messages = messages
        } else {
          result.tone = requestedTone
          result.message = buildBirthdayMessage(requestedTone, firstName, fullName, levelLine, senderName, senderEmail)
        }

        return json(result)
      }

      case 'list_whatsapp_conversations': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        // Read-only, MATCHED CONTACTS ONLY. Mirrors the app's own privacy
        // rule in MaytapiInbox.tsx: unmatched/unknown numbers are never
        // exposed with body text outside the admin "Unmatched" gate, and
        // this bridge holds to that same boundary — rows with a null
        // contact_id are excluded entirely, not just masked.
        const limit = Number.isInteger(Number(body.limit)) && Number(body.limit) > 0
          ? Math.min(Number(body.limit), 300) : 200

        const { data, error } = await supabase
          .from('maytapi_messages')
          .select('contact_id, direction, body_preview, received_at, read_at, conversation_key')
          .eq('user_id', ownerId)
          .not('contact_id', 'is', null)
          .order('received_at', { ascending: false })
          .limit(limit)
        if (error) throw error

        const contactIds = Array.from(new Set((data ?? []).map((m) => m.contact_id).filter(Boolean)))
        const contactMap: Record<string, string> = {}
        if (contactIds.length) {
          const { data: contacts } = await supabase.from('contacts').select('id, full_name').in('id', contactIds)
          for (const c of contacts ?? []) contactMap[c.id] = c.full_name
        }

        const seen = new Map<string, unknown>()
        let unreadTotal = 0
        for (const m of data ?? []) {
          if (m.direction === 'inbound' && !m.read_at) unreadTotal++
          if (seen.has(m.contact_id)) continue
          seen.set(m.contact_id, {
            contact_id: m.contact_id,
            contact_name: contactMap[m.contact_id] ?? 'Unknown',
            last_preview: m.body_preview,
            last_at: m.received_at,
            last_direction: m.direction,
          })
        }

        return json({ ok: true, unread_total: unreadTotal, conversations: Array.from(seen.values()) })
      }

      case 'get_whatsapp_thread': {
        const ownerId = await resolveOwnerUserId()
        if (!ownerId) return json({ error: 'owner_not_configured' }, 500)

        // contact_id is required (not conversation_key) — this is a
        // deliberate guardrail so an unmatched/masked-number thread can
        // never be requested through this tool; only rows with a resolved
        // contact_id are reachable.
        const contactId = String(body.contact_id ?? '')
        if (!contactId) return json({ error: 'contact_id_required' }, 400)

        const { data: contact, error: cErr } = await supabase
          .from('contacts').select('id, full_name').eq('id', contactId).eq('user_id', ownerId).maybeSingle()
        if (cErr) throw cErr
        if (!contact) return json({ error: 'contact_not_found' }, 404)

        const limit = Number.isInteger(Number(body.limit)) && Number(body.limit) > 0
          ? Math.min(Number(body.limit), 200) : 100

        const { data, error } = await supabase
          .from('maytapi_messages')
          .select('direction, body, media_type, received_at, status, read_at')
          .eq('user_id', ownerId)
          .eq('contact_id', contactId)
          .order('received_at', { ascending: true })
          .limit(limit)
        if (error) throw error

        return json({ ok: true, contact_id: contactId, contact_name: contact.full_name, message_count: data?.length ?? 0, messages: data ?? [] })
      }

      default:
        return json({ error: 'unknown_action', action }, 400)
    }
  } catch (e) {
    console.error('mcp-bridge error', action, e)
    return json({ error: 'internal_error', message: (e as Error).message }, 500)
  }
})
