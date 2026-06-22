import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { useDashboardMetrics } from '../hooks/analytics/useDashboardMetrics';
import type { TimeframeFilter } from '../hooks/analytics/useDashboardMetrics';
import { KPICards } from '../modules/dashboard/KPICards';
import { SpendAnalyticsChart } from '../modules/dashboard/SpendAnalyticsChart';

export const DashboardPage = () => {
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('current_month');
  const { metrics, isLoading, error } = useDashboardMetrics(timeframe);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-muted text-sm mt-1">High-level procurement intelligence</p>
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as TimeframeFilter)}
            className="bg-card border border-border text-white text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5"
          >
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="current_month">Current Month</option>
            <option value="quarter">This Quarter</option>
            <option value="all_time">All Time</option>
          </select>
        </div>
      </div>

      {error ? (
        <Card className="p-6 bg-red-500/10 border-red-500/20 text-red-500">
          Error loading dashboard data: {error}
        </Card>
      ) : (
        <>
          <KPICards metrics={metrics} isLoading={isLoading} />
          <SpendAnalyticsChart metrics={metrics} isLoading={isLoading} />
        </>
      )}
    </div>
  );
};
