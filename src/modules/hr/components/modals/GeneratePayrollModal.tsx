import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useHRMS } from '../../context/HRMSContext';
import { CircleDollarSign, Calendar, Users, AlertCircle } from 'lucide-react';

interface GeneratePayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeneratePayrollModal: React.FC<GeneratePayrollModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { employees, generatePayrollBatch, settings, selectedDate } = useHRMS();
  const [month, setMonth] = useState(selectedDate.substring(0, 7)); // "2026-10"

  const activeEmployees = employees.filter((e) => e.status !== 'terminated');
  const estimatedPayroll = activeEmployees.reduce((sum, e) => sum + Math.round(e.baseSalary * 0.95), 0);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    generatePayrollBatch(month);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Monthly Payroll Run"
      subtitle="Compute compensation, tax withholdings, and net payslips for all active personnel"
      maxWidth="md"
    >
      <form onSubmit={handleGenerate} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Target Pay Period (Month)
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
          />
        </div>

        {/* Batch Overview Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-slate-600 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" /> Eligible Active Employees:
            </span>
            <span className="font-bold text-[#172B4D]">{activeEmployees.length} Personnel</span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-slate-600 flex items-center gap-1.5">
              <CircleDollarSign className="w-3.5 h-3.5 text-slate-400" /> Estimated Net Outlay:
            </span>
            <span className="font-mono font-bold text-emerald-700">
              {settings.currencySymbol}{estimatedPayroll.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">Initial Voucher Status:</span>
            <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Draft (Reviewable)
            </span>
          </div>
        </div>

        {activeEmployees.length === 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              No active employees found to generate payroll. Please add employees with configured salary structures first.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
            <AlertCircle className="w-4 h-4 text-[#206DA6] flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Existing finalized vouchers for this period will be preserved. New draft vouchers will be created for any unprocessed active employees.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={activeEmployees.length === 0}
            className={`px-5 py-2 text-xs font-bold rounded-xl shadow-md transition-all ${
              activeEmployees.length === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                : 'text-white bg-[#206DA6] hover:bg-[#1A5987] shadow-[#206DA6]/20'
            }`}
          >
            Run Payroll Batch
          </button>
        </div>
      </form>
    </Modal>
  );
};
