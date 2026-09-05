-- Migration: Make awb_number nullable in customer_tickets since it was removed from create ticket form
ALTER TABLE customer_tickets ALTER COLUMN awb_number DROP NOT NULL;
