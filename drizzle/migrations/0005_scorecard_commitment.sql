ALTER TABLE public.duplication_scorecards
  ADD COLUMN commitment_action text NOT NULL DEFAULT '',
  ADD COLUMN commitment_person text NOT NULL DEFAULT '',
  ADD COLUMN last_week_done text;

CREATE OR REPLACE FUNCTION public.validate_duplication_scorecard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.new_introduced < 0 OR NEW.helped_started < 0 OR NEW.taught_to_introduce < 0
     OR NEW.team_introduced < 0 OR NEW.team_pv < 0 THEN
    RAISE EXCEPTION 'Scorecard numbers cannot be negative';
  END IF;
  IF NEW.four_by_four < 0 OR NEW.four_by_four > 4 THEN
    RAISE EXCEPTION '4x4 must be between 0 and 4';
  END IF;
  IF EXTRACT(ISODOW FROM NEW.week_start) <> 1 THEN
    RAISE EXCEPTION 'week_start must be a Monday';
  END IF;
  IF NEW.rating IS NOT NULL AND NEW.rating NOT IN ('progressing','standing_still','declining') THEN
    RAISE EXCEPTION 'Invalid rating';
  END IF;
  IF NEW.gap_type IS NOT NULL AND NEW.gap_type NOT IN ('skill','activity','belief') THEN
    RAISE EXCEPTION 'Invalid gap type';
  END IF;
  IF NEW.last_week_done IS NOT NULL AND NEW.last_week_done NOT IN ('done','partly','not_yet') THEN
    RAISE EXCEPTION 'Invalid last_week_done';
  END IF;
  RETURN NEW;
END $$;