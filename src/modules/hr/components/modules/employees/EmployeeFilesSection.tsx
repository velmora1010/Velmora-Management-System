import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileCode,
  Download,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  FolderOpen,
  Loader2,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Plus,
  X,
  XCircle,
} from 'lucide-react';
import { Employee, EmployeeFile, EmployeeFileCategory } from '../../../types/hrms';
import { Avatar } from '../../common/Avatar';

interface EmployeeFilesSectionProps {
  employees?: Employee[];
  employeeFiles?: EmployeeFile[];
  onUploadFile: (params: {
    employeeId: string;
    file: File;
    category: EmployeeFileCategory;
  }) => Promise<any>;
  onDeleteFile: (fileId: string) => Promise<any>;
  canManage: boolean;
}

interface SelectedUploadFile {
  id: string;
  file: File;
}

const CATEGORIES: EmployeeFileCategory[] = [
  'ID Proof',
  'Offer Letter',
  'Resume',
  'Contract',
  'Other',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
const MAX_FILE_SIZE_MB = 15;

export const EmployeeFilesSection: React.FC<EmployeeFilesSectionProps> = ({
  employees = [],
  employeeFiles = [],
  onUploadFile,
  onDeleteFile,
  canManage,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    employees[0]?.id || ''
  );
  const [selectedCategory, setSelectedCategory] = useState<EmployeeFileCategory>('ID Proof');

  // Currently focused employee for dedicated document details view (null = show employee table)
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all' | 'verified' | 'submitted' | 'pending'

  // Selected files queue before submission
  const [selectedFiles, setSelectedFiles] = useState<SelectedUploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadSectionRef = useRef<HTMLDivElement | null>(null);

  // Sync selectedEmployeeId if employees load asynchronously
  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  // Keep upload target in sync when viewing a specific employee's document details
  useEffect(() => {
    if (activeEmployeeId) {
      setSelectedEmployeeId(activeEmployeeId);
    }
  }, [activeEmployeeId]);

  // Helper to fetch documents for a given employee
  const getEmployeeDocs = (emp: Employee): EmployeeFile[] => {
    return employeeFiles.filter((f) => {
      const matchId = f.employeeId && (f.employeeId === emp.id || f.employeeId.toLowerCase() === emp.id.toLowerCase());
      const matchCode = emp.employeeCode && f.employeeCode && f.employeeCode.toLowerCase() === emp.employeeCode.toLowerCase();
      return Boolean(matchId || matchCode);
    });
  };

  // Helper to compute submission status: Verified, Submitted, or Pending
  const getSubmissionStatus = (docs: EmployeeFile[]): 'Pending' | 'Submitted' | 'Verified' => {
    if (docs.length === 0) return 'Pending';
    const allVerified = docs.every((d) => (d.uploadStatus || '').toLowerCase() === 'verified');
    return allVerified ? 'Verified' : 'Submitted';
  };

  // Currently active employee object
  const activeEmployee = useMemo(() => {
    if (!activeEmployeeId) return null;
    return employees.find((e) => e.id === activeEmployeeId) || null;
  }, [activeEmployeeId, employees]);

  // Documents of the active employee
  const activeEmployeeDocs = useMemo(() => {
    if (!activeEmployee) return [];
    return getEmployeeDocs(activeEmployee);
  }, [activeEmployee, employeeFiles]);

  // Selected employee object for upload
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  // Unique departments for filter
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.departmentName) set.add(e.departmentName);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered employees for the main column-based table
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const docs = getEmployeeDocs(emp);
      const status = getSubmissionStatus(docs).toLowerCase();

      // Status filter
      if (filterStatus !== 'all' && status !== filterStatus) return false;

      // Department filter
      if (filterDepartment !== 'all' && emp.departmentName !== filterDepartment) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchCode = (emp.employeeCode || '').toLowerCase().includes(q);
        const matchDept = (emp.departmentName || '').toLowerCase().includes(q);
        const matchDesig = (emp.designation || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDept && !matchDesig) return false;
      }

      return true;
    });
  }, [employees, employeeFiles, filterDepartment, filterStatus, searchQuery]);

  // Validate single file
  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Invalid file type "${file.name}". Only PDF, JPG, PNG, and DOC/DOCX are allowed.`;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File "${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB size limit.`;
    }
    return null;
  };

  // Handle files selected via file picker
  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!selectedEmployeeId) {
      setUploadError('Please select an employee before uploading documentation.');
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);

    const filesArray = Array.from(fileList);
    const newItems: SelectedUploadFile[] = [];

    for (const file of filesArray) {
      const err = validateFile(file);
      if (err) {
        setUploadError(err);
        return;
      }
      newItems.push({
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file,
      });
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
  };

  // Remove a single selected file before upload
  const handleRemoveFile = (indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  // Clear all selected files
  const handleClearSelectedFiles = () => {
    setSelectedFiles([]);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit all selected files
  const handleSubmitSelectedFiles = async () => {
    if (selectedFiles.length === 0) return;
    if (!selectedEmployeeId) {
      setUploadError('Please select an employee before uploading documentation.');
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    try {
      for (const item of selectedFiles) {
        await onUploadFile({
          employeeId: selectedEmployeeId,
          file: item.file,
          category: selectedCategory,
        });
      }

      const emp = employees.find((e) => e.id === selectedEmployeeId);
      const empName = emp ? emp.fullName : 'the employee';
      const count = selectedFiles.length;

      handleClearSelectedFiles();
      setUploadSuccess(
        `Successfully uploaded ${count} document${count > 1 ? 's' : ''} for ${empName}.`
      );
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload files.');
    } finally {
      setIsUploading(false);
    }
  };

  // View / preview file
  const handleViewFile = (file: EmployeeFile) => {
    if (file.publicUrl) {
      window.open(file.publicUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert(`Preview not available for ${file.fileName}. Please click Download to view.`);
    }
  };

  // Download file
  const handleDownloadFile = (file: EmployeeFile) => {
    if (file.publicUrl) {
      const a = document.createElement('a');
      a.href = file.publicUrl;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const blob = new Blob(
        [`Documentation for ${file.employeeName} (${file.employeeCode}) - ${file.fileName}`],
        { type: 'text/plain;charset=utf-8' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // File Icon helper
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return (
        <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
        <FileCode className="w-4 h-4" />
      </div>
    );
  };

  // Category Badge Colors
  const getCategoryBadge = (category: EmployeeFileCategory) => {
    switch (category) {
      case 'ID Proof':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'Offer Letter':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'Resume':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'Contract':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  // Quick upload trigger for focused employee
  const handleQuickUploadFor = (empId: string) => {
    setSelectedEmployeeId(empId);
    fileInputRef.current?.click();
  };

  return (
    <div className="mt-8 bg-[#1E293B] rounded-2xl border border-[#334155] p-6 shadow-card space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#334155] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/15 border border-[#2563EB]/30 text-[#60A5FA] flex items-center justify-center">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Employee Documents &amp; Submissions</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                {employeeFiles.length} Total Files
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                {employees.length} Employees
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Structured column repository tracking employee verification, document counts, and compliance status.
            </p>
          </div>
        </div>
      </div>

      {/* UPLOAD PANEL: Button-based Controls (No large drag & drop box) */}
      {canManage && (
        <div
          ref={uploadSectionRef}
          className="bg-[#151D2B] rounded-xl border border-[#334155] p-4 sm:p-5 space-y-4"
        >
          {/* Top Info Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#334155]/60 pb-3">
            <div>
              <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#60A5FA]" />
                <span>Document Submission Portal</span>
              </span>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Select an employee and category, then click Upload Document to submit official records.
              </p>
            </div>
            <span className="text-[11px] text-[#94A3B8] shrink-0 font-medium">
              Supported: PDF, JPG, PNG, DOC, DOCX (Max 15MB)
            </span>
          </div>

          {/* Controls: Select Employee + Document Category + Upload Document Button */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
            {/* Employee Selector (5 cols) */}
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-white uppercase mb-1.5">
                Select Employee *
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  setUploadError(null);
                  setUploadSuccess(null);
                }}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#334155] bg-[#0F172A] text-white focus:outline-hidden focus:border-[#3B82F6] transition-colors"
              >
                {employees.map((emp) => {
                  const count = getEmployeeDocs(emp).length;
                  return (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode}) — {count} {count === 1 ? 'doc' : 'docs'}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Document Category (4 cols) */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-white uppercase mb-1.5">
                Document Category *
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as EmployeeFileCategory)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#334155] bg-[#0F172A] text-white focus:outline-hidden focus:border-[#3B82F6] transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Document Button (3 cols) */}
            <div className="sm:col-span-3">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".pdf, .jpg, .jpeg, .png, .doc, .docx"
                onChange={(e) => {
                  handleFileSelect(e.target.files);
                  if (e.target) e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-[40px] px-4 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                title="Choose files to upload"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Document</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Selected Files Preview & Confirmation Area */}
          {selectedFiles.length > 0 && (
            <div className="p-3.5 bg-[#0F172A] border border-[#334155] rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-[#334155]/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">Selected Files</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                    {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}
                  </span>
                  <span className="text-[11px] text-[#94A3B8] hidden sm:inline">
                    → Will be linked to <strong className="text-white">{selectedEmployee?.fullName}</strong> under <strong className="text-white">{selectedCategory}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearSelectedFiles}
                  disabled={isUploading}
                  className="text-[11px] text-[#94A3B8] hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>

              {/* Selected Files Badges / Chips with Remove Button */}
              <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
                {selectedFiles.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#151D2B] border border-[#334155] text-xs text-white"
                  >
                    {getFileIcon(item.file.name)}
                    <div className="min-w-0">
                      <span className="font-medium truncate max-w-[200px] block" title={item.file.name}>
                        {item.file.name}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {(item.file.size / (1024 * 1024)).toFixed(2)} MB · {selectedCategory}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      disabled={isUploading}
                      className="p-1 rounded hover:bg-rose-500/15 text-[#94A3B8] hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action Buttons: Cancel or Confirm Upload */}
              <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-[#334155]/60">
                <button
                  type="button"
                  onClick={handleClearSelectedFiles}
                  disabled={isUploading}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#CBD5E1] hover:text-white bg-[#151D2B] hover:bg-[#1E293B] border border-[#334155] rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitSelectedFiles}
                  disabled={isUploading || selectedFiles.length === 0}
                  className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Submit ({selectedFiles.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Feedback alerts */}
          {uploadError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
          )}
        </div>
      )}

      {/* VIEW 1: DEDICATED EMPLOYEE DOCUMENT DETAILS VIEW */}
      {activeEmployeeId && activeEmployee ? (
        <div className="space-y-5">
          {/* Back Button and Employee Profile Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#151D2B] border border-[#334155]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveEmployeeId(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#CBD5E1] hover:text-white bg-[#0F172A] hover:bg-[#1E293B] border border-[#334155] rounded-xl transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Employee List</span>
              </button>

              <div className="h-6 w-px bg-[#334155] hidden sm:block"></div>

              <div className="flex items-center gap-3">
                <Avatar name={activeEmployee.fullName} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{activeEmployee.fullName}</h4>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                      {activeEmployee.employeeCode}
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    {activeEmployee.designation} · {activeEmployee.departmentName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {activeEmployeeDocs.length} Documents Submitted
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleQuickUploadFor(activeEmployee.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload For {activeEmployee.firstName || 'Employee'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Documents Table for Active Employee */}
          {activeEmployeeDocs.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-[#334155] rounded-xl bg-[#151D2B]/40 space-y-3">
              <FolderOpen className="w-10 h-10 text-[#64748B] mx-auto" />
              <div>
                <p className="text-sm font-bold text-white">
                  No documents submitted yet for {activeEmployee.fullName}
                </p>
                <p className="text-xs text-[#94A3B8] mt-1 max-w-md mx-auto">
                  Click the Upload Document button above to upload this employee's ID Proof, Offer Letter, Resume, or Contract.
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-[#334155] rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#111827] border-b border-[#334155] text-[#94A3B8] uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Document Name</th>
                    <th className="py-3 px-4">Document Category</th>
                    <th className="py-3 px-4">File Type</th>
                    <th className="py-3 px-4">File Size</th>
                    <th className="py-3 px-4">Upload Date</th>
                    <th className="py-3 px-4">Verification Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/60 bg-[#151D2B]">
                  {activeEmployeeDocs.map((file) => {
                    const ext = (file.fileName.split('.').pop() || 'FILE').toUpperCase();
                    const statusLower = (file.uploadStatus || 'Verified').toLowerCase();

                    return (
                      <tr key={file.id} className="hover:bg-[#1E293B]/60 transition-colors">
                        {/* Document Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {getFileIcon(file.fileName)}
                            <div className="min-w-0 max-w-xs">
                              <p className="font-semibold text-white truncate text-xs" title={file.fileName}>
                                {file.fileName}
                              </p>
                              <span className="text-[10px] text-[#64748B] block truncate font-mono">
                                {file.storagePath || 'Stored Securely'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Document Category */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${getCategoryBadge(
                              file.category
                            )}`}
                          >
                            {file.category}
                          </span>
                        </td>

                        {/* File Type */}
                        <td className="py-3 px-4 text-[#CBD5E1]">
                          <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#0F172A] border border-[#334155] text-[#94A3B8]">
                            {ext}
                          </span>
                        </td>

                        {/* File Size */}
                        <td className="py-3 px-4 text-[#CBD5E1]">
                          <span className="font-medium text-xs">{file.fileSize}</span>
                        </td>

                        {/* Upload Date */}
                        <td className="py-3 px-4 text-[#94A3B8]">
                          <div className="flex items-center gap-1.5 text-xs text-white font-medium">
                            <Clock className="w-3 h-3 text-[#64748B]" />
                            <span>{file.uploadedAt || 'Recent'}</span>
                          </div>
                          <span className="text-[10px] text-[#64748B] block">
                            By {file.uploadedBy || 'HR Admin'}
                          </span>
                        </td>

                        {/* Verification Status */}
                        <td className="py-3 px-4">
                          {statusLower === 'verified' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verified</span>
                            </span>
                          ) : statusLower === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                              <Clock className="w-3 h-3" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewFile(file)}
                              className="p-1.5 rounded-lg border border-[#334155] hover:border-[#60A5FA] text-[#60A5FA] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                              title="View File"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(file)}
                              className="p-1.5 rounded-lg border border-[#334155] hover:border-emerald-500 text-emerald-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                              title="Download File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Are you sure you want to delete ${file.fileName} for ${activeEmployee.fullName}?`
                                    )
                                  ) {
                                    onDeleteFile(file.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-[#334155] hover:border-rose-500 text-rose-400 hover:text-white hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Delete File"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: COLUMN-BASED EMPLOYEE DOCUMENT SUBMISSION TABLE */
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by employee name, ID, or designation..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#334155] bg-[#151D2B] text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#3B82F6]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Department Filter */}
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-[#334155] bg-[#151D2B] text-[#CBD5E1] focus:outline-hidden"
              >
                <option value="all">All Departments</option>
                {departmentsList.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-[#334155] bg-[#151D2B] text-[#CBD5E1] focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="submitted">Submitted</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {/* Column-Based Employee Table */}
          {filteredEmployees.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-[#334155] rounded-xl bg-[#151D2B]/40">
              <FolderOpen className="w-9 h-9 text-[#64748B] mx-auto mb-2" />
              <p className="text-xs font-bold text-white">No employees match filter criteria</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Adjust search query or filter options above.
              </p>
            </div>
          ) : (
            <div className="border border-[#334155] rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#111827] border-b border-[#334155] text-[#94A3B8] uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4 text-center">Documents Submitted</th>
                    <th className="py-3 px-4">Document Categories</th>
                    <th className="py-3 px-4">Submission Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/60 bg-[#151D2B]">
                  {filteredEmployees.map((emp) => {
                    const docs = getEmployeeDocs(emp);
                    const docsCount = docs.length;
                    const status = getSubmissionStatus(docs);
                    const categories = Array.from(new Set(docs.map((d) => d.category)));

                    return (
                      <tr key={emp.id} className="hover:bg-[#1E293B]/60 transition-colors">
                        {/* Employee Name (Clickable) */}
                        <td className="py-3 px-4">
                          <div
                            onClick={() => setActiveEmployeeId(emp.id)}
                            className="flex items-center gap-2.5 cursor-pointer group"
                            title={`Click to view documents for ${emp.fullName}`}
                          >
                            <Avatar name={emp.fullName} size="sm" />
                            <div>
                              <span className="font-bold text-white text-xs group-hover:text-[#60A5FA] group-hover:underline transition-colors block">
                                {emp.fullName}
                              </span>
                              <span className="text-[10px] text-[#94A3B8]">
                                {emp.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Employee ID */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-semibold text-[#60A5FA] bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                            {emp.employeeCode}
                          </span>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-4 text-[#CBD5E1]">
                          <span className="text-xs font-medium">{emp.departmentName || 'General'}</span>
                        </td>

                        {/* Designation */}
                        <td className="py-3 px-4 text-[#CBD5E1]">
                          <span className="text-xs">{emp.designation}</span>
                        </td>

                        {/* Documents Submitted */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center font-bold text-xs px-2.5 py-0.5 rounded-full ${
                              docsCount > 0
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'bg-slate-700/30 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {docsCount}
                          </span>
                        </td>

                        {/* Document Categories */}
                        <td className="py-3 px-4">
                          {categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {categories.map((cat) => (
                                <span
                                  key={cat}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryBadge(
                                    cat
                                  )}`}
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#64748B] italic">No categories</span>
                          )}
                        </td>

                        {/* Submission Status */}
                        <td className="py-3 px-4">
                          {status === 'Verified' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verified</span>
                            </span>
                          ) : status === 'Submitted' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/25">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Submitted</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                              <Clock className="w-3 h-3" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveEmployeeId(emp.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-colors shadow-xs cursor-pointer"
                          >
                            <span>View Documents</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
