-- Migration: Create public.after_dispatch_messages table for Campaign Influencer After Dispatch
-- Purpose: Persist generated After Dispatch messages, metadata, and export history

CREATE TABLE IF NOT EXISTS public.after_dispatch_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    influencer_id text NOT NULL,
    influencer_code text,
    username text,
    creator_name text,
    dispatch_status text DEFAULT 'Dispatched',
    courier text,
    tracking_id text,
    tracking_url text,
    payment_amount numeric, -- nullable, null means missing/unassigned (never default to 0)
    payment_text text,
    dispatched_products jsonb,
    message_text text NOT NULL,
    pdf_path text,
    pdf_url text,
    generated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT after_dispatch_campaign_influencer_key UNIQUE (campaign_id, influencer_id)
);

-- Enable Row Level Security
ALTER TABLE public.after_dispatch_messages ENABLE ROW LEVEL SECURITY;

-- Secure RLS Policies: Authenticated users & Service Role only (NO unrestricted anonymous access)
DROP POLICY IF EXISTS "Allow authenticated full access to after_dispatch_messages" ON public.after_dispatch_messages;
CREATE POLICY "Allow authenticated full access to after_dispatch_messages" ON public.after_dispatch_messages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to after_dispatch_messages" ON public.after_dispatch_messages;
CREATE POLICY "Allow service_role full access to after_dispatch_messages" ON public.after_dispatch_messages
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes for optimal campaign and influencer query performance
CREATE INDEX IF NOT EXISTS idx_after_dispatch_campaign_id ON public.after_dispatch_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_after_dispatch_influencer_id ON public.after_dispatch_messages(influencer_id);
CREATE INDEX IF NOT EXISTS idx_after_dispatch_influencer_code ON public.after_dispatch_messages(influencer_code);
CREATE INDEX IF NOT EXISTS idx_after_dispatch_created_at ON public.after_dispatch_messages(created_at);
