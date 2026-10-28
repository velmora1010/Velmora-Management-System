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
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-[#206DA6]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#172B4D]">Today's Attendance</h3>
                  <p className="text-[11px] text-[#64748B]">Real-time punch activity ({selectedDate})</p>
                </div>
              </div>
              <button
                onClick={onOpenCheckIn}
                className="text-xs font-semibold text-[#206DA6] hover:underline"
              >
                + Punch Now
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-2 max-h-72 overflow-y-auto">
              {todayAttendance.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center justify-center">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-xl mb-2">
                    <Clock className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-[#172B4D]">No attendance records available.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Punch in or record timesheets to see daily logs.</p>
                </div>
              ) : (
                todayAttendance.map((rec) => (
                  <div key={rec.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50/70 px-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <img src={rec.avatar} alt="" className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200" />
                      <div>
                        <p className="text-xs font-bold text-[#172B4D]">{rec.employeeName}</p>
                        <p className="text-[11px] text-slate-500">
                          {rec.departmentName} &bull; <span className="font-mono text-slate-700">{rec.checkInTime || 'No check-in'}</span>
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
            className="mt-3 pt-3 border-t border-slate-100 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-[#206DA6] hover:text-[#1A5987]"
          >
            Open Full Attendance Register <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Widget 2: Pending Leave Approvals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#172B4D]">Pending Leave Approvals</h3>
                  <p className="text-[11px] text-[#64748B]">{pendingLeaves.length} applications awaiting decision</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('leave')}
                className="text-xs font-semibold text-[#206DA6] hover:underline"
              >
                View Board
              </button>
            </div>

            <div className="space-y-2.5 mt-3 max-h-72 overflow-y-auto">
              {pendingLeaves.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center justify-center">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-xl mb-2">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-[#172B4D]">No leave requests available.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Submitted leave requests will appear here for review.</p>
                </div>
              ) : (
                pendingLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div
                      className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                      onClick={() => onSelectLeave(leave)}
                    >
                      <img src={leave.avatar} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-white" />
                      <div className="truncate">
                        <p className="font-bold text-[#172B4D] truncate hover:text-[#206DA6]">{leave.employeeName}</p>
                        <p className="text-[11px] text-slate-500 capitalize">
                          {leave.leaveType} ({leave.daysCount} days &bull; {leave.startDate})
                        </p>
                      </div>
                    </div>

                    {canApproveLeave && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => rejectLeave(leave.id, currentUser.name, 'Quick rejected from dashboard')}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => approveLeave(leave.id, currentUser.name, 'Quick approved from dashboard')}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
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
            className="mt-3 pt-3 border-t border-slate-100 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-[#206DA6] hover:text-[#1A5987]"
          >
            Manage All Leave Requests <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3-Column Grid: Recent Employees, Shifts, and Anniversaries/Birthdays */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Widget 3: Recent Employees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-50 text-[#18A999]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#172B4D]">New Additions</h3>
              </div>
              <button
                onClick={() => onNavigateTab('employees')}
                className="text-xs font-semibold text-[#206DA6] hover:underline"
              >
                All ({employees.length})
              </button>
            </div>

            {recentEmployees.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="p-3 bg-slate-50 text-slate-400 rounded-xl mb-2">
                  <UserPlus className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#172B4D]">No employees added yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Start building your company workforce.</p>
                {onAddEmployee && canManageEmployees && (
                  <button
                    onClick={onAddEmployee}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#206DA6] hover:underline"
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
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={emp.avatar} alt="" className="w-9 h-9 rounded-xl object-cover" />
                      <div>
                        <p className="text-xs font-bold text-[#172B4D] group-hover:text-[#206DA6] transition-colors">
                          {emp.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500">{emp.designation}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      {emp.joiningDate}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Widget 4: Today's Shift Schedule */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#172B4D]">Shift Rotations</h3>
              </div>
              <button
                onClick={() => onNavigateTab('shifts')}
                className="text-xs font-semibold text-[#206DA6] hover:underline"
              >
                Roster
              </button>
            </div>

            {shiftTemplates.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="p-3 bg-slate-50 text-slate-400 rounded-xl mb-2">
                  <Layers className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#172B4D]">No shifts configured yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Configure working shifts and daily rotations.</p>
                {onAddShift && (
                  <button
                    onClick={onAddShift}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#206DA6] hover:underline"
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
                      className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-8 rounded-full"
                          style={{ backgroundColor: shift.color }}
                        />
                        <div>
                          <p className="text-xs font-bold text-[#172B4D]">{shift.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {shift.startTime} - {shift.endTime}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
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
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
                  <Cake className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#172B4D]">Birthdays & Milestones</h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">Calendar</span>
            </div>

            {employees.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="p-3 bg-slate-50 text-slate-400 rounded-xl mb-2">
                  <Cake className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#172B4D]">No upcoming employee birthdays.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Employee birthdays and work milestones will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {employees.slice(0, 3).map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <img src={emp.avatar} alt="" className="w-8 h-8 rounded-xl object-cover" />
                      <div>
                        <p className="font-bold text-[#172B4D] text-xs">{emp.fullName}</p>
                        <p className="text-[11px] text-slate-400">{emp.departmentName} &bull; {emp.dateOfBirth}</p>
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
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-[#206DA6]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#172B4D]">Recent HR Activity Trail</h3>
              <p className="text-[11px] text-[#64748B]">Real-time operational audit log</p>
            </div>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-600">
            {activityLogs.length} events logged
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {activityLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No recent HR activity logged yet. New employee hires, leave approvals, and punches will create real-time audit records.
            </div>
          ) : (
            activityLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-3 truncate">
                  <img src={log.actorAvatar} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-[#172B4D]">{log.actorName} </span>
                    <span className="text-slate-500">{log.action} </span>
                    <span className="font-semibold text-slate-800">{log.target}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${log.badgeColor}15`,
                      color: log.badgeColor,
                    }}
                  >
                    {log.module}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
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
