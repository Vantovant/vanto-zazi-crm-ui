// Ported 1:1 from supabase/functions/mcp-bridge/index.ts (logic, inputs, limits).
// Runs with the caller's own token under RLS; ownerId = verified token subject.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
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

// ---------------------------------------------------------------------------
// Monthly Activity Paste — parsing/matching/dedupe helpers.
// These MUST mirror the app's own client-side logic exactly (per the
// server-side-mirror contract in this tool's description), so this bridge
// action can never silently diverge from what a human pasting in the app
// would get. Sources, kept in sync manually:
//   - src/utils/monthlyActivityParser.ts  (parseMonthlyActivityReport)
//   - src/utils/aplgoId.ts                (sanitizeAplgoId)
//   - src/utils/monthlyActivityKey.ts     (normalizeActivityMonth)
//   - src/components/MonthlyActivityPasteModal.tsx (MP0.1 sig/dedupe/Needs-Review branch order)
//   - src/hooks/useOrders.ts              (order insert shape, findOverlappingActivityPeriods)
//   - src/hooks/useWaitingRoom.ts         (contact_waiting_room insert shape)
// ---------------------------------------------------------------------------

interface MonthlyActivityParsedRow {
  userId: string
  displayedLevel: string
  actualLevel: string
  amount: number
}

function parseMonthlyActivityReport(text: string): MonthlyActivityParsedRow[] {
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const rows: MonthlyActivityParsedRow[] = []
  let currentLevel = ''

  const levelHeaderRe = /^level\s+(\d+)$/i
  // Matches: 1129930(6): 2,520.00 R  or  934517: 2385.00 R
  const entryRe = /(\d{4,})(?:\((\d+)\))?\s*:\s*(\d[\d.,]*\d)\s*R\b/gi

  for (const rawLine of rawLines) {
    const headerMatch = rawLine.match(levelHeaderRe)
    if (headerMatch) {
      currentLevel = headerMatch[1]
      continue
    }
    let match: RegExpExecArray | null
    entryRe.lastIndex = 0
    while ((match = entryRe.exec(rawLine)) !== null) {
      const userId = match[1]
      const bracketLevel = match[2] || ''
      const amount = parseFloat(match[3].replace(/,/g, ''))
      rows.push({
        userId,
        displayedLevel: currentLevel || '?',
        actualLevel: bracketLevel || currentLevel || '?',
        amount: isNaN(amount) ? 0 : amount,
      })
    }
  }
  return rows
}

// APLGO ID is digits-only. Mirrors the DB trigger sanitize_contact_aplgo_id()
// so client, DB, and this bridge always agree on the canonical stored value.
function sanitizeAplgoId(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  return String(raw).replace(/[^0-9]/g, '')
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_INDEX: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  MONTH_NAMES.forEach((name, i) => {
    m[name.toLowerCase()] = i
    m[name.slice(0, 3).toLowerCase()] = i
  })
  return m
})()

// Returns canonical "YYYY-MM" or empty string. Accepts "April 2026", "Apr 2026",
// "2026-04", "Monthly Activity - April 2026", or any Date-parseable string.
function normalizeActivityMonth(input: string | null | undefined): string {
  if (!input) return ''
  const raw = String(input).trim()
  if (!raw) return ''
  const cleaned = raw.replace(/^Monthly Activity\s*-\s*/i, '').trim()

  const ymd = cleaned.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)
  if (ymd) {
    const y = ymd[1]
    const m = String(parseInt(ymd[2], 10)).padStart(2, '0')
    return `${y}-${m}`
  }

  const named = cleaned.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (named) {
    const idx = MONTH_INDEX[named[1].toLowerCase()]
    if (idx !== undefined) return `${named[2]}-${String(idx + 1).padStart(2, '0')}`
  }

  const d = new Date(cleaned)
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return ''
}

// ---------------------------------------------------------------------------
// Call Sheets helpers (v2.1.0) — mirror src/lib/callSheets.ts.
// ---------------------------------------------------------------------------
const CS_OUTCOMES = ['Answered', 'No answer', 'Call back', 'Wrong number', 'Not interested']
const CS_BUCKETS = ['open', 'new', 'steady', 'little']
const CS_DEFAULTS = { min_level: 1, max_level: 5, new_days: 30, steady_days: 60, export_fresh_days: 45 }
const csIsNoise = (t: string) =>
  /october vip/i.test(t) || /appreciation|thank you for your (monthly )?activity|auto[- ]?sent/i.test(t)
const csToday = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10) // SAST date
const csLimit = (v: unknown, def: number, max: number) =>
  Number.isInteger(Number(v)) && Number(v) > 0 ? Math.min(Number(v), max) : def
