# Duplication Scorecard page

Context loaded. Here's the plan.

## What you get
- New page "Duplication Scorecard" at `/duplication-scorecard`, linked in the main sidebar/mobile nav. No other page changes.
- Title "My Weekly Duplication Scorecard", subtitle "Complete it honestly every Friday."
- Week selector: defaults to the current Monday–Sunday week in South African time (GMT+2), with previous/next arrows (next disabled past the current week).
- Six number boxes with gold numbered circles (box 5 limited to 0–4; others whole numbers 0+; PV allows decimals).
- "This week vs last week": Progressing / Standing still / Declining. If last week exists, a hint "Suggested: …" (more boxes up than down = Progressing, more down = Declining, else Standing still). You still choose.
- "Didn't duplicate this week?" section: expanded when rating is Standing still/Declining or boxes 1–3 are all 0; otherwise collapsed. Three selectable cards (Skill / Activity / Belief) with the fix text, plus "My one fix before next Friday."
- Save button: saves or updates that week (never duplicates). Loads the saved week when you switch weeks.
- "Past weeks" list, newest first: six numbers, rating, gap type.
- Dark background, gold accents via theme tokens (a `gold` token added to the shared theme, used only on this page), mobile-first layout.

## Database (new table only)
```sql
CREATE TABLE public.duplication_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  week_start date NOT NULL,           -- Monday
  new_introduced integer NOT NULL DEFAULT 0,
  helped_started integer NOT NULL DEFAULT 0,
  taught_to_introduce integer NOT NULL DEFAULT 0,
  team_introduced integer NOT NULL DEFAULT 0,
  four_by_four integer NOT NULL DEFAULT 0,
  team_pv numeric NOT NULL DEFAULT 0,
  rating text,                        -- progressing | standing_still | declining
  gap_type text,                      -- skill | activity | belief (optional)
  fix_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duplication_scorecards TO authenticated;
GRANT ALL ON public.duplication_scorecards TO service_role;
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
-- 4 policies: select/insert/update/delete WHERE user_id = auth.uid()
-- validation trigger: numbers >= 0, four_by_four 0–4, week_start is a Monday,
--   rating/gap_type in allowed values; updated_at trigger (existing update_updated_at_column)
```
Save = upsert on `(user_id, week_start)`.

## Not touched
Existing pages, tables, sending, consent, MCP connectors. This table is not exposed to any MCP tool.

## Rollback
Remove the page + nav link; the table can be left in place (or dropped only with your OK).

## Conflicts
None found. Category: UI + backend (new table/RLS).
