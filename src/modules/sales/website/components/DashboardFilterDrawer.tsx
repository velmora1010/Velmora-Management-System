import React, { useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Filter, 
  RotateCcw, 
  MapPin, 
  CreditCard, 
  Package, 
  Tag, 
  UploadCloud, 
  SlidersHorizontal,
  Calendar,
  Check
} from 'lucide-react';
import type { WebsiteConsolidatedOrder, WebsiteUploadBatch, WebsiteSalesFilterState } from '../types';
import { MultiSelectDropdown, OptionItem } from './MultiSelectDropdown';
import { 
  formatSalesDateDisplay, 
  formatSalesDateShort,
  normalizeLocationKey,
  toCanonicalLocation
} from '../websiteSalesUtils';

interface DashboardFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: string;
  startDate?: string;
  endDate?: string;
  activePeriodDisplay?: string;
  allOrders: WebsiteConsolidatedOrder[];
  batches: WebsiteUploadBatch[];
  draftFilters: WebsiteSalesFilterState;
  setDraftFilters: React.Dispatch<React.SetStateAction<WebsiteSalesFilterState>>;
  onApply: () => void;
  onResetAll: () => void;
}

const PAYMENT_MODE_OPTIONS: OptionItem[] = [
  { label: 'PREPAID', value: 'PREPAID' },
  { label: 'PARTIAL COD', value: 'PARTIAL COD' },
  { label: 'COD', value: 'COD' },
  { label: 'UNKNOWN', value: 'UNKNOWN' }
];

const QUANTITY_OPTIONS = [
  { label: '1 Unit', value: '1' },
  { label: '2 Units', value: '2' },
  { label: '3 Units', value: '3' },
  { label: '4 Units', value: '4' },
  { label: '5+ Units', value: '5+' }
];

const ORDER_TYPE_OPTIONS: OptionItem[] = [
  { label: 'Single Product Order', value: 'Single Product Order' },
  { label: 'Multi Product Order', value: 'Multi Product Order' },
  { label: 'Single Unit Order', value: 'Single Unit Order' },
  { label: 'Multi Unit Order', value: 'Multi Unit Order' },
  { label: 'One Product, Multiple Quantity', value: 'One Product, Multiple Quantity' },
  { label: 'Multiple Products, Multiple Quantity', value: 'Multiple Products, Multiple Quantity' }
];

