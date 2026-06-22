import { memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import type { DashboardMetrics } from '../../hooks/analytics/useDashboardMetrics';

interface SpendAnalyticsChartProps {
  metrics: DashboardMetrics;
  isLoading: boolean;
}

export const SpendAnalyticsChart = memo(({ metrics, isLoading }: SpendAnalyticsChartProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="h-[400px] animate-pulse bg-card/50"><div /></Card>
        <Card className="h-[400px] animate-pulse bg-card/50"><div /></Card>
      </div>
    );
  }

  // Format Y-axis ticks for readability (e.g., ₹100K, ₹1M)
  const formatYAxis = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
      {/* Trend Area Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-white mb-6">Spend Trend</h3>
        <div className="h-[320px] w-full">
          {metrics.spendTrends.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted">
              No data available for the selected timeframe.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.spendTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#718096" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#718096" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={formatYAxis} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a202c', borderColor: '#2d3748', borderRadius: '8px' }}
                  itemStyle={{ color: '#60a5fa' }}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0)), 'Spend']}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSpend)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Vendor Spend Bar Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-white mb-6">Top Vendors by Spend</h3>
        <div className="h-[320px] w-full">
          {metrics.vendorSpend.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted">
              No data available for the selected timeframe.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.vendorSpend} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" horizontal={false} />
                <XAxis 
                  type="number" 
                  stroke="#718096" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={formatYAxis} 
                />
                <YAxis 
                  type="category" 
                  dataKey="vendorName" 
                  stroke="#718096" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#2d3748' }}
                  contentStyle={{ backgroundColor: '#1a202c', borderColor: '#2d3748', borderRadius: '8px' }}
                  itemStyle={{ color: '#a78bfa' }}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0)), 'Spend']}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#8b5cf6" 
                  radius={[0, 4, 4, 0]} 
                  barSize={20} 
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
});

SpendAnalyticsChart.displayName = 'SpendAnalyticsChart';
