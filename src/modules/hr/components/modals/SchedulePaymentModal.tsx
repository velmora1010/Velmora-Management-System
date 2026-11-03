import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import { Employee, PayrollPaymentSchedule, PaymentFrequency, PaymentMethod } from '../../types/hrms';
import {
  User,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from 'lucide-react';

interface SchedulePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultMonth?: string;
  defaultEmployeeId?: string;
  existingSchedule?: PayrollPaymentSchedule | null;
}

// Standard corporate salary structure calculator (preserved for database/accounting calculations)
export const calculateSalaryStructure = (emp?: Employee) => {
  if (!emp || !emp.baseSalary || emp.baseSalary <= 0) return null;
  const baseSalary = emp.baseSalary;
  const housing = Math.round(baseSalary * 0.1);
  const transport = 350;
  const medical = 400;
  const bonus = 500;
  const totalAllowances = housing + transport + medical + bonus;
  const grossSalary = baseSalary + totalAllowances;

  const tax = Math.round(grossSalary * 0.18);
  const healthInsurance = 350;
  const providentFund = Math.round(baseSalary * 0.05);
  const totalDeductions = tax + healthInsurance + providentFund;
  const netSalary = grossSalary - totalDeductions;

  return {
    baseSalary,
    housing,
    transport,
    medical,
    bonus,
    totalAllowances,
    grossSalary,
    tax,
    healthInsurance,
    providentFund,
    totalDeductions,
    netSalary,
  };
};

// Parse string currency input into integer paise (returns null if invalid or <= 0)
const parseAmountToPaise = (raw: string): number | null => {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [rupeesStr, paiseStr = ''] = cleaned.split('.');
  const rupees = parseInt(rupeesStr, 10);
  const paise = parseInt(paiseStr.padEnd(2, '0'), 10);
  if (isNaN(rupees) || isNaN(paise)) return null;
  const totalPaise = rupees * 100 + paise;
  if (totalPaise <= 0 || totalPaise > 10000000000) return null; // Max ₹10,00,00,000.00
  return totalPaise;
};

