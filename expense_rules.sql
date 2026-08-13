CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.expense_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT UNIQUE NOT NULL,
    department TEXT,
    category TEXT,
    sub_category1 TEXT,
    sub_category2 TEXT,
    vendor TEXT,
    payment_mode TEXT,
    gst_status TEXT,
    purchased_by TEXT,
    approved_by TEXT,
    notes TEXT,
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.expense_rules ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'expense_rules' 
        AND policyname = 'Enable read access for authenticated users'
    ) THEN
        CREATE POLICY "Enable read access for authenticated users" 
        ON public.expense_rules 
        FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'expense_rules' 
        AND policyname = 'Enable insert access for authenticated users'
    ) THEN
        CREATE POLICY "Enable insert access for authenticated users" 
        ON public.expense_rules 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'expense_rules' 
        AND policyname = 'Enable update access for authenticated users'
    ) THEN
        CREATE POLICY "Enable update access for authenticated users" 
        ON public.expense_rules 
        FOR UPDATE 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'expense_rules' 
        AND policyname = 'Enable delete access for authenticated users'
    ) THEN
        CREATE POLICY "Enable delete access for authenticated users" 
        ON public.expense_rules 
        FOR DELETE 
        TO authenticated 
        USING (true);
    END IF;
END $$;
