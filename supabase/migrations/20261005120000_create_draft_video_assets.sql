-- Migration: Create draft_video_assets table
-- Purpose: Persist multiple draft video assets (Original Video and Tamil Translated Video) per draft attempt for Campaign Status Tracking

CREATE TABLE IF NOT EXISTS public.draft_video_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    influencer_id bigint NOT NULL REFERENCES public.influencers_info_rows(id) ON DELETE CASCADE,
    video_number integer NOT NULL,
    draft_attempt_id integer NOT NULL,
    asset_type text NOT NULL CHECK (asset_type IN ('original', 'tamil_translation')),
    file_url text NOT NULL,
    file_name text,
    file_size text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_draft_video_asset UNIQUE (campaign_id, influencer_id, video_number, draft_attempt_id, asset_type)
);

-- Index for instant lookup by campaign, influencer, video number, and attempt
CREATE INDEX IF NOT EXISTS idx_draft_video_assets_lookup 
ON public.draft_video_assets (campaign_id, influencer_id, video_number, draft_attempt_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.draft_video_assets ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies (Authenticated & Service Role full access)
DROP POLICY IF EXISTS "Allow authenticated full access to draft_video_assets" ON public.draft_video_assets;
CREATE POLICY "Allow authenticated full access to draft_video_assets" ON public.draft_video_assets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to draft_video_assets" ON public.draft_video_assets;
CREATE POLICY "Allow service_role full access to draft_video_assets" ON public.draft_video_assets
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-update updated_at column on update
DROP TRIGGER IF EXISTS trigger_update_draft_video_assets_updated_at ON public.draft_video_assets;
CREATE TRIGGER trigger_update_draft_video_assets_updated_at
BEFORE UPDATE ON public.draft_video_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
