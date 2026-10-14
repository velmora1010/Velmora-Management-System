import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Truck,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { 
  analyzeCourierTrackingFile, 
  commitCourierTrackingUpdates, 
  type TrackingFileAnalysisResult 
} from '../../../services/courierTrackingFileService';
import { CONFIGURED_COURIERS } from '../../../config/courierConfig';

interface CourierTrackingImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncSuccess: () => void;
}

export const CourierTrackingImportModal: React.FC<CourierTrackingImportModalProps> = ({
  isOpen,
  onClose,
  onSyncSuccess
}) => {
  if (!isOpen) return null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCourier, setSelectedCourier] = useState<string>('iThink Logistics – Ekart');
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TrackingFileAnalysisResult | null>(null);

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
        toast.success(`Successfully updated ${res.updatedCount} shipments!`);
        onSyncSuccess();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#0b1220] border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
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
                Update delivery statuses, events, and remarks from courier Excel/CSV files
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
              Select Courier Report Format
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
              AWBs will be matched against existing shipments in Logistics
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
              <span>Matching AWBs and comparing tracking updates...</span>
            </div>
          )}

          {/* Analysis Breakdown */}
          {analysisResult && !isAnalyzing && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-slate-400 font-medium">TOTAL ROWS</span>
                  <span className="text-base font-bold text-white mt-1 font-mono">
                    {analysisResult.totalRows}
                  </span>
                </div>

                <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-emerald-300 font-medium">MATCHED SHIPMENTS</span>
                  <span className="text-base font-bold text-emerald-300 mt-1 font-mono">
                    {analysisResult.matchedCount}
                  </span>
                  <span className="text-[10px] text-emerald-400/70">Will be updated</span>
                </div>

                <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-3 flex flex-col">
                  <span className="text-[10px] text-amber-300 font-medium">UNMATCHED AWBs</span>
                  <span className="text-base font-bold text-amber-300 mt-1 font-mono">
                    {analysisResult.unmatchedCount}
                  </span>
                  <span className="text-[10px] text-amber-400/70">Skipped (no bogus orders)</span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 flex items-center justify-between">
                  <span>PREVIEW (MATCHED SHIPMENTS)</span>
                  <span className="text-slate-500 font-normal">Status Transition</span>
                </div>

                <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto custom-scrollbar">
                  {analysisResult.previewItems
                    .filter(it => it.isMatched)
                    .slice(0, 10)
                    .map((item, idx) => (
                      <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/40">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-200">
                            {item.orderId ? `#${item.orderId}` : 'Order'} • AWB: {item.awbNumber}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate max-w-sm">
                            {item.remarks || 'No remarks in file'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-500 text-[11px] line-through">
                            {item.currentStatus}
                          </span>
                          <ArrowRight size={11} className="text-purple-400" />
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                            {item.newStatus}
                          </span>
                        </div>
                      </div>
                    ))}

                  {analysisResult.matchedCount === 0 && (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No matching AWBs found in current logistics database.
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
                <span>Applying Updates...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>Apply Tracking Updates ({analysisResult?.matchedCount || 0} Shipments)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
