const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://utusdosvijjuxtowzhta.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4');

const proposed = [
    {keyword: 'jmbottle', department: 'Operations', category: 'Packaging Department', sub_category1: 'Primary Packaging', sub_category2: 'Bottles', vendor: 'Vinayaga Plastics', priority: 50, is_active: true},
    {keyword: 'fbmetaads', department: 'Marketing', category: 'Digital Advertising', sub_category1: 'Meta (Facebook & Instagram) Ads', sub_category2: null, vendor: 'Meta Platforms', priority: 50, is_active: true},
    {keyword: 'slespaste', department: 'Operations', category: 'Procurement (Raw Materials)', sub_category1: 'Surfactants', sub_category2: 'SLES', vendor: 'ZGUARD', priority: 50, is_active: true},
    {keyword: 'titanicsti', department: 'Operations', category: 'Packaging Department', sub_category1: 'Primary Packaging', sub_category2: 'Brand Sticker', vendor: 'Titanic Stickers', priority: 50, is_active: true},
    {keyword: 'amazonads', department: 'Marketing', category: 'Marketplace Ads', sub_category1: 'Amazon Ads', sub_category2: null, vendor: 'Amazon', priority: 50, is_active: true},
    {keyword: 'whiteflower', department: 'Operations', category: 'Procurement (Raw Materials)', sub_category1: 'Fragrances', sub_category2: 'Detergent', vendor: 'Erode Scientific', priority: 50, is_active: true}
];

async function run() {
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
        console.log(`- ${v.keyword} | ${v.department} > ${v.category} > ${v.sub_category1} > ${v.sub_category2} | ${v.vendor} | Priority: ${v.priority} | Active: ${v.is_active}`);
    });
}
run();
