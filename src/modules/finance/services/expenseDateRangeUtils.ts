export interface DateRangeValue {
  from: Date | null;
  to: Date | null;
}

export const QUICK_EXPENSE_DATE_RANGES = [
  'Today',
  'Yesterday',
  'This Week',
  'Last 7 Days',
  'This Month',
  'Previous Month',
  'Last 30 Days',
  'This Year',
] as const;

export type QuickExpenseDateRange = (typeof QUICK_EXPENSE_DATE_RANGES)[number];

/**
 * Normalizes a Date to local midnight (00:00:00.000) for calendar-day comparisons.
 * Matches ExpenseAnalytics.tsx date-range normalization.
 */
export function normalizeExpenseDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addExpenseDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function getStartOfExpenseWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(copy.setDate(diff));
}

export function computeQuickExpenseDateRange(
  rangeName: QuickExpenseDateRange | string,
  referenceDate: Date = new Date()
): DateRangeValue {
  const today = normalizeExpenseDate(referenceDate);
  let from: Date | null = null;
  let to: Date | null = today;

  switch (rangeName) {
    case 'Today':
      from = today;
      break;
    case 'Yesterday':
      from = addExpenseDays(today, -1);
      to = addExpenseDays(today, -1);
      break;
    case 'This Week':
      from = getStartOfExpenseWeek(today);
      break;
    case 'Last 7 Days':
      from = addExpenseDays(today, -6);
      break;
    case 'This Month':
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'Previous Month':
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'Last 30 Days':
      from = addExpenseDays(today, -29);
      break;
    case 'This Year':
      from = new Date(today.getFullYear(), 0, 1);
      break;
  }

  return { from, to };
}

export function formatAppliedExpenseDateRange(range: DateRangeValue): string {
  if (!range.from && !range.to) return 'All Time';
  const formatStr = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (range.from && range.to) {
    if (normalizeExpenseDate(range.from).getTime() === normalizeExpenseDate(range.to).getTime()) {
      return formatStr(range.from);
    }
    return `${formatStr(range.from)} - ${formatStr(range.to)}`;
  }
  return 'Custom Range';
}

/**
 * Matches an expense against the selected local calendar date range using `created_at`,
 * consistent with ExpenseAnalytics.tsx and View Expense sorting/grouping.
 */
export function matchesExpenseDateRange(
  createdAt: string | null | undefined,
  range: DateRangeValue
): boolean {
  if (!range.from && !range.to) return true;
  if (!createdAt) return true;

  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return true;

  const expDate = normalizeExpenseDate(d).getTime();

  if (range.from) {
    const from = normalizeExpenseDate(range.from).getTime();
    if (expDate < from) return false;
  }
  if (range.to) {
    const to = normalizeExpenseDate(range.to).getTime();
    if (expDate > to) return false;
  }
  return true;
}
