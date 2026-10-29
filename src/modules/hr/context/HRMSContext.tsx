import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Employee,
  Department,
  AttendanceRecord,
  LeaveRequest,
  ShiftTemplate,
  PayrollRecord,
  ActivityLog,
  NotificationItem,
  HRSettings,
  AttendanceStatus,
  AttendanceAuditLog,
  PayrollPaymentSchedule,
  PayrollPaymentStatus,
  PaymentFrequency,
  PaymentMethod,
  ScheduleAuditEntry,
} from '../types/hrms';
import {
  INITIAL_SETTINGS,
  INITIAL_SHIFTS,
  INITIAL_DEPARTMENTS,
  INITIAL_EMPLOYEES,
  INITIAL_TODAY_ATTENDANCE,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_PAYROLL,
  INITIAL_PAYROLL_SCHEDULES,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_NOTIFICATIONS,
} from '../data/initialData';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_SHIFTS,
  MASTER_DESIGNATIONS,
  DesignationItem,
} from '../data/designationsData';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import { findLinkedEmployee, doesLeaveBelongToEmployee, isSameEmployeeRecord } from '../utils/employeeIdentity';
import { getInitialsAvatar } from '../utils/avatar';
import { safeSetItem, safeGetItem } from '../utils/storage';
import {
  resolveEmployeeShift,
  evaluatePunctuality,
  evaluateExitPunctuality,
  calculateWorkHoursDetails,
  formatTime12Hour,
  evaluateEmployeeAttendanceStatus,
  isEmployeePresentOutcome,
  getCompanyTodayDate,
} from '../utils/attendanceCalculator';

