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
  formatSalesDateShort,
  shiftDateString,
  calculateDaysBetween,
  shiftDateRange,
  formatDateRangeDisplay,
  formatSectionDateHeader,
  calculateWebsitePaymentSummary
} from './websiteSalesUtils';
import { DashboardFilterDrawer } from './components/DashboardFilterDrawer';
import { ProductDispatchModal } from './components/ProductDispatchModal';
import { ComboDispatchModal } from './components/ComboDispatchModal';
import { DateRangePickerModal, DateRangePreset } from './components/DateRangePickerModal';
import { AnalyticsDonutChart } from './components/AnalyticsDonutChart';
import { CardMatchingOrdersList } from './components/CardMatchingOrdersList';
import { useWebsiteSalesDateRange } from './context/WebsiteSalesDateRangeContext';
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

  const todayStr = getTodayInBusinessTimezone();

  // Shared Website Sales Date Range State
  const { 
    startDate: salesStartDate, 
    endDate: salesEndDate, 
    setDateRange, 
    resetToToday: handleResetToday, 
    shiftRange 
  } = useWebsiteSalesDateRange();

  const [isDateModalOpen, setIsDateModalOpen] = useState<boolean>(false);

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

  // Sync date range if URL parameters are explicitly provided
  useEffect(() => {
    const qFrom = searchParams.get('from');
    const qTo = searchParams.get('to');
    const qDate = searchParams.get('date');

    if (qFrom && qTo && qFrom.match(/^\d{4}-\d{2}-\d{2}$/) && qTo.match(/^\d{4}-\d{2}-\d{2}$/)) {
      if (qFrom !== salesStartDate || qTo !== salesEndDate) {
        setDateRange(qFrom, qTo, 'custom');
      }
    } else if (qDate && qDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      if (qDate !== salesStartDate || qDate !== salesEndDate) {
        setDateRange(qDate, qDate, qDate === todayStr ? 'today' : 'custom');
      }
    }
  }, [searchParams]);

  // Load dataset on date range change or applied filter change
  useEffect(() => {
    setDashboardPaymentCardSlice(null);
    setDashboardProductCardSlice(null);
    setDashboardOfferCardSlice(null);
    setDashboardStateCardSlice(null);
    loadData();
  }, [salesStartDate, salesEndDate, appliedFilters]);

  const loadData = async () => {
    setLoading(true);
    const bList = await websiteSalesService.getUploadBatches();
    setBatches(bList);

    // Fetch full period dataset for dropdown options
    const periodDataset = await websiteSalesService.getConsolidatedOrders({
      startDate: salesStartDate,
      endDate: salesEndDate
    });
    setAllOrders(periodDataset);

    // Filter using selected date range + applied dashboard filters
    const ordList = await websiteSalesService.getConsolidatedOrders({
      ...appliedFilters,
      startDate: salesStartDate,
      endDate: salesEndDate
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

  const updateDateRangeParams = (newStart: string, newEnd: string, preset?: DateRangePreset) => {
    setDateRange(newStart, newEnd, preset);
  };

  const handlePrevRange = () => {
    shiftRange(-1);
  };

  const handleNextRange = () => {
    shiftRange(1);
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

  const isSelectedToday = salesStartDate === todayStr && salesEndDate === todayStr;

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

  // Filtered Date Range Sales Metrics
  const totalOrdersCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const totalUnits = orders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0);
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  // Payment Breakdown for Selected Date Range & Applied Filters
  const paymentSummary = useMemo(() => calculateWebsitePaymentSummary(orders), [orders]);
  const {
    prepaidCount,
    prepaidRevenue,
    partialCodCount,
    partialCodRevenue,
    partialCodRemaining,
    fullCodCount,
    fullCodRevenue,
    fullCodPending,
    totalCodReceivable
  } = paymentSummary;

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
      { name: 'PREPAID', value: prepaidCount, color: '#10b981' },
      { name: 'PARTIAL COD', value: partialCodCount, color: '#a855f7' },
      { name: 'COD', value: fullCodCount, color: '#f59e0b' },
      { name: 'UNKNOWN', value: orders.filter(o => o.payment_mode === 'UNKNOWN').length, color: '#64748b' }
    ].filter(d => d.value > 0);
  }, [prepaidCount, partialCodCount, fullCodCount, orders]);

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

  // Batches for Selected Date Range & Applied Filters
  const dateBatches = batches.filter(b => {
    const bMinDate = b.order_date || (b.uploaded_at ? b.uploaded_at.split('T')[0] : '');
    const bMaxDate = b.order_date || bMinDate;
    if (bMaxDate < salesStartDate || bMinDate > salesEndDate) return false;
    if (appliedFilters.batchIds && appliedFilters.batchIds.length > 0 && !appliedFilters.batchIds.includes(b.id)) return false;
    return true;
  });

  const rawDataRowsCount = dateBatches.reduce((sum, b) => sum + (Number(b.total_source_rows) || 0), 0);
  const duplicatesMergedCount = dateBatches.reduce((sum, b) => sum + (Number(b.duplicate_order_count) || 0), 0);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300">
      {/* HEADER & DATE RANGE SELECTOR BAR WITH FILTER DRAWER BUTTON */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Website Sales Dashboard</h1>
            {salesStartDate === todayStr && salesEndDate === todayStr ? (
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                Today
              </span>
            ) : salesStartDate === salesEndDate ? (
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider">
                Selected Date
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                Selected Range
              </span>
            )}
          </div>
          <p className="text-cyan-400 font-semibold text-sm mt-1">
            {formatDateRangeDisplay(salesStartDate, salesEndDate)}
          </p>
        </div>

        {/* COMPACT DATE CONTROLS & FILTER DRAWER BUTTON */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 border border-slate-800 p-2 rounded-2xl">
          {/* Previous Range / Day */}
          <button
            type="button"
            onClick={handlePrevRange}
            title="Previous Range / Day"
            aria-label="Previous Range / Day"
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center border border-slate-800"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Date Range Picker Trigger Button */}
          <button
            type="button"
            onClick={() => setIsDateModalOpen(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-cyan-400 font-mono font-bold cursor-pointer flex items-center gap-2 transition-colors"
          >
            <Calendar size={15} className="text-cyan-400 shrink-0" />
            <span>{formatDateRangeDisplay(salesStartDate, salesEndDate)}</span>
          </button>

          {/* Next Range / Day */}
          <button
            type="button"
            onClick={handleNextRange}
            disabled={salesEndDate >= todayStr}
            title="Next Range / Day"
            aria-label="Next Range / Day"
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

      {/* ACTIVE DASHBOARD FILTER CHIPS BAR */}
      {hasActiveDashboardFilters && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs shadow-md animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-cyan-300 uppercase tracking-wider font-mono flex items-center gap-1.5 pr-1">
              <Filter size={13} /> FILTERED ({orders.length} ORDERS):
            </span>

            {appliedFilters.orderIdSearch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px]">
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px]">
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
              <span key={pm} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px]">
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

            {appliedFilters.orderTypes?.map(ot => (
              <span key={ot} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[11px]">
                Type: {ot}
                <button onClick={() => handleRemoveChip('orderTypes', ot)} className="hover:text-white cursor-pointer"><X size={12} /></button>
              </span>
            ))}
          </div>

          <button
            onClick={handleResetDrawerFilters}
            className="text-xs text-cyan-400 hover:underline font-bold cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
          >
            <RotateCcw size={13} /> Reset Filters
          </button>
        </div>
      )}

      {/* SECTION 1: SELECTED DATE SALES SUMMARY */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-blue-400">
          <TrendingUp size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">
            {formatSectionDateHeader('Sales Summary', salesStartDate, salesEndDate)}
          </h2>
        </div>

        {totalOrdersCount === 0 && !loading ? (
          <div className="p-10 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <AlertCircle size={36} className="text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No website orders match the selected date range and filters.</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Try editing your filter criteria or choosing a different date range using the date controls above.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsFilterDrawerOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <SlidersHorizontal size={14} /> Adjust Filters
              </button>
              <button
                onClick={handleResetToday}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Clock size={14} /> View Today
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 border-t-4 border-t-blue-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Total Orders</span>
              <div className="text-2xl font-bold text-white">{totalOrdersCount}</div>
            </div>

            <div className="p-5 border-t-4 border-t-emerald-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Total Revenue</span>
              <div className="text-2xl font-bold text-emerald-400">₹{totalRevenue.toLocaleString()}</div>
            </div>

            <div className="p-5 border-t-4 border-t-cyan-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Total Units</span>
              <div className="text-2xl font-bold text-cyan-400">{totalUnits}</div>
            </div>

            <div className="p-5 border-t-4 border-t-purple-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Average Order Value</span>
              <div className="text-2xl font-bold text-purple-400">₹{avgOrderValue.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: PAYMENT & RECEIVABLE BREAKDOWN */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-purple-400">
          <CreditCard size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">Payment & Receivable Breakdown</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Prepaid Orders */}
          <div className="p-5 border-t-4 border-t-emerald-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Prepaid Orders</span>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(90px,0.8fr)_1px_minmax(0,1.5fr)] items-stretch gap-4">
                <div className="flex flex-col justify-center">
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-400 leading-none">{prepaidCount.toLocaleString()}</div>
                  <span className="text-[11px] text-slate-500 mt-1 font-semibold uppercase tracking-wider">Orders</span>
                </div>
                <div className="hidden sm:block w-px bg-slate-800/80 self-stretch my-1" />
                <div className="flex flex-col justify-center sm:pl-1">
                  <div className="text-[17px] sm:text-[18px] font-bold text-white leading-tight">₹{prepaidRevenue.toLocaleString()}</div>
                  <span className="text-[11px] text-slate-400 block font-medium">Prepaid Order Value</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-1">
              <span className="text-[11px] text-slate-500 block leading-tight">Full payment received</span>
            </div>
          </div>

          {/* Partial COD Orders */}
          <div className="p-5 border-t-4 border-t-purple-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Partial COD Orders</span>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(90px,0.8fr)_1px_minmax(0,1.5fr)] items-stretch gap-4">
                <div className="flex flex-col justify-center">
                  <div className="text-2xl sm:text-3xl font-bold text-purple-400 leading-none">{partialCodCount.toLocaleString()}</div>
                  <span className="text-[11px] text-slate-500 mt-1 font-semibold uppercase tracking-wider">Orders</span>
                </div>
                <div className="hidden sm:block w-px bg-slate-800/80 self-stretch my-1" />
                <div className="flex flex-col justify-center sm:pl-1">
                  <div className="text-[17px] sm:text-[18px] font-bold text-white leading-tight">₹{partialCodRevenue.toLocaleString()}</div>
                  <span className="text-[11px] text-slate-400 block font-medium">Partial COD Order Value</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-1">
              <div className="text-[14px] sm:text-[15px] font-bold text-purple-400/90 leading-tight">₹{partialCodRemaining.toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wider mt-0.5">remaining COD</span>
            </div>
          </div>

          {/* Full COD Orders */}
          <div className="p-5 border-t-4 border-t-amber-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Full COD Orders</span>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(90px,0.8fr)_1px_minmax(0,1.5fr)] items-stretch gap-4">
                <div className="flex flex-col justify-center">
                  <div className="text-2xl sm:text-3xl font-bold text-amber-400 leading-none">{fullCodCount.toLocaleString()}</div>
                  <span className="text-[11px] text-slate-500 mt-1 font-semibold uppercase tracking-wider">Orders</span>
                </div>
                <div className="hidden sm:block w-px bg-slate-800/80 self-stretch my-1" />
                <div className="flex flex-col justify-center sm:pl-1">
                  <div className="text-[17px] sm:text-[18px] font-bold text-white leading-tight">₹{fullCodRevenue.toLocaleString()}</div>
                  <span className="text-[11px] text-slate-400 block font-medium">Full COD Order Value</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-1">
              <div className="text-[14px] sm:text-[15px] font-bold text-amber-400/90 leading-tight">₹{fullCodPending.toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wider mt-0.5">COD Pending</span>
            </div>
          </div>

          {/* Total COD Receivable */}
          <div className="p-5 border-t-4 border-t-pink-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Total COD Receivable</span>
              <div className="text-2xl sm:text-3xl font-bold text-pink-400 mt-3">₹{totalCodReceivable.toLocaleString()}</div>
            </div>
            <div className="mt-4 pt-1">
              <span className="text-[11px] text-slate-500 block leading-tight">Partial + Full COD pending</span>
            </div>
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
          <div className="p-5 border-t-4 border-t-cyan-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Units Dispatched</span>
            <div className="text-2xl font-bold text-cyan-400">{dispatchedProductUnits}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Total items dispatched</span>
          </div>

          <div className="p-5 border-t-4 border-t-emerald-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Products Dispatched</span>
            <div className="text-2xl font-bold text-emerald-400">{dispatchedProductsList.length}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Distinct products</span>
          </div>

          <div className="p-5 border-t-4 border-t-purple-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Combos Dispatched</span>
            <div className="text-2xl font-bold text-purple-400">{dispatchedComboOrdersCount}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Combo / offer orders</span>
          </div>

          <div className="p-5 border-t-4 border-t-blue-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Orders Dispatched</span>
            <div className="text-2xl font-bold text-white">{totalOrdersCount}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Unique order dispatches</span>
          </div>
        </div>
      </div>

      {/* FILTERED VISUALIZATION (SHOWN ONLY WHEN 1 OR MORE DASHBOARD FILTERS ARE ACTIVE) */}
      {hasActiveDashboardFilters && (
        <div className="space-y-6 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-400">
              <PieIcon size={20} />
              <h2 className="text-lg font-bold uppercase tracking-wider">Filtered Visualization</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Dataset: {orders.length} orders
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Payment Mode Filtered Donut */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Payment Mode</h3>
                  {dashboardPaymentCardSlice && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                      Slice: {dashboardPaymentCardSlice}
                    </span>
                  )}
                </div>
                {dashboardPaymentCardSlice && (
                  <button
                    onClick={() => setDashboardPaymentCardSlice(null)}
                    className="text-xs text-cyan-400 hover:underline cursor-pointer font-semibold"
                  >
                    Clear Slice
                  </button>
                )}
              </div>

              {dashboardPaymentDonutData.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No payment data for active filter.</div>
              ) : (
                <AnalyticsDonutChart
                  data={dashboardPaymentDonutData}
                  selectedSliceName={dashboardPaymentCardSlice}
                  onSliceClick={entry => {
                    const sliceName = String(entry.name || '');
                    setDashboardPaymentCardSlice(prev => prev === sliceName ? null : sliceName);
                  }}
                />
              )}

              <CardMatchingOrdersList
                orders={dashboardPaymentMatchingOrders}
                title="Matching Orders"
              />
            </div>

            {/* 2. Product Mix Filtered Donut */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Product Mix</h3>
                  {dashboardProductCardSlice && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                      Slice: {dashboardProductCardSlice}
                    </span>
                  )}
                </div>
                {dashboardProductCardSlice && (
                  <button
                    onClick={() => setDashboardProductCardSlice(null)}
                    className="text-xs text-cyan-400 hover:underline cursor-pointer font-semibold"
                  >
                    Clear Slice
                  </button>
                )}
              </div>

              {dashboardProductDonutData.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No product data for active filter.</div>
              ) : (
                <AnalyticsDonutChart
                  data={dashboardProductDonutData}
                  selectedSliceName={dashboardProductCardSlice}
                  onSliceClick={entry => {
                    const sliceName = String(entry.name || '');
                    setDashboardProductCardSlice(prev => prev === sliceName ? null : sliceName);
                  }}
                />
              )}

              <CardMatchingOrdersList
                orders={dashboardProductMatchingOrders}
                title="Matching Orders"
              />
            </div>

            {/* 3. Offer / Combo Mix Filtered Donut */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Offer / Combo Mix</h3>
                  {dashboardOfferCardSlice && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                      Slice: {dashboardOfferCardSlice}
                    </span>
                  )}
                </div>
                {dashboardOfferCardSlice && (
                  <button
                    onClick={() => setDashboardOfferCardSlice(null)}
                    className="text-xs text-cyan-400 hover:underline cursor-pointer font-semibold"
                  >
                    Clear Slice
                  </button>
                )}
              </div>

              {dashboardOfferDonutData.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No offer data for active filter.</div>
              ) : (
                <AnalyticsDonutChart
                  data={dashboardOfferDonutData}
                  selectedSliceName={dashboardOfferCardSlice}
                  onSliceClick={entry => {
                    const sliceName = String(entry.name || '');
                    setDashboardOfferCardSlice(prev => prev === sliceName ? null : sliceName);
                  }}
                />
              )}

              <CardMatchingOrdersList
                orders={dashboardOfferMatchingOrders}
                title="Matching Orders"
              />
            </div>

            {/* 4. State Mix Filtered Donut */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">State Mix</h3>
                  {dashboardStateCardSlice && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                      Slice: {dashboardStateCardSlice}
                    </span>
                  )}
                </div>
                {dashboardStateCardSlice && (
                  <button
                    onClick={() => setDashboardStateCardSlice(null)}
                    className="text-xs text-cyan-400 hover:underline cursor-pointer font-semibold"
                  >
                    Clear Slice
                  </button>
                )}
              </div>

              {dashboardStateDonutData.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No state data for active filter.</div>
              ) : (
                <AnalyticsDonutChart
                  data={dashboardStateDonutData}
                  selectedSliceName={dashboardStateCardSlice}
                  onSliceClick={entry => {
                    const sliceName = String(entry.name || '');
                    setDashboardStateCardSlice(prev => prev === sliceName ? null : sliceName);
                  }}
                />
              )}

              <CardMatchingOrdersList
                orders={dashboardStateMatchingOrders}
                title="Matching Orders"
              />
            </div>
          </div>
        </div>
      )}

      {/* LOWER DISPATCH BREAKDOWN CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PRODUCT-WISE DISPATCH CARD */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <Package size={18} />
              <h3 className="text-base font-extrabold text-white">Product-wise Dispatch</h3>
            </div>
            <button
              onClick={() => setIsProductModalOpen(true)}
              className="text-xs text-cyan-400 hover:underline font-bold cursor-pointer"
            >
              View Full Breakdown
            </button>
          </div>

          <div className="space-y-3">
            {dispatchedProductsList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No product dispatches for the selected date/filters.</div>
            ) : (
              dispatchedProductsList.slice(0, 5).map(p => (
                <div key={p.product} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs font-semibold text-slate-200 truncate max-w-[240px]">{p.product}</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">{p.units} units</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COMBO-WISE DISPATCH CARD */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-purple-400">
              <Layers size={18} />
              <h3 className="text-base font-extrabold text-white">Combo-wise Dispatch</h3>
            </div>
            <button
              onClick={() => setIsComboModalOpen(true)}
              className="text-xs text-cyan-400 hover:underline font-bold cursor-pointer"
            >
              View Full Breakdown
            </button>
          </div>

          <div className="space-y-3">
            {dispatchedCombosList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No combo dispatches for the selected date/filters.</div>
            ) : (
              dispatchedCombosList.slice(0, 5).map(c => (
                <div key={c.combo} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs font-semibold text-slate-200 truncate max-w-[240px]">{c.combo}</span>
                  <span className="text-xs font-bold text-purple-400 font-mono">{c.orders} orders ({c.units} units)</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ORDER UPLOAD BATCHES AUDIT SUMMARY */}
      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              {formatSectionDateHeader('Order Upload Batches', salesStartDate, salesEndDate)}
            </h3>
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
          <div className="p-8 text-center text-slate-400 text-sm">
            No upload batches recorded for {formatDateRangeDisplay(salesStartDate, salesEndDate)}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-400">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr className="border-b border-slate-800">
                  <th scope="col" className="px-4 py-3">File Name</th>
                  <th scope="col" className="px-4 py-3">Upload Time</th>
                  <th scope="col" className="px-4 py-3">Order Date Range</th>
                  <th scope="col" className="px-4 py-3 text-right">Source Rows</th>
                  <th scope="col" className="px-4 py-3 text-right">Unique Orders</th>
                  <th scope="col" className="px-4 py-3 text-right">Duplicates Merged</th>
                  <th scope="col" className="px-4 py-3 text-center">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {dateBatches.map((b) => (
                  <tr key={b.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {b.file_name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs font-mono">
                      {new Date(b.uploaded_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs font-mono">
                      {b.order_date_range || b.order_date}
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-300 font-mono">{b.total_source_rows}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-cyan-400 font-mono">{b.total_unique_orders}</td>
                    <td className="px-4 py-3.5 text-right text-amber-400/90 font-mono">{b.duplicate_order_count}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
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

      {/* FILTER DRAWER */}
      <DashboardFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        selectedDate={salesStartDate}
        startDate={salesStartDate}
        endDate={salesEndDate}
        activePeriodDisplay={formatDateRangeDisplay(salesStartDate, salesEndDate)}
        allOrders={allOrders}
        batches={batches}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        onApply={handleApplyDrawerFilters}
        onResetAll={handleResetDrawerFilters}
      />

      {/* PRODUCT DISPATCH MODAL */}
      <ProductDispatchModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        products={dispatchedProductsList}
        selectedDate={formatDateRangeDisplay(salesStartDate, salesEndDate)}
      />

      {/* COMBO DISPATCH MODAL */}
      <ComboDispatchModal
        isOpen={isComboModalOpen}
        onClose={() => setIsComboModalOpen(false)}
        combos={dispatchedCombosList}
        selectedDate={formatDateRangeDisplay(salesStartDate, salesEndDate)}
      />

      {/* DATE RANGE PICKER MODAL */}
      <DateRangePickerModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        startDate={salesStartDate}
        endDate={salesEndDate}
        onApply={(start, end) => updateDateRangeParams(start, end)}
      />
    </div>
  );
};
