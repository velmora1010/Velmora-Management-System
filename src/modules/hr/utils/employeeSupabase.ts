import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  process.env.VITE_SUPABASE_URL ||
  'https://utusdosvijjuxtowzhta.supabase.co';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODQxOTIsImV4cCI6MjA5NzY2MDE5Mn0.o-1z11_1KgsosTre_gOzR2InF9MjXg6spKibo0Rv5oM';

/**
 * Dedicated Supabase client for Employee Authentication inside Human Resources.
 * Uses an isolated auth storageKey to guarantee that employee sessions never
 * conflict with or overwrite the main Velmora Administrator session.
 */
export const employeeSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'hr_employee_supabase_auth_token_v1',
    persistSession: true,
    autoRefreshToken: true,
  },
});
