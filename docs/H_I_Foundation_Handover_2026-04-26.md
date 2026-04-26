# H/I Foundation — Final Handover Pack

**Date**: 2026-04-26
**Phase**: Final wrap-up (post-I2C)
**Status**: 🔒 ALL FOUNDATION PHASES LOCKED

---

## Executive Summary

This handover closes out the H-phase (Maytapi inbox + audit foundation) and the I1–I2C phases (binary tree schema + sponsor review + missing top-upline placeholder creation). The system is in a stable, fully read-only state with respect to lineage. No child contacts have been linked, no visual tree has been built, no AI/automation/send paths have been added or modified.

The next phase (**I2D — child parent linking**) is **not started** and requires a separate, explicit approval prompt. This document describes what is safe to do next and the hard guardrails that must be respected.

---

## Locked Phase Table

| Phase | Locked | Scope |
|-------|--------|-------|
| H1    | ✅     | Maytapi Inbox shell |
| H2    | ✅     | Inbound message memory |
| H2A   | ✅     | Unknown number isolation |
| H3    | ✅     | Unmatched gate (manual link / ignore) |
| H3A   | ✅     | Linked-gate propagation |
| H4    | ✅     | Read/unread, search, mobile stability |
| H5    | ✅     | Audit visibility + retention planning |
| H6    | ✅     | Audit UX polish + redacted manual export |
| H7    | ✅     | H-phase health, regression checklist, handover pack |
| I1    | ✅     | Binary tree schema foundation (`parent_contact_id`, `leg`, `tree_depth`) |
| I2A   | ✅     | Lineage pill, cycle protection, depth auto-calc, sponsor audit, `validate_contact_tree` trigger |
| I2B   | ✅     | Sponsor ID Review + Parent Linking Preview (read-only) |
| I2C   | ✅     | 10 missing top-upline placeholder contacts created |

---

## Tables Touched (writes during foundation work)

| Table | Writes |
|-------|--------|
| `contacts` | I2C inserted exactly **10** placeholder upline rows (`parent_contact_id=null`, `tree_depth=0`, `leg=''`, tagged in `additional_notes`) |
| `maytapi_gate_audit` | Append-only via H3 manual link/ignore (no destructive ops) |
| `maytapi_inbound_unmatched` | Append + status transitions only (immutability triggers active) |
| `maytapi_messages` | Inbound webhook only; `read_at`/`read_by` mutable, all other columns immutable via trigger |

## Tables NOT Touched (no writes during wrap-up)

- `contact_activities` — token format unchanged
- `zazi_actions` — send lifecycle untouched
- `prospector_send_log` — no new send attempts
- `follow_up_states`
- `integration_settings`
- `inventory`, `orders`
- `contact_birthdays`, `contact_waiting_room`
- `merge_log`, `webhook_idempotency_keys`, `webhook_rate_limit_buckets`
- `ai_action_log`, `ai_team_patterns`
- `user_api_keys`, `user_knowledge_docs`
- `user_roles`, `invites`

## Edge Functions NOT Touched

- `crm-webhook`
- `outbound-webhook`
- `maytapi-inbound`, `maytapi-send-1to1`, `maytapi-send-1to1-harness`, `maytapi-health`
- `whatsapp-sync`
- `zazi-copilot`, `zazi-prospector-*` (compose/detect/propose/supervise/action)
- `parse-backoffice-orders`, `parse-knowledge-doc`
- `smart-import`, `team-analytics`, `invite-check`

No edge function code was added, modified, or redeployed during the wrap-up phase.

---

## Privacy Rules

- **No raw phone numbers** are persisted in audit metadata. `maytapi_gate_audit` enforces this via `validate_maytapi_gate_audit` trigger.
- **No message bodies** in audit trail; only `phone_last4` and aggregated counters.
- **Webhook payloads** are stored in `maytapi_messages.raw` (immutable post-insert) and accessible only to admins via RLS.
- **All exports** from the Sponsor Review page (sponsor preview CSV, missing uplines CSV, final verification CSV) exclude phone numbers, message bodies, secrets, tokens, API keys, and Maytapi raw payloads.
- **CSV redaction** is enforced client-side by limiting column set to safe lineage / status / aggregate fields.

---

## Tree Rules (enforced by `validate_contact_tree` trigger)

1. `leg` must be one of `'L'`, `'R'`, or `''` (empty).
2. `tree_depth` is bounded `[0, 13]`.
3. A contact cannot be its own parent.
4. If `parent_contact_id IS NULL`, `tree_depth` is forced to `0`.
5. Parent must exist and belong to the same `user_id`.
6. Parent depth must be `< 13` to allow linking.
7. Child `tree_depth` is **auto-derived** as `parent.tree_depth + 1`.
8. Cycle detection walks up to 14 ancestor hops; cycles are rejected.

---

## Current Sponsor / Upline Situation

