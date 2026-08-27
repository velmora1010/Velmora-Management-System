import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Truck, IndianRupee, Factory,
  HelpCircle, Activity, Filter, RotateCcw, Calendar as CalendarIcon, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DateRangeModal, DateRange, QuickRangeKey, getQuickRangeDates } from '../components/ui/DateRangeModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityLog {
  id: string;
  user_id?: string;
  user_email: string;
  department: string;
  action: string;
  description: string;
  created_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const USER_OPTIONS = [
  { value: '', label: 'All Users' },
  { value: 'admin@velmora.com', label: 'admin@velmora.com' },
  { value: 'admin@velmora1.com', label: 'admin@velmora1.com' },
  { value: 'admin@velmora2.com', label: 'admin@velmora2.com' },
  { value: 'admin@velmora3.com', label: 'admin@velmora3.com' },
];

const DEPT_OPTIONS = [
  { value: '', label: 'All Departments' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Logistics', label: 'Logistics' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Inventory', label: 'Inventory' },
  { value: 'Customer Tickets', label: 'Customer Tickets' },
];

const DEPT_CONFIG: Record<string, { icon: typeof Activity; color: string; badgeBg: string }> = {
  Marketing:          { icon: Megaphone,   color: '#a78bfa', badgeBg: 'rgba(167,139,250,0.12)' },
  Logistics:          { icon: Truck,       color: '#34d399', badgeBg: 'rgba(52,211,153,0.12)' },
  Finance:            { icon: IndianRupee, color: '#f87171', badgeBg: 'rgba(248,113,113,0.12)' },
  Inventory:          { icon: Factory,     color: '#fb923c', badgeBg: 'rgba(251,146,60,0.12)' },
  'Customer Tickets': { icon: HelpCircle,  color: '#60a5fa', badgeBg: 'rgba(96,165,250,0.12)' },
};

const getConfig = (dept: string) =>
  DEPT_CONFIG[dept] ?? { icon: Activity, color: '#94a3b8', badgeBg: 'rgba(148,163,184,0.12)' };

