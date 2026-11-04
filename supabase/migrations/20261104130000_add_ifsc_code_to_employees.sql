-- ============================================================================
-- Migration: 20261104130000_add_ifsc_code_to_employees.sql
-- Project: Velmora business management system
-- Schema: public
-- Description: Adds ifsc_code column to employees table without modifying or deleting existing records
-- ============================================================================

-- 1. Add ifsc_code column to public.employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ifsc_code TEXT;

-- 2. Populate default Indian IFSC codes for initial seed employees if currently null
UPDATE public.employees 
SET ifsc_code = 'SBIN0001234' 
WHERE employee_code = 'EMP-1001' AND (ifsc_code IS NULL OR ifsc_code = '');

UPDATE public.employees 
SET ifsc_code = 'HDFC0000456' 
WHERE employee_code = 'EMP-1002' AND (ifsc_code IS NULL OR ifsc_code = '');

UPDATE public.employees 
SET ifsc_code = 'ICIC0000789' 
WHERE employee_code = 'EMP-1003' AND (ifsc_code IS NULL OR ifsc_code = '');

-- 3. Document the column
COMMENT ON COLUMN public.employees.ifsc_code IS 'Indian Financial System Code (11 characters: 4 alphabetic, 0, 6 alphanumeric; e.g. SBIN0001234)';
