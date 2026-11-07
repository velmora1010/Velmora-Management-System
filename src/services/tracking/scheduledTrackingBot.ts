import { bulkTrackingSyncService } from './bulkTrackingSyncService';

const SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const STORAGE_KEY = 'velmora_last_tracking_sync';

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

  public init() {
    if (this.timer) return;

    // Check if sync is overdue on launch
    const lastSyncStr = localStorage.getItem(STORAGE_KEY);
    const lastSyncTime = lastSyncStr ? new Date(lastSyncStr).getTime() : 0;
    const now = Date.now();

    if (now - lastSyncTime > SYNC_INTERVAL_MS) {
      // Run in background after 10s initial warmup
      setTimeout(() => {
        this.runBatch().catch(err => {
          console.warn('[TrackingBot] Warmup sync error:', err);
        });
      }, 10000);
    }

    // Schedule recurring job every 4 hours
    this.timer = setInterval(() => {
      this.runBatch().catch(err => {
        console.warn('[TrackingBot] Interval sync error:', err);
      });
    }, SYNC_INTERVAL_MS);

    console.info('[TrackingBot] Scheduled tracking sync bot initialized (4-hour cycle)');
  }

  public async runBatch(): Promise<ScheduledSyncReport> {
    const currentState = bulkTrackingSyncService.getState();
    if (currentState.status === 'running') {
      console.info('[TrackingBot] Sync already running via bulk tracking service, skipping overlapping run.');
      return {
        timestamp: new Date().toISOString(),
        totalCandidates: currentState.totalCandidates,
        processed: currentState.processed,
        updated: currentState.updated,
        failed: currentState.failed,
        skipped: currentState.alreadyUpToDate
      };
    }

    const state = await bulkTrackingSyncService.startBulkSync();
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());

    return {
      timestamp: state.startedAt || new Date().toISOString(),
      totalCandidates: state.totalCandidates,
      processed: state.processed,
      updated: state.updated,
      failed: state.failed,
      skipped: state.alreadyUpToDate
    };
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
