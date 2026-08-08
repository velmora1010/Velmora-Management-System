const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://utusdosvijjuxtowzhta.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4';
const supabase = createClient(supabaseUrl, supabaseKey);

// EXACT LOGIC from ExpenseRuleEngine.ts
const matchesKeyword = (description, keyword) => {
    if (!keyword || !description) return false;
    const cleanKeyword = keyword.trim().toLowerCase();
    if (!cleanKeyword) return false;
    const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\W)${escaped}((?=\\W)|$)`, 'i');
    return regex.test(description.toLowerCase());
};

async function runAudit() {
    console.log("Fetching data...");
    
    // Fetch rules
    const { data: rules, error: rulesErr } = await supabase
      .from('expense_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });
    
    if (rulesErr) throw rulesErr;

    // Fetch expenses
    const { data: expenses, error: expErr } = await supabase
      .from('expenses_row')
      .select('*');
    if (expErr) throw expErr;

    // Fetch categories
    const { data: categories, error: catErr } = await supabase
      .from('finance_category_rows') // assuming name based on previous schemas, let's verify if table exists. wait, user said "finance_categories_rows"
      .select('*');
      
    let actualCategories = categories;
    if (catErr) {
        // Fallback name check
        const { data: categories2, error: catErr2 } = await supabase
          .from('finance_categories_rows')
          .select('*');
        if (catErr2) console.log("Category fetch error:", catErr2);
        actualCategories = categories2 || [];
    }

    console.log(`Fetched ${rules.length} rules and ${expenses.length} expenses.`);

    let matchedCount = 0;
    const unmatched = [];
    const multiMatchConflicts = [];
    const pdfSpacingIssues = [];

    // TASK 1, 2, 3
    expenses.forEach(tx => {
        const desc = (tx.notes || '').toLowerCase();
        
        // Find ALL matching rules
        const matchingRules = rules.filter(r => matchesKeyword(desc, r.keyword));
        
        if (matchingRules.length > 0) {
            matchedCount++;
            
            if (matchingRules.length > 1) {
                multiMatchConflicts.push({
                    id: tx.id,
                    notes: tx.notes,
                    allMatches: matchingRules.map(r => ({ keyword: r.keyword, priority: r.priority })),
                    winner: matchingRules[0].keyword
                });
            }
        } else {
            unmatched.push(tx);
            
            // Check PDF spacing issue
            // If we remove all spaces from desc, does it match a rule keyword (with spaces removed)?
            const noSpaceDesc = desc.replace(/\s+/g, '');
            const spacingMatch = rules.find(r => {
                const kw = (r.keyword||'').toLowerCase().replace(/\s+/g, '');
                return kw && noSpaceDesc.includes(kw) && matchesKeyword(noSpaceDesc, kw); // simple check
            });
            if (spacingMatch) {
                pdfSpacingIssues.push({
                    notes: tx.notes,
                    failedRule: spacingMatch.keyword
                });
            }
        }
    });

    console.log("\n=== TASK 1: Exact Engine Coverage ===");
    console.log(`Total transactions: ${expenses.length}`);
    console.log(`Matched transactions: ${matchedCount}`);
    console.log(`Unmatched transactions: ${unmatched.length}`);
    console.log(`Match percentage: ${((matchedCount / expenses.length) * 100).toFixed(2)}%`);

    console.log("\n=== TASK 3: Multiple Matches Conflicts ===");
    multiMatchConflicts.forEach(c => {
        console.log(`- ID: ${c.id}`);
        console.log(`  Notes: ${c.notes}`);
        console.log(`  Matches: ${JSON.stringify(c.allMatches)}`);
        console.log(`  Winner: ${c.winner}`);
    });

    console.log("\n=== TASK 6: PDF Spacing Issues ===");
    pdfSpacingIssues.slice(0, 10).forEach(p => {
        console.log(`- Failed Keyword: "${p.failedRule}" | Actual notes: "${p.notes}"`);
    });

    // TASK 4 & 5: Unmatched clustering
    console.log("\n=== TASK 4 & 5: Unmatched Candidates ===");
    
    // Basic tokenizer/clusterer
    const tokenCounts = {};
    const tokenExamples = {};
    const tokenAmounts = {};

    unmatched.forEach(tx => {
        const desc = (tx.notes || '').toLowerCase();
        
        // Strip common UPI prefixes to find core words
        let clean = desc.replace(/(upi\/|imps\/|neft\/|rtgs\/|[a-z0-9]+\/)/g, ' ');
        clean = clean.replace(/[^a-z]/g, ' '); // only letters
        
        const words = clean.split(/\s+/).filter(w => w.length > 3);
        
        words.forEach(w => {
            if (!['bank', 'from', 'payment', 'transfer', 'amount', 'transaction'].includes(w)) {
                tokenCounts[w] = (tokenCounts[w] || 0) + 1;
                if (!tokenExamples[w]) tokenExamples[w] = tx.notes;
                tokenAmounts[w] = (tokenAmounts[w] || 0) + (tx.amount || 0);
            }
        });
    });

    const sortedTokens = Object.entries(tokenCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30); // top 30

    sortedTokens.forEach(([token, count]) => {
        let conf = "LOW";
        if (count > 5) conf = "HIGH";
        else if (count > 2) conf = "MEDIUM";
        
        console.log(`- Keyword Candidate: "${token}"`);
        console.log(`  Occurrences: ${count}`);
        console.log(`  Total Amount: ${tokenAmounts[token]}`);
        console.log(`  Confidence: ${conf}`);
        console.log(`  Example: ${tokenExamples[token]}`);
        
        if (conf === "HIGH") {
            // Find category
            // dummy match for now
            console.log(`  Suggested mapping: NEEDS REVIEW`);
        }
        console.log('');
    });
}

runAudit().catch(console.error);
