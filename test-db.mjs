import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://izcuwepzeqhfnjcmpekz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6Y3V3ZXB6ZXFoZm5qY21wZWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTA2MDcsImV4cCI6MjA5MDUyNjYwN30.jvDkD4aFoOmlpotWZxnxuwztN_4hvyJsDQ9c9ep9hLw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log("Testing Supabase connection...");
  const { data, error } = await supabase
    .from('finance_categories')
    .select('*')
    .limit(1);
    
  console.log("Finance Categories:", { data, error });
  
  const { data: cData, error: cErr } = await supabase
    .from('influencer_create_campaigns')
    .select('*')
    .limit(1);
    
  console.log("Campaigns:", { data: cData, error: cErr });
}

test().catch(console.error);
