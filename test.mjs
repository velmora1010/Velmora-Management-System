import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://izcuwepzeqhfnjcmpekz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6Y3V3ZXB6ZXFoZm5qY21wZWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTA2MDcsImV4cCI6MjA5MDUyNjYwN30.jvDkD4aFoOmlpotWZxnxuwztN_4hvyJsDQ9c9ep9hLw');
supabase.from('influencer_create_campaigns').select('*').then(console.log);
