/**
 * HRMS Supabase Service Layer
 * Handles persistent database operations between the Velmora HRMS Frontend
 * and the Supabase PostgreSQL database tables.
 */

import { supabase } from '../../../lib/supabase';
import {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  ShiftTemplate,
  PayrollRecord,
  PayrollPaymentSchedule,
} from '../types/hrms';
import { WorkTask, WorkTaskAssignment } from '../types/workAssignment';
import { WelfareProduct, WelfareSelection } from '../types/welfare';

// ============================================================================
// 1. DATA TRANSFORMERS (CamelCase <-> Snake_Case)
// ============================================================================

export function rowToEmployee(row: any): Employee {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    fullName: row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    email: row.email,
    phone: row.phone || '',
    avatar: row.avatar || '',
    gender: (row.gender as any) || 'male',
    dateOfBirth: row.date_of_birth || '',
    joiningDate: row.joining_date || '',
    departmentId: row.department_id || '',
    departmentName: row.department_name || '',
    designation: row.designation || '',
    designationId: row.designation_id,
    designationCategory: row.designation_category,
    status: (row.status as any) || 'active',
    employmentType: (row.employment_type as any) || 'full_time',
    shiftId: row.shift_id || 'shift-morning',
    shiftName: row.shift_name || 'Morning Shift',
    managerId: row.manager_id,
    managerName: row.manager_name,
    workLocation: (row.work_location as any) || 'On-site',
    baseSalary: Number(row.base_salary) || 0,
    currency: row.currency || 'INR',
    bankName: row.bank_name || '',
    accountNumber: row.account_number || '',
    ifscCode: row.ifsc_code || '',
    taxId: row.tax_id || '',
    emergencyContactName: row.emergency_contact_name || '',
    emergencyContactRelation: row.emergency_contact_relation || '',
    emergencyContactPhone: row.emergency_contact_phone || '',
    address: row.address || '',
    city: row.city || '',
    country: row.country || 'India',
    bio: row.bio,
  };
}

export function employeeToRow(emp: Employee, authUserId?: string): any {
  return {
    id: emp.id,
    auth_user_id: authUserId || undefined,
    employee_code: emp.employeeCode,
    first_name: emp.firstName,
    last_name: emp.lastName,
    full_name: emp.fullName,
    email: emp.email,
    phone: emp.phone,
    avatar: emp.avatar,
    gender: emp.gender,
    date_of_birth: emp.dateOfBirth || null,
    joining_date: emp.joiningDate || null,
    department_id: emp.departmentId,
    department_name: emp.departmentName,
    designation: emp.designation,
    designation_id: emp.designationId || null,
    designation_category: emp.designationCategory || null,
    status: emp.status,
    employment_type: emp.employmentType,
    shift_id: emp.shiftId,
    shift_name: emp.shiftName,
    manager_id: emp.managerId || null,
    manager_name: emp.managerName || null,
    work_location: emp.workLocation,
    base_salary: emp.baseSalary,
    currency: emp.currency || 'INR',
    bank_name: emp.bankName,
    account_number: emp.accountNumber,
    ifsc_code: emp.ifscCode || null,
    tax_id: emp.taxId,
    emergency_contact_name: emp.emergencyContactName,
    emergency_contact_relation: emp.emergencyContactRelation,
    emergency_contact_phone: emp.emergencyContactPhone,
    emergency_contact_address: emp.address,
    address: emp.address,
    city: emp.city,
    country: emp.country || 'India',
    bio: emp.bio || null,
    updated_at: new Date().toISOString(),
  };
}

