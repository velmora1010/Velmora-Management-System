import React, { useState, useRef } from 'react';
import { 
  Truck, 
  X, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  FileSpreadsheet, 
  ShieldCheck, 
  Search,
  ExternalLink,
  ChevronRight,
  Layers,
  Calendar,
  Check,
  AlertTriangle
} from 'lucide-react';
import { delhiverySalesService } from '../delhiverySalesService';
import type { 
  DelhiveryValidationResult, 
  DelhiveryImportResult 
} from '../delhiveryTypes';
import toast from 'react-hot-toast';

interface DelhiveryUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToSourceSelect?: () => void;
  onImportSuccess?: () => void;
}

type ModalStep = 'select' | 'preview' | 'importing' | 'completed';

export const DelhiveryUploadModal: React.FC<DelhiveryUploadModalProps> = ({
  isOpen,
  onClose,
  onBackToSourceSelect,
  onImportSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ModalStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const [validationResult, setValidationResult] = useState<DelhiveryValidationResult | null>(null);
  const [importResult, setImportResult] = useState<DelhiveryImportResult | null>(null);

  // Table search & filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Progress state
  const [progress, setProgress] = useState<{ current: number; total: number; phase: string }>({
    current: 0,
    total: 0,
    phase: ''
  });

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('select');
    setFile(null);
    setValidationResult(null);
    setImportResult(null);
    setSearchTerm('');
    setStatusFilter('ALL');
    setProgress({ current: 0, total: 0, phase: '' });
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a valid CSV file (.csv) exported from Delhivery One.');
      return;
    }

    setFile(selectedFile);
    setIsValidating(true);

    try {
      const result = await delhiverySalesService.validateDelhiveryFile(selectedFile);
      setValidationResult(result);
      setStep('preview');
      toast.success(`Parsed ${result.totalRows.toLocaleString('en-IN')} rows from ${selectedFile.name}`);
    } catch (err: any) {
      console.error('File validation error:', err);
      toast.error(err.message || 'Failed to parse Delhivery file');
      handleReset();
    } finally {
      setIsValidating(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!validationResult || validationResult.validCount === 0) {
      toast.error('No valid records available to import.');
      return;
    }

    setStep('importing');
    try {
      const res = await delhiverySalesService.commitDelhiveryImport(
        validationResult.records,
        prog => setProgress(prog)
      );

      setImportResult(res);
      setStep('completed');
      if (onImportSuccess) {
        onImportSuccess();
      }
      toast.success(`Successfully imported ${res.importedCount + res.updatedCount} shipments!`);
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(`Import failed: ${err.message || 'Unknown error'}`);
      setStep('preview');
    }
  };

  // Filter preview records
  const filteredRecords = (validationResult?.records || []).filter(rec => {
    if (statusFilter !== 'ALL' && rec.canonicalStatus !== statusFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchWaybill = rec.waybill.toLowerCase().includes(q);
      const matchRef = rec.referenceNo.toLowerCase().includes(q);
      const matchName = rec.consigneeName.toLowerCase().includes(q);
      const matchCity = rec.city.toLowerCase().includes(q);
      const matchState = rec.state.toLowerCase().includes(q);
      return matchWaybill || matchRef || matchName || matchCity || matchState;
    }
    return true;
  });

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

            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-inner">
              <Truck size={20} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Delhivery One Upload
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-bold uppercase tracking-wider border border-orange-500/30">
                  Dedicated CSV Importer
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Import carrier dispatch manifests, waybill tracking, and delivery scan reports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* STEP 1: FILE SELECT & DRAG-AND-DROP */}
        {step === 'select' && (
          <div className="p-6 sm:p-8 space-y-6 overflow-y-auto">
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-10 sm:p-12 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-orange-500 bg-orange-500/10 scale-[1.01]'
                  : 'border-slate-700/80 bg-slate-950/60 hover:border-orange-500/50 hover:bg-slate-800/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />

              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/25 text-orange-400 flex items-center justify-center mb-4 shadow-lg shadow-orange-500/5">
                {isValidating ? (
                  <RefreshCw size={28} className="animate-spin text-orange-400" />
                ) : (
                  <UploadCloud size={28} />
                )}
              </div>

              <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
                {isValidating ? 'Validating Delhivery File...' : 'Choose or drag & drop Delhivery CSV'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
                Accepts Delhivery One standard shipments export files. Waybill and lifecycle status headers will be automatically recognized and verified.
              </p>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/70 text-xs font-semibold text-slate-300">
                <FileSpreadsheet size={14} className="text-orange-400" />
                <span>Supported format: .csv (Delhivery One Export)</span>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-orange-400 font-semibold">
                  <ShieldCheck size={15} />
                  <span>Idempotent Upsert</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Existing Waybills are safely updated rather than duplicated. Delivered statuses are protected against downgrade.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold">
                  <Layers size={15} />
                  <span>Verified Sales Linkage</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Reference numbers matching Website Sales orders update dispatch and tracking info without creating duplicate orders.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle2 size={15} />
                  <span>Clean Data Isolation</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Processed strictly through the dedicated carrier pipeline without cross-contaminating Shopify financial records.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & CONFIRMATION */}
        {step === 'preview' && validationResult && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Summary Metrics Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/40 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3 text-xs shrink-0">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Total Rows</span>
                <span className="text-base font-bold text-white font-mono mt-0.5 block">
                  {validationResult.totalRows.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                <span className="text-[11px] text-emerald-400 block font-medium">Valid Shipments</span>
                <span className="text-base font-bold text-emerald-300 font-mono mt-0.5 block">
                  {validationResult.validCount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
                <span className="text-[11px] text-indigo-400 block font-medium">Matched Sales Orders</span>
                <span className="text-base font-bold text-indigo-300 font-mono mt-0.5 block">
                  {validationResult.matchedSalesOrderCount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25">
                <span className="text-[11px] text-cyan-400 block font-medium">Existing in DB</span>
                <span className="text-base font-bold text-cyan-300 font-mono mt-0.5 block">
                  {validationResult.existingDbWaybillCount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                <span className="text-[11px] text-amber-400 block font-medium">Duplicate Waybills</span>
                <span className="text-base font-bold text-amber-300 font-mono mt-0.5 block">
                  {validationResult.duplicateWaybillCount}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25">
                <span className="text-[11px] text-rose-400 block font-medium">Missing Waybill</span>
                <span className="text-base font-bold text-rose-300 font-mono mt-0.5 block">
                  {validationResult.missingWaybillCount}
                </span>
              </div>
            </div>

            {/* Filter toolbar inside preview */}
            <div className="p-3.5 px-6 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by Waybill, Reference #, Consignee, City..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 text-xs outline-none focus:border-orange-500/50"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      statusFilter === 'ALL'
                        ? 'bg-slate-700 text-white border-slate-600'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    All ({validationResult.records.length})
                  </button>
                  {Object.entries(validationResult.statusBreakdown).map(([st, cnt]) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                        statusFilter === st
                          ? 'bg-orange-600/30 text-orange-200 border-orange-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {st} ({cnt})
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-[11px] text-slate-400">
                Showing {Math.min(filteredRecords.length, 100)} of {filteredRecords.length} records
              </span>
            </div>

            {/* Scrollable Data Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-950/95 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Waybill (AWB)</th>
                    <th className="py-2.5 px-4">Reference No.</th>
                    <th className="py-2.5 px-4">Consignee</th>
                    <th className="py-2.5 px-4">Destination</th>
                    <th className="py-2.5 px-4">Amount / Mode</th>
                    <th className="py-2.5 px-4">Current Status</th>
                    <th className="py-2.5 px-4">Dates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredRecords.slice(0, 100).map(rec => (
                    <tr 
                      key={rec.rowNumber} 
                      className={`hover:bg-slate-800/40 transition-colors ${
                        !rec.isValid ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center font-mono text-[11px] text-slate-500">
                        {rec.rowNumber}
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-mono text-white font-semibold">
                          {rec.waybill || <span className="text-rose-400 font-sans italic">Missing</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{rec.mot}</span>
                          {rec.isExistingInDb && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[9px] border border-cyan-500/30">
                              In DB
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-mono text-indigo-300 font-medium">
                          {rec.referenceNo || '—'}
                        </div>
                        {rec.matchedSalesOrderId && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[9px] border border-indigo-500/30">
                            Sales Matched
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="text-white font-medium max-w-[150px] truncate">
                          {rec.consigneeName || '—'}
                        </div>
                        <div className="text-[10px] text-slate-400 max-w-[150px] truncate">
                          {rec.productDescription}
                        </div>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="text-slate-300">
                          {rec.city || '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {rec.state} {rec.pincode ? `(${rec.pincode})` : ''}
                        </div>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-mono font-bold text-white">
                          ₹{rec.amount.toLocaleString('en-IN')}
                        </div>
                        <span className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                          rec.paymentMode === 'PREPAID'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {rec.paymentMode}
                        </span>
                      </td>

                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                          rec.canonicalStatus === 'Delivered'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : rec.canonicalStatus.includes('RTO') || rec.canonicalStatus.includes('Returned')
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : rec.canonicalStatus === 'Cancelled'
                            ? 'bg-slate-700 text-slate-300 border-slate-600'
                            : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        }`}>
                          {rec.canonicalStatus}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          {rec.currentStatus}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-[10px] text-slate-400 font-mono">
                        {rec.deliveredDate ? (
                          <div className="text-emerald-300">Del: {rec.deliveredDate}</div>
                        ) : rec.pickUpDate ? (
                          <div>Pick: {rec.pickUpDate}</div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom confirmation footer */}
            <div className="p-4 px-6 border-t border-slate-800/80 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Change File
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right text-xs">
                  <span className="text-slate-400 block text-[11px]">Ready to process</span>
                  <span className="text-white font-bold font-mono">
                    {validationResult.validCount.toLocaleString('en-IN')} valid shipments
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={validationResult.validCount === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-600/30 border border-orange-400/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Check size={16} />
                  <span>Confirm & Import Records</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: IMPORTING PROGRESS */}
        {step === 'importing' && (
          <div className="p-10 sm:p-14 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-orange-400 shadow-xl shadow-orange-500/10">
              <RefreshCw size={30} className="animate-spin text-orange-400" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Importing Delhivery One Shipments...
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {progress.phase || 'Saving tracking numbers, lifecycle statuses, and linking to Website Sales...'}
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ 
                    width: progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : '15%' 
                  }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>{progress.current} of {progress.total} shipments</span>
                <span>{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: COMPLETED SUMMARY */}
        {step === 'completed' && importResult && (
          <div className="p-6 sm:p-8 space-y-6 overflow-y-auto">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-950/20 border border-emerald-500/30 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
                <CheckCircle2 size={26} />
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Delhivery Import Completed Successfully
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Shipment tracking and dispatch lifecycle states have been safely ingested into Supabase and local Logistics databases.
                </p>
              </div>
            </div>

            {/* Ingestion Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">New Shipments Ingested</span>
                <span className="text-lg font-bold text-white font-mono mt-1 block">
                  {importResult.importedCount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Existing Shipments Updated</span>
                <span className="text-lg font-bold text-cyan-300 font-mono mt-1 block">
                  {importResult.updatedCount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Sales Orders Linked</span>
                <span className="text-lg font-bold text-indigo-300 font-mono mt-1 block">
                  {importResult.salesOrdersUpdatedCount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Processing Time</span>
                <span className="text-lg font-bold text-emerald-300 font-mono mt-1 block">
                  {(importResult.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Error notifications if any */}
            {importResult.errors.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-rose-400 font-semibold">
                  <AlertTriangle size={15} />
                  <span>Some non-fatal issues were encountered:</span>
                </div>
                <ul className="list-disc list-inside text-rose-300 text-[11px] space-y-0.5">
                  {importResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Upload Another File
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                View Website Orders
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
