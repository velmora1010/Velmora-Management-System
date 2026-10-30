import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Building2,
  CalendarDays,
  Clock,
  ClipboardList,
  ClipboardCheck,
  HeartHandshake,
  CircleDollarSign,
  BarChart3,
  Settings,
  AlertCircle,
} from 'lucide-react';

import './index.css';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HRMSProvider, useHRMS } from './context/HRMSContext';
import { WorkAssignmentProvider, useWorkAssignment } from './context/WorkAssignmentContext';
import { TopNav } from './components/layout/TopNav';
import { NavigationTab } from './components/layout/Sidebar';
import { findLinkedEmployee, doesAssignmentBelongToEmployee } from './utils/employeeIdentity';

// Modules
import { HRDashboard } from './components/modules/dashboard/HRDashboard';
import { EmployeeDirectory } from './components/modules/employees/EmployeeDirectory';
import { AttendanceModule } from './components/modules/attendance/AttendanceModule';
import { DepartmentModule } from './components/modules/departments/DepartmentModule';
import { LeaveModule } from './components/modules/leave/LeaveModule';
import { ShiftModule } from './components/modules/shifts/ShiftModule';
import { WorkAssignmentModule } from './components/modules/work/WorkAssignmentModule';
import { AssignedWorksModule } from './components/modules/work/AssignedWorksModule';
import { EmployeeWelfareModule } from './components/modules/welfare/EmployeeWelfareModule';
import { PayrollModule } from './components/modules/payroll/PayrollModule';
import { ReportsModule } from './components/modules/reports/ReportsModule';
import { SettingsModule } from './components/modules/settings/SettingsModule';

// Modals
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { CheckInModal } from './components/modals/CheckInModal';
import { EmployeeDetailModal, EmployeeProfileTab } from './components/modals/EmployeeDetailModal';
import { EmployeeFormModal } from './components/modals/EmployeeFormModal';
import { DepartmentDetailModal } from './components/modals/DepartmentDetailModal';
import { DepartmentFormModal } from './components/modals/DepartmentFormModal';
import { LeaveDetailModal } from './components/modals/LeaveDetailModal';
import { ApplyLeaveModal } from './components/modals/ApplyLeaveModal';
import { ManualAttendanceModal } from './components/modals/ManualAttendanceModal';
import { ShiftAssignModal } from './components/modals/ShiftAssignModal';
import { ShiftFormModal } from './components/modals/ShiftFormModal';
import { PayslipModal } from './components/modals/PayslipModal';
import { GeneratePayrollModal } from './components/modals/GeneratePayrollModal';
import { EmployeeLoginModal } from './components/modals/EmployeeLoginModal';
import { AdminLoginModal } from './components/modals/AdminLoginModal';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { ErrorBoundary } from './components/common/ErrorBoundary';

import {
  Employee,
  Department,
  LeaveRequest,
  AttendanceRecord,
  AttendanceStatus,
  PayrollRecord,
} from './types/hrms';

const HRLayoutContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { employees, deleteEmployee, deleteDepartment, dashboardMetrics, leaveRequests } = useHRMS();
  const {
    currentUser,
    canManageEmployees,
    canViewPayroll,
    isLinkedEmployee,
    linkedEmployee,
    setEmployeeSession,
    clearEmployeeSession,
  } = useAuth();
  const { taskAssignments } = useWorkAssignment();
  const { showToast } = useToast();

  const [isEmployeeLoginOpen, setIsEmployeeLoginOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  const isEmployee = currentUser.role === 'employee';

  // Determine current active HR tab from pathname
  const currentTab = useMemo<NavigationTab>(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const hrIndex = segments.indexOf('hr');
    if (hrIndex !== -1 && segments[hrIndex + 1]) {
      const seg = segments[hrIndex + 1].toLowerCase();
      const valid: NavigationTab[] = [
        'dashboard',
        'employees',
        'attendance',
        'departments',
        'leave',
        'shifts',
        'work-assignment',
        'assigned-works',
        'employee-welfare',
        'payroll',
        'reports',
        'settings',
      ];
      if (valid.includes(seg as NavigationTab)) {
        return seg as NavigationTab;
      }
    }
    return 'dashboard';
  }, [location.pathname]);

  // Modal States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);

  // Employee Modals
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeDetailInitialTab, setEmployeeDetailInitialTab] = useState<
    EmployeeProfileTab | undefined
  >(undefined);
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const handleSelectEmployee = useCallback((emp: Employee) => {
    setEmployeeDetailInitialTab('profile');
    setSelectedEmployee(emp);
  }, []);

  const handleOpenMyProfile = useCallback(() => {
    const ownEmp = findLinkedEmployee(currentUser, employees);
    if (!ownEmp) {
      showToast('Your account is not linked to an employee profile. Please contact HR.', 'error');
      return;
    }
    setEmployeeDetailInitialTab('profile');
    setSelectedEmployee(ownEmp);
  }, [currentUser, employees, showToast]);

  const handleOpenMyProfileProductSelect = useCallback(() => {
    const ownEmp = findLinkedEmployee(currentUser, employees);
    if (!ownEmp) {
      showToast('Your account is not linked to an employee profile. Please contact HR.', 'error');
      return;
    }
    setEmployeeDetailInitialTab('product_select');
    setSelectedEmployee(ownEmp);
  }, [currentUser, employees, showToast]);

  const handleNavigateTab = useCallback(
    (tab: NavigationTab) => {
      if (tab === 'my-profile') {
        handleOpenMyProfile();
        return;
      }
      if (tab === 'product-select') {
        handleOpenMyProfileProductSelect();
        return;
      }
      navigate(`/hr/${tab}`);
    },
    [navigate, handleOpenMyProfile, handleOpenMyProfileProductSelect]
  );

  // Department Modals
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isDepartmentFormOpen, setIsDepartmentFormOpen] = useState(false);
  const [departmentToEdit, setDepartmentToEdit] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);

  // Leave Modals
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);

  // Attendance Modals
  const [isManualAttendanceOpen, setIsManualAttendanceOpen] = useState(false);
  const [attendanceToEdit, setAttendanceToEdit] = useState<AttendanceRecord | null>(null);
  const [manualAttendanceInitialStatus, setManualAttendanceInitialStatus] = useState<AttendanceStatus | null>(null);

  // Shift Modals
  const [shiftAssignEmployee, setShiftAssignEmployee] = useState<Employee | null>(null);
  const [isShiftFormOpen, setIsShiftFormOpen] = useState(false);

  // Payroll Modals
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [isGeneratePayrollOpen, setIsGeneratePayrollOpen] = useState(false);

  // Shortcut Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute live badge counts
  const pendingLeaves = useMemo(() => {
    return leaveRequests.filter((l) => l.status === 'pending').length;
  }, [leaveRequests]);

  const assignedWorksBadge = useMemo(() => {
    if (canManageEmployees) return null;
    const ownEmp = findLinkedEmployee(currentUser, employees);
    if (!ownEmp) return null;
    const seenTaskIds = new Set<string>();
    let personalPending = 0;
    taskAssignments.forEach((a) => {
      if (doesAssignmentBelongToEmployee(a, ownEmp)) {
        const key = a.taskId || a.id;
        if (!seenTaskIds.has(key)) {
          seenTaskIds.add(key);
          if (a.status !== 'completed' && a.status !== 'cancelled') {
            personalPending++;
          }
        }
      }
    });
    return personalPending > 0 ? personalPending : null;
  }, [canManageEmployees, currentUser, employees, taskAssignments]);

  // Navigation items partitioned into clean rows:
  // For Employee: permitted employee-facing tabs only, with administrative modules hidden
  // For Admin: Row 1 ending with Work Assignment, Row 2 with remaining administrative modules
  const { row1Items, row2Items } = useMemo(() => {
    if (isEmployee) {
      const r1 = [
        {
          id: 'dashboard' as NavigationTab,
          label: 'My Dashboard',
          icon: LayoutDashboard,
          badge: null,
        },
        {
          id: 'my-profile' as NavigationTab,
          label: 'My Profile',
          icon: Users,
          badge: null,
        },
        {
          id: 'attendance' as NavigationTab,
          label: 'My Attendance',
          icon: CalendarCheck,
          badge: null,
        },
        {
          id: 'leave' as NavigationTab,
          label: 'My Leave History',
          icon: CalendarDays,
          badge: pendingLeaves > 0 ? pendingLeaves : null,
          badgeColor: 'bg-amber-500 text-white',
        },
        {
          id: 'assigned-works' as NavigationTab,
          label: 'Assigned Works',
          icon: ClipboardCheck,
          badge: assignedWorksBadge,
          badgeColor: 'bg-indigo-600 text-white',
        },
        {
          id: 'product-select' as NavigationTab,
          label: 'Product Select',
          icon: HeartHandshake,
          badge: null,
        },
      ];
      return { row1Items: r1, row2Items: [] };
    }

    const r1 = [
      {
        id: 'dashboard' as NavigationTab,
        label: 'Dashboard',
        icon: LayoutDashboard,
        badge: null,
      },
      {
        id: 'employees' as NavigationTab,
        label: 'Employees',
        icon: Users,
        badge: dashboardMetrics.totalEmployees,
      },
      {
        id: 'attendance' as NavigationTab,
        label: 'Attendance',
        icon: CalendarCheck,
        badge: `${dashboardMetrics.presentToday}/${dashboardMetrics.totalEmployees}`,
      },
      {
        id: 'departments' as NavigationTab,
        label: 'Departments',
        icon: Building2,
        badge: dashboardMetrics.totalDepartments,
      },
      {
        id: 'leave' as NavigationTab,
        label: 'Leave Management',
        icon: CalendarDays,
        badge: pendingLeaves > 0 ? pendingLeaves : null,
        badgeColor: 'bg-amber-500 text-white',
      },
      {
        id: 'shifts' as NavigationTab,
        label: 'Shift Management',
        icon: Clock,
        badge: null,
      },
      {
        id: 'work-assignment' as NavigationTab,
        label: 'Work Assignment',
        icon: ClipboardList,
        badge: null,
      },
    ];

    const r2 = [
      {
        id: 'employee-welfare' as NavigationTab,
        label: 'Employee Welfare',
        icon: HeartHandshake,
        badge: null,
      },
      ...(canViewPayroll
        ? [
            {
              id: 'payroll' as NavigationTab,
              label: 'Salary / Payroll',
              icon: CircleDollarSign,
              badge: 'Active',
            },
          ]
        : []),
      {
        id: 'reports' as NavigationTab,
        label: 'Reports',
        icon: BarChart3,
        badge: null,
      },
      {
        id: 'settings' as NavigationTab,
        label: 'Settings',
        icon: Settings,
        badge: null,
      },
    ];

    return { row1Items: r1, row2Items: r2 };
  }, [
    isEmployee,
    dashboardMetrics,
    pendingLeaves,
    assignedWorksBadge,
    canViewPayroll,
  ]);

  const renderNavTabButton = useCallback(
    (item: {
      id: NavigationTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: string | number | null;
      badgeColor?: string;
    }) => {
      const isActive = currentTab === item.id;
      const Icon = item.icon;
      return (
        <button
          key={item.id}
          onClick={() => handleNavigateTab(item.id)}
          className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap border shrink-0 ${
            isActive
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/25 font-semibold'
              : 'bg-black/20 border-border text-muted hover:text-white hover:border-slate-600 hover:bg-white/5'
          }`}
        >
          <Icon
            className={`w-4 h-4 transition-colors ${
              isActive ? 'text-white' : 'text-muted group-hover:text-white'
            }`}
          />
          <span>{item.label}</span>
          {item.badge !== null && item.badge !== undefined && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isActive
                  ? 'bg-white/20 text-white'
                  : item.badgeColor || 'bg-white/10 text-slate-300 border border-white/5'
              }`}
            >
              {item.badge}
            </span>
          )}
        </button>
      );
    },
    [currentTab, handleNavigateTab]
  );

  // Unlinked employee account state: protect employee records and display contact-HR message
  if (isEmployee && !isLinkedEmployee) {
    return (
      <div className="hr-module-root flex-1 flex flex-col min-h-full bg-background text-main">
        <TopNav
          currentTab="dashboard"
          onToggleSidebar={() => {}}
          onOpenSearch={() => {}}
          onOpenCheckIn={() => {}}
          onNavigateTab={() => {}}
          onOpenMyProfile={() => {}}
          onOpenMyProfileProductSelect={() => {}}
          onOpenEmployeeLogin={() => setIsEmployeeLoginOpen(true)}
          onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-lg w-full bg-card rounded-2xl border border-border shadow-velmora">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Account Linking Required</h2>
            <p className="text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
              Your account is not linked to an employee profile. Please contact HR.
            </p>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-border text-xs text-muted w-full text-left">
              <p className="font-semibold text-slate-200 mb-1">Authenticated Account Details:</p>
              <p>Email: <span className="text-white font-mono">{currentUser.email}</span></p>
              <p>Role: <span className="text-white capitalize">{currentUser.role}</span></p>
              <p className="text-amber-400/90 mt-2">Protected employee records remain inaccessible until an HR administrator associates your account with a verified employee profile.</p>
            </div>
          </div>
        </main>
        <EmployeeLoginModal
          isOpen={isEmployeeLoginOpen}
          onClose={() => setIsEmployeeLoginOpen(false)}
          onSuccess={(sess) => {
            setEmployeeSession(sess);
            navigate('/hr/dashboard');
          }}
        />
        <AdminLoginModal
          isOpen={isAdminLoginOpen}
          onClose={() => setIsAdminLoginOpen(false)}
          onSuccess={() => {
            clearEmployeeSession();
            navigate('/hr/dashboard');
          }}
        />
      </div>
    );
  }

  return (
    <div className="hr-module-root flex-1 flex flex-col min-h-full bg-background text-main">
      {/* Top HR Header & Action Bar */}
      <TopNav
        currentTab={currentTab}
        onToggleSidebar={() => {}}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenCheckIn={() => setIsCheckInOpen(true)}
        onNavigateTab={handleNavigateTab}
        onOpenMyProfile={handleOpenMyProfile}
        onOpenMyProfileProductSelect={handleOpenMyProfileProductSelect}
        onOpenEmployeeLogin={() => setIsEmployeeLoginOpen(true)}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
      />

      {/* Two-Row HR Navigation Bar */}
      <div className="sticky top-16 z-10 bg-card/95 backdrop-blur-md border-b border-border px-4 sm:px-6 py-2.5 shadow-velmora flex flex-col gap-2">
        {/* Row 1 */}
        <div className="flex items-center gap-2 flex-wrap">
          {row1Items.map(renderNavTabButton)}
        </div>

        {/* Row 2: Rendered only when administrative modules exist */}
        {row2Items.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {row2Items.map(renderNavTabButton)}
          </div>
        )}
      </div>

      {/* Dynamic Module Body */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <HRDashboard
                onNavigateTab={handleNavigateTab}
                onSelectEmployee={handleSelectEmployee}
                onSelectLeave={(leave) => setSelectedLeave(leave)}
                onOpenCheckIn={() => setIsCheckInOpen(true)}
                onAddEmployee={() => {
                  if (!canManageEmployees) return;
                  setEmployeeToEdit(null);
                  setIsEmployeeFormOpen(true);
                }}
                onAddShift={() => setIsShiftFormOpen(true)}
              />
            }
          />
          <Route
            path="employees"
            element={
              canManageEmployees ? (
                <EmployeeDirectory
                  onSelectEmployee={handleSelectEmployee}
                  onAddEmployee={() => {
                    setEmployeeToEdit(null);
                    setIsEmployeeFormOpen(true);
                  }}
                  onEditEmployee={(emp) => {
                    setEmployeeToEdit(emp);
                    setIsEmployeeFormOpen(true);
                  }}
                  onDeleteEmployee={(emp) => setEmployeeToDelete(emp)}
                />
              ) : (
                <Navigate to="/hr/dashboard" replace />
              )
            }
          />
          <Route
            path="attendance"
            element={
              <AttendanceModule
                onOpenCheckIn={() => setIsCheckInOpen(true)}
                onOpenManualEntry={(rec, initialStatus) => {
                  if (!canManageEmployees) return;
                  setAttendanceToEdit(rec || null);
                  setManualAttendanceInitialStatus(initialStatus || null);
                  setIsManualAttendanceOpen(true);
                }}
                onSelectEmployee={handleSelectEmployee}
              />
            }
          />
          <Route
            path="departments"
            element={
              canManageEmployees ? (
                <DepartmentModule
                  onSelectDepartment={(dept) => setSelectedDepartment(dept)}
                  onAddDepartment={() => {
                    setDepartmentToEdit(null);
                    setIsDepartmentFormOpen(true);
                  }}
                  onEditDepartment={(dept) => {
                    setDepartmentToEdit(dept);
                    setIsDepartmentFormOpen(true);
                  }}
                />
              ) : (
                <Navigate to="/hr/dashboard" replace />
              )
            }
          />
          <Route
            path="leave"
            element={
              <LeaveModule
                onOpenApplyLeave={() => setIsApplyLeaveOpen(true)}
                onSelectLeave={(leave) => setSelectedLeave(leave)}
              />
            }
          />
          <Route
            path="shifts"
            element={
              canManageEmployees ? (
                <ShiftModule
                  onOpenAssignShift={(emp) => setShiftAssignEmployee(emp)}
                  onSelectEmployee={handleSelectEmployee}
                  onOpenAddShift={() => setIsShiftFormOpen(true)}
                />
              ) : (
                <Navigate to="/hr/dashboard" replace />
              )
            }
          />
          <Route
            path="work-assignment"
            element={
              canManageEmployees ? (
                <WorkAssignmentModule />
              ) : (
                <Navigate to="/hr/assigned-works" replace />
              )
            }
          />
          <Route
            path="assigned-works"
            element={<AssignedWorksModule />}
          />
          <Route
            path="employee-welfare"
            element={
              canManageEmployees ? (
                <EmployeeWelfareModule />
              ) : (
                <Navigate to="/hr/dashboard" replace />
              )
            }
          />
          <Route
            path="payroll"
            element={
              canViewPayroll ? (
                <PayrollModule
                  onOpenGeneratePayroll={() => setIsGeneratePayrollOpen(true)}
                  onSelectPayroll={(rec) => setSelectedPayroll(rec)}
                />
              ) : (
                <Navigate to="/hr/dashboard" replace />
              )
            }
          />
          <Route
            path="reports"
            element={
              canManageEmployees ? (
                <ReportsModule />
              ) : (
                <Navigate to="/hr/dashboard" replace />
              )
            }
          />
          <Route
            path="settings"
            element={
              canManageEmployees ? (
                <SettingsModule />
              ) : (
                <Navigate to="/hr/dashboard" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>

      {/* ================= MODALS & POPUPS ================= */}

      {/* Global Quick Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectEmployee={handleSelectEmployee}
        onSelectDepartment={(dept) => setSelectedDepartment(dept)}
      />

      {/* Live Check In / Check Out Modal */}
      <CheckInModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
      />

      {/* Employee Details Modal (tabbed with attendance, leaves, RBAC-protected compensation) */}
      <EmployeeDetailModal
        employee={selectedEmployee}
        isOpen={!!selectedEmployee}
        onClose={() => {
          setSelectedEmployee(null);
          setEmployeeDetailInitialTab(undefined);
        }}
        initialTab={employeeDetailInitialTab}
        onEdit={(emp) => {
          setEmployeeToEdit(emp);
          setIsEmployeeFormOpen(true);
        }}
        onDelete={(emp) => setEmployeeToDelete(emp)}
        onAssignShift={(emp) => setShiftAssignEmployee(emp)}
      />

      {/* Employee Add/Edit Form Modal */}
      <EmployeeFormModal
        isOpen={isEmployeeFormOpen}
        onClose={() => setIsEmployeeFormOpen(false)}
        employeeToEdit={employeeToEdit}
      />

      {/* Department Detail Modal (shows info & list of employees) */}
      <DepartmentDetailModal
        department={selectedDepartment}
        isOpen={!!selectedDepartment}
        onClose={() => setSelectedDepartment(null)}
        onEdit={(dept) => {
          setDepartmentToEdit(dept);
          setIsDepartmentFormOpen(true);
        }}
        onDelete={(dept) => setDepartmentToDelete(dept)}
        onSelectEmployee={handleSelectEmployee}
      />

      {/* Department Add/Edit Form Modal */}
      <DepartmentFormModal
        isOpen={isDepartmentFormOpen}
        onClose={() => setIsDepartmentFormOpen(false)}
        departmentToEdit={departmentToEdit}
      />

      {/* Leave Detail & Review Modal */}
      <LeaveDetailModal
        leave={selectedLeave}
        isOpen={!!selectedLeave}
        onClose={() => setSelectedLeave(null)}
      />

      {/* Apply Leave Modal */}
      <ApplyLeaveModal
        isOpen={isApplyLeaveOpen}
        onClose={() => setIsApplyLeaveOpen(false)}
      />

      {/* Manual Attendance Adjustment Modal */}
      <ManualAttendanceModal
        isOpen={isManualAttendanceOpen}
        onClose={() => {
          setIsManualAttendanceOpen(false);
          setManualAttendanceInitialStatus(null);
        }}
        recordToEdit={attendanceToEdit}
        initialStatus={manualAttendanceInitialStatus}
      />

      {/* Shift Assign Modal */}
      <ShiftAssignModal
        employee={shiftAssignEmployee}
        isOpen={!!shiftAssignEmployee}
        onClose={() => setShiftAssignEmployee(null)}
      />

      {/* Shift Add/Create Form Modal */}
      <ShiftFormModal
        isOpen={isShiftFormOpen}
        onClose={() => setIsShiftFormOpen(false)}
      />

      {/* Official Payslip Voucher Modal */}
      <PayslipModal
        payroll={selectedPayroll}
        isOpen={!!selectedPayroll}
        onClose={() => setSelectedPayroll(null)}
      />

      {/* Generate Payroll Batch Modal */}
      <GeneratePayrollModal
        isOpen={isGeneratePayrollOpen}
        onClose={() => setIsGeneratePayrollOpen(false)}
      />

      {/* Confirmation Dialog for Delete Employee */}
      <ConfirmDialog
        isOpen={!!employeeToDelete}
        onClose={() => setEmployeeToDelete(null)}
        onConfirm={() => {
          if (employeeToDelete) {
            deleteEmployee(employeeToDelete.id);
          }
        }}
        title="Delete Employee Profile"
        message={`Are you sure you want to permanently delete the profile for ${employeeToDelete?.fullName}? All associated shift assignments and historical attendance will also be archived.`}
        confirmLabel="Delete Employee"
        isDestructive={true}
      />

      {/* Confirmation Dialog for Delete Department */}
      <ConfirmDialog
        isOpen={!!departmentToDelete}
        onClose={() => setDepartmentToDelete(null)}
        onConfirm={() => {
          if (departmentToDelete) {
            deleteDepartment(departmentToDelete.id);
          }
        }}
        title="Delete Department Unit"
        message={`Are you sure you want to delete the ${departmentToDelete?.name} department? Departments with active assigned personnel cannot be deleted.`}
        confirmLabel="Delete Department"
        isDestructive={true}
      />

      {/* HR Exclusive Employee Login Modal */}
      <EmployeeLoginModal
        isOpen={isEmployeeLoginOpen}
        onClose={() => setIsEmployeeLoginOpen(false)}
        onSuccess={(sess) => {
          setEmployeeSession(sess);
          navigate('/hr/dashboard');
        }}
      />

      {/* HR Administrator Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={() => {
          clearEmployeeSession();
          navigate('/hr/dashboard');
        }}
      />
    </div>
  );
};

export const HRModule: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="Human Resources Management System">
      <ToastProvider>
        <AuthProvider>
          <HRMSProvider>
            <WorkAssignmentProvider>
              <HRLayoutContent />
            </WorkAssignmentProvider>
          </HRMSProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default HRModule;
