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

async function checkAllTablesScanCode() {
  const tables = ['raw_material_barcodes', 'product_barcodes', 'combo_boxes', 'qc_barcodes'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table ${t} error:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`Table ${t} has scan_code?`, 'scan_code' in data[0]);
    } else {
      console.log(`Table ${t} is empty`);
    }
  }
}

checkAllTablesScanCode();
