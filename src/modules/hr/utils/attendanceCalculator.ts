import { AttendanceRecord, AttendanceStatus, Employee, LeaveRequest, ShiftTemplate } from '../types/hrms';
import { DEFAULT_SHIFTS } from '../data/designationsData';

/**
 * Standard Shift Timing Definitions
 * Morning: 09:00 AM – 05:00 PM (Cutoff: 06:00 PM / 18:00)
 * Afternoon: 01:00 PM – 09:00 PM (Cutoff: 10:00 PM / 22:00)
 * Evening: 03:00 PM – 11:00 PM (Cutoff: 12:00 AM / 24:00)
 * Grace period: 10 minutes from scheduled start
 */
export const SHIFT_SCHEDULES: Record<
  string,
  { name: string; startTime: string; endTime: string; graceMinutes: number; cutoffHour: number; cutoffMinutes: number }
> = {
  'shift-morning': {
    name: 'Morning Shift',
    startTime: '09:00',
    endTime: '17:00',
    graceMinutes: 10,
    cutoffHour: 18,
    cutoffMinutes: 0,
  },
  'shift-afternoon': {
    name: 'Afternoon Shift',
    startTime: '13:00',
    endTime: '21:00',
    graceMinutes: 10,
    cutoffHour: 22,
    cutoffMinutes: 0,
  },
  'shift-evening': {
    name: 'Evening Shift',
    startTime: '15:00',
    endTime: '23:00',
    graceMinutes: 10,
    cutoffHour: 24,
    cutoffMinutes: 0,
  },
};

/**
 * Company Timezone (default Asia/Kolkata) Date Formatter
 * Returns current calendar date as YYYY-MM-DD
 */
export function getCompanyTodayDate(timeZone: string = 'Asia/Kolkata'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
}

/**
 * Converts any time string ("09:00", "09:00:00", "09:00 AM", "1:30 PM", "13:30") into total minutes from midnight.
 */
