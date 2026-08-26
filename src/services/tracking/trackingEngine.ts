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
  async syncOrder(
    orderId: number, 
    originalStatus?: string,
    options?: { timeoutMs?: number; maxAttempts?: number }
  ): Promise<{ success: boolean; status: string; supported?: boolean; error?: string }> {
    const order = await db.logistics_orders.get(orderId);
    if (!order || !order.awbNumber) {
      return { success: false, status: 'Sync Failed' };
    }

    const { isCourierActive } = await import('../../config/courierConfig');
    if (!isCourierActive(order.courier)) {
      return { success: false, status: 'Unsupported Courier', supported: false };
    }

    const prevStatusLog = order.status || 'N/A';
    const prevStatus = originalStatus || order.status || '';
    const isProgress = (s: string) => 
      s.startsWith('Checking') || 
      s === 'Fetching courier...' || 
      s === 'Parsing status...' || 
      s.startsWith('Retry') || 
      s === 'Unable to fetch' || 
      s === 'Sync Failed' ||
      s === 'Tracking API not connected' ||
      s === 'Sync not available' ||
      s === 'Queued' ||
      s === 'Waiting...' ||
      s === 'Pending' ||
      s === 'Not Tracked' ||
      s === '';
    const originalRealStatus = prevStatus && !isProgress(prevStatus) ? prevStatus : '';

    let attempt = 0;
    const maxAttempts = options?.maxAttempts !== undefined ? options.maxAttempts : 3;
    const customTimeoutMs = options?.timeoutMs;
    let result: any = null;

    while (attempt < maxAttempts) {
      attempt++;
      
      await db.logistics_orders.update(orderId, { 
        status: originalRealStatus || 'Pending',
        syncState: attempt > 1 ? 'retrying' : 'checking'
      });
      
      const attemptStart = new Date();
      
      await db.logistics_orders.update(orderId, { 
        status: originalRealStatus || 'Pending',
        syncState: 'checking'
      });
      
      let success = false;
      let errMessage = '';
      let rawResponseStr = '';

      try {
        const adapter = CourierAdapterFactory.getAdapter(order.courier);
        result = await adapter.track(order.awbNumber, customTimeoutMs);
        success = result.success;
        errMessage = result.error || '';
        rawResponseStr = result.rawResponse || '';

        await db.logistics_orders.update(orderId, { 
          status: originalRealStatus || 'Pending'
        });
        
        if (result.supported === false) {
          break;
        }

        if (success) {
          break;
        }
      } catch (err: any) {
        success = false;
        errMessage = err.message || String(err);
      } finally {
        const attemptEnd = new Date();
        const duration = attemptEnd.getTime() - attemptStart.getTime();

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
        const delayMs = attempt === 1 ? 5000 : 10000;
        await db.logistics_orders.update(orderId, { 
          status: originalRealStatus || 'Pending',
          syncState: 'retrying'
        });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (result && result.supported === false) {
      const finalStatus = originalRealStatus || '';
      await db.logistics_orders.update(orderId, {
        status: finalStatus,
        trackingError: 'Sync not available for this courier',
        syncState: 'idle'
      });
      return { success: false, status: finalStatus, supported: false };
    }

    if (result && result.success) {
      const finalStatus = result.status || 'In Transit';
      await db.logistics_orders.update(orderId, {
        status: finalStatus,
        syncedAt: new Date().toLocaleString(),
        trackingError: undefined,
        lastFailedAt: undefined,
        syncState: 'idle'
      });
      if (order.courier === 'ST Courier') {
        console.log(`[ST TRACKING] Previous DB Status: ${prevStatusLog}`);
        console.log(`[ST TRACKING] New DB Status: ${finalStatus}`);
      }
      return { success: true, status: finalStatus };
    } else {
      const finalError = (result && result.error) || 'Failed to fetch status from tracking API';
      const is404 = finalError.includes('Tracking API route not found');
      const finalStatus = originalRealStatus || (is404 ? 'Tracking API not connected' : 'Sync Failed');
      await db.logistics_orders.update(orderId, {
        status: finalStatus,
        trackingError: finalError,
        lastFailedAt: new Date().toLocaleString(),
        syncState: 'idle'
      });
      if (order.courier === 'ST Courier') {
        console.log(`[ST TRACKING] Previous DB Status: ${prevStatusLog}`);
        console.log(`[ST TRACKING] New DB Status: ${finalStatus}`);
      }
      return { success: false, status: finalStatus, error: finalError };
    }
  },

  /**
   * Syncs a list of ST Courier shipments in a highly optimized queue with:
   * - Default concurrency = 6 (adaptive range 2-8 based on throttling/spikes)
   * - Skip terminal states (Delivered, RTO)
   * - First pass: single fast attempt (13s timeout, no backoff)
   * - Priority: new untracked first -> failed second -> active refresh third
   * - Retry pass: only failed shipments are retried separately
   * - Instant row & DB state updates
   */
  async syncBulkOptimized(
    orders: LogisticsOrder[],
    onProgress: (stats: {
      completed: number;
      total: number;
      checking: number;
      queued: number;
      success: number;
      failed: number;
      phase: 'first-pass' | 'retrying' | 'complete';
      retryCount?: number;
    }) => void
  ): Promise<{ success: number; failed: number }> {
    const { isCourierActive } = await import('../../config/courierConfig');
    
    // 1. Filter out already Delivered and RTO terminal states, along with non-ST or empty AWB
    const eligibleOrders = orders.filter(o => {
      const isStCourier = isCourierActive(o.courier);
      const hasAwb = o.awbNumber && o.awbNumber.trim() !== '';
      if (!isStCourier || !hasAwb) return false;
      
      const statusLower = (o.status || '').toLowerCase().trim();
      const isDelivered = statusLower.includes('delivered');
      const isRto = statusLower.includes('rto') || statusLower.includes('returned') || statusLower.includes('return to origin');
      
      return !isDelivered && !isRto;
    });

    if (eligibleOrders.length === 0) {
      onProgress({
        completed: 0,
        total: 0,
        checking: 0,
        queued: 0,
        success: 0,
        failed: 0,
        phase: 'complete'
      });
      return { success: 0, failed: 0 };
    }

    // 2. Sort by priority: Not Tracked -> Sync Failed -> rest
    const getPriority = (o: LogisticsOrder) => {
      if (o.stage === 'order_data') return 1;
      const statusLower = (o.status || '').toLowerCase();
      if (statusLower.includes('failed') || statusLower.includes('unable') || o.trackingError) return 2;
      return 3;
    };
    const sortedOrders = [...eligibleOrders].sort((a, b) => getPriority(a) - getPriority(b));

    const total = sortedOrders.length;
    let completed = 0;
    let success = 0;
    let failed = 0;
    let checking = 0;
    let queued = total;
    let phase: 'first-pass' | 'retrying' | 'complete' = 'first-pass';

    // 3. Mark all as queued in DB
    await db.transaction('rw', db.logistics_orders, async () => {
      for (const order of sortedOrders) {
        const isNew = order.stage === 'order_data';
        await db.logistics_orders.update(order.id!, {
          stage: 'tracking',
          status: isNew ? 'Pending' : order.status,
          syncState: 'queued'
        });
      }
    });

    onProgress({ completed, total, checking, queued, success, failed, phase });

    // Adaptive concurrency settings
    let currentConcurrency = 6;
    const minConcurrency = 2;
    const maxConcurrency = 8;
    let consecutiveSuccesses = 0;

    // Retry list
    const retryQueue: typeof sortedOrders = [];

    // Helper to process a single order
    const processOrder = async (order: LogisticsOrder, isRetry: boolean, retryAttempt?: number) => {
      checking++;
      queued--;
      onProgress({ completed, total, checking, queued, success, failed, phase, retryCount: retryAttempt });

      try {
        const timeoutMs = isRetry ? 20000 : 13000;
        const maxAttempts = 1;
        
        const res = await trackingEngine.syncOrder(order.id!, order.status, {
          timeoutMs,
          maxAttempts
        });

        if (res.success) {
          success++;
          consecutiveSuccesses++;
          if (consecutiveSuccesses >= 3 && currentConcurrency < maxConcurrency) {
            currentConcurrency = Math.min(maxConcurrency, currentConcurrency + 1);
            consecutiveSuccesses = 0;
          }
        } else {
          consecutiveSuccesses = 0;
          const errStr = String(res.error || '').toLowerCase();
          const isThrottle = errStr.includes('429') || errStr.includes('403') || errStr.includes('blocked') || errStr.includes('timeout') || errStr.includes('abort');
          if (isThrottle) {
            currentConcurrency = Math.max(minConcurrency, currentConcurrency - 2);
          }

          if (!isRetry) {
            retryQueue.push(order);
          } else {
            failed++;
          }
        }
      } catch (err) {
        consecutiveSuccesses = 0;
        if (!isRetry) {
          retryQueue.push(order);
        } else {
          failed++;
        }
      } finally {
        checking--;
        if (!isRetry || (isRetry && !retryQueue.includes(order))) {
          completed++;
        }
        onProgress({ completed, total, checking, queued, success, failed, phase, retryCount: retryAttempt });
      }
    };

    // Worker pool orchestration function
    const runQueue = async (queue: typeof sortedOrders, isRetry: boolean, retryAttempt?: number) => {
      let index = 0;
      const activePromises: Promise<void>[] = [];

      const startNextWorker = async (): Promise<void> => {
        if (index >= queue.length) return;
        const currentItem = queue[index++];
        
        // Stagger starts by 100ms - 200ms
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
        
        const promise = processOrder(currentItem, isRetry, retryAttempt);
        activePromises.push(promise);
        
        promise.then(() => {
          activePromises.splice(activePromises.indexOf(promise), 1);
        });

        if (activePromises.length < currentConcurrency && index < queue.length) {
          return startNextWorker();
        } else {
          if (activePromises.length >= currentConcurrency) {
            await Promise.race(activePromises);
          }
          return startNextWorker();
        }
      };

      const initialSpawns: Promise<void>[] = [];
      for (let i = 0; i < currentConcurrency && i < queue.length; i++) {
        initialSpawns.push(startNextWorker());
      }
      await Promise.all(initialSpawns);
      await Promise.all(activePromises);
    };

    // First Pass
    await runQueue(sortedOrders, false);

    // If there are failures, run Retries
    if (retryQueue.length > 0) {
      phase = 'retrying';
      queued = retryQueue.length;
      completed = total - retryQueue.length;
      const firstRetryList = [...retryQueue];
      retryQueue.length = 0;
      
      await db.transaction('rw', db.logistics_orders, async () => {
        for (const order of firstRetryList) {
          await db.logistics_orders.update(order.id!, {
            syncState: 'queued'
          });
        }
      });

      await runQueue(firstRetryList, true, 2);

      // Attempt 3
      if (retryQueue.length > 0) {
        queued = retryQueue.length;
        completed = total - retryQueue.length;
        const secondRetryList = [...retryQueue];
        retryQueue.length = 0;

        await db.transaction('rw', db.logistics_orders, async () => {
          for (const order of secondRetryList) {
            await db.logistics_orders.update(order.id!, {
              syncState: 'queued'
            });
          }
        });

        await runQueue(secondRetryList, true, 3);
      }
    }

    phase = 'complete';
    onProgress({ completed: total, total, checking: 0, queued: 0, success, failed, phase });

    // Clean up syncState
    await db.transaction('rw', db.logistics_orders, async () => {
      for (const order of sortedOrders) {
        await db.logistics_orders.update(order.id!, {
          syncState: 'idle'
        });
      }
    });

    return { success, failed };
  }
};
