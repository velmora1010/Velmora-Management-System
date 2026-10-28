export type UserRole = 'admin' | 'hr_manager' | 'dept_head' | 'employee';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  departmentId?: string;
  employeeId?: string;
  title: string;
}

export type EmployeeStatus = 'active' | 'inactive' | 'on_leave' | 'probation' | 'terminated';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';

export interface Employee {
  id: string;
  employeeCode: string; // e.g. "EMP-1001"
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  avatar: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string; // YYYY-MM-DD
  joiningDate: string; // YYYY-MM-DD
  departmentId: string;
  departmentName: string;
  designation: string;
  designationId?: string;
  designationCategory?: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  shiftId: string;
  shiftName: string;
  managerId?: string;
  managerName?: string;
  workLocation: 'On-site' | 'Remote' | 'Hybrid';
  // Financial & Confidential Info (RBAC protected)
  baseSalary: number; // monthly
  currency: string;
  bankName: string;
  accountNumber: string;
  taxId: string;
  // Emergency Contact
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  // Address & Bio
  address: string;
  city: string;
  country: string;
  bio?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string; // e.g. "ENG", "HR", "MKT"
  description: string;
  headEmployeeId?: string;
  headEmployeeName?: string;
  headEmployeeAvatar?: string;
  location: string;
  monthlyBudget: number;
  color: string;
  createdAt: string;
}

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'half_day'
  | 'on_leave'
  | 'permission'
  | 'wfh'
  | 'weekly_off'
  | 'holiday'
  | 'missing_punch'
  | 'pending'
  | 'checked_in'
  | 'missing_checkout'
  | 'not_marked';

export interface AttendanceAuditLog {
  id: string;
  timestamp: string;
  previousStatus?: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
  notes?: string;
  enteredBy: string;
  action: 'manual_override' | 'correction' | 'revert_to_auto' | 'created';
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentId: string;
  departmentName: string;
  avatar: string;
  date: string; // YYYY-MM-DD
  shiftId?: string;
  shiftName?: string;
  scheduledStartTime?: string; // HH:mm
  scheduledEndTime?: string;   // HH:mm
  checkInTime?: string; // HH:mm:ss or HH:mm
  checkOutTime?: string; // HH:mm:ss or HH:mm
  status: AttendanceStatus; // Final effective status
  calculatedStatus?: AttendanceStatus; // Preserved auto-calculated status
  manualStatus?: AttendanceStatus; // Explicit manual status
  isManualOverride?: boolean;
  punctualityStatus?: 'on_time' | 'late';
  workHours?: number;
  workHoursFormatted?: string;
  lateMinutes?: number;
  earlyExitMinutes?: number;
  overtimeMinutes?: number;
  notes?: string;
  punchNote?: string;
  location?: string;
  workLocation?: string;
  punchStatus?: 'not_punched' | 'checked_in' | 'checked_out';
  isManualEntry?: boolean;
  manualReason?: string;
  enteredBy?: string;
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  // Specific status metadata
  halfDayType?: 'first_half' | 'second_half';
  permissionStartTime?: string;
  permissionEndTime?: string;
  permissionReason?: string;
  leaveReference?: string;
  holidayReference?: string;
  scheduleReference?: string;
  missingPunchType?: 'in' | 'out' | 'both';
  auditHistory?: AttendanceAuditLog[];
}

export type LeaveType = 'casual' | 'sick' | 'annual' | 'maternity' | 'paternity' | 'unpaid' | 'others';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentId: string;
  departmentName: string;
  avatar: string;
  leaveType: LeaveType;
  customLeaveType?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  reason: string;
  status: LeaveStatus;
  appliedDate: string; // YYYY-MM-DD
  submittedByUserId?: string;
  submittedAt?: string; // ISO timestamp
  reviewedBy?: string;
  reviewedDate?: string;
  reviewRemarks?: string;
}

export interface LeaveBalance {
  casual: { total: number; used: number };
  sick: { total: number; used: number };
  annual: { total: number; used: number };
  maternity: { total: number; used: number };
  unpaid: { total: number; used: number };
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  color: string;
  workHours: number;
  description: string;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftName: string;
  date: string; // YYYY-MM-DD
  status: 'scheduled' | 'completed' | 'swapped';
}

export type PayrollStatus = 'draft' | 'processed' | 'paid';

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentId: string;
  departmentName: string;
  month: string; // "2026-10"
  baseSalary: number;
  allowances: {
    housing: number;
    transport: number;
    medical: number;
    performanceBonus: number;
  };
  deductions: {
    tax: number;
    healthInsurance: number;
    providentFund: number;
    unpaidLeaveDeduction: number;
  };
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  paymentMethod: 'Bank Transfer' | 'Direct Deposit' | 'Cheque';
  paymentDate?: string;
  status: PayrollStatus;
  payslipNumber: string;
}

export interface ActivityLog {
  id: string;
  actorName: string;
  actorAvatar: string;
  action: string;
  target: string;
  timestamp: string; // ISO string or formatted
  module: 'employee' | 'attendance' | 'department' | 'leave' | 'shift' | 'payroll' | 'welfare' | 'settings';
  badgeColor?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'leave' | 'attendance' | 'payroll' | 'system' | 'employee' | 'work_assigned' | 'welfare';
  actionType?: 'check-in' | 'check-out';
  employeeId?: string;
  employeeName?: string;
  workLocation?: string;
  actionUrl?: string;
  recipientUserId?: string;
  recipientEmployeeId?: string;
  targetRole?: 'admin' | 'employee' | 'all';
  relatedTaskId?: string;
  taskAssignmentId?: string;
  createdAt?: string;
}

export interface HRSettings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  fiscalYearStart: string;
  workingDays: string[];
  standardWorkHours: number;
  currency: string;
  currencySymbol: string;
  leaveAllowances: {
    casual: number;
    sick: number;
    annual: number;
    maternity: number;
  };
  timezone?: string; // Default: 'Asia/Kolkata'
}

export interface Designation {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface DesignationDepartmentMapping {
  id: string;
  designationCategory: string;
  departmentName: string;
  isDefault: boolean;
}

// Salary & Payroll Calendar Types
export type PayrollPaymentStatus = 'scheduled' | 'pending' | 'approved' | 'paid' | 'overdue';
export type PaymentFrequency = 'monthly' | 'weekly' | 'biweekly';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'other';

export interface ScheduleAuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details?: string;
}

export interface PayrollPaymentSchedule {
  id: string;
  organizationId?: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentId: string;
  departmentName: string;
  payrollPeriodStart?: string;
  payrollPeriodEnd?: string;
  payrollMonth: string; // YYYY-MM
  scheduledPaymentDate: string; // YYYY-MM-DD
  paymentFrequency: PaymentFrequency;
  paymentMethod: PaymentMethod;
  payrollItemId?: string;
  amount: number;
  amountPaise?: number;
  currency?: string;
  status: PayrollPaymentStatus;
  paidDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  auditHistory?: ScheduleAuditEntry[];
}

