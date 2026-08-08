import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  AlertCircle, 
  X, 
  Settings2, 
  RefreshCw, 
  Trash2,
  Calendar
} from 'lucide-react';
import type { 
  ColumnMapping, 
  PriceInterpretationMode, 
  WebsiteUploadBatch 
} from './types';
import { 
  consolidateRawRows, 
  detectColumnMapping, 
  parseFileToRawRows,
  formatSalesDateDisplay,
  formatSalesDateShort,
  getTodayInBusinessTimezone
} from './websiteSalesUtils';
import { websiteSalesService } from './websiteSalesService';
import toast from 'react-hot-toast';

export const WebsiteUpload: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Uploaded batches list from Supabase / local
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // File Upload Form State
  const [file, setFile] = useState<File | null>(null);
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
  const [step, setStep] = useState<'idle' | 'mapping' | 'processing'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);

  // Fetch batches on mount
  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    const list = await websiteSalesService.getUploadBatches();
    setBatches(list);
    setLoading(false);
  };

  // File Picker Handler
  const handleFileSelect = async (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setValidationError('Unsupported file format. Please select a .CSV, .XLSX, or .xls file.');
      toast.error('Unsupported file format.');
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

      // Preview consolidation for date detection & duplicate warning
      const sampleId = crypto.randomUUID();
      const preview = consolidateRawRows(rows, detected, priceMode, sampleId);
      setDetectedDates(preview.detectedOrderDates);

      setStep('mapping');
    } catch (err: any) {
      console.error('File parse error:', err);
      setValidationError(err.message || 'Failed to parse order file.');
      toast.error(err.message || 'Failed to parse file.');
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsedHeaders([]);
    setParsedRows([]);
    setDetectedDates([]);
    setStep('idle');
    setValidationError(null);
    setDuplicateWarning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Process orders action
  const handleProcessOrders = async () => {
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

    setStep('processing');
    setProcessingProgress(20);

    try {
      const batchId = crypto.randomUUID();
      setProcessingProgress(50);

      const {
        consolidatedOrders,
        rawRowsProcessed,
        totalUniqueOrders,
        validRowCount,
        invalidRowCount,
        duplicateOrderCount,
        detectedOrderDates
      } = consolidateRawRows(parsedRows, columnMapping, priceMode, batchId);

      setProcessingProgress(75);

      const mainOrderDate = detectedOrderDates.length > 0 ? detectedOrderDates[0] : getTodayInBusinessTimezone();
      const dateRangeStr = detectedOrderDates.length > 1
        ? `${formatSalesDateShort(detectedOrderDates[0])} – ${formatSalesDateShort(detectedOrderDates[detectedOrderDates.length - 1])}`
        : formatSalesDateShort(mainOrderDate);

      const newBatch: WebsiteUploadBatch = {
        id: batchId,
        file_name: file?.name || 'Website_Orders.csv',
        uploaded_by: 'Sales Manager',
        uploaded_at: new Date().toISOString(),
        total_source_rows: parsedRows.length,
        total_unique_orders: totalUniqueOrders,
        valid_rows: validRowCount,
        invalid_rows: invalidRowCount,
        duplicate_order_count: duplicateOrderCount,
        price_interpretation: priceMode,
        status: 'COMPLETED',
        column_mapping: columnMapping,
        order_date: mainOrderDate,
        order_date_range: dateRangeStr
      };

      const result = await websiteSalesService.processAndUploadFile(file!, 'Sales Manager', priceMode);
      setProcessingProgress(100);

      toast.success(
        `Orders successfully uploaded & saved!\n` +
        `• ${result.metrics.sourceRowsProcessed} source rows processed\n` +
        `• ${result.metrics.totalUniqueOrders} unique orders (${result.metrics.newOrdersCount} new, ${result.metrics.updatedOrdersCount} updated)\n` +
        `• ${result.metrics.itemsCount} line items synchronized`,
        { duration: 5000 }
      );

      // Clear form & navigate to dashboard for the detected order date
      clearFile();
      navigate(`/sales/website?date=${mainOrderDate}`);
    } catch (err: any) {
      console.error('Processing error:', err);
      toast.error(`Processing failed: ${err.message || 'Unknown error'}`);
      setStep('mapping');
    }
  };

  const handleDeleteBatch = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete batch "${name}"?`)) {
      await websiteSalesService.deleteUploadBatch(id);
      loadBatches();
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
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

      {/* HEADER ROW WITH COMPACT TOP-RIGHT UPLOAD BUTTON */}
      {step === 'idle' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
              Uploaded Website Order Files
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload and manage date-based website order files.
            </p>
          </div>

          <button
            type="button"
            title="Upload File"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <UploadCloud size={16} /> Upload File
          </button>
        </div>
      )}

      {/* COLUMN MAPPING STEP */}
      {step === 'mapping' && file && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 pt-2">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{file.name}</h4>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span>Size: {(file.size / 1024).toFixed(1)} KB</span>
                  <span>•</span>
                  <span>Source Rows: <strong className="text-cyan-300">{parsedRows.length}</strong></span>
                </div>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear File"
            >
              <X size={18} />
            </button>
          </div>

          {/* DATE PREVIEW & MULTI-DATE WARNING */}
          {detectedDates.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                <Calendar size={15} />
                <span>
                  {detectedDates.length === 1 
                    ? `Detected Order Date: ${formatSalesDateDisplay(detectedDates[0])}`
                    : `Detected Date Range: ${formatSalesDateShort(detectedDates[0])} – ${formatSalesDateShort(detectedDates[detectedDates.length - 1])}`}
                </span>
              </div>
              {detectedDates.length > 1 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>This file contains orders from multiple dates ({detectedDates.length} dates detected). Each order will be stored under its real date.</span>
                </div>
              )}
            </div>
          )}

          {/* COLUMN MAPPING SELECTION */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings2 size={16} className="text-cyan-400" /> Confirm Column Mapping
              </h3>
              <span className="text-xs text-slate-400">Auto-detected from file headers</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Order ID *</label>
                <select
                  value={columnMapping.orderId}
                  onChange={e => setColumnMapping({ ...columnMapping, orderId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="">-- Select Order ID Column --</option>
                  {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Order Date</label>
                <select
                  value={columnMapping.orderDate || ''}
                  onChange={e => setColumnMapping({ ...columnMapping, orderDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="">-- Select Order Date Column --</option>
                  {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Customer Name</label>
                <select
                  value={columnMapping.customerName}
                  onChange={e => setColumnMapping({ ...columnMapping, customerName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="">-- Select Customer Name Column --</option>
                  {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Product Name *</label>
                <select
                  value={columnMapping.productName}
                  onChange={e => setColumnMapping({ ...columnMapping, productName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="">-- Select Product Name Column --</option>
                  {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Quantity *</label>
                <select
                  value={columnMapping.quantity}
                  onChange={e => setColumnMapping({ ...columnMapping, quantity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="">-- Select Quantity Column --</option>
                  {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Price / Total Amount</label>
                <select
                  value={columnMapping.price}
                  onChange={e => setColumnMapping({ ...columnMapping, price: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="">-- Select Price Column --</option>
                  {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={clearFile}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessOrders}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                Process & Save Orders
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING STATE */}
      {step === 'processing' && (
        <div className="max-w-md mx-auto p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
          <RefreshCw size={36} className="animate-spin text-cyan-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">Processing & Consolidating Orders</h3>
            <p className="text-xs text-slate-400 mt-1">Extracting order dates, consolidating line items, and normalizing payment modes...</p>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div className="bg-cyan-400 h-full transition-all duration-300" style={{ width: `${processingProgress}%` }}></div>
          </div>
        </div>
      )}

      {/* UPLOADED BATCHES AUDIT LIST */}
      {step === 'idle' && (
        <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60 shadow-xl">
          <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Uploaded File Records</h3>
            <span className="text-xs text-slate-400">Total Batches: {batches.length}</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading batch records...</div>
          ) : batches.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No upload batches found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4">Upload Date</th>
                    <th className="py-3 px-4">Source Rows</th>
                    <th className="py-3 px-4">Unique Orders</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{b.file_name}</td>
                      <td className="py-3 px-4 font-semibold text-cyan-300 whitespace-nowrap">
                        {b.order_date_range || (b.order_date ? formatSalesDateShort(b.order_date) : '-')}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {new Date(b.uploaded_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">{b.total_source_rows}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">{b.total_unique_orders}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteBatch(b.id, b.file_name)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Delete Batch"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
