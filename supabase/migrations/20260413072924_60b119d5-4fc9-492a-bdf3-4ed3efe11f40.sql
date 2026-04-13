
CREATE TABLE public.contact_birthdays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  associate_id TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  birth_date_text TEXT NOT NULL DEFAULT '',
  birth_date DATE,
  when_to_congratulate TEXT NOT NULL DEFAULT '',
  congratulate_by_date DATE,
  message_style TEXT NOT NULL DEFAULT 'warm',
  status TEXT NOT NULL DEFAULT 'not_congratulated',
  congratulated_at TIMESTAMP WITH TIME ZONE,
  cycle_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_birthdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own birthdays" ON public.contact_birthdays FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own birthdays" ON public.contact_birthdays FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own birthdays" ON public.contact_birthdays FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own birthdays" ON public.contact_birthdays FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_contact_birthdays_updated_at
  BEFORE UPDATE ON public.contact_birthdays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_contact_birthdays_user ON public.contact_birthdays(user_id);
CREATE INDEX idx_contact_birthdays_status ON public.contact_birthdays(status);
CREATE INDEX idx_contact_birthdays_date ON public.contact_birthdays(birth_date);
CREATE INDEX idx_contact_birthdays_cycle ON public.contact_birthdays(cycle_year);
