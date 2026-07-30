# Stop duplicate campaign messages (Monthly Activity)

## What happened

The activation (Monthly Activity) queue itself has **no duplicates** — 73 rows, 73 unique numbers.
The repeat happened *across runs*: the same people were thanked for July on 22 July, that queue was
later cleared during the Maytapi freeze, and the list was re-enrolled and sent again today.

Nothing today checks "have we already sent this person this campaign message this month?"

## The fix: a permanent send ledger check

The full outbound WhatsApp history already exists in the message log (every send is recorded with
number, body and timestamp). We use that as the source of truth so a cleared/re-pasted list can
never re-thank someone.

### 1. Suppression key
Every campaign send gets a stable key:

```text
<campaign>:<phone>:<cycle>
activation:27786241114:2026-07
birthday:27786241114:2026
zoom:27786241114:<event_id>
```

### 2. New table `campaign_send_ledger`
One row per successful send, written the moment Maytapi returns a message id.
Fields: user, campaign, phone, cycle key, contact id, dedupe key (unique), sent time, message id.

Backfilled from the existing outbound message history so the 22 July and 30 July sends are
already recorded before anything else goes out.

### 3. Pre-send guard in the shared sender
Before each send, the shared campaign sender checks the ledger:
- key already present → row is marked `skipped_duplicate` with the original send date, no message goes out
- key absent → send, then write the ledger row

This runs inside the sender, so it protects **all** campaigns (activity, birthday, zoom) and every
path — manual tick, cron, bulk enroll, or a re-paste of the same list.

### 4. Enrollment-time warning
Smart Paste / enrol actions run the same check first and show:
"12 of 40 already thanked for July — they will be skipped." You can still force-send an individual
person if you deliberately want a second message.

### 5. Visibility
The campaign page gets an "Already sent this cycle" count next to Queued/Sent/Failed, so a repeat
is obvious before you press anything.

## Technical notes

- New table `campaign_send_ledger` with a unique index on `(user_id, dedupe_key)` — the database
  itself refuses a duplicate, not just the code.
- Guard lives in `supabase/functions/_shared/campaign-send.ts`; the three tick functions are
  redeployed unchanged otherwise.
- Backfill migration parses existing outbound rows in the message log into ledger keys.
- A `force: true` flag on a single row bypasses the guard for deliberate resends.

## Not included
No changes to message wording, caps, the hub bridge, or the manual one-by-one send flow.
