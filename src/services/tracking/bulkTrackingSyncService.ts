import db from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { trackingEngine } from './trackingEngine';
import { normalizeCourier } from '../../config/courierConfig';
import { cleanOrderId } from '../unifiedLogisticsService';

export interface BulkSyncItem {
  orderId: string;
  awbNumber: string;
  courier: string;
  currentStatus: string;
  rawStatus?: string;
  deliveredDate?: string;
  dexieId?: number;
}

export interface FailedSyncRecord {
  orderId: string;
  awb: string;
  courier: string;
  error: string;
  lastAttempt: string;
}

export interface RecentUpdateRecord {
  orderId: string;
  awb: string;
  courier: string;
  oldStatus: string;
  newStatus: string;
  remarks?: string;
  time: string;
}

export interface BulkSyncState {
  status: 'idle' | 'running' | 'completed' | 'paused' | 'failed';
  totalCandidates: number;
  processed: number;
  updated: number;
  alreadyUpToDate: number;
  failed: number;
  trackingUnavailable: number;
  withoutAwbCount: number;
  progress: number; // 0 - 100
  currentCourier: string;
  currentAwb: string;
  currentOrderId: string;
  startedAt?: string;
  completedAt?: string;
  failedList: FailedSyncRecord[];
  recentUpdates: RecentUpdateRecord[];
  courierBreakdown: Record<string, { total: number; processed: number; updated: number; failed: number }>;
}

const STORAGE_KEY = 'velmora_bulk_sync_progress';
const REPORT_STORAGE_KEY = 'velmora_bulk_sync_last_report';

class BulkTrackingSyncService {
  private state: BulkSyncState;
  private listeners: Set<(state: BulkSyncState) => void> = new Set();
  private abortController: AbortController | null = null;
  private isProcessing: boolean = false;

  constructor() {
    this.state = this.loadInitialState();
  }

