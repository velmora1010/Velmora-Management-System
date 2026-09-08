-- Migration: Create influencer_dispatch_batches and influencer_dispatch_batch_members tables
CREATE TABLE IF NOT EXISTS public.influencer_dispatch_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    batch_name text NOT NULL,
    dispatch_date text NOT NULL,
    dispatch_time text NOT NULL,
    status text NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Ready to Dispatch' | 'Dispatched'
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.influencer_dispatch_batch_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.influencer_dispatch_batches(id) ON DELETE CASCADE,
    campaign_id text NOT NULL,
    influencer_id text NOT NULL,
    influencer_code text,
    dispatch_status text NOT NULL DEFAULT 'Pending',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.influencer_dispatch_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_dispatch_batch_members ENABLE ROW LEVEL SECURITY;

-- Allow anon full access
DROP POLICY IF EXISTS "Allow anon full access to influencer_dispatch_batches" ON public.influencer_dispatch_batches;
CREATE POLICY "Allow anon full access to influencer_dispatch_batches" ON public.influencer_dispatch_batches
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to influencer_dispatch_batch_members" ON public.influencer_dispatch_batch_members;
CREATE POLICY "Allow anon full access to influencer_dispatch_batch_members" ON public.influencer_dispatch_batch_members
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow authenticated full access
DROP POLICY IF EXISTS "Allow authenticated full access to influencer_dispatch_batches" ON public.influencer_dispatch_batches;
CREATE POLICY "Allow authenticated full access to influencer_dispatch_batches" ON public.influencer_dispatch_batches
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to influencer_dispatch_batch_members" ON public.influencer_dispatch_batch_members;
CREATE POLICY "Allow authenticated full access to influencer_dispatch_batch_members" ON public.influencer_dispatch_batch_members
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access to influencer_dispatch_batches" ON public.influencer_dispatch_batches;
CREATE POLICY "Allow service_role full access to influencer_dispatch_batches" ON public.influencer_dispatch_batches
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to influencer_dispatch_batch_members" ON public.influencer_dispatch_batch_members;
CREATE POLICY "Allow service_role full access to influencer_dispatch_batch_members" ON public.influencer_dispatch_batch_members
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_influencer_dispatch_batches_campaign ON public.influencer_dispatch_batches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_influencer_dispatch_batch_members_batch ON public.influencer_dispatch_batch_members(batch_id);
CREATE INDEX IF NOT EXISTS idx_influencer_dispatch_batch_members_inf ON public.influencer_dispatch_batch_members(influencer_id);
