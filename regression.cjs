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

async function testRegression() {
    const { data: rules } = await sb.from('expense_rules').select('*').eq('is_active', true);
    const { data: expenses } = await sb.from('expenses_row').select('*');
    
    let previousMatchCount = 0;
    let newMatchCount = 0;
    
    const targetKeywords = ['figodieselbarat', 'pradeeploanrepa', 'maarimasalary'];
    
    expenses.forEach(tx => {
        const desc = (tx.notes || '').toLowerCase();
        
        // Before normalization
        const matchedBefore = rules.find(r => matchesKeyword(desc, r.keyword));
        if (matchedBefore) previousMatchCount++;
        
        // After normalization (simulating parser)
        const normDesc = normalizePdfSpacing(desc);
        const matchedAfter = rules.find(r => matchesKeyword(normDesc, r.keyword));
        if (matchedAfter) {
            newMatchCount++;
            
            // Check specific verifications requested by user
            if (!matchedBefore && targetKeywords.includes(matchedAfter.keyword.toLowerCase())) {
                console.log(`Verified Specific Target: [${matchedAfter.keyword}] successfully recovered from -> '${tx.notes}'`);
            } else if (!matchedBefore) {
                console.log(`Also Recovered: [${matchedAfter.keyword}] from -> '${tx.notes}'`);
            }
        }
    });
    
    console.log(`\n=== REGRESSION RESULTS ===`);
    console.log(`Total transactions: ${expenses.length}`);
    console.log(`Previous Matched: ${previousMatchCount}`);
    console.log(`New Matched: ${newMatchCount}`);
    console.log(`Rules Recovered: ${newMatchCount - previousMatchCount}`);
}
testRegression();
