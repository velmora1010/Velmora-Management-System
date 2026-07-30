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

async function inspect() {
  const { data: rmBarcodes } = await supabase.from('raw_material_barcodes').select('*');
  console.log("--- ALL RAW MATERIAL BARCODES ---");
  console.log(JSON.stringify(rmBarcodes, null, 2));

  const { data: pb } = await supabase.from('production_batches').select('*');
  console.log("--- ALL PRODUCTION BATCHES ---");
  console.log(JSON.stringify(pb, null, 2));
}

inspect();
