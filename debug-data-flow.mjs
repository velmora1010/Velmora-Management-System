import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Manually parse .env
const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  console.log('=== CAMPAIGNS ===');
  const { data: campaigns } = await supabase.from('campaigns_row').select('*');
  console.log(campaigns);

  console.log('=== STATUS TRACKING RECORDS ===');
  const { data: tracking } = await supabase.from('influencer_status_tracking_rows').select('*');
  console.log(tracking);

  console.log('=== INFLUENCER DISPATCH DETAILS ===');
  const { data: dispatch } = await supabase.from('influencer_dispatch_details_rows').select('*');
  console.log(dispatch);

  console.log('=== INFLUENCERS INFO ===');
  const { data: influencers } = await supabase.from('influencers_info_rows').select('*');
  console.log(influencers);
}

test();
