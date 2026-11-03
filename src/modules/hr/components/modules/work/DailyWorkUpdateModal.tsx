import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Clock,
  Calendar,
  FileText,
  Upload,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  User,
} from 'lucide-react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { useWorkAssignment } from '../../../context/WorkAssignmentContext';
import { WorkTask } from '../../../types/workAssignment';

interface DailyWorkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTask?: WorkTask | null;
}

export const DailyWorkUpdateModal: React.FC<DailyWorkUpdateModalProps> = ({
  isOpen,
  onClose,
  initialTask,
}) => {
  const { employees, selectedDate } = useHRMS();
  const { currentUser, canManageEmployees } = useAuth();
  const { tasks, taskAssignments, submitDailyWorkUpdate } = useWorkAssignment();

  const todayStr = selectedDate || new Date().toISOString().split('T')[0];

  // Selected Employee (default to logged in employee or first employee)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [workDate, setWorkDate] = useState(todayStr);
  const [workCompletedToday, setWorkCompletedToday] = useState('');
  const [hoursSpent, setHoursSpent] = useState('4');
  const [progressPercentage, setProgressPercentage] = useState(50);
  const [blockers, setBlockers] = useState('');
  const [supportingFileName, setSupportingFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize selected employee on modal open
  useEffect(() => {
    if (isOpen) {
      if (currentUser?.employeeId) {
        setSelectedEmployeeId(currentUser.employeeId);
      } else if (employees.length > 0) {
        setSelectedEmployeeId(employees[0].id);
      }

      if (initialTask) {
        setSelectedTaskId(initialTask.id);
        setProgressPercentage(initialTask.overallProgress || 50);
      } else {
        setSelectedTaskId('');
      }

      setWorkDate(todayStr);
      setWorkCompletedToday('');
      setHoursSpent('4');
      setBlockers('');
      setSupportingFileName('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, currentUser, employees, initialTask, todayStr]);

  // Tasks assigned to selected employee
  const eligibleTasks = useMemo(() => {
    if (!selectedEmployeeId) return tasks;
    const myAssignTaskIds = taskAssignments
      .filter((a) => a.employeeId === selectedEmployeeId && a.status !== 'completed' && a.status !== 'cancelled')
      .map((a) => a.taskId);

    const filtered = tasks.filter((t) => myAssignTaskIds.includes(t.id));
    return filtered.length > 0 ? filtered : tasks;
  }, [selectedEmployeeId, taskAssignments, tasks]);

  // Auto-select first task if none selected
  useEffect(() => {
    if (eligibleTasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(eligibleTasks[0].id);
      setProgressPercentage(eligibleTasks[0].overallProgress || 50);
    }
  }, [eligibleTasks, selectedTaskId]);

  if (!isOpen) return null;

  const handleTaskChange = (taskId: string) => {
    setSelectedTaskId(taskId);
    const chosen = tasks.find((t) => t.id === taskId);
    if (chosen) {
      setProgressPercentage(chosen.overallProgress || 50);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSupportingFileName(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedTaskId) {
      setErrorMessage('Please select a task.');
      return;
    }
    if (!workCompletedToday.trim()) {
      setErrorMessage('Please describe the work completed today.');
      return;
    }
    const hrs = Number(hoursSpent);
    if (isNaN(hrs) || hrs <= 0) {
      setErrorMessage('Please enter valid hours spent (greater than 0).');
      return;
    }

    try {
      setIsSubmitting(true);
      await submitDailyWorkUpdate({
        taskId: selectedTaskId,
        employeeId: selectedEmployeeId,
        workDate,
        workDescription: workCompletedToday,
        hoursSpent: hrs,
        progressPercentage,
        blockers,
        supportingFileName,
      });

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit daily update.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/55 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Centered Modal Card */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-6 transform transition-all text-left z-10 animate-fade-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#206DA6]/10 text-[#206DA6] flex items-center justify-center font-bold">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#172B4D] tracking-tight">
                Daily Work Update
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Submit daily progress reports for your assigned tasks.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Employee Name (Auto-filled / Selectable by Admin) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Employee Name</label>
            {canManageEmployees ? (
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]/30"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode}) — {emp.departmentName}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {employees.find((e) => e.id === selectedEmployeeId)?.fullName || currentUser?.name}
                </span>
              </div>
            )}
          </div>

          {/* 2. Task Title Dropdown */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedTaskId}
              onChange={(e) => handleTaskChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]/30 font-medium"
              required
            >
              <option value="">-- Choose Assigned Task --</option>
              {eligibleTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.taskCode}: {t.title} (Due: {t.dueDate})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Work Date & Hours Spent */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Work Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Hours Spent <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={hoursSpent}
                onChange={(e) => setHoursSpent(e.target.value)}
                placeholder="e.g. 4.5"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                required
              />
            </div>
          </div>

          {/* 4. Progress Percentage */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">Task Progress Percentage</label>
              <span className="font-mono font-bold text-sm text-[#206DA6]">
                {progressPercentage}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progressPercentage}
              onChange={(e) => setProgressPercentage(Number(e.target.value))}
              className="w-full accent-[#206DA6] cursor-pointer"
            />
            <div className="flex items-center gap-1.5 mt-1">
              {[0, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setProgressPercentage(pct)}
                  className={`flex-1 py-1 rounded-lg text-center font-bold text-[11px] border transition-colors cursor-pointer ${
                    progressPercentage === pct
                      ? 'bg-[#206DA6] text-white border-[#206DA6]'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* 5. Work Completed Today */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Work Completed Today <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={workCompletedToday}
              onChange={(e) => setWorkCompletedToday(e.target.value)}
              rows={3}
              placeholder="Describe what modules, features, or tickets you worked on today..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]/30"
              required
            />
          </div>

          {/* 6. Issues / Blockers (Optional) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Issues / Blockers <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Any dependencies, API delays, or credentials needed..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]/30"
            />
          </div>

          {/* 7. Supporting File (Optional) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Supporting File <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer transition-colors shadow-2xs">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload Proof / Artifact</span>
                <input type="file" onChange={handleFileUpload} className="hidden" />
              </label>
              {supportingFileName ? (
                <span className="text-xs text-[#206DA6] font-medium truncate">
                  {supportingFileName}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">Screenshots, logs, or reports</span>
              )}
            </div>
          </div>

          {/* Important Note */}
          <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200 text-[11px] text-blue-900 leading-tight">
            <strong>Note:</strong> Self-reported task hours are tracked for operational progress and project velocity, separate from official attendance punches.
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#206DA6] hover:bg-[#1a5784] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Update'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
