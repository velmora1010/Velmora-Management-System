import * as XLSX from 'xlsx';
import { ResearchInputProfile, ProfileResearchResult } from '../types/rndTypes';
import {
  extractOriginalCategoryFromRow,
  normalizeInfluencerCode,
  normalizeUsernameForLookup
} from './excelParser';

export const RND_EXPORT_COLUMNS = [
  'Influencer Code',
  'Username',
  'Profile Link',
  'Followers',
  'Video 1',
  'Video 2',
  'Video 3',
  'Video 4',
  'Video 5',
  'Video 6',
  'Video 7',
  'Video 8',
  'Video 9',
  'Video 10',
  'Video 11',
  'Video 12',
  'Video 13',
  'Video 14',
  'Video 15',
  'Average Views',
  'Category',
  'Research Status'
] as const;

export type ExportResearchStatus = 'Completed' | 'Partial' | 'Failed' | 'Not Started';

export type InfluencerCategoryCode =
  | 'C1L1'
  | 'C1L2'
  | 'C2L1'
  | 'C2L2'
  | 'C3L1'
  | 'C3L2'
  | 'C4L1'
  | 'C4L2'
  | 'NotEnoughReels'
  | 'Uncategorized';

/**
 * Exact reproduction of `categorize(views)` from `igviews.py`:
 * 1. Filter out missing/null/undefined/NaN/negative values (never treat missing as 0).
 * 2. If len(views) < 7, return 'NotEnoughReels'.
 * 3. Count how many valid view values satisfy each threshold:
 *    C1L1 >= 1,000,000; C1L2 >= 500,000; C2L1 >= 250,000; C2L2 >= 100,000;
 *    C3L1 >= 50,000; C3L2 >= 25,000; C4L1 >= 10,000.
 * 4. Check C1L1, C1L2, C2L1, C2L2, C3L1, C3L2, C4L1 in order; if count >= 7, return immediately.
 * 5. Calculate below_10k_count = sum(v < 10_000 for v in views).
 * 6. If below_10k_count >= 7, return 'C4L2'.
 * 7. Otherwise, return 'Uncategorized'.
 */
export function categorize(
  views: ReadonlyArray<number | null | undefined> | null | undefined
): InfluencerCategoryCode {
  const validViews = Array.isArray(views)
    ? views.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0)
    : [];

  if (validViews.length < 7) {
    return 'NotEnoughReels';
  }

  const counts = {
    C1L1: validViews.filter(v => v >= 1_000_000).length,
    C1L2: validViews.filter(v => v >= 500_000).length,
    C2L1: validViews.filter(v => v >= 250_000).length,
    C2L2: validViews.filter(v => v >= 100_000).length,
    C3L1: validViews.filter(v => v >= 50_000).length,
    C3L2: validViews.filter(v => v >= 25_000).length,
    C4L1: validViews.filter(v => v >= 10_000).length
  };
  const below_10k_count = validViews.filter(v => v < 10_000).length;

  if (counts.C1L1 >= 7) {
    return 'C1L1';
  } else if (counts.C1L2 >= 7) {
    return 'C1L2';
  } else if (counts.C2L1 >= 7) {
    return 'C2L1';
  } else if (counts.C2L2 >= 7) {
    return 'C2L2';
  } else if (counts.C3L1 >= 7) {
    return 'C3L1';
  } else if (counts.C3L2 >= 7) {
    return 'C3L2';
  } else if (counts.C4L1 >= 7) {
    return 'C4L1';
  } else if (below_10k_count >= 7) {
    return 'C4L2';
  } else {
    return 'Uncategorized';
  }
}

/**
 * Extract valid non-pinned Reel view counts from a ProfileResearchResult.
 * Never treats missing/null view counts as 0.
 */
