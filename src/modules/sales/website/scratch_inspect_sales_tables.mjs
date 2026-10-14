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
  return res.status;
}

async function testFullFlow() {
  const uploadId = '11111111-1111-1111-1111-111111111111';
  const orderId = '22222222-2222-2222-2222-222222222222';
  const itemId = '33333333-3333-3333-3333-333333333333';

  // 1. sales_uploads
  await adminPost('sales_uploads', {
    id: uploadId,
    channel: 'WEBSITE',
    file_name: 'test_sales.csv',
    file_type: 'csv',
    uploaded_at: new Date().toISOString(),
    uploaded_by: 'Admin',
    order_date_from: '2026-08-07',
    order_date_to: '2026-08-07',
    source_rows: 1,
    unique_orders: 1,
    duplicates_merged: 0,
    status: 'COMPLETED'
  });

  // 2. sales_raw_data
  await adminPost('sales_raw_data', {
    upload_id: uploadId,
    row_number: 1,
    order_id: '#TEST7001',
    raw_data: { 'Order ID': '#TEST7001', 'Customer Name': 'Test Customer' }
  });

  // 3. sales_orders
  await adminPost('sales_orders', {
    id: orderId,
    upload_id: uploadId,
    channel: 'WEBSITE',
    order_id: '#TEST7001',
    order_date: '2026-08-07',
    customer_name: 'Test Customer',
    phone: '9876543210',
    state: 'Tamil Nadu',
    city: 'Chennai',
    pincode: '600001',
    offer: 'No Offer',
    order_type: 'Single Product Order',
    total_quantity: 1,
    order_total: 499,
    payment_mode: 'PREPAID',
    source_payment_method: 'Prepaid (Online Payment)',
    advance_paid: 499,
    remaining_cod: 0,
    order_status: 'CONFIRMED',
    dispatch_status: 'DISPATCHED',
    dispatch_date: '2026-08-07',
    extra_data: {}
  });

  // 4. sales_order_items
  await adminPost('sales_order_items', {
    id: itemId,
    sales_order_id: orderId,
    product_code: 'DET-500',
    product_name: 'DIY Detergent Liquid',
    quantity: 1,
    unit_price: 499,
    line_total: 499,
    item_data: {}
  });

  // Clean up test rows
  console.log('\n--- Cleaning up test rows ---');
  await fetch(`${supabaseUrl}/rest/v1/sales_order_items?id=eq.${itemId}`, { method: 'DELETE', headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
  await fetch(`${supabaseUrl}/rest/v1/sales_orders?id=eq.${orderId}`, { method: 'DELETE', headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
  await fetch(`${supabaseUrl}/rest/v1/sales_raw_data?upload_id=eq.${uploadId}`, { method: 'DELETE', headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
  await fetch(`${supabaseUrl}/rest/v1/sales_uploads?id=eq.${uploadId}`, { method: 'DELETE', headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
  console.log('Cleanup completed!');
}

testFullFlow();
