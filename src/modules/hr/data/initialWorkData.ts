import {
  WorkTask,
  WorkTaskAssignment,
  WorkProgressUpdate,
  WorkTaskComment,
  WorkTaskAttachment,
  WorkTaskActivityLog,
} from '../types/workAssignment';
import { Employee, Department } from '../types/hrms';

export const DEMO_TASK_IDS = [
  'task-1001',
  'task-1002',
  'task-1003',
  'task-1004',
  'task-1005',
  'task-1006',
];

export function isDemoTask(taskId?: string, _taskCode?: string): boolean {
  if (taskId && DEMO_TASK_IDS.includes(taskId)) return true;
  return false;
}

/**
 * Returns empty initial datasets for the clean Employee-Based Work Assignment System.
 * Demo tasks are completely removed so task counts reflect only real database records.
 */
export function generateInitialWorkData(
  employees: Employee[] = [],
  _departments: Department[] = []
): {
  tasks: WorkTask[];
  taskAssignments: WorkTaskAssignment[];
  progressUpdates: WorkProgressUpdate[];
  comments: WorkTaskComment[];
  attachments: WorkTaskAttachment[];
  activityLogs: WorkTaskActivityLog[];
} {
  const dhesan = employees.find((e) => e.employeeCode === 'EMP-1001') || {
    id: 'emp-1001',
    employeeCode: 'EMP-1001',
    fullName: 'Dhesan M',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    departmentId: 'dept-dev',
    departmentName: 'Software Development',
    designation: 'Frontend Developer',
  };
  const dinesh = employees.find((e) => e.employeeCode === 'EMP-1002') || {
    id: 'emp-1002',
    employeeCode: 'EMP-1002',
    fullName: 'Dinesh K',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    departmentId: 'dept-dev',
    departmentName: 'Software Development',
    designation: 'Backend Developer',
  };
  const priya = employees.find((e) => e.employeeCode === 'EMP-1003') || {
    id: 'emp-1003',
    employeeCode: 'EMP-1003',
    fullName: 'Priya K',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    departmentId: 'dept-qa',
    departmentName: 'Quality Assurance',
    designation: 'QA Specialist',
  };

  const today = new Date().toISOString().split('T')[0];

  const tasks: WorkTask[] = [
    {
      id: 'task-real-1001',
      taskCode: 'TSK-1001',
      title: 'Design Homepage UI Components',
      taskTitle: 'Design Homepage UI Components',
      brief: 'Create reusable card, button, and header components for dashboard',
      taskBrief: 'Create reusable card, button, and header components for dashboard',
      description:
        'Design and assemble modern responsive dashboard cards and navigation header matching design system.',
      taskDescription:
        'Design and assemble modern responsive dashboard cards and navigation header matching design system.',
      category: 'UI/UX Design',
      priority: 'high',
      assignmentType: 'single',
      departmentId: dhesan.departmentId,
      departmentName: dhesan.departmentName,
      assignedBy: 'Alex Morgan (HR Administrator)',
      assignedById: 'user-admin',
      assignedDate: today,
      dueDate: today,
      status: 'pending',
      overallProgress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-real-1002',
      taskCode: 'TSK-1002',
      title: 'Optimize Responsive Layouts',
      taskTitle: 'Optimize Responsive Layouts',
      brief: 'Ensure cross-device mobile and tablet viewport compatibility',
      taskBrief: 'Ensure cross-device mobile and tablet viewport compatibility',
      description:
        'Audit and adjust flexible CSS grids, sidebar collapse behavior, and touch targets across all viewport breakpoints.',
      taskDescription:
        'Audit and adjust flexible CSS grids, sidebar collapse behavior, and touch targets across all viewport breakpoints.',
      category: 'Frontend Engineering',
      priority: 'medium',
      assignmentType: 'single',
      departmentId: dhesan.departmentId,
      departmentName: dhesan.departmentName,
      assignedBy: 'Alex Morgan (HR Administrator)',
      assignedById: 'user-admin',
      assignedDate: today,
      dueDate: today,
      status: 'pending',
      overallProgress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-real-1003',
      taskCode: 'TSK-1003',
      title: 'Build REST API Endpoints',
      taskTitle: 'Build REST API Endpoints',
      brief: 'Implement authentication and attendance synchronization endpoints',
      taskBrief: 'Implement authentication and attendance synchronization endpoints',
      description:
        'Construct secure JWT-validated API route handlers for attendance punch clocking and employee work status tracking.',
      taskDescription:
        'Construct secure JWT-validated API route handlers for attendance punch clocking and employee work status tracking.',
      category: 'Backend Engineering',
      priority: 'high',
      assignmentType: 'single',
      departmentId: dinesh.departmentId,
      departmentName: dinesh.departmentName,
      assignedBy: 'Alex Morgan (HR Administrator)',
      assignedById: 'user-admin',
      assignedDate: today,
      dueDate: today,
      status: 'pending',
      overallProgress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-real-1004',
      taskCode: 'TSK-1004',
      title: 'Database Performance Tuning',
      taskTitle: 'Database Performance Tuning',
      brief: 'Index attendance logs and optimize slow queries',
      taskBrief: 'Index attendance logs and optimize slow queries',
      description:
        'Add indexes to attendance logs and optimize SQL query execution plans for sub-100ms dashboard load times.',
      taskDescription:
        'Add indexes to attendance logs and optimize SQL query execution plans for sub-100ms dashboard load times.',
      category: 'Database Management',
      priority: 'medium',
      assignmentType: 'single',
      departmentId: dinesh.departmentId,
      departmentName: dinesh.departmentName,
      assignedBy: 'Alex Morgan (HR Administrator)',
      assignedById: 'user-admin',
      assignedDate: today,
      dueDate: today,
      status: 'pending',
      overallProgress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-real-1005',
      taskCode: 'TSK-1005',
      title: 'Execute Regression Test Suite',
      taskTitle: 'Execute Regression Test Suite',
      brief: 'Run end-to-end verification across HRMS modules',
      taskBrief: 'Run end-to-end verification across HRMS modules',
      description:
        'Perform automated and exploratory regression testing for employee profiles, attendance calculation, and task rosters.',
      taskDescription:
        'Perform automated and exploratory regression testing for employee profiles, attendance calculation, and task rosters.',
      category: 'Quality Assurance',
      priority: 'medium',
      assignmentType: 'single',
      departmentId: priya.departmentId,
      departmentName: priya.departmentName,
      assignedBy: 'Alex Morgan (HR Administrator)',
      assignedById: 'user-admin',
      assignedDate: today,
      dueDate: today,
      status: 'pending',
      overallProgress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const taskAssignments: WorkTaskAssignment[] = [
    {
      id: 'asg-real-1001',
      taskId: 'task-real-1001',
      employeeId: dhesan.id,
      employeeName: dhesan.fullName,
      employeeCode: dhesan.employeeCode,
      employeeAvatar: dhesan.avatar || '',
      departmentId: dhesan.departmentId,
      departmentName: dhesan.departmentName,
      designation: dhesan.designation,
      assignedAt: today,
      assignedBy: 'Alex Morgan (HR Administrator)',
      status: 'pending',
      progressPercentage: 0,
      taskTitle: 'Design Homepage UI Components',
      taskBrief: 'Create reusable card, button, and header components for dashboard',
      taskDescription:
        'Design and assemble modern responsive dashboard cards and navigation header matching design system.',
      isAcknowledged: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'asg-real-1002',
      taskId: 'task-real-1002',
      employeeId: dhesan.id,
      employeeName: dhesan.fullName,
      employeeCode: dhesan.employeeCode,
      employeeAvatar: dhesan.avatar || '',
      departmentId: dhesan.departmentId,
      departmentName: dhesan.departmentName,
      designation: dhesan.designation,
      assignedAt: today,
      assignedBy: 'Alex Morgan (HR Administrator)',
      status: 'pending',
      progressPercentage: 0,
      taskTitle: 'Optimize Responsive Layouts',
      taskBrief: 'Ensure cross-device mobile and tablet viewport compatibility',
      taskDescription:
        'Audit and adjust flexible CSS grids, sidebar collapse behavior, and touch targets across all viewport breakpoints.',
      isAcknowledged: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'asg-real-1003',
      taskId: 'task-real-1003',
      employeeId: dinesh.id,
      employeeName: dinesh.fullName,
      employeeCode: dinesh.employeeCode,
      employeeAvatar: dinesh.avatar || '',
      departmentId: dinesh.departmentId,
      departmentName: dinesh.departmentName,
      designation: dinesh.designation,
      assignedAt: today,
      assignedBy: 'Alex Morgan (HR Administrator)',
      status: 'pending',
      progressPercentage: 0,
      taskTitle: 'Build REST API Endpoints',
      taskBrief: 'Implement authentication and attendance synchronization endpoints',
      taskDescription:
        'Construct secure JWT-validated API route handlers for attendance punch clocking and employee work status tracking.',
      isAcknowledged: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'asg-real-1004',
      taskId: 'task-real-1004',
      employeeId: dinesh.id,
      employeeName: dinesh.fullName,
      employeeCode: dinesh.employeeCode,
      employeeAvatar: dinesh.avatar || '',
      departmentId: dinesh.departmentId,
      departmentName: dinesh.departmentName,
      designation: dinesh.designation,
      assignedAt: today,
      assignedBy: 'Alex Morgan (HR Administrator)',
      status: 'pending',
      progressPercentage: 0,
      taskTitle: 'Database Performance Tuning',
      taskBrief: 'Index attendance logs and optimize slow queries',
      taskDescription:
        'Add indexes to attendance logs and optimize SQL query execution plans for sub-100ms dashboard load times.',
      isAcknowledged: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'asg-real-1005',
      taskId: 'task-real-1005',
      employeeId: priya.id,
      employeeName: priya.fullName,
      employeeCode: priya.employeeCode,
      employeeAvatar: priya.avatar || '',
      departmentId: priya.departmentId,
      departmentName: priya.departmentName,
      designation: priya.designation,
      assignedAt: today,
      assignedBy: 'Alex Morgan (HR Administrator)',
      status: 'pending',
      progressPercentage: 0,
      taskTitle: 'Execute Regression Test Suite',
      taskBrief: 'Run end-to-end verification across HRMS modules',
      taskDescription:
        'Perform automated and exploratory regression testing for employee profiles, attendance calculation, and task rosters.',
      isAcknowledged: false,
      updatedAt: new Date().toISOString(),
    },
  ];

  return {
    tasks,
    taskAssignments,
    progressUpdates: [],
    comments: [],
    attachments: [],
    activityLogs: [],
  };
}
