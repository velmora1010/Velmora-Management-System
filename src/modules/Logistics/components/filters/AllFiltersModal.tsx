import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Calendar, RotateCcw } from 'lucide-react';
import type { LogisticsFilterState, LogisticsDatePreset } from '../../types/logisticsFilters';
import { 
  CANONICAL_SHIPMENT_STATUSES, 
  getOrderShipmentStatus, 
  resolveDateRangeForPreset,
  formatRangeDisplay 
} from '../../types/logisticsFilters';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';

interface AllFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: LogisticsFilterState;
  onApply: (nextFilters: LogisticsFilterState) => void;
  orders?: UnifiedLogisticsOrder[];
}

type FilterCategory = 
  | 'shipment_status'
  | 'pickup_location'
  | 'manifested_date'
  | 'transport_mode'
  | 'payment_mode'
  | 'cancellation_status';

const CATEGORIES: Array<{ id: FilterCategory; label: string }> = [
  { id: 'shipment_status', label: 'Shipment status' },
  { id: 'pickup_location', label: 'Pickup location' },
  { id: 'manifested_date', label: 'Manifested date' },
  { id: 'transport_mode', label: 'Transport mode' },
  { id: 'payment_mode', label: 'Payment mode' },
  { id: 'cancellation_status', label: 'Order Cancellation Status' }
];

const DEFAULT_PICKUP_LOCATIONS = [
  'VELMORA CONSUMER B2C Erode 638002',
  'VELMORA MAIN WAREHOUSE Erode',
  'VELMORA DISPATCH HUB Erode 638001'
];

const TRANSPORT_MODES = ['Surface', 'Air'] as const;
const PAYMENT_MODES = ['Prepaid', 'Cash on Delivery'] as const;
const CANCELLATION_STATUSES = ['Requested', 'Approved', 'Rejected', 'Completed'] as const;

const MANIFEST_PRESETS: Array<{ id: LogisticsDatePreset; label: string }> = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_90_days', label: 'Last 90 Days' },
  { id: 'custom', label: 'Custom Range' }
];

