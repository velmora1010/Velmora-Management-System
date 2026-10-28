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
  ShieldLock,
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
} from 'lucide-react';
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
  | 'payroll';

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

  const canViewPrivatePersonalInfo = canManageEmployees || isOwnEmployeeProfile;

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
      {/* Employee Top Profile Hero */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 rounded-2xl border border-slate-100">
        <Avatar
          src={employee.avatar}
          name={employee.fullName}
          size="xl"
          className="ring-4 ring-white shadow-md flex-shrink-0"
        />
        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-[#172B4D]">{employee.fullName}</h2>
              <p className="text-sm font-medium text-[#206DA6]">{employee.designation}</p>
            </div>
            <div>
              <Badge variant={employee.status}>{employee.status.replace('_', ' ')}</Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 justify-center sm:justify-start">
            <span className="flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              {employee.departmentName}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {employee.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {employee.shiftName}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {employee.workLocation} ({employee.city})
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 mt-5 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'profile'
              ? 'text-[#206DA6] font-bold border-b-2 border-[#206DA6]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          General Information
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'attendance'
              ? 'text-[#206DA6] font-bold border-b-2 border-[#206DA6]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Attendance ({employeeAttendance.length})
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'leaves'
              ? 'text-[#206DA6] font-bold border-b-2 border-[#206DA6]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Leaves ({employeeLeaves.length})
        </button>
        {isOwnEmployeeProfile && (
          <button
            onClick={() => setActiveTab('product_select')}
            className={`pb-3 relative transition-colors flex items-center gap-1.5 ${
              activeTab === 'product_select'
                ? 'text-[#206DA6] font-bold border-b-2 border-[#206DA6]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product Select</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('payroll')}
          className={`pb-3 relative transition-colors flex items-center gap-1.5 ${
            activeTab === 'payroll'
              ? 'text-[#206DA6] font-bold border-b-2 border-[#206DA6]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Salary & Bank {!canViewPayroll && <ShieldLock className="w-3.5 h-3.5 text-slate-400" />}
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-4 min-h-[260px]">
        {activeTab === 'profile' && (
          <div className="space-y-4 text-xs">
            {employee.bio && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-500 block mb-1 uppercase tracking-wider text-[10px]">
                  Professional Summary
                </span>
                <p className="text-slate-700 leading-relaxed text-sm">{employee.bio}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-2.5">
                <h4 className="font-bold text-[#172B4D] text-sm flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[#206DA6]" /> Employment Details
                </h4>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Employment Type:</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {employee.employmentType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Date of Joining:</span>
                  <span className="font-semibold text-slate-800">{employee.joiningDate}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Shift Schedule:</span>
                  <span className="font-semibold text-[#206DA6]">{employee.shiftName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Manager:</span>
                  <span className="font-semibold text-slate-800">{employee.managerName || 'Direct Executive'}</span>
                </div>
              </div>

              <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-2.5">
                <h4 className="font-bold text-[#172B4D] text-sm flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-[#18A999]" /> Emergency Contact
                </h4>
                {canViewPrivatePersonalInfo ? (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Contact Name:</span>
                      <span className="font-semibold text-slate-800">{employee.emergencyContactName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Relationship:</span>
                      <span className="font-semibold text-slate-800">{employee.emergencyContactRelation}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Phone Number:</span>
                      <span className="font-semibold text-slate-800">{employee.emergencyContactPhone}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Residential Address:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[180px]">{employee.address}</span>
                    </div>
                  </>
                ) : (
                  <div className="py-5 text-center bg-slate-50 rounded-xl border border-slate-100 px-3">
                    <ShieldLock className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-[#172B4D]">Private Contact Details</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
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
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span
                    className="p-1.5 rounded-lg text-white"
                    style={{ backgroundColor: assignedShift.color }}
                  >
                    <Layers className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Assigned Shift
                    </span>
                    <span className="font-bold text-slate-800 text-sm">
                      {assignedShift.name} ({formatScheduledTimeRange(assignedShift)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Selected Date ({selectedDate}):</span>
                  {todayRecord ? (
                    <Badge variant={todayRecord.status as any} size="sm">
                      {getAttendanceStatusLabel(todayRecord.status)}
                    </Badge>
                  ) : (
                    <span className="text-slate-400 font-medium italic">No punch recorded</span>
                  )}
                </div>
              </div>

              {/* 5 Real Attendance Metric Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Present</span>
                  <span className="text-lg font-black text-emerald-600 font-mono">{presentDays}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Late</span>
                  <span className="text-lg font-black text-amber-600 font-mono">{lateDays}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Absent</span>
                  <span className="text-lg font-black text-rose-600 font-mono">{absentDays}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Leave Days</span>
                  <span className="text-lg font-black text-purple-600 font-mono">{leaveDays}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Worked</span>
                  <span className="text-lg font-black text-[#206DA6] font-mono">{totalWorkHours.toFixed(1)}h</span>
                </div>
              </div>
            </div>

            {/* Attendance History Table */}
            <div>
              <h4 className="font-bold text-[#172B4D] text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#206DA6]" /> Attendance History
              </h4>
              {employeeAttendance.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs font-semibold text-slate-500">No attendance records logged yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Punch in or record manual attendance to populate this history.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-5 bg-slate-50 px-3.5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <span>Date</span>
                    <span>Scheduled Shift</span>
                    <span>Actual In / Out</span>
                    <span>Hours</span>
                    <span className="text-right">Status</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {employeeAttendance.map((rec) => (
                      <div key={rec.id} className="grid grid-cols-5 px-3.5 py-2.5 items-center text-xs hover:bg-slate-50/80">
                        <span className="font-mono font-medium text-slate-800">{rec.date}</span>
                        <span className="text-slate-600 font-medium">
                          {rec.shiftName || assignedShift.name}
                        </span>
                        <span className="font-mono text-slate-700">
                          {rec.checkInTime ? formatTime12Hour(rec.checkInTime) : '--:--'} &rarr;{' '}
                          {rec.checkOutTime ? formatTime12Hour(rec.checkOutTime) : '--:--'}
                        </span>
                        <span className="font-mono font-bold text-slate-800">
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
              <p className="text-center py-8 text-slate-400 text-xs">No leave requests found for this employee.</p>
            ) : (
              <div className="space-y-2">
                {employeeLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="p-3 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 capitalize">
                          {leave.leaveType === 'others'
                            ? leave.customLeaveType
                              ? `Others — ${leave.customLeaveType}`
                              : 'Others'
                            : `${leave.leaveType} Leave`}
                        </span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="text-slate-600 font-medium">
                          {leave.startDate} to {leave.endDate} ({leave.daysCount} days)
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-1 italic">"{leave.reason}"</p>
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
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-4">
              {/* Heading, Supporting Text & Current Welfare Month/Year */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-[#172B4D]">
                    Select Your Monthly Welfare Product
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose one free product for this month.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-[11px] font-semibold text-slate-500">Welfare Period:</span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50/80 border border-blue-200/80 font-bold text-[#206DA6] text-xs">
                    {getMonthName(currentWelfarePeriod.month)} {currentWelfarePeriod.year}
                  </span>
                </div>
              </div>

              {/* Single Dropdown Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="employee-profile-welfare-product-select"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-600"
                >
                  SELECT PRODUCT <span className="text-rose-500">*</span>
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
                    className={`w-full h-11 pl-3.5 pr-10 rounded-xl border text-xs font-medium appearance-none transition-all focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] focus:border-[#206DA6] ${
                      currentMonthSelection
                        ? 'bg-slate-100 border-slate-200 text-[#172B4D] font-bold cursor-not-allowed'
                        : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200 text-[#172B4D] cursor-pointer'
                    }`}
                  >
                    <option value="">Select a product…</option>
                    {welfareProducts
                      .filter((p) => p.is_active !== false)
                      .map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.product_name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>

                <p className="text-[11px] text-slate-500 pt-0.5">
                  Only one product can be confirmed per employee each month.
                </p>
              </div>

              {/* Already Confirmed Monthly Selection Details & Lock Message */}
              {currentMonthSelection && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#206DA6] block">
                        Confirmed Selection &bull; {getMonthName(currentWelfarePeriod.month)}{' '}
                        {currentWelfarePeriod.year}
                      </span>
                      <h5 className="text-sm font-extrabold text-[#172B4D] mt-0.5">
                        {currentMonthSelection.product_name}
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
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
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                        >
                          Confirm Received
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-200/60 flex items-center gap-1.5 text-[11px] font-semibold text-[#172B4D]">
                    <Lock className="w-3.5 h-3.5 text-[#206DA6] flex-shrink-0" />
                    <span>
                      You have already selected {currentMonthSelection.product_name} for{' '}
                      {getMonthName(currentWelfarePeriod.month)} {currentWelfarePeriod.year}. You can
                      choose a new product next month.
                    </span>
                  </div>
                </div>
              )}

              {/* Bottom-Right Confirm Selection Button */}
              <div className="pt-2 border-t border-slate-100 flex justify-end">
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
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-[#206DA6] hover:bg-[#1A5987] text-white shadow-sm shadow-[#206DA6]/20 cursor-pointer'
                  }`}
                >
                  {isSavingWelfare ? 'Saving…' : 'Confirm Selection'}
                </button>
              </div>
            </div>

            {/* Compact My Product History */}
            <div className="pt-2">
              <h5 className="font-bold text-[#172B4D] text-xs uppercase tracking-wider mb-2">
                My Product History
              </h5>
              {myProductHistory.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-slate-400 text-xs">
                  No monthly welfare product selections recorded yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-3">Month &amp; Year</th>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3">Selected Date</th>
                        <th className="py-2 px-3 text-right">Distribution Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {myProductHistory.map((item) => {
                        const cfg = getStatusBadgeConfig(item.selection_status);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-semibold text-[#172B4D]">
                              {getMonthName(item.welfare_month)} {item.welfare_year}
                            </td>
                            <td className="py-2 px-3 font-bold text-[#206DA6]">
                              {item.product_name}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                              {formatKolkataDateTime(item.selected_at).date}
                            </td>
                            <td className="py-2 px-3 text-right">
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
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
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
                <p className="text-xs text-slate-600 leading-relaxed">
                  You have selected{' '}
                  <strong className="text-[#172B4D]">
                    {welfareProducts.find((p) => p.id === tempSelectedProductId)?.product_name}
                  </strong>{' '}
                  for{' '}
                  <strong className="text-[#206DA6]">
                    {getMonthName(currentWelfarePeriod.month)} {currentWelfarePeriod.year}
                  </strong>
                  . Only one product is allowed per employee each month. Confirm your selection?
                </p>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isSavingWelfare}
                    onClick={() => setIsConfirmWelfareOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
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
                    className="px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-sm transition-all disabled:opacity-50"
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
            {!canViewPayroll ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                <ShieldLock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h4 className="font-bold text-sm text-[#172B4D]">Confidential Financial Record</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Compensation, bank accounts, and tax identifiers are restricted to HR Administrators and Executive Payroll per security policy.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Monthly Base Salary
                    </span>
                    <span className="text-3xl font-extrabold text-emerald-700 font-mono mt-1 block">
                      {settings.currencySymbol}
                      {employee.baseSalary.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-emerald-600 mt-1 block">
                      Gross Estimated: {settings.currencySymbol}
                      {Math.round(employee.baseSalary * 1.15).toLocaleString()} / mo
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Disbursement Method
                    </span>
                    <span className="text-lg font-bold text-[#172B4D] mt-1 block">
                      {employee.bankName}
                    </span>
                    <span className="text-xs font-mono text-slate-600 mt-1 block">
                      Account: {employee.accountNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Tax ID: {employee.taxId}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      {canManageEmployees && (
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onDelete(employee);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Employee
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onAssignShift(employee);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Reassign Shift
            </button>
            <button
              type="button"
              onClick={() => {
                onEdit(employee);
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-sm transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Profile
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
