-- Migration: Add sub_issue column to customer_tickets table
ALTER TABLE customer_tickets ADD COLUMN IF NOT EXISTS sub_issue text;
