import React, { useEffect, useMemo } from 'react';
import { 
  X, 
  RotateCcw, 
  MapPin, 
  CreditCard, 
  Tag, 
  SlidersHorizontal,
  Check
} from 'lucide-react';
import type { WebsiteConsolidatedOrder, WebsiteUploadBatch } from '../types';
import type { MultiSelectFilterState } from '../WebsiteAnalytics';
import { MultiSelectDropdown, OptionItem } from './MultiSelectDropdown';
import { 
  getUploadBatchesForAnalyticsPeriod, 
  getTodayInBusinessTimezone,
  normalizeLocationKey,
  toCanonicalLocation
} from '../websiteSalesUtils';
import { useWebsiteSalesDateRange } from '../context/WebsiteSalesDateRangeContext';

interface AnalyticsFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePeriodDisplay: string;
  allOrders: WebsiteConsolidatedOrder[];
  batches: WebsiteUploadBatch[];
  draftFilters: MultiSelectFilterState;
  setDraftFilters: React.Dispatch<React.SetStateAction<MultiSelectFilterState>>;
  onApply: () => void;
  onResetAll: () => void;
}

const PAYMENT_MODE_OPTIONS: OptionItem[] = [
  { label: 'PREPAID', value: 'PREPAID' },
  { label: 'PARTIAL COD', value: 'PARTIAL COD' },
  { label: 'COD', value: 'COD' },
  { label: 'UNKNOWN', value: 'UNKNOWN' }
];

const ORDER_TYPE_OPTIONS: OptionItem[] = [
  { label: 'Single Product Order', value: 'Single Product Order' },
  { label: 'Multi Product Order', value: 'Multi Product Order' },
  { label: 'Single Unit Order', value: 'Single Unit Order' },
  { label: 'Multi Unit Order', value: 'Multi Unit Order' },
  { label: 'One Product, Multiple Quantity', value: 'One Product, Multiple Quantity' },
  { label: 'Multiple Products, Multiple Quantity', value: 'Multiple Products, Multiple Quantity' }
];

