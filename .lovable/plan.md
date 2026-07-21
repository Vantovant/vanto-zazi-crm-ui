# Three Automated Campaign Modules — Plan v1

Built on the **Reactivation Campaign Portable Spec v1** blueprint. Each campaign is a self-contained module with its own recipients table, tick function, cron windows, kill-switch, and dashboard tab — but all share ONE choke-point send function (`maytapi-send-1to1`) so guardrails are enforced globally.

**Category: backend + UI + infra + platform (Maytapi).**

⚠️ This breaks the current **MP1 Green Light Rule** (manual review per send). Approving this plan = explicit override authorising automated, throttled, cron-driven sends for these three campaigns only. All other Maytapi paths stay manual.

---

## 1. Shared foundation (build once, reuse 3×)

- **`campaign_recipients_base`** schema pattern (per Reactivation spec §3): `id, member_id, name, first_name, phone_normalized, email, contact_id, status, attempts, last_attempt_at, sent_at, provider_message_id, delivered_at, read_at, replied_at, reply_preview, error, created_at` + UNIQUE index on `phone_normalized`.
- **Kill-switch keys** in `integration_settings`: `<campaign>_enabled`, `<campaign>_daily_cap`, `<campaign>_per_tick_cap`.
- **Inbound stamping**: extend `maytapi-inbound` to match `provider_message_id` across ALL three recipient tables and stamp `delivered_at / read_at / replied_at + reply_preview`.
- **Shared dashboard shell** (`CampaignModule.tsx`): tabs Recipients · Import · Replies · Settings. Sort rule: replied first (desc), then queued by `created_at` asc.
- **Guardrails (non-negotiable)** enforced in `maytapi-send-1to1`: kill-switch check, 24h workspace cap, 6h cooldown per number, skip DNC/opt-out/invalid, unique-index dedupe.

---

## 2. Campaign A — Birthday Campaign 🎂

**Route:** `/campaigns/birthday`
**Table:** `birthday_campaign_recipients` (adds `birth_date`, `congratulate_by_date`, `tone`)
**Source:** hoist from existing `contact_birthdays` where `status='not_congratulated'` and `congratulate_by_date = today` (SA timezone).
**Template:** birthday body with `{FirstName}`, tone selector (warm/royal/spiritual/professional), APLGO brand URL last for link preview.
**Cadence:** 3 windows/day (08:30, 12:00, 16:00 SAST), cap 8 per window = 24/day max.
**Tick function:** `birthday-campaign-tick` — auto-hoists today's birthdays into recipients on first run of the day, then sends queued rows.
**On success:** also updates `contact_birthdays.status = 'congratulated'` (keeps existing panel accurate).
**Deadline logic:** each row expires at end-of-day SAST (birthdays are date-locked).

---

## 3. Campaign B — Activation Campaign 💳

**Route:** `/campaigns/activation`
**Table:** `activation_campaign_recipients` (adds `activation_date`, `pack_type`, `sponsor_name`)
**Source:** manual paste/CSV import OR auto-hoist from `orders` where `purchase_type='activation'` AND `status='paid'` AND no activation message sent yet.
**Template:** welcome/activation congratulations + next-steps link (training/onboarding URL). `{FirstName}`, `{PackType}`, `{SponsorName}`.
**Cadence:** 4 windows/day (09:00, 11:00, 14:00, 17:00 SAST), cap 10 per window = 40/day max.
**Tick function:** `activation-campaign-tick`.
**Deadline:** rolling — send within 48h of paid activation (target `daily_required = ceil(queued/2)`).
**Success side-effect:** writes `contact_activities` row (`activity_type='whatsapp'`, summary='Activation welcome sent').

---

## 4. Campaign C — Zoom Invitation Campaign 📹

**Route:** `/campaigns/zoom-invite`
**Table:** `zoom_campaign_recipients` (adds `event_id`, `event_date`, `zoom_url`, `reminder_stage` ENUM: `t_minus_48h | t_minus_24h | t_minus_2h`)
**Source:** manual list per event (paste/CSV or pick a segment: Lead Type, Tags, custom filter). One event = one campaign instance identified by `event_id`.
**Template:** invite body with `{FirstName}`, `{EventDate}`, `{ZoomURL}` last (for preview card), 2 quick-reply options (`1` = confirm, `2` = can't make it).
**Cadence:** event-driven — 3 sends per recipient across lifecycle: T-48h, T-24h, T-2h. Each stage has its own tick pass, cap 10/window.
**Tick function:** `zoom-campaign-tick` — picks rows where `reminder_stage <= now_offset` and status='queued', bumps stage after each send.
**Deadline:** hard stop at event start; cron ignores rows past `event_date`.

---

## 5. Cron schedules (pg_cron, UTC)

```text
Birthday   06:30, 10:00, 14:00 UTC   → 08:30/12:00/16:00 SAST
Activation 07:00, 09:00, 12:00, 15:00 UTC
Zoom       every 30 min (function decides which stage to fire)
```

## 6. Dashboard UX (per campaign)

Stat cards: Total · Queued · Sent · Delivered · Read · Replied · Failed.
Table: Name · Phone · Status · Sent at · Delivery event · Reply preview · Actions (Send now / Skip / Open conversation).
Replies subtab: `replied_at IS NOT NULL`, newest first, click → ContactDrawer.
Settings subtab: kill switch, daily cap, per-tick cap, active windows.

## 7. Technical details (for the dev)

**New files:**
- `supabase/migrations/<ts>_campaign_recipients.sql` — 3 tables + indexes + RLS (admin read/write via `has_role`) + GRANTs (`authenticated` SELECT/INSERT/UPDATE/DELETE, `service_role` ALL) + kill-switch rows in `integration_settings`.
- `supabase/functions/birthday-campaign-tick/index.ts`
- `supabase/functions/activation-campaign-tick/index.ts`
- `supabase/functions/zoom-campaign-tick/index.ts`
- `src/components/campaigns/CampaignModule.tsx` (shared shell)
- `src/pages/campaigns/BirthdayCampaign.tsx`
- `src/pages/campaigns/ActivationCampaign.tsx`
- `src/pages/campaigns/ZoomCampaign.tsx`
- `src/hooks/useCampaignRecipients.ts`

**Modified:**
- `supabase/functions/maytapi-inbound/index.ts` — extend stamping to 3 new tables.
- `supabase/functions/maytapi-send-1to1/index.ts` — accept `source='<campaign>'` tag, enforce cooldown + 24h cap globally.
- `src/App.tsx` — 3 new routes.
- `src/components/Sidebar.tsx` — "Campaigns" section with 3 items.

**Rollout gate:** every campaign ships **disabled by default** (`<campaign>_enabled = 'false'`). You flip it on per campaign after a dry-run (`{dry_run: true}`) shows the queue is clean.

---

## 8. What I need from you to proceed

1. **Approval override** for MP1 rule for these 3 campaigns only. ✅ / ❌
2. **Templates** — do you want me to draft the initial body for each and let you edit, or will you provide? (Default: I draft.)
3. **Cap tuning** — my proposed caps are conservative (24 / 40 / 30 per day). Confirm or adjust.
4. **Zoom source of truth** — is there an existing events table I should read from, or is Zoom campaigns always a manual per-event paste?

Say **"go"** with answers and I'll implement in one batch.