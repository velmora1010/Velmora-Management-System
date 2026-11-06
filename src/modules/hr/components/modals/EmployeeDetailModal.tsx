import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { Employee } from '../../types/hrms';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import { useToast } from '../../context/ToastContext';
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Clock,
  Building,
  DollarSign,
  AlertCircle,
  Edit2,
  CreditCard,
  UserCheck,
  CheckCircle2,
  CalendarOff,
  Layers,
  Trash2,
  Package,
  Check,
  Sparkles,
  Utensils,
  Shirt,
  Car,
  Home,
  Droplets,
  Lock,
  ChevronDown,
  FileText,
  UploadCloud,
  Download,
  Eye,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { EmployeeFile, EmployeeFileCategory } from '../../types/hrms';
import {
  resolveEmployeeShift,
  formatScheduledTimeRange,
  formatTime12Hour,
  getAttendanceStatusLabel,
} from '../../utils/attendanceCalculator';
import {
  findLinkedEmployee,
  doesLeaveBelongToEmployee,
  isSameEmployeeRecord,
} from '../../utils/employeeIdentity';
import {
  WelfareProduct,
  WelfareSelection,
  getMonthName,
  getKolkataCurrentYearMonth,
  formatKolkataDateTime,
} from '../../types/welfare';
import {
  WELFARE_SYNC_EVENT,
  initializeWelfareProducts,
  loadWelfareSelections,
  doesSelectionMatchEmployee,
  getStatusBadgeConfig,
  submitMonthlyWelfareSelection,
  confirmMonthlyWelfareReceived,
} from '../../utils/welfareStorage';

function renderCompactProductIcon(productName: string, className = 'w-5 h-5 text-[#206DA6]') {
  const lower = productName.toLowerCase();
  if (lower.includes('detergent')) return <Sparkles className={className} />;
  if (lower.includes('dish')) return <Utensils className={className} />;
  if (lower.includes('fabric')) return <Shirt className={className} />;
  if (lower.includes('bike') || lower.includes('car')) return <Car className={className} />;
  if (lower.includes('floor') || lower.includes('glass') || lower.includes('kitchen'))
    return <Home className={className} />;
  if (lower.includes('hand')) return <Droplets className={className} />;
  if (lower.includes('towel')) return <Layers className={className} />;
  return <Package className={className} />;
}

export type EmployeeProfileTab =
  | 'profile'
  | 'attendance'
  | 'leaves'
  | 'product_select'
  | 'payroll'
  | 'documents';

