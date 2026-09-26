-- Migration: Create ithink_logistics table for IThink Logistics courier tracking
CREATE TABLE IF NOT EXISTS public.ithink_logistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL,
    awb_no text NOT NULL,
    courier_company text,
    order_status text,
    order_pickup_date text,
    campaign_id text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_ithink_logistics_order_awb UNIQUE (order_number, awb_no)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ithink_logistics_order_no ON public.ithink_logistics(order_number);
CREATE INDEX IF NOT EXISTS idx_ithink_logistics_awb ON public.ithink_logistics(awb_no);
CREATE INDEX IF NOT EXISTS idx_ithink_logistics_campaign ON public.ithink_logistics(campaign_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ithink_logistics ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Allow anon full access to ithink_logistics" ON public.ithink_logistics;
CREATE POLICY "Allow anon full access to ithink_logistics" ON public.ithink_logistics
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow authenticated full access
DROP POLICY IF EXISTS "Allow authenticated full access to ithink_logistics" ON public.ithink_logistics;
CREATE POLICY "Allow authenticated full access to ithink_logistics" ON public.ithink_logistics
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access to ithink_logistics" ON public.ithink_logistics;
CREATE POLICY "Allow service_role full access to ithink_logistics" ON public.ithink_logistics
    FOR ALL TO service_role USING (true) WITH CHECK (true);
