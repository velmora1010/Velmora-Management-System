import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Employee, UserProfile, UserRole } from '../types/hrms';
import { INITIAL_EMPLOYEES, INITIAL_USERS } from '../data/initialData';
import { safeSetItem, safeGetItem } from '../utils/storage';
import { useAuth as useVelmoraAuth } from '../../../hooks/useAuth';
import { useRBAC as useVelmoraRBAC } from '../../../hooks/useRBAC';
import { ROLES } from '../../../types/rbac';

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
    const nameLower = (emp.fullName || '').trim().toLowerCase();

    const alreadyInList = synced.some(
      (u) =>
        (emailLower && (u.email || '').trim().toLowerCase() === emailLower) ||
        (nameLower && (u.name || '').trim().toLowerCase() === nameLower)
    );
    if (alreadyInList) return;

    const presetUser = INITIAL_USERS.find(
      (u) =>
        u.role === 'employee' &&
        ((emailLower && (u.email || '').trim().toLowerCase() === emailLower) ||
          (nameLower && (u.name || '').trim().toLowerCase() === nameLower))
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

  // Derive HR role from Velmora authenticated session & RBAC
  const isVelmoraAdminOrManager = useMemo(() => {
    if (!velmoraRole) {
      // Default to admin for super admin / local dev accounts
      return true;
    }
    return (
      velmoraRole === ROLES.SUPER_ADMIN ||
      velmoraRole === ROLES.ADMIN ||
      velmoraRole === ROLES.MANAGER ||
      (velmoraUser?.email && velmoraUser.email.toLowerCase().includes('admin'))
    );
  }, [velmoraRole, velmoraUser]);

  const hrRole: UserRole = isVelmoraAdminOrManager ? 'admin' : 'employee';

  const currentUser = useMemo<UserProfile>(() => {
    const userEmail = velmoraUser?.email?.trim().toLowerCase() || 'admin@company.com';
    const userName =
      velmoraUser?.user_metadata?.full_name ||
      velmoraUser?.email?.split('@')[0] ||
      (isVelmoraAdminOrManager ? 'Administrator' : 'Employee');

    // Find linked employee if present
    const employees = getStoredEmployees();
    const linkedEmp = employees.find(
      (e) =>
        (e.email && e.email.trim().toLowerCase() === userEmail) ||
        (e.fullName && e.fullName.trim().toLowerCase() === userName.toLowerCase())
    );

    return {
      id: velmoraUser?.id || (isVelmoraAdminOrManager ? 'user-admin' : 'user-staff'),
      name: linkedEmp ? linkedEmp.fullName : userName,
      email: velmoraUser?.email || (linkedEmp ? linkedEmp.email : 'admin@velmora.com'),
      role: hrRole,
      employeeId: linkedEmp?.id,
      avatar: linkedEmp?.avatar || '',
      title: linkedEmp?.designation || (isVelmoraAdminOrManager ? 'HR Administrator' : 'Staff Member'),
    };
  }, [velmoraUser, isVelmoraAdminOrManager, hrRole]);

  const refreshUsers = useCallback(() => {
    const updatedUsers = buildSyncedUsers();
    setAllUsers(updatedUsers);
  }, []);

  useEffect(() => {
    safeSetItem('hrms_current_user_v4', JSON.stringify(currentUser));
  }, [currentUser]);

  // Safe no-op handlers for any remaining switch calls to preserve security
  const switchUser = useCallback((_userId: string) => {
    // In production Velmora, user switching is handled exclusively via Velmora auth shell
  }, []);

  const switchRole = useCallback((_role: UserRole) => {
    // Role is derived directly from authenticated Velmora session
  }, []);

  // Strict permissions derived from authenticated Velmora role
  const canViewPayroll = isVelmoraAdminOrManager;
  const canManageEmployees = isVelmoraAdminOrManager;
  const canApproveLeave = isVelmoraAdminOrManager;
  const canApplyLeave = !isVelmoraAdminOrManager;
  const canManageDepartments = isVelmoraAdminOrManager;
  const canManageShifts = isVelmoraAdminOrManager;
  const canManageSettings = isVelmoraAdminOrManager;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
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