export function timeStringToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim();
  const ampmMatch = clean.match(/(am|pm)/i);

  if (ampmMatch) {
    const isPm = ampmMatch[1].toLowerCase() === 'pm';
    const parts = clean.replace(/(am|pm)/i, '').trim().split(':');
    let hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  const parts = clean.split(':').map((p) => parseInt(p, 10) || 0);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Converts minutes from midnight into 24-hour "HH:mm" format.
 */
export function minutesToTimeString24(totalMinutes: number): string {
  const norm = Math.max(0, totalMinutes % 1440);
  const hours = Math.floor(norm / 60);
  const minutes = norm % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Formats time string into standard 12-hour AM/PM format (e.g., "09:00 AM", "05:00 PM").
 */
export function formatTime12Hour(timeStr?: string): string {
  if (!timeStr || timeStr === '--:--' || timeStr === '--') return '--:--';
  const clean = timeStr.trim();
  if (clean.includes('AM') || clean.includes('PM') || clean.includes('am') || clean.includes('pm')) {
    return clean.toUpperCase();
  }
  const parts = clean.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 0 || isNaN(parts[0])) return '--:--';
  const hours = parts[0];
  const minutes = isNaN(parts[1]) ? 0 : parts[1];
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Resolves an employee's shift template from list or default shifts.
 */
export function resolveEmployeeShift(
  employee: Partial<Employee>,
  shiftTemplates: ShiftTemplate[] = DEFAULT_SHIFTS
): ShiftTemplate {
  if (employee.shiftId) {
    const found = shiftTemplates.find((s) => s.id === employee.shiftId);
    if (found) return found;
  }
  if (employee.shiftName) {
    const found = shiftTemplates.find(
      (s) => s.name.toLowerCase() === employee.shiftName?.toLowerCase()
    );
    if (found) return found;
  }
  // Default to morning shift
  return (
    shiftTemplates.find((s) => s.id === 'shift-morning') ||
    DEFAULT_SHIFTS[0] || {
      id: 'shift-morning',
      name: 'Morning Shift',
      startTime: '09:00',
      endTime: '17:00',
      color: '#0284C7',
      workHours: 8,
      description: 'Morning Shift (09:00 AM – 05:00 PM)',
    }
  );
}

/**
 * Formats a shift into "09:00 AM – 05:00 PM"
 */
export function formatScheduledTimeRange(shift: ShiftTemplate): string {
  return `${formatTime12Hour(shift.startTime)} – ${formatTime12Hour(shift.endTime)}`;
}

/**
 * Work Hours & Unpaid Break Calculator:
 * If worked hours >= 5 hours (300 minutes), automatically deduct 30 minutes for lunch/unpaid break.
 */
export function calculateWorkHoursDetails(
  checkInTime?: string,
  checkOutTime?: string
): {
  elapsedMinutes: number;
  breakDeductionMinutes: number;
  netWorkMinutes: number;
  decimalHours: number;
  formattedHours: string;
} {
  if (!checkInTime || !checkOutTime) {
    return {
      elapsedMinutes: 0,
      breakDeductionMinutes: 0,
      netWorkMinutes: 0,
      decimalHours: 0,
      formattedHours: '--',
    };
  }

  const inMins = timeStringToMinutes(checkInTime);
  let outMins = timeStringToMinutes(checkOutTime);

  // Handle overnight shift crossing midnight
  if (outMins < inMins) {
    outMins += 1440;
  }

  const elapsedMinutes = Math.max(0, outMins - inMins);
  // Break deduction: 30 minutes if worked 5 hours or more (300 minutes)
  const breakDeductionMinutes = elapsedMinutes >= 300 ? 30 : 0;
  const netWorkMinutes = Math.max(0, elapsedMinutes - breakDeductionMinutes);
  const decimalHours = Number((netWorkMinutes / 60).toFixed(1));

  const hours = Math.floor(netWorkMinutes / 60);
  const minutes = netWorkMinutes % 60;
  const formattedHours = `${hours}h ${minutes}m`;

  return {
    elapsedMinutes,
    breakDeductionMinutes,
    netWorkMinutes,
    decimalHours,
    formattedHours,
  };
}

/**
 * Punctuality evaluator:
 * Start time + 10 minute grace period.
 * Late if checkIn > startTime + 10 mins.
 */
export function evaluatePunctuality(
  checkInTime: string,
  shiftStartTime: string,
  graceMinutes: number = 10
): {
  isLate: boolean;
  lateMinutes: number;
  graceLimitMinutes: number;
} {
  const inMins = timeStringToMinutes(checkInTime);
  const startMins = timeStringToMinutes(shiftStartTime);
  const graceLimitMinutes = startMins + graceMinutes;

  if (inMins > graceLimitMinutes) {
    return {
      isLate: true,
      lateMinutes: inMins - startMins,
      graceLimitMinutes,
    };
  }

  return {
    isLate: false,
    lateMinutes: 0,
    graceLimitMinutes,
  };
}

/**
 * Overtime and Early Exit evaluator:
 */
export function evaluateExitPunctuality(
  checkOutTime: string,
  shiftEndTime: string
): {
  isEarlyExit: boolean;
  earlyExitMinutes: number;
  isOvertime: boolean;
  overtimeMinutes: number;
} {
  const outMins = timeStringToMinutes(checkOutTime);
  const endMins = timeStringToMinutes(shiftEndTime);

  const isEarlyExit = outMins < endMins;
  const earlyExitMinutes = isEarlyExit ? endMins - outMins : 0;

  // Overtime applies when working past shift end by at least 30 minutes
  const isOvertime = outMins >= endMins + 30;
  const overtimeMinutes = isOvertime ? outMins - endMins : 0;

  return {
    isEarlyExit,
    earlyExitMinutes,
    isOvertime,
    overtimeMinutes,
  };
}

/**
 * Check if the given date is Sunday (Weekly Off)
 */
export function isWeeklyOffDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return false;
  // Note: Date months are 0-indexed in JS Date
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.getDay() === 0; // Sunday
}

/**
 * Check if employee has an approved leave on this date
 */
export function findApprovedLeave(
  employeeId: string,
  dateStr: string,
  leaveRequests: LeaveRequest[]
): LeaveRequest | undefined {
  return leaveRequests.find(
    (l) =>
      l.employeeId === employeeId &&
      l.status === 'approved' &&
      dateStr >= l.startDate &&
      dateStr <= l.endDate
  );
}

export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'not_marked':
      return 'Not Marked';
    case 'present':
      return 'Present';
    case 'absent':
      return 'Absent';
    case 'late':
      return 'Late';
    case 'half_day':
      return 'Half-Day';
    case 'on_leave':
      return 'On Leave';
    case 'permission':
      return 'Permission';
    case 'wfh':
      return 'Work From Home';
    case 'weekly_off':
      return 'Weekly Off';
    case 'holiday':
      return 'Holiday';
    case 'missing_punch':
      return 'Missing Punch';
    case 'pending':
      return 'Pending';
    case 'checked_in':
      return 'Checked In';
    case 'missing_checkout':
      return 'Missing Punch';
    default:
      return status;
  }
}

/**
 * Checks whether an attendance status counts as present or active working day
 */
export function isEmployeePresentOutcome(status: AttendanceStatus): boolean {
  return (
    status === 'present' ||
    status === 'checked_in' ||
    status === 'late' ||
    status === 'wfh' ||
    status === 'half_day' ||
    status === 'permission'
  );
}

/**
 * Dynamic Shift Status Determination:
 * Evaluates whether an employee is pending, present, late, half-day, absent, on-leave, or weekly-off.
 * If an authorized manual override exists, it respects and preserves the manual status.
 */
