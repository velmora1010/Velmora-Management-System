import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Filter, 
  RotateCcw, 
  MapPin, 
  CreditCard, 
  Package, 
  Truck, 
  Calendar,
  SlidersHorizontal,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import type { 
  LogisticsFilterState, 
  LogisticsDatePreset, 
  LogisticsDateField 
} from '../types/logisticsFilters';
import { 
  INITIAL_LOGISTICS_FILTER_STATE, 
  resolveDateRangeForPreset,
  formatRangeDisplay 
} from '../types/logisticsFilters';
import { DateRangeCalendarModal } from './DateRangeCalendarModal';
import { CONFIGURED_COURIERS } from '../../../config/courierConfig';
import { MultiSelectDropdown, OptionItem } from '../../sales/website/components/MultiSelectDropdown';
import { MASTER_LOCATIONS } from '../../../data/indiaLocations';
import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';

interface LogisticsFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orders: UnifiedLogisticsOrder[];
  filters: LogisticsFilterState;
  onApply: (nextFilters: LogisticsFilterState) => void;
  onResetAll: () => void;
}

const DATE_PRESET_OPTIONS: Array<{ id: LogisticsDatePreset; label: string }> = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: '7d', label: 'Last 7 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'prev_month', label: 'Previous Month' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'this_year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' }
];

const TRACKING_STATUS_OPTIONS = [
  'Delivered',
  'In Transit',
  'Out for Delivery',
  'Info Received',
  'Pending',
  'Exception',
  'Failed Attempt',
  'Expired'
];

const PAYMENT_MODE_OPTIONS = [
  { label: 'PREPAID', value: 'PREPAID' },
  { label: 'COD', value: 'COD' },
  { label: 'PARTIAL COD', value: 'PARTIAL COD' },
  { label: 'UNKNOWN', value: 'UNKNOWN' }
];

