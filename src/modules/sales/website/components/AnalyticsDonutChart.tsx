import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { PieChart as PieIcon, AlertCircle } from 'lucide-react';

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
  onSliceClick,
  selectedSliceName,
  emptyMessage = 'No data available',
  height = 250,
  innerRadius = 60,
  outerRadius = 90
}) => {
  const chartTotal = React.useMemo(() => {
    return data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  }, [data]);

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

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as DonutSliceData;
      const pct = chartTotal > 0 ? ((d.value / chartTotal) * 100).toFixed(1) : '0';

      const mainValFormatted = valueFormatter 
        ? valueFormatter(d.value, d)
        : typeof d.value === 'number' && (d.revenue !== undefined || d.name?.toLowerCase().includes('revenue') || d.name?.toLowerCase().includes('receivable') || d.name?.toLowerCase().includes('advance'))
          ? `₹${d.value.toLocaleString()}`
          : d.value.toLocaleString();

      return (
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl text-xs space-y-1 font-mono z-50 min-w-[150px]">
          <p className="font-bold text-white font-sans border-b border-slate-800 pb-1">
            {d.name || d.product || d.offer || d.state || d.cityState || d.pincode}
          </p>
          <div className="space-y-0.5 pt-1 text-[11px]">
            <p className="text-cyan-300">
              Value: <strong>{mainValFormatted}</strong> ({pct}%)
            </p>
            {d.orders !== undefined && <p className="text-slate-300">Orders: <strong>{d.orders}</strong></p>}
            {d.revenue !== undefined && <p className="text-emerald-400">Revenue: <strong>₹{d.revenue.toLocaleString()}</strong></p>}
            {d.units !== undefined && <p className="text-purple-300">Units: <strong>{d.units}</strong></p>}
            {d.aov !== undefined && <p className="text-pink-300">AOV: <strong>₹{d.aov.toLocaleString()}</strong></p>}
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
        {centerValue !== undefined && (() => {
          const valStr = typeof centerValue === 'number' ? centerValue.toLocaleString() : String(centerValue);
          const len = valStr.length;
          let fontClass = 'text-xl sm:text-2xl font-extrabold';
          if (len > 14) fontClass = 'text-[11px] sm:text-xs font-black';
          else if (len > 11) fontClass = 'text-xs sm:text-sm font-extrabold';
          else if (len > 8) fontClass = 'text-sm sm:text-base font-extrabold';
          else if (len > 5) fontClass = 'text-base sm:text-lg font-extrabold';

          return (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
              <span className={`${fontClass} text-white tracking-tight drop-shadow-md`}>
                {valStr}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mt-0.5">
                {centerLabel}
              </span>
            </div>
          );
        })()}
      </div>

      {/* LEGEND LIST */}
      <div className="space-y-1.5 text-xs font-mono max-h-[250px] overflow-y-auto pr-1">
        {data.map((item, index) => {
          const pct = chartTotal > 0 ? ((item.value / chartTotal) * 100).toFixed(1) : '0';
          const sliceColor = item.color || DEFAULT_DISTINCT_COLORS[index % DEFAULT_DISTINCT_COLORS.length];
          const isSelected = selectedSliceName === item.name || selectedSliceName === item.state || selectedSliceName === item.city;

          const formattedVal = valueFormatter 
            ? valueFormatter(item.value, item)
            : typeof item.value === 'number' && (item.revenue !== undefined || item.name?.toLowerCase().includes('revenue') || item.name?.toLowerCase().includes('receivable') || item.name?.toLowerCase().includes('advance'))
              ? `₹${item.value.toLocaleString()}`
              : item.value.toLocaleString();

          return (
            <div
              key={`${item.name}-${index}`}
              onClick={() => onSliceClick && onSliceClick(item)}
              className={`p-2 rounded-xl border bg-slate-950 flex items-center justify-between transition-colors ${
                onSliceClick ? 'cursor-pointer hover:border-slate-700' : ''
              } ${
                isSelected ? 'border-purple-500 bg-purple-950/20' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sliceColor }} />
                <span className="font-sans font-bold text-slate-200 truncate">{item.name}</span>
              </div>
              <div className="text-right shrink-0 ml-auto pl-1">
                <span className="font-bold text-white block truncate max-w-[120px]">{formattedVal}</span>
                <span className="text-[10px] text-slate-400 block">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
