import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Truck,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { 
  analyzeCourierTrackingFile, 
  commitCourierTrackingUpdates, 
  type TrackingFileAnalysisResult,
  type TrackingMatchClassification
} from '../../../services/courierTrackingFileService';
import { CONFIGURED_COURIERS } from '../../../config/courierConfig';

interface CourierTrackingImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncSuccess?: () => void;
  onImportSuccess?: () => void;
}

export const CourierTrackingImportModal: React.FC<CourierTrackingImportModalProps> = ({
  isOpen,
  onClose,
  onSyncSuccess,
  onImportSuccess
}) => {
  if (!isOpen) return null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCourier, setSelectedCourier] = useState<string>('Delhivery');
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TrackingFileAnalysisResult | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'reconciled' | 'matched' | 'unmatched'>('all');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setAnalysisResult(null);
    setIsAnalyzing(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (json.length === 0) {
        toast.error('The uploaded file is empty.');
        return;
      }

      const res = await analyzeCourierTrackingFile(json, selectedCourier);
      setAnalysisResult(res);
    } catch (err: any) {
      toast.error('Failed to parse courier report: ' + (err.message || 'Unknown error'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmApply = async () => {
    if (!analysisResult || analysisResult.matchedCount === 0) return;
    setIsApplying(true);

    try {
      const res = await commitCourierTrackingUpdates(analysisResult.previewItems);
      if (res.errors.length === 0) {
        toast.success(`Successfully updated ${res.updatedCount} shipments in Dexie & Supabase!`);
        if (onSyncSuccess) onSyncSuccess();
        if (onImportSuccess) onImportSuccess();
        onClose();
      } else {
        toast.error('Partial error: ' + res.errors.join(', '));
      }
    } catch (err: any) {
      toast.error('Update failed: ' + err.message);
    } finally {
      setIsApplying(false);
    }
  };

  const filteredPreviewItems = (analysisResult?.previewItems || []).filter(item => {
    if (previewFilter === 'reconciled') {
      return item.classification === 'AWB_MISMATCH' || item.classification === 'COURIER_MISMATCH' || item.classification === 'BOTH_MISMATCH' || item.classification === 'NEW_ASSIGNMENT';
    }
    if (previewFilter === 'matched') {
      return item.isMatched;
    }
    if (previewFilter === 'unmatched') {
      return !item.isMatched;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#0b1220] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
              <Truck size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Upload Courier Tracking Report</h2>
              <p className="text-xs text-slate-400">
                Authoritative Order ID matching, AWB reconciliation, and live status synchronization
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
          {/* Courier Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Courier Report Format (Auto-detected if format contains courier headers)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CONFIGURED_COURIERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCourier(c.name);
                    setAnalysisResult(null);
                    setFile(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                    selectedCourier === c.name
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Truck size={13} className={selectedCourier === c.name ? 'text-white' : 'text-purple-400'} />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File Picker Zone */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700/80 hover:border-purple-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/40 group"
          >
            <FileSpreadsheet size={36} className="text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-semibold text-white">
              {file ? file.name : `Click to select ${selectedCourier} tracking report (.xlsx, .csv)`}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports Reference No., Waybill, Consignee Name, Payment Mode, Dates, and Remarks
            </p>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
              onChange={handleFileChange}
            />
          </div>

          {isAnalyzing && (
            <div className="p-6 text-center text-xs text-purple-300 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span>Matching Order IDs, verifying AWBs, and comparing tracking updates...</span>
            </div>
          )}

          {/* Analysis Breakdown */}
          {analysisResult && !isAnalyzing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-slate-400 font-medium">TOTAL ROWS</span>
                  <span className="text-base font-bold text-white mt-1 font-mono">
                    {analysisResult.totalRows}
                  </span>
                  <span className="text-[10px] text-slate-500">{analysisResult.courierProfile} profile</span>
                </div>

                <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-emerald-300 font-medium">MATCHED SHIPMENTS</span>
                  <span className="text-base font-bold text-emerald-300 mt-1 font-mono">
                    {analysisResult.matchedCount}
                  </span>
                  <span className="text-[10px] text-emerald-400/70">Will update Dexie & Supabase</span>
                </div>

                <div className="bg-cyan-950/30 border border-cyan-800/50 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-cyan-300 font-medium">RECONCILED AWBS</span>
                  <span className="text-base font-bold text-cyan-300 mt-1 font-mono">
                    {analysisResult.awbMismatchCount + analysisResult.courierMismatchCount}
                  </span>
                  <span className="text-[10px] text-cyan-400/70">Mismatches corrected</span>
                </div>

                <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-amber-300 font-medium">UNMATCHED ROWS</span>
                  <span className="text-base font-bold text-amber-300 mt-1 font-mono">
                    {analysisResult.unmatchedCount}
                  </span>
                  <span className="text-[10px] text-amber-400/70">Skipped (no bogus records)</span>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setPreviewFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    previewFilter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({analysisResult.previewItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('reconciled')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    previewFilter === 'reconciled' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Reconciled / Corrected ({analysisResult.awbMismatchCount + analysisResult.courierMismatchCount + analysisResult.newAssignmentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('matched')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    previewFilter === 'matched' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Matched ({analysisResult.matchedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('unmatched')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    previewFilter === 'unmatched' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Unmatched ({analysisResult.unmatchedCount})
                </button>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 grid grid-cols-12 gap-2">
                  <span className="col-span-2">ORDER ID</span>
                  <span className="col-span-3">CUSTOMER</span>
                  <span className="col-span-4">AWB & COURIER RECONCILIATION</span>
                  <span className="col-span-3 text-right">STATUS TRANSITION</span>
                </div>

                <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto custom-scrollbar">
                  {filteredPreviewItems.slice(0, 30).map((item, idx) => (
                    <div key={idx} className="px-4 py-2.5 grid grid-cols-12 gap-2 items-center text-xs hover:bg-slate-900/40">
                      <div className="col-span-2 flex flex-col">
                        <span className="font-mono font-bold text-slate-200">
                          {item.orderId ? `#${item.orderId}` : `Row #${item.rowNumber}`}
                        </span>
                        {item.paymentMode && (
                          <span className="text-[10px] text-slate-400">{item.paymentMode} {item.amount ? `₹${item.amount}` : ''}</span>
                        )}
                      </div>

                      <div className="col-span-3 flex flex-col truncate">
                        <span className="text-slate-200 font-medium truncate">
                          {item.customerName || 'Customer'}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate">
                          {item.remarks || 'No remarks'}
                        </span>
                      </div>

                      <div className="col-span-4 flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-cyan-300">{item.awbNumber}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 font-semibold">{item.courier}</span>
                        </div>
                        {item.classification === 'AWB_MISMATCH' || item.classification === 'BOTH_MISMATCH' ? (
                          <div className="text-[10px] text-rose-400 flex items-center gap-1 mt-0.5">
                            <span className="line-through">{item.existingAwb} ({item.existingCourier})</span>
                            <ArrowRight size={10} />
                            <span className="text-emerald-300 font-bold">Reconciling</span>
                          </div>
                        ) : item.classification === 'NEW_ASSIGNMENT' ? (
                          <span className="text-[10px] text-cyan-400 font-medium">Assigning to unassigned order</span>
                        ) : item.classification === 'CORRECT_MATCH' ? (
                          <span className="text-[10px] text-emerald-400 font-medium">Verified match</span>
                        ) : (
                          <span className="text-[10px] text-amber-400">{item.reviewReason || 'Not in system'}</span>
                        )}
                      </div>

                      <div className="col-span-3 flex items-center justify-end gap-1.5">
                        <span className="text-slate-500 text-[10px] line-through truncate max-w-[80px]">
                          {item.currentStatus}
                        </span>
                        <ArrowRight size={10} className="text-purple-400 shrink-0" />
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60 truncate">
                          {item.newStatus}
                        </span>
                      </div>
                    </div>
                  ))}

                  {filteredPreviewItems.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No shipments matching filter.
                    </div>
                  )}
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
            onClick={handleConfirmApply}
            disabled={!analysisResult || isApplying || analysisResult.matchedCount === 0}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer shadow-lg shadow-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Applying Updates to Database...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>Apply & Reconcile Tracking ({analysisResult?.matchedCount || 0} Shipments)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