export function evaluateEmployeeAttendanceStatus(params: {
  employee: Employee;
  dateStr: string;
  record?: AttendanceRecord;
  shift: ShiftTemplate;
  leaveRequests: LeaveRequest[];
  systemNow?: Date;
}): {
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  notes: string;
  isVirtualRecord: boolean;
  workHoursFormatted: string;
} {
  const { employee, dateStr, record, shift, leaveRequests, systemNow = new Date() } = params;

  // 0. Manual Status Priority: If HR/Admin has manually recorded or overridden this status
  if (record && (record.isManualOverride || record.isManualEntry)) {
    let hoursFormatted = record.workHoursFormatted || '--';
    if (
      record.checkInTime &&
      record.checkOutTime &&
      (!record.workHoursFormatted || record.workHoursFormatted === '--')
    ) {
      hoursFormatted = calculateWorkHoursDetails(record.checkInTime, record.checkOutTime).formattedHours;
    } else if (record.workHours && record.workHours > 0 && hoursFormatted === '--') {
      hoursFormatted = `${record.workHours}h`;
    }

    const punctuality = record.checkInTime
      ? evaluatePunctuality(record.checkInTime, shift.startTime, 10)
      : { isLate: record.status === 'late', lateMinutes: record.lateMinutes || 0 };

    return {
      status: record.status,
      isLate: record.status === 'late' || punctuality.isLate,
      lateMinutes: record.lateMinutes || punctuality.lateMinutes || 0,
      notes: record.notes || record.manualReason || 'Manual adjustment',
      isVirtualRecord: false,
      workHoursFormatted: hoursFormatted,
    };
  }

  // 1. Check if employee joined after the selected date
  if (employee.joiningDate && dateStr < employee.joiningDate) {
    return {
      status: 'pending',
      isLate: false,
      lateMinutes: 0,
      notes: 'Not yet joined on this date',
      isVirtualRecord: !record,
      workHoursFormatted: '--',
    };
  }

  // 2. Check if on approved leave
  const approvedLeave = findApprovedLeave(employee.id, dateStr, leaveRequests);
  if (approvedLeave) {
    return {
      status: 'on_leave',
      isLate: false,
      lateMinutes: 0,
      notes: `Approved ${approvedLeave.leaveType} leave`,
      isVirtualRecord: !record,
      workHoursFormatted: '--',
    };
  }

  // 3. Check weekly off (Sunday)
  if (isWeeklyOffDate(dateStr)) {
    return {
      status: 'weekly_off',
      isLate: false,
      lateMinutes: 0,
      notes: 'Scheduled Weekly Off',
      isVirtualRecord: !record,
      workHoursFormatted: '--',
    };
  }

  // 4. If actual attendance record exists with check-in
  if (record && record.checkInTime) {
    const punctuality = evaluatePunctuality(record.checkInTime, shift.startTime, 10);

    // If both check-in and check-out exist
    if (record.checkOutTime) {
      const hoursCalc = calculateWorkHoursDetails(record.checkInTime, record.checkOutTime);

      // Check for half-day (< 4 hours)
      if (hoursCalc.decimalHours < 4) {
        return {
          status: 'half_day',
          isLate: punctuality.isLate,
          lateMinutes: punctuality.lateMinutes,
          notes: record.notes || `Half day (${hoursCalc.formattedHours})`,
          isVirtualRecord: false,
          workHoursFormatted: hoursCalc.formattedHours,
        };
      }

      // Check if late
      if (punctuality.isLate) {
        return {
          status: 'late',
          isLate: true,
          lateMinutes: punctuality.lateMinutes,
          notes: record.notes || `Late arrival (+${punctuality.lateMinutes}m)`,
          isVirtualRecord: false,
          workHoursFormatted: hoursCalc.formattedHours,
        };
      }

      return {
        status: 'present',
        isLate: false,
        lateMinutes: 0,
        notes: record.notes || 'On-time completed shift',
        isVirtualRecord: false,
        workHoursFormatted: hoursCalc.formattedHours,
      };
    }

    // Checked in, but no checkout yet
    return {
      status: 'checked_in',
      isLate: punctuality.isLate,
      lateMinutes: punctuality.lateMinutes,
      notes: record.notes || (punctuality.isLate ? `Checked in late (+${punctuality.lateMinutes}m)` : 'Checked in (Shift in progress)'),
      isVirtualRecord: false,
      workHoursFormatted: '--',
    };
  }

  // 5. If record has an explicit status (manual or saved)
  if (record && record.status) {
    if (record.status === 'not_marked') {
      return {
        status: 'not_marked',
        isLate: false,
        lateMinutes: 0,
        notes: record.notes || 'Not Marked',
        isVirtualRecord: false,
        workHoursFormatted: '--',
      };
    }

    if (record.status !== 'pending') {
      return {
        status: record.status,
        isLate: record.status === 'late',
        lateMinutes: record.lateMinutes || 0,
        notes: record.notes || 'Saved attendance record',
        isVirtualRecord: false,
        workHoursFormatted: record.workHours ? `${record.workHours}h` : record.workHoursFormatted || '--',
      };
    }
  }

  // 6. Default State for new day or date without saved attendance:
  // Show 'not_marked'. Never automatically mark employees Absent or Present without saved record or punch.
  return {
    status: 'not_marked',
    isLate: false,
    lateMinutes: 0,
    notes: 'Not Marked',
    isVirtualRecord: !record,
    workHoursFormatted: '--',
  };
}
