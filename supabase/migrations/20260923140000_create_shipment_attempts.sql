-- Migration: Create shipment_attempts table with parent attempt chaining and unique attempt constraint
-- Purpose: Persistent multi-attempt shipment history and issue tracking for Influencer Logistics and Status Tracking

CREATE TABLE IF NOT EXISTS public.shipment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_attempt_id UUID REFERENCES public.shipment_attempts(id) ON DELETE SET NULL,
    campaign_id text NOT NULL,
    influencer_id bigint NOT NULL REFERENCES public.influencers_info_rows(id) ON DELETE CASCADE,
    attempt_number integer NOT NULL DEFAULT 1,
    shipment_type text NOT NULL, -- 'ORIGINAL' | 'RE_DISPATCH'
    courier text, -- 'Delhivery' | 'ST Courier' | other
    order_id text,
    awb_number text,
    shipment_status text DEFAULT 'Pending', -- 'Pending' | 'Dispatched' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Issue Reported'
    dispatch_date text,
    estimated_delivery_date text,
    delivered_date text,
    remarks text,
    issue_reported boolean DEFAULT false,
    issue_type text, -- 'DAMAGED_PRODUCT' | 'MISSING_PRODUCT' | 'WRONG_PRODUCT' | 'OTHER'
    issue_remarks text,
    issue_proof_url text,
    issue_reported_at timestamp with time zone,
    delivery_proof_url text,
    delivery_confirmed boolean DEFAULT false,
    status_tracking_started boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_shipment_attempts_attempt UNIQUE (campaign_id, influencer_id, attempt_number)
);

-- Performance and query indexes
CREATE INDEX IF NOT EXISTS idx_shipment_attempts_campaign_inf 
ON public.shipment_attempts (campaign_id, influencer_id);

CREATE INDEX IF NOT EXISTS idx_shipment_attempts_parent 
ON public.shipment_attempts (parent_attempt_id);

CREATE INDEX IF NOT EXISTS idx_shipment_attempts_awb 
ON public.shipment_attempts (awb_number);

CREATE INDEX IF NOT EXISTS idx_shipment_attempts_order 
ON public.shipment_attempts (order_id);

CREATE INDEX IF NOT EXISTS idx_shipment_attempts_status 
ON public.shipment_attempts (shipment_status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.shipment_attempts ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (SELECT, INSERT, UPDATE, DELETE) to match existing tables
DROP POLICY IF EXISTS "Allow anon full access to shipment_attempts" ON public.shipment_attempts;
CREATE POLICY "Allow anon full access to shipment_attempts" ON public.shipment_attempts
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow authenticated full access
DROP POLICY IF EXISTS "Allow authenticated full access to shipment_attempts" ON public.shipment_attempts;
CREATE POLICY "Allow authenticated full access to shipment_attempts" ON public.shipment_attempts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access to shipment_attempts" ON public.shipment_attempts;
CREATE POLICY "Allow service_role full access to shipment_attempts" ON public.shipment_attempts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS trigger_update_shipment_attempts_updated_at ON public.shipment_attempts;
CREATE TRIGGER trigger_update_shipment_attempts_updated_at
BEFORE UPDATE ON public.shipment_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
