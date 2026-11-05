import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  Check,
  RefreshCw,
  Loader2,
  FileText,
} from 'lucide-react';
import { Employee, EmploymentType, EmployeeStatus } from '../../types/hrms';
import { useHRMS } from '../../context/HRMSContext';

interface BulkAddEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface BulkEmployeeRow {
  rowId: string;
  name: string;
  employeeCode: string;
  email: string;
  phone: string;
  departmentId: string;
  departmentName: string;
  designation: string;
  employmentType: EmploymentType;
  joiningDate: string;
  shiftId: string;
  shiftName: string;
  workLocation: 'On-site' | 'Remote' | 'Hybrid';
  status: EmployeeStatus;
  errors: Record<string, string>;
  isValid: boolean;
}

const DEFAULT_DEPARTMENTS = [
  { id: 'dept-eng', name: 'Software Development' },
  { id: 'dept-qa', name: 'Quality Assurance' },
  { id: 'dept-mkt', name: 'Marketing' },
  { id: 'dept-ops', name: 'Operations' },
  { id: 'dept-hr', name: 'Human Resources' },
  { id: 'dept-fin', name: 'Finance & Accounts' },
];

const DEFAULT_SHIFTS = [
  { id: 'shift-morning', name: 'Morning Shift' },
  { id: 'shift-afternoon', name: 'Afternoon Shift' },
  { id: 'shift-evening', name: 'Evening Shift' },
];

