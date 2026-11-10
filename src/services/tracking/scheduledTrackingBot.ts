import { bulkTrackingSyncService } from './bulkTrackingSyncService';

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
    // Automatic bot tracking is retired in favor of uploaded courier tracking reports.
    // Do not initiate background sync intervals, warmup timers, or auto-retries.
    console.info('[TrackingBot] Automatic bot tracking is disabled. Shipment tracking uses uploaded courier reports.');
  }

  public async runBatch(): Promise<ScheduledSyncReport> {
    const currentState = bulkTrackingSyncService.getState();
    return {
      timestamp: new Date().toISOString(),
      totalCandidates: currentState.totalCandidates,
      processed: currentState.processed,
      updated: currentState.updated,
      failed: currentState.failed,
      skipped: currentState.alreadyUpToDate
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
