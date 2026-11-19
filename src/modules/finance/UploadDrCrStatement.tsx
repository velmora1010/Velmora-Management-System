import { useState, useRef, useMemo } from 'react';
import {
  Upload,
  FileText,
  X,
  Trash2,
  RefreshCw,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  ArrowLeftRight,
  ListChecks
} from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useExpenses } from '../../hooks/finance/useExpenses';
import { useCredits } from '../../hooks/finance/useCredits';
import {
  CombinedStatementExtractor,
  CombinedClassification
} from '../../utils/documentPipeline/CombinedStatementExtractor';
import {
  annotateCombinedRowsWithDuplicates,
  buildCombinedImportHistory,
  deleteCombinedStatementBatches,
  reconstructHistoryPreviewRows,
  replaceCombinedStatementBatches,
  saveCombinedStatementTransactions,
  type AnnotatedCombinedRow,
  type CombinedHistoryRecord,
  type CombinedSaveSummary
} from './services/combinedStatementService';
import toast from 'react-hot-toast';

const DR_CR_CREDIT_HASHES_KEY = 'velmora_drcr_credit_hashes';

function readStoredDrCrCreditHashes(): string[] {
  try {
    const raw = localStorage.getItem(DR_CR_CREDIT_HASHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : [];
  } catch {
    return [];
  }
}

function recordDrCrCreditHash(fileHash: string): string[] {
  const existing = readStoredDrCrCreditHashes();
  if (!fileHash || existing.includes(fileHash)) return existing;
  const next = [fileHash, ...existing].slice(0, 200);
  try {
    localStorage.setItem(DR_CR_CREDIT_HASHES_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export interface CombinedStatementFileEntry {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  fileHash: string;
  status: 'parsed' | 'saved' | 'partial' | 'error';
  errorMessage?: string;
  totalRows: number;
  debitCount: number;
  creditCount: number;
  reviewCount: number;
  duplicateCount: number;
  saveSummary?: CombinedSaveSummary;
}

interface UploadDrCrStatementProps {
  onClose: () => void;
}

export const UploadDrCrStatement = ({ onClose }: UploadDrCrStatementProps) => {
  const {
    expenses,
    imports: expenseImports,
    uploadBatch: uploadExpenseBatch,
    deleteBatch: deleteExpenseBatch,
    isLoadingImports: isLoadingExpenseImports
  } = useExpenses();
  const {
    credits,
    imports: creditImports,
    uploadBatch: uploadCreditBatch,
    deleteBatch: deleteCreditBatch,
    isLoadingImports: isLoadingCreditImports
  } = useCredits();

  const [stagedFiles, setStagedFiles] = useState<CombinedStatementFileEntry[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string | null>(null);
  const [rowsByFile, setRowsByFile] = useState<Record<string, AnnotatedCombinedRow[]>>({});
  const [sectionFilter, setSectionFilter] = useState<
    'all' | 'debit' | 'credit' | 'review'
  >('all');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [historyRecordToDelete, setHistoryRecordToDelete] =
    useState<CombinedHistoryRecord | null>(null);
  const [replaceTargetRecord, setReplaceTargetRecord] =
    useState<CombinedHistoryRecord | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<{
    oldRecord: CombinedHistoryRecord;
    newFileName: string;
    newFileSize: number;
    newFileHash: string;
    newRows: AnnotatedCombinedRow[];
    debitCount: number;
    creditCount: number;
    reviewCount: number;
    duplicateCount: number;
  } | null>(null);
  const [drCrCreditHashes, setDrCrCreditHashes] = useState<string[]>(() =>
    readStoredDrCrCreditHashes()
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceHistoryInputRef = useRef<HTMLInputElement>(null);

  const activeFile = useMemo(
    () => stagedFiles.find(f => f.id === activeFileId) || null,
    [stagedFiles, activeFileId]
  );

  // Unified combined statement history (Debit-only, Credit-only, and merged Dr + Cr)
  const savedCombinedHistory = useMemo(
    () => buildCombinedImportHistory(expenseImports, creditImports, drCrCreditHashes),
    [expenseImports, creditImports, drCrCreditHashes]
  );

  const activeHistoryRecord = useMemo(
    () => savedCombinedHistory.find(h => h.key === selectedHistoryKey) || null,
    [savedCombinedHistory, selectedHistoryKey]
  );

  const isHistoryView = Boolean(activeHistoryRecord);

  const activeRows = useMemo(() => {
    if (activeHistoryRecord) {
      return reconstructHistoryPreviewRows(activeHistoryRecord, expenses, credits);
    }
    return activeFileId ? rowsByFile[activeFileId] || [] : [];
  }, [activeHistoryRecord, expenses, credits, activeFileId, rowsByFile]);

  const summary = useMemo(() => {
    const debits = activeRows.filter(tx => tx.classification === 'debit');
    const creditsList = activeRows.filter(tx => tx.classification === 'credit');
    const unclassified = activeRows.filter(tx => tx.classification === 'unclassified');
    const duplicates = activeRows.filter(tx => tx.isDuplicate);
    const readyDebits = debits.filter(tx => !tx.isDuplicate && tx.saveState !== 'saved');
    const readyCredits = creditsList.filter(tx => !tx.isDuplicate && tx.saveState !== 'saved');

    const debitTotal = debits.reduce((sum, tx) => sum + (tx.withdrawalAmount || 0), 0);
    const creditTotal = creditsList.reduce((sum, tx) => sum + (tx.depositAmount || 0), 0);
    const reviewRequiredCount = activeRows.filter(
      tx => tx.classification === 'unclassified' || tx.isDuplicate
    ).length;

    return {
      totalCount: activeRows.length,
      debits,
      credits: creditsList,
      unclassified,
      duplicates,
      readyDebits,
      readyCredits,
      debitTotal,
      creditTotal,
      reviewRequiredCount
    };
  }, [activeRows]);

  const filteredRows = useMemo(() => {
    if (sectionFilter === 'all') return activeRows;
    if (sectionFilter === 'debit') return activeRows.filter(tx => tx.classification === 'debit');
    if (sectionFilter === 'credit') return activeRows.filter(tx => tx.classification === 'credit');
    return activeRows.filter(tx => tx.classification === 'unclassified' || tx.isDuplicate);
  }, [activeRows, sectionFilter]);

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '-';
    return `₹${Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    setParseError(null);
    setIsParsing(true);

    try {
      for (const file of files) {
        const isPdf =
          file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
          const msg = `Unsupported file "${file.name}". Please upload a combined bank statement PDF (.pdf).`;
          setParseError(msg);
          toast.error(msg);
          continue;
        }

        const { rows, fileHash } = await CombinedStatementExtractor.extractFromFile(file);
        const {
          annotatedRows,
          fileAlreadyImportedInExpenses,
          fileAlreadyImportedInCredits
        } = annotateCombinedRowsWithDuplicates({
          rows,
          fileHash,
          existingExpenses: expenses,
          existingCredits: credits,
          expenseImports,
          creditImports
        });

        const fileId = `drcr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const debitCount = annotatedRows.filter(r => r.classification === 'debit').length;
        const creditCount = annotatedRows.filter(r => r.classification === 'credit').length;
        const duplicateCount = annotatedRows.filter(r => r.isDuplicate).length;
        const reviewCount = annotatedRows.filter(
          r => r.classification === 'unclassified'
        ).length;

        const entry: CombinedStatementFileEntry = {
          id: fileId,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          fileHash,
          status: 'parsed',
          totalRows: annotatedRows.length,
          debitCount,
          creditCount,
          reviewCount,
          duplicateCount
        };

        setStagedFiles(prev => [entry, ...prev]);
        setRowsByFile(prev => ({ ...prev, [fileId]: annotatedRows }));
        setSelectedHistoryKey(null);
        setActiveFileId(fileId);
        setSectionFilter('all');

        if (fileAlreadyImportedInExpenses || fileAlreadyImportedInCredits) {
          toast(
            `File "${file.name}" matches a previous import. Duplicate transactions are flagged and will be skipped.`,
            { icon: '⚠️' }
          );
        } else {
          toast.success(
            `Extracted ${annotatedRows.length} rows (${debitCount} Dr, ${creditCount} Cr, ${reviewCount} Review).`
          );
        }
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to extract combined statement PDF.';
      setParseError(message);
      toast.error(message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== fileId));
    setRowsByFile(prev => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
    if (activeFileId === fileId) {
      setActiveFileId(null);
    }
  };

  const handleDeleteHistoryConfirm = async () => {
    if (!historyRecordToDelete) return;
    setIsSaving(true);
    try {
      const res = await deleteCombinedStatementBatches({
        record: historyRecordToDelete,
        deleteExpenseBatch,
        deleteCreditBatch
      });
      if (res.success) {
        toast.success(`"${historyRecordToDelete.fileName}" moved to Recycle Bin.`);
        if (selectedHistoryKey === historyRecordToDelete.key) {
          setSelectedHistoryKey(null);
        }
      } else {
        toast.error(res.errors.join(' | ') || 'Failed to archive combined statement.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to archive combined statement.');
    } finally {
      setIsSaving(false);
      setHistoryRecordToDelete(null);
    }
  };

  const handleReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = replaceTargetRecord;
    setReplaceTargetRecord(null);
    if (!file || !target) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      const msg = `Unsupported file "${file.name}". Please select a combined bank statement PDF (.pdf).`;
      setParseError(msg);
      toast.error(msg);
      return;
    }

    setParseError(null);
    setIsParsing(true);
    try {
      const { rows, fileHash } = await CombinedStatementExtractor.extractFromFile(file);
      const { annotatedRows } = annotateCombinedRowsWithDuplicates({
        rows,
        fileHash,
        existingExpenses: expenses,
        existingCredits: credits,
        expenseImports,
        creditImports,
        excludeExpenseBatchId: target.expenseBatchId,
        excludeCreditBatchId: target.creditBatchId
      });

      const debitCount = annotatedRows.filter(r => r.classification === 'debit' && !r.isDuplicate).length;
      const creditCount = annotatedRows.filter(r => r.classification === 'credit' && !r.isDuplicate).length;
      const reviewCount = annotatedRows.filter(r => r.classification === 'unclassified').length;
      const duplicateCount = annotatedRows.filter(r => r.isDuplicate).length;

      setPendingReplacement({
        oldRecord: target,
        newFileName: file.name,
        newFileSize: file.size,
        newFileHash: fileHash,
        newRows: annotatedRows,
        debitCount,
        creditCount,
        reviewCount,
        duplicateCount
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to parse replacement PDF. Existing statement remains untouched.';
      setParseError(msg);
      toast.error(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleReplaceConfirm = async () => {
    if (!pendingReplacement) return;
    setIsSaving(true);
    try {
      const { archiveResult, saveSummary } = await replaceCombinedStatementBatches({
        oldRecord: pendingReplacement.oldRecord,
        newFileName: pendingReplacement.newFileName,
        newFileHash: pendingReplacement.newFileHash,
        newRows: pendingReplacement.newRows,
        deleteExpenseBatch,
        deleteCreditBatch,
        uploadExpenseBatch,
        uploadCreditBatch
      });

      if (!archiveResult.success || !saveSummary) {
        const archiveErrMsg =
          archiveResult.errors.join(' | ') || 'Failed to archive previous statement batches.';
        setParseError(archiveErrMsg);
        toast.error(archiveErrMsg);
        return;
      }

      const fileId = `drcr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const finalRows = saveSummary.updatedRows || pendingReplacement.newRows;

      const entry: CombinedStatementFileEntry = {
        id: fileId,
        fileName: pendingReplacement.newFileName,
        fileSize: pendingReplacement.newFileSize,
        uploadedAt: new Date().toISOString(),
        fileHash: pendingReplacement.newFileHash,
        status:
          saveSummary.status === 'success'
            ? 'saved'
            : saveSummary.status === 'partial'
              ? 'partial'
              : saveSummary.status === 'failed'
                ? 'error'
                : 'parsed',
        errorMessage: saveSummary.errors.length > 0 ? saveSummary.errors.join(' | ') : undefined,
        totalRows: finalRows.length,
        debitCount: pendingReplacement.debitCount,
        creditCount: pendingReplacement.creditCount,
        reviewCount: pendingReplacement.reviewCount,
        duplicateCount: pendingReplacement.duplicateCount,
        saveSummary
      };

      if (saveSummary.creditSavedDone && pendingReplacement.newFileHash) {
        setDrCrCreditHashes(recordDrCrCreditHash(pendingReplacement.newFileHash));
      }

      setStagedFiles(prev => [entry, ...prev]);
      setRowsByFile(prev => ({ ...prev, [fileId]: finalRows }));
      setSelectedHistoryKey(null);
      setActiveFileId(fileId);
      setSectionFilter('all');

      if (saveSummary.status === 'success') {
        toast.success(
          `Replaced "${pendingReplacement.oldRecord.fileName}" with "${pendingReplacement.newFileName}".`
        );
      } else if (saveSummary.status === 'partial') {
        toast.error(
          `Old statement moved to Recycle Bin. Partial save: ${saveSummary.expensesSaved} Dr, ${saveSummary.creditsSaved} Cr saved; ${saveSummary.failedCount} failed (use Retry Failed).`
        );
      } else if (saveSummary.status === 'failed') {
        toast.error(
          `Old statement moved to Recycle Bin, but saving replacement failed: ${saveSummary.errors[0] || 'Unknown error'}`
        );
      }
      if ((saveSummary.ruleConflictCount || 0) > 0) {
        toast(
          `${saveSummary.ruleConflictCount} debit transaction(s) matched conflicting automation rules and were marked Uncategorized for manual review.`,
          { icon: '⚠️' }
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to replace combined statement.');
    } finally {
      setIsSaving(false);
      setPendingReplacement(null);
    }
  };

  const handleConfirmSave = async () => {
    if (!activeFile) return;

    setIsSaving(true);
    try {
      const saveSummary = await saveCombinedStatementTransactions({
        fileName: activeFile.fileName,
        fileHash: activeFile.fileHash,
        rows: activeRows,
        uploadExpenseBatch,
        uploadCreditBatch,
        previousSummary: activeFile.saveSummary
      });

      if (saveSummary.updatedRows) {
        setRowsByFile(prev => ({
          ...prev,
          [activeFile.id]: saveSummary.updatedRows!
        }));
      }

      if (saveSummary.creditSavedDone && activeFile.fileHash) {
        setDrCrCreditHashes(recordDrCrCreditHash(activeFile.fileHash));
      }

      setStagedFiles(prev =>
        prev.map(f =>
          f.id === activeFile.id
            ? {
                ...f,
                status:
                  saveSummary.status === 'success'
                    ? 'saved'
                    : saveSummary.status === 'partial'
                      ? 'partial'
                      : saveSummary.status === 'failed'
                        ? 'error'
                        : f.status,
                errorMessage:
                  saveSummary.errors.length > 0 ? saveSummary.errors.join(' | ') : undefined,
                saveSummary
              }
            : f
        )
      );

      setIsConfirmSaveOpen(false);

      if (saveSummary.status === 'success') {
        toast.success(
          `Saved ${saveSummary.expensesSaved} Expense(s) and ${saveSummary.creditsSaved} Credit(s).`
        );
      } else if (saveSummary.status === 'partial') {
        toast.error(
          `Partial save: ${saveSummary.expensesSaved} Expense(s), ${saveSummary.creditsSaved} Credit(s) saved; ${saveSummary.failedCount} failed.`
        );
      } else if (saveSummary.status === 'failed') {
        toast.error(saveSummary.errors[0] || 'Database save failed.');
      } else {
        toast('No new non-duplicate transactions to save.');
      }
      if ((saveSummary.ruleConflictCount || 0) > 0) {
        toast(
          `${saveSummary.ruleConflictCount} debit transaction(s) matched conflicting automation rules and were marked Uncategorized for manual review.`,
          { icon: '⚠️' }
        );
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to save combined statement transactions.';
      setParseError(msg);
      toast.error(msg);
      setIsConfirmSaveOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const canConfirmSave =
    !isHistoryView &&
    Boolean(activeFile) &&
    activeFile?.status !== 'saved' &&
    (summary.readyDebits.length > 0 || summary.readyCredits.length > 0) &&
    !isParsing &&
    !isSaving;

  const renderClassificationBadge = (classification: CombinedClassification) => {
    if (classification === 'debit') {
      return (
        <span className="px-2 py-0.5 rounded-md font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          Dr → Expense
        </span>
      );
    }
    if (classification === 'credit') {
      return (
        <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          Cr → Credit
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        Unclassified
      </span>
    );
  };

  const renderReviewStatusBadge = (tx: AnnotatedCombinedRow) => {
    if (tx.saveState === 'saved') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          Saved
        </span>
      );
    }
    if (tx.saveState === 'failed') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          Save Failed
        </span>
      );
    }
    if (tx.isDuplicate) {
      return (
        <span
          className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-700/70 text-slate-300 border border-slate-600"
          title={tx.duplicateReason}
        >
          Duplicate (Skipped)
        </span>
      );
    }
    if (tx.reviewStatus === 'ready') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
          Ready
        </span>
      );
    }
    if (tx.reviewStatus === 'zero_value') {
      return (
        <span
          className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-700/60 text-slate-400 border border-slate-600/70"
          title={tx.classificationReason}
        >
          Zero-Value Row
        </span>
      );
    }
    return (
      <span
        className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30"
        title={tx.classificationReason}
      >
        {tx.reviewStatus === 'ambiguous_both_populated'
          ? 'Both Dr & Cr Populated'
          : 'Needs Review'}
      </span>
    );
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/80 w-full rounded-2xl shadow-xl flex flex-col fade-in backdrop-blur-sm overflow-hidden text-slate-200 h-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesChange}
        accept=".pdf"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={replaceHistoryInputRef}
        onChange={handleReplaceFileSelected}
        accept=".pdf"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 border-b border-slate-700/60 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <ArrowLeftRight size={19} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
              Upload Dr &amp; Cr Statement
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Upload combined bank statement PDFs to extract, classify, and route Debit (Expense) and Credit (Credit) transactions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing || isSaving}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/25 flex items-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            <Upload size={15} />
            Upload Files
          </button>

          <button
            type="button"
            onClick={() => setIsConfirmSaveOpen(true)}
            disabled={!canConfirmSave}
            title={
              canConfirmSave
                ? 'Review and confirm before saving to Expense & Credit'
                : 'No ready non-duplicate Debit/Credit transactions to save'
            }
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border ${
              canConfirmSave
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/60 shadow-md shadow-emerald-600/20 active:scale-[0.98]'
                : 'bg-slate-800/80 text-slate-500 border-slate-700/80 cursor-not-allowed opacity-60'
            }`}
          >
            <CheckCircle2 size={15} />
            {isSaving
              ? 'Saving...'
              : activeFile?.status === 'partial' || activeFile?.status === 'error'
                ? 'Retry Failed'
                : 'Confirm & Save'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Split Content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Left Section: File History */}
        <div className="w-full lg:w-96 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-700/60 flex flex-col bg-slate-900/40">
          <div className="p-4 border-b border-slate-700/60 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                File History
              </h3>
            </div>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
              {stagedFiles.length + savedCombinedHistory.length}{' '}
              {stagedFiles.length + savedCombinedHistory.length === 1 ? 'file' : 'files'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
            {stagedFiles.length === 0 && savedCombinedHistory.length === 0 && !isLoadingExpenseImports && !isLoadingCreditImports ? (
              <div className="text-center p-8 bg-slate-900/30 rounded-xl border border-dashed border-slate-700/60">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <FileText size={22} />
                </div>
                <p className="text-sm font-semibold text-slate-200">No files uploaded</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click &apos;Upload Files&apos; to select a combined bank statement PDF.
                </p>
              </div>
            ) : (
              <>
                {stagedFiles.map(file => {
                  const isSelected = activeFileId === file.id;
                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        setSelectedHistoryKey(null);
                        setActiveFileId(file.id);
                        setSectionFilter('all');
                      }}
                      className={`border rounded-xl p-3 transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                        isSelected
                          ? 'border-purple-500/50 bg-purple-600/15 shadow-sm'
                          : 'border-slate-700/60 bg-slate-800/40 hover:border-slate-600/80 hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                            isSelected
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700/70'
                          }`}
                        >
                          <FileText size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4
                            className={`text-xs sm:text-sm font-semibold truncate leading-tight ${
                              isSelected ? 'text-purple-200' : 'text-slate-200 group-hover:text-white'
                            }`}
                            title={file.fileName}
                          >
                            {file.fileName}
                          </h4>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {formatDate(file.uploadedAt)} • {file.totalRows} rows •{' '}
                            <span
                              className={
                                file.status === 'saved'
                                  ? 'text-emerald-400'
                                  : file.status === 'partial'
                                    ? 'text-amber-400'
                                    : file.status === 'error'
                                      ? 'text-rose-400'
                                      : 'text-purple-300'
                              }
                            >
                              {file.status === 'saved'
                                ? 'Saved'
                                : file.status === 'partial'
                                  ? 'Partial Save'
                                  : file.status === 'error'
                                    ? 'Save Failed'
                                    : 'Ready to Confirm'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleRemoveFile(file.id);
                        }}
                        title="Remove from preview"
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}

                {savedCombinedHistory.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
                      Saved Combined Statements (Database)
                    </div>
                    <div className="space-y-2">
                      {savedCombinedHistory.map(imp => {
                        const isSelected = selectedHistoryKey === imp.key;
                        return (
                          <div
                            key={imp.key}
                            onClick={() => {
                              setActiveFileId(null);
                              setSelectedHistoryKey(imp.key);
                              setSectionFilter('all');
                            }}
                            className={`border rounded-xl p-2.5 flex items-center gap-2.5 transition-all cursor-pointer group ${
                              isSelected
                                ? 'border-purple-500/50 bg-purple-600/15 shadow-sm'
                                : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/80 hover:bg-slate-800/60'
                            }`}
                          >
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                                isSelected
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700/70'
                              }`}
                            >
                              <FileText size={15} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-xs font-semibold truncate ${
                                  isSelected ? 'text-purple-200' : 'text-slate-200 group-hover:text-white'
                                }`}
                                title={imp.fileName}
                              >
                                {imp.fileName}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {formatDate(imp.importedAt)} • {imp.totalSavedRows} row(s) (
                                {imp.expenseRows} Dr, {imp.creditRows} Cr) •{' '}
                                <span className="text-emerald-400">{imp.status}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setReplaceTargetRecord(imp);
                                  replaceHistoryInputRef.current?.click();
                                }}
                                disabled={isParsing || isSaving}
                                title="Replace Statement"
                                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500/40 text-slate-400 hover:text-purple-300 flex items-center justify-center transition-colors disabled:opacity-50"
                              >
                                <RefreshCw size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setHistoryRecordToDelete(imp);
                                }}
                                disabled={isParsing || isSaving}
                                title="Move to Recycle Bin"
                                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {parseError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 fade-in mt-4">
                <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-semibold text-rose-400">Validation Error</h4>
                  <p className="text-xs text-rose-300 mt-0.5">{parseError}</p>
                </div>
              </div>
            )}

            {isParsing && (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500/20 border-t-purple-500 mb-2"></div>
                <p className="text-xs font-medium text-slate-400">
                  Extracting &amp; classifying statement...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Normalized Transactions Preview */}
        <div className="flex-1 flex flex-col bg-slate-900/20 min-w-0">
          <div className="p-4 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Normalized Transactions Preview
              </h3>
            </div>

            {(activeFile || activeHistoryRecord) && (
              <div className="flex flex-wrap items-center gap-2">
                {(isHistoryView
                  ? (['all', 'debit', 'credit'] as const)
                  : (['all', 'debit', 'credit', 'review'] as const)
                ).map(filterKey => (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setSectionFilter(filterKey)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                      sectionFilter === filterKey
                        ? 'bg-purple-600 text-white border-purple-500/60'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-slate-200'
                    }`}
                  >
                    {filterKey === 'all'
                      ? `All Transactions (${summary.totalCount})`
                      : filterKey === 'debit'
                        ? `Debit (Dr) (${summary.debits.length})`
                        : filterKey === 'credit'
                          ? `Credit (Cr) (${summary.credits.length})`
                          : `Unclassified / Review (${summary.reviewRequiredCount})`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 p-4 overflow-hidden flex flex-col gap-4">
            {/* 4 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
              <div className="bg-slate-900/60 border border-purple-500/25 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-300">
                    Total Transactions
                  </span>
                  <div className="text-lg font-bold text-slate-100 mt-0.5">
                    {summary.totalCount}
                  </div>
                  <span className="text-[11px] text-slate-400">Extracted rows</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <ListChecks size={18} />
                </div>
              </div>

              <div className="bg-slate-900/60 border border-rose-500/25 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                    Debit Transactions
                  </span>
                  <div className="text-lg font-bold text-slate-100 mt-0.5">
                    {formatCurrency(summary.debitTotal)}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {summary.debits.length} Dr ({summary.readyDebits.length} ready)
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                  <ArrowUpRight size={18} />
                </div>
              </div>

              <div className="bg-slate-900/60 border border-emerald-500/25 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                    Credit Transactions
                  </span>
                  <div className="text-lg font-bold text-slate-100 mt-0.5">
                    {formatCurrency(summary.creditTotal)}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {summary.credits.length} Cr ({summary.readyCredits.length} ready)
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <ArrowDownLeft size={18} />
                </div>
              </div>

              <div
                className={`bg-slate-900/60 border rounded-xl p-3.5 flex items-center justify-between ${
                  summary.reviewRequiredCount > 0
                    ? 'border-amber-500/40'
                    : 'border-slate-700/70'
                }`}
              >
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                    Requires Review
                  </span>
                  <div className="text-lg font-bold text-slate-100 mt-0.5">
                    {summary.reviewRequiredCount}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {summary.unclassified.length} unclassified • {summary.duplicates.length} dup
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <AlertTriangle size={18} />
                </div>
              </div>
            </div>

            {/* Read-Only Saved Statement Summary Banner */}
            {activeHistoryRecord && (
              <div className="p-3.5 rounded-xl border bg-purple-500/10 border-purple-500/30 text-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-semibold text-purple-200 truncate">
                    Saved Statement Summary (Read-Only): {activeHistoryRecord.fileName}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Imported {formatDate(activeHistoryRecord.importedAt)} • Status:{' '}
                    <span className="text-emerald-400 font-semibold">{activeHistoryRecord.status}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 font-mono text-[11px] text-slate-200">
                  <span>Total Saved: {activeHistoryRecord.totalSavedRows}</span>
                  <span className="text-rose-300">Debit: {activeHistoryRecord.expenseRows}</span>
                  <span className="text-emerald-300">Credit: {activeHistoryRecord.creditRows}</span>
                </div>
              </div>
            )}

            {/* Save Summary Banner */}
            {activeFile?.saveSummary && (
              <div
                className={`p-3.5 rounded-xl border flex flex-col gap-2 shrink-0 ${
                  activeFile.saveSummary.status === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : activeFile.saveSummary.status === 'partial'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : activeFile.saveSummary.status === 'failed'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                        : 'bg-slate-800/80 border-slate-700 text-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                  <span>
                    Save Summary —{' '}
                    {activeFile.saveSummary.status === 'success'
                      ? 'Completed Successfully'
                      : activeFile.saveSummary.status === 'partial'
                        ? 'Partially Saved (Action Required)'
                        : activeFile.saveSummary.status === 'failed'
                          ? 'Save Failed'
                          : 'Nothing New to Save'}
                  </span>
                  <div className="flex flex-wrap gap-3 font-mono text-[11px]">
                    <span>Expenses Saved: {activeFile.saveSummary.expensesSaved}</span>
                    <span>Credits Saved: {activeFile.saveSummary.creditsSaved}</span>
                    <span>Skipped Duplicates: {activeFile.saveSummary.skippedDuplicates}</span>
                    <span>Requires Review: {activeFile.saveSummary.reviewRequired}</span>
                    {(activeFile.saveSummary.ruleConflictCount || 0) > 0 && (
                      <span className="text-amber-300">
                        Rule Conflicts: {activeFile.saveSummary.ruleConflictCount}
                      </span>
                    )}
                    <span>Failed: {activeFile.saveSummary.failedCount}</span>
                  </div>
                </div>
                {activeFile.saveSummary.errors.length > 0 && (
                  <p className="text-xs text-rose-300">
                    {activeFile.saveSummary.errors.join(' | ')}
                  </p>
                )}
              </div>
            )}

            {/* Unclassified / Duplicate Warning Banner */}
            {summary.unclassified.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 shrink-0">
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-amber-200">
                  {summary.unclassified.length} row(s) have zero-value, both Dr &amp; Cr populated,
                  or ambiguous amounts and are held as Unclassified. They will not be saved into
                  Expense or Credit automatically.
                </p>
              </div>
            )}

            {/* Preview Table / Empty State */}
            {!activeFile && !activeHistoryRecord ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700/60 rounded-2xl bg-slate-900/30 p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3.5 text-slate-400">
                  <ArrowLeftRight size={26} />
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  No combined statement selected
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Upload a bank statement PDF containing both Withdrawal (Dr) and Deposit (Cr)
                  columns to preview separated Expense and Credit transactions before saving.
                </p>
              </div>
            ) : (
              <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-700/60 shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-900/95 backdrop-blur-sm sticky top-0 z-20 border-b border-slate-700/70">
                      <tr>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12 text-center">
                          #
                        </th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Debit Amount
                        </th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Credit Amount
                        </th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Balance
                        </th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Classification
                        </th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Review Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredRows.map((tx, idx) => (
                        <tr key={tx.id || idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-xs text-slate-400 text-center font-medium">
                            {tx.sequence}
                          </td>
                          <td className="p-3 text-xs sm:text-sm text-slate-300 whitespace-nowrap">
                            {tx.transactionDate || '-'}
                          </td>
                          <td
                            className="p-3 text-xs text-slate-300 max-w-md truncate"
                            title={tx.description}
                          >
                            {tx.description || '-'}
                          </td>
                          <td className="p-3 text-xs sm:text-sm font-semibold text-rose-300 whitespace-nowrap">
                            {formatCurrency(tx.withdrawalAmount)}
                          </td>
                          <td className="p-3 text-xs sm:text-sm font-semibold text-emerald-300 whitespace-nowrap">
                            {formatCurrency(tx.depositAmount)}
                          </td>
                          <td className="p-3 text-xs text-slate-300 whitespace-nowrap font-mono">
                            {formatCurrency(tx.balance)}
                          </td>
                          <td className="p-3 text-xs whitespace-nowrap">
                            {renderClassificationBadge(tx.classification)}
                          </td>
                          <td className="p-3 text-xs whitespace-nowrap">
                            {renderReviewStatusBadge(tx)}
                          </td>
                        </tr>
                      ))}
                      {filteredRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-8 text-center text-sm text-slate-400 bg-slate-900/30"
                          >
                            No transactions match the selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Before Saving */}
      <ConfirmModal
        isOpen={isConfirmSaveOpen}
        title="Confirm Combined Statement Import"
        message={`Save ${summary.readyDebits.length} Debit transaction(s) to Expense and ${summary.readyCredits.length} Credit transaction(s) to Credit? (${summary.duplicates.length} duplicate(s) and ${summary.unclassified.length} unclassified row(s) will be skipped.)`}
        confirmText={isSaving ? 'Saving...' : 'Confirm & Save'}
        cancelText="Cancel"
        onConfirm={handleConfirmSave}
        onClose={() => setIsConfirmSaveOpen(false)}
      />

      {/* Delete Saved Combined Statement Confirmation */}
      <ConfirmModal
        isOpen={Boolean(historyRecordToDelete)}
        title="Move Combined Statement to Recycle Bin"
        message={
          historyRecordToDelete
            ? `Are you sure you want to move "${historyRecordToDelete.fileName}" (${historyRecordToDelete.expenseRows} Expense and ${historyRecordToDelete.creditRows} Credit transaction(s)) to the Finance Recycle Bin?`
            : ''
        }
        confirmText={isSaving ? 'Moving...' : 'Move to Recycle Bin'}
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleDeleteHistoryConfirm}
        onClose={() => setHistoryRecordToDelete(null)}
      />

      {/* Replace Saved Combined Statement Confirmation */}
      <ConfirmModal
        isOpen={Boolean(pendingReplacement)}
        title="Replace Combined Statement"
        message={
          pendingReplacement
            ? `Move "${pendingReplacement.oldRecord.fileName}" (${pendingReplacement.oldRecord.expenseRows} Expense, ${pendingReplacement.oldRecord.creditRows} Credit) to Recycle Bin and import "${pendingReplacement.newFileName}" (${pendingReplacement.debitCount} Debit, ${pendingReplacement.creditCount} Credit, ${pendingReplacement.reviewCount} Review)?`
            : ''
        }
        confirmText={isSaving ? 'Replacing...' : 'Replace Statement'}
        cancelText="Cancel"
        onConfirm={handleReplaceConfirm}
        onClose={() => setPendingReplacement(null)}
      />
    </div>
  );
};
