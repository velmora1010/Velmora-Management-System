const supabaseUrl = 'https://utusdosvijjuxtowzhta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODQxOTIsImV4cCI6MjA5NzY2MDE5Mn0.o-1z11_1KgsosTre_gOzR2InF9MjXg6spKibo0Rv5oM';

async function checkAllChannels() {
  console.log('--- CHECKING ALL DISTINCT CHANNELS IN sales_orders ---');

  // Fetch all rows (2427 total rows across pages)
  let allRows = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const start = page * 1000;
    const end = start + 999;

    const res = await fetch(`${supabaseUrl}/rest/v1/sales_orders?select=id,order_id,order_date,channel`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Range-Unit': 'items',
        'Range': `${start}-${end}`
      }
    });

    const rows = await res.json();
    allRows = allRows.concat(rows);
    if (rows.length < 1000) hasMore = false;
    else page++;
  }

  console.log('Total fetched sales_orders rows:', allRows.length);

  const channelsMap = {};
  allRows.forEach(r => {
    const ch = String(r.channel);
    channelsMap[ch] = (channelsMap[ch] || 0) + 1;
  });

  console.log('Distinct channels breakdown:', channelsMap);

  const julyRows = allRows.filter(r => r.order_date >= '2026-07-01' && r.order_date <= '2026-07-31');
  console.log('July 2026 filtered count in memory:', julyRows.length);

  const julyChannelsMap = {};
  julyRows.forEach(r => {
    const ch = String(r.channel);
    julyChannelsMap[ch] = (julyChannelsMap[ch] || 0) + 1;
  });
  console.log('July 2026 channels breakdown:', julyChannelsMap);
}

checkAllChannels().catch(console.error);
