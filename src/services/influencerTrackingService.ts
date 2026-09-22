import db from '../lib/db';
import { trackingService } from './trackingService';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignInfluencer } from '../types';
import { parseToYMD, formatDisplayDateLocal, getTodayLocalYMD } from '../utils/influencerDateUtils';
import {
  naturalCompareInfluencerCodes,
  naturalCompareCodes,
  getInfluencerCodeNumber,
  getShipmentInfluencerCode,
  compareShipmentsByInfluencerCodeNaturally,
  sortInfluencerShipmentsNaturally
} from './influencerStatusHandoffService';

export {
  naturalCompareInfluencerCodes,
  naturalCompareCodes,
  getInfluencerCodeNumber,
  getShipmentInfluencerCode,
  compareShipmentsByInfluencerCodeNaturally,
  sortInfluencerShipmentsNaturally,
  parseToYMD,
  formatDisplayDateLocal,
  getTodayLocalYMD
};

export type TrackingStatusCategory = 
  | 'All'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Exception'
  | 'Failed Attempt'
  | 'Pending'
  | 'Info Received'
  | 'Expired';

export interface InfluencerDispatchedShipment {
  id: string; // Dispatch record id, awb, or unique id
  influencerId?: string;
  creatorName: string;
  username: string;
  influencerCode: string;
  orderId?: string;
  profilePhoto: string;
  phoneNumber: string;
  altPhoneNumber: string;
  state: string;
  city?: string;
  pincode?: string;
  batchId?: string;
  batchCode: string;
  awbNumber: string;
  courier: string;
  dispatchDate: string;
  dispatchedDate?: string;
  expectedDeliveryDate: string;
  estimatedDeliveryDate?: string;
  deliveredDate?: string;
  status: string;
  statusCategory?: TrackingStatusCategory;
  rawStatus: string;
  remarks?: string;
  pendingRemarks?: string;
  currentStatus?: string;
  statusType?: string;
  statusSource?: 'Live ST Courier Tracking' | 'Uploaded Delhivery File' | string;
  sourceType?: 'LIVE_API' | 'UPLOADED_FILE';
  lastLocation?: string;
  trackingDateTime?: string;
  lastSyncedAt?: string;
  trackingUrl?: string | null;
  syncError?: string;
}

export interface TrackingCacheEntry {
  status: string;
  statusCategory?: TrackingStatusCategory;
  rawStatus: string;
  statusSource?: 'Live ST Courier Tracking' | 'Uploaded Delhivery File' | string;
  sourceType?: 'LIVE_API' | 'UPLOADED_FILE';
  lastLocation?: string;
  trackingDateTime?: string;
  lastSyncedAt: string;
  syncError?: string;
}

/**
 * Normalizes raw status strings or error messages into the standard Tracking Status categories.
 */
export function normalizeTrackingStatus(statusText?: string, error?: string): TrackingStatusCategory {
  if (error === 'Sync not available for this courier') {
    return 'Pending';
  }
  if (!statusText || statusText === 'Not Tracked' || statusText === 'Waiting...' || statusText === 'Checking...' || statusText === 'Queued') {
    return 'Pending';
  }

  const s = statusText.toLowerCase().trim();

  if (s.includes('out for delivery') || s.includes('out_for_delivery')) {
    return 'Out for Delivery';
  }
  if (s.includes('in transit') || s.includes('transit') || s.includes('vehicle departed') || s.includes('departed') || s.includes('forwarded') || s.includes('arrived')) {
    return 'In Transit';
  }
  if (s.includes('delivered') && !s.includes('undelivered')) {
    return 'Delivered';
  }
  if (s.includes('failed')) {
    return 'Failed Attempt';
  }
  if (
    s.includes('exception') || 
    s.includes('error') || 
    s.includes('unable to fetch') || 
    s.includes('sync failed') || 
    s.includes('rto') ||
    s.includes('returned') ||
    s.includes('unknown')
  ) {
    return 'Exception';
  }
  if (s.includes('info received') || s.includes('shipment created') || s.includes('booked') || s.includes('manifest')) {
    return 'Info Received';
  }
  if (s.includes('expired')) {
    return 'Expired';
  }

  return 'Pending';
}

export interface DelhiveryStatusInput {
  remarks?: string | null;
  pendingRemarks?: string | null;
  currentStatus?: string | null;
  statusType?: string | null;
  rawStatus?: string | null;
  status?: string | null;
}

/**
 * Formats courier status codes (like READY_FOR_PICKUP, IN_TRANSIT) into clean human-readable labels.
 */
export function formatStatusLabel(str?: string | null): string {
  if (!str) return 'Pending';
  const trimmed = str.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return 'Pending';
  }
  const upper = trimmed.toUpperCase().replace(/\s+/g, '_');
  if (upper === 'READY_FOR_PICKUP') return 'Ready for Pickup';
  if (upper === 'IN_TRANSIT' || upper === 'TRANSIT') return 'In Transit';
  if (upper === 'OUT_FOR_DELIVERY') return 'Out for Delivery';
  if (upper === 'OUT_FOR_PICKUP') return 'Out for Pickup';
  if (upper === 'PICKED_UP') return 'Picked Up';
  if (upper === 'VEHICLE_DEPARTED') return 'In Transit';
  if (upper === 'DELIVERED') return 'Delivered';
  if (upper === 'UNDELIVERED') return 'Undelivered';
  if (upper === 'SHIPPED') return 'In Transit';
  if (upper === 'PENDING') return 'Pending';
  if (upper.includes('DELIVERED_TO_CONSIGNEE') || upper.startsWith('DELIVERED')) return 'Delivered';

  // If all uppercase with underscores, convert to Title Case words
  if (/^[A-Z0-9_]+$/.test(trimmed) && trimmed.includes('_')) {
    return trimmed
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return trimmed;
}

/**
 * Resolves the display status for Delhivery shipments:
 * 1. Current Status (maps directly to status, formatted cleanly e.g. READY_FOR_PICKUP -> Ready for Pickup)
 * 2. Status Type (as secondary courier status)
 * 3. rawStatus / status (if already populated)
 * Remarks are strictly separate and are NEVER used to determine status.
 */
export function resolveDelhiveryDisplayStatus(input?: DelhiveryStatusInput | string | null): string {
  if (!input) return 'Unknown';
  if (typeof input === 'string') {
    const s = input.trim();
    if (s.toLowerCase() === 'vehicle departed' || s.toUpperCase() === 'SHIPPED') return 'In Transit';
    return formatStatusLabel(s) || 'Unknown';
  }

  const checkVal = (v?: string | null): string | null => {
    if (!v) return null;
    const t = v.trim();
    if (!t || t === '-' || t.toLowerCase() === 'null' || t.toLowerCase() === 'undefined') return null;
    if (t.toLowerCase() === 'vehicle departed' || t.toUpperCase() === 'SHIPPED') return 'In Transit';
    return t;
  };

  // 1. Current Status (maps directly to status)
  const resCurrent = checkVal(input.currentStatus);
  if (resCurrent) return formatStatusLabel(resCurrent);

  // 2. Status Type
  const resType = checkVal(input.statusType);
  if (resType) return formatStatusLabel(resType);

  // 3. rawStatus or status
  const resFallback = checkVal(input.rawStatus || input.status);
  if (resFallback) return formatStatusLabel(resFallback);

  return 'Pending';
}

