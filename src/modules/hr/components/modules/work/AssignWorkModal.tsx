import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2,
  Users,
  Building2,
  Briefcase,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Employee } from '../../../types/hrms';
import { BatchTaskItem } from '../../../types/workAssignment';
import { useWorkAssignment } from '../../../context/WorkAssignmentContext';
import { useAuth } from '../../../context/AuthContext';
import { Avatar } from '../../common/Avatar';

interface AssignWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEmployee: Employee | null;
  allTargetEmployees?: Employee[];
  isAssignToAll?: boolean;
}

interface FormTaskRow {
  rowId: string;
  title: string;
  brief: string;
  description: string;
  file?: {
    originalFilename: string;
    fileSize: string;
    fileType: string;
    dataUrl?: string;
    secureStoragePath?: string;
  };
  errors?: {
    title?: string;
    brief?: string;
  };
}

const createInitialRow = (): FormTaskRow => ({
  rowId: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
  title: '',
  brief: '',
  description: '',
});

/**
 * Resizes an image file to a lightweight data URL thumbnail (< 40KB)
 * to prevent browser localStorage quota overflow while preserving preview fidelity.
 */
const createSafeThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } else {
          resolve(e.target?.result as string || '');
        }
      };
      img.onerror = () => resolve('');
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

export const AssignWorkModal: React.FC<AssignWorkModalProps> = ({
  isOpen,
  onClose,
  selectedEmployee,
  allTargetEmployees = [],
  isAssignToAll = false,
}) => {
  const { assignBatchTasks } = useWorkAssignment();
  const { currentUser } = useAuth();

  const [taskRows, setTaskRows] = useState<FormTaskRow[]>([createInitialRow()]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTaskRows([createInitialRow()]);
      setShowConfirmation(false);
      setGeneralError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, selectedEmployee, isAssignToAll]);

  if (!isOpen) return null;

  // Determine recipients
  const recipients: Employee[] = isAssignToAll
    ? allTargetEmployees
    : selectedEmployee
    ? [selectedEmployee]
    : [];

  const recipientNames = recipients.map((r) => r.fullName).join(', ');

  // Add another task row
  const handleAddAnotherTask = () => {
    // Validate current rows before adding
    let hasError = false;
    const updated = taskRows.map((row) => {
      const errors: { title?: string; brief?: string } = {};
      if (!row.title.trim()) {
        errors.title = 'Task title is required';
        hasError = true;
      }
      if (!row.brief.trim()) {
        errors.brief = 'Task brief is required';
        hasError = true;
      }
      return { ...row, errors };
    });

    if (hasError) {
      setTaskRows(updated);
      setGeneralError('Please fill in the required Task Title and Task Brief before adding another task.');
      return;
    }

    setGeneralError(null);
    setTaskRows((prev) => [...prev, createInitialRow()]);
  };

  // Remove task row
  const handleRemoveTask = (rowId: string) => {
    if (taskRows.length <= 1) return;
    setTaskRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  // Update specific field in row
  const handleUpdateRow = (rowId: string, field: 'title' | 'brief' | 'description', value: string) => {
    setTaskRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          const errors = { ...r.errors };
          if (field === 'title' && value.trim()) delete errors.title;
          if (field === 'brief' && value.trim()) delete errors.brief;
          return { ...r, [field]: value, errors };
        }
        return r;
      })
    );
  };

  // Handle file upload
  const handleFileUpload = async (rowId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds the 10 MB limit. Please select a smaller file.');
      return;
    }

    const formattedSize =
      file.size < 1024 * 1024
        ? `${Math.round(file.size / 1024)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    let dataUrl = '';
    if (file.type.startsWith('image/')) {
      dataUrl = await createSafeThumbnail(file);
    }

    setTaskRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          return {
            ...r,
            file: {
              originalFilename: file.name,
              fileSize: formattedSize,
              fileType: file.type || 'application/octet-stream',
              dataUrl,
              secureStoragePath: dataUrl,
            },
          };
        }
        return r;
      })
    );
  };

  // Remove file from row
  const handleRemoveFile = (rowId: string) => {
    setTaskRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          return { ...r, file: undefined };
        }
        return r;
      })
    );
  };

  // Validate and open confirmation dialog
  const handleSaveAndConfirm = () => {
    let hasError = false;
    const validated = taskRows.map((row) => {
      const errors: { title?: string; brief?: string } = {};
      if (!row.title.trim()) {
        errors.title = 'Task title is required';
        hasError = true;
      } else if (row.title.length > 150) {
        errors.title = 'Title must be 150 characters or less';
        hasError = true;
      }

      if (!row.brief.trim()) {
        errors.brief = 'Task brief is required';
        hasError = true;
      }
      return { ...row, errors };
    });

    setTaskRows(validated);

    if (hasError) {
      setGeneralError('Please fill in all required fields (Task Title and Task Brief) for every task.');
      return;
    }

    if (recipients.length === 0) {
      setGeneralError('No recipient employees selected.');
      return;
    }

    setGeneralError(null);
    setShowConfirmation(true);
  };

  // Perform actual database submission
  const handleConfirmAssignment = async () => {
    try {
      setIsSubmitting(true);
      const batchItems: BatchTaskItem[] = taskRows.map((r) => ({
        rowId: r.rowId,
        title: r.title.trim(),
        brief: r.brief.trim(),
        description: r.description.trim(),
        referenceFile: r.file
          ? {
              originalFilename: r.file.originalFilename,
              fileSize: r.file.fileSize,
              fileType: r.file.fileType,
              secureStoragePath: r.file.dataUrl || '',
              dataUrl: r.file.dataUrl || '',
            }
          : undefined,
      }));

      await assignBatchTasks({
        employeeIds: recipients.map((r) => r.id),
        tasks: batchItems,
        assignedBy: currentUser?.name || 'Administrator',
        assignedById: currentUser?.id || 'user-admin',
      });

      setShowConfirmation(false);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign tasks. Please try again.';
      setGeneralError(msg);
      setShowConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close with unsaved changes confirmation
  const handleCancel = () => {
    const hasData = taskRows.some((r) => r.title.trim() || r.brief.trim() || r.description.trim() || r.file);
    if (hasData) {
      if (!window.confirm('You have unsaved task entries. Are you sure you want to cancel?')) {
        return;
      }
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      {/* Modal Dialog Container */}
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-[#172B4D] animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-work-modal-title"
      >
        {/* ================= 1. STICKY MODAL HEADER ================= */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#206DA6]" />
              <h2 id="assign-work-modal-title" className="text-xl font-bold text-[#172B4D] tracking-tight">
                Assign Work
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAssignToAll
                ? `Assign tasks simultaneously to all ${recipients.length} company employees.`
                : 'Create and assign tasks to the selected employee.'}
            </p>
          </div>

          <button
            onClick={handleCancel}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Close popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= 2. EMPLOYEE INFORMATION BANNER ================= */}
        <div className="bg-[#F8FAFC] border-b border-slate-200 px-6 py-3.5">
          {isAssignToAll ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#206DA6]/10 text-[#206DA6] flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#172B4D]">Assigning to All Employees</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#206DA6] text-white">
                      {recipients.length} Employees
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tasks will be individually created and tracked for each team member.
                  </p>
                </div>
              </div>

              {/* Avatar stack of recipients */}
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {recipients.map((emp) => (
                    <Avatar
                      key={emp.id}
                      src={emp.avatar}
                      name={emp.fullName}
                      size="sm"
                      className="ring-2 ring-white shadow-xs"
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold text-slate-700">
                  {recipients.map((r) => r.fullName).join(', ')}
                </span>
              </div>
            </div>
          ) : selectedEmployee ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <Avatar
                  src={selectedEmployee.avatar}
                  name={selectedEmployee.fullName}
                  size="md"
                  className="ring-2 ring-white shadow-sm rounded-xl"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#172B4D]">{selectedEmployee.fullName}</h3>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-200 text-slate-700">
                      {selectedEmployee.employeeCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {selectedEmployee.departmentName || 'General Department'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-medium text-slate-600">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      {selectedEmployee.designation || 'Staff'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-400 font-medium block">Assignment Mode</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#206DA6] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  Individual Work Order
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* ================= 3. SCROLLABLE TASK ROWS BODY ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {generalError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-700 font-medium animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Table Header Guide for Desktop */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 bg-slate-100 rounded-xl text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <div className="col-span-3 flex items-center gap-1.5">
              <span>1. Reference Image / File</span>
              <span className="text-[10px] text-slate-400 font-normal lowercase">(optional)</span>
            </div>
            <div className="col-span-3 flex items-center gap-1">
              <span>2. Task Title</span>
              <span className="text-rose-500">*</span>
            </div>
            <div className="col-span-3 flex items-center gap-1">
              <span>3. Task Brief</span>
              <span className="text-rose-500">*</span>
            </div>
            <div className="col-span-3 flex items-center gap-1.5">
              <span>4. Task Description</span>
              <span className="text-[10px] text-slate-400 font-normal lowercase">(optional)</span>
            </div>
          </div>

          {/* Task Rows List */}
          <div className="space-y-4">
            {taskRows.map((row, index) => {
              const fileInputRef = React.createRef<HTMLInputElement>();
              const taskNumber = index + 1;

              return (
                <div
                  key={row.rowId}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-[#206DA6]/40 transition-all overflow-hidden"
                >
                  {/* Row Header */}
                  <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#206DA6] text-white text-[11px] font-bold flex items-center justify-center">
                        {taskNumber}
                      </span>
                      <span className="text-xs font-bold text-[#172B4D]">Task {taskNumber}</span>
                      {row.title.trim() && (
                        <span className="text-xs text-slate-500 truncate max-w-[300px]">
                          — {row.title.trim()}
                        </span>
                      )}
                    </div>

                    {taskRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(row.rowId)}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium"
                        title="Remove this task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Task</span>
                      </button>
                    )}
                  </div>

                  {/* 4-Column Form Fields */}
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* COLUMN 1: Reference Image / File */}
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 lg:hidden">
                        Reference Image / File <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>

                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf"
                        onChange={(e) => handleFileUpload(row.rowId, e)}
                        className="hidden"
                      />

                      {row.file ? (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl relative group">
                          {row.file.fileType.startsWith('image/') && row.file.dataUrl ? (
                            <div className="flex items-center gap-2.5">
                              <img
                                src={row.file.dataUrl}
                                alt="Reference"
                                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-[#172B4D] truncate">
                                  {row.file.originalFilename}
                                </p>
                                <span className="text-[10px] text-slate-500 block">
                                  {row.file.fileSize} • Image
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-[#172B4D] truncate">
                                  {row.file.originalFilename}
                                </p>
                                <span className="text-[10px] text-slate-500 block">
                                  {row.file.fileSize} • Document
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-[#206DA6] hover:underline font-semibold flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(row.rowId)}
                              className="text-rose-600 hover:underline font-semibold flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-24 border-2 border-dashed border-slate-300 hover:border-[#206DA6] rounded-xl flex flex-col items-center justify-center p-2 text-center group transition-colors bg-slate-50/50 hover:bg-blue-50/20"
                        >
                          <div className="w-7 h-7 rounded-lg bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-[#206DA6] mb-1">
                            <Upload className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-semibold text-[#206DA6]">Choose File</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WEBP, PDF (Max 10MB)</span>
                        </button>
                      )}
                    </div>

                    {/* COLUMN 2: Task Title */}
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 lg:hidden">
                        Task Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={150}
                        value={row.title}
                        onChange={(e) => handleUpdateRow(row.rowId, 'title', e.target.value)}
                        placeholder="Enter task title"
                        className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-hidden focus:ring-2 transition-all ${
                          row.errors?.title
                            ? 'border-rose-400 focus:ring-rose-200 bg-rose-50/20'
                            : 'border-slate-300 focus:border-[#206DA6] focus:ring-blue-100'
                        }`}
                      />
                      {row.errors?.title && (
                        <p className="text-[11px] text-rose-600 mt-1 font-medium">{row.errors.title}</p>
                      )}
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Ex: Create Website Banner, Update Product Catalog
                      </span>
                    </div>

                    {/* COLUMN 3: Task Brief */}
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 lg:hidden">
                        Task Brief <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={row.brief}
                        onChange={(e) => handleUpdateRow(row.rowId, 'brief', e.target.value)}
                        placeholder="Briefly explain what work needs to be done"
                        className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-hidden focus:ring-2 resize-none transition-all ${
                          row.errors?.brief
                            ? 'border-rose-400 focus:ring-rose-200 bg-rose-50/20'
                            : 'border-slate-300 focus:border-[#206DA6] focus:ring-blue-100'
                        }`}
                      />
                      {row.errors?.brief && (
                        <p className="text-[11px] text-rose-600 mt-1 font-medium">{row.errors.brief}</p>
                      )}
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        High-level summary of the assignment
                      </span>
                    </div>

                    {/* COLUMN 4: Task Description */}
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 lg:hidden">
                        Task Description <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={row.description}
                        onChange={(e) => handleUpdateRow(row.rowId, 'description', e.target.value)}
                        placeholder="Enter detailed task instructions and requirements"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#206DA6] focus:ring-2 focus:ring-blue-100 bg-white focus:outline-hidden resize-none transition-all"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Technical details, deadlines, steps, deliverables
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Add Another Task Row Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleAddAnotherTask}
              className="w-full py-3 border-2 border-dashed border-[#206DA6]/40 hover:border-[#206DA6] rounded-xl text-xs font-bold text-[#206DA6] hover:bg-blue-50/40 flex items-center justify-center gap-2 transition-all shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Task</span>
            </button>
          </div>
        </div>

        {/* ================= 4. STICKY MODAL FOOTER ================= */}
        <div className="sticky bottom-0 z-20 bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">
            Total Tasks: <span className="font-bold text-[#172B4D]">{taskRows.length}</span> • Recipient:
            <span className="font-bold text-[#206DA6] ml-1">{recipientNames}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleAddAnotherTask}
              className="px-4 py-2.5 rounded-xl border border-[#206DA6] text-xs font-bold text-[#206DA6] hover:bg-blue-50 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Task</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndConfirm}
              className="px-6 py-2.5 rounded-xl bg-[#206DA6] hover:bg-[#1a5682] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <span>Save & Confirm</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= 5. CONFIRMATION POPUP ================= */}
      {showConfirmation && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#206DA6] mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#172B4D]">Confirm Work Assignment</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {isAssignToAll
                  ? `You are assigning ${taskRows.length} ${taskRows.length === 1 ? 'task' : 'tasks'} to all ${recipients.length} employees (${recipientNames}). Do you want to continue?`
                  : `You are assigning ${taskRows.length} ${taskRows.length === 1 ? 'task' : 'tasks'} to ${recipientNames}. Do you want to continue?`}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-left text-xs space-y-1 text-slate-600 border border-slate-200">
              <div className="flex justify-between font-semibold text-[#172B4D]">
                <span>Task Count:</span>
                <span>{taskRows.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Assigned By:</span>
                <span>{currentUser?.name || 'Administrator'}</span>
              </div>
              <div className="flex justify-between">
                <span>In-App Notification:</span>
                <span className="text-emerald-600 font-semibold">Automatic Delivery</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmation(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                No, Go Back
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAssignment}
                className="flex-1 py-2.5 rounded-xl bg-[#206DA6] hover:bg-[#1a5682] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <span>Yes, Assign Tasks</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
