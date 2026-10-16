import React from 'react';
import type { TrendDataPoint, CategoryBreakdown } from '../../types/analytics';
import { TrendingUp, PieChart } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

interface TrendChartProps {
  title: string;
  subtitle?: string;
  data: TrendDataPoint[];
}

export const AnalyticsTrendChart: React.FC<TrendChartProps> = ({ title, subtitle, data }) => {
  const formatCurrency = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  };

  return (
    <div className="p-5 bg-slate-900/60 border border-slate-700/80 rounded-2xl space-y-4 shadow-sm backdrop-blur-sm flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <TrendingUp size={15} />
            </div>
            <span>{title}</span>
          </h4>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
            <span className="text-slate-300 font-medium text-[11px]">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
            <span className="text-slate-300 font-medium text-[11px]">Expenses</span>
          </div>
        </div>
      </div>

      <div className="h-56 sm:h-64 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No trend data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={formatCurrency}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900/95 border border-slate-700/90 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs space-y-1.5 min-w-[140px]">
                        <p className="font-semibold text-slate-200 border-b border-slate-800 pb-1">{label}</p>
                        {payload.map((entry, index) => (
                          <div key={index} className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-slate-400 capitalize">{entry.name}:</span>
                            <span className="font-mono font-semibold" style={{ color: entry.color }}>
                              ₹{Number(entry.value).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="secondaryValue"
                name="Revenue"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="value"
                name="Expenses"
                fill="#a855f7"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
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
    <div className="p-5 bg-slate-900/60 border border-slate-700/80 rounded-2xl space-y-4 shadow-sm backdrop-blur-sm flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <PieChart size={15} />
            </div>
            <span>{title}</span>
          </h4>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="space-y-3 pt-1">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No breakdown data available
          </div>
        ) : (
          items.map((cat, idx) => (
            <div key={idx} className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center font-medium">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: cat.color || '#a855f7' }}
                  />
                  <span>{cat.category}</span>
                </span>
                <span className="text-slate-100 font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 font-semibold">
                  {cat.count} ({cat.percentage}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950/80 rounded-full overflow-hidden border border-slate-800/60">
                <div
                  style={{ width: `${cat.percentage}%`, backgroundColor: cat.color || '#a855f7' }}
                  className="h-full transition-all duration-500 rounded-full"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
