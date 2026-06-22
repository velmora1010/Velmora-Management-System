import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export const useAuditLogger = () => {
  const { user } = useAuth();

  const logAction = useCallback((
    action: 'CREATE' | 'UPDATE' | 'EXPORT_PDF' | 'LOGIN',
    targetTable: string,
    recordId?: string,
    details?: Record<string, unknown>
  ) => {
    // Non-blocking fire-and-forget
    // We don't await this, and we catch errors internally so it never crashes the app
    if (!user) return;

    const performAudit = async () => {
      try {
        const { error } = await supabase
          .from('audit_logs')
          .insert({
            user_id: user.id,
            user_email: user.email,
            action,
            target_table: targetTable,
            record_id: recordId || null,
            details: details || null
          });
          
        if (error) {
          console.error('Failed to write audit log (non-fatal):', error);
        }
      } catch (err) {
        console.error('Unexpected error in audit logger (non-fatal):', err);
      }
    };

    performAudit();
  }, [user]);

  return { logAction };
};
