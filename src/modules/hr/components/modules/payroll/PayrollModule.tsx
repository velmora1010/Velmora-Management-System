import React, { useState, useEffect, useMemo } from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { PayrollRecord, PayrollPaymentSchedule } from '../../../types/hrms';
import { SalaryCalendarView } from './SalaryCalendarView';
import { SchedulePaymentModal, formatPaiseToINR } from '../../modals/SchedulePaymentModal';
import {
  EmployeeSalaryRecordDetailModal,
  getPayrollPeriodYearAndMonth,
  formatPayrollMonthLabel,
  formatPaymentDateDisplay,
  formatPaymentMethodLabel,
  formatPaymentFrequencyLabel,
} from '../../modals/EmployeeSalaryRecordDetailModal';
import {
  Plus,
  ShieldLock,
  Calendar,
  X,
  Search,
  Filter,
  RotateCcw,
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Eye,
  FileSpreadsheet,
  IndianRupee,
} from 'lucide-react';

interface PayrollModuleProps {
  onOpenGeneratePayroll: () => void;
  onSelectPayroll: (record: PayrollRecord) => void;
}

const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export const PayrollModule: React.FC<PayrollModuleProps> = ({
  onSelectPayroll,
}) => {
  const {
    selectedDate,
    employees,
    departments,
    payrollSchedules,
    settings,
  } = useHRMS();
  const { canViewPayroll, currentUser } = useAuth();
  const { showToast } = useToast();

  // Modals state
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PayrollPaymentSchedule | null>(null);
  const [selectedDetailScheduleId, setSelectedDetailScheduleId] = useState<string | null>(null);

  // Current date in company timezone (Asia/Kolkata)
  const timezone = settings.timezone || 'Asia/Kolkata';
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }, [timezone]);

  const defaultCurrentYear = useMemo(() => {
    return todayStr.substring(0, 4); // e.g. "2026"
  }, [todayStr]);

  // Filter States — First select Year (defaults to current year), then select Month (defaults to All Months)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>(defaultCurrentYear);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Second-level (More Filters) state
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState<boolean>(false);
  const [salaryRangeFilter, setSalaryRangeFilter] = useState<string>('all');
  const [customMinSalary, setCustomMinSalary] = useState<string>('');
  const [customMaxSalary, setCustomMaxSalary] = useState<string>('');
  const [paymentDateFilter, setPaymentDateFilter] = useState<string>('all');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // Dynamic available years (currentYear - 2 through currentYear + 2, plus any years in database)
  const yearOptions = useMemo(() => {
    const currentYrNum = parseInt(defaultCurrentYear, 10) || new Date().getFullYear();
    const yearsSet = new Set<string>();
    for (let y = currentYrNum - 2; y <= currentYrNum + 2; y++) {
      yearsSet.add(String(y));
    }
    payrollSchedules.forEach((s) => {
      const period = getPayrollPeriodYearAndMonth(s);
      if (period?.year) {
        yearsSet.add(period.year);
      }
    });
    return Array.from(yearsSet).sort();
  }, [payrollSchedules, defaultCurrentYear]);

  // Handle Year selection change: if "All Years" is selected, reset Month to "All Months"
  const handleYearFilterChange = (newYear: string) => {
    setYearFilter(newYear);
    if (newYear === 'all') {
      setMonthFilter('all');
    }
  };

  // Track schedule count so when a new schedule is added, its year/month is visible
  const [prevScheduleCount, setPrevScheduleCount] = useState<number>(payrollSchedules.length);
  useEffect(() => {
    if (payrollSchedules.length > prevScheduleCount) {
      const latest = payrollSchedules[payrollSchedules.length - 1];
      if (latest) {
        const period = getPayrollPeriodYearAndMonth(latest);
        if (period) {
          if (yearFilter !== 'all' && yearFilter !== period.year) {
            setYearFilter(period.year);
          }
          if (monthFilter !== 'all' && monthFilter !== period.month) {
            setMonthFilter(period.month);
          }
        }
      }
    }
    setPrevScheduleCount(payrollSchedules.length);
  }, [payrollSchedules, prevScheduleCount, yearFilter, monthFilter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCalendarModalOpen) {
        setIsCalendarModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCalendarModalOpen]);

  // Active employees from database
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== 'terminated'),
    [employees]
  );

  // Authorize schedules per RBAC
  const authorizedSchedules = useMemo(() => {
    return payrollSchedules.filter((s) => {
      if (!s || !s.id || !s.employeeId) return false;
      if (currentUser.role === 'employee' && s.employeeId !== currentUser.employeeId) {
        return false;
      }
      return true;
    });
  }, [payrollSchedules, currentUser]);

  // Derive effective payment status (Paid is never marked Overdue)
  const getEffectiveStatus = (schedule: PayrollPaymentSchedule): string => {
    if (schedule.status === 'paid') return 'paid';
    if (schedule.status === 'approved') return 'approved';
    if (schedule.scheduledPaymentDate < todayStr) return 'overdue';
    return schedule.status;
  };

  // Helper for Payment Date Range comparisons in Asia/Kolkata
  const matchesPaymentDateFilter = (scheduledDateStr: string): boolean => {
    if (paymentDateFilter === 'all') return true;
    if (!scheduledDateStr) return false;

    if (paymentDateFilter === 'today') {
      return scheduledDateStr === todayStr;
    }

    const [ty, tm, td] = todayStr.split('-').map(Number);

    if (paymentDateFilter === 'this_week') {
      const todayDate = new Date(Date.UTC(ty, tm - 1, td));
      const dayOfWeek = todayDate.getUTCDay(); // 0 (Sun) - 6 (Sat)
      const startOfWeek = new Date(todayDate);
      startOfWeek.setUTCDate(todayDate.getUTCDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
      const startStr = startOfWeek.toISOString().slice(0, 10);
      const endStr = endOfWeek.toISOString().slice(0, 10);
      return scheduledDateStr >= startStr && scheduledDateStr <= endStr;
    }

    if (paymentDateFilter === 'this_month') {
      return scheduledDateStr.substring(0, 7) === todayStr.substring(0, 7);
    }

    if (paymentDateFilter === 'last_month') {
      const lastMonthDate = new Date(Date.UTC(ty, tm - 2, 1));
      const lastMonthPrefix = lastMonthDate.toISOString().slice(0, 7);
      return scheduledDateStr.substring(0, 7) === lastMonthPrefix;
    }

    if (paymentDateFilter === 'custom') {
      if (customFromDate && scheduledDateStr < customFromDate) return false;
      if (customToDate && scheduledDateStr > customToDate) return false;
      return true;
    }

    return true;
  };

  // Helper for numeric Salary Range comparisons (using integer paise)
  const matchesSalaryRangeFilter = (schedule: PayrollPaymentSchedule): boolean => {
    if (salaryRangeFilter === 'all') return true;
    const paise =
      schedule.amountPaise !== undefined
        ? schedule.amountPaise
        : Math.round((schedule.amount || 0) * 100);

    switch (salaryRangeFilter) {
      case 'below_10000':
        return paise < 1000000; // < ₹10,000.00
      case '10000_20000':
        return paise >= 1000000 && paise <= 2000000; // ₹10,000.00 – ₹20,000.00
      case '20001_30000':
        return paise > 2000000 && paise <= 3000000; // ₹20,000.01 – ₹30,000.00
      case '30001_50000':
        return paise > 3000000 && paise <= 5000000; // ₹30,000.01 – ₹50,000.00
      case 'above_50000':
        return paise > 5000000; // > ₹50,000.00
      case 'custom': {
        const minVal = customMinSalary.trim() !== '' ? parseFloat(customMinSalary) : null;
        const maxVal = customMaxSalary.trim() !== '' ? parseFloat(customMaxSalary) : null;
        if (minVal !== null && !isNaN(minVal) && paise < Math.round(minVal * 100)) {
          return false;
        }
        if (maxVal !== null && !isNaN(maxVal) && paise > Math.round(maxVal * 100)) {
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  // Combined AND-filtered Salary Payment Schedules (Two-step Year -> Month filtering)
  const filteredSchedules = useMemo(() => {
    return authorizedSchedules
      .filter((schedule) => {
        const emp = employees.find(
          (e) => e.id === schedule.employeeId || e.employeeCode === schedule.employeeCode
        );
        const empName = (emp?.fullName || schedule.employeeName || '').toLowerCase();
        const empCode = (emp?.employeeCode || schedule.employeeCode || '').toLowerCase();
        const deptId = schedule.departmentId || emp?.departmentId || '';

        // Search query filter
        if (searchQuery.trim() !== '') {
          const q = searchQuery.trim().toLowerCase();
          if (!empName.includes(q) && !empCode.includes(q)) {
            return false;
          }
        }

        // 1. Two-step Year & Month filter based on saved payroll period (payrollMonth / payrollPeriodStart)
        const period = getPayrollPeriodYearAndMonth(schedule);
        if (yearFilter !== 'all') {
          // If a specific Year is selected, record must have a matching payroll period year
          if (!period || period.year !== yearFilter) {
            return false;
          }
          // If a specific Month is also selected, record must match that month within the selected year
          if (monthFilter !== 'all' && period.month !== monthFilter) {
            return false;
          }
        } else if (monthFilter !== 'all') {
          // Fallback if monthFilter is set while yearFilter is 'all'
          if (!period || period.month !== monthFilter) {
            return false;
          }
        }

        // 2. Employee filter
        if (employeeFilter !== 'all') {
          if (schedule.employeeId !== employeeFilter && emp?.id !== employeeFilter) {
            return false;
          }
        }

        // 3. Department filter
        if (departmentFilter !== 'all') {
          if (deptId !== departmentFilter) {
            return false;
          }
        }

        // 4. Salary Amount Range filter
        if (!matchesSalaryRangeFilter(schedule)) {
          return false;
        }

        // 5. Payment Status filter
        const effectiveStatus = getEffectiveStatus(schedule);
        if (statusFilter !== 'all' && effectiveStatus !== statusFilter) {
          return false;
        }

        // 6. Payment Date filter
        if (!matchesPaymentDateFilter(schedule.scheduledPaymentDate)) {
          return false;
        }

        // 7. Payment Frequency filter
        if (frequencyFilter !== 'all' && schedule.paymentFrequency !== frequencyFilter) {
          return false;
        }

        // 8. Payment Method filter
        if (methodFilter !== 'all' && schedule.paymentMethod !== methodFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.scheduledPaymentDate.localeCompare(a.scheduledPaymentDate));
  }, [
    authorizedSchedules,
    employees,
    searchQuery,
    yearFilter,
    monthFilter,
    employeeFilter,
    departmentFilter,
    salaryRangeFilter,
    customMinSalary,
    customMaxSalary,
    statusFilter,
    paymentDateFilter,
    customFromDate,
    customToDate,
    frequencyFilter,
    methodFilter,
    todayStr,
  ]);

  // 4 Dynamic Summary Cards Calculations (from integer paise)
  const summaryMetrics = useMemo(() => {
    let totalScheduledPaise = 0;
    let paidPaise = 0;
    let overduePaise = 0;

    filteredSchedules.forEach((s) => {
      const paise =
        s.amountPaise !== undefined ? s.amountPaise : Math.round((s.amount || 0) * 100);
      const effStatus = getEffectiveStatus(s);
      totalScheduledPaise += paise;
      if (effStatus === 'paid') {
        paidPaise += paise;
      } else if (effStatus === 'overdue') {
        overduePaise += paise;
      }
    });

    return {
      totalSchedules: filteredSchedules.length,
      totalScheduledPaise,
      paidPaise,
      overduePaise,
    };
  }, [filteredSchedules, todayStr]);

  // Count active secondary filters
  const activeSecondaryFiltersCount = useMemo(() => {
    let count = 0;
    if (salaryRangeFilter !== 'all') count++;
    if (paymentDateFilter !== 'all') count++;
    if (frequencyFilter !== 'all') count++;
    if (methodFilter !== 'all') count++;
    return count;
  }, [salaryRangeFilter, paymentDateFilter, frequencyFilter, methodFilter]);

  // Section 7: Clear Filters Functionality
  // Reset Year to All Years, Month to All Months, Employee to All Employees, Department to All Departments, Status to All Statuses, and additional filters
  const handleClearAllFilters = () => {
    setSearchQuery('');
    setYearFilter('all');
    setMonthFilter('all');
    setEmployeeFilter('all');
    setDepartmentFilter('all');
    setStatusFilter('all');
    setSalaryRangeFilter('all');
    setCustomMinSalary('');
    setCustomMaxSalary('');
    setPaymentDateFilter('all');
    setCustomFromDate('');
    setCustomToDate('');
    setFrequencyFilter('all');
    setMethodFilter('all');
  };

  // Export Filtered Records to CSV
  const handleExportCSV = () => {
    if (!canViewPayroll) {
      showToast('Access denied: You are not authorized to export payroll records.', 'error');
      return;
    }

    if (filteredSchedules.length === 0) {
      showToast('No matching salary payment records to export.', 'warning');
      return;
    }

    const headers = [
      'Employee Name',
      'Employee ID',
      'Department',
      'Designation',
      'Payroll Month',
      'Scheduled Payment Date',
      'Salary Amount (INR)',
      'Payment Frequency',
      'Payment Method',
      'Payment Status',
      'Actual Payment Date',
      'Notes',
    ];

    const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = filteredSchedules.map((s) => {
      const emp = employees.find(
        (e) => e.id === s.employeeId || e.employeeCode === s.employeeCode
      );
      const dept = departments.find(
        (d) => d.id === (s.departmentId || emp?.departmentId)
      );
      const paise =
        s.amountPaise !== undefined ? s.amountPaise : Math.round((s.amount || 0) * 100);
      const effStatus = getEffectiveStatus(s);
      const statusLabel = effStatus.charAt(0).toUpperCase() + effStatus.slice(1);
      const period = getPayrollPeriodYearAndMonth(s);
      const payrollMonthDisplay = period
        ? formatPayrollMonthLabel(period.yearMonth)
        : 'Unassigned Period';

      return [
        escapeCsv(emp?.fullName || s.employeeName),
        escapeCsv(emp?.employeeCode || s.employeeCode),
        escapeCsv(dept?.name || s.departmentName || emp?.departmentName || ''),
        escapeCsv(emp?.designation || ''),
        escapeCsv(payrollMonthDisplay),
        escapeCsv(s.scheduledPaymentDate),
        escapeCsv(formatPaiseToINR(paise)),
        escapeCsv(formatPaymentFrequencyLabel(s.paymentFrequency)),
        escapeCsv(formatPaymentMethodLabel(s.paymentMethod)),
        escapeCsv(statusLabel),
        escapeCsv(s.paidDate || ''),
        escapeCsv(s.notes || ''),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const periodSuffix =
      yearFilter === 'all'
        ? 'all-years'
        : monthFilter === 'all'
          ? yearFilter
          : `${yearFilter}-${monthFilter}`;
    link.setAttribute('download', `salary-payment-records-${periodSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${filteredSchedules.length} salary payment record(s) to CSV.`, 'success');
  };

  // Render Payment Status Badge
  const renderStatusBadge = (effectiveStatus: string) => {
    switch (effectiveStatus) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" /> Paid
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3" /> Overdue
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldCheck className="w-3 h-3" /> Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'scheduled':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-[#206DA6] border border-blue-200">
            <Calendar className="w-3 h-3" /> Scheduled
          </span>
        );
    }
  };

  const selectedDetailSchedule = useMemo(
    () => authorizedSchedules.find((s) => s.id === selectedDetailScheduleId) || null,
    [authorizedSchedules, selectedDetailScheduleId]
  );

  // Default month passed to SchedulePaymentModal when opening from main page
  const scheduleModalDefaultMonth = useMemo(() => {
    if (yearFilter !== 'all' && monthFilter !== 'all') {
      return `${yearFilter}-${monthFilter}`;
    }
    if (yearFilter !== 'all') {
      return `${yearFilter}-${todayStr.substring(5, 7)}`;
    }
    return selectedDate.substring(0, 7);
  }, [yearFilter, monthFilter, todayStr, selectedDate]);

  // If user is not authorized, render RBAC security lock screen
  if (!canViewPayroll) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-card max-w-xl mx-auto my-12">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldLock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#172B4D]">Restricted Compensation Data</h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Access to enterprise payroll schedules, tax withholdings, employee bank accounts, and base salaries is strictly restricted to Administrators and HR Managers per corporate confidentiality compliance.
        </p>
        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 text-left">
          <span className="font-bold text-[#172B4D] block mb-1">Your Current Session:</span>
          <p>Logged in as: <strong>{currentUser.name}</strong> ({currentUser.role})</p>
          <p className="text-slate-400 mt-0.5">Switch your role to <strong>Administrator</strong> or <strong>HR Manager</strong> in the top-right profile menu to test this module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Existing Salary & Payroll Main Page Header (Unchanged) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#172B4D] tracking-tight">
            Salary &amp; Payroll
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Schedule and monitor employee salary payments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCalendarModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#206DA6] bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200/80 rounded-xl shadow-xs transition-all flex-shrink-0"
          >
            <Calendar className="w-4 h-4" />
            <span>View Salary Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingSchedule(null);
              setIsScheduleModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-[10px] shadow-md shadow-[#206DA6]/20 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Salary Payment</span>
          </button>
        </div>
      </div>

      {/* 2. Salary Payment Records & Advanced Filters Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="p-6 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-[#172B4D] tracking-tight">
              Salary Payment Records
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              View, filter, and manage employee salary payment schedules.
            </p>
          </div>

          {/* Header Controls: Search Employee | Filters | Clear Filters | Export CSV */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[210px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Employee..."
                aria-label="Search Employee"
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
                isMoreFiltersOpen || activeSecondaryFiltersCount > 0
                  ? 'bg-blue-50/80 text-[#206DA6] border-blue-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeSecondaryFiltersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#206DA6] text-white">
                  {activeSecondaryFiltersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#206DA6] bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200/80 rounded-xl transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Two-Level Advanced Filter Bar */}
        <div className="p-5 bg-slate-50/70 border-b border-slate-200/80 space-y-4">
          {/* First Row — Main Filters: Select Year | Select Month | All Employees | All Departments | All Payment Statuses | More Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            {/* FILTER 1A — SELECT YEAR */}
            <div>
              <label
                htmlFor="filter-select-year"
                className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                Select Year
              </label>
              <select
                id="filter-select-year"
                aria-label="Select Year"
                value={yearFilter}
                onChange={(e) => handleYearFilterChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              >
                <option value="all">All Years</option>
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* FILTER 1B — SELECT MONTH */}
            <div>
              <label
                htmlFor="filter-select-month"
                className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                Select Month
              </label>
              <select
                id="filter-select-month"
                aria-label="Select Month"
                value={monthFilter}
                disabled={yearFilter === 'all'}
                onChange={(e) => setMonthFilter(e.target.value)}
                title={
                  yearFilter === 'all'
                    ? 'Select a specific year first to filter by month'
                    : 'Select Month'
                }
                className={`w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] transition-colors ${
                  yearFilter === 'all'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white text-slate-700'
                }`}
              >
                <option value="all">All Months</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* FILTER 2 — EMPLOYEE */}
            <div>
              <label
                htmlFor="filter-all-employees"
                className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                All Employees
              </label>
              <select
                id="filter-all-employees"
                aria-label="All Employees"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              >
                <option value="all">All Employees</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} — {emp.employeeCode}
                  </option>
                ))}
              </select>
            </div>

            {/* FILTER 3 — DEPARTMENT */}
            <div>
              <label
                htmlFor="filter-all-departments"
                className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                All Departments
              </label>
              <select
                id="filter-all-departments"
                aria-label="All Departments"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* FILTER 5 — PAYMENT STATUS */}
            <div>
              <label
                htmlFor="filter-payment-status"
                className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                All Payment Statuses
              </label>
              <select
                id="filter-payment-status"
                aria-label="All Payment Statuses"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* More Filters Toggle Button */}
            <div>
              <button
                type="button"
                onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
                className={`w-full flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
                  isMoreFiltersOpen || activeSecondaryFiltersCount > 0
                    ? 'bg-[#206DA6] text-white border-[#206DA6] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>More Filters</span>
                {activeSecondaryFiltersCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isMoreFiltersOpen
                        ? 'bg-white text-[#206DA6]'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    {activeSecondaryFiltersCount}
                  </span>
                )}
                {isMoreFiltersOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                )}
              </button>
            </div>
          </div>

          {/* Second Row — Expandable More Filters Panel */}
          {isMoreFiltersOpen && (
            <div className="pt-3 border-t border-slate-200/80 space-y-3 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* FILTER 4 — SALARY AMOUNT */}
                <div>
                  <label
                    htmlFor="filter-salary-range"
                    className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1"
                  >
                    Salary Range
                  </label>
                  <select
                    id="filter-salary-range"
                    aria-label="Salary Range"
                    value={salaryRangeFilter}
                    onChange={(e) => setSalaryRangeFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                  >
                    <option value="all">All Salary Amounts</option>
                    <option value="below_10000">Below ₹10,000</option>
                    <option value="10000_20000">₹10,000 – ₹20,000</option>
                    <option value="20001_30000">₹20,001 – ₹30,000</option>
                    <option value="30001_50000">₹30,001 – ₹50,000</option>
                    <option value="above_50000">Above ₹50,000</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {/* FILTER 6 — PAYMENT DATE */}
                <div>
                  <label
                    htmlFor="filter-payment-date"
                    className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1"
                  >
                    Payment Date
                  </label>
                  <select
                    id="filter-payment-date"
                    aria-label="Payment Date"
                    value={paymentDateFilter}
                    onChange={(e) => setPaymentDateFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                {/* FILTER 7 — PAYMENT FREQUENCY */}
                <div>
                  <label
                    htmlFor="filter-payment-frequency"
                    className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1"
                  >
                    Payment Frequency
                  </label>
                  <select
                    id="filter-payment-frequency"
                    aria-label="Payment Frequency"
                    value={frequencyFilter}
                    onChange={(e) => setFrequencyFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                  >
                    <option value="all">All Frequencies</option>
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                  </select>
                </div>

                {/* FILTER 8 — PAYMENT METHOD */}
                <div>
                  <label
                    htmlFor="filter-payment-method"
                    className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1"
                  >
                    Payment Method
                  </label>
                  <select
                    id="filter-payment-method"
                    aria-label="Payment Method"
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                  >
                    <option value="all">All Payment Methods</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Conditional Custom Salary Range Inputs */}
              {salaryRangeFilter === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Minimum Salary (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={customMinSalary}
                      onChange={(e) => setCustomMinSalary(e.target.value)}
                      placeholder="e.g. 10000.00"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Maximum Salary (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={customMaxSalary}
                      onChange={(e) => setCustomMaxSalary(e.target.value)}
                      placeholder="e.g. 50000.00"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Custom Date Range Inputs */}
              {paymentDateFilter === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={customToDate}
                      onChange={(e) => setCustomToDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                    />
                  </div>
                </div>
              )}

              {/* Additional Controls: Apply Filters & Clear All Filters */}
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Clear All Filters
                </button>
                <button
                  type="button"
                  onClick={() => setIsMoreFiltersOpen(false)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-xs transition-all"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4 Small Salary Record Summary Cards */}
        <div className="p-5 border-b border-slate-200/80 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Salary Schedules */}
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Salary Schedules
                </span>
                <span className="text-xl font-extrabold text-[#172B4D] mt-1 block">
                  {summaryMetrics.totalSchedules}
                </span>
                <span className="text-[11px] text-slate-400">Matching schedule records</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#206DA6] flex items-center justify-center border border-blue-100">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Total Scheduled Amount */}
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Scheduled Amount
                </span>
                <span className="text-xl font-extrabold text-[#206DA6] font-mono mt-1 block">
                  {formatPaiseToINR(summaryMetrics.totalScheduledPaise)}
                </span>
                <span className="text-[11px] text-slate-400">Combined scheduled payout</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#206DA6] flex items-center justify-center border border-blue-100">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: Paid Amount */}
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Paid Amount
                </span>
                <span className="text-xl font-extrabold text-emerald-700 font-mono mt-1 block">
                  {formatPaiseToINR(summaryMetrics.paidPaise)}
                </span>
                <span className="text-[11px] text-slate-400">Confirmed disbursements</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>

            {/* Card 4: Overdue Amount */}
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Overdue Amount
                </span>
                <span className="text-xl font-extrabold text-rose-600 font-mono mt-1 block">
                  {formatPaiseToINR(summaryMetrics.overduePaise)}
                </span>
                <span className="text-[11px] text-slate-400">Past due unpaid schedules</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Employee Salary Payment Details Table Section */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-[#172B4D] tracking-tight">
              Employee Salary Payment Details
            </h4>
            <span className="text-xs font-semibold text-slate-500">
              Showing {filteredSchedules.length} of {authorizedSchedules.length} record(s)
            </span>
          </div>

          {authorizedSchedules.length === 0 ? (
            /* Empty State 1: No records exist in DB */
            <div className="py-12 px-4 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#206DA6] flex items-center justify-center mx-auto mb-3 border border-blue-100">
                <Calendar className="w-6 h-6" />
              </div>
              <h5 className="text-sm font-bold text-[#172B4D]">
                No Salary Payment Records Found
              </h5>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Schedule salary payments to view employee payment records here.
              </p>
            </div>
          ) : filteredSchedules.length === 0 ? (
            /* Empty State 2: Filters returned no matches */
            <div className="py-12 px-4 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Filter className="w-6 h-6" />
              </div>
              <h5 className="text-sm font-bold text-[#172B4D]">No Matching Records</h5>
              <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md mx-auto">
                Try adjusting or clearing your filters.
              </p>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-xs transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            </div>
          ) : (
            /* 10-Column Salary Payment Records Table */
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-3">Employee ID</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Payroll Month</th>
                    <th className="py-3 px-3">Scheduled Payment Date</th>
                    <th className="py-3 px-3">Salary Amount (₹)</th>
                    <th className="py-3 px-3">Payment Frequency</th>
                    <th className="py-3 px-3">Payment Method</th>
                    <th className="py-3 px-3">Payment Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 text-xs bg-white">
                  {filteredSchedules.map((schedule) => {
                    const emp = employees.find(
                      (e) =>
                        e.id === schedule.employeeId || e.employeeCode === schedule.employeeCode
                    );
                    const dept = departments.find(
                      (d) => d.id === (schedule.departmentId || emp?.departmentId)
                    );
                    const effectiveStatus = getEffectiveStatus(schedule);
                    const paise =
                      schedule.amountPaise !== undefined
                        ? schedule.amountPaise
                        : Math.round((schedule.amount || 0) * 100);
                    const period = getPayrollPeriodYearAndMonth(schedule);

                    return (
                      <tr
                        key={schedule.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* 1. Employee (Profile Photo + Name) */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {emp?.avatar ? (
                              <img
                                src={emp.avatar}
                                alt={emp.fullName}
                                className="w-8 h-8 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#206DA6] font-bold flex items-center justify-center text-xs border border-blue-100 flex-shrink-0">
                                {schedule.employeeName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-[#172B4D] block">
                                {emp?.fullName || schedule.employeeName}
                              </span>
                              {emp?.designation && (
                                <span className="text-[11px] text-slate-400 block">
                                  {emp.designation}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Employee ID */}
                        <td className="py-3 px-3 font-mono font-bold text-slate-600">
                          {emp?.employeeCode || schedule.employeeCode}
                        </td>

                        {/* 3. Department */}
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {dept?.name || schedule.departmentName || emp?.departmentName || '—'}
                        </td>

                        {/* 4. Payroll Month */}
                        <td className="py-3 px-3 font-medium text-slate-800">
                          {period
                            ? formatPayrollMonthLabel(period.yearMonth)
                            : 'Unassigned Period'}
                        </td>

                        {/* 5. Scheduled Payment Date */}
                        <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                          {formatPaymentDateDisplay(schedule.scheduledPaymentDate)}
                        </td>

                        {/* 6. Salary Amount (₹) */}
                        <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                          {formatPaiseToINR(paise)}
                        </td>

                        {/* 7. Payment Frequency */}
                        <td className="py-3 px-3 text-slate-700">
                          {formatPaymentFrequencyLabel(schedule.paymentFrequency)}
                        </td>

                        {/* 8. Payment Method */}
                        <td className="py-3 px-3 text-slate-700">
                          {formatPaymentMethodLabel(schedule.paymentMethod)}
                        </td>

                        {/* 9. Payment Status */}
                        <td className="py-3 px-3">{renderStatusBadge(effectiveStatus)}</td>

                        {/* 10. Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailScheduleId(schedule.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#206DA6] bg-blue-50/70 hover:bg-blue-100 border border-blue-200/80 rounded-xl transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Centered Large Salary Payment Calendar Popup (1100-1250px, max 95vw, max 90vh) */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5">
          {/* Dark Transparent Background Overlay */}
          <div
            className="fixed inset-0 bg-[#0F172A]/55 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsCalendarModalOpen(false)}
          />

          {/* Centered Modal Container */}
          <div
            className="relative z-10 w-full max-w-[1200px] w-[95vw] max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Popup Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#206DA6] flex items-center justify-center border border-blue-100">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#172B4D] tracking-tight">
                    Salary Payment Calendar
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    View scheduled salary payments and payment statuses.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCalendarModalOpen(false)}
                title="Close Calendar"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Popup Body */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#F8FAFC]">
              <SalaryCalendarView onSelectPayroll={onSelectPayroll} />
            </div>

            {/* Sticky Popup Footer */}
            <div className="sticky bottom-0 z-20 flex items-center justify-between px-6 py-3.5 bg-white border-t border-slate-200/80">
              <span className="text-xs text-slate-500">
                Click any calendar date to view or manage scheduled salary payments.
              </span>
              <button
                type="button"
                onClick={() => setIsCalendarModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee-Wise Salary Payment Details Popup */}
      <EmployeeSalaryRecordDetailModal
        isOpen={!!selectedDetailSchedule}
        onClose={() => setSelectedDetailScheduleId(null)}
        schedule={selectedDetailSchedule}
        onEditSchedule={(sched) => {
          setSelectedDetailScheduleId(null);
          setEditingSchedule(sched);
          setIsScheduleModalOpen(true);
        }}
      />

      {/* Schedule Salary Payment Popup (Create or Edit) */}
      <SchedulePaymentModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setEditingSchedule(null);
        }}
        defaultMonth={scheduleModalDefaultMonth}
        defaultDate={selectedDate}
        existingSchedule={editingSchedule}
      />
    </div>
  );
};
