import db from '../lib/db';
import { trackingService } from './trackingService';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignInfluencer } from '../types';
import { parseToYMD, formatDisplayDateLocal, getTodayLocalYMD } from '../utils/influencerDateUtils';
import { normalizeOrderId, formatDisplayOrderId, getOriginalOrderId } from '../utils/orderIdUtils';
import { isActiveStatus } from '../utils/marketingUtils';
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
  getTodayLocalYMD,
  normalizeOrderId,
  formatDisplayOrderId
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
  | 'Expired'
  | 'Re-Dispatch';

export interface InfluencerDispatchedShipment {
  id: string; // Dispatch record id, awb, or unique id
  influencerId?: string;
  creatorName: string;
  username: string;
  influencerCode: string;
  orderId?: string;
  rawOrderId?: string;
  baseOrderId?: string;
  isResend?: boolean;
  attemptNumber?: number;
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

  // 1. Delivered (check not undelivered)
  if (s.includes('delivered') && !s.includes('undelivered')) {
    return 'Delivered';
  }
  // 2. Out for Delivery
  if (s.includes('out for delivery') || s.includes('out_for_delivery')) {
    return 'Out for Delivery';
  }
  // 3. Failed Attempt
  if (
    s.includes('attempt') ||
    s.includes('failed') ||
    s.includes('undelivered') ||
    s.includes('refused') ||
    s.includes('door locked') ||
    s.includes('delivery attempted')
  ) {
    return 'Failed Attempt';
  }
  // 4. In Transit
  if (
    s.includes('in transit') ||
    s.includes('transit') ||
    s.includes('vehicle departed') ||
    s.includes('departed') ||
    s.includes('forwarded') ||
    s.includes('arrived') ||
    s.includes('hub') ||
    s.includes('dispatched') ||
    s.includes('shipped')
  ) {
    return 'In Transit';
  }
  // 5. Info Received
  if (s.includes('info received') || s.includes('shipment created') || s.includes('booked') || s.includes('consignment booked') || s.includes('manifest')) {
    return 'Info Received';
  }
  // 6. Exception
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
  // 7. Expired
  if (s.includes('expired')) {
    return 'Expired';
  }

  return 'Pending';
}

/**
 * Normalizes courier names case-insensitively and handles whitespace differences.
 * Resolves variations of "Delhivery" and "ST Courier", classifying others as "Other" or null if empty.
 */
export function normalizeCourierName(courierRaw?: string | null): 'Delhivery' | 'ST Courier' | 'Other' | null {
  if (!courierRaw) return null;
  const cleaned = courierRaw.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!cleaned) return null;
  if (cleaned.includes('delhivery')) {
    return 'Delhivery';
  }
  if (
    cleaned === 'st' ||
    cleaned.startsWith('st ') ||
    cleaned.includes('st courier') ||
    cleaned.includes('st-courier') ||
    cleaned.includes('st_courier') ||
    cleaned.includes('stcourier')
  ) {
    return 'ST Courier';
  }
  return 'Other';
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

/**
 * Formats a date/time string or Date into standard sync timestamp:
 * e.g. "24 Sep 2026, 09:38 AM" in local timezone.
 */
export function formatSyncTimestamp(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = String(hours).padStart(2, '0');

  return `${day} ${month} ${year}, ${hoursStr}:${minutes} ${ampm}`;
}

