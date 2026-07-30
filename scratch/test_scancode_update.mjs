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

async function testScanCodeUpdate() {
  const { data: selectData } = await supabase.from('product_barcodes').select('*').limit(1);
  if (!selectData || selectData.length === 0) return;
  const rowId = selectData[0].id;

  const { data, error } = await supabase
    .from('product_barcodes')
    .update({ scan_code: '1Y730001' })
    .eq('id', rowId)
    .select();

  if (error) {
    console.error("Update scan_code Error:", error);
  } else {
    console.log("Update scan_code Success! Result:", data);
  }
}

testScanCodeUpdate();
