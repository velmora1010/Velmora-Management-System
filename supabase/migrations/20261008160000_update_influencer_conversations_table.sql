-- Migration: Update influencer_conversations table for workflow step management
-- Creates table if not exists, and adds columns step_key, title, conversation_text, display_order, is_active

CREATE TABLE IF NOT EXISTS public.influencer_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    step_key text NOT NULL DEFAULT 'delivered',
    title text DEFAULT '',
    conversation_text text,
    conversation text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all columns exist if table was already created
ALTER TABLE public.influencer_conversations ADD COLUMN IF NOT EXISTS step_key text DEFAULT 'delivered';
ALTER TABLE public.influencer_conversations ADD COLUMN IF NOT EXISTS title text DEFAULT '';
ALTER TABLE public.influencer_conversations ADD COLUMN IF NOT EXISTS conversation_text text;
ALTER TABLE public.influencer_conversations ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.influencer_conversations ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Synchronize conversation and conversation_text for data consistency
UPDATE public.influencer_conversations 
SET conversation_text = conversation 
WHERE (conversation_text IS NULL OR conversation_text = '') AND conversation IS NOT NULL;

UPDATE public.influencer_conversations 
SET conversation = conversation_text 
WHERE (conversation IS NULL OR conversation = '') AND conversation_text IS NOT NULL;

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_influencer_conversations_campaign_id ON public.influencer_conversations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_influencer_conversations_step_key ON public.influencer_conversations(step_key);
CREATE INDEX IF NOT EXISTS idx_influencer_conversations_campaign_step ON public.influencer_conversations(campaign_id, step_key);
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
