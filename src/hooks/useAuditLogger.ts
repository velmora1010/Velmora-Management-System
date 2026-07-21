import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { auditService } from '../services/auditService';
import type { AuditAction } from '../types/audit';
import type { AppModule } from '../types/rbac';

export const useAuditLogger = () => {
  const { user } = useAuth();

  const logAction = useCallback((
    action: AuditAction,
    targetModule: AppModule | string,
    recordId?: string,
    newData?: Record<string, any>,
    previousData?: Record<string, any>
  ) => {
    auditService.logEvent({
      userId: user?.id,
      userEmail: user?.email,
      module: targetModule,
      action,
      recordId,
      newData,
      previousData
    });
  }, [user]);

  return { logAction };
};
