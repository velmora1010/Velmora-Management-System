import React from 'react';
import type { TrendDataPoint, CategoryBreakdown } from '../../types/analytics';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';

interface TrendChartProps {
  title: string;
  subtitle?: string;
  data: TrendDataPoint[];
}

export const AnalyticsTrendChart: React.FC<TrendChartProps> = ({ title, subtitle, data }) => {
  const maxValue = Math.max(...data.map(d => Math.max(d.value, d.secondaryValue || 0)), 1);

  return (
    <div className="p-5 bg-card border border-border rounded-xl space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-sm text-main flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-400" />
            {title}
          </h4>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="h-44 flex items-end justify-between gap-2 pt-4 px-2 border-b border-border/40 font-mono text-xs">
        {data.map((item, idx) => {
          const heightPct = Math.round((item.value / maxValue) * 100);
          const secHeightPct = item.secondaryValue ? Math.round((item.secondaryValue / maxValue) * 100) : 0;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
              <div className="w-full flex items-end justify-center gap-1 h-full">
                {item.secondaryValue && (
                  <div
                    style={{ height: `${secHeightPct}%` }}
                    className="w-1/2 bg-indigo-500/30 group-hover:bg-indigo-500/50 rounded-t transition-all"
                    title={`Secondary: ${item.secondaryValue}`}
                  />
                )}
                <div
                  style={{ height: `${heightPct}%` }}
                  className="w-1/2 bg-indigo-500 group-hover:bg-indigo-400 rounded-t transition-all shadow-sm"
                  title={`Value: ${item.value}`}
                />
              </div>
              <span className="text-[10px] text-muted truncate">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface BreakdownChartProps {
  title: string;
  subtitle?: string;
  items: CategoryBreakdown[];
}

export const AnalyticsBreakdownChart: React.FC<BreakdownChartProps> = ({ title, subtitle, items }) => {
  return (
    <div className="p-5 bg-card border border-border rounded-xl space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-sm text-main flex items-center gap-2">
            <PieChart size={16} className="text-emerald-400" />
            {title}
          </h4>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        {items.map((cat, idx) => (
          <div key={idx} className="space-y-1 text-xs">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">{cat.category}</span>
              <span className="text-main font-mono">{cat.count} ({cat.percentage}%)</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                style={{ width: `${cat.percentage}%`, backgroundColor: cat.color || '#3b82f6' }}
                className="h-full transition-all duration-500 rounded-full"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