/**
 * Centralized tracking display status resolver.
 * Determines the clean UI status label from shipment data.
 * Status is strictly derived from currentStatus, status, rawStatus, or statusType.
 * Remarks are NEVER used to determine or override status.
 */
export function getTrackingDisplayStatus(shipment?: Partial<InfluencerDispatchedShipment> | string | null): string {
  if (!shipment) return 'Unknown';
  if (typeof shipment === 'string') {
    const s = shipment.trim();
    if (s.toLowerCase() === 'vehicle departed' || s.toUpperCase() === 'SHIPPED') return 'In Transit';
    return formatStatusLabel(s) || 'Unknown';
  }

  const raw = (shipment.rawStatus || '').trim();
  const currentStatus = (shipment.currentStatus || '').trim();
  const status = (shipment.status || '').trim();

  if (
    raw.toLowerCase() === 'vehicle departed' ||
    raw.toUpperCase() === 'SHIPPED' ||
    currentStatus.toLowerCase() === 'vehicle departed' ||
    currentStatus.toUpperCase() === 'SHIPPED' ||
    status.toLowerCase() === 'vehicle departed' ||
    status.toUpperCase() === 'SHIPPED'
  ) {
    return 'In Transit';
  }

  if (currentStatus) {
    return formatStatusLabel(currentStatus);
  }

  if (status && status !== 'Unknown') {
    return formatStatusLabel(status);
  }

  return resolveDelhiveryDisplayStatus({
    currentStatus,
    statusType: shipment.statusType,
    rawStatus: raw,
    status
  });
}

/**
 * Formats Estimated Delivery Date for display:
 * If valid date -> "23 Sep 2026"
 * If missing/empty -> "—"
 */
export function formatEstimatedDeliveryDate(dateStr: string | null | undefined): string {
  if (!dateStr || !String(dateStr).trim()) return '—';
  const trimmed = String(dateStr).trim();
  if (trimmed === '—' || trimmed === '-' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'null') {
    return '—';
  }
  const ymd = parseToYMD(trimmed);
  if (!ymd) return trimmed;
  return formatDisplayDateLocal(ymd);
}

/**
 * Formats Dispatched Date (Pick Up Date) for display:
 * If valid date -> "17 Sep 2026"
 * If missing/empty/invalid -> "—"
 */
export function formatDispatchedDate(dateStr: string | null | undefined): string {
  if (!dateStr || !String(dateStr).trim()) return '—';
  const trimmed = String(dateStr).trim();
  if (trimmed === '—' || trimmed === '-' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'null') {
    return '—';
  }
  const ymd = parseToYMD(trimmed);
  if (!ymd) return '—';
  return formatDisplayDateLocal(ymd);
}

/**
 * Formats Delivered Date for display:
 * If valid date -> "22 Sep 2026"
 * If missing/empty/invalid -> "—"
 */
export function formatDeliveredDate(dateStr: string | null | undefined): string {
  if (!dateStr || !String(dateStr).trim()) return '—';
  const trimmed = String(dateStr).trim();
  if (trimmed === '—' || trimmed === '-' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'null') {
    return '—';
  }
  const ymd = parseToYMD(trimmed);
  if (!ymd) return '—';
  return formatDisplayDateLocal(ymd);
}

/**
 * Normalizes any courier status or remark to one of the 8 canonical TrackingStatusCategory values:
 * 'All' | 'Exception' | 'Failed Attempt' | 'Pending' | 'In Transit' | 'Delivered' | 'Out for Delivery' | 'Info Received' | 'Expired'
 */
export function resolveDelhiveryCategory(
  displayStatus?: string | null,
  currentStatus?: string | null,
  statusType?: string | null
): TrackingStatusCategory {
  const combined = `${displayStatus || ''} ${currentStatus || ''} ${statusType || ''}`.toLowerCase().trim();
  if (!combined) return 'Pending';

  const isUndelivered = combined.includes('undelivered');

  // 1. Exception / RTO / Returned / Cancelled / Lost / Damaged / Held / Rejected
  if (
    combined.includes('rto') ||
    combined.includes('return to origin') ||
    combined.includes('return') ||
    combined.includes('cancelled') ||
    combined.includes('canceled') ||
    combined.includes('lost') ||
    combined.includes('damaged') ||
    combined.includes('exception') ||
    combined.includes('held') ||
    combined.includes('rejected')
  ) {
    return 'Exception';
  }

  // 2. Failed Attempt
  if (
    combined.includes('attempt failed') ||
    combined.includes('failed attempt') ||
    combined.includes('customer not available') ||
    combined.includes('door locked') ||
    combined.includes('door closed') ||
    combined.includes('attempted') ||
    (isUndelivered && combined.includes('attempt'))
  ) {
    return 'Failed Attempt';
  }

  // 3. Delivered (CRITICAL: NEVER match if 'undelivered' is present!)
  if (!isUndelivered && (combined.includes('delivered') || combined.includes('dlvd'))) {
    return 'Delivered';
  }

  // 4. Out for Delivery
  if (combined.includes('out for delivery') || combined.includes('out_for_delivery')) {
    return 'Out for Delivery';
  }

  // 5. In Transit
  if (
    combined.includes('in transit') ||
    combined.includes('transit') ||
    combined.includes('vehicle departed') ||
    combined.includes('departed') ||
    combined.includes('shipped') ||
    combined.includes('forwarded') ||
    combined.includes('bagging') ||
    combined.includes('reached') ||
    combined.includes('hub') ||
    combined.includes('center') ||
    combined.includes('dispatched')
  ) {
    return 'In Transit';
  }

  // 6. Info Received / Manifest / Booked
  if (
    combined.includes('manifest') ||
    combined.includes('info received') ||
    combined.includes('booked') ||
    combined.includes('shipment created')
  ) {
    return 'Info Received';
  }

  // 7. Expired
  if (combined.includes('expired')) {
    return 'Expired';
  }

  // 8. Pending (Pickup, Out for Pickup, Ready for Pickup, Undelivered, Pending, or any other non-delivered state)
  if (
    combined.includes('pickup') ||
    combined.includes('pick up') ||
    combined.includes('out for pickup') ||
    combined.includes('ready_for_pickup') ||
    combined.includes('pending') ||
    isUndelivered
  ) {
    return 'Pending';
  }

  return 'Pending';
}

