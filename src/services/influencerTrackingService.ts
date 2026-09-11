import db from '../lib/db';
import { trackingService } from './trackingService';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';

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
 * Maps a Supabase database row to the InfluencerDispatchedShipment frontend model.
 */
export function mapDbRowToShipment(row: any): InfluencerDispatchedShipment {
  const isDelhivery = (row.courier || '').toLowerCase().includes('delhivery');
  const isSTCourier = (row.courier || '').toLowerCase().includes('st courier');

  let normalizedStatus: TrackingStatusCategory;
  if (row.status && [
    'In Transit', 'Out for Delivery', 'Delivered', 'Exception', 'Failed Attempt', 'Pending', 'Info Received', 'Expired'
  ].includes(row.status)) {
    normalizedStatus = row.status as TrackingStatusCategory;
  } else if (isDelhivery) {
    normalizedStatus = normalizeDelhiveryStatus(row.raw_status || row.status);
  } else {
    normalizedStatus = normalizeTrackingStatus(row.raw_status || row.status);
  }

  const statusSourceDisplay = isDelhivery
    ? 'Uploaded Delhivery File'
    : (isSTCourier ? 'Live ST Courier Tracking' : (row.status_source === 'delhivery_file' ? 'Uploaded Delhivery File' : 'Live ST Courier Tracking'));

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
    expectedDeliveryDate: row.expected_delivery_date || '',
    status: normalizedStatus,
    rawStatus: row.raw_status || row.status || 'In Transit',
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

  const payload: any = {
    campaign_id: String(campaignId),
    influencer_id: s.influencerId || null,
    creator_name: s.creatorName || null,
    username: s.username || null,
    influencer_code: s.influencerCode || null,
    order_id: s.orderId || (s.influencerCode ? s.influencerCode : null),
    awb_number: awb,
    courier,
    status: s.status || 'In Transit',
    status_source: statusSource,
    source_type: sourceType,
    dispatch_date: s.dispatchDate || null,
    expected_delivery_date: s.expectedDeliveryDate || null,
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
    sync_error: s.syncError || null,
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

/**
 * Fetches campaign shipments directly from the Supabase database table `influencer_tracking_shipments`.
 * Falls back to local storage cache if offline or initial load.
 */
export async function fetchCampaignShipmentsFromDb(campaignId: string | number): Promise<InfluencerDispatchedShipment[]> {
  try {
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.influencerTrackingShipments)
      .select('*')
      .eq('campaign_id', String(campaignId))
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch shipments from Supabase, falling back to local storage:', error);
      return getCampaignShipments(campaignId);
    }

    if (Array.isArray(data) && data.length > 0) {
      const shipments = data.map(mapDbRowToShipment);
      saveCampaignShipments(campaignId, shipments);
      return shipments;
    }

    // If Supabase table has no rows yet for this campaign, check if local storage has shipments
    const local = getCampaignShipments(campaignId);
    if (local && local.length > 0) {
      // Migrate local records to Supabase asynchronously in background
      upsertCampaignShipmentsToDb(campaignId, local).catch(err => {
        console.warn('Background migration of local shipments to Supabase:', err);
      });
      return local;
    }

    return [];
  } catch (err) {
    console.error('fetchCampaignShipmentsFromDb exception:', err);
    return getCampaignShipments(campaignId);
  }
}

/**
 * Upserts shipments to the Supabase database table `influencer_tracking_shipments`
 * using the unique constraint (campaign_id, courier, awb_number).
 * Also keeps local storage synchronized.
 */
export async function upsertCampaignShipmentsToDb(
  campaignId: string | number,
  shipments: InfluencerDispatchedShipment[]
): Promise<InfluencerDispatchedShipment[]> {
  // Sync to local cache immediately
  const localMerged = upsertCampaignShipments(campaignId, shipments);

  if (!shipments || shipments.length === 0) {
    return localMerged;
  }

  try {
    const valid = shipments.filter(s => s.awbNumber && s.awbNumber.trim());
    if (valid.length === 0) return localMerged;

    // Deduplicate in payload by (campaign_id, courier, awb_number)
    const payloadMap = new Map<string, any>();
    valid.forEach(s => {
      const p = mapShipmentToDbPayload(s, campaignId);
      const key = `${p.campaign_id}__${(p.courier || '').toLowerCase()}__${p.awb_number.toLowerCase()}`;
      payloadMap.set(key, p);
    });

    const payloads = Array.from(payloadMap.values());

    // Batch upsert into Supabase
    const chunkSize = 50;
    for (let i = 0; i < payloads.length; i += chunkSize) {
      const chunk = payloads.slice(i, i + chunkSize);
      const { error } = await supabase
        .from(SUPABASE_TABLES.influencerTrackingShipments)
        .upsert(chunk, {
          onConflict: 'campaign_id,courier,awb_number',
          ignoreDuplicates: false
        });

      if (error) {
        console.warn('[Supabase Tracking Upsert Error]:', error);
      }
    }

    // Refresh updated list from Supabase
    const refreshed = await fetchCampaignShipmentsFromDb(campaignId);
    return refreshed.length > 0 ? refreshed : localMerged;
  } catch (err) {
    console.error('[upsertCampaignShipmentsToDb Error]:', err);
    return localMerged;
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
    // 1. Delete all shipment records scoped strictly to current campaign_id
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.influencerTrackingShipments)
      .delete()
      .eq('campaign_id', cleanCampaignId)
      .select('id');

    if (error) {
      console.error('[Supabase Tracking Delete Error]:', error);
      return { success: false, error: error.message || 'Database deletion failed' };
    }

    // 2. Safety verification: query the table again using current campaign_id to verify 0 records remain
    const { count, error: verifyError } = await supabase
      .from(SUPABASE_TABLES.influencerTrackingShipments)
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', cleanCampaignId);

    if (verifyError) {
      console.warn('Post-delete verification query warning:', verifyError);
    } else if (count !== null && count > 0) {
      return { success: false, error: `Verification failed: ${count} tracking records still remain in database.` };
    }

    // 3. Clear local storage and caches strictly for this campaign
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`influencer_campaign_shipments_${cleanCampaignId}`);
        localStorage.removeItem(`influencer_tracking_cache_${cleanCampaignId}`);
        localStorage.removeItem(`influencer_tracking_last_sync_${cleanCampaignId}`);
      } catch (e) {
        console.warn('Error clearing localStorage for campaign:', e);
      }
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

