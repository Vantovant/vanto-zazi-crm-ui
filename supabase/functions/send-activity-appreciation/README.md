# send-activity-appreciation

Canonical, single-path sender for "Monthly Activity" WhatsApp appreciation messages.
Closes the gap between the app's manual crown-click flow, `auto-send-micro-live`,
and ad-hoc direct-to-Lovable send instructions — all three now converge on this
one function, the same message-template library, and the same tracker marker.

## Deploy (GitHub write access is blocked for this connector — push locally)

1. Copy `index.ts` into your repo at:
   `supabase/functions/send-activity-appreciation/index.ts`
2. Commit and push from your local clone (same workaround already used for
   `mcp-bridge` and `mcp-server` — the GitHub App's write permission 403s on
   this repo regardless of access settings).
3. In Lovable chat, ask it to sync from the latest GitHub commit and deploy
   the `send-activity-appreciation` function — same lightweight sync step used
   for `mcp-bridge` previously. No `verify_jwt` change needed; this function
   authenticates normally via the caller's Supabase session (same pattern as
   `auto-send-micro-live`), not a custom header.

## Call it

**Preview first (writes nothing, sends nothing):**
```
POST /functions/v1/send-activity-appreciation
Authorization: Bearer <your session token>
{ "month": "2026-07", "dry_run": true }
```
Returns the full candidate list with rendered message previews and skip reasons.

**Actually send:**
```
POST /functions/v1/send-activity-appreciation
{ "month": "2026-07" }
```
`month` defaults to the current SAST month if omitted. Optional `limit` caps
this run below the daily cap.

**Via Lovable chat**, once deployed, the instruction becomes:
> "Run send-activity-appreciation for July, dry run first"

instead of "start sending the WhatsApp messages" — which is what caused this
gap in the first place (Lovable writing fresh one-off logic per request).

## What it reads from

- **Candidates**: any order with `purchase_type = 'Activity'` and an
  `order_date` in the target month — regardless of whether it came from
  Smart Paste Orders, Monthly Activity Paste, or manual entry. New pastes
  become sendable automatically, no extra wiring per batch.
- **Wording**: `message_templates` where `category = 'Monthly Activity'` and
  `send_when_condition = 'Contact paid monthly activity'` (currently:
  "Activity Purchase Thank You"). Edit that row to change the wording —
  no redeploy needed.
- **Dedupe**: `contact_activities` entries carrying
  `[monthly_activity_appreciation_entry:oid:<order_id>]`. An order that
  already has this marker is skipped unconditionally.

## Caps and guardrails

- Daily cap: `integration_settings.auto_send_daily_cap` (defaults to 20 —
  the "not more than twenty messages per day" pacing rule).
- Quiet hours: `auto_send_quiet_start_hour` / `auto_send_quiet_end_hour`
  (defaults 08:00–19:00 SAST).
- Skips `do_not_contact`, `Unsubscribed`, and no-phone contacts rather than
  queuing them.
- Every send writes the same three markers the Monthly Activity Push page
  already reads — so Done/Pending stays accurate regardless of which channel
  triggered the send.

## Not yet wired (future work, not done in this pass)

- No UI button yet on the Orders/Monthly Activity Push page — currently
  callable via direct HTTP call or a Lovable chat instruction only. Adding a
  "Send via Tracker" button that calls this with `dry_run:true` for preview
  would close the last manual step.
- No cron tick. Could be scheduled like `birthday-campaign-tick` if you want
  it to run automatically each month rather than on request.
- Only one template currently exists in the library for this trigger
  condition, so all sends use identical wording. The function is written to
  pick whichever active template matches — adding tiered templates (e.g. by
  amount) to `message_templates` later would work without a code change,
  provided a selection rule is added to pick between them.