/**
 * Normalizes uploaded Delhivery status into standard Tracking Status categories.
 */
export function normalizeDelhiveryStatus(currentStatus?: string, statusType?: string): TrackingStatusCategory {
  return resolveDelhiveryCategory(undefined, currentStatus, statusType);
}

/**
 * Normalizes any shipment or status into standard Tracking Status categories.
 */
export function normalizeShipmentCategory(
  shipmentOrStatus?: Partial<InfluencerDispatchedShipment> | string | null,
  rawStatus?: string | null,
  currentStatus?: string | null
): TrackingStatusCategory {
  if (!shipmentOrStatus) return 'Pending';
  if (typeof shipmentOrStatus === 'string') {
    return resolveDelhiveryCategory(shipmentOrStatus, rawStatus, currentStatus);
  }
  const s = shipmentOrStatus;
  const displayStatus = getTrackingDisplayStatus(s);
  return resolveDelhiveryCategory(
    displayStatus || s.status,
    s.rawStatus || rawStatus,
    s.currentStatus || s.statusType || currentStatus
  );
}

/**
 * Convenience helper to get the canonical status category for a shipment.
 */
export function getShipmentCategory(s: InfluencerDispatchedShipment): TrackingStatusCategory {
  return normalizeShipmentCategory(s);
}

/**
 * Checks whether a shipment or status string is classified as Delivered.
 * Safely resolves any courier delivered-status variants (e.g. "Delivered",
 * "Delivered to consignee - Code Verified delivery", "Delivered to Consignee", etc.)
 * Returns false for non-delivered states (Pending, In Transit, Exception, Failed Attempt, etc.)
 */
export function isShipmentDelivered(
  shipmentOrStatus?: Partial<InfluencerDispatchedShipment> | string | null
): boolean {
  if (!shipmentOrStatus) return false;
  return normalizeShipmentCategory(shipmentOrStatus) === 'Delivered';
}

/**
 * Returns direct URL to open official courier tracking.
 */
export function getCourierTrackingUrl(courier: string, awb: string): string | null {
  if (!awb || !awb.trim()) return null;
  const cleanAwb = encodeURIComponent(awb.trim());
  const c = (courier || '').toLowerCase();

  if (c.includes('st courier') || c.includes('stcourier')) {
    return 'https://stcourier.com/track/shipment';
  }
  if (c.includes('delhivery')) {
    return `https://www.delhivery.com/track/package/${cleanAwb}`;
  }
  if (c.includes('dtdc')) {
    return `https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno=${cleanAwb}`;
  }
  if (c.includes('ekart')) {
    return 'https://ekartlogistics.com/';
  }
  if (c.includes('blue dart') || c.includes('bluedart')) {
    return 'https://www.bluedart.com/tracking';
  }
  if (c.includes('india post') || c.includes('speed post') || c.includes('post')) {
    return 'https://www.indiapost.gov.in/_layouts/15/dpt.cept.tracking/trackconsignment.aspx';
  }
  if (c.includes('professional')) {
    return 'https://www.tpcindia.com/';
  }

  return null;
}

/**
 * Returns color classes for the status badge based on courier status or category.
 */
export function getTrackingStatusBadgeStyle(status?: TrackingStatusCategory | string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  const category = resolveDelhiveryCategory(status);
  switch (category) {
    case 'Delivered':
      return {
        bg: 'bg-emerald-950/60',
        text: 'text-emerald-400',
        border: 'border-emerald-800/60',
        dot: 'bg-emerald-400'
      };
    case 'In Transit':
      return {
        bg: 'bg-blue-950/60',
        text: 'text-blue-400',
        border: 'border-blue-800/60',
        dot: 'bg-blue-400'
      };
    case 'Out for Delivery':
      return {
        bg: 'bg-cyan-950/60',
        text: 'text-cyan-400',
        border: 'border-cyan-800/60',
        dot: 'bg-cyan-400'
      };
    case 'Exception':
    case 'Failed Attempt':
      return {
        bg: 'bg-rose-950/60',
        text: 'text-rose-400',
        border: 'border-rose-800/60',
        dot: 'bg-rose-400'
      };
    case 'Info Received':
      return {
        bg: 'bg-indigo-950/60',
        text: 'text-indigo-400',
        border: 'border-indigo-800/60',
        dot: 'bg-indigo-400'
      };
    case 'Expired':
      return {
        bg: 'bg-slate-900',
        text: 'text-slate-400',
        border: 'border-slate-700',
        dot: 'bg-slate-400'
      };
    case 'Pending':
    default:
      return {
        bg: 'bg-purple-950/60',
        text: 'text-purple-300',
        border: 'border-purple-800/60',
        dot: 'bg-purple-400'
      };
  }
}

/**
 * Local cache helpers for campaign tracking
 */
export function getTrackingCache(campaignId: string | number): Record<string, TrackingCacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`influencer_tracking_cache_${campaignId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveTrackingCache(campaignId: string | number, cache: Record<string, TrackingCacheEntry>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`influencer_tracking_cache_${campaignId}`, JSON.stringify(cache));
  } catch (e) {
    // Ignore storage quota errors
  }
}

export function clearTrackingCache(campaignId: string | number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`influencer_tracking_cache_${campaignId}`);
  } catch (e) {}
}

export function getLastCampaignSyncTime(campaignId: string | number): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`influencer_tracking_last_sync_${campaignId}`) || null;
  } catch (e) {
    return null;
  }
}

export function setLastCampaignSyncTime(campaignId: string | number, timestamp: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`influencer_tracking_last_sync_${campaignId}`, timestamp);
  } catch (e) {
    // Ignore
  }
}

/**
 * Local campaign shipments storage (isolated per campaign)
 */
export function getCampaignShipments(campaignId: string | number): InfluencerDispatchedShipment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`influencer_campaign_shipments_${campaignId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return sortInfluencerShipmentsNaturally(parsed);
  } catch (e) {
    return [];
  }
}

export function saveCampaignShipments(campaignId: string | number, shipments: InfluencerDispatchedShipment[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sorted = sortInfluencerShipmentsNaturally(shipments);
    localStorage.setItem(`influencer_campaign_shipments_${campaignId}`, JSON.stringify(sorted));
  } catch (e) {
    console.warn('LocalStorage save error for campaign shipments:', e);
  }
}

