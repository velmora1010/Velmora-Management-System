import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle,
  Package,
  Layers,
  HelpCircle,
  Truck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { 
  parseAndValidateCustomerOrders, 
  commitCustomerOrdersImport, 
  type ImportValidationResult 
} from '../../../services/logisticsOrderImportService';

interface OrderImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const OrderImportModal: React.FC<OrderImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess
}) => {
  if (!isOpen) return null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);

  const [previewTab, setPreviewTab] = useState<'all' | 'new' | 'update' | 'unchanged' | 'conflicts'>('all');
  const [importSummary, setImportSummary] = useState<any | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewError(null);
    setValidationResult(null);
    setImportSummary(null);
    setPreviewTab('all');
    setIsParsing(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet) as any[];

      if (json.length === 0) {
        setPreviewError('The uploaded file contains no data rows.');
        return;
      }

      const res = await parseAndValidateCustomerOrders(json);
      setValidationResult(res);
    } catch (err: any) {
      setPreviewError('Failed to parse spreadsheet: ' + (err.message || 'Unknown format'));
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!validationResult || validationResult.orders.length === 0) return;
    setIsProcessing(true);

    try {
      const res = await commitCustomerOrdersImport(validationResult.orders, validationResult);
      setImportSummary(res);
      toast.success(
        `Import complete: ${res.inserted} inserted, ${res.updated} updated, ${res.unchanged} unchanged.`
      );
      onImportSuccess();
    } catch (err: any) {
      toast.error('Import failed: ' + (err.message || 'Database error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#0b1220] border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-300">
              <UploadCloud size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Import Customer Orders</h2>
                {validationResult?.isShopifyFormat && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-400 border border-emerald-700/60">
                    Shopify Export
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Upsert-aware: Safely updates existing orders without duplicates or stage resets
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700/60"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
          
          {/* Post-Import Results View */}
          {importSummary ? (
            <div className="space-y-5 animate-fade-in py-2">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-700/60 flex items-center justify-center text-emerald-400 mx-auto mb-3 shadow-lg">
                  <CheckCircle2 size={30} />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Import Completed Successfully</h3>
                <p className="text-xs text-slate-400">
                  Customer records in Logistics have been safely updated and synchronized.
                </p>
              </div>

              {/* Results Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                <div className="bg-purple-950/30 border border-purple-800/50 rounded-2xl p-3 flex flex-col text-center">
                  <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Inserted</span>
                  <span className="text-xl font-bold text-white font-mono mt-1">{importSummary.inserted}</span>
                  <span className="text-[10px] text-purple-400/80">New orders</span>
                </div>

                <div className="bg-blue-950/30 border border-blue-800/50 rounded-2xl p-3 flex flex-col text-center">
                  <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Updated</span>
                  <span className="text-xl font-bold text-blue-300 font-mono mt-1">{importSummary.updated}</span>
                  <span className="text-[10px] text-blue-400/80">Existing enriched</span>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex flex-col text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unchanged</span>
                  <span className="text-xl font-bold text-slate-300 font-mono mt-1">{importSummary.unchanged}</span>
                  <span className="text-[10px] text-slate-500">Already up-to-date</span>
                </div>

                <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-3 flex flex-col text-center">
                  <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">Skipped</span>
                  <span className="text-xl font-bold text-amber-300 font-mono mt-1">{importSummary.skipped}</span>
                  <span className="text-[10px] text-amber-400/80">Cancelled/Invalid</span>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3 flex flex-col text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Failed</span>
                  <span className="text-xl font-bold text-emerald-400 font-mono mt-1">{importSummary.failed}</span>
                  <span className="text-[10px] text-slate-500">Errors encountered</span>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
                <h4 className="font-bold text-slate-200">Execution Details:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span>Added to Active queue: <strong className="text-white">{importSummary.insertedActive}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span>Updated existing records: <strong className="text-white">{importSummary.updated}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>Routed to Tracking: <strong className="text-white">{importSummary.insertedTracking}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Placed in Pending review: <strong className="text-white">{importSummary.insertedPending}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* File Picker Zone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700/80 hover:border-purple-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/40 group"
              >
                <FileSpreadsheet size={36} className="text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-semibold text-white">
                  {file ? file.name : 'Click to select spreadsheet (.xlsx, .xls, .csv)'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports re-uploading updated orders safely without duplicates or erasing dispatch stages
                </p>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".xlsx,.xls,.csv" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </div>

              {isParsing && (
                <div className="p-6 text-center text-xs text-purple-300 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing order IDs, customer details, and database diffs...</span>
                </div>
              )}

              {previewError && (
                <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl flex items-center gap-3 text-rose-300 text-xs">
                  <AlertCircle size={18} className="shrink-0 text-rose-400" />
                  <span>{previewError}</span>
                </div>
              )}

              {/* Upsert Preview Breakdown */}
              {validationResult && !isParsing && (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col">
                      <span className="text-[10px] text-slate-400 font-medium">TOTAL ROWS</span>
                      <span className="text-base font-bold text-white mt-1 font-mono">
                        {validationResult.totalRows}
                      </span>
                      <span className="text-[10px] text-slate-500">{validationResult.totalUniqueOrders} unique IDs</span>
                    </div>

                    <div className="bg-purple-950/30 border border-purple-800/50 rounded-2xl p-3 flex flex-col">
                      <span className="text-[10px] text-purple-300 font-medium">NEW ORDERS</span>
                      <span className="text-base font-bold text-purple-300 mt-1 font-mono">
                        {validationResult.newOrdersCount}
                      </span>
                      <span className="text-[10px] text-purple-400/70">Will be inserted</span>
                    </div>

                    <div className="bg-blue-950/30 border border-blue-800/50 rounded-2xl p-3 flex flex-col">
                      <span className="text-[10px] text-blue-300 font-medium">EXISTING TO UPDATE</span>
                      <span className="text-base font-bold text-blue-300 mt-1 font-mono">
                        {validationResult.updateOrdersCount}
                      </span>
                      <span className="text-[10px] text-blue-400/70">Fields enriched</span>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex flex-col">
                      <span className="text-[10px] text-slate-400 font-medium">UNCHANGED</span>
                      <span className="text-base font-bold text-slate-300 mt-1 font-mono">
                        {validationResult.unchangedCount}
                      </span>
                      <span className="text-[10px] text-slate-500">Already identical</span>
                    </div>

                    <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-3 flex flex-col">
                      <span className="text-[10px] text-amber-300 font-medium">SKIPPED / INVALID</span>
                      <span className="text-base font-bold text-amber-300 mt-1 font-mono">
                        {validationResult.cancelledCount + validationResult.invalidCount}
                      </span>
                      <span className="text-[10px] text-amber-400/70">Cancelled/Empty</span>
                    </div>
                  </div>

                  {/* Conflicting rows alert if any */}
                  {validationResult.conflictCount > 0 && (
                    <div className="flex items-center gap-3 px-3.5 py-2.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
                      <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                      <div>
                        <strong className="font-semibold text-rose-200">
                          {validationResult.conflictCount} Conflicting Rows Detected:
                        </strong>
                        <span className="ml-1 text-[11px] text-rose-300/90">
                          Existing shipments will retain their courier/AWB and stage. Review below.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Preview Tabs */}
                  <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                    <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs gap-2 overflow-x-auto">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewTab('all')}
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                            previewTab === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          All ({validationResult.orders.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewTab('new')}
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                            previewTab === 'new' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          New ({validationResult.newOrdersCount})
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewTab('update')}
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                            previewTab === 'update' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          To Update ({validationResult.updateOrdersCount})
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewTab('unchanged')}
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                            previewTab === 'unchanged' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Unchanged ({validationResult.unchangedCount})
                        </button>

                        {validationResult.conflictCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setPreviewTab('conflicts')}
                            className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                              previewTab === 'conflicts' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-rose-200'
                            }`}
                          >
                            Conflicts ({validationResult.conflictCount})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Preview List */}
                    <div className="divide-y divide-slate-800/60 max-h-52 overflow-y-auto custom-scrollbar">
                      {previewTab === 'update' ? (
                        validationResult.updatePlans.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">No existing orders have updates</div>
                        ) : (
                          validationResult.updatePlans.map(plan => (
                            <div key={plan.orderId} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/40">
                              <div className="flex flex-col max-w-[70%]">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-200">#{plan.orderId}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800/60 font-semibold">
                                    Stage: {plan.currentStage}
                                  </span>
                                </div>
                                <span className="text-[11px] text-blue-300 mt-0.5">
                                  Fields to update: <strong className="text-white">{plan.changedFields.join(', ')}</strong>
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800/60">
                                Will Update
                              </span>
                            </div>
                          ))
                        )
                      ) : previewTab === 'conflicts' ? (
                        validationResult.conflictingOrders.map((c, i) => (
                          <div key={i} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/40 bg-rose-950/10">
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-rose-300">#{c.orderId}</span>
                              <span className="text-[11px] text-rose-400/90">{c.reason}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/60">
                              Conflict Flagged
                            </span>
                          </div>
                        ))
                      ) : (
                        (previewTab === 'new' 
                          ? validationResult.newOrders 
                          : previewTab === 'unchanged' 
                          ? validationResult.unchangedOrders 
                          : validationResult.orders
                        ).slice(0, 15).map(ord => (
                          <div key={ord.orderId} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/40">
                            <div className="flex flex-col max-w-[70%]">
                              <span className="font-mono font-bold text-slate-200">#{ord.orderId}</span>
                              <span className="text-[11px] text-slate-400 truncate">
                                {ord.customerName} • {ord.products}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {ord.isNew ? (
                                ord.isEligibleActive ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800/60">
                                    New → Active
                                  </span>
                                ) : ord.isAlreadyFulfilled ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                                    New → Tracking
                                  </span>
                                ) : ord.isCancelled ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/60">
                                    Skipped (Cancelled)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                                    New → Pending
                                  </span>
                                )
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-400 border border-slate-800">
                                  Existing Order
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer border border-slate-700/80"
          >
            {importSummary ? 'Close' : 'Cancel'}
          </button>

          {!importSummary && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!validationResult || isProcessing || (validationResult.newOrdersCount === 0 && validationResult.updateOrdersCount === 0)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer shadow-lg shadow-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing Upsert Import...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>
                    Confirm & Import ({(validationResult?.newOrdersCount || 0) + (validationResult?.updateOrdersCount || 0)} Orders)
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

