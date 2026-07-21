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
  console.log('Querying completed status tracking records...');
  const { data: records, error } = await supabase
    .from('influencer_status_tracking_rows')
    .select('*');

  if (error) {
    console.error('Error fetching records:', error);
    return;
  }

  const completed = records.filter(r => r.delivered_confirmed || r.draft_received || r.final_post_completed);
  console.log(`Found ${completed.length} completed records out of ${records.length} total.`);

  for (const r of completed.slice(0, 10)) {
    // Join dispatch
    const { data: disp } = await supabase
      .from('influencer_dispatch_details_rows')
      .select('*')
      .eq('id', r.dispatch_id)
      .single();

    // Join influencer
    const { data: inf } = await supabase
      .from('influencers_info_rows')
      .select('*')
      .eq('id', r.influencer_id)
      .single();

    console.log('--------------------------------------------------');
    console.log(`Influencer: ${inf ? inf.influencer_name || inf.name : 'Unknown'} (ID: ${r.influencer_id})`);
    console.log(`Campaign ID: ${r.campaign_id}, Dispatch ID: ${r.dispatch_id}`);
    console.log(`delivered_confirmed: ${r.delivered_confirmed}`);
    console.log(`draft_received: ${r.draft_received}`);
    console.log(`final_post_completed: ${r.final_post_completed}`);
    console.log(`expected_delivery_date: ${disp ? disp.expected_delivery_date : 'N/A'}`);
    console.log(`draft_expected_date: ${r.draft_expected_date}`);
    console.log(`final_post_actual_datetime: ${r.final_post_actual_datetime}`);
    console.log(`updated_at: ${r.updated_at}`);
  }
}

test();
