import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  X, 
  Truck, 
  RefreshCw, 
  Upload
} from 'lucide-react';
import type { Campaign } from '../../types';
import { 
  upsertIThinkLogisticsRecords, 
  fetchIThinkLogisticsRecords 
} from '../../services/ithinkLogisticsService';
import toast from 'react-hot-toast';

interface UploadIThinkModalProps {
  campaign: Campaign;
  initialFile: File | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

interface ParsedIThinkRow {
  order_number: string;
  awb_no: string;
  courier_company: string;
  order_status: string;
  order_pickup_date: string;
  isExisting?: boolean;
}

function cleanStr(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findCol(headers: string[], candidates: string[]): string | null {
  const normCandidates = candidates.map(c => normalizeHeader(c));
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (normCandidates.includes(norm)) {
      return h;
    }
  }
  return null;
}

export const UploadIThinkModal: React.FC<UploadIThinkModalProps> = ({
  campaign,
  initialFile,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(initialFile);
  const [step, setStep] = useState<'reading' | 'preview' | 'importing' | 'error'>('reading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const [totalRows, setTotalRows] = useState(0);
  const [validRows, setValidRows] = useState<ParsedIThinkRow[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file) {
      parseFile(file);
    }
  }, [file]);

  const parseFile = async (f: File) => {
    setStep('reading');
    setErrorMessage('');

    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('No sheets found in the uploaded workbook.');
      }

      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, any>[];

      if (!rawData || rawData.length === 0) {
        throw new Error('The uploaded CSV file contains no data rows.');
      }

      const headers = Object.keys(rawData[0] || {});

      // Required columns check:
      // - Order Number
      // - AWB No
      // - Courier Company
      // - Order Status
      // - Order Pick Up Date
      const orderCol = findCol(headers, ['ordernumber', 'orderno', 'orderid', 'order_number']);
      const awbCol = findCol(headers, ['awbno', 'awbnumber', 'awb', 'waybill', 'trackingnumber', 'awb_no']);
      const courierCol = findCol(headers, ['couriercompany', 'courier_company', 'courierpartner', 'courier']);
      const statusCol = findCol(headers, ['orderstatus', 'order_status', 'shipmentstatus', 'status']);
      const pickupDateCol = findCol(headers, [
        'orderpickupdate', 
        'order_pickup_date', 
        'orderpickup_date', 
        'pickupdate', 
        'pickup_date', 
        'dispatcheddate', 
        'dispatchdate'
      ]);

      const missing: string[] = [];
      if (!orderCol) missing.push('Order Number');
      if (!awbCol) missing.push('AWB No');
      if (!courierCol) missing.push('Courier Company');
      if (!statusCol) missing.push('Order Status');
      if (!pickupDateCol) missing.push('Order Pick Up Date');

      if (missing.length > 0) {
        throw new Error(
          `Missing required column(s): ${missing.join(', ')}. Available headers: ${headers.join(', ')}`
        );
      }

      // Fetch existing DB records to check duplicates (order_number + awb_no)
      const existingRecords = await fetchIThinkLogisticsRecords();
      const existingKeySet = new Set<string>();
      existingRecords.forEach(r => {
        const key = `${cleanStr(r.order_number).toLowerCase()}_${cleanStr(r.awb_no).toLowerCase()}`;
        if (key !== '_') existingKeySet.add(key);
      });

      const parsed: ParsedIThinkRow[] = [];
      let newCnt = 0;
      let dupCnt = 0;

      for (const row of rawData) {
        const orderNumber = cleanStr(row[orderCol!]);
        const awbNo = cleanStr(row[awbCol!]);
        const courierCompany = cleanStr(row[courierCol!]);
        const orderStatus = cleanStr(row[statusCol!]);
        const pickupDate = cleanStr(row[pickupDateCol!]);

        // Skip completely empty rows
        if (!orderNumber && !awbNo && !courierCompany && !orderStatus && !pickupDate) {
          continue;
        }

        // Require at least order_number and awb_no
        if (!orderNumber || !awbNo) {
          continue;
        }

        const key = `${orderNumber.toLowerCase()}_${awbNo.toLowerCase()}`;
        const isExisting = existingKeySet.has(key);
        if (isExisting) {
          dupCnt++;
        } else {
          newCnt++;
        }

        parsed.push({
          order_number: orderNumber,
          awb_no: awbNo,
          courier_company: courierCompany,
          order_status: orderStatus,
          order_pickup_date: pickupDate,
          isExisting
        });
      }

      if (parsed.length === 0) {
        throw new Error('No valid records with both "Order Number" and "AWB No" found in file.');
      }

      setTotalRows(rawData.length);
      setValidRows(parsed);
      setNewCount(newCnt);
      setDuplicateCount(dupCnt);
      setStep('preview');
    } catch (err: any) {
      console.error('[UploadIThinkModal] Parse error:', err);
      setErrorMessage(err.message || 'Failed to parse file.');
      setStep('error');
    }
  };

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setIsSaving(true);
    setStep('importing');

    try {
      const recordsToSave = validRows.map(r => ({
        order_number: r.order_number,
        awb_no: r.awb_no,
        courier_company: r.courier_company,
        order_status: r.order_status,
        order_pickup_date: r.order_pickup_date,
        campaign_id: campaign?.id ? String(campaign.id) : null
      }));

      const res = await upsertIThinkLogisticsRecords(recordsToSave);
      if (!res.success) {
        throw new Error(res.error || 'Failed to save to database.');
      }

      toast.success(
        `Successfully imported ${validRows.length} Amazon shipments (${res.inserted} new, ${res.updated} updated).`,
        { duration: 5000 }
      );

      // Trigger tracking update event
      window.dispatchEvent(
        new CustomEvent('influencer_tracking_updated', {
          detail: { campaignId: campaign.id }
        })
      );

      if (onSuccess) {
        await onSuccess();
      }

      onClose();
    } catch (err: any) {
      console.error('[UploadIThinkModal] Save error:', err);
      setErrorMessage(err.message || 'Failed to save shipments.');
      setStep('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChooseAnotherFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (chosen) {
      setFile(chosen);
    }
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131d36]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Truck size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Upload for Amazon
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60">
                  CSV Import
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Campaign: <span className="text-slate-200 font-semibold">{campaign.campaign_name}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* File Info Bar */}
          {file && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet size={16} className="text-amber-400 shrink-0" />
                <span className="font-mono text-slate-200 font-medium truncate">{file.name}</span>
                <span className="text-slate-500 text-[11px] shrink-0">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold underline underline-offset-2 shrink-0 cursor-pointer disabled:opacity-50"
              >
                Change File
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={handleChooseAnotherFile}
              />
            </div>
          )}

          {/* Reading State */}
          {step === 'reading' && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <RefreshCw size={28} className="animate-spin text-amber-400" />
              <div className="text-sm font-semibold text-slate-200">Reading Amazon CSV...</div>
              <div className="text-xs text-slate-400">Validating columns and checking duplicates</div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3">
              <XCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <div className="text-sm font-bold text-rose-300">CSV Validation Error</div>
                <div className="text-xs text-rose-200 font-mono leading-relaxed">{errorMessage}</div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-900 border border-rose-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Select Another File
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preview State */}
          {(step === 'preview' || step === 'importing') && (
            <div className="space-y-4">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80">
                  <div className="text-[11px] text-slate-400 font-medium">Total Rows</div>
                  <div className="text-lg font-bold font-mono text-slate-100 mt-0.5">{totalRows}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80">
                  <div className="text-[11px] text-emerald-400 font-medium">Valid Shipments</div>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{validRows.length}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80">
                  <div className="text-[11px] text-blue-400 font-medium">New Shipments</div>
                  <div className="text-lg font-bold font-mono text-blue-400 mt-0.5">{newCount}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80">
                  <div className="text-[11px] text-amber-400 font-medium">Updates / Duplicates</div>
                  <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">{duplicateCount}</div>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Data Preview (First {Math.min(validRows.length, 10)} rows)</span>
                  <span>{validRows.length} ready to import</span>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0e1626] text-slate-400 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2">Order Number</th>
                        <th className="px-3 py-2">AWB No</th>
                        <th className="px-3 py-2">Courier Company</th>
                        <th className="px-3 py-2">Order Status</th>
                        <th className="px-3 py-2">Order Pick Up Date</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {validRows.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-3 py-2 font-bold text-slate-100">{row.order_number}</td>
                          <td className="px-3 py-2 text-slate-300">{row.awb_no}</td>
                          <td className="px-3 py-2 text-amber-300 font-sans">{row.courier_company || '—'}</td>
                          <td className="px-3 py-2 font-sans">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/60 text-blue-300 border border-blue-800/60">
                              {row.order_status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-400">{row.order_pickup_date || '—'}</td>
                          <td className="px-3 py-2 text-right font-sans">
                            {row.isExisting ? (
                              <span className="text-[10px] text-amber-400 font-medium">Update</span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-medium">New</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Duplicate Prevention Note */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300/90">
                <CheckCircle2 size={13} className="shrink-0 text-amber-400" />
                <span>
                  Duplicate prevention enabled: repeated uploads match by <strong>Order Number + AWB No</strong> to prevent duplicates.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-[#131d36]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          {step === 'preview' && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isSaving || validRows.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={14} />
              <span>Confirm and Import ({validRows.length} Shipments)</span>
            </button>
          )}

          {step === 'importing' && (
            <button
              type="button"
              disabled
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600/80 text-white flex items-center gap-2 cursor-wait"
            >
              <RefreshCw size={14} className="animate-spin" />
              <span>Saving to ithink_logistics...</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
