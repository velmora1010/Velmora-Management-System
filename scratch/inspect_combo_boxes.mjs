import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read env variables
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/(^["']|["']$)/g, '');
    envVars[key] = value;
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

async function inspect() {
  const { data, error } = await supabase.from('combo_boxes').select('*').limit(1);
  if (error) {
    console.error('Error fetching combo boxes:', error);
  } else {
    console.log('Combo boxes schema/row sample:', data);
  }
}

inspect();
