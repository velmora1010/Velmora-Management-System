import db from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { trackingEngine } from './trackingEngine';
import { normalizeCourier } from '../../config/courierConfig';
import { cleanOrderId } from '../unifiedLogisticsService';

const SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const STORAGE_KEY = 'velmora_last_tracking_sync';
const RATE_LIMIT_DELAY_MS = 250; // Delay between requests to avoid rate limits

export interface ScheduledSyncReport {
  timestamp: string;
  totalCandidates: number;
  processed: number;
  updated: number;
  failed: number;
  skipped: number;
}

class ScheduledTrackingBot {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  public init() {
    if (this.timer) return;

    // Check if sync is overdue on launch
    const lastSyncStr = localStorage.getItem(STORAGE_KEY);
    const lastSyncTime = lastSyncStr ? new Date(lastSyncStr).getTime() : 0;
    const now = Date.now();

    if (now - lastSyncTime > SYNC_INTERVAL_MS) {
      // Run in background after 5s initial warmup
      setTimeout(() => {
        this.runBatch({ batchSize: 50 }).catch(err => {
          console.warn('[TrackingBot] Warmup sync error:', err);
        });
      }, 5000);
    }

    // Schedule recurring job every 4 hours
    this.timer = setInterval(() => {
      this.runBatch({ batchSize: 100 }).catch(err => {
        console.warn('[TrackingBot] Interval sync error:', err);
      });
    }, SYNC_INTERVAL_MS);

    console.info('[TrackingBot] Scheduled tracking sync bot initialized (4-hour cycle)');
  }

  public async runBatch(options: { batchSize?: number; forceAll?: boolean } = {}): Promise<ScheduledSyncReport> {
    if (this.isRunning) {
      console.info('[TrackingBot] Sync batch already running, skipping overlapping run.');
      return {
        timestamp: new Date().toISOString(),
        totalCandidates: 0,
        processed: 0,
        updated: 0,
        failed: 0,
        skipped: 0
      };
    }

    this.isRunning = true;
    const startTime = new Date().toISOString();
    let processed = 0;
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    try {
      // 1. Fetch active shipments from local db
      const allOrders = await db.logistics_orders.toArray();
      const trackable = allOrders.filter(o => {
        if (!o.awbNumber || !o.id) return false;
        const c = normalizeCourier(o.courier);
        if (c !== 'Delhivery' && c !== 'ST Courier') return false;

        if (options.forceAll) return true;

        const st = (o.status || '').toLowerCase().trim();
        const isTerminal = st.includes('delivered') || st.includes('cancelled') || st.includes('rto delivered');
        return !isTerminal;
      });

      const limit = options.batchSize || 50;
      const candidates = trackable.slice(0, limit);

      console.info(`[TrackingBot] Starting sync for ${candidates.length} active shipments (out of ${trackable.length} candidates)...`);

      for (const order of candidates) {
        try {
          const courier = normalizeCourier(order.courier) || 'Delhivery';
          const result = await trackingEngine.trackSingle(courier, order.awbNumber!);

          if (result.success && result.status && result.status !== 'Unknown') {
            await db.logistics_orders.update(order.id!, {
              status: result.status,
              currentLocation: result.location || order.shippingCity || '',
              remarks: result.remarks || order.remarks || '',
              deliveredDate: result.deliveredDate || order.deliveredDate,
              estimatedDeliveryDate: result.estimatedDeliveryDate,
              syncedAt: new Date().toISOString()
            });

            // Upsert to Supabase
            const cleanOid = cleanOrderId(order.orderId || order.displayOrderId || '');
            if (cleanOid) {
              try {
                await supabase.from('customer_tracking_shipments').upsert({
                  order_id: cleanOid,
                  display_order_id: `#${cleanOid}`,
                  awb_number: order.awbNumber,
                  courier: courier,
                  status: result.status,
                  raw_status: result.rawStatus || result.status,
                  remarks: result.remarks || null,
                  delivered_date: result.deliveredDate || null,
                  estimated_delivery_date: result.estimatedDeliveryDate || null,
                  last_location: result.location || null,
                  last_synced_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }, { onConflict: 'courier,awb_number' });
              } catch (sbErr) {
                // Ignore silent supabase sync note
              }
            }

            updated++;
          } else {
            skipped++;
          }
        } catch (itemErr) {
          failed++;
        }

        processed++;
        // Rate limiting delay
        await new Promise(res => setTimeout(res, RATE_LIMIT_DELAY_MS));
      }

      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      console.info(`[TrackingBot] Sync complete: ${updated} updated, ${skipped} skipped, ${failed} failed.`);

      return {
        timestamp: startTime,
        totalCandidates: trackable.length,
        processed,
        updated,
        failed,
        skipped
      };
    } finally {
      this.isRunning = false;
    }
  }

  public getLastSyncTime(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const scheduledTrackingBot = new ScheduledTrackingBot();
