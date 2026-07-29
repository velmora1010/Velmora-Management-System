import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
  const { data, error } = await supabase.from('product_barcodes').select('*');
  if (error) {
    console.error('Error fetching product_barcodes:', error);
  } else {
    console.log(`Total rows in product_barcodes: ${data.length}`);
    console.log('Sample rows:', data.slice(0, 10));
  }
}

inspect();
