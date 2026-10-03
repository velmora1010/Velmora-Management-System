-- Migration: Create campaign_influencer_imports and campaign_influencer_import_rows tables
-- Purpose: Track influencer imports/uploads, audit individual rows, and maintain reliable sync logs

CREATE TABLE IF NOT EXISTS public.campaign_influencer_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id bigint NOT NULL,
    file_name text NOT NULL,
    file_type text,
    total_rows integer DEFAULT 0,
    valid_rows integer DEFAULT 0,
    invalid_rows integer DEFAULT 0,
    new_influencers integer DEFAULT 0,
    updated_influencers integer DEFAULT 0,
    archived_influencers integer DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    error_message text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.campaign_influencer_import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES public.campaign_influencer_imports(id) ON DELETE CASCADE,
    campaign_id bigint NOT NULL,
    influencer_code text,
    influencer_name text,
    row_number integer,
    action text, -- 'new' | 'updated' | 'unchanged' | 'archived' | 'invalid'
    status text,
    error_message text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Appropriate indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_influencer_imports_campaign ON public.campaign_influencer_imports(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_influencer_imports_created ON public.campaign_influencer_imports(created_at);
CREATE INDEX IF NOT EXISTS idx_campaign_influencer_imports_status ON public.campaign_influencer_imports(status);

CREATE INDEX IF NOT EXISTS idx_campaign_influencer_import_rows_import ON public.campaign_influencer_import_rows(import_id);
CREATE INDEX IF NOT EXISTS idx_campaign_influencer_import_rows_campaign ON public.campaign_influencer_import_rows(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_influencer_import_rows_code ON public.campaign_influencer_import_rows(influencer_code);

-- Enable Row Level Security (RLS)
ALTER TABLE public.campaign_influencer_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_influencer_import_rows ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (matching project pattern)
DROP POLICY IF EXISTS "Allow anon full access to campaign_influencer_imports" ON public.campaign_influencer_imports;
CREATE POLICY "Allow anon full access to campaign_influencer_imports" ON public.campaign_influencer_imports
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to campaign_influencer_import_rows" ON public.campaign_influencer_import_rows;
CREATE POLICY "Allow anon full access to campaign_influencer_import_rows" ON public.campaign_influencer_import_rows
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow authenticated full access
DROP POLICY IF EXISTS "Allow authenticated full access to campaign_influencer_imports" ON public.campaign_influencer_imports;
CREATE POLICY "Allow authenticated full access to campaign_influencer_imports" ON public.campaign_influencer_imports
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to campaign_influencer_import_rows" ON public.campaign_influencer_import_rows;
CREATE POLICY "Allow authenticated full access to campaign_influencer_import_rows" ON public.campaign_influencer_import_rows
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access to campaign_influencer_imports" ON public.campaign_influencer_imports;
CREATE POLICY "Allow service_role full access to campaign_influencer_imports" ON public.campaign_influencer_imports
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to campaign_influencer_import_rows" ON public.campaign_influencer_import_rows;
CREATE POLICY "Allow service_role full access to campaign_influencer_import_rows" ON public.campaign_influencer_import_rows
    FOR ALL TO service_role USING (true) WITH CHECK (true);
