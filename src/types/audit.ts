import type { AppModule } from './rbac';

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ARCHIVE: 'ARCHIVE',
  RESTORE: 'RESTORE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  ROLE_CHANGE: 'ROLE_CHANGE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  EXPORT_PDF: 'EXPORT_PDF',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  user_id: string | null;
  module: AppModule | string;
  action: AuditAction;
  record_id: string | null;
  record_type: string | null;
  previous_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  metadata: Record<string, any> | null;
}

export interface AuditFilters {
  user_id?: string;
  module?: string;
  action?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedAuditResult {
  data: AuditLogRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
