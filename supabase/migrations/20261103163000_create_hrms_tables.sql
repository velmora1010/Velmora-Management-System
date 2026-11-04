-- ============================================================================
-- VELMORA BUSINESS MANAGEMENT SYSTEM — HUMAN RESOURCES MODULE SCHEMA
-- Migration: 20261103163000_create_hrms_tables.sql
-- Project: Velmora business management system (utusdosvijjuxtowzhta)
-- Schema: public
-- Description: Creates all core HRMS tables, indexes, RLS policies, and seeds initial data
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DEPARTMENTS TABLE EXTENSION (Preserving existing table and records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id SERIAL PRIMARY KEY,
  department_name TEXT NOT NULL,
  department_code TEXT,
  description TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure standard HRMS columns exist on departments
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS head_employee_id TEXT;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS head_employee_name TEXT;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS head_employee_avatar TEXT;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Headquarters';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#206DA6';

-- ----------------------------------------------------------------------------
-- 2. SHIFT TEMPLATES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL, -- e.g. "09:00"
  end_time TEXT NOT NULL,   -- e.g. "17:00"
  color TEXT DEFAULT '#206DA6',
  work_hours NUMERIC(4, 2) DEFAULT 8.0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. EMPLOYEES TABLE (Core Employee Profiles & Employment Details)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  avatar TEXT,
  gender TEXT DEFAULT 'male' CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth DATE,
  joining_date DATE,
  department_id TEXT,
  department_name TEXT,
  designation TEXT,
  designation_id TEXT,
  designation_category TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'probation', 'terminated')),
  employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
  shift_id TEXT REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  shift_name TEXT,
  manager_id TEXT,
  manager_name TEXT,
  work_location TEXT DEFAULT 'On-site',
  base_salary NUMERIC(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  tax_id TEXT,
  emergency_contact_name TEXT,
  emergency_contact_relation TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_address TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'India',
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_employees_code ON public.employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON public.employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);

-- ----------------------------------------------------------------------------
-- 4. ATTENDANCE RECORDS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  department_id TEXT,
  department_name TEXT,
  avatar TEXT,
  date DATE NOT NULL,
  shift_id TEXT REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  shift_name TEXT,
  scheduled_start_time TEXT,
  scheduled_end_time TEXT,
  check_in_time TEXT,
  check_out_time TEXT,
  status TEXT NOT NULL DEFAULT 'not_marked',
  calculated_status TEXT,
  manual_status TEXT,
  is_manual_override BOOLEAN DEFAULT false,
  punctuality_status TEXT,
  work_hours NUMERIC(5, 2) DEFAULT 0,
  work_hours_formatted TEXT,
  late_minutes INTEGER DEFAULT 0,
  early_exit_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  notes TEXT,
  punch_note TEXT,
  location TEXT,
  work_location TEXT,
  punch_status TEXT DEFAULT 'not_punched',
  is_manual_entry BOOLEAN DEFAULT false,
  manual_reason TEXT,
  entered_by TEXT,
  approved_by TEXT,
  half_day_type TEXT,
  permission_start_time TEXT,
  permission_end_time TEXT,
  permission_reason TEXT,
  leave_reference TEXT,
  holiday_reference TEXT,
  schedule_reference TEXT,
  missing_punch_type TEXT,
  audit_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance_records(status);

-- ----------------------------------------------------------------------------
-- 5. LEAVE REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  department_id TEXT,
  department_name TEXT,
  avatar TEXT,
  leave_type TEXT NOT NULL,
  custom_leave_type TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(4, 1) NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submitted_by_user_id TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_date DATE,
  review_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaves_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leaves_date ON public.leave_requests(start_date, end_date);

-- ----------------------------------------------------------------------------
-- 6. WORK TASKS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT DEFAULT 'org-default',
  task_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  brief TEXT,
  description TEXT,
  category TEXT DEFAULT 'Other',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assignment_type TEXT DEFAULT 'single' CHECK (assignment_type IN ('single', 'multiple', 'department')),
  department_id TEXT,
  department_name TEXT,
  assigned_by TEXT NOT NULL,
  assigned_by_id TEXT,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_date DATE,
  due_date DATE NOT NULL,
  due_time TEXT,
  estimated_hours NUMERIC(5, 2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'pending_review', 'completed', 'on_hold', 'cancelled')),
  overall_progress INTEGER DEFAULT 0,
  instructions TEXT,
  notes TEXT,
  reference_file_path TEXT,
  reference_file_name TEXT,
  reference_file_type TEXT,
  reference_file_size TEXT,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_tasks_code ON public.work_tasks(task_code);
CREATE INDEX IF NOT EXISTS idx_work_tasks_status ON public.work_tasks(status);

