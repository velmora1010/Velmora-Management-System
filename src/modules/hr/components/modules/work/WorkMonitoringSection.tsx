import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Eye,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  Building2,
  Calendar,
  Briefcase,
  Layers,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { useWorkAssignment } from '../../../context/WorkAssignmentContext';
import { EmployeeWorkload, WorkTask, WorkTaskAssignment } from '../../../types/workAssignment';

export const WorkMonitoringSection: React.FC = () => {
  const { employeeWorkloads, tasks, taskAssignments, progressUpdates, isTaskOverdue } = useWorkAssignment();
  const [selectedWorkload, setSelectedWorkload] = useState<EmployeeWorkload | null>(null);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-[#172B4D]">Employee Work Monitoring</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Workload distribution, operational progress, and active employee task status
            </p>
          </div>
          <span className="text-xs font-bold text-[#206DA6] bg-blue-50 px-3 py-1 rounded-xl border border-blue-200 self-start sm:self-auto">
            {employeeWorkloads.length} Active Employees Tracked
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Employee ID</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4 text-center">Total Assigned</th>
                <th className="py-3.5 px-4 text-center">Pending</th>
                <th className="py-3.5 px-4 text-center">In Progress</th>
                <th className="py-3.5 px-4 text-center">Completed</th>
                <th className="py-3.5 px-4 text-center">Overdue</th>
                <th className="py-3.5 px-4 text-center">Completion Rate</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employeeWorkloads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No employee workload data available.
                  </td>
                </tr>
              ) : (
                employeeWorkloads.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-50/80 transition-colors">
                    {/* 1. Employee Photo & Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={emp.employeeAvatar}
                          alt=""
                          className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200 flex-shrink-0"
                        />
                        <div>
                          <p className="font-bold text-[#172B4D] text-xs">{emp.employeeName}</p>
                          <p className="text-[11px] text-slate-500">{emp.designation || 'Staff'}</p>
                        </div>
                      </div>
                    </td>

                    {/* 2. Employee ID */}
                    <td className="py-3 px-4 font-mono font-semibold text-slate-600">
                      {emp.employeeCode}
                    </td>

                    {/* 3. Department */}
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {emp.departmentName}
                    </td>

                    {/* 4. Total Assigned Tasks */}
                    <td className="py-3 px-4 text-center font-bold font-mono text-slate-800">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100">
                        {emp.totalTasks}
                      </span>
                    </td>

                    {/* 5. Pending */}
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                        {emp.pendingTasks}
                      </span>
                    </td>

                    {/* 6. In Progress */}
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                        {emp.inProgressTasks}
                      </span>
                    </td>

                    {/* 7. Completed */}
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        {emp.completedTasks}
                      </span>
                    </td>

                    {/* 8. Overdue */}
                    <td className="py-3 px-4 text-center font-mono">
                      {emp.overdueTasks > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold animate-pulse">
                          {emp.overdueTasks}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* 9. Completion Rate */}
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${emp.completionRate}%` }}
                          />
                        </div>
                        <span className="text-slate-700">{emp.completionRate}%</span>
                      </div>
                    </td>

                    {/* 10. View Work */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedWorkload(emp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#206DA6] hover:border-[#206DA6] font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Work</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= VIEW WORK POPUP MODAL ================= */}
      {selectedWorkload && (
        <ViewWorkModal
          workload={selectedWorkload}
          onClose={() => setSelectedWorkload(null)}
          tasks={tasks}
          taskAssignments={taskAssignments}
          progressUpdates={progressUpdates}
          isTaskOverdue={isTaskOverdue}
        />
      )}
    </div>
  );
};

interface ViewWorkModalProps {
  workload: EmployeeWorkload;
  onClose: () => void;
  tasks: WorkTask[];
  taskAssignments: WorkTaskAssignment[];
  progressUpdates: any[];
  isTaskOverdue: (dueDate: string, status: any) => boolean;
}

const ViewWorkModal: React.FC<ViewWorkModalProps> = ({
  workload,
  onClose,
  tasks,
  taskAssignments,
  progressUpdates,
  isTaskOverdue,
}) => {
  const empAssignments = taskAssignments.filter((a) => a.employeeId === workload.employeeId);
  const empTaskIds = empAssignments.map((a) => a.taskId);
  const empTasks = tasks.filter((t) => empTaskIds.includes(t.id));
  const empUpdates = progressUpdates.filter((u) => u.employeeId === workload.employeeId);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-[#0F172A]/55 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-6 transform transition-all text-left z-10 animate-fade-in flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={workload.employeeAvatar}
              alt=""
              className="w-11 h-11 rounded-xl object-cover ring-2 ring-[#206DA6]/20"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#172B4D]">{workload.employeeName}</h3>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-600">
                  {workload.employeeCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {workload.departmentName} • {workload.designation}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workload Stats Bar */}
        <div className="grid grid-cols-5 p-4 bg-blue-50/30 border-b border-slate-100 text-center text-xs divide-x divide-slate-100">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
            <span className="text-base font-mono font-bold text-slate-800">{workload.totalTasks}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending</span>
            <span className="text-base font-mono font-bold text-slate-600">{workload.pendingTasks}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">In Progress</span>
            <span className="text-base font-mono font-bold text-blue-600">{workload.inProgressTasks}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Completed</span>
            <span className="text-base font-mono font-bold text-emerald-600">{workload.completedTasks}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Overdue</span>
            <span className="text-base font-mono font-bold text-rose-600">{workload.overdueTasks}</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Active Tasks List */}
          <div>
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2.5">
              Assigned Tasks ({empTasks.length})
            </h4>

            {empTasks.length === 0 ? (
              <p className="text-slate-400 italic">No tasks currently assigned.</p>
            ) : (
              <div className="space-y-2">
                {empTasks.map((t) => {
                  const assign = empAssignments.find((a) => a.taskId === t.id);
                  const isOver = isTaskOverdue(t.dueDate, t.status);
                  return (
                    <div
                      key={t.id}
                      className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[11px] text-slate-700">
                            {t.taskCode}
                          </span>
                          <span className="font-bold text-slate-800 text-xs">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isOver && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded">
                              Overdue
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-[11px] font-bold bg-white border border-slate-200 rounded capitalize">
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Due Date: <strong className="text-slate-700">{t.dueDate}</strong></span>
                        <span>Progress: <strong className="text-[#206DA6] font-mono">{assign?.progressPercentage || t.overallProgress}%</strong></span>
                      </div>

                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#206DA6] h-full rounded-full"
                          style={{ width: `${assign?.progressPercentage || t.overallProgress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Daily Updates History */}
          <div>
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2.5">
              Recent Daily Work Updates ({empUpdates.length})
            </h4>

            {empUpdates.length === 0 ? (
              <p className="text-slate-400 italic">No daily updates submitted yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {empUpdates.map((u) => (
                  <div key={u.id} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800">{u.taskTitle}</span>
                      <span className="text-slate-400 font-mono">{u.workDate} • {u.hoursSpent}h</span>
                    </div>
                    <p className="text-slate-600">{u.workDescription}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 font-bold text-xs text-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
