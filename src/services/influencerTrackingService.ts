import db from '../lib/db';
import { trackingService } from './trackingService';

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
  expectedDeliveryDate: string;
  status: TrackingStatusCategory;
  rawStatus: string;
  statusSource?: 'Live ST Courier Tracking' | 'Uploaded Delhivery File' | string;
  sourceType?: 'LIVE_API' | 'UPLOADED_FILE';
  lastLocation?: string;
  trackingDateTime?: string;
  lastSyncedAt?: string;
  trackingUrl?: string | null;
  syncError?: string;
}

export interface TrackingCacheEntry {
  status: TrackingStatusCategory;
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
  if (s.includes('in transit') || s.includes('transit') || s.includes('forwarded') || s.includes('arrived')) {
    return 'In Transit';
  }
  if (s.includes('delivered')) {
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

/**
 * Normalizes uploaded Delhivery status (Status Type and Current Status) into standard Tracking Status categories.
 * Note: Delhivery does not use external API/bot tracking; the uploaded file status is the source of truth.
 */
export function normalizeDelhiveryStatus(currentStatus?: string, statusType?: string): TrackingStatusCategory {
  const cur = (currentStatus || '').toLowerCase().trim();
  const type = (statusType || '').toLowerCase().trim();

  // 1. Delivered
  if (cur.includes('delivered') || type.includes('delivered')) {
    return 'Delivered';
  }

  // 2. Out for delivery
  if (cur.includes('out for delivery') || cur.includes('out_for_delivery') || type.includes('out for delivery')) {
    return 'Out for Delivery';
  }

  // 3. Failed Attempt
  if (
    cur.includes('attempt failed') || 
    cur.includes('undelivered - attempt') || 
    cur.includes('attempt') ||
    cur.includes('customer not available') || 
    cur.includes('failed attempt')
  ) {
    return 'Failed Attempt';
  }

  // 4. In Transit
  if (
    cur.includes('shipped') || 
    cur.includes('in transit') || 
    cur.includes('transit') || 
    cur.includes('bagging') || 
    cur.includes('reach') || 
    cur.includes('forwarded') ||
    cur.includes('hub') ||
    cur.includes('center') ||
    cur.includes('dispatched') ||
    type.includes('transit') ||
    type.includes('shipped')
  ) {
    return 'In Transit';
  }

  // 5. Exception / RTO / Returned / Cancelled / Lost / Damaged
  if (
    cur.includes('rto') || 
    cur.includes('return to origin') ||
    cur.includes('return') || 
    cur.includes('cancelled') || 
    cur.includes('canceled') || 
    cur.includes('lost') || 
    cur.includes('damaged') || 
    cur.includes('exception') ||
    type.includes('rto') ||
    type.includes('return') ||
    type.includes('cancelled') ||
    type.includes('canceled')
  ) {
    return 'Exception';
  }

  // 6. Info Received / Manifest / Pickup pending
  if (
    cur.includes('manifest') || 
    cur.includes('pickup pending') || 
    cur.includes('pickup scheduled') || 
    cur.includes('info received') || 
    cur.includes('booked')
  ) {
    return 'Info Received';
  }

  // 7. Expired
  if (cur.includes('expired') || type.includes('expired')) {
    return 'Expired';
  }

  // 8. Pending
  if (cur.includes('pending') || type.includes('pending') || cur.includes('undelivered')) {
    return 'Pending';
  }

  return normalizeTrackingStatus(currentStatus || statusType || 'Pending');
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
 * Returns color classes for the status badge based on category.
 */
export function getTrackingStatusBadgeStyle(status: TrackingStatusCategory): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status) {
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
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveCampaignShipments(campaignId: string | number, shipments: InfluencerDispatchedShipment[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`influencer_campaign_shipments_${campaignId}`, JSON.stringify(shipments));
  } catch (e) {
    console.warn('LocalStorage save error for campaign shipments:', e);
  }
}

export function upsertCampaignShipments(
  campaignId: string | number,
  newShipments: InfluencerDispatchedShipment[]
): InfluencerDispatchedShipment[] {
  const existing = getCampaignShipments(campaignId);
  const shipmentMap = new Map<string, InfluencerDispatchedShipment>();

  existing.forEach(s => {
    const key = (s.awbNumber || s.id).toLowerCase().trim();
    if (key) shipmentMap.set(key, s);
  });

  newShipments.forEach(s => {
    const key = (s.awbNumber || s.id).toLowerCase().trim();
    if (key) {
      const prev = shipmentMap.get(key);
      shipmentMap.set(key, {
        ...(prev || {}),
        ...s,
        creatorName: s.creatorName !== 'Influencer Not Matched' ? s.creatorName : (prev?.creatorName || s.creatorName),
        username: s.username !== '—' ? s.username : (prev?.username || s.username),
        influencerId: s.influencerId || prev?.influencerId,
        profilePhoto: s.profilePhoto || prev?.profilePhoto || '',
        phoneNumber: s.phoneNumber || prev?.phoneNumber || ''
      });
    }
  });

  const merged = Array.from(shipmentMap.values());
  saveCampaignShipments(campaignId, merged);
  return merged;
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
