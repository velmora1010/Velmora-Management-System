-- Migration: Create campaign_descriptions table
-- Purpose: Product descriptions for campaigns

CREATE TABLE IF NOT EXISTS public.campaign_descriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    product text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_descriptions_campaign_id ON public.campaign_descriptions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_descriptions_product ON public.campaign_descriptions(product);
CREATE INDEX IF NOT EXISTS idx_campaign_descriptions_camp_prod ON public.campaign_descriptions(campaign_id, product);

-- Enable Row Level Security (RLS)
ALTER TABLE public.campaign_descriptions ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies matching application architecture
DROP POLICY IF EXISTS "Allow anon full access to campaign_descriptions" ON public.campaign_descriptions;
CREATE POLICY "Allow anon full access to campaign_descriptions" ON public.campaign_descriptions
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to campaign_descriptions" ON public.campaign_descriptions;
CREATE POLICY "Allow authenticated full access to campaign_descriptions" ON public.campaign_descriptions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to campaign_descriptions" ON public.campaign_descriptions;
CREATE POLICY "Allow service_role full access to campaign_descriptions" ON public.campaign_descriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
