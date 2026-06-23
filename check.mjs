import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envLines = fs.readFileSync('.env', 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) {
    env[key.trim()] = rest.join('=').trim().replace(/['"`]/g, '');
  }
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // We can't query information_schema directly with the anon key usually, 
  // but we can query the table with limit(1) to see the returned keys, 
  // or we can use an empty insert to see the error, or just select *.
  const { data, error } = await supabase.from('influencer_status_tracking_rows').select('*').limit(1);
  if (error) {
    console.error('Error fetching table:', error);
  } else {
    // If table is empty, data is [], but it doesn't give us keys.
    // If it's not empty, we get the keys.
    if (data.length > 0) {
      console.log('Columns found in row:', Object.keys(data[0]));
    } else {
      console.log('Table is empty. Cannot determine schema from select *. Trying to insert dummy to get error...');
      const { error: err2 } = await supabase.from('influencer_status_tracking_rows').insert([{ dummy_nonexistent_column: 1 }]);
      console.log('Insert error details:', err2);
    }
  }
}

run().catch(console.error);
