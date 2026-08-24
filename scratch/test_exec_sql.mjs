import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

global.WebSocket = WebSocket;

const supabaseUrl = 'https://utusdosvijjuxtowzhta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function run() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { 
      query_text: 'SELECT 1;' 
    });
    console.log('Result for exec_sql:', { data, error });
  } catch (err) {
    console.error('Catch error:', err);
  }
}

run();
