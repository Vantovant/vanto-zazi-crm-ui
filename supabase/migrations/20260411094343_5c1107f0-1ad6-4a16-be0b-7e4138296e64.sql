
CREATE TABLE public.contact_waiting_room (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL DEFAULT 'other',
  issue_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_waiting_room ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own waiting room" ON public.contact_waiting_room FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own waiting room" ON public.contact_waiting_room FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own waiting room" ON public.contact_waiting_room FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own waiting room" ON public.contact_waiting_room FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_waiting_room_user_status ON public.contact_waiting_room(user_id, status);
CREATE INDEX idx_waiting_room_contact ON public.contact_waiting_room(contact_id);

CREATE TRIGGER update_waiting_room_updated_at
  BEFORE UPDATE ON public.contact_waiting_room
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