interface EmployeeDetailModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onAssignShift: (employee: Employee) => void;
  initialTab?: EmployeeProfileTab;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  employee,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onAssignShift,
  initialTab,
}) => {
  const { currentUser, canViewPayroll, canManageEmployees } = useAuth();
  const {
    employees,
    attendanceRecords,
    leaveRequests,
    settings,
    shiftTemplates,
    selectedDate,
    addNotification,
    employeeFiles,
    uploadEmployeeFile,
  } = useHRMS();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<EmployeeProfileTab>('profile');

  // Resolve authenticated employee profile
  const authenticatedEmployee = useMemo(
    () => findLinkedEmployee(currentUser, employees),
    [currentUser, employees]
  );

  const isOwnEmployeeProfile = useMemo(
    () => isSameEmployeeRecord(employee, authenticatedEmployee),
    [employee, authenticatedEmployee]
  );

  // Document state and counting logic
  const [docCategory, setDocCategory] = useState<EmployeeFileCategory>('ID Proof');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docFeedback, setDocFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const employeeFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Strictly filter to personal employee submissions owned by this employee (HR-uploaded company records excluded)
  const employeeSubmittedDocs = useMemo(() => {
    if (!employee) return [];
    return employeeFiles.filter((f) => {
      const matchId = f.employeeId && (f.employeeId === employee.id || f.employeeId.toLowerCase() === employee.id.toLowerCase());
      const matchCode = employee.employeeCode && f.employeeCode && f.employeeCode.toLowerCase() === employee.employeeCode.toLowerCase();
      const isOwner = Boolean(matchId || matchCode);
      const isEmployeeSubmission = f.submissionSource === 'employee' || f.uploaderRole === 'employee';
      return isOwner && isEmployeeSubmission;
    });
  }, [employee, employeeFiles]);

  const handleEmployeeDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;

    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setDocFeedback({ type: 'error', message: `Invalid file format "${file.name}". Only PDF, JPG, PNG, and DOC/DOCX are permitted.` });
      if (e.target) e.target.value = '';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setDocFeedback({ type: 'error', message: `File "${file.name}" exceeds 15MB limit.` });
      if (e.target) e.target.value = '';
      return;
    }

    setIsUploadingDoc(true);
    setDocFeedback(null);

    try {
      const isEmployeeSession = !canManageEmployees || isOwnEmployeeProfile;
      await uploadEmployeeFile({
        employeeId: employee.id,
        file,
        category: docCategory,
        uploaderRole: isEmployeeSession ? 'employee' : 'hr_admin',
        submissionSource: isEmployeeSession ? 'employee' : 'hr',
        uploadedBy: isEmployeeSession ? (currentUser?.name || employee.fullName) : 'HR Administrator',
        verificationStatus: isEmployeeSession ? 'pending_review' : 'verified',
      });

      setDocFeedback({
        type: 'success',
        message: isEmployeeSession
          ? `Document "${file.name}" submitted successfully for HR review!`
          : `Document "${file.name}" uploaded successfully!`,
      });
    } catch (err: any) {
      setDocFeedback({ type: 'error', message: err.message || 'Failed to upload document.' });
    } finally {
      setIsUploadingDoc(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleViewDoc = (file: EmployeeFile) => {
    if (file.publicUrl) {
      window.open(file.publicUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert(`Preview not available for ${file.fileName}. Click download to view.`);
    }
  };

  const handleDownloadDoc = (file: EmployeeFile) => {
    const url = file.publicUrl || `/${file.storagePath}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    if (isOpen && initialTab) {
      if (initialTab === 'product_select' && !isOwnEmployeeProfile) {
        setActiveTab('profile');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab, isOwnEmployeeProfile]);

  // Welfare state synced with shared welfareStorage
  const currentWelfarePeriod = useMemo(() => getKolkataCurrentYearMonth(), []);
  const [welfareProducts, setWelfareProducts] = useState<WelfareProduct[]>(() =>
    initializeWelfareProducts()
  );
  const [welfareSelections, setWelfareSelections] = useState<WelfareSelection[]>(() =>
    loadWelfareSelections()
  );
  const [tempSelectedProductId, setTempSelectedProductId] = useState<string>('');
  const [isConfirmWelfareOpen, setIsConfirmWelfareOpen] = useState<boolean>(false);
  const [isSavingWelfare, setIsSavingWelfare] = useState<boolean>(false);

  useEffect(() => {
    const syncFromStorage = () => {
      setWelfareProducts(initializeWelfareProducts());
      setWelfareSelections(loadWelfareSelections());
    };
    if (isOpen) {
      syncFromStorage();
    }
    window.addEventListener(WELFARE_SYNC_EVENT, syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener(WELFARE_SYNC_EVENT, syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, [isOpen]);

  // Reset tab if Product Select is not applicable to the viewed profile
  useEffect(() => {
    if (!isOwnEmployeeProfile && activeTab === 'product_select') {
      setActiveTab('profile');
    }
  }, [isOwnEmployeeProfile, activeTab]);

  const currentMonthSelection = useMemo(() => {
    if (!authenticatedEmployee) return null;
    return (
      welfareSelections.find(
        (s) =>
          doesSelectionMatchEmployee(s, authenticatedEmployee) &&
          s.welfare_year === currentWelfarePeriod.year &&
          s.welfare_month === currentWelfarePeriod.month &&
          s.selection_status !== 'cancelled'
      ) || null
    );
  }, [authenticatedEmployee, welfareSelections, currentWelfarePeriod]);

  const myProductHistory = useMemo(() => {
    if (!authenticatedEmployee) return [];
    return welfareSelections
      .filter(
        (s) =>
          doesSelectionMatchEmployee(s, authenticatedEmployee) &&
          s.selection_status !== 'cancelled'
      )
      .sort((a, b) => {
        if (b.welfare_year !== a.welfare_year) return b.welfare_year - a.welfare_year;
        if (b.welfare_month !== a.welfare_month) return b.welfare_month - a.welfare_month;
        return b.selected_at.localeCompare(a.selected_at);
      });
  }, [authenticatedEmployee, welfareSelections]);

  useEffect(() => {
    if (currentMonthSelection) {
      setTempSelectedProductId(currentMonthSelection.product_id);
    } else {
      setTempSelectedProductId('');
    }
  }, [currentMonthSelection, isOpen, currentUser.id]);

  if (!employee) return null;

  // Strict Access Control: Employees can strictly ONLY view their own profile
  if (!canManageEmployees && !isOwnEmployeeProfile) {
    return null;
  }

  const canViewPrivatePersonalInfo = canManageEmployees || isOwnEmployeeProfile;
  const canViewSalary = canViewPayroll || isOwnEmployeeProfile;

  // Assigned Shift
  const assignedShift = resolveEmployeeShift(employee, shiftTemplates);

  // Filter records for this employee
  const allEmployeeAttendance = attendanceRecords.filter(
    (a) =>
      a.employeeId === employee.id ||
      (a.employeeCode && a.employeeCode.toUpperCase() === employee.employeeCode.toUpperCase())
  );
  const employeeAttendance = allEmployeeAttendance.slice(0, 15);
  const employeeLeaves = leaveRequests.filter((l) => doesLeaveBelongToEmployee(l, employee));

  // Attendance Metrics
  const presentDays = allEmployeeAttendance.filter(
    (a) =>
      a.status === 'present' ||
      a.status === 'checked_in' ||
      a.status === 'wfh' ||
      a.status === 'permission' ||
      a.status === 'half_day' ||
      a.status === 'late'
  ).length;
  const lateDays = allEmployeeAttendance.filter(
    (a) => a.status === 'late' || a.punctualityStatus === 'late'
  ).length;
  const absentDays = allEmployeeAttendance.filter((a) => a.status === 'absent').length;
  const leaveDays = employeeLeaves
    .filter((l) => l.status === 'approved')
    .reduce((acc, l) => acc + l.daysCount, 0);
  const totalWorkHours = allEmployeeAttendance.reduce((acc, a) => acc + (a.workHours || 0), 0);
  const todayRecord = allEmployeeAttendance.find((a) => a.date === selectedDate);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Employee Profile"
      subtitle={`Code: ${employee.employeeCode}`}
      maxWidth="3xl"
    >
      {/* 1. Flat, Clean Dark Employee Header */}
      <div className="flex items-center justify-between gap-4 p-4 bg-[#151D2B] rounded-xl border border-[#334155] shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src={employee.avatar}
            alt={employee.fullName}
            className="w-12 h-12 rounded-xl object-cover ring-1 ring-[#334155] bg-[#0F172A] shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate leading-tight">
              {employee.fullName}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-semibold text-[#60A5FA]">
                {employee.designation}
              </span>
              <span className="text-[#475569]">•</span>
              <span className="text-[11px] font-mono text-[#94A3B8] font-medium bg-[#0F172A] px-2 py-0.5 rounded border border-[#334155]">
                {employee.employeeCode}
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              employee.status === 'active'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                employee.status === 'active' ? 'bg-emerald-400' : 'bg-slate-400'
              }`}
            />
            {employee.status === 'active' ? 'Active' : employee.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* 2. Profile Tabs: Velmora Dark Theme */}
      <div className="flex border-b border-[#334155] mt-4 space-x-6 text-xs sm:text-sm font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`pb-3 relative transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'text-[#60A5FA] font-bold border-b-2 border-[#3B82F6]'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          General Information
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 relative transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'text-[#60A5FA] font-bold border-b-2 border-[#3B82F6]'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          Attendance ({employeeAttendance.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leaves')}
          className={`pb-3 relative transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'leaves'
              ? 'text-[#60A5FA] font-bold border-b-2 border-[#3B82F6]'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          Leaves ({employeeLeaves.length})
        </button>
        {isOwnEmployeeProfile && (
          <button
            type="button"
            onClick={() => setActiveTab('product_select')}
            className={`pb-3 relative transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'product_select'
                ? 'text-[#60A5FA] font-bold border-b-2 border-[#3B82F6]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product Select</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`pb-3 relative transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'payroll'
              ? 'text-[#60A5FA] font-bold border-b-2 border-[#3B82F6]'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Salary & Bank</span>
          {!canViewSalary && <Lock className="w-3.5 h-3.5 text-[#64748B]" />}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`pb-3 relative transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'documents'
              ? 'text-[#60A5FA] font-bold border-b-2 border-[#3B82F6]'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Document ({employeeSubmittedDocs.length})</span>
        </button>
      </div>

      {/* 3. Tab Content */}
      <div className="pt-4 min-h-[260px]">
        {activeTab === 'profile' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Employment Details */}
              <div className="p-4 bg-[#151D2B] border border-[#334155] rounded-xl space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 pb-2.5 border-b border-[#334155]">
                  <Briefcase className="w-4 h-4 text-[#60A5FA]" />
                  <span>Employment Details</span>
                </h4>
                <div className="flex items-center justify-between py-2 border-b border-[#334155]/50">
                  <span className="text-[#94A3B8] font-medium">Employment Type:</span>
                  <span className="font-bold text-white capitalize">
                    {employee.employmentType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#334155]/50">
                  <span className="text-[#94A3B8] font-medium">Date of Joining:</span>
                  <span className="font-bold text-white font-mono">{employee.joiningDate}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#334155]/50">
                  <span className="text-[#94A3B8] font-medium">Shift Schedule:</span>
                  <span className="font-bold text-[#60A5FA]">{employee.shiftName}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#94A3B8] font-medium">Manager:</span>
                  <span className="font-bold text-white">{employee.managerName || 'Direct Executive'}</span>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-4 bg-[#151D2B] border border-[#334155] rounded-xl space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 pb-2.5 border-b border-[#334155]">
                  <Phone className="w-4 h-4 text-[#34D399]" />
                  <span>Emergency Contact</span>
                </h4>
                {canViewPrivatePersonalInfo ? (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-[#334155]/50">
                      <span className="text-[#94A3B8] font-medium">Contact Name:</span>
                      <span className="font-bold text-white">
                        {employee.emergencyContactName || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[#334155]/50">
                      <span className="text-[#94A3B8] font-medium">Relationship:</span>
                      <span className="font-bold text-white">
                        {employee.emergencyContactRelation || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[#334155]/50">
                      <span className="text-[#94A3B8] font-medium">Phone Number:</span>
                      <span className="font-bold text-white font-mono">
                        {employee.emergencyContactPhone || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-[#94A3B8] font-medium">Residential Address:</span>
                      <span className="font-bold text-white text-right max-w-[200px] truncate" title={employee.address}>
                        {employee.address || '—'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center bg-[#0F172A] rounded-xl border border-[#334155] px-3">
                    <Lock className="w-6 h-6 text-[#64748B] mx-auto mb-2" />
                    <p className="text-xs font-semibold text-white">Private Contact Details</p>
                    <p className="text-[11px] text-[#94A3B8] mt-1 max-w-xs mx-auto">
                      Emergency contacts and residential address are visible only to the employee and HR/Admin.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-4 text-xs">
            {/* Shift & Today's Attendance Overview Card */}
            <div className="p-4 bg-[#151D2B] border border-[#334155] rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#334155]">
                <div className="flex items-center gap-2">
                  <span
                    className="p-1.5 rounded-lg text-white"
                    style={{ backgroundColor: assignedShift.color }}
                  >
                    <Layers className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">
                      Assigned Shift
                    </span>
                    <span className="font-bold text-white text-sm">
                      {assignedShift.name} ({formatScheduledTimeRange(assignedShift)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[#94A3B8] font-medium">Selected Date ({selectedDate}):</span>
                  {todayRecord ? (
                    <Badge variant={todayRecord.status as any} size="sm">
                      {getAttendanceStatusLabel(todayRecord.status)}
                    </Badge>
                  ) : (
                    <span className="text-[#94A3B8] font-medium italic">No punch recorded</span>
                  )}
                </div>
              </div>

              {/* 5 Real Attendance Metric Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="p-2.5 bg-[#0F172A] rounded-xl border border-[#334155]">
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase block">Present</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">{presentDays}</span>
                </div>
                <div className="p-2.5 bg-[#0F172A] rounded-xl border border-[#334155]">
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase block">Late</span>
                  <span className="text-lg font-black text-amber-400 font-mono">{lateDays}</span>
                </div>
                <div className="p-2.5 bg-[#0F172A] rounded-xl border border-[#334155]">
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase block">Absent</span>
                  <span className="text-lg font-black text-rose-400 font-mono">{absentDays}</span>
                </div>
                <div className="p-2.5 bg-[#0F172A] rounded-xl border border-[#334155]">
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase block">Leave Days</span>
                  <span className="text-lg font-black text-purple-400 font-mono">{leaveDays}</span>
                </div>
                <div className="p-2.5 bg-[#0F172A] rounded-xl border border-[#334155] col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase block">Total Worked</span>
                  <span className="text-lg font-black text-[#60A5FA] font-mono">{totalWorkHours.toFixed(1)}h</span>
                </div>
              </div>
            </div>

            {/* Attendance History Table */}
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Attendance History</span>
              </h4>
              {employeeAttendance.length === 0 ? (
                <div className="p-8 bg-[#151D2B] border border-[#334155] rounded-xl text-center">
                  <p className="text-xs font-semibold text-[#94A3B8]">No attendance records logged yet.</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Punch in or record manual attendance to populate this history.</p>
                </div>
              ) : (
                <div className="border border-[#334155] rounded-xl overflow-hidden bg-[#151D2B]">
                  <div className="grid grid-cols-5 bg-[#0F172A] px-3.5 py-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider border-b border-[#334155]">
                    <span>Date</span>
                    <span>Scheduled Shift</span>
                    <span>Actual In / Out</span>
                    <span>Hours</span>
                    <span className="text-right">Status</span>
                  </div>
                  <div className="divide-y divide-[#334155]/60 max-h-60 overflow-y-auto">
                    {employeeAttendance.map((rec) => (
                      <div key={rec.id} className="grid grid-cols-5 px-3.5 py-2.5 items-center text-xs hover:bg-[#1E293B]/70">
                        <span className="font-mono font-medium text-white">{rec.date}</span>
                        <span className="text-slate-300 font-medium">
                          {rec.shiftName || assignedShift.name}
                        </span>
                        <span className="font-mono text-[#94A3B8]">
                          {rec.checkInTime ? formatTime12Hour(rec.checkInTime) : '--:--'} &rarr;{' '}
                          {rec.checkOutTime ? formatTime12Hour(rec.checkOutTime) : '--:--'}
                        </span>
                        <span className="font-mono font-bold text-white">
                          {rec.workHoursFormatted && rec.workHoursFormatted !== '--'
                            ? rec.workHoursFormatted
                            : rec.workHours
                            ? `${rec.workHours}h`
                            : '--'}
                        </span>
                        <div className="text-right">
                          <Badge variant={rec.status as any} size="sm">
                            {getAttendanceStatusLabel(rec.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'leaves' && (
          <div>
            {employeeLeaves.length === 0 ? (
              <p className="text-center py-8 text-[#94A3B8] text-xs">No leave requests found for this employee.</p>
            ) : (
              <div className="space-y-2">
                {employeeLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="p-3.5 bg-[#151D2B] border border-[#334155] rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white capitalize">
                          {leave.leaveType === 'others'
                            ? leave.customLeaveType
                              ? `Others — ${leave.customLeaveType}`
                              : 'Others'
                            : `${leave.leaveType} Leave`}
                        </span>
                        <span className="text-[#475569]">&bull;</span>
                        <span className="text-[#94A3B8] font-medium">
                          {leave.startDate} to {leave.endDate} ({leave.daysCount} days)
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1 italic">"{leave.reason}"</p>
                    </div>
                    <Badge variant={leave.status} size="sm">
                      {leave.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'product_select' && isOwnEmployeeProfile && (
          <div className="space-y-4 text-xs">
            {/* Product Select Form Card */}
            <div className="p-4 bg-[#151D2B] border border-[#334155] rounded-xl space-y-4">
              {/* Heading, Supporting Text & Current Welfare Month/Year */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#334155]">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Select Your Monthly Welfare Product
                  </h4>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Choose one free product for this month.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-[11px] font-semibold text-[#94A3B8]">Welfare Period:</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#0F172A] border border-[#334155] font-bold text-[#60A5FA] text-xs">
                    {getMonthName(currentWelfarePeriod.month)} {currentWelfarePeriod.year}
                  </span>
                </div>
              </div>

              {/* Single Dropdown Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="employee-profile-welfare-product-select"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]"
                >
                  SELECT PRODUCT <span className="text-rose-400">*</span>
                </label>

                <div className="relative">
                  <select
                    id="employee-profile-welfare-product-select"
                    value={
                      currentMonthSelection
                        ? currentMonthSelection.product_id
                        : tempSelectedProductId
                    }
                    disabled={!!currentMonthSelection || isSavingWelfare}
                    onChange={(e) => {
                      if (currentMonthSelection) return;
                      setTempSelectedProductId(e.target.value);
                    }}
                    className={`w-full h-11 pl-3.5 pr-10 rounded-xl border text-xs font-medium appearance-none transition-all focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6] ${
                      currentMonthSelection
                        ? 'bg-[#0F172A] border-[#334155] text-white font-bold cursor-not-allowed opacity-80'
                        : 'bg-[#0F172A] hover:bg-[#1E293B] border-[#334155] text-white cursor-pointer'
                    }`}
                  >
                    <option value="" className="bg-[#1E293B]">Select a product…</option>
                    {welfareProducts
                      .filter((p) => p.is_active !== false)
                      .map((prod) => (
                        <option key={prod.id} value={prod.id} className="bg-[#1E293B]">
                          {prod.product_name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>

                <p className="text-[11px] text-[#94A3B8] pt-0.5">
                  Only one product can be confirmed per employee each month.
                </p>
              </div>

              {/* Already Confirmed Monthly Selection Details & Lock Message */}
              {currentMonthSelection && (
                <div className="p-3.5 bg-[#0F172A] border border-[#334155] rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA] block">
                        Confirmed Selection &bull; {getMonthName(currentWelfarePeriod.month)}{' '}
                        {currentWelfarePeriod.year}
                      </span>
                      <h5 className="text-sm font-extrabold text-white mt-0.5">
                        {currentMonthSelection.product_name}
                      </h5>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">
                        Selected Date: {formatKolkataDateTime(currentMonthSelection.selected_at).full}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {(() => {
                        const statusCfg = getStatusBadgeConfig(
                           currentMonthSelection.selection_status
                        );
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.classes}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
                            {statusCfg.label}
                          </span>
                        );
                      })()}

                      {currentMonthSelection.selection_status === 'distributed' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!authenticatedEmployee) return;
                            const res = confirmMonthlyWelfareReceived({
                              selectionId: currentMonthSelection.id,
                              employee: authenticatedEmployee,
                              actorUserId: currentUser.id,
                              actorName: currentUser.name,
                            });
                            if (!res.ok) {
                              showToast(res.error, 'error');
                              return;
                            }
                            setWelfareSelections(loadWelfareSelections());
                            addNotification({
                              title: 'Welfare Product Received',
                              message: `${authenticatedEmployee.fullName} confirmed receipt of ${currentMonthSelection.product_name}.`,
                              type: 'welfare',
                              targetRole: 'admin',
                            });
                            showToast('Welfare product received successfully!', 'success');
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer"
                        >
                          Confirm Received
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#334155] flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                    <Lock className="w-3.5 h-3.5 text-[#60A5FA] flex-shrink-0" />
                    <span>
                      You have already selected {currentMonthSelection.product_name} for{' '}
                      {getMonthName(currentWelfarePeriod.month)} {currentWelfarePeriod.year}. You can
                      choose a new product next month.
                    </span>
                  </div>
                </div>
              )}

              {/* Bottom-Right Confirm Selection Button */}
              <div className="pt-2 border-t border-[#334155] flex justify-end">
                <button
                  type="button"
                  disabled={
                    !!currentMonthSelection ||
                    !tempSelectedProductId ||
                    isSavingWelfare
                  }
                  onClick={() => {
                    if (currentMonthSelection) {
                      showToast(
                        `You have already selected ${currentMonthSelection.product_name} for ${getMonthName(currentWelfarePeriod.month)} ${currentWelfarePeriod.year}. You can choose a new product next month.`,
                        'info'
                      );
                      return;
                    }
                    if (!tempSelectedProductId) return;
                    setIsConfirmWelfareOpen(true);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    !!currentMonthSelection || !tempSelectedProductId || isSavingWelfare
                      ? 'bg-[#0F172A] text-[#64748B] border border-[#334155] cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1D4ED8] hover:to-[#4338CA] text-white shadow-sm cursor-pointer'
                  }`}
                >
                  {isSavingWelfare ? 'Saving…' : 'Confirm Selection'}
                </button>
              </div>
            </div>

            {/* Compact My Product History */}
            <div className="pt-2">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-2">
                My Product History
              </h5>
              {myProductHistory.length === 0 ? (
                <div className="p-4 bg-[#151D2B] border border-[#334155] rounded-xl text-center text-[#94A3B8] text-xs">
                  No monthly welfare product selections recorded yet.
                </div>
              ) : (
                <div className="border border-[#334155] rounded-xl overflow-hidden bg-[#151D2B]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0F172A] border-b border-[#334155] text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Month &amp; Year</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Selected Date</th>
                        <th className="py-2.5 px-3 text-right">Distribution Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]/60">
                      {myProductHistory.map((item) => {
                        const cfg = getStatusBadgeConfig(item.selection_status);
                        return (
                          <tr key={item.id} className="hover:bg-[#1E293B]/70">
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {getMonthName(item.welfare_month)} {item.welfare_year}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-[#60A5FA]">
                              {item.product_name}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-[#94A3B8]">
                              {formatKolkataDateTime(item.selected_at).date}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.classes}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                                  {cfg.label}
                                </span>
                                {item.selection_status === 'distributed' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!authenticatedEmployee) return;
                                      const res = confirmMonthlyWelfareReceived({
                                        selectionId: item.id,
                                        employee: authenticatedEmployee,
                                        actorUserId: currentUser.id,
                                        actorName: currentUser.name,
                                      });
                                      if (!res.ok) {
                                        showToast(res.error, 'error');
                                        return;
                                      }
                                      setWelfareSelections(loadWelfareSelections());
                                      addNotification({
                                        title: 'Welfare Product Received',
                                        message: `${authenticatedEmployee.fullName} confirmed receipt of ${item.product_name}.`,
                                        type: 'welfare',
                                        targetRole: 'admin',
                                      });
                                      showToast('Welfare product received successfully!', 'success');
                                    }}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer"
                                  >
                                    Confirm Received
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

            {/* Confirmation Dialog */}
            <Modal
              isOpen={isConfirmWelfareOpen}
              onClose={() => {
                if (!isSavingWelfare) setIsConfirmWelfareOpen(false);
              }}
              title="Confirm Welfare Product"
              subtitle="Monthly Free Employee Welfare Benefit"
              maxWidth="sm"
            >
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  You have selected{' '}
                  <strong className="text-white">
                    {welfareProducts.find((p) => p.id === tempSelectedProductId)?.product_name}
                  </strong>{' '}
                  for{' '}
                  <strong className="text-[#60A5FA]">
                    {getMonthName(currentWelfarePeriod.month)} {currentWelfarePeriod.year}
                  </strong>
                  . Only one product is allowed per employee each month. Confirm your selection?
                </p>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-[#334155]">
                  <button
                    type="button"
                    disabled={isSavingWelfare}
                    onClick={() => setIsConfirmWelfareOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#94A3B8] hover:text-white bg-transparent border border-[#334155] hover:bg-white/5 rounded-xl disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingWelfare}
                    onClick={() => {
                      if (isSavingWelfare) return;
                      if (!isOwnEmployeeProfile || !authenticatedEmployee) {
                        showToast(
                          'You can only select a monthly welfare product for your own employee profile.',
                          'error'
                        );
                        setIsConfirmWelfareOpen(false);
                        return;
                      }
                      setIsSavingWelfare(true);
                      try {
                        const res = submitMonthlyWelfareSelection({
                          employee: authenticatedEmployee,
                          actorUserId: currentUser.id,
                          actorName: currentUser.name,
                          productId: tempSelectedProductId,
                          year: currentWelfarePeriod.year,
                          month: currentWelfarePeriod.month,
                        });
                        if (!res.ok) {
                          if (res.existingSelection) {
                            setWelfareSelections(loadWelfareSelections());
                          }
                          showToast(res.error, res.existingSelection ? 'info' : 'error');
                          setIsConfirmWelfareOpen(false);
                          return;
                        }
                        setWelfareSelections(loadWelfareSelections());
                        const monthYearLabel = `${getMonthName(currentWelfarePeriod.month)} ${
                          currentWelfarePeriod.year
                        }`;
                        addNotification({
                          title: 'New Welfare Product Selection',
                          message: `${authenticatedEmployee.fullName} selected ${res.product.product_name} for ${monthYearLabel}.`,
                          type: 'welfare',
                          targetRole: 'admin',
                        });
                        setIsConfirmWelfareOpen(false);
                        showToast(
                          'Your monthly welfare product has been selected successfully!',
                          'success'
                        );
                      } finally {
                        setIsSavingWelfare(false);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1D4ED8] hover:to-[#4338CA] rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingWelfare ? 'Saving…' : 'Confirm Selection'}
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        )}

        {activeTab === 'payroll' && (
          <div>
            {!canViewSalary ? (
              <div className="p-8 text-center bg-[#151D2B] border border-[#334155] rounded-xl">
                <Lock className="w-10 h-10 text-[#64748B] mx-auto mb-3" />
                <h4 className="font-bold text-sm text-white">Confidential Financial Record</h4>
                <p className="text-xs text-[#94A3B8] mt-1 max-w-sm mx-auto">
                  Compensation, bank accounts, and tax identifiers are restricted to HR Administrators and Executive Payroll per security policy.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#0F172A] border border-emerald-500/30 rounded-xl">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                      Monthly Base Salary
                    </span>
                    <span className="text-3xl font-extrabold text-emerald-400 font-mono mt-1 block">
                      {settings.currencySymbol}
                      {employee.baseSalary.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-emerald-500/80 mt-1 block">
                      Gross Estimated: {settings.currencySymbol}
                      {Math.round(employee.baseSalary * 1.15).toLocaleString()} / mo
                    </span>
                  </div>

                  <div className="p-4 bg-[#151D2B] border border-[#334155] rounded-xl">
                    <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider block">
                      Disbursement Method
                    </span>
                    <span className="text-lg font-bold text-white mt-1 block">
                      {employee.bankName}
                    </span>
                    <span className="text-xs font-mono text-slate-300 mt-1 block">
                      Account: {employee.accountNumber}
                    </span>
                    {employee.ifscCode && (
                      <span className="text-xs font-mono text-emerald-400 mt-0.5 block">
                        IFSC: {employee.ifscCode}
                      </span>
                    )}
                    <span className="text-[11px] text-[#94A3B8] block">
                      Tax ID: {employee.taxId}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB: Dedicated Exclusively to Personal Employee Submissions */}
        {activeTab === 'documents' && (
          <div className="space-y-5">
            {/* 2 Metric Indicators: Employee Submitted and Total Documents */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Employee Submitted */}
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                    Employee Submitted
                  </span>
                  <span className="text-2xl font-extrabold text-white mt-0.5 block">
                    {employeeSubmittedDocs.length}
                  </span>
                  <span className="text-[10px] text-blue-300/80">
                    Documents uploaded by employee
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              {/* 2. Total Documents */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Documents
                  </span>
                  <span className="text-2xl font-extrabold text-white mt-0.5 block">
                    {employeeSubmittedDocs.length}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Employee-submitted records visible in this profile
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-700/60 text-slate-300 border border-slate-600">
                  <FolderOpen className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Document Upload Area */}
            <div className="p-4 rounded-xl bg-[#0F172A] border border-[#334155] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#334155]/60 pb-2.5">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-[#60A5FA]" />
                    <span>Upload &amp; Submit Document</span>
                  </h4>
                  <p className="text-[11px] text-[#94A3B8]">
                    {isOwnEmployeeProfile
                      ? 'Submit your ID proof, degree certificate, or tax documents for HR verification'
                      : `Submit documentation for ${employee.fullName}`}
                  </p>
                </div>
                <span className="text-[10px] text-[#64748B] font-mono">
                  PDF, JPG, PNG, DOC, DOCX (Max 15MB)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-bold uppercase text-[#94A3B8] mb-1">
                    Document Category *
                  </label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as EmployeeFileCategory)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#334155] bg-[#151D2B] text-white focus:outline-hidden focus:border-[#3B82F6]"
                  >
                    <option value="ID Proof">ID Proof</option>
                    <option value="Offer Letter">Offer Letter</option>
                    <option value="Resume">Resume</option>
                    <option value="Contract">Contract</option>
                    <option value="Certification">Certification</option>
                    <option value="Tax Form">Tax Form</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="sm:col-span-7">
                  <input
                    type="file"
                    ref={employeeFileInputRef}
                    accept=".pdf, .jpg, .jpeg, .png, .doc, .docx"
                    onChange={handleEmployeeDocUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingDoc}
                    onClick={() => employeeFileInputRef.current?.click()}
                    className="w-full h-[38px] px-4 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    {isUploadingDoc ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading &amp; Submitting...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Browse &amp; Upload Document</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {docFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    docFeedback.type === 'error'
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {docFeedback.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span>{docFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Personal Employee Submissions Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Personal Employee Submissions ({employeeSubmittedDocs.length})</span>
                </h4>
                <span className="text-[10px] text-[#94A3B8]">
                  Documents submitted personally by {employee.fullName}
                </span>
              </div>

              {employeeSubmittedDocs.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-[#334155] rounded-xl bg-[#151D2B]/40 text-xs text-[#94A3B8]">
                  No personal employee submissions yet. Use the upload form above to submit your documents.
                </div>
              ) : (
                <div className="border border-[#334155] rounded-xl overflow-x-auto shadow-sm">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-[#111827] border-b border-[#334155] text-[#94A3B8] uppercase text-[10px] font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Document Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Submitted By</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]/60 bg-[#151D2B]">
                      {employeeSubmittedDocs.map((doc) => (
                        <tr key={doc.id} className="hover:bg-[#1E293B]/60 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-white truncate max-w-xs" title={doc.fileName}>
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span className="truncate">{doc.fileName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                              {doc.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#94A3B8]">{doc.fileSize}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] font-medium text-blue-300">
                              Submitted by {doc.uploadedBy || employee.fullName}
                            </span>
                            <span className="text-[9px] text-[#64748B] block">{doc.uploadedAt}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            {doc.verificationStatus === 'verified' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Verified</span>
                              </span>
                            ) : doc.verificationStatus === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <AlertCircle className="w-3 h-3" />
                                <span>Rejected</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                <span>Pending Review</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleViewDoc(doc)}
                                className="p-1 rounded border border-[#334155] text-blue-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                                title="View Document"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadDoc(doc)}
                                className="p-1 rounded border border-[#334155] text-emerald-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                                title="Download Document"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      {canManageEmployees && (
        <div className="mt-6 pt-4 border-t border-[#334155] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onDelete(employee);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Employee</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onAssignShift(employee);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#151D2B] hover:bg-[#334155] border border-[#334155] rounded-xl transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Reassign Shift</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onEdit(employee);
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1D4ED8] hover:to-[#4338CA] rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
