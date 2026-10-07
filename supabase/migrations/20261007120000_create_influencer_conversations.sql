-- Migration: Create influencer_conversations table
-- Purpose: Store conversation text/notes exchanged with influencers for campaigns

CREATE TABLE IF NOT EXISTS public.influencer_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    conversation text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast campaign lookups
CREATE INDEX IF NOT EXISTS idx_influencer_conversations_campaign_id ON public.influencer_conversations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_influencer_conversations_created_at ON public.influencer_conversations(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.influencer_conversations ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies matching application architecture
DROP POLICY IF EXISTS "Allow anon full access to influencer_conversations" ON public.influencer_conversations;
CREATE POLICY "Allow anon full access to influencer_conversations" ON public.influencer_conversations
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to influencer_conversations" ON public.influencer_conversations;
CREATE POLICY "Allow authenticated full access to influencer_conversations" ON public.influencer_conversations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to influencer_conversations" ON public.influencer_conversations;
CREATE POLICY "Allow service_role full access to influencer_conversations" ON public.influencer_conversations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
