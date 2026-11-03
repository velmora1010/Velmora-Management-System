import { UserRole } from './hrms';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'pending_review'
  | 'completed'
  | 'on_hold'
  | 'cancelled';

export type TaskCategory =
  | 'Software Development'
  | 'UI/UX Design'
  | 'Graphic Design'
  | 'Testing'
  | 'Marketing'
  | 'Documentation'
  | 'Data Entry'
  | 'Research'
  | 'Accounts'
  | 'Administration'
  | 'Other';

export type AssignmentType = 'single' | 'multiple' | 'department';

export interface WorkTask {
  id: string; // UUID
  organizationId?: string;
  taskCode: string; // Unique, e.g. "TSK-1001"
  title: string;
  taskTitle?: string;
  brief?: string;
  taskBrief?: string;
  description: string;
  taskDescription?: string;
  category: TaskCategory | string;
  priority: TaskPriority;
  assignmentType: AssignmentType;
  departmentId?: string;
  departmentName?: string;
  assignedBy: string; // HR/Admin user name
  assignedById?: string;
  assignedDate: string; // YYYY-MM-DD
  startDate?: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  estimatedHours?: number;
  status: TaskStatus;
  overallProgress: number; // 0 - 100
  instructions?: string;
  notes?: string;
  referenceFilePath?: string;
  referenceFileName?: string;
  referenceFileType?: string;
  referenceFileSize?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkTaskAssignment {
  id: string; // UUID
  taskId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  employeeAvatar: string;
  departmentId: string;
  departmentName: string;
  designation?: string;
  assignedAt: string;
  assignedBy: string;
  status: TaskStatus;
  assignmentStatus?: TaskStatus;
  progressPercentage: number;
  taskTitle?: string;
  taskBrief?: string;
  taskDescription?: string;
  referenceFilePath?: string;
  referenceFileName?: string;
  firstViewedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgementSource?: 'employee' | 'admin';
  acknowledgementNote?: string;
  isAcknowledged?: boolean;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  completionSource?: 'employee' | 'admin';
  completionNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  updatedAt?: string;
}

export interface BatchTaskItem {
  id?: string;
  rowId: string;
  referenceFile?: {
    originalFilename: string;
    fileSize?: string;
    fileType?: string;
    secureStoragePath?: string;
    dataUrl?: string;
  };
  title: string;
  brief: string;
  description?: string;
}

export interface AssignBatchTasksParams {
  employeeIds: string[];
  tasks: BatchTaskItem[];
  assignedBy?: string;
  assignedById?: string;
}

export interface WorkProgressUpdate {
  id: string;
  taskAssignmentId: string;
  taskId: string;
  taskTitle: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar: string;
  workDate: string; // YYYY-MM-DD
  workDescription: string;
  hoursSpent: number;
  progressPercentage: number;
  blockers?: string;
  supportingFileName?: string;
  submittedAt: string;
}

export interface WorkTaskComment {
  id: string;
  taskId: string;
  assignmentId?: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userAvatar: string;
  comment: string;
  createdAt: string;
}

export interface WorkTaskAttachment {
  id: string;
  taskId: string;
  assignmentId?: string;
  uploadedBy: string;
  originalFilename: string;
  fileSize?: string;
  fileType?: string;
  secureStoragePath: string;
  uploadedAt: string;
}

export interface WorkTaskActivityLog {
  id: string;
  taskId: string;
  assignmentId?: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: string;
  oldValues?: string;
  newValues?: string;
  notes?: string;
  createdAt: string;
}

export interface WorkSummaryMetrics {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  dueTodayTasks: number;
  pendingReviewTasks: number;
}

export interface EmployeeWorkload {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  employeeAvatar: string;
  departmentId: string;
  departmentName: string;
  designation: string;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number; // percentage
  totalHoursSpent: number;
}
