import { supabase } from '../lib/supabase';
import { notificationService } from './notificationService';
import { auditService } from './auditService';
import { 
  type AutomationEventType, 
  type AutomationRule, 
  type AutomationExecutionLog, 
  type EventContext,
  AUTOMATION_ACTION_TYPES 
} from '../types/automation';
import { DEFAULT_AUTOMATION_RULES } from '../config/automationDefaults';

let rulesCache: AutomationRule[] | null = null;
const activeProcessingEvents = new Set<string>();

export const workflowAutomationService = {
  // Clear rules memory cache
  clearCache() {
    rulesCache = null;
  },

  // Get active rules (with cache & DB fallback)
  async getRules(forceRefresh = false): Promise<AutomationRule[]> {
    if (!forceRefresh && rulesCache) {
      return rulesCache;
    }

    try {
      const { data, error } = await supabase.from('workflow_automation_rules').select('*');
      if (!error && data && data.length > 0) {
        rulesCache = data.map((r: any) => ({
          id: r.id || r.rule_id,
          name: r.name,
          description: r.description || '',
          event_type: r.event_type as AutomationEventType,
          is_enabled: r.is_enabled !== undefined ? r.is_enabled : true,
          actions: r.actions || []
        }));
        return rulesCache;
      }
    } catch (e) {
      console.warn('Error fetching workflow rules, using defaults:', e);
    }

    rulesCache = JSON.parse(JSON.stringify(DEFAULT_AUTOMATION_RULES));
    return rulesCache!;
  },

  // Toggle rule status
  async toggleRule(ruleId: string, isEnabled: boolean): Promise<boolean> {
    try {
      const rules = await this.getRules();
      const updated = rules.map(r => r.id === ruleId ? { ...r, is_enabled: isEnabled } : r);
      rulesCache = updated;

      await supabase.from('workflow_automation_rules').upsert(
        updated.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          event_type: r.event_type,
          is_enabled: r.is_enabled,
          actions: r.actions,
          updated_at: new Date().toISOString()
        })),
        { onConflict: 'id' }
      );
      return true;
    } catch (e) {
      return false;
    }
  },

  // MAIN EVENT EMITTER (Non-blocking, Asynchronous, Loop-Protected)
  emitEvent(eventType: AutomationEventType, context: EventContext): void {
    // 1. Loop Protection Check
    const loopKey = `${eventType}:${context.recordId || 'global'}`;
    if (activeProcessingEvents.has(loopKey)) {
      console.warn(`[Automation Engine] Loop prevented for event: ${loopKey}`);
      return;
    }

    // 2. Asynchronous Execution
    const processEvent = async () => {
      activeProcessingEvents.add(loopKey);
      try {
        const rules = await this.getRules();
        const matchingRules = rules.filter(r => r.event_type === eventType && r.is_enabled);

        for (const rule of matchingRules) {
          await this.executeRule(rule, context);
        }
      } catch (err) {
        console.warn(`[Automation Engine] Event processing error for ${eventType}:`, err);
      } finally {
        activeProcessingEvents.delete(loopKey);
      }
    };

    processEvent();
  },

  // Execute Rule Actions independently with isolated try/catch
  async executeRule(rule: AutomationRule, context: EventContext): Promise<void> {
    let failedAction: string | null = null;
    let errorMessage: string | null = null;

    const recordName = context.recordName || context.recordId || 'Record';

    for (const action of rule.actions) {
      try {
        // Evaluate templates
        const title = (action.titleTemplate || 'Automation Notice')
          .replace('{recordName}', recordName)
          .replace('{recordId}', context.recordId || '');

        const message = (action.messageTemplate || 'System automation event executed.')
          .replace('{recordName}', recordName)
          .replace('{recordId}', context.recordId || '');

        // Execute Action Type
        switch (action.type) {
          case AUTOMATION_ACTION_TYPES.CREATE_NOTIFICATION:
            notificationService.createNotification({
              userId: context.userId,
              title,
              message,
              module: action.targetModule || context.module,
              type: action.notificationType || 'info',
              recordId: context.recordId,
              route: action.targetRoute
            });
            break;

          case AUTOMATION_ACTION_TYPES.CREATE_AUDIT_LOG:
            auditService.logEvent({
              userId: context.userId,
              userEmail: context.userEmail,
              userRole: context.userRole,
              module: action.targetModule || context.module,
              action: action.auditAction || 'UPDATE',
              recordId: context.recordId,
              recordType: context.module,
              newData: context.details
            });
            break;

          case AUTOMATION_ACTION_TYPES.CREATE_FOLLOWUP_TASK:
            await supabase.from('Task_row').insert([{
              task_title: title,
              task_description: message,
              status: 'pending',
              priority: 'High',
              created_by: context.userId || null,
              created_at: new Date().toISOString()
            }]);
            break;

          case AUTOMATION_ACTION_TYPES.UPDATE_STATUS:
            // Generic status update action
            if (context.details?.targetTable && context.recordId && context.details?.newStatus) {
              await supabase
                .from(context.details.targetTable)
                .update({ status: context.details.newStatus })
                .eq('id', context.recordId);
            }
            break;

          default:
            break;
        }
      } catch (actionError: any) {
        // Independent action failure logging (does not break subsequent actions!)
        failedAction = action.type;
        errorMessage = actionError?.message || String(actionError);
        console.warn(`[Automation Engine] Action ${action.type} failed in rule ${rule.name}:`, actionError);
      }
    }

    // Record Execution Log
    await this.logExecution({
      event_type: rule.event_type,
      rule_id: rule.id,
      rule_name: rule.name,
      is_success: failedAction === null,
      failed_action: failedAction,
      error_message: errorMessage,
      context
    });
  },

  // Persist Execution Log to Supabase
  async logExecution(log: Omit<AutomationExecutionLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        event_type: log.event_type,
        rule_id: log.rule_id,
        rule_name: log.rule_name,
        is_success: log.is_success,
        failed_action: log.failed_action || null,
        error_message: log.error_message || null,
        context: log.context || null
      };

      const { error } = await supabase.from('workflow_execution_logs').insert([payload]);
      if (error) {
        // Fallback if table is named automation_execution_logs
        await supabase.from('automation_execution_logs').insert([payload]);
      }
    } catch (e) {
      console.warn('Execution logging error:', e);
    }
  },

  // Fetch Execution Logs for Admin Inspector
  async getExecutionLogs(page = 1, pageSize = 15): Promise<{ logs: AutomationExecutionLog[]; totalCount: number }> {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let { data, count, error } = await supabase
        .from('workflow_execution_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .range(from, to);

      if (error) {
        const fallbackRes = await supabase
          .from('automation_execution_logs')
          .select('*', { count: 'exact' })
          .order('timestamp', { ascending: false })
          .range(from, to);
        data = fallbackRes.data;
        count = fallbackRes.count;
      }

      if (!error && data) {
        return {
          logs: data as AutomationExecutionLog[],
          totalCount: count || data.length
        };
      }
    } catch (e) {
      console.warn('Error querying execution logs:', e);
    }

    return { logs: [], totalCount: 0 };
  }
};
