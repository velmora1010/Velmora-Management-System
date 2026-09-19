-- Migration: Add payment proof fields to customer_tickets table
ALTER TABLE customer_tickets ADD COLUMN IF NOT EXISTS payment_proof_url text DEFAULT NULL;
ALTER TABLE customer_tickets ADD COLUMN IF NOT EXISTS payment_proof_name text DEFAULT NULL;
