## Phone Rescue + Auto-Link Repair

Build an automated recovery system that resolves `blocked:no_phone` and `blocked:unmatched_contact` shadow rows by searching all available CRM data sources, then exposes a repair dashboard for review and one-click promotion.

### Scope (Phase 1 — Safe Recovery Only)

This stays consistent with Phase 1.5 lock: **no Maytapi sends, no Done writes, no bulk auto-promotion.** Recovery only fills phone gaps and re-runs shadow eligibility.

### Backend

**New table: `phone_rescue_candidates`**
- `shadow_log_id` (fk), `contact_id`, `lane`, `entry_key`
- `old_phone`, `recovered_phone`, `recovered_full_name`, `recovered_aplgo_id`
- `source_table` (contacts | orders | contact_activities | maytapi_inbound_unmatched | maytapi_messages | sponsor_review | import_audit)
- `match_method` (aplgo_id | phone_normalized | full_name_exact | full_name_fuzzy | sponsor_leg | whatsapp_last4 | order_owner)
- `confidence` (high | medium | low), `status` (recovered_auto | needs_review | duplicate_conflict | orphan_birthday | promoted | rejected)
- `audit` jsonb (old/new/source/timestamp), `created_at`, `resolved_at`, `resolved_by`
- RLS: select/update own rows; insert via SECURITY DEFINER edge function only

**New edge function: `phone-rescue-scan`** (admin-only, manual trigger)
- Reads recent `auto_send_shadow_log` rows where `block_reason IN ('no_phone','unmatched_contact')`
- For each, runs match cascade:
  1. APLGO ID exact (across `contacts`, `import_audit.incoming_aplgo_id`)
  2. Normalized phone exact (across `contacts.phone_normalized`, `orders.contact_id→contacts`, `maytapi_messages.phone_e164`, `maytapi_inbound_unmatched.phone_hash`)
  3. Full name exact (case-insensitive trim)
  4. Fuzzy name (`pg_trgm` similarity ≥ 0.85)
  5. Sponsor + leg + level match
  6. WhatsApp `phone_last4` match
  7. Order `contact_name` owner match
- One unique high-confidence hit → `status=recovered_auto`
- Multiple hits → `status=needs_review` (Manual Review queue)
- Zero hits → `status=orphan_birthday` (for birthday lane) or skip
- **Never overwrites** a non-empty `contacts.phone_number`

**New edge function: `phone-rescue-promote`** (admin-only)
- Body: `{ candidate_id, action: 'promote' | 'reject' }`
- On promote: updates `contacts.phone_number` only if currently empty, writes audit row, marks candidate `promoted`
- Triggers shadow re-evaluation by inserting fresh `auto_send_shadow_log` entry

### Frontend

**New component: `PhoneRescueDashboard.tsx`** (mounted on Team Dashboard, admin-only)
- Tabs: Recovered automatically · Needs manual review · Duplicate conflicts · Orphan birthdays · Repaired today
- Per row: contact name, old/recovered phone, source table, match method, confidence
- Buttons: "Promote recovered phone to primary", "Reject", "Retry Eligibility"
- Audit trail expander showing full jsonb history
- "Run Phone Rescue Scan" manual button at top

### Safety Locks (preserved)
- No Maytapi calls in any new function
- No `prospector_send_log` or `zazi_actions` writes
- No bulk promotion — promotion is per-row click
- Existing verified phones never overwritten (guarded by `IS NULL OR ''` check)
- Multi-match rows force Manual Review

### Files
- `supabase/migrations/<ts>_phone_rescue.sql` — table + indexes + RLS + pg_trgm
- `supabase/functions/phone-rescue-scan/index.ts`
- `supabase/functions/phone-rescue-promote/index.ts`
- `src/components/PhoneRescueDashboard.tsx`
- `src/pages/TeamDashboard.tsx` — mount card under AutoSendShadowCard

### Out of scope
- Twilio inbox (no Twilio integration exists — flagged but skipped)
- Auto-promotion without click
- Sending any messages