export function getLastCampaignSyncTime(
  campaignId: string | number,
  shipments?: InfluencerDispatchedShipment[]
): string | null {
  if (typeof window === 'undefined') return null;
  const cleanId = String(campaignId).trim();
  try {
    const cached = localStorage.getItem(`influencer_tracking_last_sync_${cleanId}`);
    if (cached && cached.trim()) return cached.trim();

    // Inspect shipments in memory or database for maximum last_synced_at
    if (shipments && shipments.length > 0) {
      let maxIso: string | null = null;
      shipments.forEach(s => {
        const syncAt = (s as any).last_synced_at || (s as any).lastSyncedAt;
        if (syncAt) {
          const parsed = new Date(syncAt);
          if (!isNaN(parsed.getTime())) {
            const iso = parsed.toISOString();
            if (!maxIso || iso > maxIso) maxIso = iso;
          }
        }
      });
      if (maxIso) {
        const formatted = formatSyncTimestamp(maxIso);
        localStorage.setItem(`influencer_tracking_last_sync_${cleanId}`, formatted);
        return formatted;
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

export function setLastCampaignSyncTime(campaignId: string | number, timestamp: string) {
  if (typeof window === 'undefined') return;
  const cleanId = String(campaignId).trim();
  try {
    localStorage.setItem(`influencer_tracking_last_sync_${cleanId}`, timestamp);
  } catch (e) {}
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
    const code = (s.influencerCode || s.orderId || '').replace(/^#?R[\s#_\-]+/i, '').replace(/^#+/, '').replace(/^R+/i, '').trim();
    if (code && /^\d+$/.test(code)) return;
    const courier = (s.courier || '').toLowerCase().trim();
    const awb = (s.awbNumber || s.id || '').toLowerCase().trim();
    const key = `${courier}__${awb}`;
    if (awb) {
      shipmentMap.set(key, s);
      shipmentMap.set(awb, s);
    }
  });

  newShipments.forEach(s => {
    const code = (s.influencerCode || s.orderId || '').replace(/^#?R[\s#_\-]+/i, '').replace(/^#+/, '').replace(/^R+/i, '').trim();
    if (code && /^\d+$/.test(code)) return;
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
  let resolvedRawOrderId: string | undefined = undefined;
  let resolvedBaseOrderId: string | undefined = undefined;
  let resolvedIsResend: boolean | undefined = undefined;
  let resolvedAttemptNumber: number | undefined = undefined;

  // If Supabase schema lacks dedicated remarks/delivered_date columns, decode from sync_error JSON
  if (row.sync_error && typeof row.sync_error === 'string' && row.sync_error.startsWith('{')) {
    try {
      const meta = JSON.parse(row.sync_error);
      if (!resolvedRemarks && meta.remarks) resolvedRemarks = meta.remarks;
      if (!resolvedDeliveredDate && meta.delivered_date) resolvedDeliveredDate = meta.delivered_date;
      if (meta.raw_order_id) resolvedRawOrderId = meta.raw_order_id;
      if (meta.base_order_id) resolvedBaseOrderId = meta.base_order_id;
      if (meta.is_resend !== undefined) resolvedIsResend = Boolean(meta.is_resend);
      if (meta.attempt_number !== undefined) resolvedAttemptNumber = Number(meta.attempt_number);
    } catch (e) {}
  }

  // Derive normalized fields if not explicitly stored in sync_error
  const fallbackRef = resolvedRawOrderId || row.order_id || row.influencer_code;
  if (fallbackRef) {
    const norm = normalizeOrderId(fallbackRef);
    if (!resolvedBaseOrderId) resolvedBaseOrderId = norm.baseCode || undefined;
    if (resolvedIsResend === undefined && norm.isResend) resolvedIsResend = true;
    if (resolvedAttemptNumber === undefined && norm.attemptNumber > 1) resolvedAttemptNumber = norm.attemptNumber;
  }

  return {
    id: row.id,
    influencerId: row.influencer_id || undefined,
    creatorName: row.creator_name || 'Influencer Not Matched',
    username: row.username || '—',
    influencerCode: row.influencer_code || row.order_id || '',
    orderId: row.order_id || undefined,
    rawOrderId: resolvedRawOrderId || row.order_id || undefined,
    baseOrderId: resolvedBaseOrderId || undefined,
    isResend: resolvedIsResend,
    attemptNumber: resolvedAttemptNumber,
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
    rawStatus: row.raw_status || row.status || 'Pending',
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

  // Safely encode metadata into sync_error so remarks, delivered_date, and resend info are persisted directly into Supabase
  let metaObj: any = {};
  if (s.syncError && typeof s.syncError === 'string' && s.syncError.startsWith('{')) {
    try {
      metaObj = JSON.parse(s.syncError);
    } catch (e) {}
  }
  const remarksClean = (s.remarks && s.remarks.trim()) ? s.remarks.trim() : null;
  const deliveredDateClean = (s.deliveredDate && s.deliveredDate.trim()) ? s.deliveredDate.trim() : null;
  if (remarksClean) metaObj.remarks = remarksClean;
  if (deliveredDateClean) metaObj.delivered_date = deliveredDateClean;
  if (s.rawOrderId) metaObj.raw_order_id = s.rawOrderId;
  if (s.baseOrderId) metaObj.base_order_id = s.baseOrderId;
  if (s.isResend !== undefined) metaObj.is_resend = s.isResend;
  if (s.attemptNumber !== undefined) metaObj.attempt_number = s.attemptNumber;

  let syncErrorPayload = Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj) : (s.syncError || null);

  const payload: any = {
    campaign_id: String(campaignId),
    influencer_id: s.influencerId || null,
    creator_name: s.creatorName || null,
    username: s.username || null,
    influencer_code: s.influencerCode || null,
    order_id: s.orderId || s.rawOrderId || (s.influencerCode ? s.influencerCode : null),
    awb_number: awb,
    courier,
    status: displayStatus,
    status_source: statusSource,
    source_type: sourceType,
    dispatch_date: s.dispatchedDate || s.dispatchDate || null,
    expected_delivery_date: edd,
    tracking_url: s.trackingUrl || getCourierTrackingUrl(courier, awb),
    raw_status: s.rawStatus || s.status || 'Pending',
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

      // Sanitize: filter out any customer orders (purely numeric references like #10065, #00317)
      const validShipments = shipments.filter(s => {
        const ref = (s.influencerCode || s.orderId || '').trim();
        const base = ref.replace(/^#?R[\s#_\-]+/i, '').replace(/^#+/, '').replace(/^R+/i, '').trim();
        if (!base || /^\d+$/.test(base)) {
          return false;
        }
        return true;
      });

      const sorted = sortInfluencerShipmentsNaturally(validShipments);
      saveCampaignShipments(cleanCampaignId, sorted);

      // Restore last sync timestamp from most recently synced DB record
      let maxSyncIso: string | null = null;
      allRows.forEach(row => {
        const syncAt = row.last_synced_at || row.lastSyncedAt;
        if (syncAt) {
          const parsed = new Date(syncAt);
          if (!isNaN(parsed.getTime())) {
            const iso = parsed.toISOString();
            if (!maxSyncIso || iso > maxSyncIso) maxSyncIso = iso;
          }
        }
      });
      if (maxSyncIso) {
        setLastCampaignSyncTime(cleanCampaignId, formatSyncTimestamp(maxSyncIso));
      }

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
  activeInfluencers?: CampaignInfluencer[]
): Promise<number> {
  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId) return 0;

  try {
    let influencersList = activeInfluencers;
    if (!influencersList || influencersList.length === 0) {
      const { data: dbInfs } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencersInfo)
        .select('*')
        .eq('campaign_id', cleanCampaignId);
      if (dbInfs && dbInfs.length > 0) {
        influencersList = dbInfs.filter(i => isActiveStatus(i.is_archived)) as any[];
      }
    }

    if (!influencersList || influencersList.length === 0) return 0;

    const validCodes = new Set<string>();
    const validIds = new Set<string>();
    influencersList.forEach(inf => {
      if (inf.id) validIds.add(String(inf.id));
      if (inf.code) {
        const norm = String(inf.code).replace(/[\t\r\n]/g, ' ').trim().replace(/^#+/, '').trim().toUpperCase();
        if (norm) validCodes.add(norm);
      }
    });

    const idsToDelete: string[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: dbShipments, error } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerTrackingShipments)
        .select('id, awb_number, influencer_code, order_id, influencer_id')
        .eq('campaign_id', cleanCampaignId)
        .range(from, from + pageSize - 1);

      if (error || !dbShipments || dbShipments.length === 0) break;

      dbShipments.forEach(s => {
        const infCodeRaw = String(s.influencer_code || '').trim();
        const orderIdRaw = String(s.order_id || '').trim();
        const code1 = getOriginalOrderId(infCodeRaw, validCodes);
        const code2 = getOriginalOrderId(orderIdRaw, validCodes);
        const infId = s.influencer_id ? String(s.influencer_id) : '';

        const isMatch = (code1 && validCodes.has(code1)) ||
                        (code2 && validCodes.has(code2)) ||
                        (infId && validIds.has(infId));

        const isNumeric = /^\d+$/.test(code1 || code2);

        if (!isMatch || isNumeric) {
          idsToDelete.push(s.id);
        }
      });

      if (dbShipments.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    }

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

    // Gatekeeper: filter incoming shipments to ensure only legitimate influencer shipments are written to DB
    const validCodesSet = new Set<string>();
    const validIdsSet = new Set<string>();
    try {
      const { data: dbInfs } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencersInfo)
        .select('id, code, is_archived')
        .eq('campaign_id', cleanCampaignId);
      if (dbInfs && dbInfs.length > 0) {
        dbInfs.forEach(inf => {
          if (isActiveStatus(inf.is_archived)) {
            if (inf.id) validIdsSet.add(String(inf.id));
            if (inf.code) {
              const c = String(inf.code).replace(/[\t\r\n]/g, ' ').trim().replace(/^#+/, '').trim().toUpperCase();
              if (c) validCodesSet.add(c);
            }
          }
        });
      }
    } catch (e) {
      console.warn('Could not fetch active campaign influencer codes for upsert gatekeeper:', e);
    }

    const strictlyValid = valid.filter(s => {
      const orderIdStr = String(s.orderId || s.rawOrderId || '').trim();
      const codeStr = String(s.influencerCode || '').trim();
      const infId = s.influencerId ? String(s.influencerId) : '';

      const code1 = getOriginalOrderId(orderIdStr, validCodesSet);
      const code2 = getOriginalOrderId(codeStr, validCodesSet);

      if (/^\d+$/.test(code1) || /^\d+$/.test(code2)) {
        return false;
      }

      if (validCodesSet.size > 0) {
        const isMatched = (code1 && validCodesSet.has(code1)) ||
                          (code2 && validCodesSet.has(code2)) ||
                          (infId && validIdsSet.has(infId));
        return Boolean(isMatched);
      }
      return true;
    });

    if (strictlyValid.length === 0) {
      return {
        success: true,
        total: shipments.length,
        imported: 0,
        duplicatesUpdated: 0,
        failed: shipments.length,
        shipments: localMerged,
        errors: ['No valid campaign influencer shipments matched']
      };
    }

    // Deduplicate incoming batch by (campaign_id, courier, awb_number)
    const payloadMap = new Map<string, any>();
    strictlyValid.forEach(s => {
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

export function hasShipmentDataChanged(
  oldShipment: InfluencerDispatchedShipment,
  updated: InfluencerDispatchedShipment
): boolean {
  if (oldShipment.status !== updated.status) return true;
  if ((oldShipment.rawStatus || '').trim().toLowerCase() !== (updated.rawStatus || '').trim().toLowerCase()) return true;
  if ((updated.remarks && updated.remarks.trim()) && updated.remarks.trim() !== (oldShipment.remarks || '').trim()) return true;
  if ((updated.deliveredDate && updated.deliveredDate.trim()) && updated.deliveredDate.trim() !== (oldShipment.deliveredDate || '').trim()) return true;
  if ((updated.dispatchedDate && updated.dispatchedDate.trim()) && updated.dispatchedDate.trim() !== (oldShipment.dispatchedDate || oldShipment.dispatchDate || '').trim()) return true;
  if ((updated.estimatedDeliveryDate && updated.estimatedDeliveryDate.trim()) && updated.estimatedDeliveryDate.trim() !== (oldShipment.estimatedDeliveryDate || '').trim()) return true;
  if ((updated.lastLocation && updated.lastLocation.trim()) && updated.lastLocation.trim() !== (oldShipment.lastLocation || '').trim()) return true;
  return false;
}

/**
 * Sync single shipment using official ST Courier tracking integration.
 * STRICT: Operates ONLY on ST Courier. Delhivery shipments are never touched.
 */
export async function syncSingleShipment(
  shipment: InfluencerDispatchedShipment,
  campaignId: string | number
): Promise<InfluencerDispatchedShipment> {
  const awb = shipment.awbNumber?.trim();
  const courier = shipment.courier?.trim() || 'ST Courier';
  const isST = normalizeCourierName(courier) === 'ST Courier';

  // Strict requirement: Never touch or sync Delhivery shipments
  if (!isST) {
    return shipment;
  }

  if (!awb) {
    return {
      ...shipment,
      syncError: 'No AWB assigned to this shipment'
    };
  }

  const nowIso = new Date().toISOString();
  const nowFormatted = formatSyncTimestamp(nowIso);

  try {
    const apiResult = await trackingService.syncTracking(awb, 'ST Courier');

    const rawStatus = apiResult?.rawStatus || apiResult?.status || '';
    const isSuccess = Boolean(apiResult?.success) && Boolean(rawStatus);
    const trackingError = apiResult?.error || apiResult?.trackingError;
    const lastLocation = apiResult?.lastLocation || '-';
    const trackingDateTime = apiResult?.trackingDateTime || '-';
    const returnedRemarks = apiResult?.remarks;
    const returnedDeliveredDate = apiResult?.deliveryDate;
    const returnedDispatchedDate = apiResult?.dispatchedDate;
    const returnedEdd = apiResult?.estimatedDeliveryDate;

    if (!isSuccess) {
      // Failed AWB handling: Keep existing shipment data intact and mark failed
      const failedShipment: InfluencerDispatchedShipment = {
        ...shipment,
        lastSyncedAt: nowFormatted,
        syncError: trackingError || 'Tracking Not Found / Unreachable'
      };
      upsertCampaignShipments(campaignId, [failedShipment]);

      try {
        let updateQuery = supabaseAdmin
          .from(SUPABASE_TABLES.influencerTrackingShipments)
          .update({
            last_synced_at: nowIso,
            sync_error: trackingError || 'Tracking Not Found / Unreachable',
            updated_at: nowIso
          });
        if (shipment.id && shipment.id.length === 36 && shipment.id.includes('-')) {
          updateQuery = updateQuery.eq('id', shipment.id);
        } else {
          updateQuery = updateQuery.eq('campaign_id', String(campaignId)).eq('awb_number', awb);
        }
        await updateQuery;
      } catch (e) {}

      return failedShipment;
    }

    const normalized = normalizeTrackingStatus(rawStatus);

    // Remarks: Actual latest ST Courier tracking remark/event
    const finalRemarks = (returnedRemarks && String(returnedRemarks).trim())
      ? String(returnedRemarks).trim()
      : (rawStatus || shipment.remarks);

    // Delivered Date: Populate ONLY from actual courier tracking data when delivered
    let finalDeliveredDate = shipment.deliveredDate;
    if (normalized === 'Delivered') {
      if (returnedDeliveredDate && String(returnedDeliveredDate).trim()) {
        finalDeliveredDate = String(returnedDeliveredDate).trim();
      } else if (!finalDeliveredDate && trackingDateTime && trackingDateTime !== '-') {
        finalDeliveredDate = trackingDateTime;
      }
    } else {
      // If not delivered, preserve existing deliveredDate only if previously set, or undefined
      finalDeliveredDate = shipment.deliveredDate || undefined;
    }

    // Dispatched Date: Update from booking date if available, otherwise preserve
    const finalDispatchedDate = (returnedDispatchedDate && String(returnedDispatchedDate).trim())
      ? String(returnedDispatchedDate).trim()
      : (shipment.dispatchedDate || shipment.dispatchDate);

    // Estimated Delivery Date: Preserve existing value
    const finalEdd = (returnedEdd && String(returnedEdd).trim())
      ? String(returnedEdd).trim()
      : (shipment.estimatedDeliveryDate || shipment.expectedDeliveryDate);

    const finalLocation = (lastLocation && lastLocation !== '-')
      ? lastLocation
      : shipment.lastLocation;

    const finalTrackingDateTime = (trackingDateTime && trackingDateTime !== '-')
      ? trackingDateTime
      : shipment.trackingDateTime;

    // Save to Dexie db.shipments for persistent cross-module tracking history
    try {
      await db.shipments.put({
        awb,
        orderId: shipment.influencerCode || shipment.id,
        status: rawStatus || normalized,
        state: apiResult?.state || shipment.state || 'Unknown',
        lastLocation: finalLocation || '-',
        trackingDateTime: finalTrackingDateTime || '-',
        department: (apiResult?.state === 'Tamil Nadu') ? 'Tamil Nadu' : 'Other State',
        lastSyncedAt: Date.now()
      });
    } catch (dbErr) {
      console.warn('Dexie shipment cache update failed:', dbErr);
    }

    const updatedShipment: InfluencerDispatchedShipment = {
      ...shipment,
      status: normalized,
      rawStatus: rawStatus || normalized,
      statusSource: 'Live ST Courier Tracking',
      sourceType: 'LIVE_API',
      remarks: finalRemarks,
      deliveredDate: finalDeliveredDate,
      dispatchedDate: finalDispatchedDate,
      dispatchDate: finalDispatchedDate || shipment.dispatchDate,
      estimatedDeliveryDate: finalEdd,
      expectedDeliveryDate: finalEdd,
      lastLocation: finalLocation,
      trackingDateTime: finalTrackingDateTime,
      lastSyncedAt: nowFormatted,
      syncError: undefined
    };

    // Keep persistent local storage synchronized
    upsertCampaignShipments(campaignId, [updatedShipment]);

    // Update Supabase database
    try {
      const metaObj: any = {};
      if (finalRemarks) metaObj.remarks = finalRemarks;
      if (finalDeliveredDate) metaObj.delivered_date = finalDeliveredDate;
      if (finalDispatchedDate) metaObj.dispatch_date = finalDispatchedDate;
      if (shipment.rawOrderId) metaObj.raw_order_id = shipment.rawOrderId;
      if (shipment.baseOrderId) metaObj.base_order_id = shipment.baseOrderId;
      if (shipment.isResend !== undefined) metaObj.is_resend = shipment.isResend;
      if (shipment.attemptNumber !== undefined) metaObj.attempt_number = shipment.attemptNumber;

      const syncErrorPayload = Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj) : null;

      const updateData: any = {
        status: normalized,
        raw_status: rawStatus,
        status_source: 'st_courier',
        source_type: 'LIVE_API',
        last_location: finalLocation || null,
        tracking_date_time: finalTrackingDateTime || null,
        last_synced_at: nowIso,
        sync_error: syncErrorPayload,
        updated_at: nowIso
      };

      if (finalRemarks) updateData.remarks = finalRemarks;
      if (finalDeliveredDate) updateData.delivered_date = finalDeliveredDate;
      if (finalDispatchedDate) updateData.dispatch_date = finalDispatchedDate;
      if (finalEdd) updateData.expected_delivery_date = finalEdd;

      let updateQuery = supabaseAdmin
        .from(SUPABASE_TABLES.influencerTrackingShipments)
        .update(updateData);

      if (shipment.id && shipment.id.length === 36 && shipment.id.includes('-')) {
        updateQuery = updateQuery.eq('id', shipment.id);
      } else {
        updateQuery = updateQuery.eq('campaign_id', String(campaignId)).eq('awb_number', awb);
      }

      const { error: updateErr } = await updateQuery;
      if (updateErr) {
        console.warn('Supabase shipment status sync update failed:', updateErr);
      }
    } catch (dbErr) {
      console.warn('Supabase shipment status sync update failed:', dbErr);
    }

    return updatedShipment;
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    // Keep existing shipment data intact on error
    const failedShipment: InfluencerDispatchedShipment = {
      ...shipment,
      lastSyncedAt: nowFormatted,
      syncError: errorMsg
    };

    upsertCampaignShipments(campaignId, [failedShipment]);
    return failedShipment;
  }
}

export interface SyncAllShipmentsResult {
  totalChecked: number;
  updatedCount: number;
  unchangedCount: number;
  successful: number;
  failed: number;
  results: InfluencerDispatchedShipment[];
}

/**
 * Bulk sync ST Courier shipments for a campaign with concurrency control.
 * STRICT: Only processes shipments where courier is ST Courier. Delhivery is strictly skipped.
 */
export async function syncAllShipments(
  shipments: InfluencerDispatchedShipment[],
  campaignId: string | number,
  onProgress?: (progress: { completed: number; total: number; successful: number; failed: number; currentAwb: string }) => void
): Promise<SyncAllShipmentsResult> {
  const cleanCampaignId = String(campaignId).trim();
  // Filter ONLY ST Courier shipments that have a valid AWB number
  const eligible = shipments.filter(s => {
    const isST = normalizeCourierName(s.courier) === 'ST Courier';
    const hasAwb = Boolean(s.awbNumber && s.awbNumber.trim());
    return isST && hasAwb;
  });

  if (eligible.length === 0) {
    return {
      totalChecked: 0,
      updatedCount: 0,
      unchangedCount: 0,
      successful: 0,
      failed: 0,
      results: shipments
    };
  }

  let completed = 0;
  let successful = 0;
  let failed = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const resultMap = new Map<string, InfluencerDispatchedShipment>();

  // Process in concurrent batches of 4
  const concurrency = 4;
  for (let i = 0; i < eligible.length; i += concurrency) {
    const chunk = eligible.slice(i, i + concurrency);
    
    await Promise.all(
      chunk.map(async (shipment) => {
        onProgress?.({
          completed,
          total: eligible.length,
          successful,
          failed,
          currentAwb: shipment.awbNumber || ''
        });

        const updated = await syncSingleShipment(shipment, cleanCampaignId);
        resultMap.set(shipment.id, updated);

        const isFailed = Boolean(updated.syncError);
        if (isFailed) {
          failed++;
        } else {
          successful++;
          if (hasShipmentDataChanged(shipment, updated)) {
            updatedCount++;
          } else {
            unchangedCount++;
          }
        }
        completed++;

        onProgress?.({
          completed,
          total: eligible.length,
          successful,
          failed,
          currentAwb: shipment.awbNumber || ''
        });
      })
    );
  }

  const finalResults = shipments.map(s => resultMap.get(s.id) || s);

  return {
    totalChecked: eligible.length,
    updatedCount,
    unchangedCount,
    successful,
    failed,
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

