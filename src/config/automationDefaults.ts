import { AUTOMATION_EVENTS, AUTOMATION_ACTION_TYPES, type AutomationRule } from '../types/automation';

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'rule-qc-failed',
    name: 'QC Inspection Failure Handler',
    description: 'Auto-triggers urgent Error Notification, Audit Log, and creates a follow-up Task on QC failure.',
    event_type: AUTOMATION_EVENTS.QC_FAILED,
    is_enabled: true,
    actions: [
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_NOTIFICATION,
        notificationType: 'error',
        titleTemplate: 'Urgent: QC Inspection Failed',
        messageTemplate: 'Barcode {recordName} failed quality control check.',
        targetModule: 'quality_control',
        targetRoute: '/inventory/quality-check'
      },
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_AUDIT_LOG,
        auditAction: 'REJECT',
        targetModule: 'quality_control'
      },
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_FOLLOWUP_TASK,
        titleTemplate: 'Investigate QC Failure: {recordName}',
        messageTemplate: 'Follow-up inspection required for barcode {recordName}.',
        targetModule: 'tasks'
      }
    ]
  },
  {
    id: 'rule-po-approved',
    name: 'Purchase Order Approval Handler',
    description: 'Auto-triggers Success Notification and Audit Log entry when a PO is approved.',
    event_type: AUTOMATION_EVENTS.PO_APPROVED,
    is_enabled: true,
    actions: [
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_NOTIFICATION,
        notificationType: 'success',
        titleTemplate: 'PO Approved',
        messageTemplate: 'Purchase Order #{recordName} has been approved.',
        targetModule: 'purchase_orders',
        targetRoute: '/purchase-orders'
      },
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_AUDIT_LOG,
        auditAction: 'APPROVE',
        targetModule: 'purchase_orders'
      }
    ]
  },
  {
    id: 'rule-campaign-created',
    name: 'Marketing Campaign Initializer',
    description: 'Auto-triggers Notification and Audit Log entry when a new marketing campaign is created.',
    event_type: AUTOMATION_EVENTS.CAMPAIGN_CREATED,
    is_enabled: true,
    actions: [
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_NOTIFICATION,
        notificationType: 'success',
        titleTemplate: 'New Campaign Created',
        messageTemplate: 'Campaign "{recordName}" has been initialized.',
        targetModule: 'marketing',
        targetRoute: '/marketing'
      },
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_AUDIT_LOG,
        auditAction: 'CREATE',
        targetModule: 'marketing'
      }
    ]
  },
  {
    id: 'rule-stock-low',
    name: 'Inventory Low Stock Warning',
    description: 'Auto-triggers Warning Notification and Audit Log when stock falls below minimum threshold.',
    event_type: AUTOMATION_EVENTS.STOCK_LOW,
    is_enabled: true,
    actions: [
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_NOTIFICATION,
        notificationType: 'warning',
        titleTemplate: 'Low Stock Alert',
        messageTemplate: 'Raw material "{recordName}" stock is low.',
        targetModule: 'inventory',
        targetRoute: '/inventory/dashboard'
      },
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_AUDIT_LOG,
        auditAction: 'UPDATE',
        targetModule: 'inventory'
      }
    ]
  },
  {
    id: 'rule-task-completed',
    name: 'Task Completion Handler',
    description: 'Auto-triggers Notification and Audit Log when a task is completed.',
    event_type: AUTOMATION_EVENTS.TASK_COMPLETED,
    is_enabled: true,
    actions: [
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_NOTIFICATION,
        notificationType: 'info',
        titleTemplate: 'Task Completed',
        messageTemplate: 'Task "{recordName}" has been marked as complete.',
        targetModule: 'tasks',
        targetRoute: '/tasks'
      },
      {
        type: AUTOMATION_ACTION_TYPES.CREATE_AUDIT_LOG,
        auditAction: 'UPDATE',
        targetModule: 'tasks'
      }
    ]
  }
];