export function rowToAttendance(row: any): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    departmentId: row.department_id || '',
    departmentName: row.department_name || '',
    avatar: row.avatar || '',
    date: row.date,
    shiftId: row.shift_id,
    shiftName: row.shift_name,
    scheduledStartTime: row.scheduled_start_time,
    scheduledEndTime: row.scheduled_end_time,
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    status: row.status,
    calculatedStatus: row.calculated_status,
    manualStatus: row.manual_status,
    isManualOverride: row.is_manual_override,
    punctualityStatus: row.punctuality_status,
    workHours: Number(row.work_hours) || 0,
    workHoursFormatted: row.work_hours_formatted,
    lateMinutes: row.late_minutes,
    earlyExitMinutes: row.early_exit_minutes,
    overtimeMinutes: row.overtime_minutes,
    notes: row.notes,
    punchNote: row.punch_note,
    location: row.location,
    workLocation: row.work_location,
    punchStatus: row.punch_status,
    isManualEntry: row.is_manual_entry,
    manualReason: row.manual_reason,
    enteredBy: row.entered_by,
    approvedBy: row.approved_by,
    halfDayType: row.half_day_type,
    permissionStartTime: row.permission_start_time,
    permissionEndTime: row.permission_end_time,
    permissionReason: row.permission_reason,
    leaveReference: row.leave_reference,
    holidayReference: row.holiday_reference,
    scheduleReference: row.schedule_reference,
    missingPunchType: row.missing_punch_type,
    auditHistory: Array.isArray(row.audit_history) ? row.audit_history : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function attendanceToRow(att: AttendanceRecord): any {
  return {
    id: att.id,
    employee_id: att.employeeId,
    employee_name: att.employeeName,
    employee_code: att.employeeCode,
    department_id: att.departmentId,
    department_name: att.departmentName,
    avatar: att.avatar,
    date: att.date,
    shift_id: att.shiftId || null,
    shift_name: att.shiftName || null,
    scheduled_start_time: att.scheduledStartTime || null,
    scheduled_end_time: att.scheduledEndTime || null,
    check_in_time: att.checkInTime || null,
    check_out_time: att.checkOutTime || null,
    status: att.status,
    calculated_status: att.calculatedStatus || null,
    manual_status: att.manualStatus || null,
    is_manual_override: !!att.isManualOverride,
    punctuality_status: att.punctualityStatus || null,
    work_hours: att.workHours || 0,
    work_hours_formatted: att.workHoursFormatted || null,
    late_minutes: att.lateMinutes || 0,
    early_exit_minutes: att.earlyExitMinutes || 0,
    overtime_minutes: att.overtimeMinutes || 0,
    notes: att.notes || null,
    punch_note: att.punchNote || null,
    location: att.location || null,
    work_location: att.workLocation || null,
    punch_status: att.punchStatus || 'not_punched',
    is_manual_entry: !!att.isManualEntry,
    manual_reason: att.manualReason || null,
    entered_by: att.enteredBy || null,
    approved_by: att.approvedBy || null,
    half_day_type: att.halfDayType || null,
    permission_start_time: att.permissionStartTime || null,
    permission_end_time: att.permissionEndTime || null,
    permission_reason: att.permissionReason || null,
    leave_reference: att.leaveReference || null,
    holiday_reference: att.holidayReference || null,
    schedule_reference: att.scheduleReference || null,
    missing_punch_type: att.missingPunchType || null,
    audit_history: att.auditHistory || [],
    updated_at: new Date().toISOString(),
  };
}

export function rowToLeave(row: any): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    departmentId: row.department_id || '',
    departmentName: row.department_name || '',
    avatar: row.avatar || '',
    leaveType: row.leave_type,
    customLeaveType: row.custom_leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    daysCount: Number(row.days_count) || 1,
    reason: row.reason,
    status: row.status,
    appliedDate: row.applied_date,
    submittedByUserId: row.submitted_by_user_id,
    submittedAt: row.submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedDate: row.reviewed_date,
    reviewRemarks: row.review_remarks,
  };
}

export function leaveToRow(l: LeaveRequest): any {
  return {
    id: l.id,
    employee_id: l.employeeId,
    employee_name: l.employeeName,
    employee_code: l.employeeCode,
    department_id: l.departmentId,
    department_name: l.departmentName,
    avatar: l.avatar,
    leave_type: l.leaveType,
    custom_leave_type: l.customLeaveType || null,
    start_date: l.startDate,
    end_date: l.endDate,
    days_count: l.daysCount,
    reason: l.reason,
    status: l.status,
    applied_date: l.appliedDate,
    submitted_by_user_id: l.submittedByUserId || null,
    submitted_at: l.submittedAt || new Date().toISOString(),
    reviewed_by: l.reviewedBy || null,
    reviewed_date: l.reviewedDate || null,
    review_remarks: l.reviewRemarks || null,
    updated_at: new Date().toISOString(),
  };
}

// ============================================================================
// 2. SUPABASE OPERATIONS — EMPLOYEES
// ============================================================================

export async function fetchEmployeesFromSupabase(): Promise<Employee[] | null> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('employee_code', { ascending: true });

    if (error) {
      // Table may not yet be created or accessible
      console.warn('[Supabase HR] Error fetching employees:', error.message);
      return null;
    }

    if (data && Array.isArray(data) && data.length > 0) {
      return data.map(rowToEmployee);
    }
    return null;
  } catch (err) {
    console.warn('[Supabase HR] Exception fetching employees:', err);
    return null;
  }
}