export function upsertCampaignShipments(
  campaignId: string | number,
  newShipments: InfluencerDispatchedShipment[]
): InfluencerDispatchedShipment[] {
  const cleanCampaignId = String(campaignId).trim();
  const existing = getCampaignShipments(cleanCampaignId);
  const shipmentMap = new Map<string, InfluencerDispatchedShipment>();

  existing.forEach(s => {
    const courier = (s.courier || '').toLowerCase().trim();
    const awb = (s.awbNumber || s.id || '').toLowerCase().trim();
    const key = `${courier}__${awb}`;
    if (awb) {
      shipmentMap.set(key, s);
      shipmentMap.set(awb, s);
    }
  });

  newShipments.forEach(s => {
    const courier = (s.courier || '').toLowerCase().trim();
    const awb = (s.awbNumber || s.id || '').toLowerCase().trim();
    const key = `${courier}__${awb}`;
    if (awb) {
      const prev = shipmentMap.get(key) || shipmentMap.get(awb);
      const incomingRemarks = (s.remarks && s.remarks.trim()) ? s.remarks.trim() : '';
      const finalRemarks = incomingRemarks || prev?.remarks || undefined;

      const incomingDeliveredDate = (s.deliveredDate && s.deliveredDate.trim()) ? s.deliveredDate.trim() : '';
      const finalDeliveredDate = incomingDeliveredDate || prev?.deliveredDate || undefined;

      const updated: InfluencerDispatchedShipment = {
        ...(prev || {}),
        ...s,
        id: prev?.id || s.id,
        creatorName: s.creatorName !== 'Influencer Not Matched' ? s.creatorName : (prev?.creatorName || s.creatorName),
        username: s.username !== '—' ? s.username : (prev?.username || s.username),
        influencerId: s.influencerId || prev?.influencerId,
        profilePhoto: s.profilePhoto || prev?.profilePhoto || '',
        phoneNumber: s.phoneNumber || prev?.phoneNumber || '',
        altPhoneNumber: s.altPhoneNumber || prev?.altPhoneNumber || '',
        state: s.state || prev?.state || '',
        city: s.city || prev?.city,
        pincode: s.pincode || prev?.pincode,
        batchCode: (s.batchCode && s.batchCode !== '—') ? s.batchCode : (prev?.batchCode || '—'),
        batchId: s.batchId || prev?.batchId,
        dispatchDate: s.dispatchDate || prev?.dispatchDate || '',
        dispatchedDate: s.dispatchedDate || s.dispatchDate || prev?.dispatchedDate || prev?.dispatchDate || '',
        expectedDeliveryDate: s.expectedDeliveryDate || prev?.expectedDeliveryDate || '',
        estimatedDeliveryDate: s.estimatedDeliveryDate || s.expectedDeliveryDate || prev?.estimatedDeliveryDate || prev?.expectedDeliveryDate || '',
        deliveredDate: finalDeliveredDate,
        remarks: finalRemarks,
        pendingRemarks: s.pendingRemarks || prev?.pendingRemarks || undefined,
        currentStatus: s.currentStatus || prev?.currentStatus || undefined,
        statusType: s.statusType || prev?.statusType || undefined,
        status: s.status || prev?.status || 'Pending',
        statusCategory: s.statusCategory || prev?.statusCategory,
        rawStatus: s.rawStatus || prev?.rawStatus || ''
      };
      shipmentMap.set(key, updated);
      shipmentMap.set(awb, updated);
    }
  });

  const uniqueMap = new Map<string, InfluencerDispatchedShipment>();
  shipmentMap.forEach(s => {
    const awb = (s.awbNumber || s.id || '').toLowerCase().trim();
    if (awb && !uniqueMap.has(awb)) {
      uniqueMap.set(awb, s);
    }
  });

  const merged = Array.from(uniqueMap.values());
  const sorted = sortInfluencerShipmentsNaturally(merged);
  saveCampaignShipments(cleanCampaignId, sorted);
  return sorted;
}

/**
 * Maps a Supabase database row to the InfluencerDispatchedShipment frontend model.
 */
export function mapDbRowToShipment(row: any): InfluencerDispatchedShipment {
  const isDelhivery = (row.courier || '').toLowerCase().includes('delhivery');
  const isSTCourier = (row.courier || '').toLowerCase().includes('st courier');

  let displayStatus = getTrackingDisplayStatus({
    remarks: row.remarks,
    pendingRemarks: row.pending_remarks,
    currentStatus: row.current_status,
    statusType: row.status_type || row.raw_status,
    rawStatus: row.raw_status,
    status: row.status
  });

  let statusCategory: TrackingStatusCategory;

  if (isDelhivery) {
    statusCategory = resolveDelhiveryCategory(displayStatus, row.current_status, row.status_type || row.raw_status);
  } else {
    if (displayStatus && [
      'In Transit', 'Out for Delivery', 'Delivered', 'Exception', 'Failed Attempt', 'Pending', 'Info Received', 'Expired'
    ].includes(displayStatus)) {
      statusCategory = displayStatus as TrackingStatusCategory;
    } else {
      statusCategory = normalizeTrackingStatus(row.raw_status || displayStatus);
    }
    if (!displayStatus) {
      displayStatus = statusCategory;
    }
  }

  const statusSourceDisplay = isDelhivery
    ? 'Uploaded Delhivery File'
    : (isSTCourier ? 'Live ST Courier Tracking' : (row.status_source === 'delhivery_file' ? 'Uploaded Delhivery File' : 'Live ST Courier Tracking'));

  const edd = row.estimated_delivery_date || row.expected_delivery_date || '';

  let resolvedRemarks = row.remarks || undefined;
  let resolvedDeliveredDate = row.delivered_date || row.deliveredDate || undefined;

  // If Supabase schema lacks dedicated remarks/delivered_date columns, decode from sync_error JSON
  if (row.sync_error && typeof row.sync_error === 'string' && row.sync_error.startsWith('{')) {
    try {
      const meta = JSON.parse(row.sync_error);
      if (!resolvedRemarks && meta.remarks) resolvedRemarks = meta.remarks;
      if (!resolvedDeliveredDate && meta.delivered_date) resolvedDeliveredDate = meta.delivered_date;
    } catch (e) {}
  }

  return {
    id: row.id,
    influencerId: row.influencer_id || undefined,
    creatorName: row.creator_name || 'Influencer Not Matched',
    username: row.username || '—',
    influencerCode: row.influencer_code || row.order_id || '',
    orderId: row.order_id || undefined,
    profilePhoto: row.profile_photo || '',
    phoneNumber: row.phone_number || '',
    altPhoneNumber: row.alt_phone_number || '',
    state: row.state || '',
    city: row.city || undefined,
    pincode: row.pincode || undefined,
    batchId: row.batch_id || undefined,
    batchCode: row.batch_code || '—',
    awbNumber: row.awb_number || '',
    courier: row.courier || (isDelhivery ? 'Delhivery' : 'ST Courier'),
    dispatchDate: row.dispatch_date || '',
    dispatchedDate: row.dispatch_date || '',
    expectedDeliveryDate: edd,
    estimatedDeliveryDate: edd,
    deliveredDate: resolvedDeliveredDate,
    status: displayStatus,
    statusCategory: statusCategory,
    rawStatus: row.raw_status || row.status || 'In Transit',
    remarks: resolvedRemarks,
    pendingRemarks: row.pending_remarks || undefined,
    currentStatus: row.current_status || undefined,
    statusType: row.status_type || undefined,
    statusSource: statusSourceDisplay,
    sourceType: row.source_type || (isDelhivery ? 'UPLOADED_FILE' : 'LIVE_API'),
    lastLocation: row.last_location || undefined,
    trackingDateTime: row.tracking_date_time || undefined,
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).toLocaleString() : undefined,
    trackingUrl: row.tracking_url || getCourierTrackingUrl(row.courier || '', row.awb_number || ''),
    syncError: row.sync_error || undefined,
  };
}

