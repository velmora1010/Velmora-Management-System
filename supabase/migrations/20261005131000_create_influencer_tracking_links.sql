-- Migration: Create influencer_tracking_links table
-- Purpose: Influencer-specific tracking links per campaign and product

CREATE TABLE IF NOT EXISTS public.influencer_tracking_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    influencer_id text NOT NULL,
    influencer_name text,
    influencer_code text,
    product text NOT NULL,
    tracking_url text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_links_campaign_id ON public.influencer_tracking_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_links_influencer_id ON public.influencer_tracking_links(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_links_product ON public.influencer_tracking_links(product);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_links_camp_inf_prod ON public.influencer_tracking_links(campaign_id, influencer_id, product);

-- Enable Row Level Security (RLS)
ALTER TABLE public.influencer_tracking_links ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies matching application architecture
DROP POLICY IF EXISTS "Allow anon full access to influencer_tracking_links" ON public.influencer_tracking_links;
CREATE POLICY "Allow anon full access to influencer_tracking_links" ON public.influencer_tracking_links
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to influencer_tracking_links" ON public.influencer_tracking_links;
CREATE POLICY "Allow authenticated full access to influencer_tracking_links" ON public.influencer_tracking_links
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to influencer_tracking_links" ON public.influencer_tracking_links;
CREATE POLICY "Allow service_role full access to influencer_tracking_links" ON public.influencer_tracking_links
    FOR ALL TO service_role USING (true) WITH CHECK (true);
