-- Migration: Create campaign_scripts table and script storage buckets
-- Purpose: Campaign Model Script management with product, language, model script, key points, audio/video references

CREATE TABLE IF NOT EXISTS public.campaign_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    product text NOT NULL,
    language text NOT NULL,
    model_script text NOT NULL,
    key_points text NOT NULL,
    reference_audio_url text,
    reference_audio_file_path text,
    reference_video_url text,
    reference_video_file_path text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Appropriate indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_scripts_campaign_id ON public.campaign_scripts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_scripts_product ON public.campaign_scripts(product);
CREATE INDEX IF NOT EXISTS idx_campaign_scripts_language ON public.campaign_scripts(language);
CREATE INDEX IF NOT EXISTS idx_campaign_scripts_camp_prod_lang ON public.campaign_scripts(campaign_id, product, language);

-- Enable Row Level Security (RLS)
ALTER TABLE public.campaign_scripts ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies matching application architecture
DROP POLICY IF EXISTS "Allow anon full access to campaign_scripts" ON public.campaign_scripts;
CREATE POLICY "Allow anon full access to campaign_scripts" ON public.campaign_scripts
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to campaign_scripts" ON public.campaign_scripts;
CREATE POLICY "Allow authenticated full access to campaign_scripts" ON public.campaign_scripts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to campaign_scripts" ON public.campaign_scripts;
CREATE POLICY "Allow service_role full access to campaign_scripts" ON public.campaign_scripts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-update updated_at column on update
DROP TRIGGER IF EXISTS trigger_update_campaign_scripts_updated_at ON public.campaign_scripts;
CREATE TRIGGER trigger_update_campaign_scripts_updated_at
BEFORE UPDATE ON public.campaign_scripts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure storage buckets exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
    ('script-audio', 'script-audio', true, 52428800),
    ('script-video', 'script-video', true, 52428800)
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

-- Storage policies for script-audio
DO $$ BEGIN
  CREATE POLICY "Allow public SELECT on script-audio"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'script-audio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public INSERT on script-audio"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'script-audio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public UPDATE on script-audio"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'script-audio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public DELETE on script-audio"
  ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'script-audio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage policies for script-video
DO $$ BEGIN
  CREATE POLICY "Allow public SELECT on script-video"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'script-video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public INSERT on script-video"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'script-video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public UPDATE on script-video"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'script-video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public DELETE on script-video"
  ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'script-video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