export const DashboardFilterDrawer: React.FC<DashboardFilterDrawerProps> = ({
  isOpen,
  onClose,
  selectedDate,
  startDate,
  endDate,
  activePeriodDisplay,
  allOrders,
  batches,
  draftFilters,
  setDraftFilters,
  onApply,
  onResetAll
}) => {
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

  // Compute options dynamically from Supabase order records
  const batchOptions: OptionItem[] = useMemo(() => {
    return batches.map(b => ({
      label: b.file_name,
      value: b.id
    }));
  }, [batches]);

  const stateOptions: OptionItem[] = useMemo(() => {
    const map = new Map<string, string>();
    allOrders.forEach(o => {
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
  }, [allOrders]);

  const cityOptions: OptionItem[] = useMemo(() => {
    const map = new Map<string, string>();
    const selectedStates = draftFilters.states || [];
    const normalizedSelectedStates = selectedStates.map(s => normalizeLocationKey(s));
    
    allOrders.forEach(o => {
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
  }, [allOrders, draftFilters.states]);

  const pincodeOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    const selectedStates = draftFilters.states || [];
    const selectedCities = draftFilters.cities || [];
    const normalizedSelectedStates = selectedStates.map(s => normalizeLocationKey(s));
    const normalizedSelectedCities = selectedCities.map(c => normalizeLocationKey(c));
    
    allOrders.forEach(o => {
      if (
        (normalizedSelectedStates.length === 0 || normalizedSelectedStates.includes(normalizeLocationKey(o.state))) &&
        (normalizedSelectedCities.length === 0 || normalizedSelectedCities.includes(normalizeLocationKey(o.city)))
      ) {
        const pin = String(o.pincode || '').trim();
        if (pin && pin !== '-' && pin !== 'null' && pin !== 'undefined') set.add(pin);
      }
    });
    return Array.from(set).sort().map(p => ({ label: p, value: p }));
  }, [allOrders, draftFilters.states, draftFilters.cities]);

  const offerOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => {
      const off = (o.offer || 'No Offer').trim();
      set.add(off);
    });
    return Array.from(set).sort().map(off => ({ label: off, value: off }));
  }, [allOrders]);

  const productOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach(it => set.add(it.product_name.trim()));
      } else if (o.product_name) {
        set.add(o.product_name.trim());
      }
    });
    return Array.from(set).sort().map(p => ({ label: p, value: p }));
  }, [allOrders]);

  const togglePaymentMode = (mode: string) => {
    const current = draftFilters.paymentModes || [];
    if (current.includes(mode)) {
      setDraftFilters({ ...draftFilters, paymentModes: current.filter(m => m !== mode) });
    } else {
      setDraftFilters({ ...draftFilters, paymentModes: [...current, mode] });
    }
  };

  const toggleQuantity = (qtyVal: string) => {
    const current = draftFilters.quantities || [];
    if (current.includes(qtyVal)) {
      setDraftFilters({ ...draftFilters, quantities: current.filter(q => q !== qtyVal) });
    } else {
      setDraftFilters({ ...draftFilters, quantities: [...current, qtyVal] });
    }
  };

  if (!isOpen) return null;

  const displayPeriodText = activePeriodDisplay || 
    (startDate && endDate && startDate !== endDate
      ? `${formatSalesDateShort(startDate)} - ${formatSalesDateShort(endDate)}`
      : formatSalesDateDisplay(startDate || selectedDate || ''));

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Open Dashboard Filters"
    >
      {/* BACKDROP CLICK CLOSES DRAWER */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* DRAWER CONTAINER */}
      <div className="relative w-full max-w-[500px] h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        
        {/* STICKY DRAWER HEADER */}
        <div className="p-5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 text-white font-extrabold text-base">
              <SlidersHorizontal size={18} className="text-cyan-400" />
              <span>Dashboard Filters</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Refine Website Sales dashboard data.</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 text-[11px] font-mono border border-cyan-500/20">
              <Calendar size={12} />
              <span>Period: {displayPeriodText}</span>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-7 divide-y divide-slate-800/60 text-xs">
          
          {/* FILTER GROUP 1 — ORDER SEARCH */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Search size={14} className="text-blue-400" /> Order Search
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Order ID</label>
                <input
                  type="text"
                  value={draftFilters.orderIdSearch || ''}
                  onChange={e => setDraftFilters({ ...draftFilters, orderIdSearch: e.target.value })}
                  placeholder="Search by Order ID"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={draftFilters.customerNameSearch || ''}
                  onChange={e => setDraftFilters({ ...draftFilters, customerNameSearch: e.target.value })}
                  placeholder="Search by customer name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={draftFilters.phoneSearch || ''}
                  onChange={e => setDraftFilters({ ...draftFilters, phoneSearch: e.target.value })}
                  placeholder="Search 10-digit phone number"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* FILTER GROUP 2 — LOCATION */}
          <div className="space-y-3 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <MapPin size={14} className="text-cyan-400" /> Location
            </h4>
            <div className="space-y-3">
              <MultiSelectDropdown
                label="State"
                options={stateOptions}
                selectedValues={draftFilters.states || []}
                onChange={vals => setDraftFilters({ ...draftFilters, states: vals, cities: [], pincodes: [] })}
                placeholder="All States"
              />

              <MultiSelectDropdown
                label="City"
                options={cityOptions}
                selectedValues={draftFilters.cities || []}
                onChange={vals => setDraftFilters({ ...draftFilters, cities: vals, pincodes: [] })}
                placeholder="All Cities"
              />

              <MultiSelectDropdown
                label="Pincode"
                options={pincodeOptions}
                selectedValues={draftFilters.pincodes || []}
                onChange={vals => setDraftFilters({ ...draftFilters, pincodes: vals })}
                placeholder="All Pincodes"
              />
            </div>
          </div>

          {/* FILTER GROUP 3 — PAYMENT */}
          <div className="space-y-3 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <CreditCard size={14} className="text-purple-400" /> Payment & Amount Ranges
            </h4>
            
            {/* Payment Mode Checkboxes */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-2">Payment Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_MODE_OPTIONS.map(pm => {
                  const isChecked = (draftFilters.paymentModes || []).includes(pm.value);
                  return (
                    <div
                      key={pm.value}
                      onClick={() => togglePaymentMode(pm.value)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-purple-500/20 border-purple-500/60 text-white font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isChecked ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-700 bg-slate-900'}`}>
                        {isChecked && <Check size={11} strokeWidth={3} />}
                      </div>
                      <span className="text-[11px]">{pm.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Price Range */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Min Order Amount (₹)</label>
                <input
                  type="number"
                  value={draftFilters.minPrice || ''}
                  onChange={e => setDraftFilters({ ...draftFilters, minPrice: e.target.value })}
                  placeholder="Min ₹"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Max Order Amount (₹)</label>
                <input
                  type="number"
                  value={draftFilters.maxPrice || ''}
                  onChange={e => setDraftFilters({ ...draftFilters, maxPrice: e.target.value })}
                  placeholder="Max ₹"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 font-mono"
                />
              </div>
            </div>

            {/* Remaining COD Range */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Min Remaining COD (₹)</label>
                <input
                  type="number"
                  value={draftFilters.minRemainingCod || ''}
                  onChange={e => setDraftFilters({ ...draftFilters, minRemainingCod: e.target.value })}
                  placeholder="Min ₹"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Max Remaining COD (₹)</label>
                <input
                  type="number"
                  value={draftFilters.maxRemainingCod || ''}
                  onChange={e => setDraftFilters({ ...draftFilters, maxRemainingCod: e.target.value })}
                  placeholder="Max ₹"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* FILTER GROUP 4 — PRODUCT */}
          <div className="space-y-3 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Package size={14} className="text-emerald-400" /> Product & Composition
            </h4>
            <div className="space-y-3">
              <MultiSelectDropdown
                label="Product"
                options={productOptions}
                selectedValues={draftFilters.products || []}
                onChange={vals => setDraftFilters({ ...draftFilters, products: vals })}
                placeholder="All Products"
              />

              {/* Quantity Options Checkboxes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-2">Quantity Units</label>
                <div className="flex flex-wrap gap-2">
                  {QUANTITY_OPTIONS.map(q => {
                    const isChecked = (draftFilters.quantities || []).includes(q.value);
                    return (
                      <button
                        key={q.value}
                        type="button"
                        onClick={() => toggleQuantity(q.value)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <MultiSelectDropdown
                label="Order Composition"
                options={ORDER_TYPE_OPTIONS}
                selectedValues={draftFilters.orderTypes || []}
                onChange={vals => setDraftFilters({ ...draftFilters, orderTypes: vals })}
                placeholder="All Order Types"
              />
            </div>
          </div>

          {/* FILTER GROUP 5 — OFFER */}
          <div className="space-y-3 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Tag size={14} className="text-amber-400" /> Offer
            </h4>
            <MultiSelectDropdown
              label="Offer"
              options={offerOptions}
              selectedValues={draftFilters.offers || []}
              onChange={vals => setDraftFilters({ ...draftFilters, offers: vals })}
              placeholder="All Offers"
            />
          </div>

          {/* FILTER GROUP 6 — BATCH / FILE */}
          <div className="space-y-3 pt-6 pb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <UploadCloud size={14} className="text-blue-400" /> Upload Source File
            </h4>
            <MultiSelectDropdown
              label="Upload Batch File"
              options={batchOptions}
              selectedValues={draftFilters.batchIds || []}
              onChange={vals => setDraftFilters({ ...draftFilters, batchIds: vals })}
              placeholder="All Upload Files"
            />
          </div>
        </div>

        {/* STICKY FOOTER ACTIONS */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onResetAll}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
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
              onClick={onApply}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Filter size={14} /> Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
