import { supabase } from '../lib/supabase';

export interface LogActivityParams {
  department: string;
  action: string;
  description: string;
  record_id?: string;
  record_name?: string;
  metadata?: any;
}

/**
 * Logs a user activity into the audit_logs table in Supabase.
 * Supports flexible signature: logActivity(department, action, description) or object parameter.
 */
export async function logActivity(
  departmentOrParams: string | LogActivityParams,
  actionArg?: string,
  descriptionArg?: string
): Promise<void> {
  try {
    let department = 'System';
    let action = 'Action';
    let description = '';
    let record_id: string | undefined;
    let record_name: string | undefined;
    let metadata: any = {};

    if (typeof departmentOrParams === 'object') {
      department = departmentOrParams.department;
      action = departmentOrParams.action;
      description = departmentOrParams.description;
      record_id = departmentOrParams.record_id;
      record_name = departmentOrParams.record_name;
      metadata = departmentOrParams.metadata || {};
    } else {
      department = departmentOrParams;
      action = actionArg || 'Action';
      description = descriptionArg || '';
    }

    let userName = 'admin@velmora.com';
    let userId: string | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        if (user.email) userName = user.email;
      } else {
        const storedUser = localStorage.getItem('velmora_active_user') || localStorage.getItem('active_account');
        if (storedUser) userName = storedUser;
      }
    } catch (e) {
      // Ignore auth error, fallback to default user
    }

    const isUuid = (str?: string) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validRecordId = isUuid(record_id) ? record_id : null;

    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      user_name: userName,
      user_role: userName === 'admin@velmora.com' ? 'Main Admin' : 'Admin',
      module: department,
      action: action,
      record_id: validRecordId,
      record_name: record_name || null,
      metadata: {
        description,
        ...metadata,
        ...(record_id && !validRecordId ? { numeric_record_id: record_id } : {})
      }
    });

    if (error) {
      console.error('Failed to write audit log:', error);
    }
  } catch (err) {
    console.error('Error occurred during activity logging:', err);
  }
}
