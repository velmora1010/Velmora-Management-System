import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import { AttendanceStatus, AttendanceRecord } from '../../types/hrms';
import {
  resolveEmployeeShift,
  formatTime12Hour,
  calculateWorkHoursDetails,
  evaluatePunctuality,
  formatScheduledTimeRange,
} from '../../utils/attendanceCalculator';
import {
  Shield,
  Clock,
  Search,
  Layers,
  Briefcase,
  User,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordToEdit?: AttendanceRecord | null;
  initialStatus?: AttendanceStatus | null;
}

const ATTENDANCE_STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  description: string;
  color: string;
}> = [
  { value: 'present', label: 'Present', description: 'Attended scheduled shift hours', color: '#10B981' },
  { value: 'absent', label: 'Absent', description: 'Did not attend scheduled shift', color: '#EF4444' },
  { value: 'late', label: 'Late', description: 'Arrived after shift grace period', color: '#F59E0B' },
  { value: 'half_day', label: 'Half-Day', description: 'Worked half of scheduled duration', color: '#EAB308' },
  { value: 'on_leave', label: 'On Leave', description: 'Authorized company leave', color: '#A855F7' },
  { value: 'permission', label: 'Permission', description: 'Short authorized absence / permission', color: '#3B82F6' },
  { value: 'wfh', label: 'Work From Home (WFH)', description: 'Working remotely from home / offsite', color: '#14B8A6' },
  { value: 'weekly_off', label: 'Weekly Off', description: 'Scheduled non-working day', color: '#64748B' },
  { value: 'holiday', label: 'Holiday', description: 'Official company or gazetted holiday', color: '#6366F1' },
  { value: 'missing_punch', label: 'Missing Punch', description: 'Punch correction for forgot in/out', color: '#F97316' },
  { value: 'pending', label: 'Pending', description: 'Awaiting timesheet regularisation', color: '#0EA5E9' },
];

