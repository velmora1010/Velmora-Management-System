import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, FileText, X, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { useCredits, FinanceCredit } from '../../hooks/finance/useCredits';
import { CreditPipelineEngine } from '../../utils/documentPipeline/CreditPipelineEngine';
import { DocumentType } from '../../utils/documentPipeline/types';

interface UploadCreditProps {
  onClose?: () => void;
}

export const UploadCredit = ({ onClose }: UploadCreditProps) => {
  const { imports, credits, fetchImports, uploadBatch, deleteBatch, isLoadingImports } = useCredits();
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileToReplace, setFileToReplace] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const formatDate = (value?: string | null, withFormat: boolean = true) => {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    if (withFormat) {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return d.toLocaleDateString();
  };

  const processFile = async (file: File, replacingBatchId: string | null = null) => {
    try {
      console.log(`[UploadCredit] 1. File selected: ${file.name}, size: ${file.size}`);

      // 1. Generate SHA-256 Hash
      console.log(`[UploadCredit] 2. Generating SHA-256 hash...`);
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const file_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      console.log(`[UploadCredit] SHA-256 Hash created: ${file_hash}`);

      // 2. Check for duplicates against credit_imports
      if (!replacingBatchId && imports.some(imp => imp.file_hash === file_hash)) {
        throw new Error(`File ${file.name} has already been imported as a Credit Statement.`);
      }

      // 3. Process via isolated CreditPipelineEngine
      console.log(`[UploadCredit] 3. Sending to CreditPipelineEngine...`);
      const { transactions, documentType } = await CreditPipelineEngine.process(file);
      console.log(`[UploadCredit] PipelineEngine returned Document Type: ${documentType}`);
      console.log(`[UploadCredit] PipelineEngine returned Transactions Count: ${transactions?.length}`);

      // 4. If replacing, delete old batch first
      if (replacingBatchId) {
        console.log(`[UploadCredit] Replacing existing batch: ${replacingBatchId}`);
        await deleteBatch(replacingBatchId);
      }

      // 5. Upload Batch (omitting automation rules per Phase 2E requirement)
      console.log(`[UploadCredit] 10. Calling uploadBatch() request...`);

      const mappedTransactions = transactions.map(tx => {
        let parsedDateForCreatedAt: Date | null = null;
        let pureTransactionDate: string | null = null;

        if (tx.date) {
          const parts = tx.date.split(/[\/\-]/);
          if (parts.length === 3) {
            if (!isNaN(Number(parts[1]))) {
              parsedDateForCreatedAt = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            } else {
              parsedDateForCreatedAt = new Date(tx.date);
            }

            const day = parts[0].padStart(2, '0');
            let month = parts[1];
            const year = parts[2];

            if (isNaN(Number(month))) {
              const monthMap: Record<string, string> = {
                jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
              };
              month = monthMap[month.toLowerCase()] || '01';
            } else {
              month = month.padStart(2, '0');
            }
            pureTransactionDate = `${year}-${month}-${day}`;
          } else {
            parsedDateForCreatedAt = new Date(tx.date);
            pureTransactionDate = tx.date;
          }

          if (parsedDateForCreatedAt && isNaN(parsedDateForCreatedAt.getTime())) {
            parsedDateForCreatedAt = null;
          }
        }

        let validIsoPostedDateTime: string | null = null;
        if (tx.postedDateTime) {
          const match = tx.postedDateTime.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(.*)/);
          if (match) {
            const day = match[1];
            const month = match[2];
            const year = match[3];
            const time = match[4];
            const d = new Date(`${month}/${day}/${year} ${time}`);
            if (!isNaN(d.getTime())) {
              validIsoPostedDateTime = d.toISOString();
            }
          } else {
            const d = new Date(tx.postedDateTime);
            if (!isNaN(d.getTime())) validIsoPostedDateTime = d.toISOString();
          }
        }

        return {
          sequence: tx.sequence || 0,
          transaction_date: pureTransactionDate,
          posted_datetime: validIsoPostedDateTime,
          created_at: parsedDateForCreatedAt ? parsedDateForCreatedAt.toISOString() : null,
          amount: tx.amount,
          notes: tx.notes || '',
          source: 'Unknown Source', // 'source' instead of 'vendor'
          main_category: 'Uncategorized', // No rule engine yet
          sub_category1: null,
          sub_category2: null,
          payment_mode: 'Bank Transfer',
          bank_account: null
        } as FinanceCredit;
      });

      const result = await uploadBatch(file.name, file_hash, mappedTransactions);
      console.log(`[UploadCredit] 11. uploadBatch() Response:`, result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to upload batch to database.');
      }

      return result.batch_id;
    } catch (e: any) {
      console.error(`[UploadCredit] 12. Caught exception in processFile:`, e);
      throw e;
    }
  };

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const filesArray = Array.from(e.target.files);
      let lastBatchId = null;

      for (const file of filesArray) {
        lastBatchId = await processFile(file);
      }

      if (lastBatchId) setActiveBatchId(lastBatchId);
    } catch (err: any) {
      console.error("Pipeline parse error:", err);
      setParseError(err.message || "Failed to parse one or more files.");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReplaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !fileToReplace) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const file = e.target.files[0];
      const newBatchId = await processFile(file, fileToReplace);
      setActiveBatchId(newBatchId);
    } catch (err: any) {
      console.error("Pipeline replace error:", err);
      setParseError(err.message || "Failed to replace file.");
    } finally {
      setIsParsing(false);
      setFileToReplace(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const removeFile = async (batchId: string) => {
    try {
      setIsParsing(true);
      await deleteBatch(batchId);
      if (activeBatchId === batchId) {
        setActiveBatchId(null);
      }
    } catch (err) {
      console.error("Failed to delete", err);
    } finally {
      setIsParsing(false);
    }
  };

  const triggerReplace = (batchId: string) => {
    setFileToReplace(batchId);
    replaceInputRef.current?.click();
  };

  const activeImport = imports.find(i => i.batch_id === activeBatchId);
  const activeFileCredits = credits
    .filter(e => e.import_batch_id === activeBatchId)
    .sort((a, b) => {
      // Sort by sequence ASC
      if (a.sequence && b.sequence && a.sequence !== b.sequence) {
        return a.sequence - b.sequence;
      }
      // Fallback to transaction_date ASC
      if (a.transaction_date && b.transaction_date) {
        return new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
      }
      // Preserve existing order if both are missing
      return 0;
    });

  // Debug Preview Binding
  console.log("=== PREVIEW DEBUG ===");
  console.log("Selected batchId:", activeBatchId);
  console.log("Total credits in memory:", credits.length);
  if (credits.length > 0) {
    console.log("Sample credit object from memory:", credits[0]);
  }
  console.log("Transactions returned (activeFileCredits):", activeFileCredits);
  console.log("previewTransactions.length:", activeFileCredits.length);
  if (activeFileCredits.length > 0) {
    console.log("First transaction object:", activeFileCredits[0]);
  }
  console.log("=====================");

  // Create virtual headers based on credits mapping
  const previewHeaders = ['Date', 'Amount', 'Description', 'Source', 'Main Category', 'Sub Category 1', 'Sub Category 2'];

  return (
    <div className="bg-slate-800/60 border border-slate-700/80 w-full rounded-2xl shadow-xl flex flex-col fade-in backdrop-blur-sm overflow-hidden text-slate-200 h-full min-h-[620px]">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesChange}
        accept=".xlsx, .xls, .pdf"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={replaceInputRef}
        onChange={handleReplaceChange}
        accept=".xlsx, .xls, .pdf"
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-700/60 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Upload size={19} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">Upload Credit Statements</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Bulk import credit transactions using Bank Statement PDFs.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/25 flex items-center gap-2 active:scale-[0.98]"
          >
            <Upload size={15} />
            Upload Files
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

        {/* Left Section: Files List */}
        <div className="w-full lg:w-96 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-700/60 flex flex-col bg-slate-900/40">
          <div className="p-4 border-b border-slate-700/60 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Import History
              </h3>
            </div>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
              {imports.length} {imports.length === 1 ? 'file' : 'files'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
            {isLoadingImports ? (
              <div className="text-center p-6">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500/20 border-t-purple-500 mx-auto mb-2"></div>
                <p className="text-xs text-slate-400">Loading history...</p>
              </div>
            ) : imports.length === 0 ? (
              <div className="text-center p-8 bg-slate-900/30 rounded-xl border border-dashed border-slate-700/60">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <FileSpreadsheet size={22} />
                </div>
                <p className="text-sm font-semibold text-slate-200">No files uploaded</p>
                <p className="text-xs text-slate-400 mt-1">Click &apos;Upload Files&apos; to begin importing.</p>
              </div>
            ) : (
              imports.map(file => {
                const isPdf = file.file_name.toLowerCase().endsWith('.pdf');
                const isSelected = activeBatchId === file.batch_id;
                return (
                  <div
                    key={file.batch_id}
                    onClick={() => setActiveBatchId(file.batch_id)}
                    className={`border rounded-xl p-3 transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                      isSelected
                        ? 'border-purple-500/50 bg-purple-600/15 shadow-sm'
                        : 'border-slate-700/60 bg-slate-800/40 hover:border-slate-600/80 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                        isSelected
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700/70'
                      }`}>
                        {isPdf ? <FileText size={17} /> : <FileSpreadsheet size={17} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs sm:text-sm font-semibold truncate leading-tight ${isSelected ? 'text-purple-200' : 'text-slate-200 group-hover:text-white'}`} title={file.file_name}>
                          {file.file_name}
                        </h4>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate flex items-center gap-1.5">
                          <span>{formatDate(file.created_at)}</span>
                          <span>•</span>
                          <span>{file.transaction_count} {file.transaction_count === 1 ? 'tx' : 'txs'}</span>
                          {file.import_status && (
                            <>
                              <span>•</span>
                              <span className={`capitalize ${file.import_status.toLowerCase() === 'completed' ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {file.import_status}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); triggerReplace(file.batch_id); }}
                        title="Replace File"
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500/40 text-slate-400 hover:text-purple-300 flex items-center justify-center transition-colors"
                      >
                        <RefreshCw size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(file.batch_id); }}
                        title="Delete File"
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Error State */}
            {parseError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 fade-in mt-4">
                <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-semibold text-rose-400">Validation Error</h4>
                  <p className="text-xs text-rose-300 mt-0.5">{parseError}</p>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isParsing && (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500/20 border-t-purple-500 mb-2"></div>
                <p className="text-xs font-medium text-slate-400">Processing document...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: File Data Preview */}
        <div className="flex-1 flex flex-col bg-slate-900/20 min-w-0">
          <div className="p-4 border-b border-slate-700/60 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Normalized Transactions Preview
              </h3>
            </div>
            {activeImport && (
              <div className="text-xs text-purple-300 font-semibold bg-purple-500/10 px-3 py-1 rounded-lg border border-purple-500/20">
                Imported Rows: {activeImport.transaction_count}
              </div>
            )}
          </div>

          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            {!activeImport ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700/60 rounded-2xl bg-slate-900/30 p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3.5 text-slate-400">
                  <FileSpreadsheet size={28} />
                </div>
                <p className="text-sm font-semibold text-slate-200">No document selected</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Select an uploaded document from the history list to preview and review extracted normalized transactions.
                </p>
              </div>
            ) : (
              <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-700/60 shadow-sm overflow-hidden flex flex-col relative fade-in">
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-900/95 backdrop-blur-sm sticky top-0 z-20 border-b border-slate-700/70 shadow-sm">
                      <tr>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-900/95 backdrop-blur-sm z-30 shadow-[1px_0_0_0_rgba(255,255,255,0.05)] w-12 text-center">
                          #
                        </th>
                        {previewHeaders.map((header, idx) => (
                          <th key={idx} className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {activeFileCredits.map((credit, rowIdx) => (
                        <tr key={credit.id || rowIdx} className="hover:bg-slate-800/40 transition-colors group">
                          <td className="p-3 text-xs text-slate-400 border-r border-slate-800/80 sticky left-0 bg-slate-900 group-hover:bg-slate-850 transition-colors z-10 text-center font-medium shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
                            {rowIdx + 1}
                          </td>
                          <td className="p-3 text-xs sm:text-sm text-slate-300 whitespace-nowrap">{formatDate(credit.transaction_date, false)}</td>
                          <td className="p-3 text-xs sm:text-sm font-bold text-slate-100 whitespace-nowrap">
                            ₹{credit.amount != null ? Number(credit.amount).toLocaleString('en-IN') : '-'}
                          </td>
                          <td className="p-3 text-xs text-slate-300 max-w-xs truncate" title={credit.notes || ''}>{credit.notes || '-'}</td>
                          <td className="p-3 text-xs text-slate-300 whitespace-nowrap">{credit.source || '-'}</td>
                          <td className="p-3 text-xs text-slate-300 whitespace-nowrap">{credit.main_category || '-'}</td>
                          <td className="p-3 text-xs text-slate-300 whitespace-nowrap">{credit.sub_category1 || '-'}</td>
                          <td className="p-3 text-xs text-slate-300 whitespace-nowrap">{credit.sub_category2 || '-'}</td>
                        </tr>
                      ))}
                      {activeFileCredits.length === 0 && (
                        <tr>
                          <td colSpan={previewHeaders.length + 1} className="p-8 text-center text-sm text-slate-400 bg-slate-900/30">
                            No imported transactions found in this statement.
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
    </div>
  );
};
