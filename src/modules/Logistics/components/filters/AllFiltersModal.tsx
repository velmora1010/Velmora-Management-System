import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Check, 
  Calendar, 
  RotateCcw, 
  MapPin, 
  ShieldAlert, 
  Globe, 
  CreditCard, 
  BadgeCheck, 
  Tags, 
  Compass, 
  Truck, 
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { LogisticsFilterState, LogisticsDatePreset } from '../../types/logisticsFilters';
import { 
  formatLocalYMD, 
  parseLocalYMD, 
  resolveDateRangeForPreset, 
  formatRangeDisplay,
  calculateOrderRiskOfReturn,
  calculateOrderChannel,
  calculateOrderPaymentMode,
  calculateOrderVerified,
  calculateOrderAddressScore,
  calculateOrderZone,
  MONTH_NAMES_SHORT,
  MONTH_NAMES_FULL
} from '../../types/logisticsFilters';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';

interface AllFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: LogisticsFilterState;
  onApply: (nextFilters: LogisticsFilterState) => void;
  orders?: UnifiedLogisticsOrder[];
}

export type AllFilterCategory = 
  | 'date_range'
  | 'pickup_location'
  | 'risk_of_return'
  | 'channel'
  | 'payment_mode'
  | 'verified'
  | 'order_tags'
  | 'address_score'
  | 'transport_mode'
  | 'zone';

interface CategoryConfig {
  id: AllFilterCategory;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'date_range', label: 'Date range', icon: Calendar },
  { id: 'pickup_location', label: 'Pickup location', icon: MapPin },
  { id: 'risk_of_return', label: 'Risk of return', icon: ShieldAlert },
  { id: 'channel', label: 'Channel', icon: Globe },
  { id: 'payment_mode', label: 'Payment mode', icon: CreditCard },
  { id: 'verified', label: 'Verified', icon: BadgeCheck },
  { id: 'order_tags', label: 'Order tags', icon: Tags },
  { id: 'address_score', label: 'Address score', icon: Compass },
  { id: 'transport_mode', label: 'Transport mode', icon: Truck },
  { id: 'zone', label: 'Zone', icon: Layers }
];

const DATE_PRESETS: Array<{ id: LogisticsDatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_90_days', label: 'Last 90 Days' },
  { id: 'custom', label: 'Custom Range' }
];

const DEFAULT_PICKUP_LOCATIONS = [
  'VELMORA CONSUMER B2C Erode 638002',
  'VELMORA MAIN WAREHOUSE Erode',
  'VELMORA DISPATCH HUB Erode 638001'
];

const ZONE_OPTIONS = [
  'Zone A',
  'Zone B',
  'Zone C',
  'Zone D',
  'Zone E',
  'Zone F',
  'S1',
  'S2',
  'S3',
  'S4'
];

const COMMON_TAGS = [
  'VIP',
  'Express Delivery',
  'Bulk Order',
  'Fragile',
  'Repeat Customer',
  'High Priority',
  'Gift Wrap'
];

