import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import { findLinkedEmployee } from '../../utils/employeeIdentity';
import { Avatar } from '../common/Avatar';
import {
  Clock,
  MapPin,
  CheckCircle,
  LogOut,
  Layers,
  AlertTriangle,
  ShieldCheck,
  Bell,
  Lock,
} from 'lucide-react';
import {
  resolveEmployeeShift,
  formatScheduledTimeRange,
  formatTime12Hour,
  evaluatePunctuality,
  getCompanyTodayDate,
} from '../../utils/attendanceCalculator';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({ isOpen, onClose }) => {
  const { employees, shiftTemplates, attendanceRecords, selectedDate, checkIn, checkOut } = useHRMS();
  const { currentUser, canManageEmployees } = useAuth();

  const ownEmployee = useMemo(
    () => findLinkedEmployee(currentUser, employees),
    [currentUser, employees]
  );

  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    ownEmployee?.id || currentUser.employeeId || employees[0]?.id || ''
  );
  const [location, setLocation] = useState<'On-site (HQ)' | 'Remote (Home)' | 'Client Site'>('On-site (HQ)');
  const [notes, setNotes] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!canManageEmployees) {
      // Lock employee self-service users strictly to their own linked profile
      setSelectedEmpId(ownEmployee?.id || '');
      return;
    }
    if (ownEmployee?.id && (!selectedEmpId || !employees.some((e) => e.id === selectedEmpId))) {
      setSelectedEmpId(ownEmployee.id);
    } else if (employees.length > 0 && (!selectedEmpId || !employees.some((e) => e.id === selectedEmpId))) {
      setSelectedEmpId(employees[0].id);
    }
  }, [canManageEmployees, ownEmployee, employees, selectedEmpId]);

  // Digital clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const employee = useMemo(() => {
    if (!canManageEmployees) {
      return ownEmployee;
    }
    return employees.find(
      (e) =>
        e.id === selectedEmpId ||
        e.employeeCode?.trim().toUpperCase() === selectedEmpId?.trim().toUpperCase()
    );
  }, [canManageEmployees, ownEmployee, employees, selectedEmpId]);

  const shift = employee ? resolveEmployeeShift(employee, shiftTemplates) : shiftTemplates[0];

  const currentRecord = useMemo(() => {
    if (!employee) return undefined;
    return attendanceRecords.find(
      (a) =>
        (a.employeeId === employee.id ||
          (a.employeeCode &&
            employee.employeeCode &&
            a.employeeCode.toUpperCase() === employee.employeeCode.toUpperCase())) &&
        a.date === selectedDate
    );
  }, [attendanceRecords, employee, selectedDate]);

  // Keep location synced with the active check-in record if already checked in
  useEffect(() => {
    if (currentRecord?.workLocation || currentRecord?.location) {
      const savedLoc = (currentRecord.workLocation || currentRecord.location) as
        | 'On-site (HQ)'
        | 'Remote (Home)'
        | 'Client Site';
      if (['On-site (HQ)', 'Remote (Home)', 'Client Site'].includes(savedLoc)) {
        setLocation(savedLoc);
      }
    }
  }, [currentRecord?.workLocation, currentRecord?.location, employee?.id, selectedDate]);

  const isAlreadyCheckedIn = Boolean(currentRecord?.checkInTime);
  const isAlreadyCheckedOut = Boolean(currentRecord?.checkOutTime);
  const isFutureDate = selectedDate > getCompanyTodayDate();

  const punchStatusLabel = isAlreadyCheckedOut
    ? 'Checked Out'
    : isAlreadyCheckedIn
    ? 'Checked In'
    : 'Not Checked In';

  // Real-time punctuality preview
  const time24Str = currentTime.toTimeString().split(' ')[0]; // "HH:mm:ss"
  const punctualityPreview = shift
    ? evaluatePunctuality(time24Str, shift.startTime, 10)
    : { isLate: false, lateMinutes: 0 };

  const isCheckInDisabled =
    isFutureDate ||
    !employee ||
    employees.length === 0 ||
    isAlreadyCheckedIn ||
    isAlreadyCheckedOut;

  const isCheckOutDisabled =
    isFutureDate ||
    !employee ||
    employees.length === 0 ||
    !isAlreadyCheckedIn ||
    isAlreadyCheckedOut;

  const handlePunch = (type: 'in' | 'out') => {
    if (!employee) return;

    // Enforce frontend validation rules
    if (type === 'in') {
      if (isCheckInDisabled) return;
      const trimmedNote = notes.trim();
      const fullNote = `${location}${trimmedNote ? ` - ${trimmedNote}` : ''}`;
      const ok = checkIn(employee.id, fullNote, {
        workLocation: location,
        punchNote: trimmedNote,
      });
      if (ok) {
        setNotes('');
      }
    } else {
      if (isCheckOutDisabled) return;
      const trimmedNote = notes.trim();
      const fullNote = `${location}${trimmedNote ? ` - ${trimmedNote}` : ''}`;
      const ok = checkOut(employee.id, fullNote, {
        workLocation: location,
        punchNote: trimmedNote,
      });
      if (ok) {
        setNotes('');
      }
    }
  };

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = currentTime.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attendance Punch"
      subtitle="Shift-based live check-in and check-out"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Live Clock Display */}
        <div className="bg-gradient-to-br from-[#206DA6] to-[#18A999] rounded-2xl p-5 text-white text-center shadow-lg shadow-[#206DA6]/20">
          <span className="text-xs font-medium uppercase tracking-widest text-white/80 block">
            {formattedDate}
          </span>
          <div className="text-4xl sm:text-5xl font-mono font-extrabold tracking-tight my-1.5">
            {formattedTime}
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live System Time
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-bold border ${
                isAlreadyCheckedOut
                  ? 'bg-blue-500/30 border-blue-200/50 text-white'
                  : isAlreadyCheckedIn
                  ? 'bg-emerald-500/30 border-emerald-200/50 text-white'
                  : 'bg-white/15 border-white/25 text-white/90'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Status: {punchStatusLabel}
            </span>
          </div>
        </div>

        {/* Employee Selection / Self-Service Identity */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Employee
            </label>
            {!canManageEmployees && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                <Lock className="w-2.5 h-2.5 text-slate-400" />
                Authenticated Profile Only
              </span>
            )}
          </div>
          {employees.length === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <p className="text-xs font-semibold text-amber-800">No employees registered yet.</p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                Please add an employee first before recording attendance.
              </p>
            </div>
          ) : canManageEmployees ? (
            <select
              value={employee?.id || selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode} - {emp.departmentName})
                </option>
              ))}
            </select>
          ) : employee ? (
            <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  src={employee.avatar}
                  name={employee.fullName}
                  size="md"
                  className="rounded-xl ring-1 ring-slate-200 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#172B4D] truncate">{employee.fullName}</p>
                  <p className="text-xs text-slate-500 font-mono truncate">
                    {employee.employeeCode} &bull; {employee.departmentName}
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border flex-shrink-0 ${
                  isAlreadyCheckedOut
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : isAlreadyCheckedIn
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {punchStatusLabel}
              </span>
            </div>
          ) : (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              Unable to find a linked employee profile for your account.
            </div>
          )}
        </div>

        {/* Assigned Shift Card */}
        {shift && (
          <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" style={{ color: shift.color }} />
                <span>Assigned Shift:</span>
                <span className="font-bold text-slate-900">{shift.name}</span>
              </span>
              <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                {formatScheduledTimeRange(shift)}
              </span>
            </div>

            {/* Punctuality Status Hint */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
              <span className="text-slate-500">
                10-minute grace period (up to {formatTime12Hour(`${shift.startTime}:00`)} + 10m)
              </span>
              {!isAlreadyCheckedIn ? (
                punctualityPreview.isLate ? (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <AlertTriangle className="w-3 h-3" /> Late arrival (+{punctualityPreview.lateMinutes}m)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <ShieldCheck className="w-3 h-3" /> On-time arrival
                  </span>
                )
              ) : currentRecord?.punctualityStatus === 'late' ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <AlertTriangle className="w-3 h-3" /> Late (+{currentRecord.lateMinutes || 0}m)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" /> On-time check-in
                </span>
              )}
            </div>
          </div>
        )}

        {/* Today's Punch Status & Recorded Times */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-semibold">Today's Punch Status ({selectedDate}):</span>
            <span
              className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-0.5 rounded-full border ${
                isAlreadyCheckedOut
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : isAlreadyCheckedIn
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isAlreadyCheckedOut
                    ? 'bg-blue-600'
                    : isAlreadyCheckedIn
                    ? 'bg-emerald-600'
                    : 'bg-slate-400'
                }`}
              />
              {punchStatusLabel}
            </span>
          </div>

          {currentRecord && (currentRecord.checkInTime || currentRecord.checkOutTime || currentRecord.status === 'on_leave') ? (
            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200/70">
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Check-In Time
                </span>
                <span className="text-xs font-bold text-emerald-700 font-mono">
                  {currentRecord.checkInTime ? formatTime12Hour(currentRecord.checkInTime) : '--:--'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Check-Out Time
                </span>
                <span className="text-xs font-bold text-blue-700 font-mono">
                  {currentRecord.checkOutTime ? formatTime12Hour(currentRecord.checkOutTime) : 'Active Shift'}
                </span>
              </div>
              {(currentRecord.workLocation || currentRecord.location || currentRecord.workHoursFormatted) && (
                <div className="col-span-2 flex items-center justify-between text-[11px] text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin className="w-3 h-3 text-[#206DA6]" />
                    {currentRecord.workLocation || currentRecord.location || location}
                  </span>
                  {currentRecord.workHoursFormatted && currentRecord.workHoursFormatted !== '--' && (
                    <span className="font-mono font-bold text-slate-700">
                      Duration: {currentRecord.workHoursFormatted}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 italic pt-1 border-t border-slate-200/60">
              No punch recorded yet today — click <strong className="text-slate-700 not-italic">Check In</strong> when starting work.
            </div>
          )}
        </div>

        {/* Location selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#206DA6]" /> Work Location
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['On-site (HQ)', 'Remote (Home)', 'Client Site'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                disabled={isAlreadyCheckedOut}
                onClick={() => setLocation(loc)}
                className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all truncate ${
                  isAlreadyCheckedOut ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  location === loc
                    ? 'bg-[#206DA6] text-white border-[#206DA6] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Punch Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Punch Note (Optional)
          </label>
          <input
            type="text"
            value={notes}
            disabled={isAlreadyCheckedOut}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Sprint kickoff, Client meeting, Lab work"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* Administrator Notification Info */}
        <div className="px-3 py-2 bg-blue-50/70 border border-blue-200/80 rounded-xl text-[11px] text-slate-600 flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-[#206DA6] flex-shrink-0" />
          <span>
            Every <strong>Check In</strong> and <strong>Check Out</strong> automatically notifies the Administrator.
          </span>
        </div>

        {/* Completed For Today Banner */}
        {isAlreadyCheckedIn && isAlreadyCheckedOut && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              Today's attendance punch is completed (Checked In at{' '}
              <strong>{formatTime12Hour(currentRecord?.checkInTime)}</strong> &amp; Checked Out at{' '}
              <strong>{formatTime12Hour(currentRecord?.checkOutTime)}</strong>).
            </span>
          </div>
        )}

        {/* Future Date Restriction Banner */}
        {isFutureDate && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Check In / Check Out is disabled for future dates ({selectedDate}). Attendance punches cannot be recorded in advance.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => handlePunch('in')}
            disabled={isCheckInDisabled}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold shadow-md transition-all ${
              isCheckInDisabled
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            {isAlreadyCheckedIn ? 'Checked In' : 'Check In'}
          </button>

          <button
            type="button"
            onClick={() => handlePunch('out')}
            disabled={isCheckOutDisabled}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold shadow-md transition-all ${
              isCheckOutDisabled
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                : 'bg-[#206DA6] hover:bg-[#1A5987] text-white shadow-[#206DA6]/20 cursor-pointer'
            }`}
          >
            <LogOut className="w-4 h-4" />
            {isAlreadyCheckedOut ? 'Checked Out' : 'Check Out'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
