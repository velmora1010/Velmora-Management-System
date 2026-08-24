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
    <div className="bg-card w-full rounded-2xl shadow-sm border border-border flex flex-col fade-in text-slate-200 h-full">
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
      <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-bold text-main">Upload Credit Statements</h2>
          <p className="text-sm text-muted mt-1">Bulk import credit transactions using Bank Statement PDFs.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110 flex items-center gap-2"
          >
            <Upload size={16} />
            Upload Files
          </button>
          
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 text-muted hover:text-main bg-background rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-border"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        
        {/* Left Section: Files List */}
        <div className="w-full lg:w-96 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border flex flex-col bg-background/30">
          <div className="p-4 border-b border-border bg-card">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">
              Import History
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {isLoadingImports ? (
              <div className="text-center p-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-xs text-muted">Loading history...</p>
              </div>
            ) : imports.length === 0 ? (
              <div className="text-center p-8">
                <FileSpreadsheet size={40} className="mx-auto text-muted/50 mb-3" />
                <p className="text-sm font-medium text-main">No files uploaded</p>
                <p className="text-xs text-muted mt-1">Click Upload Files to begin.</p>
              </div>
            ) : (
              imports.map(file => {
                const isPdf = file.file_name.toLowerCase().endsWith('.pdf');
                return (
                  <div 
                    key={file.batch_id} 
                    onClick={() => setActiveBatchId(file.batch_id)}
                    className={`border rounded-xl p-2.5 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      activeBatchId === file.batch_id 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-border/60 bg-card hover:border-border hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                        {isPdf ? <FileText size={16} /> : <FileSpreadsheet size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-main truncate leading-tight" title={file.file_name}>
                          {file.file_name}
                        </h4>
                        <div className="text-[11px] text-muted mt-0.5">
                          {formatDate(file.created_at)} • {file.transaction_count} transactions
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); triggerReplace(file.batch_id); }}
                        title="Replace File"
                        className="w-8 h-8 rounded-md bg-background border border-border text-main hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(file.batch_id); }}
                        title="Delete File"
                        className="w-8 h-8 rounded-md text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Error State */}
            {parseError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 fade-in mt-4">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-semibold text-red-500">Validation Error</h4>
                  <p className="text-xs text-red-400 mt-0.5">{parseError}</p>
                </div>
              </div>
            )}
            
            {/* Loading State */}
            {isParsing && (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                <p className="text-xs font-medium text-muted">Processing document...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: File Data Preview */}
        <div className="flex-1 flex flex-col bg-card min-w-0">
          <div className="p-4 border-b border-border flex items-center justify-between bg-card">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">
              Normalized Transactions Preview
            </h3>
            {activeImport && (
              <div className="text-xs text-muted font-medium bg-background px-3 py-1.5 rounded-lg border border-border">
                Imported Rows: {activeImport.transaction_count}
              </div>
            )}
          </div>
          
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            {!activeImport ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-2xl bg-background/30">
                <FileSpreadsheet size={48} className="text-muted/30 mb-4" />
                <p className="text-sm font-medium text-muted">No document selected</p>
                <p className="text-xs text-muted mt-2">Select a document from history to view extracted transactions.</p>
              </div>
            ) : (
              <div className="flex-1 bg-background rounded-2xl border border-border/50 shadow-sm overflow-hidden flex flex-col relative fade-in">
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-background/95 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                      <tr>
                        <th className="p-3 text-xs font-semibold text-muted uppercase tracking-wider border-b border-border/50 sticky left-0 bg-background/95 backdrop-blur-sm z-30 shadow-[1px_0_0_0_rgba(255,255,255,0.05)] dark:shadow-[1px_0_0_0_rgba(0,0,0,0.1)] w-12 text-center">
                          #
                        </th>
                        {previewHeaders.map((header, idx) => (
                          <th key={idx} className="p-3 text-xs font-semibold text-muted uppercase tracking-wider border-b border-border/50 whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {activeFileCredits.map((credit, rowIdx) => (
                        <tr key={credit.id || rowIdx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                          <td className="p-3 text-xs text-muted border-r border-border/50 sticky left-0 bg-background group-hover:bg-card transition-colors z-10 text-center font-medium shadow-[1px_0_0_0_rgba(255,255,255,0.05)] dark:shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                            {rowIdx + 1}
                          </td>
                          <td className="p-3 text-sm text-main whitespace-nowrap">{formatDate(credit.transaction_date, false)}</td>
                          <td className="p-3 text-sm text-main whitespace-nowrap">{credit.amount}</td>
                          <td className="p-3 text-sm text-main max-w-xs truncate" title={credit.notes || ''}>{credit.notes || '-'}</td>
                          <td className="p-3 text-sm text-main whitespace-nowrap">{credit.source || '-'}</td>
                          <td className="p-3 text-sm text-main whitespace-nowrap">{credit.main_category || '-'}</td>
                          <td className="p-3 text-sm text-main whitespace-nowrap">{credit.sub_category1 || '-'}</td>
                          <td className="p-3 text-sm text-main whitespace-nowrap">{credit.sub_category2 || '-'}</td>
                        </tr>
                      ))}
                      {activeFileCredits.length === 0 && (
                        <tr>
                          <td colSpan={previewHeaders.length + 1} className="p-8 text-center text-sm text-muted bg-card">
                            No imported transactions found.
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
