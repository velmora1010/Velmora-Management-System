import { memo, useMemo } from 'react';
import {
  Building2, Layers, Megaphone, CheckSquare, Clock,
  IndianRupee, ShoppingCart, Users, Package, Warehouse,
  Factory, ShieldCheck, AlertCircle, Truck,
} from 'lucide-react';
import type { ExecKPIs } from '../../hooks/analytics/useExecutiveDashboard';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (n: number): string => Math.max(0, n).toLocaleString('en-IN');

const fmtCurrency = (n: number): string => {
  const v = Math.max(0, n);
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000)   return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)     return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${fmt(v)}`;
};

// ── Card Config ───────────────────────────────────────────────────────────────

interface CardCfg {
  title: string;
  value: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

const Skeleton = () => (
  <div
    className="h-28 rounded-2xl border border-border animate-pulse"
    style={{ background: '#1e293b' }}
  />
);

// ── Component ─────────────────────────────────────────────────────────────────

interface KPICardsProps {
  kpis: ExecKPIs;
  isLoading: boolean;
}

export const KPICards = memo(({ kpis, isLoading }: KPICardsProps) => {
  const cards: CardCfg[] = useMemo(() => [
    {
      title: 'Total Departments',
      value: fmt(kpis.totalDepartments),
      Icon: Building2,
      color: '#94a3b8',
      bg: 'rgba(148,163,184,0.1)',
    },
    {
      title: 'Total Sections',
      value: fmt(kpis.totalSections),
      Icon: Layers,
      color: '#64748b',
      bg: 'rgba(100,116,139,0.1)',
    },
    {
      title: 'Active Campaigns',
      value: fmt(kpis.activeCampaigns),
      Icon: Megaphone,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.12)',
    },
    {
      title: 'Total Tasks',
      value: fmt(kpis.totalTasks),
      Icon: CheckSquare,
      color: '#60a5fa',
      bg: 'rgba(96,165,250,0.12)',
    },
    {
      title: 'Pending Tasks',
      value: fmt(kpis.pendingTasks),
      Icon: Clock,
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.12)',
    },
    {
      title: 'Total Expenses',
      value: fmtCurrency(kpis.totalExpenses),
      Icon: IndianRupee,
      color: '#f87171',
      bg: 'rgba(248,113,113,0.12)',
    },
    {
      title: 'Purchase Orders',
      value: fmt(kpis.totalPurchaseOrders),
      Icon: ShoppingCart,
      color: '#34d399',
      bg: 'rgba(52,211,153,0.12)',
    },
    {
      title: 'Total Vendors',
      value: fmt(kpis.totalVendors),
      Icon: Users,
      color: '#2dd4bf',
      bg: 'rgba(45,212,191,0.12)',
    },
    {
      title: 'Total Products',
      value: fmt(kpis.totalProducts),
      Icon: Package,
      color: '#818cf8',
      bg: 'rgba(129,140,248,0.12)',
    },
    {
      title: 'Inventory Value',
      value: fmtCurrency(kpis.inventoryValue),
      Icon: Warehouse,
      color: '#22d3ee',
      bg: 'rgba(34,211,238,0.12)',
    },
    {
      title: 'Production Batches',
      value: fmt(kpis.productionBatches),
      Icon: Factory,
      color: '#fb923c',
      bg: 'rgba(251,146,60,0.12)',
    },
    {
      title: 'QC Pending',
      value: fmt(kpis.qcPending),
      Icon: AlertCircle,
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.12)',
    },
    {
      title: 'QC Passed',
      value: fmt(kpis.qcPassed),
      Icon: ShieldCheck,
      color: '#4ade80',
      bg: 'rgba(74,222,128,0.12)',
    },
    {
      title: "Today's Dispatches",
      value: fmt(kpis.todaysDispatches),
      Icon: Truck,
      color: '#f472b6',
      bg: 'rgba(244,114,182,0.12)',
    },
  ], [kpis]);

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: '14px' }}>
        {Array.from({ length: 14 }).map((_, i) => <Skeleton key={i} />)}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: '14px' }}>
      {cards.map(({ title, value, Icon, color, bg }, i) => (
        <div
          key={i}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '18px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.transform = '';
            (e.currentTarget as HTMLDivElement).style.boxShadow = '';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.3 }}>
              {title}
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={17} color={color} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
});

KPICards.displayName = 'KPICards';
