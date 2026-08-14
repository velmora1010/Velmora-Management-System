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
 * Extracts a state abbreviation from a description string if present.
 */
export const extractStateFromText = (text: string): string | null => {
  if (!text) return null;
  const cleanText = text.trim().toUpperCase();
  
  // Check for suffix patterns like ", TN"
  const matches = cleanText.match(/,\s*([A-Z]{2})\b/);
  if (matches && matches[1]) {
    return matches[1];
  }
  
  const states = ['TN', 'KL', 'KA', 'AP', 'TS', 'MH', 'WB'];
  for (const st of states) {
    const regex = new RegExp(`\\b${st}\\b`);
    if (regex.test(cleanText)) {
      return st;
    }
  }
  return null;
};

/**
 * Normalizes input state string to canonical names.
 */
export const normalizeState = (stateStr: string, lastEventStr?: string): string => {
  let sStr = stateStr || '';
  if (!sStr || sStr.toLowerCase() === 'unknown') {
    if (lastEventStr) {
      const extracted = extractStateFromText(lastEventStr);
      if (extracted) {
        sStr = extracted;
      }
    }
  }
  
  if (!sStr) return 'Unknown';
  const s = sStr.trim().toLowerCase().replace(/\./g, '').trim();
  if (!s || s === 'unknown') return 'Unknown';
  
  if (s === 'tn' || s === 'tamilnadu' || s === 'tamil nadu') return 'Tamil Nadu';
  if (s === 'kl' || s === 'kerala') return 'Kerala';
  if (s === 'ka' || s === 'karnataka') return 'Karnataka';
  if (s === 'ap' || s === 'andhra' || s === 'andhra pradesh' || s === 'andhrapradesh') return 'Andhra Pradesh';
  if (s === 'ts' || s === 'tg' || s === 'telangana') return 'Telangana';
  if (s === 'mh' || s === 'maharashtra') return 'Maharashtra';
  if (s === 'wb' || s === 'west bengal' || s === 'westbengal') return 'West Bengal';
  
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
  const states = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Maharashtra', 'West Bengal', 'Unknown', 'Others'];
  
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

    const normalized = normalizeState(ord.state || '', ord.lastEvent);
    const isCod = ord.orderType && ord.orderType.trim().toUpperCase() === 'COD';
    const isPrepaid = ord.orderType && ord.orderType.trim().toUpperCase() === 'PREPAID';
    const bucket = summary[normalized] || summary['Others'];

    // 1. Accumulate Total Orders (from both order_data and tracking stages)
    if (isCod) {
      bucket.codTotal++;
    } else if (isPrepaid) {
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
        } else if (isPrepaid) {
          bucket.prepaidDelivered++;
        }
      } else if (isRTOStatus(ord.status || '')) {
        if (isCod) {
          bucket.codRTO++;
        } else if (isPrepaid) {
          bucket.prepaidRTO++;
        }
        bucket.totalRTO++;
      } else {
        // Yet to Delivered if stage is tracking and status is blank/Transit/Pending/Unable to fetch/any non-delivered & non-RTO
        if (isCod) {
          bucket.codYet++;
        } else if (isPrepaid) {
          bucket.prepaidYet++;
        }
      }
    }
  }

  return summary;
};
