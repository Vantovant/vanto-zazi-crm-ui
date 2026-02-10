
-- ============================================
-- CONTACTS TABLE (23-column Prospect schema)
-- ============================================
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date_captured DATE NOT NULL DEFAULT CURRENT_DATE,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL DEFAULT '',
  email_address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'South Africa',
  lead_temperature TEXT NOT NULL DEFAULT 'Warm' CHECK (lead_temperature IN ('Hot', 'Warm', 'Cold')),
  communication_status TEXT NOT NULL DEFAULT 'New' CHECK (communication_status IN ('New', 'In Progress', 'Pending', 'Completed')),
  registration_status TEXT NOT NULL DEFAULT 'Not Registered' CHECK (registration_status IN ('Registered', 'Not Registered', 'Activated')),
  lead_type TEXT NOT NULL DEFAULT 'Prospect' CHECK (lead_type IN ('Prospect', 'Customer', 'Distributor')),
  interest_level TEXT NOT NULL DEFAULT 'Medium' CHECK (interest_level IN ('High', 'Medium', 'Low')),
  focus_area TEXT NOT NULL DEFAULT 'Health Transformation' CHECK (focus_area IN ('Health Transformation', 'Business Opportunity', 'Both')),
  lead_path TEXT NOT NULL DEFAULT 'Not sure yet' CHECK (lead_path IN ('Customer', 'Distributor', 'Not sure yet')),
  sponsor_name TEXT NOT NULL DEFAULT '',
  assigned_to TEXT NOT NULL DEFAULT '',
  action_taken TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  meeting_time TEXT NOT NULL DEFAULT '',
  aplgo_id TEXT NOT NULL DEFAULT '',
  associate_status TEXT NOT NULL DEFAULT '',
  additional_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for contacts
CREATE POLICY "Users can view their own contacts"
  ON public.contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.contacts FOR DELETE
  USING (auth.uid() = user_id);

-- Timestamp trigger for contacts
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id TEXT NOT NULL DEFAULT '',
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  product TEXT NOT NULL DEFAULT '',
  quantity INT NOT NULL DEFAULT 1,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Delivered', 'Activated')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  badges TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS policies for orders
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own orders"
  ON public.orders FOR DELETE
  USING (auth.uid() = user_id);

-- Timestamp trigger for orders
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_contact_id ON public.orders(contact_id);