-- ----------------------------------------------------------------------------
-- 7. WORK TASK ASSIGNMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_task_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES public.work_tasks(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  employee_avatar TEXT,
  department_id TEXT,
  department_name TEXT,
  designation TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'pending_review', 'completed', 'on_hold', 'cancelled')),
  progress_percentage INTEGER DEFAULT 0,
  task_title TEXT,
  task_brief TEXT,
  task_description TEXT,
  reference_file_path TEXT,
  reference_file_name TEXT,
  first_viewed_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  acknowledgement_source TEXT CHECK (acknowledgement_source IN ('employee', 'admin')),
  acknowledgement_note TEXT,
  is_acknowledged BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  completion_source TEXT CHECK (completion_source IN ('employee', 'admin')),
  completion_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_task ON public.work_task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_assignments_employee ON public.work_task_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.work_task_assignments(status);

-- ----------------------------------------------------------------------------
-- 8. WORK PROGRESS UPDATES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_progress_updates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  assignment_id TEXT NOT NULL REFERENCES public.work_task_assignments(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES public.work_tasks(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_summary TEXT NOT NULL,
  hours_spent NUMERIC(5, 2) DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  blockers TEXT,
  supporting_file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_updates_assignment ON public.work_progress_updates(assignment_id);

-- ----------------------------------------------------------------------------
-- 9. WELFARE PRODUCTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.welfare_products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_name TEXT NOT NULL UNIQUE,
  product_image_path TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. WELFARE SELECTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.welfare_selections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT DEFAULT 'org-default',
  employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department_id TEXT,
  department_name TEXT,
  product_id TEXT NOT NULL REFERENCES public.welfare_products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  welfare_year INTEGER NOT NULL,
  welfare_month INTEGER NOT NULL CHECK (welfare_month BETWEEN 1 AND 12),
  selection_status TEXT NOT NULL DEFAULT 'selected' CHECK (selection_status IN ('selected', 'prepared', 'distributed', 'received', 'cancelled')),
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  prepared_at TIMESTAMPTZ,
  prepared_by TEXT,
  distributed_at TIMESTAMPTZ,
  distributed_by TEXT,
  received_at TIMESTAMPTZ,
  received_by TEXT,
  received_by_admin_override BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_welfare_employee_month UNIQUE (employee_id, welfare_year, welfare_month)
);

CREATE INDEX IF NOT EXISTS idx_welfare_employee ON public.welfare_selections(employee_id);
CREATE INDEX IF NOT EXISTS idx_welfare_period ON public.welfare_selections(welfare_year, welfare_month);

-- ----------------------------------------------------------------------------
-- 11. PAYROLL RECORDS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  department_id TEXT,
  department_name TEXT,
  month TEXT NOT NULL, -- e.g. "2026-10"
  base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  allowances JSONB DEFAULT '{"housing":0,"transport":0,"medical":0,"performanceBonus":0}'::jsonb,
  deductions JSONB DEFAULT '{"tax":0,"healthInsurance":0,"providentFund":0,"unpaidLeaveDeduction":0}'::jsonb,
  gross_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Bank Transfer',
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'paid')),
  payslip_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_payroll_employee_month UNIQUE (employee_id, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_employee_month ON public.payroll_records(employee_id, month);

-- ----------------------------------------------------------------------------
-- 12. PAYROLL SCHEDULES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_schedules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  department_id TEXT,
  department_name TEXT,
  salary_month TEXT NOT NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Bank Transfer',
  disbursing_bank TEXT,
  account_number TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'completed', 'failed', 'cancelled')),
  notes TEXT,
  audit_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_schedules_month ON public.payroll_schedules(salary_month);
CREATE INDEX IF NOT EXISTS idx_payroll_schedules_emp ON public.payroll_schedules(employee_id);

-- ----------------------------------------------------------------------------
-- 13. SEED INITIAL DATA (Shifts, Welfare Products, Standard Employees)
-- ----------------------------------------------------------------------------

-- Seed Shift Templates
INSERT INTO public.shift_templates (id, name, start_time, end_time, color, work_hours, description)
VALUES
  ('shift-morning', 'Morning Shift', '09:00', '17:00', '#206DA6', 8.0, 'Standard morning business shift'),
  ('shift-afternoon', 'Afternoon Shift', '13:00', '21:00', '#F59E0B', 8.0, 'Afternoon operations shift'),
  ('shift-evening', 'Evening Shift', '17:00', '01:00', '#8B5CF6', 8.0, 'Evening development and support shift')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time;

