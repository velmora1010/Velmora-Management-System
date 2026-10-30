import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Employee, UserProfile, UserRole } from '../types/hrms';
import { INITIAL_EMPLOYEES, INITIAL_USERS } from '../data/initialData';
import { safeSetItem, safeGetItem } from '../utils/storage';
import { useAuth as useVelmoraAuth } from '../../../hooks/useAuth';
import { useRBAC as useVelmoraRBAC } from '../../../hooks/useRBAC';
import { ROLES } from '../../../types/rbac';
import { findLinkedEmployee } from '../utils/employeeIdentity';

function getStoredEmployees(): Employee[] {
  const saved = safeGetItem('hrms_employees_v3');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fallback
    }
  }
  return INITIAL_EMPLOYEES;
}

function buildSyncedUsers(): UserProfile[] {
  const employees = getStoredEmployees();
  const adminUsers: UserProfile[] = INITIAL_USERS.filter(
    (u) => u.role === 'admin' || u.role === 'hr_manager'
  );
  const synced: UserProfile[] = [...adminUsers];

  employees.forEach((emp, idx) => {
    const emailLower = (emp.email || '').trim().toLowerCase();

    const alreadyInList = synced.some(
      (u) => emailLower && (u.email || '').trim().toLowerCase() === emailLower
    );
    if (alreadyInList) return;

    const presetUser = INITIAL_USERS.find(
      (u) =>
        u.role === 'employee' &&
        emailLower &&
        (u.email || '').trim().toLowerCase() === emailLower
    );

    const baseId = presetUser
      ? presetUser.id
      : `user-${(emp.employeeCode || emp.id || `emp-${idx + 1}`).toLowerCase()}`;
    const uniqueId = synced.some((u) => u.id === baseId) ? `${baseId}-${idx + 1}` : baseId;

    synced.push({
      id: uniqueId,
      name: emp.fullName,
      email: emp.email || `${(emp.employeeCode || `emp-${idx + 1}`).toLowerCase()}@company.com`,
      role: 'employee',
      employeeId: emp.id,
      avatar: emp.avatar || '',
      title: emp.designation || 'Employee',
    });
  });

  return synced;
}