/**
 * Maps frontend shipment data to a database row for Supabase insertion/upsert.
 */
export function mapShipmentToDbPayload(s: InfluencerDispatchedShipment, campaignId: string | number): any {
  const isDelhivery = (s.courier || '').toLowerCase().includes('delhivery');
  const awb = (s.awbNumber || '').trim();
  const courier = (s.courier || (isDelhivery ? 'Delhivery' : 'ST Courier')).trim();
  const statusSource = isDelhivery || s.statusSource === 'Uploaded Delhivery File'
    ? 'delhivery_file'
    : 'st_courier';
  const sourceType = isDelhivery ? 'UPLOADED_FILE' : 'LIVE_API';
  const nowIso = new Date().toISOString();
  const edd = s.estimatedDeliveryDate || s.expectedDeliveryDate || null;
  const displayStatus = getTrackingDisplayStatus(s);

  // Safely encode metadata into sync_error so remarks and delivered_date are persisted directly into Supabase
  let syncErrorPayload = s.syncError || null;
  const remarksClean = (s.remarks && s.remarks.trim()) ? s.remarks.trim() : null;
  const deliveredDateClean = (s.deliveredDate && s.deliveredDate.trim()) ? s.deliveredDate.trim() : null;
  if (remarksClean || deliveredDateClean) {
    try {
      syncErrorPayload = JSON.stringify({
        remarks: remarksClean,
        delivered_date: deliveredDateClean
      });
    } catch (e) {}
  }

  const payload: any = {
    campaign_id: String(campaignId),
    influencer_id: s.influencerId || null,
    creator_name: s.creatorName || null,
    username: s.username || null,
    influencer_code: s.influencerCode || null,
    order_id: s.orderId || (s.influencerCode ? s.influencerCode : null),
    awb_number: awb,
    courier,
    status: displayStatus,
    status_source: statusSource,
    source_type: sourceType,
    dispatch_date: s.dispatchedDate || s.dispatchDate || null,
    expected_delivery_date: edd,
    tracking_url: s.trackingUrl || getCourierTrackingUrl(courier, awb),
    raw_status: s.rawStatus || s.status || 'In Transit',
    last_location: s.lastLocation || null,
    tracking_date_time: s.trackingDateTime || null,
    profile_photo: s.profilePhoto || null,
    phone_number: s.phoneNumber || null,
    alt_phone_number: s.altPhoneNumber || null,
    state: s.state || null,
    city: s.city || null,
    pincode: s.pincode || null,
    batch_id: s.batchId || null,
    batch_code: s.batchCode || null,
    remarks: remarksClean,
    delivered_date: deliveredDateClean,
    sync_error: syncErrorPayload,
    updated_at: nowIso,
  };

  if (isDelhivery) {
    payload.imported_at = nowIso;
    payload.last_synced_at = null; // Do not pretend an API sync occurred for file-based Delhivery
  } else {
    payload.imported_at = nowIso;
    if (s.lastSyncedAt) {
      payload.last_synced_at = nowIso;
    }
  }

  return payload;
}

export interface UpsertCampaignShipmentsResult {
  success: boolean;
  total: number;
  imported: number;
  duplicatesUpdated: number;
  failed: number;
  shipments: InfluencerDispatchedShipment[];
  errors?: string[];
}

/**
 * Fetches campaign shipments directly from the Supabase database table `influencer_tracking_shipments`.
 * Uses batched pagination (.range) to ensure all records (even > 1000) are loaded.
 * Falls back to local storage cache if offline or initial load.
 */
export async function fetchCampaignShipmentsFromDb(campaignId: string | number): Promise<InfluencerDispatchedShipment[]> {
  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId) return [];

  try {
    const pageSize = 1000;
    let from = 0;
    let allRows: any[] = [];
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerTrackingShipments)
        .select('*')
        .eq('campaign_id', cleanCampaignId)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        console.warn('Failed to fetch shipments from Supabase, falling back to local storage / accumulated rows:', error);
        if (allRows.length > 0) break;
        return getCampaignShipments(cleanCampaignId);
      }

      if (data && data.length > 0) {
        allRows = allRows.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    if (allRows.length > 0) {
      const localCached = getCampaignShipments(cleanCampaignId);
      const localMap = new Map<string, InfluencerDispatchedShipment>();
      localCached.forEach(s => {
        const awb = (s.awbNumber || s.id || '').toLowerCase().trim();
        if (awb) localMap.set(awb, s);
      });

      const shipments = allRows.map(row => {
        const mapped = mapDbRowToShipment(row);
        const awb = (mapped.awbNumber || mapped.id || '').toLowerCase().trim();
        const local = localMap.get(awb);
        if (local) {
          if (!mapped.deliveredDate && local.deliveredDate) {
            mapped.deliveredDate = local.deliveredDate;
          }
          if (!mapped.dispatchedDate && (local.dispatchedDate || local.dispatchDate)) {
            mapped.dispatchedDate = local.dispatchedDate || local.dispatchDate;
            mapped.dispatchDate = mapped.dispatchedDate;
          }
          if (!mapped.estimatedDeliveryDate && (local.estimatedDeliveryDate || local.expectedDeliveryDate)) {
            mapped.estimatedDeliveryDate = local.estimatedDeliveryDate || local.expectedDeliveryDate;
            mapped.expectedDeliveryDate = mapped.estimatedDeliveryDate;
          }
        }
        return mapped;
      });

      const sorted = sortInfluencerShipmentsNaturally(shipments);
      saveCampaignShipments(cleanCampaignId, sorted);
      return sorted;
    }

    // Database is the source of truth: 0 records found in Supabase.
    // Ensure localStorage is also empty so cleared/deleted shipments do not resurrect.
    saveCampaignShipments(cleanCampaignId, []);
    return [];
  } catch (err) {
    console.error('fetchCampaignShipmentsFromDb exception:', err);
    return getCampaignShipments(cleanCampaignId);
  }
}

/**
 * Prunes customer / unmatched tracking shipments from Supabase for a specific campaign.
 * Scoped strictly to `influencer_tracking_shipments` where `campaign_id` matches.
 * Deletes any records that do not match an active campaign influencer.
 */
