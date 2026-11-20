import type { FinanceExpense, ExpenseImport } from '../../../hooks/finance/useExpenses';
import type { FinanceCredit, CreditImport } from '../../../hooks/finance/useCredits';
import {
  CombinedExtractedRow,
  computeTransactionFingerprint
} from '../../../utils/documentPipeline/CombinedStatementExtractor';
import type { NormalizedTransaction } from '../../../utils/documentPipeline/types';
import { ExpenseRuleEngine } from '../../../utils/rules/ExpenseRuleEngine';
import { CreditRuleEngine } from '../../../utils/rules/CreditRuleEngine';

export type RowSaveState = 'pending' | 'saved' | 'failed';

export interface AnnotatedCombinedRow extends CombinedExtractedRow {
  isDuplicate: boolean;
  duplicateReason?: string;
  saveState?: RowSaveState;
}

export interface CombinedSaveSummary {
  fileName: string;
  expensesSaved: number;
  creditsSaved: number;
  skippedDuplicates: number;
  reviewRequired: number;
  ruleConflictCount?: number;
  failedCount: number;
  expenseBatchId?: string | null;
  creditBatchId?: string | null;
  expenseSavedDone: boolean;
  creditSavedDone: boolean;
  errors: string[];
  status: 'success' | 'partial' | 'failed' | 'nothing_to_save';
  updatedRows?: AnnotatedCombinedRow[];
}

export interface CombinedHistoryRecord {
  key: string;
  fileName: string;
  fileHash: string;
  importedAt: string;
  expenseRows: number;
  creditRows: number;
  totalSavedRows: number;
  statementType: 'combined' | 'debit_only' | 'credit_only';
  status: string;
  expenseBatchId?: string;
  creditBatchId?: string;
}

export type UploadExpenseBatchFn = (
  file_name: string,
  file_hash: string,
  source_type: string,
  imported_by: string | null,
  expensesData: FinanceExpense[],
  document_type?: string
) => Promise<{ success: boolean; batch_id?: string; error?: string }>;

export type UploadCreditBatchFn = (
  file_name: string,
  file_hash: string,
  creditsData: FinanceCredit[]
) => Promise<{ success: boolean; batch_id?: string; error?: string }>;

export type DeleteBatchFn = (
  batch_id: string
) => Promise<{ success: boolean; error?: string }>;

export function filterStandardExpenseImports(imports: ExpenseImport[]): ExpenseImport[] {
  return imports.filter(imp => imp.document_type !== 'COMBINED_DR_CR_STATEMENT');
}

function normalizeDbDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoPrefix ? isoPrefix[1] : trimmed;
}

function normalizeIsoTimestamp(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = new Date(raw);
  return isNaN(d.getTime()) ? String(raw).trim() : d.toISOString();
}

export function buildExistingTransactionFingerprints(
  existingExpenses: FinanceExpense[],
  existingCredits: FinanceCredit[]
): Set<string> {
  const fingerprints = new Set<string>();

  for (const exp of existingExpenses) {
    if (exp.status === 'archived') continue;
    const fp = computeTransactionFingerprint({
      type: 'debit',
      normalizedDate: normalizeDbDate(exp.transaction_date),
      postedDateTimeIso: normalizeIsoTimestamp(exp.posted_datetime),
      amount: exp.amount ?? 0,
      description: exp.notes || ''
    });
    fingerprints.add(fp);

    const fpNoTime = computeTransactionFingerprint({
      type: 'debit',
      normalizedDate: normalizeDbDate(exp.transaction_date),
      postedDateTimeIso: '',
      amount: exp.amount ?? 0,
      description: exp.notes || ''
    });
    fingerprints.add(fpNoTime);
  }

  for (const cred of existingCredits) {
    if (cred.status === 'archived') continue;
    const fp = computeTransactionFingerprint({
      type: 'credit',
      normalizedDate: normalizeDbDate(cred.transaction_date),
      postedDateTimeIso: normalizeIsoTimestamp(cred.posted_datetime),
      amount: cred.amount ?? 0,
      description: cred.notes || ''
    });
    fingerprints.add(fp);

    const fpNoTime = computeTransactionFingerprint({
      type: 'credit',
      normalizedDate: normalizeDbDate(cred.transaction_date),
      postedDateTimeIso: '',
      amount: cred.amount ?? 0,
      description: cred.notes || ''
    });
    fingerprints.add(fpNoTime);
  }

  return fingerprints;
}

