import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

global.WebSocket = class {};

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

async function main() {
  console.log('--- STEP 2: VERIFYING SUPABASE DATABASE DIRECTLY ---');

  // Check total count in sales_orders for website channel
  const { count: totalWebsiteOrders, error: err1 } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('channel', 'WEBSITE');

  console.log('Total Website Orders in sales_orders DB table:', totalWebsiteOrders);

  // Check order_date values distribution
  const { data: sampleOrders, error: err2 } = await supabase
    .from('sales_orders')
    .select('id, order_id, order_date, channel, created_at')
    .eq('channel', 'WEBSITE')
    .limit(5);

  console.log('Sample Website Orders in DB:', sampleOrders);

  // Query July 2026 exact date range: order_date >= '2026-07-01' and order_date <= '2026-07-31'
  const { count: julyCountExact, error: err3 } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('channel', 'WEBSITE')
    .gte('order_date', '2026-07-01')
    .lte('order_date', '2026-07-31');

  console.log('July 2026 Exact order_date count (>= 2026-07-01 and <= 2026-07-31):', julyCountExact);

  // Query July 2026 half-open interval: order_date >= '2026-07-01' and order_date < '2026-08-01'
  const { count: julyCountHalfOpen, error: err4 } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('channel', 'WEBSITE')
    .gte('order_date', '2026-07-01')
    .lt('order_date', '2026-08-01');

  console.log('July 2026 Half-Open order_date count (>= 2026-07-01 and < 2026-08-01):', julyCountHalfOpen);

  // Check upload batches in sales_uploads
  const { data: batches, error: err5 } = await supabase
    .from('sales_uploads')
    .select('*')
    .eq('channel', 'WEBSITE');

  console.log('Upload Batches in sales_uploads:', batches?.map(b => ({ id: b.id, file_name: b.file_name, source_rows: b.source_rows, unique_orders: b.unique_orders, order_date_from: b.order_date_from, order_date_to: b.order_date_to })));
}

main();
