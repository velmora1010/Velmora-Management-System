import React from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { Employee, LeaveRequest } from '../../../types/hrms';
import { Badge } from '../../common/Badge';
import {
  Clock,
  UserPlus,
  CalendarCheck,
  Cake,
  Award,
  Layers,
  Activity,
  CheckCircle,
  XCircle,
  ChevronRight,
  Plus,
} from 'lucide-react';

interface DashboardWidgetsProps {
  onSelectEmployee: (employee: Employee) => void;
  onSelectLeave: (leave: LeaveRequest) => void;
  onOpenCheckIn: () => void;
  onNavigateTab: (tab: any) => void;
  onAddEmployee?: () => void;
  onAddShift?: () => void;
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({
  onSelectEmployee,
  onSelectLeave,
  onOpenCheckIn,
  onNavigateTab,
  onAddEmployee,
  onAddShift,
}) => {
  const {
    employees,
    attendanceRecords,
    leaveRequests,
    shiftTemplates,
    activityLogs,
    selectedDate,
    approveLeave,
    rejectLeave,
  } = useHRMS();
  const { currentUser, canApproveLeave, canManageEmployees } = useAuth();

  // 1. Today's Attendance list
  const todayAttendance = attendanceRecords.filter((a) => a.date === selectedDate).slice(0, 6);

  // 2. Recent Employees (sorted by joining date desc)
  const recentEmployees = [...employees]
    .sort((a, b) => new Date(b.joiningDate).getTime() - new Date(a.joiningDate).getTime())
    .slice(0, 5);

  // 3. Pending Leaves
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending').slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 2-Column Grid: Today's Attendance & Pending Leaves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget 1: Today's Attendance */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/15 text-primary border border-primary/20">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Today's Attendance</h3>
                  <p className="text-[11px] text-muted">Real-time punch activity ({selectedDate})</p>
                </div>
              </div>
              <button
                onClick={onOpenCheckIn}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Punch Now
              </button>
            </div>

            <div className="divide-y divide-border/40 mt-2 max-h-72 overflow-y-auto">
              {todayAttendance.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center justify-center">
                  <div className="p-3 bg-slate-800 text-slate-400 rounded-xl mb-2 border border-border">
                    <Clock className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-white">No attendance records available.</p>
                  <p className="text-[11px] text-muted mt-0.5">Punch in or record timesheets to see daily logs.</p>
                </div>
              ) : (
                todayAttendance.map((rec) => (
                  <div key={rec.id} className="py-2.5 flex items-center justify-between hover:bg-white/5 px-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <img src={rec.avatar} alt="" className="w-8 h-8 rounded-xl object-cover ring-1 ring-border" />
                      <div>
                        <p className="text-xs font-bold text-white">{rec.employeeName}</p>
                        <p className="text-[11px] text-muted">
                          {rec.departmentName} &bull; <span className="font-mono text-slate-300">{rec.checkInTime || 'No check-in'}</span>
                        </p>
                      </div>
                    </div>
                    <Badge variant={rec.status} size="sm">
                      {rec.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('attendance')}
            className="mt-3 pt-3 border-t border-border w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-white transition-colors"
          >
            Open Full Attendance Register <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Widget 2: Pending Leave Approvals */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pending Leave Approvals</h3>
                  <p className="text-[11px] text-muted">{pendingLeaves.length} applications awaiting decision</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('leave')}
                className="text-xs font-semibold text-primary hover:underline"
              >
                View Board
              </button>
            </div>

            <div className="space-y-2.5 mt-3 max-h-72 overflow-y-auto">
              {pendingLeaves.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center justify-center">
                  <div className="p-3 bg-white/5 text-muted rounded-xl mb-2 border border-border">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-white">No leave requests available.</p>
                  <p className="text-[11px] text-muted mt-0.5">Submitted leave requests will appear here for review.</p>
                </div>
              ) : (
                pendingLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="p-3 bg-black/20 rounded-xl border border-border flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
                  >
                    <div
                      className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                      onClick={() => onSelectLeave(leave)}
                    >
                      <img src={leave.avatar} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-border" />
                      <div className="truncate">
                        <p className="font-bold text-white truncate hover:text-primary transition-colors">{leave.employeeName}</p>
                        <p className="text-[11px] text-muted capitalize">
                          {leave.leaveType} ({leave.daysCount} days &bull; {leave.startDate})
                        </p>
                      </div>
                    </div>

                    {canApproveLeave && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => rejectLeave(leave.id, currentUser.name, 'Quick rejected from dashboard')}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => approveLeave(leave.id, currentUser.name, 'Quick approved from dashboard')}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('leave')}
            className="mt-3 pt-3 border-t border-border w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-white transition-colors"
          >
            Manage All Leave Requests <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3-Column Grid: Recent Employees, Shifts, and Anniversaries/Birthdays */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Widget 3: Recent Employees */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/20">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">New Additions</h3>
              </div>
              <button
                onClick={() => onNavigateTab('employees')}
                className="text-xs font-semibold text-primary hover:underline"
              >
                All ({employees.length})
              </button>
            </div>

            {recentEmployees.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="p-3 bg-white/5 text-muted rounded-xl mb-2 border border-border">
                  <UserPlus className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-white">No employees added yet.</p>
                <p className="text-[11px] text-muted mt-0.5">Start building your company workforce.</p>
                {onAddEmployee && canManageEmployees && (
                  <button
                    onClick={onAddEmployee}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Employee
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {recentEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => onSelectEmployee(emp)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={emp.avatar} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-border" />
                      <div>
                        <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                          {emp.fullName}
                        </p>
                        <p className="text-[11px] text-muted">{emp.designation}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-medium text-slate-400 bg-black/30 px-2 py-0.5 rounded border border-border">
                      {emp.joiningDate}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Widget 4: Today's Shift Schedule */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Shift Rotations</h3>
              </div>
              <button
                onClick={() => onNavigateTab('shifts')}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Roster
              </button>
            </div>

            {shiftTemplates.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="p-3 bg-white/5 text-muted rounded-xl mb-2 border border-border">
                  <Layers className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-white">No shifts configured yet.</p>
                <p className="text-[11px] text-muted mt-0.5">Configure working shifts and daily rotations.</p>
                {onAddShift && (
                  <button
                    onClick={onAddShift}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Shift
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {shiftTemplates.map((shift) => {
                  const assignedCount = employees.filter((e) => e.shiftId === shift.id).length;
                  return (
                    <div
                      key={shift.id}
                      className="p-3 rounded-xl border border-border bg-black/20 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-8 rounded-full"
                          style={{ backgroundColor: shift.color }}
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{shift.name}</p>
                          <p className="text-[11px] text-muted font-mono">
                            {shift.startTime} - {shift.endTime}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-white bg-white/5 px-2.5 py-1 rounded-lg border border-border">
                        {assignedCount} Staff
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Widget 5: Celebrations & Milestones (Birthdays & Anniversaries) */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pink-500/15 text-pink-400 border border-pink-500/20">
                  <Cake className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Birthdays & Milestones</h3>
              </div>
              <span className="text-[11px] font-semibold text-muted">Calendar</span>
            </div>

            {employees.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="p-3 bg-white/5 text-muted rounded-xl mb-2 border border-border">
                  <Cake className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-white">No upcoming employee birthdays.</p>
                <p className="text-[11px] text-muted mt-0.5">Employee birthdays and work milestones will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {employees.slice(0, 3).map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <img src={emp.avatar} alt="" className="w-8 h-8 rounded-xl object-cover ring-1 ring-border" />
                      <div>
                        <p className="font-bold text-white text-xs">{emp.fullName}</p>
                        <p className="text-[11px] text-muted">{emp.departmentName} &bull; {emp.dateOfBirth}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Widget 7: Recent HR Activity Audit Trail */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora">
        <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Recent HR Activity Trail</h3>
              <p className="text-[11px] text-muted">Real-time operational audit log</p>
            </div>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 bg-black/30 rounded text-slate-300 border border-border">
            {activityLogs.length} events logged
          </span>
        </div>

        <div className="divide-y divide-border">
          {activityLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No recent HR activity logged yet. New employee hires, leave approvals, and punches will create real-time audit records.
            </div>
          ) : (
            activityLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-3 truncate">
                  <img src={log.actorAvatar} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0 ring-1 ring-border" />
                  <div className="truncate">
                    <span className="font-bold text-white">{log.actorName} </span>
                    <span className="text-muted">{log.action} </span>
                    <span className="font-semibold text-slate-200">{log.target}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-white/10"
                    style={{
                      backgroundColor: `${log.badgeColor}25`,
                      color: log.badgeColor,
                    }}
                  >
                    {log.module}
                  </span>
                  <span className="text-[11px] text-muted font-mono hidden sm:inline">
                    {log.timestamp}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
