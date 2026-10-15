import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface AnalyticsKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  colorBadge?: string;
}

export const AnalyticsKpiCard: React.FC<AnalyticsKpiCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  isPositive = true,
  icon,
  colorBadge = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
}) => {
  return (
    <div className="p-5 bg-slate-900/60 border border-slate-700/80 rounded-2xl space-y-3.5 shadow-sm hover:border-slate-600/80 transition-all duration-200 backdrop-blur-sm flex flex-col justify-between group">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">{title}</span>
        <div className={`p-2.5 rounded-xl border shadow-sm transition-transform group-hover:scale-105 duration-200 ${colorBadge}`}>
          {icon}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-2xl font-bold text-slate-100 tracking-tight font-mono">
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5 pt-0.5">
            {trend && (
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                isPositive
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/25'
              }`}>
                {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                <span>{trend}</span>
              </span>
            )}
            <span className="truncate">{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
};
