import React from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { SummaryCard } from './SummaryCard';
import { WeeklyAttendanceChart } from './WeeklyAttendanceChart';
import { MonthlyAttendanceChart } from './MonthlyAttendanceChart';
import { DepartmentDonutChart } from './DepartmentDonutChart';
import { LeaveSummaryChart } from './LeaveSummaryChart';
import { EmployeeGrowthChart } from './EmployeeGrowthChart';
import { DashboardWidgets } from './DashboardWidgets';
import { Employee, LeaveRequest } from '../../../types/hrms';
import {
  Users,
  UserCheck,
  CheckCircle2,
  UserX,
  CalendarOff,
  Clock,
  Building2,
  CalendarClock,
  Briefcase,
  DollarSign,
  Calendar,
  Filter,
  ShieldLock,
} from 'lucide-react';

interface HRDashboardProps {
  onNavigateTab: (tab: any) => void;
  onSelectEmployee: (employee: Employee) => void;
  onSelectLeave: (leave: LeaveRequest) => void;
  onOpenCheckIn: () => void;
  onAddEmployee?: () => void;
  onAddShift?: () => void;
}

export const HRDashboard: React.FC<HRDashboardProps> = ({
  onNavigateTab,
  onSelectEmployee,
  onSelectLeave,
  onOpenCheckIn,
  onAddEmployee,
  onAddShift,
}) => {
  const {
    departments,
    dashboardMetrics,
    selectedDepartment,
    setSelectedDepartment,
    selectedDate,
    setSelectedDate,
    settings,
  } = useHRMS();

  const { canViewPayroll } = useAuth();

  return (
    <div className="space-y-6">
      {/* Top Filter Bar: Date Selector & Department Filter */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-velmora flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-white tracking-tight">Workforce Overview</h2>
          <p className="text-xs text-muted">
            Showing operational metrics for{' '}
            <span className="font-semibold text-primary">{selectedDate}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-border rounded-xl px-3 py-1.5 text-xs text-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-transparent font-medium focus:outline-hidden cursor-pointer text-slate-200"
            >
              <option value="all" className="bg-[#161b22] text-white">All Departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id} className="bg-[#161b22] text-white">
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-border rounded-xl px-3 py-1.5 text-xs text-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-medium focus:outline-hidden cursor-pointer font-mono text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* 10 Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* 1. Total Employees */}
        <SummaryCard
          title="Total Employees"
          value={dashboardMetrics.totalEmployees}
          icon={Users}
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/15 border border-indigo-500/30"
          trend={dashboardMetrics.totalEmployees > 0 ? { value: '+1', isPositive: true, label: 'new staff' } : undefined}
          indicator={{ color: dashboardMetrics.totalEmployees > 0 ? 'bg-indigo-400' : 'bg-slate-500', label: dashboardMetrics.totalEmployees > 0 ? 'All Staff' : 'No Staff' }}
          onClick={() => onNavigateTab('employees')}
        />

        {/* 2. Active Employees */}
        <SummaryCard
          title="Active Employees"
          value={dashboardMetrics.activeEmployees}
          icon={UserCheck}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/15 border border-emerald-500/30"
          trend={dashboardMetrics.activeEmployees > 0 ? { value: '100%', isNeutral: true, label: 'eligible' } : undefined}
          indicator={{ color: dashboardMetrics.activeEmployees > 0 ? 'bg-emerald-400' : 'bg-slate-500', label: 'Active Roster' }}
          onClick={() => onNavigateTab('employees')}
        />

        {/* 3. Present Today */}
        <SummaryCard
          title="Present Today"
          value={dashboardMetrics.presentToday}
          icon={CheckCircle2}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/15 border border-emerald-500/30"
          trend={dashboardMetrics.totalEmployees > 0 && dashboardMetrics.presentToday > 0 ? { value: `${Math.round((dashboardMetrics.presentToday / dashboardMetrics.totalEmployees) * 100)}%`, isPositive: true, label: 'on-time' } : undefined}
          indicator={{ color: dashboardMetrics.presentToday > 0 ? 'bg-emerald-400' : 'bg-slate-500', label: 'In Office/Remote' }}
          onClick={() => onNavigateTab('attendance')}
        />

        {/* 4. Absent Today */}
        <SummaryCard
          title="Absent Today"
          value={dashboardMetrics.absentToday}
          icon={UserX}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/15 border border-rose-500/30"
          trend={undefined}
          indicator={{ color: dashboardMetrics.absentToday > 0 ? 'bg-rose-400' : 'bg-emerald-400', label: dashboardMetrics.absentToday > 0 ? 'Needs Follow-up' : 'No Absences' }}
          onClick={() => onNavigateTab('attendance')}
        />

        {/* 5. Employees on Leave */}
        <SummaryCard
          title="Employees on Leave"
          value={dashboardMetrics.onLeaveToday}
          icon={CalendarOff}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/15 border border-purple-500/30"
          trend={undefined}
          indicator={{ color: dashboardMetrics.onLeaveToday > 0 ? 'bg-purple-400' : 'bg-slate-500', label: 'Scheduled Leave' }}
          onClick={() => onNavigateTab('leave')}
        />

        {/* 6. Late Arrivals */}
        <SummaryCard
          title="Late Arrivals"
          value={dashboardMetrics.lateArrivals}
          icon={Clock}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/15 border border-amber-500/30"
          trend={undefined}
          indicator={{ color: dashboardMetrics.lateArrivals > 0 ? 'bg-amber-400' : 'bg-emerald-400', label: dashboardMetrics.lateArrivals > 0 ? '>15m grace' : 'No Delays' }}
          onClick={() => onNavigateTab('attendance')}
        />

        {/* 7. Total Departments */}
        <SummaryCard
          title="Total Departments"
          value={dashboardMetrics.totalDepartments}
          icon={Building2}
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/15 border border-cyan-500/30"
          trend={undefined}
          indicator={{ color: dashboardMetrics.totalDepartments > 0 ? 'bg-cyan-400' : 'bg-slate-500', label: `${dashboardMetrics.totalDepartments} Active Units` }}
          onClick={() => onNavigateTab('departments')}
        />

        {/* 8. Pending Leave Requests */}
        <SummaryCard
          title="Pending Leave"
          value={dashboardMetrics.pendingLeaves}
          icon={CalendarClock}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/15 border border-amber-500/30"
          trend={undefined}
          indicator={{ color: dashboardMetrics.pendingLeaves > 0 ? 'bg-amber-400' : 'bg-emerald-400', label: dashboardMetrics.pendingLeaves > 0 ? 'Review Required' : 'Queue Clear' }}
          onClick={() => onNavigateTab('leave')}
        />

        {/* 9. Employees Working Today */}
        <SummaryCard
          title="Working Today"
          value={dashboardMetrics.workingToday}
          icon={Briefcase}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/15 border border-blue-500/30"
          trend={dashboardMetrics.totalEmployees > 0 && dashboardMetrics.workingToday > 0 ? { value: `${Math.round((dashboardMetrics.workingToday / dashboardMetrics.totalEmployees) * 100)}%`, isPositive: true, label: 'engaged' } : undefined}
          indicator={{ color: dashboardMetrics.workingToday > 0 ? 'bg-emerald-400' : 'bg-slate-500', label: 'Present + Late' }}
          onClick={() => onNavigateTab('attendance')}
        />

        {/* 10. Monthly Payroll Total (Visible only to authorized roles) */}
        {canViewPayroll ? (
          <SummaryCard
            title="Monthly Payroll Total"
            value={dashboardMetrics.monthlyPayrollTotal === 0 ? `${settings.currencySymbol}0.00` : `${settings.currencySymbol}${dashboardMetrics.monthlyPayrollTotal.toLocaleString('en-IN')}`}
            icon={DollarSign}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/15 border border-emerald-500/30"
            trend={undefined}
            indicator={{ color: dashboardMetrics.monthlyPayrollTotal > 0 ? 'bg-emerald-400' : 'bg-slate-500', label: 'Processed Net' }}
            onClick={() => onNavigateTab('payroll')}
          />
        ) : (
          <div className="bg-card/50 rounded-2xl p-4 sm:p-5 border border-dashed border-border flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                  Monthly Payroll Total
                </span>
                <span className="text-lg font-bold text-muted mt-2 block">
                  &bull;&bull;&bull;&bull;&bull;&bull;
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 text-muted border border-border">
                <ShieldLock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted mt-3 pt-3 border-t border-border/40">
              Restricted to Admin / HR Manager
            </p>
          </div>
        )}
      </div>

      {/* Dashboard Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklyAttendanceChart />
        <MonthlyAttendanceChart />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DepartmentDonutChart />
        <LeaveSummaryChart />
        <EmployeeGrowthChart />
      </div>

      {/* Dashboard Widgets Section */}
      <DashboardWidgets
        onSelectEmployee={onSelectEmployee}
        onSelectLeave={onSelectLeave}
        onOpenCheckIn={onOpenCheckIn}
        onNavigateTab={onNavigateTab}
        onAddEmployee={onAddEmployee}
        onAddShift={onAddShift}
      />
    </div>
  );
};
