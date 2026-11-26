import assert from 'node:assert/strict';
import { ExpenseRuleEngine, type ExpenseRule } from './ExpenseRuleEngine';
import { evaluateAndUpdateRow, type EligibleExpenseRow } from '../../modules/finance/services/expenseReevaluationService';

function makeRule(overrides: Partial<ExpenseRule> & { id: string; keyword: string }): ExpenseRule {
  const tokens = ExpenseRuleEngine.parseRuleKeywords(overrides.keyword);
  return {
    keywords: tokens,
    keyword_signature: ExpenseRuleEngine.getKeywordSignature(tokens),
    department: 'Operations',
    category: 'Procurement (Raw Materials)',
    sub_category1: 'Preservatives',
    sub_category2: 'Sodium Benzoate',
    sub_category3_values: [],
    vendor: 'ICICI Bank Transaction',
    payment_mode: 'Bank Transfer',
    gst_status: 'Unregistered',
    purchased_by: null,
    approved_by: null,
    notes: null,
    priority: 50,
    created_at: '2026-11-26T09:37:20.439416+00:00',
    ...overrides,
  };
}

interface CaseResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: CaseResult[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`PASS: ${name}`);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, detail });
    console.error(`FAIL: ${name} -> ${detail}`);
  }
}

async function run() {
  console.log('=== TEST SUITE: ExpenseRuleEngine Keyword Boundary & Workflows ===');

  const tableCases: Array<{ keyword: string; text: string; expected: boolean }> = [
    { keyword: 'sodiumbenzoate', text: 'sodiumbenzo ate2', expected: true },
    { keyword: 'sles/aos/capb', text: 'sles3aos2capb1l', expected: true },
    { keyword: 'advancesalary/sathya', text: 'advancesalary/sathya', expected: true },
    { keyword: 'advancesalary/driveranna', text: 'advancesalary/driveranna', expected: true },
    { keyword: 'tea', text: 'team', expected: false },
    { keyword: 'gstr1', text: 'gstr10', expected: false },
    { keyword: 'sodiumbenzoate', text: 'sodiumbenzoate', expected: true },
    { keyword: 'sodiumbenzoate', text: 'sodiumbenzoate2', expected: true },
    { keyword: 'sodiumbenzoate', text: 'sodiumbenzoatex', expected: false },
    { keyword: '100', text: '2100', expected: false },
    { keyword: 'aos', text: '3aos2', expected: true },
    { keyword: 'capb', text: '2capb1', expected: true },
  ];

  for (const tc of tableCases) {
    check(`${tc.keyword} vs "${tc.text}" => ${tc.expected ? 'MATCH' : 'NO MATCH'}`, () => {
      const rule = makeRule({ id: 'rule-1', keyword: tc.keyword });
      const actual = ExpenseRuleEngine.matchesRule(tc.text, rule);
      assert.equal(actual, tc.expected);
    });
  }

  check('Case-insensitive combinations (SODIUMBENZOATE vs SoDiUmBeNzO aTe2)', () => {
    const rule = makeRule({ id: 'rule-case', keyword: 'SODIUMBENZOATE' });
    assert.equal(
      ExpenseRuleEngine.matchesRule('MMT/IMPS/613812090107/SoDiUmBeNzO aTe2/ErodeScien/PUNB0071510', rule),
      true
    );
  });

  check('Multiple keywords separated by / with spaces inserted in narration', () => {
    const rule = makeRule({ id: 'rule-multi', keyword: 'sodiumbenzoate/erodescien' });
    assert.equal(
      ExpenseRuleEngine.matchesRule('MMT/IMPS/613812090107/sodiumbenzo ate2/Erode Scien/PUNB0071510', rule),
      true
    );
  });

  check('Existing punctuation boundaries still match (delhiveryrechar with / and -)', () => {
    const rule = makeRule({ id: 'rule-punct', keyword: 'delhiveryrechar' });
    assert.equal(ExpenseRuleEngine.matchesRule('QA-DRCR/delhiveryrechar/wallet', rule), true);
    assert.equal(ExpenseRuleEngine.matchesRule('delhiveryrechar-topup', rule), true);
  });

  check('Automated upload workflow: applyExpenseRules matches exact 9332 narration', () => {
    const rule = makeRule({ id: '5b34a978-23d8-4399-97fa-75d72fd896e1', keyword: 'sodiumbenzoate' });
    const applied = ExpenseRuleEngine.applyExpenseRules(
      {
        sequence: 1,
        amount: 5192,
        notes: 'MMT/IMPS/613812090107/sodiumbenzo ate2/ErodeScien/PUNB0071510',
      },
      [rule]
    );
    assert.equal(applied.main_category, 'Operations');
    assert.equal(applied.sub_category1, 'Procurement (Raw Materials)');
    assert.equal(applied.sub_category2, 'Preservatives');
    assert.equal(applied.sub_category3, 'Sodium Benzoate');
    assert.equal(applied.matchedRuleId, '5b34a978-23d8-4399-97fa-75d72fd896e1');
  });

  check('Priority and conflict handling preserved with trailing digit fix', () => {
    const ruleA = makeRule({
      id: 'r-a',
      keyword: 'sodiumbenzoate',
      department: 'Operations',
      priority: 50,
    });
    const ruleB = makeRule({
      id: 'r-b',
      keyword: 'erodescien',
      department: 'Marketing',
      priority: 50,
    });
    const conflictTx = ExpenseRuleEngine.applyExpenseRules(
      {
        sequence: 1,
        amount: 5192,
        notes: 'MMT/IMPS/613812090107/sodiumbenzo ate2/ErodeScien/PUNB0071510',
      },
      [ruleA, ruleB]
    );
    assert.equal(conflictTx.main_category, 'Uncategorized');
    assert.ok(conflictTx.ruleConflict);
    assert.equal(conflictTx.matchedRuleId, null);
  });

  // Verify manually_edited protection in historical reevaluation workflow (no DB call needed when skipped)
  await (async () => {
    const name = 'Historical reevaluation: manually_edited row is skipped without DB write';
    try {
      const rule = makeRule({ id: '5b34a978-23d8-4399-97fa-75d72fd896e1', keyword: 'sodiumbenzoate' });
      const row: EligibleExpenseRow = {
        id: '9334',
        notes: 'MMT/IMPS/613813164652/sodiumbenzo ate2/ErodeScien/PUNB0071510',
        amount: 472,
        main_category: 'Uncategorized',
        import_batch_id: 'batch_1794996599021_494zmgusz',
        manually_edited: true,
        categorization_source: 'unassigned',
        row_version: 2,
      };
      const outcome = await evaluateAndUpdateRow(row, [rule], false);
      assert.equal(outcome, 'skipped');
      results.push({ name, passed: true });
      console.log(`PASS: ${name}`);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      results.push({ name, passed: false, detail });
      console.error(`FAIL: ${name} -> ${detail}`);
    }
  })();

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.length - passedCount;
  console.log(`\nSUMMARY: ${passedCount}/${results.length} passed, ${failedCount} failed.`);
  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

run();
