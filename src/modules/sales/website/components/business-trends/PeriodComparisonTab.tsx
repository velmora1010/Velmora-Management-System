import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  TrendingUp,
  Info
} from 'lucide-react';
import type { MonthlyPerformanceRecord, YearlyPerformanceRecord } from './businessTrendsTypes';
import { comparePeriods } from './businessTrendsCalculations';

interface PeriodComparisonTabProps {
  monthlyRecords: MonthlyPerformanceRecord[];
  yearlyRecords: YearlyPerformanceRecord[];
}

export const PeriodComparisonTab: React.FC<PeriodComparisonTabProps> = ({
  monthlyRecords,
  yearlyRecords
}) => {
  const [comparisonType, setComparisonType] = useState<'monthly' | 'yearly'>('monthly');

  // Month selectors (default to last 2 months if available)
  const defaultMonthA = monthlyRecords[monthlyRecords.length - 1]?.monthKey || '';
  const defaultMonthB = monthlyRecords[monthlyRecords.length - 2]?.monthKey || defaultMonthA;
  const [selectedMonthA, setSelectedMonthA] = useState<string>(defaultMonthA);
  const [selectedMonthB, setSelectedMonthB] = useState<string>(defaultMonthB);

  // Year selectors (default to last 2 years if available)
  const defaultYearA = yearlyRecords[yearlyRecords.length - 1]?.year || 2026;
  const defaultYearB = yearlyRecords[yearlyRecords.length - 2]?.year || defaultYearA;
  const [selectedYearA, setSelectedYearA] = useState<number>(defaultYearA);
  const [selectedYearB, setSelectedYearB] = useState<number>(defaultYearB);

  // Active records
  const comparisonResult = useMemo(() => {
    if (comparisonType === 'monthly') {
      const recA = monthlyRecords.find(m => m.monthKey === selectedMonthA) || monthlyRecords[monthlyRecords.length - 1];
      const recB = monthlyRecords.find(m => m.monthKey === selectedMonthB) || monthlyRecords[monthlyRecords.length - 2] || recA;
      if (!recA || !recB) return null;
      return comparePeriods(recA, recB, 'monthly');
    } else {
      const recA = yearlyRecords.find(y => y.year === selectedYearA) || yearlyRecords[yearlyRecords.length - 1];
      const recB = yearlyRecords.find(y => y.year === selectedYearB) || yearlyRecords[yearlyRecords.length - 2] || recA;
      if (!recA || !recB) return null;
      return comparePeriods(recA, recB, 'yearly');
    }
  }, [comparisonType, selectedMonthA, selectedMonthB, selectedYearA, selectedYearB, monthlyRecords, yearlyRecords]);

  if (!comparisonResult) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
        Not enough historical data to generate comparison.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Comparison Type & Period Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <GitCompare size={16} className="text-purple-400" />
          <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setComparisonType('monthly')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                comparisonType === 'monthly'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Month vs Month
            </button>
            <button
              type="button"
              onClick={() => setComparisonType('yearly')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                comparisonType === 'yearly'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Year vs Year
            </button>
          </div>
        </div>

        {/* Dropdowns for Period A (Current) and Period B (Baseline) */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {comparisonType === 'monthly' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Period A (Current):</span>
                <select
                  value={selectedMonthA}
                  onChange={e => setSelectedMonthA(e.target.value)}
                  className="h-8 px-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-white font-mono text-xs cursor-pointer focus:border-purple-500"
                >
                  {monthlyRecords.map(m => (
                    <option key={m.monthKey} value={m.monthKey}>
                      {m.monthLabel}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-slate-600 font-bold">vs</span>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Period B (Baseline):</span>
                <select
                  value={selectedMonthB}
                  onChange={e => setSelectedMonthB(e.target.value)}
                  className="h-8 px-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-white font-mono text-xs cursor-pointer focus:border-purple-500"
                >
                  {monthlyRecords.map(m => (
                    <option key={m.monthKey} value={m.monthKey}>
                      {m.monthLabel}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Year A (Current):</span>
                <select
                  value={selectedYearA}
                  onChange={e => setSelectedYearA(Number(e.target.value))}
                  className="h-8 px-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-white font-mono text-xs cursor-pointer focus:border-purple-500"
                >
                  {yearlyRecords.map(y => (
                    <option key={y.year} value={y.year}>
                      {y.yearLabel}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-slate-600 font-bold">vs</span>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Year B (Baseline):</span>
                <select
                  value={selectedYearB}
                  onChange={e => setSelectedYearB(Number(e.target.value))}
                  className="h-8 px-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-white font-mono text-xs cursor-pointer focus:border-purple-500"
                >
                  {yearlyRecords.map(y => (
                    <option key={y.year} value={y.year}>
                      {y.yearLabel}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Top Comparison Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {comparisonResult.metrics.slice(0, 4).map(m => {
          const isPositive = m.difference >= 0;
          const isGood = m.isLowerBetter ? !isPositive : isPositive;
          const badgeColor = isGood ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' : 'text-rose-400 bg-rose-950/60 border-rose-800/60';

          return (
            <div key={m.metricKey} className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                {m.metricLabel}
              </span>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-lg font-black font-mono text-white">
                  {m.isCurrency ? `₹${m.currentValue.toLocaleString('en-IN')}` : m.currentValue.toLocaleString('en-IN')}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-0.5 ${badgeColor}`}>
                  {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {m.percentChange != null ? `${Math.abs(m.percentChange)}%` : '—'}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                vs {m.isCurrency ? `₹${m.previousValue.toLocaleString('en-IN')}` : m.previousValue.toLocaleString('en-IN')} in {comparisonResult.previousLabel}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Detailed Metrics Comparison Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th className="py-2.5 px-3">Performance Metric</th>
              <th className="py-2.5 px-3 text-right text-purple-300">{comparisonResult.currentLabel} (Current)</th>
              <th className="py-2.5 px-3 text-right text-slate-400">{comparisonResult.previousLabel} (Baseline)</th>
              <th className="py-2.5 px-3 text-right">Absolute Difference</th>
              <th className="py-2.5 px-3 text-right">Percentage Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {comparisonResult.metrics.map(m => {
              const isPositive = m.difference >= 0;
              const isGood = m.isLowerBetter ? !isPositive : isPositive;
              const textColor = m.difference === 0 ? 'text-slate-400' : isGood ? 'text-emerald-400' : 'text-rose-400';

              return (
                <tr key={m.metricKey} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-white font-sans">
                    {m.metricLabel}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">
                    {m.isCurrency ? `₹${m.currentValue.toLocaleString('en-IN')}` : m.currentValue.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">
                    {m.isCurrency ? `₹${m.previousValue.toLocaleString('en-IN')}` : m.previousValue.toLocaleString('en-IN')}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold ${textColor}`}>
                    {m.difference > 0 ? '+' : ''}
                    {m.isCurrency ? `₹${m.difference.toLocaleString('en-IN')}` : m.difference.toLocaleString('en-IN')}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold ${textColor}`}>
                    {m.percentChange != null ? (
                      <span className="inline-flex items-center gap-0.5">
                        {m.percentChange > 0 ? '+' : ''}{m.percentChange}%
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PeriodComparisonTab;
