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

async function testBarcodeInQuery() {
  const expectedBarcodes = ["PROD-1B-MB1-260730-001", "PROD-1B-MB1-260730-002", "PROD-1B-MB1-260730-003"];
  const { data, error } = await supabase
    .from('product_barcodes')
    .select('*')
    .in('barcode', expectedBarcodes);

  if (error) {
    console.error("Supabase Error:", error);
    return;
  }
  console.log(`Querying .in('barcode', ${JSON.stringify(expectedBarcodes)}) returned ${data.length} records:`);
  data.forEach((row, i) => {
    console.log(`[${i+1}] barcode: ${row.barcode}, id: ${row.id}, batch_id: ${row.batch_id}`);
  });
}

testBarcodeInQuery();