const ABSENCE_REASONS = [
  'Unplanned absence / No call',
  'Personal emergency / Family reason',
  'Health / Medical issue without prior leave',
  'Transportation / Commute problem',
  'Unauthorized absence',
  'Other personal reason',
];

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
  isOpen,
  onClose,
  recordToEdit,
  initialStatus,
}) => {
  const {
    employees,
    shiftTemplates,
    leaveRequests,
    selectedDate,
    saveAttendanceRecord,
    removeAttendanceOverride,
  } = useHRMS();
  const { currentUser } = useAuth();

  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [date, setDate] = useState(selectedDate);
  const [status, setStatus] = useState<AttendanceStatus>(initialStatus || 'present');

  // Times
  const [checkInTime, setCheckInTime] = useState('09:00');
  const [checkOutTime, setCheckOutTime] = useState('17:00');
  const [workHours, setWorkHours] = useState<number>(8);

  // Status-specific conditional fields
  const [absenceReason, setAbsenceReason] = useState(ABSENCE_REASONS[0]);
  const [halfDayType, setHalfDayType] = useState<'first_half' | 'second_half'>('first_half');
  const [permissionStart, setPermissionStart] = useState('09:00');
  const [permissionEnd, setPermissionEnd] = useState('11:00');
  const [permissionReason, setPermissionReason] = useState('Doctor appointment');
  const [leaveReference, setLeaveReference] = useState('Casual Leave');
  const [holidayReference, setHolidayReference] = useState('Public / Gazetted Holiday');
  const [scheduleReference, setScheduleReference] = useState('Weekly Rest Day');
  const [missingPunchType, setMissingPunchType] = useState<'in' | 'out' | 'both'>('out');
  const [missingPunchReason, setMissingPunchReason] = useState('Forgot to clock out');
  const [pendingReason, setPendingReason] = useState('Awaiting employee regularisation request');
  const [workLocation, setWorkLocation] = useState('Remote (Home)');

  // General audit
  const [manualReason, setManualReason] = useState('');
  const [notes, setNotes] = useState('');
  const [hasError, setHasError] = useState(false);

  // Selected employee & their assigned shift
  const selectedEmp = useMemo(
    () => employees.find((e) => e.id === employeeId) || employees[0],
    [employees, employeeId]
  );

  const assignedShift = useMemo(
    () => (selectedEmp ? resolveEmployeeShift(selectedEmp, shiftTemplates) : shiftTemplates[0]),
    [selectedEmp, shiftTemplates]
  );

  // Check matching approved leave for date
  const matchedApprovedLeave = useMemo(() => {
    if (!selectedEmp) return null;
    return leaveRequests.find(
      (l) =>
        l.employeeId === selectedEmp.id &&
        l.status === 'approved' &&
        date >= l.startDate &&
        date <= l.endDate
    );
  }, [leaveRequests, selectedEmp, date]);

  // Initialize or reset form
  useEffect(() => {
    if (recordToEdit) {
      setEmployeeId(recordToEdit.employeeId);
      setDate(recordToEdit.date);
      setStatus(initialStatus || recordToEdit.status || 'present');
      setCheckInTime(recordToEdit.checkInTime ? recordToEdit.checkInTime.slice(0, 5) : assignedShift?.startTime || '09:00');
      setCheckOutTime(recordToEdit.checkOutTime ? recordToEdit.checkOutTime.slice(0, 5) : assignedShift?.endTime || '17:00');
      setWorkHours(recordToEdit.workHours ?? 8);
      setManualReason(recordToEdit.manualReason || '');
      setNotes(recordToEdit.notes || '');
      if (recordToEdit.halfDayType) setHalfDayType(recordToEdit.halfDayType);
      if (recordToEdit.permissionStartTime) setPermissionStart(recordToEdit.permissionStartTime);
      if (recordToEdit.permissionEndTime) setPermissionEnd(recordToEdit.permissionEndTime);
      if (recordToEdit.permissionReason) setPermissionReason(recordToEdit.permissionReason);
      if (recordToEdit.leaveReference) setLeaveReference(recordToEdit.leaveReference);
      if (recordToEdit.holidayReference) setHolidayReference(recordToEdit.holidayReference);
      if (recordToEdit.scheduleReference) setScheduleReference(recordToEdit.scheduleReference);
      if (recordToEdit.missingPunchType) setMissingPunchType(recordToEdit.missingPunchType);
    } else {
      if (employees.length > 0 && !employees.some((e) => e.id === employeeId)) {
        setEmployeeId(employees[0].id);
      }
      setDate(selectedDate);
      setStatus(initialStatus || 'present');
      if (assignedShift) {
        setCheckInTime(assignedShift.startTime);
        setCheckOutTime(assignedShift.endTime);
      }
      setWorkHours(8);
      setManualReason('');
      setNotes('');
    }
    setHasError(false);
  }, [recordToEdit, employees, selectedDate, isOpen, assignedShift, initialStatus]);

  // Dynamic calculations when times change
  const handleCheckInChange = (newVal: string) => {
    setCheckInTime(newVal);
    if (newVal && checkOutTime && requiresPunchTimes(status)) {
      const calc = calculateWorkHoursDetails(newVal, checkOutTime);
      setWorkHours(calc.decimalHours);
    }
  };

  const handleCheckOutChange = (newVal: string) => {
    setCheckOutTime(newVal);
    if (checkInTime && newVal && requiresPunchTimes(status)) {
      const calc = calculateWorkHoursDetails(checkInTime, newVal);
      setWorkHours(calc.decimalHours);
    }
  };

  // Late minutes calculation
  const lateCalculation = useMemo(() => {
    if (!assignedShift || !checkInTime) return { isLate: false, lateMinutes: 0 };
    return evaluatePunctuality(checkInTime, assignedShift.startTime, 10);
  }, [assignedShift, checkInTime]);

  // Permission duration calculation
  const permissionDuration = useMemo(() => {
    if (!permissionStart || !permissionEnd) return '';
    const details = calculateWorkHoursDetails(permissionStart, permissionEnd);
    return `${details.decimalHours} hrs (${details.formattedHours})`;
  }, [permissionStart, permissionEnd]);

  function requiresPunchTimes(st: AttendanceStatus): boolean {
    return st === 'present' || st === 'late' || st === 'half_day' || st === 'wfh' || st === 'missing_punch';
  }

  // Filtered employees for dropdown
  const filteredEmployees = employees.filter(
    (e) =>
      e.fullName.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      e.departmentName.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    const hasPunches = requiresPunchTimes(status);
    const effectiveIn = hasPunches ? checkInTime : undefined;
    const effectiveOut = hasPunches ? checkOutTime : undefined;

    let computedHours = 0;
    let computedHoursFormatted = '--';
    if (hasPunches && effectiveIn && effectiveOut) {
      const hoursCalc = calculateWorkHoursDetails(effectiveIn, effectiveOut);
      computedHours = workHours > 0 ? Number(workHours) : hoursCalc.decimalHours;
      computedHoursFormatted = hoursCalc.formattedHours;
    }

    // Build comprehensive note
    let specificNote = '';
    if (status === 'absent') specificNote = `Absence Reason: ${absenceReason}`;
    else if (status === 'late') specificNote = `Late Arrival (+${lateCalculation.lateMinutes} min)`;
    else if (status === 'half_day') specificNote = `Half-Day (${halfDayType === 'first_half' ? '1st Half' : '2nd Half'})`;
    else if (status === 'on_leave') specificNote = `Leave Ref: ${matchedApprovedLeave ? `Approved ${matchedApprovedLeave.leaveType}` : leaveReference}`;
    else if (status === 'permission') specificNote = `Permission: ${formatTime12Hour(permissionStart)} – ${formatTime12Hour(permissionEnd)} (${permissionReason})`;
    else if (status === 'wfh') specificNote = `Work Location: ${workLocation}`;
    else if (status === 'weekly_off') specificNote = `Schedule Ref: ${scheduleReference}`;
    else if (status === 'holiday') specificNote = `Holiday Ref: ${holidayReference}`;
    else if (status === 'missing_punch') specificNote = `Missing Punch (${missingPunchType}): ${missingPunchReason}`;
    else if (status === 'pending') specificNote = `Pending Reason: ${pendingReason}`;

    const combinedNotes = [specificNote, notes.trim()].filter(Boolean).join(' | ');

    saveAttendanceRecord({
      employeeId: selectedEmp.id,
      date,
      status,
      checkInTime: effectiveIn,
      checkOutTime: effectiveOut,
      workHours: computedHours,
      workHoursFormatted: computedHoursFormatted,
      lateMinutes: lateCalculation.isLate ? lateCalculation.lateMinutes : 0,
      notes: combinedNotes,
      manualReason: manualReason.trim() || 'Manual status update',
      enteredBy: currentUser?.name || 'Administrator',
      halfDayType: status === 'half_day' ? halfDayType : undefined,
      permissionStartTime: status === 'permission' ? permissionStart : undefined,
      permissionEndTime: status === 'permission' ? permissionEnd : undefined,
      permissionReason: status === 'permission' ? permissionReason : undefined,
      leaveReference: status === 'on_leave' ? (matchedApprovedLeave ? `Approved ${matchedApprovedLeave.leaveType}` : leaveReference) : undefined,
      holidayReference: status === 'holiday' ? holidayReference : undefined,
      scheduleReference: status === 'weekly_off' ? scheduleReference : undefined,
      missingPunchType: status === 'missing_punch' ? missingPunchType : undefined,
      location: status === 'wfh' ? workLocation : undefined,
    });

    onClose();
  };

  const handleRevertToAuto = () => {
    if (!selectedEmp) return;
    if (window.confirm(`Are you sure you want to remove the manual override and revert ${selectedEmp.fullName}'s attendance for ${date} to automatic shift calculation?`)) {
      removeAttendanceOverride(selectedEmp.id, date);
      onClose();
    }
  };

  const selectedStatusConfig = ATTENDANCE_STATUS_OPTIONS.find((s) => s.value === status);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manual Attendance Entry"
      subtitle="Record or update employee attendance manually."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Existing Override Notice Banner */}
        {recordToEdit?.isManualOverride && (
          <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-800">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div>
                <span className="font-bold">Manual Override Active</span>
                <p className="text-[11px] text-amber-700">
                  Previously set by <span className="font-semibold">{recordToEdit.enteredBy || 'Administrator'}</span>: &ldquo;{recordToEdit.manualReason || 'Manual adjustment'}&rdquo;
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRevertToAuto}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100/80 shadow-xs transition-colors cursor-pointer flex-shrink-0"
              title="Remove manual override and return to auto shift calculation"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Auto</span>
            </button>
          </div>
        )}

        {/* SECTION A — Employee Information */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <User className="w-3.5 h-3.5 text-[#206DA6]" />
            Section A — Employee Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Searchable Employee Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Employee Name *
              </label>
              {employees.length === 0 ? (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  No employees available.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {!recordToEdit && employees.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        placeholder="Search employee by name / code..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#206DA6]"
                      />
                    </div>
                  )}
                  <select
                    value={employeeId}
                    disabled={!!recordToEdit}
                    onChange={(e) => {
                      setEmployeeId(e.target.value);
                      const emp = employees.find((emp) => emp.id === e.target.value);
                      if (emp) {
                        const sh = resolveEmployeeShift(emp, shiftTemplates);
                        setCheckInTime(sh.startTime);
                        setCheckOutTime(sh.endTime);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] font-medium"
                  >
                    {filteredEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName} ({e.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Attendance Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Attendance Date *
              </label>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-xs font-mono font-medium focus:outline-hidden w-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Auto-displayed Read-Only Shift & Department Metadata Card */}
          {selectedEmp && assignedShift && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Department
                </span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 truncate">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  {selectedEmp.departmentName}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Assigned Shift
                </span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 truncate">
                  <Layers className="w-3.5 h-3.5 text-[#206DA6] flex-shrink-0" />
                  {assignedShift.name}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Scheduled Time
                </span>
                <span className="font-mono font-bold text-[#206DA6] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  {formatScheduledTimeRange(assignedShift)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION B — Attendance Status Selection */}
        <div className="space-y-3 pt-1">
          <h3 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#206DA6]" />
            Section B — Attendance Status
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Attendance Status *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] font-bold text-slate-800"
              >
                {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Status Hint Box */}
              <div
                className="px-3.5 py-2 rounded-xl border text-xs flex items-center justify-between"
                style={{
                  backgroundColor: `${selectedStatusConfig?.color || '#206DA6'}10`,
                  borderColor: `${selectedStatusConfig?.color || '#206DA6'}30`,
                  color: selectedStatusConfig?.color || '#206DA6',
                }}
              >
                <div>
                  <span className="font-bold block">{selectedStatusConfig?.label}</span>
                  <span className="text-[11px] opacity-80">{selectedStatusConfig?.description}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION C — Conditional Status-Specific Fields */}
        <div className="space-y-3 pt-1">
          {/* 1. Present, Late, Half-Day, WFH, Missing Punch: Show Check-In & Check-Out */}
          {requiresPunchTimes(status) && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Punches & Working Hours
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Actual Check-In Time
                  </label>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => handleCheckInChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Actual Check-Out Time
                  </label>
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => handleCheckOutChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Calculated Total Hours
                  </label>
                  <div className="px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 flex items-center justify-between">
                    <span>{workHours} hrs</span>
                    <span className="text-[10px] text-slate-500 font-normal">(-30m break if &ge; 5h)</span>
                  </div>
                </div>
              </div>

              {/* Late Arrival Punctuality Indicator */}
              {status === 'late' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-center justify-between">
                  <span className="font-semibold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Late Arrival Evaluation:
                  </span>
                  <span className="font-mono font-bold text-amber-700">
                    +{lateCalculation.lateMinutes} mins late (Grace: {formatTime12Hour(assignedShift?.startTime)} + 10m)
                  </span>
                </div>
              )}

              {/* Half-Day Type Selector */}
              {status === 'half_day' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Half-Day Session *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['first_half', 'second_half'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setHalfDayType(t)}
                        className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                          halfDayType === t
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {t === 'first_half' ? 'First Half (Morning Session)' : 'Second Half (Afternoon Session)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Punch Type and Reason */}
              {status === 'missing_punch' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Which Punch Was Missing? *
                    </label>
                    <select
                      value={missingPunchType}
                      onChange={(e) => setMissingPunchType(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden"
                    >
                      <option value="in">Missing Check-In Only</option>
                      <option value="out">Missing Check-Out Only</option>
                      <option value="both">Both Punches Missing</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Correction Reason *
                    </label>
                    <input
                      type="text"
                      value={missingPunchReason}
                      onChange={(e) => setMissingPunchReason(e.target.value)}
                      placeholder="e.g. Forgot punch card, device offline"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* WFH Location */}
              {status === 'wfh' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Remote Work Location
                  </label>
                  <input
                    type="text"
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    placeholder="e.g. Remote (Home), Client Site"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden"
                  />
                </div>
              )}
            </div>
          )}

          {/* 2. Absent Conditional Fields */}
          {status === 'absent' && (
            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2 text-xs">
              <label className="block font-semibold text-rose-900 uppercase tracking-wider">
                Absence Reason Category (Optional)
              </label>
              <select
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-rose-200 rounded-xl focus:outline-hidden text-slate-800"
              >
                {ABSENCE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-rose-600">
                Punches will remain empty (--:--) to reflect non-attendance.
              </p>
            </div>
          )}

          {/* 3. On Leave Conditional Fields */}
          {status === 'on_leave' && (
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2 text-xs">
              <label className="block font-semibold text-purple-900 uppercase tracking-wider">
                Approved Leave Reference
              </label>
              {matchedApprovedLeave ? (
                <div className="p-2.5 bg-white border border-purple-200 rounded-xl text-purple-800 flex items-center justify-between">
                  <span className="font-bold">
                    Found Approved Leave: {matchedApprovedLeave.leaveType.toUpperCase()}
                  </span>
                  <span className="text-[11px] font-mono">
                    {matchedApprovedLeave.startDate} to {matchedApprovedLeave.endDate}
                  </span>
                </div>
              ) : (
                <select
                  value={leaveReference}
                  onChange={(e) => setLeaveReference(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-purple-200 rounded-xl focus:outline-hidden text-slate-800"
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Annual / Earned Leave">Annual / Earned Leave</option>
                  <option value="Maternity / Paternity Leave">Maternity / Paternity Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              )}
              <p className="text-[11px] text-purple-600">
                Manual status updates reflect on the register without modifying employee leave balances.
              </p>
            </div>
          )}

          {/* 4. Permission Conditional Fields */}
          {status === 'permission' && (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 text-xs">
              <span className="font-semibold text-blue-900 uppercase tracking-wider block">
                Permission Details (Short Absence)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Permission Start</label>
                  <input
                    type="time"
                    value={permissionStart}
                    onChange={(e) => setPermissionStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Permission End</label>
                  <input
                    type="time"
                    value={permissionEnd}
                    onChange={(e) => setPermissionEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Duration</label>
                  <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-blue-800 font-bold">
                    {permissionDuration || '--'}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Permission Reason *</label>
                <input
                  type="text"
                  value={permissionReason}
                  onChange={(e) => setPermissionReason(e.target.value)}
                  placeholder="e.g. Bank work, Doctor visit, Emergency appointment"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* 5. Weekly Off / Holiday / Pending */}
          {status === 'weekly_off' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <label className="block font-semibold text-slate-700 uppercase">Schedule Reference</label>
              <input
                type="text"
                value={scheduleReference}
                onChange={(e) => setScheduleReference(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden"
              />
            </div>
          )}

          {status === 'holiday' && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-1.5">
              <label className="block font-semibold text-indigo-900 uppercase">Holiday Reference / Name *</label>
              <input
                type="text"
                value={holidayReference}
                onChange={(e) => setHolidayReference(e.target.value)}
                placeholder="e.g. Gandhi Jayanti, Diwali, Republic Day"
                className="w-full px-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-hidden"
              />
            </div>
          )}

          {status === 'pending' && (
            <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl text-xs space-y-1.5">
              <label className="block font-semibold text-sky-900 uppercase">Pending Reason *</label>
              <input
                type="text"
                value={pendingReason}
                onChange={(e) => setPendingReason(e.target.value)}
                placeholder="e.g. Awaiting employee regularisation or manager clearance"
                className="w-full px-3 py-2 text-xs bg-white border border-sky-200 rounded-xl focus:outline-hidden"
              />
            </div>
          )}
        </div>

        {/* SECTION D — Reason & Audit Trail */}
        <div className="space-y-3 pt-1">
          <h3 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <Shield className="w-3.5 h-3.5 text-[#206DA6]" />
            Section D — Audit Trail & Justification
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reason / Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="State any reason, justification, or administrative notes (optional)..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes or approval email references..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Entered By
              </span>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>{currentUser?.name || 'Administrator'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Entry Date &amp; Time
              </span>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-mono text-[11px]">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Audit History (if editing) */}
        {recordToEdit?.auditHistory && recordToEdit.auditHistory.length > 0 && (
          <div className="pt-2">
            <details className="text-xs group">
              <summary className="font-semibold text-slate-600 cursor-pointer hover:text-[#206DA6] flex items-center gap-1.5">
                <span>View Previous Corrections ({recordToEdit.auditHistory.length})</span>
              </summary>
              <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50">
                {recordToEdit.auditHistory.map((item) => (
                  <div key={item.id} className="text-[11px] p-1.5 bg-white rounded border border-slate-100">
                    <div className="flex justify-between text-slate-500 font-mono text-[10px]">
                      <span>{new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      <span className="font-bold text-slate-700">{item.enteredBy}</span>
                    </div>
                    <p className="text-slate-800 font-medium mt-0.5">
                      Status: <span className="font-bold uppercase text-[#206DA6]">{item.newStatus}</span> ({item.reason})
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Modal Footer Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedEmp || employees.length === 0}
            className={`px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer ${
              !selectedEmp || employees.length === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                : 'text-white bg-[#206DA6] hover:bg-[#1A5987] shadow-[#206DA6]/20'
            }`}
          >
            Save Attendance
          </button>
        </div>
      </form>
    </Modal>
  );
};
