import React, { useState, useRef, useMemo } from 'react';
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
  Filter,
  User,
  ExternalLink,
  Plus,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { Employee, EmployeeFile, EmployeeFileCategory } from '../../../types/hrms';
import { Avatar } from '../../common/Avatar';

interface EmployeeFilesSectionProps {
  employees: Employee[];
  employeeFiles: EmployeeFile[];
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
  employees,
  employeeFiles,
  onUploadFile,
  onDeleteFile,
  canManage,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    employees[0]?.id || ''
  );
  const [selectedCategory, setSelectedCategory] = useState<EmployeeFileCategory>('ID Proof');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Handle file drop / select
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!selectedEmployeeId) {
      setUploadError('Please select an employee before uploading documentation.');
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    try {
      const filesArray = Array.from(fileList);
      for (const file of filesArray) {
        const error = validateFile(file);
        if (error) {
          setUploadError(error);
          setIsUploading(false);
          return;
        }
      }

      for (const file of filesArray) {
        await onUploadFile({
          employeeId: selectedEmployeeId,
          file,
          category: selectedCategory,
        });
      }

      setUploadSuccess(`Successfully uploaded ${filesArray.length} document(s).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload files.');
    } finally {
      setIsUploading(false);
    }
  };

  // Filtered files list
  const filteredFiles = useMemo(() => {
    return employeeFiles.filter((f) => {
      // Category filter
      if (filterCategory !== 'all' && f.category !== filterCategory) return false;
      // Employee filter
      if (filterEmployee !== 'all') {
        if (f.employeeId !== filterEmployee && f.employeeCode !== filterEmployee) return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = f.fileName.toLowerCase().includes(q);
        const matchCode = f.employeeCode.toLowerCase().includes(q);
        const matchEmpName = f.employeeName.toLowerCase().includes(q);
        const matchCat = f.category.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchEmpName && !matchCat) return false;
      }
      return true;
    });
  }, [employeeFiles, filterCategory, filterEmployee, searchQuery]);

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
      // Fallback: create mock text download or alert
      const blob = new Blob([`Documentation for ${file.employeeName} (${file.employeeCode}) - ${file.fileName}`], {
        type: 'text/plain;charset=utf-8',
      });
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

  // Get File Extension Icon
  const getFileIcon = (fileName: string, type: string) => {
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

  return (
    <div className="mt-8 bg-[#1E293B] rounded-2xl border border-[#334155] p-6 shadow-card space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#334155] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/15 border border-[#2563EB]/30 text-[#60A5FA] flex items-center justify-center">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Upload Employee Files</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                {employeeFiles.length} Records
              </span>
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Securely upload and link employee documentation (ID Proof, Offer Letter, Resume, Contract) with their Employee ID.
            </p>
          </div>
        </div>
      </div>

      {/* UPLOAD FORM PANEL (If Authorized) */}
      {canManage && (
        <div className="bg-[#151D2B] rounded-xl border border-[#334155] p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Employee Selector */}
            <div>
              <label className="block text-xs font-semibold text-white uppercase mb-1">
                Select Associated Employee *
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#334155] bg-[#0F172A] text-white focus:outline-hidden focus:border-[#3B82F6]"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode}) — {emp.designation}
                  </option>
                ))}
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

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
              isDragging
                ? 'border-[#3B82F6] bg-blue-500/10'
                : 'border-[#334155] hover:border-[#60A5FA] bg-[#0F172A]/70 hover:bg-[#0F172A]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf, .jpg, .jpeg, .png, .doc, .docx"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />

            <div className="w-10 h-10 rounded-xl bg-[#1E293B] border border-[#334155] text-[#60A5FA] flex items-center justify-center shadow-xs">
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <UploadCloud className="w-5 h-5" />
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-white">
                {isUploading ? 'Uploading files...' : 'Click to select or drag & drop employee files here'}
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Supports PDF, JPG, PNG, DOC, and DOCX (Max 15MB each • Multiple uploads supported)
              </p>
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
        </div>
      )}

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files by name or Employee ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#334155] bg-[#151D2B] text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#3B82F6]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter */}
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

          {/* Employee Filter */}
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-[#334155] bg-[#151D2B] text-[#CBD5E1] focus:outline-hidden max-w-[180px]"
          >
            <option value="all">All Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName} ({e.employeeCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* FILES TABLE */}
      {filteredFiles.length === 0 ? (
        <div className="p-10 text-center border border-dashed border-[#334155] rounded-xl bg-[#151D2B]/40">
          <FolderOpen className="w-9 h-9 text-[#64748B] mx-auto mb-2" />
          <p className="text-xs font-bold text-white">No files found matching criteria</p>
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
              {filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-[#1E293B]/60 transition-colors">
                  {/* File Name & Icon */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.fileName, file.fileType)}
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

                  {/* Employee */}
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

                  {/* Size & Type */}
                  <td className="py-3 px-4 text-[#CBD5E1]">
                    <span className="font-medium text-xs block">{file.fileSize}</span>
                    <span className="text-[10px] text-[#64748B] uppercase font-mono">
                      {file.fileName.split('.').pop() || 'File'}
                    </span>
                  </td>

                  {/* Upload Date & By */}
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
                      <span>{file.uploadStatus}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* View */}
                      <button
                        type="button"
                        onClick={() => handleViewFile(file)}
                        className="p-1.5 rounded-lg border border-[#334155] hover:border-[#60A5FA] text-[#60A5FA] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        title="View File"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Download */}
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(file)}
                        className="p-1.5 rounded-lg border border-[#334155] hover:border-emerald-500 text-emerald-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        title="Download File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
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
  );
};
