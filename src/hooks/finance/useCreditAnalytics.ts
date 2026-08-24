import { useMemo } from 'react';
import type { FinanceCredit } from './useCredits';

export interface CreditAnalyticsData {
  totalAmount: number;
  totalTransactions: number;
  categorizedAmount: number;
  uncategorizedAmount: number;
  uncategorizedPercentage: number;
  averageCredit: number;

  trendData: { name: string; amount: number; count: number }[];
  departmentData: { name: string; value: number; count: number }[];
  sub1Data: { name: string; value: number; count: number }[];
  sub2Data: { name: string; value: number; count: number }[];
  paymentModeData: { name: string; value: number; count: number }[];
  sourceData: { name: string; value: number; count: number }[];
}

export const useCreditAnalytics = (
  credits: FinanceCredit[],
  dateRange: { from: Date | null; to: Date | null },
  selectedMain: string | null,
  selectedSub1: string | null,
  selectedSub2: string | null
): CreditAnalyticsData => {
  return useMemo(() => {
    // 1. Filter by Active and Date Range First
    // (Archived credits are already excluded by FinanceCredit, but we enforce it here just in case)
    let filtered = credits.filter(c => c.status !== 'archived' && (c.amount || 0) > 0);

    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(c => {
        if (!c.transaction_date) return true; // Safety: preserve missing dates
        const d = new Date(c.transaction_date);
        if (isNaN(d.getTime())) return true;
        
        // Normalize to midnight
        const txDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        
        if (dateRange.from) {
          const from = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate()).getTime();
          if (txDate < from) return false;
        }
        if (dateRange.to) {
          const to = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate()).getTime();
          if (txDate > to) return false;
        }
        return true;
      });
    }

    // Top Level Metrics
    let totalAmount = 0;
    let totalTransactions = filtered.length;
    let categorizedAmount = 0;
    let uncategorizedAmount = 0;

    filtered.forEach(c => {
      const amt = Number(c.amount || 0);
      totalAmount += amt;
      if (!c.main_category || c.main_category === 'Uncategorized') {
        uncategorizedAmount += amt;
      } else {
        categorizedAmount += amt;
      }
    });

    const averageCredit = totalTransactions > 0 ? totalAmount / totalTransactions : 0;
    const uncategorizedPercentage = totalAmount > 0 ? (uncategorizedAmount / totalAmount) * 100 : 0;

    // Build Aggregations
    const aggMap = <T,>(getKey: (c: FinanceCredit) => string, list: FinanceCredit[]) => {
      const map: Record<string, { amount: number; count: number }> = {};
      list.forEach(c => {
        const key = getKey(c);
        if (!map[key]) map[key] = { amount: 0, count: 0 };
        map[key].amount += Number(c.amount || 0);
        map[key].count += 1;
      });
      return Object.keys(map).map(name => ({
        name,
        value: map[name].amount,
        count: map[name].count
      })).sort((a, b) => b.value - a.value);
    };

    // Department / Category Breakdown
    const departmentData = aggMap(c => c.main_category || 'Uncategorized', filtered);

    // Cascading logic for Sub1 and Sub2
    const filteredForSub1 = selectedMain 
      ? filtered.filter(c => (c.main_category || 'Uncategorized') === selectedMain)
      : [];
    const sub1Data = aggMap(c => c.sub_category1 || 'Other', filteredForSub1);

    const filteredForSub2 = (selectedMain && selectedSub1)
      ? filteredForSub1.filter(c => (c.sub_category1 || 'Other') === selectedSub1)
      : [];
    const sub2Data = aggMap(c => c.sub_category2 || 'Other', filteredForSub2);

    // Payment Mode & Source Breakdown (Unfiltered by category to show global spread)
    const paymentModeData = aggMap(c => c.payment_mode || 'Unknown Mode', filtered);
    const sourceData = aggMap(c => c.source || 'Unknown Source', filtered);

    // Trend Data (Time Series)
    const trendMap: Record<string, { amount: number; count: number; timestamp: number }> = {};
    
    // Determine if we should group by month or day based on span
    let spanDays = 0;
    if (filtered.length > 0) {
      let min = Infinity, max = -Infinity;
      filtered.forEach(c => {
        if (c.transaction_date) {
          const t = new Date(c.transaction_date).getTime();
          if (!isNaN(t)) {
            if (t < min) min = t;
            if (t > max) max = t;
          }
        }
      });
      if (min !== Infinity && max !== -Infinity) {
        spanDays = (max - min) / (1000 * 60 * 60 * 24);
      }
    }

    const isMonthly = spanDays > 60;

    filtered.forEach(c => {
      if (!c.transaction_date) return;
      const d = new Date(c.transaction_date);
      if (isNaN(d.getTime())) return;

      let key = '';
      let timestamp = 0;
      
      if (isMonthly) {
        key = d.toLocaleString('en-GB', { month: 'short', year: 'numeric' }); // e.g. "Aug 2026"
        timestamp = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      } else {
        key = d.toLocaleString('en-GB', { day: '2-digit', month: 'short' }); // e.g. "14 Aug"
        timestamp = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }

      if (!trendMap[key]) {
        trendMap[key] = { amount: 0, count: 0, timestamp };
      }
      trendMap[key].amount += Number(c.amount || 0);
      trendMap[key].count += 1;
    });

    const trendData = Object.keys(trendMap)
      .map(key => ({
        name: key,
        amount: trendMap[key].amount,
        count: trendMap[key].count,
        timestamp: trendMap[key].timestamp
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(t => ({ name: t.name, amount: t.amount, count: t.count }));

    return {
      totalAmount,
      totalTransactions,
      categorizedAmount,
      uncategorizedAmount,
      uncategorizedPercentage,
      averageCredit,
      trendData,
      departmentData,
      sub1Data,
      sub2Data,
      paymentModeData,
      sourceData
    };
  }, [credits, dateRange.from, dateRange.to, selectedMain, selectedSub1, selectedSub2]);
};