const MEDIA_LABELS: Record<string, string> = { ptt: 'Voice note', audio: 'Voice note', image: 'Image', video: 'Video', document: 'Document', sticker: 'Sticker' }
function cs_msg(m: any) {
  const text = norm(m.body || m.body_preview)
  return {
    direction: m.direction, date: m.received_at, received_at: m.received_at,
    text: text || null,
    media_label: text ? null : (MEDIA_LABELS[String(m.media_type ?? '').toLowerCase()] ?? (m.media_type ? `Media (${m.media_type})` : 'No text')),
    media_type: m.media_type ?? null, status: m.status, read_at: m.read_at, body: m.body,
  }
}
// One card per person: same aplgo_id or phone_normalized → keep the first.
function csDedupe(rows: any[]) {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const keys = [r.aplgo_id ? `a:${r.aplgo_id}` : '', r.phone_normalized ? `p:${r.phone_normalized}` : ''].filter(Boolean)
    if (keys.some((k) => seen.has(k))) return false
    keys.forEach((k) => seen.add(k)); return true
  })
}
async function csHistory(sb: any, ownerId: string, ids: string[], perPerson: number) {
  const map: Record<string, { at: string; text: string }[]> = {}
  if (!ids.length) return map
  const push = (id: string, l: { at: string; text: string }) => { (map[id] ||= []).push(l) }
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    const [acts, ords, msgs] = await Promise.all([
      sb.from('contact_activities').select('contact_id,created_at,summary,notes,activity_type').eq('user_id', ownerId).in('contact_id', chunk).order('created_at', { ascending: false }).limit(2000),
      sb.from('orders').select('contact_id,order_date,product,amount').eq('user_id', ownerId).in('contact_id', chunk).order('order_date', { ascending: false }).limit(1000),
      sb.from('maytapi_messages').select('contact_id,received_at,direction,body,body_preview').eq('user_id', ownerId).in('contact_id', chunk).order('received_at', { ascending: false }).limit(1000),
    ])
    for (const a of acts.data ?? []) {
      const t = [a.summary, a.notes].filter(Boolean).join(' — ')
      if (!t || csIsNoise(t)) continue
      push(a.contact_id, { at: a.created_at, text: a.activity_type === 'call' ? `Call: ${t}` : t })
    }
    for (const o of ords.data ?? []) push(o.contact_id, { at: o.order_date, text: `Order: ${o.product} (R${Number(o.amount).toFixed(0)})` })
    for (const m of msgs.data ?? []) {
      const b = norm(m.body || m.body_preview)
      if (!b || csIsNoise(b)) continue
      push(m.contact_id, { at: m.received_at, text: `${m.direction === 'inbound' ? 'WhatsApp from them' : 'WhatsApp sent'}: ${b.slice(0, 90)}` })
    }
  }
  for (const k of Object.keys(map)) map[k] = map[k].sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, perPerson)
  return map
}
async function csFindContact(sb: any, ownerId: string, body: Record<string, unknown>):
  Promise<{ id: string } | { error: string; status: number }> {
  const sel = () => sb.from('contacts').select('id').eq('user_id', ownerId).order('updated_at', { ascending: false }).limit(1)
  if (body.contact_id) {
    const { data } = await sel().eq('id', String(body.contact_id))
    return data?.[0] ? { id: data[0].id } : { error: 'contact_not_found', status: 404 }
  }
  const aplgo = sanitizeAplgoId(body.aplgo_id)
  if (aplgo) {
    const { data } = await sel().eq('aplgo_id', aplgo)
    return data?.[0] ? { id: data[0].id } : { error: 'contact_not_found', status: 404 }
  }
  if (norm(body.phone)) {
    const { data: pn } = await sb.rpc('normalize_phone', { raw: norm(body.phone) })
    if (!pn) return { error: 'contact_not_found', status: 404 }
    const { data } = await sel().eq('phone_normalized', pn)
    return data?.[0] ? { id: data[0].id } : { error: 'contact_not_found', status: 404 }
  }
  return { error: 'contact_id_or_aplgo_id_or_phone_required', status: 400 }
}


export interface ActionResult { status: number; body: Record<string, unknown> }
const r = (body: any, status = 200): ActionResult => ({ status, body })