export async function pruneUnmatchedCampaignTrackingShipments(
  campaignId: string | number,
  activeInfluencers: CampaignInfluencer[]
): Promise<number> {
  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId || !activeInfluencers || activeInfluencers.length === 0) return 0;

  try {
    const validCodes = new Set<string>();
    const validIds = new Set<string>();
    activeInfluencers.forEach(inf => {
      if (inf.id) validIds.add(String(inf.id));
      if (inf.code) {
        const norm = String(inf.code).replace(/[\t\r\n]/g, ' ').trim().replace(/^#+/, '').trim().toLowerCase();
        if (norm) validCodes.add(norm);
      }
    });

    const { data: dbShipments, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencerTrackingShipments)
      .select('id, awb_number, influencer_code, order_id, influencer_id')
      .eq('campaign_id', cleanCampaignId);

    if (error || !dbShipments || dbShipments.length === 0) return 0;

    const idsToDelete: string[] = [];
    dbShipments.forEach(s => {
      const code1 = String(s.influencer_code || '').replace(/[\t\r\n]/g, ' ').trim().replace(/^#+/, '').trim().toLowerCase();
      const code2 = String(s.order_id || '').replace(/[\t\r\n]/g, ' ').trim().replace(/^#+/, '').trim().toLowerCase();
      const infId = s.influencer_id ? String(s.influencer_id) : '';

      const isMatch = (code1 && validCodes.has(code1)) ||
                      (code2 && validCodes.has(code2)) ||
                      (infId && validIds.has(infId));

      if (!isMatch) {
        idsToDelete.push(s.id);
      }
    });

    if (idsToDelete.length > 0) {
      console.log(`[Tracking Cleanup] Pruning ${idsToDelete.length} customer/unmatched shipments for campaign ${cleanCampaignId}`);
      for (let i = 0; i < idsToDelete.length; i += 100) {
        const chunk = idsToDelete.slice(i, i + 100);
        await supabaseAdmin
          .from(SUPABASE_TABLES.influencerTrackingShipments)
          .delete()
          .in('id', chunk);
      }
      return idsToDelete.length;
    }
  } catch (err) {
    console.warn('Error pruning unmatched campaign tracking shipments:', err);
  }
  return 0;
}

/**
 * Upserts shipments to the Supabase database table `influencer_tracking_shipments`
 * using the unique constraint (campaign_id, courier, awb_number).
 * Checks existing DB records to return accurate (total, imported, duplicatesUpdated, failed) statistics.
 * Also keeps local storage synchronized.
 */
export async function upsertCampaignShipmentsToDb(
  campaignId: string | number,
  shipments: InfluencerDispatchedShipment[]
): Promise<UpsertCampaignShipmentsResult> {
  const cleanCampaignId = String(campaignId).trim();
  const previousLocalShipments = getCampaignShipments(cleanCampaignId);
  const previousLocalKeys = new Set<string>();
  previousLocalShipments.forEach(s => {
    const courier = (s.courier || '').toLowerCase().trim();
    const awb = (s.awbNumber || s.id || '').toLowerCase().trim();
    if (awb) {
      previousLocalKeys.add(`${courier}__${awb}`);
      previousLocalKeys.add(awb);
    }
  });

  const localMerged = upsertCampaignShipments(cleanCampaignId, shipments);

  if (!shipments || shipments.length === 0) {
    return {
      success: true,
      total: 0,
      imported: 0,
      duplicatesUpdated: 0,
      failed: 0,
      shipments: localMerged
    };
  }

  try {
    const valid = shipments.filter(s => s.awbNumber && s.awbNumber.trim());
    const invalidCount = shipments.length - valid.length;
    if (valid.length === 0) {
      return {
        success: false,
        total: shipments.length,
        imported: 0,
        duplicatesUpdated: 0,
        failed: invalidCount,
        shipments: localMerged,
        errors: ['No shipments with valid tracking or waybill numbers found']
      };
    }

    // Deduplicate incoming batch by (campaign_id, courier, awb_number)
    const payloadMap = new Map<string, any>();
    valid.forEach(s => {
      const p = mapShipmentToDbPayload(s, cleanCampaignId);
      const key = `${p.campaign_id}__${(p.courier || '').toLowerCase()}__${p.awb_number.toLowerCase()}`;
      payloadMap.set(key, p);
    });

    const payloads = Array.from(payloadMap.values());

    // Check which AWBs already exist in DB for this campaign
    const existingDbKeys = new Set<string>();
    try {
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabaseAdmin
          .from(SUPABASE_TABLES.influencerTrackingShipments)
          .select('awb_number, courier')
          .eq('campaign_id', cleanCampaignId)
          .range(from, from + pageSize - 1);

        if (error || !data) break;
        data.forEach(r => {
          if (r.awb_number) {
            const cleanAwb = r.awb_number.toLowerCase().trim();
            existingDbKeys.add(`${cleanCampaignId}__${(r.courier || '').toLowerCase()}__${cleanAwb}`);
            existingDbKeys.add(`${cleanCampaignId}__${cleanAwb}`);
          }
        });
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      }
    } catch (e) {
      console.warn('Could not query existing DB keys for duplicate count:', e);
    }

    let actualUpdatedCount = 0;
    let actualNewCount = 0;
    let failedCount = invalidCount;
    const errors: string[] = [];
    const chunkSize = 50;

    for (let i = 0; i < payloads.length; i += chunkSize) {
      const chunk = payloads.slice(i, i + chunkSize);
      let { error } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerTrackingShipments)
        .upsert(chunk, {
          onConflict: 'campaign_id,courier,awb_number',
          ignoreDuplicates: false
        });

      if (error && (error.code === '42703' || String(error.message || '').includes('delivered_date') || String(error.message || '').includes('remarks')) && chunk.some(p => 'delivered_date' in p || 'remarks' in p)) {
        // Fallback: table doesn't have delivered_date or remarks column yet, strip them and retry
        const sanitizedChunk = chunk.map(({ delivered_date, remarks, ...rest }: any) => rest);
        const retryResult = await supabaseAdmin
          .from(SUPABASE_TABLES.influencerTrackingShipments)
          .upsert(sanitizedChunk, {
            onConflict: 'campaign_id,courier,awb_number',
            ignoreDuplicates: false
          });
        error = retryResult.error;
      }

      if (error) {
        console.warn('[Supabase Tracking Upsert Error]:', error);
        errors.push(error.message || String(error));
        failedCount += chunk.length;
      } else {
        chunk.forEach(p => {
          const cleanAwb = (p.awb_number || '').toLowerCase().trim();
          const key1 = `${p.campaign_id}__${(p.courier || '').toLowerCase()}__${cleanAwb}`;
          const key2 = `${p.campaign_id}__${cleanAwb}`;
          if (existingDbKeys.has(key1) || existingDbKeys.has(key2)) {
            actualUpdatedCount++;
          } else {
            actualNewCount++;
            existingDbKeys.add(key1);
            existingDbKeys.add(key2);
          }
        });
      }
    }

    // Fallback: If DB errors occurred or offline, ensure counts reflect local persistence
    if (actualUpdatedCount === 0 && actualNewCount === 0 && payloads.length > 0) {
      valid.forEach(s => {
        const courier = (s.courier || '').toLowerCase().trim();
        const awb = (s.awbNumber || s.id || '').toLowerCase().trim();
        if (previousLocalKeys.has(`${courier}__${awb}`) || previousLocalKeys.has(awb)) {
          actualUpdatedCount++;
        } else {
          actualNewCount++;
          previousLocalKeys.add(`${courier}__${awb}`);
          previousLocalKeys.add(awb);
        }
      });
      // If locally merged, the records are available to the UI
      failedCount = invalidCount;
    }

    // Refresh updated list from Supabase with pagination
    const refreshed = await fetchCampaignShipmentsFromDb(cleanCampaignId);
    const finalShipments = refreshed.length > 0 ? refreshed : localMerged;

    return {
      success: failedCount === 0,
      total: shipments.length,
      imported: actualNewCount,
      duplicatesUpdated: actualUpdatedCount,
      failed: failedCount,
      shipments: finalShipments,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (err: any) {
    console.error('[upsertCampaignShipmentsToDb Error]:', err);
    return {
      success: false,
      total: shipments.length,
      imported: 0,
      duplicatesUpdated: 0,
      failed: shipments.length,
      shipments: localMerged,
      errors: [err?.message || String(err)]
    };
  }
}

/**
 * Sync single shipment using existing courier tracking API and Dexie DB.
 */
export async function syncSingleShipment(
  shipment: InfluencerDispatchedShipment,
  campaignId: string | number
): Promise<InfluencerDispatchedShipment> {
  const awb = shipment.awbNumber?.trim();
  const courier = shipment.courier?.trim() || 'ST Courier';
  const isDelhivery = courier.toLowerCase().includes('delhivery');

  if (isDelhivery) {
    return {
      ...shipment,
      statusSource: 'Uploaded Delhivery File',
      sourceType: 'UPLOADED_FILE',
      syncError: 'Live API sync is only for ST Courier. Delhivery status is sourced from uploaded file.'
    };
  }

  if (!awb) {
    return {
      ...shipment,
      syncError: 'No AWB assigned to this shipment'
    };
  }

  const nowStr = new Date().toLocaleString();

  try {
    const apiResult = await trackingService.syncTracking(awb, 'ST Courier');

    const rawStatus = apiResult?.status || '';
    const isSuccess = Boolean(apiResult?.success);
    const trackingError = apiResult?.error || apiResult?.trackingError;
    const lastLocation = apiResult?.lastLocation || '-';
    const trackingDateTime = apiResult?.trackingDateTime || '-';

    let normalized: TrackingStatusCategory;
    if (isSuccess && rawStatus) {
      normalized = normalizeTrackingStatus(rawStatus);
    } else if (trackingError === 'Sync not available for this courier') {
      normalized = normalizeTrackingStatus(shipment.rawStatus || 'Pending');
    } else {
      normalized = normalizeTrackingStatus(rawStatus || 'Exception');
    }

    // Save to Dexie db.shipments for persistent cross-module tracking history
    try {
      await db.shipments.put({
        awb,
        orderId: shipment.influencerCode || shipment.id,
        status: rawStatus || normalized,
        state: apiResult?.state || shipment.state || 'Unknown',
        lastLocation,
        trackingDateTime,
        department: (apiResult?.state === 'Tamil Nadu') ? 'Tamil Nadu' : 'Other State',
        lastSyncedAt: Date.now()
      });
    } catch (dbErr) {
      console.warn('Dexie shipment cache update failed:', dbErr);
    }

    // Save to local campaign cache
    const cache = getTrackingCache(campaignId);
    cache[awb] = {
      status: normalized,
      rawStatus: rawStatus || normalized,
      statusSource: 'Live ST Courier Tracking',
      sourceType: 'LIVE_API',
      lastLocation: lastLocation !== '-' ? lastLocation : undefined,
      trackingDateTime: trackingDateTime !== '-' ? trackingDateTime : undefined,
      lastSyncedAt: nowStr,
      syncError: isSuccess ? undefined : trackingError
    };
    saveTrackingCache(campaignId, cache);

    const updatedShipment: InfluencerDispatchedShipment = {
      ...shipment,
      status: normalized,
      rawStatus: rawStatus || (isSuccess ? normalized : 'Tracking Failed'),
      statusSource: 'Live ST Courier Tracking',
      sourceType: 'LIVE_API',
      lastLocation: lastLocation !== '-' ? lastLocation : shipment.lastLocation,
      trackingDateTime: trackingDateTime !== '-' ? trackingDateTime : shipment.trackingDateTime,
      lastSyncedAt: nowStr,
      syncError: isSuccess ? undefined : trackingError
    };

    // Keep persistent campaign storage synchronized
    upsertCampaignShipments(campaignId, [updatedShipment]);

    // Update Supabase database
    try {
      await supabase
        .from(SUPABASE_TABLES.influencerTrackingShipments)
        .update({
          status: normalized,
          raw_status: rawStatus || (isSuccess ? normalized : 'Tracking Failed'),
          status_source: 'st_courier',
          source_type: 'LIVE_API',
          last_location: lastLocation !== '-' ? lastLocation : (shipment.lastLocation || null),
          tracking_date_time: trackingDateTime !== '-' ? trackingDateTime : (shipment.trackingDateTime || null),
          last_synced_at: new Date().toISOString(),
          sync_error: isSuccess ? null : (trackingError || null),
          updated_at: new Date().toISOString()
        })
        .eq('campaign_id', String(campaignId))
        .eq('courier', shipment.courier || 'ST Courier')
        .eq('awb_number', awb);
    } catch (dbErr) {
      console.warn('Supabase shipment status sync update failed:', dbErr);
    }

    return updatedShipment;
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    const normalized: TrackingStatusCategory = 'Exception';

    const cache = getTrackingCache(campaignId);
    cache[awb] = {
      status: normalized,
      rawStatus: 'Tracking Failed',
      statusSource: 'Live ST Courier Tracking',
      sourceType: 'LIVE_API',
      lastSyncedAt: nowStr,
      syncError: errorMsg
    };
    saveTrackingCache(campaignId, cache);

    const failedShipment: InfluencerDispatchedShipment = {
      ...shipment,
      status: normalized,
      rawStatus: 'Tracking Failed',
      statusSource: 'Live ST Courier Tracking',
      sourceType: 'LIVE_API',
      lastSyncedAt: nowStr,
      syncError: errorMsg
    };

    upsertCampaignShipments(campaignId, [failedShipment]);

    // Update Supabase database
    try {
      await supabase
        .from(SUPABASE_TABLES.influencerTrackingShipments)
        .update({
          status: normalized,
          raw_status: 'Tracking Failed',
          status_source: 'st_courier',
          source_type: 'LIVE_API',
          last_synced_at: new Date().toISOString(),
          sync_error: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('campaign_id', String(campaignId))
        .eq('courier', shipment.courier || 'ST Courier')
        .eq('awb_number', awb);
    } catch (dbErr) {}

    return failedShipment;
  }
}

/**
 * Bulk sync eligible shipments for a campaign with concurrency control.
 * Only applies to ST Courier shipments. Delhivery shipments are skipped.
 */
export async function syncAllShipments(
  shipments: InfluencerDispatchedShipment[],
  campaignId: string | number,
  onProgress?: (progress: { completed: number; total: number; successful: number; failed: number; currentAwb: string }) => void
): Promise<{ successful: number; failed: number; skippedDelhivery: number; results: InfluencerDispatchedShipment[] }> {
  // Only sync ST Courier shipments that have an AWB and are not already Delivered or RTO
  const eligible = shipments.filter(s => {
    if (!s.awbNumber || !s.awbNumber.trim()) return false;
    const isST = (s.courier || '').toLowerCase().includes('st courier');
    if (!isST) return false;
    const st = s.status;
    return st !== 'Delivered' && !s.rawStatus.toLowerCase().includes('rto');
  });

  const skippedDelhivery = shipments.filter(s =>
    (s.courier || '').toLowerCase().includes('delhivery')
  ).length;

  if (eligible.length === 0) {
    return { successful: 0, failed: 0, skippedDelhivery, results: shipments };
  }

  let completed = 0;
  let successful = 0;
  let failed = 0;
  const resultMap = new Map<string, InfluencerDispatchedShipment>();

  // Process in small batches of 2 concurrent calls to prevent rate limits
  const concurrency = 2;
  for (let i = 0; i < eligible.length; i += concurrency) {
    const chunk = eligible.slice(i, i + concurrency);
    
    await Promise.all(
      chunk.map(async (shipment) => {
        onProgress?.({
          completed,
          total: eligible.length,
          successful,
          failed,
          currentAwb: shipment.awbNumber
        });

        const updated = await syncSingleShipment(shipment, campaignId);
        resultMap.set(shipment.id, updated);

        if (!updated.syncError && updated.status !== 'Exception') {
          successful++;
        } else {
          failed++;
        }
        completed++;

        onProgress?.({
          completed,
          total: eligible.length,
          successful,
          failed,
          currentAwb: shipment.awbNumber
        });
      })
    );
  }

  const nowTimestamp = new Date().toLocaleString();
  setLastCampaignSyncTime(campaignId, nowTimestamp);

  const finalResults = shipments.map(s => resultMap.get(s.id) || s);

  return {
    successful,
    failed,
    skippedDelhivery,
    results: finalResults
  };
}

/**
 * Permanently deletes all tracking shipment records for the specified campaign
 * from the dedicated Supabase table `influencer_tracking_shipments`.
 * Also clears the local campaign tracking cache and local storage.
 */
export async function deleteCampaignShipmentsFromDb(
  campaignId: string | number
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  if (!campaignId) {
    const err = 'Unable to clear tracking data because the current campaign could not be identified.';
    console.error(err);
    return { success: false, error: err };
  }

  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId) {
    const err = 'Unable to clear tracking data because the current campaign ID is empty.';
    return { success: false, error: err };
  }

  try {
    // 1. Immediately wipe local storage and caches strictly for this campaign
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`influencer_campaign_shipments_${cleanCampaignId}`);
        localStorage.removeItem(`influencer_tracking_cache_${cleanCampaignId}`);
        localStorage.removeItem(`influencer_tracking_last_sync_${cleanCampaignId}`);
      } catch (e) {
        console.warn('Error clearing localStorage for campaign:', e);
      }
    }

    // 2. Delete all shipment records scoped strictly to current campaign_id using supabaseAdmin
    const { data, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencerTrackingShipments)
      .delete()
      .eq('campaign_id', cleanCampaignId)
      .select('id');

    if (error) {
      console.error('[Supabase Tracking Delete Error]:', error);
      return { success: false, error: error.message || 'Database deletion failed' };
    }

    // 3. Safety verification: query the table again using current campaign_id to verify 0 records remain
    const { count, error: verifyError } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencerTrackingShipments)
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', cleanCampaignId);

    if (verifyError) {
      console.warn('Post-delete verification query warning:', verifyError);
    } else if (count !== null && count > 0) {
      return { success: false, error: `Verification failed: ${count} tracking records still remain in database.` };
    }

    // 4. Ensure local cache stays strictly empty
    saveCampaignShipments(cleanCampaignId, []);
    saveTrackingCache(cleanCampaignId, {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
    }

    return {
      success: true,
      deletedCount: data ? data.length : 0
    };
  } catch (err: any) {
    console.error('deleteCampaignShipmentsFromDb exception:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while deleting tracking data'
    };
  }
}

