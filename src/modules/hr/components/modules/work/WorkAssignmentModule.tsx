import React, { useState, useMemo } from 'react';
import {
  Users,
  ClipboardList,
  Plus,
  Clock,
  CheckCircle2,
  PlayCircle,
  Building2,
  Briefcase,
  ArrowRight,
  FileText,
  Calendar,
  Sparkles,
  Search,
  Filter,
  Check,
  Eye,
  AlertCircle,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCheck,
} from 'lucide-react';
import { useWorkAssignment } from '../../../context/WorkAssignmentContext';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { Employee } from '../../../types/hrms';
import { WorkTask, TaskStatus } from '../../../types/workAssignment';
import { AssignWorkModal } from './AssignWorkModal';
import { TaskDetailsModal } from './TaskDetailsModal';
import { EmployeeAssignedWorkModal } from './EmployeeAssignedWorkModal';
import { ViewAssignedWorkSection } from './ViewAssignedWorkSection';
import { Avatar } from '../../common/Avatar';
import { doesAssignmentBelongToEmployee } from '../../../utils/employeeIdentity';

export const WorkAssignmentModule: React.FC = () => {
  const { tasks, taskAssignments, updateAssignmentStatus } = useWorkAssignment();
  const { employees } = useHRMS();
  const { currentUser, canManageEmployees } = useAuth();

  // Modals state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignModalEmployee, setAssignModalEmployee] = useState<Employee | null>(null);
  const [isAssignToAll, setIsAssignToAll] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<WorkTask | null>(null);

  // Redesigned View Assigned Work Section state
  const [selectedEmployeeForView, setSelectedEmployeeForView] = useState<Employee | null>(null);

  // Employee Assigned Work Modal state
  const [assignedWorkModalEmployee, setAssignedWorkModalEmployee] = useState<Employee | null>(null);

  // Target Three Employees: Dhesan M (EMP-1001), Dinesh K (EMP-1002), Priya K (EMP-1003)
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

    // Extensible fallback: take all employees or first 3
    return employees.length > 0 ? employees : [];
  }, [employees]);

  // Open modal for single employee work assignment
  const handleOpenAssignModal = (employee: Employee) => {
    setAssignModalEmployee(employee);
    setIsAssignToAll(false);
    setIsAssignModalOpen(true);
  };

  // Open modal for all employees
  const handleOpenAssignToAllModal = () => {
    setAssignModalEmployee(null);
    setIsAssignToAll(true);
    setIsAssignModalOpen(true);
  };

  // Open Employee Assigned Work Section / Popup
  const handleOpenAssignedWorkModal = (employee: Employee) => {
    setSelectedEmployeeForView(employee);
  };

  // Check if current user is an employee viewing their own tasks
  const isEmployeeRole = !canManageEmployees && !!currentUser?.employeeId;
  const loggedInEmployee = employees.find(
    (e) =>
      e.id === currentUser?.employeeId ||
      e.employeeCode?.toUpperCase() === currentUser?.employeeId?.toUpperCase() ||
      e.fullName?.toLowerCase() === currentUser?.name?.toLowerCase()
  );

  // Tasks assigned to logged in employee
  const myAssignedTasks = useMemo(() => {
    if (!loggedInEmployee) return [];
    const myAssignments = taskAssignments.filter(
      (a) =>
        a.employeeId === loggedInEmployee.id ||
        a.employeeCode?.toUpperCase() === loggedInEmployee.employeeCode?.toUpperCase()
    );
    const myTaskIds = new Set(myAssignments.map((a) => a.taskId));
    return tasks.filter((t) => myTaskIds.has(t.id));
  }, [loggedInEmployee, taskAssignments, tasks]);

  // Dynamic calculations from database
  const totalEmployeesCount = targetEmployees.length;
  const totalTasksCount = taskAssignments.length;
  const pendingTasksCount = taskAssignments.filter((a) => a.status === 'pending').length;
  const completedTasksCount = taskAssignments.filter((a) => a.status === 'completed').length;

  if (!canManageEmployees) {
    return null;
  }

  // If an employee is selected for viewing assigned work, render the redesigned ViewAssignedWorkSection
  if (selectedEmployeeForView) {
    return (
      <ViewAssignedWorkSection
        employee={selectedEmployeeForView}
        onBack={() => setSelectedEmployeeForView(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-[#172B4D]">
      {/* ================= 1. PAGE HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#151D2B] text-violet-400 border border-[#334155] flex items-center justify-center font-bold">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F8FAFC]">
                Work Assignment
              </h1>
              <p className="text-xs sm:text-sm text-[#94A3B8] mt-0.5">
                Assign daily work and manage employee tasks.
              </p>
            </div>
          </div>
        </div>

        {/* Top Action: Assign Work to All */}
        {canManageEmployees && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAssignToAllModal}
              className="px-5 py-2.5 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 group border border-[#7C3AED]"
            >
              <Plus className="w-4 h-4 text-white/90 group-hover:scale-110 transition-transform" />
              <span>Assign Work to All</span>
            </button>
          </div>
        )}
      </div>

      {/* ================= 2. TOP SUMMARY METRIC CARDS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155] shadow-xs hover:border-[#6D28D9]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">
              Total Employees
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#151D2B] text-violet-400 flex items-center justify-center border border-[#334155]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#F8FAFC]">{totalEmployeesCount}</span>
            <span className="text-[11px] text-[#94A3B8] block mt-0.5">Assigned workforce</span>
          </div>
        </div>

        {/* Total Assigned Tasks */}
        <div className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155] shadow-xs hover:border-[#6D28D9]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">
              Total Assigned Tasks
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#151D2B] text-indigo-400 flex items-center justify-center border border-[#334155]">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#F8FAFC]">{totalTasksCount}</span>
            <span className="text-[11px] text-[#94A3B8] block mt-0.5">Active database tasks</span>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155] shadow-xs hover:border-[#6D28D9]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">
              Pending Tasks
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#151D2B] text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400">{pendingTasksCount}</span>
            <span className="text-[11px] text-[#94A3B8] block mt-0.5">Awaiting completion</span>
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155] shadow-xs hover:border-[#6D28D9]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">
              Completed Tasks
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#151D2B] text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">{completedTasksCount}</span>
            <span className="text-[11px] text-[#94A3B8] block mt-0.5">Finished deliverables</span>
          </div>
        </div>
      </div>

      {/* ================= 3. EMPLOYEE TASK ROSTER ================= */}
      {isEmployeeRole ? (
        /* EMPLOYEE VIEW — MY ASSIGNED WORK */
        <div className="bg-[#1E293B] rounded-2xl border border-[#334155] p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155] pb-5">
            <div className="flex items-center gap-3.5">
              <Avatar
                src={loggedInEmployee?.avatar}
                name={loggedInEmployee?.fullName || currentUser.name}
                size="lg"
                className="ring-2 ring-white shadow-xs rounded-2xl"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#172B4D]">{loggedInEmployee?.fullName || currentUser.name}</h2>
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-[#151D2B] text-[#CBD5E1] border border-[#334155]">
                    {loggedInEmployee?.employeeCode || 'EMP'}
                  </span>
                </div>
                <p className="text-xs text-[#CBD5E1] mt-0.5">
                  {loggedInEmployee?.designation || 'Staff'} • {loggedInEmployee?.departmentName || 'General Department'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loggedInEmployee && handleOpenAssignedWorkModal(loggedInEmployee)}
                className="px-4 py-2 bg-[#206DA6] hover:bg-[#1a5682] text-white rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                <span>Open Assigned Work Portal</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">
                My Assigned Work Orders ({myAssignedTasks.length})
              </h3>
              <span className="text-xs text-slate-400">
                Acknowledge and track your assignments below
              </span>
            </div>

            {myAssignedTasks.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No tasks assigned to you right now.</p>
                <p className="text-[11px] text-slate-400 mt-1">Check back when HR assigns daily work.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myAssignedTasks.map((t) => {
                  const assignment = taskAssignments.find(
                    (a) => a.taskId === t.id && a.employeeId === loggedInEmployee?.id
                  );
                  const isAck = !!assignment?.isAcknowledged;
                  const status = assignment?.status || t.status;

                  return (
                    <div
                      key={t.id}
                      className="p-4 bg-[#151D2B] rounded-xl border border-[#334155] shadow-2xs transition-shadow space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-[#206DA6] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {t.taskCode}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              status === 'completed' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : status === 'in_progress' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Pending'}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-[#172B4D] line-clamp-1">{t.title}</h4>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                            {t.brief || t.taskBrief || t.description}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Seen Status:</span>
                          {isAck ? (
                            <span className="text-emerald-700 font-bold">Acknowledged ✓</span>
                          ) : (
                            <span className="text-amber-600 font-semibold">Awaiting OK</span>
                          )}
                        </div>

                        <button
                          onClick={() => loggedInEmployee && handleOpenAssignedWorkModal(loggedInEmployee)}
                          className="w-full py-2 bg-slate-50 hover:bg-blue-50 text-[#206DA6] border border-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View & Update Work</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* EMPLOYEE TASK ROSTER */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#F8FAFC]">Employee Task Roster</h2>
              <p className="text-xs text-[#94A3B8]">Select an employee card below to create or review daily work assignments.
              </p>
            </div>
            <span className="text-xs font-bold text-[#CBD5E1] bg-[#151D2B] px-3 py-1 rounded-full border border-[#334155]">
              {targetEmployees.length} Active Employees
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {targetEmployees.map((emp) => {
              const empAssignments = taskAssignments.filter((a) =>
                doesAssignmentBelongToEmployee(a, emp)
              );
              const empTotal = empAssignments.length;
              const empPending = empAssignments.filter((a) => a.status === 'pending').length;
              const empCompleted = empAssignments.filter((a) => a.status === 'completed').length;
              const empAck = empAssignments.filter((a) => a.isAcknowledged).length;

              return (
                <div
                  key={emp.id}
                  className="bg-[#1E293B] rounded-2xl border border-[#334155] shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group hover:border-[#6D28D9]/60"
                >
                  {/* Card Header Profile Banner */}
                  <div className="p-5 border-b border-[#334155] bg-[#151D2B]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <Avatar
                          src={emp.avatar}
                          name={emp.fullName}
                          size="lg"
                          className="ring-2 ring-white shadow-xs rounded-2xl group-hover:scale-105 transition-transform"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[#F8FAFC] group-hover:text-violet-300 transition-colors">
                              {emp.fullName}
                            </h3>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#0F172A] text-[#CBD5E1] border border-[#334155]">
                              {emp.employeeCode}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-[#CBD5E1] flex items-center gap-1.5 mt-0.5">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                            {emp.designation || 'Specialist'}
                          </p>
                          <p className="text-[11px] text-[#94A3B8] flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 text-slate-300" />
                            {emp.departmentName || 'Software Development'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Employee Task Statistics Row (Total, Pending, Done, Acknowledged) */}
                    <div className="mt-4 pt-4 border-t border-[#334155] grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 bg-[#0F172A] rounded-xl border border-[#334155]"><span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider block">Total</span><span className="text-sm font-extrabold text-[#F8FAFC]">{empTotal}</span></div>
                      <div className="p-2 bg-[#0F172A] rounded-xl border border-amber-500/30"><span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block">Pending</span><span className="text-sm font-extrabold text-amber-300">{empPending}</span></div>
                      <div className="p-2 bg-[#0F172A] rounded-xl border border-emerald-500/30"><span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">Done</span><span className="text-sm font-extrabold text-emerald-300">{empCompleted}</span></div>
                      <div className="p-2 bg-[#0F172A] rounded-xl border border-indigo-500/30"><span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Seen</span><span className="text-sm font-extrabold text-indigo-300">{empAck}/{empTotal}</span></div>
                    </div>
                  </div>

                  {/* Card Body: Task List */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-[#1E293B]">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider">
                          Assigned Work ({empTotal})
                        </span>
                      </div>

                      {empAssignments.length === 0 ? (
                        <div className="py-6 text-center bg-[#151D2B] rounded-xl border border-dashed border-[#334155]">
                          <ClipboardList className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                          <p className="text-xs font-semibold text-[#CBD5E1]">No tasks assigned yet</p>
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">
                            Click Assign Work to create daily assignments.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {empAssignments.map((assign, idx) => {
                            const parentTask = tasks.find((t) => t.id === assign.taskId);
                            const taskCode = parentTask?.taskCode || `TSK-${1001 + idx}`;
                            const title = assign.taskTitle || parentTask?.title || 'Assigned Work';
                            const status = assign.status;
                            const isAck = !!assign.isAcknowledged;

                            return (
                              <div
                                key={assign.id}
                                onClick={() => handleOpenAssignedWorkModal(emp)}
                                className="p-2.5 bg-[#151D2B] hover:bg-[#151F30] rounded-xl border border-[#334155] hover:border-violet-500/50 transition-colors cursor-pointer group/task flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono font-bold text-violet-400">
                                      {taskCode}
                                    </span>
                                    <h4 className="text-xs font-bold text-[#F8FAFC] truncate group-hover/task:text-violet-300">
                                      {title}
                                    </h4>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-[#94A3B8]">
                                      Seen:{' '}
                                      {isAck ? (
                                        <span className="text-emerald-400 font-bold">Seen ✓</span>
                                      ) : assign.firstViewedAt ? (
                                        <span className="text-violet-400 font-medium">Seen</span>
                                      ) : (
                                        <span className="text-amber-400">Not Seen</span>
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                    status === 'completed' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : status === 'in_progress' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {status === 'completed'
                                    ? 'Done'
                                    : status === 'in_progress'
                                    ? 'In Progress'
                                    : 'Pending'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Dual Action Buttons: Assign Work & View Assigned Work */}
                    <div className="pt-2 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleOpenAssignModal(emp)}
                        className="py-2.5 px-3 bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-[#7C3AED]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Assign Work</span>
                      </button>

                      <button
                        onClick={() => handleOpenAssignedWorkModal(emp)}
                        className="py-2.5 px-3 bg-[#151D2B] hover:bg-[#151F30] text-[#CBD5E1] hover:text-[#F8FAFC] border border-[#334155] hover:border-violet-500/50 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span>View Assigned Work</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 5. ASSIGN WORK MODAL ================= */}
      <AssignWorkModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        selectedEmployee={assignModalEmployee}
        allTargetEmployees={targetEmployees}
        isAssignToAll={isAssignToAll}
      />

      {/* ================= 6. EMPLOYEE ASSIGNED WORK POPUP ================= */}
      <EmployeeAssignedWorkModal
        isOpen={!!assignedWorkModalEmployee}
        onClose={() => setAssignedWorkModalEmployee(null)}
        employee={assignedWorkModalEmployee}
      />

      {/* ================= 7. TASK DETAILS MODAL ================= */}
      <TaskDetailsModal
        isOpen={!!selectedTaskForDetails}
        task={selectedTaskForDetails}
        onClose={() => setSelectedTaskForDetails(null)}
      />
    </div>
  );
};
