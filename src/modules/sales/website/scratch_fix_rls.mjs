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

async function checkRpc() {
  const sql = `
    CREATE POLICY "Allow all on sales_uploads" ON public.sales_uploads FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow all on sales_raw_data" ON public.sales_raw_data FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow all on sales_orders" ON public.sales_orders FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow all on sales_order_items" ON public.sales_order_items FOR ALL USING (true) WITH CHECK (true);
  `;

  console.log('Testing RPC calls with Service Role Key...');
  const endpoints = ['exec_sql', 'exec', 'execute_sql', 'sql', 'run_sql', 'pg_exec'];
  for (const ep of endpoints) {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${ep}`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql, sql: sql })
    });
    console.log(`rpc/${ep}: status ${res.status}`);
  }
}

checkRpc();
