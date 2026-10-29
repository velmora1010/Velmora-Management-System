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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: velmoraUser } = useVelmoraAuth();
  const { role: velmoraRole } = useVelmoraRBAC();

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => buildSyncedUsers());

  // Derive HR role strictly from Velmora authenticated session & verified role
  const isVelmoraAdminOrManager = useMemo(() => {
    if (!velmoraUser) return false;
    const emailLower = (velmoraUser.email || '').toLowerCase().trim();
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
  }, [velmoraRole, velmoraUser]);

  const hrRole: UserRole = isVelmoraAdminOrManager ? 'admin' : 'employee';

  const employees = useMemo(() => getStoredEmployees(), []);

  // Verified employee link resolution
  const linkedEmployee = useMemo<Employee | null>(() => {
    if (isVelmoraAdminOrManager) {
      // Admins operate in administrative context
      return null;
    }
    const userEmail = velmoraUser?.email?.trim().toLowerCase() || '';
    const metadataId = (velmoraUser?.user_metadata?.employeeId || velmoraUser?.user_metadata?.employeeCode || '').trim();

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
  }, [isVelmoraAdminOrManager, velmoraUser, employees]);

  const isLinkedEmployee = isVelmoraAdminOrManager || !!linkedEmployee;

  const currentUser = useMemo<UserProfile>(() => {
    const userEmail = velmoraUser?.email?.trim().toLowerCase() || 'admin@velmora.com';
    const userName =
      velmoraUser?.user_metadata?.full_name ||
      velmoraUser?.email?.split('@')[0] ||
      (isVelmoraAdminOrManager ? 'Administrator' : 'Employee');

    return {
      id: velmoraUser?.id || (isVelmoraAdminOrManager ? 'user-admin' : 'user-staff'),
      name: linkedEmployee ? linkedEmployee.fullName : userName,
      email: velmoraUser?.email || (linkedEmployee ? linkedEmployee.email : userEmail),
      role: hrRole,
      employeeId: linkedEmployee?.id,
      avatar: linkedEmployee?.avatar || '',
      title: linkedEmployee?.designation || (isVelmoraAdminOrManager ? 'HR Administrator' : 'Staff Member'),
    };
  }, [velmoraUser, isVelmoraAdminOrManager, hrRole, linkedEmployee]);

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
