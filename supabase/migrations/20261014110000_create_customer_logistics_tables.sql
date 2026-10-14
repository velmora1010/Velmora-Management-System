-- Migration: Create customer_tracking_shipments and customer_dispatch_batches
-- Mirrors the proven influencer tracking design, safely isolated for customer orders

CREATE TABLE IF NOT EXISTS public.customer_dispatch_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id text NOT NULL,
    batch_name text NOT NULL,
    dispatch_date text NOT NULL,
    dispatch_time text,
    courier text,
    status text DEFAULT 'Ready to Dispatch',
    total_orders integer DEFAULT 0,
    dispatched_orders integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_customer_dispatch_batches UNIQUE (batch_id)
);

CREATE TABLE IF NOT EXISTS public.customer_tracking_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id text NOT NULL,
    display_order_id text,
    awb_number text NOT NULL,
    courier text NOT NULL,
    status text NOT NULL DEFAULT 'In Transit',
    raw_status text,
    status_source text DEFAULT 'LIVE_API',
    source_type text DEFAULT 'CUSTOMER_ORDER',
    dispatch_date text,
    estimated_delivery_date text,
    delivered_date text,
    last_synced_at timestamp with time zone,
    tracking_url text,
    remarks text,
    last_location text,
    tracking_date_time text,
    customer_name text,
    phone_number text,
    alt_phone_number text,
    address text,
    state text,
    city text,
    pincode text,
    products text,
    amount numeric(12,2) DEFAULT 0,
    order_type text,
    batch_id text,
    batch_name text,
    sync_error text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_customer_tracking_shipments UNIQUE (courier, awb_number)
);

-- Enable RLS
ALTER TABLE public.customer_dispatch_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tracking_shipments ENABLE ROW LEVEL SECURITY;

-- Allow anon full access
DROP POLICY IF EXISTS "Allow anon full access to customer_dispatch_batches" ON public.customer_dispatch_batches;
CREATE POLICY "Allow anon full access to customer_dispatch_batches" ON public.customer_dispatch_batches
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to customer_tracking_shipments" ON public.customer_tracking_shipments;
CREATE POLICY "Allow anon full access to customer_tracking_shipments" ON public.customer_tracking_shipments
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow authenticated full access
DROP POLICY IF EXISTS "Allow authenticated full access to customer_dispatch_batches" ON public.customer_dispatch_batches;
CREATE POLICY "Allow authenticated full access to customer_dispatch_batches" ON public.customer_dispatch_batches
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to customer_tracking_shipments" ON public.customer_tracking_shipments;
CREATE POLICY "Allow authenticated full access to customer_tracking_shipments" ON public.customer_tracking_shipments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access to customer_dispatch_batches" ON public.customer_dispatch_batches;
CREATE POLICY "Allow service_role full access to customer_dispatch_batches" ON public.customer_dispatch_batches
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to customer_tracking_shipments" ON public.customer_tracking_shipments;
CREATE POLICY "Allow service_role full access to customer_tracking_shipments" ON public.customer_tracking_shipments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_tracking_shipments_awb ON public.customer_tracking_shipments(awb_number);
CREATE INDEX IF NOT EXISTS idx_customer_tracking_shipments_order ON public.customer_tracking_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_tracking_shipments_courier ON public.customer_tracking_shipments(courier);
CREATE INDEX IF NOT EXISTS idx_customer_tracking_shipments_status ON public.customer_tracking_shipments(status);
CREATE INDEX IF NOT EXISTS idx_customer_tracking_shipments_batch ON public.customer_tracking_shipments(batch_id);
