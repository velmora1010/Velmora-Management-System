export type InfluencerStatusType = 'active' | 'other' | 'recycle_bin';

export const getInfluencerStatus = (value: any): InfluencerStatusType => {
  if (value === 'other') return 'other';
  if (value === true || value === 'true' || value === 1 || value === '1') return 'recycle_bin';
  return 'active';
};

export const isArchived = (value: any): boolean => {
  return getInfluencerStatus(value) === 'recycle_bin';
};

export const isOtherStatus = (value: any): boolean => {
  return getInfluencerStatus(value) === 'other';
};

export const isActiveStatus = (value: any): boolean => {
  return getInfluencerStatus(value) === 'active';
};

export type InfluencerDispatchStage = 'pending' | 'prepare_dispatch' | 'dispatched';

/**
 * Returns true if an influencer has reported a product issue and requires a replacement shipment (re-dispatch).
 */
export const isInfluencerReDispatch = (
  inf: { dispatchDetails?: any; id?: string | number; dispatch_status?: string } | null | undefined,
  dispatchRecords?: any[]
): boolean => {
  if (!inf) return false;
  const dispatch = inf.dispatchDetails || (dispatchRecords && dispatchRecords.find(d => String(d.influencer_id) === String(inf.id)));
  const status = (dispatch?.dispatch_status || (inf as any).dispatch_status || '').trim().toLowerCase();
  return status === 're_dispatch' || status === 're-dispatch' || status === 'redispatch';
};

/**
 * Returns true ONLY when actual dispatch has been successfully completed and confirmed (status is 'dispatched' or 'tracking').
 * If an issue was reported (re_dispatch), returns false so the influencer can be dispatched again.
 */
export const isInfluencerDispatched = (
  inf: { dispatchDetails?: any; id?: string | number; dispatch_status?: string } | null | undefined,
  dispatchRecords?: any[]
): boolean => {
  if (!inf) return false;
  if (isInfluencerReDispatch(inf, dispatchRecords)) return false;
  const dispatch = inf.dispatchDetails || (dispatchRecords && dispatchRecords.find(d => String(d.influencer_id) === String(inf.id)));
  if (!dispatch) return false;
  const status = (dispatch.dispatch_status || (inf as any).dispatch_status || '').trim().toLowerCase();
  return status === 'dispatched' || status === 'tracking';
};

/**
 * Returns true when an influencer has been moved into Prepare Dispatch (or a batch) but has NOT yet been dispatched.
 */
export const isInfluencerInPrepareDispatch = (
  inf: { dispatchDetails?: any; id?: string | number; dispatch_status?: string } | null | undefined,
  dispatchRecords?: any[]
): boolean => {
  if (!inf) return false;
  if (isInfluencerDispatched(inf, dispatchRecords)) return false;
  const dispatch = inf.dispatchDetails || (dispatchRecords && dispatchRecords.find(d => String(d.influencer_id) === String(inf.id)));
  if (!dispatch) return false;
  const status = (dispatch.dispatch_status || (inf as any).dispatch_status || '').trim().toLowerCase();
  return status === 'prepare_dispatch' || status === 'ready to dispatch';
};

/**
 * Resolves the current logistics stage of an influencer:
 * - 'dispatched': Confirmed shipped/dispatched or in tracking
 * - 'prepare_dispatch': In a batch / waiting for dispatch
 * - 'pending': Normal active logistics pending selection/preparation (including Re-Dispatch)
 */
export const getInfluencerLogisticsStage = (
  inf: { dispatchDetails?: any; id?: string | number } | null | undefined,
  dispatchRecords?: any[]
): InfluencerDispatchStage => {
  if (isInfluencerDispatched(inf, dispatchRecords)) return 'dispatched';
  if (isInfluencerInPrepareDispatch(inf, dispatchRecords)) return 'prepare_dispatch';
  return 'pending';
};

/**
 * Returns a date formatted as YYYY-MM-DD in the user's LOCAL timezone.
 * Avoids UTC timezone offsets (e.g. toISOString().split('T')[0]) which can cause
 * the date to shift to yesterday.
 */
export const getLocalDateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

/**
 * Normalizes any date string (ISO, YYYY-MM-DD, or DD-Mon-YYYY such as "23-Sep-2026")
 * into a standard local YYYY-MM-DD string without UTC shifting.
 */
export const normalizeToLocalDateKey = (dateStr?: string | null): string => {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD-Mon-YYYY (e.g. 23-Sep-2026 or 23 Sep 2026 or 23-September-2026)
  const dMyMatch = trimmed.match(/^(\d{1,2})[-/\s]([A-Za-z]+)[-/\s](\d{4})$/);
  if (dMyMatch) {
    const day = parseInt(dMyMatch[1], 10);
    const monStr = dMyMatch[2].toLowerCase().slice(0, 3);
    const year = parseInt(dMyMatch[3], 10);
    if (monStr in MONTH_MAP && !isNaN(day) && !isNaN(year)) {
      const d = new Date(year, MONTH_MAP[monStr], day);
      return getLocalDateKey(d);
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d = new Date(year, month, day);
      return getLocalDateKey(d);
    }
  }

  // Standard fallback parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return getLocalDateKey(parsed);
  }

  return '';
};

/**
 * Adds specified number of days to a date string using local date math.
 */
export const addDaysToDateString = (dateStr: string, days: number = 4): string => {
  if (!dateStr) return '';
  const normalized = normalizeToLocalDateKey(dateStr);
  if (!normalized) return '';
  const [y, m, d] = normalized.split('-').map(Number);
  const target = new Date(y, m - 1, d + days);
  return getLocalDateKey(target);
};