interface HRMSContextType {
  // Data
  employees: Employee[];
  departments: Department[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  shiftTemplates: ShiftTemplate[];
  payrollRecords: PayrollRecord[];
  payrollSchedules: PayrollPaymentSchedule[];
  activityLogs: ActivityLog[];
  notifications: NotificationItem[];
  settings: HRSettings;
  designations: DesignationItem[];

  // Designation Operations
  addDesignation: (designation: Omit<DesignationItem, 'id'>) => DesignationItem;

  // Filters
  selectedDepartment: string;
  setSelectedDepartment: (deptId: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;

  // Employee Operations
  addEmployee: (employee: Omit<Employee, 'id' | 'employeeCode'>) => Employee;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  getEmployeeById: (id: string) => Employee | undefined;

  // Department Operations
  addDepartment: (department: Omit<Department, 'id' | 'createdAt'>) => Department;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  deleteDepartment: (id: string) => boolean;

  // Attendance Operations
  checkIn: (
    employeeId: string,
    notes?: string,
    options?: { workLocation?: string; punchNote?: string }
  ) => boolean;
  checkOut: (
    employeeId: string,
    notes?: string,
    options?: { workLocation?: string; punchNote?: string }
  ) => boolean;
  saveAttendanceRecord: (record: Partial<AttendanceRecord> & { employeeId: string; date: string }) => void;
  removeAttendanceOverride: (employeeId: string, date: string) => void;

  // Leave Operations
  applyLeave: (leave: Omit<LeaveRequest, 'id' | 'status' | 'appliedDate'>) => LeaveRequest | null;
  approveLeave: (id: string, reviewerName: string, remarks?: string) => void;
  rejectLeave: (id: string, reviewerName: string, remarks?: string) => void;

  // Shift Operations
  assignShift: (employeeId: string, shiftId: string) => void;
  addShiftTemplate: (shift: Omit<ShiftTemplate, 'id'>) => ShiftTemplate;

  // Payroll Operations
  generatePayrollBatch: (month: string) => number;
  markPayrollPaid: (id: string) => void;
  updatePayrollRecord: (id: string, updates: Partial<PayrollRecord>) => void;
  addPayrollSchedule: (
    schedule:
      | Omit<PayrollPaymentSchedule, 'id' | 'createdAt' | 'updatedAt' | 'auditHistory'>
      | Array<Omit<PayrollPaymentSchedule, 'id' | 'createdAt' | 'updatedAt' | 'auditHistory'>>
  ) => void;
  updatePayrollSchedule: (id: string, updates: Partial<PayrollPaymentSchedule>) => void;
  recordSchedulePayment: (id: string, paymentMethod?: PaymentMethod, notes?: string) => void;
  deletePayrollSchedule: (id: string) => void;
  clearDemoPayrollRecords: () => void;

  // Settings & Activity
  updateSettings: (newSettings: Partial<HRSettings>) => void;
  addNotification: (
    notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'> & { timestamp?: string; read?: boolean }
  ) => NotificationItem;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  resetToDefaultData: () => void;

  // Computed Dashboard Metrics
  dashboardMetrics: {
    totalEmployees: number;
    activeEmployees: number;
    presentToday: number;
    absentToday: number;
    onLeaveToday: number;
    lateArrivals: number;
    totalDepartments: number;
    pendingLeaves: number;
    workingToday: number;
    monthlyPayrollTotal: number;
    notMarkedToday: number;
  };
}

const HRMSContext = createContext<HRMSContextType | undefined>(undefined);

const LOCAL_STORAGE_KEYS = {
  EMPLOYEES: 'hrms_employees_v3',
  DEPARTMENTS: 'hrms_departments_v3',
  ATTENDANCE: 'hrms_attendance_v3',
  LEAVES: 'hrms_leaves_v3',
  SHIFTS: 'hrms_shifts_v3',
  PAYROLL: 'hrms_payroll_v3',
  SCHEDULES: 'hrms_payroll_schedules_v4',
  LOGS: 'hrms_activity_v3',
  NOTIFS: 'hrms_notifications_v3',
  SETTINGS: 'hrms_settings_v3',
  DESIGNATIONS: 'hrms_designations_v3',
};

export const HRMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const { currentUser, canManageEmployees, canApproveLeave, canApplyLeave, refreshUsers } = useAuth();

  // 1. Employees State
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.EMPLOYEES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return INITIAL_EMPLOYEES;
  });

  // 2. Departments State - Ensure standard organizational departments exist
  const [departments, setDepartments] = useState<Department[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.DEPARTMENTS);
    let list: Department[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        list = [];
      }
    }

    if (list.length === 0) {
      return DEFAULT_DEPARTMENTS;
    }

    // Ensure all 10 standard departments exist in DB without duplicates
    const combined = [...list];
    for (const defDept of DEFAULT_DEPARTMENTS) {
      const exists = combined.some(
        (d) => d.name.toLowerCase() === defDept.name.toLowerCase() || d.id === defDept.id
      );
      if (!exists) {
        combined.push(defDept);
      }
    }
    return combined;
  });

  // 3. Attendance State
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = safeGetItem(LOCAL_STORAGE_KEYS.ATTENDANCE);
    let list: AttendanceRecord[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      } catch {
        list = [];
      }
    }
    if (list.length === 0) {
      list = INITIAL_TODAY_ATTENDANCE;
    }
    // Attach employee avatar dynamically if missing
    return list.map((r) => {
      if (!r.avatar) {
        const emp = employees.find((e) => e.id === r.employeeId || e.employeeCode === r.employeeCode);
        return { ...r, avatar: emp?.avatar || '' };
      }
      return r;
    });
  });

  // 4. Leaves State
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.LEAVES);
    return saved ? JSON.parse(saved) : INITIAL_LEAVE_REQUESTS;
  });

  // 5. Shifts State - Exactly 3 standard company shifts (Morning, Afternoon, Evening)
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SHIFTS);
    let list: ShiftTemplate[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        list = [];
      }
    }

    const combined = [...list];
    for (const defShift of DEFAULT_SHIFTS) {
      const exists = combined.some(
        (s) => s.id === defShift.id || s.name.toLowerCase() === defShift.name.toLowerCase()
      );
      if (!exists) {
        combined.push(defShift);
      }
    }
    return combined;
  });

  // 6. Master IT Designations State
  const [designations, setDesignations] = useState<DesignationItem[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.DESIGNATIONS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return MASTER_DESIGNATIONS;
  });

  // 7. Payroll State
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.PAYROLL);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Clean verified demo/test draft records (baseSalary === 6500) backed up in payrollDemoBackup.json
          return parsed.filter((p) => !(p.status === 'draft' && p.baseSalary === 6500));
        }
      } catch {
        // fallback
      }
    }
    return INITIAL_PAYROLL;
  });

  // 7b. Payroll Payment Schedules State (Salary Calendar)
  const [payrollSchedules, setPayrollSchedules] = useState<PayrollPaymentSchedule[]>(() => {
    // Safely back up any pre-existing demo/test schedules from v3 before starting with a clean calendar
    const legacyV3 = localStorage.getItem('hrms_payroll_schedules_v3');
    if (legacyV3) {
      if (!localStorage.getItem('hrms_payroll_schedules_backup_v3')) {
        localStorage.setItem('hrms_payroll_schedules_backup_v3', legacyV3);
      }
      localStorage.removeItem('hrms_payroll_schedules_v3');
    }

    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SCHEDULES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return INITIAL_PAYROLL_SCHEDULES;
  });

  // 8. Activity Logs
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.LOGS);
    return saved ? JSON.parse(saved) : INITIAL_ACTIVITY_LOGS;
  });

  // 9. Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.NOTIFS);
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  // 10. Settings with Timezone
  const [settings, setSettings] = useState<HRSettings>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS);
    const parsed = saved ? JSON.parse(saved) : INITIAL_SETTINGS;
    return {
      ...parsed,
      timezone: parsed.timezone || 'Asia/Kolkata',
    };
  });

  // Dashboard Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = getCompanyTodayDate('Asia/Kolkata');
    try {
      const saved = sessionStorage.getItem('hrms_selected_date');
      if (saved) return saved;
    } catch {}
    return today;
  });

  // Track selected date in session storage for browser refresh persistence
  useEffect(() => {
    try {
      sessionStorage.setItem('hrms_selected_date', selectedDate);
    } catch {}
  }, [selectedDate]);

  // Automatic midnight detection in company timezone (Asia/Kolkata)
  useEffect(() => {
    const checkMidnight = () => {
      const currentToday = getCompanyTodayDate(settings.timezone || 'Asia/Kolkata');
      let previousToday = currentToday;
      try {
        previousToday = sessionStorage.getItem('hrms_current_today') || currentToday;
      } catch {}

      if (previousToday !== currentToday) {
        try {
          sessionStorage.setItem('hrms_current_today', currentToday);
        } catch {}
        // If the user was viewing the previous day in live mode, switch to the new day
        setSelectedDate((prevSelected) => {
          if (prevSelected === previousToday) {
            return currentToday;
          }
          return prevSelected;
        });
      } else {
        try {
          sessionStorage.setItem('hrms_current_today', currentToday);
        } catch {}
      }
    };

    checkMidnight();
    const interval = setInterval(checkMidnight, 10000);
    return () => clearInterval(interval);
  }, [settings.timezone]);

  // Persistence Effects
  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
    refreshUsers();
  }, [employees, refreshUsers]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.DEPARTMENTS, JSON.stringify(departments));
  }, [departments]);

  useEffect(() => {
    const sanitizedAttendance = attendanceRecords.map((r) => {
      if (r.avatar && (r.avatar.startsWith('data:') || r.avatar.length > 200)) {
        const { avatar, ...rest } = r;
        return { ...rest, avatar: '' };
      }
      return r;
    });
    safeSetItem(LOCAL_STORAGE_KEYS.ATTENDANCE, JSON.stringify(sanitizedAttendance));
  }, [attendanceRecords]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.LEAVES, JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.SHIFTS, JSON.stringify(shiftTemplates));
  }, [shiftTemplates]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.PAYROLL, JSON.stringify(payrollRecords));
  }, [payrollRecords]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.SCHEDULES, JSON.stringify(payrollSchedules));
  }, [payrollSchedules]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.LOGS, JSON.stringify(activityLogs));
  }, [activityLogs]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.NOTIFS, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.DESIGNATIONS, JSON.stringify(designations));
  }, [designations]);

  const addDesignation = useCallback((desig: Omit<DesignationItem, 'id'>): DesignationItem => {
    const newDesig: DesignationItem = {
      ...desig,
      id: `desig-${Date.now()}`,
    };
    setDesignations((prev) => [...prev, newDesig]);
    showToast(`Designation "${newDesig.name}" added successfully.`, 'success');
    return newDesig;
  }, [showToast]);

  // Activity Logger Helper
  const logActivity = useCallback((action: string, target: string, module: ActivityLog['module'], badgeColor?: string) => {
    const newLog: ActivityLog = {
      id: `act-${Date.now()}`,
      actorName: 'Eleanor Vance',
      actorAvatar: getInitialsAvatar('Eleanor Vance'),
      action,
      target,
      timestamp: 'Just now',
      module,
      badgeColor: badgeColor || '#206DA6',
    };
    setActivityLogs((prev) => [newLog, ...prev.slice(0, 49)]);
  }, []);

  // EMPLOYEE CRUD
  const addEmployee = (empData: Omit<Employee, 'id' | 'employeeCode'>): Employee => {
    if (!canManageEmployees) {
      showToast('Only HR/Admin users are authorized to add employees.', 'error');
      throw new Error('Unauthorized');
    }
    const maxNum = employees.reduce((max, emp) => {
      const m = (emp.employeeCode || emp.id || '').match(/(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        const normalized = n < 1000 ? 1000 + n : n;
        return Math.max(max, normalized);
      }
      return max;
    }, 1000);
    const codeNum = maxNum + 1;
    const employeeCode = `EMP-${codeNum}`;
    const id = `emp-${codeNum}`;
    const avatar = empData.avatar && empData.avatar.trim()
      ? empData.avatar
      : getInitialsAvatar(empData.fullName || `${empData.firstName} ${empData.lastName}`);

    const newEmployee: Employee = {
      ...empData,
      avatar,
      id,
      employeeCode,
    };

    setEmployees((prev) => [newEmployee, ...prev]);
    logActivity('onboarded new employee', `${newEmployee.fullName} (${newEmployee.designation})`, 'employee', '#18A999');
    showToast('Employee profile created successfully!', 'success', 'Employee Created');
    return newEmployee;
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    if (!canManageEmployees) {
      showToast('Only HR/Admin users are authorized to update employee records.', 'error');
      return;
    }
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === id) {
          const fullName = updates.fullName || (updates.firstName || updates.lastName ? `${updates.firstName ?? emp.firstName} ${updates.lastName ?? emp.lastName}`.trim() : emp.fullName);
          const avatar = updates.avatar !== undefined
            ? (updates.avatar && updates.avatar.trim() ? updates.avatar : getInitialsAvatar(fullName))
            : emp.avatar;
          const updated = { ...emp, ...updates, fullName, avatar };
          return updated;
        }
        return emp;
      })
    );
    // Also sync department name or shift name in attendance if changed
    if (updates.departmentId || updates.shiftId) {
      setAttendanceRecords((prev) =>
        prev.map((att) => {
          if (att.employeeId === id) {
            return {
              ...att,
              departmentId: updates.departmentId || att.departmentId,
              departmentName: updates.departmentName || att.departmentName,
            };
          }
          return att;
        })
      );
    }
    logActivity('updated employee details for', updates.fullName || id, 'employee');
    showToast('Employee profile updated successfully.', 'success');
  };

  const deleteEmployee = (id: string) => {
    if (!canManageEmployees) {
      showToast('Only HR/Admin users are authorized to delete employee records.', 'error');
      return;
    }
    const emp = employees.find((e) => e.id === id);
    if (!emp) return;
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    // Remove from attendance and pending leaves
    setAttendanceRecords((prev) => prev.filter((a) => a.employeeId !== id));
    logActivity('removed employee record for', emp.fullName, 'employee', '#EF4444');
    showToast(`Employee ${emp.fullName} was deleted.`, 'info');
  };

  const getEmployeeById = (id: string) => employees.find((e) => e.id === id);

  // DEPARTMENT CRUD
  const addDepartment = (deptData: Omit<Department, 'id' | 'createdAt'>): Department => {
    const id = `dept-${deptData.code.toLowerCase().replace(/\s+/g, '-')}`;
    const newDept: Department = {
      ...deptData,
      id,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setDepartments((prev) => [...prev, newDept]);
    logActivity('created new department', newDept.name, 'department', '#8B5CF6');
    showToast(`Department ${newDept.name} created.`, 'success');
    return newDept;
  };

  const updateDepartment = (id: string, updates: Partial<Department>) => {
    setDepartments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
    // Sync departmentName in employees
    if (updates.name) {
      setEmployees((prev) =>
        prev.map((e) => (e.departmentId === id ? { ...e, departmentName: updates.name! } : e))
      );
    }
    logActivity('updated department details for', updates.name || id, 'department');
    showToast('Department updated successfully.', 'success');
  };

  const deleteDepartment = (id: string): boolean => {
    const assignedCount = employees.filter((e) => e.departmentId === id).length;
    if (assignedCount > 0) {
      showToast(`Cannot delete department with ${assignedCount} active employees. Please reassign them first.`, 'error');
      return false;
    }
    const dept = departments.find((d) => d.id === id);
    setDepartments((prev) => prev.filter((d) => d.id !== id));
    logActivity('deleted department', dept?.name || id, 'department', '#EF4444');
    showToast('Department deleted successfully.', 'info');
    return true;
  };

  // ATTENDANCE OPERATIONS
  const checkIn = (
    employeeId: string,
    notes?: string,
    options?: { workLocation?: string; punchNote?: string }
  ): boolean => {
    const emp = employees.find(
      (e) =>
        e.id === employeeId ||
        e.employeeCode?.trim().toUpperCase() === employeeId?.trim().toUpperCase()
    );
    if (!emp) {
      showToast('Employee profile not found.', 'error');
      return false;
    }

    // Access Rule: Only the authenticated employee can punch for their own profile when not Admin/HR
    if (!canManageEmployees) {
      const ownEmp = findLinkedEmployee(currentUser, employees);
      if (!ownEmp || !isSameEmployeeRecord(ownEmp, emp)) {
        showToast('Authorization Error: You can only punch attendance for your own employee profile.', 'error');
        return false;
      }
    }

    // Future date validation
    const todayDate = getCompanyTodayDate(settings.timezone || 'Asia/Kolkata');
    if (selectedDate > todayDate) {
      showToast(`Check In is disabled for future dates (${selectedDate}).`, 'warning');
      return false;
    }

    const existingIndex = attendanceRecords.findIndex(
      (a) =>
        (a.employeeId === emp.id ||
          (a.employeeCode && emp.employeeCode && a.employeeCode.toUpperCase() === emp.employeeCode.toUpperCase())) &&
        a.date === selectedDate
    );

    if (existingIndex >= 0) {
      const existingRec = attendanceRecords[existingIndex];
      if (existingRec.checkInTime && existingRec.checkOutTime) {
        showToast(
          `Attendance punch for ${emp.fullName} is already completed for ${selectedDate} (Checked In & Checked Out).`,
          'warning'
        );
        return false;
      }
      if (existingRec.checkInTime) {
        showToast(
          `${emp.fullName} has already checked in at ${formatTime12Hour(existingRec.checkInTime)} on ${selectedDate}. Please Check Out before checking in again.`,
          'warning'
        );
        return false;
      }
    }

    const shift = resolveEmployeeShift(emp, shiftTemplates);
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss
    const punctuality = evaluatePunctuality(timeStr, shift.startTime, 10);
    const formattedIn = formatTime12Hour(timeStr);

    const punctualityStatus = punctuality.isLate ? 'late' : 'on_time';
    // Status is 'late' if arrived after 10-minute grace period, else 'checked_in'
    const status: AttendanceStatus = punctuality.isLate ? 'late' : 'checked_in';

    const workLocation = options?.workLocation || (notes ? notes.split(' - ')[0] : 'On-site (HQ)');
    const punchNote =
      options?.punchNote !== undefined
        ? options.punchNote
        : notes && notes.includes(' - ')
        ? notes.split(' - ').slice(1).join(' - ')
        : '';

    const defaultNote = punctuality.isLate
      ? `Late arrival (+${punctuality.lateMinutes} min)`
      : 'On-time check-in';
    const combinedUserNote = notes || (punchNote ? `${workLocation} - ${punchNote}` : workLocation);
    const noteText = combinedUserNote ? `${combinedUserNote} (${defaultNote})` : defaultNote;

    if (existingIndex >= 0) {
      const updated = [...attendanceRecords];
      updated[existingIndex] = {
        ...updated[existingIndex],
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        shiftId: shift.id,
        shiftName: shift.name,
        scheduledStartTime: shift.startTime,
        scheduledEndTime: shift.endTime,
        checkInTime: timeStr,
        location: workLocation,
        workLocation,
        punchNote,
        punchStatus: 'checked_in',
        status,
        punctualityStatus,
        lateMinutes: punctuality.lateMinutes,
        notes: noteText,
        updatedAt: now.toISOString(),
      };
      setAttendanceRecords(updated);
    } else {
      const newRec: AttendanceRecord = {
        id: `att-${Date.now()}`,
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        departmentId: emp.departmentId,
        departmentName: emp.departmentName,
        avatar: emp.avatar,
        date: selectedDate,
        shiftId: shift.id,
        shiftName: shift.name,
        scheduledStartTime: shift.startTime,
        scheduledEndTime: shift.endTime,
        checkInTime: timeStr,
        location: workLocation,
        workLocation,
        punchNote,
        punchStatus: 'checked_in',
        status,
        punctualityStatus,
        lateMinutes: punctuality.lateMinutes,
        workHours: 0,
        workHoursFormatted: '--',
        notes: noteText,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      setAttendanceRecords((prev) => [newRec, ...prev]);
    }

    // Send real-time notification to Administrator
    const adminNotifMessage = `${emp.fullName} checked in at ${formattedIn} on ${selectedDate} from ${workLocation}.`;
    const newAdminNotif: NotificationItem = {
      id: `notif-att-in-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: 'Employee Checked In',
      message: adminNotifMessage,
      timestamp: `${selectedDate} • ${formattedIn}`,
      read: false,
      type: 'attendance',
      actionType: 'check-in',
      employeeId: emp.id,
      employeeName: emp.fullName,
      workLocation,
      targetRole: 'admin',
      recipientUserId: 'user-admin',
      createdAt: now.toISOString(),
    };
    setNotifications((prev) => [newAdminNotif, ...prev]);

    logActivity(
      'checked in',
      `${emp.fullName} (${formattedIn}) - ${workLocation} • ${shift.name}`,
      'attendance',
      punctuality.isLate ? '#F59E0B' : '#10B981'
    );
    showToast(`Check-in recorded successfully at ${formattedIn} (${punctuality.isLate ? 'LATE' : 'ON TIME'})`, 'success');
    return true;
  };

  const checkOut = (
    employeeId: string,
    notes?: string,
    options?: { workLocation?: string; punchNote?: string }
  ): boolean => {
    const emp = employees.find(
      (e) =>
        e.id === employeeId ||
        e.employeeCode?.trim().toUpperCase() === employeeId?.trim().toUpperCase()
    );
    if (!emp) {
      showToast('Employee profile not found.', 'error');
      return false;
    }

    // Access Rule: Only the authenticated employee can punch for their own profile when not Admin/HR
    if (!canManageEmployees) {
      const ownEmp = findLinkedEmployee(currentUser, employees);
      if (!ownEmp || !isSameEmployeeRecord(ownEmp, emp)) {
        showToast('Authorization Error: You can only punch attendance for your own employee profile.', 'error');
        return false;
      }
    }

    // Future date validation
    const todayDate = getCompanyTodayDate(settings.timezone || 'Asia/Kolkata');
    if (selectedDate > todayDate) {
      showToast(`Check Out is disabled for future dates (${selectedDate}).`, 'warning');
      return false;
    }

    const existingRecord = attendanceRecords.find(
      (a) =>
        (a.employeeId === emp.id ||
          (a.employeeCode && emp.employeeCode && a.employeeCode.toUpperCase() === emp.employeeCode.toUpperCase())) &&
        a.date === selectedDate
    );

    if (!existingRecord || !existingRecord.checkInTime) {
      showToast('Cannot Check Out before Check In. Please Check In first.', 'error');
      return false;
    }

    if (existingRecord.checkOutTime) {
      showToast(
        `${emp.fullName} has already checked out at ${formatTime12Hour(existingRecord.checkOutTime)} on ${selectedDate}.`,
        'warning'
      );
      return false;
    }

    const shift = resolveEmployeeShift(emp, shiftTemplates);
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const formattedOut = formatTime12Hour(timeStr);

    const workLocation =
      options?.workLocation ||
      existingRecord.workLocation ||
      existingRecord.location ||
      (notes ? notes.split(' - ')[0] : 'On-site (HQ)');
    const outPunchNote =
      options?.punchNote !== undefined
        ? options.punchNote
        : notes && notes.includes(' - ')
        ? notes.split(' - ').slice(1).join(' - ')
        : '';

    const checkInTime = existingRecord.checkInTime || shift.startTime;
    const hoursCalc = calculateWorkHoursDetails(checkInTime, timeStr);
    const exitCalc = evaluateExitPunctuality(timeStr, shift.endTime);

    let finalStatus: AttendanceStatus = 'present';
    if (hoursCalc.decimalHours < 4) {
      finalStatus = 'half_day';
    } else if (existingRecord.punctualityStatus === 'late') {
      finalStatus = 'late';
    }

    setAttendanceRecords((prev) =>
      prev.map((a) => {
        if (a.id === existingRecord.id || (a.employeeId === emp.id && a.date === selectedDate)) {
          let noteText = a.notes || '';
          const userOutNote = notes || (outPunchNote ? `${workLocation} - ${outPunchNote}` : '');
          if (userOutNote) {
            noteText = `${noteText} | Out: ${userOutNote}`;
          }
          if (exitCalc.isOvertime) {
            noteText = `${noteText} (OT: +${Math.round((exitCalc.overtimeMinutes / 60) * 10) / 10}h)`;
          } else if (exitCalc.isEarlyExit) {
            noteText = `${noteText} (Early exit: -${exitCalc.earlyExitMinutes}m)`;
          }

          const combinedPunchNote = outPunchNote
            ? a.punchNote
              ? `${a.punchNote} | Out: ${outPunchNote}`
              : outPunchNote
            : a.punchNote;

          return {
            ...a,
            checkOutTime: timeStr,
            workHours: hoursCalc.decimalHours,
            workHoursFormatted: hoursCalc.formattedHours,
            location: workLocation,
            workLocation,
            punchNote: combinedPunchNote,
            punchStatus: 'checked_out',
            status: finalStatus,
            earlyExitMinutes: exitCalc.earlyExitMinutes,
            overtimeMinutes: exitCalc.overtimeMinutes,
            notes: noteText.trim(),
            updatedAt: now.toISOString(),
          };
        }
        return a;
      })
    );

    // Send real-time notification to Administrator
    const adminNotifMessage = `${emp.fullName} checked out at ${formattedOut} on ${selectedDate} from ${workLocation}.`;
    const newAdminNotif: NotificationItem = {
      id: `notif-att-out-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: 'Employee Checked Out',
      message: adminNotifMessage,
      timestamp: `${selectedDate} • ${formattedOut}`,
      read: false,
      type: 'attendance',
      actionType: 'check-out',
      employeeId: emp.id,
      employeeName: emp.fullName,
      workLocation,
      targetRole: 'admin',
      recipientUserId: 'user-admin',
      createdAt: now.toISOString(),
    };
    setNotifications((prev) => [newAdminNotif, ...prev]);

    logActivity(
      'checked out',
      `${emp.fullName} (${formattedOut}) - ${workLocation} • ${hoursCalc.formattedHours}`,
      'attendance',
      '#206DA6'
    );
    showToast(`Check-out recorded successfully at ${formattedOut} (Work Duration: ${hoursCalc.formattedHours})`, 'info');
    return true;
  };

  const saveAttendanceRecord = (record: Partial<AttendanceRecord> & { employeeId: string; date: string }) => {
    if (!canManageEmployees) {
      showToast('Unauthorized: Only administrators can modify attendance records manually.', 'error');
      return;
    }
    const emp = employees.find((e) => e.id === record.employeeId);
    if (!emp) return;

    const shift = resolveEmployeeShift(emp, shiftTemplates);
    let workHours = record.workHours;
    let workHoursFormatted = record.workHoursFormatted;
    let punctualityStatus = record.punctualityStatus;
    let lateMinutes = record.lateMinutes || 0;
    let earlyExitMinutes = record.earlyExitMinutes || 0;
    let overtimeMinutes = record.overtimeMinutes || 0;
    const status = record.status || 'present';

    if (record.checkInTime) {
      const punctuality = evaluatePunctuality(record.checkInTime, shift.startTime, 10);
      punctualityStatus = punctuality.isLate ? 'late' : 'on_time';
      lateMinutes = punctuality.lateMinutes;

      if (record.checkOutTime) {
        const hoursCalc = calculateWorkHoursDetails(record.checkInTime, record.checkOutTime);
        if (workHours === undefined) {
          workHours = hoursCalc.decimalHours;
        }
        if (!workHoursFormatted) {
          workHoursFormatted = hoursCalc.formattedHours;
        }
        const exitCalc = evaluateExitPunctuality(record.checkOutTime, shift.endTime);
        earlyExitMinutes = exitCalc.earlyExitMinutes;
        overtimeMinutes = exitCalc.overtimeMinutes;
      }
    }

    const nowIso = new Date().toISOString();

    // If marking on_leave, synchronize an approved leave request into leaveRequests if none exists
    if (status === 'on_leave') {
      setLeaveRequests((prevLeaves) => {
        const hasApproved = prevLeaves.some(
          (l) => l.employeeId === emp.id && l.status === 'approved' && record.date >= l.startDate && record.date <= l.endDate
        );
        if (!hasApproved) {
          const newLeave: LeaveRequest = {
            id: `leave-${Date.now()}`,
            employeeId: emp.id,
            employeeName: emp.fullName,
            employeeCode: emp.employeeCode,
            avatar: emp.avatar,
            departmentId: emp.departmentId,
            departmentName: emp.departmentName,
            leaveType: 'casual',
            startDate: record.date,
            endDate: record.date,
            daysCount: 1,
            reason: record.notes || 'Approved company leave',
            status: 'approved',
            appliedDate: record.date,
            reviewedBy: record.enteredBy || 'Administrator',
            reviewRemarks: 'Approved on attendance register',
            reviewedDate: nowIso,
          };
          return [newLeave, ...prevLeaves];
        }
        return prevLeaves;
      });
    }

    setAttendanceRecords((prev) => {
      const idx = prev.findIndex((a) => a.employeeId === record.employeeId && a.date === record.date);

      // If resetting to not_marked and no actual punch was made, remove the record
      if (status === 'not_marked' && !record.checkInTime && !record.checkOutTime) {
        if (idx >= 0) {
          return prev.filter((_, i) => i !== idx);
        }
        return prev;
      }
      const existing = idx >= 0 ? prev[idx] : undefined;

      const previousStatus = existing?.status;
      const calculatedStatus = existing?.calculatedStatus || existing?.status || 'present';

      const auditLogItem: AttendanceAuditLog = {
        id: `audit-${Date.now()}`,
        timestamp: nowIso,
        previousStatus,
        newStatus: status,
        reason: record.manualReason || 'Manual adjustment',
        notes: record.notes,
        enteredBy: record.enteredBy || 'Administrator',
        action: existing ? 'correction' : 'manual_override',
      };

      const updatedAuditHistory = [auditLogItem, ...(existing?.auditHistory || [])];

      if (idx >= 0) {
        const copy = [...prev];
        const existing = prev[idx];
        const effectiveCheckIn = record.checkInTime !== undefined ? record.checkInTime : existing.checkInTime;
        const effectiveCheckOut = record.checkOutTime !== undefined ? record.checkOutTime : existing.checkOutTime;
        let effectiveWorkHours = record.workHours !== undefined ? record.workHours : existing.workHours;
        let effectiveWorkHoursFormatted = record.workHoursFormatted !== undefined ? record.workHoursFormatted : existing.workHoursFormatted;

        if (effectiveCheckIn && effectiveCheckOut && (effectiveWorkHours === undefined || effectiveWorkHours === 0)) {
          const calc = calculateWorkHoursDetails(effectiveCheckIn, effectiveCheckOut);
          effectiveWorkHours = calc.decimalHours;
          effectiveWorkHoursFormatted = calc.formattedHours;
        }

        // If marking absent when punches existed, preserve note of the conflict
        let effectiveNotes = record.notes !== undefined ? record.notes : existing.notes;
        if (status === 'absent' && effectiveCheckIn && !effectiveNotes?.includes('[Punch Conflict]')) {
          effectiveNotes = `${effectiveNotes ? effectiveNotes + ' | ' : ''}[Punch Conflict] Had check-in: ${effectiveCheckIn}${effectiveCheckOut ? `, check-out: ${effectiveCheckOut}` : ''}`;
        }

        copy[idx] = {
          ...copy[idx],
          ...record,
          shiftId: shift.id,
          shiftName: shift.name,
          scheduledStartTime: shift.startTime,
          scheduledEndTime: shift.endTime,
          checkInTime: effectiveCheckIn,
          checkOutTime: effectiveCheckOut,
          workHours: effectiveWorkHours ?? 0,
          workHoursFormatted: effectiveWorkHoursFormatted ?? '--',
          punctualityStatus: punctualityStatus ?? existing.punctualityStatus,
          lateMinutes: lateMinutes ?? existing.lateMinutes,
          earlyExitMinutes: earlyExitMinutes ?? existing.earlyExitMinutes,
          overtimeMinutes: overtimeMinutes ?? existing.overtimeMinutes,
          notes: effectiveNotes,
          status,
          manualStatus: status,
          calculatedStatus,
          isManualOverride: true,
          isManualEntry: true,
          enteredBy: record.enteredBy || 'Administrator',
          updatedAt: nowIso,
          auditHistory: updatedAuditHistory,
        };
        return copy;
      } else {
        let effectiveWorkHours = workHours;
        let effectiveWorkHoursFormatted = workHoursFormatted;
        if (record.checkInTime && record.checkOutTime) {
          const calc = calculateWorkHoursDetails(record.checkInTime, record.checkOutTime);
          effectiveWorkHours = calc.decimalHours;
          effectiveWorkHoursFormatted = calc.formattedHours;
        } else {
          effectiveWorkHours = effectiveWorkHours ?? 0;
          effectiveWorkHoursFormatted = effectiveWorkHoursFormatted ?? '--';
        }

        const newRecord: AttendanceRecord = {
          id: `att-${Date.now()}`,
          employeeId: emp.id,
          employeeName: emp.fullName,
          employeeCode: emp.employeeCode,
          departmentId: emp.departmentId,
          departmentName: emp.departmentName,
          avatar: emp.avatar,
          date: record.date,
          shiftId: shift.id,
          shiftName: shift.name,
          scheduledStartTime: shift.startTime,
          scheduledEndTime: shift.endTime,
          status,
          manualStatus: status,
          calculatedStatus: 'present',
          isManualOverride: true,
          isManualEntry: true,
          punctualityStatus,
          checkInTime: record.checkInTime,
          checkOutTime: record.checkOutTime,
          workHours: effectiveWorkHours,
          workHoursFormatted: effectiveWorkHoursFormatted,
          lateMinutes,
          earlyExitMinutes,
          overtimeMinutes,
          notes: record.notes || (status === 'present' ? 'Manually confirmed present' : record.manualReason || 'Manual entry'),
          manualReason: record.manualReason,
          enteredBy: record.enteredBy || 'Administrator',
          createdAt: nowIso,
          updatedAt: nowIso,
          halfDayType: record.halfDayType,
          permissionStartTime: record.permissionStartTime,
          permissionEndTime: record.permissionEndTime,
          permissionReason: record.permissionReason,
          leaveReference: record.leaveReference,
          holidayReference: record.holidayReference,
          scheduleReference: record.scheduleReference,
          missingPunchType: record.missingPunchType,
          location: record.location,
          auditHistory: [auditLogItem],
        };
        return [newRecord, ...prev];
      }
    });

    logActivity('manually updated attendance for', `${emp.fullName} (${record.date}) -> ${status.toUpperCase()}`, 'attendance');
    showToast('Attendance updated successfully!', 'success');
  };

  const removeAttendanceOverride = (employeeId: string, date: string) => {
    if (!canManageEmployees) {
      showToast('Unauthorized: Only administrators can revert attendance overrides.', 'error');
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;

    setAttendanceRecords((prev) => {
      const idx = prev.findIndex((a) => a.employeeId === employeeId && a.date === date);
      if (idx < 0) return prev;

      const record = prev[idx];
      const shift = resolveEmployeeShift(emp, shiftTemplates);

      // Re-evaluate automatically without the manual override flag
      const autoEval = evaluateEmployeeAttendanceStatus({
        employee: emp,
        dateStr: date,
        record: { ...record, isManualOverride: false, isManualEntry: false },
        shift,
        leaveRequests,
      });

      const auditEntry: AttendanceAuditLog = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        previousStatus: record.status,
        newStatus: autoEval.status,
        reason: 'Reverted manual override to automatic calculation',
        enteredBy: 'Administrator',
        action: 'revert_to_auto',
      };

      // If this record had no actual punch and was created purely for manual entry, remove it so dynamic evaluation takes over
      if (!record.checkInTime && !record.checkOutTime) {
        return prev.filter((_, i) => i !== idx);
      }

      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        status: autoEval.status,
        manualStatus: undefined,
        isManualOverride: false,
        isManualEntry: false,
        notes: autoEval.notes,
        updatedAt: new Date().toISOString(),
        auditHistory: [auditEntry, ...(record.auditHistory || [])],
      };
      return copy;
    });

    logActivity('reverted attendance override for', `${emp.fullName} (${date})`, 'attendance');
    showToast('Attendance status reverted to automatic calculation.', 'info');
  };

  // LEAVE OPERATIONS
  const applyLeave = (leave: Omit<LeaveRequest, 'id' | 'status' | 'appliedDate'>): LeaveRequest | null => {
    if (!currentUser || !canApplyLeave || currentUser.role === 'admin' || currentUser.role === 'hr_manager') {
      showToast('Administrative accounts cannot submit employee leave applications.', 'error');
      return null;
    }

    const linkedEmp = findLinkedEmployee(currentUser, employees);
    if (!linkedEmp) {
      showToast('Your user account is not linked to an employee profile. Please contact HR.', 'error');
      return null;
    }

    const isAuthorizedForTarget = doesLeaveBelongToEmployee(
      { employeeId: leave.employeeId, employeeCode: leave.employeeCode },
      linkedEmp
    );
    if (!isAuthorizedForTarget) {
      showToast('You can only submit leave applications for your own employee profile.', 'error');
      return null;
    }

    if (!leave.startDate || !leave.endDate || leave.endDate < leave.startDate) {
      showToast('Please select a valid start and end date for the leave request.', 'error');
      return null;
    }

    const trimmedCustomType =
      leave.leaveType === 'others' ? (leave.customLeaveType || '').trim().slice(0, 100) : undefined;
    if (leave.leaveType === 'others' && !trimmedCustomType) {
      showToast('Please specify your leave type when selecting Others.', 'error');
      return null;
    }

    if (!leave.reason || !leave.reason.trim()) {
      showToast('Please provide a reason for the leave request.', 'error');
      return null;
    }

    const conflictingLeave = leaveRequests.find(
      (existing) =>
        doesLeaveBelongToEmployee(existing, linkedEmp) &&
        (existing.status === 'pending' || existing.status === 'approved') &&
        leave.startDate <= existing.endDate &&
        leave.endDate >= existing.startDate
    );
    if (conflictingLeave) {
      showToast(
        `You already have a ${conflictingLeave.status} leave request (${conflictingLeave.startDate} to ${conflictingLeave.endDate}) for the selected period.`,
        'error'
      );
      return null;
    }

    const id = `leave-${Date.now().toString().slice(-4)}`;
    const nowIso = new Date().toISOString();
    const newLeave: LeaveRequest = {
      ...leave,
      id,
      employeeId: linkedEmp.id,
      employeeName: linkedEmp.fullName,
      employeeCode: linkedEmp.employeeCode,
      departmentId: linkedEmp.departmentId,
      departmentName: linkedEmp.departmentName,
      avatar: linkedEmp.avatar,
      customLeaveType: trimmedCustomType,
      reason: leave.reason.trim(),
      status: 'pending',
      appliedDate: selectedDate,
      submittedByUserId: currentUser.id,
      submittedAt: nowIso,
    };

    setLeaveRequests((prev) => [newLeave, ...prev]);

    const categoryLabel =
      newLeave.leaveType === 'others' && newLeave.customLeaveType
        ? `Others (${newLeave.customLeaveType})`
        : newLeave.leaveType;

    // Add notification
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: 'New Leave Application',
      message: `${newLeave.employeeName} (${newLeave.employeeCode}) applied for ${newLeave.daysCount} days of ${categoryLabel} leave.`,
      timestamp: 'Just now',
      read: false,
      type: 'leave',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    logActivity('submitted leave request for', `${newLeave.employeeName} (${newLeave.daysCount} days)`, 'leave', '#F59E0B');
    showToast('Leave application submitted successfully!', 'success');
    return newLeave;
  };

  const approveLeave = (id: string, reviewerName: string, remarks?: string) => {
    if (!canApproveLeave || currentUser.role === 'employee') {
      showToast('You do not have permission to approve leave requests.', 'error');
      return;
    }
    const req = leaveRequests.find((l) => l.id === id);
    if (!req) return;
    const reviewerEmp = findLinkedEmployee(currentUser, employees);
    if (
      (currentUser.employeeId && req.employeeId === currentUser.employeeId) ||
      (reviewerEmp && doesLeaveBelongToEmployee(req, reviewerEmp))
    ) {
      showToast('You cannot approve your own leave request.', 'error');
      return;
    }

    const categoryNote =
      req.leaveType === 'others' && req.customLeaveType
        ? `Others — ${req.customLeaveType}`
        : req.leaveType;

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: 'approved',
              reviewedBy: reviewerName,
              reviewedDate: selectedDate,
              reviewRemarks: remarks || 'Approved by HR/Manager',
            }
          : l
      )
    );

    // Update attendance record for today if the leave includes today
    if (selectedDate >= req.startDate && selectedDate <= req.endDate) {
      setAttendanceRecords((prev) => {
        const idx = prev.findIndex((a) => a.employeeId === req.employeeId && a.date === selectedDate);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], status: 'on_leave', notes: `Approved ${categoryNote} leave` };
          return copy;
        } else {
          return [
            {
              id: `att-${Date.now()}`,
              employeeId: req.employeeId,
              employeeName: req.employeeName,
              employeeCode: req.employeeCode,
              departmentId: req.departmentId,
              departmentName: req.departmentName,
              avatar: req.avatar,
              date: selectedDate,
              status: 'on_leave',
              notes: `Approved ${categoryNote} leave`,
            },
            ...prev,
          ];
        }
      });

      // Update employee status
      setEmployees((prev) =>
        prev.map((e) => (e.id === req.employeeId ? { ...e, status: 'on_leave' } : e))
      );
    }

    logActivity('approved leave request for', `${req.employeeName} (${req.daysCount} days)`, 'leave', '#10B981');
    showToast(`Leave request for ${req.employeeName} approved.`, 'success');
  };

  const rejectLeave = (id: string, reviewerName: string, remarks?: string) => {
    if (!canApproveLeave || currentUser.role === 'employee') {
      showToast('You do not have permission to reject leave requests.', 'error');
      return;
    }
    const req = leaveRequests.find((l) => l.id === id);
    if (!req) return;
    const reviewerEmp = findLinkedEmployee(currentUser, employees);
    if (
      (currentUser.employeeId && req.employeeId === currentUser.employeeId) ||
      (reviewerEmp && doesLeaveBelongToEmployee(req, reviewerEmp))
    ) {
      showToast('You cannot reject your own leave request.', 'error');
      return;
    }

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: 'rejected',
              reviewedBy: reviewerName,
              reviewedDate: selectedDate,
              reviewRemarks: remarks || 'Declined',
            }
          : l
      )
    );

    logActivity('rejected leave request for', `${req.employeeName}`, 'leave', '#EF4444');
    showToast(`Leave request for ${req.employeeName} was rejected.`, 'info');
  };

  // SHIFT OPERATIONS
  const assignShift = (employeeId: string, shiftId: string) => {
    const shift = shiftTemplates.find((s) => s.id === shiftId);
    if (!shift) return;

    setEmployees((prev) =>
      prev.map((e) =>
        e.id === employeeId
          ? { ...e, shiftId: shift.id, shiftName: shift.name }
          : e
      )
    );

    const emp = employees.find((e) => e.id === employeeId);
    logActivity('reassigned shift for', `${emp?.fullName} -> ${shift.name}`, 'shift', '#8B5CF6');
    showToast(`Assigned ${shift.name} to ${emp?.fullName}`, 'success');
  };

  const addShiftTemplate = (shiftData: Omit<ShiftTemplate, 'id'>): ShiftTemplate => {
    const id = `shift-${Date.now().toString().slice(-4)}`;
    const newShift: ShiftTemplate = { ...shiftData, id };
    setShiftTemplates((prev) => [...prev, newShift]);
    logActivity('created shift schedule', newShift.name, 'shift');
    showToast(`Shift ${newShift.name} added.`, 'success');
    return newShift;
  };

  // PAYROLL OPERATIONS
  const generatePayrollBatch = (month: string): number => {
    const activeEmps = employees.filter((e) => e.status !== 'terminated');
    let generatedCount = 0;

    const newRecords: PayrollRecord[] = activeEmps.map((emp) => {
      const existing = payrollRecords.find((p) => p.employeeId === emp.id && p.month === month);
      if (existing) return existing;

      generatedCount++;
      const housing = Math.round(emp.baseSalary * 0.1);
      const transport = 350;
      const medical = 400;
      const bonus = 500;
      const grossSalary = emp.baseSalary + housing + transport + medical + bonus;

      const tax = Math.round(grossSalary * 0.18);
      const healthInsurance = 350;
      const providentFund = Math.round(emp.baseSalary * 0.05);
      const totalDeductions = tax + healthInsurance + providentFund;
      const netSalary = grossSalary - totalDeductions;

      return {
        id: `pay-${month}-${emp.employeeCode.replace('EMP-', '')}`,
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        departmentId: emp.departmentId,
        departmentName: emp.departmentName,
        month,
        baseSalary: emp.baseSalary,
        allowances: { housing, transport, medical, performanceBonus: bonus },
        deductions: { tax, healthInsurance, providentFund, unpaidLeaveDeduction: 0 },
        grossSalary,
        totalDeductions,
        netSalary,
        paymentMethod: 'Direct Deposit',
        status: 'draft',
        payslipNumber: `PAY-${month.replace('-', '')}-${emp.employeeCode.replace('EMP-', '')}`,
      };
    });

    setPayrollRecords(newRecords);
    logActivity('generated payroll batch for', `${month} (${generatedCount} new slips)`, 'payroll', '#206DA6');
    showToast(`Generated ${generatedCount} payslips for period ${month}.`, 'success');
    return generatedCount;
  };

  const markPayrollPaid = (id: string) => {
    setPayrollRecords((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: 'paid', paymentDate: new Date().toISOString().split('T')[0] }
          : p
      )
    );
    showToast('Payslip marked as PAID and disbursed.', 'success');
  };

  const updatePayrollRecord = (id: string, updates: Partial<PayrollRecord>) => {
    setPayrollRecords((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    showToast('Payroll record updated.', 'success');
  };

  // SALARY PAYMENT SCHEDULE OPERATIONS (Salary Calendar)
  const addPayrollSchedule = (
    scheduleInput:
      | Omit<PayrollPaymentSchedule, 'id' | 'createdAt' | 'updatedAt' | 'auditHistory'>
      | Array<Omit<PayrollPaymentSchedule, 'id' | 'createdAt' | 'updatedAt' | 'auditHistory'>>
  ) => {
    const list = Array.isArray(scheduleInput) ? scheduleInput : [scheduleInput];
    const nowIso = new Date().toISOString();
    const createdItems: PayrollPaymentSchedule[] = list.map((item) => {
      const amountPaise = item.amountPaise ?? Math.round((item.amount || 0) * 100);
      const exactAmount = amountPaise / 100;
      const monthStr = item.payrollMonth || item.scheduledPaymentDate.substring(0, 7);
      let periodStart = item.payrollPeriodStart;
      let periodEnd = item.payrollPeriodEnd;
      if (!periodStart && /^\d{4}-\d{2}$/.test(monthStr)) {
        const [yr, mo] = monthStr.split('-').map(Number);
        const lastDay = new Date(yr, mo, 0).getDate();
        periodStart = `${monthStr}-01`;
        periodEnd = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
      }
      return {
        ...item,
        id: `sched-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        payrollMonth: monthStr,
        payrollPeriodStart: periodStart,
        payrollPeriodEnd: periodEnd,
        amount: exactAmount,
        amountPaise,
        currency: item.currency || 'INR',
        status: item.status || 'scheduled',
        createdAt: nowIso,
        updatedAt: nowIso,
        auditHistory: [
          {
            timestamp: nowIso,
            action: 'created',
            actor: 'HR Administrator',
            details: `Scheduled payment of ₹${exactAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for ${monthStr} on ${item.scheduledPaymentDate}`,
          },
        ],
      };
    });

    setPayrollSchedules((prev) => {
      // Filter out duplicate schedules for the same employee on the same date
      const newKeys = new Set(createdItems.map((c) => `${c.employeeId}-${c.scheduledPaymentDate}`));
      const kept = prev.filter((p) => !newKeys.has(`${p.employeeId}-${p.scheduledPaymentDate}`));
      return [...kept, ...createdItems];
    });

    createdItems.forEach((c) => {
      addNotification({
        title: 'Salary Payment Scheduled',
        message: `Salary payment for ${c.employeeName} (${c.employeeCode}) scheduled for ${c.scheduledPaymentDate}.`,
        type: 'payroll',
        recipientEmployeeId: c.employeeId,
      });
      logActivity(
        'scheduled salary payment for',
        `${c.employeeName} on ${c.scheduledPaymentDate}`,
        'payroll',
        '#206DA6'
      );
    });

    showToast('Salary payment scheduled successfully!', 'success');
  };

  const clearDemoPayrollRecords = () => {
    setPayrollRecords((prev) => prev.filter((p) => !(p.status === 'draft' && p.baseSalary === 6500)));
    showToast('Demo payroll records cleared successfully.', 'info');
  };

  const updatePayrollSchedule = (id: string, updates: Partial<PayrollPaymentSchedule>) => {
    const nowIso = new Date().toISOString();
    let updatedEmployee = '';
    setPayrollSchedules((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        updatedEmployee = item.employeeName;
        const newAudit = [
          ...(item.auditHistory || []),
          {
            timestamp: nowIso,
            action: 'updated',
            actor: 'HR Administrator',
            details: `Updated schedule: ${Object.keys(updates).join(', ')}`,
          },
        ];
        return {
          ...item,
          ...updates,
          updatedAt: nowIso,
          auditHistory: newAudit,
        };
      })
    );

    logActivity('updated salary schedule for', updatedEmployee || 'Employee', 'payroll', '#206DA6');
    showToast('Salary payment schedule updated successfully.', 'success');
  };

  const recordSchedulePayment = (id: string, paymentMethod?: PaymentMethod, notes?: string) => {
    const nowIso = new Date().toISOString();
    const formattedPaidDate = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date());

    setPayrollSchedules((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newAudit = [
          ...(item.auditHistory || []),
          {
            timestamp: nowIso,
            action: 'payment_recorded',
            actor: 'HR Administrator',
            details: `Confirmed disbursement via ${paymentMethod || item.paymentMethod}. ${notes || ''}`,
          },
        ];
        return {
          ...item,
          status: 'paid',
          paidDate: formattedPaidDate,
          paymentMethod: paymentMethod || item.paymentMethod,
          notes: notes ? `${item.notes ? item.notes + ' | ' : ''}${notes}` : item.notes,
          updatedAt: nowIso,
          auditHistory: newAudit,
        };
      })
    );

    // Sync corresponding payroll voucher if exists
    const schedule = payrollSchedules.find((s) => s.id === id);
    if (schedule) {
      setPayrollRecords((prev) =>
        prev.map((rec) => {
          if (rec.employeeId === schedule.employeeId && rec.month === schedule.payrollMonth) {
            return {
              ...rec,
              status: 'paid',
              paymentDate: schedule.scheduledPaymentDate,
            };
          }
          return rec;
        })
      );

      addNotification({
        title: 'Salary Payment Confirmed',
        message: `Salary disbursement of ₹${schedule.amount.toLocaleString()} has been confirmed as PAID for ${schedule.employeeName}.`,
        type: 'payroll',
        recipientEmployeeId: schedule.employeeId,
      });

      logActivity(
        'confirmed salary payment for',
        `${schedule.employeeName} (₹${schedule.amount.toLocaleString()})`,
        'payroll',
        '#10B981'
      );

      showToast(`Payment recorded as PAID for ${schedule.employeeName}.`, 'success');
    }
  };

  const deletePayrollSchedule = (id: string) => {
    setPayrollSchedules((prev) => prev.filter((s) => s.id !== id));
    showToast('Salary schedule removed.', 'info');
  };

  // SETTINGS & NOTIFICATIONS
  const updateSettings = (newSettings: Partial<HRSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    logActivity('updated HR company settings', 'Company Policy & Fiscal Profile', 'settings');
    showToast('HR settings saved successfully.', 'success');
  };

  const addNotification = useCallback(
    (
      notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'> & { timestamp?: string; read?: boolean }
    ): NotificationItem => {
      const newNotif: NotificationItem = {
        ...notif,
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: notif.timestamp || 'Just now',
        read: notif.read ?? false,
      };
      setNotifications((prev) => [newNotif, ...prev]);
      return newNotif;
    },
    []
  );

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast('All notifications marked as read.', 'info');
  };

  const resetToDefaultData = () => {
    setEmployees(INITIAL_EMPLOYEES);
    setDepartments(INITIAL_DEPARTMENTS);
    setAttendanceRecords(INITIAL_TODAY_ATTENDANCE);
    setLeaveRequests(INITIAL_LEAVE_REQUESTS);
    setShiftTemplates(INITIAL_SHIFTS);
    setPayrollRecords(INITIAL_PAYROLL);
    setPayrollSchedules(INITIAL_PAYROLL_SCHEDULES);
    setActivityLogs(INITIAL_ACTIVITY_LOGS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setSettings(INITIAL_SETTINGS);
    setSelectedDepartment('all');
    setSelectedDate('2026-10-15');
    // Clear only HRMS-specific storage keys to preserve Velmora auth session and navigation
    Object.values(LOCAL_STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('hrms_current_user_v4');
    localStorage.removeItem('hrms_assigned_works_v1');
    localStorage.removeItem('hrms_welfare_products_v1');
    localStorage.removeItem('hrms_welfare_requests_v1');
    showToast('Database reset to fresh enterprise sample data.', 'info', 'System Reset');
  };

  // COMPUTED DASHBOARD METRICS (dynamically filtered by department)
  const dashboardMetrics = useMemo(() => {
    // Filter employees by department if one is selected
    const filteredEmployees = selectedDepartment === 'all'
      ? employees
      : employees.filter((e) => e.departmentId === selectedDepartment);

    const empIdSet = new Set(filteredEmployees.map((e) => e.id));

    // Attendance for the selected date
    const dateAttendance = attendanceRecords.filter(
      (a) => a.date === selectedDate && empIdSet.has(a.employeeId)
    );

    const totalEmployees = filteredEmployees.length;
    const activeEmployees = filteredEmployees.filter((e) => e.status === 'active' || e.status === 'probation').length;

    const evaluatedStatuses = filteredEmployees.map((emp) => {
      const realRecord = attendanceRecords.find((a) => a.employeeId === emp.id && a.date === selectedDate);
      const shift = resolveEmployeeShift(emp, shiftTemplates);
      return evaluateEmployeeAttendanceStatus({
        employee: emp,
        dateStr: selectedDate,
        record: realRecord,
        shift,
        leaveRequests,
      });
    });

    const presentToday = evaluatedStatuses.filter((s) => isEmployeePresentOutcome(s.status)).length;
    const lateArrivals = evaluatedStatuses.filter((s) => s.isLate || s.status === 'late').length;
    const absentToday = evaluatedStatuses.filter((s) => s.status === 'absent').length;
    const onLeaveToday = evaluatedStatuses.filter((s) => s.status === 'on_leave').length;
    const pendingToday = evaluatedStatuses.filter((s) => s.status === 'pending').length;
    const notMarkedToday = evaluatedStatuses.filter((s) => s.status === 'not_marked').length;

    const totalDepartments = selectedDepartment === 'all'
      ? departments.length
      : (departments.some((d) => d.id === selectedDepartment) ? 1 : 0);

    const pendingLeaves = leaveRequests.filter(
      (l) => l.status === 'pending' && (selectedDepartment === 'all' || l.departmentId === selectedDepartment)
    ).length;

    // Employees working today = present
    const workingToday = presentToday;

    // Monthly payroll total for current month
    const currentMonth = selectedDate.substring(0, 7); // "2026-10"
    const monthlyPayrollTotal = payrollRecords
      .filter((p) => p.month === currentMonth && empIdSet.has(p.employeeId))
      .reduce((sum, p) => sum + p.netSalary, 0);

    return {
      totalEmployees,
      activeEmployees,
      presentToday,
      absentToday,
      onLeaveToday,
      lateArrivals,
      totalDepartments,
      pendingLeaves,
      workingToday,
      monthlyPayrollTotal,
      notMarkedToday,
    };
  }, [employees, departments, attendanceRecords, leaveRequests, payrollRecords, selectedDepartment, selectedDate]);

  return (
    <HRMSContext.Provider
      value={{
        employees,
        departments,
        attendanceRecords,
        leaveRequests,
        shiftTemplates,
        payrollRecords,
        payrollSchedules,
        activityLogs,
        notifications,
        settings,
        designations,
        addDesignation,

        selectedDepartment,
        setSelectedDepartment,
        selectedDate,
        setSelectedDate,

        addEmployee,
        updateEmployee,
        deleteEmployee,
        getEmployeeById,

        addDepartment,
        updateDepartment,
        deleteDepartment,

        checkIn,
        checkOut,
        saveAttendanceRecord,
        removeAttendanceOverride,

        applyLeave,
        approveLeave,
        rejectLeave,

        assignShift,
        addShiftTemplate,

        generatePayrollBatch,
        markPayrollPaid,
        updatePayrollRecord,
        addPayrollSchedule,
        updatePayrollSchedule,
        recordSchedulePayment,
        deletePayrollSchedule,
        clearDemoPayrollRecords,

        updateSettings,
        addNotification,
        markNotificationRead,
        markAllNotificationsRead,
        resetToDefaultData,

        dashboardMetrics,
      }}
    >
      {children}
    </HRMSContext.Provider>
  );
};

export const useHRMS = () => {
  const context = useContext(HRMSContext);
  if (!context) {
    throw new Error('useHRMS must be used within an HRMSProvider');
  }
  return context;
};
