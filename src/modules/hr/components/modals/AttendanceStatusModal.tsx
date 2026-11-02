import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  CheckCircle2,
  MoreHorizontal,
  ChevronDown,
  Loader2,
  Calendar,
  Clock,
  UserX,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { Employee, AttendanceRecord, ShiftTemplate, AttendanceStatus } from '../../types/hrms';
import { getAttendanceStatusLabel, getCompanyTodayDate } from '../../utils/attendanceCalculator';

export interface StatusConfig {
  value: AttendanceStatus;
  label: string;
  description: string;
  dotColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export const NOT_MARKED_CONFIG: StatusConfig = {
  value: 'not_marked',
  label: 'Not Marked',
  description: 'Attendance not yet recorded for this date',
  dotColor: 'bg-slate-400',
  badgeBg: 'bg-slate-800/80',
  badgeBorder: 'border-slate-700',
  badgeText: 'text-slate-300',
};

export const MAIN_STATUS_CARDS: StatusConfig[] = [
  {
    value: 'present',
    label: 'Present',
    description: 'Employee attended work',
    dotColor: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/15',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-400',
  },
  {
    value: 'absent',
    label: 'Absent',
    description: 'Employee did not attend work',
    dotColor: 'bg-rose-500',
    badgeBg: 'bg-rose-500/15',
    badgeBorder: 'border-rose-500/30',
    badgeText: 'text-rose-400',
  },
];

export const MORE_STATUS_ITEMS: StatusConfig[] = [
  {
    value: 'half_day',
    label: 'Half Day',
    description: 'Worked half shift duration',
    dotColor: 'bg-amber-400',
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-300',
  },
  {
    value: 'late',
    label: 'Late',
    description: 'Arrived after shift grace period',
    dotColor: 'bg-amber-500',
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-400',
  },
  {
    value: 'on_leave',
    label: 'On Leave',
    description: 'Authorized company leave',
    dotColor: 'bg-purple-500',
    badgeBg: 'bg-purple-500/15',
    badgeBorder: 'border-purple-500/30',
    badgeText: 'text-purple-400',
  },
  {
    value: 'wfh',
    label: 'Work From Home',
    description: 'Remote / off-site work',
    dotColor: 'bg-teal-400',
    badgeBg: 'bg-teal-500/15',
    badgeBorder: 'border-teal-500/30',
    badgeText: 'text-teal-300',
  },
  {
    value: 'holiday',
    label: 'Holiday',
    description: 'Official company or gazetted holiday',
    dotColor: 'bg-indigo-400',
    badgeBg: 'bg-indigo-500/15',
    badgeBorder: 'border-indigo-500/30',
    badgeText: 'text-indigo-300',
  },
  {
    value: 'weekly_off',
    label: 'Weekly Off',
    description: 'Scheduled non-working day',
    dotColor: 'bg-slate-400',
    badgeBg: 'bg-slate-800/80',
    badgeBorder: 'border-slate-700',
    badgeText: 'text-slate-300',
  },
  {
    value: 'permission',
    label: 'Permission',
    description: 'Short authorized absence',
    dotColor: 'bg-blue-400',
    badgeBg: 'bg-blue-500/15',
    badgeBorder: 'border-blue-500/30',
    badgeText: 'text-blue-300',
  },
  {
    value: 'missing_punch',
    label: 'Missing Punch',
    description: 'Punch correction needed',
    dotColor: 'bg-orange-500',
    badgeBg: 'bg-orange-500/15',
    badgeBorder: 'border-orange-500/30',
    badgeText: 'text-orange-400',
  },
  {
    value: 'pending',
    label: 'Pending',
    description: 'Awaiting timesheet regularisation',
    dotColor: 'bg-sky-400',
    badgeBg: 'bg-sky-500/15',
    badgeBorder: 'border-sky-500/30',
    badgeText: 'text-sky-300',
  },
];

export const ALL_STATUS_CONFIGS: StatusConfig[] = [
  ...MAIN_STATUS_CARDS,
  ...MORE_STATUS_ITEMS,
  NOT_MARKED_CONFIG,
];

export function getStatusConfig(status: AttendanceStatus): StatusConfig {
  if (status === 'not_marked') return NOT_MARKED_CONFIG;
  const match = ALL_STATUS_CONFIGS.find((c) => c.value === status);
  if (match) return match;
  return {
    value: status,
    label: getAttendanceStatusLabel(status),
    description: '',
    dotColor: 'bg-slate-400',
    badgeBg: 'bg-slate-800/80',
    badgeBorder: 'border-slate-700',
    badgeText: 'text-slate-300',
  };
}

interface AttendanceStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  record: AttendanceRecord | null;
  shift: ShiftTemplate | null;
  dateStr: string;
  currentStatus: AttendanceStatus;
  onSave: (newStatus: AttendanceStatus, notes?: string) => Promise<void> | void;
}

