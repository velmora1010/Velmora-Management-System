import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Truck, 
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import db from '../../lib/db';
import { logActivity } from '../../services/activityService';
import {
  syncSingleShipment,
  normalizeDelhiveryStatus,
  normalizeTrackingStatus,
  upsertCampaignShipments,
  getCampaignShipments,
  InfluencerDispatchedShipment,
  getCourierTrackingUrl
} from '../../services/influencerTrackingService';
import toast from 'react-hot-toast';

export interface UploadCourierShipmentModalProps {
  campaign: Campaign;
  courier: 'ST Courier' | 'Delhivery';
  influencers: CampaignInfluencer[];
  initialFile?: File | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadCourierShipmentModal: React.FC<UploadCourierShipmentModalProps> = ({
  campaign,
  courier,
  influencers,
  initialFile,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'importing' | 'completed' | 'error'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isExecutingRef = useRef(false);

  // Import Progress State
  const [importProgress, setImportProgress] = useState<{
    total: number;
    completed: number;
    successful: number;
    failed: number;
    duplicates: number;
    imported: number;
    currentAwb: string;
    phase: string;
  }>({
    total: 0,
    completed: 0,
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

  // Automated end-to-end upload, parse, transform, import, and sync pipeline
  const executeUploadPipeline = async (selectedFile: File) => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;

    setFile(selectedFile);
    setUploadError(null);
    setStep('importing');

    console.log(`[Upload Pipeline] Starting for ${courier}. File:`, selectedFile.name, 'Size:', selectedFile.size, 'Type:', selectedFile.type);

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
      let cityCol: string | null = null;
      let stateCol: string | null = null;
      let pinCol: string | null = null;

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
        dateCol = findColumnKey(headers, ['orderdate', 'dispatchdate', 'bookingdate', 'date', 'pickupdate']);
        weightCol = findColumnKey(headers, ['weight', 'totalweight', 'chargedweight']);
      } else {
        // Delhivery
        awbCol = findColumnKey(headers, ['waybill', 'waybillno', 'waybillnumber', 'awb', 'trackingnumber']);
        if (!awbCol) {
          const err = `Delhivery upload failed: Required "Waybill" column not found. Available columns: ${headers.join(', ')}`;
          setUploadError(err);
          setStep('error');
          toast.error('Invalid Delhivery file: "Waybill" column not found.', { duration: 6000 });
          isExecutingRef.current = false;
          return;
        }
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

      // 2. Build influencer lookup maps for current campaign
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

      // 3. Existing shipments in current campaign (for duplicate & reconciliation tracking)
      const existingCampaignShipments = getCampaignShipments(campaign.id);
      const existingMap = new Map<string, InfluencerDispatchedShipment>();
      existingCampaignShipments.forEach(s => {
        const k = (s.awbNumber || s.id).toLowerCase().trim();
        if (k) existingMap.set(k, s);
      });

      // 4. Parse rows into shipment records
      const todayDate = new Date().toISOString().split('T')[0];
      const validRows: {
        rawAwb: string;
        orderId: string;
        consigneeName: string;
        currentStatus: string;
        statusType: string;
        weight: string;
        date: string;
        edd: string;
        city: string;
        state: string;
        pin: string;
        matchedInf?: CampaignInfluencer;
      }[] = [];

      rawData.forEach((row) => {
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
        // Require valid AWB
        if (!rawAwb || rawAwb.length < 4) return;

        let matchedInf: CampaignInfluencer | undefined;

        if (rawOrderId) {
          const normCode = normalizeCode(rawOrderId);
          if (codeMap.has(normCode)) {
            matchedInf = codeMap.get(normCode);
          } else if (idMap.has(rawOrderId)) {
            matchedInf = idMap.get(rawOrderId);
          }
        }

        if (!matchedInf && rawConsigneeName) {
          const normName = cleanStr(rawConsigneeName).toLowerCase();
          if (nameMap.has(normName)) {
            matchedInf = nameMap.get(normName);
          }
        }

        if (!matchedInf) {
          for (const key of headers) {
            const val = cleanStr(row[key]);
            if (!val) continue;
            const normC = normalizeCode(val);
            const normP = normalizePhone(val);
            if (codeMap.has(normC)) {
              matchedInf = codeMap.get(normC);
              break;
            } else if (normP && phoneMap.has(normP)) {
              matchedInf = phoneMap.get(normP);
              break;
            }
          }
        }

        validRows.push({
          rawAwb,
          orderId: rawOrderId,
          consigneeName: rawConsigneeName,
          currentStatus: rawCurrentStatus,
          statusType: rawStatusType,
          weight: rawWeight,
          date: rawDate,
          edd: rawEdd,
          city: rawCity,
          state: rawState,
          pin: rawPin,
          matchedInf
        });
      });

      if (validRows.length === 0) {
        const err = `No valid shipments found with a valid ${courier === 'ST Courier' ? 'Tracking number' : 'Waybill'}.`;
        setUploadError(err);
        setStep('error');
        toast.error(err);
        isExecutingRef.current = false;
        return;
      }

      // Count new vs duplicate/reconciled
      let duplicateCount = 0;
      let newCount = 0;
      validRows.forEach(r => {
        const k = r.rawAwb.toLowerCase().trim();
        if (existingMap.has(k)) {
          duplicateCount++;
        } else {
          newCount++;
        }
      });

      console.log(`[Upload Pipeline] Valid rows: ${validRows.length}, New: ${newCount}, Duplicates to update: ${duplicateCount}`);

      // =======================================================================
      // WORKFLOW A: ST COURIER (LIVE API SYNC ONE BY ONE)
      // =======================================================================
      if (courier === 'ST Courier') {
        setImportProgress({
          total: validRows.length,
          completed: 0,
          successful: 0,
          failed: 0,
          duplicates: duplicateCount,
          imported: newCount,
          currentAwb: '',
          phase: `Fetching live statuses from ST Courier (0 of ${validRows.length})...`
        });

        const trackedShipments: InfluencerDispatchedShipment[] = [];
        let successfulCount = 0;
        let failedCount = 0;
        let completedCount = 0;

        // Controlled concurrency: 2 at a time
        const concurrency = 2;
        for (let i = 0; i < validRows.length; i += concurrency) {
          const chunk = validRows.slice(i, i + concurrency);

          await Promise.all(
            chunk.map(async (row) => {
              const inf = row.matchedInf;
              const awb = row.rawAwb.trim();
              const orderId = row.orderId || (inf ? inf.code : undefined) || '';

              const baseShipment: InfluencerDispatchedShipment = {
                id: inf ? (inf.dispatchDetails?.id || String(inf.id)) : `st-${awb}`,
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
                pincode: row.pin || undefined,
                batchCode: '—',
                awbNumber: awb,
                courier: 'ST Courier',
                dispatchDate: row.date || todayDate,
                expectedDeliveryDate: row.edd || '',
                status: 'Pending',
                rawStatus: row.currentStatus || 'Pending',
                statusSource: 'Live ST Courier Tracking',
                sourceType: 'LIVE_API',
                trackingUrl: getCourierTrackingUrl('ST Courier', awb)
              };

              // Fetch live status from existing ST Courier tracking API
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
                duplicates: duplicateCount,
                imported: newCount,
                currentAwb: awb,
                phase: `Fetching ST Courier status (${completedCount} of ${validRows.length})...`
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
                    dispatch_date: s.dispatchDate || todayDate,
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
            description: `Imported and tracked ${trackedShipments.length} ST Courier shipments for campaign "${campaign.campaign_name}". Successfully tracked: ${successfulCount}, Failed: ${failedCount}`,
            record_id: String(campaign.id),
            record_name: campaign.campaign_name,
            metadata: { courier: 'ST Courier', total: trackedShipments.length, successful: successfulCount, failed: failedCount }
          });
        } catch (e) {}

        setImportProgress(prev => ({
          ...prev,
          phase: 'Completed'
        }));
        setStep('completed');

        const summaryText = `ST Courier Upload Complete\nTotal rows: ${validRows.length}\nImported: ${newCount}\nDuplicates updated: ${duplicateCount}\nFailed: ${failedCount}`;
        toast.success(summaryText, { duration: 6000 });

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 700);

      // =======================================================================
      // WORKFLOW B: DELHIVERY (UPLOADED FILE STATUS AS SOURCE OF TRUTH - NO API)
      // =======================================================================
      } else {
        setImportProgress({
          total: validRows.length,
          completed: 0,
          successful: 0,
          failed: 0,
          duplicates: duplicateCount,
          imported: newCount,
          currentAwb: '',
          phase: `Importing ${validRows.length} Delhivery shipments from file...`
        });

        const nowTimestamp = new Date().toLocaleString();
        const delhiveryShipments: InfluencerDispatchedShipment[] = [];

        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          const inf = row.matchedInf;
          const awb = row.rawAwb.trim();
          const orderId = row.orderId || (inf ? inf.code : undefined) || '';

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
            pincode: row.pin || undefined,
            batchCode: '—',
            awbNumber: awb,
            courier: 'Delhivery',
            dispatchDate: row.date || todayDate,
            expectedDeliveryDate: row.edd || '',
            status: normalized,
            rawStatus,
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
              orderId: orderId || awb,
              status: rawStatus,
              state: row.state || 'Unknown',
              lastLocation: '-',
              trackingDateTime: '-',
              department: (row.state === 'Tamil Nadu') ? 'Tamil Nadu' : 'Other State',
              lastSyncedAt: Date.now()
            });
          } catch (dbErr) {}

          // If matched to influencer, persist to Supabase
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
                    dispatch_date: row.date || todayDate,
                    expected_delivery_date: row.edd || null,
                    total_weight: row.weight || '500g'
                  })
                  .eq('id', existingRecords[0].id);
              }
            } catch (e) {}
          }

          if (i % 20 === 0 || i === validRows.length - 1) {
            setImportProgress({
              total: validRows.length,
              completed: i + 1,
              successful: i + 1,
              failed: 0,
              duplicates: duplicateCount,
              imported: newCount,
              currentAwb: awb,
              phase: `Importing Delhivery shipments (${i + 1} of ${validRows.length})...`
            });
          }
        }

        // Save all Delhivery shipments into isolated campaign storage
        upsertCampaignShipments(campaign.id, delhiveryShipments);

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

        setImportProgress(prev => ({
          ...prev,
          phase: 'Completed'
        }));
        setStep('completed');

        const summaryText = `Delhivery Upload Complete\nTotal rows: ${validRows.length}\nImported: ${newCount}\nDuplicates updated: ${duplicateCount}\nFailed: 0`;
        toast.success(summaryText, { duration: 6000 });

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 700);
      }
    } catch (err: any) {
      console.error('[Upload Pipeline Error]:', err);
      const msg = `Upload failed: ${err?.message || String(err)}`;
      setUploadError(msg);
      setStep('error');
      toast.error(msg, { duration: 6000 });
    } finally {
      isExecutingRef.current = false;
    }
  };

  // Trigger automatically when initialFile is supplied
  useEffect(() => {
    if (initialFile) {
      executeUploadPipeline(initialFile);
    }
  }, [initialFile]);

  const handleManualFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      executeUploadPipeline(selected);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      executeUploadPipeline(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#141a29] border border-slate-700/80 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700/80 bg-[#1e2638] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30 shrink-0">
              <Truck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Upload for {courier}
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-950/70 border border-purple-800/50 text-purple-300">
                  {courier}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {courier === 'ST Courier' ? (
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
        <div className="p-6">
          {/* STEP 1: IMPORTING PROGRESS (AUTOMATIC) */}
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
                    : (courier === 'ST Courier' ? 'Fetching Live ST Courier Tracking' : 'Importing Delhivery Shipments')}
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
                  New: {importProgress.imported}
                </span>
                <span className="px-3 py-1 rounded-xl bg-blue-950/60 border border-blue-800/60 text-blue-300 text-xs font-semibold">
                  Updated: {importProgress.duplicates}
                </span>
                <span className="px-3 py-1 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
                  Ready: {importProgress.successful}
                </span>
                {importProgress.failed > 0 && (
                  <span className="px-3 py-1 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs font-semibold">
                    Failed: {importProgress.failed}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: ERROR SCREEN */}
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

          {/* STEP 3: FALLBACK MANUAL DROPZONE */}
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
                  Required column: <code className="text-purple-300 bg-purple-950/60 px-1 py-0.5 rounded border border-purple-800/50 font-mono">{courier === 'ST Courier' ? 'Tracking number' : 'Waybill'}</code>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
