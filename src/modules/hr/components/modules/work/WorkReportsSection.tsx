import React, { useState, useMemo } from 'react';
import {
  Download,
  Printer,
  FileSpreadsheet,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Users,
  Calendar,
  Filter,
} from 'lucide-react';
import { useWorkAssignment } from '../../../context/WorkAssignmentContext';
import { useHRMS } from '../../../context/HRMSContext';
import { TaskStatus, TaskPriority } from '../../../types/workAssignment';

export const WorkReportsSection: React.FC = () => {
  const { tasks, taskAssignments, progressUpdates, isTaskOverdue } = useWorkAssignment();
  const { employees, departments } = useHRMS();

  // Filters
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterDepartmentId !== 'all' && t.departmentId !== filterDepartmentId) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (startDate && t.dueDate < startDate) return false;
      if (endDate && t.dueDate > endDate) return false;

      if (filterEmployeeId !== 'all') {
        const assigned = taskAssignments.some(
          (a) => a.taskId === t.id && a.employeeId === filterEmployeeId
        );
        if (!assigned) return false;
      }

      return true;
    });
  }, [tasks, taskAssignments, filterDepartmentId, filterStatus, filterPriority, filterEmployeeId, startDate, endDate]);

  // Aggregate stats
  const totalCount = filteredTasks.length;
  const completedCount = filteredTasks.filter((t) => t.status === 'completed').length;
  const inProgressCount = filteredTasks.filter((t) => t.status === 'in_progress').length;
  const pendingCount = filteredTasks.filter((t) => t.status === 'pending').length;
  const overdueCount = filteredTasks.filter((t) => isTaskOverdue(t.dueDate, t.status)).length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Department Breakdown
  const departmentBreakdown = useMemo(() => {
    return departments.map((dept) => {
      const deptTasks = tasks.filter((t) => t.departmentId === dept.id);
      const done = deptTasks.filter((t) => t.status === 'completed').length;
      const rate = deptTasks.length > 0 ? Math.round((done / deptTasks.length) * 100) : 0;
      return {
        deptName: dept.name,
        total: deptTasks.length,
        completed: done,
        rate,
      };
    }).filter((d) => d.total > 0 || departments.length <= 5);
  }, [departments, tasks]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Task Code',
      'Title',
      'Category',
      'Priority',
      'Status',
      'Assigned Employees',
      'Department',
      'Assigned Date',
      'Due Date',
      'Estimated Hours',
      'Overall Progress',
      'Is Overdue',
    ];

    const rows = filteredTasks.map((t) => {
      const assigned = taskAssignments
        .filter((a) => a.taskId === t.id)
        .map((a) => a.employeeName)
        .join('; ');

      const overdueStr = isTaskOverdue(t.dueDate, t.status) ? 'YES' : 'NO';

      return [
        t.taskCode,
        `"${t.title.replace(/"/g, '""')}"`,
        `"${t.category}"`,
        t.priority.toUpperCase(),
        t.status.toUpperCase(),
        `"${assigned}"`,
        `"${t.departmentName || ''}"`,
        t.assignedDate,
        t.dueDate,
        t.estimatedHours || 8,
        `${t.overallProgress}%`,
        overdueStr,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `work_assignment_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Top Header & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#172B4D] tracking-tight">Work Assignment Reports</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational workload analysis, completion trends, and task delivery metrics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#206DA6] hover:bg-[#1a5784] text-white font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Department Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Department</label>
          <select
            value={filterDepartmentId}
            onChange={(e) => setFilterDepartmentId(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Employee Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Employee</label>
          <select
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white"
          >
            <option value="all">All Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_review">Pending Review</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Priority</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">From Due Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl font-mono"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">To Due Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl font-mono"
          />
        </div>
      </div>

      {/* Aggregate Report Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Tasks</span>
          <span className="text-xl font-extrabold text-[#172B4D] font-mono mt-0.5 block">{totalCount}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed</span>
          <span className="text-xl font-extrabold text-emerald-600 font-mono mt-0.5 block">{completedCount}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">In Progress</span>
          <span className="text-xl font-extrabold text-blue-600 font-mono mt-0.5 block">{inProgressCount}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending</span>
          <span className="text-xl font-extrabold text-slate-600 font-mono mt-0.5 block">{pendingCount}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overdue</span>
          <span className="text-xl font-extrabold text-rose-600 font-mono mt-0.5 block">{overdueCount}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completion Rate</span>
          <span className="text-xl font-extrabold text-[#206DA6] font-mono mt-0.5 block">{completionRate}%</span>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-sm text-[#172B4D]">Department-Wise Task Breakdown</h4>
          <span className="text-[11px] text-slate-500">Live operational distribution</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4 text-center">Total Tasks</th>
                <th className="py-3 px-4 text-center">Completed</th>
                <th className="py-3 px-4 text-center">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departmentBreakdown.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-bold text-slate-800">{d.deptName}</td>
                  <td className="py-2.5 px-4 text-center font-mono font-semibold">{d.total}</td>
                  <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-600">{d.completed}</td>
                  <td className="py-2.5 px-4 text-center font-mono font-bold text-[#206DA6]">{d.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filtered Tasks Detailed Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-sm text-[#172B4D]">Detailed Work Log ({filteredTasks.length} Records)</h4>
          <span className="text-[11px] text-slate-400 font-mono">Real database records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Task Code</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No tasks match the selected report filters.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-700">{t.taskCode}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-800 max-w-xs truncate">{t.title}</td>
                    <td className="py-2.5 px-4 text-slate-600">{t.category}</td>
                    <td className="py-2.5 px-4 uppercase font-bold text-[10px]">{t.priority}</td>
                    <td className="py-2.5 px-4 font-mono">{t.dueDate}</td>
                    <td className="py-2.5 px-4 capitalize font-semibold">{t.status.replace('_', ' ')}</td>
                    <td className="py-2.5 px-4 text-center font-mono font-bold text-[#206DA6]">{t.overallProgress}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
