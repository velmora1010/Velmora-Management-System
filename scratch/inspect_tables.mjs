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
  console.log("--- RAW MATERIAL BARCODES ---");
  const { data: rmBarcodes, error: err1 } = await supabase.from('raw_material_barcodes').select('*');
  console.log("Err1:", err1);
  console.log("Count:", rmBarcodes?.length);
  if (rmBarcodes && rmBarcodes.length > 0) {
    console.log("Sample rmBarcode:", rmBarcodes[0]);
  }

  console.log("\n--- RAW MATERIALS ---");
  const { data: rm, error: err2 } = await supabase.from('raw_materials').select('*');
  console.log("Err2:", err2);
  console.log("Count:", rm?.length);
  if (rm && rm.length > 0) {
    console.log("Sample rm:", rm[0]);
  }

  console.log("\n--- PRODUCTION BATCHES ---");
  const { data: pb, error: err3 } = await supabase.from('production_batches').select('*');
  console.log("Err3:", err3);
  console.log("Count:", pb?.length);
  if (pb && pb.length > 0) {
    console.log("Sample pb:", pb[0]);
  }

  console.log("\n--- MICRO BATCHES ---");
  const { data: mb, error: err4 } = await supabase.from('micro_batches').select('*');
  console.log("Err4:", err4);
  console.log("Count:", mb?.length);
  if (mb && mb.length > 0) {
    console.log("Sample mb:", mb[0]);
  }
}

inspect();
