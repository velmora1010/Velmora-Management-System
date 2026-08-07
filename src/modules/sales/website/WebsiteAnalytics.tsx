import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  BarChart3, 
  MapPin, 
  CreditCard, 
  Tag, 
  Filter, 
  RotateCcw,
  Building2,
  Package,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  PieChart as PieIcon,
  DollarSign,
  LayoutGrid,
  Check,
  CalendarRange,
  X
} from 'lucide-react';
import type { WebsiteConsolidatedOrder, WebsiteUploadBatch, WebsiteOrderItem } from './types';
import { websiteSalesService } from './websiteSalesService';
import { MultiSelectDropdown, OptionItem } from './components/MultiSelectDropdown';
import { AnalyticsSegmentedControl, SegmentOption } from './components/AnalyticsSegmentedControl';
import { AnalyticsDonutChart } from './components/AnalyticsDonutChart';
import { 
  getTodayInBusinessTimezone, 
  formatSalesDateDisplay, 
  formatSalesDateShort,
  shiftDateString 
} from './websiteSalesUtils';
import toast from 'react-hot-toast';

export interface MultiSelectFilterState {
  batchIds: string[];
  states: string[];
  cities: string[];
  pincodes: string[];
  paymentModes: string[];
  offers: string[];
  products: string[];
  orderTypes: string[];
  dateRangePreset: string;
  selectedDate: string;
  startDate: string;
  endDate: string;
}

const DEFAULT_FILTERS: MultiSelectFilterState = {
  batchIds: [],
  states: [],
  cities: [],
  pincodes: [],
  paymentModes: [],
  offers: [],
  products: [],
  orderTypes: [],
  dateRangePreset: 'today',
  selectedDate: getTodayInBusinessTimezone(),
  startDate: getTodayInBusinessTimezone(),
  endDate: getTodayInBusinessTimezone()
};

const ORDER_TYPE_OPTIONS = [
  'Single Product Order',
  'Multi Product Order',
  'Single Unit Order',
  'Multi Unit Order',
  'One Product, Multiple Quantity',
  'Multiple Products, Multiple Quantity'
];

export const ORDER_VALUE_BUCKETS = [
  { label: 'Below ₹500', min: 0, max: 499.99 },
  { label: '₹500–₹749', min: 500, max: 749.99 },
  { label: '₹750–₹999', min: 750, max: 999.99 },
  { label: '₹1,000–₹1,299', min: 1000, max: 1299.99 },
  { label: '₹1,300–₹1,499', min: 1300, max: 1499.99 },
  { label: '₹1,500 and above', min: 1500, max: Infinity }
];

const ANALYTICS_VIEW_OPTIONS = [
  { id: 'analytics-overview', label: 'Overview' },
  { id: 'analytics-payment-mode', label: 'Payment Mode Breakdown' },
  { id: 'analytics-revenue-mix', label: 'Revenue Mix' },
  { id: 'analytics-state', label: 'State-wise Sales' },
  { id: 'analytics-city', label: 'City-wise Sales' },
  { id: 'analytics-pincode', label: 'Pincode Performance' },
  { id: 'analytics-product', label: 'Product Performance' },
  { id: 'analytics-offer', label: 'Offer Performance' },
  { id: 'analytics-order-value', label: 'Order Value Distribution' },
  { id: 'analytics-order-composition', label: 'Order Composition' },
  { id: 'analytics-cod-receivable', label: 'COD Receivable Overview' }
];

const DATE_PRESET_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7days', label: 'Last 7 Days' },
  { id: '30days', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'prev_month', label: 'Previous Month' },
  { id: 'custom_date', label: 'Custom Date' },
  { id: 'custom_range', label: 'Custom Date Range' }
];

const DISTINCT_COLORS = [
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#64748b'  // Others (Slate)
];

const REVENUE_MIX_SEGMENTS: SegmentOption<'Payment Mode' | 'State' | 'Product' | 'Offer' | 'Order Value Range'>[] = [
  { label: 'Payment', value: 'Payment Mode' },
  { label: 'State', value: 'State' },
  { label: 'Product', value: 'Product' },
  { label: 'Offer', value: 'Offer' },
  { label: 'Order Value', value: 'Order Value Range' }
];

const ORDERS_REV_UNITS_SEGMENTS: SegmentOption<'orders' | 'revenue' | 'units'>[] = [
  { label: 'Orders', value: 'orders' },
  { label: 'Revenue', value: 'revenue' },
  { label: 'Units', value: 'units' }
];

const UNITS_ORDERS_REV_SEGMENTS: SegmentOption<'units' | 'orders' | 'revenue'>[] = [
  { label: 'Units', value: 'units' },
  { label: 'Orders', value: 'orders' },
  { label: 'Revenue', value: 'revenue' }
];

const ORDERS_REV_SEGMENTS: SegmentOption<'orders' | 'revenue'>[] = [
  { label: 'Orders', value: 'orders' },
  { label: 'Revenue', value: 'revenue' }
];

