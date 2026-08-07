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
const serviceRoleKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function adminPost(tableName, payload) {
  console.log(`\n--- Admin POST into ${tableName} ---`);
  const res = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  console.log(`Status ${res.status}:`, text);
}

async function run() {
  await adminPost('sales_uploads', { invalid_col: 1 });
  await adminPost('sales_raw_data', { invalid_col: 1 });
  await adminPost('sales_orders', { invalid_col: 1 });
  await adminPost('sales_order_items', { invalid_col: 1 });
}

run();
