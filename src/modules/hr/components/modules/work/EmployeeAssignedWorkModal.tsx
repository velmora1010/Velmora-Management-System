import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ClipboardList,
  CheckCircle2,
  Clock,
  PlayCircle,
  FileText,
  Download,
  Building2,
  Briefcase,
  Check,
  Eye,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Shield,
  ArrowLeft,
  Search,
  Filter,
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
  targetTaskId?: string;
}

interface TaskDetailModalState {
  assignment: WorkTaskAssignment;
  parentTask?: WorkTask;
  taskCode: string;
  title: string;
  brief: string;
  description: string;
  refFile?: string;
  refFileName?: string;
  assignedDate: string;
  seenStatus: 'Acknowledged' | 'Seen' | 'Not Seen';
  seenTime: string;
  completionStatus: 'Completed' | 'Pending';
  completionTime: string;
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

  // Search & Status Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'seen'>('all');

  // Expanded descriptions state
  const [expandedDescIds, setExpandedDescIds] = useState<Record<string, boolean>>({});

  // Centered Task Details Popup state
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<TaskDetailModalState | null>(null);

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
  const ownEmployee = useMemo(
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
  const employeeAssignments = useMemo(() => {
    return employee
      ? taskAssignments.filter((a) => doesAssignmentBelongToEmployee(a, employee))
      : [];
  }, [employee, taskAssignments]);

  // Compute 4 Summary Counts
  const totalTasksCount = employeeAssignments.length;
  const pendingTasksCount = employeeAssignments.filter((a) => a.status === 'pending').length;
  const completedTasksCount = employeeAssignments.filter((a) => a.status === 'completed').length;
  const seenTasksCount = employeeAssignments.filter(
    (a) => !!a.isAcknowledged || !!a.firstViewedAt
  ).length;

  // Filtered task assignments for table
  const filteredAssignments = useMemo(() => {
    return employeeAssignments.filter((a) => {
      const parentTask = tasks.find((t) => t.id === a.taskId);
      const taskCode = (parentTask?.taskCode || `TSK-${a.taskId.slice(-4)}`).toLowerCase();
      const title = (a.taskTitle || parentTask?.title || parentTask?.taskTitle || '').toLowerCase();

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!taskCode.includes(q) && !title.includes(q)) return false;
      }

      if (statusFilter === 'pending') {
        if (a.status !== 'pending') return false;
      } else if (statusFilter === 'completed') {
        if (a.status !== 'completed') return false;
      } else if (statusFilter === 'seen') {
        if (!a.isAcknowledged && !a.firstViewedAt) return false;
      }

      return true;
    });
  }, [employeeAssignments, tasks, searchQuery, statusFilter]);

  // When the assigned employee opens the modal, record "first_viewed_at" for tasks not yet marked viewed
  useEffect(() => {
    if (isOpen && employee && isOwnerEmployee) {
      employeeAssignments.forEach((assign) => {
        if (!assign.firstViewedAt) {
          recordTaskFirstViewed(assign.id);
        }
      });
    }
  }, [isOpen, employee, isOwnerEmployee, employeeAssignments, recordTaskFirstViewed]);

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

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      {/* Modal Dialog */}
      <div
        className="bg-[#1E293B] rounded-2xl shadow-2xl border border-[#334155] w-full max-w-[1200px] max-h-[92vh] flex flex-col overflow-hidden text-white animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assigned-work-modal-title"
      >
        {/* ================= 1. STICKY MODAL HEADER ================= */}
        <div className="sticky top-0 z-20 bg-[#151D2B] border-b border-[#334155] px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white border border-[#334155] transition-colors cursor-pointer"
              title="Return to Task Roster"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#206DA6]" />
                <h2 id="assigned-work-modal-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Assigned Works
                </h2>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Monitoring and tracking all tasks assigned to this employee.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#0D1117] text-[#94A3B8] border border-[#334155] text-xs font-semibold">
              <Shield className="w-3.5 h-3.5 text-[#206DA6]" />
              <span>Administrator Monitoring</span>
            </span>

            <button
              onClick={onClose}
              className="p-2 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded-xl transition-colors cursor-pointer"
              aria-label="Close popup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= 2. EMPLOYEE PROFILE HEADER BANNER ================= */}
        <div className="bg-[#151D2B]/70 border-b border-[#334155] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar
                src={employee.avatar}
                name={employee.fullName}
                size="lg"
                className="ring-2 ring-[#334155] shadow-sm rounded-2xl w-14 h-14"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-base font-bold text-white">{employee.fullName}</h3>
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-[#0D1117] text-sky-400 border border-[#334155]">
                    {employee.employeeCode}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A3B8] mt-1.5">
                  <span className="flex items-center gap-1.5 font-medium text-white">
                    <Briefcase className="w-3.5 h-3.5 text-[#94A3B8]" />
                    {employee.designation || 'Specialist'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#94A3B8]" />
                    {employee.departmentName || 'Software Development'}
                  </span>
                  <span>•</span>
                  <span className="text-[#94A3B8]">Full Time Employee</span>
                </div>
              </div>
            </div>

            {/* Quick Summary Counts Badge */}
            <div className="px-4 py-2 bg-[#0D1117] border border-[#334155] rounded-xl text-xs text-right">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">
                Total Assigned
              </span>
              <span className="text-base font-extrabold text-white">
                {totalTasksCount} {totalTasksCount === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>
          </div>
        </div>

        {/* ================= 3. SCROLLABLE BODY ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#0D1117]/50">
          {/* Four Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Tasks */}
            <div className="bg-[#1E293B] rounded-2xl p-4 border border-[#334155] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                  Total Tasks
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#151D2B] text-sky-400 border border-[#334155] flex items-center justify-center">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-black text-white">{totalTasksCount}</span>
                <span className="text-[11px] text-[#94A3B8] block mt-0.5">Total assigned</span>
              </div>
            </div>

            {/* Pending Tasks */}
            <div className="bg-[#1E293B] rounded-2xl p-4 border border-[#334155] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                  Pending Tasks
                </span>
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-black text-orange-400">{pendingTasksCount}</span>
                <span className="text-[11px] text-[#94A3B8] block mt-0.5">Awaiting completion</span>
              </div>
            </div>

            {/* Completed Tasks */}
            <div className="bg-[#1E293B] rounded-2xl p-4 border border-[#334155] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                  Completed Tasks
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-black text-emerald-400">{completedTasksCount}</span>
                <span className="text-[11px] text-[#94A3B8] block mt-0.5">Finished deliverables</span>
              </div>
            </div>

            {/* Seen Tasks */}
            <div className="bg-[#1E293B] rounded-2xl p-4 border border-[#334155] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                  Seen Tasks
                </span>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-black text-purple-400">{seenTasksCount}</span>
                <span className="text-[11px] text-[#94A3B8] block mt-0.5">Acknowledged & viewed</span>
              </div>
            </div>
          </div>

          {/* Assigned Task Table */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden shadow-velmora">
            {/* Search and Filter */}
            <div className="p-4 bg-[#151D2B] border-b border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Task ID or Title..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0D1117] border border-[#334155] rounded-xl text-xs text-white placeholder-[#94A3B8] focus:border-[#206DA6] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Status:</span>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-[#0D1117] border border-[#334155] text-white text-xs rounded-xl px-3 py-2 focus:border-[#206DA6] focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Tasks</option>
                  <option value="pending">Pending Tasks</option>
                  <option value="completed">Completed Tasks</option>
                  <option value="seen">Seen / Acknowledged</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#151D2B] border-b border-[#334155] text-[#94A3B8] uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 whitespace-nowrap">Task ID</th>
                    <th className="py-3.5 px-4 min-w-[160px]">Task Title</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Task Description</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Attachment</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Assigned Date</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Seen Status</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Seen Time</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Completion Status</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Completion Time</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#334155]">
                  {filteredAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-[#94A3B8]">
                        <ClipboardList className="w-7 h-7 text-[#94A3B8]/60 mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-white">No tasks match your criteria</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAssignments.map((assignment, index) => {
                      const parentTask = tasks.find((t) => t.id === assignment.taskId);
                      const taskCode = parentTask?.taskCode || `TSK-${1001 + index}`;
                      const title =
                        assignment.taskTitle ||
                        parentTask?.title ||
                        parentTask?.taskTitle ||
                        'Untitled Task';
                      const brief =
                        assignment.taskBrief || parentTask?.brief || parentTask?.taskBrief || '';
                      const desc =
                        assignment.taskDescription ||
                        parentTask?.description ||
                        parentTask?.taskDescription ||
                        '';
                      const refFile = assignment.referenceFilePath || parentTask?.referenceFilePath;
                      const refFileName =
                        assignment.referenceFileName ||
                        parentTask?.referenceFileName ||
                        'Reference File';
                      const assignedDate =
                        assignment.assignedAt || parentTask?.assignedDate || 'Today';

                      const isAck = !!assignment.isAcknowledged;
                      const ackTime = assignment.acknowledgedAt;
                      const firstViewTime = assignment.firstViewedAt;
                      const completedTime = assignment.completedAt;
                      const isCompleted = assignment.status === 'completed';

                      const isExpanded = !!expandedDescIds[assignment.id];

                      const detailPayload: TaskDetailModalState = {
                        assignment,
                        parentTask,
                        taskCode,
                        title,
                        brief,
                        description: desc,
                        refFile,
                        refFileName,
                        assignedDate,
                        seenStatus: isAck ? 'Acknowledged' : firstViewTime ? 'Seen' : 'Not Seen',
                        seenTime: ackTime || firstViewTime || '—',
                        completionStatus: isCompleted ? 'Completed' : 'Pending',
                        completionTime: completedTime || '—',
                      };

                      return (
                        <tr
                          key={assignment.id}
                          className="hover:bg-[#151D2B]/70 transition-colors"
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#151D2B] text-sky-400 border border-[#334155]">
                              {taskCode}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-white">
                            <span>{title}</span>
                          </td>

                          <td className="py-3.5 px-4 text-[#94A3B8]">
                            <div className="max-w-xs">
                              <p
                                className={`text-xs leading-relaxed ${
                                  isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'
                                }`}
                              >
                                {desc || brief || 'No description provided.'}
                              </p>
                              {(desc.length > 80 || (brief && desc)) && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpandDesc(assignment.id)}
                                  className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold mt-1 flex items-center gap-0.5 cursor-pointer"
                                >
                                  <span>{isExpanded ? 'Show less' : 'Show more'}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {refFile ? (
                              <a
                                href={refFile}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={refFileName}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#151D2B] text-sky-400 hover:text-white hover:bg-[#206DA6] border border-[#334155] text-xs font-semibold transition-colors shadow-2xs"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="max-w-[120px] truncate">{refFileName}</span>
                              </a>
                            ) : (
                              <span className="text-[#94A3B8] italic text-xs">None</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-white font-medium">
                            {assignedDate}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isAck ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <Check className="w-3.5 h-3.5" />
                                <span>Acknowledged</span>
                              </span>
                            ) : firstViewTime ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                <Eye className="w-3.5 h-3.5" />
                                <span>Seen</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-[#94A3B8] border border-[#334155]">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Not Seen</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-xs text-[#94A3B8] font-mono">
                            {ackTime || firstViewTime || '—'}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Completed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-xs text-[#94A3B8] font-mono">
                            {completedTime || '—'}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedTaskDetails(detailPayload)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#206DA6] hover:bg-[#1a5682] text-white text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Details</span>
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
        </div>

        {/* ================= 4. STICKY MODAL FOOTER ================= */}
        <div className="sticky bottom-0 z-20 bg-[#151D2B] border-t border-[#334155] px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="text-xs text-[#94A3B8]">
            Total Work Orders:{' '}
            <strong className="text-white">{employeeAssignments.length}</strong> • Employee:{' '}
            <strong className="text-sky-400">{employee.fullName}</strong>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#334155] hover:bg-[#475569] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* ================= 5. TASK DETAILS POPUP MODAL ================= */}
      {selectedTaskDetails && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div
            className="bg-[#1E293B] border border-[#334155] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-white animate-scale-up"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#334155] bg-[#151D2B] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#0D1117] text-sky-400 border border-[#334155]">
                  {selectedTaskDetails.taskCode}
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedTaskDetails.title}
                  </h3>
                  <span className="text-[11px] text-[#94A3B8]">
                    Assigned to: <strong className="text-white">{employee.fullName}</strong> ({employee.employeeCode})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTaskDetails(null)}
                className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Task Brief */}
              {selectedTaskDetails.brief && (
                <div className="p-3.5 bg-[#151D2B] border border-[#334155] rounded-xl">
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1">
                    Task Brief
                  </span>
                  <p className="text-xs text-white leading-relaxed font-medium">
                    {selectedTaskDetails.brief}
                  </p>
                </div>
              )}

              {/* Task Description */}
              <div className="p-4 bg-[#151D2B] border border-[#334155] rounded-xl">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-2">
                  Task Description
                </span>
                <p className="text-xs text-[#94A3B8] leading-relaxed whitespace-pre-wrap">
                  {selectedTaskDetails.description || 'No detailed instructions provided.'}
                </p>
              </div>

              {/* Reference Attachment */}
              <div className="p-4 bg-[#151D2B] border border-[#334155] rounded-xl">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-2">
                  Reference Image / File Attachment
                </span>
                {selectedTaskDetails.refFile ? (
                  <div className="space-y-3">
                    {selectedTaskDetails.refFile.startsWith('data:image') ||
                    selectedTaskDetails.refFile.includes('.jpg') ||
                    selectedTaskDetails.refFile.includes('.png') ||
                    selectedTaskDetails.refFile.includes('.webp') ? (
                      <div className="rounded-xl overflow-hidden border border-[#334155] bg-[#0D1117] p-2 flex justify-center">
                        <img
                          src={selectedTaskDetails.refFile}
                          alt="Reference preview"
                          className="max-h-56 object-contain rounded-lg"
                        />
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between p-2.5 bg-[#0D1117] rounded-xl border border-[#334155]">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-sky-400" />
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {selectedTaskDetails.refFileName}
                          </span>
                          <span className="text-[10px] text-[#94A3B8]">Reference Attachment</span>
                        </div>
                      </div>

                      <a
                        href={selectedTaskDetails.refFile}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={selectedTaskDetails.refFileName}
                        className="px-3 py-1.5 rounded-lg bg-[#206DA6] hover:bg-[#1a5682] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#94A3B8] italic">No reference file attached.</p>
                )}
              </div>

              {/* Status and Timestamp Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#151D2B] border border-[#334155] rounded-xl text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">
                    Assigned Date
                  </span>
                  <span className="font-semibold text-white mt-1 block">
                    {selectedTaskDetails.assignedDate}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">
                    Seen Status & Timestamp
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`font-semibold ${
                        selectedTaskDetails.seenStatus === 'Acknowledged'
                          ? 'text-emerald-400 font-bold'
                          : selectedTaskDetails.seenStatus === 'Seen'
                          ? 'text-purple-400 font-semibold'
                          : 'text-[#94A3B8]'
                      }`}
                    >
                      {selectedTaskDetails.seenStatus}
                    </span>
                    {selectedTaskDetails.seenTime !== '—' && (
                      <span className="text-[11px] text-[#94A3B8]">
                        ({selectedTaskDetails.seenTime})
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">
                    Completion Status & Timestamp
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`font-semibold ${
                        selectedTaskDetails.completionStatus === 'Completed'
                          ? 'text-emerald-400 font-bold'
                          : 'text-orange-400 font-semibold'
                      }`}
                    >
                      {selectedTaskDetails.completionStatus}
                    </span>
                    {selectedTaskDetails.completionTime !== '—' && (
                      <span className="text-[11px] text-[#94A3B8]">
                        ({selectedTaskDetails.completionTime})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer (Strictly Read-Only - No Admin Complete or Ack Buttons) */}
            <div className="px-6 py-4 border-t border-[#334155] bg-[#151D2B] flex items-center justify-between">
              <span className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#206DA6]" />
                <span>Monitoring Mode • Actions restricted to assigned employee</span>
              </span>

              <button
                type="button"
                onClick={() => setSelectedTaskDetails(null)}
                className="px-5 py-2 rounded-xl bg-[#334155] hover:bg-[#475569] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
