import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

global.WebSocket = WebSocket;

const supabaseUrl = 'https://utusdosvijjuxtowzhta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODQxOTIsImV4cCI6MjA5NzY2MDE5Mn0.o-1z11_1KgsosTre_gOzR2InF9MjXg6spKibo0Rv5oM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getMaxId(table) {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .not('id', 'is', null)
    .order('id', { ascending: false })
    .limit(1);
  if (error) {
    console.warn(`Could not fetch max id for ${table}:`, error);
    return 0;
  }
  return data && data.length > 0 ? Number(data[0].id) : 0;
}

async function run() {
  try {
    const campaignId = 9;
    const maxInfoId = await getMaxId('influencers_info_rows');
    const newInfluencerId = maxInfoId + 1;

    const infoPayload = {
      id: newInfluencerId,
      campaign_id: campaignId,
      code: `TEST${Date.now()}`,
      name: 'Test Influencer Boolean',
      influencer_name: 'test_inf_bool',
      phone_number: '1234567890',
      alternative_number: '',
      upi_number: '',
      complete_address: 'Test Address',
      city: 'Test City',
      state: 'Test State',
      languages: ['English'],
      profile_file_url: 'https://example.com/test.jpg',
      auto_dm: false,
      is_archived: false // boolean false
    };

    console.log('Inserting with boolean is_archived...');
    const { error: insertInfoErr } = await supabase
      .from('influencers_info_rows')
      .insert([infoPayload]);

    if (insertInfoErr) {
      console.error('Insert failed:', insertInfoErr);
    } else {
      console.log('Insert with boolean is_archived succeeded!');
      await supabase.from('influencers_info_rows').delete().eq('id', newInfluencerId);
    }
  } catch (err) {
    console.error('Catch error:', err);
  }
}

run();
