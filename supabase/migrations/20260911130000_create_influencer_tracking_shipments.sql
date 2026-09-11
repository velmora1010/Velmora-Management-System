-- Migration: Create influencer_tracking_shipments table for campaign influencer tracking
CREATE TABLE IF NOT EXISTS public.influencer_tracking_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    influencer_id text,
    creator_name text,
    username text,
    influencer_code text,
    order_id text,
    awb_number text NOT NULL,
    courier text NOT NULL,
    status text NOT NULL DEFAULT 'In Transit',
    status_source text DEFAULT 'st_courier',
    source_type text DEFAULT 'LIVE_API',
    dispatch_date text,
    expected_delivery_date text,
    imported_at timestamp with time zone,
    last_synced_at timestamp with time zone,
    tracking_url text,
    raw_status text,
    last_location text,
    tracking_date_time text,
    profile_photo text,
    phone_number text,
    alt_phone_number text,
    state text,
    city text,
    pincode text,
    batch_id text,
    batch_code text,
    sync_error text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_influencer_tracking_shipments UNIQUE (campaign_id, courier, awb_number)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.influencer_tracking_shipments ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Allow anon full access to influencer_tracking_shipments" ON public.influencer_tracking_shipments;
CREATE POLICY "Allow anon full access to influencer_tracking_shipments" ON public.influencer_tracking_shipments
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow authenticated full access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Allow authenticated full access to influencer_tracking_shipments" ON public.influencer_tracking_shipments;
CREATE POLICY "Allow authenticated full access to influencer_tracking_shipments" ON public.influencer_tracking_shipments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access to influencer_tracking_shipments" ON public.influencer_tracking_shipments;
CREATE POLICY "Allow service_role full access to influencer_tracking_shipments" ON public.influencer_tracking_shipments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Performance and query indexes
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_shipments_campaign ON public.influencer_tracking_shipments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_shipments_awb ON public.influencer_tracking_shipments(awb_number);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_shipments_courier ON public.influencer_tracking_shipments(courier);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_shipments_status ON public.influencer_tracking_shipments(status);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_shipments_order ON public.influencer_tracking_shipments(order_id);
