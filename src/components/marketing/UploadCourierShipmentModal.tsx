import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle,
  AlertTriangle, 
  X, 
  Truck, 
  RefreshCw,
  ArrowRight,
  Eye,
  Check,
  Ban,
  Layers,
  FileText,
  AlertCircle
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import db from '../../lib/db';
import { logActivity } from '../../services/activityService';
import {
  syncSingleShipment,
  normalizeDelhiveryStatus,
  normalizeTrackingStatus,
  resolveDelhiveryDisplayStatus,
  getTrackingDisplayStatus,
  formatStatusLabel,
  resolveDelhiveryCategory,
  upsertCampaignShipments,
  upsertCampaignShipmentsToDb,
  getCampaignShipments,
  fetchCampaignShipmentsFromDb,
  clearTrackingCache,
  InfluencerDispatchedShipment,
  getCourierTrackingUrl
} from '../../services/influencerTrackingService';
import { parseToYMD } from '../../utils/influencerDateUtils';
import { normalizeInfluencerReference } from '../../services/influencerStatusHandoffService';
import { isActiveStatus } from '../../utils/marketingUtils';
import { 
  normalizeOrderId, 
  isSameUnderlyingOrder,
  parseDelhiveryReferenceNo,
  ParsedDelhiveryReference
} from '../../utils/orderIdUtils';
import toast from 'react-hot-toast';

export interface UploadResultStats {
  title: string;
  isSuccess: boolean;
  acceptedCount: number;
  ignoredCustomerCount: number;
  unmatchedInvalidCount: number;
  updatedExistingCount: number;
  newShipmentsCount: number;
  rowsWithRemarksCount?: number;
  errorMessage?: string;
}

/**
 * Displays a clean, uncompressed, dark navy result toast with separate metric rows.
 */
