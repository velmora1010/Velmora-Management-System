import type { LogisticsOrder } from '../types/logistics';

export interface StateMetrics {
  state: string;
  prepaidTotal: number;
  codTotal: number;
  totalOrder: number;
  codDelivered: number;
  prepaidDelivered: number;
  codYet: number;
  prepaidYet: number;
  prepaidRTO: number;
  codRTO: number;
  totalRTO: number;
}

/**
 * Normalizes input state string to canonical names.
 */
export const normalizeState = (stateStr: string): string => {
  if (!stateStr) return 'Others';
  const s = stateStr.trim().toLowerCase().replace(/\./g, '');
  if (s === 'tamil nadu' || s === 'tn' || s === 'tamilnadu') return 'Tamil Nadu';
  if (s === 'kerala' || s === 'kl') return 'Kerala';
  if (s === 'karnataka' || s === 'ka') return 'Karnataka';
  if (s === 'andhra pradesh' || s === 'ap') return 'Andhra Pradesh';
  if (s === 'telangana' || s === 'ts' || s === 'tg') return 'Telangana';
  return 'Others';
};

/**
 * Checks if status belongs to RTO categories.
 * Substrings: RTO, Return To Origin, Returned, Return Initiated, Undelivered
 */
export const isRTOStatus = (statusStr: string): boolean => {
  if (!statusStr) return false;
  const s = statusStr.trim().toLowerCase();
  return (
    s.includes('rto') ||
    s.includes('return to origin') ||
    s.includes('returned') ||
    s.includes('return initiated') ||
    s.includes('undelivered')
  );
};

/**
 * Calculates state-wise metrics from a list of LogisticsOrders.
 */
export const calculateStateSummary = (orders: LogisticsOrder[]): Record<string, StateMetrics> => {
  const states = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Others'];
  
  // Initialize summary buckets
  const summary: Record<string, StateMetrics> = {};
  for (const st of states) {
    summary[st] = {
      state: st,
      prepaidTotal: 0,
      codTotal: 0,
      totalOrder: 0,
      codDelivered: 0,
      prepaidDelivered: 0,
      codYet: 0,
      prepaidYet: 0,
      prepaidRTO: 0,
      codRTO: 0,
      totalRTO: 0
    };
  }

  for (const ord of orders) {
    // Exclude COD Restore stage
    if (ord.stage === 'trash') continue;

    const normalized = normalizeState(ord.state || '');
    const isCod = ord.orderType === 'COD';
    const bucket = summary[normalized] || summary['Others'];

    // 1. Accumulate Total Orders (from both order_data and tracking stages)
    if (isCod) {
      bucket.codTotal++;
    } else {
      bucket.prepaidTotal++;
    }
    bucket.totalOrder++;

    // 2. Classify by Status ONLY for stage = "tracking"
    if (ord.stage === 'tracking') {
      const status = ord.status ? ord.status.toLowerCase().trim() : '';
      const isDelivered = status.includes('delivered');

      if (isDelivered) {
        if (isCod) {
          bucket.codDelivered++;
        } else {
          bucket.prepaidDelivered++;
        }
      } else if (isRTOStatus(ord.status || '')) {
        if (isCod) {
          bucket.codRTO++;
        } else {
          bucket.prepaidRTO++;
        }
        bucket.totalRTO++;
      } else {
        // Yet to Delivered if stage is tracking and status is blank/Transit/Pending/Unable to fetch/any non-delivered & non-RTO
        if (isCod) {
          bucket.codYet++;
        } else {
          bucket.prepaidYet++;
        }
      }
    }
  }

  return summary;
};
