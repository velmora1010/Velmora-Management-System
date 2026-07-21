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
    <div className="p-5 bg-card border border-border rounded-xl space-y-3 shadow-sm hover:border-slate-700 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted tracking-wide uppercase">{title}</span>
        <div className={`p-2 rounded-lg border ${colorBadge}`}>
          {icon}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-2xl font-bold text-main tracking-tight font-mono">
          {value}
        </div>
        {subtitle && (
          <div className="text-[11px] text-muted flex items-center gap-1">
            {trend && (
              <span className={`inline-flex items-center text-[10px] font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
                {trend}
              </span>
            )}
            <span>{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
};
