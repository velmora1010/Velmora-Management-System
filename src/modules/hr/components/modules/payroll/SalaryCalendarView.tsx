import React, { useState, useMemo } from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { PayrollPaymentSchedule, PayrollRecord } from '../../../types/hrms';
import { SchedulePaymentModal } from '../../modals/SchedulePaymentModal';
import { SalaryScheduleDetailModal } from '../../modals/SalaryScheduleDetailModal';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';

interface SalaryCalendarViewProps {
  onSelectPayroll?: (record: PayrollRecord) => void;
}

export const SalaryCalendarView: React.FC<SalaryCalendarViewProps> = ({ onSelectPayroll }) => {
  const { employees, departments, payrollRecords, payrollSchedules, settings } = useHRMS();
  const { currentUser, canViewPayroll } = useAuth();

  // Current company date in Asia/Kolkata
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }, []);

  const todayYear = parseInt(todayStr.substring(0, 4), 10);
  const todayMonthIndex = parseInt(todayStr.substring(5, 7), 10) - 1;

  // Calendar View State: Year and Month index (0..11)
  const [viewYear, setViewYear] = useState<number>(todayYear);
  const [viewMonthIndex, setViewMonthIndex] = useState<number>(todayMonthIndex);

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal states
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalDate, setScheduleModalDate] = useState<string | undefined>(undefined);
  const [editingSchedule, setEditingSchedule] = useState<PayrollPaymentSchedule | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('');

  // Active employees
  const activeEmployees = employees.filter((e) => e.status !== 'terminated');

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (viewMonthIndex === 0) {
      setViewMonthIndex(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonthIndex === 11) {
      setViewMonthIndex(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonthIndex((m) => m + 1);
    }
  };

  const handleToday = () => {
    setViewYear(todayYear);
    setViewMonthIndex(todayMonthIndex);
  };

  // Formatted current viewing month string: "YYYY-MM"
  const currentMonthKey = `${viewYear}-${String(viewMonthIndex + 1).padStart(2, '0')}`;

  const monthName = new Date(viewYear, viewMonthIndex, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Calculate effective status helper (do not overwrite paid or approved records when deriving overdue)
  const getEffectiveStatus = (schedule: PayrollPaymentSchedule) => {
    if (schedule.status === 'paid') return 'paid';
    if (schedule.status === 'approved') return 'approved';
    if (schedule.scheduledPaymentDate < todayStr) return 'overdue';
    return schedule.status;
  };

  const getStatusCardStyle = (effStatus: string) => {
    switch (effStatus) {
      case 'paid':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'overdue':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'approved':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'pending':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'scheduled':
      default:
        return 'bg-blue-50 text-[#206DA6] border-blue-200';
    }
  };

  // Deduplicated schedules by distinct ID & (employeeId + scheduledPaymentDate) with RBAC filter
  const authorizedSchedules = useMemo(() => {
    const seenIds = new Set<string>();
    const seenEmpDates = new Set<string>();
    const result: PayrollPaymentSchedule[] = [];

    for (const sched of payrollSchedules) {
      if (!sched || !sched.id || !sched.employeeId || !sched.scheduledPaymentDate) continue;
      if (currentUser.role === 'employee' && sched.employeeId !== currentUser.employeeId) {
        continue;
      }
      const empDateKey = `${sched.employeeId}__${sched.scheduledPaymentDate}`;
      if (seenIds.has(sched.id) || seenEmpDates.has(empDateKey)) {
        continue;
      }
      seenIds.add(sched.id);
      seenEmpDates.add(empDateKey);
      result.push(sched);
    }
    return result;
  }, [payrollSchedules, currentUser]);

  // Filtered schedules for calendar rendering
  const filteredSchedules = useMemo(() => {
    return authorizedSchedules.filter((s) => {
      if (employeeFilter !== 'all' && s.employeeId !== employeeFilter) return false;
      if (departmentFilter !== 'all' && s.departmentId !== departmentFilter) return false;
      if (statusFilter !== 'all') {
        const eff = getEffectiveStatus(s);
        if (eff !== statusFilter) return false;
      }
      return true;
    });
  }, [authorizedSchedules, employeeFilter, departmentFilter, statusFilter, todayStr]);

  // Distinct status counts for current viewing month
  const monthStatusCounts = useMemo(() => {
    const inMonth = filteredSchedules.filter((s) => s.scheduledPaymentDate.startsWith(currentMonthKey));
    const counts = {
      scheduled: 0,
      pending: 0,
      overdue: 0,
      approved: 0,
      paid: 0,
      total: inMonth.length,
    };
    inMonth.forEach((s) => {
      const eff = getEffectiveStatus(s);
      if (eff in counts) {
        counts[eff as keyof typeof counts]++;
      }
    });
    return counts;
  }, [filteredSchedules, currentMonthKey, todayStr]);

  // Generate 7-column calendar grid cells (Sunday = 0 to Saturday = 6)
  const calendarCells = useMemo(() => {
    const cells: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      schedules: PayrollPaymentSchedule[];
    }> = [];

    const firstDayOfWeek = new Date(viewYear, viewMonthIndex, 1).getDay(); // 0 = Sunday
    const daysInCurrentMonth = new Date(viewYear, viewMonthIndex + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonthIndex, 0).getDate();

    // Trailing days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(viewYear, viewMonthIndex - 1, dayNum);
      const prevMonthStr = String(prevDate.getMonth() + 1).padStart(2, '0');
      const prevYearStr = prevDate.getFullYear();
      const dateStr = `${prevYearStr}-${prevMonthStr}-${String(dayNum).padStart(2, '0')}`;
      const daySchedules = filteredSchedules.filter((s) => s.scheduledPaymentDate === dateStr);
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        schedules: daySchedules,
      });
    }

    // Days in current month
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const dateStr = `${viewYear}-${String(viewMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const daySchedules = filteredSchedules.filter((s) => s.scheduledPaymentDate === dateStr);
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        schedules: daySchedules,
      });
    }

    // Leading days from next month to complete standard grid (35 or 42 cells)
    const totalCellsNeeded = cells.length <= 35 ? 35 : 42;
    const remaining = totalCellsNeeded - cells.length;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(viewYear, viewMonthIndex + 1, dayNum);
      const nextMonthStr = String(nextDate.getMonth() + 1).padStart(2, '0');
      const nextYearStr = nextDate.getFullYear();
      const dateStr = `${nextYearStr}-${nextMonthStr}-${String(dayNum).padStart(2, '0')}`;
      const daySchedules = filteredSchedules.filter((s) => s.scheduledPaymentDate === dateStr);
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        schedules: daySchedules,
      });
    }

    return cells;
  }, [viewYear, viewMonthIndex, filteredSchedules, todayStr]);

  // Click calendar date: if schedules exist on that date, open details popup; if empty, open Schedule Salary Payment popup with date populated
  const handleDateClick = (dateStr: string) => {
    setSelectedCalendarDate(dateStr);
    const existing = authorizedSchedules.filter((s) => s.scheduledPaymentDate === dateStr);
    if (existing.length > 0) {
      setIsDetailModalOpen(true);
    } else {
      handleOpenScheduleModal(dateStr);
    }
  };

  const handleOpenScheduleModal = (dateStr?: string) => {
    setEditingSchedule(null);
    setScheduleModalDate(dateStr || todayStr);
    setIsScheduleModalOpen(true);
  };

  const handleEditSchedule = (schedule: PayrollPaymentSchedule) => {
    setIsDetailModalOpen(false);
    setEditingSchedule(schedule);
    setIsScheduleModalOpen(true);
  };

  const schedulesForSelectedDate = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return authorizedSchedules.filter((s) => s.scheduledPaymentDate === selectedCalendarDate);
  }, [authorizedSchedules, selectedCalendarDate]);

  return (
    <div className="space-y-4">
      {/* Controls & Filters Bar */}
      <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Month / Year Navigator */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 text-xs font-bold text-[#172B4D] min-w-32 text-center select-none font-mono">
              {monthName}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
          >
            Today
          </button>

          {/* Status Legend Pills with Accurate Counts */}
          <div className="hidden xl:flex items-center gap-1.5 pl-2 text-[11px] font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#206DA6] border border-blue-200">
              Scheduled ({monthStatusCounts.scheduled})
            </span>
            <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
              Pending ({monthStatusCounts.pending})
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              Overdue ({monthStatusCounts.overdue})
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              Approved ({monthStatusCounts.approved})
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Paid ({monthStatusCounts.paid})
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Employee Filter */}
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="all">All Employees</option>
            {activeEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName} ({emp.employeeCode})
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Payment Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="all">All Payment Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>

          {/* Schedule Salary Payment Action */}
          <button
            type="button"
            onClick={() => handleOpenScheduleModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-[10px] shadow-md shadow-[#206DA6]/20 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Salary Payment</span>
          </button>
        </div>
      </div>

      {/* 7-Column Monthly Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Calendar Day Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider text-center py-2.5">
          <div className="text-rose-600">Sunday</div>
          <div>Monday</div>
          <div>Tuesday</div>
          <div>Wednesday</div>
          <div>Thursday</div>
          <div>Friday</div>
          <div className="text-slate-400">Saturday</div>
        </div>

        {/* Calendar Grid Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-100/40">
          {calendarCells.map((cell) => {
            const hasSchedules = cell.schedules.length > 0;

            return (
              <div
                key={cell.dateStr}
                data-date={cell.dateStr}
                onClick={() => handleDateClick(cell.dateStr)}
                className={`min-h-26 p-2 flex flex-col justify-between cursor-pointer transition-all ${
                  cell.isCurrentMonth ? 'bg-white hover:bg-slate-50/90' : 'bg-slate-50/60 hover:bg-slate-100/70 text-slate-400'
                } ${cell.isToday ? 'ring-2 ring-inset ring-[#206DA6] bg-blue-50/20' : ''}`}
              >
                {/* Cell Header: Date Number & Badge */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`text-xs font-bold font-mono inline-flex items-center justify-center ${
                      cell.isToday
                        ? 'w-6 h-6 rounded-full bg-[#206DA6] text-white shadow-xs'
                        : cell.isCurrentMonth
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {hasSchedules && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-[#206DA6] border border-slate-200">
                      {cell.schedules.length}
                    </span>
                  )}
                </div>

                {/* Scheduled Payment Indicators & Employee Event Cards */}
                <div className="flex-1 space-y-1 overflow-hidden">
                  {cell.schedules.slice(0, 2).map((sched) => {
                    const effStatus = getEffectiveStatus(sched);
                    const badgeStyles = getStatusCardStyle(effStatus);
                    const matchingVoucher = payrollRecords.find(
                      (p) => p.employeeId === sched.employeeId && p.month === sched.payrollMonth
                    );
                    const validAmount = matchingVoucher ? matchingVoucher.netSalary : sched.amount;

                    return (
                      <div
                        key={sched.id}
                        className={`text-[10px] font-semibold p-1 rounded-lg border truncate ${badgeStyles}`}
                        title={`${sched.employeeName} — ${sched.scheduledPaymentDate} — ${effStatus.toUpperCase()}`}
                      >
                        <div className="flex items-center justify-between gap-1 truncate">
                          <span className="truncate font-bold">{sched.employeeName}</span>
                          <span className="font-mono text-[9px] uppercase font-bold">{effStatus}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[9px] opacity-85 mt-0.5 font-mono">
                          <span>{sched.scheduledPaymentDate}</span>
                          {canViewPayroll && validAmount > 0 && (
                            <span className="font-bold">
                              {settings.currencySymbol}{validAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {cell.schedules.length > 2 && (
                    <div className="text-[9px] font-bold text-[#206DA6] text-center bg-blue-50/70 rounded py-0.5">
                      +{cell.schedules.length - 2} more scheduled
                    </div>
                  )}
                </div>

                {!hasSchedules && cell.isCurrentMonth && <div className="h-2" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <SchedulePaymentModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setEditingSchedule(null);
        }}
        defaultDate={scheduleModalDate}
        defaultMonth={currentMonthKey}
        existingSchedule={editingSchedule}
      />

      <SalaryScheduleDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        selectedDateStr={selectedCalendarDate}
        schedules={schedulesForSelectedDate}
        onOpenScheduleModal={(d) => {
          setIsDetailModalOpen(false);
          handleOpenScheduleModal(d);
        }}
        onEditSchedule={handleEditSchedule}
        onViewPayroll={onSelectPayroll}
      />
    </div>
  );
};