export async function upsertEmployeeInSupabase(
  employee: Employee,
  authUserId?: string
): Promise<boolean> {
  try {
    const row = employeeToRow(employee, authUserId);
    const { error } = await supabase.from('employees').upsert(row, { onConflict: 'employee_code' });

    if (error) {
      console.warn('[Supabase HR] Error saving employee:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase HR] Exception saving employee:', err);
    return false;
  }
}

export async function deleteEmployeeFromSupabase(employeeId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('employees').delete().eq('id', employeeId);
    if (error) {
      console.warn('[Supabase HR] Error deleting employee:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase HR] Exception deleting employee:', err);
    return false;
  }
}

// ============================================================================
// 3. SUPABASE OPERATIONS — ATTENDANCE
// ============================================================================

export async function fetchAttendanceFromSupabase(date?: string): Promise<AttendanceRecord[] | null> {
  try {
    let query = supabase.from('attendance_records').select('*');
    if (date) {
      query = query.eq('date', date);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('[Supabase HR] Error fetching attendance:', error.message);
      return null;
    }
    if (data && Array.isArray(data) && data.length > 0) {
      return data.map(rowToAttendance);
    }
    return null;
  } catch (err) {
    console.warn('[Supabase HR] Exception fetching attendance:', err);
    return null;
  }
}

export async function upsertAttendanceInSupabase(record: AttendanceRecord): Promise<boolean> {
  try {
    const row = attendanceToRow(record);
    const { error } = await supabase
      .from('attendance_records')
      .upsert(row, { onConflict: 'employee_id,date' });

    if (error) {
      console.warn('[Supabase HR] Error saving attendance:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase HR] Exception saving attendance:', err);
    return false;
  }
}

// ============================================================================
// 4. SUPABASE OPERATIONS — LEAVES
// ============================================================================

export async function fetchLeavesFromSupabase(): Promise<LeaveRequest[] | null> {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('applied_date', { ascending: false });

    if (error) {
      console.warn('[Supabase HR] Error fetching leaves:', error.message);
      return null;
    }
    if (data && Array.isArray(data) && data.length > 0) {
      return data.map(rowToLeave);
    }
    return null;
  } catch (err) {
    console.warn('[Supabase HR] Exception fetching leaves:', err);
    return null;
  }
}

export async function upsertLeaveInSupabase(leave: LeaveRequest): Promise<boolean> {
  try {
    const row = leaveToRow(leave);
    const { error } = await supabase.from('leave_requests').upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase HR] Error saving leave request:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase HR] Exception saving leave request:', err);
    return false;
  }
}

// ============================================================================
// 5. SUPABASE OPERATIONS — WORK TASKS & ASSIGNMENTS
// ============================================================================

export async function fetchWorkTasksFromSupabase(): Promise<WorkTask[] | null> {
  try {
    const { data, error } = await supabase.from('work_tasks').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('[Supabase HR] Error fetching work tasks:', error.message);
      return null;
    }
    if (data && Array.isArray(data) && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        organizationId: row.organization_id,
        taskCode: row.task_code,
        title: row.title,
        brief: row.brief,
        description: row.description,
        category: row.category,
        priority: row.priority,
        assignmentType: row.assignment_type,
        departmentId: row.department_id,
        departmentName: row.department_name,
        assignedBy: row.assigned_by,
        assignedById: row.assigned_by_id,
        assignedDate: row.assigned_date,
        startDate: row.start_date,
        dueDate: row.due_date,
        dueTime: row.due_time,
        estimatedHours: Number(row.estimated_hours) || 0,
        status: row.status,
        overallProgress: row.overall_progress || 0,
        instructions: row.instructions,
        notes: row.notes,
        referenceFilePath: row.reference_file_path,
        referenceFileName: row.reference_file_name,
        referenceFileType: row.reference_file_type,
        referenceFileSize: row.reference_file_size,
        isDemo: row.is_demo,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }
    return null;
  } catch (err) {
    console.warn('[Supabase HR] Exception fetching work tasks:', err);
    return null;
  }
}

