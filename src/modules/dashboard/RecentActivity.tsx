import { memo } from 'react';
import {
  CheckSquare, ShoppingCart, Megaphone,
  Factory, IndianRupee, HelpCircle,
} from 'lucide-react';
import type { RecentActivityItem } from '../../hooks/analytics/useExecutiveDashboard';

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  task:       { icon: CheckSquare,  color: '#60a5fa', label: 'Task' },
  po:         { icon: ShoppingCart, color: '#34d399', label: 'Purchase Order' },
  campaign:   { icon: Megaphone,    color: '#a78bfa', label: 'Campaign' },
  production: { icon: Factory,      color: '#fb923c', label: 'Production' },
  qc:         { icon: HelpCircle,   color: '#2dd4bf', label: 'QC Barcode' },
  expense:    { icon: IndianRupee,  color: '#f87171', label: 'Expense' },
} as const;

const STATUS_COLORS: Record<string, string> = {
  completed:    '#4ade80', done:         '#4ade80', passed: '#4ade80',
  active:       '#60a5fa', 'in-progress': '#60a5fa',
  pending:      '#fbbf24', draft:        '#94a3b8',
  paid:         '#4ade80', failed:       '#f87171',
  archived:     '#64748b',
};

const getStatusColor = (s: string): string =>
  STATUS_COLORS[s.toLowerCase()] ?? '#64748b';

const fmtDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

const Skeleton = () => (
  <div style={{ height: 62, borderRadius: 12, background: '#0f172a', animation: 'pulse 2s ease infinite' }} />
);

// ── Component ─────────────────────────────────────────────────────────────────

interface RecentActivityProps {
  items: RecentActivityItem[];
  isLoading: boolean;
}

export const RecentActivity = memo(({ items, isLoading }: RecentActivityProps) => (
  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', minHeight: 320 }}>
    <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, margin: '0 0 18px 0' }}>Recent Activity</h3>

    {isLoading ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
      </div>
    ) : items.length === 0 ? (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#475569' }}>
        <CheckSquare size={32} />
        <span style={{ fontSize: 13 }}>No recent activity</span>
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 520 }}>
        {items.map(item => {
          const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.task;
          const Icon = cfg.icon;
          const statusColor = getStatusColor(item.status);
          return (
            <div
              key={`${item.type}-${item.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '11px 14px',
                background: '#0f172a',
                borderRadius: 12,
                border: '1px solid #1e293b',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Icon badge */}
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={cfg.color} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                  {cfg.label} · {fmtDate(item.date)}
                  {item.subtitle ? ` · ${item.subtitle}` : ''}
                </div>
              </div>

              {/* Status chip */}
              <span style={{
                padding: '2px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 700,
                color: statusColor,
                background: `${statusColor}18`,
                textTransform: 'capitalize',
                flexShrink: 0,
              }}>
                {item.status}
              </span>
            </div>
          );
        })}
      </div>
    )}
  </div>
));

RecentActivity.displayName = 'RecentActivity';
