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

async function queryTable(tableName) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=*`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    }
  });
  return await res.json();
}

async function verifySupabaseData() {
  console.log('=================== VERIFYING SUPABASE SALES TABLES ===================');

  const uploads = await queryTable('sales_uploads');
  console.log(`\n1. sales_uploads count: ${uploads.length}`);
  if (uploads.length > 0) console.log('Latest Upload:', uploads[0]);

  const rawData = await queryTable('sales_raw_data');
  console.log(`\n2. sales_raw_data count: ${rawData.length}`);

  const orders = await queryTable('sales_orders');
  console.log(`\n3. sales_orders count: ${orders.length}`);
  if (orders.length > 0) console.log('Sample Order:', orders[0].order_id, orders[0].customer_name, orders[0].payment_mode, orders[0].order_total);

  const items = await queryTable('sales_order_items');
  console.log(`\n4. sales_order_items count: ${items.length}`);
  if (items.length > 0) console.log('Sample Item:', items[0].product_name, items[0].quantity, items[0].line_total);

  console.log('\n========================================================================');
}

verifySupabaseData();
