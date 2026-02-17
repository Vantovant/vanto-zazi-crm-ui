
-- Create contact_activities table for timestamped activity logging
CREATE TABLE public.contact_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'note',
  summary TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  next_action TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

-- Users can only see their own activities
CREATE POLICY "Users can view their own activities"
ON public.contact_activities FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities"
ON public.contact_activities FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities"
ON public.contact_activities FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_contact_activities_user ON public.contact_activities(user_id);
CREATE INDEX idx_contact_activities_contact ON public.contact_activities(contact_id);
CREATE INDEX idx_contact_activities_created ON public.contact_activities(created_at DESC);
