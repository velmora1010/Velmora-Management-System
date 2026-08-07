import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  TrendingUp, 
  Layers, 
  Clock, 
  UploadCloud, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CreditCard,
  AlertCircle,
  SlidersHorizontal,
  X,
  RotateCcw,
  Filter
} from 'lucide-react';
import type { WebsiteConsolidatedOrder, WebsiteUploadBatch, WebsiteSalesFilterState } from './types';
import { websiteSalesService } from './websiteSalesService';
import { 
  getTodayInBusinessTimezone, 
  formatSalesDateDisplay, 
  shiftDateString,
  formatSalesDateShort
} from './websiteSalesUtils';
import { DashboardFilterDrawer } from './components/DashboardFilterDrawer';
import toast from 'react-hot-toast';

const DEFAULT_DASHBOARD_FILTERS: WebsiteSalesFilterState = {
  orderIdSearch: '',
  customerNameSearch: '',
  phoneSearch: '',
  batchIds: [],
  states: [],
  cities: [],
  pincodes: [],
  paymentModes: [],
  minPrice: '',
  maxPrice: '',
  minRemainingCod: '',
  maxRemainingCod: '',
  products: [],
  quantities: [],
  orderTypes: [],
  offers: []
};

export const WebsiteDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Date State synced with URL ?date=YYYY-MM-DD
  const todayStr = getTodayInBusinessTimezone();
  const urlDate = searchParams.get('date');
  const initialDate = (urlDate && urlDate.match(/^\d{4}-\d{2}-\d{2}$/)) ? urlDate : todayStr;

  const [selectedSalesDate, setSelectedSalesDate] = useState<string>(initialDate);
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [allOrders, setAllOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [orders, setOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Drawer & Filter state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [draftFilters, setDraftFilters] = useState<WebsiteSalesFilterState>(DEFAULT_DASHBOARD_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<WebsiteSalesFilterState>(DEFAULT_DASHBOARD_FILTERS);

  // Sync state when URL parameter changes
  useEffect(() => {
    const qDate = searchParams.get('date');
    if (qDate && qDate.match(/^\d{4}-\d{2}-\d{2}$/) && qDate !== selectedSalesDate) {
      setSelectedSalesDate(qDate);
    }
  }, [searchParams]);

  // Load dataset on date change or applied filter change
  useEffect(() => {
    loadData();
  }, [selectedSalesDate, appliedFilters]);

  const updateDateParam = (newDate: string) => {
    setSelectedSalesDate(newDate);
    if (newDate === todayStr) {
      searchParams.delete('date');
    } else {
      searchParams.set('date', newDate);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const loadData = async () => {
    setLoading(true);
    const bList = await websiteSalesService.getUploadBatches();
    setBatches(bList);

    // Fetch orders for dataset
    const fullDataset = await websiteSalesService.getConsolidatedOrders();
    setAllOrders(fullDataset);

    // Filter using selected date + applied dashboard filters
    const ordList = await websiteSalesService.getConsolidatedOrders({
      ...appliedFilters,
      selectedDate: selectedSalesDate
    });

    setOrders(ordList);
    setLoading(false);
  };

  const handleDeleteBatch = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete batch "${name}" and all its raw & consolidated data?`)) {
      await websiteSalesService.deleteUploadBatch(id);
      loadData();
    }
  };

  const handlePrevDay = () => {
    const prev = shiftDateString(selectedSalesDate, -1);
    updateDateParam(prev);
  };

  const handleNextDay = () => {
    const next = shiftDateString(selectedSalesDate, 1);
    updateDateParam(next);
  };

  const handleResetToday = () => {
    updateDateParam(todayStr);
  };

  const handleSelectDate = (val: string) => {
    if (val) {
      updateDateParam(val);
    }
  };

  const handleApplyDrawerFilters = () => {
    setAppliedFilters(draftFilters);
    setIsFilterDrawerOpen(false);
    toast.success('Dashboard filters applied!');
  };

  const handleResetDrawerFilters = () => {
    setDraftFilters(DEFAULT_DASHBOARD_FILTERS);
    setAppliedFilters(DEFAULT_DASHBOARD_FILTERS);
    setIsFilterDrawerOpen(false);
    toast.success('Dashboard filters reset');
  };

  // Remove individual active chip
  const handleRemoveChip = (key: keyof WebsiteSalesFilterState, val?: string) => {
    const nextDraft = { ...appliedFilters };
    if (val && Array.isArray(nextDraft[key])) {
      (nextDraft[key] as string[]) = ((nextDraft[key] as string[]) || []).filter(v => v !== val);
    } else {
      delete nextDraft[key];
    }
    setDraftFilters(nextDraft);
    setAppliedFilters(nextDraft);
  };

  const isSelectedToday = selectedSalesDate === todayStr;

  // Active filter count computation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.orderIdSearch) count++;
    if (appliedFilters.customerNameSearch) count++;
    if (appliedFilters.phoneSearch) count++;
    if (appliedFilters.batchIds && appliedFilters.batchIds.length > 0) count += appliedFilters.batchIds.length;
    if (appliedFilters.states && appliedFilters.states.length > 0) count += appliedFilters.states.length;
    if (appliedFilters.cities && appliedFilters.cities.length > 0) count += appliedFilters.cities.length;
    if (appliedFilters.pincodes && appliedFilters.pincodes.length > 0) count += appliedFilters.pincodes.length;
    if (appliedFilters.paymentModes && appliedFilters.paymentModes.length > 0) count += appliedFilters.paymentModes.length;
    if (appliedFilters.minPrice) count++;
    if (appliedFilters.maxPrice) count++;
    if (appliedFilters.minRemainingCod) count++;
    if (appliedFilters.maxRemainingCod) count++;
    if (appliedFilters.products && appliedFilters.products.length > 0) count += appliedFilters.products.length;
    if (appliedFilters.quantities && appliedFilters.quantities.length > 0) count += appliedFilters.quantities.length;
    if (appliedFilters.orderTypes && appliedFilters.orderTypes.length > 0) count += appliedFilters.orderTypes.length;
    if (appliedFilters.offers && appliedFilters.offers.length > 0) count += appliedFilters.offers.length;
    return count;
  }, [appliedFilters]);

  // Filtered Date Sales Metrics
  const totalOrdersCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const totalUnits = orders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0);
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  // Payment Breakdown for Selected Date & Applied Filters
  const prepaidOrdersCount = orders.filter(o => o.payment_mode === 'PREPAID').length;
  const partialCodOrders = orders.filter(o => o.payment_mode === 'PARTIAL COD');
  const partialCodOrdersCount = partialCodOrders.length;
  const fullCodOrders = orders.filter(o => o.payment_mode === 'COD');
  const fullCodOrdersCount = fullCodOrders.length;

  const partialCodRemaining = partialCodOrders.reduce((sum, o) => sum + (Number(o.remaining_payable) || 0), 0);
  const fullCodReceivable = fullCodOrders.reduce((sum, o) => sum + (Number(o.remaining_payable ?? o.price) || 0), 0);
  const totalCodReceivable = partialCodRemaining + fullCodReceivable;

  // Batches for Selected Date & Applied Filters
  const dateBatches = batches.filter(b => {
    if (b.order_date !== selectedSalesDate && (!b.uploaded_at || !b.uploaded_at.startsWith(selectedSalesDate))) return false;
    if (appliedFilters.batchIds && appliedFilters.batchIds.length > 0 && !appliedFilters.batchIds.includes(b.id)) return false;
    return true;
  });

  const rawDataRowsCount = dateBatches.reduce((sum, b) => sum + (Number(b.total_source_rows) || 0), 0);
  const duplicatesMergedCount = dateBatches.reduce((sum, b) => sum + (Number(b.duplicate_order_count) || 0), 0);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300">
      {/* HEADER & DATE SELECTOR BAR WITH FILTER DRAWER BUTTON */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Website Sales Dashboard</h1>
            {isSelectedToday ? (
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                Today
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider">
                Selected Date
              </span>
            )}
          </div>
          <p className="text-cyan-400 font-semibold text-sm mt-1">
            {formatSalesDateDisplay(selectedSalesDate)}
          </p>
        </div>

        {/* COMPACT DATE CONTROLS & FILTER DRAWER BUTTON */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 border border-slate-800 p-2 rounded-2xl">
          {/* Previous Day */}
          <button
            type="button"
            onClick={handlePrevDay}
            title="Previous Day"
            aria-label="Previous Day"
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center border border-slate-800"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Calendar Date Input */}
          <div className="relative flex items-center">
            <Calendar size={15} className="absolute left-3 text-cyan-400 pointer-events-none" />
            <input
              type="date"
              value={selectedSalesDate}
              onChange={e => handleSelectDate(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-cyan-400 font-mono font-bold cursor-pointer"
            />
          </div>

          {/* Next Day */}
          <button
            type="button"
            onClick={handleNextDay}
            disabled={selectedSalesDate >= todayStr}
            title="Next Day"
            aria-label="Next Day"
            className="p-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center border border-slate-800"
          >
            <ChevronRight size={16} />
          </button>

          {/* Today Reset Button */}
          <button
            type="button"
            onClick={handleResetToday}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Clock size={14} /> Today
          </button>

          {/* COMPACT DASHBOARD FILTER DRAWER TRIGGER BUTTON */}
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(true)}
            aria-label="Open Dashboard Filters"
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
              activeFilterCount > 0
                ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500 text-slate-950 font-extrabold font-mono">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ACTIVE FILTER CHIPS BAR */}
      {activeFilterCount > 0 && (
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Active Filters:</span>
            
            {appliedFilters.orderIdSearch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-[11px]">
                Order ID: {appliedFilters.orderIdSearch}
                <button onClick={() => handleRemoveChip('orderIdSearch')} className="hover:text-white cursor-pointer"><X size={12} /></button>
              </span>
            )}

            {appliedFilters.customerNameSearch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px]">
                Customer: {appliedFilters.customerNameSearch}
                <button onClick={() => handleRemoveChip('customerNameSearch')} className="hover:text-white cursor-pointer"><X size={12} /></button>
              </span>
            )}

            {appliedFilters.phoneSearch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-[11px]">
                Phone: {appliedFilters.phoneSearch}
                <button onClick={() => handleRemoveChip('phoneSearch')} className="hover:text-white cursor-pointer"><X size={12} /></button>
              </span>
            )}

            {appliedFilters.states?.map(st => (
              <span key={st} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px]">
                State: {st}
                <button onClick={() => handleRemoveChip('states', st)} className="hover:text-white cursor-pointer"><X size={12} /></button>
              </span>
            ))}

            {appliedFilters.cities?.map(ct => (
              <span key={ct} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px]">
                City: {ct}
                <button onClick={() => handleRemoveChip('cities', ct)} className="hover:text-white cursor-pointer"><X size={12} /></button>
              </span>
            ))}

            {appliedFilters.paymentModes?.map(pm => (
              <span key={pm} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-bold">
                Payment: {pm}
                <button onClick={() => handleRemoveChip('paymentModes', pm)} className="hover:text-white cursor-pointer"><X size={12} /></button>
              </span>
            ))}

            {appliedFilters.products?.map(p => (
              <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px]">
                Product: {p}
                <button onClick={() => handleRemoveChip('products', p)} className="hover:text-white cursor-pointer"><X size={12} /></button>
              </span>
            ))}

            {appliedFilters.offers?.map(off => (
              <span key={off} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px]">
                Offer: {off}
                <button onClick={() => handleRemoveChip('offers', off)} className="hover:text-white cursor-pointer"><X size={12} /></button>
              </span>
            ))}
          </div>

          <button
            onClick={handleResetDrawerFilters}
            className="text-xs text-cyan-400 hover:underline font-bold cursor-pointer flex items-center gap-1 shrink-0"
          >
            <RotateCcw size={13} /> Clear All Filters
          </button>
        </div>
      )}

      {/* SECTION 1: SELECTED DATE SALES SUMMARY */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-blue-400">
          <TrendingUp size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">Sales Summary ({formatSalesDateShort(selectedSalesDate)})</h2>
        </div>

        {totalOrdersCount === 0 && !loading ? (
          <div className="p-10 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <AlertCircle size={36} className="text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No website orders match the selected date and filters.</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Try editing your filter criteria or navigating to another date using the date controls above.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsFilterDrawerOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <SlidersHorizontal size={14} /> Edit Filters
              </button>
              <button
                onClick={handleResetDrawerFilters}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw size={14} /> Reset Filters
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: TOTAL ORDERS */}
            <div className="p-6 border-t-4 border-t-blue-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Total Orders</span>
              <div className="text-3xl font-bold text-white">{totalOrdersCount}</div>
            </div>
            
            {/* Card 2: TOTAL REVENUE */}
            <div className="p-6 border-t-4 border-t-emerald-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Total Revenue</span>
              <div className="text-3xl font-bold text-emerald-400">₹{totalRevenue.toLocaleString()}</div>
            </div>

            {/* Card 3: TOTAL UNITS */}
            <div className="p-6 border-t-4 border-t-cyan-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Total Units</span>
              <div className="text-3xl font-bold text-cyan-300">{totalUnits}</div>
            </div>

            {/* Card 4: AVG ORDER VALUE */}
            <div className="p-6 border-t-4 border-t-purple-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Avg Order Value</span>
              <div className="text-3xl font-bold text-purple-300">₹{avgOrderValue.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: PAYMENT & COD BREAKDOWN CARDS */}
      {totalOrdersCount > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-purple-400">
            <CreditCard size={20} />
            <h2 className="text-lg font-bold uppercase tracking-wider">Payment & Receivable Breakdown</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: PREPAID ORDERS */}
            <div className="p-6 border-t-4 border-t-emerald-400 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Prepaid Orders</span>
              <div className="text-3xl font-bold text-emerald-400">{prepaidOrdersCount}</div>
            </div>

            {/* Card 2: PARTIAL COD ORDERS */}
            <div className="p-6 border-t-4 border-t-purple-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Partial COD Orders</span>
              <div className="text-3xl font-bold text-purple-300">{partialCodOrdersCount}</div>
            </div>

            {/* Card 3: FULL COD ORDERS */}
            <div className="p-6 border-t-4 border-t-amber-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Full COD Orders</span>
              <div className="text-3xl font-bold text-amber-400">{fullCodOrdersCount}</div>
            </div>

            {/* Card 4: TOTAL COD RECEIVABLE */}
            <div className="p-6 border-t-4 border-t-pink-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Total COD Receivable</span>
              <div className="text-3xl font-bold text-pink-300">₹{totalCodReceivable.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: ORDER SUMMARY */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-emerald-500">
          <Layers size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">Batch & Audit Summary</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: RAW DATA ROWS */}
          <div className="p-6 border-t-4 border-t-emerald-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Raw Data Rows</span>
            <div className="text-3xl font-bold text-white">{rawDataRowsCount}</div>
          </div>
          
          {/* Card 2: UNIQUE ORDERS */}
          <div className="p-6 border-t-4 border-t-emerald-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Unique Orders</span>
            <div className="text-3xl font-bold text-white">{totalOrdersCount}</div>
          </div>

          {/* Card 3: DUPLICATES MERGED */}
          <div className="p-6 border-t-4 border-t-emerald-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Duplicates Merged</span>
            <div className="text-3xl font-bold text-white">{duplicatesMergedCount}</div>
          </div>

          {/* Card 4: UPLOAD BATCHES FOR DATE */}
          <div className="p-6 border-t-4 border-t-emerald-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Upload Batches</span>
            <div className="text-3xl font-bold text-white">{dateBatches.length}</div>
          </div>
        </div>
      </div>

      {/* RECENT UPLOAD PANEL */}
      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Order Upload Batches ({formatSalesDateShort(selectedSalesDate)})</h3>
            <p className="text-xs text-slate-400">Order date and upload timestamp audit records</p>
          </div>
          <button
            onClick={() => navigate('/sales/website/upload')}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <UploadCloud size={14} /> Upload Orders
          </button>
        </div>

        {dateBatches.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No upload batches recorded for {formatSalesDateShort(selectedSalesDate)}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-400">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 font-semibold">File Name</th>
                  <th className="px-4 py-3 font-semibold">Order Date</th>
                  <th className="px-4 py-3 font-semibold">Upload Date</th>
                  <th className="px-4 py-3 font-semibold">Source Rows</th>
                  <th className="px-4 py-3 font-semibold">Unique Orders</th>
                  <th className="px-4 py-3 font-semibold">Price Mode</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {dateBatches.map(b => (
                  <tr key={b.id} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{b.file_name}</td>
                    <td className="px-4 py-3 font-semibold text-cyan-300 whitespace-nowrap">
                      {b.order_date_range || (b.order_date ? formatSalesDateShort(b.order_date) : '-')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-mono text-xs">
                      {new Date(b.uploaded_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 font-medium text-blue-400">{b.total_source_rows}</td>
                    <td className="px-4 py-3 font-medium text-emerald-400">{b.total_unique_orders}</td>
                    <td className="px-4 py-3 text-slate-400">{b.price_interpretation}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-emerald-500/20 text-emerald-400">
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteBatch(b.id, b.file_name)}
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete Batch"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADVANCED DASHBOARD FILTER DRAWER COMPONENT */}
      <DashboardFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        selectedDate={selectedSalesDate}
        allOrders={allOrders}
        batches={batches}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        onApply={handleApplyDrawerFilters}
        onResetAll={handleResetDrawerFilters}
      />
    </div>
  );
};
