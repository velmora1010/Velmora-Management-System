import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  RefreshCw, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  Settings2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import type { 
  ColumnMapping, 
  PriceInterpretationMode, 
  WebsiteUploadBatch 
} from '../types';
import { 
  consolidateRawRows, 
  detectColumnMapping, 
  parseFileToRawRows,
  formatSalesDateDisplay,
  formatSalesDateShort,
  getTodayInBusinessTimezone
} from '../websiteSalesUtils';
import { websiteSalesService } from '../websiteSalesService';
import toast from 'react-hot-toast';

interface WebsiteOrderFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: (orderDate: string) => void;
}

export const WebsiteOrderFilesModal: React.FC<WebsiteOrderFilesModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batches state
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  // File Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [detectedDates, setDetectedDates] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    orderId: '',
    customerName: '',
    address: '',
    state: '',
    city: '',
    pincode: '',
    productName: '',
    quantity: '',
    offer: '',
    price: '',
    phone: '',
    paymentMode: '',
    orderDate: ''
  });
  const [priceMode, setPriceMode] = useState<PriceInterpretationMode>('Order Total');
  const [showMappingDetails, setShowMappingDetails] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load batches on open
  useEffect(() => {
    if (isOpen) {
      loadBatches();
    } else {
      clearSelectedFile();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  const loadBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const list = await websiteSalesService.getUploadBatches();
      setBatches(list);
    } catch (err: any) {
      console.warn('Failed to load upload batches:', err);
      toast.error('Failed to load uploaded files');
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const clearSelectedFile = () => {
    setFile(null);
    setParsedHeaders([]);
    setParsedRows([]);
    setDetectedDates([]);
    setValidationError(null);
    setShowMappingDetails(false);
    setIsProcessing(false);
    setProcessingProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = async (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setValidationError('Unsupported file format. Please select a .CSV, .XLSX, or .xls file.');
      toast.error('Unsupported file format. Use CSV or Excel.');
      return;
    }

    setValidationError(null);
    setFile(selectedFile);

    try {
      const { headers, rows } = await parseFileToRawRows(selectedFile);
      if (rows.length === 0) {
        setValidationError('Selected file is empty or has no readable rows.');
        toast.error('File has no readable rows.');
        return;
      }

      setParsedHeaders(headers);
      setParsedRows(rows);

      // Auto detect mapping
      const detected = detectColumnMapping(headers);
      setColumnMapping(detected);

      // Detect dates
      const sampleId = crypto.randomUUID();
      const preview = consolidateRawRows(rows, detected, priceMode, sampleId);
      setDetectedDates(preview.detectedOrderDates);
    } catch (err: any) {
      console.error('File parse error:', err);
      setValidationError(err.message || 'Failed to parse file.');
      toast.error(err.message || 'Failed to parse file.');
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Process & Upload Orders
  const handleProcessOrders = async () => {
    if (!file || isProcessing) return;

    if (!columnMapping.orderId) {
      toast.error('Please map the required Order ID column.');
      return;
    }
    if (!columnMapping.productName) {
      toast.error('Please map the required Product Name column.');
      return;
    }
    if (!columnMapping.quantity) {
      toast.error('Please map the required Quantity column.');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(20);

    try {
      setProcessingProgress(45);
      const result = await websiteSalesService.processAndUploadFile(
        file,
        'Sales Manager',
        priceMode,
        columnMapping
      );
      setProcessingProgress(90);

      const mainDate = result.batch.order_date || getTodayInBusinessTimezone();
      const logPreserved = result.metrics.logisticsPreservedCount ? ` (${result.metrics.logisticsPreservedCount} dispatch/tracking preserved)` : '';

      toast.success(
        `Orders successfully uploaded & saved!\n` +
        `• ${result.metrics.sourceRowsProcessed} source rows processed\n` +
        `• ${result.metrics.totalUniqueOrders} unique orders (${result.metrics.newOrdersCount} new, ${result.metrics.updatedOrdersCount} updated)\n` +
        `• Available in Logistics: ${result.metrics.logisticsActiveCount} active, ${result.metrics.logisticsFulfilledCount} fulfilled${logPreserved}`,
        { duration: 6000 }
      );

      setProcessingProgress(100);
      clearSelectedFile();
      await loadBatches();

      if (onUploadSuccess) {
        onUploadSuccess(mainDate);
      }
    } catch (err: any) {
      console.error('Processing error:', err);
      toast.error(`Processing failed: ${err.message || 'Unknown error'}`);
      setValidationError(err.message || 'Processing failed.');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // Delete Batch
  const handleDeleteBatch = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete batch "${name}"? This will delete all associated orders from Sales and Logistics.`)) {
      setDeletingBatchId(id);
      try {
        await websiteSalesService.deleteUploadBatch(id);
        toast.success(`Batch "${name}" deleted.`);
        await loadBatches();
      } catch (err: any) {
        console.error('Delete batch error:', err);
        toast.error(`Failed to delete batch: ${err.message || 'Error'}`);
      } finally {
        setDeletingBatchId(null);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 md:p-6 animate-in fade-in duration-200">
      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv, .xlsx, .xls"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
          }
        }}
      />

      {/* MODAL DIALOG CONTAINER */}
      <div 
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-inner">
              <UploadCloud size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Website Order Files
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload new order spreadsheets and review historical batches.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadBatches}
              disabled={isLoadingBatches}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh upload records"
            >
              <RefreshCw size={16} className={isLoadingBatches ? 'animate-spin text-purple-400' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              title="Close panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* SECTION A: UPLOAD NEW FILE */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                Upload New Order File
              </h3>
              {file && (
                <button
                  type="button"
                  onClick={clearSelectedFile}
                  disabled={isProcessing}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X size={13} /> Change file
                </button>
              )}
            </div>

            {/* DRAG & DROP ZONE (WHEN NO FILE IS SELECTED) */}
            {!file && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-purple-500 bg-purple-950/30 ring-2 ring-purple-500/30'
                    : 'border-slate-800 hover:border-purple-500/50 bg-slate-950/50 hover:bg-slate-950/80'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-md">
                  <UploadCloud size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Drag and drop your order file here, or <span className="text-purple-400 hover:underline">Browse Files</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports Shopify and standard spreadsheets (.CSV, .XLSX, .XLS)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">CSV</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">XLSX</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">XLS</span>
                </div>
              </div>
            )}

            {/* VALIDATION ERROR BANNER */}
            {validationError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
                <AlertCircle size={16} className="shrink-0 text-red-400" />
                <span>{validationError}</span>
              </div>
            )}

            {/* FILE SELECTED CARD & ACTIONS */}
            {file && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20 shrink-0">
                        <FileSpreadsheet size={22} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white break-all">{file.name}</h4>
                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 mt-0.5">
                          <span>{(file.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>Source Rows: <strong className="text-purple-300 font-mono">{parsedRows.length}</strong></span>
                          {detectedDates.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-cyan-300 flex items-center gap-1">
                                <Calendar size={12} />
                                {detectedDates.length === 1 
                                  ? formatSalesDateDisplay(detectedDates[0])
                                  : `${formatSalesDateShort(detectedDates[0])} – ${formatSalesDateShort(detectedDates[detectedDates.length - 1])}`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setShowMappingDetails(prev => !prev)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Settings2 size={14} />
                        <span>{showMappingDetails ? 'Hide Mapping' : 'Review Mapping'}</span>
                      </button>
                    </div>
                  </div>

                  {/* COLUMN MAPPING ACCORDION (OPTIONAL REVIEW) */}
                  {showMappingDetails && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-3">
                      <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
                        <span>Auto-detected columns (adjust if needed):</span>
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-slate-400">Price Mode:</label>
                          <select
                            value={priceMode}
                            onChange={e => setPriceMode(e.target.value as PriceInterpretationMode)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none"
                          >
                            <option value="Order Total">Order Total</option>
                            <option value="Line Total">Line Total</option>
                            <option value="Unit Price x Quantity">Unit Price x Quantity</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">Order ID *</label>
                          <select
                            value={columnMapping.orderId}
                            onChange={e => setColumnMapping({ ...columnMapping, orderId: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-400"
                          >
                            <option value="">-- Select Order ID --</option>
                            {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">Product Name *</label>
                          <select
                            value={columnMapping.productName}
                            onChange={e => setColumnMapping({ ...columnMapping, productName: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-400"
                          >
                            <option value="">-- Select Product --</option>
                            {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">Quantity *</label>
                          <select
                            value={columnMapping.quantity}
                            onChange={e => setColumnMapping({ ...columnMapping, quantity: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-400"
                          >
                            <option value="">-- Select Quantity --</option>
                            {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">Customer Name</label>
                          <select
                            value={columnMapping.customerName}
                            onChange={e => setColumnMapping({ ...columnMapping, customerName: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-400"
                          >
                            <option value="">-- Select Name --</option>
                            {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">Phone Number</label>
                          <select
                            value={columnMapping.phone}
                            onChange={e => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-400"
                          >
                            <option value="">-- Select Phone --</option>
                            {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">Price / Amount</label>
                          <select
                            value={columnMapping.price}
                            onChange={e => setColumnMapping({ ...columnMapping, price: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-400"
                          >
                            <option value="">-- Select Price --</option>
                            {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PROGRESS BAR (DURING PROCESSING) */}
                  {isProcessing && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span className="flex items-center gap-1.5 text-purple-300">
                          <RefreshCw size={12} className="animate-spin" /> Processing & consolidating orders...
                        </span>
                        <span className="font-mono">{processingProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300"
                          style={{ width: `${processingProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={clearSelectedFile}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleProcessOrders}
                      disabled={isProcessing}
                      className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={15} />
                          <span>Process & Upload Orders</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION B: PREVIOUSLY UPLOADED FILES */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  Uploaded File Records
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700/80">
                  {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
                </span>
              </div>

              <button
                type="button"
                onClick={loadBatches}
                disabled={isLoadingBatches}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} className={isLoadingBatches ? 'animate-spin' : ''} />
                <span>Refresh List</span>
              </button>
            </div>

            {/* BATCHES TABLE */}
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60 shadow-lg">
              {isLoadingBatches ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-purple-400" />
                  <span>Loading batch records...</span>
                </div>
              ) : batches.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No upload batches found. Upload your first file above.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3.5">File Name</th>
                        <th className="py-2.5 px-3.5">Order Date</th>
                        <th className="py-2.5 px-3.5">Upload Date</th>
                        <th className="py-2.5 px-3.5">Source Rows</th>
                        <th className="py-2.5 px-3.5">Unique Orders</th>
                        <th className="py-2.5 px-3.5">Status</th>
                        <th className="py-2.5 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {batches.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3.5 font-bold text-white flex items-center gap-2">
                            <FileSpreadsheet size={14} className="text-purple-400 shrink-0" />
                            <span className="truncate max-w-[200px]" title={b.file_name}>{b.file_name}</span>
                          </td>
                          <td className="py-2.5 px-3.5 font-semibold text-cyan-300 whitespace-nowrap">
                            {b.order_date_range || (b.order_date ? formatSalesDateShort(b.order_date) : '-')}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {new Date(b.uploaded_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-cyan-400">{b.total_source_rows}</td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-400">{b.total_unique_orders}</td>
                          <td className="py-2.5 px-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              {b.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteBatch(b.id, b.file_name)}
                              disabled={deletingBatchId === b.id}
                              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                              title="Delete batch and orders"
                            >
                              <Trash2 size={14} className={deletingBatchId === b.id ? 'animate-pulse text-red-400' : ''} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-3.5 px-5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Orders uploaded here immediately synchronize with the Logistics department.</span>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
