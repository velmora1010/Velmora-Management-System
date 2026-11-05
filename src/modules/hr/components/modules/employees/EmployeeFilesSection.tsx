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
  UserCheck,
  FileCheck2,
  LayoutGrid,
  Table as TableIcon,
  ShieldCheck,
  Plus,
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

  // Active view: 'employees' (cards) vs 'all-documents' (global table)
  const [activeTab, setActiveTab] = useState<'employees' | 'all-documents'>('employees');

  // Currently focused employee for dedicated document details view (null = show all employee cards)
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all' | 'submitted' | 'pending'
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  // Unique departments for filter
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.departmentName) set.add(e.departmentName);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered employees for the employee-wise submission cards
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const docs = getEmployeeDocs(emp);
      const hasDocs = docs.length > 0;

      // Status filter
      if (filterStatus === 'submitted' && !hasDocs) return false;
      if (filterStatus === 'pending' && hasDocs) return false;

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

  // Filtered documents for the all-documents master table
  const filteredAllDocuments = useMemo(() => {
    return employeeFiles.filter((f) => {
      if (filterCategory !== 'all' && f.category !== filterCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchFile = f.fileName.toLowerCase().includes(q);
        const matchCode = (f.employeeCode || '').toLowerCase().includes(q);
        const matchName = (f.employeeName || '').toLowerCase().includes(q);
        const matchCat = (f.category || '').toLowerCase().includes(q);
        if (!matchFile && !matchCode && !matchName && !matchCat) return false;
      }
      return true;
    });
  }, [employeeFiles, filterCategory, searchQuery]);

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

  // Direct upload handler (instantly uploads dropped or browsed files)
  const handleDirectUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!selectedEmployeeId) {
      setUploadError('Please select an employee before uploading documentation.');
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);

    const filesArray = Array.from(fileList);
    for (const file of filesArray) {
      const err = validateFile(file);
      if (err) {
        setUploadError(err);
        return;
      }
    }

    setIsUploading(true);
    try {
      for (const file of filesArray) {
        await onUploadFile({
          employeeId: selectedEmployeeId,
          file,
          category: selectedCategory,
        });
      }

      const emp = employees.find((e) => e.id === selectedEmployeeId);
      const empName = emp ? emp.fullName : 'the employee';
      setUploadSuccess(
        `Successfully uploaded ${filesArray.length} document${filesArray.length > 1 ? 's' : ''} for ${empName}.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
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

  // Scroll to upload card when clicking quick upload
  const handleQuickUploadFor = (empId: string) => {
    setSelectedEmployeeId(empId);
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="mt-8 bg-[#1E293B] rounded-2xl border border-[#334155] p-6 shadow-card space-y-6">
      {/* SECTION HEADER & VIEW SWITCHER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#334155] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/15 border border-[#2563EB]/30 text-[#60A5FA] flex items-center justify-center">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Employee Documents</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                {employeeFiles.length} Total Files
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                {employees.length} Staff Members
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Secure document repository linked by Employee ID (ID Proof, Offer Letter, Resume, Contract).
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        {!activeEmployeeId && (
          <div className="flex items-center bg-[#0F172A] p-1 rounded-xl border border-[#334155]">
            <button
              type="button"
              onClick={() => setActiveTab('employees')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'employees'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Employee Submissions</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all-documents')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'all-documents'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>All Documents</span>
            </button>
          </div>
        )}
      </div>

      {/* UPLOAD PANEL (Left-aligned Passport-Size Upload Card, Right-Side Queue Removed) */}
      {canManage && (
        <div
          ref={uploadSectionRef}
          className="bg-[#151D2B] rounded-xl border border-[#334155] p-4 sm:p-5"
        >
          <div className="flex flex-col md:flex-row items-start justify-between gap-6">
            {/* Form Fields & Instructions */}
            <div className="space-y-4 flex-1 w-full max-w-xl">
              <div>
                <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#60A5FA]" />
                  <span>Document Submission Portal</span>
                </span>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Select an employee and document category, then drop files into the card to submit documents.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Employee Selector */}
                <div>
                  <label className="block text-xs font-semibold text-white uppercase mb-1">
                    Select Employee *
                  </label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      setSelectedEmployeeId(e.target.value);
                      setUploadError(null);
                      setUploadSuccess(null);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#334155] bg-[#0F172A] text-white focus:outline-hidden focus:border-[#3B82F6]"
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

                {/* Document Category */}
                <div>
                  <label className="block text-xs font-semibold text-white uppercase mb-1">
                    Document Category *
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as EmployeeFileCategory)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#334155] bg-[#0F172A] text-white focus:outline-hidden focus:border-[#3B82F6]"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Feedback */}
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

              <div className="text-[11px] text-[#94A3B8] flex items-center gap-2 pt-1">
                <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0"></span>
                <span>
                  Supported formats: <strong>PDF, JPG, PNG, DOC, DOCX</strong> up to 15MB. Files are verified immediately upon upload.
                </span>
              </div>
            </div>

            {/* Left-Aligned Passport-Size Upload Card */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleDirectUpload(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`w-[180px] h-[220px] shrink-0 border-2 border-dashed rounded-2xl p-3 flex flex-col items-center justify-between text-center cursor-pointer transition-all duration-200 select-none ${
                isDragging
                  ? 'border-[#3B82F6] bg-blue-500/10 shadow-lg shadow-blue-500/10 scale-[1.02]'
                  : 'border-[#334155] hover:border-[#60A5FA] bg-[#0F172A]/80 hover:bg-[#0F172A]'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".pdf, .jpg, .jpeg, .png, .doc, .docx"
                onChange={(e) => {
                  handleDirectUpload(e.target.files);
                  if (e.target) e.target.value = '';
                }}
                className="hidden"
              />

              {/* Centered Light Upload Icon */}
              <div className="w-11 h-11 mt-1 rounded-xl bg-[#1E293B] border border-[#334155] text-[#60A5FA] flex items-center justify-center shadow-xs">
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#60A5FA]" />
                ) : (
                  <UploadCloud className="w-5 h-5 text-[#60A5FA]" />
                )}
              </div>

              {/* Centered Text Info */}
              <div className="space-y-1 px-1">
                <h4 className="text-xs font-bold text-white tracking-wide">
                  Upload Document
                </h4>
                <p className="text-[11px] text-[#94A3B8] leading-tight">
                  Click or drag file here
                </p>
                <p className="text-[10px] text-[#64748B] pt-0.5 font-medium">
                  PDF, JPG, PNG, DOC, DOCX
                </p>
              </div>

              {/* Browse Files Button */}
              <button
                type="button"
                disabled={isUploading}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="mb-1 px-3.5 py-1 text-[11px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {isUploading ? 'Uploading...' : 'Browse Files'}
              </button>
            </div>
          </div>
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
                  Use the Upload Document card above to upload this employee's ID Proof, Offer Letter, Resume, or Contract.
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-[#334155] rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#111827] border-b border-[#334155] text-[#94A3B8] uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Document Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">File Size &amp; Type</th>
                    <th className="py-3 px-4">Upload Info</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/60 bg-[#151D2B]">
                  {activeEmployeeDocs.map((file) => (
                    <tr key={file.id} className="hover:bg-[#1E293B]/60 transition-colors">
                      {/* Document Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
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

                      {/* Category Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${getCategoryBadge(
                            file.category
                          )}`}
                        >
                          {file.category}
                        </span>
                      </td>

                      {/* File Size & Type */}
                      <td className="py-3 px-4 text-[#CBD5E1]">
                        <span className="font-medium text-xs block">{file.fileSize}</span>
                        <span className="text-[10px] text-[#64748B] uppercase font-mono">
                          {file.fileName.split('.').pop() || 'File'}
                        </span>
                      </td>

                      {/* Upload Info */}
                      <td className="py-3 px-4 text-[#94A3B8]">
                        <div className="flex items-center gap-1.5 text-xs text-white font-medium">
                          <Clock className="w-3 h-3 text-[#64748B]" />
                          <span>{file.uploadedAt || 'Recent'}</span>
                        </div>
                        <span className="text-[10px] text-[#64748B] block">
                          By {file.uploadedBy || 'HR Admin'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{file.uploadStatus || 'Verified'}</span>
                        </span>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'employees' ? (
        /* VIEW 2: EMPLOYEE-WISE DOCUMENT SUBMISSION GRID */
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
                <option value="submitted">Submitted (Has Files)</option>
                <option value="pending">Pending Submission (0 Files)</option>
              </select>
            </div>
          </div>

          {/* Responsive Grid of Employee Cards */}
          {filteredEmployees.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-[#334155] rounded-xl bg-[#151D2B]/40">
              <FolderOpen className="w-9 h-9 text-[#64748B] mx-auto mb-2" />
              <p className="text-xs font-bold text-white">No employees match filter criteria</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Adjust search query or filter options above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map((emp) => {
                const docs = getEmployeeDocs(emp);
                const hasDocs = docs.length > 0;

                return (
                  <div
                    key={emp.id}
                    onClick={() => setActiveEmployeeId(emp.id)}
                    className="bg-[#151D2B] border border-[#334155] hover:border-[#3B82F6] rounded-2xl p-4.5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:bg-[#1A2436] flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Row: Avatar + Employee Identity */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.fullName} size="md" />
                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-[#60A5FA] transition-colors">
                              {emp.fullName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[10px] font-semibold text-[#60A5FA] bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                {emp.employeeCode}
                              </span>
                              <span className="text-[11px] text-[#94A3B8] truncate max-w-[140px]">
                                {emp.departmentName}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Submission Status Badge */}
                        {hasDocs ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Submitted</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 shrink-0 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        )}
                      </div>

                      {/* Designation */}
                      <p className="text-xs text-[#CBD5E1] mt-3 font-medium">
                        {emp.designation}
                      </p>

                      {/* Document Count Metric */}
                      <div className="mt-3 pt-3 border-t border-[#334155]/60 flex items-center justify-between text-xs">
                        <span className="text-[#94A3B8]">Documents Submitted</span>
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <FileCheck2 className={`w-3.5 h-3.5 ${hasDocs ? 'text-[#60A5FA]' : 'text-[#64748B]'}`} />
                          <span className={hasDocs ? 'text-white' : 'text-[#64748B]'}>{docs.length}</span>
                        </span>
                      </div>

                      {/* Category preview chips if documents exist */}
                      {hasDocs && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {Array.from(new Set(docs.map((d) => d.category))).map((cat) => (
                            <span
                              key={cat}
                              className="text-[10px] px-2 py-0.5 rounded bg-[#0F172A] border border-[#334155] text-[#94A3B8]"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* View Documents Button */}
                    <div className="mt-4 pt-3 border-t border-[#334155]/60">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveEmployeeId(emp.id);
                        }}
                        className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <span>View Documents</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 3: ALL DOCUMENTS MASTER TABLE VIEW */
        <div className="space-y-4">
          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents by name, employee, or category..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#334155] bg-[#151D2B] text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#3B82F6]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-[#334155] bg-[#151D2B] text-[#CBD5E1] focus:outline-hidden"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredAllDocuments.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-[#334155] rounded-xl bg-[#151D2B]/40">
              <FolderOpen className="w-9 h-9 text-[#64748B] mx-auto mb-2" />
              <p className="text-xs font-bold text-white">No documents found matching criteria</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Upload new files using the panel above or adjust search filters.
              </p>
            </div>
          ) : (
            <div className="border border-[#334155] rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#111827] border-b border-[#334155] text-[#94A3B8] uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Document</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Associated Employee</th>
                    <th className="py-3 px-4">File Size &amp; Type</th>
                    <th className="py-3 px-4">Upload Info</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/60 bg-[#151D2B]">
                  {filteredAllDocuments.map((file) => (
                    <tr key={file.id} className="hover:bg-[#1E293B]/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {getFileIcon(file.fileName)}
                          <div className="min-w-0 max-w-[240px]">
                            <p className="font-semibold text-white truncate text-xs" title={file.fileName}>
                              {file.fileName}
                            </p>
                            <span className="text-[10px] text-[#64748B] block truncate font-mono">
                              {file.storagePath || 'Stored Securely'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${getCategoryBadge(
                            file.category
                          )}`}
                        >
                          {file.category}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={file.employeeName} size="xs" />
                          <div>
                            <span className="font-bold text-white block text-xs">{file.employeeName}</span>
                            <span className="font-mono text-[10px] text-[#60A5FA]">
                              {file.employeeCode}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-[#CBD5E1]">
                        <span className="font-medium text-xs block">{file.fileSize}</span>
                        <span className="text-[10px] text-[#64748B] uppercase font-mono">
                          {file.fileName.split('.').pop() || 'File'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#94A3B8]">
                        <div className="flex items-center gap-1.5 text-xs text-white font-medium">
                          <Clock className="w-3 h-3 text-[#64748B]" />
                          <span>{file.uploadedAt || 'Recent'}</span>
                        </div>
                        <span className="text-[10px] text-[#64748B] block">
                          By {file.uploadedBy || 'HR Admin'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{file.uploadStatus || 'Verified'}</span>
                        </span>
                      </td>

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
                                    `Are you sure you want to delete ${file.fileName} for ${file.employeeName}?`
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
