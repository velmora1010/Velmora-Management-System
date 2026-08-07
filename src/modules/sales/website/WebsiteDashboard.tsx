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
  Filter,
  Truck,
  Package,
  PieChart as PieIcon
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
import { ProductDispatchModal } from './components/ProductDispatchModal';
import { ComboDispatchModal } from './components/ComboDispatchModal';
import { AnalyticsDonutChart } from './components/AnalyticsDonutChart';
import { CardMatchingOrdersList } from './components/CardMatchingOrdersList';
import toast from 'react-hot-toast';

const DISTINCT_COLORS = [
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#64748b'  // Slate
];

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
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isComboModalOpen, setIsComboModalOpen] = useState<boolean>(false);
  const [draftFilters, setDraftFilters] = useState<WebsiteSalesFilterState>(DEFAULT_DASHBOARD_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<WebsiteSalesFilterState>(DEFAULT_DASHBOARD_FILTERS);

  // Filtered Visualization Card Slice States
  const [dashboardPaymentCardSlice, setDashboardPaymentCardSlice] = useState<string | null>(null);
  const [dashboardProductCardSlice, setDashboardProductCardSlice] = useState<string | null>(null);
  const [dashboardOfferCardSlice, setDashboardOfferCardSlice] = useState<string | null>(null);
  const [dashboardStateCardSlice, setDashboardStateCardSlice] = useState<string | null>(null);

  // Sync state when URL parameter changes
  useEffect(() => {
    const qDate = searchParams.get('date');
    if (qDate && qDate.match(/^\d{4}-\d{2}-\d{2}$/) && qDate !== selectedSalesDate) {
      setSelectedSalesDate(qDate);
    }
  }, [searchParams]);

  // Load dataset on date change or applied filter change
  useEffect(() => {
    setDashboardPaymentCardSlice(null);
    setDashboardProductCardSlice(null);
    setDashboardOfferCardSlice(null);
    setDashboardStateCardSlice(null);
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

  const hasActiveDashboardFilters = activeFilterCount > 0;

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

  // Product Dispatch Breakdown (Order items or product names)
  const dispatchedProductsList = useMemo(() => {
    const map = new Map<string, { product: string; units: number }>();
    orders.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach(it => {
          const pName = it.product_name || 'Unspecified';
          const qty = Number(it.quantity) || 1;
          const prev = map.get(pName) || { product: pName, units: 0 };
          map.set(pName, { product: pName, units: prev.units + qty });
        });
      } else {
        const pName = o.product_name || 'Unspecified';
        const qty = Number(o.total_quantity) || 1;
        const prev = map.get(pName) || { product: pName, units: 0 };
        map.set(pName, { product: pName, units: prev.units + qty });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.units - a.units);
  }, [orders]);

  const dispatchedProductUnits = useMemo(() => {
    return dispatchedProductsList.reduce((sum, p) => sum + p.units, 0);
  }, [dispatchedProductsList]);

  // Combo Dispatch Breakdown (Offers / Multi-product combos)
  const dispatchedCombosList = useMemo(() => {
    const map = new Map<string, { combo: string; orders: number; units: number }>();
    orders.forEach(o => {
      const offerName = (o.offer && o.offer !== '-' && o.offer !== 'No Offer') ? o.offer : null;
      const isMultiProd = (o.items && o.items.length > 1) || (o.order_formatted && o.order_formatted.includes('|'));
      
      if (offerName || isMultiProd) {
        const comboKey = offerName || o.order_formatted || o.product_name || 'Multi-Product Combo';
        const prev = map.get(comboKey) || { combo: comboKey, orders: 0, units: 0 };
        map.set(comboKey, { 
          combo: comboKey, 
          orders: prev.orders + 1, 
          units: prev.units + (Number(o.total_quantity) || 1) 
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  }, [orders]);

  const dispatchedComboOrdersCount = useMemo(() => {
    return dispatchedCombosList.reduce((sum, c) => sum + c.orders, 0);
  }, [dispatchedCombosList]);

  // 1. Dashboard Payment Mode Donut
  const dashboardPaymentDonutData = useMemo(() => {
    return [
      { name: 'PREPAID', value: orders.filter(o => o.payment_mode === 'PREPAID').length, color: '#10b981' },
      { name: 'PARTIAL COD', value: orders.filter(o => o.payment_mode === 'PARTIAL COD').length, color: '#a855f7' },
      { name: 'COD', value: orders.filter(o => o.payment_mode === 'COD').length, color: '#f59e0b' },
      { name: 'UNKNOWN', value: orders.filter(o => o.payment_mode === 'UNKNOWN').length, color: '#64748b' }
    ].filter(d => d.value > 0);
  }, [orders]);

  // 2. Dashboard Product Mix Donut
  const dashboardProductDonutData = useMemo(() => {
    return dispatchedProductsList.map((p, i) => ({
      name: p.product,
      value: p.units,
      color: DISTINCT_COLORS[i % DISTINCT_COLORS.length]
    }));
  }, [dispatchedProductsList]);

  // 3. Dashboard Offer / Combo Mix Donut
  const dashboardOfferDonutData = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => {
      const key = (o.offer && o.offer !== '-' && o.offer !== 'No Offer') ? o.offer : 'No Offer';
      map.set(key, (map.get(key) || 0) + 1);
    });
    const list = Array.from(map.entries()).map(([name, count]) => ({ name, value: count }));
    list.sort((a, b) => b.value - a.value);
    return list.map((d, i) => ({ ...d, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] }));
  }, [orders]);

  // 4. Dashboard State Mix Donut
  const dashboardStateDonutData = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => {
      const st = o.state || 'Unspecified';
      map.set(st, (map.get(st) || 0) + 1);
    });
    const list = Array.from(map.entries()).map(([name, count]) => ({ name, value: count }));
    list.sort((a, b) => b.value - a.value);
    return list.map((d, i) => ({ ...d, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] }));
  }, [orders]);

  // Slice-filtered matching order lists for each Donut card
  const dashboardPaymentMatchingOrders = useMemo(() => {
    if (!dashboardPaymentCardSlice) return orders;
    return orders.filter(o => o.payment_mode === dashboardPaymentCardSlice);
  }, [orders, dashboardPaymentCardSlice]);

  const dashboardProductMatchingOrders = useMemo(() => {
    if (!dashboardProductCardSlice) return orders;
    return orders.filter(o => {
      if (o.items && o.items.length > 0) {
        return o.items.some(it => (it.product_name || '') === dashboardProductCardSlice);
      }
      return (o.product_name || '').includes(dashboardProductCardSlice);
    });
  }, [orders, dashboardProductCardSlice]);

  const dashboardOfferMatchingOrders = useMemo(() => {
    if (!dashboardOfferCardSlice) return orders;
    return orders.filter(o => {
      const key = (o.offer && o.offer !== '-' && o.offer !== 'No Offer') ? o.offer : 'No Offer';
      return key === dashboardOfferCardSlice;
    });
  }, [orders, dashboardOfferCardSlice]);

  const dashboardStateMatchingOrders = useMemo(() => {
    if (!dashboardStateCardSlice) return orders;
    return orders.filter(o => (o.state || 'Unspecified') === dashboardStateCardSlice);
  }, [orders, dashboardStateCardSlice]);

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

      {/* ACTIVE FILTER SUMMARY STRIP */}
      {activeFilterCount > 0 && (
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-extrabold text-[10px] uppercase tracking-wider border border-cyan-500/30">
              Filtered View
            </span>
            <span className="text-slate-300 font-mono font-bold text-xs pl-1">
              {totalOrdersCount} {totalOrdersCount === 1 ? 'Order' : 'Orders'} Matching
            </span>
            <span className="text-slate-700">|</span>

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
            className="text-xs text-cyan-400 hover:underline font-bold cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
          >
            <RotateCcw size={13} /> Clear Filters
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

      {/* SECTION 3: DISPATCH SUMMARY */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-cyan-400">
          <Truck size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">Dispatch Summary</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: UNITS DISPATCHED */}
          <div className="p-6 border-t-4 border-t-cyan-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Units Dispatched</span>
            <div className="text-3xl font-bold text-cyan-300">{totalUnits} Units</div>
          </div>

          {/* Card 2: PRODUCTS DISPATCHED (CLICKABLE) */}
          <div 
            onClick={() => setIsProductModalOpen(true)}
            className="p-6 border-t-4 border-t-emerald-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Products Dispatched</span>
              <span className="text-[10px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">View Breakdown →</span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{dispatchedProductUnits} Units</div>
          </div>

          {/* Card 3: COMBOS DISPATCHED (CLICKABLE) */}
          <div 
            onClick={() => setIsComboModalOpen(true)}
            className="p-6 border-t-4 border-t-purple-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Combos Dispatched</span>
              <span className="text-[10px] text-purple-300 opacity-0 group-hover:opacity-100 transition-opacity font-bold">View Breakdown →</span>
            </div>
            <div className="text-3xl font-bold text-purple-300">{dispatchedComboOrdersCount}</div>
          </div>

          {/* Card 4: ORDERS DISPATCHED */}
          <div className="p-6 border-t-4 border-t-blue-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Orders Dispatched</span>
            <div className="text-3xl font-bold text-white">{totalOrdersCount}</div>
          </div>
        </div>
      </div>

      {/* SECTION 4: FILTERED VISUALIZATION — SHOWN ONLY WHEN DASHBOARD FILTERS ARE ACTIVE */}
      {hasActiveDashboardFilters && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-pink-400">
                <PieIcon size={20} />
                <h2 className="text-lg font-bold uppercase tracking-wider">Filtered Visualization</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  FILTERED
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Visual breakdown of the currently applied dashboard filters.
              </p>
            </div>
          </div>

          {totalOrdersCount === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <AlertCircle size={28} className="mx-auto text-slate-600" />
              <p className="text-xs text-slate-400 font-medium">No visualization available because no orders match the selected filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* 1. Payment Mode Donut Card */}
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm font-bold text-white">Payment Mode</span>
                  {dashboardPaymentCardSlice && (
                    <button
                      onClick={() => setDashboardPaymentCardSlice(null)}
                      className="text-[10px] text-cyan-400 hover:underline font-bold cursor-pointer"
                    >
                      Clear Slice ({dashboardPaymentCardSlice})
                    </button>
                  )}
                </div>
                <AnalyticsDonutChart
                  data={dashboardPaymentDonutData}
                  centerValue={totalOrdersCount}
                  centerLabel="ORDERS"
                  height={220}
                  innerRadius={45}
                  outerRadius={75}
                  selectedSliceName={dashboardPaymentCardSlice}
                  onSliceClick={entry => setDashboardPaymentCardSlice(prev => prev === entry.name ? null : entry.name)}
                  emptyMessage="No payment mode data available"
                />
                <CardMatchingOrdersList
                  orders={dashboardPaymentMatchingOrders}
                  title={dashboardPaymentCardSlice ? `Matching Orders (${dashboardPaymentCardSlice})` : 'Matching Orders'}
                />
              </div>

              {/* 2. Product Mix Donut Card */}
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm font-bold text-white">Product Mix</span>
                  {dashboardProductCardSlice && (
                    <button
                      onClick={() => setDashboardProductCardSlice(null)}
                      className="text-[10px] text-cyan-400 hover:underline font-bold cursor-pointer"
                    >
                      Clear Slice ({dashboardProductCardSlice})
                    </button>
                  )}
                </div>
                <AnalyticsDonutChart
                  data={dashboardProductDonutData}
                  centerValue={totalUnits}
                  centerLabel="UNITS"
                  height={220}
                  innerRadius={45}
                  outerRadius={75}
                  selectedSliceName={dashboardProductCardSlice}
                  onSliceClick={entry => setDashboardProductCardSlice(prev => prev === entry.name ? null : entry.name)}
                  emptyMessage="No product mix data available"
                />
                <CardMatchingOrdersList
                  orders={dashboardProductMatchingOrders}
                  title={dashboardProductCardSlice ? `Matching Orders (${dashboardProductCardSlice})` : 'Matching Orders'}
                />
              </div>

              {/* 3. Offer / Combo Mix Donut Card */}
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm font-bold text-white">Offer / Combo Mix</span>
                  {dashboardOfferCardSlice && (
                    <button
                      onClick={() => setDashboardOfferCardSlice(null)}
                      className="text-[10px] text-cyan-400 hover:underline font-bold cursor-pointer"
                    >
                      Clear Slice ({dashboardOfferCardSlice})
                    </button>
                  )}
                </div>
                <AnalyticsDonutChart
                  data={dashboardOfferDonutData}
                  centerValue={totalOrdersCount}
                  centerLabel="ORDERS"
                  height={220}
                  innerRadius={45}
                  outerRadius={75}
                  selectedSliceName={dashboardOfferCardSlice}
                  onSliceClick={entry => setDashboardOfferCardSlice(prev => prev === entry.name ? null : entry.name)}
                  emptyMessage="No offer mix data available"
                />
                <CardMatchingOrdersList
                  orders={dashboardOfferMatchingOrders}
                  title={dashboardOfferCardSlice ? `Matching Orders (${dashboardOfferCardSlice})` : 'Matching Orders'}
                />
              </div>

              {/* 4. State Mix Donut Card */}
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm font-bold text-white">State Mix</span>
                  {dashboardStateCardSlice && (
                    <button
                      onClick={() => setDashboardStateCardSlice(null)}
                      className="text-[10px] text-cyan-400 hover:underline font-bold cursor-pointer"
                    >
                      Clear Slice ({dashboardStateCardSlice})
                    </button>
                  )}
                </div>
                <AnalyticsDonutChart
                  data={dashboardStateDonutData}
                  centerValue={totalOrdersCount}
                  centerLabel="ORDERS"
                  height={220}
                  innerRadius={45}
                  outerRadius={75}
                  selectedSliceName={dashboardStateCardSlice}
                  onSliceClick={entry => setDashboardStateCardSlice(prev => prev === entry.name ? null : entry.name)}
                  emptyMessage="No state mix data available"
                />
                <CardMatchingOrdersList
                  orders={dashboardStateMatchingOrders}
                  title={dashboardStateCardSlice ? `Matching Orders (${dashboardStateCardSlice})` : 'Matching Orders'}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: PRODUCT DISPATCH TODAY & COMBO DISPATCH TODAY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PRODUCT DISPATCH TODAY */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Package size={18} className="text-emerald-400" />
              <span>Product Dispatch Today</span>
            </div>
            <button
              onClick={() => setIsProductModalOpen(true)}
              className="text-xs text-emerald-400 hover:underline font-bold cursor-pointer"
            >
              View All Products ({dispatchedProductsList.length})
            </button>
          </div>

          {dispatchedProductsList.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No products dispatched for selected date/filters.</p>
          ) : (
            <div className="space-y-2">
              {dispatchedProductsList.slice(0, 5).map(p => (
                <div key={p.product} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-white truncate max-w-[240px]">{p.product}</span>
                  <span className="font-mono font-bold text-emerald-400">{p.units} Units</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COMBO DISPATCH TODAY */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Layers size={18} className="text-purple-400" />
              <span>Combo Dispatch Today</span>
            </div>
            <button
              onClick={() => setIsComboModalOpen(true)}
              className="text-xs text-purple-400 hover:underline font-bold cursor-pointer"
            >
              View All Combos ({dispatchedCombosList.length})
            </button>
          </div>

          {dispatchedCombosList.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No combos dispatched for selected date/filters.</p>
          ) : (
            <div className="space-y-2">
              {dispatchedCombosList.slice(0, 5).map(c => (
                <div key={c.combo} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-white truncate max-w-[240px]">{c.combo}</span>
                  <span className="font-mono font-bold text-purple-300">{c.orders} {c.orders === 1 ? 'Order' : 'Orders'}</span>
                </div>
              ))}
            </div>
          )}
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

      {/* DISPATCH BREAKDOWN MODALS */}
      <ProductDispatchModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        products={dispatchedProductsList}
        selectedDate={selectedSalesDate}
      />

      <ComboDispatchModal
        isOpen={isComboModalOpen}
        onClose={() => setIsComboModalOpen(false)}
        combos={dispatchedCombosList}
        selectedDate={selectedSalesDate}
      />
    </div>
  );
};