export function showUploadResultToast(stats: UploadResultStats) {
  toast.dismiss();

  toast.custom(
    (t) => (
      <div
        className={`relative z-[9999] bg-[#141a29] border ${
          stats.isSuccess ? 'border-emerald-500/50 shadow-emerald-950/50' : 'border-rose-500/50 shadow-rose-950/50'
        } p-4 rounded-xl shadow-2xl min-w-[340px] max-w-[420px] flex flex-col gap-3 pointer-events-auto transition-all duration-200 animate-in fade-in zoom-in-95`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {stats.isSuccess ? (
              <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <CheckCircle2 size={18} />
              </div>
            ) : (
              <div className="p-1.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 shrink-0">
                <XCircle size={18} />
              </div>
            )}
            <span className="font-bold text-sm text-slate-100">{stats.title}</span>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {stats.errorMessage && (
          <div className="text-xs text-rose-300 font-medium bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/50">
            {stats.errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-700/60 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Accepted Influencer Shipments:</span>
            <span className="font-mono font-bold text-emerald-400">{stats.acceptedCount}</span>
          </div>
          {stats.rowsWithRemarksCount !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">Rows with Remarks:</span>
              <span className="font-mono font-bold text-purple-300">{stats.rowsWithRemarksCount}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Ignored Customer Rows:</span>
            <span className="font-mono font-bold text-slate-300">{stats.ignoredCustomerCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Unmatched / Invalid Rows:</span>
            <span className="font-mono font-bold text-slate-400">{stats.unmatchedInvalidCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Updated Existing Shipments:</span>
            <span className="font-mono font-bold text-blue-400">{stats.updatedExistingCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">New Shipments:</span>
            <span className="font-mono font-bold text-emerald-300">{stats.newShipmentsCount}</span>
          </div>
        </div>
      </div>
    ),
    { duration: 7000 }
  );
}

export interface ValidParsedShipmentRow {
  rawAwb: string;
  orderId: string;
  rawOrderId: string;
  baseOrderId: string;
  isResend: boolean;
  attemptNumber: number;
  consigneeName: string;
  currentStatus: string;
  statusType: string;
  remarks: string;
  pendingRemarks: string;
  weight: string;
  date: string;
  edd: string;
  deliveredDate: string;
  city: string;
  state: string;
  pin: string;
  matchedInf: CampaignInfluencer;
}

export interface ImportPreviewData {
  file: File;
  totalCsvRows: number;
  validRows: ValidParsedShipmentRow[];
  originalCount: number;
  replacementCount: number;
  ignoredCustomerCount: number;
  invalidCount: number;
  newShipmentsCount: number;
  existingShipmentsCount: number;
  ignoredSamples: { ref: string; reason: string }[];
  validSamples: { ref: string; displayOrderId: string; influencerName: string; isReplacement: boolean; awb: string; status: string }[];
  rowsWithRemarksCount: number;
  existingMap: Map<string, InfluencerDispatchedShipment>;
  activeCampaignInfluencers: CampaignInfluencer[];
}

export interface UploadCourierShipmentModalProps {
  campaign: Campaign;
  courier: 'ST Courier' | 'Delhivery';
  influencers: CampaignInfluencer[];
  initialFile?: File | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export const UploadCourierShipmentModal: React.FC<UploadCourierShipmentModalProps> = ({
  campaign,
  courier,
  influencers,
  initialFile,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'completed' | 'error'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [previewTab, setPreviewTab] = useState<'valid' | 'ignored'>('valid');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isExecutingRef = useRef(false);
  const processedFileRef = useRef<File | null>(null);

  // Import Progress State
  const [importProgress, setImportProgress] = useState<{
    total: number;
    completed: number;
    accepted: number;
    ignored: number;
    successful: number;
    failed: number;
    duplicates: number;
    imported: number;
    currentAwb: string;
    phase: string;
  }>({
    total: 0,
    completed: 0,
    accepted: 0,
    ignored: 0,
    successful: 0,
    failed: 0,
    duplicates: 0,
    imported: 0,
    currentAwb: '',
    phase: ''
  });

  // String cleaning helpers
  const cleanStr = (val: any): string => {
    if (val === undefined || val === null) return '';
    let s = String(val).replace(/[\t\r\n]/g, ' ').trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    return s;
  };

  // Find header index based on possible variations
  const findColumnKey = (rowKeys: string[], possibleNames: string[]): string | null => {
    // Pass 1: exact normalized match
    for (const target of possibleNames) {
      const normTarget = target.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      for (const key of rowKeys) {
        const normKey = key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (normKey === normTarget) {
          return key;
        }
      }
    }
    // Pass 2: substring match (length >= 4)
    for (const target of possibleNames) {
      const normTarget = target.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (normTarget.length < 4) continue;
      for (const key of rowKeys) {
        const normKey = key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (normKey.includes(normTarget)) {
          return key;
        }
      }
    }
    return null;
  };

  // Step 1: Parse and analyze the uploaded file without writing to database
  const executeUploadPipeline = async (selectedFile: File) => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;

    setFile(selectedFile);
    setUploadError(null);
    setStep('importing');

    console.log(`[Upload Pipeline] Analyzing ${courier} file:`, selectedFile.name, 'Size:', selectedFile.size);

    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const isCsv = selectedFile.name.endsWith('.csv') || selectedFile.type.includes('csv') || selectedFile.type.includes('comma');

    if (!isExcel && !isCsv) {
      const err = 'Invalid format. Please upload a CSV (.csv) or Excel (.xlsx/.xls) file.';
      setUploadError(err);
      setStep('error');
      toast.error(err);
      isExecutingRef.current = false;
      return;
    }

    try {
      setImportProgress({
        total: 0,
        completed: 0,
        accepted: 0,
        ignored: 0,
        successful: 0,
        failed: 0,
        duplicates: 0,
        imported: 0,
        currentAwb: '',
        phase: `Reading ${courier} file: ${selectedFile.name}...`
      });

      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, any>[];

      console.log(`[Upload Pipeline] Raw rows read:`, rawData.length);

      if (!rawData || rawData.length === 0) {
        const err = 'The uploaded file contains no data rows.';
        setUploadError(err);
        setStep('error');
        toast.error(err);
        isExecutingRef.current = false;
        return;
      }

      const headers = Object.keys(rawData[0]);
      setDetectedHeaders(headers);
      console.log(`[Upload Pipeline] Detected headers:`, headers);

      // 1. Column detection & validation
      let awbCol: string | null = null;
      let orderCol: string | null = null;
      let consigneeNameCol: string | null = null;
      let currentStatusCol: string | null = null;
      let statusTypeCol: string | null = null;
      let weightCol: string | null = null;
      let dateCol: string | null = null;
      let eddCol: string | null = null;
      let deliveredDateCol: string | null = null;
      let cityCol: string | null = null;
      let stateCol: string | null = null;
      let pinCol: string | null = null;
      let remarksCol: string | null = null;
      let pendingRemarksCol: string | null = null;

      if (courier === 'ST Courier') {
        awbCol = findColumnKey(headers, ['trackingnumber', 'trackingno', 'trackingid', 'tracking', 'awbnumber', 'awb']);
        if (!awbCol) {
          const err = `ST Courier upload failed: Required "Tracking number" column not found. Available columns: ${headers.join(', ')}`;
          setUploadError(err);
          setStep('error');
          toast.error('Invalid ST Courier file: "Tracking number" column not found.', { duration: 6000 });
          isExecutingRef.current = false;
          return;
        }
        orderCol = findColumnKey(headers, ['order', 'orderno', 'orderid', 'ordernumber', 'influencercode', 'code']);
        currentStatusCol = findColumnKey(headers, ['status', 'shipmentstatus', 'substatus', 'currentstatus']);
        remarksCol = findColumnKey(headers, ['remarks', 'remark', 'courierremarks', 'statusremarks', 'trackingremarks']);
        dateCol = findColumnKey(headers, ['orderdate', 'dispatchdate', 'bookingdate', 'date', 'pickupdate']);
        deliveredDateCol = findColumnKey(headers, ['delivereddate', 'delivered_date', 'deliverydate', 'delivery_date', 'actualdeliverydate', 'actual_delivery_date']);
        weightCol = findColumnKey(headers, ['weight', 'totalweight', 'chargedweight']);
      } else {
        // Delhivery: strictly requires Waybill and Reference No.
        awbCol = findColumnKey(headers, ['waybill', 'waybillno', 'waybillnumber', 'awb', 'trackingnumber']);
        if (!awbCol) {
          const err = `Delhivery upload failed: Required "Waybill" column not found. Available columns: ${headers.join(', ')}`;
          setUploadError(err);
          setStep('error');
          toast.error('Invalid Delhivery file: "Waybill" column not found.', { duration: 6000 });
          isExecutingRef.current = false;
          return;
        }
        // ONLY match reference columns — never use clientreference, waybill, or consignee
        orderCol = findColumnKey(headers, ['referenceno', 'referencenumber', 'refno', 'reference', 'orderid', 'orderno', 'ordernumber', 'order']);
        if (!orderCol) {
          const err = `Delhivery upload failed: Required "Reference No." column not found. Available columns: ${headers.join(', ')}`;
          setUploadError(err);
          setStep('error');
          toast.error('Invalid Delhivery file: "Reference No." column not found.', { duration: 6000 });
          isExecutingRef.current = false;
          return;
        }
        consigneeNameCol = findColumnKey(headers, ['consigneename', 'creatorname', 'influencername', 'customername', 'name', 'recipient']);
        currentStatusCol = findColumnKey(headers, ['currentstatus', 'status', 'shipmentstatus']);
        statusTypeCol = findColumnKey(headers, ['statustype', 'type', 'shipmenttype']);
        remarksCol = findColumnKey(headers, ['remarks', 'remark', 'delhiveryremarks', 'courierremarks', 'statusremarks', 'trackingremarks', 'deliveryremarks', 'lastremarks', 'activityremarks', 'latestremarks', 'comment', 'comments', 'notes', 'reason', 'statusreason']);
        pendingRemarksCol = findColumnKey(headers, ['pendingreturnedremarks', 'pendingreturnedremark', 'pendingremarks', 'returnedremarks']);
        dateCol = findColumnKey(headers, ['pickupdate', 'pickup_date', 'dispatchdate', 'dispatch_date', 'bookingdate']);
        eddCol = findColumnKey(headers, ['estimateddeliverydate', 'estimateddelivery', 'estdeliverydate', 'edd']);
        deliveredDateCol = findColumnKey(headers, ['delivereddate', 'delivered_date', 'deliverydate', 'delivery_date', 'actualdeliverydate', 'actual_delivery_date', 'delivered_on', 'deliveredon']);
        cityCol = findColumnKey(headers, ['city', 'destinationcity']);
        stateCol = findColumnKey(headers, ['destinationstate', 'state']);
        pinCol = findColumnKey(headers, ['pin', 'pincode', 'postalcode', 'zip']);
        weightCol = findColumnKey(headers, ['weight', 'amount', 'mpsamount']);
      }

      // 2. Load active campaign influencers strictly for the current campaign
      let activeCampaignInfluencers = (influencers || []).filter(inf => 
        isActiveStatus(inf.is_archived) &&
        (inf.campaign_id === undefined || String(inf.campaign_id) === String(campaign.id))
      );

      // Always query Supabase directly to ensure we have the complete, authoritative list of campaign influencers
      try {
        const { data: dbInfs } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencersInfo)
          .select('*')
          .eq('campaign_id', String(campaign.id));
        if (dbInfs && dbInfs.length > 0) {
          const dbActive = dbInfs.filter(i => isActiveStatus(i.is_archived)) as CampaignInfluencer[];
          const infMap = new Map<string, CampaignInfluencer>();
          activeCampaignInfluencers.forEach(inf => {
            if (inf.id) infMap.set(String(inf.id), inf);
          });
          dbActive.forEach(inf => {
            if (inf.id && !infMap.has(String(inf.id))) infMap.set(String(inf.id), inf);
          });
          activeCampaignInfluencers = Array.from(infMap.values());
        }
      } catch (e) {
        console.warn('Fallback loading active influencers for upload failed:', e);
      }

      // Build canonical campaign influencer code sets & map
      const validCampaignCodesSet = new Set<string>();
      const codeMap = new Map<string, CampaignInfluencer>();

      activeCampaignInfluencers.forEach(inf => {
        if (inf.code) {
          const raw = String(inf.code).replace(/[\t\r\n]/g, ' ').trim();
          const clean = raw.replace(/^#+/, '').trim().toUpperCase();
          if (clean) {
            validCampaignCodesSet.add(clean);
            codeMap.set(clean, inf);
            codeMap.set(clean.toLowerCase(), inf);
          }
        }
      });

      console.log(`[Upload Pipeline] Campaign ${campaign.id}: ${activeCampaignInfluencers.length} active influencers, ${validCampaignCodesSet.size} unique codes.`);

      // 3. Existing shipments in current campaign (for duplicate & reconciliation tracking)
      let existingCampaignShipments: InfluencerDispatchedShipment[] = [];
      try {
        existingCampaignShipments = await fetchCampaignShipmentsFromDb(campaign.id);
      } catch (e) {
        existingCampaignShipments = getCampaignShipments(campaign.id);
      }
      const existingMap = new Map<string, InfluencerDispatchedShipment>();
      existingCampaignShipments.forEach(s => {
        const k = (s.awbNumber || s.id || '').toLowerCase().trim();
        if (k) existingMap.set(k, s);
      });

      // 4. Parse rows with strict Reference No. validation
      const validRows: ValidParsedShipmentRow[] = [];
      const ignoredSamples: { ref: string; reason: string }[] = [];
      const validSamples: { ref: string; displayOrderId: string; influencerName: string; isReplacement: boolean; awb: string; status: string }[] = [];
      let invalidRowsCount = 0;
      let ignoredCustomerRowsCount = 0;
      let rowsWithRemarksCount = 0;

      rawData.forEach((row) => {
        const rawAwb = awbCol ? cleanStr(row[awbCol]) : '';
        const rawOrderId = orderCol ? cleanStr(row[orderCol]) : '';
        const rawConsigneeName = consigneeNameCol ? cleanStr(row[consigneeNameCol]) : '';
        const rawCurrentStatus = currentStatusCol ? cleanStr(row[currentStatusCol]) : '';
        const rawStatusType = statusTypeCol ? cleanStr(row[statusTypeCol]) : '';
        const rawRemarks = remarksCol ? cleanStr(row[remarksCol]) : '';
        const rawPendingRemarks = pendingRemarksCol ? cleanStr(row[pendingRemarksCol]) : '';
        const rawWeight = weightCol ? cleanStr(row[weightCol]) : '';
        const rawDate = dateCol ? cleanStr(row[dateCol]) : '';
        const rawEdd = eddCol ? cleanStr(row[eddCol]) : '';
        const rawDeliveredDate = deliveredDateCol ? cleanStr(row[deliveredDateCol]) : '';
        const rawCity = cityCol ? cleanStr(row[cityCol]) : '';
        const rawState = stateCol ? cleanStr(row[stateCol]) : '';
        const rawPin = pinCol ? cleanStr(row[pinCol]) : '';

        // Skip completely empty rows
        const hasContent = Object.values(row).some(v => cleanStr(v) !== '');
        if (!hasContent) return;

        // Require valid AWB
        if (!rawAwb || rawAwb.length < 4) {
          invalidRowsCount++;
          return;
        }

        if (courier === 'Delhivery') {
          // Delhivery: ONLY Reference No. determines if this is an influencer shipment
          const parsedRef = parseDelhiveryReferenceNo(rawOrderId, validCampaignCodesSet);
          if (!parsedRef.isValid) {
            if (parsedRef.rejectReason?.includes('numeric') || parsedRef.rejectReason?.includes('not found')) {
              ignoredCustomerRowsCount++;
            } else {
              invalidRowsCount++;
            }
            if (ignoredSamples.length < 25) {
              ignoredSamples.push({
                ref: rawOrderId || '(Blank)',
                reason: parsedRef.rejectReason || 'Invalid Reference No.'
              });
            }
            return; // STRICT: Do NOT check any other column!
          }

          const matchedInf = codeMap.get(parsedRef.influencerCode) || codeMap.get(parsedRef.influencerCode.toLowerCase());
          if (!matchedInf) {
            ignoredCustomerRowsCount++;
            if (ignoredSamples.length < 25) {
              ignoredSamples.push({
                ref: rawOrderId,
                reason: `Influencer code "${parsedRef.influencerCode}" not found in current campaign`
              });
            }
            return;
          }

          if (rawRemarks) {
            rowsWithRemarksCount++;
          }

          const rowObj: ValidParsedShipmentRow = {
            rawAwb,
            orderId: parsedRef.displayOrderId,
            rawOrderId,
            baseOrderId: parsedRef.logicalOrderId,
            isResend: parsedRef.isReplacement,
            attemptNumber: parsedRef.attemptNumber,
            consigneeName: rawConsigneeName,
            currentStatus: rawCurrentStatus,
            statusType: rawStatusType,
            remarks: rawRemarks,
            pendingRemarks: rawPendingRemarks,
            weight: rawWeight,
            date: rawDate,
            edd: rawEdd,
            deliveredDate: rawDeliveredDate,
            city: rawCity,
            state: rawState,
            pin: rawPin,
            matchedInf
          };

          validRows.push(rowObj);
          if (validSamples.length < 25) {
            validSamples.push({
              ref: rawOrderId,
              displayOrderId: parsedRef.displayOrderId,
              influencerName: matchedInf.influencer_name || matchedInf.name || 'Influencer',
              isReplacement: parsedRef.isReplacement,
              awb: rawAwb,
              status: rawCurrentStatus || rawStatusType || 'Pending'
            });
          }
        } else {
          // ST Courier
          const parsedRef = parseDelhiveryReferenceNo(rawOrderId, validCampaignCodesSet);
          let matchedInf = parsedRef.isValid 
            ? (codeMap.get(parsedRef.influencerCode) || codeMap.get(parsedRef.influencerCode.toLowerCase()))
            : undefined;

          if (!matchedInf && rawOrderId) {
            const norm = normalizeOrderId(rawOrderId);
            if (norm.baseCode && !norm.isNumericCustomerOrder) {
              matchedInf = codeMap.get(norm.baseCode.toUpperCase()) || codeMap.get(norm.baseCode.toLowerCase());
            }
          }

          if (!matchedInf) {
            if (rawOrderId) {
              ignoredCustomerRowsCount++;
              if (ignoredSamples.length < 25) {
                ignoredSamples.push({
                  ref: rawOrderId,
                  reason: parsedRef.rejectReason || 'Influencer not found in current campaign'
                });
              }
            } else {
              invalidRowsCount++;
            }
            return;
          }

          if (rawRemarks) {
            rowsWithRemarksCount++;
          }

          const orderInfo = normalizeOrderId(rawOrderId || matchedInf.code, validCampaignCodesSet);
          const canonicalBase = orderInfo.baseCode || (matchedInf.code ? matchedInf.code.replace(/^#+/, '') : '');
          const resolvedOrderId = orderInfo.isResend 
            ? `R ${canonicalBase}` 
            : (rawOrderId ? (rawOrderId.startsWith('#') ? rawOrderId : `#${rawOrderId}`) : `#${canonicalBase}`);

          const rowObj: ValidParsedShipmentRow = {
            rawAwb,
            orderId: resolvedOrderId,
            rawOrderId: rawOrderId || resolvedOrderId,
            baseOrderId: canonicalBase,
            isResend: orderInfo.isResend,
            attemptNumber: orderInfo.attemptNumber,
            consigneeName: rawConsigneeName,
            currentStatus: rawCurrentStatus,
            statusType: rawStatusType,
            remarks: rawRemarks,
            pendingRemarks: rawPendingRemarks,
            weight: rawWeight,
            date: rawDate,
            edd: rawEdd,
            deliveredDate: rawDeliveredDate,
            city: rawCity,
            state: rawState,
            pin: rawPin,
            matchedInf
          };

          validRows.push(rowObj);
          if (validSamples.length < 25) {
            validSamples.push({
              ref: rawOrderId,
              displayOrderId: resolvedOrderId,
              influencerName: matchedInf.influencer_name || matchedInf.name || 'Influencer',
              isReplacement: orderInfo.isResend,
              awb: rawAwb,
              status: rawCurrentStatus || 'Pending'
            });
          }
        }
      });

      if (validRows.length === 0) {
        const err = `No valid campaign influencer shipments found in this file (${ignoredCustomerRowsCount} customer rows ignored).`;
        setUploadError(err);
        setStep('error');
        showUploadResultToast({
          title: `${courier} Upload - No Shipments Found`,
          isSuccess: false,
          acceptedCount: 0,
          ignoredCustomerCount: ignoredCustomerRowsCount,
          unmatchedInvalidCount: invalidRowsCount,
          updatedExistingCount: 0,
          newShipmentsCount: 0,
          errorMessage: err
        });
        isExecutingRef.current = false;
        return;
      }

      const replacementCount = validRows.filter(r => r.isResend).length;
      const originalCount = validRows.filter(r => !r.isResend).length;
      const newShipmentsCount = validRows.filter(r => !existingMap.has(r.rawAwb.toLowerCase())).length;
      const existingShipmentsCount = validRows.filter(r => existingMap.has(r.rawAwb.toLowerCase())).length;

      console.log(`[Upload Pipeline] Analysis Complete for ${selectedFile.name}:
- Total CSV rows: ${rawData.length}
- Valid influencer shipments: ${validRows.length} (Original: ${originalCount}, Replacement: ${replacementCount})
- Ignored customer rows: ${ignoredCustomerRowsCount}
- Invalid rows: ${invalidRowsCount}
- New shipments: ${newShipmentsCount}
- Existing shipments: ${existingShipmentsCount}`);

      setPreviewData({
        file: selectedFile,
        totalCsvRows: rawData.length,
        validRows,
        originalCount,
        replacementCount,
        ignoredCustomerCount: ignoredCustomerRowsCount,
        invalidCount: invalidRowsCount,
        newShipmentsCount,
        existingShipmentsCount,
        ignoredSamples,
        validSamples,
        rowsWithRemarksCount,
        existingMap,
        activeCampaignInfluencers
      });

      setStep('preview');
    } catch (err: any) {
      console.error('[Upload Pipeline Error]:', err);
      const msg = `Failed to process file: ${err?.message || String(err)}`;
      setUploadError(msg);
      setStep('error');
      showUploadResultToast({
        title: `${courier} Upload Failed`,
        isSuccess: false,
        acceptedCount: 0,
        ignoredCustomerCount: 0,
        unmatchedInvalidCount: 0,
        updatedExistingCount: 0,
        newShipmentsCount: 0,
        errorMessage: msg
      });
    } finally {
      isExecutingRef.current = false;
    }
  };

  // Step 2: User confirms the preview -> execute final import & persistence
  const executeFinalImport = async () => {
    if (!previewData || isExecutingRef.current) return;
    isExecutingRef.current = true;
    setStep('importing');

    const { 
      validRows, 
      existingMap, 
      ignoredCustomerCount, 
      invalidCount, 
      totalCsvRows,
      rowsWithRemarksCount 
    } = previewData;

    try {
      // =======================================================================
      // WORKFLOW A: ST COURIER (LIVE API SYNC ONE BY ONE)
      // =======================================================================
      if (courier === 'ST Courier') {
        setImportProgress({
          total: validRows.length,
          completed: 0,
          accepted: validRows.length,
          ignored: ignoredCustomerCount,
          successful: 0,
          failed: invalidCount,
          duplicates: 0,
          imported: 0,
          currentAwb: '',
          phase: `Fetching live statuses from ST Courier (0 of ${validRows.length})...`
        });

        const trackedShipments: InfluencerDispatchedShipment[] = [];
        let liveApiSyncedCount = 0;
        let liveApiPendingCount = 0;
        let completedCount = 0;

        const concurrency = 2;
        for (let i = 0; i < validRows.length; i += concurrency) {
          const chunk = validRows.slice(i, i + concurrency);

          await Promise.all(
            chunk.map(async (row) => {
              const inf = row.matchedInf;
              const awb = row.rawAwb.trim();
              const existingShipment = existingMap.get(awb.toLowerCase());

              const baseShipment: InfluencerDispatchedShipment = {
                id: existingShipment?.id || crypto.randomUUID(),
                influencerId: String(inf.id),
                creatorName: inf.influencer_name || inf.name || existingShipment?.creatorName || 'Influencer',
                username: inf.platforms?.find(p => p.username)?.username || existingShipment?.username || `@${inf.influencer_name}`,
                influencerCode: inf.code || row.baseOrderId || existingShipment?.influencerCode || '',
                orderId: row.orderId || existingShipment?.orderId || undefined,
                rawOrderId: row.rawOrderId || existingShipment?.rawOrderId || undefined,
                baseOrderId: row.baseOrderId || existingShipment?.baseOrderId || undefined,
                isResend: row.isResend !== undefined ? row.isResend : existingShipment?.isResend,
                attemptNumber: row.attemptNumber || existingShipment?.attemptNumber,
                profilePhoto: inf.profile_file_url || existingShipment?.profilePhoto || '',
                phoneNumber: inf.phone_number || existingShipment?.phoneNumber || '',
                altPhoneNumber: inf.alternative_number || existingShipment?.altPhoneNumber || '',
                state: inf.state || row.state || existingShipment?.state || '',
                city: row.city || existingShipment?.city || undefined,
                pincode: row.pin || existingShipment?.pincode || undefined,
                batchCode: existingShipment?.batchCode || '—',
                batchId: existingShipment?.batchId,
                awbNumber: awb,
                courier: 'ST Courier',
                dispatchDate: row.date ? (parseToYMD(row.date) || row.date) : (existingShipment?.dispatchDate || existingShipment?.dispatchedDate || ''),
                dispatchedDate: row.date ? (parseToYMD(row.date) || row.date) : (existingShipment?.dispatchDate || existingShipment?.dispatchedDate || ''),
                expectedDeliveryDate: row.edd ? (parseToYMD(row.edd) || row.edd) : (existingShipment?.expectedDeliveryDate || ''),
                estimatedDeliveryDate: row.edd ? (parseToYMD(row.edd) || row.edd) : (existingShipment?.estimatedDeliveryDate || ''),
                deliveredDate: row.deliveredDate ? (parseToYMD(row.deliveredDate) || row.deliveredDate) : (existingShipment?.deliveredDate || undefined),
                status: 'Pending',
                rawStatus: row.currentStatus || 'Pending',
                statusSource: 'Live ST Courier Tracking',
                sourceType: 'LIVE_API',
                trackingUrl: getCourierTrackingUrl('ST Courier', awb)
              };

              const tracked = await syncSingleShipment(baseShipment, campaign.id);
              trackedShipments.push(tracked);

              if (!tracked.syncError && tracked.status !== 'Exception') {
                liveApiSyncedCount++;
              } else {
                liveApiPendingCount++;
              }
              completedCount++;

              setImportProgress({
                total: validRows.length,
                completed: completedCount,
                accepted: validRows.length,
                ignored: ignoredCustomerCount,
                successful: liveApiSyncedCount,
                failed: invalidCount,
                duplicates: 0,
                imported: completedCount,
                currentAwb: awb,
                phase: `Fetching ST Courier status (${completedCount} of ${validRows.length})...`
              });
            })
          );
        }

        // Save only validated campaign influencer shipments to Supabase
        const dbResult = await upsertCampaignShipmentsToDb(campaign.id, trackedShipments);

        const acceptedReported = validRows.length;
        const importedReported = dbResult.imported;
        const duplicatesReported = dbResult.duplicatesUpdated;
        const failedReported = dbResult.failed + invalidCount;

        // Persist matched influencers to Supabase influencer_dispatch table
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
                    dispatch_date: s.dispatchDate || null,
                    expected_delivery_date: s.expectedDeliveryDate || null
                  })
                  .eq('id', existingRecords[0].id);
              }
            } catch (e) {}
          }
        }

        // Log activity
        try {
          await logActivity({
            department: 'Marketing',
            action: 'Upload ST Courier Shipments',
            description: `Imported and tracked ${trackedShipments.length} ST Courier shipments for campaign "${campaign.campaign_name}". Accepted: ${acceptedReported}, Ignored customer: ${ignoredCustomerCount}, Invalid: ${invalidCount}, Duplicates updated: ${duplicatesReported}`,
            record_id: String(campaign.id),
            record_name: campaign.campaign_name,
            metadata: { courier: 'ST Courier', total: totalCsvRows, accepted: acceptedReported, ignoredCustomer: ignoredCustomerCount, invalid: invalidCount, imported: importedReported, duplicates: duplicatesReported, failed: failedReported, liveSynced: liveApiSyncedCount, livePending: liveApiPendingCount }
          });
        } catch (e) {}

        setImportProgress(prev => ({
          ...prev,
          completed: prev.total,
          phase: 'Completed',
          duplicates: duplicatesReported,
          imported: importedReported,
          failed: failedReported
        }));
        setStep('completed');

        try {
          await onSuccess();
        } catch (refreshErr) {
          console.warn('Error refreshing tracking data:', refreshErr);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail: { campaignId: String(campaign.id) } }));
        }
        onClose();

        showUploadResultToast({
          title: 'ST Courier Upload Complete',
          isSuccess: true,
          acceptedCount: acceptedReported,
          ignoredCustomerCount: ignoredCustomerCount,
          unmatchedInvalidCount: invalidCount,
          updatedExistingCount: duplicatesReported,
          newShipmentsCount: importedReported
        });

      // =======================================================================
      // WORKFLOW B: DELHIVERY (UPLOADED FILE STATUS AS SOURCE OF TRUTH)
      // =======================================================================
      } else {
        setImportProgress({
          total: validRows.length,
          completed: 0,
          accepted: validRows.length,
          ignored: ignoredCustomerCount,
          successful: 0,
          failed: invalidCount,
          duplicates: 0,
          imported: 0,
          currentAwb: '',
          phase: `Saving ${validRows.length} Delhivery shipments to database...`
        });

        // Pre-fetch existing campaign dispatches
        const existingDispatchesMap = new Map<string, string>();
        try {
          const { data: dispatches } = await supabaseAdmin
            .from(SUPABASE_TABLES.influencerDispatch)
            .select('id, influencer_id')
            .eq('campaign_id', String(campaign.id));
          if (dispatches) {
            dispatches.forEach((d: any) => {
              if (d.influencer_id) existingDispatchesMap.set(String(d.influencer_id), d.id);
            });
          }
        } catch (e) {}

        const nowTimestamp = new Date().toLocaleString();
        const delhiveryShipments: InfluencerDispatchedShipment[] = [];
        const dispatchUpdates: { id: string; courier_partner: string; tracking_id: string; dispatch_status: string; dispatch_date: string | null; expected_delivery_date: string | null; }[] = [];

        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          const inf = row.matchedInf;
          const awb = String(row.rawAwb || '').trim();

          const incomingRemarks = (row.remarks && row.remarks.trim()) ? row.remarks.trim() : '';
          const existingShipment = existingMap.get(awb.toLowerCase());

          const finalRemarks = incomingRemarks || existingShipment?.remarks || undefined;
          const incomingDeliveredDate = (row.deliveredDate && row.deliveredDate.trim()) ? row.deliveredDate.trim() : '';
          const finalDeliveredDate = (incomingDeliveredDate ? (parseToYMD(incomingDeliveredDate) || incomingDeliveredDate) : '') || existingShipment?.deliveredDate || undefined;

          const displayStatus = row.currentStatus
            ? formatStatusLabel(row.currentStatus)
            : (row.statusType ? formatStatusLabel(row.statusType) : (existingShipment?.status || 'Pending'));
          const statusCategory = resolveDelhiveryCategory(displayStatus, row.currentStatus, row.statusType);
          const rawStatus = row.currentStatus || row.statusType || displayStatus;
          const normalizedDate = row.date ? (parseToYMD(row.date) || row.date) : (existingShipment?.dispatchDate || existingShipment?.dispatchedDate || '');
          const normalizedEdd = row.edd ? (parseToYMD(row.edd) || row.edd) : (existingShipment?.estimatedDeliveryDate || existingShipment?.expectedDeliveryDate || '');

          const shipmentObj: InfluencerDispatchedShipment = {
            id: existingShipment?.id || crypto.randomUUID(),
            influencerId: String(inf.id),
            creatorName: inf.influencer_name || inf.name || existingShipment?.creatorName || 'Influencer',
            username: inf.platforms?.find(p => p.username)?.username || existingShipment?.username || `@${inf.influencer_name}`,
            influencerCode: inf.code || row.baseOrderId || existingShipment?.influencerCode || '',
            orderId: row.orderId || existingShipment?.orderId || undefined,
            rawOrderId: row.rawOrderId || existingShipment?.rawOrderId || undefined,
            baseOrderId: row.baseOrderId || existingShipment?.baseOrderId || undefined,
            isResend: row.isResend !== undefined ? row.isResend : existingShipment?.isResend,
            attemptNumber: row.attemptNumber || existingShipment?.attemptNumber,
            profilePhoto: inf.profile_file_url || existingShipment?.profilePhoto || '',
            phoneNumber: inf.phone_number || existingShipment?.phoneNumber || '',
            altPhoneNumber: inf.alternative_number || existingShipment?.altPhoneNumber || '',
            state: inf.state || row.state || existingShipment?.state || '',
            city: row.city || existingShipment?.city || undefined,
            pincode: row.pin || existingShipment?.pincode || undefined,
            batchCode: existingShipment?.batchCode || '—',
            batchId: existingShipment?.batchId,
            awbNumber: awb,
            courier: 'Delhivery',
            dispatchDate: normalizedDate,
            dispatchedDate: normalizedDate,
            expectedDeliveryDate: normalizedEdd,
            estimatedDeliveryDate: normalizedEdd,
            deliveredDate: finalDeliveredDate,
            status: displayStatus,
            statusCategory,
            rawStatus,
            remarks: finalRemarks,
            pendingRemarks: (row.pendingRemarks && row.pendingRemarks.trim()) ? row.pendingRemarks.trim() : (existingShipment?.pendingRemarks || undefined),
            currentStatus: row.currentStatus || existingShipment?.currentStatus || undefined,
            statusType: row.statusType || existingShipment?.statusType || undefined,
            statusSource: 'Uploaded Delhivery File',
            sourceType: 'UPLOADED_FILE',
            lastSyncedAt: nowTimestamp,
            trackingUrl: getCourierTrackingUrl('Delhivery', awb)
          };

          delhiveryShipments.push(shipmentObj);

          // Save to Dexie
          try {
            await db.shipments.put({
              awb,
              orderId: shipmentObj.orderId || awb,
              status: displayStatus,
              state: row.state || 'Unknown',
              lastLocation: '-',
              trackingDateTime: '-',
              department: (row.state === 'Tamil Nadu') ? 'Tamil Nadu' : 'Other State',
              lastSyncedAt: Date.now()
            });
          } catch (dbErr) {}

          // Queue influencerDispatch update
          const dispatchId = existingDispatchesMap.get(String(inf.id));
          if (dispatchId) {
            dispatchUpdates.push({
              id: dispatchId,
              courier_partner: 'Delhivery',
              tracking_id: awb,
              dispatch_status: 'Dispatched',
              dispatch_date: normalizedDate || null,
              expected_delivery_date: normalizedEdd || null
            });
          }

          if (i % 25 === 0 || i === validRows.length - 1) {
            setImportProgress({
              total: validRows.length,
              completed: i + 1,
              accepted: validRows.length,
              ignored: ignoredCustomerCount,
              successful: i + 1,
              failed: invalidCount,
              duplicates: 0,
              imported: i + 1,
              currentAwb: awb,
              phase: `Saving Delhivery shipments (${i + 1} of ${validRows.length})...`
            });
          }
        }

        // Batch update influencerDispatch records
        if (dispatchUpdates.length > 0) {
          try {
            await Promise.all(dispatchUpdates.map(u =>
              supabaseAdmin
                .from(SUPABASE_TABLES.influencerDispatch)
                .update({
                  courier_partner: u.courier_partner,
                  tracking_id: u.tracking_id,
                  dispatch_status: u.dispatch_status,
                  dispatch_date: u.dispatch_date,
                  expected_delivery_date: u.expected_delivery_date
                })
                .eq('id', u.id)
            ));
          } catch (dispErr) {
            console.warn('Batch updating influencerDispatch failed:', dispErr);
          }
        }

        // Save only validated campaign influencer shipments into Supabase
        const dbResult = await upsertCampaignShipmentsToDb(campaign.id, delhiveryShipments);

        const acceptedReported = validRows.length;
        const importedReported = dbResult.imported;
        const duplicatesReported = dbResult.duplicatesUpdated;
        const failedReported = dbResult.failed + invalidCount;

        // Log activity
        try {
          await logActivity({
            department: 'Marketing',
            action: 'Upload Delhivery Shipments',
            description: `Imported ${delhiveryShipments.length} Delhivery shipments for campaign "${campaign.campaign_name}". Accepted: ${acceptedReported}, Ignored customer: ${ignoredCustomerCount}, Invalid: ${invalidCount}, Duplicates updated: ${duplicatesReported}, With Remarks: ${rowsWithRemarksCount}`,
            record_id: String(campaign.id),
            record_name: campaign.campaign_name,
            metadata: { courier: 'Delhivery', total: totalCsvRows, accepted: acceptedReported, ignoredCustomer: ignoredCustomerCount, invalid: invalidCount, imported: importedReported, duplicates: duplicatesReported, failed: failedReported, rowsWithRemarks: rowsWithRemarksCount, source: 'Uploaded File' }
          });
        } catch (e) {}

        setImportProgress(prev => ({
          ...prev,
          completed: prev.total,
          phase: 'Completed',
          duplicates: duplicatesReported,
          imported: importedReported,
          failed: failedReported
        }));
        setStep('completed');

        clearTrackingCache(campaign.id);
        try {
          await onSuccess();
        } catch (refreshErr) {
          console.warn('Error refreshing tracking data:', refreshErr);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail: { campaignId: String(campaign.id) } }));
        }
        onClose();

        showUploadResultToast({
          title: 'Delhivery Upload Complete',
          isSuccess: true,
          acceptedCount: acceptedReported,
          ignoredCustomerCount: ignoredCustomerCount,
          unmatchedInvalidCount: invalidCount,
          updatedExistingCount: duplicatesReported,
          newShipmentsCount: importedReported,
          rowsWithRemarksCount: rowsWithRemarksCount
        });
      }
    } catch (err: any) {
      console.error('[Execute Final Import Error]:', err);
      const msg = `Import failed: ${err?.message || String(err)}`;
      setUploadError(msg);
      setStep('error');
      showUploadResultToast({
        title: `${courier} Import Failed`,
        isSuccess: false,
        acceptedCount: 0,
        ignoredCustomerCount: 0,
        unmatchedInvalidCount: 0,
        updatedExistingCount: 0,
        newShipmentsCount: 0,
        errorMessage: msg
      });
    } finally {
      isExecutingRef.current = false;
    }
  };

  // Trigger automatically when initialFile is supplied
  useEffect(() => {
    if (initialFile && processedFileRef.current !== initialFile) {
      processedFileRef.current = initialFile;
      executeUploadPipeline(initialFile);
    }
  }, [initialFile]);

  const handleManualFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processedFileRef.current = selected;
      executeUploadPipeline(selected);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      processedFileRef.current = selected;
      executeUploadPipeline(selected);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className={`bg-[#141a29] border border-slate-700/80 rounded-2xl w-full ${step === 'preview' ? 'max-w-3xl' : 'max-w-xl'} flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 transition-all`}>
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700/80 bg-[#1e2638] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30 shrink-0">
              <Truck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  {step === 'preview' ? 'Review & Confirm Import' : `Upload for ${courier}`}
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-950/70 border border-purple-800/50 text-purple-300">
                  {courier}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 'preview' ? (
                  <span>Verify detected influencer shipments before saving to database</span>
                ) : courier === 'ST Courier' ? (
                  <span>Live status will be tracked one by one via ST Courier service</span>
                ) : (
                  <span>Status will be extracted directly from the uploaded file</span>
                )}
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            disabled={step === 'importing'}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[80vh]">
          {/* STEP 1: IMPORT PREVIEW SUMMARY */}
          {step === 'preview' && previewData && (
            <div className="space-y-5 animate-fade-in">
              {/* Notification Banner */}
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-start gap-3 text-emerald-200">
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold text-emerald-300">File Analysis Complete:</span> Velmora scanned{' '}
                  <span className="font-semibold text-white font-mono">{previewData.totalCsvRows.toLocaleString()}</span> rows from{' '}
                  <span className="font-semibold text-white font-mono">{previewData.file.name}</span>. Identified{' '}
                  <span className="font-bold text-emerald-400 font-mono">{previewData.validRows.length}</span> valid influencer shipments.{' '}
                  <span className="text-emerald-300/90 font-mono">{previewData.ignoredCustomerCount.toLocaleString()}</span> unrelated customer rows will be safely excluded.
                </div>
              </div>

              {/* 6 Key Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-[#101522] border border-slate-800 p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-slate-400">Total File Rows</span>
                  <span className="text-xl font-bold font-mono text-slate-200">{previewData.totalCsvRows.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500">Read from CSV</span>
                </div>

                <div className="bg-[#101522] border border-emerald-900/60 p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-emerald-400">Valid Shipments</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">{previewData.validRows.length}</span>
                  <span className="text-[10px] text-emerald-400/70 font-mono">{previewData.originalCount} orig + {previewData.replacementCount} resend</span>
                </div>

                <div className="bg-[#101522] border border-amber-900/50 p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-amber-300">Replacement (R)</span>
                  <span className="text-xl font-bold font-mono text-amber-300">{previewData.replacementCount}</span>
                  <span className="text-[10px] text-amber-400/70">Re-dispatch orders</span>
                </div>

                <div className="bg-[#101522] border border-slate-800 p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-slate-400">Ignored Customer Rows</span>
                  <span className="text-xl font-bold font-mono text-slate-300">{previewData.ignoredCustomerCount.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500">Numeric/Non-campaign</span>
                </div>

                <div className="bg-[#101522] border border-slate-800 p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-indigo-400">New Shipments</span>
                  <span className="text-xl font-bold font-mono text-indigo-300">{previewData.newShipmentsCount}</span>
                  <span className="text-[10px] text-indigo-400/70">Will be inserted</span>
                </div>

                <div className="bg-[#101522] border border-slate-800 p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-blue-400">Existing to Update</span>
                  <span className="text-xl font-bold font-mono text-blue-300">{previewData.existingShipmentsCount}</span>
                  <span className="text-[10px] text-blue-400/70">Status refreshed</span>
                </div>
              </div>

              {/* Preview Tabs: Valid vs Ignored */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('valid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      previewTab === 'valid'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>Accepted Shipments ({previewData.validRows.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTab('ignored')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      previewTab === 'ignored'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Ban size={13} />
                    <span>Ignored Samples ({previewData.ignoredCustomerCount.toLocaleString()})</span>
                  </button>
                </div>

                {/* Tab 1: Accepted Samples */}
                {previewTab === 'valid' && (
                  <div className="bg-[#0e1422] border border-slate-800/80 rounded-xl overflow-hidden">
                    <div className="p-2.5 bg-slate-900/70 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span className="font-semibold text-slate-300">Showing first {previewData.validSamples.length} accepted influencer shipments:</span>
                      <span className="text-[10px] text-slate-500">Only Reference No. matches are accepted</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 text-xs">
                      {previewData.validSamples.map((item, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 ${
                              item.isReplacement 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}>
                              {item.displayOrderId}
                            </span>
                            <span className="font-medium text-slate-200 truncate">{item.influencerName}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono text-[11px] text-slate-400">{item.awb}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                              {item.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 2: Ignored Customer Rows */}
                {previewTab === 'ignored' && (
                  <div className="bg-[#0e1422] border border-slate-800/80 rounded-xl overflow-hidden">
                    <div className="p-2.5 bg-slate-900/70 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span className="font-semibold text-slate-300">Sample of ignored customer rows (Total: {previewData.ignoredCustomerCount.toLocaleString()}):</span>
                      <span className="text-[10px] text-amber-400/80">Protected: Will NOT be imported</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 text-xs">
                      {previewData.ignoredSamples.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs">No customer rows were ignored.</div>
                      ) : (
                        previewData.ignoredSamples.map((item, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-semibold text-rose-300/90 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/50">
                                {item.ref}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 italic shrink-0">
                              {item.reason}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewData(null);
                    setStep('upload');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel / Select Another File
                </button>

                <button
                  type="button"
                  onClick={executeFinalImport}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-950/60 flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Check size={15} />
                  <span>Confirm & Import {previewData.validRows.length} Shipments</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: IMPORTING PROGRESS (DURING FINAL PERSISTENCE) */}
          {(step === 'importing' || step === 'completed') && (
            <div className="py-6 flex flex-col items-center justify-center space-y-6 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-purple-950/70 border border-purple-600/60 flex items-center justify-center text-purple-400 shadow-xl shadow-purple-950/50">
                {step === 'completed' ? (
                  <CheckCircle2 size={36} className="text-emerald-400 animate-in zoom-in-75 duration-200" />
                ) : (
                  <RefreshCw size={32} className="animate-spin text-purple-400" />
                )}
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">
                  {step === 'completed'
                    ? `${courier} Import Complete!`
                    : (courier === 'ST Courier' ? 'Fetching Live ST Courier Tracking' : 'Saving Delhivery Shipments')}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  {importProgress.phase || 'Processing shipments...'}
                </p>
                {importProgress.currentAwb && (
                  <p className="text-[11px] font-mono text-purple-300">
                    AWB: {importProgress.currentAwb}
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md space-y-2">
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                  <div 
                    className="bg-gradient-to-r from-purple-600 to-indigo-500 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${importProgress.total > 0 ? Math.round((importProgress.completed / importProgress.total) * 100) : (step === 'completed' ? 100 : 15)}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Processed {importProgress.completed} of {importProgress.total} shipments</span>
                  <span>{importProgress.total > 0 ? Math.round((importProgress.completed / importProgress.total) * 100) : (step === 'completed' ? 100 : 0)}%</span>
                </div>
              </div>

              {/* Live Count Badges */}
              <div className="flex items-center gap-2.5 flex-wrap justify-center">
                <span className="px-3 py-1 rounded-xl bg-purple-950/60 border border-purple-800/60 text-purple-300 text-xs font-semibold">
                  Accepted: {importProgress.accepted}
                </span>
                {importProgress.ignored > 0 && (
                  <span className="px-3 py-1 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs font-semibold" title="Ignored — Not a campaign influencer">
                    Ignored Customers: {importProgress.ignored}
                  </span>
                )}
                <span className="px-3 py-1 rounded-xl bg-blue-950/60 border border-blue-800/60 text-blue-300 text-xs font-semibold">
                  Updated: {importProgress.duplicates}
                </span>
                <span className="px-3 py-1 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
                  New: {importProgress.imported}
                </span>
                {importProgress.failed > 0 && (
                  <span className="px-3 py-1 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs font-semibold">
                    Failed: {importProgress.failed}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: ERROR SCREEN */}
          {step === 'error' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-2xl flex items-start gap-3.5 text-rose-200">
                <AlertTriangle size={24} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-xs">
                  <div className="font-bold text-sm text-rose-300">Upload Failed</div>
                  <div className="leading-relaxed">{uploadError}</div>
                  {detectedHeaders.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-rose-900/60 text-[11px] text-slate-300">
                      <div className="font-semibold text-slate-400 mb-1">Detected headers in your file:</div>
                      <div className="font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800 max-h-24 overflow-y-auto leading-relaxed text-slate-300">
                        {detectedHeaders.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    setStep('upload');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                      fileInputRef.current.click();
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Select Another File</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: MANUAL DROPZONE */}
          {step === 'upload' && (
            <div className="space-y-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                onChange={handleManualFileInputChange} 
                className="hidden" 
              />

              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-700/80 hover:border-purple-500/80 bg-[#0e1626]/70 hover:bg-purple-950/10 rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[220px] group"
              >
                <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-purple-400 group-hover:scale-105 group-hover:bg-purple-900/50 transition-all mb-3">
                  <FileSpreadsheet size={36} />
                </div>
                <p className="text-sm font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                  Click or drag {courier} file here to upload
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Required column: <code className="text-purple-300 bg-purple-950/60 px-1 py-0.5 rounded border border-purple-800/50 font-mono">{courier === 'ST Courier' ? 'Tracking number' : 'Waybill & Reference No.'}</code>
                </p>
                {courier === 'Delhivery' && (
                  <p className="text-[11px] text-slate-500 mt-2 max-w-sm">
                    Only shipment rows whose Reference No. belongs to a valid campaign influencer (#HIS1, R HIS1, etc.) will be accepted. Customer orders are safely ignored.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