export async function runAction(action: string, body: Record<string, any>, supabase: any, ownerId: string): Promise<ActionResult> {
    switch (action) {
      case 'list_contacts': {

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
        return r({ ok: true, count: data?.length ?? 0, contacts: data ?? [] })
      }

      case 'get_contact': {

        const contactId = body.contact_id ? String(body.contact_id) : null
        const phone = body.phone_normalized ? String(body.phone_normalized) : null
        if (!contactId && !phone) return r({ error: 'contact_id_or_phone_normalized_required' }, 400)

        let query = supabase.from('contacts').select('*').eq('user_id', ownerId).limit(1)
        query = contactId ? query.eq('id', contactId) : query.eq('phone_normalized', phone)
        const { data: contact, error } = await query.maybeSingle()
        if (error) throw error
        if (!contact) return r({ error: 'contact_not_found' }, 404)

        const { data: recentActivity } = await supabase
          .from('contact_activities')
          .select('activity_type, summary, notes, next_action, created_at')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(10)

        return r({ ok: true, contact, recent_activity: recentActivity ?? [] })
      }

      case 'update_contact': {

        const contactId = String(body.contact_id ?? '')
        if (!contactId) return r({ error: 'contact_id_required' }, 400)

        // Only fields explicitly provided are changed. lead_type / lead_temperature /
        // registration_status / communication_status are FREE TEXT at the DB level in
        // this app (their CHECK constraints were dropped in migration
        // 20260210103356_68eb302b...sql) — accepted as provided, not coerced into a
        // hardcoded enum that could reject legitimate values the app itself uses
        // (e.g. "Expired", "Registered_Nopurchase" appear elsewhere in this codebase).
        // Phone number is intentionally NOT editable here — avoids colliding with
        // duplicate-detection / phone_normalized matching; use the app UI for that.
        // aplgo_id IS editable here (added 2026-09-19, per Vanto's explicit request) —
        // this is the field the app's own Monthly Activity Paste modal matches
        // pasted-report rows against, so being able to set it via MCP directly
        // closes the loop on newly-created contacts that come in unmatched.
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        const allowed = [
          'full_name', 'email_address', 'aplgo_id', 'lead_type', 'lead_temperature',
          'registration_status', 'communication_status', 'assigned_to',
          'next_action', 'sponsor_name', 'city', 'province', 'country',
        ]
        for (const key of allowed) {
          if (body[key] !== undefined) {
            updates[key] = typeof body[key] === 'string' ? (body[key] as string).trim() : body[key]
          }
        }
        if (Object.keys(updates).length === 1) return r({ error: 'no_updatable_fields_provided' }, 400)

        const { data, error } = await supabase
          .from('contacts')
          .update(updates)
          .eq('id', contactId)
          .eq('user_id', ownerId)
          .select('id, full_name, email_address, aplgo_id, lead_type, lead_temperature, registration_status, communication_status, assigned_to, next_action, updated_at')
          .single()
        if (error) throw error
        return r({ ok: true, contact: data })
      }

      case 'create_contact': {

        const fullName = norm(body.full_name)
        if (!fullName) return r({ error: 'full_name_required' }, 400)
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
              return r({ ok: false, duplicate: true, existing_contact: existing, message: 'A contact with this phone or email already exists. Pass force=true to create anyway.' }, 409)
            }
          }
        }

        const insertRow: Record<string, unknown> = {
          user_id: ownerId,
          date_captured: new Date().toISOString().split('T')[0],
          full_name: fullName,
          phone_number: phone,
          email_address: email,
          aplgo_id: norm(body.aplgo_id),
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
          .select('id, full_name, phone_number, email_address, aplgo_id, lead_type, lead_temperature, registration_status, created_at')
          .single()
        if (error) {
          if ((error as { code?: string }).code === '23505') {
            return r({ error: 'duplicate', message: error.message }, 409)
          }
          throw error
        }
        return r({ ok: true, contact: data })
      }

      case 'add_contact_note': {

        const contactId = String(body.contact_id ?? '')
        const note = String(body.note ?? '').trim()
        if (!contactId) return r({ error: 'contact_id_required' }, 400)
        if (!note) return r({ error: 'note_required' }, 400)

        const { data: contact, error: cErr } = await supabase
          .from('contacts').select('id').eq('id', contactId).eq('user_id', ownerId).maybeSingle()
        if (cErr) throw cErr
        if (!contact) return r({ error: 'contact_not_found' }, 404)

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

        return r({ ok: true, contact_id: contactId, activity_id: inserted.id, created_at: inserted.created_at })
      }

      case 'list_orders': {

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
        return r({ ok: true, count: data?.length ?? 0, orders: data ?? [] })
      }

      case 'get_prospector_status': {

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

        return r({ ok: true, counts_by_status: counts, pending_review: pending ?? [] })
      }

      case 'get_prospector_drafts': {

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

        return r({ ok: true, count: drafts.length, drafts })
      }

      case 'list_inventory': {

        const { data, error } = await supabase
          .from('inventory')
          .select('id, product_name, stock_quantity, updated_at')
          .eq('user_id', ownerId)
          .order('product_name', { ascending: true })
        if (error) throw error
        return r({ ok: true, count: data?.length ?? 0, inventory: data ?? [] })
      }

      case 'update_inventory_stock': {

        const id = body.id ? String(body.id) : null
        const productName = body.product_name ? norm(body.product_name) : null
        const quantity = Number(body.quantity)
        if (!Number.isInteger(quantity) || quantity < 0) return r({ error: 'quantity_must_be_a_non_negative_integer' }, 400)
        if (!id && !productName) return r({ error: 'id_or_product_name_required' }, 400)

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
          return r({ ok: true, item: data })
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
          return r({ ok: true, item: data })
        }

        const { data, error } = await supabase
          .from('inventory')
          .insert({ user_id: ownerId, product_name: productName, stock_quantity: quantity })
          .select('id, product_name, stock_quantity, updated_at')
          .single()
        if (error) throw error
        return r({ ok: true, item: data, created: true })
      }

      case 'get_deals_summary': {

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

        return r({
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

        return r({ ok: true, group_count: groups.length, groups })
      }

      case 'get_sponsor_id_audit': {

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

        return r({
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

        return r({ ok: true, count: withTiming.length, birthdays: withTiming })
      }

      case 'list_birthday_message_tones': {
        // Static reference, no DB call. Mirrors BirthdayComposerModal.tsx's
        // TONE_CONFIG (label/description only — icon/color are UI-only).
        return r({ ok: true, tones: BIRTHDAY_TONES })
      }

      case 'compose_birthday_message': {

        const birthdayId = body.birthday_id ? String(body.birthday_id) : null
        const associateId = body.associate_id ? String(body.associate_id) : null
        if (!birthdayId && !associateId) return r({ error: 'birthday_id_or_associate_id_required' }, 400)

        const allTones = body.all_tones === true
        const requestedTone = (body.tone ? String(body.tone) : 'warm').toLowerCase()
        const validTones = BIRTHDAY_TONES.map((t) => t.key)
        if (!allTones && !validTones.includes(requestedTone)) {
          return r({ error: 'invalid_tone', message: `tone must be one of ${validTones.join(', ')}` }, 400)
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
        if (!entry) return r({ error: 'birthday_not_found' }, 404)

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

        return r(result)
      }

      case 'list_whatsapp_conversations': {

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

        return r({ ok: true, unread_total: unreadTotal, conversations: Array.from(seen.values()) })
      }

      case 'get_whatsapp_thread': {

        // contact_id is required (not conversation_key) — this is a
        // deliberate guardrail so an unmatched/masked-number thread can
        // never be requested through this tool; only rows with a resolved
        // contact_id are reachable.
        const contactId = String(body.contact_id ?? '')
        if (!contactId) return r({ error: 'contact_id_required' }, 400)

        const { data: contact, error: cErr } = await supabase
          .from('contacts').select('id, full_name').eq('id', contactId).eq('user_id', ownerId).maybeSingle()
        if (cErr) throw cErr
        if (!contact) return r({ error: 'contact_not_found' }, 404)

        const limit = Number.isInteger(Number(body.limit)) && Number(body.limit) > 0
          ? Math.min(Number(body.limit), 200) : 30

        // v2.1: return the LAST `limit` messages (oldest -> newest), each with
        // date + text, or a media label when there is no text.
        const { data, error } = await supabase
          .from('maytapi_messages')
          .select('direction, body, body_preview, media_type, received_at, status, read_at')
          .eq('user_id', ownerId)
          .eq('contact_id', contactId)
          .order('received_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        const messages = (data ?? []).reverse().map(cs_msg)

        return r({ ok: true, contact_id: contactId, contact_name: contact.full_name, message_count: messages.length, messages })
      }

      // ---------- Shipments / deliveries ----------
      case 'list_shipments': {
        const limit = Number.isInteger(Number(body.limit)) && Number(body.limit) > 0
          ? Math.min(Number(body.limit), 200) : 50
        let q = supabase
          .from('shipments')
          .select('id, waybill_number, contact_id, order_id, status, product_summary, delivery_address, service_level, courier_reference, earliest_delivery_date, last_status_update, created_at')
          .eq('user_id', ownerId)
          .order('last_status_update', { ascending: false })
          .limit(limit)
        if (body.status) q = q.eq('status', String(body.status))
        if (body.contact_id) q = q.eq('contact_id', String(body.contact_id))
        const { data, error } = await q
        if (error) throw error
        return r({ ok: true, count: data?.length ?? 0, shipments: data ?? [] })
      }

      case 'get_shipment': {
        const waybill = String(body.waybill_number ?? '').trim()
        if (!waybill) return r({ error: 'waybill_number_required' }, 400)
        const { data, error } = await supabase
          .from('shipments')
          .select('*')
          .eq('user_id', ownerId)
          .eq('waybill_number', waybill)
          .maybeSingle()
        if (error) throw error
        if (!data) return r({ error: 'shipment_not_found', waybill_number: waybill }, 404)
        return r({ ok: true, shipment: data })
      }

      case 'create_shipment': {
        const waybill = String(body.waybill_number ?? '').trim()
        if (!waybill) return r({ error: 'waybill_number_required' }, 400)

        const contactId = body.contact_id ? String(body.contact_id) : null
        if (contactId) {
          const { data: c, error: cErr } = await supabase
            .from('contacts').select('id').eq('id', contactId).eq('user_id', ownerId).maybeSingle()
          if (cErr) throw cErr
          if (!c) return r({ error: 'contact_not_found' }, 404)
        }
        const orderId = body.order_id ? String(body.order_id) : null
        if (orderId) {
          const { data: o, error: oErr } = await supabase
            .from('orders').select('id').eq('id', orderId).eq('user_id', ownerId).maybeSingle()
          if (oErr) throw oErr
          if (!o) return r({ error: 'order_not_found' }, 404)
        }

        const { data: existing } = await supabase
          .from('shipments').select('id').eq('user_id', ownerId).eq('waybill_number', waybill).maybeSingle()
        if (existing) return r({ error: 'shipment_already_exists', waybill_number: waybill }, 409)

        const { data, error } = await supabase
          .from('shipments')
          .insert({
            user_id: ownerId,
            waybill_number: waybill,
            contact_id: contactId,
            order_id: orderId,
            status: String(body.status ?? 'unknown'),
            product_summary: String(body.product_summary ?? ''),
            collection_address: String(body.collection_address ?? ''),
            delivery_address: String(body.delivery_address ?? ''),
            service_level: String(body.service_level ?? ''),
            courier_reference: String(body.courier_reference ?? ''),
            earliest_delivery_date: body.earliest_delivery_date ? String(body.earliest_delivery_date) : null,
            last_status_update: new Date().toISOString(),
          })
          .select('*')
          .single()
        if (error) throw error
        return r({ ok: true, shipment: data })
      }

      case 'update_shipment': {
        const waybill = String(body.waybill_number ?? '').trim()
        if (!waybill) return r({ error: 'waybill_number_required' }, 400)

        const allowed = [
          'status', 'product_summary', 'collection_address', 'delivery_address',
          'service_level', 'courier_reference', 'earliest_delivery_date',
          'contact_id', 'order_id',
        ]
        const patch: Record<string, unknown> = {}
        for (const key of allowed) {
          if (body[key] !== undefined) {
            patch[key] = body[key] === null || body[key] === '' ? null : body[key]
          }
        }
        if (Object.keys(patch).length === 0) return r({ error: 'no_fields_to_update' }, 400)

        if (patch.contact_id) {
          const { data: c } = await supabase
            .from('contacts').select('id').eq('id', String(patch.contact_id)).eq('user_id', ownerId).maybeSingle()
          if (!c) return r({ error: 'contact_not_found' }, 404)
        }
        if (patch.order_id) {
          const { data: o } = await supabase
            .from('orders').select('id').eq('id', String(patch.order_id)).eq('user_id', ownerId).maybeSingle()
          if (!o) return r({ error: 'order_not_found' }, 404)
        }
        if (patch.status !== undefined) patch.last_status_update = new Date().toISOString()

        const { data, error } = await supabase
          .from('shipments')
          .update(patch)
          .eq('user_id', ownerId)
          .eq('waybill_number', waybill)
          .select('*')
          .maybeSingle()
        if (error) throw error
        if (!data) return r({ error: 'shipment_not_found', waybill_number: waybill }, 404)
        return r({ ok: true, shipment: data })
      }

      case 'paste_monthly_activity': {

        const pastedText = String(body.pasted_text ?? '')
        const activityMonthRaw = String(body.activity_month ?? '').trim()
        if (!pastedText.trim()) return r({ error: 'pasted_text_required' }, 400)
        if (!activityMonthRaw) return r({ error: 'activity_month_required' }, 400)

        const periodStart = body.period_start ? String(body.period_start) : null
        const periodEnd = body.period_end ? String(body.period_end) : null
        // Defaults to true (preview-only); must be explicitly false to write anything.
        const dryRun = body.dry_run !== false

        // ---- Parse (mirrors monthlyActivityParser.ts exactly) ----
        const parsedRows = parseMonthlyActivityReport(pastedText)
        if (parsedRows.length === 0) {
          return r({
            error: 'no_entries_found',
            message: 'No entries found. Expected format: "Level 1\\n1129930(6): 2,520.00 R, 934517: 2,385.00 R"',
          }, 400)
        }

        // ---- Match by aplgo_id (collapses the app's local-cache + exact-db tiers into one direct query) ----
        const sanitizedIds = Array.from(new Set(parsedRows.map((r) => sanitizeAplgoId(r.userId)).filter(Boolean)))
        const { data: matchedContacts, error: matchErr } = await supabase
          .from('contacts')
          .select('id, full_name, aplgo_id')
          .eq('user_id', ownerId)
          .in('aplgo_id', sanitizedIds)
        if (matchErr) throw matchErr
        const contactByAplgo = new Map<string, { id: string; full_name: string }>()
        for (const c of matchedContacts ?? []) {
          const k = sanitizeAplgoId(c.aplgo_id)
          if (k) contactByAplgo.set(k, { id: c.id, full_name: c.full_name })
        }

        const rows = parsedRows.map((r) => {
          const contact = contactByAplgo.get(sanitizeAplgoId(r.userId)) || null
          return { ...r, contact }
        })
        const matchedRows = rows.filter((r) => r.contact)
        const unmatchedRows = rows.filter((r) => !r.contact)

        // ---- Period overlap check — purely informational, never blocks (mirrors useOrders.findOverlappingActivityPeriods) ----
        const overlapByContact = new Map<string, { start: string; end: string }[]>()
        if (periodStart && periodEnd && matchedRows.length > 0) {
          const contactIds = Array.from(new Set(matchedRows.map((r) => r.contact!.id)))
          const { data: overlapRows } = await supabase
            .from('orders')
            .select('contact_id, activity_period_start, activity_period_end')
            .eq('user_id', ownerId)
            .eq('source', 'monthly-activity-paste')
            .not('activity_period_start', 'is', null)
            .not('activity_period_end', 'is', null)
            .in('contact_id', contactIds)
          for (const row of overlapRows ?? []) {
            const start = row.activity_period_start as string
            const end = row.activity_period_end as string
            if (start <= periodEnd && end >= periodStart) {
              const cid = String(row.contact_id)
              const list = overlapByContact.get(cid) || []
              list.push({ start, end })
              overlapByContact.set(cid, list)
            }
          }
        }

        // ---- MP0.1 stable signature + within-batch occurrence (mirrors MonthlyActivityPasteModal.handleSave exactly) ----
        const monthKey = normalizeActivityMonth(activityMonthRaw) || activityMonthRaw.replace(/\s/g, '')
        const monthSlug = activityMonthRaw.replace(/\s/g, '')
        const buildSig = (row: { userId: string; amount: number; displayedLevel: string; actualLevel: string }) =>
          [ownerId, monthKey, row.userId, row.amount, row.displayedLevel || 'x', row.actualLevel || 'x'].join('|').toLowerCase()

        const sigPrefix = `ma|${[ownerId, monthKey].join('|').toLowerCase()}|`
        const { data: existingKeyRows } = await supabase
          .from('orders')
          .select('dedupe_key')
          .eq('user_id', ownerId)
          .eq('source', 'monthly-activity-paste')
          .like('dedupe_key', `${sigPrefix}%`)
        const existingKeys = new Set((existingKeyRows ?? []).map((r: any) => String(r.dedupe_key || '').toLowerCase()))

        const sigCountInBatch = new Map<string, number>()
        for (const r of matchedRows) {
          const s = buildSig(r)
          sigCountInBatch.set(s, (sigCountInBatch.get(s) || 0) + 1)
        }

        const occurrenceCursor = new Map<string, number>()
        const previewRows: Record<string, unknown>[] = []
        let created = 0, skipped = 0, flagged = 0

        for (const row of matchedRows) {
          const sig = buildSig(row)
          const occ = (occurrenceCursor.get(sig) || 0) + 1
          occurrenceCursor.set(sig, occ)

          const dedupeKey = `ma|${sig}|#${occ}`
          const firstKey = `ma|${sig}|#1`
          const thisKeyAlreadyExists = existingKeys.has(dedupeKey)
          const firstAlreadyExists = existingKeys.has(firstKey)
          const sameReportTwin = (sigCountInBatch.get(sig) || 0) >= 2

          // Same branch order as the in-app modal: A) exact key exists -> skip;
          // B) same-report twin proof in this paste -> insert; C) fresh first
          // occurrence -> insert; D) ambiguous repeat -> Needs Review, never inserted.
          let action: 'insert' | 'skip_duplicate' | 'needs_review'
          if (thisKeyAlreadyExists) action = 'skip_duplicate'
          else if (sameReportTwin) action = 'insert'
          else if (occ === 1 && !firstAlreadyExists) action = 'insert'
          else action = 'needs_review'

          const overlap = overlapByContact.get(row.contact!.id) || []

          if (dryRun) {
            previewRows.push({
              user_id: row.userId,
              contact_id: row.contact!.id,
              contact_name: row.contact!.full_name,
              displayed_level: row.displayedLevel,
              actual_level: row.actualLevel,
              amount: row.amount,
              dedupe_key: dedupeKey,
              would_action: action,
              ...(overlap.length ? { period_overlap: overlap } : {}),
            })
            if (action === 'insert') created++
            else if (action === 'skip_duplicate') skipped++
            else flagged++
            continue
          }

          if (action === 'skip_duplicate') { skipped++; continue }

          if (action === 'needs_review') {
            const { error: wrErr } = await supabase.from('contact_waiting_room').insert({
              user_id: ownerId,
              contact_id: row.contact!.id,
              issue_type: 'follow_up_correction',
              issue_note:
                `Possible duplicate Monthly Activity entry — owner approval required. ` +
                `Month: ${activityMonthRaw}. Amount: R${row.amount}. ` +
                `Level: ${row.displayedLevel}/${row.actualLevel}. ` +
                `A prior entry with the same signature exists and this paste did not provide same-report twin proof for a new occurrence.`,
              priority: 'medium',
              status: 'open',
            })
            if (wrErr) console.error('paste_monthly_activity: waiting-room insert failed', wrErr)
            flagged++
            continue
          }

          // action === 'insert'
          const entrySig = `${row.amount}-${row.displayedLevel || 'x'}-${row.actualLevel || 'x'}-occ${occ}`
          const orderId = `MA-${row.userId}-${monthSlug}-${entrySig}`
          const { error: insErr } = await supabase.from('orders').insert({
            user_id: ownerId,
            order_id: orderId,
            contact_id: row.contact!.id,
            contact_name: row.contact!.full_name,
            product: `Monthly Activity - ${activityMonthRaw}`,
            quantity: 1,
            amount: row.amount,
            status: 'Paid',
            order_date: new Date().toISOString().split('T')[0],
            badges: ['Activity'],
            purchase_type: 'Activity',
            pv_amount: 0,
            source: 'monthly-activity-paste',
            dedupe_key: dedupeKey,
            ...(periodStart ? { activity_period_start: periodStart } : {}),
            ...(periodEnd ? { activity_period_end: periodEnd } : {}),
          })
          if (insErr) {
            if ((insErr as { code?: string }).code === '23505') skipped++
            else { console.error('paste_monthly_activity: order insert failed', insErr); flagged++ }
            continue
          }
          created++
        }

        return r({
          ok: true,
          dry_run: dryRun,
          activity_month: activityMonthRaw,
          parsed_count: rows.length,
          matched_count: matchedRows.length,
          unmatched_count: unmatchedRows.length,
          created,
          skipped,
          flagged,
          unmatched: unmatchedRows.map((r) => ({
            user_id: r.userId, displayed_level: r.displayedLevel, actual_level: r.actualLevel, amount: r.amount,
          })),
          ...(dryRun ? { rows: previewRows } : {}),
          note: dryRun
            ? 'Preview only — nothing written. Review would_action per row, then call again with dry_run:false.'
            : 'Unmatched APLGO IDs were never inserted — those contacts need to exist in the CRM first (see create_contact). Needs-review rows were sent to the in-app Waiting Room, not inserted as orders.',
        })
      }

      // ---------- Call Sheets (v2.1.0) ----------
      // Mirrors src/pages/CallSheets.tsx + the save_call RPC. Never sends,
      // never touches orders, never deletes, never changes consent/opt-out/
      // communication_status. Every query is scoped to the configured owner.
      case 'list_call_sheet': {
        const level = Number(body.level)
        if (!Number.isInteger(level) || level < 1 || level > 12) return r({ error: 'level_must_be_1_to_12' }, 400)
        const bucket = body.bucket == null ? '' : String(body.bucket)
        if (bucket && !CS_BUCKETS.includes(bucket)) return r({ error: 'invalid_bucket', allowed: CS_BUCKETS }, 400)
        const limit = csLimit(body.limit, 100, 500)
        let q = supabase.from('call_sheet_cards').select('*').eq('user_id', ownerId).eq('level', String(level))
        if (bucket) q = q.eq('bucket', bucket)
        if (body.not_called_today === true) q = q.eq('called_today', false)
        const { data, error } = await q.order('full_name').limit(2000)
        if (error) throw error
        const cards = csDedupe(data ?? []).slice(0, limit)
        const hist = await csHistory(supabase, ownerId, cards.map((c) => c.id), 3)
        return r({ ok: true, level, count: cards.length, cards: cards.map((c) => ({ ...c, history: hist[c.id] ?? [] })) })
      }

      case 'get_call_sheet_card': {
        const contact = await csFindContact(supabase, ownerId, body)
        if ('error' in contact) return r({ error: contact.error }, contact.status)
        const { data: card, error } = await supabase.from('call_sheet_cards').select('*')
          .eq('user_id', ownerId).eq('id', contact.id).maybeSingle()
        if (error) throw error
        const hist = await csHistory(supabase, ownerId, [contact.id], 10)
        const { data: msgs } = await supabase.from('maytapi_messages')
          .select('direction, body, body_preview, media_type, received_at')
          .eq('user_id', ownerId).eq('contact_id', contact.id).order('received_at', { ascending: false }).limit(10)
        return r({
          ok: true, contact_id: contact.id, on_call_sheet: !!card,
          note: card ? undefined : 'This contact is not on a call sheet (level outside range or not in the latest export).',
          card: card ?? null, history: hist[contact.id] ?? [],
          whatsapp: (msgs ?? []).reverse().map(cs_msg),
        })
      }

      case 'log_call': {
        const contactId = String(body.contact_id ?? '')
        if (!contactId) return r({ error: 'contact_id_required' }, 400)
        const outcome = String(body.outcome ?? '')
        if (!CS_OUTCOMES.includes(outcome)) return r({ error: 'invalid_outcome', allowed: CS_OUTCOMES }, 400)
        const followUp = body.follow_up_on == null || body.follow_up_on === '' ? null : String(body.follow_up_on)
        if (followUp && !/^\d{4}-\d{2}-\d{2}$/.test(followUp)) return r({ error: 'follow_up_on_must_be_yyyy_mm_dd' }, 400)
        const { data: c } = await supabase.from('contacts').select('id').eq('id', contactId).eq('user_id', ownerId).maybeSingle()
        if (!c) return r({ error: 'contact_not_found' }, 404)
        const notes = norm(body.notes); const nextAction = norm(body.next_action)
        const { data: ins, error } = await supabase.from('contact_activities').insert({
          user_id: ownerId, contact_id: contactId, activity_type: 'call', summary: outcome, outcome,
          notes: notes || null, next_action: nextAction || null, follow_up_on: followUp,
        }).select('id, created_at').single()
        if (error) throw error
        if (nextAction) {
          const { error: uErr } = await supabase.from('contacts')
            .update({ next_action: nextAction, updated_at: new Date().toISOString() })
            .eq('id', contactId).eq('user_id', ownerId)
          if (uErr) throw uErr
        }
        return r({ ok: true, activity_id: ins.id, created_at: ins.created_at, contact_id: contactId, outcome })
      }

      case 'list_calls': {
        const today = csToday()
        const from = String(body.from ?? today); const to = String(body.to ?? today)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return r({ error: 'dates_must_be_yyyy_mm_dd' }, 400)
        if (body.outcome != null && !CS_OUTCOMES.includes(String(body.outcome))) return r({ error: 'invalid_outcome', allowed: CS_OUTCOMES }, 400)
        let q = supabase.from('contact_activities')
          .select('id, contact_id, created_at, outcome, summary, notes, next_action, follow_up_on, contacts(full_name, level)')
          .eq('user_id', ownerId).eq('activity_type', 'call')
          .gte('created_at', `${from}T00:00:00+02:00`).lte('created_at', `${to}T23:59:59.999+02:00`)
        if (body.outcome != null) q = q.eq('outcome', String(body.outcome))
        const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
        if (error) throw error
        let calls = (data ?? []).map((r: any) => ({
          activity_id: r.id, contact_id: r.contact_id, full_name: r.contacts?.full_name ?? '', level: norm(r.contacts?.level),
          called_at: r.created_at, outcome: r.outcome ?? r.summary, notes: r.notes, next_action: r.next_action, follow_up_on: r.follow_up_on,
        }))
        if (body.level != null) calls = calls.filter((c) => c.level === String(body.level))
        return r({ ok: true, from, to, count: calls.length, calls })
      }

      case 'list_followups_due': {
        const onOrBefore = String(body.on_or_before ?? csToday())
        if (!/^\d{4}-\d{2}-\d{2}$/.test(onOrBefore)) return r({ error: 'on_or_before_must_be_yyyy_mm_dd' }, 400)
        const { data, error } = await supabase.from('contact_activities')
          .select('id, contact_id, created_at, outcome, summary, notes, next_action, follow_up_on, contacts(full_name, level, phone_number)')
          .eq('user_id', ownerId).eq('activity_type', 'call').not('contact_id', 'is', null)
          .order('created_at', { ascending: false }).limit(5000)
        if (error) throw error
        const latest = new Map<string, any>()
        for (const r of data ?? []) if (!latest.has(r.contact_id)) latest.set(r.contact_id, r)
        let due = [...latest.values()]
          .filter((r) => r.follow_up_on && r.follow_up_on <= onOrBefore)
          .map((r) => ({
            contact_id: r.contact_id, full_name: r.contacts?.full_name ?? '', level: norm(r.contacts?.level),
            phone_number: r.contacts?.phone_number ?? '', follow_up_on: r.follow_up_on, last_call_at: r.created_at,
            last_call_outcome: r.outcome ?? r.summary, notes: r.notes, next_action: r.next_action,
          }))
        if (body.level != null) due = due.filter((d) => d.level === String(body.level))
        due.sort((a, b) => String(a.follow_up_on).localeCompare(String(b.follow_up_on)))
        return r({ ok: true, on_or_before: onOrBefore, count: due.length, followups: due })
      }

      case 'list_needs_level': {
        const since = new Date(Date.now() - 14 * 864e5).toISOString()
        const { data, error } = await supabase.from('contacts')
          .select('id, full_name, phone_number, city, aplgo_id, level, leg, lead_type, created_at')
          .eq('user_id', ownerId).or(`aplgo_id.neq.,created_at.gte.${since}`).neq('lead_type', 'Expired').limit(5000)
        if (error) throw error
        const needs = (data ?? []).filter((c: any) => !/^\s*\d{1,2}\s*$/.test(c.level || ''))
        const { data: hi } = await supabase.from('contacts').select('id, full_name, phone_number, level, aplgo_id')
          .eq('user_id', ownerId).not('level', 'is', null).neq('level', '').limit(10000)
        const outside = (hi ?? []).filter((c: any) => /^\s*\d+\s*$/.test(c.level) && Number(c.level) > 12)
        return r({ ok: true, needs_level_count: needs.length, needs_level: needs, outside_range_count: outside.length, outside_range: outside })
      }

      case 'set_contact_level': {
        const contactId = String(body.contact_id ?? '')
        if (!contactId) return r({ error: 'contact_id_required' }, 400)
        const level = Number(body.level)
        if (!Number.isInteger(level) || level < 1 || level > 12) return r({ error: 'level_must_be_1_to_12', received: body.level ?? null }, 400)
        if (body.leg != null && !['L', 'R'].includes(String(body.leg))) return r({ error: 'leg_must_be_L_or_R' }, 400)
        const { data: c } = await supabase.from('contacts').select('id').eq('id', contactId).eq('user_id', ownerId).maybeSingle()
        if (!c) return r({ error: 'contact_not_found' }, 404)
        const patch: Record<string, unknown> = { level: String(level), updated_at: new Date().toISOString() }
        if (body.leg != null) patch.leg = String(body.leg)
        if (body.go_status != null) patch.go_status = norm(body.go_status)
        const { error } = await supabase.from('contacts').update(patch).eq('id', contactId).eq('user_id', ownerId)
        if (error) throw error
        await supabase.from('contact_activities').insert({
          user_id: ownerId, contact_id: contactId, activity_type: 'note', summary: `Level set to ${level} via Claude`, next_action: '',
        })
        return r({ ok: true, contact_id: contactId, updated: patch })
      }

      case 'bulk_set_levels': {
        const items = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : null
        if (!items || !items.length) return r({ error: 'items_required' }, 400)
        if (items.length > 100) return r({ error: 'max_100_items' }, 400)
        // Validate everything first so a bad row never leaves a half-applied batch.
        for (const [i, it] of items.entries()) {
          if (!sanitizeAplgoId(it.aplgo_id) && !norm(it.phone)) return r({ error: 'aplgo_id_or_phone_required', index: i }, 400)
          if (it.level != null) {
            const l = Number(it.level)
            if (!Number.isInteger(l) || l < 1 || l > 12) return r({ error: 'level_must_be_1_to_12', index: i, received: it.level }, 400)
          }
          if (it.leg != null && !['L', 'R'].includes(String(it.leg))) return r({ error: 'leg_must_be_L_or_R', index: i }, 400)
          for (const k of ['enrolled_on', 'activated_on']) {
            if (it[k] != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(it[k]))) return r({ error: `${k}_must_be_yyyy_mm_dd`, index: i }, 400)
          }
        }
        const today = csToday()
        let matched = 0, updated = 0
        const notFound: unknown[] = []
        const results: unknown[] = []
        for (const it of items) {
          const aplgo = sanitizeAplgoId(it.aplgo_id)
          let contact: any = null
          if (aplgo) {
            const { data } = await supabase.from('contacts').select('id, full_name, level, leg, go_status, enrolled_on, activated_on')
              .eq('user_id', ownerId).eq('aplgo_id', aplgo).order('updated_at', { ascending: false }).limit(1)
            contact = data?.[0] ?? null
          }
          if (!contact && norm(it.phone)) {
            const { data: pn } = await supabase.rpc('normalize_phone', { raw: norm(it.phone) })
            if (pn) {
              const { data } = await supabase.from('contacts').select('id, full_name, level, leg, go_status, enrolled_on, activated_on')
                .eq('user_id', ownerId).eq('phone_normalized', pn).order('updated_at', { ascending: false }).limit(1)
              contact = data?.[0] ?? null
            }
          }
          if (!contact) { notFound.push(it); continue }
          matched++
          const changes: Record<string, unknown> = {}
          if (it.level != null && norm(contact.level) !== String(Number(it.level))) changes.level = String(Number(it.level))
          if (it.leg != null && contact.leg !== String(it.leg)) changes.leg = String(it.leg)
          if (it.go_status != null && contact.go_status !== norm(it.go_status)) changes.go_status = norm(it.go_status)
          if (it.enrolled_on != null && contact.enrolled_on !== String(it.enrolled_on)) changes.enrolled_on = String(it.enrolled_on)
          if (it.activated_on != null && contact.activated_on !== String(it.activated_on)) changes.activated_on = String(it.activated_on)
          const { error } = await supabase.from('contacts')
            .update({ ...changes, export_seen_on: today, updated_at: new Date().toISOString() })
            .eq('id', contact.id).eq('user_id', ownerId)
          if (error) throw error
          if (Object.keys(changes).length) {
            updated++
            await supabase.from('contact_activities').insert({
              user_id: ownerId, contact_id: contact.id, activity_type: 'note', next_action: '',
              summary: `Export refresh via Claude: ${Object.entries(changes).map(([k, v]) => `${k} → ${v}`).join(', ')}`,
            })
          }
          results.push({ contact_id: contact.id, full_name: contact.full_name, changed: changes })
        }
        return r({ ok: true, export_seen_on: today, matched, updated, not_found: notFound.length, not_found_rows: notFound, results })
      }

      case 'get_call_sheet_settings': {
        const { data } = await supabase.from('call_sheet_settings').select('min_level, max_level, new_days, steady_days, export_fresh_days')
          .eq('user_id', ownerId).maybeSingle()
        return r({ ok: true, settings: data ?? CS_DEFAULTS, is_default: !data })
      }

      case 'set_call_sheet_settings': {
        const { data: cur } = await supabase.from('call_sheet_settings').select('min_level, max_level, new_days, steady_days, export_fresh_days')
          .eq('user_id', ownerId).maybeSingle()
        const next: Record<string, number> = { ...CS_DEFAULTS, ...(cur ?? {}) }
        for (const k of Object.keys(CS_DEFAULTS)) {
          if (body[k] == null) continue
          const n = Number(body[k])
          if (!Number.isInteger(n) || n < 1) return r({ error: `${k}_must_be_positive_integer` }, 400)
          next[k] = n
        }
        if (next.min_level > 12 || next.max_level > 12) return r({ error: 'level_must_be_1_to_12' }, 400)
        if (next.min_level > next.max_level) return r({ error: 'min_level_cannot_exceed_max_level' }, 400)
        const { error } = await supabase.from('call_sheet_settings')
          .upsert({ user_id: ownerId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        if (error) throw error
        return r({ ok: true, settings: next })
      }

      default:
        return r({ error: 'unknown_action', action }, 400)
    }
}