export function annotateCombinedRowsWithDuplicates(params: {
  rows: CombinedExtractedRow[];
  fileHash: string;
  existingExpenses: FinanceExpense[];
  existingCredits: FinanceCredit[];
  expenseImports: ExpenseImport[];
  creditImports: CreditImport[];
  excludeExpenseBatchId?: string;
  excludeCreditBatchId?: string;
}): {
  annotatedRows: AnnotatedCombinedRow[];
  fileAlreadyImportedInExpenses: boolean;
  fileAlreadyImportedInCredits: boolean;
} {
  const {
    rows,
    fileHash,
    existingExpenses,
    existingCredits,
    expenseImports,
    creditImports,
    excludeExpenseBatchId,
    excludeCreditBatchId
  } = params;

  const filteredExpenses = excludeExpenseBatchId
    ? existingExpenses.filter(e => e.import_batch_id !== excludeExpenseBatchId)
    : existingExpenses;
  const filteredCredits = excludeCreditBatchId
    ? existingCredits.filter(c => c.import_batch_id !== excludeCreditBatchId)
    : existingCredits;

  const fileAlreadyImportedInExpenses = expenseImports.some(
    imp =>
      imp.file_hash === fileHash &&
      imp.batch_id !== excludeExpenseBatchId &&
      imp.status !== 'archived'
  );
  const fileAlreadyImportedInCredits = creditImports.some(
    imp =>
      imp.file_hash === fileHash &&
      imp.batch_id !== excludeCreditBatchId &&
      imp.import_status !== 'archived'
  );

  const existingFingerprints = buildExistingTransactionFingerprints(
    filteredExpenses,
    filteredCredits
  );
  const seenInCurrentFile = new Set<string>();

  const annotatedRows: AnnotatedCombinedRow[] = rows.map(row => {
    if (row.classification === 'unclassified') {
      return { ...row, isDuplicate: false, saveState: 'pending' };
    }

    const amount = row.classification === 'debit' ? row.withdrawalAmount : row.depositAmount;
    const fpWithTimeNoRef = computeTransactionFingerprint({
      type: row.classification,
      normalizedDate: row.normalizedDate,
      postedDateTimeIso: row.postedDateTimeIso,
      amount,
      description: row.description
    });
    const fpNoTimeNoRef = computeTransactionFingerprint({
      type: row.classification,
      normalizedDate: row.normalizedDate,
      postedDateTimeIso: '',
      amount,
      description: row.description
    });

    const isFileLevelDup =
      (row.classification === 'debit' && fileAlreadyImportedInExpenses) ||
      (row.classification === 'credit' && fileAlreadyImportedInCredits);

    const matchesExistingDb =
      existingFingerprints.has(row.fingerprint) ||
      existingFingerprints.has(fpWithTimeNoRef) ||
      existingFingerprints.has(fpNoTimeNoRef);

    // Only flag intra-file duplicates when the row has a unique timestamp or reference number.
    // Statements without timestamps/references may contain genuine identical same-day transactions.
    const hasDistinguishingIdentity = Boolean(row.postedDateTimeIso || row.chequeRef);
    const matchesWithinFile =
      hasDistinguishingIdentity && seenInCurrentFile.has(row.fingerprint);

    if (isFileLevelDup || matchesExistingDb || matchesWithinFile) {
      return {
        ...row,
        reviewStatus: 'duplicate',
        isDuplicate: true,
        saveState: 'pending',
        duplicateReason: isFileLevelDup
          ? 'This file was already imported'
          : matchesExistingDb
            ? 'Matching transaction already exists in Finance records'
            : 'Duplicate transaction row within the same statement'
      };
    }

    if (hasDistinguishingIdentity) {
      seenInCurrentFile.add(row.fingerprint);
    }
    return { ...row, isDuplicate: false, saveState: 'pending' };
  });

  return {
    annotatedRows,
    fileAlreadyImportedInExpenses,
    fileAlreadyImportedInCredits
  };
}