- **Total contacts** and other live counts are visible in the **I2D Ready Gate** panel on `/sponsor-id-review`.
- **Exact `aplgo_id` matches** for sponsor IDs are ready for one-by-one linking once I2D is approved.
- **10 missing top-uplines** were resolved in I2C as placeholder contacts (see below).
- **Children with `sponsor_name` but no `parent_contact_id`** are awaiting I2D. None were linked during the wrap-up phase.
- **Pre-existing legacy `leg` values** (~1094 rows) exist from earlier phases; they were **not modified** in I2C or wrap-up. They are observation-only until I2D defines a reconciliation policy.

---

## I2C Placeholder Uplines Created

Source CSV: `APLGO_downline_787262_2026-04-26.csv`. Tag in `additional_notes`: `[I2C bulk top-upline import] Source: APLGO_downline_787262_2026-04-26.csv`.

| sponsor_id | placeholder full_name | parent_contact_id | tree_depth | leg |
|------------|------------------------|-------------------|------------|-----|
| 787262 | Upline 787262 | null | 0 | '' |
| 939155 | Upline 939155 | null | 0 | '' |
| 975023 | Upline 975023 | null | 0 | '' |
| 667131 | Upline 667131 | null | 0 | '' |
| 939214 | Upline 939214 | null | 0 | '' |
| 872364 | Upline 872364 | null | 0 | '' |
| 816313 | Upline 816313 | null | 0 | '' |
| 557516 | Upline 557516 | null | 0 | '' |
| 631663 | Upline 631663 | null | 0 | '' |
| 683171 | Upline 683171 | null | 0 | '' |

All 10 verified via DB SELECT on 2026-04-26.

---

## What Is Safe To Do Next (without new approval)

- Browse `/sponsor-id-review` to view all read-only summary cards, tables, lineage checks, and the new I2D Ready Gate.
- Export the **Sponsor preview CSV**, **Missing uplines CSV**, and **Final Verification CSV** (all redacted).
- Continue normal day-to-day CRM operations: contacts CRUD, orders, activities, birthdays, WhatsApp inbox (manual reply only, no auto-send).
- Add or adjust **placeholder upline contacts** for any *additional* missing top-level sponsor IDs through the existing one-by-one "Create upline contact" flow on the Missing Uplines table (still no child linking).

---

## What Must NOT Be Done Without Approval

- ❌ Writing `parent_contact_id` to any existing child contact
- ❌ Writing `tree_depth > 0` on any contact (must be auto-derived by trigger when a parent is set)
- ❌ Writing `leg` (`'L'` / `'R'`) on existing child contacts
- ❌ Bulk-importing the 2,101-row downline CSV
- ❌ Bulk-linking children (Apply / Link / Auto Link / Bulk Link / Start I2D buttons must not exist)
- ❌ Building a visual tree, drag-and-drop reparenting, or any tree editor UI
- ❌ Adding AI suggestions, auto-replies, reply boxes, Send All, cron jobs, or production-mode flips
- ❌ Touching `maytapi_*` tables outside the existing inbound/audit flows
- ❌ Touching `prospector_send_log` or `zazi_actions` send lifecycle
- ❌ Mutating `contacts.lead_type` from a lineage workflow
- ❌ Changing `contact_activities` token format

---

## Recommended Next Phase: I2D

**Recommendation: I2D = one-by-one manual parent linking, with explicit per-link approval. Not bulk linking.**

Rationale:
1. The current dataset has known legacy `leg` values that must be reviewed against CSV ground truth before any bulk write.
2. The `validate_contact_tree` trigger will reject cycles and depth overruns, but each link should still be human-confirmed because sponsor IDs can collide (the Sponsor Review preview already flags `ambiguous_parent`, `self_match_risk`, `cycle_risk`, `depth_risk`).
3. One-by-one linking allows safe rollback per contact via undo, where bulk linking would require a separate re-parent migration.
4. Bulk linking (and the 2,101-row downline import) should be a separate later phase **I2E** with its own approval prompt, dry-run preview, and rollback plan.

I2D should be scoped to:
- Add a per-row "Link" button on the Parent Linking Preview table (only for `safe_preview` rows).
- Each click writes `parent_contact_id` to the single child contact (depth + cycle handled by trigger).
- No `leg` writes initially — leave `leg` empty until a separate `leg-assignment` workflow is approved.
- Full audit log entry per link.

---

## File / Surface Map

- **Sponsor Review page**: `src/pages/SponsorIdReview.tsx` (admin-only, gated by `OWNER_ID` check)
- **I2D Ready Gate panel**: same file, in the read-only summary section
- **Final Audit Report**: same file, just below the I2D Ready Gate
- **Verification Checks**: same file, below Final Audit Report
- **Final Verification CSV export**: `exportFinalVerificationCsv` function in same file
- **DB tree trigger**: `validate_contact_tree` (defined in earlier I2A migration)
- **DB enum trigger**: `validate_contact_enums`
- **DB normalization trigger**: `auto_normalize_contact`

---

**End of handover. System is locked and ready to hold pending I2D approval.**