-- Seed Welfare Products
INSERT INTO public.welfare_products (id, product_name, is_active)
VALUES
  ('prod-1', 'Detergent', true),
  ('prod-2', 'Dish Wash', true),
  ('prod-3', 'Fabric Wash', true),
  ('prod-4', 'Bike Wash', true),
  ('prod-5', 'Car Wash', true),
  ('prod-6', 'Floor Cleaner', true),
  ('prod-7', 'Glass Cleaner', true),
  ('prod-8', 'Kitchen Cleaner', true),
  ('prod-9', 'Hand Wash', true),
  ('prod-10', 'Bamboo Towel', true)
ON CONFLICT (product_name) DO NOTHING;

-- Seed Production Employees (Linked with production auth.users UUIDs)
INSERT INTO public.employees (
  id,
  auth_user_id,
  employee_code,
  first_name,
  last_name,
  full_name,
  email,
  phone,
  avatar,
  gender,
  date_of_birth,
  joining_date,
  department_id,
  department_name,
  designation,
  status,
  employment_type,
  shift_id,
  shift_name,
  manager_name,
  work_location,
  base_salary,
  currency,
  bank_name,
  account_number,
  tax_id,
  emergency_contact_name,
  emergency_contact_relation,
  emergency_contact_phone,
  address,
  city,
  country
)
VALUES
  (
    'emp-1001',
    '129d7653-12d9-4d8b-a8e1-c888eeb0c8e2',
    'EMP-1001',
    'Dhesan',
    'M',
    'Dhesan M',
    'dhesan.m@company.com',
    '+91 98765 43210',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'male',
    '1995-05-15',
    '2026-09-22',
    '3',
    'Software Development',
    'Software Developer',
    'active',
    'full_time',
    'shift-morning',
    'Morning Shift',
    'Direct Executive',
    'On-site',
    65000,
    'INR',
    'HDFC Bank',
    '••••••••1001',
    'PAN-1001',
    'Dinesh',
    'Friend',
    '6532984276',
    '123 Tech Park, Erode',
    'Erode',
    'India'
  ),
  (
    'emp-1002',
    'ed2ca2cd-394e-4083-bcc6-e821a81213b5',
    'EMP-1002',
    'Dinesh',
    'K',
    'Dinesh K',
    'dinesh.k@company.com',
    '+91 98765 43211',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'male',
    '1994-08-22',
    '2026-10-01',
    '3',
    'Software Development',
    'Backend Developer',
    'active',
    'full_time',
    'shift-morning',
    'Morning Shift',
    'Dhesan M',
    'On-site',
    72000,
    'INR',
    'ICICI Bank',
    '••••••••1002',
    'PAN-1002',
    'Suresh K',
    'Brother',
    '+91 98765 00002',
    '45 Cyber Heights, Bengaluru',
    'Bengaluru',
    'India'
  ),
  (
    'emp-1003',
    'bdf63f23-2ac2-4284-9618-304868dd27fd',
    'EMP-1003',
    'Priya',
    'K',
    'Priya K',
    'priya.k@company.com',
    '+91 98765 43212',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    'female',
    '1996-03-10',
    '2026-10-15',
    '8',
    'Quality Assurance',
    'QA Specialist',
    'active',
    'full_time',
    'shift-morning',
    'Morning Shift',
    'Dhesan M',
    'Hybrid',
    58000,
    'INR',
    'State Bank of India',
    '••••••••1003',
    'PAN-1003',
    'Kavitha R',
    'Mother',
    '+91 98765 00003',
    '78 Quality Lane, Chennai',
    'Chennai',
    'India'
  )
ON CONFLICT (employee_code) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  designation = EXCLUDED.designation;

-- ----------------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL POLICIES
-- ----------------------------------------------------------------------------

-- Enable Row Level Security on all HRMS tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welfare_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welfare_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

-- Helper check function: is current user HR admin
CREATE OR REPLACE FUNCTION public.is_hr_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr_manager', 'Main Admin', 'Developer 1', 'Developer 2', 'Developer 3')
    OR (auth.jwt() ->> 'email') IN ('admin@velmora.com', 'admin@velmora1.com', 'admin@velmora2.com', 'admin@velmora3.com')
    OR auth.role() = 'service_role',
    true
  );
$$;

-- RLS POLICIES FOR EMPLOYEES
DROP POLICY IF EXISTS "Employees viewable by authenticated users" ON public.employees;
CREATE POLICY "Employees viewable by authenticated users"
  ON public.employees FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Employees insertable by HR admin" ON public.employees;
CREATE POLICY "Employees insertable by HR admin"
  ON public.employees FOR INSERT
  WITH CHECK (public.is_hr_admin());

