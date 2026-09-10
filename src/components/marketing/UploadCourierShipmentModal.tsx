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
  Package,
  Check,
  RefreshCw
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import db from '../../lib/db';
import { dispatchBatchService } from '../../services/dispatchBatchService';
import { logActivity } from '../../services/activityService';
import {
  syncSingleShipment,
  normalizeDelhiveryStatus,
  normalizeTrackingStatus,
  upsertCampaignShipments,
  InfluencerDispatchedShipment,
  getCourierTrackingUrl
} from '../../services/influencerTrackingService';
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
  orderId?: string;
  awbNumber: string;
  weight?: string;
  status?: string;
  statusType?: string;
  currentStatus?: string;
  dispatchDate?: string;
  expectedDeliveryDate?: string;
  consigneeName?: string;
  city?: string;
  state?: string;
  pincode?: string;
  matchedInfluencer?: CampaignInfluencer;
  matchType?: 'code' | 'phone' | 'name' | 'id' | 'awb';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterView, setFilterView] = useState<'all' | 'matched' | 'unmatched'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import Progress State
  const [importProgress, setImportProgress] = useState<{
    total: number;
    completed: number;
    successful: number;
    failed: number;
    currentAwb: string;
    phase: string;
  }>({
    total: 0,
    completed: 0,
    successful: 0,
    failed: 0,
    currentAwb: '',
    phase: ''
  });

  // Normalize string helpers
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

  // Find header index based on possible variations (ignoring punctuation & whitespace)
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

      // REQUIRED HEADER VALIDATION STRICTLY PER COURIER SPECIFICATION
      if (courier === 'ST Courier') {
        const hasTrackingNumber = findColumnKey(headers, ['trackingnumber', 'trackingno', 'trackingid', 'tracking']);
        if (!hasTrackingNumber) {
          toast.error('Invalid ST Courier file: Tracking number column not found.', { duration: 6000 });
          setIsProcessing(false);
          return;
        }
      } else if (courier === 'Delhivery') {
        const hasWaybill = findColumnKey(headers, ['waybill', 'waybillno', 'waybillnumber']);
        if (!hasWaybill) {
          toast.error('Invalid Delhivery file: Waybill column not found.', { duration: 6000 });
          setIsProcessing(false);
          return;
        }
      }

      // Detect Columns based on courier-specific headers and standard fallbacks
      let awbCol: string | null = null;
      let orderCol: string | null = null;
      let consigneeNameCol: string | null = null;
      let currentStatusCol: string | null = null;
      let statusTypeCol: string | null = null;
      let weightCol: string | null = null;
      let dateCol: string | null = null;
      let eddCol: string | null = null;
      let cityCol: string | null = null;
      let stateCol: string | null = null;
      let pinCol: string | null = null;

      if (courier === 'ST Courier') {
        awbCol = findColumnKey(headers, ['trackingnumber', 'trackingno', 'trackingid', 'tracking', 'awbnumber', 'awb']);
        orderCol = findColumnKey(headers, ['order', 'orderno', 'orderid', 'ordernumber', 'influencercode', 'code']);
        currentStatusCol = findColumnKey(headers, ['status', 'shipmentstatus', 'substatus', 'currentstatus']);
        dateCol = findColumnKey(headers, ['orderdate', 'dispatchdate', 'bookingdate', 'date', 'pickupdate']);
        weightCol = findColumnKey(headers, ['weight', 'totalweight', 'chargedweight']);
      } else {
        // Delhivery
        awbCol = findColumnKey(headers, ['waybill', 'waybillno', 'waybillnumber', 'awb', 'trackingnumber']);
        orderCol = findColumnKey(headers, ['referenceno', 'reference', 'refno', 'order', 'orderid', 'orderno']);
        consigneeNameCol = findColumnKey(headers, ['consigneename', 'creatorname', 'influencername', 'customername', 'name', 'recipient']);
        currentStatusCol = findColumnKey(headers, ['currentstatus', 'status', 'shipmentstatus']);
        statusTypeCol = findColumnKey(headers, ['statustype', 'type', 'shipmenttype']);
        dateCol = findColumnKey(headers, ['pickupdate', 'dispatchdate', 'bookingdate', 'firstbaggingdate', 'date']);
        eddCol = findColumnKey(headers, ['delivereddate', 'deliverydate', 'estimateddeliverydate', 'promiseddeliverydate', 'edd']);
        cityCol = findColumnKey(headers, ['city', 'destinationcity']);
        stateCol = findColumnKey(headers, ['destinationstate', 'state']);
        pinCol = findColumnKey(headers, ['pin', 'pincode', 'postalcode', 'zip']);
        weightCol = findColumnKey(headers, ['weight', 'amount', 'mpsamount']);
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
        const rawAwb = awbCol ? cleanStr(row[awbCol]) : '';
        const rawOrderId = orderCol ? cleanStr(row[orderCol]) : '';
        const rawConsigneeName = consigneeNameCol ? cleanStr(row[consigneeNameCol]) : '';
        const rawCurrentStatus = currentStatusCol ? cleanStr(row[currentStatusCol]) : '';
        const rawStatusType = statusTypeCol ? cleanStr(row[statusTypeCol]) : '';
        const rawWeight = weightCol ? cleanStr(row[weightCol]) : '';
        const rawDate = dateCol ? cleanStr(row[dateCol]) : '';
        const rawEdd = eddCol ? cleanStr(row[eddCol]) : '';
        const rawCity = cityCol ? cleanStr(row[cityCol]) : '';
        const rawState = stateCol ? cleanStr(row[stateCol]) : '';
        const rawPin = pinCol ? cleanStr(row[pinCol]) : '';

        // Skip completely empty rows
        if (!rawAwb && !rawOrderId && !rawConsigneeName) return;

        let matchedInf: CampaignInfluencer | undefined;
        let matchType: 'code' | 'phone' | 'name' | 'id' | 'awb' | undefined;

        // 1. Match by Order / Reference number (e.g. #8861 or #9212)
        if (rawOrderId) {
          const normCode = normalizeCode(rawOrderId);
          if (codeMap.has(normCode)) {
            matchedInf = codeMap.get(normCode);
            matchType = 'code';
          } else if (idMap.has(rawOrderId)) {
            matchedInf = idMap.get(rawOrderId);
            matchType = 'id';
          }
        }

        // 2. Match by Consignee / Creator Name if not matched yet
        if (!matchedInf && rawConsigneeName) {
          const normName = cleanStr(rawConsigneeName).toLowerCase();
          if (nameMap.has(normName)) {
            matchedInf = nameMap.get(normName);
            matchType = 'name';
          }
        }

        // 3. Match across row values for phone or code
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

        // DO NOT drop rows where influencer is not matched!
        // Unmatched shipments are preserved with "Influencer Not Matched"
        const isValid = isValidAwb;
        let errorReason = '';
        if (!isValidAwb) {
          errorReason = courier === 'Delhivery' ? 'Missing or invalid Waybill' : 'Missing or invalid Tracking number';
        }

        parsed.push({
          rowIdx: idx + 1,
          rawIdentifier: rawOrderId || rawConsigneeName || rawAwb,
          orderId: rawOrderId || undefined,
          awbNumber: rawAwb,
          weight: rawWeight || undefined,
          status: rawCurrentStatus || rawStatusType || undefined,
          statusType: rawStatusType || undefined,
          currentStatus: rawCurrentStatus || undefined,
          dispatchDate: rawDate || undefined,
          expectedDeliveryDate: rawEdd || undefined,
          consigneeName: rawConsigneeName || undefined,
          city: rawCity || undefined,
          state: rawState || undefined,
          pincode: rawPin || undefined,
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
  const totalCount = parsedRows.length;
  const matchedCount = useMemo(() => parsedRows.filter(r => r.isValid && r.matchedInfluencer).length, [parsedRows]);
  const unmatchedCount = useMemo(() => parsedRows.filter(r => r.isValid && !r.matchedInfluencer).length, [parsedRows]);
  const invalidCount = useMemo(() => parsedRows.filter(r => !r.isValid).length, [parsedRows]);
  const validCount = useMemo(() => parsedRows.filter(r => r.isValid).length, [parsedRows]);

  const filteredPreviewRows = useMemo(() => {
    return parsedRows.filter(row => {
      if (filterView === 'matched' && !row.matchedInfluencer) return false;
      if (filterView === 'unmatched' && row.matchedInfluencer) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const creator = (row.matchedInfluencer?.influencer_name || row.matchedInfluencer?.name || row.consigneeName || '').toLowerCase();
      const code = (row.matchedInfluencer?.code || row.orderId || '').toLowerCase();
      const awb = row.awbNumber.toLowerCase();
      const raw = row.rawIdentifier.toLowerCase();

      return creator.includes(term) || code.includes(term) || awb.includes(term) || raw.includes(term);
    });
  }, [parsedRows, filterView, searchTerm]);

  // Execute import workflow
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid shipments to import.');
      return;
    }

    setStep('importing');
    const todayDate = new Date().toISOString().split('T')[0];

    // =========================================================================
    // WORKFLOW 1: ST COURIER (FETCH STATUS ONE BY ONE VIA API)
    // =========================================================================
    if (courier === 'ST Courier') {
      setImportProgress({
        total: validRows.length,
        completed: 0,
        successful: 0,
        failed: 0,
        currentAwb: '',
        phase: 'Fetching live tracking statuses one by one from ST Courier...'
      });

      const trackedShipments: InfluencerDispatchedShipment[] = [];
      let successfulCount = 0;
      let failedCount = 0;
      let completedCount = 0;

      // Controlled concurrency (2 at a time) to prevent API rate limits
      const concurrency = 2;
      for (let i = 0; i < validRows.length; i += concurrency) {
        const chunk = validRows.slice(i, i + concurrency);

        await Promise.all(
          chunk.map(async (row) => {
            const inf = row.matchedInfluencer;
            const awb = row.awbNumber.trim();
            const orderId = row.orderId || (inf ? inf.code : undefined) || '';

            setImportProgress(prev => ({
              ...prev,
              currentAwb: awb,
              completed: completedCount
            }));

            // Prepare base shipment record
            const baseShipment: InfluencerDispatchedShipment = {
              id: inf ? (inf.dispatchDetails?.id || String(inf.id)) : `st-${awb}`,
              influencerId: inf ? String(inf.id) : undefined,
              creatorName: inf ? (inf.influencer_name || inf.name || 'Influencer') : 'Influencer Not Matched',
              username: inf?.platforms?.find(p => p.username)?.username || (inf ? `@${inf.influencer_name}` : '—'),
              influencerCode: inf?.code || orderId || '',
              orderId: orderId || undefined,
              profilePhoto: inf?.profile_file_url || '',
              phoneNumber: inf?.phone_number || '',
              altPhoneNumber: inf?.alternative_number || '',
              state: inf?.state || row.state || '',
              city: row.city || undefined,
              pincode: row.pincode || undefined,
              batchCode: '—',
              awbNumber: awb,
              courier: 'ST Courier',
              dispatchDate: row.dispatchDate || todayDate,
              expectedDeliveryDate: row.expectedDeliveryDate || '',
              status: 'Pending',
              rawStatus: row.status || 'Pending',
              statusSource: 'Live ST Courier Tracking',
              sourceType: 'LIVE_API',
              trackingUrl: getCourierTrackingUrl('ST Courier', awb)
            };

            // Fetch live status from ST Courier tracking service
            const tracked = await syncSingleShipment(baseShipment, campaign.id);
            trackedShipments.push(tracked);

            if (!tracked.syncError && tracked.status !== 'Exception') {
              successfulCount++;
            } else {
              failedCount++;
            }
            completedCount++;

            setImportProgress({
              total: validRows.length,
              completed: completedCount,
              successful: successfulCount,
              failed: failedCount,
              currentAwb: awb,
              phase: `Processed ${completedCount} of ${validRows.length} shipments`
            });
          })
        );
      }

      // Save all tracked shipments to campaign storage
      upsertCampaignShipments(campaign.id, trackedShipments);

      // Also persist matched influencers to Supabase and Dexie
      for (const s of trackedShipments) {
        if (s.influencerId) {
          try {
            const { data: existingRecords } = await supabase
              .from(SUPABASE_TABLES.influencerDispatch)
              .select('id')
              .eq('influencer_id', s.influencerId)
              .eq('campaign_id', String(campaign.id));

            if (existingRecords && existingRecords.length > 0) {
              await supabase
                .from(SUPABASE_TABLES.influencerDispatch)
                .update({
                  courier_partner: 'ST Courier',
                  tracking_id: s.awbNumber,
                  dispatch_status: 'Dispatched',
                  dispatch_date: s.dispatchDate,
                  expected_delivery_date: s.expectedDeliveryDate || null,
                  total_weight: '500g'
                })
                .eq('id', existingRecords[0].id);
            }

            const existingOrder = await db.logistics_orders
              .where('orderId')
              .equals(s.influencerCode || `INF-${s.influencerId}`)
              .first();

            if (existingOrder) {
              await db.logistics_orders.update(existingOrder.id!, {
                awbNumber: s.awbNumber,
                courier: 'ST Courier',
                syncedAt: new Date().toLocaleString()
              });
            }
          } catch (e) {
            console.warn('Non-fatal sync error to database:', e);
          }
        }
      }

      // Log activity
      try {
        await logActivity({
          department: 'Marketing',
          action: 'Upload ST Courier Shipments',
          description: `Imported and tracked ${trackedShipments.length} ST Courier shipments for campaign "${campaign.campaign_name}". Successfully tracked: ${successfulCount}, Failed: ${failedCount}`,
          record_id: String(campaign.id),
          record_name: campaign.campaign_name,
          metadata: { courier: 'ST Courier', total: trackedShipments.length, successful: successfulCount, failed: failedCount }
        });
      } catch (e) {}

      toast.success(`Successfully tracked: ${successfulCount}, Failed: ${failedCount}`, { duration: 5000 });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);

    // =========================================================================
    // WORKFLOW 2: DELHIVERY (UPLOADED FILE STATUS AS SOURCE OF TRUTH - NO API)
    // =========================================================================
    } else {
      setImportProgress({
        total: validRows.length,
        completed: 0,
        successful: 0,
        failed: 0,
        currentAwb: '',
        phase: 'Processing and normalizing Delhivery shipments from uploaded file...'
      });

      const nowTimestamp = new Date().toLocaleString();
      const delhiveryShipments: InfluencerDispatchedShipment[] = [];

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const inf = row.matchedInfluencer;
        const awb = row.awbNumber.trim();
        const orderId = row.orderId || (inf ? inf.code : undefined) || '';

        // Normalize status using the Delhivery status normalizer
        const normalized = normalizeDelhiveryStatus(row.currentStatus, row.statusType);
        const rawStatus = row.currentStatus || row.statusType || 'DELIVERED';

        const shipmentObj: InfluencerDispatchedShipment = {
          id: inf ? (inf.dispatchDetails?.id || String(inf.id)) : `del-${awb}`,
          influencerId: inf ? String(inf.id) : undefined,
          creatorName: inf ? (inf.influencer_name || inf.name || 'Influencer') : (row.consigneeName || 'Influencer Not Matched'),
          username: inf?.platforms?.find(p => p.username)?.username || (inf ? `@${inf.influencer_name}` : '—'),
          influencerCode: inf?.code || orderId || '',
          orderId: orderId || undefined,
          profilePhoto: inf?.profile_file_url || '',
          phoneNumber: inf?.phone_number || '',
          altPhoneNumber: inf?.alternative_number || '',
          state: inf?.state || row.state || '',
          city: row.city || undefined,
          pincode: row.pincode || undefined,
          batchCode: '—',
          awbNumber: awb,
          courier: 'Delhivery',
          dispatchDate: row.dispatchDate || todayDate,
          expectedDeliveryDate: row.expectedDeliveryDate || '',
          status: normalized,
          rawStatus,
          statusSource: 'Uploaded Delhivery File',
          sourceType: 'UPLOADED_FILE',
          lastSyncedAt: nowTimestamp,
          trackingUrl: getCourierTrackingUrl('Delhivery', awb)
        };

        delhiveryShipments.push(shipmentObj);

        // Also save to Dexie db.shipments
        try {
          await db.shipments.put({
            awb,
            orderId: orderId || awb,
            status: rawStatus,
            state: row.state || 'Unknown',
            lastLocation: '-',
            trackingDateTime: '-',
            department: (row.state === 'Tamil Nadu') ? 'Tamil Nadu' : 'Other State',
            lastSyncedAt: Date.now()
          });
        } catch (dbErr) {}

        // If matched to an influencer, persist to Supabase
        if (inf) {
          try {
            const { data: existingRecords } = await supabase
              .from(SUPABASE_TABLES.influencerDispatch)
              .select('id')
              .eq('influencer_id', String(inf.id))
              .eq('campaign_id', String(campaign.id));

            if (existingRecords && existingRecords.length > 0) {
              await supabase
                .from(SUPABASE_TABLES.influencerDispatch)
                .update({
                  courier_partner: 'Delhivery',
                  tracking_id: awb,
                  dispatch_status: 'Dispatched',
                  dispatch_date: row.dispatchDate || todayDate,
                  expected_delivery_date: row.expectedDeliveryDate || null,
                  total_weight: row.weight || '500g'
                })
                .eq('id', existingRecords[0].id);
            }
          } catch (e) {}
        }
      }

      // Save all Delhivery shipments into isolated campaign storage
      upsertCampaignShipments(campaign.id, delhiveryShipments);

      setImportProgress({
        total: validRows.length,
        completed: validRows.length,
        successful: validRows.length,
        failed: 0,
        currentAwb: '',
        phase: `Successfully imported ${delhiveryShipments.length} Delhivery shipments`
      });

      // Log activity
      try {
        await logActivity({
          department: 'Marketing',
          action: 'Upload Delhivery Shipments',
          description: `Imported ${delhiveryShipments.length} Delhivery shipments for campaign "${campaign.campaign_name}" (Source: Uploaded File)`,
          record_id: String(campaign.id),
          record_name: campaign.campaign_name,
          metadata: { courier: 'Delhivery', total: delhiveryShipments.length, source: 'Uploaded File' }
        });
      } catch (e) {}

      toast.success(`Successfully imported ${delhiveryShipments.length} Delhivery shipments (Source: Uploaded File)`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
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
                {courier === 'ST Courier' ? (
                  <span>Upload ST Courier CSV → Live status will be retrieved one by one via ST Courier service</span>
                ) : (
                  <span>Upload Delhivery CSV → Status will be extracted directly from the uploaded file (No API calls)</span>
                )}
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            disabled={step === 'importing'}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
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
                    <span className="text-sm font-semibold text-slate-200">Reading & validating columns...</span>
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-purple-400 group-hover:scale-105 group-hover:bg-purple-900/50 transition-all mb-3">
                      <FileSpreadsheet size={36} />
                    </div>
                    <p className="text-base font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                      Click or drag {courier} shipment file here
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports CSV (.csv) and Excel (.xlsx, .xls) exports
                    </p>
                  </>
                )}
              </div>

              {/* Supported Columns Guide */}
              <div className="p-4 bg-[#0e1626]/60 border border-slate-800/80 rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Package size={14} className="text-purple-400" />
                  <span>Required Identifier for {courier}</span>
                </div>
                <div className="text-slate-400 text-[11px] leading-relaxed">
                  {courier === 'ST Courier' ? (
                    <div>
                      <span className="text-purple-300 font-bold">Required column: </span>
                      <code className="text-purple-200 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/50">Tracking number</code>
                      <span className="ml-2 text-slate-400">· Other fields: Order, Status, Carrier, Order date</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-purple-300 font-bold">Required column: </span>
                      <code className="text-purple-200 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/50">Waybill</code>
                      <span className="ml-2 text-slate-400">· Other fields: Reference No., Status Type, Current Status, Consignee Name, Pick Up Date</span>
                    </div>
                  )}
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
                  <div className="text-[11px] font-medium text-slate-400">Total Valid Rows</div>
                  <div className="text-lg font-bold text-slate-100">{validCount}</div>
                </div>

                <div 
                  onClick={() => setFilterView('matched')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    filterView === 'matched' ? 'bg-emerald-950/50 border-emerald-500' : 'bg-[#0e1626]/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span>Matched Influencers</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-300">{matchedCount}</div>
                </div>

                <div 
                  onClick={() => setFilterView('unmatched')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    filterView === 'unmatched' ? 'bg-amber-950/50 border-amber-500' : 'bg-[#0e1626]/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>Influencer Not Matched</span>
                  </div>
                  <div className="text-lg font-bold text-amber-300">{unmatchedCount}</div>
                </div>
              </div>

              {/* Search within preview */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search by order ID, name, code, or AWB..." 
                  className="w-full h-9 bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Rows Table */}
              <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-[#0b101b]/60 max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#121929] sticky top-0 z-10 border-b border-slate-800 text-slate-400 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Order / Ref</th>
                      <th className="py-2.5 px-3">Influencer</th>
                      <th className="py-2.5 px-3">{courier === 'Delhivery' ? 'Waybill' : 'Tracking Number'}</th>
                      <th className="py-2.5 px-3">Courier</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-200">
                    {filteredPreviewRows.length > 0 ? (
                      filteredPreviewRows.map((row, idx) => {
                        const inf = row.matchedInfluencer;
                        const creator = inf?.influencer_name || inf?.name || row.consigneeName || 'Influencer Not Matched';
                        return (
                          <tr key={idx} className={`hover:bg-slate-800/40 transition-colors ${!row.isValid ? 'bg-rose-950/10' : ''}`}>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{row.rowIdx}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-300 font-mono">{row.orderId || row.rawIdentifier}</td>
                            <td className="py-2.5 px-3">
                              {inf ? (
                                <div>
                                  <div className="font-semibold text-slate-100">{creator}</div>
                                  <div className="text-[10px] text-purple-400 font-mono">{inf.code || 'No Code'}</div>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/50">
                                  Influencer Not Matched
                                </span>
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
                              {courier === 'ST Courier' ? (
                                <span className="text-purple-300 text-[11px] flex items-center gap-1 font-medium">
                                  <RefreshCw size={10} className="animate-spin text-purple-400" />
                                  <span>Will fetch live</span>
                                </span>
                              ) : (
                                <span className="text-emerald-400 text-[11px] font-semibold">
                                  {row.currentStatus || row.status || 'Delivered'}
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

          {step === 'importing' && (
            <div className="py-8 px-4 flex flex-col items-center justify-center space-y-6 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-purple-950/70 border border-purple-600/60 flex items-center justify-center text-purple-400 shadow-xl shadow-purple-950/50">
                <RefreshCw size={32} className="animate-spin text-purple-400" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">
                  {courier === 'ST Courier' ? 'Fetching Live ST Courier Tracking' : 'Importing Delhivery Shipments'}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  {importProgress.phase || 'Processing shipments...'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md space-y-2">
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                  <div 
                    className="bg-gradient-to-r from-purple-600 to-indigo-500 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${importProgress.total > 0 ? Math.round((importProgress.completed / importProgress.total) * 100) : 0}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Processed {importProgress.completed} of {importProgress.total} shipments</span>
                  <span>{importProgress.total > 0 ? Math.round((importProgress.completed / importProgress.total) * 100) : 0}%</span>
                </div>
              </div>

              {/* Live Count Badges */}
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-bold">
                  Tracked / Ready: {importProgress.successful}
                </span>
                {importProgress.failed > 0 && (
                  <span className="px-3 py-1 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs font-bold">
                    Failed: {importProgress.failed}
                  </span>
                )}
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
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Back to File Select
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={validCount === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-md shadow-purple-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileCheck size={14} />
                <span>Confirm & Import ({validCount}) Shipments</span>
              </button>
            </>
          ) : step === 'importing' ? (
            <div className="w-full flex justify-center text-xs text-slate-400">
              Please wait while shipments are being processed...
            </div>
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