export const LogisticsFilterDrawer: React.FC<LogisticsFilterDrawerProps> = ({
  isOpen,
  onClose,
  orders,
  filters,
  onApply,
  onResetAll
}) => {
  // Local draft state initialized whenever drawer opens
  const [draft, setDraft] = useState<LogisticsFilterState>(filters);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(filters);
    }
  }, [isOpen, filters]);

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Master State Options
  const stateOptions: OptionItem[] = useMemo(() => {
    const names = Object.values(MASTER_LOCATIONS).map(s => s.name);
    // Also include any unique state from orders that might not be in master
    orders.forEach(o => {
      const st = o.state || o.shippingState;
      if (st && st.toLowerCase() !== 'india' && !names.includes(st)) {
        names.push(st);
      }
    });
    return Array.from(new Set(names))
      .sort((a, b) => a.localeCompare(b))
      .map(s => ({ label: s, value: s }));
  }, [orders]);

  // Dependent City Options based on selected states
  const cityOptions: OptionItem[] = useMemo(() => {
    const selectedStates = draft.states || [];
    const citySet = new Set<string>();

    if (selectedStates.length > 0) {
      // Find cities for selected states in master locations
      Object.values(MASTER_LOCATIONS).forEach(st => {
        if (selectedStates.includes(st.name)) {
          st.cities.forEach(c => citySet.add(c));
        }
      });
      // Also check orders matching those states
      orders.forEach(o => {
        const st = o.state || o.shippingState || '';
        if (selectedStates.some(s => st.toLowerCase().includes(s.toLowerCase()))) {
          const ct = o.city || o.shippingCity;
          if (ct) citySet.add(ct);
        }
      });
    } else {
      // All cities from orders
      orders.forEach(o => {
        const ct = o.city || o.shippingCity;
        if (ct) citySet.add(ct);
      });
    }

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b))
      .map(c => ({ label: c, value: c }));
  }, [draft.states, orders]);

  if (!isOpen) return null;

  // Active period display text in header
  const getActivePeriodText = () => {
    if (draft.datePreset === 'all') return 'All Historical Time';
    if (draft.datePreset === 'custom') {
      if (draft.startDate && draft.endDate) {
        return `${draft.startDate} to ${draft.endDate}`;
      }
      return 'Custom Range';
    }
    const resolved = resolveDateRangeForPreset(draft.datePreset);
    if (resolved.start && resolved.end) {
      return `${resolved.start} to ${resolved.end}`;
    }
    return draft.datePreset;
  };

  const toggleCourier = (courierName: string) => {
    const current = draft.couriers || [];
    if (current.includes(courierName)) {
      setDraft({ ...draft, couriers: current.filter(c => c !== courierName) });
    } else {
      setDraft({ ...draft, couriers: [...current, courierName] });
    }
  };

  const toggleTrackingStatus = (status: string) => {
    const current = draft.trackingStatuses || [];
    if (current.includes(status)) {
      setDraft({ ...draft, trackingStatuses: current.filter(s => s !== status) });
    } else {
      setDraft({ ...draft, trackingStatuses: [...current, status] });
    }
  };

  const togglePaymentMode = (mode: string) => {
    const current = draft.paymentModes || [];
    if (current.includes(mode)) {
      setDraft({ ...draft, paymentModes: current.filter(m => m !== mode) });
    } else {
      setDraft({ ...draft, paymentModes: [...current, mode] });
    }
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(INITIAL_LOGISTICS_FILTER_STATE);
    onResetAll();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Open Logistics Filters"
    >
      {/* BACKDROP CLICK CLOSES DRAWER */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* DRAWER CONTAINER */}
      <div className="relative w-full max-w-[520px] h-full bg-[#0b1220] border-l border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        
        {/* STICKY DRAWER HEADER */}
        <div className="p-5 bg-[#0e1626] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 text-white font-extrabold text-base">
              <SlidersHorizontal size={18} className="text-cyan-400" />
              <span>Logistics Filters</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Refine orders, dispatch operations, and shipment tracking.</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 text-[11px] font-mono border border-cyan-500/20">
              <Calendar size={12} />
              <span>Period: {getActivePeriodText()}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Filters Drawer"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* VERTICALLY SCROLLABLE FILTER CONTENT */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 divide-y divide-slate-800/70 text-xs custom-scrollbar">
          
          {/* SECTION 1 — DATE & TIME FILTERS */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Calendar size={14} className="text-cyan-400" /> Date & Time Filters
            </h4>

            {/* Date Field Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Date Field to Filter</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(['orderDate', 'dispatchDate', 'deliveredDate', 'syncedAt'] as LogisticsDateField[]).map(df => (
                  <button
                    key={df}
                    type="button"
                    onClick={() => setDraft({ ...draft, dateField: df })}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-medium border text-center transition-colors cursor-pointer truncate ${
                      draft.dateField === df
                        ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-sm'
                        : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {df === 'orderDate' ? 'Order Date' : df === 'dispatchDate' ? 'Dispatch Date' : df === 'deliveredDate' ? 'Delivery Date' : 'Tracking Sync'}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Date Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Quick Presets</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {DATE_PRESET_OPTIONS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      if (preset.id === 'custom') {
                        setIsCalendarModalOpen(true);
                      } else {
                        const resolved = resolveDateRangeForPreset(preset.id);
                        setDraft({
                          ...draft,
                          datePreset: preset.id,
                          startDate: resolved.start,
                          endDate: resolved.end
                        });
                      }
                    }}
                    className={`py-1.5 px-1.5 rounded-xl text-[11px] font-medium border text-center transition-colors cursor-pointer truncate ${
                      draft.datePreset === preset.id
                        ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500 font-bold'
                        : 'bg-[#0e1626] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Date Range Trigger Card */}
            <div 
              onClick={() => setIsCalendarModalOpen(true)}
              className="p-3 bg-[#0e1626] border border-cyan-500/40 hover:border-cyan-400 rounded-xl flex items-center justify-between cursor-pointer transition-colors group shadow-sm"
              title="Click to open Advanced Date-Range Calendar"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 shrink-0">
                  <Calendar size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Selected Range ({draft.datePreset === 'custom' ? 'Custom' : draft.datePreset})
                  </div>
                  <div className="text-xs font-mono font-bold text-cyan-300 truncate">
                    {formatRangeDisplay(draft.startDate, draft.endDate)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-cyan-300 group-hover:text-white px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800/80 group-hover:border-cyan-500 transition-colors shrink-0 cursor-pointer"
              >
                Open Calendar
              </button>
            </div>
          </div>

          {/* SECTION 2 — ORDER SEARCH */}
          <div className="space-y-3 pt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Search size={14} className="text-blue-400" /> Order Search
            </h4>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Order ID</label>
                <input
                  type="text"
                  value={draft.orderIdSearch}
                  onChange={e => setDraft({ ...draft, orderIdSearch: e.target.value })}
                  placeholder="e.g. 6674 or #6674"
                  className="w-full bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={draft.customerNameSearch}
                  onChange={e => setDraft({ ...draft, customerNameSearch: e.target.value })}
                  placeholder="Search customer name"
                  className="w-full bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={draft.phoneSearch}
                  onChange={e => setDraft({ ...draft, phoneSearch: e.target.value })}
                  placeholder="Search 10-digit mobile number"
                  className="w-full bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Product Name</label>
                <input
                  type="text"
                  value={draft.productSearch}
                  onChange={e => setDraft({ ...draft, productSearch: e.target.value })}
                  placeholder="Filter by product or combo name"
                  className="w-full bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3 — LOCATION */}
          <div className="space-y-3 pt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <MapPin size={14} className="text-cyan-400" /> Customer Destination Location
            </h4>
            <div className="space-y-2.5">
              <MultiSelectDropdown
                label="State"
                options={stateOptions}
                selectedValues={draft.states || []}
                onChange={vals => setDraft({ ...draft, states: vals, cities: [] })}
                placeholder="All States"
              />

              <MultiSelectDropdown
                label="City"
                options={cityOptions}
                selectedValues={draft.cities || []}
                onChange={vals => setDraft({ ...draft, cities: vals })}
                placeholder={(draft.states || []).length > 0 ? "All Cities in Selected States" : "All Cities"}
              />

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">PIN / Postal Code</label>
                <input
                  type="text"
                  value={draft.pincode}
                  onChange={e => setDraft({ ...draft, pincode: e.target.value })}
                  placeholder="Search 6-digit PIN code"
                  className="w-full bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4 — DISPATCH & COURIER */}
          <div className="space-y-3 pt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Truck size={14} className="text-purple-400" /> Dispatch & Courier Partner
            </h4>

            {/* Dispatch Status */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Dispatch Status</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'all', label: 'All Orders' },
                  { id: 'dispatched', label: 'Dispatched' },
                  { id: 'pending', label: 'Awaiting Dispatch' }
                ].map(ds => (
                  <button
                    key={ds.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, dispatchStatus: ds.id as any })}
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                      draft.dispatchStatus === ds.id
                        ? 'bg-purple-600 text-white border-purple-500 font-bold'
                        : 'bg-[#0e1626] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {ds.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Courier Partner Selection */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Assigned Courier Partner</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CONFIGURED_COURIERS.map(c => {
                  const isChecked = (draft.couriers || []).includes(c.name);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCourier(c.name)}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-purple-950/60 border-purple-500 text-purple-200 font-bold'
                          : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        isChecked ? 'bg-purple-600 border-purple-500' : 'border-slate-700'
                      }`}>
                        {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="truncate text-xs">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Missing AWB Toggle */}
            <div className="pt-1">
              <label className="flex items-center gap-2.5 p-2.5 bg-[#0e1626] border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={draft.missingAwbOnly}
                  onChange={e => setDraft({ ...draft, missingAwbOnly: e.target.checked })}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <span className="text-xs text-slate-300 font-medium">Show only orders missing AWB tracking number</span>
              </label>
            </div>
          </div>

          {/* SECTION 5 — SHIPMENT TRACKING STATUS */}
          <div className="space-y-3 pt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Clock size={14} className="text-emerald-400" /> Shipment Tracking Status
            </h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {TRACKING_STATUS_OPTIONS.map(st => {
                const isSelected = (draft.trackingStatuses || []).includes(st);
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => toggleTrackingStatus(st)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border text-center transition-all cursor-pointer truncate ${
                      isSelected
                        ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500 font-bold'
                        : 'bg-[#0e1626] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>

            {/* Sync Status Filter */}
            <div className="pt-1">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Carrier Sync Status</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'all', label: 'All Shipments' },
                  { id: 'synced', label: 'Live Synced' },
                  { id: 'never_synced', label: 'Awaiting Sync' }
                ].map(ss => (
                  <button
                    key={ss.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, syncStatus: ss.id as any })}
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                      draft.syncStatus === ss.id
                        ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500 font-bold'
                        : 'bg-[#0e1626] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {ss.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 6 — PAYMENT & AMOUNT RANGES */}
          <div className="space-y-3 pt-5 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <CreditCard size={14} className="text-purple-400" /> Payment & Order Value
            </h4>

            {/* Payment Mode Pills */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Payment Method</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PAYMENT_MODE_OPTIONS.map(opt => {
                  const isChecked = (draft.paymentModes || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => togglePaymentMode(opt.value)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-purple-600 text-white border-purple-500 font-bold'
                          : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Min & Max Amount */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Min Amount (₹)</label>
                <input
                  type="number"
                  value={draft.minAmount}
                  onChange={e => setDraft({ ...draft, minAmount: e.target.value })}
                  placeholder="Min ₹"
                  className="w-full bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Max Amount (₹)</label>
                <input
                  type="number"
                  value={draft.maxAmount}
                  onChange={e => setDraft({ ...draft, maxAmount: e.target.value })}
                  placeholder="Max ₹"
                  className="w-full bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>
          </div>

        </div>

        {/* STICKY FOOTER ACTIONS */}
        <div className="p-4 bg-[#0e1626] border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 bg-[#0b1220] hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Reset All
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Filter size={14} /> Apply Filters
            </button>
          </div>
        </div>

      </div>

      {/* Date Range Calendar Modal (Opened from drawer) */}
      {isCalendarModalOpen && (
        <DateRangeCalendarModal
          isOpen={isCalendarModalOpen}
          onClose={() => setIsCalendarModalOpen(false)}
          startDate={draft.startDate}
          endDate={draft.endDate}
          preset={draft.datePreset}
          targetDateField={draft.dateField}
          onTargetDateFieldChange={(df) => setDraft(prev => ({ ...prev, dateField: df }))}
          onApply={(range) => {
            setDraft(prev => ({
              ...prev,
              startDate: range.startDate,
              endDate: range.endDate,
              datePreset: range.preset
            }));
          }}
        />
      )}
    </div>
  );
};
