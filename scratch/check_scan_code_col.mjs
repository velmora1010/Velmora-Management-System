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

async function checkAndAddScanCodeColumn() {
  // Check sample row
  const { data, error } = await supabase.from('product_barcodes').select('*').limit(1);
  if (error) {
    console.error("Error selecting from product_barcodes:", error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log("Sample product_barcodes row keys:", Object.keys(data[0]));
    console.log("Does scan_code exist?", 'scan_code' in data[0]);
  } else {
    console.log("No product_barcodes rows found");
  }
}

checkAndAddScanCodeColumn();
