import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardCheck,
  ClipboardList,
  Clock,
  CheckCircle2,
  Eye,
  EyeOff,
  Building2,
  Briefcase,
  ArrowRight,
  CheckCheck,
  Search,
  Check,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  AlertCircle,
  X,
} from 'lucide-react';
import { useWorkAssignment, formatAsiaKolkataDateTime } from '../../../context/WorkAssignmentContext';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { Employee } from '../../../types/hrms';
import { WorkTask, WorkTaskAssignment } from '../../../types/workAssignment';
import { EmployeeAssignedWorkModal } from './EmployeeAssignedWorkModal';
import { Avatar } from '../../common/Avatar';
import { findLinkedEmployee, doesAssignmentBelongToEmployee } from '../../../utils/employeeIdentity';

type PersonalTaskFilter = 'all' | 'not_seen' | 'pending' | 'completed';

export const AssignedWorksModule: React.FC = () => {
  const { tasks, taskAssignments, acknowledgeTask, completeTask } = useWorkAssignment();
  const { employees } = useHRMS();
  const { currentUser, canManageEmployees } = useAuth();

  // HR/Admin Search & Filter State for Live Monitoring Table
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  // HR/Admin Employee Assigned Work Modal state
  const [assignedWorkModalEmployee, setAssignedWorkModalEmployee] = useState<Employee | null>(null);

  // Employee Personal View State
  const [personalFilter, setPersonalFilter] = useState<PersonalTaskFilter>('all');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [detailPopupAssignment, setDetailPopupAssignment] = useState<{
    assignment: WorkTaskAssignment;
    task?: WorkTask;
    taskNumber: number;
    taskCode: string;
  } | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<{
    assignmentId: string;
    taskTitle: string;
  } | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completedSuccessDetails, setCompletedSuccessDetails] = useState<{
    employeeName: string;
    taskTitle: string;
    completedAt: string;
  } | null>(null);

  // Clear previous employee selection, modal state, and filters when switching accounts
  useEffect(() => {
    setAssignedWorkModalEmployee(null);
    setPersonalFilter('all');
    setExpandedTaskIds({});
    setDetailPopupAssignment(null);
    setTaskToComplete(null);
    setCompletedSuccessDetails(null);
    setSearchTerm('');
    setStatusFilter('all');
  }, [currentUser.id]);

  // Resolve verified linked employee for employee logins
  const loggedInEmployee = useMemo(
    () => findLinkedEmployee(currentUser, employees),
    [currentUser, employees]
  );

  // Distinct assignments belonging strictly to the logged-in employee
  const personalAssignments = useMemo(() => {
    if (!loggedInEmployee) return [];
    const matched = taskAssignments.filter((a) =>
      doesAssignmentBelongToEmployee(a, loggedInEmployee)
    );
    const seenKeys = new Set<string>();
    const distinct: WorkTaskAssignment[] = [];
    for (const a of matched) {
      const key = a.taskId ? `${a.taskId}-${loggedInEmployee.id}` : a.id;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      distinct.push(a);
    }
    return distinct;
  }, [loggedInEmployee, taskAssignments]);

  // Personal Task Counts (scoped strictly to the logged-in employee's distinct assignments)
  const personalCounts = useMemo(() => {
    const totalAssigned = personalAssignments.length;
    const notSeen = personalAssignments.filter((a) => !a.isAcknowledged && !a.firstViewedAt).length;
    const acknowledged = personalAssignments.filter((a) => !!a.isAcknowledged).length;
    const completed = personalAssignments.filter((a) => a.status === 'completed').length;
    const pending = personalAssignments.filter((a) => a.status !== 'completed').length;
    return {
      totalAssigned,
      notSeen,
      acknowledged,
      pending,
      completed,
    };
  }, [personalAssignments]);

  // Filtered personal assignments
  const filteredPersonalAssignments = useMemo(() => {
    return personalAssignments.filter((a) => {
      if (personalFilter === 'not_seen') return !a.isAcknowledged && !a.firstViewedAt;
      if (personalFilter === 'pending') return a.status !== 'completed';
      if (personalFilter === 'completed') return a.status === 'completed';
      return true;
    });
  }, [personalAssignments, personalFilter]);

  // Target Three Employees for HR/Admin overview: Dhesan M (EMP-1001), Dinesh K (EMP-1002), Priya K (EMP-1003)
  const targetEmployees = useMemo(() => {
    const targetCodes = ['EMP-1001', 'EMP-1002', 'EMP-1003'];
    const targetIds = ['emp-1001', 'emp-1002', 'emp-1003'];

    const matched = employees.filter(
      (e) =>
        targetCodes.includes(e.employeeCode?.toUpperCase()) ||
        targetIds.includes(e.id?.toLowerCase())
    );

    if (matched.length > 0) {
      return matched.sort((a, b) => {
        const order = ['EMP-1001', 'EMP-1002', 'EMP-1003'];
        const idxA = order.indexOf(a.employeeCode?.toUpperCase());
        const idxB = order.indexOf(b.employeeCode?.toUpperCase());
        return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
      });
    }

    return employees.length > 0 ? employees : [];
  }, [employees]);

  // Open Employee Assigned Work Popup (HR/Admin)
  const handleOpenAssignedWorkModal = (employee: Employee) => {
    setAssignedWorkModalEmployee(employee);
  };

  // Top 5 Organization-Wide Dynamic Metrics from database (HR/Admin only)
  const totalAssignedTasks = taskAssignments.length;
  const notSeenTasks = taskAssignments.filter((a) => !a.firstViewedAt && !a.isAcknowledged).length;
  const acknowledgedTasks = taskAssignments.filter((a) => a.isAcknowledged).length;
  const pendingTasks = taskAssignments.filter((a) => a.status === 'pending').length;
  const completedTasks = taskAssignments.filter((a) => a.status === 'completed').length;

  // Filtered Task Assignments for Live Monitoring Table (HR/Admin only)
  const filteredAssignments = useMemo(() => {
    return taskAssignments.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const parentTask = tasks.find((t) => t.id === a.taskId);
      const taskCode = (parentTask?.taskCode || `TSK-${a.taskId.slice(-4)}`).toLowerCase();
      const taskTitle = (a.taskTitle || parentTask?.title || '').toLowerCase();
      const empName = (a.employeeName || '').toLowerCase();
      const empCode = (a.employeeCode || '').toLowerCase();

      return (
        taskCode.includes(term) ||
        taskTitle.includes(term) ||
        empName.includes(term) ||
        empCode.includes(term)
      );
    });
  }, [taskAssignments, tasks, searchTerm, statusFilter]);

  // Employee Actions Handlers
  const toggleExpandTask = (assignmentId: string) => {
    setExpandedTaskIds((prev) => ({ ...prev, [assignmentId]: !prev[assignmentId] }));
  };

  const handleEmployeeAcknowledge = async (assignment: WorkTaskAssignment) => {
    if (!loggedInEmployee) return;
    if (!doesAssignmentBelongToEmployee(assignment, loggedInEmployee)) return;
    await acknowledgeTask(assignment.id, loggedInEmployee.id, {
      source: 'employee',
      actorName: loggedInEmployee.fullName,
    });
  };

  const handleConfirmEmployeeComplete = async () => {
    if (!taskToComplete || !loggedInEmployee) return;
    const targetAssign = personalAssignments.find((a) => a.id === taskToComplete.assignmentId);
    if (!targetAssign || !doesAssignmentBelongToEmployee(targetAssign, loggedInEmployee)) {
      setTaskToComplete(null);
      return;
    }
    try {
      setIsCompleting(true);
      const timestamp = formatAsiaKolkataDateTime(new Date());
      await completeTask(taskToComplete.assignmentId, loggedInEmployee.id, {
        source: 'employee',
        actorName: loggedInEmployee.fullName,
      });
      setCompletedSuccessDetails({
        employeeName: loggedInEmployee.fullName,
        taskTitle: taskToComplete.taskTitle,
        completedAt: targetAssign.completedAt || timestamp,
      });
      setTaskToComplete(null);
    } finally {
      setIsCompleting(false);
    }
  };

  // ============================================================================
  // ADMINISTRATOR / HR GUARD — ASSIGNED WORKS IS FOR EMPLOYEE SELF-SERVICE ONLY
  // ============================================================================
  if (canManageEmployees) {
    return null;
  }

  // ============================================================================
  // EMPLOYEE LOGIN VIEW — PERSONAL ASSIGNED WORKS ONLY
  // ============================================================================
  if (!canManageEmployees) {
    if (!loggedInEmployee) {
      return (
        <div className="space-y-6 animate-fade-in text-[#172B4D]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#206DA6]/10 text-[#206DA6] flex items-center justify-center font-bold">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#172B4D]">
                Assigned Works
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                View your assigned tasks, acknowledge instructions, and update completion.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-xs max-w-xl mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-[#172B4D]">Profile Link Required</h2>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Your account is not linked to an employee profile. Please contact HR.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in text-[#172B4D]">
        {/* ================= 1. PAGE HEADER ================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#206DA6]/10 text-[#206DA6] flex items-center justify-center font-bold">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#172B4D]">
                Assigned Works
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                View your assigned tasks, acknowledge instructions, and update completion.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold self-start md:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Personal Work Workspace</span>
          </div>
        </div>

        {/* ================= 2. TOP PERSONAL PROFILE SUMMARY ================= */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar
                src={loggedInEmployee.avatar}
                name={loggedInEmployee.fullName}
                size="lg"
                className="ring-2 ring-[#206DA6]/15 shadow-xs rounded-2xl"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-[#172B4D]">
                    {loggedInEmployee.fullName}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-blue-50 text-[#206DA6] border border-blue-200">
                    {loggedInEmployee.employeeCode}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Briefcase className="w-3.5 h-3.5 text-[#206DA6]" />
                    {loggedInEmployee.designation || 'Employee'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {loggedInEmployee.departmentName || 'General Department'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ================= 3. PERSONAL TASK COUNTS ================= */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5 pt-5 border-t border-slate-100">
            {/* Total Assigned */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Assigned
                </span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ClipboardList className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xl font-black text-[#172B4D]">{personalCounts.totalAssigned}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Your assigned tasks</span>
              </div>
            </div>

            {/* Not Seen */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Not Seen
                </span>
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <EyeOff className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <span
                  className={`text-xl font-black ${
                    personalCounts.notSeen > 0 ? 'text-rose-600' : 'text-slate-700'
                  }`}
                >
                  {personalCounts.notSeen}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Awaiting Seen / OK</span>
              </div>
            </div>

            {/* Acknowledged */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Acknowledged
                </span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#206DA6] flex items-center justify-center">
                  <CheckCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xl font-black text-[#206DA6]">{personalCounts.acknowledged}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Confirmed Seen ✓</span>
              </div>
            </div>

            {/* Pending */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Pending
                </span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xl font-black text-amber-600">{personalCounts.pending}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">In progress / pending</span>
              </div>
            </div>

            {/* Completed */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Completed
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xl font-black text-emerald-600">{personalCounts.completed}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Finished tasks</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 4. PERSONAL TASK FILTERS ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: 'All Tasks', count: personalCounts.totalAssigned },
                { id: 'not_seen', label: 'Not Seen', count: personalCounts.notSeen },
                { id: 'pending', label: 'Pending', count: personalCounts.pending },
                { id: 'completed', label: 'Completed', count: personalCounts.completed },
              ] as Array<{ id: PersonalTaskFilter; label: string; count: number }>
            ).map((tab) => {
              const isActive = personalFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPersonalFilter(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-[#206DA6] text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:text-[#172B4D] border border-slate-200/90 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= 5. PERSONAL TASK CARDS LIST ================= */}
        {personalAssignments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <ClipboardList className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-[#172B4D]">No work assigned to you yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Tasks assigned to your profile by HR will appear directly on this page.
            </p>
          </div>
        ) : filteredPersonalAssignments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center shadow-xs">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-[#172B4D]">No tasks match the selected filter.</p>
            <button
              type="button"
              onClick={() => setPersonalFilter('all')}
              className="mt-3 px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#206DA6] transition-colors cursor-pointer"
            >
              Show All Tasks
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPersonalAssignments.map((assignment) => {
              const overallIdx = personalAssignments.findIndex((a) => a.id === assignment.id);
              const taskNumber = overallIdx >= 0 ? overallIdx + 1 : 1;
              const parentTask = tasks.find((t) => t.id === assignment.taskId);
              const taskCode = parentTask?.taskCode || `TSK-${1000 + taskNumber}`;
              const title =
                assignment.taskTitle || parentTask?.title || parentTask?.taskTitle || 'Assigned Task';
              const brief =
                assignment.taskBrief || parentTask?.brief || parentTask?.taskBrief || '—';
              const description =
                assignment.taskDescription ||
                parentTask?.description ||
                parentTask?.taskDescription ||
                '';
              const assignedBy = assignment.assignedBy || parentTask?.assignedBy || 'HR Administrator';
              const assignedDate = assignment.assignedAt || parentTask?.assignedDate || '—';
              const refFile = assignment.referenceFilePath || parentTask?.referenceFilePath;
              const refFileName =
                assignment.referenceFileName || parentTask?.referenceFileName || 'Reference Attachment';

              const isAck = !!assignment.isAcknowledged;
              const seenTime = assignment.acknowledgedAt || assignment.firstViewedAt || '—';
              const completedTime = assignment.completedAt || '—';
              const isAckRecordedByHR = assignment.acknowledgementSource === 'admin';
              const isCompRecordedByHR = assignment.completionSource === 'admin';
              const isExpanded = !!expandedTaskIds[assignment.id];

              return (
                <div
                  key={assignment.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-[#206DA6]/40 shadow-xs transition-all overflow-hidden"
                >
                  {/* Top Bar: Task Number, ID, Title & Status Badges */}
                  <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200/80 text-slate-700 shrink-0">
                        Task #{taskNumber}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-[#206DA6] text-white shrink-0">
                        {taskCode}
                      </span>
                      <h3 className="text-sm font-bold text-[#172B4D] truncate">{title}</h3>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Seen Status Badge */}
                      {isAck ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Seen ✓</span>
                          {isAckRecordedByHR && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Recorded by HR
                            </span>
                          )}
                        </span>
                      ) : assignment.firstViewedAt ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Seen ✓</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                          <span>Not Seen</span>
                        </span>
                      )}

                      {/* Work Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          assignment.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : assignment.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {assignment.status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        <span>
                          {assignment.status === 'completed'
                            ? 'Completed'
                            : assignment.status === 'in_progress'
                            ? 'In Progress'
                            : 'Pending'}
                        </span>
                        {assignment.status === 'completed' && isCompRecordedByHR && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Recorded by HR
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-4">
                    {/* Task Brief */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Task Brief
                      </span>
                      <p className="text-xs text-[#172B4D] font-medium leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
                        {brief}
                      </p>
                    </div>

                    {/* Metadata Grid: Assigned By, Assigned Date, Seen Status, Seen Time, Work Status, Completed Time */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Assigned By
                        </span>
                        <span className="font-semibold text-[#172B4D] mt-0.5 block truncate">
                          {assignedBy}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Assigned Date
                        </span>
                        <span className="font-semibold text-[#172B4D] mt-0.5 block">
                          {assignedDate}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Seen Status
                        </span>
                        <span
                          className={`font-bold mt-0.5 block ${
                            isAck
                              ? 'text-emerald-700'
                              : assignment.firstViewedAt
                              ? 'text-blue-700'
                              : 'text-rose-600'
                          }`}
                        >
                          {isAck ? 'Seen ✓' : assignment.firstViewedAt ? 'Seen ✓' : 'Not Seen'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Seen Time
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-slate-700 mt-0.5 block">
                          {seenTime}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Work Status
                        </span>
                        <span
                          className={`font-bold mt-0.5 block capitalize ${
                            assignment.status === 'completed'
                              ? 'text-emerald-700'
                              : assignment.status === 'in_progress'
                              ? 'text-blue-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {assignment.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Completed Time
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-slate-700 mt-0.5 block">
                          {completedTime}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Description & Reference Attachments */}
                    {(description || refFile) && isExpanded && (
                      <div className="pt-3 border-t border-slate-100 space-y-3 animate-fade-in">
                        {description && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Task Description & Instructions
                            </span>
                            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/60 p-3.5 rounded-xl border border-slate-200/70 whitespace-pre-wrap">
                              {description}
                            </p>
                          </div>
                        )}

                        {refFile && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                              Reference Attachment
                            </span>
                            <div className="p-3 bg-blue-50/30 border border-blue-200/70 rounded-xl flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {refFile.startsWith('data:image') ||
                                refFile.includes('.jpg') ||
                                refFile.includes('.png') ? (
                                  <img
                                    src={refFile}
                                    alt={refFileName}
                                    className="w-10 h-10 object-cover rounded-lg border border-blue-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-[#172B4D] block truncate">
                                    {refFileName}
                                  </span>
                                  <span className="text-[10px] text-slate-400">Attached by {assignedBy}</span>
                                </div>
                              </div>

                              <a
                                href={refFile}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={refFileName}
                                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#206DA6] hover:bg-blue-50 flex items-center gap-1 shadow-2xs shrink-0"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Bar: Expand/Popup Details on Left, Independent Seen / OK | Complete Controls on Right */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 -mx-5 -mb-5 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setDetailPopupAssignment({
                              assignment,
                              task: parentTask,
                              taskNumber,
                              taskCode,
                            })
                          }
                          className="text-xs font-bold text-[#206DA6] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>

                        {(description || refFile) && (
                          <button
                            type="button"
                            onClick={() => toggleExpandTask(assignment.id)}
                            className="text-xs font-semibold text-slate-500 hover:text-[#172B4D] flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide Instructions' : 'Expand Instructions'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Independent Task Controls: Seen / OK | Complete */}
                      <div className="flex items-center gap-2.5">
                        {/* BUTTON 1: SEEN / OK */}
                        {!isAck ? (
                          <button
                            type="button"
                            onClick={() => handleEmployeeAcknowledge(assignment)}
                            className="px-4 py-2 rounded-xl bg-[#206DA6] hover:bg-[#1a5682] text-white text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Check className="w-4 h-4" />
                            <span>Seen / OK</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-default shadow-2xs"
                          >
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Seen ✓</span>
                            {assignment.acknowledgedAt && (
                              <span className="text-[10px] font-mono text-emerald-600/90 ml-0.5">
                                ({assignment.acknowledgedAt})
                              </span>
                            )}
                          </button>
                        )}

                        {/* BUTTON 2: COMPLETE */}
                        {assignment.status === 'completed' ? (
                          <button
                            type="button"
                            disabled
                            className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-default shadow-2xs"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            <span>Completed ✓</span>
                          </button>
                        ) : !isAck ? (
                          <button
                            type="button"
                            disabled
                            title="Please acknowledge the task first by clicking Seen / OK"
                            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed opacity-60"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Complete</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setTaskToComplete({
                                assignmentId: assignment.id,
                                taskTitle: title,
                              })
                            }
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Complete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= CENTERED TASK DETAILS POPUP (EMPLOYEE) ================= */}
        {detailPopupAssignment &&
          createPortal(
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
              <div
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-[#172B4D] animate-scale-up"
                role="dialog"
                aria-modal="true"
              >
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
                      Task #{detailPopupAssignment.taskNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-[#206DA6] text-white">
                      {detailPopupAssignment.taskCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailPopupAssignment(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-[#172B4D]">
                      {detailPopupAssignment.assignment.taskTitle ||
                        detailPopupAssignment.task?.title ||
                        'Assigned Task'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Assigned by{' '}
                      <span className="font-semibold text-slate-700">
                        {detailPopupAssignment.assignment.assignedBy ||
                          detailPopupAssignment.task?.assignedBy ||
                          'HR Administrator'}
                      </span>{' '}
                      on{' '}
                      <span className="font-semibold text-slate-700">
                        {detailPopupAssignment.assignment.assignedAt ||
                          detailPopupAssignment.task?.assignedDate ||
                          '—'}
                      </span>
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Task Brief
                    </span>
                    <p className="text-xs text-[#172B4D] font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      {detailPopupAssignment.assignment.taskBrief ||
                        detailPopupAssignment.task?.brief ||
                        'No task brief provided.'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Task Description & Instructions
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 whitespace-pre-wrap min-h-[72px]">
                      {detailPopupAssignment.assignment.taskDescription ||
                        detailPopupAssignment.task?.description ||
                        'No detailed instructions provided.'}
                    </p>
                  </div>

                  {(detailPopupAssignment.assignment.referenceFilePath ||
                    detailPopupAssignment.task?.referenceFilePath) && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Reference Attachment
                      </span>
                      <div className="p-3 bg-blue-50/40 border border-blue-200/80 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-blue-100 text-[#206DA6] flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-[#172B4D] block truncate">
                              {detailPopupAssignment.assignment.referenceFileName ||
                                detailPopupAssignment.task?.referenceFileName ||
                                'Reference File'}
                            </span>
                            <span className="text-[10px] text-slate-500">Attached reference file</span>
                          </div>
                        </div>

                        <a
                          href={
                            detailPopupAssignment.assignment.referenceFilePath ||
                            detailPopupAssignment.task?.referenceFilePath
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          download={
                            detailPopupAssignment.assignment.referenceFileName ||
                            detailPopupAssignment.task?.referenceFileName ||
                            'Reference File'
                          }
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#206DA6] hover:bg-blue-50 flex items-center gap-1 shadow-2xs shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setDetailPopupAssignment(null)}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* ================= EMPLOYEE COMPLETE TASK CONFIRMATION MODAL ================= */}
        {taskToComplete &&
          createPortal(
            <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center space-y-4 animate-scale-up">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#172B4D]">Complete Assigned Task</h3>
                  <p className="text-xs font-semibold text-[#206DA6] mt-1">
                    "{taskToComplete.taskTitle}"
                  </p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Have you finished this assigned work?
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isCompleting}
                    onClick={() => setTaskToComplete(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isCompleting}
                    onClick={handleConfirmEmployeeComplete}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isCompleting ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Yes, Complete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* ================= COMPLETION SUCCESS MODAL ================= */}
        {completedSuccessDetails &&
          createPortal(
            <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4 animate-scale-up">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#172B4D]">
                    Task Completion Recorded Successfully!
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Your task status and completion timestamp have been saved.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl text-left text-xs space-y-1.5 border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employee:</span>
                    <span className="font-bold text-[#172B4D]">
                      {completedSuccessDetails.employeeName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Task:</span>
                    <span className="font-bold text-[#206DA6] truncate max-w-[180px]">
                      {completedSuccessDetails.taskTitle}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Completed Time:</span>
                    <span className="font-bold text-emerald-700">
                      {completedSuccessDetails.completedAt}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCompletedSuccessDetails(null)}
                  className="w-full py-2.5 rounded-xl bg-[#206DA6] hover:bg-[#1a5682] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Great, Continue
                </button>
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }

  // ============================================================================
  // HR / ADMIN VIEW — ORGANIZATION-WIDE ASSIGNED WORKS MONITORING
  // ============================================================================
  return (
    <div className="space-y-6 animate-fade-in text-[#172B4D]">
      {/* ================= 1. PAGE HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#206DA6]/10 text-[#206DA6] flex items-center justify-center font-bold">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#172B4D]">
                Assigned Works
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                Monitor employee assignments, acknowledgements, and task completion.
              </p>
            </div>
          </div>
        </div>

        {/* Live sync badge */}
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Database Synchronized</span>
        </div>
      </div>

      {/* ================= 2. TOP SUMMARY METRIC CARDS (5 METRICS) ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Total Assigned Tasks */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Assigned
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#172B4D]">{totalAssignedTasks}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Active assigned tasks</span>
          </div>
        </div>

        {/* Metric 2: Not Seen Tasks */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Not Seen
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <EyeOff className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black ${notSeenTasks > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {notSeenTasks}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Awaiting employee view</span>
          </div>
        </div>

        {/* Metric 3: Acknowledged Tasks */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Acknowledged
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#206DA6] flex items-center justify-center">
              <CheckCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#206DA6]">{acknowledgedTasks}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Confirmed by workforce</span>
          </div>
        </div>

        {/* Metric 4: Pending Tasks */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pending
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-600">{pendingTasks}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Awaiting completion</span>
          </div>
        </div>

        {/* Metric 5: Completed Tasks */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-600">{completedTasks}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Finished deliverables</span>
          </div>
        </div>
      </div>

      {/* ================= 3. EMPLOYEE PROFILE MONITORING CARDS ================= */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#172B4D]">Assigned Work Overviews</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View individual employee assignments, acknowledgements, and completion status.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {targetEmployees.map((emp) => {
            const empAssigns = taskAssignments.filter((a) =>
              doesAssignmentBelongToEmployee(a, emp)
            );
            const totalTasks = empAssigns.length;
            const notSeenCount = empAssigns.filter((a) => !a.firstViewedAt && !a.isAcknowledged).length;
            const acknowledgedCount = empAssigns.filter((a) => a.isAcknowledged).length;
            const inProgressCount = empAssigns.filter((a) => a.status === 'in_progress').length;
            const completedCount = empAssigns.filter((a) => a.status === 'completed').length;

            return (
              <div
                key={emp.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                {/* Employee Info Header */}
                <div className="flex items-center gap-3.5">
                  <Avatar
                    src={emp.avatar}
                    name={emp.fullName}
                    size="lg"
                    className="ring-2 ring-white shadow-xs rounded-2xl"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#172B4D] truncate">{emp.fullName}</h3>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                        {emp.employeeCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {emp.designation || 'Specialist'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {emp.departmentName || 'Software Development'}
                    </p>
                  </div>
                </div>

                {/* 5 Tracking Metric Counters */}
                <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200/60 text-xs">
                  <div className="flex items-center justify-between font-semibold text-[#172B4D]">
                    <span>Total Assigned Tasks:</span>
                    <span className="font-extrabold">{totalTasks}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Not Seen Tasks:</span>
                    <span className={notSeenCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-600 font-semibold'}>
                      {notSeenCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Acknowledged Tasks:</span>
                    <span className="text-emerald-700 font-bold">{acknowledgedCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>In Progress Tasks:</span>
                    <span className="text-blue-700 font-bold">{inProgressCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Completed Tasks:</span>
                    <span className="text-emerald-700 font-bold">{completedCount}</span>
                  </div>
                </div>

                {/* Action Button: View Assigned Work */}
                <button
                  onClick={() => handleOpenAssignedWorkModal(emp)}
                  className="w-full py-2.5 px-4 bg-[#206DA6] hover:bg-[#1a5682] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Assigned Work</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= 4. ORGANIZATION LIVE WORK MONITORING TABLE ================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Organization Live Work Monitoring Table
            </h3>
            <p className="text-[11px] text-slate-400">
              Real-time timestamps for employee seen status, acknowledgements, and completions.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search task or staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-[#172B4D] focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]/30 w-44 sm:w-52 bg-white"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs text-[#172B4D] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]/30 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Task ID</th>
                <th className="py-3 px-4">Task Title</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Seen Status</th>
                <th className="py-3 px-4">Seen Time</th>
                <th className="py-3 px-4">Work Status</th>
                <th className="py-3 px-4">Completed Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    {searchTerm || statusFilter !== 'all'
                      ? 'No matching task assignments found.'
                      : 'No assigned tasks in database yet. Click "+ Assign Work" in Work Assignment to get started.'}
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((a, idx) => {
                  const parentTask = tasks.find((t) => t.id === a.taskId);
                  const taskCode = parentTask?.taskCode || `TSK-${1001 + idx}`;
                  const title = a.taskTitle || parentTask?.title || 'Assigned Work';
                  const isAck = !!a.isAcknowledged;
                  const isRecordedByHR = a.acknowledgementSource === 'admin';
                  const isCompRecordedByHR = a.completionSource === 'admin';
                  const targetEmp = employees.find((e) => doesAssignmentBelongToEmployee(a, e));

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Task ID */}
                      <td className="py-3 px-4 font-mono font-bold text-[#206DA6]">
                        {taskCode}
                      </td>

                      {/* 2. Task Title */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <span className="font-semibold text-[#172B4D] truncate block" title={title}>
                          {title}
                        </span>
                        {a.taskBrief && (
                          <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                            {a.taskBrief}
                          </span>
                        )}
                      </td>

                      {/* 3. Employee */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={a.employeeAvatar}
                            name={a.employeeName}
                            size="sm"
                            className="w-6 h-6 rounded-lg ring-1 ring-slate-200"
                          />
                          <div>
                            <span className="font-medium text-[#172B4D] block leading-tight">
                              {a.employeeName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {a.employeeCode}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Seen Status */}
                      <td className="py-3 px-4">
                        {isAck ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCheck className="w-3 h-3 text-emerald-600" />
                              <span>Acknowledged ✓</span>
                            </span>
                            {isRecordedByHR && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Recorded by HR
                              </span>
                            )}
                          </div>
                        ) : a.firstViewedAt ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Eye className="w-3 h-3 text-blue-500" />
                            <span>Seen</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span>Not Seen</span>
                          </span>
                        )}
                      </td>

                      {/* 5. Seen Time */}
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {a.acknowledgedAt || a.firstViewedAt || '—'}
                      </td>

                      {/* 6. Work Status */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              a.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : a.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {a.status === 'completed' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-600" />
                            )}
                            <span className="capitalize">{a.status.replace('_', ' ')}</span>
                          </span>
                          {a.status === 'completed' && isCompRecordedByHR && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Recorded by HR
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Completed Time */}
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {a.completedAt ? (
                          <div>
                            <span>{a.completedAt}</span>
                            {a.completedBy && (
                              <span className="block text-[10px] text-slate-400">
                                by {a.completedBy}
                              </span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => targetEmp && handleOpenAssignedWorkModal(targetEmp)}
                          className="text-[#206DA6] hover:text-[#1a5682] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Work</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= 5. SHARED EMPLOYEE ASSIGNED WORK MODAL ================= */}
      {assignedWorkModalEmployee && (
        <EmployeeAssignedWorkModal
          isOpen={!!assignedWorkModalEmployee}
          onClose={() => setAssignedWorkModalEmployee(null)}
          employee={assignedWorkModalEmployee}
        />
      )}
    </div>
  );
};
