-- Migration: Create Website Sales Department Tables
-- Tables: website_order_uploads, website_order_raw_rows, website_orders, website_order_items

-- 1. Website Upload Batches
CREATE TABLE IF NOT EXISTS public.website_order_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  uploaded_by text DEFAULT 'Sales Manager',
  uploaded_at timestamptz DEFAULT now(),
  total_source_rows integer DEFAULT 0,
  total_unique_orders integer DEFAULT 0,
  valid_rows integer DEFAULT 0,
  invalid_rows integer DEFAULT 0,
  duplicate_order_count integer DEFAULT 0,
  price_interpretation text DEFAULT 'Order Total',
  status text DEFAULT 'COMPLETED',
  column_mapping jsonb,
  file_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Website Raw Order Rows
CREATE TABLE IF NOT EXISTS public.website_order_raw_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_batch_id uuid REFERENCES public.website_order_uploads(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  raw_data jsonb NOT NULL,
  order_id text,
  customer_name text,
  product_name text,
  quantity text,
  price text,
  payment_mode text,
  validation_status text DEFAULT 'VALID',
  validation_errors text[],
  created_at timestamptz DEFAULT now()
);

-- 3. Website Consolidated Orders
CREATE TABLE IF NOT EXISTS public.website_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  customer_name text,
  address text,
  state text,
  city text,
  pincode text,
  offer text,
  price numeric(12,2) DEFAULT 0,
  phone text,
  payment_mode text DEFAULT 'UNKNOWN',
  source_payment_mode text,
  total_quantity integer DEFAULT 0,
  upload_batch_id uuid REFERENCES public.website_order_uploads(id) ON DELETE CASCADE,
  data_conflict boolean DEFAULT false,
  conflict_details text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Website Order Items
CREATE TABLE IF NOT EXISTS public.website_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_order_id uuid REFERENCES public.website_orders(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  product_code text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2),
  line_total numeric(12,2),
  source_row_number integer,
  created_at timestamptz DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_website_orders_order_id ON public.website_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_website_orders_batch_id ON public.website_orders(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_website_orders_state ON public.website_orders(state);
CREATE INDEX IF NOT EXISTS idx_website_orders_city ON public.website_orders(city);
CREATE INDEX IF NOT EXISTS idx_website_orders_payment_mode ON public.website_orders(payment_mode);
CREATE INDEX IF NOT EXISTS idx_website_order_raw_rows_batch ON public.website_order_raw_rows(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_website_order_items_order_id ON public.website_order_items(website_order_id);
