-- Migration: Create influencer_video_payment_rows and influencer_video_payment_transactions
-- Purpose: Per-video payment workflow and permanent transaction history for Status Tracking

-- 1. Create helper function for updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create influencer_video_payment_rows table
CREATE TABLE IF NOT EXISTS public.influencer_video_payment_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id text NOT NULL,
    influencer_id bigint NOT NULL REFERENCES public.influencers_info_rows(id) ON DELETE CASCADE,
    video_number integer NOT NULL,
    payment_type text NOT NULL DEFAULT 'advance', -- 'advance' | 'final'
    payment_status text NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled'
    payment_method text, -- 'UPI' | 'ACCOUNT_DETAILS'
    agreed_amount numeric(12,2),
    paid_amount numeric(12,2) DEFAULT 0,
    transaction_reference text,
    payment_date timestamp with time zone,
    payment_proof_url text,
    notes text,
    created_by text,
    updated_by text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_influencer_video_payment UNIQUE (campaign_id, influencer_id, video_number, payment_type)
);

-- 3. Create influencer_video_payment_transactions table (Permanent append-only history)
CREATE TABLE IF NOT EXISTS public.influencer_video_payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_row_id UUID REFERENCES public.influencer_video_payment_rows(id) ON DELETE SET NULL,
    campaign_id text NOT NULL,
    influencer_id bigint NOT NULL REFERENCES public.influencers_info_rows(id) ON DELETE CASCADE,
    video_number integer NOT NULL,
    payment_type text NOT NULL DEFAULT 'advance', -- 'advance' | 'final'
    amount numeric(12,2) NOT NULL DEFAULT 0,
    payment_method text,
    payment_status text NOT NULL DEFAULT 'paid',
    transaction_reference text,
    payment_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    payment_proof_url text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.influencer_video_payment_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_video_payment_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Set up RLS Policies (Secure: Authenticated & Service Role only, NO anonymous access)
DROP POLICY IF EXISTS "Allow authenticated full access to influencer_video_payment_rows" ON public.influencer_video_payment_rows;
CREATE POLICY "Allow authenticated full access to influencer_video_payment_rows" ON public.influencer_video_payment_rows
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to influencer_video_payment_rows" ON public.influencer_video_payment_rows;
CREATE POLICY "Allow service_role full access to influencer_video_payment_rows" ON public.influencer_video_payment_rows
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to influencer_video_payment_transactions" ON public.influencer_video_payment_transactions;
CREATE POLICY "Allow authenticated full access to influencer_video_payment_transactions" ON public.influencer_video_payment_transactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to influencer_video_payment_transactions" ON public.influencer_video_payment_transactions;
CREATE POLICY "Allow service_role full access to influencer_video_payment_transactions" ON public.influencer_video_payment_transactions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Indexes for high-performance query patterns
CREATE INDEX IF NOT EXISTS idx_ivp_campaign_influencer ON public.influencer_video_payment_rows(campaign_id, influencer_id);
CREATE INDEX IF NOT EXISTS idx_ivp_campaign_influencer_video ON public.influencer_video_payment_rows(campaign_id, influencer_id, video_number);
CREATE INDEX IF NOT EXISTS idx_ivp_status ON public.influencer_video_payment_rows(payment_status);
CREATE INDEX IF NOT EXISTS idx_ivp_created_at ON public.influencer_video_payment_rows(created_at);

CREATE INDEX IF NOT EXISTS idx_ivpt_campaign_influencer ON public.influencer_video_payment_transactions(campaign_id, influencer_id);
CREATE INDEX IF NOT EXISTS idx_ivpt_campaign_influencer_video ON public.influencer_video_payment_transactions(campaign_id, influencer_id, video_number);
CREATE INDEX IF NOT EXISTS idx_ivpt_created_at ON public.influencer_video_payment_transactions(created_at);

