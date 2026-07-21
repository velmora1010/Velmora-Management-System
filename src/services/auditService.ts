import { supabase } from '../lib/supabase';
import { AUDIT_ACTIONS, type AuditAction, type AuditLogRecord, type AuditFilters, type PaginatedAuditResult } from '../types/audit';
import type { AppModule } from '../types/rbac';

interface LogEventParams {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  module: AppModule | string;
  action: AuditAction;
  recordId?: string | null;
  recordType?: string | null;
  previousData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export const auditService = {
  // Low-level non-blocking fire-and-forget logger
  logEvent(params: LogEventParams): void {
    // Execute asynchronously; catch all errors internally so caller is never blocked
    const performAudit = async () => {
      try {
        const timestamp = new Date().toISOString();
        const browserDevice = typeof navigator !== 'undefined' ? navigator.userAgent : 'Server/Unknown';

        const payload = {
          timestamp,
          user_id: params.userId || null,
          module: params.module,
          action: params.action,
          record_id: params.recordId ? String(params.recordId) : null,
          record_type: params.recordType || params.module,
          previous_data: params.previousData || null,
          new_data: params.newData || null,
          metadata: {
            user_email: params.userEmail || null,
            user_name: params.userName || null,
            user_role: params.userRole || null,
            browser_device: browserDevice,
            ...(params.metadata || {})
          }
        };

        const { error } = await supabase.from('audit_logs').insert([payload]);
        if (error) {
          console.warn('Audit logging DB insert failed (non-fatal):', error.message);
        }
      } catch (err) {
        console.warn('Unexpected error in auditService.logEvent (non-fatal):', err);
      }
    };

    performAudit();
  },

  // Helper Logging Methods
  logCreate(params: Omit<LogEventParams, 'action'>) {
    this.logEvent({ ...params, action: AUDIT_ACTIONS.CREATE });
  },

  logUpdate(params: Omit<LogEventParams, 'action'>) {
    this.logEvent({ ...params, action: AUDIT_ACTIONS.UPDATE });
  },

  logDelete(params: Omit<LogEventParams, 'action'>) {
    this.logEvent({ ...params, action: AUDIT_ACTIONS.DELETE });
  },

  logArchive(params: Omit<LogEventParams, 'action'>) {
    this.logEvent({ ...params, action: AUDIT_ACTIONS.ARCHIVE });
  },

  logRestore(params: Omit<LogEventParams, 'action'>) {
    this.logEvent({ ...params, action: AUDIT_ACTIONS.RESTORE });
  },

  logApprove(params: Omit<LogEventParams, 'action'>) {
    this.logEvent({ ...params, action: AUDIT_ACTIONS.APPROVE });
  },

  logReject(params: Omit<LogEventParams, 'action'>) {
    this.logEvent({ ...params, action: AUDIT_ACTIONS.REJECT });
  },

  logLogin(params: Omit<LogEventParams, 'action' | 'module'>) {
    this.logEvent({ ...params, module: 'auth', action: AUDIT_ACTIONS.LOGIN });
  },

  logLogout(params: Omit<LogEventParams, 'action' | 'module'>) {
    this.logEvent({ ...params, module: 'auth', action: AUDIT_ACTIONS.LOGOUT });
  },

  logRoleChange(params: Omit<LogEventParams, 'action'>) {
    this.logEvent({ ...params, action: AUDIT_ACTIONS.ROLE_CHANGE });
  },

  logStatusChange(params: Omit<LogEventParams, 'action'>) {
    this.logEvent({ ...params, action: AUDIT_ACTIONS.STATUS_CHANGE });
  },

  // Server-side Paginated Query Handler
  async getAuditLogs(
    filters: AuditFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedAuditResult> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false });

      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.module) {
        query = query.eq('module', filters.module);
      }
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.startDate) {
        query = query.gte('timestamp', new Date(filters.startDate).toISOString());
      }
      if (filters.endDate) {
        query = query.lte('timestamp', new Date(filters.endDate).toISOString());
      }

      // Range offset for server-side pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query.range(from, to);

      if (error) {
        console.warn('Error querying audit_logs:', error.message);
        return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
      }

      let records = (data || []).map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp || r.created_at || new Date().toISOString(),
        user_id: r.user_id || null,
        module: r.module || r.target_table || 'system',
        action: (r.action as AuditAction) || AUDIT_ACTIONS.UPDATE,
        record_id: r.record_id || null,
        record_type: r.record_type || r.target_table || null,
        previous_data: r.previous_data || null,
        new_data: r.new_data || r.details || null,
        metadata: r.metadata || { user_email: r.user_email }
      })) as AuditLogRecord[];

      // Client-side text search filtering if search term present
      if (filters.search && filters.search.trim() !== '') {
        const term = filters.search.toLowerCase().trim();
        records = records.filter(r => 
          String(r.module).toLowerCase().includes(term) ||
          String(r.action).toLowerCase().includes(term) ||
          String(r.record_id).toLowerCase().includes(term) ||
          String(r.metadata?.user_name || '').toLowerCase().includes(term) ||
          String(r.metadata?.user_email || '').toLowerCase().includes(term)
        );
      }

      const total = count !== null ? count : records.length;
      const totalPages = Math.ceil(total / pageSize) || 1;

      return {
        data: records,
        totalCount: total,
        page,
        pageSize,
        totalPages
      };
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }
  }
};
