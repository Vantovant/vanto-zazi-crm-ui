# Call Sheets page — plan

## Data check before building (needs your answer)
Your expected counts don't match the live data. Excluding Expired, de-duplicated by APLGO ID / phone:

| Level | You expected | Database today |
|---|---|---|
| 1 | 42 | 54 |
| 2 | 15 | 38 |
| 3 | 16 | 18 |
| 4 | 20 | 49 |
| 5 | 27 | 61 |

Total 220, not about 120. No duplicates found. Possible causes: your list counts only GO-active people, only one leg, or only the October group. **Tell me which filter gives your numbers.** Otherwise the page shows the live numbers and acceptance test 1 is reported as a mismatch, not faked.

Also: one contact has level 13. The 1–12 settings range leaves them out.

## Database (one additive migration)
- `contacts`: add `enrolled_on date`, `activated_on date`. Backfill from "Enrolled dd.mm.yyyy, Activated dd.mm.yyyy" in `additional_notes` and in activity notes.
- `contact_activities`: add `outcome text`, `follow_up_on date`. `activity_type` has no CHECK constraint, so nothing else changes.
- `call_sheet_settings` (user_id PK, min_level 1, max_level 5, new_days 30, steady_days 60). A validation trigger keeps values between 1 and 12. RLS is limited to `auth.uid()`. Grants go to authenticated and service_role.
- View `call_sheet_cards` (security_invoker = true): has every column you listed. It filters to numeric levels inside the user's settings range, excludes Expired, removes duplicates by APLGO ID or phone, and computes the bucket in your precedence order.
- RPC `save_call(...)` (security invoker): writes the activity row and the optional next_action / updated_at update in one transaction.
- Realtime: add `contact_activities` and `maytapi_messages` to the publication.

## Page
- `/call-sheets` route and a sidebar entry next to Contacts and Activities.
- Level tabs come from settings. Filter chips, search, and "Called today X of Y".
- Cards follow your 7-part order. Phone numbers show as 0xx xxx xxxx with a tel: link. Location shows town only, never street addresses or ID numbers.
- Opted-out people get a "No WhatsApp. Phone only." strip and no WhatsApp button.
- "Needs a level" panel at the top. "Unmatched numbers" panel at the bottom reuses the existing link flow from the Maytapi inbox.
- WhatsApp drawer shows the last 30 messages, an "Open in WhatsApp" wa.me link, and no sending. Read receipts use the existing `mark_maytapi_thread_read`, which only works for admins, the same as the inbox today.
- Undo is available for 10 seconds and deletes only the activity row it created.

## Not touched
Sending code, Maytapi gates, caps, freeze, campaign tables, consent and opt-out values, the existing Contacts, Activities, Campaigns and Birthday pages, and MCP.

## Tests
I'll run all 7 acceptance tests with temporary contacts and a temporary message, then delete them. **Deleting test rows needs your OK.** Approving this plan counts as that OK.

## Rollback
Drop the view, the RPC and the settings table, and remove the new nullable columns. No existing data is changed apart from the date backfill into the new columns.
