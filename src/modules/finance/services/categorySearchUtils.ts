import type { FinanceCategoryRow } from '../../../hooks/finance/useFinanceCategories';

export type CategoryLevelLabel =
  | 'Department'
  | 'Category'
  | 'Sub Category 1'
  | 'Sub Category 2'
  | 'Sub Category 3';

export const CATEGORY_LEVEL_LABELS: readonly CategoryLevelLabel[] = [
  'Department',
  'Category',
  'Sub Category 1',
  'Sub Category 2',
  'Sub Category 3',
] as const;

export interface CategoryPathSelection {
  dept: string;
  cat: string;
  sub1: string;
  sub2: string;
  sub3: string;
}

export interface CategorySearchResult {
  key: string;
  segments: string[];
  displayPath: string;
  matchedLevels: CategoryLevelLabel[];
  selection: CategoryPathSelection;
}

function normalizeSegment(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed === '-' ? '' : trimmed;
}

function extractPathSegments(row: FinanceCategoryRow): string[] {
  const rawLevels = [row.main, row.sub1, row.sub2, row.sub3, row.sub4];
  const segments: string[] = [];
  for (const raw of rawLevels) {
    const normalized = normalizeSegment(raw);
    if (!normalized) break;
    segments.push(normalized);
  }
  return segments;
}

/**
 * Search across all five finance category hierarchy levels (case-insensitive partial match)
 * and return deduplicated complete category paths with matched level metadata.
 */
export function searchCategoryPaths(
  categories: FinanceCategoryRow[],
  query: string
): CategorySearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const resultsByKey = new Map<string, CategorySearchResult>();

  for (const row of categories) {
    const segments = extractPathSegments(row);
    if (segments.length === 0) continue;

    const matchedLevels: CategoryLevelLabel[] = [];
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].toLowerCase().includes(normalizedQuery)) {
        matchedLevels.push(CATEGORY_LEVEL_LABELS[i]);
      }
    }

    if (matchedLevels.length === 0) continue;

    const key = segments.join('\u0000');
    if (resultsByKey.has(key)) continue;

    resultsByKey.set(key, {
      key,
      segments,
      displayPath: segments.join(' → '),
      matchedLevels,
      selection: {
        dept: segments[0] ?? '',
        cat: segments[1] ?? '',
        sub1: segments[2] ?? '',
        sub2: segments[3] ?? '',
        sub3: segments[4] ?? '',
      },
    });
  }

  return Array.from(resultsByKey.values()).sort((a, b) =>
    a.displayPath.localeCompare(b.displayPath)
  );
}
