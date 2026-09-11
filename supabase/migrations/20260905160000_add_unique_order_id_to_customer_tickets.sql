-- Migration: Add unique index on lower(trim(order_id)) for customer_tickets
-- Ensures database-level duplicate protection for Order IDs (case-insensitive and trimmed)

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tickets_unique_order_id
ON public.customer_tickets (LOWER(TRIM(order_id)));

