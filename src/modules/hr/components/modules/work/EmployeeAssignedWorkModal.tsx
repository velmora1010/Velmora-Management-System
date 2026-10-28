import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ClipboardList,
  CheckCircle2,
  Clock,
  PlayCircle,
  FileText,
  Download,
  AlertCircle,
  Building2,
  Briefcase,
  Check,
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Shield,
} from 'lucide-react';
import { Employee } from '../../../types/hrms';
import { WorkTask, WorkTaskAssignment, TaskStatus } from '../../../types/workAssignment';
import { useWorkAssignment, formatAsiaKolkataDateTime } from '../../../context/WorkAssignmentContext';
import { useAuth } from '../../../context/AuthContext';
import { useHRMS } from '../../../context/HRMSContext';
import { Avatar } from '../../common/Avatar';
import {
  doesAssignmentBelongToEmployee,
  findLinkedEmployee,
  isSameEmployeeRecord,
} from '../../../utils/employeeIdentity';

interface EmployeeAssignedWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  targetTaskId?: string; // Optional: auto-focus/highlight a specific task from a notification click
}

export const EmployeeAssignedWorkModal: React.FC<EmployeeAssignedWorkModalProps> = ({
  isOpen,
  onClose,
  employee,
  targetTaskId,
}) => {
  const { tasks, taskAssignments, recordTaskFirstViewed, acknowledgeTask, completeTask } =
    useWorkAssignment();
  const { currentUser, allUsers, switchUser, canManageEmployees } = useAuth();
  const { employees } = useHRMS();

  // Expanded descriptions state
  const [expandedDescIds, setExpandedDescIds] = useState<Record<string, boolean>>({});

  // Confirmation modal state for Employee Complete Task
  const [taskToComplete, setTaskToComplete] = useState<{ assignmentId: string; taskTitle: string } | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Success dialog after completion
  const [completedSuccessDetails, setCompletedSuccessDetails] = useState<{
    employeeName: string;
    taskTitle: string;
    completedAt: string;
    recordedBy?: string;
  } | null>(null);

  // Verify whether the logged-in user is the assigned employee (never true for Administrator/HR Admin)
  const ownEmployee = React.useMemo(
    () => findLinkedEmployee(currentUser, employees),
    [currentUser, employees]
  );

  const isOwnerEmployee =
    !canManageEmployees &&
    !!ownEmployee &&
    !!employee &&
    isSameEmployeeRecord(ownEmployee, employee);

  const matchingEmployeeUser = allUsers.find(
    (u) =>
      u.role === 'employee' &&
      (u.employeeId === employee?.id ||
        u.employeeId === employee?.employeeCode ||
        u.name.toLowerCase() === employee?.fullName?.toLowerCase())
  );

  // Assignments for this employee
  const employeeAssignments = employee
    ? taskAssignments.filter((a) => doesAssignmentBelongToEmployee(a, employee))
    : [];

  // When the assigned employee opens the modal, record "first_viewed_at" for tasks not yet marked viewed
  useEffect(() => {
    if (isOpen && employee && isOwnerEmployee) {
      employeeAssignments.forEach((assign) => {
        if (!assign.firstViewedAt) {
          recordTaskFirstViewed(assign.id);
        }
      });
    }
  }, [isOpen, employee, isOwnerEmployee]);

  if (!isOpen || !employee) return null;

  const toggleExpandDesc = (id: string) => {
    setExpandedDescIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAcknowledge = async (assignmentId: string) => {
    if (!isOwnerEmployee) return;
    await acknowledgeTask(assignmentId, employee.id, {
      source: 'employee',
      actorName: employee.fullName,
    });
  };

  const handleConfirmComplete = async () => {
    if (!taskToComplete || !isOwnerEmployee) return;
    try {
      setIsCompleting(true);
      const timestamp = formatAsiaKolkataDateTime(new Date());
      await completeTask(taskToComplete.assignmentId, employee.id, {
        source: 'employee',
        actorName: employee.fullName,
      });
      setCompletedSuccessDetails({
        employeeName: employee.fullName,
        taskTitle: taskToComplete.taskTitle,
        completedAt: timestamp,
      });
      setTaskToComplete(null);
    } finally {
      setIsCompleting(false);
    }
  };

  const getStatusBadge = (
    status: TaskStatus,
    isAcknowledged?: boolean,
    completionSource?: 'employee' | 'admin'
  ) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
            {completionSource === 'admin' && (
              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                Recorded by HR
              </span>
            )}
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <PlayCircle className="w-3.5 h-3.5" />
            <span>In Progress</span>
          </span>
        );
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
            <Eye className="w-3.5 h-3.5" />
            <span>Submitted for Review</span>
          </span>
        );
      default:
        if (isAcknowledged) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Acknowledged</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      {/* Modal Dialog */}
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-[1100px] max-h-[90vh] flex flex-col overflow-hidden text-[#172B4D] animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assigned-work-modal-title"
      >
        {/* ================= 1. STICKY MODAL HEADER ================= */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#206DA6]" />
              <h2 id="assigned-work-modal-title" className="text-xl font-bold text-[#172B4D] tracking-tight">
                Employee Assigned Work
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              View and monitor all work assigned to this employee.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Close popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= 2. EMPLOYEE PROFILE HEADER BANNER ================= */}
        <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar
                src={employee.avatar}
                name={employee.fullName}
                size="lg"
                className="ring-2 ring-white shadow-sm rounded-2xl"
              />
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-[#172B4D]">{employee.fullName}</h3>
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-200 text-slate-700">
                    {employee.employeeCode}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Active
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    {employee.designation || 'Specialist'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {employee.departmentName || 'Software Development'}
                  </span>
                  <span>•</span>
                  <span className="text-slate-400">
                    Status: <span className="font-semibold text-slate-600">Full Time Employee</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Summary Counts */}
            <div className="flex items-center gap-2 text-center">
              <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total
                </span>
                <span className="text-sm font-extrabold text-[#172B4D]">{employeeAssignments.length}</span>
              </div>
              <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
                  Pending
                </span>
                <span className="text-sm font-extrabold text-amber-700">
                  {employeeAssignments.filter((a) => a.status === 'pending').length}
                </span>
              </div>
              <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                  Done
                </span>
                <span className="text-sm font-extrabold text-emerald-700">
                  {employeeAssignments.filter((a) => a.status === 'completed').length}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Role Switcher Banner for Testing Workflow */}
          {canManageEmployees && matchingEmployeeUser && (
            <div className="mt-3 p-3 bg-blue-50/80 border border-blue-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Shield className="w-4 h-4 text-[#206DA6] shrink-0" />
                <span>
                  <strong>HR Administrator Monitoring Mode:</strong> To protect authentication integrity, Seen & Complete actions are restricted to the assigned employee.
                </span>
              </div>
              <button
                type="button"
                onClick={() => switchUser(matchingEmployeeUser.id)}
                className="px-3.5 py-1.5 bg-[#206DA6] hover:bg-[#1a5682] text-white font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Log in as {employee.fullName} to Test Workflow</span>
              </button>
            </div>
          )}
          {isOwnerEmployee && (
            <div className="mt-3 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-800">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Logged in as {employee.fullName} (Employee Mode):</strong> You have direct access to click <strong>[✓ Seen / OK]</strong> and <strong>[✓ Complete]</strong> on your assigned tasks below.
                </span>
              </div>
              <button
                type="button"
                onClick={() => switchUser('user-admin')}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Switch back to HR Admin</span>
              </button>
            </div>
          )}
        </div>

        {/* ================= 3. SCROLLABLE ASSIGNED TASKS BODY ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {employeeAssignments.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No tasks assigned yet.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Tasks assigned by HR will appear here with live tracking, acknowledgement confirmations, and status updates.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {employeeAssignments.map((assignment, index) => {
                const parentTask = tasks.find((t) => t.id === assignment.taskId);
                const taskCode = parentTask?.taskCode || `TSK-${1001 + index}`;
                const title = assignment.taskTitle || parentTask?.title || parentTask?.taskTitle || 'Untitled Task';
                const brief = assignment.taskBrief || parentTask?.brief || parentTask?.taskBrief || '';
                const desc = assignment.taskDescription || parentTask?.description || parentTask?.taskDescription || '';
                const refFile = assignment.referenceFilePath || parentTask?.referenceFilePath;
                const refFileName = assignment.referenceFileName || parentTask?.referenceFileName || 'Reference File';
                const isExpanded = expandedDescIds[assignment.id];
                const isTarget = targetTaskId && (assignment.taskId === targetTaskId || assignment.id === targetTaskId);

                // Seen & Acknowledged status
                const isAck = !!assignment.isAcknowledged;
                const ackTime = assignment.acknowledgedAt;
                const firstViewTime = assignment.firstViewedAt;
                const assignedTime = assignment.assignedAt || parentTask?.assignedDate || 'Today';
                const completedTime = assignment.completedAt;

                return (
                  <div
                    key={assignment.id}
                    className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                      isTarget
                        ? 'border-[#206DA6] ring-2 ring-[#206DA6]/20'
                        : 'border-slate-200/90 hover:border-[#206DA6]/40'
                    }`}
                  >
                    {/* Top Row: Task ID, Title, Status & Timestamps */}
                    <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#206DA6] text-white shadow-2xs">
                          {taskCode}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-[#172B4D]">{title}</h4>
                          <span className="text-[11px] text-slate-400">
                            Assigned on: <span className="font-medium text-slate-600">{assignedTime}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Seen / Acknowledged Badge */}
                        {isAck ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Acknowledged ✓</span>
                            {assignment.acknowledgementSource === 'admin' && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                                Recorded by HR
                              </span>
                            )}
                            {ackTime && (
                              <span className="text-[10px] text-emerald-600/90 ml-1 font-normal">
                                ({ackTime})
                              </span>
                            )}
                          </div>
                        ) : firstViewTime ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Seen ({firstViewTime})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>Not Seen</span>
                          </div>
                        )}

                        {/* Work Status Badge */}
                        {getStatusBadge(assignment.status, isAck, assignment.completionSource)}
                      </div>
                    </div>

                    {/* Task Content: Brief, Description, Reference File */}
                    <div className="p-5 space-y-4">
                      {/* Brief */}
                      {brief && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Task Brief
                          </span>
                          <p className="text-xs text-[#172B4D] font-medium leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
                            {brief}
                          </p>
                        </div>
                      )}

                      {/* Description with Expand/Collapse */}
                      {desc && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Task Instructions & Description
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleExpandDesc(assignment.id)}
                              className="text-[11px] text-[#206DA6] font-semibold flex items-center gap-1 hover:underline"
                            >
                              <span>{isExpanded ? 'Show Less' : 'Show Full Description'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                          <p
                            className={`text-xs text-slate-600 leading-relaxed bg-slate-50/60 p-3 rounded-xl border border-slate-200/60 whitespace-pre-wrap ${
                              isExpanded ? '' : 'line-clamp-2'
                            }`}
                          >
                            {desc}
                          </p>
                        </div>
                      )}

                      {/* Reference Image / File */}
                      {refFile && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Reference Attachment
                          </span>
                          <div className="p-2.5 bg-blue-50/30 border border-blue-200/70 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {refFile.startsWith('data:image') || refFile.includes('.jpg') || refFile.includes('.png') ? (
                                <img
                                  src={refFile}
                                  alt="Reference preview"
                                  className="w-10 h-10 object-cover rounded-lg border border-blue-200"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                                  <FileText className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <span className="text-xs font-bold text-[#172B4D] block truncate max-w-xs">
                                  {refFileName}
                                </span>
                                <span className="text-[10px] text-slate-400">Attached by HR</span>
                              </div>
                            </div>

                            <a
                              href={refFile}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={refFileName}
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#206DA6] hover:bg-blue-50 flex items-center gap-1 shadow-2xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Timestamps Meta Footer Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Assigned Date
                          </span>
                          <span className="font-semibold text-slate-700 mt-0.5 block">{assignedTime}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Seen Status
                          </span>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span
                              className={`font-semibold ${
                                isAck
                                  ? 'text-emerald-700 font-bold'
                                  : firstViewTime
                                  ? 'text-blue-700 font-semibold'
                                  : 'text-slate-400'
                              }`}
                            >
                              {isAck ? 'Acknowledged ✓' : firstViewTime ? 'Seen' : 'Not Seen'}
                            </span>
                            {isAck && assignment.acknowledgementSource === 'admin' && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                Recorded by HR
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Seen Time
                          </span>
                          <span
                            className={`font-semibold mt-0.5 block ${
                              ackTime ? 'text-emerald-700 font-bold' : firstViewTime ? 'text-blue-700' : 'text-slate-400 italic'
                            }`}
                          >
                            {ackTime || firstViewTime || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Completed Date & Time
                          </span>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span
                              className={`font-semibold ${
                                completedTime ? 'text-emerald-700 font-bold' : 'text-slate-400'
                              }`}
                            >
                              {completedTime ? completedTime : '—'}
                            </span>
                            {completedTime && assignment.completionSource === 'admin' && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                Recorded by HR
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ================= TASK FOOTER: EMPLOYEE ACTIONS vs ADMIN VIEW ONLY ================= */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 -mx-5 -mb-5 p-4 rounded-b-2xl">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            {isOwnerEmployee ? 'Task Actions:' : 'View Task Only:'}
                          </span>
                          {!isOwnerEmployee ? (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">
                              Admin View Only
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-[#206DA6] bg-blue-100/80 px-2 py-0.5 rounded border border-blue-200">
                              Employee Actions
                            </span>
                          )}
                          {isOwnerEmployee && isAck && assignment.status !== 'completed' && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-300">
                              <Check className="w-3 h-3" /> Ready for completion
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          {/* ================= EMPLOYEE VIEW (ASSIGNED EMPLOYEE ONLY) ================= */}
                          {isOwnerEmployee ? (
                            <>
                              {/* BUTTON 1: SEEN / OK */}
                              {!isAck ? (
                                <button
                                  type="button"
                                  onClick={() => handleAcknowledge(assignment.id)}
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
                                  <span>Confirmed ✓</span>
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
                            </>
                          ) : (
                            /* ================= ADMINISTRATOR / READ-ONLY VIEW ================= */
                            <div className="flex items-center gap-2">
                              {desc && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpandDesc(assignment.id)}
                                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{isExpanded ? 'Hide Details' : 'View Task Details'}</span>
                                </button>
                              )}
                              <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 select-none">
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>Read Only</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= 4. STICKY MODAL FOOTER ================= */}
        <div className="sticky bottom-0 z-20 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="text-xs text-slate-500">
            Total Work Orders:{' '}
            <span className="font-bold text-[#172B4D]">{employeeAssignments.length}</span> • Employee:{' '}
            <span className="font-bold text-[#206DA6]">{employee.fullName}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* ================= 5. EMPLOYEE COMPLETE TASK CONFIRMATION MODAL ================= */}
      {isOwnerEmployee && taskToComplete && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#172B4D]">Complete Assigned Task</h3>
              <p className="text-xs font-semibold text-[#206DA6] mt-1">"{taskToComplete.taskTitle}"</p>
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
                onClick={handleConfirmComplete}
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
        </div>
      )}

      {/* ================= 6. COMPLETION SUCCESS TOAST / MODAL ================= */}
      {completedSuccessDetails && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#172B4D]">Task Completion Recorded Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1">
                The task completion has been recorded and updated across HR monitoring.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-left text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <span className="font-bold text-[#172B4D]">{completedSuccessDetails.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Task:</span>
                <span className="font-bold text-[#206DA6] truncate max-w-[180px]">
                  {completedSuccessDetails.taskTitle}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Completed Time:</span>
                <span className="font-bold text-emerald-700">{completedSuccessDetails.completedAt}</span>
              </div>
              {completedSuccessDetails.recordedBy && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Recorded By:</span>
                  <span className="font-bold text-amber-800">{completedSuccessDetails.recordedBy} (HR)</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCompletedSuccessDetails(null)}
              className="w-full py-2.5 rounded-xl bg-[#206DA6] hover:bg-[#1a5682] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Great, Continue
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
