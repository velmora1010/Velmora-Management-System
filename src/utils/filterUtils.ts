/**
 * Reusable filter normalization and deduplication utilities
 * Ensures clean, unique, case-insensitive, whitespace-safe filter options
 */

/**
 * Normalizes a raw filter value into a clean, lowercased comparison key.
 * - Safely converts to string
 * - Trims leading & trailing whitespace
 * - Collapses internal repeated whitespace into a single space
 * - Lowercases for case-insensitive matching
 */
export const normalizeFilterKey = (val?: any): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

/**
 * Checks if two filter values match case-insensitively and whitespace-safely.
 */
export const areFilterValuesEqual = (a?: any, b?: any): boolean => {
  const keyA = normalizeFilterKey(a);
  const keyB = normalizeFilterKey(b);
  if (!keyA || !keyB) return false;
  return keyA === keyB;
};

/**
 * Scores the casing/formatting cleanliness of a display string.
 * Higher score = cleaner preferred display candidate.
 */
const getDisplayCleanlinessScore = (str: string): number => {
  if (!str) return 0;
  let score = 1;

  // Severe penalty for all-lowercase (e.g. "chennai")
  if (str === str.toLowerCase()) score -= 10;

  // Penalty for all-uppercase if longer than 4 chars (e.g. "CHENNAI" vs short acronym "DTDC")
  if (str === str.toUpperCase() && str.length > 4) score -= 8;

  // Bonus for Title Case words (e.g. "Chennai", "Tamil Nadu", "Delhivery")
  if (/^[A-Z][a-z0-9]*(\s[A-Z][a-z0-9]*)*$/.test(str)) score += 15;

  // Bonus if at least first letter is capitalized
  if (/^[A-Z]/.test(str)) score += 5;

  return score;
};

/**
 * Converts a string to Title Case as a fallback when only lowercase/uppercase variants exist.
 * Preserves known acronyms or mixed casing if applicable.
 */
export const toCleanTitleCase = (str: string): string => {
  if (!str) return '';
  const trimmed = str.trim().replace(/\s+/g, ' ');
  return trimmed
    .split(' ')
    .map(word => {
      if (word.length <= 1) return word.toUpperCase();
      // Keep short all-caps acronyms like 'ST', 'DTDC', 'FB'
      if (word.length <= 4 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

/**
 * Deduplicates and normalizes an array of raw filter values.
 * 
 * - Collapses case-insensitive and whitespace-variant duplicates (e.g. "chennai", "Chennai", " CHENNAI ")
 * - Retains the cleanest display formatting (e.g. "Chennai")
 * - Discards empty values and redundant "All ..." labels from raw inputs
 * - Sorts alphabetically
 */
export const getUniqueFilterOptions = (values: (string | null | undefined)[]): string[] => {
  const map = new Map<string, { display: string; score: number }>();

  values.forEach(raw => {
    if (raw === null || raw === undefined) return;
    const trimmed = String(raw).trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    const key = trimmed.toLowerCase();

    // Prevent any raw values matching generic "all" or "all ..." from polluting the option list
    if (key === 'all' || key.startsWith('all ') || key === 'none') {
      return;
    }

    const score = getDisplayCleanlinessScore(trimmed);
    const existing = map.get(key);

    if (!existing || score > existing.score) {
      let display = trimmed;
      // If it's all-lowercase, capitalize it properly for display
      if (trimmed === trimmed.toLowerCase()) {
        display = toCleanTitleCase(trimmed);
      }
      map.set(key, { display, score });
    }
  });

  return Array.from(map.values())
    .map(entry => entry.display)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
};
