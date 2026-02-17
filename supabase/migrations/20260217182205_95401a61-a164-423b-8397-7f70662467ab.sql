
-- Create storage bucket for knowledge documents
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-docs', 'knowledge-docs', false);

-- Storage policies: users can only access their own folder
CREATE POLICY "Users can upload their own docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own docs"
ON storage.objects FOR DELETE
USING (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create table for extracted document content
CREATE TABLE public.user_knowledge_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  extracted_text TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own docs" ON public.user_knowledge_docs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own docs" ON public.user_knowledge_docs
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own docs" ON public.user_knowledge_docs
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own docs" ON public.user_knowledge_docs
FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_knowledge_docs_updated_at
BEFORE UPDATE ON public.user_knowledge_docs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
