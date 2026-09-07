-- Migration: Add mail_acceptance column to public.offer_agreements
ALTER TABLE public.offer_agreements ADD COLUMN IF NOT EXISTS mail_acceptance text DEFAULT NULL;
