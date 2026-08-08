const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://utusdosvijjuxtowzhta.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4');

const proposed = [
    {keyword: 'aos100kg', department: 'Operations', category: 'Procurement (Raw Materials)', sub_category1: 'Surfactants', sub_category2: 'AOS', vendor: 'Erode Scientific', priority: 50, is_active: true}
];

async function run() {
    console.log('=== PART 1: INSERT aos100kg ===');
    const { data: categories } = await sb.from('finance_categories_rows').select('*').eq('status', 'active');
    let allValid = true;
    for (const p of proposed) {
        const match = categories.find(c => c.main === p.department && c.sub1 === p.category && c.sub2 === p.sub_category1 && c.sub3 === p.sub_category2);
        if (!match) {
            console.error(`ERROR: Category hierarchy not found for ${p.keyword}`);
            allValid = false;
        }
    }
    if (!allValid) return;
    
    const { data: existing } = await sb.from('expense_rules').select('keyword');
    const existingKeys = existing.map(e => e.keyword.trim().toLowerCase());
    const toInsert = proposed.filter(p => !existingKeys.includes(p.keyword.trim().toLowerCase()));
    
    if (toInsert.length > 0) {
        await sb.from('expense_rules').insert(toInsert);
        console.log('Inserted:', toInsert[0].keyword);
    } else {
        console.log('Skipped duplicate');
    }
    
    const { data: verify } = await sb.from('expense_rules').select('*').eq('keyword', 'aos100kg');
    if (verify.length > 0) {
        const v = verify[0];
        console.log(`Stored rule: ${v.keyword} | ${v.department} > ${v.category} > ${v.sub_category1} > ${v.sub_category2} | Vendor: ${v.vendor} | Priority: ${v.priority} | Active: ${v.is_active}`);
    }

    console.log('\n=== PART 2: REFUND ANALYSIS ===');
    const { data: refunds } = await sb.from('expenses_row').select('*').ilike('notes', '%refund%');
    refunds.forEach(r => {
        const match = r.notes.match(/\d+refund[a-z]*/i);
        const token = match ? match[0] : 'UNKNOWN';
        console.log(`ID: ${r.id}`);
        console.log(`Date: ${r.transaction_date}`);
        console.log(`Amount: ${r.amount}`);
        console.log(`Notes: ${r.notes}`);
        console.log(`Token: ${token}`);
        console.log('---');
    });
}
run();
