import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utusdosvijjuxtowzhta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: imports, error: err1 } = await supabase.from('expense_imports').select('*').order('imported_at', { ascending: false }).limit(1);
  if (err1) console.error(err1);
  console.log('Latest import:', imports);

  if (imports && imports.length > 0) {
    const batchId = imports[0].batch_id;
    console.log('Querying expenses_row for batch_id:', batchId);
    
    // First, let's see ALL expenses to see what their import_batch_id looks like
    const { data: allExpenses } = await supabase.from('expenses_row').select('id, import_batch_id').limit(5);
    console.log('Sample expenses_row import_batch_ids:', allExpenses);

    const { data: expenses, error: err2 } = await supabase.from('expenses_row').select('*').eq('import_batch_id', batchId);
    if (err2) console.error(err2);
    console.log(`Found ${expenses?.length} expenses for batch_id ${batchId}`);
  }
}

run();