export function buildCombinedImportHistory(
  expenseImports: ExpenseImport[],
  creditImports: CreditImport[],
  drCrCreditHashes: string[] = []
): CombinedHistoryRecord[] {
  const activeExpenseCombined = expenseImports.filter(
    imp => imp.document_type === 'COMBINED_DR_CR_STATEMENT' && imp.status !== 'archived'
  );
  const activeCredits = creditImports.filter(imp => imp.import_status !== 'archived');

  const creditByHash = new Map<string, CreditImport>();
  for (const cImp of activeCredits) {
    if (cImp.file_hash && !creditByHash.has(cImp.file_hash)) {
      creditByHash.set(cImp.file_hash, cImp);
    }
  }

  const mergedHashes = new Set<string>();
  const records: CombinedHistoryRecord[] = [];

  for (const eImp of activeExpenseCombined) {
    const matchingCredit = eImp.file_hash ? creditByHash.get(eImp.file_hash) : undefined;
    if (matchingCredit && eImp.file_hash) {
      mergedHashes.add(eImp.file_hash);
    }

    const expenseRows = eImp.imported_rows || 0;
    const creditRows = matchingCredit?.transaction_count || 0;

    records.push({
      key: `exp_${eImp.batch_id}`,
      fileName: eImp.file_name,
      fileHash: eImp.file_hash,
      importedAt: eImp.imported_at,
      expenseRows,
      creditRows,
      totalSavedRows: expenseRows + creditRows,
      statementType: matchingCredit ? 'combined' : 'debit_only',
      status: eImp.status || 'completed',
      expenseBatchId: eImp.batch_id,
      creditBatchId: matchingCredit?.batch_id
    });
  }

  const drCrHashSet = new Set(drCrCreditHashes);
  for (const cImp of activeCredits) {
    if (!cImp.file_hash || mergedHashes.has(cImp.file_hash)) continue;
    if (!drCrHashSet.has(cImp.file_hash)) continue;

    records.push({
      key: `cred_${cImp.batch_id}`,
      fileName: cImp.file_name,
      fileHash: cImp.file_hash,
      importedAt: cImp.created_at,
      expenseRows: 0,
      creditRows: cImp.transaction_count || 0,
      totalSavedRows: cImp.transaction_count || 0,
      statementType: 'credit_only',
      status: cImp.import_status || 'completed',
      creditBatchId: cImp.batch_id
    });
  }

  return records.sort(
    (a, b) => new Date(b.importedAt || 0).getTime() - new Date(a.importedAt || 0).getTime()
  );
}

export function reconstructHistoryPreviewRows(
  record: CombinedHistoryRecord,
  expenses: FinanceExpense[],
  credits: FinanceCredit[]
): AnnotatedCombinedRow[] {
  const rows: AnnotatedCombinedRow[] = [];

  if (record.expenseBatchId) {
    const matchedExpenses = expenses.filter(
      e => e.import_batch_id === record.expenseBatchId && e.status !== 'archived'
    );
    for (const exp of matchedExpenses) {
      const seq = typeof exp.sequence === 'number' ? exp.sequence : 0;
      rows.push({
        id: exp.id || `hist_exp_${record.expenseBatchId}_${seq}_${rows.length}`,
        sequence: seq,
        transactionDate: exp.transaction_date || '-',
        normalizedDate: exp.transaction_date || null,
        createdAtIso: exp.created_at || null,
        postedDateTime: exp.posted_datetime || '',
        postedDateTimeIso: exp.posted_datetime || null,
        chequeRef: '',
        description: exp.notes || '-',
        withdrawalAmount: exp.amount !== null && exp.amount !== undefined ? Number(exp.amount) : null,
        depositAmount: null,
        balance: null,
        rawWithdrawalText: exp.amount !== null && exp.amount !== undefined ? String(exp.amount) : '',
        rawDepositText: '',
        rawBalanceText: '',
        classification: 'debit',
        targetModule: 'Expense',
        reviewStatus: 'ready',
        saveState: 'saved',
        isDuplicate: false,
        fingerprint: `hist_exp_${exp.id || rows.length}`
      });
    }
  }

  if (record.creditBatchId) {
    const matchedCredits = credits.filter(
      c => c.import_batch_id === record.creditBatchId && c.status !== 'archived'
    );
    for (const cred of matchedCredits) {
      const seq = typeof cred.sequence === 'number' ? cred.sequence : 0;
      rows.push({
        id: cred.id || `hist_cred_${record.creditBatchId}_${seq}_${rows.length}`,
        sequence: seq,
        transactionDate: cred.transaction_date || '-',
        normalizedDate: cred.transaction_date || null,
        createdAtIso: cred.created_at || null,
        postedDateTime: cred.posted_datetime || '',
        postedDateTimeIso: cred.posted_datetime || null,
        chequeRef: '',
        description: cred.notes || '-',
        withdrawalAmount: null,
        depositAmount: cred.amount !== null && cred.amount !== undefined ? Number(cred.amount) : null,
        balance: null,
        rawWithdrawalText: '',
        rawDepositText: cred.amount !== null && cred.amount !== undefined ? String(cred.amount) : '',
        rawBalanceText: '',
        classification: 'credit',
        targetModule: 'Credit',
        reviewStatus: 'ready',
        saveState: 'saved',
        isDuplicate: false,
        fingerprint: `hist_cred_${cred.id || rows.length}`
      });
    }
  }

  return rows.sort((a, b) => {
    if (a.sequence > 0 && b.sequence > 0 && a.sequence !== b.sequence) {
      return a.sequence - b.sequence;
    }
    const timeA = a.normalizedDate ? new Date(a.normalizedDate).getTime() : 0;
    const timeB = b.normalizedDate ? new Date(b.normalizedDate).getTime() : 0;
    if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }
    return 0;
  });
}