export const AnalyticsFilterDrawer: React.FC<AnalyticsFilterDrawerProps> = ({
  isOpen,
  onClose,
  activePeriodDisplay,
  allOrders,
  batches,
  draftFilters,
  setDraftFilters,
  onApply,
  onResetAll
}) => {
  // Shared Website Sales Date Range Context
  const { startDate, endDate } = useWebsiteSalesDateRange();

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

  // Orders falling strictly within the selected Analytics date/period
  const periodOrders = useMemo(() => {
    const start = startDate || getTodayInBusinessTimezone();
    const end = endDate || getTodayInBusinessTimezone();
    return allOrders.filter(o => {
      const d = o.order_date;
      return d && d >= start && d <= end;
    });
  }, [allOrders, startDate, endDate]);

  // Count of automatically included upload batch files for the selected period
  const periodBatchesCount = useMemo(() => {
    const start = startDate || getTodayInBusinessTimezone();
    const end = endDate || getTodayInBusinessTimezone();
    return getUploadBatchesForAnalyticsPeriod(batches, allOrders, start, end).length;
  }, [batches, allOrders, startDate, endDate]);

  // Dynamic filter options derived strictly from active period orders
  const stateOptions: OptionItem[] = useMemo(() => {
    const map = new Map<string, string>();
    periodOrders.forEach(o => {
      const raw = o.state;
      const normalized = normalizeLocationKey(raw);
      if (!normalized) return;
      if (normalized === 'na' || normalized === 'n/a' || normalized === 'null' || normalized === 'undefined' || normalized === '-') return;
      
      const canonical = toCanonicalLocation(raw);
      if (canonical === 'Unspecified') return;
      
      if (!map.has(normalized)) {
        map.set(normalized, canonical);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({ label, value: label }));
  }, [periodOrders]);

  const cityOptions: OptionItem[] = useMemo(() => {
    const map = new Map<string, string>();
    const selectedStates = draftFilters.states || [];
    const normalizedSelectedStates = selectedStates.map(s => normalizeLocationKey(s));
    
    periodOrders.forEach(o => {
      if (normalizedSelectedStates.length === 0 || normalizedSelectedStates.includes(normalizeLocationKey(o.state))) {
        const raw = o.city;
        const normalized = normalizeLocationKey(raw);
        if (!normalized) return;
        if (normalized === 'na' || normalized === 'n/a' || normalized === 'null' || normalized === 'undefined' || normalized === '-') return;
        
        const canonical = toCanonicalLocation(raw);
        if (canonical === 'Unspecified') return;
        
        if (!map.has(normalized)) {
          map.set(normalized, canonical);
        }
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({ label, value: label }));
  }, [periodOrders, draftFilters.states]);

  const pincodeOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    const selectedStates = draftFilters.states || [];
    const selectedCities = draftFilters.cities || [];
    const normalizedSelectedStates = selectedStates.map(s => normalizeLocationKey(s));
    const normalizedSelectedCities = selectedCities.map(c => normalizeLocationKey(c));
    
    periodOrders.forEach(o => {
      if (
        (normalizedSelectedStates.length === 0 || normalizedSelectedStates.includes(normalizeLocationKey(o.state))) &&
        (normalizedSelectedCities.length === 0 || normalizedSelectedCities.includes(normalizeLocationKey(o.city)))
      ) {
        const pin = String(o.pincode || '').trim();
        if (pin && pin !== '-' && pin !== 'null' && pin !== 'undefined') set.add(pin);
      }
    });
    return Array.from(set).sort().map(p => ({ label: p, value: p }));
  }, [periodOrders, draftFilters.states, draftFilters.cities]);

  const offerOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    periodOrders.forEach(o => set.add((o.offer || 'No Offer').trim()));
    return Array.from(set).sort().map(off => ({ label: off, value: off }));
  }, [periodOrders]);

  const productOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    periodOrders.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach(it => set.add(it.product_name.trim()));
      } else if (o.product_name) {
        set.add(o.product_name.trim());
      }
    });
    return Array.from(set).sort().map(p => ({ label: p, value: p }));
  }, [periodOrders]);

  // Auto-clean invalid child filter selections when parent filters change
  useEffect(() => {
    if (draftFilters.states && draftFilters.states.length > 0) {
      const validCityValues = new Set(cityOptions.map(c => c.value));
      const filteredCities = draftFilters.cities.filter(c => validCityValues.has(c));
      if (filteredCities.length !== draftFilters.cities.length) {
        setDraftFilters(prev => ({ ...prev, cities: filteredCities, pincodes: [] }));
      }
    }
  }, [draftFilters.states, cityOptions]);

  useEffect(() => {
    if (draftFilters.cities && draftFilters.cities.length > 0) {
      const validPinValues = new Set(pincodeOptions.map(p => p.value));
      const filteredPins = draftFilters.pincodes.filter(p => validPinValues.has(p));
      if (filteredPins.length !== draftFilters.pincodes.length) {
        setDraftFilters(prev => ({ ...prev, pincodes: filteredPins }));
      }
    }
  }, [draftFilters.cities, pincodeOptions]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Open Analytics Filters"
      data-right-drawer="true"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md lg:max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* HEADER */}
          <div className="p-6 bg-slate-900 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400">
                <SlidersHorizontal size={20} />
                <h2 className="text-lg font-extrabold text-white tracking-tight">Analytics Filters</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close Analytics Filters"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400">Refine Website Sales analytics.</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider font-mono">
                Period: {activePeriodDisplay}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                • {periodBatchesCount} {periodBatchesCount === 1 ? 'file' : 'files'} included automatically
              </span>
            </div>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. LOCATION */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <MapPin size={14} className="text-cyan-400" />
                <span>Location</span>
              </div>
              <div className="space-y-3">
                <MultiSelectDropdown
                  label="State"
                  options={stateOptions}
                  selectedValues={draftFilters.states}
                  onChange={vals => setDraftFilters(prev => ({ ...prev, states: vals, cities: [], pincodes: [] }))}
                  placeholder={stateOptions.length > 0 ? "All States" : "No states for selected period"}
                  disabled={stateOptions.length === 0}
                />
                <MultiSelectDropdown
                  label="City"
                  options={cityOptions}
                  selectedValues={draftFilters.cities}
                  onChange={vals => setDraftFilters(prev => ({ ...prev, cities: vals, pincodes: [] }))}
                  placeholder={cityOptions.length > 0 ? "All Cities" : "No cities for selected period"}
                  disabled={cityOptions.length === 0}
                />
                <MultiSelectDropdown
                  label="Pincode"
                  options={pincodeOptions}
                  selectedValues={draftFilters.pincodes}
                  onChange={vals => setDraftFilters(prev => ({ ...prev, pincodes: vals }))}
                  placeholder={pincodeOptions.length > 0 ? "All Pincodes" : "No pincodes for selected period"}
                  disabled={pincodeOptions.length === 0}
                />
              </div>
            </div>

            {/* 2. PAYMENT */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <CreditCard size={14} className="text-purple-400" />
                <span>Payment</span>
              </div>
              <MultiSelectDropdown
                label="Payment Mode"
                options={PAYMENT_MODE_OPTIONS}
                selectedValues={draftFilters.paymentModes}
                onChange={vals => setDraftFilters(prev => ({ ...prev, paymentModes: vals }))}
                placeholder="All Payment Modes"
                disabled={periodOrders.length === 0}
              />
            </div>

            {/* 3. SALES & PRODUCTS */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Tag size={14} className="text-emerald-400" />
                <span>Sales & Products</span>
              </div>
              <div className="space-y-3">
                <MultiSelectDropdown
                  label="Offer"
                  options={offerOptions}
                  selectedValues={draftFilters.offers}
                  onChange={vals => setDraftFilters(prev => ({ ...prev, offers: vals }))}
                  placeholder={offerOptions.length > 0 ? "All Offers" : "No offers for selected period"}
                  disabled={offerOptions.length === 0}
                />
                <MultiSelectDropdown
                  label="Product"
                  options={productOptions}
                  selectedValues={draftFilters.products}
                  onChange={vals => setDraftFilters(prev => ({ ...prev, products: vals }))}
                  placeholder={productOptions.length > 0 ? "All Products" : "No products for selected period"}
                  disabled={productOptions.length === 0}
                />
                <MultiSelectDropdown
                  label="Order Type"
                  options={ORDER_TYPE_OPTIONS}
                  selectedValues={draftFilters.orderTypes}
                  onChange={vals => setDraftFilters(prev => ({ ...prev, orderTypes: vals }))}
                  placeholder="All Order Types"
                  disabled={periodOrders.length === 0}
                />
              </div>
            </div>
          </div>

          {/* STICKY FOOTER */}
          <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onResetAll}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw size={14} /> Reset All
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onApply}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Check size={14} /> Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
