import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

export type TimeframeFilter = 'current_month' | 'last_7_days' | 'last_30_days' | 'quarter' | 'all_time';

export interface DashboardMetrics {
  totalSpend: number;
  activePOCount: number;
  totalVendors: number;
  pendingApprovals: number; // Placeholder for future approval workflows
  spendTrends: { date: string; amount: number }[];
  vendorSpend: { vendorName: string; amount: number }[];
}

const dashboardCache: Record<string, { metrics: DashboardMetrics; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useDashboardMetrics = (timeframe: TimeframeFilter) => {
  const [metrics, setMetrics] = useState<DashboardMetrics>(() => {
    return dashboardCache[timeframe]?.metrics || {
      totalSpend: 0,
      activePOCount: 0,
      totalVendors: 0,
      pendingApprovals: 0,
      spendTrends: [],
      vendorSpend: [],
    };
  });
  
  // Only show loading state if we don't have cached data
  const [isLoading, setIsLoading] = useState(() => !dashboardCache[timeframe]);
  const [error, setError] = useState('');

  // Calculate the starting date based on the timeframe
  const startDate = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    switch (timeframe) {
      case 'last_7_days':
        date.setDate(date.getDate() - 7);
        break;
      case 'last_30_days':
        date.setDate(date.getDate() - 30);
        break;
      case 'current_month':
        date.setDate(1); // Start of current month
        break;
      case 'quarter': {
        const quarter = Math.floor(date.getMonth() / 3);
        date.setMonth(quarter * 3, 1);
        break;
      }
      case 'all_time':
        return null; // Return null for no date filter
    }
    return date.toISOString();
  }, [timeframe]);

  useEffect(() => {
    const fetchMetrics = async () => {
      // Skip fetch if cache is fresh
      const cached = dashboardCache[timeframe];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setIsLoading(false);
        return;
      }

      if (!cached) {
        setIsLoading(true);
      }
      setError('');

      try {
        // Build the queries
        let poQuery = supabase
          .from('purchase_orders')
          .select('id, subtotal, gst_total, created_at, vendor_name');

        if (startDate) {
          poQuery = poQuery.gte('created_at', startDate);
        }

        const vendorQuery = supabase
          .from('vendors')
          .select('id', { count: 'exact', head: true });

        const [poResult, vendorResult] = await Promise.all([poQuery, vendorQuery]);

        if (poResult.error) throw poResult.error;
        if (vendorResult.error) throw vendorResult.error;

        const pos = poResult.data || [];
        const totalVendors = vendorResult.count || 0;

        // Aggregate Metrics
        let totalSpend = 0;
        const trendMap = new Map<string, number>();
        const vendorSpendMap = new Map<string, number>();

        pos.forEach(po => {
          const grandTotal = (po.subtotal || 0) + (po.gst_total || 0);
          totalSpend += grandTotal;

          // Group by Date for Trends (YYYY-MM-DD format)
          const dateOnly = po.created_at.split('T')[0];
          trendMap.set(dateOnly, (trendMap.get(dateOnly) || 0) + grandTotal);

          // Group by Vendor for Spend Analysis
          const vName = po.vendor_name || 'Unknown';
          vendorSpendMap.set(vName, (vendorSpendMap.get(vName) || 0) + grandTotal);
        });

        // Convert maps to arrays and sort
        const spendTrends = Array.from(trendMap.entries())
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const vendorSpend = Array.from(vendorSpendMap.entries())
          .map(([vendorName, amount]) => ({ vendorName, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10); // Top 10 vendors

        const newMetrics = {
          totalSpend,
          activePOCount: pos.length,
          totalVendors,
          pendingApprovals: 0, // Hardcoded for now
          spendTrends,
          vendorSpend,
        };

        dashboardCache[timeframe] = {
          metrics: newMetrics,
          timestamp: Date.now()
        };

        setMetrics(newMetrics);

      } catch (err: unknown) {
        console.error('Failed to fetch dashboard metrics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [startDate, timeframe]);

  return { metrics, isLoading, error };
};
