import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
    label: string;
  };
  indicator?: {
    color: string;
    label: string;
  };
  onClick?: () => void;
  restricted?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  indicator,
  onClick,
  restricted = false,
}) => {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`bg-card rounded-2xl p-4 sm:p-5 border border-border shadow-velmora hover:shadow-velmora-hover hover:border-primary/40 transition-all duration-200 flex flex-col justify-between group ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* Top Header: Title & Icon */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
            {title}
          </span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
              {value}
            </span>
          </div>
        </div>

        <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor} flex-shrink-0 transition-transform group-hover:scale-110 shadow-xs`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {/* Bottom Footer: Trend or Indicator */}
      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
        {trend && (
          <div className="flex items-center gap-1">
            <span
              className={`inline-flex items-center text-[11px] font-bold ${
                trend.isNeutral
                  ? 'text-slate-400'
                  : trend.isPositive
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {trend.isNeutral ? (
                <Minus className="w-3 h-3 mr-0.5" />
              ) : trend.isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {trend.value}
            </span>
            <span className="text-[11px] text-muted truncate">{trend.label}</span>
          </div>
        )}

        {indicator && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className={`w-2 h-2 rounded-full ${indicator.color}`} />
            <span className="text-[11px] font-medium text-muted">{indicator.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};
