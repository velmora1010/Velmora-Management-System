import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  AlertTriangle 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import db from '../../../lib/db';
import { cleanOrderId, normalizePhoneNumber } from '../../../services/unifiedLogisticsService';

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
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationSummary, setValidationSummary] = useState<{
    totalRows: number;
    validRows: number;
    duplicateRows: number;
    invalidRows: number;
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewError(null);
    setValidationSummary(null);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet) as any[];

      if (json.length === 0) {
        setPreviewError('The uploaded sheet contains no data rows.');
        return;
      }

      const fileHeaders = Object.keys(json[0]);
      setHeaders(fileHeaders);
      setParsedRows(json);

      // Validate rows
      const existingOrders = await db.logistics_orders.toArray();
      const existingIdSet = new Set(existingOrders.map(o => cleanOrderId(o.orderId).toLowerCase()));

      let valid = 0;
      let duplicates = 0;
      let invalid = 0;

      json.forEach(row => {
        const orderId = cleanOrderId(row['Order'] || row['Order ID'] || row['order_id'] || row['Invoice No']);
        if (!orderId) {
          invalid++;
        } else if (existingIdSet.has(orderId.toLowerCase())) {
          duplicates++;
        } else {
          valid++;
        }
      });

      setValidationSummary({
        totalRows: json.length,
        validRows: valid,
        duplicateRows: duplicates,
        invalidRows: invalid
      });
    } catch (err: any) {
      setPreviewError('Failed to parse spreadsheet: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    try {
      const existingOrders = await db.logistics_orders.toArray();
      const existingIdMap = new Map<string, typeof existingOrders[0]>();
      existingOrders.forEach(o => {
        if (o.stage !== 'trash') {
          existingIdMap.set(cleanOrderId(o.orderId).toLowerCase(), o);
        }
      });

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      await db.transaction('rw', db.logistics_orders, async () => {
        for (const row of parsedRows) {
          const rawId = row['Order'] || row['Order ID'] || row['order_id'] || row['Invoice No'];
          const orderId = cleanOrderId(rawId);
          if (!orderId) {
            skippedCount++;
            continue;
          }

          const rawPhone = row['Phone'] || row['Phone Number'] || row['Mobile'] || row['Customer Phone'];
          const cleanPhone = normalizePhoneNumber(rawPhone);
          const customerName = String(row['Customer'] || row['Customer Name'] || row['Name'] || row['Billing Name'] || 'Customer').trim();
          const address = String(row['Address'] || row['Shipping Address'] || row['Delivery Address'] || '').trim();
          const city = String(row['City'] || row['Shipping City'] || '').trim();
          const state = String(row['State'] || row['Shipping State'] || '').trim();
          const pincode = String(row['Pincode'] || row['Pin Code'] || row['Shipping Zip'] || '').trim();
          const products = String(row['Products'] || row['Item Name'] || row['SKU'] || 'Products').trim();
          const amount = String(row['Amount'] || row['Total'] || row['Order Total'] || '0').trim();
          const orderType = String(row['Payment Method'] || row['Type'] || row['Order Type'] || 'Prepaid').trim();
          const rawAwb = row['Tracking number'] || row['AWB'] || row['Waybill'];
          const courier = String(row['Carrier'] || row['Courier'] || '').trim();
          const rawDate = row['Date'] || row['Order Date'] || row['Created At'];

          const existing = existingIdMap.get(orderId.toLowerCase());

          if (existing) {
            // Update shipment/tracking details if newly present, never overwrite customer data silently
            if (rawAwb && !existing.awbNumber) {
              await db.logistics_orders.update(existing.id!, {
                awbNumber: String(rawAwb).trim(),
                courier: courier || existing.courier
              });
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            // New order -> goes into Active
            await db.logistics_orders.add({
              orderId,
              customerName,
              phoneNumber: cleanPhone || String(rawPhone || ''),
              address,
              city,
              state,
              pincode,
              products,
              amount,
              orderType,
              awbNumber: rawAwb ? String(rawAwb).trim() : undefined,
              courier: courier || undefined,
              stage: 'order_data', // Active stage in Dexie
              status: rawAwb ? 'In Transit' : 'Not Tracked',
              uploadedAt: new Date().toLocaleString(),
              orderDate: rawDate ? String(rawDate).trim() : new Date().toISOString().slice(0, 10)
            });
            insertedCount++;
          }
        }
      });

      toast.success(`Import complete! ${insertedCount} orders placed into Active.`);
      onImportSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Import failed: ' + (err.message || 'Database error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-300">
              <UploadCloud size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Import Orders (Excel / CSV)</h2>
              <p className="text-xs text-slate-400">Imported orders will automatically appear in Active</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700/60"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
          {/* File Picker Zone */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700/80 hover:border-purple-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/40"
          >
            <FileSpreadsheet size={36} className="text-purple-400 mb-2" />
            <p className="text-xs font-semibold text-white">
              {file ? file.name : 'Click to select spreadsheet (.xlsx, .xls, .csv)'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Supports Shopify exports, courier delivery reports, or custom CSV manifests
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {previewError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{previewError}</span>
            </div>
          )}

          {/* Validation Summary */}
          {validationSummary && (
            <div className="grid grid-cols-4 gap-2 bg-slate-950/50 p-3 rounded-2xl border border-slate-800 text-xs text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Rows</span>
                <span className="block font-bold text-white text-sm mt-0.5">{validationSummary.totalRows}</span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-400 uppercase font-semibold">New Orders</span>
                <span className="block font-bold text-emerald-400 text-sm mt-0.5">{validationSummary.validRows}</span>
              </div>
              <div>
                <span className="text-[10px] text-amber-400 uppercase font-semibold">Existing</span>
                <span className="block font-bold text-amber-400 text-sm mt-0.5">{validationSummary.duplicateRows}</span>
              </div>
              <div>
                <span className="text-[10px] text-rose-400 uppercase font-semibold">Invalid</span>
                <span className="block font-bold text-rose-400 text-sm mt-0.5">{validationSummary.invalidRows}</span>
              </div>
            </div>
          )}

          {/* Data Preview */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase mb-2">
                <span>Preview (First 3 rows)</span>
                <span className="text-slate-500 font-mono">{parsedRows.length} total</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 text-[11px]">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                    <tr>
                      {headers.slice(0, 6).map(h => (
                        <th key={h} className="p-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {parsedRows.slice(0, 3).map((r, i) => (
                      <tr key={i}>
                        {headers.slice(0, 6).map(h => (
                          <td key={h} className="p-2 truncate max-w-[120px]">{String(r[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={isProcessing || parsedRows.length === 0}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/30 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            <span>{isProcessing ? 'Importing...' : 'Import into Active'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
