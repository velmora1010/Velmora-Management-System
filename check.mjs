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
  const { data: profiles, error } = await supabase.from('user_profiles').select('*');
  if (error) {
    console.error('Error fetching user profiles:', error);
  } else {
    console.log('User Profiles:', JSON.stringify(profiles, null, 2));
  }
}

run().catch(console.error);