export const AllFiltersModal: React.FC<AllFiltersModalProps> = ({
  isOpen,
  onClose,
  filters,
  onApply,
  orders = []
}) => {
  const [activeCategory, setActiveCategory] = useState<AllFilterCategory>('date_range');
  const [draft, setDraft] = useState<LogisticsFilterState>(filters);
  const [searchTerm, setSearchTerm] = useState('');

  // Calendar view for custom range
  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());
  const [rangeStage, setRangeStage] = useState<'idle' | 'selecting_end'>('idle');
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sync draft state on open
  useEffect(() => {
    if (isOpen) {
      setDraft(filters);
      setSearchTerm('');
      setRangeStage('idle');
      setHoverDate(null);
      const refDate = filters.startDate ? parseLocalYMD(filters.startDate) : new Date();
      setViewYear(refDate.getFullYear());
      setViewMonth(refDate.getMonth());
    }
  }, [isOpen, filters]);

  // Escape key listener
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Pickup locations list
  const availableLocations = useMemo(() => {
    const set = new Set<string>(DEFAULT_PICKUP_LOCATIONS);
    orders.forEach(o => {
      if (o.pickupLocation && o.pickupLocation.trim()) {
        set.add(o.pickupLocation.trim());
      }
    });
    return Array.from(set);
  }, [orders]);

  // Order tags list
  const availableTags = useMemo(() => {
    const set = new Set<string>(COMMON_TAGS);
    orders.forEach(o => {
      (o.tags || []).forEach(t => {
        if (t && t.trim()) set.add(t.trim());
      });
    });
    return Array.from(set);
  }, [orders]);

  // Live item counts across categories
  const counts = useMemo(() => {
    // 1. Pickup locations
    const locMap: Record<string, number> = {};
    availableLocations.forEach(l => { locMap[l] = 0; });

    // 2. Risk of return
    const riskMap: Record<string, number> = {
      'Low (0 - 20)': 0,
      'Medium (21 - 51)': 0,
      'High (52+)': 0
    };

    // 3. Channel
    const chMap: Record<string, number> = {
      'Online Store / Shopify': 0,
      'Website': 0,
      'Manual / Direct': 0,
      'Delhivery Direct': 0
    };

    // 4. Payment mode
    const payMap: Record<string, number> = {
      'COD': 0,
      'Pickup': 0,
      'Prepaid': 0,
      'Replacement': 0
    };

    // 5. Verified
    const verMap: Record<string, number> = {
      'Verified': 0,
      'Unverified': 0
    };

    // 6. Address score
    const addrMap: Record<string, number> = {
      'Complete (100%)': 0,
      'Good (75-99%)': 0,
      'Partial (50-74%)': 0,
      'Poor (<50%)': 0
    };

    // 7. Transport mode
    const tmMap: Record<string, number> = {
      'Surface': 0,
      'Express': 0
    };

    // 8. Zone
    const zoneMap: Record<string, number> = {};
    ZONE_OPTIONS.forEach(z => { zoneMap[z] = 0; });

    // 9. Tags
    const tagMap: Record<string, number> = {};
    availableTags.forEach(t => { tagMap[t] = 0; });

    orders.forEach(o => {
      // Location
      const loc = o.pickupLocation?.trim() || 'VELMORA CONSUMER B2C Erode 638002';
      if (locMap[loc] !== undefined) locMap[loc]++;
      else {
        const found = availableLocations.find(l => loc.toLowerCase().includes(l.toLowerCase()));
        if (found) locMap[found] = (locMap[found] || 0) + 1;
      }

      // Risk
      const risk = calculateOrderRiskOfReturn(o);
      if (riskMap[risk] !== undefined) riskMap[risk]++;

      // Channel
      const ch = calculateOrderChannel(o);
      if (chMap[ch] !== undefined) chMap[ch]++;
      else chMap['Website']++;

      // Payment
      const pm = calculateOrderPaymentMode(o);
      if (payMap[pm] !== undefined) payMap[pm]++;

      // Verified
      const ver = calculateOrderVerified(o);
      if (verMap[ver] !== undefined) verMap[ver]++;

      // Address score
      const score = calculateOrderAddressScore(o);
      if (addrMap[score] !== undefined) addrMap[score]++;

      // Transport mode
      const tm = (o.transportMode || 'Surface').toLowerCase();
      if (tm.includes('express') || tm.includes('air')) tmMap['Express']++;
      else tmMap['Surface']++;

      // Zone
      const z = calculateOrderZone(o);
      if (zoneMap[z] !== undefined) zoneMap[z]++;

      // Tags
      (o.tags || []).forEach(t => {
        if (tagMap[t] !== undefined) tagMap[t]++;
      });
    });

    return {
      locations: locMap,
      risk: riskMap,
      channel: chMap,
      payment: payMap,
      verified: verMap,
      address: addrMap,
      transport: tmMap,
      zone: zoneMap,
      tags: tagMap
    };
  }, [orders, availableLocations, availableTags]);

  // Active counts per category for badges in the left sidebar
  const activeCategoryCounts = useMemo(() => {
    return {
      date_range: (draft.datePreset !== 'all' || Boolean(draft.startDate)) ? 1 : 0,
      pickup_location: draft.pickupLocations.length,
      risk_of_return: draft.riskOfReturn.length,
      channel: draft.channels.length,
      payment_mode: draft.paymentModes.length,
      verified: draft.verifiedStatuses.length,
      order_tags: draft.orderTags.length,
      address_score: draft.addressScores.length,
      transport_mode: draft.transportModes.length,
      zone: draft.zones.length
    };
  }, [draft]);

  // Total active count in draft
  const totalDraftCount = useMemo(() => {
    return Object.values(activeCategoryCounts).reduce((a, b) => a + b, 0);
  }, [activeCategoryCounts]);

  // Calendar days calculation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startDayOfWeek = firstDay.getDay() - 1; // Monday = 0
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: Array<{ dayNumber: number; ymd: string; isCurrentMonth: boolean }> = [];
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevD = new Date(viewYear, viewMonth - 1, dNum);
      days.push({ dayNumber: dNum, ymd: formatLocalYMD(prevD), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const curD = new Date(viewYear, viewMonth, i);
      days.push({ dayNumber: i, ymd: formatLocalYMD(curD), isCurrentMonth: true });
    }
    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextDNum = 1;
    while (days.length < totalCells) {
      const nextD = new Date(viewYear, viewMonth + 1, nextDNum);
      days.push({ dayNumber: nextDNum, ymd: formatLocalYMD(nextD), isCurrentMonth: false });
      nextDNum++;
    }
    return days;
  }, [viewYear, viewMonth]);

  // Toggle helpers
  const toggleArrayItem = <K extends keyof LogisticsFilterState>(
    key: K,
    item: string
  ) => {
    setDraft(prev => {
      const arr = (prev[key] as unknown as string[]) || [];
      const nextArr = arr.includes(item)
        ? arr.filter(x => x !== item)
        : [...arr, item];
      return { ...prev, [key]: nextArr };
    });
  };

  const handleClearAll = () => {
    setDraft(prev => ({
      ...prev,
      datePreset: 'all',
      startDate: '',
      endDate: '',
      manifestDatePreset: 'all',
      manifestStartDate: '',
      manifestEndDate: '',
      deliveredDatePreset: 'all',
      deliveredStartDate: '',
      deliveredEndDate: '',
      returnedDatePreset: 'all',
      returnedStartDate: '',
      returnedEndDate: '',
      pickupLocations: [],
      transportModes: [],
      paymentModes: [],
      riskOfReturn: [],
      channels: [],
      verifiedStatuses: [],
      orderTags: [],
      addressScores: [],
      zones: []
    }));
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      
      {/* Modal Container */}
      <div className="w-full max-w-4xl h-[620px] max-h-[92vh] bg-[#0b1220] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#0e1626]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-white tracking-tight">All Filters</h2>
            {totalDraftCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-purple-600/30 border border-purple-500/50 text-purple-300 text-xs font-semibold">
                {totalDraftCount} active
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Left Sidebar + Right Options */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          {/* Left Categories List */}
          <div className="w-56 sm:w-64 border-r border-slate-800/80 bg-[#070c14] p-2 flex flex-col gap-1 overflow-y-auto custom-scrollbar shrink-0">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              const catCount = activeCategoryCounts[cat.id];

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearchTerm('');
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-purple-950/60 text-purple-200 border border-purple-800/60 font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={14} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
                    <span className="truncate">{cat.label}</span>
                  </div>
                  {catCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {catCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0b1220] overflow-hidden">
            
            {/* Header of Active Category */}
            <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-800/60 shrink-0">
              <h3 className="text-sm font-bold text-slate-100">
                {CATEGORIES.find(c => c.id === activeCategory)?.label}
              </h3>
            </div>

            {/* Content Switcher */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
              
              {/* 1. DATE RANGE */}
              {activeCategory === 'date_range' && (
                <div className="flex flex-col gap-4">
                  <span className="text-xs text-slate-400">Choose a preset or select custom date boundaries:</span>
                  
                  {/* Preset Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DATE_PRESETS.map(p => {
                      const isSelected = draft.datePreset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setDraft(prev => {
                              if (p.id === 'custom') {
                                return { ...prev, datePreset: 'custom' };
                              }
                              const res = resolveDateRangeForPreset(p.id);
                              return {
                                ...prev,
                                datePreset: p.id,
                                startDate: res.start,
                                endDate: res.end
                              };
                            });
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                              : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Selected Range Display */}
                  <div className="p-3 bg-[#0e1626] border border-slate-800 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-slate-300">
                      <strong>Current Range:</strong> {formatRangeDisplay(draft.startDate, draft.endDate)}
                    </span>
                    {(draft.datePreset !== 'all' || draft.startDate) && (
                      <button
                        type="button"
                        onClick={() => setDraft(prev => ({ ...prev, datePreset: 'all', startDate: '', endDate: '' }))}
                        className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                      >
                        Reset Date
                      </button>
                    )}
                  </div>

                  {/* Calendar for Custom Range */}
                  <div className="p-4 bg-[#070c14] border border-slate-800 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        {MONTH_NAMES_FULL[viewMonth]} {viewYear}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (viewMonth === 0) {
                              setViewMonth(11);
                              setViewYear(y => y - 1);
                            } else setViewMonth(m => m - 1);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (viewMonth === 11) {
                              setViewMonth(0);
                              setViewYear(y => y + 1);
                            } else setViewMonth(m => m + 1);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500">
                      {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                        <span key={d}>{d}</span>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map(item => {
                        const isStart = draft.startDate === item.ymd;
                        const isEnd = draft.endDate === item.ymd;
                        const effectiveEnd = draft.endDate || (rangeStage === 'selecting_end' ? hoverDate : null);
                        const inRange = Boolean(
                          draft.startDate && 
                          effectiveEnd && 
                          item.ymd > draft.startDate && 
                          item.ymd < effectiveEnd
                        );

                        let cellClass = 'text-slate-300 hover:bg-slate-800';
                        if (!item.isCurrentMonth) cellClass = 'text-slate-600 hover:bg-slate-800/40';
                        if (isStart || isEnd) cellClass = 'bg-purple-600 text-white font-bold shadow-sm';
                        else if (inRange) cellClass = 'bg-purple-950/60 text-purple-200';

                        return (
                          <button
                            key={item.ymd}
                            type="button"
                            onClick={() => {
                              setDraft(prev => {
                                if (rangeStage === 'idle') {
                                  setRangeStage('selecting_end');
                                  return { ...prev, datePreset: 'custom', startDate: item.ymd, endDate: '' };
                                } else {
                                  setRangeStage('idle');
                                  setHoverDate(null);
                                  if (prev.startDate && item.ymd < prev.startDate) {
                                    return { ...prev, datePreset: 'custom', startDate: item.ymd, endDate: prev.startDate };
                                  }
                                  return { ...prev, datePreset: 'custom', endDate: item.ymd };
                                }
                              });
                            }}
                            onMouseEnter={() => {
                              if (rangeStage === 'selecting_end') setHoverDate(item.ymd);
                            }}
                            className={`h-8 rounded text-xs flex items-center justify-center transition-all cursor-pointer ${cellClass}`}
                          >
                            {item.dayNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PICKUP LOCATION */}
              {activeCategory === 'pickup_location' && (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search for Pickup location"
                      className="w-full h-9 pl-9 pr-8 bg-[#070c14] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1">
                    {availableLocations
                      .filter(l => !searchTerm || l.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(loc => {
                        const checked = draft.pickupLocations.includes(loc);
                        const count = counts.locations[loc] || 0;

                        return (
                          <label
                            key={loc}
                            onClick={() => toggleArrayItem('pickupLocations', loc)}
                            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-slate-800/50 cursor-pointer text-xs select-none transition-colors border border-transparent hover:border-slate-800"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                checked
                                  ? 'bg-purple-600 border-purple-500 text-white'
                                  : 'border-slate-700 bg-slate-900/60'
                              }`}>
                                {checked && <Check size={11} strokeWidth={3} />}
                              </div>
                              <span className={checked ? 'text-white font-semibold' : 'text-slate-300'}>
                                {loc}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                              {count}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 3. RISK OF RETURN (Image 1 reference) */}
              {activeCategory === 'risk_of_return' && (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search for Risk of return"
                      className="w-full h-9 pl-9 pr-8 bg-[#070c14] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mt-1">
                    {[
                      { id: 'Low (0 - 20)', label: 'Low (0 - 20)', color: 'bg-emerald-500', count: counts.risk['Low (0 - 20)'] },
                      { id: 'Medium (21 - 51)', label: 'Medium (21 - 51)', color: 'bg-amber-500', count: counts.risk['Medium (21 - 51)'] },
                      { id: 'High (52+)', label: 'High (52+)', color: 'bg-rose-500', count: counts.risk['High (52+)'] }
                    ]
                      .filter(item => !searchTerm || item.label.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(item => {
                        const checked = draft.riskOfReturn.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            onClick={() => toggleArrayItem('riskOfReturn', item.id)}
                            className="flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-slate-800/50 cursor-pointer text-xs select-none transition-colors border border-slate-800/60"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                checked
                                  ? 'bg-purple-600 border-purple-500 text-white'
                                  : 'border-slate-700 bg-slate-900/60'
                              }`}>
                                {checked && <Check size={11} strokeWidth={3} />}
                              </div>
                              <span className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
                              <span className={checked ? 'text-white font-semibold' : 'text-slate-300'}>
                                {item.label}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                              {item.count}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 4. CHANNEL */}
              {activeCategory === 'channel' && (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search for Channel"
                      className="w-full h-9 pl-9 pr-8 bg-[#070c14] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex flex-col gap-2 mt-1">
                    {[
                      { id: 'Online Store / Shopify', label: 'Online Store / Shopify', count: counts.channel['Online Store / Shopify'] },
                      { id: 'Website', label: 'Website (Direct)', count: counts.channel['Website'] },
                      { id: 'Manual / Direct', label: 'Manual / Direct Order', count: counts.channel['Manual / Direct'] },
                      { id: 'Delhivery Direct', label: 'Delhivery Direct', count: counts.channel['Delhivery Direct'] }
                    ]
                      .filter(item => !searchTerm || item.label.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(item => {
                        const checked = draft.channels.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            onClick={() => toggleArrayItem('channels', item.id)}
                            className="flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-slate-800/50 cursor-pointer text-xs select-none transition-colors border border-slate-800/60"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                checked
                                  ? 'bg-purple-600 border-purple-500 text-white'
                                  : 'border-slate-700 bg-slate-900/60'
                              }`}>
                                {checked && <Check size={11} strokeWidth={3} />}
                              </div>
                              <span className={checked ? 'text-white font-semibold' : 'text-slate-300'}>
                                {item.label}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                              {item.count}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 5. PAYMENT MODE (Image 2 reference) */}
              {activeCategory === 'payment_mode' && (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search for Payment mode"
                      className="w-full h-9 pl-9 pr-8 bg-[#070c14] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mt-1">
                    {[
                      { id: 'COD', label: 'COD', count: counts.payment['COD'] },
                      { id: 'Pickup', label: 'Pickup', count: counts.payment['Pickup'] },
                      { id: 'Prepaid', label: 'Prepaid', count: counts.payment['Prepaid'] },
                      { id: 'Replacement', label: 'Replacement', count: counts.payment['Replacement'] }
                    ]
                      .filter(item => !searchTerm || item.label.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(item => {
                        const checked = draft.paymentModes.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            onClick={() => toggleArrayItem('paymentModes', item.id)}
                            className="flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-slate-800/50 cursor-pointer text-xs select-none transition-colors border border-slate-800/60"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                checked
                                  ? 'bg-purple-600 border-purple-500 text-white'
                                  : 'border-slate-700 bg-slate-900/60'
                              }`}>
                                {checked && <Check size={11} strokeWidth={3} />}
                              </div>
                              <span className={checked ? 'text-white font-semibold' : 'text-slate-300'}>
                                {item.label}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                              {item.count}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 6. VERIFIED */}
              {activeCategory === 'verified' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 mt-1">
                    {[
                      { id: 'Verified', label: 'Verified', count: counts.verified['Verified'] },
                      { id: 'Unverified', label: 'Unverified', count: counts.verified['Unverified'] }
                    ].map(item => {
                      const checked = draft.verifiedStatuses.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          onClick={() => toggleArrayItem('verifiedStatuses', item.id)}
                          className="flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-slate-800/50 cursor-pointer text-xs select-none transition-colors border border-slate-800/60"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              checked
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'border-slate-700 bg-slate-900/60'
                            }`}>
                              {checked && <Check size={11} strokeWidth={3} />}
                            </div>
                            <span className={checked ? 'text-white font-semibold' : 'text-slate-300'}>
                              {item.label}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                            {item.count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 7. ORDER TAGS */}
              {activeCategory === 'order_tags' && (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search for Order tags"
                      className="w-full h-9 pl-9 pr-8 bg-[#070c14] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1">
                    {availableTags
                      .filter(t => !searchTerm || t.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(tag => {
                        const checked = draft.orderTags.includes(tag);
                        const count = counts.tags[tag] || 0;
                        return (
                          <label
                            key={tag}
                            onClick={() => toggleArrayItem('orderTags', tag)}
                            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-slate-800/50 cursor-pointer text-xs select-none transition-colors border border-transparent hover:border-slate-800"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                checked
                                  ? 'bg-purple-600 border-purple-500 text-white'
                                  : 'border-slate-700 bg-slate-900/60'
                              }`}>
                                {checked && <Check size={11} strokeWidth={3} />}
                              </div>
                              <span className={checked ? 'text-white font-semibold' : 'text-slate-300'}>
                                {tag}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                              {count}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 8. ADDRESS SCORE */}
              {activeCategory === 'address_score' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 mt-1">
                    {[
                      { id: 'Complete (100%)', label: 'Complete (100%)', count: counts.address['Complete (100%)'] },
                      { id: 'Good (75-99%)', label: 'Good (75-99%)', count: counts.address['Good (75-99%)'] },
                      { id: 'Partial (50-74%)', label: 'Partial (50-74%)', count: counts.address['Partial (50-74%)'] },
                      { id: 'Poor (<50%)', label: 'Poor (<50%)', count: counts.address['Poor (<50%)'] }
                    ].map(item => {
                      const checked = draft.addressScores.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          onClick={() => toggleArrayItem('addressScores', item.id)}
                          className="flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-slate-800/50 cursor-pointer text-xs select-none transition-colors border border-slate-800/60"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              checked
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'border-slate-700 bg-slate-900/60'
                            }`}>
                              {checked && <Check size={11} strokeWidth={3} />}
                            </div>
                            <span className={checked ? 'text-white font-semibold' : 'text-slate-300'}>
                              {item.label}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                            {item.count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 9. TRANSPORT MODE */}
              {activeCategory === 'transport_mode' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 mt-1">
                    {[
                      { id: 'Surface', label: 'Surface', count: counts.transport['Surface'] },
                      { id: 'Express', label: 'Express', count: counts.transport['Express'] }
                    ].map(item => {
                      const checked = draft.transportModes.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          onClick={() => toggleArrayItem('transportModes', item.id)}
                          className="flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-slate-800/50 cursor-pointer text-xs select-none transition-colors border border-slate-800/60"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              checked
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'border-slate-700 bg-slate-900/60'
                            }`}>
                              {checked && <Check size={11} strokeWidth={3} />}
                            </div>
                            <span className={checked ? 'text-white font-semibold' : 'text-slate-300'}>
                              {item.label}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                            {item.count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 10. ZONE */}
              {activeCategory === 'zone' && (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search for Zone"
                      className="w-full h-9 pl-9 pr-8 bg-[#070c14] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1">
                    {ZONE_OPTIONS
                      .filter(z => !searchTerm || z.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(zone => {
                        const checked = draft.zones.includes(zone);
                        const count = counts.zone[zone] || 0;
                        return (
                          <label
                            key={zone}
                            onClick={() => toggleArrayItem('zones', zone)}
                            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-slate-800/50 cursor-pointer text-xs select-none transition-colors border border-transparent hover:border-slate-800"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                checked
                                  ? 'bg-purple-600 border-purple-500 text-white'
                                  : 'border-slate-700 bg-slate-900/60'
                              }`}>
                                {checked && <Check size={11} strokeWidth={3} />}
                              </div>
                              <span className={checked ? 'text-white font-semibold' : 'text-slate-300'}>
                                {zone}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                              {count}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Bottom Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-800/80 bg-[#0e1626] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 underline cursor-pointer"
              >
                Clear all
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                >
                  Apply Filters {totalDraftCount > 0 ? `(${totalDraftCount})` : ''}
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
