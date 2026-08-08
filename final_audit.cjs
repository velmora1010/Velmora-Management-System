const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://utusdosvijjuxtowzhta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4';
const supabase = createClient(supabaseUrl, supabaseKey);

const normalizePdfSpacing = (text) => {
  if (!text) return text;
  let s = text.trim();
  s = s.replace(/\b([a-zA-Z0-9])\s+([a-zA-Z0-9]{4,})\b/g, '$1$2');
  s = s.replace(/\b([a-zA-Z0-9]{4,})\s+([a-zA-Z0-9])\b/g, '$1$2');
  s = s.replace(/\b([a-zA-Z0-9]{2})\s+([a-zA-Z0-9]{5,})\b/g, '$1$2');
  s = s.replace(/\b([a-zA-Z0-9]{5,})\s+([a-zA-Z0-9]{2})\b/g, '$1$2');
  s = s.replace(/\b([a-zA-Z0-9]{3})\s+([a-zA-Z0-9]{10,})\b/g, '$1$2');
  s = s.replace(/\b([a-zA-Z0-9]{10,})\s+([a-zA-Z0-9]{3})\b/g, '$1$2');
  s = s.replace(/(\d)\s+(\d)/g, '$1$2');
  return s;
};

const matchesKeyword = (description, keyword) => {
    if (!keyword || !description) return false;
    const cleanKeyword = keyword.trim().toLowerCase();
    if (!cleanKeyword) return false;
    const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\W)${escaped}((?=\\W)|$)`, 'i');
    return regex.test(description.toLowerCase());
};

async function runAudit() {
    const { data: rules } = await supabase.from('expense_rules').select('*').eq('is_active', true);
    const { data: expenses } = await supabase.from('expenses_row').select('*');
    const { data: categories } = await supabase.from('finance_categories_rows').select('*');
    
    let matchedCount = 0;
    const unmatched = [];
    const multiMatchConflicts = [];
    
    expenses.forEach(tx => {
        const desc = normalizePdfSpacing(tx.notes || '').toLowerCase();
        const matchingRules = rules.filter(r => matchesKeyword(desc, r.keyword));
        
        if (matchingRules.length > 0) {
            matchedCount++;
            if (matchingRules.length > 1) {
                multiMatchConflicts.push({ id: tx.id, notes: tx.notes, matches: matchingRules.map(r=>r.keyword) });
            }
        } else {
            unmatched.push(tx);
        }
    });
    
    console.log(`=== COVERAGE ===`);
    console.log(`Total: ${expenses.length}`);
    console.log(`Matched: ${matchedCount}`);
    console.log(`Unmatched: ${unmatched.length}`);
    console.log(`Coverage: ${((matchedCount/expenses.length)*100).toFixed(2)}%`);
    console.log(`Conflicts: ${multiMatchConflicts.length}`);
    
    const tokenCounts = {};
    const tokenExamples = {};
    const tokenAmounts = {};
    
    unmatched.forEach(tx => {
        const desc = normalizePdfSpacing(tx.notes || '').toLowerCase();
        let clean = desc.replace(/(upi\/|imps\/|neft\/|rtgs\/|[0-9]{10,}\/)/g, ' ');
        clean = clean.replace(/[^a-z]/g, ' ');
        const words = clean.split(/\s+/).filter(w => w.length > 3);
        
        words.forEach(w => {
            if (!['bank', 'from', 'payment', 'transfer', 'amount', 'transaction'].includes(w)) {
                tokenCounts[w] = (tokenCounts[w] || 0) + 1;
                if (!tokenExamples[w]) tokenExamples[w] = tx.notes;
                tokenAmounts[w] = (tokenAmounts[w] || 0) + (tx.amount || 0);
            }
        });
    });
    
    const sortedTokens = Object.entries(tokenCounts).sort((a, b) => b[1] - a[1]).slice(0, 30);
    
    console.log(`\n=== TOKENS ===`);
    sortedTokens.forEach(([t, c]) => {
        console.log(`${t}|${c}|${tokenAmounts[t]}|${tokenExamples[t]}`);
    });
}
runAudit();
