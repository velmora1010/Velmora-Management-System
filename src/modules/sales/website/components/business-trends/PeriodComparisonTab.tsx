import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  TrendingUp,
  Info,
  DollarSign,
  Package,
  CheckCircle2,
  Users
} from 'lucide-react';
import type { MonthlyPerformanceRecord, YearlyPerformanceRecord } from './businessTrendsTypes';
import { FULL_MONTH_NAMES, SHORT_MONTH_NAMES, comparePeriods } from './businessTrendsCalculations';

interface PeriodComparisonTabProps {
  monthlyRecords: MonthlyPerformanceRecord[];
  yearlyRecords: YearlyPerformanceRecord[];
}

export const PeriodComparisonTab: React.FC<PeriodComparisonTabProps> = ({
  monthlyRecords,
  yearlyRecords
}) => {
  // 4 Modes: 'monthly' | 'yearly' | 'same_month_multi_year' | 'full_year_12_months'
  const [comparisonMode, setComparisonMode] = useState<
    'monthly' | 'yearly' | 'same_month_multi_year' | 'full_year_12_months'
  >('full_year_12_months');

  // Month selectors (default to last 2 months if available)
  const defaultMonthA = monthlyRecords[monthlyRecords.length - 1]?.monthKey || '';
  const defaultMonthB = monthlyRecords[monthlyRecords.length - 2]?.monthKey || defaultMonthA;
  const [selectedMonthA, setSelectedMonthA] = useState<string>(defaultMonthA);
  const [selectedMonthB, setSelectedMonthB] = useState<string>(defaultMonthB);

  // Year selectors (default to 2026 vs 2025 if available)
  const availableYears = yearlyRecords.map(y => y.year);
  const defaultYearA = availableYears.includes(2026) ? 2026 : yearlyRecords[yearlyRecords.length - 1]?.year || 2026;
  const defaultYearB = availableYears.includes(2025) ? 2025 : yearlyRecords[yearlyRecords.length - 2]?.year || defaultYearA;
  const [selectedYearA, setSelectedYearA] = useState<number>(defaultYearA);
  const [selectedYearB, setSelectedYearB] = useState<number>(defaultYearB);

  // Same Month selector (1..12)
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(new Date().getMonth() + 1);

  // Active records & calculation
  const comparisonResult = useMemo(() => {
    if (comparisonMode === 'monthly') {
      const recA = monthlyRecords.find(m => m.monthKey === selectedMonthA) || monthlyRecords[monthlyRecords.length - 1];
      const recB = monthlyRecords.find(m => m.monthKey === selectedMonthB) || monthlyRecords[monthlyRecords.length - 2] || recA;
      if (!recA || !recB) return null;
      return comparePeriods(recA, recB, 'monthly');
    }

    if (comparisonMode === 'same_month_multi_year') {
      const yearRecA = yearlyRecords.find(y => y.year === selectedYearA) || yearlyRecords[yearlyRecords.length - 1];
      const yearRecB = yearlyRecords.find(y => y.year === selectedYearB) || yearlyRecords[yearlyRecords.length - 2] || yearRecA;
      const recA = yearRecA?.monthlyBreakdown?.find(m => m.monthNumber === selectedMonthNum) ||
        monthlyRecords.find(m => m.year === selectedYearA && m.monthNumber === selectedMonthNum);
      const recB = yearRecB?.monthlyBreakdown?.find(m => m.monthNumber === selectedMonthNum) ||
        monthlyRecords.find(m => m.year === selectedYearB && m.monthNumber === selectedMonthNum);
      if (!recA || !recB) return null;
      return comparePeriods(recA, recB, 'same_month_multi_year');
    }

    // 'yearly' or 'full_year_12_months'
    const recA = yearlyRecords.find(y => y.year === selectedYearA) || yearlyRecords[yearlyRecords.length - 1];
    const recB = yearlyRecords.find(y => y.year === selectedYearB) || yearlyRecords[yearlyRecords.length - 2] || recA;
    if (!recA || !recB) return null;

    const yearA12Months = recA.monthlyBreakdown;
    const yearB12Months = recB.monthlyBreakdown;

    return comparePeriods(
      recA,
      recB,
      comparisonMode === 'full_year_12_months' ? 'full_year_12_months' : 'yearly',
      yearA12Months,
      yearB12Months
    );
  }, [
    comparisonMode,
    selectedMonthA,
    selectedMonthB,
    selectedYearA,
    selectedYearB,
    selectedMonthNum,
    monthlyRecords,
    yearlyRecords
  ]);

  if (!comparisonResult) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
        Not enough historical data to generate comparison.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Comparison Mode Switcher & Period Selectors */}
      <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitCompare size={16} className="text-cyan-400" />
            <h4 className="text-sm font-bold text-white">
              Multi-Period Financial & Operations Comparison
            </h4>
          </div>

          {/* 4 Mode Buttons */}
          <div className="flex flex-wrap items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setComparisonMode('full_year_12_months')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                comparisonMode === 'full_year_12_months'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              12-Month Year Trajectory
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode('yearly')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                comparisonMode === 'yearly'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Year vs Year
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode('same_month_multi_year')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                comparisonMode === 'same_month_multi_year'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Same Month Across Years
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode('monthly')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                comparisonMode === 'monthly'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Month vs Month
            </button>
          </div>
        </div>

        {/* Dynamic Period Selectors */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          {comparisonMode === 'monthly' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Period A (Current):</span>
                <select
                  value={selectedMonthA}
                  onChange={e => setSelectedMonthA(e.target.value)}
                  className="h-8 px-2.5 bg-slate-900 border border-cyan-500/60 rounded-lg text-white font-mono text-xs cursor-pointer focus:border-cyan-400"
                >
                  {monthlyRecords.map(m => (
                    <option key={m.monthKey} value={m.monthKey}>
                      {m.monthLong} {m.year}
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
                  className="h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-mono text-xs cursor-pointer focus:border-cyan-400"
                >
                  {monthlyRecords.map(m => (
                    <option key={m.monthKey} value={m.monthKey}>
                      {m.monthLong} {m.year}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {comparisonMode === 'same_month_multi_year' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Month:</span>
                <select
                  value={selectedMonthNum}
                  onChange={e => setSelectedMonthNum(Number(e.target.value))}
                  className="h-8 px-2.5 bg-slate-900 border border-cyan-500/60 rounded-lg text-white font-medium text-xs cursor-pointer"
                >
                  {FULL_MONTH_NAMES.map((mName, idx) => (
                    <option key={mName} value={idx + 1}>
                      {mName}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-slate-600 font-bold">in Year</span>

              <select
                value={selectedYearA}
                onChange={e => setSelectedYearA(Number(e.target.value))}
                className="h-8 px-2.5 bg-slate-900 border border-cyan-500/60 rounded-lg text-white font-mono text-xs cursor-pointer"
              >
                {yearlyRecords.map(y => (
                  <option key={y.year} value={y.year}>{y.yearLabel}</option>
                ))}
              </select>

              <span className="text-slate-600 font-bold">vs Year</span>

              <select
                value={selectedYearB}
                onChange={e => setSelectedYearB(Number(e.target.value))}
                className="h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-mono text-xs cursor-pointer"
              >
                {yearlyRecords.map(y => (
                  <option key={y.year} value={y.year}>{y.yearLabel}</option>
                ))}
              </select>
            </>
          )}

          {(comparisonMode === 'yearly' || comparisonMode === 'full_year_12_months') && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Current Year A:</span>
                <select
                  value={selectedYearA}
                  onChange={e => setSelectedYearA(Number(e.target.value))}
                  className="h-8 px-2.5 bg-slate-900 border border-cyan-500/60 rounded-lg text-white font-mono text-xs cursor-pointer"
                >
                  {yearlyRecords.map(y => (
                    <option key={y.year} value={y.year}>{y.yearLabel}</option>
                  ))}
                </select>
              </div>

              <span className="text-slate-600 font-bold">vs</span>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Baseline Year B:</span>
                <select
                  value={selectedYearB}
                  onChange={e => setSelectedYearB(Number(e.target.value))}
                  className="h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-mono text-xs cursor-pointer"
                >
                  {yearlyRecords.map(y => (
                    <option key={y.year} value={y.year}>{y.yearLabel}</option>
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
        <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Detailed Performance Metrics Comparison
          </span>
          <span className="text-[10px] font-mono text-cyan-300">
            {comparisonResult.currentLabel} vs {comparisonResult.previousLabel}
          </span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th className="py-2.5 px-3">Performance Metric</th>
              <th className="py-2.5 px-3 text-right text-cyan-300">{comparisonResult.currentLabel} (Current)</th>
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

      {/* 4. Full Year 12-Month Month-by-Month Trajectory Table (when comparing years) */}
      {comparisonResult.monthByMonthComparison && (
        <div className="overflow-x-auto rounded-xl border border-cyan-800/60 bg-slate-950/60 space-y-2">
          <div className="p-3 bg-slate-900/90 border-b border-cyan-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-cyan-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Full 12-Month Calendar Trajectory Comparison (January to December)
              </h4>
            </div>
            <span className="text-[10px] text-cyan-300 font-mono">
              {comparisonResult.currentLabel} vs {comparisonResult.previousLabel}
            </span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-2 px-3">Month</th>
                <th className="py-2 px-3 text-right text-cyan-300">{comparisonResult.currentLabel} Orders</th>
                <th className="py-2 px-3 text-right text-slate-400">{comparisonResult.previousLabel} Orders</th>
                <th className="py-2 px-3 text-right text-emerald-400">{comparisonResult.currentLabel} Revenue</th>
                <th className="py-2 px-3 text-right text-slate-400">{comparisonResult.previousLabel} Revenue</th>
                <th className="py-2 px-3 text-right text-cyan-400">{comparisonResult.currentLabel} Net Sales</th>
                <th className="py-2 px-3 text-right text-slate-400">{comparisonResult.previousLabel} Net Sales</th>
                <th className="py-2 px-3 text-right">Rev Difference</th>
                <th className="py-2 px-3 text-right">Rev Growth (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {comparisonResult.monthByMonthComparison.map(row => {
                const isPositive = row.revenueDiff >= 0;
                const textColor = row.revenueDiff === 0 ? 'text-slate-400' : isPositive ? 'text-emerald-400' : 'text-rose-400';

                return (
                  <tr key={row.monthShort} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 font-sans font-semibold text-white">
                      {row.monthLong}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-white">{row.currentOrders.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right text-slate-400">{row.previousOrders.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-400">₹{row.currentRevenue.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right text-slate-400">₹{row.previousRevenue.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right text-cyan-400">₹{row.currentNetSales.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right text-slate-400">₹{row.previousNetSales.toLocaleString('en-IN')}</td>
                    <td className={`py-2 px-3 text-right font-bold ${textColor}`}>
                      {row.revenueDiff > 0 ? '+' : ''}₹{row.revenueDiff.toLocaleString('en-IN')}
                    </td>
                    <td className={`py-2 px-3 text-right font-bold ${textColor}`}>
                      {row.revenuePercentChange != null ? (
                        <span>{row.revenuePercentChange > 0 ? '+' : ''}{row.revenuePercentChange}%</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PeriodComparisonTab;
