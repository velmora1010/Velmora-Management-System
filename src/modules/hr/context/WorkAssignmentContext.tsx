import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  WorkTask,
  WorkTaskAssignment,
  WorkProgressUpdate,
  WorkTaskComment,
  WorkTaskAttachment,
  WorkTaskActivityLog,
  WorkSummaryMetrics,
  EmployeeWorkload,
  TaskStatus,
  TaskPriority,
  AssignmentType,
  TaskCategory,
  BatchTaskItem,
  AssignBatchTasksParams,
} from '../types/workAssignment';
import { useHRMS } from './HRMSContext';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { generateInitialWorkData, isDemoTask } from '../data/initialWorkData';
import { safeSetItem, safeGetItem } from '../utils/storage';
import { findLinkedEmployee, doesAssignmentBelongToEmployee } from '../utils/employeeIdentity';

export interface CreateTaskParams {
  title: string;
  description: string;
  category: TaskCategory | string;
  priority: TaskPriority;
  assignmentType: AssignmentType;
  departmentId?: string;
  employeeIds: string[];
  assignedDate: string;
  startDate?: string;
  dueDate: string;
  dueTime?: string;
  estimatedHours?: number;
  initialStatus?: TaskStatus;
  instructions?: string;
  notes?: string;
  attachments?: Array<{ originalFilename: string; fileSize?: string; fileType?: string; secureStoragePath?: string }>;
}

export interface SubmitDailyUpdateParams {
  taskAssignmentId?: string;
  taskId: string;
  employeeId: string;
  workDate: string;
  workDescription: string;
  hoursSpent: number;
  progressPercentage: number;
  blockers?: string;
  supportingFileName?: string;
}

interface WorkAssignmentContextType {
  tasks: WorkTask[];
  taskAssignments: WorkTaskAssignment[];
  progressUpdates: WorkProgressUpdate[];
  comments: WorkTaskComment[];
  attachments: WorkTaskAttachment[];
  activityLogs: WorkTaskActivityLog[];
  summaryMetrics: WorkSummaryMetrics;
  employeeWorkloads: EmployeeWorkload[];

  createTask: (params: CreateTaskParams) => Promise<WorkTask>;
  updateTask: (taskId: string, updates: Partial<WorkTask>) => void;
  deleteTask: (taskId: string) => void;
  updateAssignmentProgress: (
    assignmentId: string,
    progress: number,
    notes?: string,
    newStatus?: TaskStatus
  ) => void;
  submitDailyWorkUpdate: (params: SubmitDailyUpdateParams) => Promise<void>;
  submitTaskForReview: (assignmentId: string, notes?: string) => Promise<void>;
  reviewTaskSubmission: (
    assignmentId: string,
    action: 'approve' | 'request_changes' | 'reopen',
    reviewNotes?: string
  ) => Promise<void>;
  addComment: (taskId: string, comment: string, assignmentId?: string) => void;
  addAttachment: (
    taskId: string,
    file: { originalFilename: string; fileSize?: string; fileType?: string; secureStoragePath?: string },
    assignmentId?: string
  ) => void;

  assignBatchTasks: (params: AssignBatchTasksParams) => Promise<WorkTask[]>;
  updateAssignmentStatus: (assignmentId: string, status: TaskStatus) => void;
  recordTaskFirstViewed: (assignmentId: string) => void;
  acknowledgeTask: (
    assignmentId: string,
    employeeId?: string,
    options?: { source?: 'employee' | 'admin'; note?: string; actorName?: string }
  ) => Promise<void>;
  startTaskWork: (assignmentId: string, employeeId: string) => Promise<void>;
  completeTask: (
    assignmentId: string,
    employeeId?: string,
    options?: { source?: 'employee' | 'admin'; note?: string; actorName?: string }
  ) => Promise<void>;

  isTaskOverdue: (dueDate: string, status: TaskStatus) => boolean;
  isTaskDueToday: (dueDate: string, status: TaskStatus) => boolean;
}

const WorkAssignmentContext = createContext<WorkAssignmentContextType | undefined>(undefined);

export const formatAsiaKolkataDateTime = (dateInput?: Date | string): string => {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
};

const LOCAL_STORAGE_KEYS = {
  TASKS: 'hrms_work_tasks_v2',
  ASSIGNMENTS: 'hrms_work_assignments_v2',
  UPDATES: 'hrms_work_updates_v2',
  COMMENTS: 'hrms_work_comments_v2',
  ATTACHMENTS: 'hrms_work_attachments_v2',
  LOGS: 'hrms_work_logs_v2',
};

