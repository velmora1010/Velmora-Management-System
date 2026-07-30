import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) envVars[key.trim()] = vals.join('=').trim();
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAddColumn() {
  // Attempt to call rpc execute_sql if present
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE public.product_barcodes ADD COLUMN IF NOT EXISTS scan_code text;' });
  if (error) {
    console.log("exec_sql rpc error:", error.message);
  } else {
    console.log("exec_sql rpc success:", data);
  }
}

testAddColumn();
