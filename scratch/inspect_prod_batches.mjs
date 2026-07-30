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

async function inspectProdBatches() {
  const { data, error } = await supabase.from('production_batches').select('*');
  if (error) {
    console.error("Supabase Error:", error);
    return;
  }
  console.log(`Fetched ${data.length} records from production_batches:`);
  data.forEach((row, i) => {
    console.log(`[${i+1}] id: ${row.id}, batch_id: ${row.batch_id}, production_batch_id: ${row.production_batch_id}, product_name: ${row.product_name}`);
  });
}

inspectProdBatches();
