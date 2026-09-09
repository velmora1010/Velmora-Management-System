import type { CampaignInfluencer } from '../types';
import { isActiveStatus } from './marketingUtils';

export interface RangeParseResult {
  /** Array of unique influencer IDs successfully matched from active influencers */
  selectedInfluencerIds: string[];
  /** Full influencer objects for all successfully matched active influencers */
  selectedInfluencers: CampaignInfluencer[];
  /** Error messages for syntactically invalid or mismatched prefix ranges */
  invalidRanges: string[];
  /** Codes that belong to eliminated or recycle bin influencers */
  inactiveCodes: string[];
  /** Codes that do not exist in the campaign at all */
  notFoundCodes: string[];
  /** Total unique codes requested across all single codes and ranges */
  totalCodesRequested: number;
}

/**
 * Normalizes an influencer code by trimming and converting to uppercase.
 */
export const normalizeCode = (code?: string | null): string => {
  return (code || '').trim().toUpperCase();
};

/**
 * Parses raw code/range input (e.g. "HIS1 - HIS5, HIS7, TNS20 - TNS25")
 * and resolves active influencers while rejecting invalid ranges and reporting
 * inactive/eliminated and not-found codes.
 *
 * @param input Raw text string entered by the user
 * @param activeInfluencers The list of active campaign influencers (must satisfy isActiveStatus)
 * @param allCampaignInfluencers Optional full list of all influencers in the campaign (to detect eliminated/recycled)
 */
export const parseInfluencerCodeRanges = (
  input: string,
  activeInfluencers: CampaignInfluencer[],
  allCampaignInfluencers?: CampaignInfluencer[]
): RangeParseResult => {
  const result: RangeParseResult = {
    selectedInfluencerIds: [],
    selectedInfluencers: [],
    invalidRanges: [],
    inactiveCodes: [],
    notFoundCodes: [],
    totalCodesRequested: 0,
  };

  const cleanInput = (input || '').trim();
  if (!cleanInput) {
    return result;
  }

  // Build lookup maps for fast case-insensitive access
  const activeCodeMap = new Map<string, CampaignInfluencer>();
  activeInfluencers.forEach(inf => {
    if (inf.code) {
      activeCodeMap.set(normalizeCode(inf.code), inf);
    }
  });

  // Full campaign lookup (active + eliminated + recycle bin)
  const allInfluencersList = allCampaignInfluencers || activeInfluencers;
  const allCodeMap = new Map<string, CampaignInfluencer>();
  allInfluencersList.forEach(inf => {
    if (inf.code) {
      allCodeMap.set(normalizeCode(inf.code), inf);
    }
  });

  // Split by comma
  const rawSegments = cleanInput.split(',').map(s => s.trim()).filter(Boolean);
  const requestedCodes = new Set<string>();
  const codeRegex = /^([A-Za-z]+)(\d+)$/;

  for (const segment of rawSegments) {
    // Check if segment is a range (contains hyphen)
    if (segment.includes('-')) {
      const parts = segment.split('-').map(s => s.trim());
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        result.invalidRanges.push(`Invalid range format: "${segment}"`);
        continue;
      }

      const [startRaw, endRaw] = parts;
      const startMatch = startRaw.match(codeRegex);
      const endMatch = endRaw.match(codeRegex);

      if (!startMatch || !endMatch) {
        result.invalidRanges.push(`Invalid code format in range "${segment}". Expected Prefix+Number (e.g. HIS1-HIS5)`);
        continue;
      }

      const startPrefix = startMatch[1].toUpperCase();
      const endPrefix = endMatch[1].toUpperCase();
      const startNum = parseInt(startMatch[2], 10);
      const endNum = parseInt(endMatch[2], 10);

      if (startPrefix !== endPrefix) {
        result.invalidRanges.push(
          `Prefix mismatch in range "${segment}": start has "${startPrefix}" but end has "${endPrefix}"`
        );
        continue;
      }

      if (startNum > endNum) {
        result.invalidRanges.push(
          `Invalid range "${segment}": start number (${startNum}) is greater than end number (${endNum})`
        );
        continue;
      }

      // Safety check against extreme ranges
      if (endNum - startNum > 1000) {
        result.invalidRanges.push(
          `Range "${segment}" is too large (maximum 1,000 codes per range)`
        );
        continue;
      }

      // Generate sequence
      for (let num = startNum; num <= endNum; num++) {
        requestedCodes.add(`${startPrefix}${num}`);
      }
    } else {
      // Single code
      const norm = normalizeCode(segment);
      if (norm) {
        requestedCodes.add(norm);
      }
    }
  }

  result.totalCodesRequested = requestedCodes.size;

  // Validate each requested code
  const matchedInfluencerSet = new Map<string, CampaignInfluencer>();

  requestedCodes.forEach(code => {
    if (activeCodeMap.has(code)) {
      const inf = activeCodeMap.get(code)!;
      matchedInfluencerSet.set(String(inf.id), inf);
    } else if (allCodeMap.has(code)) {
      const inf = allCodeMap.get(code)!;
      if (!isActiveStatus(inf.is_archived)) {
        result.inactiveCodes.push(`${code} — Not Active / Not Available`);
      } else {
        // Fallback: active in allCodeMap
        matchedInfluencerSet.set(String(inf.id), inf);
      }
    } else {
      result.notFoundCodes.push(`${code} — Not Found`);
    }
  });

  result.selectedInfluencers = Array.from(matchedInfluencerSet.values());
  result.selectedInfluencerIds = Array.from(matchedInfluencerSet.keys());

  return result;
};
