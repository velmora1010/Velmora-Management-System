import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  PlayCircle,
  FileText,
  Download,
  Edit2,
  Save,
  Building2,
  Briefcase,
  Layers,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useWorkAssignment } from '../../../context/WorkAssignmentContext';
import { WorkTask, TaskStatus } from '../../../types/workAssignment';
import { Avatar } from '../../common/Avatar';

interface TaskDetailsModalProps {
  task: WorkTask | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({ task, isOpen, onClose }) => {
  const { currentUser, canManageEmployees } = useAuth();
  const { taskAssignments, updateTask, updateAssignmentStatus } = useWorkAssignment();

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBrief, setEditBrief] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>('pending');

  useEffect(() => {
    if (task) {
      setEditTitle(task.taskTitle || task.title || '');
      setEditBrief(task.taskBrief || task.brief || '');
      setEditDescription(task.taskDescription || task.description || '');
      setSelectedStatus(task.status);
      setIsEditing(false);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  // Assignments for this task
  const assignments = taskAssignments.filter((a) => a.taskId === task.id);
  const primaryAssignment = assignments[0];

  const handleSaveChanges = () => {
    if (!task) return;
    updateTask(task.id, {
      title: editTitle.trim() || task.title,
      taskTitle: editTitle.trim() || task.title,
      brief: editBrief.trim(),
      taskBrief: editBrief.trim(),
      description: editDescription.trim(),
      taskDescription: editDescription.trim(),
    });

    setIsEditing(false);
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return {
          label: 'Completed',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2,
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: PlayCircle,
        };
      default:
        return {
          label: 'Pending',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: Clock,
        };
    }
  };

  const currentBadge = getStatusBadge(selectedStatus);
  const StatusIcon = currentBadge.icon;

  const refFile = task.referenceFilePath || primaryAssignment?.referenceFilePath;
  const refFileName = task.referenceFileName || primaryAssignment?.referenceFileName || 'Reference File';

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-[#172B4D] animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#206DA6]" />
            <div>
              <span className="text-xs font-mono font-bold text-[#206DA6] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                {task.taskCode}
              </span>
              <h2 className="text-base font-bold text-[#172B4D] mt-1">
                {isEditing ? 'Edit Task Details' : task.taskTitle || task.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Assigned Personnel Header */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              {assignments.length > 0 ? (
                <>
                  <Avatar
                    src={primaryAssignment.employeeAvatar}
                    name={primaryAssignment.employeeName}
                    size="md"
                    className="ring-2 ring-white shadow-xs"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#172B4D]">
                        {assignments.map((a) => a.employeeName).join(', ')}
                      </span>
                      {assignments.length === 1 && (
                        <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                          {primaryAssignment.employeeCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>{primaryAssignment.departmentName}</span>
                      {primaryAssignment.designation && (
                        <>
                          <span>•</span>
                          <span>{primaryAssignment.designation}</span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Unassigned or multiple assignees</span>
                </div>
              )}
            </div>

            {/* Current Read-Only Status Badge */}
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Task Status
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${currentBadge.bg}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                <span>{currentBadge.label}</span>
              </span>
            </div>
          </div>

          {/* Form Fields: Edit vs Read-Only View */}
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#206DA6] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Task Brief *</label>
                <textarea
                  rows={2}
                  value={editBrief}
                  onChange={(e) => setEditBrief(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#206DA6] focus:outline-hidden resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Task Description</label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#206DA6] focus:outline-hidden resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Task Brief */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Task Brief
                </span>
                <p className="text-xs text-[#172B4D] font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  {task.taskBrief || task.brief || 'No task brief provided.'}
                </p>
              </div>

              {/* Task Description */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Task Description & Instructions
                </span>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 whitespace-pre-wrap min-h-[70px]">
                  {task.taskDescription || task.description || 'No detailed instructions provided.'}
                </p>
              </div>

              {/* Reference Image / File */}
              {refFile && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Attached Reference File
                  </span>
                  <div className="p-3 bg-blue-50/40 border border-blue-200/80 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {refFile.startsWith('data:image') || refFile.includes('.jpg') || refFile.includes('.png') ? (
                        <img
                          src={refFile}
                          alt="Reference preview"
                          className="w-12 h-12 object-cover rounded-lg border border-blue-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-[#172B4D] block truncate max-w-xs">
                          {refFileName}
                        </span>
                        <span className="text-[10px] text-slate-500">Click to view reference file</span>
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

              {/* Assignment Meta */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-100">
                <div className="text-slate-500">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Assigned By
                  </span>
                  <span className="font-semibold text-slate-700 mt-0.5 block">
                    {task.assignedBy || 'Administrator'}
                  </span>
                </div>

                <div className="text-slate-500">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Assigned Date
                  </span>
                  <span className="font-semibold text-slate-700 mt-0.5 block">
                    {task.assignedDate || 'Today'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {canManageEmployees && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-xl border border-[#206DA6] text-xs font-bold text-[#206DA6] hover:bg-blue-50 transition-colors flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Task</span>
              </button>
            )}

            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  Cancel Edit
                </button>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  className="px-4 py-2 rounded-xl bg-[#206DA6] hover:bg-[#1a5682] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