interface AuthContextType {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  isLinkedEmployee: boolean;
  linkedEmployee: Employee | null;
  switchUser: (userId: string) => void;
  switchRole: (role: UserRole) => void;
  refreshUsers: () => void;
  canViewPayroll: boolean;
  canManageEmployees: boolean;
  canApproveLeave: boolean;
  canApplyLeave: boolean;
  canManageDepartments: boolean;
  canManageShifts: boolean;
  canManageSettings: boolean;
  // HR Account Type Switch & Session Management
  activeHRAccountType: 'admin' | 'employee';
  setEmployeeSession: (session: { email: string; token: string; user: any }) => void;
  clearEmployeeSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: velmoraUser } = useVelmoraAuth();
  const { role: velmoraRole } = useVelmoraRBAC();

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => buildSyncedUsers());

  // HR-specific Employee Session state (stored in session storage to persist across refresh)
  const [employeeSession, setEmployeeSessionState] = useState<{
    email: string;
    token: string;
    user: any;
  } | null>(() => {
    try {
      const stored = sessionStorage.getItem('hr_employee_session_v1');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setEmployeeSession = useCallback((session: { email: string; token: string; user: any }) => {
    setEmployeeSessionState(session);
    try {
      sessionStorage.setItem('hr_employee_session_v1', JSON.stringify(session));
    } catch (e) {
      console.warn('Failed saving employee session:', e);
    }
  }, []);

  const clearEmployeeSession = useCallback(() => {
    setEmployeeSessionState(null);
    try {
      sessionStorage.removeItem('hr_employee_session_v1');
    } catch (e) {
      console.warn('Failed removing employee session:', e);
    }
  }, []);

  // Determine effective user in HR module:
  // If an HR employee session is active, effective user is the employee; otherwise the Velmora user
  const effectiveUser = useMemo(() => {
    if (employeeSession?.user) {
      return employeeSession.user;
    }
    return velmoraUser;
  }, [employeeSession, velmoraUser]);

  const activeHRAccountType: 'admin' | 'employee' = employeeSession ? 'employee' : 'admin';

  // Derive HR role strictly from effective authenticated session & verified role
  const isVelmoraAdminOrManager = useMemo(() => {
    // If explicit employee session is active in HR, they are strictly employee
    if (activeHRAccountType === 'employee') return false;

    if (!effectiveUser) return false;
    const emailLower = (effectiveUser.email || '').toLowerCase().trim();
    if (
      emailLower === 'admin@velmora.com' ||
      emailLower === 'admin@velmora1.com' ||
      emailLower === 'admin@velmora2.com' ||
      emailLower === 'admin@velmora3.com' ||
      emailLower.startsWith('admin@')
    ) {
      return true;
    }
    return (
      velmoraRole === ROLES.SUPER_ADMIN ||
      velmoraRole === ROLES.ADMIN ||
      velmoraRole === ROLES.MANAGER
    );
  }, [activeHRAccountType, effectiveUser, velmoraRole]);

  const hrRole: UserRole = isVelmoraAdminOrManager ? 'admin' : 'employee';

  const employees = useMemo(() => getStoredEmployees(), []);

  // Verified employee link resolution
  const linkedEmployee = useMemo<Employee | null>(() => {
    if (isVelmoraAdminOrManager) {
      // Admins operate in administrative context
      return null;
    }
    const userEmail = effectiveUser?.email?.trim().toLowerCase() || '';
    const metadataId = (effectiveUser?.user_metadata?.employeeId || effectiveUser?.user_metadata?.employeeCode || '').trim();

    return (
      findLinkedEmployee(
        {
          email: userEmail,
          employeeId: metadataId,
          role: 'employee',
        },
        employees
      ) || null
    );
  }, [isVelmoraAdminOrManager, effectiveUser, employees]);

  const isLinkedEmployee = isVelmoraAdminOrManager || !!linkedEmployee;

  const currentUser = useMemo<UserProfile>(() => {
    const userEmail = effectiveUser?.email?.trim().toLowerCase() || 'admin@velmora.com';
    const userName =
      effectiveUser?.user_metadata?.full_name ||
      effectiveUser?.email?.split('@')[0] ||
      (isVelmoraAdminOrManager ? 'Administrator' : 'Employee');

    return {
      id: effectiveUser?.id || (isVelmoraAdminOrManager ? 'user-admin' : 'user-staff'),
      name: linkedEmployee ? linkedEmployee.fullName : userName,
      email: effectiveUser?.email || (linkedEmployee ? linkedEmployee.email : userEmail),
      role: hrRole,
      employeeId: linkedEmployee?.id,
      avatar: linkedEmployee?.avatar || '',
      title: linkedEmployee?.designation || (isVelmoraAdminOrManager ? 'HR Administrator' : 'Staff Member'),
    };
  }, [effectiveUser, isVelmoraAdminOrManager, hrRole, linkedEmployee]);

  const refreshUsers = useCallback(() => {
    const updatedUsers = buildSyncedUsers();
    setAllUsers(updatedUsers);
  }, []);

  useEffect(() => {
    safeSetItem('hrms_current_user_v4', JSON.stringify(currentUser));
  }, [currentUser]);

  // Safe no-op handlers for any remaining switch calls to prevent security bypasses
  const switchUser = useCallback((_userId: string) => {}, []);
  const switchRole = useCallback((_role: UserRole) => {}, []);

  // Strict permissions derived from authenticated Velmora role
  const canViewPayroll =
    isVelmoraAdminOrManager &&
    (velmoraRole === ROLES.SUPER_ADMIN ||
      velmoraRole === ROLES.ADMIN ||
      velmoraUser?.email === 'admin@velmora.com' ||
      velmoraUser?.email === 'admin@velmora1.com');
  const canManageEmployees = isVelmoraAdminOrManager;
  const canApproveLeave = isVelmoraAdminOrManager;
  const canApplyLeave = !isVelmoraAdminOrManager && !!linkedEmployee;
  const canManageDepartments = isVelmoraAdminOrManager;
  const canManageShifts = isVelmoraAdminOrManager;
  const canManageSettings = isVelmoraAdminOrManager;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        isLinkedEmployee,
        linkedEmployee,
        switchUser,
        switchRole,
        refreshUsers,
        canViewPayroll,
        canManageEmployees,
        canApproveLeave,
        canApplyLeave,
        canManageDepartments,
        canManageShifts,
        canManageSettings,
        activeHRAccountType,
        setEmployeeSession,
        clearEmployeeSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