  private loadInitialState(): BulkSyncState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // If it was running when user refreshed, keep as running/paused
        return {
          ...parsed,
          status: parsed.status === 'running' ? 'paused' : parsed.status
        };
      }
    } catch (e) {
      // ignore parse error
    }

    return {
      status: 'idle',
      totalCandidates: 0,
      processed: 0,
      updated: 0,
      alreadyUpToDate: 0,
      failed: 0,
      trackingUnavailable: 0,
      withoutAwbCount: 0,
      progress: 0,
      currentCourier: '',
      currentAwb: '',
      currentOrderId: '',
      failedList: [],
      recentUpdates: [],
      courierBreakdown: {}
    };
  }

  private persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      if (this.state.status === 'completed') {
        localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      // ignore storage error
    }
  }

  public getState(): BulkSyncState {
    return { ...this.state };
  }

  public getLastReport(): BulkSyncState | null {
    try {
      const saved = localStorage.getItem(REPORT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  public subscribe(listener: (state: BulkSyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.persistState();
    const current = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (err) {
        console.error('[BulkTrackingSyncService] Listener error:', err);
      }
    }
  }

  public stopSync() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isProcessing = false;
    this.state.status = 'paused';
    this.notify();
  }

  /**
   * Retrieves all eligible shipments from Supabase across all pages,
   * merges with Dexie local cache, and identifies records with and without AWBs.
   */
  public async fetchAllEligibleShipments(): Promise<{
    eligibleItems: BulkSyncItem[];
    withoutAwbCount: number;
    totalSupabaseShipments: number;
  }> {
    let allSupabase: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('customer_tracking_shipments')
        .select('id, order_id, display_order_id, awb_number, courier, status, raw_status, delivered_date')
        .neq('status', 'Order Deleted')
        .neq('raw_status', 'DELETED')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !data || data.length === 0) break;
      allSupabase = allSupabase.concat(data);
      if (data.length < pageSize) hasMore = false;
      else page++;
    }

    // Also fetch local Dexie orders
    const dexieOrders = await db.logistics_orders.where('stage').notEqual('trash').toArray();
    const dexieMap = new Map<string, any>();
    for (const o of dexieOrders) {
      const cleanOid = cleanOrderId(o.orderId);
      if (cleanOid) {
        dexieMap.set(cleanOid.toLowerCase(), o);
      }
      if (o.awbNumber) {
        dexieMap.set(String(o.awbNumber).trim(), o);
      }
    }

    let withoutAwbCount = 0;
    const itemsMap = new Map<string, BulkSyncItem>();

    // 1. Process Supabase shipments
    for (const s of allSupabase) {
      const rawAwb = (s.awb_number || '').trim();
      const rawOid = cleanOrderId(s.order_id || s.display_order_id || '');
      const courier = normalizeCourier(s.courier) || 'Delhivery';

      if (!rawAwb || rawAwb.endsWith('999999')) {
        withoutAwbCount++;
        continue;
      }

      const localDexie = dexieMap.get(rawOid.toLowerCase()) || dexieMap.get(rawAwb);

      itemsMap.set(rawAwb, {
        orderId: rawOid || localDexie?.orderId || rawAwb,
        awbNumber: rawAwb,
        courier: courier,
        currentStatus: s.status || localDexie?.status || 'Awaiting Tracking Update',
        rawStatus: s.raw_status || localDexie?.rawStatus,
        deliveredDate: s.delivered_date || localDexie?.deliveredDate,
        dexieId: localDexie?.id
      });
    }

    // 2. Add any Dexie orders that have valid AWBs not yet included in Supabase
    for (const o of dexieOrders) {
      const rawAwb = (o.awbNumber || '').trim();
      if (!rawAwb || rawAwb.endsWith('999999')) {
        continue;
      }
      if (!itemsMap.has(rawAwb)) {
        const rawOid = cleanOrderId(o.orderId);
        const courier = normalizeCourier(o.courier) || 'Delhivery';
        itemsMap.set(rawAwb, {
          orderId: rawOid || rawAwb,
          awbNumber: rawAwb,
          courier: courier,
          currentStatus: o.status || 'Awaiting Tracking Update',
          rawStatus: o.rawStatus,
          deliveredDate: o.deliveredDate,
          dexieId: o.id
        });
      }
    }

    // Prioritize active and pending orders before historical delivered orders
    const getStatusPriority = (status: string) => {
      const s = (status || '').toLowerCase();
      // Highest priority: Awaiting tracking update or pending manifest
      if (s.includes('awaiting') || s.includes('pending') || s.includes('manifest')) return 1;
      // High priority: Out for delivery, In transit, Failed attempt, Ready for pickup
      if (s.includes('out for delivery') || s.includes('transit') || s.includes('failed') || s.includes('pickup') || s.includes('ready')) return 2;
      // Medium priority: Exceptions & RTO
      if (s.includes('exception') || s.includes('rto') || s.includes('return')) return 3;
      // Lower priority: Terminal states (Delivered, Cancelled)
      if (s.includes('delivered') || s.includes('cancel')) return 4;
      return 2;
    };

    const sortedItems = Array.from(itemsMap.values()).sort((a, b) => {
      const prioDiff = getStatusPriority(a.currentStatus) - getStatusPriority(b.currentStatus);
      if (prioDiff !== 0) return prioDiff;
      // Sort newer order IDs first
      const numA = parseInt(a.orderId.replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(b.orderId.replace(/[^0-9]/g, ''), 10) || 0;
      return numB - numA;
    });

    return {
      eligibleItems: sortedItems,
      withoutAwbCount,
      totalSupabaseShipments: allSupabase.length
    };
  }

  /**
   * Main entry point to start or resume full bulk tracking synchronization.
   */
  public async startBulkSync(options: {
    specificAwbs?: string[];
    onProgress?: (state: BulkSyncState) => void;
  } = {}): Promise<BulkSyncState> {
    if (this.isProcessing) {
      console.warn('[BulkTrackingSyncService] Bulk sync is already running.');
      return this.getState();
    }

    this.isProcessing = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // 1. Discover all eligible items
    const { eligibleItems, withoutAwbCount } = await this.fetchAllEligibleShipments();

    let itemsToProcess = eligibleItems;
    if (options.specificAwbs && options.specificAwbs.length > 0) {
      const filterSet = new Set(options.specificAwbs.map(a => a.trim().toLowerCase()));
      itemsToProcess = eligibleItems.filter(i => filterSet.has(i.awbNumber.toLowerCase()));
    }

    // Initialize courier breakdown
    const courierBreakdown: Record<string, { total: number; processed: number; updated: number; failed: number }> = {};
    for (const item of itemsToProcess) {
      if (!courierBreakdown[item.courier]) {
        courierBreakdown[item.courier] = { total: 0, processed: 0, updated: 0, failed: 0 };
      }
      courierBreakdown[item.courier].total++;
    }

    this.state = {
      status: 'running',
      totalCandidates: itemsToProcess.length,
      processed: 0,
      updated: 0,
      alreadyUpToDate: 0,
      failed: 0,
      trackingUnavailable: 0,
      withoutAwbCount,
      progress: 0,
      currentCourier: itemsToProcess[0]?.courier || '',
      currentAwb: itemsToProcess[0]?.awbNumber || '',
      currentOrderId: itemsToProcess[0]?.orderId || '',
      startedAt: new Date().toISOString(),
      failedList: [],
      recentUpdates: [],
      courierBreakdown
    };
    this.notify();

    console.info(`[BulkTrackingSyncService] Starting bulk tracking sync for ${itemsToProcess.length} eligible AWBs (${withoutAwbCount} without AWB)...`);

    // Group by courier for optimal rate-limiting
    const delhiveryItems = itemsToProcess.filter(i => i.courier === 'Delhivery');
    const stCourierItems = itemsToProcess.filter(i => i.courier === 'ST Courier');
    const otherItems = itemsToProcess.filter(i => i.courier !== 'Delhivery' && i.courier !== 'ST Courier');

    try {
      // 1. Process Delhivery with concurrency = 4 and 120ms pacing
      if (delhiveryItems.length > 0 && !signal.aborted) {
        await this.processCourierGroup(delhiveryItems, 'Delhivery', 4, 120, signal);
      }

      // 2. Process ST Courier with concurrency = 2 and 200ms pacing
      if (stCourierItems.length > 0 && !signal.aborted) {
        await this.processCourierGroup(stCourierItems, 'ST Courier', 2, 200, signal);
      }

      // 3. Process any remaining other couriers
      if (otherItems.length > 0 && !signal.aborted) {
        await this.processCourierGroup(otherItems, 'Other', 2, 150, signal);
      }

      if (!signal.aborted) {
        this.state.status = 'completed';
        this.state.completedAt = new Date().toISOString();
        this.state.progress = 100;
        this.state.currentAwb = '';
        this.state.currentOrderId = '';
        this.notify();
        console.info(`[BulkTrackingSyncService] Finished bulk sync: ${this.state.updated} updated, ${this.state.alreadyUpToDate} up to date, ${this.state.failed} failed.`);
      }
    } catch (err: any) {
      if (signal.aborted) {
        this.state.status = 'paused';
      } else {
        this.state.status = 'failed';
        console.error('[BulkTrackingSyncService] Fatal sync error:', err);
      }
      this.notify();
    } finally {
      this.isProcessing = false;
      this.abortController = null;
    }

    return this.getState();
  }

  /**
   * Processes a chunked queue of items for a specific courier with concurrency limit and exponential backoff retry.
   */
  private async processCourierGroup(
    items: BulkSyncItem[],
    courierName: string,
    concurrency: number,
    delayBetweenMs: number,
    signal: AbortSignal
  ) {
    let index = 0;

    const worker = async () => {
      while (index < items.length && !signal.aborted) {
        const currentIndex = index++;
        const item = items[currentIndex];
        if (!item) break;

        this.state.currentCourier = item.courier;
        this.state.currentAwb = item.awbNumber;
        this.state.currentOrderId = item.orderId;

        await this.processSingleItem(item, signal);

        this.state.processed++;
        this.state.progress = Math.round((this.state.processed / this.state.totalCandidates) * 100);

        if (this.state.courierBreakdown[item.courier]) {
          this.state.courierBreakdown[item.courier].processed++;
        }

        // Notify subscribers every 3 items or at completion
        if (this.state.processed % 3 === 0 || this.state.processed === this.state.totalCandidates) {
          this.notify();
        }

        if (delayBetweenMs > 0) {
          await new Promise(res => setTimeout(res, delayBetweenMs));
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
  }

  /**
   * Processes a single shipment with retry on rate limit / network error and strict transition protection.
   */
  private async processSingleItem(item: BulkSyncItem, signal: AbortSignal) {
    let maxRetries = 2;
    let attempt = 0;
    let result: any = null;

    while (attempt <= maxRetries && !signal.aborted) {
      attempt++;
      try {
        result = await trackingEngine.trackSingle(item.courier, item.awbNumber, 15000);

        // If rate limited, wait and retry
        if (result && result.error && String(result.error).includes('rate limit')) {
          if (attempt <= maxRetries) {
            await new Promise(res => setTimeout(res, 1200 * attempt));
            continue;
          }
        }
        break;
      } catch (e: any) {
        if (attempt <= maxRetries) {
          await new Promise(res => setTimeout(res, 1000 * attempt));
          continue;
        }
        result = { success: false, status: 'Unable to fetch', error: e.message || String(e) };
      }
    }

    if (!result) return;

    if (result.success && result.status && result.status !== 'Unknown') {
      let finalStatus = result.status;

      // Status Transition Protection
      const curStatus = item.currentStatus || '';
      if ((curStatus === 'Delivered' || curStatus === 'RTO Delivered to Seller') && finalStatus !== curStatus && !finalStatus.includes('RTO')) {
        finalStatus = curStatus;
      }

      const isChanged = finalStatus !== curStatus || 
                        (result.rawStatus && result.rawStatus !== item.rawStatus) ||
                        (result.deliveredDate && !item.deliveredDate);

      // 1. Update local Dexie if record ID is available
      if (item.dexieId) {
        const patch: any = {
          status: finalStatus,
          rawStatus: result.rawStatus || finalStatus,
          syncedAt: new Date().toISOString(),
          trackingError: undefined,
          syncState: 'idle'
        };
        if (result.remarks) patch.remarks = result.remarks;
        if (result.deliveredDate) patch.deliveredDate = result.deliveredDate;
        if (result.estimatedDeliveryDate) patch.estimatedDeliveryDate = result.estimatedDeliveryDate;
        if (result.location) patch.currentLocation = result.location;
        if (finalStatus === 'Delivered') patch.stage = 'fulfilled';

        await db.logistics_orders.update(item.dexieId, patch);
      }

      // 2. Update Supabase customer_tracking_shipments
      try {
        await supabase.from('customer_tracking_shipments').upsert({
          order_id: item.orderId,
          display_order_id: item.orderId.startsWith('#') ? item.orderId : `#${item.orderId}`,
          awb_number: item.awbNumber,
          courier: normalizeCourier(item.courier) || item.courier || 'Delhivery',
          status: finalStatus,
          raw_status: result.rawStatus || finalStatus,
          remarks: result.remarks || null,
          delivered_date: result.deliveredDate || item.deliveredDate || null,
          estimated_delivery_date: result.estimatedDeliveryDate || null,
          last_location: result.location || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'courier,awb_number' });

        if (finalStatus === 'Delivered' && item.orderId) {
          await supabase.from('sales_orders').update({
            dispatch_status: 'DELIVERED',
            updated_at: new Date().toISOString()
          }).eq('order_id', item.orderId);
        }
      } catch (sbErr) {
        console.warn('[BulkTrackingSyncService] Supabase write note:', sbErr);
      }

      if (isChanged) {
        this.state.updated++;
        if (this.state.courierBreakdown[item.courier]) {
          this.state.courierBreakdown[item.courier].updated++;
        }
        this.state.recentUpdates.unshift({
          orderId: item.orderId,
          awb: item.awbNumber,
          courier: item.courier,
          oldStatus: curStatus,
          newStatus: finalStatus,
          remarks: result.remarks,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        if (this.state.recentUpdates.length > 20) {
          this.state.recentUpdates.pop();
        }
      } else {
        this.state.alreadyUpToDate++;
      }
    } else {
      const errStr = result.error || 'Tracking API response error';
      if (errStr.includes('not found') || result.status === 'Tracking Not Available' || result.status === 'Tracking Not Found') {
        this.state.trackingUnavailable++;
      } else {
        this.state.failed++;
        if (this.state.courierBreakdown[item.courier]) {
          this.state.courierBreakdown[item.courier].failed++;
        }
        this.state.failedList.push({
          orderId: item.orderId,
          awb: item.awbNumber,
          courier: item.courier,
          error: errStr,
          lastAttempt: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Retries only the shipments that failed in the last sync run.
   */
  public async retryFailed(): Promise<BulkSyncState> {
    const failedAwbs = this.state.failedList.map(f => f.awb);
    if (failedAwbs.length === 0) return this.getState();
    return this.startBulkSync({ specificAwbs: failedAwbs });
  }
}

export const bulkTrackingSyncService = new BulkTrackingSyncService();