-- 7. Trigger for automatic updated_at
DROP TRIGGER IF EXISTS trg_update_influencer_video_payment_rows_updated_at ON public.influencer_video_payment_rows;
CREATE TRIGGER trg_update_influencer_video_payment_rows_updated_at
    BEFORE UPDATE ON public.influencer_video_payment_rows
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Backfill existing Video 1 Advance payments from influencer_status_tracking_rows
INSERT INTO public.influencer_video_payment_rows (
    campaign_id,
    influencer_id,
    video_number,
    payment_type,
    payment_status,
    payment_method,
    agreed_amount,
    paid_amount,
    transaction_reference,
    payment_proof_url,
    payment_date,
    notes,
    created_at,
    updated_at
)
SELECT 
    str.campaign_id::text,
    str.influencer_id,
    1,
    'advance',
    CASE 
        WHEN str.pay_advance_completed = true OR COALESCE(NULLIF(regexp_replace(str.advance_paid_amount, '[^0-9.]', '', 'g'), '')::numeric, 0) > 0 THEN 'paid'
        ELSE 'pending'
    END,
    CASE 
        WHEN str.advance_gpay_number IS NOT NULL AND trim(str.advance_gpay_number) <> '' THEN 'UPI'
        ELSE NULL 
    END,
    NULLIF(regexp_replace(str.advance_total_amount, '[^0-9.]', '', 'g'), '')::numeric,
    COALESCE(NULLIF(regexp_replace(str.advance_paid_amount, '[^0-9.]', '', 'g'), '')::numeric, 0),
    NULLIF(trim(str.advance_gpay_number), ''),
    NULLIF(trim(str.pay_advance_photo_url), ''),
    COALESCE(str.updated_at, str.created_at, now()),
    'Backfilled from influencer_status_tracking_rows',
    COALESCE(str.created_at, now()),
    COALESCE(str.updated_at, now())
FROM public.influencer_status_tracking_rows str
WHERE str.pay_advance_completed = true 
   OR COALESCE(NULLIF(regexp_replace(str.advance_paid_amount, '[^0-9.]', '', 'g'), '')::numeric, 0) > 0
   OR (str.pay_advance_photo_url IS NOT NULL AND trim(str.pay_advance_photo_url) <> '')
ON CONFLICT (campaign_id, influencer_id, video_number, payment_type) DO NOTHING;

-- 9. Backfill existing Video 1 Remaining payments from influencer_status_tracking_rows
INSERT INTO public.influencer_video_payment_rows (
    campaign_id,
    influencer_id,
    video_number,
    payment_type,
    payment_status,
    payment_method,
    paid_amount,
    payment_proof_url,
    payment_date,
    notes,
    created_at,
    updated_at
)
SELECT 
    str.campaign_id::text,
    str.influencer_id,
    1,
    'final',
    'paid',
    NULL,
    0,
    NULLIF(trim(str.payment_remaining_photo_url), ''),
    COALESCE(str.updated_at, str.created_at, now()),
    'Backfilled remaining payment from influencer_status_tracking_rows',
    COALESCE(str.created_at, now()),
    COALESCE(str.updated_at, now())
FROM public.influencer_status_tracking_rows str
WHERE str.payment_remaining_completed = true 
   OR (str.payment_remaining_photo_url IS NOT NULL AND trim(str.payment_remaining_photo_url) <> '')
ON CONFLICT (campaign_id, influencer_id, video_number, payment_type) DO NOTHING;

-- 10. Record transactions in influencer_video_payment_transactions for completed payments
INSERT INTO public.influencer_video_payment_transactions (
    payment_row_id,
    campaign_id,
    influencer_id,
    video_number,
    payment_type,
    amount,
    payment_method,
    payment_status,
    transaction_reference,
    payment_proof_url,
    payment_date,
    notes,
    created_at
)
SELECT 
    ivp.id,
    ivp.campaign_id,
    ivp.influencer_id,
    ivp.video_number,
    ivp.payment_type,
    COALESCE(ivp.paid_amount, 0),
    ivp.payment_method,
    'paid',
    ivp.transaction_reference,
    ivp.payment_proof_url,
    COALESCE(ivp.payment_date, ivp.created_at),
    ivp.notes,
    ivp.created_at
FROM public.influencer_video_payment_rows ivp
WHERE ivp.payment_status = 'paid'
ON CONFLICT DO NOTHING;