export const WebsiteAnalytics: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allOrders, setAllOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [applying, setApplying] = useState<boolean>(false);

  // Navigation Dropdown State
  const [selectedViewId, setSelectedViewId] = useState<string>('analytics-overview');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState<boolean>(false);
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  // Date Range Dropdown State
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState<boolean>(false);
  const [showCustomRangePanel, setShowCustomRangePanel] = useState<boolean>(false);
  const [showCustomDateInput, setShowCustomDateInput] = useState<boolean>(false);
  const [customFromDate, setCustomFromDate] = useState<string>(getTodayInBusinessTimezone());
  const [customToDate, setCustomToDate] = useState<string>(getTodayInBusinessTimezone());
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Filter States
  const [draftFilters, setDraftFilters] = useState<MultiSelectFilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<MultiSelectFilterState>(DEFAULT_FILTERS);

  // Metric Switcher States
  const [revenueMixGroup, setRevenueMixGroup] = useState<'Payment Mode' | 'State' | 'Product' | 'Offer' | 'Order Value Range'>('Order Value Range');
  const [stateMetric, setStateMetric] = useState<'orders' | 'revenue' | 'units'>('orders');
  const [cityMetric, setCityMetric] = useState<'orders' | 'revenue' | 'units'>('orders');
  const [pincodeMetric, setPincodeMetric] = useState<'orders' | 'revenue' | 'units'>('orders');
  const [productMetric, setProductMetric] = useState<'units' | 'orders' | 'revenue'>('units');
  const [offerMetric, setOfferMetric] = useState<'orders' | 'revenue' | 'units'>('orders');
  const [orderValueMetric, setOrderValueMetric] = useState<'orders' | 'revenue'>('orders');

  // Chart Drill-down filters
  const [drillDownPaymentMode, setDrillDownPaymentMode] = useState<string | null>(null);
  const [drillDownState, setDrillDownState] = useState<string | null>(null);
  const [drillDownCity, setDrillDownCity] = useState<string | null>(null);

  // Collapsible Secondary Tables
  const [showStateTable, setShowStateTable] = useState<boolean>(false);

  useEffect(() => {
    loadData();
    // Initialize date from URL query parameters if present
    const period = searchParams.get('period');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (from && to && from.match(/^\d{4}-\d{2}-\d{2}$/) && to.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const presetKey = from === to ? 'custom_date' : 'custom_range';
      const initialDateState = {
        ...DEFAULT_FILTERS,
        dateRangePreset: presetKey,
        selectedDate: from,
        startDate: from,
        endDate: to
      };
      setDraftFilters(initialDateState);
      setAppliedFilters(initialDateState);
      setCustomFromDate(from);
      setCustomToDate(to);
    } else if (period) {
      applyPresetDate(period, true);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setIsDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const bList = await websiteSalesService.getUploadBatches();
    setBatches(bList);

    const orders = await websiteSalesService.getConsolidatedOrders();
    setAllOrders(orders);
    setLoading(false);
  };

  const handleSelectAnalyticsView = (sectionId: string) => {
    setSelectedViewId(sectionId);
    setIsViewDropdownOpen(false);

    const targetEl = document.getElementById(sectionId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedSectionId(sectionId);
      setTimeout(() => {
        setHighlightedSectionId(null);
      }, 2000);
    }
  };

  // Centralized Date Preset Calculation Function
  const applyPresetDate = (preset: string, updateUrl: boolean = true) => {
    const today = getTodayInBusinessTimezone();
    let start = today;
    let end = today;

    if (preset === 'today') {
      start = today;
      end = today;
    } else if (preset === 'yesterday') {
      start = shiftDateString(today, -1);
      end = shiftDateString(today, -1);
    } else if (preset === '7days') {
      start = shiftDateString(today, -6);
      end = today;
    } else if (preset === '30days') {
      start = shiftDateString(today, -29);
      end = today;
    } else if (preset === 'this_month') {
      const parts = today.split('-');
      start = `${parts[0]}-${parts[1]}-01`;
      end = today;
    } else if (preset === 'prev_month') {
      const parts = today.split('-');
      let year = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      const mStr = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      start = `${year}-${mStr}-01`;
      end = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;
    }

    const nextFilterState = {
      dateRangePreset: preset,
      selectedDate: start,
      startDate: start,
      endDate: end
    };

    setDraftFilters(prev => ({ ...prev, ...nextFilterState }));
    setAppliedFilters(prev => ({ ...prev, ...nextFilterState }));

    if (updateUrl) {
      if (preset === 'today') {
        searchParams.delete('period');
        searchParams.delete('from');
        searchParams.delete('to');
      } else {
        searchParams.set('period', preset);
        searchParams.delete('from');
        searchParams.delete('to');
      }
      setSearchParams(searchParams, { replace: true });
    }

    setShowCustomRangePanel(false);
    setShowCustomDateInput(false);
    setIsDateDropdownOpen(false);
  };

  const handleSelectDatePresetOption = (presetId: string) => {
    if (presetId === 'custom_date') {
      setShowCustomDateInput(true);
      setShowCustomRangePanel(false);
      setIsDateDropdownOpen(false);
    } else if (presetId === 'custom_range') {
      setShowCustomRangePanel(true);
      setShowCustomDateInput(false);
      setIsDateDropdownOpen(false);
    } else {
      applyPresetDate(presetId);
    }
  };

  const handleApplyCustomRange = () => {
    if (customFromDate > customToDate) {
      toast.error('From Date cannot be after To Date');
      return;
    }

    const isSingle = customFromDate === customToDate;
    const presetKey = isSingle ? 'custom_date' : 'custom_range';

    const nextFilterState = {
      dateRangePreset: presetKey,
      selectedDate: customFromDate,
      startDate: customFromDate,
      endDate: customToDate
    };

    setDraftFilters(prev => ({ ...prev, ...nextFilterState }));
    setAppliedFilters(prev => ({ ...prev, ...nextFilterState }));

    searchParams.delete('period');
    searchParams.set('from', customFromDate);
    searchParams.set('to', customToDate);
    setSearchParams(searchParams, { replace: true });

    setShowCustomRangePanel(false);
    setShowCustomDateInput(false);
    toast.success('Custom date range applied!');
  };

  const getResolvedDateLabel = () => {
    const preset = appliedFilters.dateRangePreset;
    const start = appliedFilters.startDate;
    const end = appliedFilters.endDate;

    if (preset === 'today') return 'Today';
    if (preset === 'yesterday') return 'Yesterday';
    if (preset === '7days') return 'Last 7 Days';
    if (preset === '30days') return 'Last 30 Days';
    if (preset === 'this_month') return 'This Month';
    if (preset === 'prev_month') return 'Previous Month';
    if (start === end) return formatSalesDateShort(start);
    return `${formatSalesDateShort(start)} – ${formatSalesDateShort(end)}`;
  };

  // Filter Dropdown Options
  const batchOptions: OptionItem[] = useMemo(() => batches.map(b => ({ label: b.file_name, value: b.id })), [batches]);
  const stateOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => set.add((o.state || 'Unspecified').trim()));
    return Array.from(set).sort().map(s => ({ label: s, value: s }));
  }, [allOrders]);
  const cityOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => {
      if (draftFilters.states.length === 0 || draftFilters.states.includes(o.state)) {
        set.add((o.city || 'Unspecified').trim());
      }
    });
    return Array.from(set).sort().map(c => ({ label: c, value: c }));
  }, [allOrders, draftFilters.states]);
  const pincodeOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => {
      const pin = String(o.pincode || '').trim();
      if (pin && pin !== '-') set.add(pin);
    });
    return Array.from(set).sort().map(p => ({ label: p, value: p }));
  }, [allOrders]);

  const paymentModeOptions: OptionItem[] = [
    { label: 'PREPAID', value: 'PREPAID' },
    { label: 'PARTIAL COD', value: 'PARTIAL COD' },
    { label: 'COD', value: 'COD' },
    { label: 'UNKNOWN', value: 'UNKNOWN' }
  ];

  const offerOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => set.add((o.offer || 'No Offer').trim()));
    return Array.from(set).sort().map(off => ({ label: off, value: off }));
  }, [allOrders]);

  const productOptions: OptionItem[] = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach((it: WebsiteOrderItem) => set.add(it.product_name.trim()));
      } else if (o.product_name) {
        set.add(o.product_name.trim());
      }
    });
    return Array.from(set).sort().map(p => ({ label: p, value: p }));
  }, [allOrders]);

  const orderTypeOptions: OptionItem[] = ORDER_TYPE_OPTIONS.map(ot => ({ label: ot, value: ot }));

  const handleApplyFilters = () => {
    setApplying(true);
    setAppliedFilters(draftFilters);
    setTimeout(() => {
      setApplying(false);
      toast.success('Analytics updated!');
    }, 200);
  };

  const handleResetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setDrillDownPaymentMode(null);
    setDrillDownState(null);
    setDrillDownCity(null);
    toast.success('Filters reset to Today defaults');
  };

  // FILTERING ENGINE
  const filteredOrders = useMemo(() => {
    return allOrders.filter(o => {
      const orderDateStr = o.order_date || getTodayInBusinessTimezone();
      if (appliedFilters.startDate && appliedFilters.endDate) {
        if (orderDateStr < appliedFilters.startDate || orderDateStr > appliedFilters.endDate) {
          return false;
        }
      }

      if (drillDownPaymentMode && o.payment_mode !== drillDownPaymentMode) return false;
      if (drillDownState && o.state !== drillDownState) return false;
      if (drillDownCity && o.city !== drillDownCity) return false;

      if (appliedFilters.batchIds.length > 0 && !appliedFilters.batchIds.includes(o.upload_batch_id)) return false;
      if (appliedFilters.states.length > 0 && !appliedFilters.states.includes(o.state)) return false;
      if (appliedFilters.cities.length > 0 && !appliedFilters.cities.includes(o.city)) return false;
      if (appliedFilters.pincodes.length > 0 && !appliedFilters.pincodes.includes(o.pincode)) return false;
      if (appliedFilters.paymentModes.length > 0 && !appliedFilters.paymentModes.includes(o.payment_mode)) return false;
      if (appliedFilters.offers.length > 0 && !appliedFilters.offers.includes(o.offer)) return false;

      if (appliedFilters.products.length > 0) {
        const hasProduct = o.items
          ? o.items.some((it: WebsiteOrderItem) => appliedFilters.products.includes(it.product_name.trim()))
          : appliedFilters.products.some(p => o.product_name.includes(p));
        if (!hasProduct) return false;
      }

      if (appliedFilters.orderTypes.length > 0) {
        const itemCount = o.items ? o.items.length : 1;
        const totalQty = o.total_quantity || 1;

        let matched = false;
        for (const ot of appliedFilters.orderTypes) {
          if (ot === 'Single Product Order' && itemCount === 1) matched = true;
          if (ot === 'Multi Product Order' && itemCount > 1) matched = true;
          if (ot === 'Single Unit Order' && totalQty === 1) matched = true;
          if (ot === 'Multi Unit Order' && totalQty > 1) matched = true;
          if (ot === 'One Product, Multiple Quantity' && itemCount === 1 && totalQty > 1) matched = true;
          if (ot === 'Multiple Products, Multiple Quantity' && itemCount > 1 && totalQty > 1) matched = true;
        }
        if (!matched) return false;
      }

      return true;
    });
  }, [allOrders, appliedFilters, drillDownPaymentMode, drillDownState, drillDownCity]);

  // SUMMARY METRICS COMPUTATION
  const totalOrdersCount = filteredOrders.length;
  const totalRevenue = useMemo(() => filteredOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0), [filteredOrders]);
  const totalUnits = useMemo(() => filteredOrders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0), [filteredOrders]);
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  const prepaidOrders = useMemo(() => filteredOrders.filter(o => o.payment_mode === 'PREPAID'), [filteredOrders]);
  const partialCodOrders = useMemo(() => filteredOrders.filter(o => o.payment_mode === 'PARTIAL COD'), [filteredOrders]);
  const codOrders = useMemo(() => filteredOrders.filter(o => o.payment_mode === 'COD'), [filteredOrders]);
  const unknownPaymentOrders = useMemo(() => filteredOrders.filter(o => o.payment_mode === 'UNKNOWN'), [filteredOrders]);

  const prepaidRevenue = useMemo(() => prepaidOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0), [prepaidOrders]);
  const partialCodValue = useMemo(() => partialCodOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0), [partialCodOrders]);
  const partialCodAdvance = useMemo(() => partialCodOrders.reduce((sum, o) => sum + (Number(o.advance_paid) || 0), 0), [partialCodOrders]);
  const partialCodRemaining = useMemo(() => partialCodOrders.reduce((sum, o) => sum + (Number(o.remaining_payable) || 0), 0), [partialCodOrders]);

  const fullCodReceivable = useMemo(() => codOrders.reduce((sum, o) => sum + (Number(o.remaining_payable ?? o.price) || 0), 0), [codOrders]);
  const totalCodReceivable = partialCodRemaining + fullCodReceivable;

  // 1. PAYMENT MODE DONUT DATA
  const paymentDonutData = useMemo(() => {
    return [
      { name: 'PREPAID', value: prepaidOrders.length, revenue: prepaidRevenue, color: '#10b981' },
      { name: 'PARTIAL COD', value: partialCodOrders.length, revenue: partialCodValue, color: '#a855f7' },
      { name: 'COD', value: codOrders.length, revenue: fullCodReceivable, color: '#f59e0b' },
      { name: 'UNKNOWN', value: unknownPaymentOrders.length, revenue: 0, color: '#64748b' }
    ].filter(d => d.value > 0);
  }, [prepaidOrders, partialCodOrders, codOrders, unknownPaymentOrders, prepaidRevenue, partialCodValue, fullCodReceivable]);

  // 2. REVENUE MIX PIE / DONUT DATA
  const revenueMixData = useMemo(() => {
    const map = new Map<string, number>();

    filteredOrders.forEach(o => {
      let key = 'Other';
      if (revenueMixGroup === 'Payment Mode') key = o.payment_mode;
      else if (revenueMixGroup === 'State') key = o.state || 'Unspecified';
      else if (revenueMixGroup === 'Product') key = o.product_name || 'Unspecified';
      else if (revenueMixGroup === 'Offer') key = (o.offer && o.offer !== '-') ? o.offer : 'No Offer';
      else if (revenueMixGroup === 'Order Value Range') {
        const p = Number(o.price) || 0;
        if (p < 500) key = 'Below ₹500';
        else if (p < 750) key = '₹500–₹749';
        else if (p < 1000) key = '₹750–₹999';
        else if (p < 1300) key = '₹1,000–₹1,299';
        else if (p < 1500) key = '₹1,300–₹1,499';
        else key = '₹1,500 and above';
      }

      map.set(key, (map.get(key) || 0) + (Number(o.price) || 0));
    });

    const sorted = Array.from(map.entries())
      .map(([name, rev]) => ({ name, value: rev }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 5) {
      return sorted.map((d, i) => ({ ...d, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] }));
    }

    const top5 = sorted.slice(0, 5);
    const othersRev = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
    return [
      ...top5.map((d, i) => ({ ...d, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] })),
      { name: 'Others', value: othersRev, color: '#64748b' }
    ];
  }, [filteredOrders, revenueMixGroup]);

  // 3. STATE-WISE SALES PIE DATA (Top 5 + Others)
  const statePieData = useMemo(() => {
    const map = new Map<string, { state: string; orders: number; revenue: number; units: number }>();
    filteredOrders.forEach(o => {
      const st = o.state || 'Unspecified';
      if (!map.has(st)) map.set(st, { state: st, orders: 0, revenue: 0, units: 0 });
      const item = map.get(st)!;
      item.orders += 1;
      item.revenue += Number(o.price) || 0;
      item.units += Number(o.total_quantity) || 0;
    });

    const list = Array.from(map.values()).map(d => ({
      ...d,
      aov: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0,
      val: stateMetric === 'revenue' ? d.revenue : stateMetric === 'units' ? d.units : d.orders
    }));

    list.sort((a, b) => b.val - a.val);

    if (list.length <= 5) {
      return list.map((d, i) => ({ ...d, name: d.state, value: d.val, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] }));
    }

    const top5 = list.slice(0, 5);
    const remaining = list.slice(5);
    const othersOrders = remaining.reduce((s, x) => s + x.orders, 0);
    const othersRev = remaining.reduce((s, x) => s + x.revenue, 0);
    const othersUnits = remaining.reduce((s, x) => s + x.units, 0);
    const othersVal = remaining.reduce((s, x) => s + x.val, 0);

    return [
      ...top5.map((d, i) => ({ ...d, name: d.state, value: d.val, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] })),
      {
        state: 'Others',
        name: 'Others',
        orders: othersOrders,
        revenue: othersRev,
        units: othersUnits,
        aov: othersOrders > 0 ? Math.round(othersRev / othersOrders) : 0,
        val: othersVal,
        value: othersVal,
        color: '#64748b'
      }
    ];
  }, [filteredOrders, stateMetric]);

  // 4. CITY-WISE SALES DONUT DATA (Top 6 + Others)
  const cityDonutData = useMemo(() => {
    const map = new Map<string, { cityState: string; city: string; state: string; orders: number; revenue: number; units: number }>();
    filteredOrders.forEach(o => {
      const key = `${o.city || 'Unspecified'}, ${o.state || 'Unspecified'}`;
      if (!map.has(key)) map.set(key, { cityState: key, city: o.city || 'Unspecified', state: o.state || 'Unspecified', orders: 0, revenue: 0, units: 0 });
      const item = map.get(key)!;
      item.orders += 1;
      item.revenue += Number(o.price) || 0;
      item.units += Number(o.total_quantity) || 0;
    });

    const list = Array.from(map.values()).map(d => ({
      ...d,
      val: cityMetric === 'revenue' ? d.revenue : cityMetric === 'units' ? d.units : d.orders
    }));

    list.sort((a, b) => b.val - a.val);

    if (list.length <= 6) {
      return list.map((d, i) => ({ ...d, name: d.cityState, value: d.val, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] }));
    }

    const top6 = list.slice(0, 6);
    const remaining = list.slice(6);
    const othersOrders = remaining.reduce((s, x) => s + x.orders, 0);
    const othersRev = remaining.reduce((s, x) => s + x.revenue, 0);
    const othersUnits = remaining.reduce((s, x) => s + x.units, 0);
    const othersVal = remaining.reduce((s, x) => s + x.val, 0);

    return [
      ...top6.map((d, i) => ({ ...d, name: d.cityState, value: d.val, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] })),
      {
        cityState: 'Others',
        city: 'Others',
        state: 'Others',
        name: 'Others',
        orders: othersOrders,
        revenue: othersRev,
        units: othersUnits,
        val: othersVal,
        value: othersVal,
        color: '#64748b'
      }
    ];
  }, [filteredOrders, cityMetric]);

  // 5. PINCODE PERFORMANCE PIE DATA (Top 6 + Others)
  const pincodePieData = useMemo(() => {
    const map = new Map<string, { pincode: string; city: string; state: string; orders: number; revenue: number; units: number }>();
    filteredOrders.forEach(o => {
      const pin = String(o.pincode || '-').trim();
      if (pin === '-') return;
      if (!map.has(pin)) map.set(pin, { pincode: pin, city: o.city || '-', state: o.state || '-', orders: 0, revenue: 0, units: 0 });
      const item = map.get(pin)!;
      item.orders += 1;
      item.revenue += Number(o.price) || 0;
      item.units += Number(o.total_quantity) || 0;
    });

    const list = Array.from(map.values()).map(d => ({
      ...d,
      aov: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0,
      val: pincodeMetric === 'revenue' ? d.revenue : pincodeMetric === 'units' ? d.units : d.orders
    }));

    list.sort((a, b) => b.val - a.val);

    if (list.length <= 6) {
      return list.map((d, i) => ({ ...d, name: d.pincode, value: d.val, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] }));
    }

    const top6 = list.slice(0, 6);
    const remaining = list.slice(6);
    const othersOrders = remaining.reduce((s, x) => s + x.orders, 0);
    const othersRev = remaining.reduce((s, x) => s + x.revenue, 0);
    const othersUnits = remaining.reduce((s, x) => s + x.units, 0);
    const othersVal = remaining.reduce((s, x) => s + x.val, 0);

    return [
      ...top6.map((d, i) => ({ ...d, name: d.pincode, value: d.val, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] })),
      {
        pincode: 'Others',
        city: 'Others',
        state: 'Others',
        name: 'Others',
        orders: othersOrders,
        revenue: othersRev,
        units: othersUnits,
        aov: othersOrders > 0 ? Math.round(othersRev / othersOrders) : 0,
        val: othersVal,
        value: othersVal,
        color: '#64748b'
      }
    ];
  }, [filteredOrders, pincodeMetric]);

  // 6. PRODUCT PERFORMANCE DONUT DATA (Top 5 + Others)
  const productDonutData = useMemo(() => {
    const map = new Map<string, { product: string; units: number; orders: number; revenue: number }>();
    filteredOrders.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach((it: WebsiteOrderItem) => {
          const pName = it.product_name.trim();
          if (!map.has(pName)) map.set(pName, { product: pName, units: 0, orders: 0, revenue: 0 });
          const item = map.get(pName)!;
          item.units += it.quantity;
          item.orders += 1;
        });
      } else if (o.product_name) {
        const pName = o.product_name.trim();
        if (!map.has(pName)) map.set(pName, { product: pName, units: 0, orders: 0, revenue: 0 });
        const item = map.get(pName)!;
        item.units += o.total_quantity || 1;
        item.orders += 1;
        item.revenue += Number(o.price) || 0;
      }
    });

    const list = Array.from(map.values()).map(d => ({
      ...d,
      val: productMetric === 'revenue' ? d.revenue : productMetric === 'orders' ? d.orders : d.units
    }));

    list.sort((a, b) => b.val - a.val);

    if (list.length <= 5) {
      return list.map((d, i) => ({ ...d, name: d.product, value: d.val, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] }));
    }

    const top5 = list.slice(0, 5);
    const remaining = list.slice(5);
    const othersUnits = remaining.reduce((s, x) => s + x.units, 0);
    const othersOrders = remaining.reduce((s, x) => s + x.orders, 0);
    const othersRev = remaining.reduce((s, x) => s + x.revenue, 0);
    const othersVal = remaining.reduce((s, x) => s + x.val, 0);

    return [
      ...top5.map((d, i) => ({ ...d, name: d.product, value: d.val, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] })),
      {
        product: 'Others',
        name: 'Others',
        units: othersUnits,
        orders: othersOrders,
        revenue: othersRev,
        val: othersVal,
        value: othersVal,
        color: '#64748b'
      }
    ];
  }, [filteredOrders, productMetric]);

  // 7. OFFER PERFORMANCE PIE DATA (Top 5 + Others)
  const offerPieData = useMemo(() => {
    const map = new Map<string, { offer: string; orders: number; revenue: number; units: number }>();
    filteredOrders.forEach(o => {
      const off = (o.offer && o.offer !== '-') ? o.offer.trim() : 'No Offer';
      if (!map.has(off)) map.set(off, { offer: off, orders: 0, revenue: 0, units: 0 });
      const item = map.get(off)!;
      item.orders += 1;
      item.revenue += Number(o.price) || 0;
      item.units += Number(o.total_quantity) || 0;
    });

    const list = Array.from(map.values()).map(d => ({
      ...d,
      val: offerMetric === 'revenue' ? d.revenue : offerMetric === 'units' ? d.units : d.orders
    }));

    list.sort((a, b) => b.val - a.val);

    if (list.length <= 5) {
      return list.map((d, i) => ({ ...d, name: d.offer, value: d.val, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] }));
    }

    const top5 = list.slice(0, 5);
    const remaining = list.slice(5);
    const othersOrders = remaining.reduce((s, x) => s + x.orders, 0);
    const othersRev = remaining.reduce((s, x) => s + x.revenue, 0);
    const othersUnits = remaining.reduce((s, x) => s + x.units, 0);
    const othersVal = remaining.reduce((s, x) => s + x.val, 0);

    return [
      ...top5.map((d, i) => ({ ...d, name: d.offer, value: d.val, color: DISTINCT_COLORS[i % DISTINCT_COLORS.length] })),
      {
        offer: 'Others',
        name: 'Others',
        orders: othersOrders,
        revenue: othersRev,
        units: othersUnits,
        val: othersVal,
        value: othersVal,
        color: '#64748b'
      }
    ];
  }, [filteredOrders, offerMetric]);

  // 8. ORDER VALUE DISTRIBUTION DONUT DATA
  const orderValueDonutData = useMemo(() => {
    return ORDER_VALUE_BUCKETS.map((b, i) => {
      const matching = filteredOrders.filter(o => o.price >= b.min && o.price <= b.max);
      const rev = matching.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
      const val = orderValueMetric === 'revenue' ? rev : matching.length;
      return {
        name: b.label,
        bucket: b.label,
        orders: matching.length,
        revenue: rev,
        val,
        value: val,
        color: DISTINCT_COLORS[i % DISTINCT_COLORS.length]
      };
    }).filter(d => d.value > 0);
  }, [filteredOrders, orderValueMetric]);

  // 9. ORDER COMPOSITION DONUT DATA (2 DONUTS)
  const orderCompositionDonuts = useMemo(() => {
    let singleProd = 0;
    let multiProd = 0;
    let singleUnit = 0;
    let multiUnit = 0;
    let oneProdMultiQty = 0;
    let multiProdMultiQty = 0;

    filteredOrders.forEach(o => {
      const itemCount = o.items ? o.items.length : 1;
      const totalQty = o.total_quantity || 1;

      if (itemCount === 1) singleProd++;
      else multiProd++;

      if (totalQty === 1) singleUnit++;
      else multiUnit++;

      if (itemCount === 1 && totalQty > 1) oneProdMultiQty++;
      if (itemCount > 1 && totalQty > 1) multiProdMultiQty++;
    });

    return {
      productDonut: [
        { name: 'Single Product Orders', value: singleProd, color: '#3b82f6' },
        { name: 'Multi Product Orders', value: multiProd, color: '#ec4899' }
      ].filter(d => d.value > 0),
      quantityDonut: [
        { name: 'Single Unit Orders', value: singleUnit, color: '#10b981' },
        { name: 'Multi Unit Orders', value: multiUnit, color: '#a855f7' },
        { name: '1 Prod, Multi Qty', value: oneProdMultiQty, color: '#f59e0b' },
        { name: 'Multi Prod & Qty', value: multiProdMultiQty, color: '#06b6d4' }
      ].filter(d => d.value > 0)
    };
  }, [filteredOrders]);

  // 10. COD RECEIVABLE DONUT DATA
  const codReceivableDonutData = useMemo(() => {
    return [
      { name: 'Partial COD Advance Collected', value: partialCodAdvance, color: '#10b981' },
      { name: 'Partial COD Remaining Receivable', value: partialCodRemaining, color: '#a855f7' },
      { name: 'Full COD Receivable', value: fullCodReceivable, color: '#f59e0b' }
    ].filter(d => d.value > 0);
  }, [partialCodAdvance, partialCodRemaining, fullCodReceivable]);



  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300">
      {/* PAGE HEADER & NAVIGATION CONTROLS */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Website Sales Analytics</h1>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <span>Active Period:</span>
                <strong className="text-purple-300 font-mono">{getResolvedDateLabel()}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLS: ANALYTICS VIEW DROPDOWN + DATE RANGE DROPDOWN */}
        <div className="flex flex-wrap items-center gap-3">
          {/* ANALYTICS VIEW DROPDOWN */}
          <div ref={viewDropdownRef} className="relative w-full sm:w-[240px]">
            <button
              type="button"
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              aria-label="Select Analytics View"
              className="w-full h-[40px] px-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between text-xs font-bold text-white transition-all cursor-pointer shadow-sm focus:border-indigo-400 focus:outline-none"
            >
              <div className="flex items-center gap-2 truncate">
                <LayoutGrid size={15} className="text-indigo-400 shrink-0" />
                <span className="truncate">
                  {ANALYTICS_VIEW_OPTIONS.find(o => o.id === selectedViewId)?.label || 'Overview'}
                </span>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${isViewDropdownOpen ? 'rotate-180 text-indigo-400' : ''}`} />
            </button>

            {isViewDropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden py-1 divide-y divide-slate-800/40 text-xs animate-in fade-in duration-150 max-h-[320px] overflow-y-auto">
                {ANALYTICS_VIEW_OPTIONS.map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectAnalyticsView(opt.id)}
                    className={`px-3.5 py-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                      selectedViewId === opt.id
                        ? 'bg-indigo-600/20 text-indigo-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {selectedViewId === opt.id && <Check size={13} className="text-indigo-400" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COMPACT DATE RANGE DROPDOWN */}
          <div ref={dateDropdownRef} className="relative w-full sm:w-[170px]">
            <button
              type="button"
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              aria-label="Select Analytics Date Range"
              className={`w-full h-[40px] px-3.5 border rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer shadow-sm focus:outline-none ${
                appliedFilters.dateRangePreset !== 'today'
                  ? 'bg-purple-950/40 border-purple-500/60 text-purple-200'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Calendar size={15} className="text-purple-400 shrink-0" />
                <span className="truncate">{getResolvedDateLabel()}</span>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${isDateDropdownOpen ? 'rotate-180 text-purple-400' : ''}`} />
            </button>

            {/* DATE PRESET DROPDOWN POPUP MENU */}
            {isDateDropdownOpen && (
              <div className="absolute z-50 top-full right-0 w-[200px] mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden py-1 divide-y divide-slate-800/40 text-xs animate-in fade-in duration-150">
                {DATE_PRESET_OPTIONS.map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectDatePresetOption(opt.id)}
                    className={`px-3.5 py-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                      appliedFilters.dateRangePreset === opt.id
                        ? 'bg-purple-600/20 text-purple-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {appliedFilters.dateRangePreset === opt.id && <Check size={13} className="text-purple-400" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CUSTOM SINGLE DATE PICKER INPUT */}
      {showCustomDateInput && (
        <div className="p-4 bg-slate-900 border border-purple-500/40 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-purple-400" />
            <span className="text-xs font-bold text-slate-200">Select Custom Date:</span>
            <input
              type="date"
              value={appliedFilters.selectedDate}
              onChange={e => {
                const val = e.target.value;
                if (val) {
                  const nextFilterState = {
                    dateRangePreset: 'custom_date',
                    selectedDate: val,
                    startDate: val,
                    endDate: val
                  };
                  setDraftFilters(prev => ({ ...prev, ...nextFilterState }));
                  setAppliedFilters(prev => ({ ...prev, ...nextFilterState }));
                  searchParams.delete('period');
                  searchParams.set('from', val);
                  searchParams.set('to', val);
                  setSearchParams(searchParams, { replace: true });
                }
              }}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-purple-400 font-mono font-bold cursor-pointer"
            />
          </div>
          <button
            onClick={() => setShowCustomDateInput(false)}
            className="text-xs text-slate-400 hover:text-white font-semibold cursor-pointer"
          >
            Close Picker
          </button>
        </div>
      )}

      {/* CUSTOM DATE RANGE PANEL (From & To Date Fields) */}
      {showCustomRangePanel && (
        <div className="p-5 bg-slate-900 border border-purple-500/40 rounded-2xl space-y-4 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
              <CalendarRange size={16} /> Custom Date Range
            </div>
            <button onClick={() => setShowCustomRangePanel(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">From Date</label>
              <input
                type="date"
                value={customFromDate}
                onChange={e => setCustomFromDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-purple-400 font-mono font-bold cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">To Date</label>
              <input
                type="date"
                value={customToDate}
                onChange={e => setCustomToDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-purple-400 font-mono font-bold cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => setShowCustomRangePanel(false)}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyCustomRange}
              className="px-5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-md"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}

      {/* DRILL DOWN ACTIVE CHIPS BAR */}
      {(drillDownPaymentMode || drillDownState || drillDownCity) && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-300">
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={15} />
            <span>Active Chart Drill-down Filter:</span>
            {drillDownPaymentMode && <span className="font-bold bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-md border border-purple-500/40">Payment: {drillDownPaymentMode}</span>}
            {drillDownState && <span className="font-bold bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-md border border-cyan-500/40">State: {drillDownState}</span>}
            {drillDownCity && <span className="font-bold bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-md border border-blue-500/40">City: {drillDownCity}</span>}
          </div>
          <button
            onClick={() => {
              setDrillDownPaymentMode(null);
              setDrillDownState(null);
              setDrillDownCity(null);
            }}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm"
          >
            Clear Drill-down
          </button>
        </div>
      )}

      {/* MULTI-SELECT FILTER PANEL */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 text-sm font-bold text-white">
            <Filter size={18} className="text-indigo-400" />
            <span>Multi-Select Filters</span>
          </div>
          <span className="text-xs text-slate-400">Click Apply Filters to refresh visualizations</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MultiSelectDropdown
            label="Upload Batch"
            options={batchOptions}
            selectedValues={draftFilters.batchIds}
            onChange={vals => setDraftFilters({ ...draftFilters, batchIds: vals })}
            placeholder="All Batches"
          />

          <MultiSelectDropdown
            label="State"
            options={stateOptions}
            selectedValues={draftFilters.states}
            onChange={vals => setDraftFilters({ ...draftFilters, states: vals, cities: [] })}
            placeholder="All States"
          />

          <MultiSelectDropdown
            label="City"
            options={cityOptions}
            selectedValues={draftFilters.cities}
            onChange={vals => setDraftFilters({ ...draftFilters, cities: vals })}
            placeholder="All Cities"
          />

          <MultiSelectDropdown
            label="Pincode"
            options={pincodeOptions}
            selectedValues={draftFilters.pincodes}
            onChange={vals => setDraftFilters({ ...draftFilters, pincodes: vals })}
            placeholder="All Pincodes"
          />

          <MultiSelectDropdown
            label="Payment Mode"
            options={paymentModeOptions}
            selectedValues={draftFilters.paymentModes}
            onChange={vals => setDraftFilters({ ...draftFilters, paymentModes: vals })}
            placeholder="All Payment Modes"
          />

          <MultiSelectDropdown
            label="Offer"
            options={offerOptions}
            selectedValues={draftFilters.offers}
            onChange={vals => setDraftFilters({ ...draftFilters, offers: vals })}
            placeholder="All Offers"
          />

          <MultiSelectDropdown
            label="Product"
            options={productOptions}
            selectedValues={draftFilters.products}
            onChange={vals => setDraftFilters({ ...draftFilters, products: vals })}
            placeholder="All Products"
          />

          <MultiSelectDropdown
            label="Order Type"
            options={orderTypeOptions}
            selectedValues={draftFilters.orderTypes}
            onChange={vals => setDraftFilters({ ...draftFilters, orderTypes: vals })}
            placeholder="All Order Types"
          />
        </div>

        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Filtered Orders: <strong className="text-white font-mono text-sm">{totalOrdersCount}</strong>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw size={14} /> Reset Filters
            </button>
            <button
              disabled={applying}
              onClick={handleApplyFilters}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {applying ? <RefreshCw size={14} className="animate-spin" /> : <Filter size={14} />} Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* ROW 1: SUMMARY CARDS (OVERVIEW SECTION) */}
      <div 
        id="analytics-overview"
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-500 rounded-2xl p-1 ${
          highlightedSectionId === 'analytics-overview' ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/30' : ''
        }`}
      >
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
          <div className="text-2xl font-bold text-cyan-300">{totalUnits}</div>
        </div>

        <div className="p-5 border-t-4 border-t-purple-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Avg Order Value</span>
          <div className="text-2xl font-bold text-purple-300">₹{avgOrderValue.toLocaleString()}</div>
        </div>

        <div className="p-5 border-t-4 border-t-emerald-400 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Prepaid Orders</span>
          <div className="text-2xl font-bold text-emerald-400">{prepaidOrders.length}</div>
        </div>

        <div className="p-5 border-t-4 border-t-purple-400 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Partial COD Orders</span>
          <div className="text-2xl font-bold text-purple-300">{partialCodOrders.length}</div>
        </div>

        <div className="p-5 border-t-4 border-t-amber-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Full COD Orders</span>
          <div className="text-2xl font-bold text-amber-400">{codOrders.length}</div>
        </div>

        <div className="p-5 border-t-4 border-t-pink-500 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm hover:bg-slate-900/80 transition-all duration-300">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Total COD Receivable</span>
          <div className="text-2xl font-bold text-pink-300">₹{totalCodReceivable.toLocaleString()}</div>
        </div>
      </div>

      {totalOrdersCount === 0 && !loading ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <AlertCircle size={40} className="text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No orders match the selected date and filters.</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try choosing a different date range or click Reset Filters to view sales activity.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* ROW 2: PAYMENT MODE DONUT & REVENUE MIX DONUT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PAYMENT MODE DONUT CHART */}
            <div 
              id="analytics-payment-mode"
              className={`p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 transition-all duration-500 ${
                highlightedSectionId === 'analytics-payment-mode' ? 'ring-2 ring-indigo-500 shadow-indigo-500/40 border-indigo-500' : ''
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <CreditCard size={18} className="text-purple-400" />
                  <span>Payment Mode Breakdown</span>
                </div>
                <span className="text-xs text-slate-400">Click slice to filter page</span>
              </div>

              <AnalyticsDonutChart
                data={paymentDonutData}
                centerValue={totalOrdersCount}
                centerLabel="TOTAL ORDERS"
                selectedSliceName={drillDownPaymentMode}
                onSliceClick={entry => setDrillDownPaymentMode(entry.name)}
                emptyMessage="No payment data available for the selected filters"
              />
            </div>

            {/* REVENUE MIX DONUT CHART */}
            <div 
              id="analytics-revenue-mix"
              className={`p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 transition-all duration-500 ${
                highlightedSectionId === 'analytics-revenue-mix' ? 'ring-2 ring-indigo-500 shadow-indigo-500/40 border-indigo-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <DollarSign size={18} className="text-emerald-400" />
                  <span>Revenue Mix</span>
                </div>

                <AnalyticsSegmentedControl
                  options={REVENUE_MIX_SEGMENTS}
                  selectedValue={revenueMixGroup}
                  onChange={setRevenueMixGroup}
                  activeColorClass="bg-purple-600 text-white shadow-sm"
                  ariaLabel="Group Revenue By"
                />
              </div>

              <AnalyticsDonutChart
                data={revenueMixData}
                centerValue={`₹${totalRevenue.toLocaleString()}`}
                centerLabel="TOTAL REVENUE"
                emptyMessage="No revenue data available for the selected filters"
              />
            </div>
          </div>

          {/* ROW 3: STATE-WISE SALES DONUT & CITY-WISE SALES DONUT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* STATE-WISE SALES DONUT CHART */}
            <div 
              id="analytics-state"
              className={`p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 transition-all duration-500 ${
                highlightedSectionId === 'analytics-state' ? 'ring-2 ring-indigo-500 shadow-indigo-500/40 border-indigo-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <MapPin size={18} className="text-cyan-400" />
                  <span>State-wise Sales</span>
                </div>

                <AnalyticsSegmentedControl
                  options={ORDERS_REV_UNITS_SEGMENTS}
                  selectedValue={stateMetric}
                  onChange={setStateMetric}
                  activeColorClass="bg-cyan-600 text-white shadow-sm"
                  ariaLabel="Select State Metric"
                />
              </div>

              <AnalyticsDonutChart
                data={statePieData}
                centerValue={stateMetric === 'revenue' ? `₹${totalRevenue.toLocaleString()}` : stateMetric === 'units' ? totalUnits : totalOrdersCount}
                centerLabel={stateMetric === 'revenue' ? "TOTAL REVENUE" : stateMetric === 'units' ? "TOTAL UNITS" : "TOTAL ORDERS"}
                selectedSliceName={drillDownState}
                onSliceClick={entry => entry.state && entry.state !== 'Others' && setDrillDownState(entry.state)}
                emptyMessage="No state data available for the selected filters"
              />

              {/* State Table Toggle */}
              <div className="pt-1">
                <button
                  onClick={() => setShowStateTable(!showStateTable)}
                  className="text-xs text-cyan-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                >
                  {showStateTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showStateTable ? 'Hide State Breakdown Table' : 'View Full State Breakdown Table'}
                </button>
                {showStateTable && (
                  <div className="mt-2 overflow-x-auto rounded-xl border border-slate-800 max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">State</th>
                          <th className="py-2 px-3">Orders</th>
                          <th className="py-2 px-3">Revenue</th>
                          <th className="py-2 px-3">Units</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {statePieData.map(s => (
                          <tr key={s.name} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2 px-3 font-bold text-white font-sans">{s.name}</td>
                            <td className="py-2 px-3 text-cyan-300">{s.orders}</td>
                            <td className="py-2 px-3 text-emerald-400">₹{s.revenue.toLocaleString()}</td>
                            <td className="py-2 px-3 text-slate-300">{s.units}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* CITY-WISE SALES DONUT CHART */}
            <div 
              id="analytics-city"
              className={`p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 transition-all duration-500 ${
                highlightedSectionId === 'analytics-city' ? 'ring-2 ring-indigo-500 shadow-indigo-500/40 border-indigo-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Building2 size={18} className="text-blue-400" />
                  <span>City-wise Sales (City, State)</span>
                </div>

                <AnalyticsSegmentedControl
                  options={ORDERS_REV_UNITS_SEGMENTS}
                  selectedValue={cityMetric}
                  onChange={setCityMetric}
                  activeColorClass="bg-blue-600 text-white shadow-sm"
                  ariaLabel="Select City Metric"
                />
              </div>

              <AnalyticsDonutChart
                data={cityDonutData}
                centerValue={cityMetric === 'revenue' ? `₹${totalRevenue.toLocaleString()}` : cityMetric === 'units' ? totalUnits : totalOrdersCount}
                centerLabel={cityMetric === 'revenue' ? "TOTAL REVENUE" : cityMetric === 'units' ? "TOTAL UNITS" : "TOTAL ORDERS"}
                selectedSliceName={drillDownCity}
                onSliceClick={entry => entry.city && entry.city !== 'Others' && setDrillDownCity(entry.city)}
                emptyMessage="No city data available for the selected filters"
              />
            </div>
          </div>

          {/* ROW 4: PINCODE PERFORMANCE DONUT & PRODUCT PERFORMANCE DONUT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PINCODE PERFORMANCE DONUT CHART */}
            <div 
              id="analytics-pincode"
              className={`p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 transition-all duration-500 ${
                highlightedSectionId === 'analytics-pincode' ? 'ring-2 ring-indigo-500 shadow-indigo-500/40 border-indigo-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Tag size={18} className="text-amber-400" />
                  <span>Pincode Performance</span>
                </div>

                <AnalyticsSegmentedControl
                  options={ORDERS_REV_UNITS_SEGMENTS}
                  selectedValue={pincodeMetric}
                  onChange={setPincodeMetric}
                  activeColorClass="bg-amber-600 text-white shadow-sm"
                  ariaLabel="Select Pincode Metric"
                />
              </div>

              <AnalyticsDonutChart
                data={pincodePieData}
                centerValue={pincodeMetric === 'revenue' ? `₹${totalRevenue.toLocaleString()}` : pincodeMetric === 'units' ? totalUnits : totalOrdersCount}
                centerLabel={pincodeMetric === 'revenue' ? "TOTAL REVENUE" : pincodeMetric === 'units' ? "TOTAL UNITS" : "TOTAL ORDERS"}
                emptyMessage="No pincode data available for the selected filters"
              />
            </div>

            {/* PRODUCT PERFORMANCE DONUT CHART */}
            <div 
              id="analytics-product"
              className={`p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 transition-all duration-500 ${
                highlightedSectionId === 'analytics-product' ? 'ring-2 ring-indigo-500 shadow-indigo-500/40 border-indigo-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Package size={18} className="text-emerald-400" />
                  <span>Product Performance</span>
                </div>

                <AnalyticsSegmentedControl
                  options={UNITS_ORDERS_REV_SEGMENTS}
                  selectedValue={productMetric}
                  onChange={setProductMetric}
                  activeColorClass="bg-emerald-600 text-white shadow-sm"
                  ariaLabel="Select Product Metric"
                />
              </div>

              <AnalyticsDonutChart
                data={productDonutData}
                centerValue={productMetric === 'revenue' ? `₹${totalRevenue.toLocaleString()}` : productMetric === 'orders' ? totalOrdersCount : totalUnits}
                centerLabel={productMetric === 'revenue' ? "TOTAL REVENUE" : productMetric === 'orders' ? "TOTAL ORDERS" : "TOTAL UNITS"}
                emptyMessage="No product data available for the selected filters"
              />
            </div>
          </div>

          {/* ROW 5: OFFER PERFORMANCE DONUT & ORDER VALUE DONUT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OFFER PERFORMANCE DONUT CHART */}
            <div 
              id="analytics-offer"
              className={`p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 transition-all duration-500 ${
                highlightedSectionId === 'analytics-offer' ? 'ring-2 ring-indigo-500 shadow-indigo-500/40 border-indigo-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Tag size={18} className="text-purple-400" />
                  <span>Offer Performance</span>
                </div>

                <AnalyticsSegmentedControl
                  options={ORDERS_REV_UNITS_SEGMENTS}
                  selectedValue={offerMetric}
                  onChange={setOfferMetric}
                  activeColorClass="bg-purple-600 text-white shadow-sm"
                  ariaLabel="Select Offer Metric"
                />
              </div>

              <AnalyticsDonutChart
                data={offerPieData}
                centerValue={offerMetric === 'revenue' ? `₹${totalRevenue.toLocaleString()}` : offerMetric === 'units' ? totalUnits : totalOrdersCount}
                centerLabel={offerMetric === 'revenue' ? "TOTAL REVENUE" : offerMetric === 'units' ? "TOTAL UNITS" : "TOTAL ORDERS"}
                emptyMessage="No offer data available for the selected filters"
              />
            </div>

            {/* ORDER VALUE DISTRIBUTION DONUT CHART */}
            <div 
              id="analytics-order-value"
              className={`p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 transition-all duration-500 ${
                highlightedSectionId === 'analytics-order-value' ? 'ring-2 ring-indigo-500 shadow-indigo-500/40 border-indigo-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <ShoppingBag size={18} className="text-pink-400" />
                  <span>Order Value Distribution</span>
                </div>

                <AnalyticsSegmentedControl
                  options={ORDERS_REV_SEGMENTS}
                  selectedValue={orderValueMetric}
                  onChange={setOrderValueMetric}
                  activeColorClass="bg-pink-600 text-white shadow-sm"
                  ariaLabel="Select Order Value Metric"
                />
              </div>

              <AnalyticsDonutChart
                data={orderValueDonutData}
                centerValue={orderValueMetric === 'revenue' ? `₹${totalRevenue.toLocaleString()}` : totalOrdersCount}
                centerLabel={orderValueMetric === 'revenue' ? "TOTAL REVENUE" : "TOTAL ORDERS"}
                emptyMessage="No order value data available for the selected filters"
              />
            </div>
          </div>

          {/* ROW 6: ORDER COMPOSITION (TWO DONUT CHARTS) */}
          <div 
            id="analytics-order-composition"
            className={`p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 transition-all duration-500 ${
              highlightedSectionId === 'analytics-order-composition' ? 'ring-2 ring-indigo-500 shadow-indigo-500/40 border-indigo-500' : ''
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <PieIcon size={18} className="text-pink-400" />
                <span>Order Composition</span>
              </div>
              <span className="text-xs text-slate-400">Product & Quantity Breakdown</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* DONUT 1: PRODUCT COMPOSITION */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center">Product Composition</h4>
                <AnalyticsDonutChart
                  data={orderCompositionDonuts.productDonut}
                  centerValue={totalOrdersCount}
                  centerLabel="TOTAL ORDERS"
                  height={220}
                  innerRadius={45}
                  outerRadius={75}
                  emptyMessage="No product composition data available"
                />
              </div>

              {/* DONUT 2: QUANTITY COMPOSITION */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center">Quantity Composition</h4>
                <AnalyticsDonutChart
                  data={orderCompositionDonuts.quantityDonut}
                  centerValue={totalOrdersCount}
                  centerLabel="TOTAL ORDERS"
                  height={220}
                  innerRadius={45}
                  outerRadius={75}
                  emptyMessage="No quantity composition data available"
                />
              </div>
            </div>
          </div>

          {/* ROW 7: COD RECEIVABLE OVERVIEW DONUT CHART */}
          <div 
            id="analytics-cod-receivable"
            className={`p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 transition-all duration-500 ${
              highlightedSectionId === 'analytics-cod-receivable' ? 'ring-2 ring-indigo-500 shadow-indigo-500/40 border-indigo-500' : ''
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <DollarSign size={18} className="text-emerald-400" />
                <span>COD Receivable Overview</span>
              </div>
              <span className="text-xs text-slate-400">Advance vs Balance Receivable</span>
            </div>

            <AnalyticsDonutChart
              data={codReceivableDonutData}
              centerValue={`₹${(partialCodAdvance + totalCodReceivable).toLocaleString()}`}
              centerLabel="TOTAL COD VALUE"
              emptyMessage="No COD data available for the selected filters"
            />
          </div>
        </>
      )}
    </div>
  );
};