export function mapDebitRowsToExpenses(
  debitRows: AnnotatedCombinedRow[],
  activeRules: Awaited<ReturnType<typeof ExpenseRuleEngine.fetchActiveRules>>,
  onConflictCount?: (count: number) => void
): FinanceExpense[] {
  let conflictCount = 0;
  const mapped = debitRows.map(row => {
    const baseTx: NormalizedTransaction = {
      sequence: row.sequence,
      transactionDate: row.transactionDate,
      postedDateTime: row.postedDateTime || undefined,
      date: row.transactionDate,
      amount: row.withdrawalAmount || 0,
      notes: row.description
    };

    const ruled = ExpenseRuleEngine.applyExpenseRules(baseTx, activeRules);
    if (ruled.ruleConflict) {
      conflictCount += 1;
    }

    return {
      sequence: row.sequence,
      transaction_date: row.normalizedDate,
      posted_datetime: row.postedDateTimeIso,
      created_at: row.createdAtIso || undefined,
      amount: ruled.amount,
      notes: ruled.notes || row.description || '',
      vendor: ruled.vendor || 'Unknown Vendor',
      main_category: ruled.main_category || 'Uncategorized',
      sub_category1: ruled.sub_category1 || null,
      sub_category2: ruled.sub_category2 || null,
      sub_category3: ruled.sub_category3 || null,
      sub_category3_values: ruled.sub_category3_values || [],
      quantity: 1,
      gst_status: ruled.gst_status || 'Unregistered',
      payment_mode: ruled.payment_mode || 'Bank Transfer',
      bank_account: null,
      purchased_by: ruled.purchased_by || null,
      approved_by: ruled.approved_by || null
    };
  });
  onConflictCount?.(conflictCount);
  return mapped;
}

export function mapCreditRowsToCredits(
  creditRows: AnnotatedCombinedRow[],
  activeRules: Awaited<ReturnType<typeof CreditRuleEngine.fetchActiveRules>>
): FinanceCredit[] {
  return creditRows.map(row => {
    const baseTx: NormalizedTransaction = {
      sequence: row.sequence,
      transactionDate: row.transactionDate,
      postedDateTime: row.postedDateTime || undefined,
      date: row.transactionDate,
      amount: row.depositAmount || 0,
      notes: row.description
    };

    const ruled = CreditRuleEngine.applyCreditRules(baseTx, activeRules);

    return {
      sequence: row.sequence,
      transaction_date: row.normalizedDate,
      posted_datetime: row.postedDateTimeIso,
      created_at: row.createdAtIso || undefined,
      amount: ruled.amount,
      notes: ruled.notes || row.description || '',
      source: ruled.source || 'Unknown Source',
      main_category: ruled.main_category || 'Uncategorized',
      sub_category1: ruled.sub_category1 || null,
      sub_category2: ruled.sub_category2 || null,
      payment_mode: ruled.payment_mode || 'Bank Transfer',
      bank_account: null
    };
  });
}

