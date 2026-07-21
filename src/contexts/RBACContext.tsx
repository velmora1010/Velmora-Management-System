import React, { createContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ROLES, ACTIONS, type AppRole, type AppModule, type PermissionAction, type ServiceActionResult } from '../types/rbac';
import { rbacService } from '../services/rbacService';

interface RBACContextType {
  role: AppRole;
  isEnabled: boolean;
  isLoading: boolean;
  hasPermission: (module: AppModule, action: PermissionAction) => boolean;
  canView: (module: AppModule) => boolean;
  canCreate: (module: AppModule) => boolean;
  canEdit: (module: AppModule) => boolean;
  canDelete: (module: AppModule) => boolean;
  canApprove: (module: AppModule) => boolean;
  canExport: (module: AppModule) => boolean;
  refreshPermissions: () => Promise<void>;
  executeGuardedAction: <T>(module: AppModule, action: PermissionAction, fn: () => Promise<T>) => Promise<ServiceActionResult<T>>;
}

export const RBACContext = createContext<RBACContextType | undefined>(undefined);

export const RBACProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole>(ROLES.SUPER_ADMIN);
  const [isEnabled, setIsEnabled] = useState(true);
  const [permissionMatrix, setPermissionMatrix] = useState<Record<AppRole, Record<AppModule, Record<PermissionAction, boolean>>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserPermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      if (user) {
        const profile = await rbacService.getUserRole(user.id, user.email);
        setRole(profile.role);
        setIsEnabled(profile.is_enabled);
      } else {
        setRole(ROLES.SUPER_ADMIN);
        setIsEnabled(true);
      }

      const matrix = await rbacService.getRolePermissionsMatrix();
      setPermissionMatrix(matrix);
    } catch (err) {
      console.error('Failed to load RBAC permissions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserPermissions();
  }, [loadUserPermissions]);

  const refreshPermissions = async () => {
    rbacService.clearCache();
    await loadUserPermissions();
  };

  const hasPermission = useCallback((module: AppModule, action: PermissionAction): boolean => {
    if (!isEnabled) return false;
    if (role === ROLES.SUPER_ADMIN) return true;
    if (!permissionMatrix) return true; // Safe fallback during initial hydration
    return Boolean(permissionMatrix[role]?.[module]?.[action]);
  }, [role, isEnabled, permissionMatrix]);

  const canView = useCallback((module: AppModule) => hasPermission(module, ACTIONS.VIEW), [hasPermission]);
  const canCreate = useCallback((module: AppModule) => hasPermission(module, ACTIONS.CREATE), [hasPermission]);
  const canEdit = useCallback((module: AppModule) => hasPermission(module, ACTIONS.EDIT), [hasPermission]);
  const canDelete = useCallback((module: AppModule) => hasPermission(module, ACTIONS.DELETE), [hasPermission]);
  const canApprove = useCallback((module: AppModule) => hasPermission(module, ACTIONS.APPROVE), [hasPermission]);
  const canExport = useCallback((module: AppModule) => hasPermission(module, ACTIONS.EXPORT), [hasPermission]);

  const executeGuardedAction = async <T,>(
    module: AppModule,
    action: PermissionAction,
    fn: () => Promise<T>
  ): Promise<ServiceActionResult<T>> => {
    if (!hasPermission(module, action)) {
      return {
        success: false,
        error: `Permission denied: Cannot perform '${action}' on '${module}'.`
      };
    }
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Execution error' };
    }
  };

  const value: RBACContextType = {
    role,
    isEnabled,
    isLoading,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canApprove,
    canExport,
    refreshPermissions,
    executeGuardedAction
  };

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
};
