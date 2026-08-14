import db from '../../lib/db';
import { CourierAdapterFactory } from './adapters/CourierAdapterFactory';
import type { LogisticsOrder } from '../../types/logistics';

export interface BulkSyncSummary {
  Amazon: { success: number; unsupported: number };
  'ST Courier': { success: number; unsupported: number };
  Delhivery: { success: number; unsupported: number };
  Ekart: { success: number; unsupported: number };
  Failed: number;
}

export const trackingEngine = {
  /**
   * Syncs a single order's tracking status with retries, logging, and progress reporting.
   */
  async syncOrder(orderId: number, originalStatus?: string): Promise<{ success: boolean; status: string; supported?: boolean }> {
    const order = await db.logistics_orders.get(orderId);
    if (!order || !order.awbNumber) {
      return { success: false, status: 'Unable to fetch' };
    }

    const prevStatusLog = order.status || 'N/A';
    const prevStatus = originalStatus || order.status || '';
    const isProgress = (s: string) => 
      s.startsWith('Checking') || 
      s === 'Fetching courier...' || 
      s === 'Parsing status...' || 
      s.startsWith('Retry') || 
      s === 'Unable to fetch' || 
      s === 'Tracking API not connected' ||
      s === 'Sync not available' ||
      s === '';
    const originalRealStatus = prevStatus && !isProgress(prevStatus) ? prevStatus : '';

    let attempt = 0;
    const maxAttempts = 3;
    let result: any = null;

    while (attempt < maxAttempts) {
      attempt++;
      
      // Update DB with checking status
      const checkMsg = attempt > 1 ? `Retry ${attempt}/3...` : `Checking ${order.courier || 'courier'}...`;
      await db.logistics_orders.update(orderId, { status: checkMsg });
      
      const attemptStart = new Date();
      
      // Update DB to fetching status
      await db.logistics_orders.update(orderId, { status: 'Fetching courier...' });
      
      let success = false;
      let errMessage = '';
      let rawResponseStr = '';

      try {
        const adapter = CourierAdapterFactory.getAdapter(order.courier);
        result = await adapter.track(order.awbNumber);
        success = result.success;
        errMessage = result.error || '';
        rawResponseStr = result.rawResponse || '';

        await db.logistics_orders.update(orderId, { status: 'Parsing status...' });
        
        if (result.supported === false) {
          // Unsupported courier, stop retrying immediately
          break;
        }

        if (success) {
          // Success, break retry loop
          break;
        }
      } catch (err: any) {
        success = false;
        errMessage = err.message || String(err);
      } finally {
        const attemptEnd = new Date();
        const duration = attemptEnd.getTime() - attemptStart.getTime();

        // Save every attempt (including unsupported/failed attempts) in Dexie tracking_logs
        await db.tracking_logs.add({
          awb: order.awbNumber,
          courier: order.courier || 'Unknown',
          startedAt: attemptStart.toISOString(),
          finishedAt: attemptEnd.toISOString(),
          duration,
          success,
          error: errMessage || undefined,
          rawResponse: rawResponseStr || undefined
        });
      }

      if (attempt < maxAttempts) {
        // Backoff delay: 5s after Attempt 1, 10s after Attempt 2
        const delayMs = attempt === 1 ? 5000 : 10000;
        await db.logistics_orders.update(orderId, { status: `Retry ${attempt + 1}/3...` });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Process the final outcome
    if (result && result.supported === false) {
      const finalStatus = originalRealStatus || '';
      await db.logistics_orders.update(orderId, {
        status: finalStatus,
        trackingError: 'Sync not available for this courier'
      });
      return { success: false, status: finalStatus, supported: false };
    }

    if (result && result.success) {
      const finalStatus = result.status || 'In Transit';
      await db.logistics_orders.update(orderId, {
        status: finalStatus,
        syncedAt: new Date().toLocaleString(),
        trackingError: undefined,
        lastFailedAt: undefined
      });
      if (order.courier === 'ST Courier') {
        console.log(`[ST TRACKING] Previous DB Status: ${prevStatusLog}`);
        console.log(`[ST TRACKING] New DB Status: ${finalStatus}`);
      }
      return { success: true, status: finalStatus };
    } else {
      const finalError = (result && result.error) || 'Failed to fetch status from tracking API';
      const is404 = finalError.includes('Tracking API route not found');
      const finalStatus = originalRealStatus || (is404 ? 'Tracking API not connected' : 'Unable to fetch');
      await db.logistics_orders.update(orderId, {
        status: finalStatus,
        trackingError: finalError,
        lastFailedAt: new Date().toLocaleString()
      });
      if (order.courier === 'ST Courier') {
        console.log(`[ST TRACKING] Previous DB Status: ${prevStatusLog}`);
        console.log(`[ST TRACKING] New DB Status: ${finalStatus}`);
      }
      return { success: false, status: finalStatus };
    }
  },

  /**
   * Syncs a list of orders in a queue with maximum 2 concurrent requests.
   */
  async syncBulk(orders: LogisticsOrder[], onProgressChange?: () => void): Promise<BulkSyncSummary> {
    const summary: BulkSyncSummary = {
      Amazon: { success: 0, unsupported: 0 },
      'ST Courier': { success: 0, unsupported: 0 },
      Delhivery: { success: 0, unsupported: 0 },
      Ekart: { success: 0, unsupported: 0 },
      Failed: 0
    };

    const processItem = async (order: LogisticsOrder) => {
      if (!order.id) return;
      const res = await trackingEngine.syncOrder(order.id);
      
      const courierKey = order.courier as 'Amazon' | 'ST Courier' | 'Delhivery' | 'Ekart';
      const isKnownCourier = ['Amazon', 'ST Courier', 'Delhivery', 'Ekart'].includes(order.courier || '');
      
      if (res.supported === false) {
        if (isKnownCourier) {
          summary[courierKey].unsupported++;
        }
      } else if (res.success) {
        if (isKnownCourier) {
          summary[courierKey].success++;
        }
      } else {
        summary.Failed++;
      }
      
      if (onProgressChange) {
        onProgressChange();
      }
    };

    // Promise pool concurrency mechanism (max 2 concurrent requests)
    const concurrencyLimit = 2;
    const executing: Promise<any>[] = [];
    
    for (const order of orders) {
      const p = Promise.resolve().then(() => processItem(order));
      executing.push(p);
      
      if (concurrencyLimit <= orders.length) {
        const e: any = p.then(() => executing.splice(executing.indexOf(e), 1));
        if (executing.length >= concurrencyLimit) {
          await Promise.race(executing);
        }
      }
    }
    
    await Promise.all(executing);
    return summary;
  }
};
