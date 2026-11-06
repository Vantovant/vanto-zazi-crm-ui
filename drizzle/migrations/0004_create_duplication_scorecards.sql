CREATE TABLE public.duplication_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  week_start date NOT NULL,
  new_introduced integer NOT NULL DEFAULT 0,
  helped_started integer NOT NULL DEFAULT 0,
  taught_to_introduce integer NOT NULL DEFAULT 0,
  team_introduced integer NOT NULL DEFAULT 0,
  four_by_four integer NOT NULL DEFAULT 0,
  team_pv numeric NOT NULL DEFAULT 0,
  rating text,
  gap_type text,
  fix_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duplication_scorecards TO authenticated;
GRANT ALL ON public.duplication_scorecards TO service_role;
ALTER TABLE public.duplication_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own scorecards select" ON public.duplication_scorecards FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own scorecards insert" ON public.duplication_scorecards FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own scorecards update" ON public.duplication_scorecards FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own scorecards delete" ON public.duplication_scorecards FOR DELETE TO authenticated USING (user_id = auth.uid());

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
  RETURN NEW;
END $$;
CREATE TRIGGER validate_duplication_scorecard BEFORE INSERT OR UPDATE ON public.duplication_scorecards
FOR EACH ROW EXECUTE FUNCTION public.validate_duplication_scorecard();
CREATE TRIGGER duplication_scorecards_updated_at BEFORE UPDATE ON public.duplication_scorecards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();