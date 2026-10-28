import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HRMSProvider, useHRMS } from './context/HRMSContext';
import { Sidebar, NavigationTab } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { findLinkedEmployee } from './utils/employeeIdentity';

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
import { WorkAssignmentProvider } from './context/WorkAssignmentContext';

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

const VALID_TABS: NavigationTab[] = [
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

const getTabFromLocation = (): NavigationTab => {
  if (typeof window === 'undefined') return 'dashboard';
  const path = window.location.pathname.replace(/^\/+/, '').split('/')[0].trim().toLowerCase();
  if (VALID_TABS.includes(path as NavigationTab)) {
    return path as NavigationTab;
  }
  const hash = window.location.hash.replace(/^#\/?/, '').split('/')[0].trim().toLowerCase();
  if (VALID_TABS.includes(hash as NavigationTab)) {
    return hash as NavigationTab;
  }
  return 'dashboard';
};

const resolveRolePermittedTab = (tab: NavigationTab, canManageEmployees: boolean): NavigationTab => {
  if (canManageEmployees && tab === 'assigned-works') {
    return 'work-assignment';
  }
  if (!canManageEmployees && tab === 'work-assignment') {
    return 'assigned-works';
  }
  if (!canManageEmployees && tab === 'employee-welfare') {
    return 'employees';
  }
  return tab;
};

const HRMSAppContent: React.FC = () => {
  const { employees, deleteEmployee, deleteDepartment } = useHRMS();
  const { currentUser, canManageEmployees } = useAuth();
  const { showToast } = useToast();

  // Navigation State with immediate role-aware URL resolution
  const [currentTab, setCurrentTab] = useState<NavigationTab>(() =>
    resolveRolePermittedTab(getTabFromLocation(), canManageEmployees)
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const effectiveTab = resolveRolePermittedTab(currentTab, canManageEmployees);

  // Sync browser URL whenever effectiveTab changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentPath = window.location.pathname.replace(/^\/+/, '').split('/')[0].trim().toLowerCase();
    const expectedPath = effectiveTab === 'dashboard' ? '' : effectiveTab;
    if (currentPath !== expectedPath) {
      window.history.replaceState(null, '', effectiveTab === 'dashboard' ? '/' : `/${effectiveTab}`);
    }
  }, [effectiveTab]);

  // Handle browser back and forward navigation with role enforcement
  useEffect(() => {
    const handlePopState = () => {
      const rawTab = getTabFromLocation();
      const permittedTab = resolveRolePermittedTab(rawTab, canManageEmployees);
      setCurrentTab(permittedTab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [canManageEmployees]);

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

  // Redirect restricted routes based on role when account or tab changes
  useEffect(() => {
    if (!canManageEmployees && currentTab === 'employee-welfare') {
      setCurrentTab('employees');
      const ownEmp = findLinkedEmployee(currentUser, employees);
      if (ownEmp) {
        setEmployeeDetailInitialTab('product_select');
        setSelectedEmployee(ownEmp);
      }
    } else if (!canManageEmployees && currentTab === 'work-assignment') {
      setCurrentTab('assigned-works');
    } else if (canManageEmployees && currentTab === 'assigned-works') {
      setCurrentTab('work-assignment');
    }
  }, [canManageEmployees, currentTab, currentUser, employees]);

  const handleNavigateTab = useCallback(
    (tab: NavigationTab) => {
      if (tab === 'employee-welfare' && !canManageEmployees) {
        setCurrentTab('employees');
        handleOpenMyProfileProductSelect();
        return;
      }
      if (tab === 'work-assignment' && !canManageEmployees) {
        setCurrentTab('assigned-works');
        return;
      }
      if (tab === 'assigned-works' && canManageEmployees) {
        setCurrentTab('work-assignment');
        return;
      }
      setCurrentTab(tab);
    },
    [canManageEmployees, handleOpenMyProfileProductSelect]
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

  return (
    <div className="flex min-h-screen bg-[#F6F8FC] text-[#172B4D]">
      {/* Collapsible Left Sidebar */}
      <Sidebar
        currentTab={effectiveTab}
        onSelectTab={handleNavigateTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation */}
        <TopNav
          currentTab={effectiveTab}
          onNavigateTab={handleNavigateTab}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenCheckIn={() => setIsCheckInOpen(true)}
          onOpenMyProfile={handleOpenMyProfile}
          onOpenMyProfileProductSelect={handleOpenMyProfileProductSelect}
        />

        {/* Dynamic Module Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {effectiveTab === 'dashboard' && (
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
          )}

          {effectiveTab === 'employees' && (
            <EmployeeDirectory
              onSelectEmployee={handleSelectEmployee}
              onAddEmployee={() => {
                if (!canManageEmployees) return;
                setEmployeeToEdit(null);
                setIsEmployeeFormOpen(true);
              }}
              onEditEmployee={(emp) => {
                if (!canManageEmployees) return;
                setEmployeeToEdit(emp);
                setIsEmployeeFormOpen(true);
              }}
              onDeleteEmployee={(emp) => {
                if (!canManageEmployees) return;
                setEmployeeToDelete(emp);
              }}
            />
          )}

          {effectiveTab === 'attendance' && (
            <AttendanceModule
              onOpenCheckIn={() => setIsCheckInOpen(true)}
              onOpenManualEntry={(rec, initialStatus) => {
                setAttendanceToEdit(rec || null);
                setManualAttendanceInitialStatus(initialStatus || null);
                setIsManualAttendanceOpen(true);
              }}
              onSelectEmployee={handleSelectEmployee}
            />
          )}

          {effectiveTab === 'departments' && (
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
          )}

          {effectiveTab === 'leave' && (
            <LeaveModule
              onOpenApplyLeave={() => setIsApplyLeaveOpen(true)}
              onSelectLeave={(leave) => setSelectedLeave(leave)}
            />
          )}

          {effectiveTab === 'shifts' && (
            <ShiftModule
              onOpenAssignShift={(emp) => setShiftAssignEmployee(emp)}
              onSelectEmployee={handleSelectEmployee}
              onOpenAddShift={() => setIsShiftFormOpen(true)}
            />
          )}

          {effectiveTab === 'work-assignment' && canManageEmployees && <WorkAssignmentModule />}

          {effectiveTab === 'assigned-works' && !canManageEmployees && <AssignedWorksModule />}

          {effectiveTab === 'employee-welfare' && canManageEmployees && <EmployeeWelfareModule />}

          {effectiveTab === 'payroll' && (
            <PayrollModule
              onOpenGeneratePayroll={() => setIsGeneratePayrollOpen(true)}
              onSelectPayroll={(rec) => setSelectedPayroll(rec)}
            />
          )}

          {effectiveTab === 'reports' && <ReportsModule />}

          {effectiveTab === 'settings' && <SettingsModule />}
        </main>
      </div>

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
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary fallbackTitle="Human Resources Management System">
      <ToastProvider>
        <AuthProvider>
          <HRMSProvider>
            <WorkAssignmentProvider>
              <HRMSAppContent />
            </WorkAssignmentProvider>
          </HRMSProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
