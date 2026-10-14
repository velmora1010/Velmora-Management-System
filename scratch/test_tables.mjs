import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envText.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.trim();
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || '';
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY || '';

async function checkTables() {
  const tables = ['website_order_uploads', 'website_order_raw_rows', 'website_orders', 'website_order_items'];
  for (const t of tables) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${t}?select=*&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`Table ${t}: OK (${data.length} rows)`);
      } else {
        console.log(`Table ${t}: Error ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.log(`Table ${t}: Error`, err.message);
    }
  }
}

checkTables();
