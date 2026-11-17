import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  FileSpreadsheet, 
  ShieldCheck, 
  Search,
  Download,
  AlertTriangle,
  Package,
  Truck,
  Send,
  Mail,
  Layers,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  CourierUploadType,
  MultiCourierPreviewItem,
  MultiCourierAnalysisResult,
  MultiCourierImportResult,
  parseAndValidateCourierFile,
  commitMultiCourierImport,
  exportUnmatchedRecordsCsv
} from '../../../../services/multiCourierUploadService';

interface DedicatedCourierUploadModalProps {
  isOpen: boolean;
  courierType: CourierUploadType;
  onClose: () => void;
  onBackToSourceSelect?: () => void;
  onImportSuccess?: () => void;
}

type ModalStep = 'select' | 'preview' | 'importing' | 'completed';

export const DedicatedCourierUploadModal: React.FC<DedicatedCourierUploadModalProps> = ({
  isOpen,
  courierType,
  onClose,
  onBackToSourceSelect,
  onImportSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ModalStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const [analysisResult, setAnalysisResult] = useState<MultiCourierAnalysisResult | null>(null);
  const [importResult, setImportResult] = useState<MultiCourierImportResult | null>(null);

  // Search & Filter in Preview
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');

  // Progress state during commit
  const [progress, setProgress] = useState<{ current: number; total: number; phase: string }>({
    current: 0,
    total: 0,
    phase: ''
  });

  // Filtered preview items hook - must be declared before any conditional returns
  const filteredItems = useMemo(() => {
    if (!analysisResult) return [];
    return analysisResult.previewItems.filter(item => {
      if (filterType === 'MATCHED' && !item.isMatched) return false;
      if (filterType === 'UNMATCHED' && item.isMatched) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const mOid = item.orderId.toLowerCase().includes(q) || item.cleanOrderId.toLowerCase().includes(q);
        const mAwb = item.awbNumber.toLowerCase().includes(q);
        const mCust = (item.customerName || '').toLowerCase().includes(q);
        const mCity = (item.city || '').toLowerCase().includes(q);
        const mCourier = (item.courier || '').toLowerCase().includes(q);
        return mOid || mAwb || mCust || mCity || mCourier;
      }

      return true;
    });
  }, [analysisResult, filterType, searchTerm]);

  // Courier Theme Details
  const courierConfig = getCourierTheme(courierType);

  const handleReset = () => {
    setStep('select');
    setFile(null);
    setAnalysisResult(null);
    setImportResult(null);
    setSearchTerm('');
    setFilterType('ALL');
    setProgress({ current: 0, total: 0, phase: '' });
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileSelected = async (selectedFile: File) => {
    const ext = selectedFile.name.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      toast.error('Please upload a valid spreadsheet file (.csv, .xlsx, or .xls).');
      return;
    }

    setFile(selectedFile);
    setIsValidating(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      if (!rawRows || rawRows.length <= 1) {
        toast.error('The selected file contains no order records.');
        handleReset();
        return;
      }

      const result = await parseAndValidateCourierFile(rawRows, courierType, selectedFile.name);
      setAnalysisResult(result);
      setStep('preview');
      toast.success(`Parsed ${result.uniqueOrdersCount} unique orders from ${selectedFile.name}`);
    } catch (err: any) {
      console.error('File parse error:', err);
      toast.error(err.message || 'Failed to parse courier report');
      handleReset();
    } finally {
      setIsValidating(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!analysisResult || analysisResult.matchedCount === 0) {
      toast.error('No matched orders available to import.');
      return;
    }

    setStep('importing');
    try {
      const res = await commitMultiCourierImport(
        analysisResult.previewItems,
        courierType,
        prog => setProgress(prog)
      );

      setImportResult(res);
      setStep('completed');
      if (onImportSuccess) {
        onImportSuccess();
      }
      toast.success(`Successfully reconciled ${res.updatedShipmentsCount} shipments!`);
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(`Import failed: ${err.message || 'Unknown error'}`);
      setStep('preview');
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div 
        className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* TOP BAR / HEADER */}
        <div className="px-6 py-4.5 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            {onBackToSourceSelect && step === 'select' && (
              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onBackToSourceSelect();
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer mr-1"
                title="Back to source selection"
              >
                <ArrowLeft size={16} />
              </button>
            )}

            <div className={`w-10 h-10 rounded-xl ${courierConfig.iconBg} border ${courierConfig.iconBorder} ${courierConfig.iconText} flex items-center justify-center shadow-inner`}>
              {courierConfig.icon}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {courierConfig.title}
                </h2>
                <span className={`px-2 py-0.5 rounded-full ${courierConfig.badgeBg} ${courierConfig.badgeText} text-[10px] font-bold uppercase tracking-wider border ${courierConfig.badgeBorder}`}>
                  Dedicated Uploader
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {courierConfig.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BODY CONTAINER */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* STEP 1: SELECT FILE */}
          {step === 'select' && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-4 ${
                  isDragging 
                    ? `${courierConfig.dropBorder} bg-slate-800/60 scale-[1.01]` 
                    : 'border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-800/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />

                <div className={`w-16 h-16 rounded-2xl ${courierConfig.iconBg} border ${courierConfig.iconBorder} ${courierConfig.iconText} flex items-center justify-center shadow-lg shadow-purple-500/5`}>
                  {isValidating ? (
                    <RefreshCw size={28} className="animate-spin text-purple-400" />
                  ) : (
                    <UploadCloud size={30} />
                  )}
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {isValidating ? 'Analyzing spreadsheet...' : `Click or drag & drop ${courierConfig.title} file`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Supports <span className="text-slate-200 font-semibold">.CSV</span>, <span className="text-slate-200 font-semibold">.XLSX</span>, and <span className="text-slate-200 font-semibold">.XLS</span> report exports.
                  </p>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-700/60 text-[11px] text-slate-300">
                  <FileSpreadsheet size={13} className="text-slate-400" />
                  <span>Enriches existing orders with AWB, status, delivery dates, and tracking events</span>
                </div>
              </div>

              {/* Supported Columns Guide Card */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <Layers size={14} className={courierConfig.iconText} />
                  <span>Expected Columns & Auto-Detection</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {courierConfig.expectedColumns.map((col, idx) => (
                    <span 
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 font-mono"
                    >
                      {col}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {courierConfig.note}
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & RECONCILIATION */}
          {step === 'preview' && analysisResult && (
            <div className="space-y-5">
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rows</span>
                  <div className="text-lg font-bold text-white mt-0.5">{analysisResult.totalRows.toLocaleString('en-IN')}</div>
                  <span className="text-[11px] text-slate-500">{analysisResult.uniqueOrdersCount} unique orders</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-800/50">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Matched Orders</span>
                  <div className="text-lg font-bold text-emerald-300 mt-0.5">{analysisResult.matchedCount.toLocaleString('en-IN')}</div>
                  <span className="text-[11px] text-emerald-400/80">Ready to enrich</span>
                </div>

                <div className={`p-3.5 rounded-2xl ${analysisResult.unmatchedCount > 0 ? 'bg-amber-950/30 border border-amber-800/50' : 'bg-slate-950/70 border border-slate-800'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${analysisResult.unmatchedCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    Unmatched Records
                  </span>
                  <div className={`text-lg font-bold mt-0.5 ${analysisResult.unmatchedCount > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                    {analysisResult.unmatchedCount.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-slate-500">Not in Sales orders</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Carrier Split</span>
                  <div className="text-xs font-semibold text-slate-300 mt-1 flex flex-wrap gap-1">
                    {Object.entries(analysisResult.carrierBreakdown).map(([c, count]) => (
                      <span key={c} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">
                        {c}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Unmatched Notice Alert if any */}
              {analysisResult.unmatchedCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold">{analysisResult.unmatchedCount} records could not be matched to existing Sales orders.</span>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">
                        These will not be created as new orders. You can export them to CSV for manual audit.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportUnmatchedRecordsCsv(analysisResult.unmatchedItems, `${courierType}_unmatched`)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-100 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Download size={13} />
                    <span>Download Unmatched CSV</span>
                  </button>
                </div>
              )}

              {/* Search & Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search order, AWB, customer, city..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="h-9 pl-9 pr-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-52 sm:w-64"
                    />
                  </div>

                  <div className="flex items-center rounded-xl bg-slate-950/80 border border-slate-800 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterType('ALL')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        filterType === 'ALL' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All ({analysisResult.previewItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('MATCHED')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        filterType === 'MATCHED' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Matched ({analysisResult.matchedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('UNMATCHED')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        filterType === 'UNMATCHED' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Unmatched ({analysisResult.unmatchedCount})
                    </button>
                  </div>
                </div>

                <span className="text-xs text-slate-400">
                  Showing {filteredItems.length} of {analysisResult.previewItems.length}
                </span>
              </div>

              {/* Preview Table */}
              <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/50">
                <div className="overflow-x-auto max-h-[380px] custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0 z-10 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Row</th>
                        <th className="py-2.5 px-3">Order ID</th>
                        <th className="py-2.5 px-3">AWB No</th>
                        <th className="py-2.5 px-3">Carrier</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Status in Report</th>
                        <th className="py-2.5 px-3">Delivery Date</th>
                        <th className="py-2.5 px-3">Reconciliation Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredItems.slice(0, 200).map((it, idx) => {
                        const isMatched = it.isMatched;
                        return (
                          <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">{it.rowNumber}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {it.orderId}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-300">
                              {it.awbNumber || <span className="text-slate-600">—</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium text-[11px]">
                                {it.courier}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 max-w-[140px] truncate" title={it.customerName}>
                              {it.customerName || <span className="text-slate-600">—</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                it.normalizedStatus === 'Delivered' 
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : it.normalizedStatus.includes('RTO')
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              }`}>
                                {it.normalizedStatus}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                              {it.deliveredDate || <span className="text-slate-600">—</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              {isMatched ? (
                                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                                  <CheckCircle2 size={13} className="shrink-0" />
                                  <span className="truncate max-w-[200px]" title={it.matchReason}>
                                    {it.classification === 'MATCHED_NEW_AWB' ? 'New AWB Linked' : 'Enriched'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                                  <AlertCircle size={13} className="shrink-0" />
                                  <span className="truncate max-w-[200px]" title={it.matchReason}>
                                    {it.matchReason}
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IMPORTING PROGRESS */}
          {step === 'importing' && (
            <div className="py-12 px-4 text-center space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto shadow-inner animate-pulse">
                <RefreshCw size={28} className="animate-spin text-purple-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Reconciling Shipments...</h3>
                <p className="text-xs text-slate-400">{progress.phase || 'Applying tracking updates to Sales & Logistics'}</p>
              </div>

              {progress.total > 0 && (
                <div className="space-y-2">
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-mono">
                    <span>{progress.current} of {progress.total}</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: COMPLETED SUMMARY */}
          {step === 'completed' && importResult && (
            <div className="py-8 px-4 text-center space-y-6 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Reconciliation Complete!</h3>
                <p className="text-xs text-slate-400">
                  Shipment metadata and tracking statuses have been synchronized across Sales and Logistics.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logistics Shipments</span>
                  <div className="text-xl font-bold text-emerald-300 mt-1">
                    {importResult.updatedShipmentsCount}
                  </div>
                  <span className="text-[11px] text-slate-500">Updated in workspace</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Website Sales Orders</span>
                  <div className="text-xl font-bold text-purple-300 mt-1">
                    {importResult.salesOrdersUpdatedCount}
                  </div>
                  <span className="text-[11px] text-slate-500">Enriched with AWB & carrier</span>
                </div>
              </div>

              {importResult.unmatchedCount > 0 && analysisResult && (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{importResult.unmatchedCount} unmatched records skipped</span>
                  <button
                    type="button"
                    onClick={() => exportUnmatchedRecordsCsv(analysisResult.unmatchedItems, `${courierType}_unmatched`)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Download Unmatched CSV</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="px-6 py-4 border-t border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div>
            {step === 'preview' && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Upload Different File</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 'preview' && analysisResult && (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={analysisResult.matchedCount === 0}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white shadow-md shadow-purple-600/20 border border-purple-400/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ShieldCheck size={16} />
                  <span>Confirm & Apply Import ({analysisResult.matchedCount})</span>
                </button>
              </>
            )}

            {step === 'completed' && (
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white shadow-md shadow-emerald-600/20 border border-emerald-400/30 transition-all cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function getCourierTheme(courierType: CourierUploadType) {
  switch (courierType) {
    case 'amazon_shipping':
      return {
        title: 'Amazon Shipping Upload',
        subtitle: 'Import multi-channel Amazon Shipping manifests and waybill reports (CSV)',
        icon: <Package size={20} />,
        iconBg: 'bg-amber-500/15',
        iconBorder: 'border-amber-500/30',
        iconText: 'text-amber-400',
        badgeBg: 'bg-amber-500/20',
        badgeBorder: 'border-amber-500/30',
        badgeText: 'text-amber-300',
        dropBorder: 'border-amber-500/60',
        expectedColumns: [
          'Order Number', 'AWB No', 'Courier Company', 'Order Status', 'Customer Name',
          'Order Total', 'Order Pickup Date', 'Order Delivered Date', 'RTO Initiated Date'
        ],
        note: 'Multi-line product continuation rows are grouped under the parent order. Ekart records within the file are identified and routed to Ekart separately.'
      };
    case 'st_courier':
      return {
        title: 'ST Courier Upload',
        subtitle: 'Import ST Courier consignment registers, AWB tracking, and delivery updates',
        icon: <Send size={20} />,
        iconBg: 'bg-cyan-500/15',
        iconBorder: 'border-cyan-500/30',
        iconText: 'text-cyan-400',
        badgeBg: 'bg-cyan-500/20',
        badgeBorder: 'border-cyan-500/30',
        badgeText: 'text-cyan-300',
        dropBorder: 'border-cyan-500/60',
        expectedColumns: [
          'Order ID', 'AWB Number', 'Courier Name', 'Status Type', 'Current Status',
          'Delivered Date', 'Dispatch Status', 'Customer Name', 'Order Value (INR)'
        ],
        note: 'Flexible header detection supports any column order. Status is determined using both Status Type and Current Status.'
      };
    case 'india_post':
      return {
        title: 'India Post Upload',
        subtitle: 'Import India Post Speed Post consignment manifests and article tracking registers',
        icon: <Mail size={20} />,
        iconBg: 'bg-rose-500/15',
        iconBorder: 'border-rose-500/30',
        iconText: 'text-rose-400',
        badgeBg: 'bg-rose-500/20',
        badgeBorder: 'border-rose-500/30',
        badgeText: 'text-rose-300',
        dropBorder: 'border-rose-500/60',
        expectedColumns: [
          'Order/Ref No', 'Article/Consignment No', 'Booking Date', 'Status', 'Event', 'Delivered Date'
        ],
        note: 'Requires at least an Order Reference and Article/Consignment tracking number. Extensible for all India Post regional formats.'
      };
    default:
      return {
        title: 'Courier Tracking Upload',
        subtitle: 'Import carrier dispatch manifests and delivery reports',
        icon: <Truck size={20} />,
        iconBg: 'bg-purple-500/15',
        iconBorder: 'border-purple-500/30',
        iconText: 'text-purple-400',
        badgeBg: 'bg-purple-500/20',
        badgeBorder: 'border-purple-500/30',
        badgeText: 'text-purple-300',
        dropBorder: 'border-purple-500/60',
        expectedColumns: ['Order ID', 'AWB Number', 'Status', 'Date'],
        note: 'Enriches existing orders safely with AWB and tracking events.'
      };
  }
}
