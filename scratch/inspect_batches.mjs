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
  const { data, error } = await supabase.from('production_batches').select('*');
  if (error) {
    console.error('Error fetching production_batches:', error);
  } else {
    console.log(`Total production_batches: ${data.length}`);
    console.log('Production batches:', data.map(b => ({ id: b.id, batch_id: b.batch_id, product_name: b.product_name, created_at: b.created_at })));
  }
}

inspect();
