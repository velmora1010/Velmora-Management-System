import { supabase } from '../lib/supabase';

/**
 * Logs a user activity into the database.
 * This is a non-blocking operation that will swallow any errors and only log them to the console.
 */
export async function logActivity(department: string, action: string, description: string): Promise<void> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn('Cannot log activity: No authenticated user session found.', authError);
      return;
    }

    const { error } = await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_email: user.email,
      department,
      action,
      description
    });

    if (error) {
      console.error('Failed to write activity log:', error);
    }
  } catch (err) {
    console.error('Error occurred during activity logging:', err);
  }
}
