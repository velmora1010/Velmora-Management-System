-- Migration: 20261028110000_order_cancellations.sql
-- Description: Create dedicated order cancellations and audit tracking table with RLS policies

CREATE TABLE IF NOT EXISTS public.order_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  channel text DEFAULT 'WEBSITE',
  cancellation_status text NOT NULL DEFAULT 'CANCELLED', -- 'CANCELLED', 'PENDING_LOGISTICS_APPROVAL', 'REJECTED'
  cancellation_reason text NOT NULL,
  cancellation_notes text,
  requested_by text DEFAULT 'Sales Team',
  requested_at timestamptz DEFAULT now(),
  confirmed_by text,
  confirmed_at timestamptz,
  logistics_action text, -- 'CONFIRMED', 'REJECTED', 'COURIER_CANCELLED', 'CANNOT_CANCEL', 'PENDING_REVIEW'
  logistics_notes text,
  previous_fulfillment_status text,
  previous_shipment_status text,
  audit_trail jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_order_cancellations_order_id ON public.order_cancellations(order_id);
CREATE INDEX IF NOT EXISTS idx_order_cancellations_status ON public.order_cancellations(cancellation_status);
CREATE INDEX IF NOT EXISTS idx_order_cancellations_created_at ON public.order_cancellations(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.order_cancellations ENABLE ROW LEVEL SECURITY;

-- Permissive public policy matching existing sales_orders RLS
DROP POLICY IF EXISTS "Allow all access to order_cancellations" ON public.order_cancellations;
CREATE POLICY "Allow all access to order_cancellations" ON public.order_cancellations
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);
