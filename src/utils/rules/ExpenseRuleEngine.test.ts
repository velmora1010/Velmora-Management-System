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

  // Verify manually_edited protection in historical reevaluation and targeted re-sync (no DB call needed when skipped)
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

  check('Multi-path rule assigns all configured category paths (sles1canaos1can -> SLES + AOS)', () => {
    const multiRule = makeRule({
      id: '309f959a-97f0-45dd-9594-e508e02a6aaf',
      keyword: 'sles1canaos1can',
      category_paths: [
        {
          main_category: 'Operations',
          sub_category1: 'Procurement (Raw Materials)',
          sub_category2: 'Surfactants',
          sub_category3: 'SLES',
          sub_category3_values: [],
          sort_order: 0,
        },
        {
          main_category: 'Operations',
          sub_category1: 'Procurement (Raw Materials)',
          sub_category2: 'Surfactants',
          sub_category3: 'AOS',
          sub_category3_values: [],
          sort_order: 1,
        },
      ],
    });
    const applied = ExpenseRuleEngine.applyExpenseRules(
      {
        sequence: 1,
        amount: 20591,
        notes: 'MMT/IMPS/614110327805/sles1canaos1can/ErodeScien/PUN B0071510',
      },
      [multiRule]
    );
    assert.equal(applied.main_category, 'Operations');
    assert.equal(applied.sub_category3, 'SLES');
    assert.equal(applied.category_paths?.length, 2);
    assert.equal(applied.category_paths?.[0].sub_category3, 'SLES');
    assert.equal(applied.category_paths?.[1].sub_category3, 'AOS');
    assert.equal(applied.matchedRuleId, '309f959a-97f0-45dd-9594-e508e02a6aaf');
  });

  check('Legacy single-path rule without category_paths falls back cleanly', () => {
    const legacyRule = makeRule({
      id: 'legacy-1',
      keyword: 'sodiumbenzoate',
      category_paths: [],
    });
    const applied = ExpenseRuleEngine.applyExpenseRules(
      { sequence: 1, amount: 5192, notes: 'sodiumbenzo ate2' },
      [legacyRule]
    );
    assert.equal(applied.category_paths?.length, 1);
    assert.equal(applied.category_paths?.[0].sub_category3, 'Sodium Benzoate');
  });

  check('Multi-path vs single-path rule with same keyword/priority triggers conflict', () => {
    const r1 = makeRule({
      id: 'r-multi',
      keyword: 'sles1canaos1can',
      category_paths: [
        { main_category: 'Operations', sub_category1: 'Procurement (Raw Materials)', sub_category2: 'Surfactants', sub_category3: 'SLES', sub_category3_values: [] },
        { main_category: 'Operations', sub_category1: 'Procurement (Raw Materials)', sub_category2: 'Surfactants', sub_category3: 'AOS', sub_category3_values: [] },
      ],
    });
    const r2 = makeRule({
      id: 'r-single',
      keyword: 'erodescien',
      category_paths: [
        { main_category: 'Operations', sub_category1: 'Procurement (Raw Materials)', sub_category2: 'Surfactants', sub_category3: 'SLES', sub_category3_values: [] },
      ],
    });
    const conflictTx = ExpenseRuleEngine.applyExpenseRules(
      { sequence: 1, amount: 20591, notes: 'MMT/IMPS/614110327805/sles1canaos1can/ErodeScien/PUN B0071510' },
      [r1, r2]
    );
    assert.ok(conflictTx.ruleConflict);
    assert.equal(conflictTx.category_paths?.length, 0);
    assert.equal(conflictTx.matchedRuleId, null);
  });

  check('getRulePathsSignature is order-independent for rule reuse comparison', () => {
    const sigA = ExpenseRuleEngine.getRulePathsSignature([
      { main_category: 'Operations', sub_category1: 'Procurement (Raw Materials)', sub_category2: 'Surfactants', sub_category3: 'SLES', sub_category3_values: [] },
      { main_category: 'Operations', sub_category1: 'Procurement (Raw Materials)', sub_category2: 'Surfactants', sub_category3: 'AOS', sub_category3_values: [] },
    ]);
    const sigB = ExpenseRuleEngine.getRulePathsSignature([
      { main_category: 'Operations', sub_category1: 'Procurement (Raw Materials)', sub_category2: 'Surfactants', sub_category3: 'AOS', sub_category3_values: [] },
      { main_category: 'Operations', sub_category1: 'Procurement (Raw Materials)', sub_category2: 'Surfactants', sub_category3: 'SLES', sub_category3_values: [] },
    ]);
    assert.equal(sigA, sigB);
  });

  await (async () => {
    const name = 'Combined Dr/Cr mapDebitRowsToExpenses preserves multi-path category_paths';
    try {
      (globalThis as Record<string, unknown>).DOMMatrix ??= class {};
      const { mapDebitRowsToExpenses } = await import('../../modules/finance/services/combinedStatementService');
      const multiRule = makeRule({
        id: '309f959a-97f0-45dd-9594-e508e02a6aaf',
        keyword: 'sles1canaos1can',
        category_paths: [
          { main_category: 'Operations', sub_category1: 'Procurement (Raw Materials)', sub_category2: 'Surfactants', sub_category3: 'SLES', sub_category3_values: [] },
          { main_category: 'Operations', sub_category1: 'Procurement (Raw Materials)', sub_category2: 'Surfactants', sub_category3: 'AOS', sub_category3_values: [] },
        ],
      });
      const mapped = mapDebitRowsToExpenses(
        [
          {
            sequence: 1,
            transactionDate: '26/11/2026',
            normalizedDate: '2026-11-26',
            postedDateTime: '',
            postedDateTimeIso: null,
            createdAtIso: null,
            description: 'MMT/IMPS/614110327805/sles1canaos1can/ErodeScien/PUN B0071510',
            withdrawalAmount: 20591,
            depositAmount: null,
            isDuplicate: false,
            selected: true,
          } as unknown as Parameters<typeof mapDebitRowsToExpenses>[0][number],
        ],
        [multiRule]
      );
      assert.equal(mapped[0].categorization_source, 'auto_rule');
      assert.equal(mapped[0].category_paths?.length, 2);
      assert.equal(mapped[0].matched_rule_id, '309f959a-97f0-45dd-9594-e508e02a6aaf');
      results.push({ name, passed: true });
      console.log(`PASS: ${name}`);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      results.push({ name, passed: false, detail });
      console.error(`FAIL: ${name} -> ${detail}`);
    }
  })();

  await (async () => {
    const name = 'Targeted rule re-sync: manually_edited=true and unassigned rows are skipped';
    try {
      const rule = makeRule({ id: '309f959a-97f0-45dd-9594-e508e02a6aaf', keyword: 'sles1canaos1can' });
      const manualRow: EligibleExpenseRow = {
        id: '9369',
        notes: 'MMT/IMPS/614211157008/sles1canaos1can/ErodeScien/PUN B0071510',
        amount: 26727,
        main_category: 'Operations',
        import_batch_id: 'batch_1',
        manually_edited: true,
        categorization_source: 'auto_rule',
        row_version: 2,
      };
      const unassignedRow: EligibleExpenseRow = {
        id: '9399',
        notes: 'sles1canaos1can',
        amount: 100,
        main_category: 'Uncategorized',
        import_batch_id: 'batch_1',
        manually_edited: false,
        categorization_source: 'unassigned',
        row_version: 1,
      };
      assert.equal(await evaluateAndUpdateRow(manualRow, [rule], true, 'targeted_rule_resync'), 'skipped');
      assert.equal(await evaluateAndUpdateRow(unassignedRow, [rule], false, 'targeted_rule_resync'), 'skipped');
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
