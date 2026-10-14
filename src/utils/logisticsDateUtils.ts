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
 * 3. Formatted date strings (e.g. "13/04/2026", "13-04-2026", "13 Apr 2026")
 * 4. Millisecond timestamps (13-digit numbers)
 * 5. Rejects non-date numbers (AWBs, phone numbers, order IDs like 1132)
 * 6. Returns clean empty string for null, undefined, NaN, or invalid values without crashing
 */
export function parseAndFormatLogisticsDate(val: any): FormattedDateResult {
  if (val === null || val === undefined || val === '') {
    return { isoDate: '', displayDate: '', timeStr: '', raw: val };
  }

  const str = String(val).trim();
  if (
    str === '' || 
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

  // 2. Check for DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2060) {
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const displayDate = `${day} ${MONTH_NAMES[month - 1]} ${year}`;
      return { isoDate, displayDate, displayDateTime: displayDate, raw: val };
    }
  }

  // 3. ISO format or standard date string with separators
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