export function extractValidViewsFromResult(
  res?: Partial<ProfileResearchResult> | null
): number[] {
  if (!res) return [];
  if (Array.isArray(res.selectedReels) && res.selectedReels.length > 0) {
    return res.selectedReels
      .filter(
        r =>
          r &&
          !r.isPinned &&
          typeof r.viewCount === 'number' &&
          Number.isFinite(r.viewCount) &&
          r.viewCount >= 0
      )
      .map(r => r.viewCount as number);
  }
  if (Array.isArray(res.rawViewCounts)) {
    return res.rawViewCounts.filter(
      (v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
    );
  }
  return [];
}

/**
 * Determine strict Export Research Status for a profile:
 * - Completed: research completed with all 15 valid view counts.
 * - Partial: research returned some valid counts but fewer than 15.
 * - Failed: research failed and no usable research result was obtained.
 * - Not Started: research has not yet run.
 */
export function determineExportStatus(
  profile: ResearchInputProfile,
  res?: ProfileResearchResult
): ExportResearchStatus {
  if (!res) {
    if (profile.researchStatus === 'failed' || profile.researchStatus === 'reels_not_found') {
      return 'Failed';
    }
    return 'Not Started';
  }

  if (res.status === 'failed' || res.status === 'reels_not_found') {
    return 'Failed';
  }

  const validCount = typeof res.validViewCountsCount === 'number'
    ? res.validViewCountsCount
    : (res.selectedReels?.filter(r => typeof r.viewCount === 'number' && !r.isPinned).length ?? 0);

  // Must have all 15 valid counts to be Completed; never label partial as Completed
  if (validCount >= 15 && res.status === 'completed') {
    return 'Completed';
  }

  if (validCount > 0) {
    return 'Partial';
  }

  // If 0 valid counts were obtained and status is not completed
  return 'Failed';
}

/**
 * Generate formatted filename with current local date YYYY-MM-DD
 */
export function getExportFileName(extension: 'xlsx' | 'csv'): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `Velmora_Influencer_RnD_${year}-${month}-${day}.${extension}`;
}

export interface PreparedExportRow {
  influencerCode: string;
  username: string;
  profileLink: string;
  followers: number | null;
  video1: number | null;
  video2: number | null;
  video3: number | null;
  video4: number | null;
  video5: number | null;
  video6: number | null;
  video7: number | null;
  video8: number | null;
  video9: number | null;
  video10: number | null;
  video11: number | null;
  video12: number | null;
  video13: number | null;
  video14: number | null;
  video15: number | null;
  averageViews: number | null;
  category: string;
  researchStatus: ExportResearchStatus;
}

/**
 * Extract category from a research result (calculated from Reel view counts) or profile.
 * Prioritizes the research result's calculated category, falling back to any input spreadsheet category.
 */
export function extractDirectCategory(
  profile?: Partial<ResearchInputProfile> | null,
  res?: Partial<ProfileResearchResult> | null
): string {
  if (res) {
    if (typeof res.category === 'string' && res.category.trim() !== '') {
      return res.category.trim();
    }
    if (typeof res.creatorCategory === 'string' && res.creatorCategory.trim() !== '') {
      return res.creatorCategory.trim();
    }
    const validViews = extractValidViewsFromResult(res);
    if (
      validViews.length > 0 ||
      res.status === 'completed' ||
      res.status === 'partial' ||
      res.status === 'reels_not_enough'
    ) {
      return categorize(validViews);
    }
  }

  if (profile) {
    if (typeof profile.category === 'string' && profile.category.trim() !== '') {
      return profile.category.trim();
    }
    if (typeof profile.creatorCategory === 'string' && profile.creatorCategory.trim() !== '') {
      return profile.creatorCategory.trim();
    }
    if (profile.originalData && typeof profile.originalData === 'object') {
      const fromRow = extractOriginalCategoryFromRow(profile.originalData);
      if (fromRow !== '') return fromRow;
    }
  }

  return '';
}

/**
 * Prepare raw export rows combining uploaded spreadsheet data with stored research results.
 * Matches research results and original categories using stable identifiers
 * (normalized influencer code and normalized username), never row position alone.
 */
