
-- 1. Create inventory table
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_name)
);

-- 2. Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Users can select own inventory" ON public.inventory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inventory" ON public.inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inventory" ON public.inventory
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own inventory" ON public.inventory
  FOR DELETE USING (auth.uid() = user_id);

-- 4. updated_at trigger
CREATE TRIGGER set_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Add sales_channel to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sales_channel text NOT NULL DEFAULT 'Online';

-- 6. Atomic offline order RPC
CREATE OR REPLACE FUNCTION public.create_offline_order_and_deduct_stock(
  p_user_id uuid,
  p_contact_id uuid,
  p_contact_name text,
  p_product text,
  p_quantity integer,
  p_amount numeric,
  p_pv_amount numeric,
  p_purchase_type text,
  p_status text,
  p_source text,
  p_order_date date,
  p_order_id text,
  p_badges text[],
  p_sales_channel text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock integer;
  v_inv_id uuid;
  v_order_id uuid;
BEGIN
  -- Lock the inventory row
  SELECT id, stock_quantity INTO v_inv_id, v_stock
  FROM public.inventory
  WHERE user_id = p_user_id AND product_name = p_product
  FOR UPDATE;

  IF v_inv_id IS NULL THEN
    RAISE EXCEPTION 'Product "%" not found in your inventory', p_product;
  END IF;

  IF v_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: have %, need %', v_stock, p_quantity;
  END IF;

  -- Deduct stock
  UPDATE public.inventory
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = v_inv_id;

  -- Insert order
  INSERT INTO public.orders (
    user_id, contact_id, contact_name, product, quantity, amount,
    pv_amount, purchase_type, status, source, order_date, order_id,
    badges, sales_channel
  ) VALUES (
    p_user_id, p_contact_id, p_contact_name, p_product, p_quantity, p_amount,
    p_pv_amount, p_purchase_type, p_status, p_source, p_order_date, p_order_id,
    p_badges, p_sales_channel
  ) RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;
