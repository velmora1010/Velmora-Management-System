import React from 'react';
import { Modal } from '../common/Modal';
import { PayrollRecord } from '../../types/hrms';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';
import { Printer, CheckCircle, Building, FileCheck } from 'lucide-react';

interface PayslipModalProps {
  payroll: PayrollRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({
  payroll,
  isOpen,
  onClose,
}) => {
  const { settings, markPayrollPaid } = useHRMS();
  const { canViewPayroll } = useAuth();

  if (!payroll) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleMarkPaid = () => {
    markPayrollPaid(payroll.id);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Salary Payslip Statement"
      subtitle={`Voucher: ${payroll.payslipNumber}`}
      maxWidth="2xl"
    >
      <div className="space-y-6 printable-payslip">
        {/* Payslip Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#206DA6] flex items-center justify-center text-white font-extrabold text-lg">
              HR
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#172B4D]">{settings.companyName}</h2>
              <p className="text-[11px] text-slate-500">{settings.companyAddress}</p>
              <p className="text-[11px] text-slate-400">{settings.companyEmail} &bull; {settings.companyPhone}</p>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="text-[11px] text-slate-500 block uppercase tracking-wider">Payroll Period</span>
            <span className="text-base font-bold text-[#172B4D] font-mono">{payroll.month}</span>
            <div className="mt-1">
              <Badge variant={payroll.status} size="sm">
                {payroll.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Employee Profile Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Employee Name</span>
            <span className="font-bold text-slate-800 mt-0.5 block">{payroll.employeeName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Employee ID</span>
            <span className="font-mono font-semibold text-slate-800 mt-0.5 block">{payroll.employeeCode}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Department</span>
            <span className="font-medium text-slate-800 mt-0.5 block">{payroll.departmentName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment Mode</span>
            <span className="font-medium text-slate-800 mt-0.5 block">{payroll.paymentMethod}</span>
          </div>
        </div>

        {/* Breakdown Tables (Earnings vs Deductions) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Earnings */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-emerald-50/70 px-3.5 py-2 border-b border-emerald-100 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Earnings & Allowances</span>
              <span className="text-[11px] font-bold text-emerald-700">Amount</span>
            </div>
            <div className="p-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Basic Salary</span>
                <span className="font-mono font-semibold text-slate-800">
                  {settings.currencySymbol}{payroll.baseSalary.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Housing Allowance</span>
                <span className="font-mono text-slate-700">
                  {settings.currencySymbol}{payroll.allowances.housing.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Transport Subsidy</span>
                <span className="font-mono text-slate-700">
                  {settings.currencySymbol}{payroll.allowances.transport.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Medical Allowance</span>
                <span className="font-mono text-slate-700">
                  {settings.currencySymbol}{payroll.allowances.medical.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Performance Incentive</span>
                <span className="font-mono text-slate-700">
                  {settings.currencySymbol}{payroll.allowances.performanceBonus.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pt-2 font-bold text-slate-900">
                <span>Total Gross Earnings</span>
                <span className="font-mono text-emerald-700">
                  {settings.currencySymbol}{payroll.grossSalary.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-rose-50/70 px-3.5 py-2 border-b border-rose-100 flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">Statutory Deductions</span>
              <span className="text-[11px] font-bold text-rose-700">Amount</span>
            </div>
            <div className="p-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Income Withholding Tax</span>
                <span className="font-mono text-slate-700">
                  {settings.currencySymbol}{payroll.deductions.tax.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Health Care Insurance</span>
                <span className="font-mono text-slate-700">
                  {settings.currencySymbol}{payroll.deductions.healthInsurance.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Provident / Pension Fund</span>
                <span className="font-mono text-slate-700">
                  {settings.currencySymbol}{payroll.deductions.providentFund.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Unpaid Absence Deductions</span>
                <span className="font-mono text-slate-700">
                  {settings.currencySymbol}{payroll.deductions.unpaidLeaveDeduction.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pt-2 font-bold text-slate-900">
                <span>Total Deductions</span>
                <span className="font-mono text-rose-700">
                  {settings.currencySymbol}{payroll.totalDeductions.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Net Salary Highlight Box */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#206DA6] block">
              Net Take-Home Pay
            </span>
            <span className="text-[11px] text-slate-500">
              Gross ({settings.currencySymbol}{payroll.grossSalary.toLocaleString()}) &minus; Deductions ({settings.currencySymbol}{payroll.totalDeductions.toLocaleString()})
            </span>
          </div>
          <div className="text-right">
            <span className="text-3xl font-extrabold text-[#172B4D] font-mono">
              {settings.currencySymbol}
              {payroll.netSalary.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 block font-medium">USD Net Disbursed</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF
          </button>

          <div className="flex items-center gap-2">
            {payroll.status !== 'paid' && canViewPayroll && (
              <button
                type="button"
                onClick={handleMarkPaid}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark Paid & Disburse
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
