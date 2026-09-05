-- Migration: Create public.offer_agreements table for campaign offer agreements
CREATE TABLE IF NOT EXISTS public.offer_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    influencer_id text NOT NULL,
    influencer_code text,
    username text,
    price_per_video numeric DEFAULT 0,
    agreement_price numeric DEFAULT 0,
    publishing_dates jsonb,
    draft_dates jsonb,
    agreement_text text,
    pdf_path text,
    pdf_url text,
    generated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT offer_agreements_campaign_influencer_key UNIQUE (campaign_id, influencer_id)
);

ALTER TABLE public.offer_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access to offer_agreements" ON public.offer_agreements;
DO $$ BEGIN
  CREATE POLICY "Allow anon full access to offer_agreements" ON public.offer_agreements
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "Allow authenticated full access to offer_agreements" ON public.offer_agreements;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated full access to offer_agreements" ON public.offer_agreements
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "Allow service_role full access to offer_agreements" ON public.offer_agreements;
DO $$ BEGIN
  CREATE POLICY "Allow service_role full access to offer_agreements" ON public.offer_agreements
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_offer_agreements_campaign_id ON public.offer_agreements(campaign_id);
CREATE INDEX IF NOT EXISTS idx_offer_agreements_influencer_id ON public.offer_agreements(influencer_id);
