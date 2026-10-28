import React from 'react';
import { Modal } from '../common/Modal';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import { PayrollPaymentSchedule } from '../../types/hrms';
import { formatPaiseToINR } from './SchedulePaymentModal';
import {
  Calendar,
  Building2,
  Briefcase,
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
  Edit,
  ShieldCheck,
  Repeat,
  FileText,
  UserCheck,
} from 'lucide-react';

interface EmployeeSalaryRecordDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: PayrollPaymentSchedule | null;
  onEditSchedule: (schedule: PayrollPaymentSchedule) => void;
}

const MONTH_NAME_MAP: Record<string, string> = {
  january: '01',
  jan: '01',
  february: '02',
  feb: '02',
  march: '03',
  mar: '03',
  april: '04',
  apr: '04',
  may: '05',
  june: '06',
  jun: '06',
  july: '07',
  jul: '07',
  august: '08',
  aug: '08',
  september: '09',
  sep: '09',
  sept: '09',
  october: '10',
  oct: '10',
  november: '11',
  nov: '11',
  december: '12',
  dec: '12',
};

/**
 * Normalizes any date or month string into strict "YYYY-MM" format (matching both year and month).
 */
export const normalizeYearMonth = (raw?: string): string => {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  // Exact YYYY-MM
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
    return trimmed;
  }
  // YYYY-MM-DD or ISO string
  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 7);
  }
  // DD-MM-YYYY
  if (/^\d{2}-(0[1-9]|1[0-2])-\d{4}$/.test(trimmed)) {
    const [, mm, yyyy] = trimmed.split('-');
    return `${yyyy}-${mm}`;
  }
  // MM-YYYY
  if (/^(0[1-9]|1[0-2])-\d{4}$/.test(trimmed)) {
    const [mm, yyyy] = trimmed.split('-');
    return `${yyyy}-${mm}`;
  }
  // "October 2026" or "Oct 2026"
  const nameMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (nameMatch) {
    const mm = MONTH_NAME_MAP[nameMatch[1].toLowerCase()];
    if (mm) return `${nameMatch[2]}-${mm}`;
  }
  return '';
};

/**
 * Extracts the saved payroll period Year and Month ({ year: "YYYY", month: "MM", yearMonth: "YYYY-MM" })
 * from payrollMonth or payrollPeriodStart without conflating it with scheduledPaymentDate.
 */
export const getPayrollPeriodYearAndMonth = (
  schedule: PayrollPaymentSchedule
): { year: string; month: string; yearMonth: string } | null => {
  const fromPayrollMonth = normalizeYearMonth(schedule.payrollMonth);
  const fromPeriodStart = normalizeYearMonth(schedule.payrollPeriodStart);
  const ym = fromPayrollMonth || fromPeriodStart;
  if (!ym || !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) {
    return null;
  }
  const [year, month] = ym.split('-');
  return { year, month, yearMonth: ym };
};

/**
 * Extracts the canonical "YYYY-MM" (Month + Year) for a salary payment schedule record's payroll period.
 */
export const extractRecordYearMonth = (schedule: PayrollPaymentSchedule): string => {
  const period = getPayrollPeriodYearAndMonth(schedule);
  return period ? period.yearMonth : '';
};

export const formatPayrollMonthLabel = (monthStr: string): string => {
  const normalized = normalizeYearMonth(monthStr) || monthStr;
  if (!normalized || !/^\d{4}-\d{2}$/.test(normalized)) return monthStr || '—';
  const [year, month] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 15));
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export const formatPaymentDateDisplay = (dateStr?: string): string => {
  if (!dateStr) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  }
  return dateStr;
};

export const formatPaymentMethodLabel = (method: string): string => {
  switch (method) {
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'cash':
      return 'Cash';
    case 'other':
      return 'Other';
    default:
      return method || 'Bank Transfer';
  }
};

export const formatPaymentFrequencyLabel = (freq: string): string => {
  if (!freq) return 'Monthly';
  return freq.charAt(0).toUpperCase() + freq.slice(1);
};

