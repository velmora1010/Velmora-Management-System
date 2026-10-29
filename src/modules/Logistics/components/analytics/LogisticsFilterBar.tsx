import React from 'react';
import { 
  Calendar, 
  RotateCcw, 
  RefreshCw, 
  Filter, 
  Truck, 
  Layers, 
  TrendingUp, 
  ShieldAlert, 
  MapPin, 
  IndianRupee, 
  Clock, 
  PieChart, 
  CheckCircle2, 
  Search,
  ChevronDown,
  X
} from 'lucide-react';
import type { LogisticsFilterState, LogisticsDatePreset, LogisticsDateField } from '../../types/logisticsFilters';
import { formatRangeDisplay, countActiveLogisticsFilters } from '../../types/logisticsFilters';
import { CONFIGURED_COURIERS } from '../../../../config/courierConfig';
import { ALL_CANONICAL_STATUSES } from '../../utils/logisticsAnalyticsUtils';

export type AnalyticsSectionKey =
  | 'overview'
  | 'delivery_status'
  | 'rto_intelligence'
  | 'courier_performance'
  | 'sla_delays'
  | 'cod_reconciliation'
  | 'geographic'
  | 'tracking_exceptions';

interface LogisticsFilterBarProps {
  filters: LogisticsFilterState;
  activeSection: AnalyticsSectionKey;
  onSelectSection: (section: AnalyticsSectionKey) => void;
  onUpdateFilters: (updater: (prev: LogisticsFilterState) => LogisticsFilterState) => void;
  onResetFilters: () => void;
  onOpenDateCalendar: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const LogisticsFilterBar: React.FC<LogisticsFilterBarProps> = ({
  filters,
  activeSection,
  onSelectSection,
  onUpdateFilters,
  onResetFilters,
  onOpenDateCalendar,
  onRefresh,
  isRefreshing = false
}) => {
  const activeCount = countActiveLogisticsFilters(filters);

  const datePresets: Array<{ key: LogisticsDatePreset; label: string }> = [
    { key: 'all', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { key: 'this_month', label: 'This Month' },
    { key: 'prev_month', label: 'Last Month' },
    { key: 'this_year', label: 'This Year' },
    { key: 'custom', label: 'Custom' }
  ];

  const dateFieldOptions: Array<{ key: LogisticsDateField; label: string }> = [
    { key: 'orderDate', label: 'Order Date' },
    { key: 'dispatchDate', label: 'Dispatch Date' },
    { key: 'deliveredDate', label: 'Delivery Date' },
    { key: 'syncedAt', label: 'Tracking Sync' }
  ];

  const sections: Array<{ key: AnalyticsSectionKey; label: string; icon: React.ReactNode }> = [
    { key: 'overview', label: 'Overview (20 KPIs)', icon: <Layers size={13} /> },
    { key: 'delivery_status', label: 'Delivery Status', icon: <CheckCircle2 size={13} /> },
    { key: 'rto_intelligence', label: 'RTO Intelligence', icon: <ShieldAlert size={13} /> },
    { key: 'courier_performance', label: 'Courier Performance', icon: <Truck size={13} /> },
    { key: 'sla_delays', label: 'SLA & Delays', icon: <Clock size={13} /> },
    { key: 'cod_reconciliation', label: 'COD Reconciliation', icon: <IndianRupee size={13} /> },
    { key: 'geographic', label: 'Geographic Logistics', icon: <MapPin size={13} /> },
    { key: 'tracking_exceptions', label: 'Exceptions & Actions', icon: <ShieldAlert size={13} /> }
  ];

  return (
    <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl space-y-3.5">
      
      {/* ROW 1: PRIMARY DATE CONTROLS, TARGET DATE FIELD, AND ACTIONS */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        
        {/* Left: Date Preset Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 custom-scrollbar">
          {datePresets.map((preset) => {
            const isSelected = filters.datePreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  if (preset.key === 'custom') {
                    onOpenDateCalendar();
                  } else {
                    onUpdateFilters(prev => ({
                      ...prev,
                      datePreset: preset.key,
                      startDate: '',
                      endDate: ''
                    }));
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/30 font-bold'
                    : 'bg-[#0e1626] text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Right: Date Field Selector, Calendar Trigger, and Reset */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          
          {/* Target Date Field Selector */}
          <div className="flex items-center gap-1.5 bg-[#0e1626] border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">Date Basis:</span>
            <select
              value={filters.dateField}
              onChange={(e) => onUpdateFilters(prev => ({ ...prev, dateField: e.target.value as LogisticsDateField }))}
              className="bg-transparent text-cyan-300 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              {dateFieldOptions.map(df => (
                <option key={df.key} value={df.key} className="bg-[#0b1220] text-slate-200">
                  {df.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Modal Trigger */}
          <button
            type="button"
            onClick={onOpenDateCalendar}
            className="h-8 px-3 rounded-xl text-xs font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-white border border-cyan-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Open Date Range Calendar"
          >
            <Calendar size={13} className="text-cyan-400" />
            <span className="font-mono text-[11px]">{formatRangeDisplay(filters.startDate, filters.endDate)}</span>
          </button>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`h-8 w-8 rounded-xl bg-[#0e1626] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer ${
                isRefreshing ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              title="Refresh Analytics Data"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-cyan-400' : ''} />
            </button>
          )}

          {/* Reset Filters */}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onResetFilters}
              className="h-8 px-2.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset all active filters"
            >
              <RotateCcw size={12} />
              <span>Reset ({activeCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* ROW 2: ADVANCED INLINE FILTERS (Courier, Status, Payment Mode, Search) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80">
        
        {/* Courier Partner Filter */}
        <div className="relative">
          <select
            value={filters.couriers[0] || 'all'}
            onChange={(e) => {
              const val = e.target.value;
              onUpdateFilters(prev => ({
                ...prev,
                couriers: val === 'all' ? [] : [val]
              }));
            }}
            className="w-full bg-[#0e1626] border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="all">All Courier Partners</option>
            {CONFIGURED_COURIERS.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <div className="absolute right-2.5 top-2.5 pointer-events-none text-slate-400">
            <ChevronDown size={12} />
          </div>
        </div>

        {/* Canonical Status Filter */}
        <div className="relative">
          <select
            value={filters.trackingStatuses[0] || 'all'}
            onChange={(e) => {
              const val = e.target.value;
              onUpdateFilters(prev => ({
                ...prev,
                trackingStatuses: val === 'all' ? [] : [val]
              }));
            }}
            className="w-full bg-[#0e1626] border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="all">All Delivery Statuses (13)</option>
            {ALL_CANONICAL_STATUSES.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <div className="absolute right-2.5 top-2.5 pointer-events-none text-slate-400">
            <ChevronDown size={12} />
          </div>
        </div>

        {/* Payment Mode Filter */}
        <div className="relative">
          <select
            value={filters.paymentModes[0] || 'all'}
            onChange={(e) => {
              const val = e.target.value;
              onUpdateFilters(prev => ({
                ...prev,
                paymentModes: val === 'all' ? [] : [val]
              }));
            }}
            className="w-full bg-[#0e1626] border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="all">All Payment Modes</option>
            <option value="PREPAID">Prepaid Only</option>
            <option value="COD">Cash on Delivery (COD)</option>
            <option value="PARTIAL COD">Partial COD</option>
          </select>
          <div className="absolute right-2.5 top-2.5 pointer-events-none text-slate-400">
            <ChevronDown size={12} />
          </div>
        </div>

        {/* Product / SKU Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={filters.productSearch}
            onChange={(e) => onUpdateFilters(prev => ({ ...prev, productSearch: e.target.value }))}
            placeholder="Search product / SKU..."
            className="w-full bg-[#0e1626] border border-slate-800 focus:border-cyan-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          {filters.productSearch && (
            <button
              type="button"
              onClick={() => onUpdateFilters(prev => ({ ...prev, productSearch: '' }))}
              className="absolute right-2 top-2 text-slate-400 hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>

      </div>

      {/* ROW 3: QUICK-JUMP SECTION NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-800/80 custom-scrollbar">
        {sections.map(sec => {
          const isActive = activeSection === sec.key;
          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => onSelectSection(sec.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm font-bold'
                  : 'bg-[#0e1626]/70 text-slate-400 hover:text-slate-200 border border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <span className={isActive ? 'text-cyan-400' : 'text-slate-400'}>{sec.icon}</span>
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
};
