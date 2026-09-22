-- Migration: Create campaign_video_scripts table
-- Purpose: Per-video script details (custom concept, hooks, proposed script, voice record, approval) for Campaign Status Tracking

CREATE TABLE IF NOT EXISTS public.campaign_video_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    influencer_id bigint NOT NULL REFERENCES public.influencers_info_rows(id) ON DELETE CASCADE,
    video_number integer NOT NULL,
    custom_concept text,
    hooks text,
    proposed_script text,
    voice_record_url text,
    voice_record_file_name text,
    voice_record_file_size text,
    voice_record_storage_path text,
    script_shared_approved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_campaign_video_script UNIQUE (campaign_id, influencer_id, video_number)
);

-- Index for instant lookup by campaign, influencer, and video
CREATE INDEX IF NOT EXISTS idx_campaign_video_scripts_lookup 
ON public.campaign_video_scripts (campaign_id, influencer_id, video_number);

-- Enable Row Level Security (RLS)
ALTER TABLE public.campaign_video_scripts ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies (Authenticated & Service Role full access)
DROP POLICY IF EXISTS "Allow authenticated full access to campaign_video_scripts" ON public.campaign_video_scripts;
CREATE POLICY "Allow authenticated full access to campaign_video_scripts" ON public.campaign_video_scripts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to campaign_video_scripts" ON public.campaign_video_scripts;
CREATE POLICY "Allow service_role full access to campaign_video_scripts" ON public.campaign_video_scripts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-update updated_at column on update
DROP TRIGGER IF EXISTS trigger_update_campaign_video_scripts_updated_at ON public.campaign_video_scripts;
CREATE TRIGGER trigger_update_campaign_video_scripts_updated_at
BEFORE UPDATE ON public.campaign_video_scripts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
