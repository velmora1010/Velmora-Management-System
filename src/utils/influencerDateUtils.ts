/**
 * Shared date utility for Influencer Logistics, Campaign Influencers, Status Tracking, and Calendar.
 * Handles calendar-safe arithmetic without UTC conversion drift.
 */

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, sept: 9, october: 10, november: 11, december: 12
};

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses any incoming date representation (string, Date, ISO, Excel serial, DD-MMM-YYYY, MMM DD, etc.)
 * into a canonical YYYY-MM-DD string using calendar values (no UTC timezone shifts).
 */
export const parseToYMD = (val: any, defaultYear = 2026): string => {
  if (val === undefined || val === null) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    let y = val.getFullYear();
    if (y <= 2010) y = defaultYear;
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (!str || str === '—' || str === '-' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return '';

  // Handle Excel serial date numbers (e.g. 46305 -> 2026-10-10)
  const numVal = typeof val === 'number' ? val : (/^\d{5}$/.test(str) ? Number(str) : NaN);
  if (!isNaN(numVal) && numVal >= 20000 && numVal <= 70000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const dateFromSerial = new Date(excelEpoch.getTime() + numVal * 86400 * 1000);
    if (!isNaN(dateFromSerial.getTime())) {
      const y = dateFromSerial.getUTCFullYear();
      const m = String(dateFromSerial.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateFromSerial.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    let y = parseInt(isoMatch[1], 10);
    if (isNaN(y) || y <= 2010) y = defaultYear;
    return `${y}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`;
  }

  const dmMatch = str.match(/^(\d{1,2})[\s\-\/]+([a-zA-Z]+)(?:[\s\-\/]+(\d{2,4}))?$/);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const mStr = dmMatch[2].toLowerCase();
    const month = MONTH_NAME_MAP[mStr] || MONTH_NAME_MAP[mStr.slice(0, 3)];
    let year = dmMatch[3] ? (dmMatch[3].length === 2 ? 2000 + parseInt(dmMatch[3], 10) : parseInt(dmMatch[3], 10)) : defaultYear;
    if (isNaN(year) || year <= 2010) year = defaultYear;
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const mdMatch = str.match(/^([a-zA-Z]+)[\s\-\/]+(\d{1,2})(?:[\s\-\/]+(\d{2,4}))?$/);
  if (mdMatch) {
    const mStr = mdMatch[1].toLowerCase();
    const month = MONTH_NAME_MAP[mStr] || MONTH_NAME_MAP[mStr.slice(0, 3)];
    const day = parseInt(mdMatch[2], 10);
    let year = mdMatch[3] ? (mdMatch[3].length === 2 ? 2000 + parseInt(mdMatch[3], 10) : parseInt(mdMatch[3], 10)) : defaultYear;
    if (isNaN(year) || year <= 2010) year = defaultYear;
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = dmyMatch[3].length === 2 ? 2000 + parseInt(dmyMatch[3], 10) : parseInt(dmyMatch[3], 10);
    if (isNaN(year) || year <= 2010) year = defaultYear;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const dObj = new Date(str);
  if (!isNaN(dObj.getTime())) {
    let y = dObj.getFullYear();
    if (y <= 2010) y = defaultYear;
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const d = String(dObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
};

/**
 * Formats a canonical or local date string into "DD MMM YYYY" (e.g. "23 Sep 2026").
 */
export const formatDisplayDateLocal = (dateStr: string | null | undefined, defaultYear = 2026): string => {
  if (!dateStr || !String(dateStr).trim()) return 'Not Assigned';
  const ymd = parseToYMD(dateStr, defaultYear);
  if (!ymd) return String(dateStr);
  const parts = ymd.split('-');
  if (parts.length !== 3) return String(dateStr);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const monthName = MONTH_NAMES_SHORT[month - 1] || '';
  const dd = String(day).padStart(2, '0');
  return `${dd} ${monthName} ${year}`;
};

/**
 * Calculates Post Date from Draft Date using calendar-safe date arithmetic:
 * Post Date = Draft Date + 3 CALENDAR DAYS
 * e.g. 19 Sep 2026 -> 22 Sep 2026
 *      20 Sep 2026 -> 23 Sep 2026
 *      21 Sep 2026 -> 24 Sep 2026
 */
export const calculatePostDateFromDraft = (draftDateStr: string | null | undefined, defaultYear = 2026): string => {
  const ymd = parseToYMD(draftDateStr, defaultYear);
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 3);
  const resY = dt.getUTCFullYear();
  const resM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(dt.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
};

/**
 * Calculates Draft Date from Post Date using calendar-safe date arithmetic:
 * Draft Date = Post Date - 3 CALENDAR DAYS
 */
export const calculateDraftDate = (postDateStr: string | null | undefined, defaultYear = 2026): string => {
  const ymd = parseToYMD(postDateStr, defaultYear);
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 3);
  const resY = dt.getUTCFullYear();
  const resM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(dt.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
};

/**
 * Formats an ISO timestamp for display in History entries (e.g. "15 Sep 2026, 05:00 PM").
 */
export const formatHistoryTimestamp = (isoStr?: string | null): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mmm = months[d.getMonth()];
    const yyyy = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${dd} ${mmm} ${yyyy}, ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch (e) {
    return isoStr;
  }
};

export interface CanonicalPostDateItem {
  video_number: number;
  post_date: string;            // YYYY-MM-DD
  draft_date: string;           // YYYY-MM-DD
  formatted_post_date: string;  // e.g. "10 Oct 2026"
  formatted_draft_date: string; // e.g. "07 Oct 2026"
}

/**
 * Single source of truth resolver for Campaign Influencer Post Date Schedule.
 * Used identically by Campaign Influencer Post Date Card and Campaign Calendar.
 */
export const getCanonicalInfluencerPostDates = (
  influencer?: { postDates?: Array<{ video_number?: number | string; post_date?: string | null; draft_date?: string | null }> | null } | null,
  defaultYear = 2026
): CanonicalPostDateItem[] => {
  if (!influencer || !Array.isArray(influencer.postDates)) return [];

  const dates = influencer.postDates
    .filter(d => d && d.post_date && String(d.post_date).trim() !== '')
    .slice()
    .sort((a, b) => (Number(a.video_number) || 0) - (Number(b.video_number) || 0));

  return dates.map((d, i) => {
    const vNum = Number(d.video_number) || (i + 1);
    const postDateYmd = parseToYMD(d.post_date, defaultYear);
    const draftDateYmd = d.draft_date 
      ? parseToYMD(d.draft_date, defaultYear) 
      : (postDateYmd ? calculateDraftDate(postDateYmd, defaultYear) : '');

    return {
      video_number: vNum,
      post_date: postDateYmd,
      draft_date: draftDateYmd,
      formatted_post_date: formatDisplayDateLocal(postDateYmd, defaultYear),
      formatted_draft_date: formatDisplayDateLocal(draftDateYmd, defaultYear)
    };
  });
};