export async function fetchAssignmentsFromSupabase(employeeId?: string): Promise<WorkTaskAssignment[] | null> {
  try {
    let query = supabase.from('work_task_assignments').select('*').order('assigned_at', { ascending: false });
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('[Supabase HR] Error fetching assignments:', error.message);
      return null;
    }
    if (data && Array.isArray(data) && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        taskId: row.task_id,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        employeeCode: row.employee_code,
        employeeAvatar: row.employee_avatar,
        departmentId: row.department_id,
        departmentName: row.department_name,
        designation: row.designation,
        assignedAt: row.assigned_at,
        assignedBy: row.assigned_by,
        status: row.status,
        progressPercentage: row.progress_percentage || 0,
        taskTitle: row.task_title,
        taskBrief: row.task_brief,
        taskDescription: row.task_description,
        referenceFilePath: row.reference_file_path,
        referenceFileName: row.reference_file_name,
        firstViewedAt: row.first_viewed_at,
        acknowledgedAt: row.acknowledged_at,
        acknowledgedBy: row.acknowledged_by,
        acknowledgementSource: row.acknowledgement_source,
        acknowledgementNote: row.acknowledgement_note,
        isAcknowledged: !!row.is_acknowledged,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        completedBy: row.completed_by,
        completionSource: row.completion_source,
        completionNote: row.completion_note,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        reviewNotes: row.review_notes,
        updatedAt: row.updated_at,
      }));
    }
    return null;
  } catch (err) {
    console.warn('[Supabase HR] Exception fetching assignments:', err);
    return null;
  }
}

