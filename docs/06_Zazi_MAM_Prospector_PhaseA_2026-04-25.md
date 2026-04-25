# Zazi MAM Prospector — Phase A + A.1 Lockdown Record

**Date:** 2026-04-25
**Source of truth:** `Vanto_Zazi_MAM_Prospector_Master_Spec_v3.1_2026-04-25.pdf`
**Status:** Phase A complete · Phase A.1 hardening complete · **awaiting approval to start Phase B**

---

## 1. Tables created

### `public.zazi_actions` (0 rows)
Stores AI proposals from the Master AI Mentor pipeline. **Derived-only**: `movement_stage` never writes back to `contacts.lead_type`.

Columns (29):
`id, user_id, contact_id, status, channel,
movement_stage, leadership_need, belief_risk, recommended_tone,
reason_for_message, next_best_business_action, expected_next_step,
proposed_message, evidence,
supervisor_quality_score, supervisor_safety, supervisor_grounding,
supervisor_cultural_fit, supervisor_clarity, supervisor_relevance,
supervisor_tone_fit, supervisor_leadership_fit, supervisor_block_reason,
approved_by, approved_at, sent_at, maytapi_message_id,
created_at, updated_at`

**Locks confirmed:**
- ✅ `proposed_message` exists · ❌ `draft_message` does **not** exist
- ✅ `evidence` (jsonb) exists · ❌ `evidence_jsonb` does **not** exist
- ✅ `movement_stage` exists, isolated to this table only
- ✅ `supervisor_leadership_fit` exists (7th rubric axis)

### `public.integration_settings` (9 rows — one per existing user)
Safety + Maytapi config. PK on `user_id`.

Columns (15):
`user_id, zazi_prospector_enabled, prospector_can_propose,
prospector_supervisor_required, prospector_can_auto_apply_low,
prospector_can_send_autonomous, maytapi_enabled, maytapi_phone_allowlist,
daily_send_cap, daily_token_cap,
supervisor_block_threshold, supervisor_safety_threshold,
supervisor_leadership_fit_threshold, created_at, updated_at`

---

## 2. Columns added to existing tables

- `public.user_knowledge_docs.tags text[] DEFAULT '{}'` + GIN index `user_knowledge_docs_tags_gin`

No other existing tables touched.

---

## 3. Flags & defaults (verified across all 9 rows)

| Flag | Value |
|---|---|
| `zazi_prospector_enabled` | **false** (9/9) |
| `prospector_can_propose` | **false** (9/9) |
| `prospector_can_auto_apply_low` | **false** (9/9) |
| `prospector_can_send_autonomous` | **false** (9/9) |
| `maytapi_enabled` | **false** (9/9) |
| `maytapi_phone_allowlist` | **`{}`** (9/9) |
| `prospector_supervisor_required` | **true** (9/9) |
| `supervisor_block_threshold` | 60 |
| `supervisor_safety_threshold` | 70 |
| `supervisor_leadership_fit_threshold` | 60 |
| `daily_send_cap` | 100 |
| `daily_token_cap` | 200000 |

---

## 4. RLS policies

Both tables: RLS **enabled**, uniform `auth.uid() = user_id`.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `zazi_actions` | ✅ own | ✅ own | ✅ own | ✅ own |
| `integration_settings` | ✅ own | ✅ own | ✅ own | ✅ own |

---

## 5. Indexes (Phase A.1 additions)

- `zazi_actions_user_status_created_idx (user_id, status, created_at DESC)` ✅ new
- `zazi_actions_user_contact_status_idx (user_id, contact_id, status)` ✅ new
- `zazi_actions_user_movement_stage_idx (user_id, movement_stage)` ✅ new
- `zazi_actions_user_leadership_need_idx (user_id, leadership_need)` ✅ new
- `zazi_actions_user_quality_idx (user_id, supervisor_quality_score)` ✅ new
- `zazi_actions_evidence_gin (evidence)` ✅ pre-existing
- `zazi_actions_status_idx`, `zazi_actions_contact_idx`, `zazi_actions_created_idx`, `zazi_actions_user_idx` ✅ pre-existing
- `integration_settings_pkey (user_id)` ✅ pre-existing (PK serves as user index)
- `user_knowledge_docs_tags_gin (tags)` ✅ confirmed present

---

## 6. `updated_at` triggers (Phase A.1 additions)

- `update_zazi_actions_updated_at` BEFORE UPDATE → `public.update_updated_at_column()` ✅ new
- `update_integration_settings_updated_at` BEFORE UPDATE → `public.update_updated_at_column()` ✅ new

The shared trigger function `public.update_updated_at_column()` was **not modified**.

---

## 7. Safety locks honored

- ❌ No edge functions created or changed
- ❌ No UI files changed
- ❌ No Maytapi secrets requested or stored
- ❌ No messages sent
- ❌ No flags flipped ON
- ❌ No changes to Phase 1 / Phase 2 / Phase 3 functions
- ❌ No edits to `contact_activities` (plural — confirmed live name)
- ❌ No writes to `contacts.lead_type`
- ❌ No changes to existing RLS on production tables
- ✅ Additive trigger `on_auth_user_created_integration_settings` provisions safe defaults for new users

---

## 8. Outstanding security warning (manual — not code)

**Leaked Password Protection Disabled** — Lovable Cloud Auth dashboard setting, not a code/migration fix.

**Owner action path:**
Lovable Cloud → Auth → Password security → **Enable leaked password protection**

This is a global Auth setting and is documented here only; Phase A.1 takes no action on it.

---

## 9. Next-phase gate

Phase A + A.1 verification: **PASS**.

**Recommendation: Phase B (Detector + Reasoner shadow mode) may proceed** when explicitly approved. Phase B will:
- Run detector + reasoner only, writing draft rows into `zazi_actions` with `status='draft'`.
- Stay 100% silent — no Maytapi, no UI surfacing yet, no auto-send, no flag flips.
- Continue to honor all locks above.

Do not start Phase B without an explicit "GO Phase B" prompt.