export const EmployeeSalaryRecordDetailModal: React.FC<EmployeeSalaryRecordDetailModalProps> = ({
  isOpen,
  onClose,
  schedule,
  onEditSchedule,
}) => {
  const { employees, departments, recordSchedulePayment } = useHRMS();
  const { canViewPayroll } = useAuth();

  if (!isOpen || !schedule) return null;

  const employee = employees.find(
    (e) => e.id === schedule.employeeId || e.employeeCode === schedule.employeeCode
  );
  const department = departments.find(
    (d) => d.id === (schedule.departmentId || employee?.departmentId)
  );

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const getEffectiveStatus = (item: PayrollPaymentSchedule) => {
    if (item.status === 'paid') return 'paid';
    if (item.status === 'approved') return 'approved';
    if (item.scheduledPaymentDate < todayStr) return 'overdue';
    return item.status;
  };

  const effectiveStatus = getEffectiveStatus(schedule);
  const amountPaise =
    schedule.amountPaise !== undefined
      ? schedule.amountPaise
      : Math.round((schedule.amount || 0) * 100);
  const canonicalYearMonth = extractRecordYearMonth(schedule);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" /> Paid
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Overdue
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
      case 'scheduled':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#206DA6] border border-blue-200">
            <Calendar className="w-3.5 h-3.5" /> Scheduled
          </span>
        );
    }
  };

  const recordedByActor =
    schedule.auditHistory && schedule.auditHistory.length > 0
      ? schedule.auditHistory[schedule.auditHistory.length - 1].actor
      : schedule.createdBy || 'HR Administrator';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Employee Salary Payment Details"
      subtitle="Detailed view of scheduled employee salary disbursement and payment status."
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* 1. Employee Information Card */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {employee?.avatar ? (
              <img
                src={employee.avatar}
                alt={schedule.employeeName}
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-xs"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[#206DA6]/10 text-[#206DA6] flex items-center justify-center font-extrabold text-base border border-blue-200">
                {schedule.employeeName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-[#172B4D]">
                  {employee?.fullName || schedule.employeeName}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-white text-slate-700 border border-slate-200">
                  {employee?.employeeCode || schedule.employeeCode}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {department?.name || schedule.departmentName || employee?.departmentName || 'General'}
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  {employee?.designation || 'Specialist'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Payment Status
            </span>
            {renderStatusBadge(effectiveStatus)}
          </div>
        </div>

        {/* 2. Salary Payment Information Grid */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
            Salary Payment Information
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200/70">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Salary Amount (₹)
              </span>
              <span className="text-base font-extrabold text-emerald-700 font-mono mt-1 block">
                {canViewPayroll ? formatPaiseToINR(amountPaise) : 'Restricted'}
              </span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Payroll Month
              </span>
              <span className="text-sm font-bold text-[#172B4D] mt-1 block">
                {formatPayrollMonthLabel(canonicalYearMonth)}
              </span>
              <span className="text-[11px] font-mono text-slate-400">{canonicalYearMonth}</span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Scheduled Payment Date
              </span>
              <span className="text-sm font-bold text-[#172B4D] font-mono mt-1 block">
                {formatPaymentDateDisplay(schedule.scheduledPaymentDate)}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {schedule.scheduledPaymentDate}
              </span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Payment Frequency
              </span>
              <span className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-[#206DA6]" />
                {formatPaymentFrequencyLabel(schedule.paymentFrequency)}
              </span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Payment Method
              </span>
              <span className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#206DA6]" />
                {formatPaymentMethodLabel(schedule.paymentMethod)}
              </span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Recorded By
              </span>
              <span className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#206DA6]" />
                {recordedByActor}
              </span>
            </div>
          </div>

          {/* Actual Payment Date (if confirmed) */}
          {schedule.paidDate && (
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-900">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  Actual Payment Date: <strong className="font-mono">{schedule.paidDate}</strong>
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700">Disbursement Confirmed</span>
            </div>
          )}

          {/* Notes */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
              <FileText className="w-3 h-3" />
              Notes
            </span>
            <p className="text-slate-700 leading-relaxed">
              {schedule.notes ? schedule.notes : 'No additional notes recorded for this schedule.'}
            </p>
          </div>
        </div>

        {/* 3. Popup Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2.5">
            {canViewPayroll && (
              <button
                type="button"
                onClick={() => onEditSchedule(schedule)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#206DA6] bg-blue-50/70 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Schedule</span>
              </button>
            )}

            {canViewPayroll && effectiveStatus !== 'paid' && (
              <button
                type="button"
                onClick={() => recordSchedulePayment(schedule.id)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
