import React from 'react';
import { Modal } from '../common/Modal';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import { PayrollPaymentSchedule, PayrollRecord } from '../../types/hrms';
import {
  Calendar,
  Building2,
  CreditCard,
  Clock,
  FileText,
  Plus,
  CheckCircle,
  AlertTriangle,
  Edit,
  ShieldCheck,
  Repeat,
} from 'lucide-react';

interface SalaryScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDateStr: string;
  schedules: PayrollPaymentSchedule[];
  onOpenScheduleModal: (dateStr?: string) => void;
  onEditSchedule: (schedule: PayrollPaymentSchedule) => void;
  onViewPayroll?: (record: PayrollRecord) => void;
}

export const SalaryScheduleDetailModal: React.FC<SalaryScheduleDetailModalProps> = ({
  isOpen,
  onClose,
  selectedDateStr,
  schedules,
  onOpenScheduleModal,
  onEditSchedule,
  onViewPayroll,
}) => {
  const { settings, payrollRecords, recordSchedulePayment } = useHRMS();
  const { canViewPayroll } = useAuth();

  const formattedDate = selectedDateStr
    ? new Date(`${selectedDateStr}T12:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const getEffectiveStatus = (schedule: PayrollPaymentSchedule) => {
    if (schedule.status === 'paid') return 'paid';
    if (schedule.status === 'approved') return 'approved';
    if (schedule.scheduledPaymentDate < todayStr) return 'overdue';
    return schedule.status;
  };

  const getStatusBadge = (effectiveStatus: string) => {
    switch (effectiveStatus) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" /> Paid
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3" /> Overdue
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldCheck className="w-3 h-3" /> Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'scheduled':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#206DA6] border border-blue-200">
            <Calendar className="w-3 h-3" /> Scheduled
          </span>
        );
    }
  };

  const formatMethod = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'cash':
        return 'Cash';
      default:
        return 'Other';
    }
  };

  const formatFrequency = (freq: string) => {
    if (!freq) return 'Monthly';
    return freq.charAt(0).toUpperCase() + freq.slice(1);
  };

  const handleRecordPayment = (scheduleId: string) => {
    recordSchedulePayment(scheduleId);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Salary Payment Details"
      subtitle={`Scheduled employee salary disbursement details for ${formattedDate}`}
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Date Context Header */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#206DA6]/10 text-[#206DA6] flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Selected Calendar Date
              </span>
              <span className="text-xs font-bold text-[#172B4D]">{formattedDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              {schedules.length} scheduled payment{schedules.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => onOpenScheduleModal(selectedDateStr)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-lg transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Schedule</span>
            </button>
          </div>
        </div>

        {/* Content: List or Empty State */}
        {schedules.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">
              No salary payments scheduled for this date.
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              There are no employee compensation disbursements registered for this calendar day. You can schedule one now.
            </p>
            <button
              type="button"
              onClick={() => onOpenScheduleModal(selectedDateStr)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Schedule New Payment
            </button>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {schedules.map((schedule) => {
              const effectiveStatus = getEffectiveStatus(schedule);
              const matchingVoucher = payrollRecords.find(
                (p) => p.employeeId === schedule.employeeId && p.month === schedule.payrollMonth
              );
              const validAmount = matchingVoucher ? matchingVoucher.netSalary : schedule.amount;

              return (
                <div
                  key={schedule.id}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
                >
                  {/* Top Row: Employee & Status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-[#206DA6] flex items-center justify-center font-bold font-mono text-xs border border-slate-200">
                        {schedule.employeeCode.replace('EMP-', '')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#172B4D]">{schedule.employeeName}</span>
                          <span className="text-[11px] font-mono text-slate-400">({schedule.employeeCode})</span>
                        </div>
                        <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {schedule.departmentName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">{getStatusBadge(effectiveStatus)}</div>
                  </div>

                  {/* Grid of Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Payroll Month
                      </span>
                      <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                        {schedule.payrollMonth}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Scheduled Date
                      </span>
                      <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                        {schedule.scheduledPaymentDate}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Frequency
                      </span>
                      <span className="font-semibold text-slate-800 mt-0.5 block flex items-center gap-1">
                        <Repeat className="w-3 h-3 text-slate-400" />
                        {formatFrequency(schedule.paymentFrequency)}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Payment Method
                      </span>
                      <span className="font-semibold text-slate-800 mt-0.5 block flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-slate-400" />
                        {formatMethod(schedule.paymentMethod)}
                      </span>
                    </div>

                    {canViewPayroll && validAmount > 0 && (
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Scheduled Amount
                        </span>
                        <span className="font-bold text-emerald-700 font-mono text-sm mt-0.5 block">
                          {settings.currencySymbol}
                          {validAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actual Payment Date if Paid */}
                  {schedule.paidDate && (
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>
                        Actual Payment Date: <strong>{schedule.paidDate}</strong>
                      </span>
                    </div>
                  )}

                  {schedule.notes && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-500">Notes:</span> {schedule.notes}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      {matchingVoucher && onViewPayroll && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onViewPayroll(matchingVoucher);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#206DA6] bg-blue-50/60 border border-blue-200/60 rounded-xl hover:bg-blue-100 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Payroll Details</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => onEditSchedule(schedule)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5 text-slate-400" />
                        <span>Edit Schedule</span>
                      </button>

                      {effectiveStatus !== 'paid' && canViewPayroll && (
                        <button
                          type="button"
                          onClick={() => handleRecordPayment(schedule.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Record Payment</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
