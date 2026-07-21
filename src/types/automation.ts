import type { AppModule } from './rbac';
import type { NotificationType } from './notification';
import type { AuditAction } from './audit';

export const AUTOMATION_EVENTS = {
  CAMPAIGN_CREATED: 'CAMPAIGN_CREATED',
  DISPATCH_COMPLETED: 'DISPATCH_COMPLETED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  EXPENSE_APPROVED: 'EXPENSE_APPROVED',
  BILL_DUE: 'BILL_DUE',
  PO_APPROVED: 'PO_APPROVED',
  STOCK_LOW: 'STOCK_LOW',
  PRODUCTION_COMPLETED: 'PRODUCTION_COMPLETED',
  QC_FAILED: 'QC_FAILED',
  ROLE_CHANGED: 'ROLE_CHANGED',
} as const;

export type AutomationEventType = typeof AUTOMATION_EVENTS[keyof typeof AUTOMATION_EVENTS];

export const AUTOMATION_ACTION_TYPES = {
  CREATE_NOTIFICATION: 'CREATE_NOTIFICATION',
  CREATE_AUDIT_LOG: 'CREATE_AUDIT_LOG',
  CREATE_FOLLOWUP_TASK: 'CREATE_FOLLOWUP_TASK',
  UPDATE_STATUS: 'UPDATE_STATUS',
} as const;

export type AutomationActionType = typeof AUTOMATION_ACTION_TYPES[keyof typeof AUTOMATION_ACTION_TYPES];

export interface AutomationActionPayload {
  type: AutomationActionType;
  notificationType?: NotificationType;
  auditAction?: AuditAction;
  titleTemplate?: string;
  messageTemplate?: string;
  targetModule?: AppModule | string;
  targetRoute?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  event_type: AutomationEventType;
  is_enabled: boolean;
  actions: AutomationActionPayload[];
}

export interface AutomationExecutionLog {
  id: string;
  timestamp: string;
  event_type: AutomationEventType;
  rule_id: string;
  rule_name: string;
  is_success: boolean;
  failed_action?: string | null;
  error_message?: string | null;
  context?: Record<string, any> | null;
}

export interface EventContext {
  recordId?: string | null;
  recordName?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  module: AppModule | string;
  details?: Record<string, any> | null;
}