export function prepareExportData(
  profiles: ResearchInputProfile[],
  researchResults: Record<string, ProfileResearchResult>
): PreparedExportRow[] {
  const resultsByCode = new Map<string, ProfileResearchResult>();
  const resultsByUsername = new Map<string, ProfileResearchResult>();
  const categoryByCode = new Map<string, string>();
  const categoryByUsername = new Map<string, string>();

  // Index researchResults by normalized influencerCode and normalized username
  for (const [key, r] of Object.entries(researchResults || {})) {
    if (!r) continue;
    const normKey = normalizeInfluencerCode(key);
    const normCode = normalizeInfluencerCode(r.influencerCode);
    const normReqUser = normalizeUsernameForLookup(r.requestedUsername);
    const normVerUser = normalizeUsernameForLookup(r.verifiedUsername);

    if (normKey && !resultsByCode.has(normKey)) resultsByCode.set(normKey, r);
    if (normCode && !resultsByCode.has(normCode)) resultsByCode.set(normCode, r);
    if (normReqUser && !resultsByUsername.has(normReqUser)) resultsByUsername.set(normReqUser, r);
    if (normVerUser && !resultsByUsername.has(normVerUser)) resultsByUsername.set(normVerUser, r);

    const resCat = extractDirectCategory(null, r);
    if (resCat) {
      if (normKey && !categoryByCode.has(normKey)) categoryByCode.set(normKey, resCat);
      if (normCode && !categoryByCode.has(normCode)) categoryByCode.set(normCode, resCat);
      if (normReqUser && !categoryByUsername.has(normReqUser)) categoryByUsername.set(normReqUser, resCat);
      if (normVerUser && !categoryByUsername.has(normVerUser)) categoryByUsername.set(normVerUser, resCat);
    }
  }

  // Index original categories from uploaded profiles by normalized influencerCode and normalized username
  for (const profile of profiles) {
    const normCode = normalizeInfluencerCode(profile.influencerCode);
    const normUser = normalizeUsernameForLookup(profile.username);

    if (profile.researchResult && typeof profile.researchResult === 'object') {
      const pr = profile.researchResult as ProfileResearchResult;
      if (normCode && !resultsByCode.has(normCode)) resultsByCode.set(normCode, pr);
      if (normUser && !resultsByUsername.has(normUser)) resultsByUsername.set(normUser, pr);
    }

    const directCat = extractDirectCategory(profile, profile.researchResult);
    if (directCat) {
      if (normCode && !categoryByCode.has(normCode)) {
        categoryByCode.set(normCode, directCat);
      }
      if (normUser && !categoryByUsername.has(normUser)) {
        categoryByUsername.set(normUser, directCat);
      }
    }
  }

  return profiles.map(profile => {
    const normCode = normalizeInfluencerCode(profile.influencerCode);
    const normUser = normalizeUsernameForLookup(profile.username);

    const res =
      researchResults[profile.influencerCode] ||
      (normCode ? resultsByCode.get(normCode) : undefined) ||
      (normUser ? resultsByUsername.get(normUser) : undefined) ||
      (profile.researchResult as ProfileResearchResult | undefined);

    const status = determineExportStatus(profile, res);

    // Profile Link: from original profile or fallback to canonical Instagram handle link
    let profileLink = profile.profileLink || '';
    if (!profileLink && (profile.username || res?.verifiedUsername)) {
      const handle = (res?.verifiedUsername || profile.username).replace(/^@/, '').trim();
      if (handle) {
        profileLink = `https://www.instagram.com/${handle}/`;
      }
    }

    // Followers: numeric cell or null for blank
    let followers: number | null = null;
    if (res && typeof res.followerCount === 'number' && res.followerCount > 0) {
      followers = res.followerCount;
    } else if (profile.followers) {
      if (typeof profile.followers === 'number' && profile.followers > 0) {
        followers = profile.followers;
      } else if (typeof profile.followers === 'string') {
        const cleanStr = profile.followers.replace(/,/g, '').trim().toLowerCase();
        if (/^\d+(\.\d+)?[km]?$/.test(cleanStr)) {
          if (cleanStr.endsWith('k')) {
            followers = Math.round(parseFloat(cleanStr) * 1000);
          } else if (cleanStr.endsWith('m')) {
            followers = Math.round(parseFloat(cleanStr) * 1000000);
          } else {
            const num = Number(cleanStr);
            if (!isNaN(num) && num > 0) followers = num;
          }
        }
      }
    }

    // Video 1–15: numeric cells from selectedReels, or null for blank (never 0 for missing)
    // For failed or unstarted profiles, Video 1–15 must be blank (null)
    const videoCounts: (number | null)[] = [];
    for (let i = 0; i < 15; i++) {
      if (status === 'Failed' || status === 'Not Started') {
        videoCounts.push(null);
      } else {
        const reel = res?.selectedReels?.[i];
        if (reel && typeof reel.viewCount === 'number' && !isNaN(reel.viewCount) && !reel.isPinned) {
          videoCounts.push(reel.viewCount);
        } else {
          videoCounts.push(null);
        }
      }
    }

    // Average Views: numeric cell from existing research result; do not recalculate. Null if unavailable/failed/unstarted.
    let averageViews: number | null = null;
    if (
      res &&
      typeof res.averageViews === 'number' &&
      !isNaN(res.averageViews) &&
      status !== 'Failed' &&
      status !== 'Not Started'
    ) {
      averageViews = res.averageViews;
    }

    // Category: resolved by stable identifier (normalized influencer code or normalized username) or direct profile fields.
    // Never invent categories or replace missing categories with guessed values.
    const resNormCode = normalizeInfluencerCode(res?.influencerCode);
    const resNormReqUser = normalizeUsernameForLookup(res?.requestedUsername);
    const resNormVerUser = normalizeUsernameForLookup(res?.verifiedUsername);

    const category =
      extractDirectCategory(profile, res) ||
      (normCode ? categoryByCode.get(normCode) : undefined) ||
      (resNormCode ? categoryByCode.get(resNormCode) : undefined) ||
      (normUser ? categoryByUsername.get(normUser) : undefined) ||
      (resNormReqUser ? categoryByUsername.get(resNormReqUser) : undefined) ||
      (resNormVerUser ? categoryByUsername.get(resNormVerUser) : undefined) ||
      '';

    return {
      influencerCode: profile.influencerCode,
      username: profile.username,
      profileLink,
      followers,
      video1: videoCounts[0],
      video2: videoCounts[1],
      video3: videoCounts[2],
      video4: videoCounts[3],
      video5: videoCounts[4],
      video6: videoCounts[5],
      video7: videoCounts[6],
      video8: videoCounts[7],
      video9: videoCounts[8],
      video10: videoCounts[9],
      video11: videoCounts[10],
      video12: videoCounts[11],
      video13: videoCounts[12],
      video14: videoCounts[13],
      video15: videoCounts[14],
      averageViews,
      category,
      researchStatus: status
    };
  });
}

