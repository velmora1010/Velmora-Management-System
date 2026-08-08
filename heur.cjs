const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://utusdosvijjuxtowzhta.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4');

const matchesKeyword = (description, keyword) => {
    if (!keyword || !description) return false;
    const cleanKeyword = keyword.trim().toLowerCase();
    if (!cleanKeyword) return false;
    const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\W)${escaped}((?=\\W)|$)`, 'i');
    return regex.test(description.toLowerCase());
};

async function testHeuristics() {
    const { data: rules } = await sb.from('expense_rules').select('*').eq('is_active', true);
    const { data: expenses } = await sb.from('expenses_row').select('*');
    
    const unmatched = expenses.filter(tx => !rules.some(r => matchesKeyword((tx.notes || '').toLowerCase(), r.keyword)));
    
    const normalize = (notes) => {
        if (!notes) return notes;
        let n = notes;
        
        // Let's implement the specific normalizations required.
        // PDF parser breaks words by inserting a single space randomly.
        // A single space separating numbers is clearly an artifact.
        n = n.replace(/(\d)\s+(\d)/g, '$1$2');
        
        // Single letter isolated from a word > 3 letters:
        // 'f igodieselbarat'
        n = n.replace(/\b([a-zA-Z])\s+([a-zA-Z]{4,})\b/gi, '$1$2');
        n = n.replace(/\b([a-zA-Z]{4,})\s+([a-zA-Z])\b/gi, '$1$2');
        
        // 2-3 letters isolated from a word > 5 letters:
        // 'pradeeploanr epa' (epa is 3), 'maarimaSala ry' (ry is 2)
        n = n.replace(/\b([a-zA-Z]{5,})\s+([a-zA-Z]{2,3})\b/gi, '$1$2');
        n = n.replace(/\b([a-zA-Z]{2,3})\s+([a-zA-Z]{5,})\b/gi, '$1$2');
        
        // Check if "amazon payment" gets broken: "amazon" (6), "payment" (7). Neither is <= 3, so it's safe!
        // Check "warehouse tea expense": "warehouse" (9), "tea" (3). It will become "warehousetea expense"!
        // This is a problem! "warehouse tea expense" -> "warehousetea".
        
        // What if we only do this inside segments containing a slash?
        return n;
    };
    
    let recovered = 0;
    unmatched.forEach(tx => {
        const norm = normalize(tx.notes);
        if (norm !== tx.notes) {
            const match = rules.find(r => matchesKeyword(norm.toLowerCase(), r.keyword));
            if (match) {
                console.log(`Recovered: [${match.keyword}] from '${tx.notes}' -> '${norm}'`);
                recovered++;
            }
        }
    });
    console.log('Total recovered:', recovered);
}
testHeuristics();