export async function saveCombinedStatementTransactions(params: {
  fileName: string;
  fileHash: string;
  rows: AnnotatedCombinedRow[];
  uploadExpenseBatch: UploadExpenseBatchFn;
  uploadCreditBatch: UploadCreditBatchFn;
  previousSummary?: CombinedSaveSummary;
  fetchExpenseRules?: typeof ExpenseRuleEngine.fetchActiveRules;
  fetchCreditRules?: typeof CreditRuleEngine.fetchActiveRules;
}): Promise<CombinedSaveSummary> {
  const {
    fileName,
    fileHash,
    rows,
    uploadExpenseBatch,
    uploadCreditBatch,
    previousSummary,
    fetchExpenseRules = () => ExpenseRuleEngine.fetchActiveRules(),
    fetchCreditRules = () => CreditRuleEngine.fetchActiveRules()
  } = params;

  const skippedDuplicates = rows.filter(r => r.isDuplicate).length;
  const reviewRequired = rows.filter(
    r => !r.isDuplicate && r.classification === 'unclassified'
  ).length;

  const readyDebits = rows.filter(
    r => !r.isDuplicate && r.classification === 'debit' && r.saveState !== 'saved'
  );
  const readyCredits = rows.filter(
    r => !r.isDuplicate && r.classification === 'credit' && r.saveState !== 'saved'
  );

  let expenseSavedDone = Boolean(previousSummary?.expenseSavedDone);
  let creditSavedDone = Boolean(previousSummary?.creditSavedDone);
  let expensesSaved = previousSummary?.expensesSaved || 0;
  let creditsSaved = previousSummary?.creditsSaved || 0;
  let expenseBatchId: string | null = previousSummary?.expenseBatchId || null;
  let creditBatchId: string | null = previousSummary?.creditBatchId || null;
  let failedCount = 0;
  const errors: string[] = [];

  if (readyDebits.length === 0 && readyCredits.length === 0 && !expenseSavedDone && !creditSavedDone) {
    return {
      fileName,
      expensesSaved: 0,
      creditsSaved: 0,
      skippedDuplicates,
      reviewRequired,
      failedCount: 0,
      expenseSavedDone: false,
      creditSavedDone: false,
      errors: [],
      status: 'nothing_to_save',
      updatedRows: rows
    };
  }

  let nextDebitState: RowSaveState | null = null;
  let nextCreditState: RowSaveState | null = null;
  let ruleConflictCount = previousSummary?.ruleConflictCount || 0;

  if (readyDebits.length > 0 && !expenseSavedDone) {
    try {
      const expenseRules = await fetchExpenseRules();
      const mappedExpenses = mapDebitRowsToExpenses(readyDebits, expenseRules, count => {
        ruleConflictCount = count;
      });
      const expRes = await uploadExpenseBatch(
        fileName,
        fileHash,
        'pdf',
        null,
        mappedExpenses,
        'COMBINED_DR_CR_STATEMENT'
      );
      if (expRes.success) {
        expensesSaved += mappedExpenses.length;
        expenseBatchId = expRes.batch_id || null;
        expenseSavedDone = true;
        nextDebitState = 'saved';
      } else {
        failedCount += mappedExpenses.length;
        nextDebitState = 'failed';
        errors.push(`Expense save failed: ${expRes.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      failedCount += readyDebits.length;
      nextDebitState = 'failed';
      errors.push(`Expense save failed: ${err?.message || 'Unexpected error'}`);
    }
  } else if (readyDebits.length === 0 && !expenseSavedDone) {
    // Debit-not-applicable for Credit-only statement
    expenseSavedDone = false;
  }

  if (readyCredits.length > 0 && !creditSavedDone) {
    try {
      const creditRules = await fetchCreditRules();
      const mappedCredits = mapCreditRowsToCredits(readyCredits, creditRules);
      const credRes = await uploadCreditBatch(fileName, fileHash, mappedCredits);
      if (credRes.success) {
        creditsSaved += mappedCredits.length;
        creditBatchId = credRes.batch_id || null;
        creditSavedDone = true;
        nextCreditState = 'saved';
      } else {
        failedCount += mappedCredits.length;
        nextCreditState = 'failed';
        errors.push(`Credit save failed: ${credRes.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      failedCount += readyCredits.length;
      nextCreditState = 'failed';
      errors.push(`Credit save failed: ${err?.message || 'Unexpected error'}`);
    }
  }

  const updatedRows = rows.map(row => {
    if (row.isDuplicate || row.classification === 'unclassified') return row;
    if (row.saveState === 'saved') return row;
    if (row.classification === 'debit' && nextDebitState) {
      return { ...row, saveState: nextDebitState };
    }
    if (row.classification === 'credit' && nextCreditState) {
      return { ...row, saveState: nextCreditState };
    }
    return row;
  });

  const totalSaved = expensesSaved + creditsSaved;
  let status: CombinedSaveSummary['status'] = 'success';
  if (totalSaved === 0 && failedCount > 0) {
    status = 'failed';
  } else if (failedCount > 0 || errors.length > 0) {
    status = 'partial';
  } else if (totalSaved === 0) {
    status = 'nothing_to_save';
  }

  return {
    fileName,
    expensesSaved,
    creditsSaved,
    skippedDuplicates,
    reviewRequired,
    ruleConflictCount,
    failedCount,
    expenseBatchId,
    creditBatchId,
    expenseSavedDone,
    creditSavedDone,
    errors,
    status,
    updatedRows
  };
}

export async function deleteCombinedStatementBatches(params: {
  record: CombinedHistoryRecord;
  deleteExpenseBatch: DeleteBatchFn;
  deleteCreditBatch: DeleteBatchFn;
}): Promise<{
  success: boolean;
  expenseArchived: boolean;
  creditArchived: boolean;
  errors: string[];
}> {
  const { record, deleteExpenseBatch, deleteCreditBatch } = params;
  const errors: string[] = [];
  let expenseArchived = false;
  let creditArchived = false;

  if (record.expenseBatchId) {
    const res = await deleteExpenseBatch(record.expenseBatchId);
    if (res.success) {
      expenseArchived = true;
    } else {
      errors.push(`Expense batch archive failed: ${res.error || 'Unknown error'}`);
    }
  }

  if (record.creditBatchId) {
    const res = await deleteCreditBatch(record.creditBatchId);
    if (res.success) {
      creditArchived = true;
    } else if (expenseArchived) {
      errors.push(
        `Partial archive: Expense batch (${record.expenseBatchId}) was moved to Recycle Bin, while Credit batch (${record.creditBatchId}) remains active (${res.error || 'Unknown error'}). You can restore the Expense batch from Finance Recycle Bin.`
      );
    } else {
      errors.push(`Credit batch archive failed: ${res.error || 'Unknown error'}`);
    }
  }

  return {
    success: errors.length === 0,
    expenseArchived,
    creditArchived,
    errors
  };
}

export async function replaceCombinedStatementBatches(params: {
  oldRecord: CombinedHistoryRecord;
  newFileName: string;
  newFileHash: string;
  newRows: AnnotatedCombinedRow[];
  deleteExpenseBatch: DeleteBatchFn;
  deleteCreditBatch: DeleteBatchFn;
  uploadExpenseBatch: UploadExpenseBatchFn;
  uploadCreditBatch: UploadCreditBatchFn;
  fetchExpenseRules?: typeof ExpenseRuleEngine.fetchActiveRules;
  fetchCreditRules?: typeof CreditRuleEngine.fetchActiveRules;
}): Promise<{
  archiveResult: {
    success: boolean;
    expenseArchived: boolean;
    creditArchived: boolean;
    errors: string[];
  };
  saveSummary: CombinedSaveSummary | null;
}> {
  const archiveResult = await deleteCombinedStatementBatches({
    record: params.oldRecord,
    deleteExpenseBatch: params.deleteExpenseBatch,
    deleteCreditBatch: params.deleteCreditBatch
  });

  if (!archiveResult.success) {
    return {
      archiveResult,
      saveSummary: null
    };
  }

  const saveSummary = await saveCombinedStatementTransactions({
    fileName: params.newFileName,
    fileHash: params.newFileHash,
    rows: params.newRows,
    uploadExpenseBatch: params.uploadExpenseBatch,
    uploadCreditBatch: params.uploadCreditBatch,
    fetchExpenseRules: params.fetchExpenseRules,
    fetchCreditRules: params.fetchCreditRules
  });

  return {
    archiveResult,
    saveSummary
  };
}
