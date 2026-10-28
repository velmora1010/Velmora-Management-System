import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  ArrowLeft,
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
  badgeBg: 'bg-slate-100',
  badgeBorder: 'border-slate-300',
  badgeText: 'text-slate-700',
};

export const MAIN_STATUS_CARDS: StatusConfig[] = [
  {
    value: 'present',
    label: 'Present',
    description: 'Employee attended work',
    dotColor: 'bg-emerald-500',
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-200',
    badgeText: 'text-emerald-700',
  },
  {
    value: 'absent',
    label: 'Absent',
    description: 'Employee did not attend work',
    dotColor: 'bg-rose-500',
    badgeBg: 'bg-rose-50',
    badgeBorder: 'border-rose-200',
    badgeText: 'text-rose-700',
  },
];

export const MORE_STATUS_ITEMS: StatusConfig[] = [
  {
    value: 'late',
    label: 'Late',
    description: 'Arrived after shift grace period',
    dotColor: 'bg-amber-500',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-200',
    badgeText: 'text-amber-700',
  },
  {
    value: 'half_day',
    label: 'Half-Day',
    description: 'Worked half shift duration',
    dotColor: 'bg-amber-400',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-300',
    badgeText: 'text-amber-800',
  },
  {
    value: 'on_leave',
    label: 'On Leave',
    description: 'Authorized company leave',
    dotColor: 'bg-purple-500',
    badgeBg: 'bg-purple-50',
    badgeBorder: 'border-purple-200',
    badgeText: 'text-purple-700',
  },
  {
    value: 'permission',
    label: 'Permission',
    description: 'Short authorized absence',
    dotColor: 'bg-blue-500',
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-200',
    badgeText: 'text-blue-700',
  },
  {
    value: 'wfh',
    label: 'Work From Home',
    description: 'Remote / off-site work',
    dotColor: 'bg-teal-500',
    badgeBg: 'bg-teal-50',
    badgeBorder: 'border-teal-200',
    badgeText: 'text-teal-700',
  },
  {
    value: 'weekly_off',
    label: 'Weekly Off',
    description: 'Scheduled non-working day',
    dotColor: 'bg-slate-400',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-200',
    badgeText: 'text-slate-600',
  },
  {
    value: 'holiday',
    label: 'Holiday',
    description: 'Official company or gazetted holiday',
    dotColor: 'bg-indigo-500',
    badgeBg: 'bg-indigo-50',
    badgeBorder: 'border-indigo-200',
    badgeText: 'text-indigo-700',
  },
  {
    value: 'missing_punch',
    label: 'Missing Punch',
    description: 'Punch correction needed',
    dotColor: 'bg-orange-500',
    badgeBg: 'bg-orange-50',
    badgeBorder: 'border-orange-200',
    badgeText: 'text-orange-700',
  },
  {
    value: 'pending',
    label: 'Pending',
    description: 'Awaiting timesheet regularisation',
    dotColor: 'bg-sky-500',
    badgeBg: 'bg-blue-50/70',
    badgeBorder: 'border-blue-200',
    badgeText: 'text-blue-700',
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
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-200',
    badgeText: 'text-slate-700',
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
  const [currentView, setCurrentView] = useState<'main' | 'more'>('main');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever modal opens or currentStatus changes
  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(currentStatus);
      // If current status is one of the more options, open directly in more options view or start at main
      const isInMore = MORE_STATUS_ITEMS.some((item) => item.value === currentStatus);
      setCurrentView(isInMore ? 'more' : 'main');
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
    // Discard any unsaved changes
    setSelectedStatus(currentStatus);
    setCurrentView('main');
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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-modal-title"
    >
      {/* Backdrop overlay: rgba(15, 23, 42, 0.55) */}
      <div
        className="fixed inset-0 transition-opacity"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(3px)' }}
        onClick={handleCancel}
      />

      {/* Centered Modal Card: 440px - 500px width, rounded-2xl (16px), shadow-2xl */}
      <div
        className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto transform transition-all text-left z-10 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 'min(480px, 95vw)', borderRadius: '16px' }}
      >
        {/* Header: Title, Subtitle, Close Icon */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 id="attendance-modal-title" className="text-base sm:text-lg font-bold text-[#172B4D] tracking-tight">
              Update Attendance Status
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the attendance status for this employee.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Employee Information Card */}
        <div className="p-6 pb-4">
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/70 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={employee.avatar}
                alt=""
                className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200 flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-[#172B4D] truncate">{employee.fullName}</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-600 flex-shrink-0">
                    {employee.employeeCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span>{employee.departmentName}</span>
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {formattedDate}
                  </span>
                  <span>•</span>
                  <span
                    className="inline-flex items-center gap-1 font-medium"
                    style={{ color: shift?.color || '#206DA6' }}
                  >
                    <Clock className="w-3 h-3" />
                    {shift?.name || 'Assigned Shift'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-1">
              <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">
                Current
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${currentConfig.badgeBg} ${currentConfig.badgeBorder} ${currentConfig.badgeText}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${currentConfig.dotColor}`} />
                {currentConfig.label}
              </span>
            </div>
          </div>

          {/* Advance Date Info Banner */}
          {isFutureDate && (
            <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Advance attendance record for date: {formattedDate}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Modal Body Views */}
          <div className="mt-4">
            {currentView === 'main' ? (
              /* VIEW 1: MAIN OPTIONS (PRESENT & ABSENT) */
              <div className="space-y-3">
                {/* Option 1 — PRESENT */}
                <button
                  type="button"
                  data-testid="status-opt-present"
                  onClick={() => setSelectedStatus('present')}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                    selectedStatus === 'present'
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`p-2.5 rounded-xl transition-colors ${
                        selectedStatus === 'present'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-emerald-100/80 text-emerald-700'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#172B4D]">Present</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Employee attended work</p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      selectedStatus === 'present'
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 bg-white'
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
                  className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                    selectedStatus === 'absent'
                      ? 'border-rose-500 bg-rose-50/70 shadow-xs ring-1 ring-rose-500/20'
                      : 'border-slate-200 hover:border-rose-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`p-2.5 rounded-xl transition-colors ${
                        selectedStatus === 'absent'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'bg-rose-100/80 text-rose-700'
                      }`}
                    >
                      <UserX className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#172B4D]">Absent</span>
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Employee did not attend work</p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      selectedStatus === 'absent'
                        ? 'border-rose-500 bg-rose-500 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {selectedStatus === 'absent' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </button>

                {/* More Options Button */}
                <button
                  type="button"
                  data-testid="status-opt-more"
                  onClick={() => setCurrentView('more')}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 hover:text-[#206DA6] hover:bg-slate-100/80 hover:border-slate-300 font-semibold text-xs transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                    <span>More Options</span>
                    {isMoreSelected && (
                      <span className="text-[10px] font-bold text-[#206DA6] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        Selected: {selectedConfig.label}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 font-bold">→</span>
                </button>
              </div>
            ) : (
              /* VIEW 2: MORE OPTIONS (9 ADDITIONAL STATUSES) */
              <div>
                {/* Back Button */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setCurrentView('main')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#206DA6] transition-colors cursor-pointer p-1 -ml-1 rounded-lg hover:bg-slate-100"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Present / Absent</span>
                  </button>
                  <span className="text-[11px] font-medium text-slate-400">9 additional statuses</span>
                </div>

                {/* 9 Additional Statuses List */}
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
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
                            ? 'border-[#206DA6] bg-blue-50/70 shadow-2xs ring-1 ring-[#206DA6]/30'
                            : 'border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full ${opt.dotColor} flex-shrink-0`} />
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-[#172B4D] truncate">{opt.label}</p>
                            <p className="text-[11px] text-slate-500 truncate">{opt.description}</p>
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ml-2 ${
                            isSelected
                              ? 'border-[#206DA6] bg-[#206DA6] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Optional Notes / Remarks Field */}
            <div className="mt-3.5 pt-3 border-t border-slate-100">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Notes / Remarks <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add optional attendance note..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]/30 focus:border-[#206DA6] bg-slate-50/50 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer: Cancel | Save Attendance */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 min-w-0 pr-2">
            Selected:{' '}
            <span className="font-bold text-[#172B4D] capitalize">
              {selectedStatus === 'not_marked' ? 'Please select a status' : selectedConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              type="button"
              data-testid="status-cancel-btn"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
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
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-colors ${
                !canSave
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-[#206DA6] hover:bg-[#1a5784] cursor-pointer disabled:opacity-50'
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
