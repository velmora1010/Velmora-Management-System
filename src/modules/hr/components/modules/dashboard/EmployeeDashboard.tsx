import React, { useMemo } from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { useWorkAssignment } from '../../../context/WorkAssignmentContext';
import {
  Clock,
  CalendarCheck,
  ClipboardList,
  CalendarDays,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Briefcase,
  User,
  Package,
} from 'lucide-react';
import { resolveEmployeeShift, formatTime12Hour } from '../../../utils/attendanceCalculator';
import { doesAssignmentBelongToEmployee, doesLeaveBelongToEmployee } from '../../../utils/employeeIdentity';
import { getKolkataCurrentYearMonth } from '../../../types/welfare';
import { loadWelfareSelections, doesSelectionMatchEmployee } from '../../../utils/welfareStorage';
import { Badge } from '../../common/Badge';
import { Avatar } from '../../common/Avatar';

interface EmployeeDashboardProps {
  onNavigateTab: (tab: any) => void;
  onSelectLeave?: (leave: any) => void;
  onOpenCheckIn: () => void;
  onOpenMyProfile?: () => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
  onNavigateTab,
  onOpenCheckIn,
}) => {
  const { employees, attendanceRecords, leaveRequests, selectedDate, shiftTemplates } = useHRMS();
  const { currentUser, linkedEmployee } = useAuth();
  const { taskAssignments, acknowledgeTask, completeTask } = useWorkAssignment();

  const emp = linkedEmployee || employees.find((e) => e.id === currentUser.employeeId);

  // Today's attendance punch for authenticated employee
  const todayAttendance = useMemo(() => {
    if (!emp) return null;
    return (
      attendanceRecords.find(
        (a) =>
          (a.employeeId === emp.id ||
            (a.employeeCode && emp.employeeCode && a.employeeCode.toUpperCase() === emp.employeeCode.toUpperCase())) &&
          a.date === selectedDate
      ) || null
    );
  }, [emp, attendanceRecords, selectedDate]);

  // Assigned Shift
  const shift = useMemo(() => {
    if (!emp) return null;
    return resolveEmployeeShift(emp, shiftTemplates);
  }, [emp, shiftTemplates]);

  // Personal Work Tasks
  const myTasks = useMemo(() => {
    if (!emp) return [];
    return taskAssignments.filter((a) => doesAssignmentBelongToEmployee(a, emp));
  }, [emp, taskAssignments]);

  const pendingTasks = useMemo(() => {
    return myTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  }, [myTasks]);

  // Personal Leaves
  const myLeaves = useMemo(() => {
    if (!emp) return [];
    return leaveRequests.filter((l) => doesLeaveBelongToEmployee(l, emp));
  }, [emp, leaveRequests]);

  const pendingLeaves = useMemo(() => {
    return myLeaves.filter((l) => l.status === 'pending');
  }, [myLeaves]);

  // Monthly Welfare Selection
  const currentPeriod = useMemo(() => getKolkataCurrentYearMonth(), []);
  const welfareSelection = useMemo(() => {
    if (!emp) return null;
    const all = loadWelfareSelections();
    return (
      all.find(
        (s) =>
          doesSelectionMatchEmployee(s, emp) &&
          s.welfare_year === currentPeriod.year &&
          s.welfare_month === currentPeriod.month &&
          s.selection_status !== 'cancelled'
      ) || null
    );
  }, [emp, currentPeriod]);

  const isCheckedIn = !!todayAttendance?.checkInTime && !todayAttendance?.checkOutTime;
  const isCheckedOut = !!todayAttendance?.checkInTime && !!todayAttendance?.checkOutTime;

  if (!emp) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border">
        <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Account Linking Required</h3>
        <p className="text-sm text-muted max-w-md">
          Your account is not linked to an employee profile. Please contact HR.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-card to-card/80 p-6 rounded-2xl border border-border shadow-velmora flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar src={emp.avatar} name={emp.fullName} size="xl" className="ring-2 ring-primary/40 shadow-md" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Welcome back, {emp.fullName}
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {emp.employeeCode}
              </span>
            </div>
            <p className="text-xs text-muted mt-1">
              {emp.designation} &bull; <span className="text-slate-300">{emp.departmentName}</span> &bull; {emp.workLocation}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCheckIn}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
            isCheckedOut
              ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'
              : isCheckedIn
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>
            {isCheckedOut
              ? `Checked Out (${formatTime12Hour(todayAttendance?.checkOutTime || '')})`
              : isCheckedIn
              ? `Checked In (${formatTime12Hour(todayAttendance?.checkInTime || '')}) - Clock Out`
              : 'Clock In Today'}
          </span>
        </button>
      </div>

      {/* Personal Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Punch */}
        <div
          onClick={() => onNavigateTab('attendance')}
          className="bg-card p-5 rounded-2xl border border-border shadow-velmora hover:border-slate-600 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Today's Attendance</span>
            <div className={`p-2.5 rounded-xl ${isCheckedIn || isCheckedOut ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-muted border border-border'}`}>
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-white">
              {isCheckedOut ? 'Checked Out' : isCheckedIn ? 'Checked In' : 'Not Marked'}
            </div>
            <p className="text-[11px] text-muted mt-1">
              {todayAttendance?.checkInTime ? `In: ${formatTime12Hour(todayAttendance.checkInTime)}` : 'No punch recorded yet'}
            </p>
          </div>
        </div>

        {/* 2. Assigned Shift */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">My Shift</span>
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-white truncate">{shift?.name || 'General Shift'}</div>
            <p className="text-[11px] text-muted font-mono mt-1">
              {shift ? `${shift.startTime} - ${shift.endTime}` : '09:00 - 18:00'}
            </p>
          </div>
        </div>

        {/* 3. Assigned Work Tasks */}
        <div
          onClick={() => onNavigateTab('assigned-works')}
          className="bg-card p-5 rounded-2xl border border-border shadow-velmora hover:border-slate-600 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Assigned Works</span>
            <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{pendingTasks.length}</div>
            <p className="text-[11px] text-muted mt-1">
              {pendingTasks.length === 0 ? 'All tasks completed' : 'Pending work assignments'}
            </p>
          </div>
        </div>

        {/* 4. Welfare Benefit */}
        <div
          onClick={() => onNavigateTab('product-select')}
          className="bg-card p-5 rounded-2xl border border-border shadow-velmora hover:border-slate-600 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Monthly Welfare</span>
            <div className="p-2.5 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/20">
              <HeartHandshake className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-white truncate">
              {welfareSelection ? welfareSelection.product_name : 'Not Selected'}
            </div>
            <p className="text-[11px] text-muted mt-1 capitalize">
              {welfareSelection ? `Status: ${welfareSelection.selection_status}` : 'Click to select product'}
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Active Tasks & Recent Leaves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget 1: My Active Work Assignments */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">My Assigned Tasks</h3>
                  <p className="text-[11px] text-muted">Daily instructions & tasks from HR</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('assigned-works')}
                className="text-xs font-semibold text-primary hover:underline"
              >
                View All ({myTasks.length})
              </button>
            </div>

            <div className="space-y-2.5">
              {pendingTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">
                  No pending work assignments. You're completely up to date!
                </div>
              ) : (
                pendingTasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-black/20 rounded-xl border border-border flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="truncate flex-1">
                      <p className="font-bold text-white truncate">{task.taskTitle}</p>
                      <p className="text-[11px] text-muted truncate mt-0.5">{task.taskBrief || 'Assigned task'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!task.firstViewedAt && (
                        <button
                          onClick={() => acknowledgeTask(task.id, emp.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold hover:bg-indigo-500/25 transition-colors"
                        >
                          Seen / OK
                        </button>
                      )}
                      <button
                        onClick={() => completeTask(task.id, emp.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold hover:bg-emerald-500/25 transition-colors"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('assigned-works')}
            className="mt-3 pt-3 border-t border-border w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-white transition-colors"
          >
            Open Assigned Works Board <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Widget 2: My Leave Applications */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">My Leave Requests</h3>
                  <p className="text-[11px] text-muted">Submitted applications & review statuses</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('leave')}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Apply Leave
              </button>
            </div>

            <div className="space-y-2.5">
              {myLeaves.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">
                  No leave requests submitted yet. Use "Apply Leave" to submit time-off.
                </div>
              ) : (
                myLeaves.slice(0, 4).map((leave) => (
                  <div
                    key={leave.id}
                    className="p-3 bg-black/20 rounded-xl border border-border flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="truncate flex-1">
                      <p className="font-bold text-white truncate capitalize">
                        {leave.leaveType} ({leave.daysCount} {leave.daysCount === 1 ? 'day' : 'days'})
                      </p>
                      <p className="text-[11px] text-muted truncate mt-0.5">
                        {leave.startDate} to {leave.endDate} &bull; {leave.reason}
                      </p>
                    </div>
                    <Badge variant={leave.status} size="sm">
                      {leave.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('leave')}
            className="mt-3 pt-3 border-t border-border w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-white transition-colors"
          >
            Manage Time-Off Applications <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
