
-- Add dedupe_key column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Create unique partial index on dedupe_key per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_dedupe_key 
  ON public.orders (user_id, dedupe_key) 
  WHERE dedupe_key IS NOT NULL;

-- Clean up existing duplicates from previous smart paste runs
-- For each group of duplicates (same user_id + same source + same contact_name + same product + same quantity + same amount + same pv_amount + same order_date),
-- keep the oldest row and delete the rest
WITH duplicate_groups AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, source, contact_name, product, quantity, amount, pv_amount, purchase_type, order_date
      ORDER BY created_at ASC
    ) AS rn
  FROM public.orders
  WHERE source = 'backoffice-paste'
),
to_delete AS (
  SELECT id FROM duplicate_groups WHERE rn > 1
)
DELETE FROM public.orders WHERE id IN (SELECT id FROM to_delete);

-- Now backfill dedupe_key for existing backoffice-paste orders
UPDATE public.orders
SET dedupe_key = md5(
  COALESCE(lower(trim(contact_name)), '') || '|' ||
  COALESCE(lower(trim(product)), '') || '|' ||
  COALESCE(quantity::text, '0') || '|' ||
  COALESCE(amount::text, '0') || '|' ||
  COALESCE(pv_amount::text, '0') || '|' ||
  COALESCE(lower(trim(purchase_type)), '') || '|' ||
  COALESCE(order_date::text, '') || '|' ||
  COALESCE(lower(trim(source)), 'manual')
)
WHERE source = 'backoffice-paste' AND dedupe_key IS NULL;