// Format: 27 Aug 2026, 10:42 AM
const fmtDateTime = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    const day = d.getDate();
    const month = d.toLocaleDateString('en-IN', { month: 'short' });
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${day} ${month} ${year}, ${time}`;
  } catch {
    return '—';
  }
};

const fmtShortDateStr = (d: Date | null): string => {
  if (!d) return '';
  const month = d.toLocaleDateString('en-IN', { month: 'short' });
  return `${d.getDate()} ${month} ${d.getFullYear()}`;
};

// ── Styles ────────────────────────────────────────────────────────────────────

const SELECT_STYLE: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 12,
  border: '1px solid #334155',
  background: '#1e293b',
  color: 'white',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
};

const BTN_STYLE: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 12,
  border: '1px solid #334155',
  background: '#1e293b',
  color: '#94a3b8',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'color 0.15s',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const ActivityHistoryPage = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterDept, setFilterDept] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [dateFilterKey, setDateFilterKey] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    quickRangeKey: 'last_7_days',
  });
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (filterDept) {
        query = query.eq('department', filterDept);
      }
      if (filterUser) {
        query = query.eq('user_email', filterUser);
      }
      if (dateRange.startDate) {
        query = query.gte('created_at', dateRange.startDate.toISOString());
      }
      if (dateRange.endDate) {
        query = query.lte('created_at', dateRange.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch activity logs:', error);
        setLogs([]);
      } else {
        setLogs((data as ActivityLog[]) || []);
      }
    } catch (err) {
      console.error('Error loading activity logs:', err);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterDept, filterUser, dateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleDateDropdownChange = (key: string) => {
    setDateFilterKey(key);
    if (key === 'all') {
      setDateRange({ startDate: null, endDate: null });
    } else if (key === 'custom') {
      setIsDateModalOpen(true);
    } else {
      const { start, end } = getQuickRangeDates(key as QuickRangeKey);
      setDateRange({
        startDate: start,
        endDate: end,
        quickRangeKey: key as QuickRangeKey,
      });
    }
  };

  const handleApplyDateModal = (range: DateRange) => {
    setDateRange(range);
    setDateFilterKey(range.quickRangeKey || 'custom');
  };

  const clearAllFilters = () => {
    setFilterDept('');
    setFilterUser('');
    setDateFilterKey('all');
    setDateRange({ startDate: null, endDate: null });
  };

  const hasActiveFilters = filterDept !== '' || filterUser !== '' || dateRange.startDate !== null;

  return (
    <div className="w-full max-w-screen-2xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* ── Header Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Activity History</h1>
          <p className="text-sm mt-1 text-slate-400">
            Track development and operational activity across all departments.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Department Filter */}
          <label htmlFor="dept-filter-select" className="sr-only">Department</label>
          <select
            id="dept-filter-select"
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            disabled={isLoading}
            style={{ ...SELECT_STYLE, opacity: isLoading ? 0.6 : 1 }}
          >
            {DEPT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* User Filter */}
          <label htmlFor="user-filter-select" className="sr-only">User</label>
          <select
            id="user-filter-select"
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            disabled={isLoading}
            style={{ ...SELECT_STYLE, opacity: isLoading ? 0.6 : 1 }}
          >
            {USER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Date Range Dropdown */}
          <label htmlFor="date-filter-select" className="sr-only">Date Range</label>
          <select
            id="date-filter-select"
            value={dateFilterKey}
            onChange={e => handleDateDropdownChange(e.target.value)}
            disabled={isLoading}
            style={{ ...SELECT_STYLE, opacity: isLoading ? 0.6 : 1 }}
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="this_month">This Month</option>
            <option value="prev_month">Previous Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Date Range...</option>
          </select>

          {/* Custom Date Range Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsDateModalOpen(true)}
            style={{ ...BTN_STYLE }}
            title="Open Date Range Picker"
            className="hover:border-cyan-500/50 hover:text-cyan-400"
          >
            <CalendarIcon size={14} className="text-cyan-400" />
            <span className="hidden sm:inline">Range</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchLogs}
            disabled={isLoading}
            style={{ ...BTN_STYLE, opacity: isLoading ? 0.6 : 1 }}
            title="Refresh"
            className="hover:text-white"
          >
            <RotateCcw size={14} style={{ animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Active Filter Chips ── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
            <Filter size={12} /> Filtered by:
          </span>

          {filterDept && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/40 border border-purple-800/40 text-purple-300 text-xs font-semibold">
              Department: {filterDept}
            </span>
          )}

          {filterUser && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/40 border border-blue-800/40 text-blue-300 text-xs font-semibold">
              User: {filterUser}
            </span>
          )}

          {dateRange.startDate && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs font-semibold">
              Date: {fmtShortDateStr(dateRange.startDate)} — {fmtShortDateStr(dateRange.endDate)}
            </span>
          )}

          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-full border border-slate-700 hover:bg-slate-800 transition-colors"
          >
            <X size={12} /> Clear all
          </button>
        </div>
      )}

      {/* ── Result Count ── */}
      <div className="text-xs font-semibold text-slate-400">
        {isLoading ? 'Loading activities...' : `Showing ${logs.length} activit${logs.length === 1 ? 'y' : 'ies'}`}
      </div>

      {/* ── Main Activity Feed ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[420px] flex flex-col justify-between">
        
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-950/50 border border-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          
          /* ── Centered Empty State ── */
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center my-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mb-4 border border-slate-700/50">
              <Activity size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-1">No activity found</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {hasActiveFilters
                ? 'No activities match the selected filters. Try changing the user, department, or date range filters.'
                : 'No development or operational activities recorded yet.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>

        ) : (

          /* ── Activity Timeline List ── */
          <div className="space-y-3">
            {logs.map((log) => {
              const cfg = getConfig(log.department);
              const Icon = cfg.icon;

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all group"
                >
                  {/* Department Icon Badge */}
                  <div
                    style={{ background: cfg.badgeBg, color: cfg.color }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border border-slate-800"
                  >
                    <Icon size={18} />
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0">
                    
                    {/* 1. Action Title */}
                    <div className="text-sm font-bold text-slate-100 leading-snug group-hover:text-cyan-300 transition-colors">
                      {log.action}
                    </div>

                    {/* 2. Description */}
                    <div className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {log.description}
                    </div>

                    {/* 3. Metadata Row (User | Department | Date & Time) */}
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-slate-400 font-medium">
                      
                      {/* User */}
                      <span className="flex items-center gap-1 text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        {log.user_email}
                      </span>

                      <span className="text-slate-700">•</span>

                      {/* Department Chip */}
                      <span
                        style={{ color: cfg.color }}
                        className="font-bold tracking-wide"
                      >
                        {log.department}
                      </span>

                      <span className="text-slate-700">•</span>

                      {/* Date & Time */}
                      <span className="text-slate-500 font-mono">
                        {fmtDateTime(log.created_at)}
                      </span>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

        )}
      </div>

      {/* ── Date Range Modal ── */}
      <DateRangeModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onApply={handleApplyDateModal}
        initialRange={dateRange}
      />

    </div>
  );
};
