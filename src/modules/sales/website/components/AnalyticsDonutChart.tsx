import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { PieChart as PieIcon, AlertCircle } from 'lucide-react';
import { formatIndianCurrency, formatIndianNumber } from '../websiteSalesUtils';

export interface DonutSliceData {
  name: string;
  value: number;
  color?: string;
  orders?: number;
  revenue?: number;
  units?: number;
  aov?: number;
  pincode?: string;
  city?: string;
  state?: string;
  cityState?: string;
  product?: string;
  offer?: string;
  [key: string]: any;
}

const DEFAULT_DISTINCT_COLORS = [
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#64748b'  // Others (Slate)
];

export interface AnalyticsDonutChartProps {
  data: DonutSliceData[];
  centerValue?: string | number;
  centerLabel?: string;
  valueFormatter?: (value: number, item: DonutSliceData) => string;
  isCurrency?: boolean;
  onSliceClick?: (item: DonutSliceData) => void;
  selectedSliceName?: string | null;
  emptyMessage?: string;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export const AnalyticsDonutChart: React.FC<AnalyticsDonutChartProps> = ({
  data,
  centerValue,
  centerLabel = 'TOTAL',
  valueFormatter,
  isCurrency = false,
  onSliceClick,
  selectedSliceName,
  emptyMessage = 'No data available',
  height = 250,
  innerRadius = 60,
  outerRadius = 90
}) => {
  // HOOK 1: Chart Total calculation (MUST BE AT TOP LEVEL)
  const chartTotal = React.useMemo(() => {
    if (!data) return 0;
    return data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  }, [data]);

  // HOOK 2: Format Center Value (MUST BE AT TOP LEVEL BEFORE ANY EARLY RETURN)
  const formattedCenterValue = React.useMemo(() => {
    if (centerValue === undefined || centerValue === null) return '';
    if (typeof centerValue === 'number') {
      return isCurrency ? formatIndianCurrency(centerValue) : formatIndianNumber(centerValue);
    }
    return String(centerValue);
  }, [centerValue, isCurrency]);

  // HOOK 3: Center Font Size Class (MUST BE AT TOP LEVEL BEFORE ANY EARLY RETURN)
  const centerFontSizeClass = React.useMemo(() => {
    const len = formattedCenterValue.length;
    if (len > 15) return 'text-xs font-extrabold';
    if (len > 12) return 'text-sm font-extrabold';
    if (len > 9) return 'text-base font-extrabold';
    return 'text-xl sm:text-2xl font-extrabold';
  }, [formattedCenterValue]);

  // EARLY RETURN IF DATA IS EMPTY (Hooks count is strictly invariant on every render!)
  if (!data || data.length === 0 || chartTotal === 0) {
    return (
      <div 
        style={{ height: `${height}px` }} 
        className="w-full flex flex-col items-center justify-center text-center p-6 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-2"
      >
        <AlertCircle size={28} className="text-slate-600" />
        <p className="text-xs text-slate-400 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  const formatSliceValue = (val: number, item: DonutSliceData): string => {
    if (valueFormatter) return valueFormatter(val, item);
    if (isCurrency) return formatIndianCurrency(val);
    return formatIndianNumber(val);
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as DonutSliceData;
      const pct = chartTotal > 0 ? ((d.value / chartTotal) * 100).toFixed(1) : '0';

      const mainValFormatted = formatSliceValue(d.value, d);

      return (
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl text-xs space-y-1 font-mono z-50 min-w-[160px]">
          <p className="font-bold text-white font-sans border-b border-slate-800 pb-1">
            {d.name || d.product || d.offer || d.state || d.cityState || d.pincode}
          </p>
          <div className="space-y-0.5 pt-1 text-[11px]">
            <p className="text-cyan-300">
              Value: <strong>{mainValFormatted}</strong> ({pct}%)
            </p>
            {d.orders !== undefined && <p className="text-slate-300">Orders: <strong>{formatIndianNumber(d.orders)}</strong></p>}
            {d.revenue !== undefined && <p className="text-emerald-400">Revenue: <strong>{formatIndianCurrency(d.revenue)}</strong></p>}
            {d.units !== undefined && <p className="text-purple-300">Units: <strong>{formatIndianNumber(d.units)}</strong></p>}
            {d.aov !== undefined && <p className="text-pink-300">AOV: <strong>{formatIndianCurrency(d.aov)}</strong></p>}
            {d.city !== undefined && d.city !== d.name && <p className="text-slate-400">City: <strong>{d.city}</strong></p>}
            {d.state !== undefined && d.state !== d.name && <p className="text-slate-400">State: <strong>{d.state}</strong></p>}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center w-full">
      {/* DONUT CHART RING */}
      <div style={{ height: `${height}px` }} className="relative w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={3}
            >
              {data.map((entry, index) => {
                const sliceColor = entry.color || DEFAULT_DISTINCT_COLORS[index % DEFAULT_DISTINCT_COLORS.length];
                const isSelected = selectedSliceName === entry.name || selectedSliceName === entry.state || selectedSliceName === entry.city;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={sliceColor}
                    opacity={selectedSliceName ? (isSelected ? 1 : 0.4) : 1}
                    stroke={isSelected ? '#ffffff' : 'none'}
                    strokeWidth={isSelected ? 2 : 0}
                    onClick={() => onSliceClick && onSliceClick(entry)}
                    className={onSliceClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                  />
                );
              })}
            </Pie>
            <Tooltip content={<CustomPieTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* CENTER OVERLAY (TOTAL VALUE & LABEL) */}
        {formattedCenterValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
            <span className={`${centerFontSizeClass} text-white tracking-tight drop-shadow-md`}>
              {formattedCenterValue}
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mt-0.5">
              {centerLabel}
            </span>
          </div>
        )}
      </div>

      {/* LEGEND LIST */}
      <div className="space-y-1.5 text-xs font-mono max-h-[250px] overflow-y-auto pr-1">
        {data.map((item, index) => {
          const pct = chartTotal > 0 ? ((item.value / chartTotal) * 100).toFixed(1) : '0';
          const sliceColor = item.color || DEFAULT_DISTINCT_COLORS[index % DEFAULT_DISTINCT_COLORS.length];
          const isSelected = selectedSliceName === item.name || selectedSliceName === item.state || selectedSliceName === item.city;
          const formattedVal = formatSliceValue(item.value, item);

          return (
            <div
              key={`${item.name}-${index}`}
              onClick={() => onSliceClick && onSliceClick(item)}
              className={`p-2.5 rounded-xl border bg-slate-950 flex items-center justify-between gap-2 min-w-0 transition-colors ${
                onSliceClick ? 'cursor-pointer hover:border-slate-700' : ''
              } ${
                isSelected ? 'border-purple-500 bg-purple-950/30 ring-1 ring-purple-500/50' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 shrink flex-1 pr-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sliceColor }} />
                <span className="font-sans font-bold text-slate-200 text-xs truncate" title={item.name}>
                  {item.name}
                </span>
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="font-bold text-white text-xs tracking-tight whitespace-nowrap">
                  {formattedVal}
                </div>
                <div className="text-[10px] text-slate-400 font-medium text-right">
                  {pct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