export const AllFiltersModal: React.FC<AllFiltersModalProps> = ({
  isOpen,
  onClose,
  filters,
  onApply,
  orders = []
}) => {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('shipment_status');
  const [draft, setDraft] = useState<LogisticsFilterState>(filters);
  const [statusSearch, setStatusSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  // Sync draft when opened
  useEffect(() => {
    if (isOpen) {
      setDraft(filters);
      setStatusSearch('');
      setLocationSearch('');
    }
  }, [isOpen, filters]);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Distinct pickup locations
  const availableLocations = useMemo(() => {
    const set = new Set<string>(DEFAULT_PICKUP_LOCATIONS);
    orders.forEach(o => {
      if (o.pickupLocation && o.pickupLocation.trim()) {
        set.add(o.pickupLocation.trim());
      }
    });
    return Array.from(set);
  }, [orders]);

  // Calculate live counts
  const shipmentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    CANONICAL_SHIPMENT_STATUSES.forEach(st => { map[st] = 0; });
    orders.forEach(o => {
      const canonical = getOrderShipmentStatus(o);
      if (map[canonical] !== undefined) map[canonical]++;
    });
    return map;
  }, [orders]);

  const locationCounts = useMemo(() => {
    const map: Record<string, number> = {};
    availableLocations.forEach(loc => { map[loc] = 0; });
    orders.forEach(o => {
      const loc = o.pickupLocation?.trim() || 'VELMORA CONSUMER B2C Erode 638002';
      if (map[loc] !== undefined) {
        map[loc]++;
      } else {
        const found = availableLocations.find(l => loc.toLowerCase().includes(l.toLowerCase()));
        if (found) map[found] = (map[found] || 0) + 1;
      }
    });
    return map;
  }, [availableLocations, orders]);

  const transportCounts = useMemo(() => {
    let surface = 0;
    let air = 0;
    orders.forEach(o => {
      const tm = (o.transportMode || 'Surface').toLowerCase();
      if (tm.includes('air')) air++;
      else surface++;
    });
    return { Surface: surface, Air: air };
  }, [orders]);

  const paymentCounts = useMemo(() => {
    let prepaid = 0;
    let cod = 0;
    orders.forEach(o => {
      const type = (o.orderType || '').toLowerCase();
      if (type.includes('cod')) cod++;
      else prepaid++;
    });
    return { Prepaid: prepaid, 'Cash on Delivery': cod };
  }, [orders]);

  const cancellationCounts = useMemo(() => {
    const map: Record<string, number> = {
      Requested: 0,
      Approved: 0,
      Rejected: 0,
      Completed: 0
    };
    orders.forEach(o => {
      const cs = o.cancellationStatus || (o.status === 'Cancelled' ? 'Completed' : '');
      if (map[cs] !== undefined) map[cs]++;
    });
    return map;
  }, [orders]);

  // Count active selections per category
  const categoryCounts: Record<FilterCategory, number> = {
    shipment_status: draft.shipmentStatuses.length,
    pickup_location: draft.pickupLocations.length,
    manifested_date: (draft.manifestDatePreset !== 'all' || draft.manifestStartDate || draft.manifestEndDate) ? 1 : 0,
    transport_mode: draft.transportModes.length,
    payment_mode: draft.paymentModes.length,
    cancellation_status: draft.cancellationStatuses.length
  };

  const totalActiveDraftCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  // Clear specific category
  const handleClearCategory = (cat: FilterCategory) => {
    setDraft(prev => {
      switch (cat) {
        case 'shipment_status': return { ...prev, shipmentStatuses: [] };
        case 'pickup_location': return { ...prev, pickupLocations: [] };
        case 'manifested_date': return { ...prev, manifestDatePreset: 'all', manifestStartDate: '', manifestEndDate: '' };
        case 'transport_mode': return { ...prev, transportModes: [] };
        case 'payment_mode': return { ...prev, paymentModes: [] };
        case 'cancellation_status': return { ...prev, cancellationStatuses: [] };
        default: return prev;
      }
    });
  };

  // Clear all
  const handleClearAll = () => {
    setDraft(prev => ({
      ...prev,
      shipmentStatuses: [],
      pickupLocations: [],
      manifestDatePreset: 'all',
      manifestStartDate: '',
      manifestEndDate: '',
      transportModes: [],
      paymentModes: [],
      cancellationStatuses: []
    }));
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl bg-[#0e1626] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[580px] max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0b1220]/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-100">All Filters</h2>
            {totalActiveDraftCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-purple-600/30 border border-purple-500/50 text-purple-300 text-xs font-bold font-mono">
                {totalActiveDraftCount} active
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: Left Categories Navigation + Right Content */}
        <div className="flex-1 flex min-h-0 divide-x divide-slate-800/80 overflow-hidden">
          
          {/* Left Navigation */}
          <div className="w-56 bg-[#0b1220]/50 p-2.5 flex flex-col gap-1 overflow-y-auto custom-scrollbar shrink-0">
            {CATEGORIES.map(cat => {
              const isSelected = activeCategory === cat.id;
              const count = categoryCounts[cat.id];
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent'
                  }`}
                >
                  <span className="truncate">{cat.label}</span>
                  {count > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 p-5 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
            
            {/* Top Bar inside Category */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {CATEGORIES.find(c => c.id === activeCategory)?.label}
              </span>
              {categoryCounts[activeCategory] > 0 && (
                <button
                  type="button"
                  onClick={() => handleClearCategory(activeCategory)}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                >
                  Clear category
                </button>
              )}
            </div>

            {/* Category: Shipment Status */}
            {activeCategory === 'shipment_status' && (
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={statusSearch}
                    onChange={e => setStatusSearch(e.target.value)}
                    placeholder="Search shipment status"
                    className="w-full h-8 pl-9 pr-3 bg-[#0b1220] border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 flex-1">
                  {CANONICAL_SHIPMENT_STATUSES.filter(s => s.toLowerCase().includes(statusSearch.toLowerCase())).map(st => {
                    const checked = draft.shipmentStatuses.includes(st);
                    const count = shipmentCounts[st] || 0;
                    return (
                      <label
                        key={st}
                        onClick={() => {
                          setDraft(prev => ({
                            ...prev,
                            shipmentStatuses: checked
                              ? prev.shipmentStatuses.filter(s => s !== st)
                              : [...prev.shipmentStatuses, st]
                          }));
                        }}
                        className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              checked
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'border-slate-600 bg-[#0b1220]'
                            }`}
                          >
                            {checked && <Check size={11} strokeWidth={3} />}
                          </div>
                          <span className={checked ? 'text-purple-200 font-semibold' : 'text-slate-300'}>
                            {st}
                          </span>
                        </div>
                        {count > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400">
                            {count}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category: Pickup Location */}
            {activeCategory === 'pickup_location' && (
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={e => setLocationSearch(e.target.value)}
                    placeholder="Search pickup locations"
                    className="w-full h-8 pl-9 pr-3 bg-[#0b1220] border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 flex-1">
                  {availableLocations.filter(l => l.toLowerCase().includes(locationSearch.toLowerCase())).map(loc => {
                    const checked = draft.pickupLocations.includes(loc);
                    const count = locationCounts[loc] || 0;
                    return (
                      <label
                        key={loc}
                        onClick={() => {
                          setDraft(prev => ({
                            ...prev,
                            pickupLocations: checked
                              ? prev.pickupLocations.filter(l => l !== loc)
                              : [...prev.pickupLocations, loc]
                          }));
                        }}
                        className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                              checked
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'border-slate-600 bg-[#0b1220]'
                            }`}
                          >
                            {checked && <Check size={11} strokeWidth={3} />}
                          </div>
                          <span className={`truncate ${checked ? 'text-purple-200 font-semibold' : 'text-slate-300'}`}>
                            {loc}
                          </span>
                        </div>
                        {count > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 shrink-0">
                            {count}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category: Manifested Date */}
            {activeCategory === 'manifested_date' && (
              <div className="flex flex-col gap-4 flex-1">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-2">
                    Quick Preset Range
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {MANIFEST_PRESETS.map(p => {
                      const isSelected = draft.manifestDatePreset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            if (p.id === 'all') {
                              setDraft(prev => ({ ...prev, manifestDatePreset: 'all', manifestStartDate: '', manifestEndDate: '' }));
                            } else if (p.id === 'custom') {
                              setDraft(prev => ({ ...prev, manifestDatePreset: 'custom' }));
                            } else {
                              const res = resolveDateRangeForPreset(p.id);
                              setDraft(prev => ({
                                ...prev,
                                manifestDatePreset: p.id,
                                manifestStartDate: res.start,
                                manifestEndDate: res.end
                              }));
                            }
                          }}
                          className={`h-9 px-3 rounded-xl text-xs font-semibold transition-all border text-left flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                              : 'bg-[#0b1220] border-slate-700/80 text-slate-300 hover:border-slate-600 hover:text-white'
                          }`}
                        >
                          <span>{p.label}</span>
                          {isSelected && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-[#0b1220] border border-slate-800 rounded-xl flex flex-col gap-2.5">
                  <span className="text-[11px] font-bold text-slate-400">Custom Manifest Date Boundaries</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Start Date</label>
                      <input
                        type="date"
                        value={draft.manifestStartDate}
                        onChange={e => {
                          setDraft(prev => ({
                            ...prev,
                            manifestDatePreset: 'custom',
                            manifestStartDate: e.target.value
                          }));
                        }}
                        className="w-full h-8 px-2.5 bg-[#111c30] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">End Date</label>
                      <input
                        type="date"
                        value={draft.manifestEndDate}
                        onChange={e => {
                          setDraft(prev => ({
                            ...prev,
                            manifestDatePreset: 'custom',
                            manifestEndDate: e.target.value
                          }));
                        }}
                        className="w-full h-8 px-2.5 bg-[#111c30] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                  {draft.manifestStartDate && (
                    <p className="text-[11px] text-purple-300 font-medium">
                      Active Manifest Range: {formatRangeDisplay(draft.manifestStartDate, draft.manifestEndDate || draft.manifestStartDate)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Category: Transport Mode */}
            {activeCategory === 'transport_mode' && (
              <div className="space-y-1 flex-1">
                {TRANSPORT_MODES.map(tm => {
                  const checked = draft.transportModes.includes(tm);
                  const count = transportCounts[tm] || 0;
                  return (
                    <label
                      key={tm}
                      onClick={() => {
                        setDraft(prev => ({
                          ...prev,
                          transportModes: checked
                            ? prev.transportModes.filter(m => m !== tm)
                            : [...prev.transportModes, tm]
                        }));
                      }}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            checked
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'border-slate-600 bg-[#0b1220]'
                          }`}
                        >
                          {checked && <Check size={11} strokeWidth={3} />}
                        </div>
                        <span className={checked ? 'text-purple-200 font-semibold' : 'text-slate-300'}>
                          {tm}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400">
                        {count}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Category: Payment Mode */}
            {activeCategory === 'payment_mode' && (
              <div className="space-y-1 flex-1">
                {PAYMENT_MODES.map(pm => {
                  const checked = draft.paymentModes.includes(pm);
                  const count = paymentCounts[pm] || 0;
                  return (
                    <label
                      key={pm}
                      onClick={() => {
                        setDraft(prev => ({
                          ...prev,
                          paymentModes: checked
                            ? prev.paymentModes.filter(m => m !== pm)
                            : [...prev.paymentModes, pm]
                        }));
                      }}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            checked
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'border-slate-600 bg-[#0b1220]'
                          }`}
                        >
                          {checked && <Check size={11} strokeWidth={3} />}
                        </div>
                        <span className={checked ? 'text-purple-200 font-semibold' : 'text-slate-300'}>
                          {pm}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400">
                        {count}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Category: Order Cancellation Status */}
            {activeCategory === 'cancellation_status' && (
              <div className="space-y-1 flex-1">
                {CANCELLATION_STATUSES.map(cs => {
                  const checked = draft.cancellationStatuses.includes(cs);
                  const count = cancellationCounts[cs] || 0;
                  return (
                    <label
                      key={cs}
                      onClick={() => {
                        setDraft(prev => ({
                          ...prev,
                          cancellationStatuses: checked
                            ? prev.cancellationStatuses.filter(s => s !== cs)
                            : [...prev.cancellationStatuses, cs]
                        }));
                      }}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            checked
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'border-slate-600 bg-[#0b1220]'
                          }`}
                        >
                          {checked && <Check size={11} strokeWidth={3} />}
                        </div>
                        <span className={checked ? 'text-purple-200 font-semibold' : 'text-slate-300'}>
                          {cs}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400">
                        {count}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-[#0b1220]/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer transition-colors"
          >
            Clear All Filters
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="h-9 px-5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 transition-all cursor-pointer"
            >
              Apply Filters {totalActiveDraftCount > 0 ? `(${totalActiveDraftCount})` : ''}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
