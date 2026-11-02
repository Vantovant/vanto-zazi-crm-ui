# Kairos key: allow add_contact_note with duplicate guard

Context loaded. Here's the plan.

## What changes
1. **Kairos allowlist** (bridge function only): the 4 reads + `add_contact_note`. Everything else stays 403 (log_call, bulk_set_levels, set_contact_level, create_contact, update_contact, paste_monthly_activity, update_inventory_stock, shipments, and any other tool).
2. **Optional `kairos_ref`** on `add_contact_note`, Kairos key only:
   - Text, trimmed, max 80 chars; longer returns 400 `kairos_ref_too_long`.
   - If a note with the same `kairos_ref` already exists for that contact (same owner), return that note with `"duplicate": true` and add nothing.
   - Otherwise insert the note with `kairos_ref` stored.
   - Sent with the main key: ignored (old key behaviour unchanged byte-for-byte in effect).

## Database (backend / permissions) — needs your OK
Notes live in `contact_activities` (activity_type 'note'). One additive migration:
```sql
ALTER TABLE public.contact_activities ADD COLUMN kairos_ref text;
CREATE UNIQUE INDEX contact_activities_kairos_ref_uniq
  ON public.contact_activities (user_id, contact_id, kairos_ref)
  WHERE kairos_ref IS NOT NULL;
```
- Nullable, no default, no CHECK; existing rows untouched. Length limit enforced in the function.
- Unique partial index makes the duplicate guard safe even if Kairos retries at the same moment (on conflict the function re-reads and returns the existing note).
- RLS/grants unchanged: existing owner-scoped policies already cover the new column.
- No change to sending, consent, opt-out, MCP_BRIDGE_TOKEN, Railway server or sign-in connector.

## Tests (real calls, then clean-up)
1. Kairos key, `add_contact_note` with `kairos_ref: "test-1"` → note added once.
2. Same call again → same note, `duplicate: true`, still one row.
3. Kairos key `log_call` → 403.
4. Main key `add_contact_note` (and a read) → works as before, `kairos_ref` ignored.
5. Delete all rows with `kairos_ref LIKE 'test-%'` plus the main-key test note.

Real Kairos key is only in secrets; tests run against the deployed function using a temporary stand-in only if I can't read it — I'll say which.

## Rollback
Revert allowlist line; drop index and column (only after your OK).
