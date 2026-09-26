-- Migration: Create india_post_tracking table for manual India Post tracking entries
CREATE TABLE IF NOT EXISTS public.india_post_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    order_id text NOT NULL,
    awb_number text NOT NULL,
    courier text NOT NULL DEFAULT 'India Post',
    status text NOT NULL,
    status_category text,
    dispatch_date text NOT NULL,
    estimated_delivery_date text,
    delivered_date text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_india_post_tracking_campaign ON public.india_post_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_india_post_tracking_order ON public.india_post_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_india_post_tracking_awb ON public.india_post_tracking(awb_number);
CREATE INDEX IF NOT EXISTS idx_india_post_tracking_status ON public.india_post_tracking(status);

-- Enable RLS
ALTER TABLE public.india_post_tracking ENABLE ROW LEVEL SECURITY;

-- Allow anon full access
DROP POLICY IF EXISTS "Allow anon full access to india_post_tracking" ON public.india_post_tracking;
CREATE POLICY "Allow anon full access to india_post_tracking" ON public.india_post_tracking
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow authenticated full access
DROP POLICY IF EXISTS "Allow authenticated full access to india_post_tracking" ON public.india_post_tracking;
CREATE POLICY "Allow authenticated full access to india_post_tracking" ON public.india_post_tracking
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access to india_post_tracking" ON public.india_post_tracking;
CREATE POLICY "Allow service_role full access to india_post_tracking" ON public.india_post_tracking
    FOR ALL TO service_role USING (true) WITH CHECK (true);