/**
 * Build the SheetJS Workbook for the Influencer R&D export
 */
export function buildExcelWorkbook(
  profiles: ResearchInputProfile[],
  researchResults: Record<string, ProfileResearchResult>
): XLSX.WorkBook {
  const exportRows = prepareExportData(profiles, researchResults);

  // Build 2D Array of Arrays (AOA)
  const headerRow: string[] = [...RND_EXPORT_COLUMNS];
  const dataRows: (string | number | null)[][] = exportRows.map(r => [
    r.influencerCode,
    r.username,
    r.profileLink,
    r.followers,
    r.video1,
    r.video2,
    r.video3,
    r.video4,
    r.video5,
    r.video6,
    r.video7,
    r.video8,
    r.video9,
    r.video10,
    r.video11,
    r.video12,
    r.video13,
    r.video14,
    r.video15,
    r.averageViews,
    r.category,
    r.researchStatus
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  // Reasonable column widths based on content
  ws['!cols'] = [
    { wch: 18 }, // Influencer Code
    { wch: 24 }, // Username
    { wch: 38 }, // Profile Link
    { wch: 14 }, // Followers
    { wch: 12 }, // Video 1
    { wch: 12 }, // Video 2
    { wch: 12 }, // Video 3
    { wch: 12 }, // Video 4
    { wch: 12 }, // Video 5
    { wch: 12 }, // Video 6
    { wch: 12 }, // Video 7
    { wch: 12 }, // Video 8
    { wch: 12 }, // Video 9
    { wch: 12 }, // Video 10
    { wch: 12 }, // Video 11
    { wch: 12 }, // Video 12
    { wch: 12 }, // Video 13
    { wch: 12 }, // Video 14
    { wch: 12 }, // Video 15
    { wch: 16 }, // Average Views
    { wch: 18 }, // Category
    { wch: 16 }  // Research Status
  ];

  // Freeze header row at A2 so Row 1 remains visible when scrolling
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  (ws as any)['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }];

  // Auto-filter on the header row across all columns
  const totalRows = dataRows.length + 1;
  const lastColRef = XLSX.utils.encode_col(RND_EXPORT_COLUMNS.length - 1);
  ws['!autofilter'] = { ref: `A1:${lastColRef}${totalRows}` };

  // Set header cell styles (bold headers)
  for (let c = 0; c < RND_EXPORT_COLUMNS.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { bold: true },
        alignment: { horizontal: 'left', vertical: 'center' }
      };
    }
  }

  // Numeric column indices (Followers: 3, Video 1-15: 4..18, Average Views: 19)
  const numericColIndices = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  for (let r = 1; r <= dataRows.length; r++) {
    for (let c = 0; c < RND_EXPORT_COLUMNS.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      if (!cell) continue;

      if (numericColIndices.has(c) && typeof cell.v === 'number') {
        cell.z = '#,##0'; // Integer number format with commas
        cell.s = {
          alignment: { horizontal: 'right', vertical: 'center' }
        };
      } else {
        cell.s = {
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      }
    }
  }

  // Create workbook and append worksheet named 'Influencer R&D'
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Influencer R&D');
  return wb;
}

/**
 * Serialize the workbook to an .xlsx byte array and ensure the frozen pane at A2
 * is persisted in OpenXML (xl/worksheets/sheet1.xml).
 */
export function buildExcelBuffer(
  profiles: ResearchInputProfile[],
  researchResults: Record<string, ProfileResearchResult>
): Uint8Array {
  const wb = buildExcelWorkbook(profiles, researchResults);
  const rawOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const cfbLib = (XLSX as any).CFB || (XLSX as any).default?.CFB;
  if (!cfbLib) {
    return rawOut instanceof Uint8Array ? rawOut : new Uint8Array(rawOut as ArrayBuffer);
  }
  const cfb = cfbLib.read(new Uint8Array(rawOut), { type: 'array' });
  const entry =
    cfbLib.find(cfb, '/xl/worksheets/sheet1.xml') ||
    cfbLib.find(cfb, 'xl/worksheets/sheet1.xml');

  if (entry && entry.content) {
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();
    const rawBytes =
      entry.content instanceof Uint8Array
        ? entry.content
        : new Uint8Array(entry.content as ArrayLike<number>);
    const xml = decoder.decode(rawBytes);
    const frozenSheetViewsXml =
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>';
    const updatedXml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, frozenSheetViewsXml);
    entry.content = encoder.encode(updatedXml);
  }

  const zipOut = cfbLib.write(cfb, { type: 'array', fileType: 'zip' });
  return zipOut instanceof Uint8Array ? zipOut : new Uint8Array(zipOut as ArrayBuffer);
}

/**
 * Export research results to real Excel (.xlsx) file
 */
export function exportToExcel(
  profiles: ResearchInputProfile[],
  researchResults: Record<string, ProfileResearchResult>,
  customFileName?: string
): void {
  const xlsxBytes = buildExcelBuffer(profiles, researchResults);
  const fileName = customFileName || getExportFileName('xlsx');
  const blob = new Blob([xlsxBytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  downloadBlob(blob, fileName);
}

/**
 * Build standard UTF-8 CSV string (without BOM) with the exact same columns and data as Excel
 */
export function buildCsvContent(
  profiles: ResearchInputProfile[],
  researchResults: Record<string, ProfileResearchResult>
): string {
  const exportRows = prepareExportData(profiles, researchResults);

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined || val === '') return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  // Header line
  lines.push(RND_EXPORT_COLUMNS.map(escapeCsv).join(','));

  // Data lines
  for (const r of exportRows) {
    const rowValues = [
      r.influencerCode,
      r.username,
      r.profileLink,
      r.followers !== null ? r.followers : '',
      r.video1 !== null ? r.video1 : '',
      r.video2 !== null ? r.video2 : '',
      r.video3 !== null ? r.video3 : '',
      r.video4 !== null ? r.video4 : '',
      r.video5 !== null ? r.video5 : '',
      r.video6 !== null ? r.video6 : '',
      r.video7 !== null ? r.video7 : '',
      r.video8 !== null ? r.video8 : '',
      r.video9 !== null ? r.video9 : '',
      r.video10 !== null ? r.video10 : '',
      r.video11 !== null ? r.video11 : '',
      r.video12 !== null ? r.video12 : '',
      r.video13 !== null ? r.video13 : '',
      r.video14 !== null ? r.video14 : '',
      r.video15 !== null ? r.video15 : '',
      r.averageViews !== null ? r.averageViews : '',
      r.category,
      r.researchStatus
    ];

    lines.push(rowValues.map(escapeCsv).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Export research results to standard UTF-8 CSV (.csv) file
 */
export function exportToCsv(
  profiles: ResearchInputProfile[],
  researchResults: Record<string, ProfileResearchResult>,
  customFileName?: string
): void {
  const csvString = buildCsvContent(profiles, researchResults);
  // Prepend UTF-8 Byte Order Mark (BOM) so Excel opens UTF-8 characters properly
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  
  const fileName = customFileName || getExportFileName('csv');
  downloadBlob(blob, fileName);
}

function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