export async function upsertWorkTaskInSupabase(task: WorkTask): Promise<boolean> {
  try {
    const { error } = await supabase.from('work_tasks').upsert(
      {
        id: task.id,
        task_code: task.taskCode,
        title: task.title,
        brief: task.brief || task.taskBrief,
        description: task.description || task.taskDescription,
        category: task.category,
        priority: task.priority,
        assignment_type: task.assignmentType,
        department_id: task.departmentId,
        department_name: task.departmentName,
        assigned_by: task.assignedBy,
        assigned_by_id: task.assignedById,
        assigned_date: task.assignedDate,
        start_date: task.startDate,
        due_date: task.dueDate,
        due_time: task.dueTime,
        estimated_hours: task.estimatedHours,
        status: task.status,
        overall_progress: task.overallProgress,
        instructions: task.instructions,
        notes: task.notes,
        reference_file_path: task.referenceFilePath,
        reference_file_name: task.referenceFileName,
        reference_file_type: task.referenceFileType,
        reference_file_size: task.referenceFileSize,
        is_demo: !!task.isDemo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'task_code' }
    );
    if (error) {
      console.warn('[Supabase HR] Error saving work task:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase HR] Exception saving work task:', err);
    return false;
  }
}

export async function upsertAssignmentInSupabase(assignment: WorkTaskAssignment): Promise<boolean> {
  try {
    const { error } = await supabase.from('work_task_assignments').upsert(
      {
        id: assignment.id,
        task_id: assignment.taskId,
        employee_id: assignment.employeeId,
        employee_name: assignment.employeeName,
        employee_code: assignment.employeeCode,
        employee_avatar: assignment.employeeAvatar,
        department_id: assignment.departmentId,
        department_name: assignment.departmentName,
        designation: assignment.designation,
        assigned_at: assignment.assignedAt,
        assigned_by: assignment.assignedBy,
        status: assignment.status,
        progress_percentage: assignment.progressPercentage,
        task_title: assignment.taskTitle,
        task_brief: assignment.taskBrief,
        task_description: assignment.taskDescription,
        reference_file_path: assignment.referenceFilePath,
        reference_file_name: assignment.referenceFileName,
        first_viewed_at: assignment.firstViewedAt,
        acknowledged_at: assignment.acknowledgedAt,
        acknowledged_by: assignment.acknowledgedBy,
        acknowledgement_source: assignment.acknowledgementSource,
        acknowledgement_note: assignment.acknowledgementNote,
        is_acknowledged: !!assignment.isAcknowledged,
        started_at: assignment.startedAt,
        completed_at: assignment.completedAt,
        completed_by: assignment.completedBy,
        completion_source: assignment.completionSource,
        completion_note: assignment.completionNote,
        reviewed_by: assignment.reviewedBy,
        reviewed_at: assignment.reviewedAt,
        review_notes: assignment.reviewNotes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn('[Supabase HR] Error saving assignment:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase HR] Exception saving assignment:', err);
    return false;
  }
}

// ============================================================================
// 6. SUPABASE OPERATIONS — WELFARE SELECTIONS & PRODUCTS
// ============================================================================

export async function fetchWelfareSelectionsFromSupabase(
  year?: number,
  month?: number
): Promise<WelfareSelection[] | null> {
  try {
    let query = supabase.from('welfare_selections').select('*');
    if (year) query = query.eq('welfare_year', year);
    if (month) query = query.eq('welfare_month', month);

    const { data, error } = await query;
    if (error) {
      console.warn('[Supabase HR] Error fetching welfare selections:', error.message);
      return null;
    }
    if (data && Array.isArray(data) && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        organization_id: row.organization_id || 'org-default',
        employee_id: row.employee_id,
        employee_code: row.employee_code,
        employee_name: row.employee_name,
        department_id: row.department_id,
        department_name: row.department_name,
        product_id: row.product_id,
        product_name: row.product_name,
        welfare_year: row.welfare_year,
        welfare_month: row.welfare_month,
        selection_status: row.selection_status,
        selected_at: row.selected_at,
        prepared_at: row.prepared_at,
        prepared_by: row.prepared_by,
        distributed_at: row.distributed_at,
        distributed_by: row.distributed_by,
        received_at: row.received_at,
        received_by: row.received_by,
        received_by_admin_override: row.received_by_admin_override,
        cancelled_at: row.cancelled_at,
        cancelled_by: row.cancelled_by,
        cancel_reason: row.cancel_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    }
    return null;
  } catch (err) {
    console.warn('[Supabase HR] Exception fetching welfare selections:', err);
    return null;
  }
}

export async function upsertWelfareSelectionInSupabase(sel: WelfareSelection): Promise<boolean> {
  try {
    const { error } = await supabase.from('welfare_selections').upsert(
      {
        id: sel.id,
        organization_id: sel.organization_id || 'org-default',
        employee_id: sel.employee_id,
        employee_code: sel.employee_code,
        employee_name: sel.employee_name,
        department_id: sel.department_id,
        department_name: sel.department_name,
        product_id: sel.product_id,
        product_name: sel.product_name,
        welfare_year: sel.welfare_year,
        welfare_month: sel.welfare_month,
        selection_status: sel.selection_status,
        selected_at: sel.selected_at,
        prepared_at: sel.prepared_at || null,
        prepared_by: sel.prepared_by || null,
        distributed_at: sel.distributed_at || null,
        distributed_by: sel.distributed_by || null,
        received_at: sel.received_at || null,
        received_by: sel.received_by || null,
        received_by_admin_override: !!sel.received_by_admin_override,
        cancelled_at: sel.cancelled_at || null,
        cancelled_by: sel.cancelled_by || null,
        cancel_reason: sel.cancel_reason || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id,welfare_year,welfare_month' }
    );
    if (error) {
      console.warn('[Supabase HR] Error saving welfare selection:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase HR] Exception saving welfare selection:', err);
    return false;
  }
}

// ============================================================================
// 7. SUPABASE OPERATIONS — PAYROLL & SCHEDULES
// ============================================================================

export async function fetchPayrollRecordsFromSupabase(month?: string): Promise<PayrollRecord[] | null> {
  try {
    let query = supabase.from('payroll_records').select('*');
    if (month) query = query.eq('month', month);

    const { data, error } = await query;
    if (error) {
      console.warn('[Supabase HR] Error fetching payroll records:', error.message);
      return null;
    }
    if (data && Array.isArray(data) && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        employeeCode: row.employee_code,
        departmentId: row.department_id,
        departmentName: row.department_name,
        month: row.month,
        baseSalary: Number(row.base_salary) || 0,
        allowances: row.allowances || {},
        deductions: row.deductions || {},
        grossSalary: Number(row.gross_salary) || 0,
        totalDeductions: Number(row.total_deductions) || 0,
        netSalary: Number(row.net_salary) || 0,
        paymentMethod: row.payment_method || 'Bank Transfer',
        paymentDate: row.payment_date,
        status: row.status,
        payslipNumber: row.payslip_number,
      }));
    }
    return null;
  } catch (err) {
    console.warn('[Supabase HR] Exception fetching payroll records:', err);
    return null;
  }
}

export async function upsertPayrollRecordInSupabase(record: PayrollRecord): Promise<boolean> {
  try {
    const { error } = await supabase.from('payroll_records').upsert(
      {
        id: record.id,
        employee_id: record.employeeId,
        employee_name: record.employeeName,
        employee_code: record.employeeCode,
        department_id: record.departmentId,
        department_name: record.departmentName,
        month: record.month,
        base_salary: record.baseSalary,
        allowances: record.allowances,
        deductions: record.deductions,
        gross_salary: record.grossSalary,
        total_deductions: record.totalDeductions,
        net_salary: record.netSalary,
        payment_method: record.paymentMethod,
        payment_date: record.paymentDate || null,
        status: record.status,
        payslip_number: record.payslipNumber,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id,month' }
    );
    if (error) {
      console.warn('[Supabase HR] Error saving payroll record:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase HR] Exception saving payroll record:', err);
    return false;
  }
}
