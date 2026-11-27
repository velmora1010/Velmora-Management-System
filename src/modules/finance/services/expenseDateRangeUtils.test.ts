import assert from 'node:assert/strict';
import {
  computeQuickExpenseDateRange,
  formatAppliedExpenseDateRange,
  matchesExpenseDateRange,
  normalizeExpenseDate,
} from './expenseDateRangeUtils';

const ref = new Date(2026, 10, 27, 15, 30, 0); // 27 Nov 2026 15:30 local

console.log('=== TEST SUITE: Expense Date Range Utils ===');

// 1. Default All Time matches everything
assert.equal(matchesExpenseDateRange('2026-05-14T18:30:00+00:00', { from: null, to: null }), true);
assert.equal(matchesExpenseDateRange(null, { from: null, to: null }), true);
assert.equal(formatAppliedExpenseDateRange({ from: null, to: null }), 'All Time');
console.log('PASS: Test 1 - Default All Time');

// 2. Today
const todayRange = computeQuickExpenseDateRange('Today', ref);
assert.equal(normalizeExpenseDate(todayRange.from!).getDate(), 27);
assert.equal(normalizeExpenseDate(todayRange.to!).getDate(), 27);
assert.equal(matchesExpenseDateRange(new Date(2026, 10, 27, 23, 59, 59).toISOString(), todayRange), true);
assert.equal(matchesExpenseDateRange(new Date(2026, 10, 26, 23, 59, 59).toISOString(), todayRange), false);
console.log('PASS: Test 2 - Today & end-of-day boundary');

// 3. Yesterday
const yestRange = computeQuickExpenseDateRange('Yesterday', ref);
assert.equal(normalizeExpenseDate(yestRange.from!).getDate(), 26);
assert.equal(normalizeExpenseDate(yestRange.to!).getDate(), 26);
assert.equal(matchesExpenseDateRange(new Date(2026, 10, 26, 0, 0, 1).toISOString(), yestRange), true);
assert.equal(matchesExpenseDateRange(new Date(2026, 10, 27, 0, 0, 1).toISOString(), yestRange), false);
console.log('PASS: Test 3 - Yesterday');

// 4. This Week (Monday start: 27 Nov 2026 is Friday -> 23 Nov 2026..27 Nov 2026)
const weekRange = computeQuickExpenseDateRange('This Week', ref);
assert.equal(normalizeExpenseDate(weekRange.from!).getDate(), 23);
assert.equal(normalizeExpenseDate(weekRange.to!).getDate(), 27);
console.log('PASS: Test 4 - This Week');

// 5. Last 7 Days (21 Nov..27 Nov)
const last7Range = computeQuickExpenseDateRange('Last 7 Days', ref);
assert.equal(normalizeExpenseDate(last7Range.from!).getDate(), 21);
assert.equal(normalizeExpenseDate(last7Range.to!).getDate(), 27);
console.log('PASS: Test 5 - Last 7 Days');

// 6. This Month (1 Nov..27 Nov)
const thisMonth = computeQuickExpenseDateRange('This Month', ref);
assert.equal(normalizeExpenseDate(thisMonth.from!).getDate(), 1);
assert.equal(normalizeExpenseDate(thisMonth.from!).getMonth(), 10);
assert.equal(normalizeExpenseDate(thisMonth.to!).getDate(), 27);
console.log('PASS: Test 6 - This Month');

// 7. Previous Month (1 Oct..31 Oct)
const prevMonth = computeQuickExpenseDateRange('Previous Month', ref);
assert.equal(normalizeExpenseDate(prevMonth.from!).getMonth(), 9);
assert.equal(normalizeExpenseDate(prevMonth.from!).getDate(), 1);
assert.equal(normalizeExpenseDate(prevMonth.to!).getMonth(), 9);
assert.equal(normalizeExpenseDate(prevMonth.to!).getDate(), 31);
console.log('PASS: Test 7 - Previous Month');

// 8. Last 30 Days & This Year
const last30 = computeQuickExpenseDateRange('Last 30 Days', ref);
assert.equal(normalizeExpenseDate(last30.from!).getMonth(), 9);
assert.equal(normalizeExpenseDate(last30.from!).getDate(), 29);
const thisYear = computeQuickExpenseDateRange('This Year', ref);
assert.equal(normalizeExpenseDate(thisYear.from!).getMonth(), 0);
assert.equal(normalizeExpenseDate(thisYear.from!).getDate(), 1);
console.log('PASS: Test 8 - Last 30 Days & This Year');

// 9. Custom range & formatted label
const customRange = { from: new Date(2026, 4, 15), to: new Date(2026, 4, 21) };
assert.equal(matchesExpenseDateRange(new Date(2026, 4, 21, 23, 59, 0).toISOString(), customRange), true);
assert.equal(matchesExpenseDateRange(new Date(2026, 4, 22, 0, 0, 1).toISOString(), customRange), false);
assert.equal(formatAppliedExpenseDateRange(customRange), '15 May 2026 - 21 May 2026');
console.log('PASS: Test 9 - Custom range & full end-date inclusion');

console.log('ALL 9 DATE RANGE TESTS PASSED.');
