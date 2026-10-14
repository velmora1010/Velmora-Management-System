import * as fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[key] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

async function anonPost(tableName, payload) {
  console.log(`\n--- Anon POST into ${tableName} ---`);
  const res = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  console.log(`Status ${res.status}:`, text);
}

async function run() {
  const testId = '99999999-9999-9999-9999-999999999999';
  await anonPost('sales_uploads', {
    id: testId,
    channel: 'WEBSITE',
    file_name: 'anon_test.csv',
    file_type: 'csv',
    uploaded_at: new Date().toISOString(),
    status: 'PROCESSING'
  });
  await anonPost('sales_raw_data', {
    upload_id: testId,
    row_number: 1,
    raw_data: { test: true }
  });
  await anonPost('sales_orders', {
    id: testId,
    upload_id: testId,
    channel: 'WEBSITE',
    order_id: '#ANON001',
    order_date: '2026-08-07',
    order_total: 100
  });
  await anonPost('sales_order_items', {
    id: testId,
    sales_order_id: testId,
    product_name: 'Test Prod',
    quantity: 1
  });
}

run();
