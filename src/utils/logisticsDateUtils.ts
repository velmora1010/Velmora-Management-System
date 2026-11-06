import * as XLSX from 'xlsx';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface FormattedDateResult {
  isoDate: string;        // e.g. "2026-04-13" or ""
  displayDate: string;    // e.g. "13 Apr 2026" or ""
  timeStr?: string;       // e.g. "10:24 AM" or ""
  displayDateTime?: string; // e.g. "13 Apr 2026, 10:00 AM"
  raw: any;
}

/**
 * Universal date parser and formatter for Logistics customer orders and shipments.
 * Handles:
 * 1. Excel numeric serial dates (e.g. 46125.41683425926 or "46125")
 * 2. ISO date strings (e.g. "2026-04-13T10:00:14.000Z", "2026-04-13")
 * 3. Indian Logistics format (handles 2-digit & 4-digit years):
 *    - "1/11/26", "27/10/2026", "8/10/26", "12/10/26", "5/9/26", "7/10/26 14:30:00"
 * 4. Named month strings (e.g. "13 Apr 2026", "1 Nov 2026")
 * 5. Millisecond timestamps (13-digit numbers)
 * 6. Rejects non-date numbers (AWBs, phone numbers, order IDs like 1132)
 * 7. Returns clean empty string for null, undefined, NaN, or invalid values without crashing
 */
export function parseAndFormatLogisticsDate(val: any): FormattedDateResult {
  if (val === null || val === undefined || val === '') {
    return { isoDate: '', displayDate: '', timeStr: '', raw: val };
  }

  const str = String(val).trim();
  if (
    str === '' || 
    str === '-' ||
    str.toLowerCase() === 'null' || 
    str.toLowerCase() === 'undefined' || 
    str.toLowerCase() === 'nan' ||
    str.toLowerCase() === 'invalid date'
  ) {
    return { isoDate: '', displayDate: '', timeStr: '', raw: val };
  }

  // 1. Check for numeric string or number (Excel serial or Unix timestamp)
  const num = Number(str);
  if (!isNaN(num)) {
    // Pure integers under 35000 (e.g. order IDs like 1132, prices like 449) are NOT dates!
    if (num < 35000) {
      return { isoDate: '', displayDate: '', timeStr: '', raw: val };
    }

    // Modern Excel serial dates (~1995 to ~2055, corresponding to serials 35000 to 60000)
    if (num >= 35000 && num <= 60000) {
      try {
        const p = XLSX.SSF.parse_date_code(num);
        if (p && p.y && p.m && p.d && p.y >= 1990 && p.y <= 2060) {
          const isoDate = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
          const displayDate = `${p.d} ${MONTH_NAMES[p.m - 1]} ${p.y}`;
          
          let displayDateTime = displayDate;
          let timeStr = '';
          if (p.H !== undefined && (p.H > 0 || p.M > 0)) {
            const hour12 = p.H % 12 || 12;
            const ampm = p.H >= 12 ? 'PM' : 'AM';
            const minStr = String(p.M || 0).padStart(2, '0');
            timeStr = `${hour12}:${minStr} ${ampm}`;
            displayDateTime = `${displayDate}, ${timeStr}`;
          }

          return { isoDate, displayDate, timeStr, displayDateTime, raw: val };
        }
      } catch (e) {
        // Fall through
      }
    }

    // Unix millisecond timestamp (13 digits, ~2001 to ~2065)
    if (num >= 1000000000000 && num <= 3000000000000) {
      const d = new Date(num);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const displayDate = `${day} ${MONTH_NAMES[m - 1]} ${y}`;
        return { isoDate, displayDate, displayDateTime: displayDate, raw: val };
      }
    }

    // Large numbers (e.g. 10-digit phone numbers or AWBs) are NOT dates
    return { isoDate: '', displayDate: '', raw: val };
  }

  // 2. ISO format: YYYY-MM-DD or YYYY/MM/DD (with optional time)
  // Parsing directly avoids timezone shifting bugs (e.g. UTC 00:00 shifting to previous day)
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2060) {
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const displayDate = `${day} ${MONTH_NAMES[month - 1]} ${year}`;
      let timeStr = '';
      let displayDateTime = displayDate;
      if (isoMatch[4] !== undefined && isoMatch[5] !== undefined) {
        const hours = parseInt(isoMatch[4], 10);
        const mins = parseInt(isoMatch[5], 10);
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        timeStr = `${hour12}:${String(mins).padStart(2, '0')} ${ampm}`;
        displayDateTime = `${displayDate}, ${timeStr}`;
      }
      return { isoDate, displayDate, timeStr, displayDateTime, raw: val };
    }
  }

  // 3. Indian Logistics format: Day/Month/Year or Day-Month-Year (handles 2-digit & 4-digit years)
  // e.g. "1/11/26", "27/10/2026", "8/10/26", "12/10/26", "5/9/26", "7/10/26 14:30:00"
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const rawYear = parseInt(dmyMatch[3], 10);
    const year = rawYear < 100 ? (rawYear >= 70 ? 1900 + rawYear : 2000 + rawYear) : rawYear;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2060) {
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const displayDate = `${day} ${MONTH_NAMES[month - 1]} ${year}`;
      let timeStr = '';
      let displayDateTime = displayDate;

      if (dmyMatch[4] !== undefined && dmyMatch[5] !== undefined) {
        let hours = parseInt(dmyMatch[4], 10);
        const mins = parseInt(dmyMatch[5], 10);
        const ampmMarker = (dmyMatch[7] || '').toUpperCase();
        if (ampmMarker === 'PM' && hours < 12) hours += 12;
        if (ampmMarker === 'AM' && hours === 12) hours = 0;
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        timeStr = `${hour12}:${String(mins).padStart(2, '0')} ${ampm}`;
        displayDateTime = `${displayDate}, ${timeStr}`;
      }

      return { isoDate, displayDate, timeStr, displayDateTime, raw: val };
    }
  }

  // 4. Formatted string with text month (e.g. "13 Apr 2026", "11 Jan 2026", "13-Apr-2026")
  const textMonthMatch = str.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-](\d{2,4})/);
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const monthStr = textMonthMatch[2].toLowerCase().slice(0, 3);
    const rawYear = parseInt(textMonthMatch[3], 10);
    const year = rawYear < 100 ? (rawYear >= 70 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
    const monthIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === monthStr);

    if (monthIdx !== -1 && day >= 1 && day <= 31 && year >= 1990 && year <= 2060) {
      const month = monthIdx + 1;
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const displayDate = `${day} ${MONTH_NAMES[monthIdx]} ${year}`;
      return { isoDate, displayDate, displayDateTime: displayDate, raw: val };
    }
  }

  // 5. Fallback for standard date strings
  if (str.includes('-') || str.includes('/') || str.includes(',') || str.includes(' ')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      if (y >= 1990 && y <= 2060) {
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const displayDate = `${day} ${MONTH_NAMES[m - 1]} ${y}`;
        
        let displayDateTime = displayDate;
        let timeStr = '';
        const hours = d.getHours();
        const minutes = d.getMinutes();
        if (hours > 0 || minutes > 0) {
          const hour12 = hours % 12 || 12;
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const minStr = String(minutes).padStart(2, '0');
          timeStr = `${hour12}:${minStr} ${ampm}`;
          displayDateTime = `${displayDate}, ${timeStr}`;
        }

        return { isoDate, displayDate, timeStr, displayDateTime, raw: val };
      }
    }
  }

  return { isoDate: '', displayDate: '', raw: val };
}
