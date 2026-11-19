import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL || 'https://utusdosvijjuxtowzhta.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODQxOTIsImV4cCI6MjA5NzY2MDE5Mn0.o-1z11_1KgsosTre_gOzR2InF9MjXg6spKibo0Rv5oM';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

const isBrowser = typeof window !== 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
  }
});
