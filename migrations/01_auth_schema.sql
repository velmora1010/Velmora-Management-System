-- 01_auth_schema.sql
-- Run this in your Supabase SQL Editor

-- 1. Create User Profiles Table
-- Links to auth.users to store application-specific roles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Manager', 'Operator', 'Viewer')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read all profiles (or restrict as needed)
CREATE POLICY "Profiles are viewable by everyone" ON public.user_profiles
  FOR SELECT USING (true);

-- Trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (new.id, new.email, 'Viewer'); -- Default role
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL, -- e.g., 'CREATE', 'UPDATE', 'EXPORT_PDF', 'LOGIN'
  target_table text,    -- e.g., 'purchase_orders', 'vendors'
  record_id text,       -- ID of the affected record
  details jsonb,        -- Additional context or payload diffs
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone (or authenticated users) to insert audit logs
CREATE POLICY "Anyone can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Allow only Admins/Managers to read audit logs (Simplified: allow all auth'd for now, refine later)
CREATE POLICY "Authenticated users can view audit logs" ON public.audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');


-- 3. Add created_by to transactional tables
-- Ensure these tables exist before running this section!

ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
