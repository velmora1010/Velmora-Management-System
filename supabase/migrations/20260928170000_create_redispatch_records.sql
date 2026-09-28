-- Migration: Create redispatch_records table for persistent Re-Dispatch lifecycle tracking
CREATE TABLE IF NOT EXISTS public.redispatch_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL DEFAULT '15',
    influencer_id bigint REFERENCES public.influencers_info_rows(id) ON DELETE SET NULL,
    influencer_code text NOT NULL,
    order_id text,
    previous_awb text,
    courier text,
    issue_type text,
    issue_remark text,
    redispatch_status text NOT NULL CHECK (redispatch_status IN ('PENDING_REDISPATCH', 'MOVED_TO_ACTIVE', 'COMPLETED')),
    moved_to_active_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_redispatch_records_campaign_code UNIQUE (campaign_id, influencer_code)
);

-- Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_redispatch_records_campaign ON public.redispatch_records(campaign_id);
CREATE INDEX IF NOT EXISTS idx_redispatch_records_code ON public.redispatch_records(influencer_code);
CREATE INDEX IF NOT EXISTS idx_redispatch_records_order ON public.redispatch_records(order_id);
CREATE INDEX IF NOT EXISTS idx_redispatch_records_status ON public.redispatch_records(redispatch_status);
CREATE INDEX IF NOT EXISTS idx_redispatch_records_created ON public.redispatch_records(created_at);
CREATE INDEX IF NOT EXISTS idx_redispatch_records_inf_id ON public.redispatch_records(influencer_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.redispatch_records ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (matching project pattern)
DROP POLICY IF EXISTS "Allow anon full access to redispatch_records" ON public.redispatch_records;
CREATE POLICY "Allow anon full access to redispatch_records" ON public.redispatch_records
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow authenticated full access
DROP POLICY IF EXISTS "Allow authenticated full access to redispatch_records" ON public.redispatch_records;
CREATE POLICY "Allow authenticated full access to redispatch_records" ON public.redispatch_records
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access to redispatch_records" ON public.redispatch_records;
CREATE POLICY "Allow service_role full access to redispatch_records" ON public.redispatch_records
    FOR ALL TO service_role USING (true) WITH CHECK (true);