// Format integer paise to ₹XX,XXX.XX
export const formatPaiseToINR = (paise: number): string => {
  const amount = paise / 100;
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const SchedulePaymentModal: React.FC<SchedulePaymentModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  defaultMonth,
  defaultEmployeeId,
  existingSchedule,
}) => {
  const {
    employees,
    departments,
    payrollSchedules,
    addPayrollSchedule,
    updatePayrollSchedule,
  } = useHRMS();
  const { canViewPayroll } = useAuth();

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== 'terminated'),
    [employees]
  );

  // Section A: Employee Selection
  const [selectionMode, setSelectionMode] = useState<'single' | 'multiple' | 'all'>('single');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Section B: Payment Schedule
  const [payrollMonth, setPayrollMonth] = useState<string>('');
  const [scheduledPaymentDate, setScheduledPaymentDate] = useState<string>('');
  const [salaryAmountInput, setSalaryAmountInput] = useState<string>('');
  const [employeeAmounts, setEmployeeAmounts] = useState<Record<string, string>>({});
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form fields when opening
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSearchTerm('');

      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      if (existingSchedule) {
        setSelectionMode('single');
        setSelectedEmployeeId(existingSchedule.employeeId);
        setSelectedEmployeeIds([existingSchedule.employeeId]);
        setSelectedDepartmentId(existingSchedule.departmentId || 'all');
        setPayrollMonth(existingSchedule.payrollMonth);
        setScheduledPaymentDate(existingSchedule.scheduledPaymentDate);
        const existingVal =
          existingSchedule.amount > 0 ? String(existingSchedule.amount) : '';
        setSalaryAmountInput(existingVal);
        setEmployeeAmounts({ [existingSchedule.employeeId]: existingVal });
        setPaymentFrequency(existingSchedule.paymentFrequency);
        setPaymentMethod(existingSchedule.paymentMethod);
        setNotes(existingSchedule.notes || '');
      } else {
        const initialDate = defaultDate || todayStr;
        const initialMonth = initialDate.substring(0, 7) || defaultMonth || todayStr.substring(0, 7);
        setPayrollMonth(initialMonth);
        setScheduledPaymentDate(initialDate);
        setSelectionMode('single');
        // Do not preselect an employee unless opened in an employee-specific context
        const initialEmpId = defaultEmployeeId || '';
        setSelectedEmployeeId(initialEmpId);
        setSelectedEmployeeIds(initialEmpId ? [initialEmpId] : []);
        setSelectedDepartmentId('all');
        setSalaryAmountInput('');
        setEmployeeAmounts({});
        setPaymentFrequency('monthly');
        setPaymentMethod('bank_transfer');
        setNotes('');
      }
    }
  }, [isOpen, defaultDate, defaultMonth, defaultEmployeeId, existingSchedule]);

  const filteredEmployeesByDept = useMemo(() => {
    return activeEmployees.filter((e) => {
      const matchDept = selectedDepartmentId === 'all' || e.departmentId === selectedDepartmentId;
      const matchSearch =
        !searchTerm ||
        e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [activeEmployees, selectedDepartmentId, searchTerm]);

  const selectedEmployee = useMemo(() => {
    return activeEmployees.find((e) => e.id === selectedEmployeeId);
  }, [activeEmployees, selectedEmployeeId]);

  // Selected employees list for single / multi / all modes
  const targetEmployees = useMemo(() => {
    if (selectionMode === 'single') {
      return selectedEmployee ? [selectedEmployee] : [];
    }
    if (selectionMode === 'multiple') {
      return activeEmployees.filter((e) => selectedEmployeeIds.includes(e.id));
    }
    return activeEmployees.filter(
      (e) => selectedDepartmentId === 'all' || e.departmentId === selectedDepartmentId
    );
  }, [selectionMode, selectedEmployee, selectedEmployeeIds, activeEmployees, selectedDepartmentId]);

  const handleToggleMultipleEmp = (empId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAllInDept = () => {
    const allFilteredIds = filteredEmployeesByDept.map((e) => e.id);
    const areAllSelected = allFilteredIds.every((id) => selectedEmployeeIds.includes(id));
    if (areAllSelected) {
      setSelectedEmployeeIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleEmployeeAmountChange = (empId: string, val: string) => {
    setEmployeeAmounts((prev) => ({
      ...prev,
      [empId]: val,
    }));
  };

  // Live parsed amounts for summary
  const summaryAmountDetails = useMemo(() => {
    if (selectionMode === 'single') {
      const paise = parseAmountToPaise(salaryAmountInput);
      return {
        totalPaise: paise || 0,
        isValid: paise !== null,
        perEmployee: selectedEmployee
          ? [{ emp: selectedEmployee, paise: paise || 0, isValid: paise !== null }]
          : [],
      };
    }

    let totalPaise = 0;
    let allValid = targetEmployees.length > 0;
    const perEmployee = targetEmployees.map((emp) => {
      const raw = employeeAmounts[emp.id] ?? salaryAmountInput;
      const paise = parseAmountToPaise(raw || '');
      if (paise === null) {
        allValid = false;
      } else {
        totalPaise += paise;
      }
      return { emp, paise: paise || 0, isValid: paise !== null };
    });

    return {
      totalPaise,
      isValid: allValid,
      perEmployee,
    };
  }, [selectionMode, salaryAmountInput, employeeAmounts, selectedEmployee, targetEmployees]);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!canViewPayroll) {
      setErrorMessage('Access denied: You do not have permissions to schedule salary payments.');
      return;
    }
    if (targetEmployees.length === 0) {
      setErrorMessage('Please select an employee.');
      return;
    }
    if (!scheduledPaymentDate) {
      setErrorMessage('Please select a Scheduled Payment Date.');
      return;
    }
    if (!paymentFrequency) {
      setErrorMessage('Please select a payment frequency.');
      return;
    }
    if (!paymentMethod) {
      setErrorMessage('Please select a payment method.');
      return;
    }

    // Validate salary amounts for each selected employee
    const validatedEntries: Array<{ emp: Employee; amountPaise: number; amount: number }> = [];

    if (selectionMode === 'single') {
      const paise = parseAmountToPaise(salaryAmountInput);
      if (paise === null) {
        setErrorMessage('Please enter a valid Salary Amount (₹) greater than ₹0 (up to 2 decimal places).');
        return;
      }
      validatedEntries.push({
        emp: targetEmployees[0],
        amountPaise: paise,
        amount: paise / 100,
      });
    } else {
      for (const emp of targetEmployees) {
        const raw = employeeAmounts[emp.id] ?? salaryAmountInput;
        const paise = parseAmountToPaise(raw || '');
        if (paise === null) {
          setErrorMessage(
            `Please enter a valid Salary Amount (₹) greater than ₹0 for ${emp.fullName} (${emp.employeeCode}).`
          );
          return;
        }
        validatedEntries.push({
          emp,
          amountPaise: paise,
          amount: paise / 100,
        });
      }
    }

    const effectivePayrollMonth = scheduledPaymentDate
      ? scheduledPaymentDate.substring(0, 7)
      : payrollMonth;

    if (existingSchedule) {
      // Check if moving to a date where the same employee already has another schedule
      const duplicateOnTargetDate = payrollSchedules.find(
        (s) =>
          s.id !== existingSchedule.id &&
          s.employeeId === existingSchedule.employeeId &&
          s.scheduledPaymentDate === scheduledPaymentDate
      );
      if (duplicateOnTargetDate) {
        setErrorMessage(
          `${existingSchedule.employeeName} already has a scheduled payment on ${formatDateDisplay(scheduledPaymentDate)}.`
        );
        return;
      }

      const entry = validatedEntries[0];
      updatePayrollSchedule(existingSchedule.id, {
        payrollMonth: effectivePayrollMonth,
        scheduledPaymentDate,
        amount: entry.amount,
        amountPaise: entry.amountPaise,
        currency: 'INR',
        paymentFrequency,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      onClose();
      return;
    }

    // Check for unintended duplicate schedule on the same date
    for (const entry of validatedEntries) {
      const existingDup = payrollSchedules.find(
        (s) =>
          s.employeeId === entry.emp.id &&
          s.scheduledPaymentDate === scheduledPaymentDate
      );
      if (existingDup) {
        setErrorMessage(
          `A salary payment schedule already exists for ${entry.emp.fullName} on ${formatDateDisplay(scheduledPaymentDate)}. Please edit the existing schedule instead.`
        );
        return;
      }
    }

    // Create schedule payloads for each target employee
    const schedulesToCreate = validatedEntries.map(({ emp, amount, amountPaise }) => ({
      employeeId: emp.id,
      employeeName: emp.fullName,
      employeeCode: emp.employeeCode,
      departmentId: emp.departmentId,
      departmentName: emp.departmentName,
      payrollMonth: effectivePayrollMonth,
      scheduledPaymentDate,
      paymentFrequency,
      paymentMethod,
      amount,
      amountPaise,
      currency: 'INR',
      status: 'scheduled' as const,
      notes: notes.trim() || undefined,
      createdBy: 'Administrator',
    }));

    addPayrollSchedule(schedulesToCreate);
    onClose();
  };

  const singleParsedPaise = parseAmountToPaise(salaryAmountInput);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Salary Payment"
      subtitle="Select employee salary details and schedule the payment."
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* SECTION A — EMPLOYEE INFORMATION */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#206DA6]" />
              Section A — Employee Information *
            </span>

            {!existingSchedule && (
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectionMode('single')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    selectionMode === 'single'
                      ? 'bg-[#206DA6] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Single Employee
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode('multiple')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    selectionMode === 'multiple'
                      ? 'bg-[#206DA6] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Select Multiple
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    selectionMode === 'all'
                      ? 'bg-[#206DA6] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Eligible
                </button>
              </div>
            )}
          </div>

          {/* Department Filter & Single Employee Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Department (Filter)
              </label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                disabled={!!existingSchedule}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              >
                <option value="all">All Departments ({activeEmployees.length} employees)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Single Employee Dropdown */}
            {selectionMode === 'single' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Select Employee *
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  disabled={!!existingSchedule}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                >
                  <option value="">Select Employee</option>
                  {filteredEmployeesByDept.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} — {emp.employeeCode} ({emp.departmentName})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Single Employee Details Card */}
          {selectionMode === 'single' && selectedEmployee && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <img
                  src={selectedEmployee.avatar}
                  alt={selectedEmployee.fullName}
                  className="w-11 h-11 rounded-xl object-cover border border-slate-200 shadow-xs"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#172B4D]">{selectedEmployee.fullName}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold border border-slate-200">
                      {selectedEmployee.employeeCode}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {selectedEmployee.departmentName}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      {selectedEmployee.designation}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
            </div>
          )}

          {/* Multiple Employees Checkboxes List with Individual Salary Amount Inputs */}
          {selectionMode === 'multiple' && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700">
                  Select Employees &amp; Enter Individual Salary Amounts ({selectedEmployeeIds.length} of {filteredEmployeesByDept.length} selected)
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllInDept}
                  className="text-xs font-bold text-[#206DA6] hover:underline"
                >
                  Select / Deselect All
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {filteredEmployeesByDept.map((emp) => {
                  const isChecked = selectedEmployeeIds.includes(emp.id);
                  const empVal = employeeAmounts[emp.id] ?? '';
                  return (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 text-xs transition-colors"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleMultipleEmp(emp.id)}
                          className="rounded text-[#206DA6] focus:ring-[#206DA6]"
                        />
                        <img src={emp.avatar} alt={emp.fullName} className="w-6 h-6 rounded-md object-cover" />
                        <span className="font-bold text-slate-800">{emp.fullName}</span>
                        <span className="font-mono text-[11px] text-slate-400 font-medium">({emp.employeeCode})</span>
                        <span className="text-[11px] text-slate-500 hidden sm:inline">• {emp.departmentName}</span>
                      </label>

                      {isChecked && (
                        <div className="relative w-44 flex-shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={empVal}
                            onChange={(e) => handleEmployeeAmountChange(emp.id, e.target.value)}
                            placeholder="Enter Salary Amount"
                            className="w-full pl-6 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Eligible Employees List with Individual Editable Salary Amounts */}
          {selectionMode === 'all' && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-xs text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-[#206DA6] flex-shrink-0" />
                <span>
                  All <strong>{targetEmployees.length}</strong> eligible active employee(s) selected. Enter or edit each employee&apos;s salary amount below:
                </span>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {targetEmployees.map((emp) => {
                  const empVal = employeeAmounts[emp.id] ?? '';
                  return (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between gap-2.5 p-1.5 rounded-lg bg-slate-50/60 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <img src={emp.avatar} alt={emp.fullName} className="w-6 h-6 rounded-md object-cover" />
                        <span className="font-bold text-slate-800">{emp.fullName}</span>
                        <span className="font-mono text-[11px] text-slate-400 font-medium">({emp.employeeCode})</span>
                        <span className="text-[11px] text-slate-500 hidden sm:inline">• {emp.departmentName}</span>
                      </div>

                      <div className="relative w-44 flex-shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={empVal}
                          onChange={(e) => handleEmployeeAmountChange(emp.id, e.target.value)}
                          placeholder="Enter Salary Amount"
                          className="w-full pl-6 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* SECTION B — PAYMENT SCHEDULE */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <span className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#206DA6]" />
            Section B — Payment Schedule *
          </span>

          {/* First Row: Scheduled Payment Date * | Salary Amount (₹) * */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Scheduled Payment Date *
              </label>
              <input
                type="date"
                value={scheduledPaymentDate}
                onChange={(e) => setScheduledPaymentDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase">
                  Salary Amount (₹) *
                </label>
                {selectionMode === 'single' && singleParsedPaise !== null && (
                  <span className="text-[11px] font-bold text-emerald-700 font-mono">
                    {formatPaiseToINR(singleParsedPaise)}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={salaryAmountInput}
                  onChange={(e) => setSalaryAmountInput(e.target.value)}
                  placeholder="Enter Salary Amount"
                  required={selectionMode === 'single'}
                  className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                />
              </div>
            </div>
          </div>

          {/* Second Row: Payment Frequency | Payment Method | Payment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Payment Frequency
              </label>
              <select
                value={paymentFrequency}
                onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Payment Status
              </label>
              <div className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold flex items-center gap-1.5 text-[#206DA6]">
                <span className="w-2 h-2 rounded-full bg-[#206DA6]" />
                {existingSchedule?.status
                  ? existingSchedule.status.charAt(0).toUpperCase() + existingSchedule.status.slice(1)
                  : 'Scheduled'}
              </div>
            </div>
          </div>

          {/* Third Row: Notes (Optional) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Month-end payroll disbursement via primary corporate banking gateway..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
            />
          </div>
        </div>

        {/* SECTION C — PAYMENT SCHEDULE SUMMARY */}
        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-2.5 text-xs">
          <span className="text-[11px] font-bold text-[#206DA6] uppercase tracking-wider block">
            Section C — Payment Schedule Summary
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Selected Employee(s)</span>
              <span className="font-bold text-[#172B4D]">
                {selectionMode === 'single'
                  ? selectedEmployee
                    ? `${selectedEmployee.fullName} (${selectedEmployee.employeeCode})`
                    : 'None'
                  : targetEmployees.map((e) => e.fullName).join(', ') || 'None'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Employee Count</span>
              <span className="font-semibold">
                {targetEmployees.length} {targetEmployees.length === 1 ? 'Employee' : 'Employees'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Scheduled Payment Date</span>
              <span className="font-semibold font-mono">{formatDateDisplay(scheduledPaymentDate)}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Salary Amount (₹)</span>
              <span className="font-bold font-mono text-emerald-700">
                {summaryAmountDetails.totalPaise > 0
                  ? formatPaiseToINR(summaryAmountDetails.totalPaise)
                  : '—'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Payment Frequency</span>
              <span className="font-semibold capitalize">{paymentFrequency}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Payment Method</span>
              <span className="font-semibold capitalize">{paymentMethod.replace('_', ' ')}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Payment Status</span>
              <span className="font-bold text-[#206DA6]">
                {existingSchedule?.status
                  ? existingSchedule.status.charAt(0).toUpperCase() + existingSchedule.status.slice(1)
                  : 'Scheduled'}
              </span>
            </div>
          </div>

          {/* Individual breakdown for multiple employees */}
          {selectionMode !== 'single' && summaryAmountDetails.perEmployee.length > 0 && (
            <div className="pt-2 border-t border-blue-100/80 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Individual Employee Amounts
              </span>
              <div className="flex flex-wrap gap-2">
                {summaryAmountDetails.perEmployee.map(({ emp, paise, isValid }) => (
                  <span
                    key={emp.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200/70 text-[11px]"
                  >
                    <span className="font-bold text-[#172B4D]">{emp.fullName}:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {isValid ? formatPaiseToINR(paise) : 'Enter Amount'}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* POPUP FOOTER */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all"
          >
            Save Salary Schedule
          </button>
        </div>
      </form>
    </Modal>
  );
};
