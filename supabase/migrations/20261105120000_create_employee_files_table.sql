-- ============================================================================
-- Migration: 20261105120000_create_employee_files_table.sql
-- Project: Velmora business management system
-- Schema: public
-- Description: Creates employee_files table and employee-documents storage bucket
-- ============================================================================

-- 1. Create employee_files table
CREATE TABLE IF NOT EXISTS public.employee_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size TEXT NOT NULL,
  file_size_bytes BIGINT DEFAULT 0,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  category TEXT NOT NULL DEFAULT 'Other', -- 'ID Proof', 'Offer Letter', 'Resume', 'Contract', 'Other'
  upload_status TEXT NOT NULL DEFAULT 'Uploaded', -- 'Uploaded', 'Verified', 'Pending'
  verification_status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'verified', 'rejected'
  uploaded_by TEXT DEFAULT 'HR Administrator',
  uploader_role TEXT NOT NULL DEFAULT 'hr_admin', -- 'hr_admin', 'employee'
  submission_source TEXT NOT NULL DEFAULT 'hr', -- 'hr', 'employee'
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for uploader role & submission source
CREATE INDEX IF NOT EXISTS idx_employee_files_uploader_role ON public.employee_files(uploader_role);
CREATE INDEX IF NOT EXISTS idx_employee_files_submission_source ON public.employee_files(submission_source);

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_employee_files_employee_code ON public.employee_files(employee_code);
CREATE INDEX IF NOT EXISTS idx_employee_files_employee_id ON public.employee_files(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_files_category ON public.employee_files(category);
CREATE INDEX IF NOT EXISTS idx_employee_files_created_at ON public.employee_files(created_at DESC);

-- 3. Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('employee-documents', 'employee-documents', true, 20971520)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.employee_files ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow public SELECT on employee_files"
  ON public.employee_files FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated/anon INSERT on employee_files"
  ON public.employee_files FOR INSERT TO public WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated/anon UPDATE on employee_files"
  ON public.employee_files FOR UPDATE TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated/anon DELETE on employee_files"
  ON public.employee_files FOR DELETE TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Storage policies for employee-documents bucket
DO $$ BEGIN
  CREATE POLICY "Allow public SELECT on employee-documents"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'employee-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated/anon upload on employee-documents"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'employee-documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
