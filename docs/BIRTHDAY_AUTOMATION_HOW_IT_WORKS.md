# Birthday Campaign – Fully Automated (GetWell Grow)

_Last updated: 22 July 2026_

## What just went live

- **Kill-switch:** ENABLED for the Birthday Campaign.
- **Schedule:** `birthday-campaign-tick` runs **every 15 minutes** via `pg_cron`.
- **Dedup:** Duplicate recipients removed. A **unique index** now blocks any
  future duplicate (same phone + same year cannot be enrolled twice).
- **Greeting:** Every message now addresses the recipient as
  **"Leader &lt;First Name&gt;"** (across all four tones: warm, royal, spiritual, professional).
- **First live send:** 1 message dispatched to today's birthday (Tau Matebello Victoria).
  Remaining 14 recipients stay `queued` and fire automatically on their own
  `congratulate_by_date`.

## End-to-end flow (no manual steps)

```text
Birthday Smart Paste  ──►  contact_birthdays  ──►  BirthdayPanel
                                                        │
                          [Enroll in Birthday Campaign] │  (one-click, or
                                                        ▼   automatic re-enroll)
                                     birthday_campaign_recipients (queued)
                                                        │
                                              pg_cron every 15 min
                                                        ▼
                                          birthday-campaign-tick
                                                        │
                          ┌─────────────────────────────┼─────────────────────────────┐
                          ▼                             ▼                             ▼
                 kill-switch check           per-tick / daily caps          6h cooldown per phone
                          │                             │                             │
                          └─────────────────────────────┴─────────────────────────────┘
                                                        ▼
                                        VantoOS hub dnc_check (marketing)
                                                        │
                                                        ▼
                                             Maytapi sendMessage
                                                        │
                                                        ▼
                                        hub.send_recorded  +  row → sent
```

## Guardrails (why this is safe to leave on)

| Guardrail            | Setting                                     |
|----------------------|---------------------------------------------|
| Kill-switch          | `campaign_settings.enabled = true` (birthday) |
| Daily cap            | 24 sends / day                              |
| Per-tick cap         | 8 sends / 15 min                            |
| Per-phone cooldown   | 6 hours                                     |
| Duplicate protection | Unique index `(phone_normalized, cycle_year)` |
| Date gate            | Only rows where `congratulate_by_date <= today` |
| Opt-out              | Inbound STOP writes to `hub_bridge` DNC     |

If anything goes wrong you can stop everything in one click:
**Campaigns → Birthday → uncheck "ENABLED"** (or run
`UPDATE campaign_settings SET enabled=false WHERE campaign_key='birthday';`).

## How today's send behaved

```json
{ "campaign": "birthday", "processed": 1, "sent": 1, "skipped": 0, "failed": 0 }
```

The remaining 14 queued recipients have future `congratulate_by_date`
values (25 Jul, 26 Jul, …) and will be picked up automatically on the
first tick after their date arrives.

## Where to watch it live

1. **Campaigns → Birthday Campaign** — Sent / Delivered / Read / Failed cards
   update in real time; recipient table shows per-row status + Maytapi ID.
2. **WhatsApp → Birthdays tab** — the source list, still one-click enroll for
   any late additions.
3. **Hub Decisions Panel** — every `dnc_check` / `send_recorded` round-trip
   with the VantoOS hub is logged for audit.

## Message template

```text
https://crm.onlinecourseformlm.com/aplgo.html

Hi Leader <First Name> 🎉

Happy Birthday to you! 🎂 Wishing you joy, favor, and a
beautiful year ahead.

— Your Team
```

Tone variants (`royal`, `spiritual`, `professional`) all now begin with
**"Leader &lt;First Name&gt;"**.

## What you never have to do again

- No manual "Send today's birthdays" clicking.
- No manual dedup — the DB rejects duplicates.
- No cron babysitting — pg_cron is inside Supabase, not on your machine.
- No worrying about opt-outs — the hub enforces DNC before every send.

## Emergency kill

```sql
UPDATE public.campaign_settings SET enabled = false WHERE campaign_key = 'birthday';
SELECT cron.unschedule('birthday-campaign-tick-15m');
```
