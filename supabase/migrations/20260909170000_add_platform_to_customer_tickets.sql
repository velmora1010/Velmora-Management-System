-- Migration: Add platform column to customer_tickets table
ALTER TABLE customer_tickets ADD COLUMN IF NOT EXISTS platform text DEFAULT NULL;
