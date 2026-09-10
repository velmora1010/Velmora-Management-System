import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Loader2, 
  Truck, 
  Search, 
  FileCheck, 
  ArrowRight,
  Package,
  Check
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import db from '../../lib/db';
import { dispatchBatchService } from '../../services/dispatchBatchService';
import { logActivity } from '../../services/activityService';
import toast from 'react-hot-toast';

export interface UploadCourierShipmentModalProps {
  campaign: Campaign;
  courier: 'ST Courier' | 'Delhivery';
  influencers: CampaignInfluencer[];
  onClose: () => void;
  onSuccess: () => void;
}

export interface ParsedShipmentRow {
  rowIdx: number;
  rawIdentifier: string;
  awbNumber: string;
  weight?: string;
  status?: string;
  dispatchDate?: string;
  expectedDeliveryDate?: string;
  matchedInfluencer?: CampaignInfluencer;
  matchType?: 'code' | 'phone' | 'name' | 'id';
  isValid: boolean;
  errorReason?: string;
}

export const UploadCourierShipmentModal: React.FC<UploadCourierShipmentModalProps> = ({
  campaign,
  courier,
  influencers,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedShipmentRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterView, setFilterView] = useState<'all' | 'matched' | 'unmatched'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize helper
  const cleanStr = (val: any): string => {
    if (val === undefined || val === null) return '';
    let s = String(val).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    return s;
  };

  const normalizePhone = (val: any): string => {
    const s = cleanStr(val).replace(/[^0-9]/g, '');
    return s.length >= 10 ? s.slice(-10) : s;
  };

  const normalizeCode = (val: any): string => {
    return cleanStr(val).replace(/^#+/, '').trim().toLowerCase();
  };

  // Find header index based on possible variations
  const findColumnKey = (rowKeys: string[], possibleNames: string[]): string | null => {
    for (const key of rowKeys) {
      const normKey = key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      for (const target of possibleNames) {
        const normTarget = target.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (normKey === normTarget || normKey.includes(normTarget)) {
          return key;
        }
      }
    }
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const isCsv = selectedFile.name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      toast.error('Invalid format. Please upload an Excel (.xlsx/.xls) or CSV (.csv) file.');
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];

      if (rawData.length === 0) {
        toast.error('The uploaded file contains no data.');
        setIsProcessing(false);
        return;
      }

      const headers = Object.keys(rawData[0]);

      // Detect AWB column
      const awbCol = findColumnKey(headers, [
        'trackingnumber', 'trackingno', 'trackingid', 'waybill', 'awbnumber', 
        'awbno', 'awb', 'consignmentno', 'consignmentnumber', 'cnno', 'lrno', 'docketno'
      ]);

      // Detect identifier column
      const idCol = findColumnKey(headers, [
        'order', 'orderid', 'orderno', 'ordernumber', 'influencercode', 'code', 
        'influencerid', 'creatorname', 'creator', 'influencername', 'name', 
        'customername', 'recipient', 'mobile', 'phone', 'phonenumber', 'contact'
      ]);

      // Detect optional columns
      const weightCol = findColumnKey(headers, ['weight', 'totalweight', 'chargedweight', 'actualweight']);
      const statusCol = findColumnKey(headers, ['status', 'shipmentstatus', 'currentstatus']);
      const dateCol = findColumnKey(headers, ['dispatchdate', 'bookingdate', 'orderdate', 'date', 'pickupdate']);
      const eddCol = findColumnKey(headers, ['expecteddeliverydate', 'edd', 'deliverydate']);

      if (!awbCol) {
        toast.error('Could not detect AWB / Tracking number column. Please ensure header includes "Tracking number", "AWB", or "Waybill".', { duration: 6000 });
        setIsProcessing(false);
        return;
      }

      // Build quick lookup maps for campaign influencers
      const codeMap = new Map<string, CampaignInfluencer>();
      const phoneMap = new Map<string, CampaignInfluencer>();
      const nameMap = new Map<string, CampaignInfluencer>();
      const idMap = new Map<string, CampaignInfluencer>();

      influencers.forEach(inf => {
        idMap.set(String(inf.id), inf);
        if (inf.code) codeMap.set(normalizeCode(inf.code), inf);
        if (inf.phone_number) phoneMap.set(normalizePhone(inf.phone_number), inf);
        if (inf.alternative_number) phoneMap.set(normalizePhone(inf.alternative_number), inf);
        if (inf.influencer_name) nameMap.set(cleanStr(inf.influencer_name).toLowerCase(), inf);
        if (inf.name) nameMap.set(cleanStr(inf.name).toLowerCase(), inf);
      });

      const parsed: ParsedShipmentRow[] = [];

      rawData.forEach((row, idx) => {
        const rawAwb = cleanStr(row[awbCol]);
        const rawId = idCol ? cleanStr(row[idCol]) : '';
        const rawWeight = weightCol ? cleanStr(row[weightCol]) : '';
        const rawStatus = statusCol ? cleanStr(row[statusCol]) : '';
        const rawDate = dateCol ? cleanStr(row[dateCol]) : '';
        const rawEdd = eddCol ? cleanStr(row[eddCol]) : '';

        // Skip completely empty rows
        if (!rawAwb && !rawId) return;

        let matchedInf: CampaignInfluencer | undefined;
        let matchType: 'code' | 'phone' | 'name' | 'id' | undefined;

        if (rawId) {
          const normId = normalizeCode(rawId);
          const normPhone = normalizePhone(rawId);
          const normName = cleanStr(rawId).toLowerCase();

          if (codeMap.has(normId)) {
            matchedInf = codeMap.get(normId);
            matchType = 'code';
          } else if (normPhone && phoneMap.has(normPhone)) {
            matchedInf = phoneMap.get(normPhone);
            matchType = 'phone';
          } else if (nameMap.has(normName)) {
            matchedInf = nameMap.get(normName);
            matchType = 'name';
          } else if (idMap.has(rawId)) {
            matchedInf = idMap.get(rawId);
            matchType = 'id';
          }
        }

        // If not matched by identifier, try checking if rawAwb itself matches code or if row has other phone/code fields
        if (!matchedInf) {
          for (const key of headers) {
            const val = cleanStr(row[key]);
            if (!val) continue;
            const normC = normalizeCode(val);
            const normP = normalizePhone(val);
            if (codeMap.has(normC)) {
              matchedInf = codeMap.get(normC);
              matchType = 'code';
              break;
            } else if (normP && phoneMap.has(normP)) {
              matchedInf = phoneMap.get(normP);
              matchType = 'phone';
              break;
            }
          }
        }

        const isValidAwb = Boolean(rawAwb && rawAwb.length >= 4);
        const isValid = Boolean(isValidAwb && matchedInf);

        let errorReason = '';
        if (!isValidAwb) {
          errorReason = 'Missing or invalid AWB number';
        } else if (!matchedInf) {
          errorReason = `No influencer found for "${rawId || 'row ' + (idx + 1)}" in this campaign`;
        }

        parsed.push({
          rowIdx: idx + 1,
          rawIdentifier: rawId || rawAwb,
          awbNumber: rawAwb,
          weight: rawWeight || undefined,
          status: rawStatus || undefined,
          dispatchDate: rawDate || undefined,
          expectedDeliveryDate: rawEdd || undefined,
          matchedInfluencer: matchedInf,
          matchType,
          isValid,
          errorReason: errorReason || undefined
        });
      });

      setParsedRows(parsed);
      setStep('preview');
      toast.success(`Parsed ${parsed.length} rows from ${selectedFile.name}`);
    } catch (err: any) {
      console.error('File parsing error:', err);
      toast.error(`Error parsing file: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Preview filtering & statistics
  const matchedCount = useMemo(() => parsedRows.filter(r => r.isValid).length, [parsedRows]);
  const unmatchedCount = useMemo(() => parsedRows.filter(r => !r.isValid).length, [parsedRows]);

  const filteredPreviewRows = useMemo(() => {
    return parsedRows.filter(row => {
      if (filterView === 'matched' && !row.isValid) return false;
      if (filterView === 'unmatched' && row.isValid) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const creator = (row.matchedInfluencer?.influencer_name || row.matchedInfluencer?.name || '').toLowerCase();
      const code = (row.matchedInfluencer?.code || '').toLowerCase();
      const awb = row.awbNumber.toLowerCase();
      const raw = row.rawIdentifier.toLowerCase();

      return creator.includes(term) || code.includes(term) || awb.includes(term) || raw.includes(term);
    });
  }, [parsedRows, filterView, searchTerm]);

  // Execute database import
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid && r.matchedInfluencer);
    if (validRows.length === 0) {
      toast.error('No valid matched shipments to import.');
      return;
    }

    setIsImporting(true);
    const toastId = toast.loading(`Importing ${validRows.length} shipments for ${courier}...`);

    try {
      let savedCount = 0;
      const todayDate = new Date().toISOString().split('T')[0];

      for (const row of validRows) {
        const inf = row.matchedInfluencer!;
        const influencerId = String(inf.id);
        const campaignId = String(campaign.id);
        const awb = row.awbNumber.trim();
        const weight = row.weight || inf.dispatchDetails?.total_weight || '500g';
        const dispatchDate = row.dispatchDate || inf.dispatchDetails?.dispatch_date || todayDate;
        const expectedEdd = row.expectedDeliveryDate || inf.dispatchDetails?.expected_delivery_date || null;

        // 1. Check if dispatch record exists in Supabase
        const { data: existingRecords } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id')
          .eq('influencer_id', influencerId)
          .eq('campaign_id', campaignId);

        if (existingRecords && existingRecords.length > 0) {
          // Update existing dispatch record
          await supabase
            .from(SUPABASE_TABLES.influencerDispatch)
            .update({
              courier_partner: courier,
              tracking_id: awb,
              dispatch_status: 'Dispatched',
              dispatch_date: dispatchDate,
              expected_delivery_date: expectedEdd,
              total_weight: weight
            })
            .eq('id', existingRecords[0].id);
        } else {
          // Insert new dispatch record
          await supabase
            .from(SUPABASE_TABLES.influencerDispatch)
            .insert({
              influencer_id: influencerId,
              campaign_id: campaignId,
              creator_name: inf.influencer_name || inf.name || 'Influencer',
              phone_number: inf.phone_number || null,
              alternative_phone_number: inf.alternative_number || null,
              address: inf.complete_address || (inf as any).address || null,
              state: inf.state || null,
              campaign_name: campaign.campaign_name,
              courier_partner: courier,
              tracking_id: awb,
              dispatch_status: 'Dispatched',
              dispatch_date: dispatchDate,
              expected_delivery_date: expectedEdd,
              total_weight: weight,
              selected_products: [],
              total_products: 1
            });
        }

        // 2. Also register in local Dexie database for Logistics/Tracking sync
        try {
          const existingOrder = await db.logistics_orders
            .where('orderId')
            .equals(inf.code || `INF-${influencerId}`)
            .first();

          if (existingOrder) {
            await db.logistics_orders.update(existingOrder.id!, {
              awbNumber: awb,
              courier,
              syncedAt: new Date().toLocaleString()
            });
          } else {
            await db.logistics_orders.add({
              orderId: inf.code || `INF-${influencerId}`,
              awbNumber: awb,
              courier,
              customerName: inf.influencer_name || inf.name || 'Influencer',
              phoneNumber: inf.phone_number || '',
              orderType: 'Influencer Kit',
              amount: '0',
              products: 'Influencer Kit',
              stage: 'order_data',
              uploadedAt: new Date().toLocaleString(),
              status: 'Not Tracked',
              state: inf.state || 'Unknown',
              pincode: inf.pincode || ''
            });
          }
        } catch (dexieErr) {
          console.warn('Dexie logistics order update non-fatal error:', dexieErr);
        }

        savedCount++;
      }

      // 3. Keep dispatch batches in sync
      try {
        const loadedBatches = await dispatchBatchService.getBatches(campaign.id);
        if (loadedBatches && loadedBatches.length > 0) {
          const updatedBatches = loadedBatches.map(b => {
            let batchModified = false;
            const updatedMembers = b.members.map(m => {
              const matched = validRows.find(vr => String(vr.matchedInfluencer?.id) === String(m.influencer_id));
              if (matched) {
                batchModified = true;
                return { ...m, dispatch_status: 'Dispatched' as const };
              }
              return m;
            });
            if (batchModified) {
              const allDispatched = updatedMembers.every(m => m.dispatch_status === 'Dispatched');
              return {
                ...b,
                members: updatedMembers,
                status: allDispatched ? ('Dispatched' as const) : b.status,
                updated_at: new Date().toISOString()
              };
            }
            return b;
          });
          await dispatchBatchService.saveBatches(campaign.id, updatedBatches);
        }
      } catch (batchErr) {
        console.warn('Batch update non-fatal error:', batchErr);
      }

      // 4. Log activity
      try {
        await logActivity({
          department: 'Marketing',
          action: `Bulk Upload ${courier} Shipments`,
          description: `Imported ${savedCount} shipments for ${courier} in campaign "${campaign.campaign_name}" from file "${file?.name}"`,
          record_id: String(campaign.id),
          record_name: campaign.campaign_name,
          metadata: {
            courier,
            savedCount,
            fileName: file?.name
          }
        });
      } catch (logErr) {
        // Non fatal
      }

      toast.dismiss(toastId);
      toast.success(`Successfully imported ${savedCount} shipments for ${courier}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Import execution error:', err);
      toast.dismiss(toastId);
      toast.error(`Import failed: ${err.message || String(err)}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#141a29] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700/80 bg-[#1e2638] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30 shrink-0">
              <Truck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  Upload for {courier}
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-950/70 border border-purple-800/50 text-purple-300">
                  {courier}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload shipments for {courier} in <span className="text-purple-300 font-semibold">{campaign.campaign_name}</span>
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Dropzone Area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700/80 hover:border-purple-500/80 bg-[#0e1626]/70 hover:bg-purple-950/10 rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[220px] group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />

                {isProcessing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={38} className="text-purple-400 animate-spin" />
                    <span className="text-sm font-semibold text-slate-200">Reading & parsing file...</span>
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-purple-400 group-hover:scale-105 group-hover:bg-purple-900/50 transition-all mb-3">
                      <FileSpreadsheet size={36} />
                    </div>
                    <p className="text-base font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                      Click or drag shipment file here
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports Excel (.xlsx, .xls) and CSV (.csv) exports
                    </p>
                  </>
                )}
              </div>

              {/* Supported Columns Guide */}
              <div className="p-4 bg-[#0e1626]/60 border border-slate-800/80 rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Package size={14} className="text-purple-400" />
                  <span>Column Auto-Detection Reference</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-400 text-[11px] leading-relaxed">
                  <div>
                    <span className="text-purple-300 font-medium">Tracking Number / AWB:</span> Tracking number, AWB, Waybill, Consignment No, Tracking ID
                  </div>
                  <div>
                    <span className="text-purple-300 font-medium">Influencer Identifier:</span> Order, Order ID, Influencer Code, Creator Name, Phone
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary Stats Bar */}
              <div className="grid grid-cols-3 gap-3">
                <div 
                  onClick={() => setFilterView('all')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    filterView === 'all' ? 'bg-purple-950/50 border-purple-500' : 'bg-[#0e1626]/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[11px] font-medium text-slate-400">Total Rows</div>
                  <div className="text-lg font-bold text-slate-100">{parsedRows.length}</div>
                </div>

                <div 
                  onClick={() => setFilterView('matched')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    filterView === 'matched' ? 'bg-emerald-950/50 border-emerald-500' : 'bg-[#0e1626]/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span>Matched Shipments</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-300">{matchedCount}</div>
                </div>

                <div 
                  onClick={() => setFilterView('unmatched')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    filterView === 'unmatched' ? 'bg-rose-950/50 border-rose-500' : 'bg-[#0e1626]/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>Unmatched / Skipped</span>
                  </div>
                  <div className="text-lg font-bold text-rose-300">{unmatchedCount}</div>
                </div>
              </div>

              {/* Search within preview */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search by creator name, code, or AWB..." 
                  className="w-full h-9 bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Rows Table */}
              <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-[#0b101b]/60 max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#121929] sticky top-0 z-10 border-b border-slate-800 text-slate-400 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">File Ref</th>
                      <th className="py-2.5 px-3">Matched Influencer</th>
                      <th className="py-2.5 px-3">AWB / Tracking</th>
                      <th className="py-2.5 px-3">Courier</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-200">
                    {filteredPreviewRows.length > 0 ? (
                      filteredPreviewRows.map((row, idx) => {
                        const inf = row.matchedInfluencer;
                        const creator = inf?.influencer_name || inf?.name || '—';
                        return (
                          <tr key={idx} className={`hover:bg-slate-800/40 transition-colors ${!row.isValid ? 'bg-rose-950/10' : ''}`}>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{row.rowIdx}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-300">{row.rawIdentifier}</td>
                            <td className="py-2.5 px-3">
                              {inf ? (
                                <div>
                                  <div className="font-semibold text-slate-100">{creator}</div>
                                  <div className="text-[10px] text-purple-400 font-mono">{inf.code || 'No Code'}</div>
                                </div>
                              ) : (
                                <span className="text-rose-400 text-[11px] italic">Not Found</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-200">
                              {row.awbNumber || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-800/60 text-purple-300 font-semibold text-[10px]">
                                {courier}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {row.isValid ? (
                                <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                                  <Check size={12} /> Ready
                                </span>
                              ) : (
                                <span className="text-rose-400 text-[11px]" title={row.errorReason}>
                                  {row.errorReason}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500 italic text-xs">
                          No rows match your preview filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-700/80 bg-[#1e2638] flex items-center justify-between shrink-0">
          {step === 'preview' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setParsedRows([]);
                }}
                disabled={isImporting}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Back to File Select
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || matchedCount === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-md shadow-purple-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Importing Shipments...</span>
                  </>
                ) : (
                  <>
                    <FileCheck size={14} />
                    <span>Confirm & Import ({matchedCount}) Shipments</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
