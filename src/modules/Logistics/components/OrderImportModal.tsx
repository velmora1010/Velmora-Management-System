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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewError(null);
    setValidationResult(null);
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
      const res = await commitCustomerOrdersImport(validationResult.orders);
      toast.success(
        `Import complete!\n• ${res.insertedActive} orders placed into Active\n• ${res.insertedPending} orders in Pending review\n• ${res.insertedTracking} placed into Tracking`,
        { duration: 5000 }
      );
      onImportSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Import failed: ' + (err.message || 'Database error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#0b1220] border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
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
                Supports Shopify CSV/Excel exports & custom order spreadsheets
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
              Validates fulfillment eligibility, eliminates duplicates, and routes orders
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
              <span>Analyzing orders, line items, and fulfillment statuses...</span>
            </div>
          )}

          {previewError && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl flex items-center gap-3 text-rose-300 text-xs">
              <AlertCircle size={18} className="shrink-0 text-rose-400" />
              <span>{previewError}</span>
            </div>
          )}

          {/* Validation Breakdown Summary */}
          {validationResult && !isParsing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-slate-400 font-medium">TOTAL ORDERS</span>
                  <span className="text-base font-bold text-white mt-1 font-mono">
                    {validationResult.totalUniqueOrders}
                  </span>
                  <span className="text-[10px] text-slate-500">{validationResult.totalRows} file rows</span>
                </div>

                <div className="bg-purple-950/30 border border-purple-800/50 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-purple-300 font-medium">ELIGIBLE ACTIVE</span>
                  <span className="text-base font-bold text-purple-300 mt-1 font-mono">
                    {validationResult.eligibleActiveCount}
                  </span>
                  <span className="text-[10px] text-purple-400/70">Awaiting dispatch</span>
                </div>

                <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-amber-300 font-medium">PENDING REVIEW</span>
                  <span className="text-base font-bold text-amber-300 mt-1 font-mono">
                    {validationResult.pendingCount}
                  </span>
                  <span className="text-[10px] text-amber-400/70">Missing phone/address</span>
                </div>

                <div className="bg-cyan-950/30 border border-cyan-800/50 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-cyan-300 font-medium">ALREADY FULFILLED</span>
                  <span className="text-base font-bold text-cyan-300 mt-1 font-mono">
                    {validationResult.alreadyFulfilledCount}
                  </span>
                  <span className="text-[10px] text-cyan-400/70">Routes to Tracking</span>
                </div>
              </div>

              {(validationResult.cancelledCount > 0 || validationResult.duplicateCount > 0) && (
                <div className="flex items-center gap-3 px-3 py-2 bg-slate-900/50 border border-slate-800/80 rounded-xl text-xs text-slate-400">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <span>
                    Auto-skipping: 
                    {validationResult.cancelledCount > 0 && ` ${validationResult.cancelledCount} cancelled/refunded`}
                    {validationResult.cancelledCount > 0 && validationResult.duplicateCount > 0 && ' and'}
                    {validationResult.duplicateCount > 0 && ` ${validationResult.duplicateCount} existing duplicates`}
                  </span>
                </div>
              )}

              {/* Sample Order Preview List */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 flex items-center justify-between">
                  <span>PREVIEW (FIRST 8 ORDERS)</span>
                  <span className="text-slate-500 font-normal">Fulfillment Routing</span>
                </div>

                <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto custom-scrollbar">
                  {validationResult.orders.slice(0, 8).map((ord) => (
                    <div key={ord.orderId} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/40">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-slate-200">#{ord.orderId}</span>
                        <span className="text-[11px] text-slate-400">{ord.customerName} • {ord.products}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {ord.isEligibleActive ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800/60">
                            → Active
                          </span>
                        ) : ord.isAlreadyFulfilled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                            → Tracking
                          </span>
                        ) : ord.isCancelled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/60">
                            Skipped (Cancelled)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                            → Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer border border-slate-700/80"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!validationResult || isProcessing || (validationResult.eligibleActiveCount === 0 && validationResult.pendingCount === 0 && validationResult.alreadyFulfilledCount === 0)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer shadow-lg shadow-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Importing Orders...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>
                  Confirm & Import ({(validationResult?.eligibleActiveCount || 0) + (validationResult?.pendingCount || 0)} Orders)
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
