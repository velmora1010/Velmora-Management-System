-- Migration: Add amount column to customer_tickets table
ALTER TABLE customer_tickets ADD COLUMN IF NOT EXISTS amount numeric DEFAULT NULL;
