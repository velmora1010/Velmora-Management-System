CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. credit_imports
-- Tracks each uploaded Credit statement PDF and prevents duplicate imports.
CREATE TABLE IF NOT EXISTS public.credit_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    file_hash TEXT UNIQUE NOT NULL,
    import_status TEXT DEFAULT 'completed',
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. credits_row
-- Stores individual Credit transactions.
CREATE TABLE IF NOT EXISTS public.credits_row (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date DATE,
    posted_datetime TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    amount NUMERIC(15, 2) NOT NULL,
    notes TEXT,
    source TEXT,
    main_category TEXT,
    sub_category1 TEXT,
    sub_category2 TEXT,
    payment_mode TEXT,
    bank_account TEXT,
    import_batch_id TEXT REFERENCES public.credit_imports(batch_id) ON DELETE CASCADE,
    import_file_name TEXT,
    import_status TEXT,
    sequence INTEGER,
    status TEXT DEFAULT 'active'
);

-- 3. credit_rules
-- Foundation for future Credit automation
CREATE TABLE IF NOT EXISTS public.credit_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT UNIQUE NOT NULL,
    main_category TEXT,
    sub_category1 TEXT,
    sub_category2 TEXT,
    source TEXT,
    payment_mode TEXT,
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.credit_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_row ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_rules ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies for credit_imports
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_imports' AND policyname = 'Enable read access for authenticated users') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.credit_imports FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_imports' AND policyname = 'Enable insert access for authenticated users') THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.credit_imports FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_imports' AND policyname = 'Enable update access for authenticated users') THEN
        CREATE POLICY "Enable update access for authenticated users" ON public.credit_imports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_imports' AND policyname = 'Enable delete access for authenticated users') THEN
        CREATE POLICY "Enable delete access for authenticated users" ON public.credit_imports FOR DELETE TO authenticated USING (true);
    END IF;
END $$;

-- Idempotent RLS Policies for credits_row
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credits_row' AND policyname = 'Enable read access for authenticated users') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.credits_row FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credits_row' AND policyname = 'Enable insert access for authenticated users') THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.credits_row FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credits_row' AND policyname = 'Enable update access for authenticated users') THEN
        CREATE POLICY "Enable update access for authenticated users" ON public.credits_row FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credits_row' AND policyname = 'Enable delete access for authenticated users') THEN
        CREATE POLICY "Enable delete access for authenticated users" ON public.credits_row FOR DELETE TO authenticated USING (true);
    END IF;
END $$;

-- Idempotent RLS Policies for credit_rules
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_rules' AND policyname = 'Enable read access for authenticated users') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.credit_rules FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_rules' AND policyname = 'Enable insert access for authenticated users') THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.credit_rules FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_rules' AND policyname = 'Enable update access for authenticated users') THEN
        CREATE POLICY "Enable update access for authenticated users" ON public.credit_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_rules' AND policyname = 'Enable delete access for authenticated users') THEN
        CREATE POLICY "Enable delete access for authenticated users" ON public.credit_rules FOR DELETE TO authenticated USING (true);
    END IF;
END $$;
