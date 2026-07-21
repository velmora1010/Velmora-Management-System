import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  console.log("Getting max ID from influencers_info_rows...");
  const { data: maxData, error: maxError } = await supabase
    .from('influencers_info_rows')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);

  console.log("Max ID error:", maxError);
  console.log("Max ID data:", maxData);
}

test();
