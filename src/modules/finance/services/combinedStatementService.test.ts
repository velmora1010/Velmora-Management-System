import assert from 'node:assert/strict';

(globalThis as Record<string, unknown>).DOMMatrix ??= class {};

async function runTests() {
  const { annotateCombinedRowsWithDuplicates } = await import('./combinedStatementService');
  const { computeTransactionFingerprint } = await import(
    '../../../utils/documentPipeline/CombinedStatementExtractor'
  );

  type CombinedExtractedRow = Parameters<typeof annotateCombinedRowsWithDuplicates>[0]['rows'][number];

  function makeRow(overrides: Partial<CombinedExtractedRow> = {}): CombinedExtractedRow {
    const base = {
      id: 'row-1',
      sequence: 1,
      transactionDate: '27/11/2026',
      normalizedDate: '2026-11-27',
      createdAtIso: '2026-11-27T00:00:00.000Z',
      postedDateTime: '27/11/2026 03:32:56 PM',
      postedDateTimeIso: '2026-11-27T10:02:56.000Z',
      chequeRef: 'REF123',
      description: 'BANK CHARGES SMS FEE',
      withdrawalAmount: 29.5,
      depositAmount: null,
      balance: 5737.65,
      rawWithdrawalText: '29.50',
      rawDepositText: '',
      rawBalanceText: '5737.65',
      classification: 'debit' as const,
      targetModule: 'Expense' as const,
      reviewStatus: 'ready' as const,
      fingerprint: '',
      ...overrides,
    };

    const amount = base.classification === 'debit' ? base.withdrawalAmount : base.depositAmount;
    base.fingerprint = computeTransactionFingerprint({
      type: base.classification === 'credit' ? 'credit' : 'debit',
      normalizedDate: base.normalizedDate,
      postedDateTimeIso: base.postedDateTimeIso,
      amount,
      description: base.description,
      chequeRef: base.chequeRef,
    });

    return base;
  }

  console.log('=== TEST SUITE: Combined Statement Duplicate Detection ===');

  // Test 1: Legitimate transactions (same timestamp/amount/desc/ref, different balances)
  {
    const r489 = makeRow({ id: 'row-489', sequence: 489, balance: 5737.65 });
    const r490 = makeRow({ id: 'row-490', sequence: 490, balance: 5708.15 });
    const res = annotateCombinedRowsWithDuplicates({
      rows: [r489, r490],
      fileHash: 'hash-1',
      existingExpenses: [],
      existingCredits: [],
      expenseImports: [],
      creditImports: [],
    });
    assert.equal(res.annotatedRows[0].isDuplicate, false);
    assert.equal(res.annotatedRows[1].isDuplicate, false);
    assert.equal(res.annotatedRows[0].reviewStatus, 'ready');
    assert.equal(res.annotatedRows[1].reviewStatus, 'ready');
    console.log('PASS: Test 1 - Legitimate same-second transactions with different balances are NOT duplicates');
  }

  // Test 2: Actual duplicate (same identifying fields AND same balance)
  {
    const r1 = makeRow({ id: 'row-1', sequence: 1, balance: 5737.65 });
    const r2 = makeRow({ id: 'row-2', sequence: 2, balance: 5737.65 });
    const res = annotateCombinedRowsWithDuplicates({
      rows: [r1, r2],
      fileHash: 'hash-2',
      existingExpenses: [],
      existingCredits: [],
      expenseImports: [],
      creditImports: [],
    });
    assert.equal(res.annotatedRows[0].isDuplicate, false);
    assert.equal(res.annotatedRows[1].isDuplicate, true);
    assert.equal(res.annotatedRows[1].reviewStatus, 'duplicate');
    assert.equal(res.annotatedRows[1].duplicateReason, 'Duplicate transaction row within the same statement');
    console.log('PASS: Test 2 - Identical rows with same balance flag second row as duplicate');
  }

  // Test 3: Missing balance preserves fallback fingerprint duplicate detection
  {
    const r1 = makeRow({ id: 'row-1', sequence: 1, balance: null });
    const r2 = makeRow({ id: 'row-2', sequence: 2, balance: undefined as unknown as null });
    const res = annotateCombinedRowsWithDuplicates({
      rows: [r1, r2],
      fileHash: 'hash-3',
      existingExpenses: [],
      existingCredits: [],
      expenseImports: [],
      creditImports: [],
    });
    assert.equal(res.annotatedRows[0].isDuplicate, false);
    assert.equal(res.annotatedRows[1].isDuplicate, true);
    assert.equal(res.annotatedRows[1].duplicateReason, 'Duplicate transaction row within the same statement');
    console.log('PASS: Test 3 - Missing balance preserves fallback intra-file duplicate detection');
  }

  // Test 4: Different transaction amounts remain valid
  {
    const r1 = makeRow({ id: 'row-1', sequence: 1, withdrawalAmount: 29.5, balance: 5737.65 });
    const r2 = makeRow({ id: 'row-2', sequence: 2, withdrawalAmount: 35.0, balance: 5702.65 });
    const res = annotateCombinedRowsWithDuplicates({
      rows: [r1, r2],
      fileHash: 'hash-4',
      existingExpenses: [],
      existingCredits: [],
      expenseImports: [],
      creditImports: [],
    });
    assert.equal(res.annotatedRows[0].isDuplicate, false);
    assert.equal(res.annotatedRows[1].isDuplicate, false);
    console.log('PASS: Test 4 - Different transaction amounts remain valid');
  }

  // Test 5: Existing database duplicate still flags regardless of running balance
  {
    const r1 = makeRow({ id: 'row-1', sequence: 1, balance: 9999.99, chequeRef: '' });
    const res = annotateCombinedRowsWithDuplicates({
      rows: [r1],
      fileHash: 'hash-5',
      existingExpenses: [
        {
          id: '101',
          amount: 29.5,
          notes: 'BANK CHARGES SMS FEE',
          transaction_date: '2026-11-27',
          posted_datetime: '2026-11-27T10:02:56.000Z',
          status: 'active',
        } as never,
      ],
      existingCredits: [],
      expenseImports: [],
      creditImports: [],
    });
    assert.equal(res.annotatedRows[0].isDuplicate, true);
    assert.equal(res.annotatedRows[0].duplicateReason, 'Matching transaction already exists in Finance records');
    console.log('PASS: Test 5 - Existing DB duplicate is flagged regardless of PDF running balance');
  }

  // Test 6: Previously imported file-hash detection remains unchanged
  {
    const r1 = makeRow({ id: 'row-1', sequence: 1, balance: 5737.65 });
    const res = annotateCombinedRowsWithDuplicates({
      rows: [r1],
      fileHash: 'already-imported-hash',
      existingExpenses: [],
      existingCredits: [],
      expenseImports: [
        {
          id: 'imp-1',
          batch_id: 'batch_old',
          file_name: 'stmt.pdf',
          file_hash: 'already-imported-hash',
          status: 'completed',
        } as never,
      ],
      creditImports: [],
    });
    assert.equal(res.fileAlreadyImportedInExpenses, true);
    assert.equal(res.annotatedRows[0].isDuplicate, true);
    assert.equal(res.annotatedRows[0].duplicateReason, 'This file was already imported');
    console.log('PASS: Test 6 - Previously imported file hash flags duplicate');
  }

  console.log('ALL 6 DUPLICATE DETECTION TESTS PASSED.');
}

runTests();
