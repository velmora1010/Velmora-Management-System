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
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import type { WebsiteConsolidatedOrder, WebsiteUploadBatch, WebsiteOrderItem } from './types';
import { websiteSalesService } from './websiteSalesService';
import { OptionItem } from './components/MultiSelectDropdown';
import { AnalyticsSegmentedControl, SegmentOption } from './components/AnalyticsSegmentedControl';
import { AnalyticsDonutChart } from './components/AnalyticsDonutChart';
import { CardMatchingOrdersList } from './components/CardMatchingOrdersList';
import { CustomerProductAnalyticsSection } from './components/CustomerProductAnalyticsSection';
import { OperationsForecastingSection } from './components/OperationsForecastingSection';
import { AnalyticsFullPageDataView, CustomerPurchaseProfile, OperationalOrderRecord } from './components/AnalyticsFullPageDataView';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import { AnalyticsFilterDrawer } from './components/AnalyticsFilterDrawer';
import { DateRangePickerModal } from './components/DateRangePickerModal';
import { useWebsiteSalesDateRange } from './context/WebsiteSalesDateRangeContext';
import { 
  getTodayInBusinessTimezone, 
  formatSalesDateDisplay, 
  formatSalesDateShort,
  shiftDateString,
  calculateDaysBetween,
  calculateWebsitePaymentSummary,
  normalizeLocationKey,
  resolveCanonicalLocation,
  orderMatchesLocationFilter,
  matchesOrderSearch,
  normalizeOrderId,
  matchesOrderIdExact,
  matchesCustomerNamePartial,
  matchesPhoneDigitsPartial
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
  orderIdSearch?: string;
  customerNameSearch?: string;
  phoneSearch?: string;
  globalSearch?: string;
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
  endDate: getTodayInBusinessTimezone(),
  orderIdSearch: '',
  customerNameSearch: '',
  phoneSearch: '',
  globalSearch: ''
};

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
  { id: 'analytics-cod-receivable', label: 'COD Receivable Overview' },
  { id: 'analytics-customer-product', label: 'Customer Product Analytics' },
  { id: 'analytics-operations-forecasting', label: 'Operations & Forecasting' }
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
  const [searchParams] = useSearchParams();
  const [allOrders, setAllOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Shared Website Sales Date Range State
  const { 
    startDate: analyticsStartDate, 
    endDate: analyticsEndDate, 
    setDateRange,
    resetToToday,
    shiftRange 
  } = useWebsiteSalesDateRange();

  const [isDateModalOpen, setIsDateModalOpen] = useState<boolean>(false);

  // Navigation Dropdown State
  const [selectedViewId, setSelectedViewId] = useState<string>('analytics-overview');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState<boolean>(false);
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  // Filter States
  const [draftFilters, setDraftFilters] = useState<MultiSelectFilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<MultiSelectFilterState>(DEFAULT_FILTERS);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);

  // Active filter count computation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.batchIds && appliedFilters.batchIds.length > 0) count += appliedFilters.batchIds.length;
    if (appliedFilters.states && appliedFilters.states.length > 0) count += appliedFilters.states.length;
    if (appliedFilters.cities && appliedFilters.cities.length > 0) count += appliedFilters.cities.length;
    if (appliedFilters.pincodes && appliedFilters.pincodes.length > 0) count += appliedFilters.pincodes.length;
    if (appliedFilters.paymentModes && appliedFilters.paymentModes.length > 0) count += appliedFilters.paymentModes.length;
    if (appliedFilters.offers && appliedFilters.offers.length > 0) count += appliedFilters.offers.length;
    if (appliedFilters.products && appliedFilters.products.length > 0) count += appliedFilters.products.length;
    if (appliedFilters.orderTypes && appliedFilters.orderTypes.length > 0) count += appliedFilters.orderTypes.length;
    if (appliedFilters.orderIdSearch && appliedFilters.orderIdSearch.trim()) count += 1;
    if (appliedFilters.customerNameSearch && appliedFilters.customerNameSearch.trim()) count += 1;
    if (appliedFilters.phoneSearch && appliedFilters.phoneSearch.trim()) count += 1;
    if (appliedFilters.globalSearch && appliedFilters.globalSearch.trim()) count += 1;
    return count;
  }, [appliedFilters]);

  // Remove individual active filter chip
  const handleRemoveChip = (key: keyof MultiSelectFilterState, val?: string) => {
    const nextFilters = { ...appliedFilters };
    if (val && Array.isArray(nextFilters[key])) {
      (nextFilters[key] as string[]) = ((nextFilters[key] as string[]) || []).filter(v => v !== val);
    } else if (typeof nextFilters[key] === 'string') {
      (nextFilters[key] as string) = '';
    }
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  };

  // Metric Switcher States
  const [revenueMixGroup, setRevenueMixGroup] = useState<'Payment Mode' | 'State' | 'Product' | 'Offer' | 'Order Value Range'>('Order Value Range');
  const [stateMetric, setStateMetric] = useState<'orders' | 'revenue' | 'units'>('orders');
  const [cityMetric, setCityMetric] = useState<'orders' | 'revenue' | 'units'>('orders');
  const [pincodeMetric, setPincodeMetric] = useState<'orders' | 'revenue' | 'units'>('orders');
  const [productMetric, setProductMetric] = useState<'units' | 'orders' | 'revenue'>('units');
  const [offerMetric, setOfferMetric] = useState<'orders' | 'revenue' | 'units'>('orders');
  const [orderValueMetric, setOrderValueMetric] = useState<'orders' | 'revenue'>('orders');

  // Chart Drill-down filters & Card-level Slice Selections
  const [drillDownPaymentMode, setDrillDownPaymentMode] = useState<string | null>(null);
  const [drillDownState, setDrillDownState] = useState<string | null>(null);
  const [drillDownCity, setDrillDownCity] = useState<string | null>(null);

  // Card-specific slice selection states
  const [revenueMixCardSlice, setRevenueMixCardSlice] = useState<string | null>(null);
  const [pincodeCardSlice, setPincodeCardSlice] = useState<string | null>(null);
  const [productCardSlice, setProductCardSlice] = useState<string | null>(null);
  const [offerCardSlice, setOfferCardSlice] = useState<string | null>(null);
  const [orderValueCardSlice, setOrderValueCardSlice] = useState<string | null>(null);
  const [prodCompCardSlice, setProdCompCardSlice] = useState<string | null>(null);
  const [qtyCompCardSlice, setQtyCompCardSlice] = useState<string | null>(null);
  const [codCardSlice, setCodCardSlice] = useState<string | null>(null);

  const [selectedOrderForModal, setSelectedOrderForModal] = useState<WebsiteConsolidatedOrder | null>(null);
  const [trackingShipments, setTrackingShipments] = useState<any[]>([]);
  const [fullPageView, setFullPageView] = useState<{
    viewType: 'orders' | 'customers' | 'operations';
    title: string;
    subtitle?: string;
    orders?: WebsiteConsolidatedOrder[];
    customers?: CustomerPurchaseProfile[];
    operations?: OperationalOrderRecord[];
  } | null>(null);

  const handleOpenOrdersFullPage = (title: string, list: WebsiteConsolidatedOrder[]) => {
    setFullPageView({
      viewType: 'orders',
      title,
      subtitle: `Viewing ${list.length} orders for ${title}`,
      orders: list
    });
  };

  const handleOpenCustomersFullPage = (title: string, list: CustomerPurchaseProfile[]) => {
    setFullPageView({
      viewType: 'customers',
      title,
      subtitle: `Viewing ${list.length} customer profiles`,
      customers: list
    });
  };

  const handleOpenOperationsFullPage = (title: string, list: OperationalOrderRecord[]) => {
    setFullPageView({
      viewType: 'operations',
      title,
      subtitle: `Viewing ${list.length} operational orders & shipments`,
      operations: list
    });
  };

  // Collapsible Secondary Tables
  const [showStateTable, setShowStateTable] = useState<boolean>(false);

  useEffect(() => {
    loadData();
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (from && to && from.match(/^\d{4}-\d{2}-\d{2}$/) && to.match(/^\d{4}-\d{2}-\d{2}$/)) {
      if (from !== analyticsStartDate || to !== analyticsEndDate) {
        setDateRange(from, to, 'custom');
      }
    }
  }, [analyticsStartDate, analyticsEndDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bList, orders, shipments] = await Promise.all([
        websiteSalesService.getUploadBatches(),
        websiteSalesService.getConsolidatedOrders({
          startDate: analyticsStartDate,
          endDate: analyticsEndDate
        }),
        websiteSalesService.getTrackingShipments()
      ]);
      setBatches(bList);
      setAllOrders(orders);
      setTrackingShipments(shipments);
    } catch (err: any) {
      console.error('Failed to load analytics data:', err);
      toast.error('Failed to load analytics orders');
    } finally {
      setLoading(false);
    }
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

  const getResolvedDateLabel = () => {
    const todayStr = getTodayInBusinessTimezone();
    if (analyticsStartDate === todayStr && analyticsEndDate === todayStr) return 'Today';
    if (analyticsStartDate === analyticsEndDate) return formatSalesDateShort(analyticsStartDate);
    return `${formatSalesDateShort(analyticsStartDate)} – ${formatSalesDateShort(analyticsEndDate)}`;
  };

  const todayStr = getTodayInBusinessTimezone();
  const handlePrevRange = () => shiftRange(-1);
  const handleNextRange = () => shiftRange(1);
  const handleResetToday = () => resetToToday();

  // Reset filters handler
  const handleResetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setDrillDownPaymentMode(null);
    setDrillDownState(null);
    setDrillDownCity(null);
    setRevenueMixCardSlice(null);
    setPincodeCardSlice(null);
    setProductCardSlice(null);
    setOfferCardSlice(null);
    setOrderValueCardSlice(null);
    setProdCompCardSlice(null);
    setQtyCompCardSlice(null);
    setCodCardSlice(null);
    toast.success('Filters reset to default');
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    setIsFilterDrawerOpen(false);
    toast.success('Filters applied successfully');
  };

  // --- FILTERING DATA LOGIC ---
  const filteredOrders = useMemo(() => {
    return allOrders.filter(o => {
      // Date Range Filter
      if (analyticsStartDate && analyticsEndDate) {
        const orderDateStr = o.order_date || '';
        if (orderDateStr < analyticsStartDate || orderDateStr > analyticsEndDate) {
          return false;
        }
      }

      if (drillDownPaymentMode && o.payment_mode !== drillDownPaymentMode) return false;
      if (drillDownState) {
        const cState = o.canonicalState || resolveCanonicalLocation(o.state, o.city, o.pincode).stateName;
        if (normalizeLocationKey(cState) !== normalizeLocationKey(drillDownState)) return false;
      }
      if (drillDownCity) {
        const cCity = o.canonicalCity || resolveCanonicalLocation(o.state, o.city, o.pincode).cityName;
        if (normalizeLocationKey(cCity) !== normalizeLocationKey(drillDownCity)) return false;
      }

      if (appliedFilters.batchIds.length > 0 && !appliedFilters.batchIds.includes(o.upload_batch_id)) return false;
      
      // Unified Canonical Location Matching (State, City, Pincode)
      if (!orderMatchesLocationFilter(o, appliedFilters.states, appliedFilters.cities, appliedFilters.pincodes)) {
        return false;
      }
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

      // Order Search
      if (appliedFilters.orderIdSearch && appliedFilters.orderIdSearch.trim()) {
        if (!matchesOrderIdExact(o, appliedFilters.orderIdSearch.trim())) return false;
      }
      if (appliedFilters.customerNameSearch && appliedFilters.customerNameSearch.trim()) {
        if (!matchesCustomerNamePartial(o, appliedFilters.customerNameSearch.trim())) return false;
      }
      if (appliedFilters.phoneSearch && appliedFilters.phoneSearch.trim()) {
        if (!matchesPhoneDigitsPartial(o, appliedFilters.phoneSearch.trim())) return false;
      }

      // Global Header Search
      if (appliedFilters.globalSearch && appliedFilters.globalSearch.trim()) {
        if (!matchesOrderSearch(o, appliedFilters.globalSearch.trim())) return false;
      }

      return true;
    });
  }, [allOrders, analyticsStartDate, analyticsEndDate, appliedFilters, drillDownPaymentMode, drillDownState, drillDownCity]);

  // SUMMARY METRICS COMPUTATION
  const totalOrdersCount = filteredOrders.length;
  const totalRevenue = useMemo(() => filteredOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0), [filteredOrders]);
  const totalUnits = useMemo(() => filteredOrders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0), [filteredOrders]);
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  // Payment Summary metrics using the unified calculation logic
  const paymentSummary = useMemo(() => calculateWebsitePaymentSummary(filteredOrders), [filteredOrders]);
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

  const partialCodOrders = useMemo(() => filteredOrders.filter(o => o.payment_mode === 'PARTIAL COD'), [filteredOrders]);
  const partialCodAdvance = useMemo(() => partialCodOrders.reduce((sum, o) => sum + (Number(o.advance_paid) || 0), 0), [partialCodOrders]);
  const fullCodReceivable = fullCodPending;

  // Reset Revenue Mix card slice when grouping changes
  useEffect(() => {
    setRevenueMixCardSlice(null);
  }, [revenueMixGroup]);

  // CARD-SPECIFIC MATCHING ORDERS COMPUTATIONS
  const paymentMatchingOrders = useMemo(() => {
    if (!drillDownPaymentMode) return filteredOrders;
    return filteredOrders.filter(o => o.payment_mode === drillDownPaymentMode);
  }, [filteredOrders, drillDownPaymentMode]);

  const revenueMixMatchingOrders = useMemo(() => {
    if (!revenueMixCardSlice) return filteredOrders;
    return filteredOrders.filter(o => {
      if (revenueMixGroup === 'Payment Mode') return o.payment_mode === revenueMixCardSlice;
      if (revenueMixGroup === 'State') return (o.state || 'Unspecified') === revenueMixCardSlice;
      if (revenueMixGroup === 'Product') {
        return o.items 
          ? o.items.some(i => i.product_name === revenueMixCardSlice) 
          : (o.product_name || '').includes(revenueMixCardSlice);
      }
      if (revenueMixGroup === 'Offer') {
        const off = o.offer && o.offer !== '-' ? o.offer : 'No Offer';
        return off === revenueMixCardSlice;
      }
      if (revenueMixGroup === 'Order Value Range') {
        const p = Number(o.price) || 0;
        if (revenueMixCardSlice === 'Below ₹500') return p < 500;
        if (revenueMixCardSlice === '₹500–₹749') return p >= 500 && p < 750;
        if (revenueMixCardSlice === '₹750–₹999') return p >= 750 && p < 1000;
        if (revenueMixCardSlice === '₹1,000–₹1,299') return p >= 1000 && p < 1300;
        if (revenueMixCardSlice === '₹1,300–₹1,499') return p >= 1300 && p < 1500;
        if (revenueMixCardSlice === '₹1,500 and above') return p >= 1500;
      }
      return true;
    });
  }, [filteredOrders, revenueMixGroup, revenueMixCardSlice]);

  const pincodeMatchingOrders = useMemo(() => {
    if (!pincodeCardSlice) return filteredOrders;
    return filteredOrders.filter(o => (o.pincode || 'Unspecified') === pincodeCardSlice);
  }, [filteredOrders, pincodeCardSlice]);

  const productMatchingOrders = useMemo(() => {
    if (!productCardSlice) return filteredOrders;
    return filteredOrders.filter(o => {
      if (o.items) return o.items.some(i => i.product_name === productCardSlice);
      return (o.product_name || '').includes(productCardSlice);
    });
  }, [filteredOrders, productCardSlice]);

  const offerMatchingOrders = useMemo(() => {
    if (!offerCardSlice) return filteredOrders;
    if (offerCardSlice === 'Others' || offerCardSlice === 'No Offer') {
      return filteredOrders.filter(o => !o.offer || o.offer === '-' || o.offer === 'No Offer');
    }
    return filteredOrders.filter(o => o.offer === offerCardSlice);
  }, [filteredOrders, offerCardSlice]);

  const orderValueMatchingOrders = useMemo(() => {
    if (!orderValueCardSlice) return filteredOrders;
    return filteredOrders.filter(o => {
      const p = Number(o.price) || 0;
      if (orderValueCardSlice === 'Below ₹500') return p < 500;
      if (orderValueCardSlice === '₹500–₹749') return p >= 500 && p < 750;
      if (orderValueCardSlice === '₹750–₹999') return p >= 750 && p < 1000;
      if (orderValueCardSlice === '₹1,000–₹1,299') return p >= 1000 && p < 1300;
      if (orderValueCardSlice === '₹1,300–₹1,499') return p >= 1300 && p < 1500;
      if (orderValueCardSlice === '₹1,500 and above') return p >= 1500;
      return true;
    });
  }, [filteredOrders, orderValueCardSlice]);

  const prodCompMatchingOrders = useMemo(() => {
    if (!prodCompCardSlice) return filteredOrders;
    return filteredOrders.filter(o => {
      const count = o.items ? o.items.length : 1;
      if (prodCompCardSlice === 'Single Product Orders') return count === 1;
      if (prodCompCardSlice === 'Multi Product Orders') return count > 1;
      return true;
    });
  }, [filteredOrders, prodCompCardSlice]);

  const qtyCompMatchingOrders = useMemo(() => {
    if (!qtyCompCardSlice) return filteredOrders;
    return filteredOrders.filter(o => {
      const qty = o.total_quantity || 1;
      if (qtyCompCardSlice === 'Single Unit Orders') return qty === 1;
      if (qtyCompCardSlice === 'Multi Unit Orders') return qty > 1;
      return true;
    });
  }, [filteredOrders, qtyCompCardSlice]);

  const codMatchingOrders = useMemo(() => {
    if (!codCardSlice) return filteredOrders.filter(o => o.payment_mode === 'COD' || o.payment_mode === 'PARTIAL COD');
    if (codCardSlice === 'Partial COD Advance Collected') return filteredOrders.filter(o => o.payment_mode === 'PARTIAL COD');
    if (codCardSlice === 'Partial COD Remaining Receivable') return filteredOrders.filter(o => o.payment_mode === 'PARTIAL COD');
    if (codCardSlice === 'Full COD Receivable') return filteredOrders.filter(o => o.payment_mode === 'COD');
    return filteredOrders;
  }, [filteredOrders, codCardSlice]);

  // --- CHART DATA PREPARATIONS ---
  // 1. PAYMENT MODE DONUT DATA
  const paymentDonutData = useMemo(() => {
    const list = [
      { name: 'PREPAID', value: prepaidCount, color: '#10b981', orders: prepaidCount, revenue: prepaidRevenue },
      { name: 'PARTIAL COD', value: partialCodCount, color: '#a855f7', orders: partialCodCount, revenue: partialCodRevenue },
      { name: 'COD', value: fullCodCount, color: '#f59e0b', orders: fullCodCount, revenue: fullCodRevenue }
    ];
    return list.filter(d => d.value > 0);
  }, [prepaidCount, prepaidRevenue, partialCodCount, partialCodRevenue, fullCodCount, fullCodRevenue]);

  // 2. REVENUE MIX DATA
  const revenueMixData = useMemo(() => {
    const map = new Map<string, number>();

    if (revenueMixGroup === 'Payment Mode') {
      filteredOrders.forEach(o => {
        const mode = o.payment_mode || 'UNKNOWN';
        map.set(mode, (map.get(mode) || 0) + (Number(o.price) || 0));
      });
    } else if (revenueMixGroup === 'State') {
      filteredOrders.forEach(o => {
        const st = (o.state || 'Unspecified').trim();
        map.set(st, (map.get(st) || 0) + (Number(o.price) || 0));
      });
    } else if (revenueMixGroup === 'Product') {
      filteredOrders.forEach(o => {
        if (o.items && o.items.length > 0) {
          o.items.forEach(it => {
            const p = it.product_name.trim();
            const rev = it.line_total != null ? it.line_total : ((Number(o.price) || 0) / (o.total_quantity || 1)) * (it.quantity || 1);
            map.set(p, (map.get(p) || 0) + rev);
          });
        } else {
          const p = (o.product_name || 'Unspecified').trim();
          map.set(p, (map.get(p) || 0) + (Number(o.price) || 0));
        }
      });
    } else if (revenueMixGroup === 'Offer') {
      filteredOrders.forEach(o => {
        const off = o.offer && o.offer !== '-' ? o.offer.trim() : 'No Offer';
        map.set(off, (map.get(off) || 0) + (Number(o.price) || 0));
      });
    } else if (revenueMixGroup === 'Order Value Range') {
      ORDER_VALUE_BUCKETS.forEach(b => map.set(b.label, 0));
      filteredOrders.forEach(o => {
        const p = Number(o.price) || 0;
        const bucket = ORDER_VALUE_BUCKETS.find(b => p >= b.min && p <= b.max);
        if (bucket) {
          map.set(bucket.label, (map.get(bucket.label) || 0) + p);
        }
      });
    }

    const sorted = Array.from(map.entries())
      .filter(([_, val]) => val > 0)
      .sort((a, b) => b[1] - a[1]);

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const othersTotal = others.reduce((acc, curr) => acc + curr[1], 0);

    const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#64748b'];
    const result = top5.map(([name, val], idx) => ({
      name,
      value: Math.round(val),
      revenue: Math.round(val),
      color: colors[idx % colors.length]
    }));

    if (othersTotal > 0) {
      result.push({
        name: 'Others',
        value: Math.round(othersTotal),
        revenue: Math.round(othersTotal),
        color: colors[colors.length - 1]
      });
    }

    return result;
  }, [filteredOrders, revenueMixGroup]);

  // 3. STATE-WISE SALES DATA
  const statePieData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number; units: number }>();
    filteredOrders.forEach(o => {
      const canonicalState = o.canonicalState || resolveCanonicalLocation(o.state, o.city, o.pincode).stateName || o.state || 'Unspecified';
      const key = canonicalState.trim();
      const curr = map.get(key) || { orders: 0, revenue: 0, units: 0 };
      curr.orders += 1;
      curr.revenue += Number(o.price) || 0;
      curr.units += Number(o.total_quantity) || 1;
      map.set(key, curr);
    });

    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1][stateMetric] - a[1][stateMetric]);

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const othersTotals = others.reduce((acc, curr) => ({
      orders: acc.orders + curr[1].orders,
      revenue: acc.revenue + curr[1].revenue,
      units: acc.units + curr[1].units
    }), { orders: 0, revenue: 0, units: 0 });

    const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#64748b'];
    const result = top5.map(([name, data], idx) => ({
      name,
      state: name,
      value: data[stateMetric],
      orders: data.orders,
      revenue: Math.round(data.revenue),
      units: data.units,
      color: colors[idx % colors.length]
    }));

    if (othersTotals[stateMetric] > 0) {
      result.push({
        name: 'Others',
        state: 'Others',
        value: othersTotals[stateMetric],
        orders: othersTotals.orders,
        revenue: Math.round(othersTotals.revenue),
        units: othersTotals.units,
        color: colors[colors.length - 1]
      });
    }

    return result;
  }, [filteredOrders, stateMetric]);

  const stateMatchingOrders = useMemo(() => {
    if (!drillDownState) return filteredOrders;
    return filteredOrders.filter(o => {
      const cState = o.canonicalState || resolveCanonicalLocation(o.state, o.city, o.pincode).stateName;
      return normalizeLocationKey(cState) === normalizeLocationKey(drillDownState);
    });
  }, [filteredOrders, drillDownState]);

  // 4. CITY-WISE SALES DATA
  const cityDonutData = useMemo(() => {
    const map = new Map<string, { city: string; state: string; orders: number; revenue: number; units: number }>();
    filteredOrders.forEach(o => {
      const cLoc = resolveCanonicalLocation(o.state, o.city, o.pincode);
      const city = o.canonicalCity || cLoc.cityName || o.city || 'Unspecified';
      const state = o.canonicalState || cLoc.stateName || o.state || 'Unspecified';
      const label = `${city}, ${state}`;

      const curr = map.get(label) || { city, state, orders: 0, revenue: 0, units: 0 };
      curr.orders += 1;
      curr.revenue += Number(o.price) || 0;
      curr.units += Number(o.total_quantity) || 1;
      map.set(label, curr);
    });

    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1][cityMetric] - a[1][cityMetric]);

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const othersTotals = others.reduce((acc, curr) => ({
      orders: acc.orders + curr[1].orders,
      revenue: acc.revenue + curr[1].revenue,
      units: acc.units + curr[1].units
    }), { orders: 0, revenue: 0, units: 0 });

    const colors = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#64748b'];
    const result = top5.map(([label, data], idx) => ({
      name: label,
      cityState: label,
      city: data.city,
      state: data.state,
      value: data[cityMetric],
      orders: data.orders,
      revenue: Math.round(data.revenue),
      units: data.units,
      color: colors[idx % colors.length]
    }));

    if (othersTotals[cityMetric] > 0) {
      result.push({
        name: 'Others',
        cityState: 'Others',
        city: 'Others',
        state: 'Others',
        value: othersTotals[cityMetric],
        orders: othersTotals.orders,
        revenue: Math.round(othersTotals.revenue),
        units: othersTotals.units,
        color: colors[colors.length - 1]
      });
    }

    return result;
  }, [filteredOrders, cityMetric]);

  const cityMatchingOrders = useMemo(() => {
    if (!drillDownCity) return filteredOrders;
    return filteredOrders.filter(o => {
      const cLoc = resolveCanonicalLocation(o.state, o.city, o.pincode);
      const label = `${o.canonicalCity || cLoc.cityName || o.city || 'Unspecified'}, ${o.canonicalState || cLoc.stateName || o.state || 'Unspecified'}`;
      return label === drillDownCity;
    });
  }, [filteredOrders, drillDownCity]);

  // 5. PINCODE PERFORMANCE DONUT DATA
  const pincodePieData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number; units: number }>();
    filteredOrders.forEach(o => {
      const pin = (o.pincode || 'Unspecified').trim();
      const curr = map.get(pin) || { orders: 0, revenue: 0, units: 0 };
      curr.orders += 1;
      curr.revenue += Number(o.price) || 0;
      curr.units += Number(o.total_quantity) || 1;
      map.set(pin, curr);
    });

    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1][pincodeMetric] - a[1][pincodeMetric]);

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const othersTotals = others.reduce((acc, curr) => ({
      orders: acc.orders + curr[1].orders,
      revenue: acc.revenue + curr[1].revenue,
      units: acc.units + curr[1].units
    }), { orders: 0, revenue: 0, units: 0 });

    const colors = ['#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b'];
    const result = top5.map(([name, data], idx) => ({
      name,
      pincode: name,
      value: data[pincodeMetric],
      orders: data.orders,
      revenue: Math.round(data.revenue),
      units: data.units,
      color: colors[idx % colors.length]
    }));

    if (othersTotals[pincodeMetric] > 0) {
      result.push({
        name: 'Others',
        pincode: 'Others',
        value: othersTotals[pincodeMetric],
        orders: othersTotals.orders,
        revenue: Math.round(othersTotals.revenue),
        units: othersTotals.units,
        color: colors[colors.length - 1]
      });
    }

    return result;
  }, [filteredOrders, pincodeMetric]);

  // 6. PRODUCT PERFORMANCE DONUT DATA
  const productDonutData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number; units: number }>();
    filteredOrders.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach(it => {
          const p = (it.product_name || 'Unspecified').trim();
          const curr = map.get(p) || { orders: 0, revenue: 0, units: 0 };
          curr.units += it.quantity || 1;
          const rev = it.line_total != null ? it.line_total : ((Number(o.price) || 0) / (o.total_quantity || 1)) * (it.quantity || 1);
          curr.revenue += rev;
          curr.orders += 1;
          map.set(p, curr);
        });
      } else {
        const p = (o.product_name || 'Unspecified').trim();
        const curr = map.get(p) || { orders: 0, revenue: 0, units: 0 };
        curr.orders += 1;
        curr.revenue += Number(o.price) || 0;
        curr.units += Number(o.total_quantity) || 1;
        map.set(p, curr);
      }
    });

    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1][productMetric] - a[1][productMetric]);

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const othersTotals = others.reduce((acc, curr) => ({
      orders: acc.orders + curr[1].orders,
      revenue: acc.revenue + curr[1].revenue,
      units: acc.units + curr[1].units
    }), { orders: 0, revenue: 0, units: 0 });

    const colors = ['#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#64748b'];
    const result = top5.map(([name, data], idx) => ({
      name,
      product: name,
      value: data[productMetric],
      orders: data.orders,
      revenue: Math.round(data.revenue),
      units: data.units,
      color: colors[idx % colors.length]
    }));

    if (othersTotals[productMetric] > 0) {
      result.push({
        name: 'Others',
        product: 'Others',
        value: othersTotals[productMetric],
        orders: othersTotals.orders,
        revenue: Math.round(othersTotals.revenue),
        units: othersTotals.units,
        color: colors[colors.length - 1]
      });
    }

    return result;
  }, [filteredOrders, productMetric]);

  // 7. OFFER PERFORMANCE DONUT DATA
  const offerPieData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number; units: number }>();
    filteredOrders.forEach(o => {
      const off = o.offer && o.offer !== '-' ? o.offer.trim() : 'No Offer';
      const curr = map.get(off) || { orders: 0, revenue: 0, units: 0 };
      curr.orders += 1;
      curr.revenue += Number(o.price) || 0;
      curr.units += Number(o.total_quantity) || 1;
      map.set(off, curr);
    });

    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1][offerMetric] - a[1][offerMetric]);

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const othersTotals = others.reduce((acc, curr) => ({
      orders: acc.orders + curr[1].orders,
      revenue: acc.revenue + curr[1].revenue,
      units: acc.units + curr[1].units
    }), { orders: 0, revenue: 0, units: 0 });

    const colors = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#64748b'];
    const result = top5.map(([name, data], idx) => ({
      name,
      offer: name,
      value: data[offerMetric],
      orders: data.orders,
      revenue: Math.round(data.revenue),
      units: data.units,
      color: colors[idx % colors.length]
    }));

    if (othersTotals[offerMetric] > 0) {
      result.push({
        name: 'Others',
        offer: 'Others',
        value: othersTotals[offerMetric],
        orders: othersTotals.orders,
        revenue: Math.round(othersTotals.revenue),
        units: othersTotals.units,
        color: colors[colors.length - 1]
      });
    }

    return result;
  }, [filteredOrders, offerMetric]);

  // 8. ORDER VALUE DISTRIBUTION DONUT DATA
  const orderValueDonutData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>();
    ORDER_VALUE_BUCKETS.forEach(b => map.set(b.label, { orders: 0, revenue: 0 }));

    filteredOrders.forEach(o => {
      const p = Number(o.price) || 0;
      const bucket = ORDER_VALUE_BUCKETS.find(b => p >= b.min && p <= b.max);
      if (bucket) {
        const curr = map.get(bucket.label)!;
        curr.orders += 1;
        curr.revenue += p;
      }
    });

    const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    return ORDER_VALUE_BUCKETS.map((b, idx) => {
      const data = map.get(b.label)!;
      return {
        name: b.label,
        value: orderValueMetric === 'revenue' ? Math.round(data.revenue) : data.orders,
        orders: data.orders,
        revenue: Math.round(data.revenue),
        color: colors[idx % colors.length]
      };
    }).filter(d => d.value > 0);
  }, [filteredOrders, orderValueMetric]);

  // 9. ORDER COMPOSITION DONUTS DATA
  const orderCompositionDonuts = useMemo(() => {
    let singleProdCount = 0;
    let multiProdCount = 0;
    let singleUnitCount = 0;
    let multiUnitCount = 0;

    filteredOrders.forEach(o => {
      const itemCount = o.items ? o.items.length : 1;
      if (itemCount === 1) singleProdCount++;
      else multiProdCount++;

      const qty = o.total_quantity || 1;
      if (qty === 1) singleUnitCount++;
      else multiUnitCount++;
    });

    const productDonut = [
      { name: 'Single Product Orders', value: singleProdCount, color: '#06b6d4', orders: singleProdCount },
      { name: 'Multi Product Orders', value: multiProdCount, color: '#8b5cf6', orders: multiProdCount }
    ].filter(d => d.value > 0);

    const quantityDonut = [
      { name: 'Single Unit Orders', value: singleUnitCount, color: '#10b981', orders: singleUnitCount },
      { name: 'Multi Unit Orders', value: multiUnitCount, color: '#ec4899', orders: multiUnitCount }
    ].filter(d => d.value > 0);

    return { productDonut, quantityDonut };
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
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {fullPageView ? (
        <AnalyticsFullPageDataView
          viewType={fullPageView.viewType}
          title={fullPageView.title}
          subtitle={fullPageView.subtitle}
          orders={fullPageView.orders}
          customers={fullPageView.customers}
          operations={fullPageView.operations}
          onBack={() => setFullPageView(null)}
          onOrderDeleted={loadData}
        />
      ) : (
        <>
          {/* 1. COMPACT PAGE HEADER & NAVIGATION CONTROLS */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20 flex items-center justify-center shrink-0">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Website Sales Analytics</h1>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span>Active Period:</span>
              <strong className="text-purple-300 font-mono">{getResolvedDateLabel()}</strong>
            </p>
          </div>
        </div>

        {/* CONTROLS BAR: VIEW DROPDOWN + DATE BAR WITH PREV/NEXT/TODAY + SEARCH + FILTERS */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* JUMP TO VIEW DROPDOWN */}
          <div ref={viewDropdownRef} className="relative w-full sm:w-[190px]">
            <button
              type="button"
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              aria-label="Select Analytics View"
              className="w-full h-[38px] px-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between text-xs font-bold text-white transition-all cursor-pointer shadow-sm focus:border-purple-400 focus:outline-none"
            >
              <div className="flex items-center gap-2 truncate">
                <LayoutGrid size={14} className="text-purple-400 shrink-0" />
                <span className="truncate">
                  {ANALYTICS_VIEW_OPTIONS.find(o => o.id === selectedViewId)?.label || 'Overview'}
                </span>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${isViewDropdownOpen ? 'rotate-180 text-purple-400' : ''}`} />
            </button>

            {isViewDropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden py-1 divide-y divide-slate-800/40 text-xs animate-in fade-in duration-150 max-h-[320px] overflow-y-auto">
                {ANALYTICS_VIEW_OPTIONS.map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectAnalyticsView(opt.id)}
                    className={`px-3.5 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                      selectedViewId === opt.id
                        ? 'bg-purple-600/20 text-purple-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {selectedViewId === opt.id && <Check size={13} className="text-purple-400" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DATE CONTROLS GROUP (PREV | DATE RANGE | NEXT | TODAY) */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl shadow-inner">
            <button
              type="button"
              onClick={handlePrevRange}
              title="Previous Range / Day"
              aria-label="Previous Range / Day"
              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
            >
              <ChevronLeft size={15} />
            </button>

            <button
              type="button"
              onClick={() => setIsDateModalOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold text-white hover:text-purple-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calendar size={13} className="text-purple-400 shrink-0" />
              <span className="truncate max-w-[150px] font-mono font-bold">{getResolvedDateLabel()}</span>
            </button>

            <button
              type="button"
              onClick={handleNextRange}
              disabled={analyticsEndDate >= todayStr}
              title="Next Range / Day"
              aria-label="Next Range / Day"
              className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
            >
              <ChevronRight size={15} />
            </button>

            <button
              type="button"
              onClick={handleResetToday}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                analyticsStartDate === todayStr && analyticsEndDate === todayStr
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white'
              }`}
            >
              <Clock size={12} /> Today
            </button>
          </div>

          {/* GLOBAL SEARCH INPUT */}
          <div className="relative w-full sm:w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={appliedFilters.globalSearch || ''}
              onChange={e => {
                const val = e.target.value;
                setDraftFilters(prev => ({ ...prev, globalSearch: val }));
                setAppliedFilters(prev => ({ ...prev, globalSearch: val }));
              }}
              placeholder="Search Order, Name, Phone..."
              className="w-full h-[38px] pl-8 pr-7 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-purple-400 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-colors shadow-sm font-mono"
            />
            {appliedFilters.globalSearch && (
              <button
                onClick={() => {
                  setDraftFilters(prev => ({ ...prev, globalSearch: '' }));
                  setAppliedFilters(prev => ({ ...prev, globalSearch: '' }));
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                title="Clear global search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* FILTERS BUTTON */}
          <button
            type="button"
            onClick={() => {
              setDraftFilters(appliedFilters);
              setIsFilterDrawerOpen(true);
            }}
            aria-label="Open Analytics Filters"
            className={`h-[38px] px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
              activeFilterCount > 0
                ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300'
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500 text-slate-950 font-extrabold font-mono">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* REFRESH BUTTON */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="h-[38px] w-[38px] bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-purple-400' : ''} />
          </button>
        </div>
      </div>

      {/* DRILL DOWN ACTIVE CHIPS BAR */}
      {(drillDownPaymentMode || drillDownState || drillDownCity) && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-purple-300">
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={14} />
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
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm"
          >
            Clear Drill-down
          </button>
        </div>
      )}

      {/* ACTIVE FILTER CHIPS BAR & MATCHING COUNT */}
      {activeFilterCount > 0 && (
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-extrabold text-[10px] uppercase tracking-wider border border-purple-500/30">
              FILTERED
            </span>
            <span className="text-slate-300 font-mono font-bold text-xs pl-1">
              {totalOrdersCount} {totalOrdersCount === 1 ? 'Order' : 'Orders'} Matching
            </span>
            <span className="text-slate-700">|</span>

            {appliedFilters.states?.map(st => (
              <span key={st} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px]">
                State: {st}
                <button onClick={() => handleRemoveChip('states', st)} className="hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            ))}

            {appliedFilters.cities?.map(ct => (
              <span key={ct} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px]">
                City: {ct}
                <button onClick={() => handleRemoveChip('cities', ct)} className="hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            ))}

            {appliedFilters.pincodes?.map(pin => (
              <span key={pin} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-mono">
                Pincode: {pin}
                <button onClick={() => handleRemoveChip('pincodes', pin)} className="hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            ))}

            {appliedFilters.paymentModes?.map(pm => (
              <span key={pm} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-bold">
                Payment: {pm}
                <button onClick={() => handleRemoveChip('paymentModes', pm)} className="hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            ))}

            {appliedFilters.products?.map(p => (
              <span key={p} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px]">
                Product: {p}
                <button onClick={() => handleRemoveChip('products', p)} className="hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            ))}

            {appliedFilters.offers?.map(off => (
              <span key={off} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px]">
                Offer: {off}
                <button onClick={() => handleRemoveChip('offers', off)} className="hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            ))}

            {appliedFilters.orderIdSearch && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px] font-mono font-bold">
                Order ID: #{normalizeOrderId(appliedFilters.orderIdSearch)}
                <button onClick={() => handleRemoveChip('orderIdSearch')} className="hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            )}
          </div>

          <button
            onClick={handleResetFilters}
            className="text-xs text-purple-400 hover:underline font-bold cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
          >
            <RotateCcw size={12} /> Clear All
          </button>
        </div>
      )}

      {/* 2. OVERVIEW KPI CARDS (MODERN COMPACT DESIGN) */}
      <div id="analytics-overview" className="space-y-3">
        {/* Row 1: Core Performance Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Orders */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-sm transition-all flex flex-col justify-between min-h-[100px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <ShoppingBag size={14} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white font-mono mt-2">
              {totalOrdersCount.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Orders in period</span>
              <button
                type="button"
                onClick={() => handleOpenOrdersFullPage('All Filtered Website Orders', filteredOrders)}
                className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
              >
                View All →
              </button>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-sm transition-all flex flex-col justify-between min-h-[100px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Revenue</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <DollarSign size={14} />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-2">
              ₹{Math.round(totalRevenue).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500">Gross placed order value</div>
          </div>

          {/* Total Units */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-sm transition-all flex flex-col justify-between min-h-[100px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Units</span>
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <Package size={14} />
              </div>
            </div>
            <div className="text-2xl font-bold text-cyan-300 font-mono mt-2">
              {totalUnits.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500">Cumulative items ordered</div>
          </div>

          {/* Avg Order Value */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-sm transition-all flex flex-col justify-between min-h-[100px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg Order Value</span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <CreditCard size={14} />
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-300 font-mono mt-2">
              ₹{avgOrderValue.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500">Average ticket size</div>
          </div>
        </div>

        {/* Row 2: Payment Performance Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Prepaid Orders */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-sm transition-all flex flex-col justify-between min-h-[100px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Prepaid Orders</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-emerald-400 font-mono">{prepaidCount.toLocaleString('en-IN')}</span>
                <span className="text-sm font-bold text-white font-mono">₹{Math.round(prepaidRevenue).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500">Full payment received</div>
          </div>

          {/* Partial COD Orders */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-sm transition-all flex flex-col justify-between min-h-[100px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Partial COD</span>
              <span className="w-2 h-2 rounded-full bg-purple-400" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-purple-300 font-mono">{partialCodCount.toLocaleString('en-IN')}</span>
                <span className="text-sm font-bold text-white font-mono">₹{Math.round(partialCodRevenue).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="text-[10px] text-purple-400/90 font-mono">₹{Math.round(partialCodRemaining).toLocaleString('en-IN')} remaining COD</div>
          </div>

          {/* Full COD Orders */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-sm transition-all flex flex-col justify-between min-h-[100px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Full COD</span>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-amber-400 font-mono">{fullCodCount.toLocaleString('en-IN')}</span>
                <span className="text-sm font-bold text-white font-mono">₹{Math.round(fullCodRevenue).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="text-[10px] text-amber-400/90 font-mono">₹{Math.round(fullCodPending).toLocaleString('en-IN')} COD pending</div>
          </div>

          {/* Total COD Receivable */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-sm transition-all flex flex-col justify-between min-h-[100px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">COD Receivable</span>
              <span className="w-2 h-2 rounded-full bg-pink-400" />
            </div>
            <div className="text-xl font-bold text-pink-300 font-mono mt-2">
              ₹{Math.round(totalCodReceivable).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500">Partial + Full COD pending</div>
          </div>
        </div>
      </div>

      {totalOrdersCount === 0 && !loading ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <AlertCircle size={36} className="text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No orders match the selected date and filters.</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try choosing a different date range or click Reset Filters to view sales activity.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl hover:bg-purple-500 transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* 3. ROW 2: PAYMENT MODE DONUT & REVENUE MIX DONUT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* PAYMENT MODE DONUT CHART */}
            <div 
              id="analytics-payment-mode"
              className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-4 transition-all duration-300 ${
                highlightedSectionId === 'analytics-payment-mode' ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <CreditCard size={17} className="text-purple-400" />
                  <span>Payment Mode Breakdown</span>
                </div>
                <span className="text-xs text-slate-400">Click slice to filter matching orders</span>
              </div>

              <AnalyticsDonutChart
                data={paymentDonutData}
                centerValue={totalOrdersCount}
                centerLabel="TOTAL ORDERS"
                valueFormatter={(val) => val.toLocaleString()}
                selectedSliceName={drillDownPaymentMode}
                onSliceClick={entry => setDrillDownPaymentMode(prev => prev === entry.name ? null : entry.name)}
                emptyMessage="No payment data available for the selected filters"
              />

              <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} orders={paymentMatchingOrders} onOrderDeleted={loadData} />
            </div>

            {/* REVENUE MIX DONUT CHART */}
            <div 
              id="analytics-revenue-mix"
              className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-4 transition-all duration-300 ${
                highlightedSectionId === 'analytics-revenue-mix' ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <DollarSign size={17} className="text-emerald-400" />
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
                centerValue={`₹${Math.round(totalRevenue).toLocaleString('en-IN')}`}
                centerLabel="TOTAL REVENUE"
                valueFormatter={(val) => `₹${val.toLocaleString('en-IN')}`}
                selectedSliceName={revenueMixCardSlice}
                onSliceClick={entry => setRevenueMixCardSlice(prev => prev === entry.name ? null : entry.name)}
                emptyMessage="No revenue data available for the selected filters"
              />

              <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} orders={revenueMixMatchingOrders} onOrderDeleted={loadData} />
            </div>
          </div>

          {/* 4. ROW 3: STATE-WISE SALES DONUT & CITY-WISE SALES DONUT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* STATE-WISE SALES DONUT CHART */}
            <div 
              id="analytics-state"
              className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-4 transition-all duration-300 ${
                highlightedSectionId === 'analytics-state' ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <MapPin size={17} className="text-cyan-400" />
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
                centerValue={stateMetric === 'revenue' ? `₹${Math.round(totalRevenue).toLocaleString('en-IN')}` : stateMetric === 'units' ? totalUnits : totalOrdersCount}
                centerLabel={stateMetric === 'revenue' ? "TOTAL REVENUE" : stateMetric === 'units' ? "TOTAL UNITS" : "TOTAL ORDERS"}
                valueFormatter={(val) => stateMetric === 'revenue' ? `₹${val.toLocaleString('en-IN')}` : val.toLocaleString()}
                selectedSliceName={drillDownState}
                onSliceClick={entry => {
                  if (entry.state && entry.state !== 'Others') {
                    const st = entry.state;
                    setDrillDownState(prev => prev === st ? null : st);
                  }
                }}
                emptyMessage="No state data available for the selected filters"
              />

              <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} orders={stateMatchingOrders} onOrderDeleted={loadData} />

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
                            <td className="py-2 px-3 text-emerald-400">₹{s.revenue.toLocaleString('en-IN')}</td>
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
              className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-4 transition-all duration-300 ${
                highlightedSectionId === 'analytics-city' ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Building2 size={17} className="text-blue-400" />
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
                centerValue={cityMetric === 'revenue' ? `₹${Math.round(totalRevenue).toLocaleString('en-IN')}` : cityMetric === 'units' ? totalUnits : totalOrdersCount}
                centerLabel={cityMetric === 'revenue' ? "TOTAL REVENUE" : cityMetric === 'units' ? "TOTAL UNITS" : "TOTAL ORDERS"}
                valueFormatter={(val) => cityMetric === 'revenue' ? `₹${val.toLocaleString('en-IN')}` : val.toLocaleString()}
                selectedSliceName={drillDownCity}
                onSliceClick={entry => {
                  if (entry.cityState && entry.cityState !== 'Others') {
                    const cs = entry.cityState;
                    setDrillDownCity(prev => prev === cs ? null : cs);
                  }
                }}
                emptyMessage="No city data available for the selected filters"
              />

              <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} orders={cityMatchingOrders} onOrderDeleted={loadData} />
            </div>
          </div>

          {/* 5. ROW 4: PINCODE PERFORMANCE DONUT & PRODUCT PERFORMANCE DONUT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* PINCODE PERFORMANCE DONUT CHART */}
            <div 
              id="analytics-pincode"
              className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-4 transition-all duration-300 ${
                highlightedSectionId === 'analytics-pincode' ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Tag size={17} className="text-amber-400" />
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
                centerValue={pincodeMetric === 'revenue' ? `₹${Math.round(totalRevenue).toLocaleString('en-IN')}` : pincodeMetric === 'units' ? totalUnits : totalOrdersCount}
                centerLabel={pincodeMetric === 'revenue' ? "TOTAL REVENUE" : pincodeMetric === 'units' ? "TOTAL UNITS" : "TOTAL ORDERS"}
                valueFormatter={(val) => pincodeMetric === 'revenue' ? `₹${val.toLocaleString('en-IN')}` : val.toLocaleString()}
                selectedSliceName={pincodeCardSlice}
                onSliceClick={entry => setPincodeCardSlice(prev => prev === entry.name ? null : entry.name)}
                emptyMessage="No pincode data available for the selected filters"
              />

              <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} orders={pincodeMatchingOrders} onOrderDeleted={loadData} />
            </div>

            {/* PRODUCT PERFORMANCE DONUT CHART */}
            <div 
              id="analytics-product"
              className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-4 transition-all duration-300 ${
                highlightedSectionId === 'analytics-product' ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Package size={17} className="text-emerald-400" />
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
                centerValue={productMetric === 'revenue' ? `₹${Math.round(totalRevenue).toLocaleString('en-IN')}` : productMetric === 'orders' ? totalOrdersCount : totalUnits}
                centerLabel={productMetric === 'revenue' ? "TOTAL REVENUE" : productMetric === 'orders' ? "TOTAL ORDERS" : "TOTAL UNITS"}
                valueFormatter={(val) => productMetric === 'revenue' ? `₹${val.toLocaleString('en-IN')}` : val.toLocaleString()}
                selectedSliceName={productCardSlice}
                onSliceClick={entry => setProductCardSlice(prev => prev === entry.name ? null : entry.name)}
                emptyMessage="No product data available for the selected filters"
              />

              <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} orders={productMatchingOrders} onOrderDeleted={loadData} />
            </div>
          </div>

          {/* 6. ROW 5: OFFER PERFORMANCE DONUT & ORDER VALUE DONUT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* OFFER PERFORMANCE DONUT CHART */}
            <div 
              id="analytics-offer"
              className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-4 transition-all duration-300 ${
                highlightedSectionId === 'analytics-offer' ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Tag size={17} className="text-purple-400" />
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
                centerValue={offerMetric === 'revenue' ? `₹${Math.round(totalRevenue).toLocaleString('en-IN')}` : offerMetric === 'units' ? totalUnits : totalOrdersCount}
                centerLabel={offerMetric === 'revenue' ? "TOTAL REVENUE" : offerMetric === 'units' ? "TOTAL UNITS" : "TOTAL ORDERS"}
                valueFormatter={(val) => offerMetric === 'revenue' ? `₹${val.toLocaleString('en-IN')}` : val.toLocaleString()}
                selectedSliceName={offerCardSlice}
                onSliceClick={entry => setOfferCardSlice(prev => prev === entry.name ? null : entry.name)}
                emptyMessage="No offer data available for the selected filters"
              />

              <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} orders={offerMatchingOrders} onOrderDeleted={loadData} />
            </div>

            {/* ORDER VALUE DISTRIBUTION DONUT CHART */}
            <div 
              id="analytics-order-value"
              className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-4 transition-all duration-300 ${
                highlightedSectionId === 'analytics-order-value' ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <ShoppingBag size={17} className="text-pink-400" />
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
                centerValue={orderValueMetric === 'revenue' ? `₹${Math.round(totalRevenue).toLocaleString('en-IN')}` : totalOrdersCount}
                centerLabel={orderValueMetric === 'revenue' ? "TOTAL REVENUE" : "TOTAL ORDERS"}
                valueFormatter={(val) => orderValueMetric === 'revenue' ? `₹${val.toLocaleString('en-IN')}` : val.toLocaleString()}
                selectedSliceName={orderValueCardSlice}
                onSliceClick={entry => setOrderValueCardSlice(prev => prev === entry.name ? null : entry.name)}
                emptyMessage="No order value data available for the selected filters"
              />

              <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} orders={orderValueMatchingOrders} onOrderDeleted={loadData} />
            </div>
          </div>

          {/* 7. ROW 6: ORDER COMPOSITION (TWO DONUT CHARTS) */}
          <div 
            id="analytics-order-composition"
            className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-4 transition-all duration-300 ${
              highlightedSectionId === 'analytics-order-composition' ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <PieIcon size={17} className="text-pink-400" />
                <span>Order Composition</span>
              </div>
              <span className="text-xs text-slate-400">Product & Quantity Breakdown</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* DONUT 1: PRODUCT COMPOSITION */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center">Product Composition</h4>
                <AnalyticsDonutChart
                  data={orderCompositionDonuts.productDonut}
                  centerValue={totalOrdersCount}
                  centerLabel="TOTAL ORDERS"
                  valueFormatter={(val) => val.toLocaleString()}
                  height={220}
                  innerRadius={45}
                  outerRadius={75}
                  selectedSliceName={prodCompCardSlice}
                  onSliceClick={entry => setProdCompCardSlice(prev => prev === entry.name ? null : entry.name)}
                  emptyMessage="No product composition data available"
                />

                <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} title="Product Composition Orders" orders={prodCompMatchingOrders} onOrderDeleted={loadData} />
              </div>

              {/* DONUT 2: QUANTITY COMPOSITION */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center">Quantity Composition</h4>
                <AnalyticsDonutChart
                  data={orderCompositionDonuts.quantityDonut}
                  centerValue={totalOrdersCount}
                  centerLabel="TOTAL ORDERS"
                  valueFormatter={(val) => val.toLocaleString()}
                  height={220}
                  innerRadius={45}
                  outerRadius={75}
                  selectedSliceName={qtyCompCardSlice}
                  onSliceClick={entry => setQtyCompCardSlice(prev => prev === entry.name ? null : entry.name)}
                  emptyMessage="No quantity composition data available"
                />

                <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} title="Quantity Composition Orders" orders={qtyCompMatchingOrders} onOrderDeleted={loadData} />
              </div>
            </div>
          </div>

          {/* 8. ROW 7: COD RECEIVABLE OVERVIEW DONUT CHART */}
          <div 
            id="analytics-cod-receivable"
            className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 shadow-md space-y-4 transition-all duration-300 ${
              highlightedSectionId === 'analytics-cod-receivable' ? 'ring-2 ring-purple-500 shadow-purple-500/40 border-purple-500' : ''
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <DollarSign size={17} className="text-emerald-400" />
                <span>COD Receivable Overview</span>
              </div>
              <span className="text-xs text-slate-400">Advance vs Balance Receivable</span>
            </div>

            <AnalyticsDonutChart
              data={codReceivableDonutData}
              centerValue={`₹${Math.round(partialCodAdvance + totalCodReceivable).toLocaleString('en-IN')}`}
              centerLabel="TOTAL COD VALUE"
              valueFormatter={(val) => `₹${val.toLocaleString('en-IN')}`}
              selectedSliceName={codCardSlice}
              onSliceClick={entry => setCodCardSlice(prev => prev === entry.name ? null : entry.name)}
              emptyMessage="No COD data available for the selected filters"
            />

            <CardMatchingOrdersList onViewAll={handleOpenOrdersFullPage} title="COD Receivable Orders" orders={codMatchingOrders} onOrderDeleted={loadData} />
          </div>

          {/* 9. CUSTOMER PRODUCT ANALYTICS */}
          <CustomerProductAnalyticsSection
            orders={filteredOrders}
            onViewAllCustomers={handleOpenCustomersFullPage}
            highlighted={highlightedSectionId === 'analytics-customer-product'}
          />

          {/* 10. OPERATIONS & FORECASTING */}
          <OperationsForecastingSection
            orders={filteredOrders}
            trackingShipments={trackingShipments}
            onViewAllOperations={handleOpenOperationsFullPage}
            highlighted={highlightedSectionId === 'analytics-operations-forecasting'}
          />
        </>
      )}

        </>
      )}

      {/* ANALYTICS FILTER DRAWER */}
      <AnalyticsFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        activePeriodDisplay={getResolvedDateLabel()}
        allOrders={allOrders}
        batches={batches}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        onApply={handleApplyFilters}
        onResetAll={handleResetFilters}
      />

      {/* DATE RANGE PICKER MODAL */}
      <DateRangePickerModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        startDate={analyticsStartDate}
        endDate={analyticsEndDate}
        onApply={(start, end, preset) => {
          setDateRange(start, end, preset);
          setIsDateModalOpen(false);
        }}
      />

      {/* ORDER DETAILS MODAL */}
      <OrderDetailsModal
        order={selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
        onOrderDeleted={() => {
          setSelectedOrderForModal(null);
          loadData();
        }}
      />
    </div>
  );
};