export const BulkAddEmployeesModal: React.FC<BulkAddEmployeesModalProps> = ({ isOpen, onClose }) => {
  const { employees, departments: ctxDepartments, shiftTemplates: ctxShifts, addBulkEmployees } = useHRMS();

  const departments = ctxDepartments.length > 0 ? ctxDepartments : DEFAULT_DEPARTMENTS;
  const shifts = ctxShifts.length > 0 ? ctxShifts : DEFAULT_SHIFTS;

  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [rows, setRows] = useState<BulkEmployeeRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Generate initial row helper
  const createBlankRow = (index = 0): BulkEmployeeRow => {
    const today = new Date().toISOString().split('T')[0];
    return {
      rowId: `bulk-row-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
      name: '',
      employeeCode: '',
      email: '',
      phone: '',
      departmentId: departments[0]?.id || 'dept-eng',
      departmentName: departments[0]?.name || 'Software Development',
      designation: 'Software Developer',
      employmentType: 'full_time',
      joiningDate: today,
      shiftId: shifts[0]?.id || 'shift-morning',
      shiftName: shifts[0]?.name || 'Morning Shift',
      workLocation: 'On-site',
      status: 'active',
      errors: {},
      isValid: false,
    };
  };

  // Validate all rows against database and each other
  const validateRows = (inputRows: BulkEmployeeRow[]): BulkEmployeeRow[] => {
    const existingEmails = new Set(employees.map((e) => (e.email || '').toLowerCase().trim()));
    const existingCodes = new Set(employees.map((e) => (e.employeeCode || '').toUpperCase().trim()));

    const seenEmailsInBatch = new Set<string>();
    const seenCodesInBatch = new Set<string>();

    return inputRows.map((row) => {
      const err: Record<string, string> = {};
      const trimmedName = row.name.trim();
      const trimmedEmail = row.email.toLowerCase().trim();
      const trimmedCode = row.employeeCode.toUpperCase().trim();

      if (!trimmedName) {
        err.name = 'Employee Name is required';
      }

      if (!trimmedEmail) {
        err.email = 'Work Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        err.email = 'Invalid email address format';
      } else if (existingEmails.has(trimmedEmail)) {
        err.email = 'Email already exists in employee directory';
      } else if (seenEmailsInBatch.has(trimmedEmail)) {
        err.email = 'Duplicate email within this bulk batch';
      } else {
        seenEmailsInBatch.add(trimmedEmail);
      }

      if (trimmedCode) {
        if (existingCodes.has(trimmedCode)) {
          err.employeeCode = `Code ${trimmedCode} already taken`;
        } else if (seenCodesInBatch.has(trimmedCode)) {
          err.employeeCode = `Duplicate Code ${trimmedCode} in batch`;
        } else {
          seenCodesInBatch.add(trimmedCode);
        }
      }

      return {
        ...row,
        errors: err,
        isValid: Object.keys(err).length === 0,
      };
    });
  };

  // Update a field in a row
  const handleRowChange = (
    rowId: string,
    field: keyof Omit<BulkEmployeeRow, 'rowId' | 'errors' | 'isValid'>,
    value: any
  ) => {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.rowId === rowId) {
          const mod = { ...r, [field]: value };
          if (field === 'departmentId') {
            const d = departments.find((dept) => dept.id === value);
            if (d) mod.departmentName = d.name;
          }
          if (field === 'shiftId') {
            const s = shifts.find((sh) => sh.id === value);
            if (s) mod.shiftName = s.name;
          }
          return mod;
        }
        return r;
      });
      return validateRows(updated);
    });
  };

  // Add new row manually
  const handleAddRow = () => {
    setRows((prev) => validateRows([...prev, createBlankRow(prev.length)]));
  };

  // Delete row
  const handleDeleteRow = (rowId: string) => {
    setRows((prev) => validateRows(prev.filter((r) => r.rowId !== rowId)));
  };

  // Clear all
  const handleClearAll = () => {
    if (rows.length > 0 && !window.confirm('Are you sure you want to clear all rows?')) return;
    setRows([]);
    setImportedFileName(null);
    setGlobalError(null);
  };

  // Download sample CSV template
  const handleDownloadSampleCSV = () => {
    const csvHeader =
      'Employee Name,Employee ID,Email,Phone Number,Department,Designation,Employment Type,Date of Joining,Shift,Work Location,Employee Status\n';
    const sampleRows = [
      'Alex Morgan,EMP-1004,alex.morgan@company.com,9876543210,Software Development,Frontend Engineer,Full-time,2026-11-05,Morning Shift,On-site,Active',
      'Sara Connor,EMP-1005,sara.connor@company.com,9876543211,Human Resources,HR Specialist,Full-time,2026-11-05,Morning Shift,Hybrid,Active',
      'David Kim,EMP-1006,david.kim@company.com,9876543212,Quality Assurance,QA Engineer,Full-time,2026-11-05,Morning Shift,Remote,Active',
    ].join('\n');

    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'velmora_bulk_employees_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Excel / CSV File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    setGlobalError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!data || data.length === 0) {
          setGlobalError('The uploaded file contains no data rows.');
          return;
        }

        const parsedRows: BulkEmployeeRow[] = data.map((rowObj, index) => {
          // Normalize column names
          const getVal = (...keys: string[]) => {
            for (const k of keys) {
              const matchedKey = Object.keys(rowObj).find(
                (col) => col.trim().toLowerCase() === k.toLowerCase()
              );
              if (matchedKey && rowObj[matchedKey] !== undefined) {
                return String(rowObj[matchedKey]).trim();
              }
            }
            return '';
          };

          const name = getVal('Employee Name', 'Name', 'Full Name');
          const code = getVal('Employee ID', 'Employee Code', 'Code', 'ID');
          const email = getVal('Email', 'Work Email', 'Email Address');
          const phone = getVal('Phone Number', 'Phone', 'Mobile');
          const deptRaw = getVal('Department', 'Dept');
          const desigRaw = getVal('Designation', 'Job Title', 'Role', 'Position');
          const empTypeRaw = getVal('Employment Type', 'Type');
          const joiningDateRaw = getVal('Date of Joining', 'Joining Date', 'Joined');
          const shiftRaw = getVal('Shift', 'Shift Schedule');
          const locRaw = getVal('Work Location', 'Location');
          const statusRaw = getVal('Employee Status', 'Status');

          // Match department
          const matchedDept =
            departments.find((d) => d.name.toLowerCase() === deptRaw.toLowerCase()) ||
            departments[0];

          // Match shift
          const matchedShift =
            shifts.find((s) => s.name.toLowerCase() === shiftRaw.toLowerCase()) || shifts[0];

          // Match employment type
          let empType: EmploymentType = 'full_time';
          const lowerType = empTypeRaw.toLowerCase();
          if (lowerType.includes('part')) empType = 'part_time';
          else if (lowerType.includes('contract')) empType = 'contract';
          else if (lowerType.includes('intern')) empType = 'intern';

          // Match status
          let status: EmployeeStatus = 'active';
          const lowerStatus = statusRaw.toLowerCase();
          if (lowerStatus.includes('leave')) status = 'on_leave';
          else if (lowerStatus.includes('inact') || lowerStatus.includes('term')) status = 'inactive';

          // Match location
          let workLoc: 'On-site' | 'Remote' | 'Hybrid' = 'On-site';
          const lowerLoc = locRaw.toLowerCase();
          if (lowerLoc.includes('remote')) workLoc = 'Remote';
          else if (lowerLoc.includes('hybrid')) workLoc = 'Hybrid';

          return {
            rowId: `imported-${index}-${Date.now()}`,
            name: name,
            employeeCode: code ? (code.startsWith('EMP-') ? code : `EMP-${code}`) : '',
            email: email,
            phone: phone,
            departmentId: matchedDept.id,
            departmentName: matchedDept.name,
            designation: desigRaw || 'Software Developer',
            employmentType: empType,
            joiningDate: joiningDateRaw || new Date().toISOString().split('T')[0],
            shiftId: matchedShift.id,
            shiftName: matchedShift.name,
            workLocation: workLoc,
            status,
            errors: {},
            isValid: false,
          };
        });

        const validated = validateRows(parsedRows);
        setRows(validated);
        setActiveTab('manual'); // Switch to review table
      } catch (err: any) {
        setGlobalError(`Failed to parse file: ${err.message || 'Invalid spreadsheet file'}`);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit and save
  const handleSaveAll = async () => {
    const validated = validateRows(rows);
    setRows(validated);

    const validRows = validated.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setGlobalError('Please fix the validation errors before saving.');
      return;
    }

    try {
      setIsSubmitting(true);
      setGlobalError(null);

      const payload = validRows.map((r) => {
        const parts = r.name.trim().split(' ');
        const fName = parts[0] || '';
        const lName = parts.slice(1).join(' ') || '';

        return {
          firstName: fName,
          lastName: lName,
          fullName: r.name.trim(),
          employeeCode: r.employeeCode.trim() || undefined,
          email: r.email.trim(),
          phone: r.phone.trim(),
          departmentId: r.departmentId,
          departmentName: r.departmentName,
          designation: r.designation,
          employmentType: r.employmentType,
          joiningDate: r.joiningDate,
          shiftId: r.shiftId,
          shiftName: r.shiftName,
          workLocation: r.workLocation,
          status: r.status,
        };
      });

      await addBulkEmployees(payload);
      onClose();
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to save employees.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = useMemo(() => rows.filter((r) => r.isValid).length, [rows]);
  const errorCount = useMemo(() => rows.filter((r) => !r.isValid).length, [rows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div
        className="bg-[#1E293B] rounded-2xl shadow-2xl border border-[#334155] w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden text-white animate-scale-up"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= 1. HEADER ================= */}
        <div className="sticky top-0 z-20 bg-[#151D2B] border-b border-[#334155] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-[#60A5FA] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Bulk Add Employees</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Batch Onboarding
                </span>
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Add multiple company employees via manual entry or Excel/CSV spreadsheet upload.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= 2. TABS & ACTIONS BAR ================= */}
        <div className="bg-[#151D2B]/80 px-6 py-3 border-b border-[#334155] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-[#0F172A] p-1 rounded-xl border border-[#334155]">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import Excel / CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Review & Edit Rows ({rows.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadSampleCSV}
              className="px-3 py-1.5 rounded-xl border border-[#334155] hover:border-[#60A5FA] bg-[#1E293B] text-xs font-semibold text-[#CBD5E1] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Download standard CSV structure"
            >
              <Download className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Download Sample CSV</span>
            </button>

            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 rounded-xl bg-[#2563EB]/15 hover:bg-[#2563EB]/30 border border-[#2563EB]/40 text-[#60A5FA] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Row</span>
            </button>

            {rows.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {globalError && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {/* ================= 3. BODY ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#0D1117]/60">
          {activeTab === 'upload' ? (
            <div className="max-w-3xl mx-auto space-y-6 py-4">
              {/* Drag and Drop Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#334155] hover:border-[#3B82F6] rounded-2xl bg-[#1E293B]/70 hover:bg-[#1E293B] p-10 text-center transition-all cursor-pointer group flex flex-col items-center justify-center space-y-3"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#60A5FA] group-hover:scale-105 group-hover:border-[#3B82F6] flex items-center justify-center transition-all shadow-md">
                  <Upload className="w-7 h-7" />
                </div>

                <div>
                  <p className="text-sm font-bold text-white group-hover:text-[#60A5FA] transition-colors">
                    Click to browse or drag &amp; drop employee spreadsheet
                  </p>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Supports Excel (.xlsx, .xls) and CSV (.csv) files (Up to 10MB)
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F172A] border border-[#334155] text-[11px] text-[#94A3B8]">
                  <span>Columns matched automatically: Name, Email, Department, Designation, etc.</span>
                </div>
              </div>

              {importedFileName && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Parsed file: <strong>{importedFileName}</strong> ({rows.length} rows imported)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className="underline hover:text-white font-bold cursor-pointer"
                  >
                    View &amp; Edit Rows &rarr;
                  </button>
                </div>
              )}

              {/* Guide card */}
              <div className="p-4 bg-[#151D2B] border border-[#334155] rounded-xl text-xs text-[#94A3B8] space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#60A5FA]" />
                  <span>Spreadsheet Requirements &amp; Tips</span>
                </h4>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li><strong>Employee Name</strong> and <strong>Email</strong> are strictly required.</li>
                  <li><strong>Employee ID</strong> is optional. If left blank, Velmora automatically generates next sequential ID (e.g. EMP-1004).</li>
                  <li>Duplicate emails or IDs against the existing database are caught immediately and flagged in red.</li>
                  <li>Download our sample template above for optimal pre-configured column headers.</li>
                </ul>
              </div>
            </div>
          ) : (
            /* Manual / Review Table */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white">Batch Status:</span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                    {validCount} Valid
                  </span>
                  {errorCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold">
                      {errorCount} With Errors
                    </span>
                  )}
                  <span className="text-[#94A3B8]">Total: {rows.length} rows</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Row</span>
                  </button>
                </div>
              </div>

              {rows.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-[#334155] rounded-2xl bg-[#151D2B]/50">
                  <Users className="w-10 h-10 text-[#64748B] mx-auto mb-2" />
                  <p className="text-sm font-bold text-white">No employees in current batch</p>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Upload an Excel/CSV spreadsheet or click &quot;Add Row&quot; to begin.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="mt-4 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
                  >
                    + Add First Row
                  </button>
                </div>
              ) : (
                <div className="border border-[#334155] rounded-xl overflow-x-auto shadow-sm">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-[#111827] border-b border-[#334155] text-[#94A3B8] uppercase text-[10px] tracking-wider font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">Status</th>
                        <th className="py-2.5 px-3 min-w-[160px]">Employee Name *</th>
                        <th className="py-2.5 px-3 min-w-[110px]">Employee ID</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Email Address *</th>
                        <th className="py-2.5 px-3 min-w-[130px]">Phone</th>
                        <th className="py-2.5 px-3 min-w-[160px]">Department</th>
                        <th className="py-2.5 px-3 min-w-[150px]">Designation</th>
                        <th className="py-2.5 px-3 min-w-[120px]">Employment Type</th>
                        <th className="py-2.5 px-3 min-w-[120px]">Joining Date</th>
                        <th className="py-2.5 px-3 min-w-[130px]">Shift</th>
                        <th className="py-2.5 px-3 min-w-[110px]">Location</th>
                        <th className="py-2.5 px-3 min-w-[100px]">Status</th>
                        <th className="py-2.5 px-3 w-10 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]/60 bg-[#151D2B]">
                      {rows.map((row, idx) => {
                        return (
                          <tr
                            key={row.rowId}
                            className={`hover:bg-[#1E293B]/60 transition-colors ${
                              !row.isValid ? 'bg-rose-950/20' : ''
                            }`}
                          >
                            {/* STATUS BADGE */}
                            <td className="py-2 px-3 text-center">
                              {row.isValid ? (
                                <span title="All required fields valid" className="inline-flex">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                </span>
                              ) : (
                                <span
                                  title={Object.values(row.errors).join(', ')}
                                  className="inline-flex cursor-help"
                                >
                                  <AlertCircle className="w-4 h-4 text-rose-400" />
                                </span>
                              )}
                            </td>

                            {/* NAME */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => handleRowChange(row.rowId, 'name', e.target.value)}
                                placeholder="e.g. John Doe"
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs bg-[#0F172A] text-white focus:outline-hidden ${
                                  row.errors.name ? 'border-rose-500' : 'border-[#334155]'
                                }`}
                              />
                              {row.errors.name && (
                                <span className="text-[10px] text-rose-400 block mt-0.5">{row.errors.name}</span>
                              )}
                            </td>

                            {/* CODE */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.employeeCode}
                                onChange={(e) =>
                                  handleRowChange(row.rowId, 'employeeCode', e.target.value.toUpperCase())
                                }
                                placeholder="Auto (EMP-XXXX)"
                                className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs bg-[#0F172A] text-white focus:outline-hidden ${
                                  row.errors.employeeCode ? 'border-rose-500' : 'border-[#334155]'
                                }`}
                              />
                              {row.errors.employeeCode && (
                                <span className="text-[10px] text-rose-400 block mt-0.5">
                                  {row.errors.employeeCode}
                                </span>
                              )}
                            </td>

                            {/* EMAIL */}
                            <td className="py-2 px-3">
                              <input
                                type="email"
                                value={row.email}
                                onChange={(e) => handleRowChange(row.rowId, 'email', e.target.value)}
                                placeholder="name@company.com"
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs bg-[#0F172A] text-white focus:outline-hidden ${
                                  row.errors.email ? 'border-rose-500' : 'border-[#334155]'
                                }`}
                              />
                              {row.errors.email && (
                                <span className="text-[10px] text-rose-400 block mt-0.5">{row.errors.email}</span>
                              )}
                            </td>

                            {/* PHONE */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.phone}
                                onChange={(e) => handleRowChange(row.rowId, 'phone', e.target.value)}
                                placeholder="9876543210"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-[#334155] text-xs bg-[#0F172A] text-white focus:outline-hidden"
                              />
                            </td>

                            {/* DEPARTMENT */}
                            <td className="py-2 px-3">
                              <select
                                value={row.departmentId}
                                onChange={(e) => handleRowChange(row.rowId, 'departmentId', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-[#334155] text-xs bg-[#0F172A] text-white focus:outline-hidden"
                              >
                                {departments.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* DESIGNATION */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.designation}
                                onChange={(e) => handleRowChange(row.rowId, 'designation', e.target.value)}
                                placeholder="Designation"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-[#334155] text-xs bg-[#0F172A] text-white focus:outline-hidden"
                              />
                            </td>

                            {/* EMPLOYMENT TYPE */}
                            <td className="py-2 px-3">
                              <select
                                value={row.employmentType}
                                onChange={(e) => handleRowChange(row.rowId, 'employmentType', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-[#334155] text-xs bg-[#0F172A] text-white focus:outline-hidden"
                              >
                                <option value="full_time">Full Time</option>
                                <option value="part_time">Part Time</option>
                                <option value="contract">Contract</option>
                                <option value="intern">Intern</option>
                              </select>
                            </td>

                            {/* JOINING DATE */}
                            <td className="py-2 px-3">
                              <input
                                type="date"
                                value={row.joiningDate}
                                onChange={(e) => handleRowChange(row.rowId, 'joiningDate', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-[#334155] text-xs bg-[#0F172A] text-white focus:outline-hidden"
                              />
                            </td>

                            {/* SHIFT */}
                            <td className="py-2 px-3">
                              <select
                                value={row.shiftId}
                                onChange={(e) => handleRowChange(row.rowId, 'shiftId', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-[#334155] text-xs bg-[#0F172A] text-white focus:outline-hidden"
                              >
                                {shifts.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* LOCATION */}
                            <td className="py-2 px-3">
                              <select
                                value={row.workLocation}
                                onChange={(e) => handleRowChange(row.rowId, 'workLocation', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-[#334155] text-xs bg-[#0F172A] text-white focus:outline-hidden"
                              >
                                <option value="On-site">On-site</option>
                                <option value="Remote">Remote</option>
                                <option value="Hybrid">Hybrid</option>
                              </select>
                            </td>

                            {/* STATUS */}
                            <td className="py-2 px-3">
                              <select
                                value={row.status}
                                onChange={(e) => handleRowChange(row.rowId, 'status', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-[#334155] text-xs bg-[#0F172A] text-white focus:outline-hidden"
                              >
                                <option value="active">Active</option>
                                <option value="on_leave">On Leave</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </td>

                            {/* DELETE */}
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.rowId)}
                                className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Remove row"
                              >
                                <Trash2 className="w-4 h-4" />
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

        {/* ================= 4. FOOTER ================= */}
        <div className="sticky bottom-0 z-20 bg-[#151D2B] border-t border-[#334155] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#94A3B8]">
            <span>Total to import: </span>
            <strong className="text-white">{validCount}</strong>
            <span> of </span>
            <strong>{rows.length}</strong>
            <span> valid employees</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-[#334155] text-xs font-semibold text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSubmitting || validCount === 0 || errorCount > 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1D4ED8] hover:to-[#4338CA] text-white text-xs font-bold shadow-md shadow-blue-950/40 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save &amp; Import ({validCount} Employees)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
