const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://utusdosvijjuxtowzhta.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4');

const proposed = [
    {keyword: 'refund', department: 'Finance & Accounts', category: 'RTO', sub_category1: 'SalesRefunds', sub_category2: null, vendor: 'Customer Refunds', priority: 100, is_active: true},
    {keyword: 'swiggy', department: 'Human Resources (HR)', category: 'Welfare', sub_category1: 'Staff Food', sub_category2: null, vendor: 'Swiggy', priority: 100, is_active: true},
    {keyword: '1stvideoj60', department: 'Marketing', category: 'Content Creation', sub_category1: 'UGC Videos', sub_category2: null, vendor: 'UGC Creators', priority: 100, is_active: true},
    {keyword: '2ndvideoj61', department: 'Marketing', category: 'Content Creation', sub_category1: 'UGC Videos', sub_category2: null, vendor: 'UGC Creators', priority: 100, is_active: true}
];

async function run() {
    // Verify categories
    const { data: categories } = await sb.from('finance_categories_rows').select('*').eq('status', 'active');
    
    let allValid = true;
    for (const p of proposed) {
        const match = categories.find(c => c.main === p.department && c.sub1 === p.category && c.sub2 === p.sub_category1 && c.sub3 === p.sub_category2);
        if (!match) {
            console.error(`ERROR: Category hierarchy not found for ${p.keyword}`);
            allValid = false;
        }
    }
    
    if (!allValid) {
        console.error('Aborting insertion due to invalid categories.');
        return;
    }
    console.log('Category hierarchies verified.');

    // Fetch existing rules
    const { data: existing } = await sb.from('expense_rules').select('keyword');
    const existingKeys = existing.map(e => e.keyword.trim().toLowerCase());
    
    const toInsert = proposed.filter(p => !existingKeys.includes(p.keyword.trim().toLowerCase()));
    
    let insertedCount = 0;
    if (toInsert.length > 0) {
        const { error, data } = await sb.from('expense_rules').insert(toInsert).select();
        if (error) {
            console.error('Insert error:', error);
            return;
        }
        insertedCount = data.length;
    }
    
    console.log('Inserted rows:', insertedCount);
    const duplicates = proposed.length - toInsert.length;
    console.log('Duplicates skipped:', duplicates);
    
    const keywords = proposed.map(p => p.keyword);
    const { data: verify } = await sb.from('expense_rules').select('*').in('keyword', keywords);
    
    console.log('\nVerification:');
    verify.forEach(v => {
        console.log(`- ${v.keyword} | ${v.department} > ${v.category} > ${v.sub_category1} > ${v.sub_category2} | Vendor: ${v.vendor} | Priority: ${v.priority} | Active: ${v.is_active}`);
    });
}
run();
