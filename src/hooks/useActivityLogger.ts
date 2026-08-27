import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

/**
 * Custom React hook for logging user activity.
 * Synchronously retrieves the logged-in user from AuthContext and inserts logs.
 * All errors are caught internally to prevent disruption of business workflows.
 */
export const useActivityLogger = () => {
  const { user } = useAuth();

  const logActivity = async (department: string, action: string, description: string): Promise<void> => {
    if (!user) {
      console.warn('Cannot log activity in hook: No active user session found.');
      return;
    }

    try {
      const { error } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_email: user.email,
        department,
        action,
        description
      });

      if (error) {
        console.error('Failed to write activity log in hook:', error);
      }
    } catch (err) {
      console.error('Error occurred during activity logging in hook:', err);
    }
  };

  return { logActivity };
};
