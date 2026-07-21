import React from 'react';
import { useRBAC } from '../../hooks/useRBAC';
import type { AppModule, PermissionAction } from '../../types/rbac';

interface PermissionGuardProps {
  module: AppModule;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  disableOnly?: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  module,
  action,
  children,
  fallback = null,
  disableOnly = false,
}) => {
  const { hasPermission } = useRBAC();
  const allowed = hasPermission(module, action);

  if (!allowed) {
    if (disableOnly && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        disabled: true,
        title: `Permission denied (${action} in ${module})`,
        style: { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' },
      });
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