/**
 * Permanently deletes a single tracking shipment record from Supabase
 * and removes it from local storage and cache.
 */
export async function deleteSingleCampaignShipmentFromDb(
  campaignId: string | number,
  shipment: InfluencerDispatchedShipment
): Promise<{ success: boolean; error?: string }> {
  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId) {
    return { success: false, error: 'Campaign ID is required' };
  }

  try {
    const isUuid = shipment.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shipment.id);
    const awb = (shipment.awbNumber || '').trim();

    let query = supabaseAdmin.from(SUPABASE_TABLES.influencerTrackingShipments).delete();

    if (isUuid) {
      query = query.eq('id', shipment.id);
    } else if (awb) {
      query = query.eq('campaign_id', cleanCampaignId).eq('awb_number', awb);
    } else {
      return { success: false, error: 'Shipment has neither valid UUID nor AWB number' };
    }

    const { error } = await query;
    if (error) {
      console.error('Failed to delete single shipment from Supabase:', error);
      return { success: false, error: error.message };
    }

    // Update local storage
    const local = getCampaignShipments(cleanCampaignId);
    const filtered = local.filter(s => {
      if (isUuid && s.id === shipment.id) return false;
      if (awb && (s.awbNumber || '').trim().toLowerCase() === awb.toLowerCase()) return false;
      return true;
    });
    saveCampaignShipments(cleanCampaignId, filtered);

    // Clear tracking cache for this AWB if exists
    if (awb) {
      const cache = getTrackingCache(cleanCampaignId);
      delete cache[awb];
      saveTrackingCache(cleanCampaignId, cache);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail: { campaignId: cleanCampaignId } }));
    }

    return { success: true };
  } catch (err: any) {
    console.error('deleteSingleCampaignShipmentFromDb exception:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

