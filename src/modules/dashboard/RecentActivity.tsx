import { memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Megaphone, Truck, IndianRupee, Package,
  HeadphonesIcon, Activity, ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityLog {
  id: string;
  user_email: string;
  department: string;
  action: string;
  description: string;
  created_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const DEPT_CONFIG: Record<string, { icon: typeof Activity; color: string }> = {
  Marketing:          { icon: Megaphone,      color: '#a78bfa' },
  Logistics:          { icon: Truck,          color: '#34d399' },
  Finance:            { icon: IndianRupee,    color: '#f87171' },
  Inventory:          { icon: Package,        color: '#fb923c' },
  'Customer Tickets': { icon: HeadphonesIcon, color: '#60a5fa' },
};

const getConfig = (dept: string) =>
  DEPT_CONFIG[dept] ?? { icon: Activity, color: '#64748b' };

const fmtDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
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

export const RecentActivity = memo(() => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Failed to fetch activity logs:', error);
        } else if (mounted) {
          setLogs((data as ActivityLog[]) || []);
        }
      } catch (err) {
        console.error('Error loading activity logs:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchLogs();
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', minHeight: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, margin: 0 }}>Recent Activity</h3>
        <button
          onClick={() => navigate('/activity-history')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#60a5fa', fontSize: 12, fontWeight: 500,
          }}
        >
          View All <ExternalLink size={12} />
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : logs.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#475569' }}>
          <Activity size={32} />
          <span style={{ fontSize: 13 }}>No recent activity</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 520 }}>
          {logs.map(log => {
            const cfg = getConfig(log.department);
            const Icon = cfg.icon;
            return (
              <div
                key={log.id}
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
                    {log.action}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.user_email} · {log.description}
                  </div>
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 2 }}>
                  <span style={{
                    padding: '2px 10px', borderRadius: 20,
                    fontSize: 10, fontWeight: 700,
                    color: cfg.color,
                    background: `${cfg.color}18`,
                  }}>
                    {log.department}
                  </span>
                  <span style={{ color: '#475569', fontSize: 10 }}>
                    {fmtDate(log.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

RecentActivity.displayName = 'RecentActivity';
