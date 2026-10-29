import React, { useState, useMemo } from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { AttendanceRecord, Employee, AttendanceStatus, ShiftTemplate } from '../../../types/hrms';
import { Badge } from '../../common/Badge';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  AlertTriangle,
  UserX,
  CalendarOff,
  Edit2,
  Download,
  Hourglass,
  Layers,
  Shield,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import {
  resolveEmployeeShift,
  formatScheduledTimeRange,
  formatTime12Hour,
  evaluateEmployeeAttendanceStatus,
  getAttendanceStatusLabel,
  getCompanyTodayDate,
} from '../../../utils/attendanceCalculator';
import { AttendanceStatusModal, getStatusConfig } from '../../modals/AttendanceStatusModal';
import { useToast } from '../../../context/ToastContext';

interface AttendanceModuleProps {
  onOpenCheckIn: () => void;
  onOpenManualEntry: (record?: AttendanceRecord, initialStatus?: AttendanceStatus) => void;
  onSelectEmployee: (employee: Employee) => void;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  onOpenCheckIn,
  onOpenManualEntry,
  onSelectEmployee,
}) => {
  const {
    employees,
    departments,
    shiftTemplates,
    attendanceRecords,
    leaveRequests,
    selectedDate,
    setSelectedDate,
    selectedDepartment,
    setSelectedDepartment,
    saveAttendanceRecord,
  } = useHRMS();

  const { canManageEmployees, currentUser, linkedEmployee } = useAuth();
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalData, setStatusModalData] = useState<{
    employee: Employee;
    record: AttendanceRecord;
    shift: ShiftTemplate;
    currentStatus: AttendanceStatus;
  } | null>(null);

  // Scoped employees: Only the verified authenticated employee when not Admin/HR
  const scopedEmployees = useMemo(() => {
    if (canManageEmployees) return employees;
    if (linkedEmployee) return [linkedEmployee];
    const found = employees.find((e) => e.id === currentUser.employeeId);
    return found ? [found] : [];
  }, [canManageEmployees, employees, linkedEmployee, currentUser.employeeId]);

  // Daily records for selected date
  const dateRecords = useMemo(
    () => attendanceRecords.filter((a) => a.date === selectedDate),
    [attendanceRecords, selectedDate]
  );

  // Combine employees with dynamic evaluation of their attendance status
  // STRICT RULE: Actual punch times (checkInTime, checkOutTime) are NEVER fabricated.
  const combinedList = useMemo(() => {
    return scopedEmployees.map((emp) => {
      const realRecord = dateRecords.find((r) => r.employeeId === emp.id);
      const shift = resolveEmployeeShift(emp, shiftTemplates);

      const evaluation = evaluateEmployeeAttendanceStatus({
        employee: emp,
        dateStr: selectedDate,
        record: realRecord,
        shift,
        leaveRequests,
      });

      const effectiveRecord: AttendanceRecord = realRecord || {
        id: `virtual-${emp.id}-${selectedDate}`,
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        departmentId: emp.departmentId,
        departmentName: emp.departmentName,
        avatar: emp.avatar,
        date: selectedDate,
        shiftId: shift.id,
        shiftName: shift.name,
        scheduledStartTime: shift.startTime,
        scheduledEndTime: shift.endTime,
        status: evaluation.status,
        checkInTime: undefined,
        checkOutTime: undefined,
        workHours: 0,
        workHoursFormatted: evaluation.workHoursFormatted,
        lateMinutes: evaluation.lateMinutes,
        notes: evaluation.notes,
      };

      return {
        emp,
        shift,
        scheduledTime: formatScheduledTimeRange(shift),
        record: effectiveRecord,
        status: evaluation.status,
        isLate: evaluation.isLate,
        lateMinutes: evaluation.lateMinutes,
        workHoursFormatted: evaluation.workHoursFormatted,
        notes: effectiveRecord.notes || evaluation.notes,
      };
    });
  }, [employees, dateRecords, shiftTemplates, selectedDate, leaveRequests]);

  const filtered = useMemo(() => {
    return combinedList.filter((item) => {
      const matchesDept = selectedDepartment === 'all' || item.emp.departmentId === selectedDepartment;
      const matchesShift = shiftFilter === 'all' || item.shift.id === shiftFilter || item.shift.name === shiftFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        item.status === statusFilter ||
        (statusFilter === 'present_all' &&
          (item.status === 'present' ||
            item.status === 'checked_in' ||
            item.status === 'wfh' ||
            item.status === 'permission' ||
            item.status === 'half_day' ||
            item.status === 'late'));
      const matchesSearch =
        item.emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
        item.emp.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
        item.emp.departmentName.toLowerCase().includes(search.toLowerCase());
      return matchesDept && matchesShift && matchesStatus && matchesSearch;
    });
  }, [combinedList, selectedDepartment, shiftFilter, statusFilter, search]);

  // 6 Responsive Summary Card Counts
  const presentCount = combinedList.filter(
    (c) =>
      c.status === 'present' ||
      c.status === 'checked_in' ||
      c.status === 'wfh' ||
      c.status === 'permission' ||
      c.status === 'half_day' ||
      c.status === 'late'
  ).length;
  const lateCount = combinedList.filter((c) => c.isLate || c.status === 'late').length;
  const absentCount = combinedList.filter((c) => c.status === 'absent').length;
  const leaveCount = combinedList.filter((c) => c.status === 'on_leave').length;
  const pendingCount = combinedList.filter((c) => c.status === 'pending').length;
  const notMarkedCount = combinedList.filter((c) => c.status === 'not_marked').length;

  const exportAttendanceCSV = () => {
    const headers = [
      'Date',
      'Employee Code',
      'Employee Name',
      'Department',
      'Shift',
      'Scheduled Time',
      'Check In',
      'Check Out',
      'Total Hours',
      'Status',
      'Notes / Location',
    ];
    const rows = filtered.map((f) => [
      selectedDate,
      f.emp.employeeCode,
      `"${f.emp.fullName}"`,
      `"${f.emp.departmentName}"`,
      `"${f.shift.name}"`,
      `"${f.scheduledTime}"`,
      f.record.checkInTime ? formatTime12Hour(f.record.checkInTime) : '',
      f.record.checkOutTime ? formatTime12Hour(f.record.checkOutTime) : '',
      f.workHoursFormatted !== '--' ? f.workHoursFormatted : f.record.workHours ? `${f.record.workHours}h` : '',
      f.status,
      `"${f.notes || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_register_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenStatusModal = (
    employee: Employee,
    record: AttendanceRecord,
    shift: ShiftTemplate,
    currentStatus: AttendanceStatus
  ) => {
    setStatusModalData({ employee, record, shift, currentStatus });
    setStatusModalOpen(true);
  };

  const handleSaveStatusModal = async (newStatus: AttendanceStatus, notes?: string) => {
    if (!statusModalData) return;
    const { employee, record, shift } = statusModalData;
    saveAttendanceRecord({
      employeeId: employee.id,
      date: selectedDate,
      shiftId: shift.id,
      shiftName: shift.name,
      scheduledStartTime: shift.startTime,
      scheduledEndTime: shift.endTime,
      status: newStatus,
      isManualOverride: true,
      isManualEntry: true,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      workHours: record.workHours,
      workHoursFormatted: record.workHoursFormatted,
      notes: notes !== undefined && notes.trim() !== '' ? notes : record.notes,
      manualReason: 'Attendance status updated via centered modal',
      enteredBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Administrator',
    });
    showToast('Attendance updated successfully!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions Bar */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-white tracking-tight">
            {canManageEmployees ? 'Attendance Register' : 'My Attendance'}
          </h2>
          <p className="text-xs text-muted">
            {canManageEmployees
              ? 'Automatic shift-based tracking, punctuality monitoring, and timesheet adjustments'
              : 'Track your clock-ins, daily logs, and work hours'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-border rounded-xl px-3 py-2 text-xs text-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-medium focus:outline-hidden cursor-pointer font-mono text-slate-200"
            />
          </div>

          {/* Department Filter (Admin only) */}
          {canManageEmployees && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="text-xs bg-slate-900/60 border border-border rounded-xl px-3 py-2 text-slate-200 font-medium focus:outline-hidden"
            >
              <option value="all" className="bg-sidebar">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id} className="bg-sidebar">
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {/* Shift Filter (Admin only) */}
          {canManageEmployees && (
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="text-xs bg-slate-900/60 border border-border rounded-xl px-3 py-2 text-slate-200 font-medium focus:outline-hidden"
            >
              <option value="all" className="bg-sidebar">All Shifts</option>
              {shiftTemplates.map((s) => (
                <option key={s.id} value={s.id} className="bg-sidebar">
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="not_marked">Not Marked</option>
            <option value="present_all">Present (All Working)</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="half_day">Half-Day</option>
            <option value="on_leave">On Leave</option>
            <option value="permission">Permission</option>
            <option value="wfh">Work From Home (WFH)</option>
            <option value="weekly_off">Weekly Off</option>
            <option value="holiday">Holiday</option>
            <option value="missing_punch">Missing Punch</option>
            <option value="pending">Pending</option>
          </select>

          {/* Export CSV */}
          <button
            onClick={exportAttendanceCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Clock In / Out Modal Trigger */}
          <button
            onClick={onOpenCheckIn}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            <span>Clock In / Out</span>
          </button>

          {/* Manual Entry (authorized) */}
          {canManageEmployees && (
            <button
              onClick={() => onOpenManualEntry()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Manual Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* 6 Summary Mini-Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Present Today */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Present Today
            </span>
            <span className="text-2xl font-black text-emerald-700 font-mono mt-0.5 block">
              {presentCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Late Arrivals */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Late Arrivals
            </span>
            <span className="text-2xl font-black text-amber-600 font-mono mt-0.5 block">
              {lateCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Absent */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Absent
            </span>
            <span className="text-2xl font-black text-rose-600 font-mono mt-0.5 block">
              {absentCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        {/* On Leave */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              On Leave
            </span>
            <span className="text-2xl font-black text-purple-600 font-mono mt-0.5 block">
              {leaveCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
            <CalendarOff className="w-5 h-5" />
          </div>
        </div>

        {/* Pending */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Pending
            </span>
            <span className="text-2xl font-black text-sky-600 font-mono mt-0.5 block">
              {pendingCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
            <Hourglass className="w-5 h-5" />
          </div>
        </div>

        {/* Not Marked */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Not Marked
            </span>
            <span className="text-2xl font-black text-slate-700 font-mono mt-0.5 block">
              {notMarkedCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
            <HelpCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Attendance Table - 10 Columns */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Shift</th>
                <th className="py-3.5 px-4">Scheduled Time</th>
                <th className="py-3.5 px-4">Check-In</th>
                <th className="py-3.5 px-4">Check-Out</th>
                <th className="py-3.5 px-4">Total Hours</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Notes / Location</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-3 bg-slate-50 text-slate-400 rounded-xl mb-2">
                        <Clock className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-[#172B4D]">No attendance records available.</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        {employees.length === 0
                          ? 'Add employees to begin tracking daily attendance and shift schedules.'
                          : 'No employees match the selected department, shift, or status filters.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(({ emp, shift, scheduledTime, record, status, workHoursFormatted, notes }, idx) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* 1. Employee */}
                    <td className="py-3 px-4">
                      <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => onSelectEmployee(emp)}
                      >
                        <img
                          src={emp.avatar}
                          alt=""
                          className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200"
                        />
                        <div>
                          <p className="font-bold text-[#172B4D] group-hover:text-[#206DA6] transition-colors">
                            {emp.fullName}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">{emp.employeeCode}</p>
                        </div>
                      </div>
                    </td>

                    {/* 2. Department */}
                    <td className="py-3 px-4 text-slate-700 font-medium">{emp.departmentName}</td>

                    {/* 3. Shift */}
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px]"
                        style={{
                          backgroundColor: `${shift.color}15`,
                          color: shift.color,
                        }}
                      >
                        <Layers className="w-3 h-3" />
                        {shift.name}
                      </span>
                    </td>

                    {/* 4. Scheduled Time */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-600">
                      {scheduledTime}
                    </td>

                    {/* 5. Check-In */}
                    <td className="py-3 px-4 font-mono font-semibold">
                      {record.checkInTime ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {formatTime12Hour(record.checkInTime)}
                        </span>
                      ) : (
                        <span className="text-slate-400">--:--</span>
                      )}
                    </td>

                    {/* 6. Check-Out */}
                    <td className="py-3 px-4 font-mono font-semibold">
                      {record.checkOutTime ? (
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          {formatTime12Hour(record.checkOutTime)}
                        </span>
                      ) : (
                        <span className="text-slate-400">--:--</span>
                      )}
                    </td>

                    {/* 7. Total Hours */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {workHoursFormatted !== '--' ? (
                        <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          {workHoursFormatted}
                        </span>
                      ) : record.workHours ? (
                        <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          {record.workHours}h
                        </span>
                      ) : (
                        <span className="text-slate-400">--</span>
                      )}
                    </td>

                    {/* 8. Status */}
                    <td className="py-3 px-4">
                      {(() => {
                        const config = getStatusConfig(status);
                        return canManageEmployees ? (
                          <button
                            type="button"
                            onClick={() => handleOpenStatusModal(emp, record, shift, status)}
                            className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs select-none hover:scale-[1.02] focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]/30 ${config.badgeBg} ${config.badgeBorder} ${config.badgeText}`}
                            title="Click to update attendance status"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} flex-shrink-0`} />
                            <span className="capitalize">{config.label}</span>
                            <ChevronDown className="w-3 h-3 opacity-70 group-hover:opacity-100 transition-transform duration-200" />
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.badgeBg} ${config.badgeBorder} ${config.badgeText}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} flex-shrink-0`} />
                            <span className="capitalize">{config.label}</span>
                          </span>
                        );
                      })()}
                    </td>

                    {/* 9. Notes / Location */}
                    <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate" title={notes}>
                      {notes || '--'}
                    </td>

                    {/* 10. Actions */}
                    <td className="py-3 px-4 text-right">
                      {canManageEmployees && (
                        <button
                          onClick={() => onOpenManualEntry(record)}
                          className="p-1.5 text-slate-400 hover:text-[#206DA6] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Adjust Attendance"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Centered Attendance Status Modal */}
      <AttendanceStatusModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        employee={statusModalData?.employee || null}
        record={statusModalData?.record || null}
        shift={statusModalData?.shift || null}
        dateStr={selectedDate}
        currentStatus={statusModalData?.currentStatus || 'present'}
        onSave={handleSaveStatusModal}
      />
    </div>
  );
};
