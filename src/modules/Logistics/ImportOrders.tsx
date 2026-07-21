import React, { useState, useRef, useMemo, useEffect } from 'react';
import db from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import * as XLSX from 'xlsx';
import { UploadCloud, Table, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { importHistoricalData, mapAllRows, detectColumns, extractDateOnly, type ColumnMapping } from '../../services/deliveryRecommendationService';
import { normalizePincode } from '../../utils/pincodeUtils';
import { recommendationRefreshManager } from '../../services/recommendationRefreshManager';

interface ImportOrdersProps {
  initialFileId?: number | null;
}

export const ImportOrders: React.FC<ImportOrdersProps> = ({ initialFileId }) => {
  const [selectedImportId, setSelectedImportId] = useState<number | null>(initialFileId || null);

  React.useEffect(() => {
    if (initialFileId !== undefined && initialFileId !== null) {
      setSelectedImportId(initialFileId);
    }
  }, [initialFileId]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all local imports from IndexedDB
  const importsList = useLiveQuery(() => db.logistics_imports.reverse().toArray(), []) ?? [];

  // Automatically select the latest import if none selected
  React.useEffect(() => {
    if (importsList.length > 0 && selectedImportId === null) {
      setSelectedImportId(importsList[0].id || null);
    }
  }, [importsList, selectedImportId]);

  // Load active import details
  const activeImport = useLiveQuery(
    async () => {
      if (!selectedImportId) return undefined;
      return await db.logistics_imports.get(selectedImportId);
    },
    [selectedImportId]
  );

  const [pincodeSearch, setPincodeSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(recommendationRefreshManager.isRefreshing());

  useEffect(() => {
    const unsubscribe = recommendationRefreshManager.subscribe((refreshing) => {
      setIsRefreshing(refreshing);
    });
    return unsubscribe;
  }, []);

  const [debugOrderInfo, setDebugOrderInfo] = useState<{ orderId: string; rawRows: any[][]; headers: string[]; cols: ColumnMapping } | null>(null);

  const handleDebugClick = (mr: any) => {
    if (!activeImport) return;
    const cols = detectColumns(activeImport.headers);
    const targetId = String(mr.orderId).trim().toLowerCase();
    
    const matches = activeImport.rows.filter(row => {
      const orderNo = cols.orderNoIdx !== -1 ? String(row[cols.orderNoIdx] || '').replace(/^'+/, '').trim() : '';
      return orderNo.toLowerCase() === targetId;
    });

    setDebugOrderInfo({
      orderId: mr.orderId,
      rawRows: matches,
      headers: activeImport.headers,
      cols
    });
  };

  React.useEffect(() => {
    setPincodeSearch('');
  }, [selectedImportId]);

  // Map raw rows to display columns
  const mappedRows = useMemo(() => {
    if (!activeImport) return [];
    const { mapped } = mapAllRows(activeImport.headers, activeImport.rows);
    return mapped;
  }, [activeImport]);

  const filteredMappedRows = useMemo(() => {
    const search = normalizePincode(pincodeSearch).trim().toLowerCase();
    if (!search) return mappedRows;
    return mappedRows.filter(mr => normalizePincode(mr.pincode).toLowerCase().includes(search));
  }, [mappedRows, pincodeSearch]);

  const handleFile = async (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCsv = file.name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      toast.error('Invalid file format. Please upload an Excel (.xlsx/.xls) or CSV (.csv) file.');
      return;
    }

    const loadToast = toast.loading(`Parsing ${file.name}...`);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          // Parse to 2D array: header row + data rows
          const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];
          
          if (rawRows.length === 0) {
            toast.dismiss(loadToast);
            toast.error('The uploaded file is empty.');
            return;
          }

          const headers = rawRows[0].map(h => String(h || ''));
          const rows = rawRows.slice(1);

          const historicalResult = await importHistoricalData(headers, rows, file.name);

          const newImport = {
            fileName: file.name,
            uploadedAt: new Date().toLocaleString(),
            headers,
            rows,
            rawCount: historicalResult.rawCount,
            savedCount: historicalResult.savedCount,
            duplicateCount: historicalResult.duplicateCount,
            skippedCount: historicalResult.skippedCount,
            invalidDateCount: historicalResult.invalidDateCount,
            missingDeliveredCount: historicalResult.missingDeliveredCount,
            missingOrderCount: historicalResult.missingOrderCount,
            parsedCount: historicalResult.parsedCount,
            columnsDetected: historicalResult.columnsDetected
          };

          const newId = await db.logistics_imports.add(newImport);
          setSelectedImportId(Number(newId));

          toast.dismiss(loadToast);
          recommendationRefreshManager.startRefresh();
          setTimeout(() => {
            recommendationRefreshManager.completeRefresh();
            toast.success("Delivery recommendations updated successfully.");
            if (!historicalResult.columnsDetected) {
              toast.error('File uploaded, but no delivery history columns detected for recommendation.', { duration: 6000 });
            }
          }, 800);
        } catch (err: any) {
          toast.dismiss(loadToast);
          toast.error(`Parsing error: ${err.message || String(err)}`);
        }
      };

      reader.onerror = () => {
        toast.dismiss(loadToast);
        toast.error('File read error.');
      };

      reader.readAsBinaryString(file);
    } catch (err: any) {
      toast.dismiss(loadToast);
      toast.error(`Error: ${err.message || String(err)}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const deleteImport = async () => {
    if (!selectedImportId) return;
    if (confirm('Are you sure you want to delete this imported spreadsheet and its historical delivery records?')) {
      try {
        const imp = importsList.find(i => i.id === selectedImportId);
        if (imp) {
          await db.delivery_history.where('sourceFileName').equals(imp.fileName).delete();
        }
        await db.logistics_imports.delete(selectedImportId);
        setSelectedImportId(null);
        toast.success('Import and associated delivery history deleted.');
      } catch (err: any) {
        toast.error(`Delete failed: ${err.message}`);
      }
    }
  };

  const clearAllHistory = async () => {
    if (confirm('Are you sure you want to clear ALL imported delivery history files and records from the database? This cannot be undone.')) {
      try {
        await db.delivery_history.clear();
        await db.logistics_imports.clear();
        setSelectedImportId(null);
        toast.success('All delivery history cleared.');
      } catch (err: any) {
        toast.error(`Clear failed: ${err.message}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-5">
      {isRefreshing && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400 font-semibold flex items-center gap-3 animate-pulse shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
          <span>Refreshing recommendations...</span>
        </div>
      )}
      
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Import Orders</h2>
          <p className="text-muted text-[11px] mt-1">Upload CSV or Excel spreadsheets to view raw order records.</p>
        </div>
        
        {importsList.length > 0 && (
          <div className="flex items-center gap-3">
            {selectedImportId && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by Pincode..."
                  value={pincodeSearch}
                  onChange={(e) => setPincodeSearch(e.target.value)}
                  className="h-9 bg-slate-900 border border-slate-700/80 rounded-xl pl-3 pr-8 text-xs text-slate-200 focus:outline-none focus:border-primary w-44 shadow-sm"
                />
                {pincodeSearch && (
                  <button
                    onClick={() => setPincodeSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <select
              value={selectedImportId || ''}
              onChange={(e) => setSelectedImportId(Number(e.target.value))}
              className="h-9 bg-slate-900 border border-slate-700/80 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-primary max-w-xs shadow-sm"
            >
              {importsList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fileName} ({new Date(item.uploadedAt).toLocaleDateString()})
                </option>
              ))}
            </select>
            
            <button
              onClick={deleteImport}
              className="h-9 w-9 flex items-center justify-center border border-slate-700/80 hover:border-red-500/20 text-slate-400 hover:text-red-400 bg-slate-900 rounded-xl transition-all shadow-sm cursor-pointer"
              title="Delete selected sheet"
            >
              <Trash2 size={14} />
            </button>
            
            <button
              onClick={clearAllHistory}
              className="px-3 h-9 flex items-center gap-1.5 border border-red-500/25 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Clear all imported delivery records"
            >
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* Main body area */}
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        
        {/* Upload box */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-2 shrink-0 ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border/30 hover:border-primary/50 bg-slate-800/10'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".csv, .xlsx, .xls"
            className="hidden"
          />
          <UploadCloud className="text-muted group-hover:text-primary transition-colors" size={30} />
          <div>
            <span className="text-xs font-semibold text-slate-200">Drag & drop sheet here, or </span>
            <span className="text-xs font-semibold text-primary hover:underline">browse</span>
          </div>
          <span className="text-[10px] text-muted font-medium">Supports Excel (.xlsx, .xls) and CSV files</span>
        </div>

        {/* Spreadsheet View */}
        <div className="flex-1 min-h-0 bg-slate-950/40 border border-border/10 rounded-xl flex flex-col overflow-hidden">
          {activeImport ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Delivery History Stats Bar */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-b border-border/10 shrink-0">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivery History Feed:</span>
                  {activeImport.columnsDetected ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                        {activeImport.rawCount || 0} Raw Rows
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        {activeImport.savedCount || 0} Unique Saved
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        {activeImport.duplicateCount || 0} Duplicates Removed
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 border border-red-500/20 text-red-400">
                        {activeImport.invalidDateCount || 0} Invalid Dates
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        {activeImport.missingDeliveredCount || 0} Missing Delivery Dates
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        {activeImport.missingOrderCount || 0} Missing Order Dates
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        {activeImport.parsedCount || 0} Parsed Dates
                      </span>
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 border border-red-500/20 text-red-400">
                      No delivery history columns detected for recommendation
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-[11px] table-auto">
                <thead className="bg-slate-900/80 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 text-center w-12 bg-slate-900">#</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider whitespace-nowrap">Order Id</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider whitespace-nowrap">Customer Name</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider whitespace-nowrap">Pincode</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider whitespace-nowrap">Order Date</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider whitespace-nowrap">City</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider whitespace-nowrap">State</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider whitespace-nowrap">Delivery Date</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider whitespace-nowrap">Courier</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider whitespace-nowrap text-center">Delivery Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {filteredMappedRows.length > 0 ? (
                    filteredMappedRows.map((mr, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/35 transition-colors">
                        <td className="px-4 py-2 text-center text-slate-500 border-r border-border/10 font-mono">{rIdx + 1}</td>
                        <td className="px-4 py-2 text-slate-200 font-mono font-bold whitespace-nowrap">{mr.orderId || '-'}</td>
                        <td className="px-4 py-2 text-slate-300 font-medium whitespace-nowrap">{mr.customerName || '-'}</td>
                        <td className="px-4 py-2 text-slate-400 font-mono font-medium whitespace-nowrap">{normalizePincode(mr.pincode) || '-'}</td>
                        <td className="px-4 py-2 text-slate-400 font-medium whitespace-nowrap">{mr.orderDate || '-'}</td>
                        <td className="px-4 py-2 text-slate-300 font-medium whitespace-nowrap">{mr.city || '-'}</td>
                        <td className="px-4 py-2 text-slate-300 font-medium whitespace-nowrap">{mr.state || '-'}</td>
                        <td className="px-4 py-2 text-slate-400 font-medium whitespace-nowrap flex items-center gap-2">
                          <span>{mr.deliveryDate || '-'}</span>
                          {(!mr.deliveryDate || mr.deliveryDate === '-') && (
                            <button
                              onClick={() => handleDebugClick(mr)}
                              className="px-1.5 py-0.5 bg-red-500/25 border border-red-500/50 hover:bg-red-500/50 text-red-300 rounded text-[9px] font-semibold transition-colors cursor-pointer"
                            >
                              Debug
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-300 font-medium whitespace-nowrap">{mr.courier || '-'}</td>
                        <td className="px-4 py-2 text-center font-bold whitespace-nowrap">
                          {typeof mr.deliveryDays === 'number' && mr.deliveryDays >= 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              {mr.deliveryDays} days
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 font-mono">
                              {mr.deliveryDays}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-slate-500 italic bg-slate-900/10">
                        No delivery history found for this pincode.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 italic p-6 space-y-3">
              <Table size={32} className="opacity-40 text-primary" />
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-400">No spreadsheets imported yet</p>
                <p className="text-[11px] text-muted mt-1 font-normal">Upload a file above to view spreadsheet contents.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {debugOrderInfo && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-5 border-b border-border/10 bg-slate-850">
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                Emergency Debug: Order {debugOrderInfo.orderId}
              </h3>
              <button 
                onClick={() => setDebugOrderInfo(null)} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800 rounded-lg border border-slate-700/60 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1 custom-scrollbar">
              <div className="bg-slate-950/40 p-4 rounded-xl border border-border/5 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-slate-300">
                  <div>
                    <span className="text-slate-500 block">Order Number Column index:</span>
                    <span className="text-white font-mono">{debugOrderInfo.cols.orderNoIdx} ({debugOrderInfo.headers[debugOrderInfo.cols.orderNoIdx] || 'Not Found'})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Order Date Column index:</span>
                    <span className="text-white font-mono">{debugOrderInfo.cols.orderDateIdx} ({debugOrderInfo.headers[debugOrderInfo.cols.orderDateIdx] || 'Not Found'})</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Order Delivered Date Column index:</span>
                    <span className="text-red-400 font-mono font-bold">{debugOrderInfo.cols.deliveredDateIdx} ({debugOrderInfo.headers[debugOrderInfo.cols.deliveredDateIdx] || 'Not Found'})</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-border/10 rounded-xl">
                <table className="w-full text-left border-collapse text-[11px] table-auto">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Row Index</th>
                      <th className="px-3 py-2">Raw Order Number</th>
                      <th className="px-3 py-2">Raw Order Date</th>
                      <th className="px-3 py-2">Raw Order Delivered Date</th>
                      <th className="px-3 py-2">mapped deliveryDateDisplay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 bg-slate-900/40">
                    {debugOrderInfo.rawRows.map((row, idx) => {
                      const rawId = debugOrderInfo.cols.orderNoIdx !== -1 ? row[debugOrderInfo.cols.orderNoIdx] : '';
                      const rawO = debugOrderInfo.cols.orderDateIdx !== -1 ? row[debugOrderInfo.cols.orderDateIdx] : '';
                      const rawD = debugOrderInfo.cols.deliveredDateIdx !== -1 ? row[debugOrderInfo.cols.deliveredDateIdx] : '';
                      const mappedD = extractDateOnly(rawD);
                      return (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2 text-slate-200 font-mono">{String(rawId || '')}</td>
                          <td className="px-3 py-2 text-slate-200 font-mono">{String(rawO || '')}</td>
                          <td className="px-3 py-2 text-red-300 font-mono font-bold bg-red-500/5">{String(rawD || '')}</td>
                          <td className="px-3 py-2 text-slate-300 font-mono">{mappedD}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-5 pt-0 border-t border-border/10 bg-slate-800/10 flex justify-end h-16 items-center">
              <button
                onClick={() => setDebugOrderInfo(null)}
                className="px-5 h-9 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
