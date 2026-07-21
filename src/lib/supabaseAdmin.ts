import { createClient } from '@supabase/supabase-js';

// Admin client with service_role key — bypasses Row Level Security (RLS).
// persistSession: false prevents the client from using the browser's
// stored auth session, which would override the service_role key
// with the user's authenticated role (still blocked by RLS).
export const supabaseAdmin = createClient(
  'https://utusdosvijjuxtowzhta.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);
