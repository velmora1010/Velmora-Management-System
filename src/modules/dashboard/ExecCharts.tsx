import { memo } from 'react';
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ExecChartData } from '../../hooks/analytics/useExecutiveDashboard';

// ── Theme Constants ───────────────────────────────────────────────────────────

const PALETTE = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#2dd4bf', '#fb923c', '#f472b6'] as const;

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '10px',
  color: '#fff',
  fontSize: '13px',
};

const AXIS_STYLE = { stroke: '#475569', fontSize: 11 };

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtINR = (v: number) => {
  const n = Math.max(0, v);
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ChartCard = ({ title, children, span = 1 }: { title: string; children: React.ReactNode; span?: number }) => (
  <div
    className={span === 2 ? 'col-span-1 lg:col-span-2' : 'col-span-1'}
    style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '24px' }}
  >
    <h3 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: '0 0 18px 0' }}>{title}</h3>
    {children}
  </div>
);

const NoData = () => (
  <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#475569' }}>
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3h18v18H3zM9 9h6M9 12h6M9 15h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span style={{ fontSize: '13px' }}>No data available</span>
  </div>
);

const SkeletonChart = () => (
  <div
    style={{ height: 280, borderRadius: '20px', background: '#1e293b', border: '1px solid #334155', animation: 'pulse 2s ease infinite' }}
  />
);

// ── Custom Pie Label ──────────────────────────────────────────────────────────

const renderPieLabel = (entry: any) =>
  (entry.percent || 0) > 0.05 ? `${entry.name || ''} ${((entry.percent || 0) * 100).toFixed(0)}%` : '';

// ── Main Component ────────────────────────────────────────────────────────────

interface ExecChartsProps {
  charts: ExecChartData;
  isLoading: boolean;
}

export const ExecCharts = memo(({ charts, isLoading }: ExecChartsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 7 }).map((_, i) => <SkeletonChart key={i} />)}
      </div>
    );
  }

  const hasExpense  = charts.monthlyExpense.some(m => m.amount > 0);
  const hasCampaign = charts.campaignStatus.length > 0;
  const hasPO       = charts.poByMonth.some(m => m.count > 0);
  const hasStock    = charts.stockLevels.length > 0;
  const hasProd     = charts.dailyProduction.some(d => d.batches > 0);
  const hasTask     = charts.taskStatus.length > 0;
  const hasQC       = charts.qcPassFail.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* 1 — Monthly Expenses (Area, full width) */}
      <ChartCard title="Monthly Expenses" span={2}>
        {!hasExpense ? <NoData /> : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={charts.monthlyExpense} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="execExpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f87171" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
              <XAxis dataKey="month"  {...AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtINR} {...AXIS_STYLE} tickLine={false} axisLine={false} width={55} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [fmtINR(Number(v || 0)), 'Expense']}
              />
              <Area type="monotone" dataKey="amount" stroke="#f87171" strokeWidth={2} fill="url(#execExpGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 2 — Campaign Status (Pie) */}
      <ChartCard title="Campaign Status">
        {!hasCampaign ? <NoData /> : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={charts.campaignStatus}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                outerRadius={82}
                label={renderPieLabel}
                labelLine={false}
                fontSize={11}
              >
                {charts.campaignStatus.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 3 — Task Status (Donut Pie) */}
      <ChartCard title="Task Status">
        {!hasTask ? <NoData /> : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={charts.taskStatus}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                innerRadius={52}
                outerRadius={82}
                label={renderPieLabel}
                labelLine={false}
                fontSize={11}
              >
                {charts.taskStatus.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 4 — Purchase Orders by Month (Bar, full width) */}
      <ChartCard title="Purchase Orders by Month" span={2}>
        {!hasPO ? <NoData /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={charts.poByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
              <XAxis dataKey="month" {...AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [Number(v || 0), 'Orders']}
              />
              <Bar dataKey="count" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 5 — Stock Levels (Horizontal Bar) */}
      <ChartCard title="Stock Levels — Top Items">
        {!hasStock ? <NoData /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={charts.stockLevels} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" horizontal={false} />
              <XAxis type="number" {...AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis
                type="category" dataKey="name"
                {...AXIS_STYLE} tickLine={false} axisLine={false}
                width={80}
                tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [Number(v || 0), 'Units']}
              />
              <Bar dataKey="quantity" fill="#22d3ee" radius={[0, 6, 6, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 6 — QC Pass vs Fail (Pie) */}
      <ChartCard title="QC Pass vs Fail">
        {!hasQC ? <NoData /> : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={charts.qcPassFail}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                outerRadius={82}
                label={renderPieLabel}
                labelLine={false}
                fontSize={11}
              >
                {charts.qcPassFail.map((entry, i) => {
                  const c = entry.name === 'Passed' ? '#4ade80' : entry.name === 'Pending' ? '#fbbf24' : '#f87171';
                  return <Cell key={i} fill={c} />;
                })}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 7 — Daily Production (Line, full width) */}
      <ChartCard title="Daily Production — Last 14 Days" span={2}>
        {!hasProd ? <NoData /> : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={charts.dailyProduction} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
              <XAxis dataKey="date" {...AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [Number(v || 0), 'Batches']}
              />
              <Line
                type="monotone"
                dataKey="batches"
                stroke="#fb923c"
                strokeWidth={2.5}
                dot={{ fill: '#fb923c', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: '#fdba74' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

    </div>
  );
});

ExecCharts.displayName = 'ExecCharts';