DROP POLICY IF EXISTS "Employees updatable by HR admin or self" ON public.employees;
CREATE POLICY "Employees updatable by HR admin or self"
  ON public.employees FOR UPDATE
  USING (
    public.is_hr_admin() OR auth.uid() = auth_user_id
  );

DROP POLICY IF EXISTS "Employees deletable by HR admin" ON public.employees;
CREATE POLICY "Employees deletable by HR admin"
  ON public.employees FOR DELETE
  USING (public.is_hr_admin());

-- RLS POLICIES FOR ATTENDANCE
DROP POLICY IF EXISTS "Attendance viewable by HR admin or self" ON public.attendance_records;
CREATE POLICY "Attendance viewable by HR admin or self"
  ON public.attendance_records FOR SELECT
  USING (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Attendance insertable by HR admin or self" ON public.attendance_records;
CREATE POLICY "Attendance insertable by HR admin or self"
  ON public.attendance_records FOR INSERT
  WITH CHECK (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Attendance updatable by HR admin or self" ON public.attendance_records;
CREATE POLICY "Attendance updatable by HR admin or self"
  ON public.attendance_records FOR UPDATE
  USING (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

-- RLS POLICIES FOR LEAVE REQUESTS
DROP POLICY IF EXISTS "Leaves viewable by HR admin or self" ON public.leave_requests;
CREATE POLICY "Leaves viewable by HR admin or self"
  ON public.leave_requests FOR SELECT
  USING (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Leaves insertable by self or HR admin" ON public.leave_requests;
CREATE POLICY "Leaves insertable by self or HR admin"
  ON public.leave_requests FOR INSERT
  WITH CHECK (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Leaves updatable by HR admin or self" ON public.leave_requests;
CREATE POLICY "Leaves updatable by HR admin or self"
  ON public.leave_requests FOR UPDATE
  USING (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

-- RLS POLICIES FOR WORK TASKS & ASSIGNMENTS
DROP POLICY IF EXISTS "Tasks viewable by all authenticated" ON public.work_tasks;
CREATE POLICY "Tasks viewable by all authenticated"
  ON public.work_tasks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Tasks manageable by HR admin" ON public.work_tasks;
CREATE POLICY "Tasks manageable by HR admin"
  ON public.work_tasks FOR ALL
  USING (public.is_hr_admin());

DROP POLICY IF EXISTS "Assignments viewable by HR admin or self" ON public.work_task_assignments;
CREATE POLICY "Assignments viewable by HR admin or self"
  ON public.work_task_assignments FOR SELECT
  USING (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Assignments updatable by HR admin or self" ON public.work_task_assignments;
CREATE POLICY "Assignments updatable by HR admin or self"
  ON public.work_task_assignments FOR UPDATE
  USING (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Assignments insertable by HR admin" ON public.work_task_assignments;
CREATE POLICY "Assignments insertable by HR admin"
  ON public.work_task_assignments FOR INSERT
  WITH CHECK (public.is_hr_admin());

-- RLS POLICIES FOR WELFARE
DROP POLICY IF EXISTS "Welfare products viewable by all" ON public.welfare_products;
CREATE POLICY "Welfare products viewable by all"
  ON public.welfare_products FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Welfare selections viewable by HR admin or self" ON public.welfare_selections;
CREATE POLICY "Welfare selections viewable by HR admin or self"
  ON public.welfare_selections FOR SELECT
  USING (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Welfare selections manageable by HR admin or self" ON public.welfare_selections;
CREATE POLICY "Welfare selections manageable by HR admin or self"
  ON public.welfare_selections FOR ALL
  USING (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

-- RLS POLICIES FOR PAYROLL (Strict protection)
DROP POLICY IF EXISTS "Payroll viewable by HR admin or self" ON public.payroll_records;
CREATE POLICY "Payroll viewable by HR admin or self"
  ON public.payroll_records FOR SELECT
  USING (
    public.is_hr_admin() OR
    employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Payroll manageable only by HR admin" ON public.payroll_records;
CREATE POLICY "Payroll manageable only by HR admin"
  ON public.payroll_records FOR ALL
  USING (public.is_hr_admin());

DROP POLICY IF EXISTS "Payroll schedules manageable by HR admin" ON public.payroll_schedules;
CREATE POLICY "Payroll schedules manageable by HR admin"
  ON public.payroll_schedules FOR ALL
  USING (public.is_hr_admin());

-- Allow shift templates to be read by all
DROP POLICY IF EXISTS "Shifts viewable by all" ON public.shift_templates;
CREATE POLICY "Shifts viewable by all"
  ON public.shift_templates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Shifts manageable by HR admin" ON public.shift_templates;
CREATE POLICY "Shifts manageable by HR admin"
  ON public.shift_templates FOR ALL
  USING (public.is_hr_admin());
