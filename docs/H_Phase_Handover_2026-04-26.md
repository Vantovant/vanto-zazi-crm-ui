# H-Phase Handover — Maytapi Inbox Foundation

**Date:** 2026-04-26
**Phases covered:** H1, H2, H2A, H3, H3A, H4, H5, H6, H7
**Status:** All H-phases LOCKED.

---

## 1. What H1–H6 built

| Phase | Outcome |
|-------|---------|
| **H1** | Maytapi Inbox shell (admin-only sub-tabs: Conversations / Unmatched / Audit). |
| **H2**  | Inbound memory: matched inbound messages persisted to `maytapi_messages`. |
| **H2A** | Unknown-number isolation: unknown senders never enter the main conversation history; phone is stored as `phone_hash` + `phone_last4` only. |
| **H3**  | Unmatched gate: admin can **Link** an unknown number to an existing CRM contact, or **Ignore** it. Status: `open` / `linked` / `ignored`. |
| **H3A** | Linked-gate propagation: once linked, future inbound from that hash is routed to the linked contact. **Old history is NOT backfilled.** |
| **H4**  | Read/unread state, search by name / message / last4, and mobile-stable layout. |
| **H5**  | Audit visibility tab + retention summary. **No cleanup / cron.** |
| **H6**  | Audit UX polish: row detail drawer, redacted manual CSV export, filter presets, mobile support. |
| **H7**  | QA, regression checklist, H-Phase Health diagnostics panel, this handover doc. **No new business behavior.** |

---

## 2. Tables involved

- `maytapi_messages` — matched conversation memory. Inbound + outbound rows. Body and phone columns are immutable post-insert (enforced by `enforce_maytapi_messages_update_scope` trigger). Only `read_at` / `read_by` may be updated.
- `maytapi_inbound_unmatched` — unknown-sender gate. Status flow `open → linked` or `open → ignored`. Reverting `linked → open` is **blocked** by `enforce_unmatched_update_scope`.
- `maytapi_gate_audit` — admin action audit (link / ignore / marked_read / marked_unread). Validated by `validate_maytapi_gate_audit`: metadata may **never** contain `phone_e164`, `phone_number`, `phone_normalized`, `body`, `body_preview`, `raw`, or `message`.

RLS: all three tables are admin-only (`has_role(auth.uid(), 'admin')`).

---

## 3. Edge functions involved

- `maytapi-inbound` — write path for inbound webhooks. Performs hash + last4, decides matched vs unmatched, applies gate routing.
- `maytapi-send-1to1` — **LOCKED send path.** Do not modify in any H-phase.
- `maytapi-send-1to1-harness` — has a pre-existing build/type issue. **Out of H-phase scope. Do not touch.**
- `maytapi-health` — read-only health probe. Untouched.

---

## 4. Privacy rules (enforced)

- Matched contacts only appear in main conversation history.
- Unknown numbers are masked to `••••<last4>` everywhere in the UI.
- No unknown body is stored in main conversation history.
- Audit CSV export (H6) contains **only**: `action`, `actor_display_name`, `linked_contact_name`, `phone_last4`, `created_at`, `safe_metadata_summary`.
- Audit CSV does **NOT** contain: raw phone, phone_hash, message body, body_preview, raw webhook payload, secrets, tokens, API keys.
- H-Phase Health panel (H7) shows aggregate counts and timestamps only — no raw phone, no body, no payload.

---

## 5. Hard NO list

The following are **not** part of any H-phase and must not be added without an explicit new phase prompt:

- ❌ Auto-reply
- ❌ AI suggestions in the inbox
- ❌ Send All
- ❌ Cron / scheduled jobs / cleanup / archive / purge
- ❌ Production-mode flip from this UI
- ❌ Any mutation of `contacts.lead_type`, `contacts.leg`, `parent_contact_id`, `tree_depth`
- ❌ Reply box in the inbox
- ❌ Any new send path
- ❌ Mutating `prospector_send_log`, `zazi_actions` send lifecycle, or `contact_activities` token format from the inbox

---

## 6. Mobile behavior summary

- Sub-tabs wrap on narrow viewports.
- Conversation list and audit rows render as stacked cards on mobile.
- Audit detail drawer (H6) and link-to-contact modal fit small screens.
- Bottom padding (`pb-24` / `pb-32`) prevents content from being hidden behind floating widgets (Zazi Copilot bubble, install banner).
- No horizontal scroll on Android Chrome / Edge mobile / installed PWA at common widths.

---

## 7. What not to touch

- `supabase/functions/maytapi-send-1to1/`
- `supabase/functions/maytapi-send-1to1-harness/` (pre-existing build issue, out of scope)
- `supabase/functions/maytapi-health/`
- Business logic in `supabase/functions/maytapi-inbound/` (read-only diagnostics only)
- `prospector_send_log` table and `ProspectorSendAuditPanel`, `ProspectorInbox`, `ProspectorProposalCard` components
- `contact_activities` token format
- `zazi_actions` send lifecycle
- `contacts.lead_type`, `contacts.leg`, `parent_contact_id`, `tree_depth`

---

## 8. Known risks

1. **Webhook freshness is heuristic** — H7's H-Phase Health panel infers webhook health from the latest inbound timestamp. A genuine quiet period will look like a stale webhook. This is informational only.
2. **No retention automation** — `maytapi_gate_audit` will grow unbounded. Retention is intentionally manual until a future phase explicitly approves cleanup.
3. **Linked-gate routing is forward-only by design** — historical unmatched messages are **not** stitched into the linked contact's conversation. This is intentional (privacy + auditability) but may surprise operators expecting backfill.
4. **`maytapi-send-1to1-harness`** has a pre-existing TypeScript/build issue. Untouched in all H-phases. Must be addressed in a dedicated send-path phase, not here.
5. **Audit CSV is client-side generated** — for very large filtered sets, browser memory may bound the export size. Acceptable at current scale.

---

## 9. Recommended next roadmap (NOT implemented)

- **I1** — Binary tree schema (`parent_contact_id`, `tree_depth`) and constraints. Schema only; no UI mutation surface.
- **I2** — Tree visualizer (read-only).
- **J1** — Conversation intelligence (summarization / suggestions). **Only** after the inbox map is fully stable and a dedicated J-phase prompt is issued. Must respect all H-phase privacy rules.

---

## 10. H7 deliverables (this phase)

- New file: `src/components/HPhaseHealthPanel.tsx` — admin-only, SELECT-only diagnostics + static regression checklist + handover summary.
- Wired into `src/components/MaytapiInbox.tsx` as a 4th sub-tab: **H-Phase**.
- This document: `docs/H_Phase_Handover_2026-04-26.md`.
- No migrations. No edge function changes. No mutations of any kind.
