import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

global.WebSocket = WebSocket;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('raw_material_barcodes')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data:', data);
    console.log('Supabase Connected Successfully');
  }
}

test();