export const AttendanceStatusModal: React.FC<AttendanceStatusModalProps> = ({
  isOpen,
  onClose,
  employee,
  record,
  shift,
  dateStr,
  currentStatus,
  onSave,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>(currentStatus);
  const [isMoreExpanded, setIsMoreExpanded] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever modal opens or currentStatus changes
  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(currentStatus);
      const isInMore = MORE_STATUS_ITEMS.some((item) => item.value === currentStatus);
      setIsMoreExpanded(isInMore);
      setNotes(record?.notes && record?.notes !== 'Not Marked' ? record.notes : '');
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [isOpen, currentStatus, record]);

  // Lock body scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSaving, onClose]);

  if (!isOpen || !employee) return null;

  const currentConfig = getStatusConfig(currentStatus);
  const selectedConfig = getStatusConfig(selectedStatus);
  const todayDateStr = getCompanyTodayDate();
  const isFutureDate = dateStr > todayDateStr;
  const canSave = !isSaving && selectedStatus !== 'not_marked';

  // Format attendance date
  let formattedDate = dateStr;
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  } catch {
    formattedDate = dateStr;
  }

  const handleCancel = () => {
    if (isSaving) return;
    setSelectedStatus(currentStatus);
    setErrorMessage(null);
    onClose();
  };

  const handleSaveAttendance = async () => {
    if (!canSave) return;
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await onSave(selectedStatus, notes);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save attendance status.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const isMoreSelected = MORE_STATUS_ITEMS.some((item) => item.value === selectedStatus);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-modal-title"
    >
      {/* Backdrop overlay: dark with subtle blur */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={handleCancel}
      />

      {/* Centered Modal Card: Velmora Dark Theme */}
      <div
        className="relative w-full max-w-[500px] bg-[#1E293B] border border-[#334155] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden my-auto transform transition-all text-left z-10 animate-fade-in flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header: Title, Subtitle, Close Icon */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#334155] bg-[#151D2B] flex-shrink-0">
          <div>
            <h3 id="attendance-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
              Update Attendance Status
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5 font-normal">
              Select the attendance status for this employee
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Employee Information Card */}
          <div className="p-3.5 bg-[#151D2B] rounded-xl border border-[#334155] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={employee.avatar}
                alt={employee.fullName}
                className="w-11 h-11 rounded-xl object-cover ring-1 ring-[#334155] flex-shrink-0 bg-[#0F172A]"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white truncate">{employee.fullName}</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#0F172A] rounded border border-[#334155] text-[#94A3B8] flex-shrink-0 font-medium">
                    {employee.employeeCode}
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] truncate mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#64748B] flex-shrink-0" />
                  <span>{employee.departmentName}</span>
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-[#94A3B8]">
                  <span className="inline-flex items-center gap-1 font-medium text-[#94A3B8]">
                    <Calendar className="w-3 h-3 text-[#64748B]" />
                    {formattedDate}
                  </span>
                  <span className="text-[#475569]">•</span>
                  <span
                    className="inline-flex items-center gap-1 font-medium"
                    style={{ color: shift?.color || '#38BDF8' }}
                  >
                    <Clock className="w-3 h-3" />
                    {shift?.name || 'Assigned Shift'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-1">
              <span className="text-[9px] uppercase font-bold text-[#64748B] tracking-wider block mb-1">
                Current
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${currentConfig.badgeBg} ${currentConfig.badgeBorder} ${currentConfig.badgeText}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${currentConfig.dotColor}`} />
                {currentConfig.label}
              </span>
            </div>
          </div>

          {/* Advance Date Info Banner */}
          {isFutureDate && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>Advance attendance record for date: {formattedDate}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Attendance Status Options */}
          <div className="space-y-2.5">
            {/* Option 1 — PRESENT */}
            <button
              type="button"
              data-testid="status-opt-present"
              onClick={() => setSelectedStatus('present')}
              className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                selectedStatus === 'present'
                  ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30 shadow-md shadow-emerald-950/30'
                  : 'border-[#334155] bg-[#151D2B] hover:border-emerald-500/50 hover:bg-[#151D2B]/80'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`p-2.5 rounded-xl transition-colors ${
                    selectedStatus === 'present'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">Present</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-0.5">Employee attended work</p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                  selectedStatus === 'present'
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-[#475569] bg-[#0F172A]'
                }`}
              >
                {selectedStatus === 'present' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>

            {/* Option 2 — ABSENT */}
            <button
              type="button"
              data-testid="status-opt-absent"
              onClick={() => setSelectedStatus('absent')}
              className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                selectedStatus === 'absent'
                  ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/30 shadow-md shadow-rose-950/30'
                  : 'border-[#334155] bg-[#151D2B] hover:border-rose-500/50 hover:bg-[#151D2B]/80'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`p-2.5 rounded-xl transition-colors ${
                    selectedStatus === 'absent'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">Absent</span>
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-0.5">Employee did not attend work</p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                  selectedStatus === 'absent'
                    ? 'border-rose-500 bg-rose-500 text-white'
                    : 'border-[#475569] bg-[#0F172A]'
                }`}
              >
                {selectedStatus === 'absent' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>

            {/* More Options Accordion Toggle */}
            <div className="pt-1">
              <button
                type="button"
                data-testid="status-opt-more"
                onClick={() => setIsMoreExpanded((prev) => !prev)}
                className={`w-full py-2.5 px-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer text-xs font-semibold ${
                  isMoreExpanded || isMoreSelected
                    ? 'border-[#206DA6] bg-[#206DA6]/15 text-white'
                    : 'border-[#334155] bg-[#151D2B] text-[#94A3B8] hover:text-white hover:bg-[#1E293B] hover:border-[#475569]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MoreHorizontal className="w-4 h-4 text-[#64748B]" />
                  <span>More Options</span>
                  {isMoreSelected && (
                    <span className="text-[10px] font-bold text-[#38BDF8] bg-[#0F172A] px-2 py-0.5 rounded-full border border-[#334155]">
                      Selected: {selectedConfig.label}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-[#94A3B8] transition-transform duration-200 ${
                    isMoreExpanded ? 'rotate-180 text-[#38BDF8]' : ''
                  }`}
                />
              </button>

              {/* Collapsible List of Additional Statuses */}
              {isMoreExpanded && (
                <div className="space-y-2 mt-2 pt-2 border-t border-[#334155]/60 max-h-[240px] overflow-y-auto pr-1">
                  {MORE_STATUS_ITEMS.map((opt) => {
                    const isSelected = selectedStatus === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        data-testid={`status-opt-${opt.value}`}
                        onClick={() => setSelectedStatus(opt.value)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'border-[#206DA6] bg-[#206DA6]/20 ring-1 ring-[#206DA6]/50 shadow-xs'
                            : 'border-[#334155] bg-[#151D2B] hover:border-[#475569] hover:bg-[#1E293B]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full ${opt.dotColor} flex-shrink-0`} />
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-white truncate">{opt.label}</p>
                            <p className="text-[11px] text-[#94A3B8] truncate">{opt.description}</p>
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ml-2 ${
                            isSelected
                              ? 'border-[#206DA6] bg-[#206DA6] text-white'
                              : 'border-[#475569] bg-[#0F172A]'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Optional Notes / Remarks Field */}
          <div className="pt-2 border-t border-[#334155]">
            <label className="block text-xs font-semibold text-white mb-1.5">
              Notes / Remarks <span className="text-[#64748B] font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add optional attendance note..."
              className="w-full text-xs px-3.5 py-2.5 bg-[#0F172A] border border-[#334155] text-white rounded-xl placeholder-[#64748B] focus:outline-hidden focus:ring-1 focus:ring-[#206DA6] focus:border-[#206DA6] transition-colors"
            />
          </div>
        </div>

        {/* Modal Footer: Selected status indicator | Cancel | Save Attendance */}
        <div className="px-6 py-4 bg-[#151D2B] border-t border-[#334155] flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-[#94A3B8] w-full sm:w-auto text-left">
            Selected:{' '}
            <span className="font-bold text-white capitalize">
              {selectedStatus === 'not_marked' ? 'Please Select A Status' : selectedConfig.label}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              data-testid="status-cancel-btn"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-transparent hover:bg-white/5 border border-[#334155] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="status-save-btn"
              onClick={handleSaveAttendance}
              disabled={!canSave}
              title={
                selectedStatus === 'not_marked'
                  ? 'Please select an attendance status'
                  : undefined
              }
              className={`inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
                !canSave
                  ? 'bg-[#334155] text-[#64748B] border border-[#475569]/40 cursor-not-allowed opacity-60'
                  : 'bg-[#206DA6] hover:bg-[#1a5784] border border-[#206DA6] cursor-pointer'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Attendance</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
