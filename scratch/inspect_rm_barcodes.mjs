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

async function inspectRMBarcodes() {
  const { data, error } = await supabase.from('raw_material_barcodes').select('*');
  if (error) {
    console.error("Supabase Error:", error);
    return;
  }
  console.log(`Fetched ${data.length} records from raw_material_barcodes:`);
  data.forEach((row, i) => {
    console.log(`[${i+1}] barcode: ${row.barcode}, material_name: ${row.material_name}, current_stage: ${row.current_stage}, status: ${row.status}, quantity: ${row.quantity}, unit: ${row.unit}, price_per_kg: ${row.price_per_kg}, batch_no: ${row.batch_no}`);
  });
}

inspectRMBarcodes();
