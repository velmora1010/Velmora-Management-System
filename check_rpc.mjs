import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

global.WebSocket = WebSocket;

const supabaseUrl = 'https://utusdosvijjuxtowzhta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' });
  console.log('Result:', data);
  console.log('Error:', error);
}

testRpc();