export const WorkAssignmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { employees, departments, selectedDate, addNotification } = useHRMS();
  const { currentUser, canManageEmployees } = useAuth();
  const { showToast } = useToast();

  const todayStr = useMemo(() => {
    return selectedDate || new Date().toISOString().split('T')[0];
  }, [selectedDate]);

  // Initial seed data generator
  const initialData = useMemo(() => {
    return generateInitialWorkData(employees, departments);
  }, [employees, departments]);

  // 1. Tasks - Exclude old demo tasks
  const [tasks, setTasks] = useState<WorkTask[]>(() => {
    const saved = safeGetItem(LOCAL_STORAGE_KEYS.TASKS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const nonDemo = parsed.filter((t: WorkTask) => !isDemoTask(t.id));
          const seen = new Set<string>();
          const uniqueTasks = nonDemo.filter((t: WorkTask) => {
            if (!t.id || seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
          });
          if (uniqueTasks.length > 0) return uniqueTasks;
        }
      } catch {
        // fallback
      }
    }
    return initialData.tasks;
  });

  // 2. Task Assignments - Exclude demo task assignments and deduplicate
  const [taskAssignments, setTaskAssignments] = useState<WorkTaskAssignment[]>(() => {
    const saved = safeGetItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const nonDemo = parsed.filter((a: WorkTaskAssignment) => !isDemoTask(a.taskId));
          const seenIds = new Set<string>();
          const uniqueAssignments: WorkTaskAssignment[] = [];
          for (const a of nonDemo) {
            if (!a.id || seenIds.has(a.id)) continue;
            seenIds.add(a.id);
            if (!a.employeeAvatar) {
              const emp = employees.find((e) => e.id === a.employeeId || e.employeeCode === a.employeeCode);
              uniqueAssignments.push({ ...a, employeeAvatar: emp?.avatar || '' });
            } else {
              uniqueAssignments.push(a);
            }
          }
          if (uniqueAssignments.length > 0) return uniqueAssignments;
        }
      } catch {
        // fallback
      }
    }
    return initialData.taskAssignments;
  });

  // Keep tasks and assignments synchronized so no task is missing
  useEffect(() => {
    const existingTaskIds = new Set(tasks.map((t) => t.id));
    const missing: WorkTask[] = [];
    taskAssignments.forEach((assign) => {
      if (assign.taskId && !existingTaskIds.has(assign.taskId)) {
        existingTaskIds.add(assign.taskId);
        missing.push({
          id: assign.taskId,
          taskCode: `TSK-${assign.taskId.replace(/\D/g, '').slice(-4) || '1001'}`,
          title: assign.taskTitle || 'Assigned Work',
          taskTitle: assign.taskTitle || 'Assigned Work',
          brief: assign.taskBrief || '',
          taskBrief: assign.taskBrief || '',
          description: assign.taskDescription || '',
          taskDescription: assign.taskDescription || '',
          category: 'General Work',
          priority: 'medium',
          assignmentType: 'single',
          assignedBy: assign.assignedBy || 'Administrator',
          assignedById: 'user-admin',
          assignedDate: assign.assignedAt || todayStr,
          dueDate: assign.assignedAt || todayStr,
          status: assign.status || 'pending',
          overallProgress: assign.progressPercentage || 0,
          referenceFilePath: assign.referenceFilePath,
          referenceFileName: assign.referenceFileName,
          createdAt: assign.assignedAt || new Date().toISOString(),
          updatedAt: assign.updatedAt || new Date().toISOString(),
        });
      }
    });

    if (missing.length > 0) {
      setTasks((prev) => [...prev, ...missing]);
    }
  }, [taskAssignments, tasks, todayStr]);

  // 3. Progress Updates
  const [progressUpdates, setProgressUpdates] = useState<WorkProgressUpdate[]>(() => {
    const saved = safeGetItem(LOCAL_STORAGE_KEYS.UPDATES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const nonDemo = parsed.filter((u: WorkProgressUpdate) => !isDemoTask(u.taskId));
          return nonDemo.map((u: WorkProgressUpdate) => {
            if (!u.employeeAvatar) {
              const emp = employees.find((e) => e.id === u.employeeId);
              return { ...u, employeeAvatar: emp?.avatar || '' };
            }
            return u;
          });
        }
      } catch {
        // fallback
      }
    }
    return [];
  });

  // 4. Comments
  const [comments, setComments] = useState<WorkTaskComment[]>(() => {
    const saved = safeGetItem(LOCAL_STORAGE_KEYS.COMMENTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((c: WorkTaskComment) => !isDemoTask(c.taskId));
        }
      } catch {
        // fallback
      }
    }
    return [];
  });

  // 5. Attachments
  const [attachments, setAttachments] = useState<WorkTaskAttachment[]>(() => {
    const saved = safeGetItem(LOCAL_STORAGE_KEYS.ATTACHMENTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((att: WorkTaskAttachment) => !isDemoTask(att.taskId));
        }
      } catch {
        // fallback
      }
    }
    return [];
  });

  // 6. Activity Logs
  const [activityLogs, setActivityLogs] = useState<WorkTaskActivityLog[]>(() => {
    const saved = safeGetItem(LOCAL_STORAGE_KEYS.LOGS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((log: WorkTaskActivityLog) => !isDemoTask(log.taskId));
        }
      } catch {
        // fallback
      }
    }
    return [];
  });

  // Sync to localStorage safely
  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    const sanitizedAssignments = taskAssignments.map((a) => {
      if (a.employeeAvatar && (a.employeeAvatar.startsWith('data:') || a.employeeAvatar.length > 200)) {
        const { employeeAvatar, ...rest } = a;
        return { ...rest, employeeAvatar: '' };
      }
      return a;
    });
    safeSetItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(sanitizedAssignments));
  }, [taskAssignments]);

  useEffect(() => {
    const sanitizedUpdates = progressUpdates.map((u) => {
      if (u.employeeAvatar && (u.employeeAvatar.startsWith('data:') || u.employeeAvatar.length > 200)) {
        const { employeeAvatar, ...rest } = u;
        return { ...rest, employeeAvatar: '' };
      }
      return u;
    });
    safeSetItem(LOCAL_STORAGE_KEYS.UPDATES, JSON.stringify(sanitizedUpdates));
  }, [progressUpdates]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.COMMENTS, JSON.stringify(comments));
  }, [comments]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.ATTACHMENTS, JSON.stringify(attachments));
  }, [attachments]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.LOGS, JSON.stringify(activityLogs));
  }, [activityLogs]);

  // Overdue and Due Today helper functions
  const isTaskOverdue = useCallback(
    (dueDate: string, status: TaskStatus): boolean => {
      if (status === 'completed' || status === 'cancelled') return false;
      return dueDate < todayStr;
    },
    [todayStr]
  );

  const isTaskDueToday = useCallback(
    (dueDate: string, status: TaskStatus): boolean => {
      if (status === 'completed' || status === 'cancelled') return false;
      return dueDate === todayStr;
    },
    [todayStr]
  );

  // Computed Summary Metrics
  const summaryMetrics: WorkSummaryMetrics = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    let dueToday = 0;
    let pendingReview = 0;

    tasks.forEach((t) => {
      if (t.status === 'pending') pending++;
      else if (t.status === 'in_progress') inProgress++;
      else if (t.status === 'completed') completed++;
      else if (t.status === 'pending_review') pendingReview++;

      if (isTaskOverdue(t.dueDate, t.status)) overdue++;
      if (isTaskDueToday(t.dueDate, t.status)) dueToday++;
    });

    return {
      totalTasks: tasks.length,
      pendingTasks: pending,
      inProgressTasks: inProgress,
      completedTasks: completed,
      overdueTasks: overdue,
      dueTodayTasks: dueToday,
      pendingReviewTasks: pendingReview,
    };
  }, [tasks, isTaskOverdue, isTaskDueToday]);

  // Computed Employee Workloads
  const employeeWorkloads: EmployeeWorkload[] = useMemo(() => {
    return employees.map((emp) => {
      const empAssignments = taskAssignments.filter((a) => a.employeeId === emp.id);
      const empUpdates = progressUpdates.filter((u) => u.employeeId === emp.id);

      const totalTasks = empAssignments.length;
      let pendingTasks = 0;
      let inProgressTasks = 0;
      let completedTasks = 0;
      let overdueTasks = 0;

      empAssignments.forEach((assign) => {
        const parentTask = tasks.find((t) => t.id === assign.taskId);
        const taskDueDate = parentTask?.dueDate || '';

        if (assign.status === 'pending') pendingTasks++;
        else if (assign.status === 'in_progress') inProgressTasks++;
        else if (assign.status === 'completed') completedTasks++;

        if (isTaskOverdue(taskDueDate, assign.status)) overdueTasks++;
      });

      const totalHoursSpent = empUpdates.reduce((sum, u) => sum + (Number(u.hoursSpent) || 0), 0);
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        employeeAvatar: emp.avatar,
        departmentId: emp.departmentId,
        departmentName: emp.departmentName,
        designation: emp.designation,
        totalTasks,
        pendingTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks,
        completionRate,
        totalHoursSpent,
      };
    });
  }, [employees, taskAssignments, progressUpdates, tasks, isTaskOverdue]);

  // Create Task
  const createTask = useCallback(
    async (params: CreateTaskParams): Promise<WorkTask> => {
      if (!canManageEmployees) {
        showToast('Unauthorized: Only HR or Admin accounts can assign work.', 'error');
        throw new Error('Unauthorized: Only HR or Admin accounts can assign work.');
      }
      // 1. Validation
      if (!params.title.trim()) {
        throw new Error('Task title is required.');
      }
      if (!params.description.trim()) {
        throw new Error('Task description is required.');
      }
      if (!params.dueDate) {
        throw new Error('Due date is required.');
      }
      if (params.startDate && params.dueDate < params.startDate) {
        throw new Error('Due date cannot be earlier than start date.');
      }
      if (params.assignedDate && params.dueDate < params.assignedDate) {
        throw new Error('Due date cannot be earlier than assigned date.');
      }
      if (!params.employeeIds || params.employeeIds.length === 0) {
        throw new Error('Please select at least one employee or department.');
      }

      // Generate unique task code
      const nextNum = tasks.length + 1001;
      const taskCode = `TSK-${nextNum}`;
      const taskId = `task-${Date.now()}`;
      const nowIso = new Date().toISOString();

      let targetDeptName = '';
      if (params.departmentId) {
        const d = departments.find((dept) => dept.id === params.departmentId);
        targetDeptName = d ? d.name : '';
      }

      const newTask: WorkTask = {
        id: taskId,
        taskCode,
        title: params.title.trim(),
        description: params.description.trim(),
        category: params.category || 'Other',
        priority: params.priority || 'medium',
        assignmentType: params.assignmentType,
        departmentId: params.departmentId,
        departmentName: targetDeptName,
        assignedBy: currentUser?.name || 'Administrator',
        assignedById: currentUser?.id,
        assignedDate: params.assignedDate || todayStr,
        startDate: params.startDate || params.assignedDate || todayStr,
        dueDate: params.dueDate,
        dueTime: params.dueTime || '18:00',
        estimatedHours: Number(params.estimatedHours) || 8,
        status: params.initialStatus || 'pending',
        overallProgress: 0,
        instructions: params.instructions || '',
        notes: params.notes || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Create assignments for all target employees
      const newAssignments: WorkTaskAssignment[] = [];
      const assignedNames: string[] = [];

      params.employeeIds.forEach((empId) => {
        const emp = employees.find((e) => e.id === empId);
        if (!emp) return;
        assignedNames.push(emp.fullName);

        newAssignments.push({
          id: `assign-${taskId}-${empId}`,
          taskId,
          employeeId: emp.id,
          employeeName: emp.fullName,
          employeeCode: emp.employeeCode,
          employeeAvatar: emp.avatar,
          departmentId: emp.departmentId,
          departmentName: emp.departmentName,
          designation: emp.designation,
          assignedAt: params.assignedDate || todayStr,
          assignedBy: currentUser?.name || 'Administrator',
          status: params.initialStatus || 'pending',
          progressPercentage: 0,
        });
      });

      // Handle attachments
      const newAttachments: WorkTaskAttachment[] = [];
      if (params.attachments && params.attachments.length > 0) {
        params.attachments.forEach((att, idx) => {
          newAttachments.push({
            id: `att-${taskId}-${idx}`,
            taskId,
            uploadedBy: currentUser?.name || 'Administrator',
            originalFilename: att.originalFilename,
            fileSize: att.fileSize || '1.2 MB',
            fileType: att.fileType || 'application/octet-stream',
            secureStoragePath: att.secureStoragePath || `/attachments/${taskId}/${att.originalFilename}`,
            uploadedAt: nowIso,
          });
        });
      }

      // Activity log
      const newLog: WorkTaskActivityLog = {
        id: `log-${Date.now()}`,
        taskId,
        actorUserId: currentUser?.id || 'admin',
        actorName: currentUser?.name || 'Administrator',
        actorRole: currentUser?.role || 'admin',
        action: 'Task Created',
        notes: `Assigned to ${assignedNames.join(', ') || 'team'}`,
        createdAt: nowIso,
      };

      // Commit to state
      setTasks((prev) => [newTask, ...prev]);
      setTaskAssignments((prev) => [...newAssignments, ...prev]);
      if (newAttachments.length > 0) {
        setAttachments((prev) => [...newAttachments, ...prev]);
      }
      setActivityLogs((prev) => [newLog, ...prev]);

      showToast('Work assigned successfully!', 'success');
      return newTask;
    },
    [tasks, currentUser, canManageEmployees, employees, departments, todayStr, showToast]
  );

  // Update Task
  const updateTask = useCallback(
    (taskId: string, updates: Partial<WorkTask>) => {
      if (!canManageEmployees) {
        showToast('Unauthorized: Only HR or Admin accounts can modify tasks.', 'error');
        return;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
      );

      const log: WorkTaskActivityLog = {
        id: `log-${Date.now()}`,
        taskId,
        actorUserId: currentUser?.id || 'admin',
        actorName: currentUser?.name || 'Administrator',
        actorRole: currentUser?.role || 'admin',
        action: 'Task Updated',
        notes: `Modified task properties`,
        createdAt: new Date().toISOString(),
      };
      setActivityLogs((prev) => [log, ...prev]);
      showToast('Task updated successfully.', 'success');
    },
    [currentUser, canManageEmployees, showToast]
  );

  // Delete Task
  const deleteTask = useCallback(
    (taskId: string) => {
      if (!canManageEmployees) {
        showToast('Unauthorized: Only HR or Admin accounts can delete tasks.', 'error');
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setTaskAssignments((prev) => prev.filter((a) => a.taskId !== taskId));
      setProgressUpdates((prev) => prev.filter((u) => u.taskId !== taskId));
      setComments((prev) => prev.filter((c) => c.taskId !== taskId));
      setAttachments((prev) => prev.filter((a) => a.taskId !== taskId));
      setActivityLogs((prev) => prev.filter((l) => l.taskId !== taskId));
      showToast('Task deleted successfully.', 'info');
    },
    [canManageEmployees, showToast]
  );

  // Update Assignment Progress
  const updateAssignmentProgress = useCallback(
    (assignmentId: string, progress: number, notes?: string, newStatus?: TaskStatus) => {
      const clamped = Math.max(0, Math.min(100, Math.round(progress)));
      let targetTaskId = '';

      setTaskAssignments((prev) =>
        prev.map((a) => {
          if (a.id === assignmentId) {
            targetTaskId = a.taskId;
            let status = a.status;
            if (newStatus) {
              status = newStatus;
            } else if (clamped === 100 && status !== 'completed') {
              status = 'pending_review';
            } else if (clamped > 0 && status === 'pending') {
              status = 'in_progress';
            }
            return {
              ...a,
              progressPercentage: clamped,
              status,
            };
          }
          return a;
        })
      );

      if (targetTaskId) {
        // Recalculate parent task overall progress
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id === targetTaskId) {
              const allForTask = taskAssignments.map((a) =>
                a.id === assignmentId ? { ...a, progressPercentage: clamped } : a
              ).filter((a) => a.taskId === targetTaskId);

              const avg =
                allForTask.length > 0
                  ? Math.round(allForTask.reduce((s, a) => s + a.progressPercentage, 0) / allForTask.length)
                  : clamped;

              let parentStatus = t.status;
              if (newStatus) parentStatus = newStatus;
              else if (avg === 100 && parentStatus !== 'completed') parentStatus = 'pending_review';
              else if (avg > 0 && parentStatus === 'pending') parentStatus = 'in_progress';

              return {
                ...t,
                overallProgress: avg,
                status: parentStatus,
                updatedAt: new Date().toISOString(),
              };
            }
            return t;
          })
        );

        const log: WorkTaskActivityLog = {
          id: `log-${Date.now()}`,
          taskId: targetTaskId,
          assignmentId,
          actorUserId: currentUser?.id || 'user',
          actorName: currentUser?.name || 'User',
          actorRole: currentUser?.role || 'employee',
          action: 'Progress Updated',
          notes: `Progress set to ${clamped}%${notes ? ` — ${notes}` : ''}`,
          createdAt: new Date().toISOString(),
        };
        setActivityLogs((prev) => [log, ...prev]);
      }

      showToast(`Task progress updated to ${clamped}%.`, 'success');
    },
    [taskAssignments, currentUser, showToast]
  );

  // Submit Daily Work Update
  const submitDailyWorkUpdate = useCallback(
    async (params: SubmitDailyUpdateParams): Promise<void> => {
      if (!params.taskId) throw new Error('Task is required.');
      if (!params.employeeId) throw new Error('Employee is required.');
      if (!params.workDescription.trim()) throw new Error('Work completed today description is required.');
      if (params.hoursSpent <= 0) throw new Error('Hours spent must be greater than 0.');

      const emp = employees.find((e) => e.id === params.employeeId);
      const task = tasks.find((t) => t.id === params.taskId);
      const assignment = taskAssignments.find(
        (a) => a.taskId === params.taskId && a.employeeId === params.employeeId
      );

      const assignmentId = params.taskAssignmentId || assignment?.id || `assign-${params.taskId}-${params.employeeId}`;
      const nowIso = new Date().toISOString();

      const newUpdate: WorkProgressUpdate = {
        id: `update-${Date.now()}`,
        taskAssignmentId: assignmentId,
        taskId: params.taskId,
        taskTitle: task?.title || 'Assigned Work',
        employeeId: params.employeeId,
        employeeName: emp?.fullName || currentUser?.name || 'Employee',
        employeeAvatar: emp?.avatar || currentUser?.avatar || '',
        workDate: params.workDate || todayStr,
        workDescription: params.workDescription.trim(),
        hoursSpent: Number(params.hoursSpent),
        progressPercentage: Math.max(0, Math.min(100, Math.round(params.progressPercentage))),
        blockers: params.blockers?.trim() || '',
        supportingFileName: params.supportingFileName || '',
        submittedAt: nowIso,
      };

      setProgressUpdates((prev) => [newUpdate, ...prev]);

      // Also update assignment progress & status
      updateAssignmentProgress(
        assignmentId,
        params.progressPercentage,
        `Daily log: ${params.hoursSpent}h spent. ${params.workDescription}`
      );

      showToast('Daily work update submitted successfully!', 'success');
    },
    [employees, tasks, taskAssignments, currentUser, todayStr, updateAssignmentProgress, showToast]
  );

  // Submit Task For Review
  const submitTaskForReview = useCallback(
    async (assignmentId: string, notes?: string): Promise<void> => {
      const assignment = taskAssignments.find((a) => a.id === assignmentId);
      if (!assignment) throw new Error('Assignment not found.');

      setTaskAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, status: 'pending_review' } : a))
      );

      setTasks((prev) =>
        prev.map((t) => (t.id === assignment.taskId ? { ...t, status: 'pending_review', updatedAt: new Date().toISOString() } : t))
      );

      const log: WorkTaskActivityLog = {
        id: `log-${Date.now()}`,
        taskId: assignment.taskId,
        assignmentId,
        actorUserId: currentUser?.id || 'employee',
        actorName: currentUser?.name || assignment.employeeName,
        actorRole: currentUser?.role || 'employee',
        action: 'Submitted for Review',
        notes: notes || 'Work completed and submitted for supervisor review and approval',
        createdAt: new Date().toISOString(),
      };
      setActivityLogs((prev) => [log, ...prev]);

      showToast('Task submitted for review!', 'success');
    },
    [taskAssignments, currentUser, showToast]
  );

  // Review Task Submission (Approve / Request Changes / Reopen)
  const reviewTaskSubmission = useCallback(
    async (
      assignmentId: string,
      action: 'approve' | 'request_changes' | 'reopen',
      reviewNotes?: string
    ): Promise<void> => {
      const assignment = taskAssignments.find((a) => a.id === assignmentId);
      if (!assignment) throw new Error('Assignment not found.');

      const nowIso = new Date().toISOString();
      const reviewerName = currentUser?.name || 'Administrator';

      if (action === 'approve') {
        setTaskAssignments((prev) =>
          prev.map((a) =>
            a.id === assignmentId
              ? {
                  ...a,
                  status: 'completed',
                  progressPercentage: 100,
                  completedAt: nowIso,
                  reviewedBy: reviewerName,
                  reviewedAt: nowIso,
                  reviewNotes: reviewNotes || 'Approved work completion',
                }
              : a
          )
        );

        // Check if all assignments for this task are completed
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id === assignment.taskId) {
              const others = taskAssignments
                .filter((a) => a.taskId === assignment.taskId && a.id !== assignmentId);
              const allDone = others.every((a) => a.status === 'completed');
              return {
                ...t,
                status: allDone ? 'completed' : t.status,
                overallProgress: allDone ? 100 : t.overallProgress,
                updatedAt: nowIso,
              };
            }
            return t;
          })
        );

        const log: WorkTaskActivityLog = {
          id: `log-${Date.now()}`,
          taskId: assignment.taskId,
          assignmentId,
          actorUserId: currentUser?.id || 'admin',
          actorName: reviewerName,
          actorRole: currentUser?.role || 'admin',
          action: 'Task Approved',
          notes: reviewNotes || 'Work approved and marked as Completed',
          createdAt: nowIso,
        };
        setActivityLogs((prev) => [log, ...prev]);
        showToast('Task completion approved successfully!', 'success');
      } else if (action === 'request_changes') {
        setTaskAssignments((prev) =>
          prev.map((a) =>
            a.id === assignmentId
              ? {
                  ...a,
                  status: 'in_progress',
                  reviewNotes: reviewNotes || 'Changes requested by reviewer',
                }
              : a
          )
        );

        setTasks((prev) =>
          prev.map((t) =>
            t.id === assignment.taskId
              ? { ...t, status: 'in_progress', updatedAt: nowIso }
              : t
          )
        );

        const log: WorkTaskActivityLog = {
          id: `log-${Date.now()}`,
          taskId: assignment.taskId,
          assignmentId,
          actorUserId: currentUser?.id || 'admin',
          actorName: reviewerName,
          actorRole: currentUser?.role || 'admin',
          action: 'Changes Requested',
          notes: reviewNotes || 'Reviewer requested revisions on submitted work',
          createdAt: nowIso,
        };
        setActivityLogs((prev) => [log, ...prev]);
        showToast('Changes requested. Task returned to In Progress.', 'warning');
      } else if (action === 'reopen') {
        setTaskAssignments((prev) =>
          prev.map((a) =>
            a.id === assignmentId
              ? {
                  ...a,
                  status: 'in_progress',
                  completedAt: undefined,
                  reviewNotes: reviewNotes || 'Task reopened',
                }
              : a
          )
        );

        setTasks((prev) =>
          prev.map((t) =>
            t.id === assignment.taskId
              ? { ...t, status: 'in_progress', updatedAt: nowIso }
              : t
          )
        );

        const log: WorkTaskActivityLog = {
          id: `log-${Date.now()}`,
          taskId: assignment.taskId,
          assignmentId,
          actorUserId: currentUser?.id || 'admin',
          actorName: reviewerName,
          actorRole: currentUser?.role || 'admin',
          action: 'Task Reopened',
          notes: reviewNotes || 'Task reopened for further development',
          createdAt: nowIso,
        };
        setActivityLogs((prev) => [log, ...prev]);
        showToast('Task reopened.', 'info');
      }
    },
    [taskAssignments, currentUser, showToast]
  );

  // Add Comment
  const addComment = useCallback(
    (taskId: string, commentText: string, assignmentId?: string) => {
      if (!commentText.trim()) return;

      const newComment: WorkTaskComment = {
        id: `comm-${Date.now()}`,
        taskId,
        assignmentId,
        userId: currentUser?.id || 'user',
        userName: currentUser?.name || 'Administrator',
        userRole: currentUser?.role || 'admin',
        userAvatar: currentUser?.avatar || '',
        comment: commentText.trim(),
        createdAt: new Date().toISOString(),
      };

      setComments((prev) => [...prev, newComment]);

      const log: WorkTaskActivityLog = {
        id: `log-${Date.now()}`,
        taskId,
        assignmentId,
        actorUserId: currentUser?.id || 'user',
        actorName: currentUser?.name || 'User',
        actorRole: currentUser?.role || 'admin',
        action: 'Comment Added',
        notes: commentText.length > 40 ? `${commentText.substring(0, 40)}...` : commentText,
        createdAt: new Date().toISOString(),
      };
      setActivityLogs((prev) => [log, ...prev]);
      showToast('Comment posted.', 'success');
    },
    [currentUser, showToast]
  );

  // Add Attachment
  const addAttachment = useCallback(
    (
      taskId: string,
      file: { originalFilename: string; fileSize?: string; fileType?: string; secureStoragePath?: string },
      assignmentId?: string
    ) => {
      const newAtt: WorkTaskAttachment = {
        id: `att-${Date.now()}`,
        taskId,
        assignmentId,
        uploadedBy: currentUser?.name || 'Administrator',
        originalFilename: file.originalFilename,
        fileSize: file.fileSize || '1.5 MB',
        fileType: file.fileType || 'application/octet-stream',
        secureStoragePath: file.secureStoragePath || `/attachments/${taskId}/${file.originalFilename}`,
        uploadedAt: new Date().toISOString(),
      };

      setAttachments((prev) => [...prev, newAtt]);

      const log: WorkTaskActivityLog = {
        id: `log-${Date.now()}`,
        taskId,
        assignmentId,
        actorUserId: currentUser?.id || 'user',
        actorName: currentUser?.name || 'User',
        actorRole: currentUser?.role || 'admin',
        action: 'File Attached',
        notes: file.originalFilename,
        createdAt: new Date().toISOString(),
      };
      setActivityLogs((prev) => [log, ...prev]);
      showToast('File attached successfully.', 'success');
    },
    [currentUser, showToast]
  );

  // Assign Batch Tasks (New 4-Column Multi-Task System)
  const assignBatchTasks = useCallback(
    async (params: AssignBatchTasksParams): Promise<WorkTask[]> => {
      if (!canManageEmployees) {
        showToast('Unauthorized: Only HR or Admin accounts can assign work.', 'error');
        throw new Error('Unauthorized: Only HR or Admin accounts can assign work.');
      }
      const { employeeIds, tasks: taskItems } = params;
      if (!employeeIds || employeeIds.length === 0) {
        throw new Error('Please select at least one employee.');
      }
      if (!taskItems || taskItems.length === 0) {
        throw new Error('Please enter at least one task.');
      }

      // Find current highest TSK-xxxx number
      let maxNum = 1000;
      tasks.forEach((t) => {
        const m = t.taskCode?.match(/TSK-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      });

      const nowIso = new Date().toISOString();
      const newTasks: WorkTask[] = [];
      const newAssignments: WorkTaskAssignment[] = [];
      const newAttachments: WorkTaskAttachment[] = [];

      taskItems.forEach((item, idx) => {
        const codeNum = maxNum + idx + 1;
        const taskCode = `TSK-${codeNum}`;
        const taskId = `task-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;

        const refPath = item.referenceFile?.secureStoragePath || item.referenceFile?.dataUrl || '';
        const refName = item.referenceFile?.originalFilename || '';

        const createdTask: WorkTask = {
          id: taskId,
          taskCode,
          title: item.title.trim(),
          taskTitle: item.title.trim(),
          brief: item.brief.trim(),
          taskBrief: item.brief.trim(),
          description: item.description?.trim() || '',
          taskDescription: item.description?.trim() || '',
          category: 'General Work',
          priority: 'medium',
          assignmentType: employeeIds.length > 1 ? 'multiple' : 'single',
          assignedBy: params.assignedBy || currentUser?.name || 'Administrator',
          assignedById: params.assignedById || currentUser?.id || 'user-admin',
          assignedDate: todayStr,
          dueDate: todayStr,
          status: 'pending',
          overallProgress: 0,
          referenceFilePath: refPath,
          referenceFileName: refName,
          referenceFileType: item.referenceFile?.fileType || '',
          referenceFileSize: item.referenceFile?.fileSize || '',
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        newTasks.push(createdTask);

        if (item.referenceFile && (item.referenceFile.originalFilename || refPath)) {
          newAttachments.push({
            id: `att-${taskId}-${Date.now()}`,
            taskId,
            uploadedBy: params.assignedBy || currentUser?.name || 'Administrator',
            originalFilename: refName,
            fileSize: item.referenceFile.fileSize || '1.0 MB',
            fileType: item.referenceFile.fileType || 'application/octet-stream',
            secureStoragePath: refPath,
            uploadedAt: nowIso,
          });
        }

        // Generate independent task assignments for every selected employee
        employeeIds.forEach((empId) => {
          const emp = employees.find(
            (e) => e.id === empId || e.employeeCode.toUpperCase() === empId.toUpperCase()
          );
          if (!emp) return;

          newAssignments.push({
            id: `assign-${taskId}-${emp.id}`,
            taskId,
            employeeId: emp.id,
            employeeName: emp.fullName,
            employeeCode: emp.employeeCode,
            employeeAvatar: emp.avatar,
            departmentId: emp.departmentId,
            departmentName: emp.departmentName,
            designation: emp.designation,
            assignedAt: todayStr,
            assignedBy: params.assignedBy || currentUser?.name || 'Administrator',
            status: 'pending',
            assignmentStatus: 'pending',
            progressPercentage: 0,
            taskTitle: item.title.trim(),
            taskBrief: item.brief.trim(),
            taskDescription: item.description?.trim() || '',
            referenceFilePath: refPath,
            referenceFileName: refName,
          });
        });
      });

      // Employee Work Notification System
      employeeIds.forEach((empId) => {
        const emp = employees.find(
          (e) => e.id === empId || e.employeeCode.toUpperCase() === empId.toUpperCase()
        );
        if (!emp) return;

        const count = taskItems.length;
        addNotification({
          title: 'New Work Assigned',
          message: `You have been assigned ${count} new ${count === 1 ? 'task' : 'tasks'} by HR. Click to view your work.`,
          type: 'work_assigned',
          recipientUserId: emp.id,
          recipientEmployeeId: emp.id,
          relatedTaskId: newTasks[0]?.id,
          read: false,
        });
      });

      setTasks((prev) => [...newTasks, ...prev]);
      setTaskAssignments((prev) => [...newAssignments, ...prev]);
      if (newAttachments.length > 0) {
        setAttachments((prev) => [...newAttachments, ...prev]);
      }

      showToast('Tasks assigned successfully!', 'success');
      return newTasks;
    },
    [employees, tasks, currentUser, canManageEmployees, todayStr, addNotification, showToast]
  );

  // Update Assignment Status (Pending, In Progress, Completed) — Restricted to Assigned Employee
  const updateAssignmentStatus = useCallback(
    (assignmentId: string, status: TaskStatus) => {
      const targetAssignment = taskAssignments.find((a) => a.id === assignmentId);
      if (!targetAssignment) {
        showToast('Task assignment not found.', 'error');
        return;
      }

      const ownEmp = findLinkedEmployee(currentUser, employees);
      if (canManageEmployees || !ownEmp || !doesAssignmentBelongToEmployee(targetAssignment, ownEmp)) {
        showToast('Authorization Error: Only the assigned employee can update task status.', 'error');
        return;
      }

      setTaskAssignments((prev) =>
        prev.map((a) => {
          if (a.id === assignmentId) {
            const completedAt = status === 'completed' ? new Date().toISOString().split('T')[0] : undefined;
            const progressPercentage = status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0;
            return {
              ...a,
              status,
              assignmentStatus: status,
              progressPercentage,
              completedAt,
            };
          }
          return a;
        })
      );

      setTasks((prev) =>
        prev.map((t) => {
          const relevantAssignments = taskAssignments.filter((a) => a.taskId === t.id);
          const target = relevantAssignments.find((a) => a.id === assignmentId);
          if (target) {
            const allStatuses = relevantAssignments.map((a) => (a.id === assignmentId ? status : a.status));
            const allCompleted = allStatuses.every((s) => s === 'completed');
            const anyInProgress = allStatuses.some((s) => s === 'in_progress');
            const newOverallStatus: TaskStatus = allCompleted ? 'completed' : anyInProgress ? 'in_progress' : status;
            return {
              ...t,
              status: newOverallStatus,
              overallProgress: allCompleted ? 100 : anyInProgress ? 50 : 0,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        })
      );

      showToast(`Task status updated to ${status}.`, 'info');
    },
    [taskAssignments, currentUser, canManageEmployees, employees, showToast]
  );

  // Record First Viewed Timestamp — Restricted to Assigned Employee
  const recordTaskFirstViewed = useCallback(
    (assignmentId: string) => {
      if (canManageEmployees) return;
      const ownEmp = findLinkedEmployee(currentUser, employees);
      if (!ownEmp) return;

      const timestamp = formatAsiaKolkataDateTime(new Date());
      setTaskAssignments((prev) =>
        prev.map((a) => {
          if (a.id === assignmentId && !a.firstViewedAt && doesAssignmentBelongToEmployee(a, ownEmp)) {
            return {
              ...a,
              firstViewedAt: timestamp,
              updatedAt: new Date().toISOString(),
            };
          }
          return a;
        })
      );
    },
    [canManageEmployees, currentUser, employees]
  );

  // Employee OK - Acknowledge Work Assignment — Restricted to Assigned Employee Only
  const acknowledgeTask = useCallback(
    async (
      assignmentId: string,
      employeeId?: string,
      options?: { source?: 'employee' | 'admin'; note?: string; actorName?: string }
    ) => {
      const targetAssignment = taskAssignments.find((a) => a.id === assignmentId);
      if (!targetAssignment) {
        showToast('Task assignment not found.', 'error');
        return;
      }

      const ownEmp = findLinkedEmployee(currentUser, employees);
      if (
        canManageEmployees ||
        options?.source === 'admin' ||
        !ownEmp ||
        !doesAssignmentBelongToEmployee(targetAssignment, ownEmp)
      ) {
        showToast('Authorization Error: Only the assigned employee can acknowledge this task.', 'error');
        throw new Error('Authorization Error: Only the assigned employee can acknowledge this task.');
      }

      const timestamp = formatAsiaKolkataDateTime(new Date());
      const actorName = ownEmp.fullName || options?.actorName || currentUser?.name || 'Employee';
      const note = options?.note?.trim() || '';

      setTaskAssignments((prev) =>
        prev.map((a) => {
          if (a.id === assignmentId) {
            const finalAckTime = a.acknowledgedAt || timestamp;
            const preservedSource = a.acknowledgementSource === 'admin' ? 'admin' : 'employee';
            return {
              ...a,
              isAcknowledged: true,
              acknowledgedAt: finalAckTime,
              acknowledgedBy: a.acknowledgedBy || actorName,
              acknowledgementSource: preservedSource,
              acknowledgementNote: note || a.acknowledgementNote,
              firstViewedAt: a.firstViewedAt || finalAckTime,
              updatedAt: new Date().toISOString(),
            };
          }
          return a;
        })
      );

      // Add audit activity log only if not previously acknowledged
      if (!targetAssignment.isAcknowledged) {
        const log: WorkTaskActivityLog = {
          id: `log-${Date.now()}`,
          taskId: targetAssignment.taskId,
          assignmentId,
          actorUserId: currentUser?.id || employeeId || 'user',
          actorName,
          actorRole: 'employee',
          action: 'Work Acknowledged by Employee',
          notes: note ? `Note: ${note}` : 'Acknowledged and confirmed assignment',
          createdAt: new Date().toISOString(),
        };
        setActivityLogs((prev) => [log, ...prev]);
      }

      showToast('Work assignment acknowledged successfully.', 'success');
    },
    [taskAssignments, currentUser, canManageEmployees, employees, showToast]
  );

  // Employee Start Work — Restricted to Assigned Employee Only
  const startTaskWork = useCallback(
    async (assignmentId: string, _employeeId: string) => {
      const targetAssignment = taskAssignments.find((a) => a.id === assignmentId);
      if (!targetAssignment) return;

      const ownEmp = findLinkedEmployee(currentUser, employees);
      if (canManageEmployees || !ownEmp || !doesAssignmentBelongToEmployee(targetAssignment, ownEmp)) {
        showToast('Authorization Error: Only the assigned employee can update this task.', 'error');
        throw new Error('Authorization Error: Only the assigned employee can update this task.');
      }

      const timestamp = formatAsiaKolkataDateTime(new Date());

      setTaskAssignments((prev) =>
        prev.map((a) => {
          if (a.id === assignmentId) {
            return {
              ...a,
              status: 'in_progress',
              assignmentStatus: 'in_progress',
              startedAt: timestamp,
              progressPercentage: Math.max(a.progressPercentage || 0, 30),
              updatedAt: new Date().toISOString(),
            };
          }
          return a;
        })
      );

      // Update parent task
      setTasks((prev) =>
        prev.map((t) => {
          const assigns = taskAssignments.filter((a) => a.taskId === t.id);
          if (assigns.some((a) => a.id === assignmentId)) {
            return {
              ...t,
              status: 'in_progress',
              overallProgress: Math.max(t.overallProgress || 0, 30),
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        })
      );

      showToast('Task status updated: In Progress', 'info');
    },
    [taskAssignments, currentUser, canManageEmployees, employees, showToast]
  );

  // Employee - Complete Task — Restricted to Assigned Employee Only
  const completeTask = useCallback(
    async (
      assignmentId: string,
      employeeId?: string,
      options?: { source?: 'employee' | 'admin'; note?: string; actorName?: string }
    ) => {
      const targetAssignment = taskAssignments.find((a) => a.id === assignmentId);
      if (!targetAssignment) {
        showToast('Task assignment not found.', 'error');
        return;
      }

      const ownEmp = findLinkedEmployee(currentUser, employees);
      if (
        canManageEmployees ||
        options?.source === 'admin' ||
        !ownEmp ||
        !doesAssignmentBelongToEmployee(targetAssignment, ownEmp)
      ) {
        showToast('Authorization Error: Only the assigned employee can complete this task.', 'error');
        throw new Error('Authorization Error: Only the assigned employee can complete this task.');
      }

      if (!targetAssignment.isAcknowledged) {
        showToast('Please acknowledge the task first by clicking Seen / OK.', 'warning');
        return;
      }

      const timestamp = formatAsiaKolkataDateTime(new Date());
      const actorName = ownEmp.fullName || options?.actorName || currentUser?.name || 'Employee';
      const note = options?.note?.trim() || '';

      const targetTaskTitle = targetAssignment.taskTitle || '';
      const targetEmployeeName = targetAssignment.employeeName || ownEmp.fullName;
      const targetTaskId = targetAssignment.taskId;

      setTaskAssignments((prev) =>
        prev.map((a) => {
          if (a.id === assignmentId) {
            const finalCompletedTime = a.completedAt || timestamp;
            const preservedCompletionSource = a.completionSource === 'admin' ? 'admin' : 'employee';
            return {
              ...a,
              status: 'completed',
              assignmentStatus: 'completed',
              completedAt: finalCompletedTime,
              completedBy: a.completedBy || actorName,
              completionSource: preservedCompletionSource,
              completionNote: note || a.completionNote,
              progressPercentage: 100,
              updatedAt: new Date().toISOString(),
            };
          }
          return a;
        })
      );

      // Update parent task
      setTasks((prev) =>
        prev.map((t) => {
          const assigns = taskAssignments.filter((a) => a.taskId === t.id);
          const match = assigns.find((a) => a.id === assignmentId);
          if (match) {
            const otherAssigns = assigns.filter((a) => a.id !== assignmentId);
            const allOtherDone = otherAssigns.every((a) => a.status === 'completed');
            return {
              ...t,
              status: allOtherDone ? 'completed' : 'in_progress',
              overallProgress: allOtherDone ? 100 : 70,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        })
      );

      // Add audit activity log
      if (targetTaskId && targetAssignment.status !== 'completed') {
        const log: WorkTaskActivityLog = {
          id: `log-${Date.now()}`,
          taskId: targetTaskId,
          assignmentId,
          actorUserId: currentUser?.id || employeeId || 'user',
          actorName,
          actorRole: 'employee',
          action: 'Task Completed by Employee',
          notes: note ? `Completion Note: ${note}` : 'Work completed by employee',
          createdAt: new Date().toISOString(),
        };
        setActivityLogs((prev) => [log, ...prev]);
      }

      // In-app notification to HR / Administrator
      if (targetAssignment.status !== 'completed') {
        addNotification({
          title: 'Task Completed',
          message: `${targetEmployeeName || 'Employee'} has completed the assigned task: "${targetTaskTitle || 'Assigned Work'}".`,
          type: 'work_assigned',
          recipientUserId: 'user-admin',
          read: false,
        });
      }

      showToast('Task completion recorded successfully!', 'success');
    },
    [taskAssignments, currentUser, canManageEmployees, employees, addNotification, showToast]
  );

  return (
    <WorkAssignmentContext.Provider
      value={{
        tasks,
        taskAssignments,
        progressUpdates,
        comments,
        attachments,
        activityLogs,
        summaryMetrics,
        employeeWorkloads,
        createTask,
        updateTask,
        deleteTask,
        assignBatchTasks,
        updateAssignmentStatus,
        recordTaskFirstViewed,
        acknowledgeTask,
        startTaskWork,
        completeTask,
        updateAssignmentProgress,
        submitDailyWorkUpdate,
        submitTaskForReview,
        reviewTaskSubmission,
        addComment,
        addAttachment,
        isTaskOverdue,
        isTaskDueToday,
      }}
    >
      {children}
    </WorkAssignmentContext.Provider>
  );
};

export const useWorkAssignment = (): WorkAssignmentContextType => {
  const context = useContext(WorkAssignmentContext);
  if (!context) {
    throw new Error('useWorkAssignment must be used within a WorkAssignmentProvider');
  }
  return context;
};
