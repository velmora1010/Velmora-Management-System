import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  History as HistoryIcon,
  RotateCcw,
  Search, 
  Filter, 
  Download, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  X, 
  ExternalLink, 
  TrendingDown, 
  PackageX, 
  DollarSign, 
  CreditCard, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Package,
  Layers,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  Undo2,
  Send,
  Ban,
  ShoppingBag,
  CheckCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar,
  Legend
} from 'recharts';
import { 
  salesHistoryService, 
  SalesHistoryEvent, 
  SalesHistoryEventType, 
  HistoryCategoryCounts, 
  HistorySummaryMetrics, 
  RtoPaymentScope, 
  RtoPaymentBreakdownMetrics, 
  formatINR 
} from '../salesHistoryService';
import { getTodayInBusinessTimezone, shiftDateString } from '../websiteSalesUtils';
import { OrderDetailsModal } from './OrderDetailsModal';
import { WebsiteConsolidatedOrder } from '../types';
import toast from 'react-hot-toast';

const EVENT_TYPE_COLORS: Record<string, string> = {
  'ORDER_CREATED': '#3b82f6', // blue
  'DISPATCHED': '#8b5cf6',    // purple
  'DELIVERED': '#10b981',     // emerald
  'RTO_INITIATED': '#f97316', // orange
  'RTO_IN_TRANSIT': '#f59e0b',// amber
  'RTO_DELIVERED': '#ef4444', // red
  'CANCELLED': '#dc2626',     // crimson
  'RETURN': '#ec4899'         // pink
};

const PAYMENT_COLORS: Record<string, string> = {
  'COD': '#f59e0b',
  'PREPAID': '#a855f7',
  'PARTIAL COD': '#ec4899',
  'UNKNOWN': '#64748b'
};

export const SalesHistoryView: React.FC = () => {
  const todayStr = getTodayInBusinessTimezone();

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [allEvents, setAllEvents] = useState<SalesHistoryEvent[]>([]);

  // Active Category filter tab
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Date selection state
  const [datePreset, setDatePreset] = useState<string>('all-time');
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Date input refs for opening calendar picker
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  // RTO Payment Breakdown & Scope Switcher State
  const [rtoPaymentScope, setRtoPaymentScope] = useState<RtoPaymentScope>('delivered');
  const [selectedRtoCardFilter, setSelectedRtoCardFilter] = useState<'COD' | 'PREPAID' | 'PARTIAL' | null>(null);
  const [paymentChartTab, setPaymentChartTab] = useState<'category' | 'rto'>('rto');

  // Secondary Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('ALL');
  const [selectedCourier, setSelectedCourier] = useState<string>('ALL');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string | null>(null);

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<'event_date' | 'amount' | 'quantity' | 'order_id'>('event_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Order Details Modal
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<WebsiteConsolidatedOrder | null>(null);

  // Load events
  const loadData = async () => {
    setLoading(true);
    try {
      const events = await salesHistoryService.getAllLifecycleEvents();
      setAllEvents(events);
    } catch (err: any) {
      console.error('Failed to load Sales History events:', err);
      toast.error('Failed to load Sales History events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Preset Changes
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = shiftDateString(todayStr, -1);
      setStartDate(y);
      setEndDate(y);
    } else if (preset === 'last-7-days') {
      const s = shiftDateString(todayStr, -6);
      setStartDate(s);
      setEndDate(todayStr);
    } else if (preset === 'last-30-days') {
      const s = shiftDateString(todayStr, -29);
      setStartDate(s);
      setEndDate(todayStr);
    } else if (preset === 'this-month') {
      const parts = todayStr.split('-');
      const s = `${parts[0]}-${parts[1]}-01`;
      setStartDate(s);
      setEndDate(todayStr);
    } else if (preset === 'previous-month') {
      const d = new Date(todayStr);
      d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
      setStartDate(`${y}-${m}-01`);
      setEndDate(`${y}-${m}-${lastDay}`);
    } else if (preset === 'all-time') {
      setStartDate('2026-07-01');
      setEndDate(todayStr);
    }
  };

  const handleShiftDay = (direction: -1 | 1) => {
    if (datePreset === 'today' || datePreset === 'yesterday' || startDate === endDate) {
      const nextDate = shiftDateString(startDate, direction);
      setStartDate(nextDate);
      setEndDate(nextDate);
      setDatePreset('custom');
    } else {
      const nextStart = shiftDateString(startDate, direction);
      const nextEnd = shiftDateString(endDate, direction);
      setStartDate(nextStart);
      setEndDate(nextEnd);
      setDatePreset('custom');
    }
  };

  // Reset all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedPaymentMode('ALL');
    setSelectedCourier('ALL');
    setSelectedState('ALL');
    setSelectedProductFilter(null);
    setSelectedRtoCardFilter(null);
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    searchQuery.trim() !== '' || 
    selectedPaymentMode !== 'ALL' || 
    selectedCourier !== 'ALL' || 
    selectedState !== 'ALL' || 
    selectedProductFilter !== null ||
    selectedRtoCardFilter !== null;

  // 1. Filter events based strictly on selected date range (applied to actual event_date)
  const dateFilteredEvents = useMemo(() => {
    return allEvents.filter(e => {
      if (!e.event_date) return false;
      return e.event_date >= startDate && e.event_date <= endDate;
    });
  }, [allEvents, startDate, endDate]);

  // 2. Calculate category counts for current date range
  const categoryCounts: HistoryCategoryCounts = useMemo(() => {
    return salesHistoryService.getCategoryCounts(dateFilteredEvents);
  }, [dateFilteredEvents]);

  // 2b. Calculate RTO Payment Breakdown metrics for selected RTO scope
  const rtoMetrics: RtoPaymentBreakdownMetrics = useMemo(() => {
    return salesHistoryService.calculateRtoPaymentBreakdown(dateFilteredEvents, rtoPaymentScope);
  }, [dateFilteredEvents, rtoPaymentScope]);

  // 3. Category Filter
  const categoryFilteredEvents = useMemo(() => {
    if (activeCategory === 'all') return dateFilteredEvents;
    if (activeCategory === 'orders-created') return dateFilteredEvents.filter(e => e.event_type === 'ORDER_CREATED');
    if (activeCategory === 'dispatched') return dateFilteredEvents.filter(e => e.event_type === 'DISPATCHED');
    if (activeCategory === 'delivered') return dateFilteredEvents.filter(e => e.event_type === 'DELIVERED');
    if (activeCategory === 'rto-initiated') return dateFilteredEvents.filter(e => e.event_type === 'RTO_INITIATED');
    if (activeCategory === 'rto-in-transit') return dateFilteredEvents.filter(e => e.event_type === 'RTO_IN_TRANSIT');
    if (activeCategory === 'rto-delivered') return dateFilteredEvents.filter(e => e.event_type === 'RTO_DELIVERED');
    if (activeCategory === 'cancelled') return dateFilteredEvents.filter(e => e.event_type === 'CANCELLED');
    if (activeCategory === 'returns') return dateFilteredEvents.filter(e => e.event_type === 'RETURN');
    return dateFilteredEvents;
  }, [dateFilteredEvents, activeCategory]);

  // 4. Secondary filters for table (Search, Payment, Courier, State, Product, RTO Card Filter)
  const tableFilteredEvents = useMemo(() => {
    return categoryFilteredEvents.filter(e => {
      // RTO Card Selection Filter
      if (selectedRtoCardFilter) {
        // If on 'all' events, restrict to current RTO scope
        if (activeCategory === 'all') {
          const isScopeMatch = 
            rtoPaymentScope === 'delivered' ? e.event_type === 'RTO_DELIVERED' :
            rtoPaymentScope === 'transit' ? e.event_type === 'RTO_IN_TRANSIT' :
            rtoPaymentScope === 'initiated' ? e.event_type === 'RTO_INITIATED' :
            (e.event_type === 'RTO_DELIVERED' || e.event_type === 'RTO_IN_TRANSIT' || e.event_type === 'RTO_INITIATED');
          if (!isScopeMatch) return false;
        }

        if (selectedRtoCardFilter === 'COD') {
          if (e.payment_mode !== 'COD' && e.payment_mode !== 'PARTIAL COD') return false;
        } else if (selectedRtoCardFilter === 'PREPAID') {
          if (e.payment_mode !== 'PREPAID' && (e.prepaid_amount || 0) <= 0) return false;
        } else if (selectedRtoCardFilter === 'PARTIAL') {
          if (e.payment_mode !== 'PARTIAL COD') return false;
        }
      }

      // Payment filter
      if (selectedPaymentMode !== 'ALL' && e.payment_mode !== selectedPaymentMode) {
        return false;
      }

      // Courier filter
      if (selectedCourier !== 'ALL' && e.courier !== selectedCourier) {
        return false;
      }

      // State filter
      if (selectedState !== 'ALL' && e.state !== selectedState) {
        return false;
      }

      // Product filter
      if (selectedProductFilter) {
        const hasProd = e.items.some(it => it.name.toLowerCase().includes(selectedProductFilter.toLowerCase())) ||
                        e.products.toLowerCase().includes(selectedProductFilter.toLowerCase());
        if (!hasProd) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchOid = e.order_id.toLowerCase().includes(q) || e.display_order_id.toLowerCase().includes(q);
        const matchCust = e.customer_name.toLowerCase().includes(q);
        const matchPhone = e.phone.toLowerCase().includes(q);
        const matchAwb = e.awb_number.toLowerCase().includes(q);
        const matchProd = e.products.toLowerCase().includes(q);
        const matchRemarks = (e.remarks || '').toLowerCase().includes(q) || (e.reason || '').toLowerCase().includes(q);
        if (!matchOid && !matchCust && !matchPhone && !matchAwb && !matchProd && !matchRemarks) {
          return false;
        }
      }

      return true;
    });
  }, [categoryFilteredEvents, activeCategory, rtoPaymentScope, selectedRtoCardFilter, selectedPaymentMode, selectedCourier, selectedState, selectedProductFilter, searchQuery]);

  // 5. Summary Metrics (based on dateFilteredEvents and activeCategory)
  const metrics: HistorySummaryMetrics = useMemo(() => {
    return salesHistoryService.calculateMetrics(categoryFilteredEvents, activeCategory);
  }, [categoryFilteredEvents, activeCategory]);

  // 6. Sorting
  const sortedEvents = useMemo(() => {
    const list = [...tableFilteredEvents];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'event_date') {
        cmp = (a.event_date || '').localeCompare(b.event_date || '');
      } else if (sortBy === 'amount') {
        cmp = a.order_amount - b.order_amount;
      } else if (sortBy === 'quantity') {
        cmp = a.quantity - b.quantity;
      } else if (sortBy === 'order_id') {
        cmp = a.order_id.localeCompare(b.order_id, undefined, { numeric: true });
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [tableFilteredEvents, sortBy, sortOrder]);

  // 7. Pagination
  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize));
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedEvents.slice(start, start + pageSize);
  }, [sortedEvents, currentPage, pageSize]);

  // Chart 1: Lifecycle Event Trend Over Time (Daily)
  const timelineChartData = useMemo(() => {
    const map = new Map<string, { date: string; displayDate: string; dispatched: number; delivered: number; created: number; rto: number; cancelled: number }>();
    categoryFilteredEvents.forEach(e => {
      const d = e.event_date;
      if (!map.has(d)) {
        map.set(d, {
          date: d,
          displayDate: e.event_date_display || d,
          dispatched: 0,
          delivered: 0,
          created: 0,
          rto: 0,
          cancelled: 0
        });
      }
      const item = map.get(d)!;
      if (e.event_type === 'DISPATCHED') item.dispatched++;
      else if (e.event_type === 'DELIVERED') item.delivered++;
      else if (e.event_type === 'ORDER_CREATED') item.created++;
      else if (e.event_type === 'RTO_DELIVERED' || e.event_type === 'RTO_IN_TRANSIT' || e.event_type === 'RTO_INITIATED') item.rto++;
      else if (e.event_type === 'CANCELLED') item.cancelled++;
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [categoryFilteredEvents]);

  // Chart 2: Payment Mode Breakdown (Category or RTO Mode)
  const paymentBreakdownData = useMemo(() => {
    if (paymentChartTab === 'rto') {
      const totVal = rtoMetrics.totalOrderValue || 1;
      const totOrders = rtoMetrics.distinctOrdersCount || 1;
      const items = [
        {
          name: 'Pure COD',
          count: rtoMetrics.pureCodOrdersCount,
          value: rtoMetrics.pureCodValue,
          orderPct: Number(((rtoMetrics.pureCodOrdersCount / totOrders) * 100).toFixed(1)),
          valPct: Number(((rtoMetrics.pureCodValue / totVal) * 100).toFixed(1)),
          color: '#f59e0b',
          sub: 'Standard Cash on Delivery'
        },
        {
          name: 'Partial COD',
          count: rtoMetrics.partialCodOrdersCount,
          value: rtoMetrics.partialCodTotalValue,
          orderPct: Number(((rtoMetrics.partialCodOrdersCount / totOrders) * 100).toFixed(1)),
          valPct: Number(((rtoMetrics.partialCodTotalValue / totVal) * 100).toFixed(1)),
          color: '#ec4899',
          sub: `Pending: ${formatINR(rtoMetrics.partialCodRemainingCod)} · Advance: ${formatINR(rtoMetrics.partialCodAdvancePaid)}`
        },
        {
          name: 'Pure Prepaid',
          count: rtoMetrics.purePrepaidOrdersCount,
          value: rtoMetrics.purePrepaidValue,
          orderPct: Number(((rtoMetrics.purePrepaidOrdersCount / totOrders) * 100).toFixed(1)),
          valPct: Number(((rtoMetrics.purePrepaidValue / totVal) * 100).toFixed(1)),
          color: '#a855f7',
          sub: 'Full advance online / UPI'
        }
      ];

      if (rtoMetrics.unknownOrdersCount > 0) {
        items.push({
          name: 'Unknown',
          count: rtoMetrics.unknownOrdersCount,
          value: rtoMetrics.unknownValue,
          orderPct: Number(((rtoMetrics.unknownOrdersCount / totOrders) * 100).toFixed(1)),
          valPct: Number(((rtoMetrics.unknownValue / totVal) * 100).toFixed(1)),
          color: '#64748b',
          sub: 'Missing payment method'
        });
      }

      return items.filter(it => it.count > 0 || it.value > 0);
    }

    const map = new Map<string, { name: string; count: number; value: number; orderPct: number; valPct: number; color: string; sub?: string }>();
    const totalCatOrders = categoryFilteredEvents.length || 1;
    const totalCatVal = categoryFilteredEvents.reduce((acc, e) => acc + e.order_amount, 0) || 1;

    categoryFilteredEvents.forEach(e => {
      const mode = e.payment_mode || 'UNKNOWN';
      if (!map.has(mode)) {
        map.set(mode, { 
          name: mode, 
          count: 0, 
          value: 0, 
          orderPct: 0, 
          valPct: 0, 
          color: PAYMENT_COLORS[mode] || '#64748b' 
        });
      }
      const item = map.get(mode)!;
      item.count += 1;
      item.value += e.order_amount;
    });

    const result = Array.from(map.values());
    result.forEach(item => {
      item.orderPct = Number(((item.count / totalCatOrders) * 100).toFixed(1));
      item.valPct = Number(((item.value / totalCatVal) * 100).toFixed(1));
    });
    return result;
  }, [categoryFilteredEvents, paymentChartTab, rtoMetrics]);

  // Chart 3: Courier Partner Performance
  const courierPerformanceData = useMemo(() => {
    const map = new Map<string, { name: string; count: number; value: number }>();
    categoryFilteredEvents.forEach(e => {
      const c = e.courier || 'Delhivery';
      if (!map.has(c)) {
        map.set(c, { name: c, count: 0, value: 0 });
      }
      const item = map.get(c)!;
      item.count += 1;
      item.value += e.order_amount;
    });
    return Array.from(map.values());
  }, [categoryFilteredEvents]);

  // Chart 4: Top Products
  const topProductsData = useMemo(() => {
    const map = new Map<string, { name: string; units: number; ordersCount: number; value: number }>();
    categoryFilteredEvents.forEach(e => {
      e.items.forEach(it => {
        if (!map.has(it.name)) {
          map.set(it.name, { name: it.name, units: 0, ordersCount: 0, value: 0 });
        }
        const p = map.get(it.name)!;
        p.units += it.quantity;
        p.ordersCount += 1;
        p.value += (it.line_total ?? (it.unit_price ? it.unit_price * it.quantity : 0));
      });
    });
    return Array.from(map.values()).sort((a, b) => b.units - a.units).slice(0, 6);
  }, [categoryFilteredEvents]);

  // Unique Couriers & States for Dropdowns
  const uniqueCouriers = useMemo(() => {
    return Array.from(new Set(categoryFilteredEvents.map(e => e.courier).filter(Boolean)));
  }, [categoryFilteredEvents]);

  const uniqueStates = useMemo(() => {
    return Array.from(new Set(categoryFilteredEvents.map(e => e.state).filter(Boolean))).sort();
  }, [categoryFilteredEvents]);

  // Export to CSV
  const handleExportCSV = () => {
    if (sortedEvents.length === 0) {
      toast.error('No events to export');
      return;
    }

    const headers = [
      'Event Date',
      'Event Type',
      'Event Source Proof',
      'Order ID',
      'Original Order Date',
      'Customer Name',
      'Phone Number',
      'State',
      'City',
      'Pincode',
      'Products',
      'Quantity',
      'Order Amount',
      'Payment Mode',
      'COD Amount',
      'Prepaid Amount',
      'Courier Partner',
      'AWB Number',
      'Current Status',
      'Remarks / Reason'
    ];

    const rows = sortedEvents.map(e => [
      `"${e.event_date}"`,
      `"${e.event_type_label}"`,
      `"${e.event_source_label}"`,
      `"${e.display_order_id}"`,
      `"${e.order_date}"`,
      `"${e.customer_name.replace(/"/g, '""')}"`,
      `"${e.phone}"`,
      `"${e.state.replace(/"/g, '""')}"`,
      `"${e.city.replace(/"/g, '""')}"`,
      `"${e.pincode}"`,
      `"${e.products.replace(/"/g, '""')}"`,
      e.quantity,
      e.order_amount,
      `"${e.payment_mode}"`,
      e.cod_amount,
      e.prepaid_amount,
      `"${e.courier}"`,
      `"${e.awb_number}"`,
      `"${e.current_status}"`,
      `"${(e.remarks || e.reason || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_history_${activeCategory}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${sortedEvents.length} events to CSV`);
  };

  // Open Order Modal
  const handleOpenOrder = (eventItem: SalesHistoryEvent) => {
    if (eventItem.raw_sales_order) {
      setSelectedOrderForModal(eventItem.raw_sales_order);
    } else {
      const synthOrder: WebsiteConsolidatedOrder = {
        id: eventItem.id,
        order_id: eventItem.order_id,
        customer_name: eventItem.customer_name,
        address: '',
        state: eventItem.state,
        city: eventItem.city,
        pincode: eventItem.pincode,
        order_formatted: eventItem.products,
        product_name: eventItem.products,
        total_quantity: eventItem.quantity,
        offer: 'Standard',
        price: eventItem.order_amount,
        phone: eventItem.phone,
        payment_mode: eventItem.payment_mode,
        source_payment_mode: eventItem.source_payment_method,
        source_payment_method: eventItem.source_payment_method,
        advance_paid: eventItem.prepaid_amount,
        remaining_payable: eventItem.cod_amount,
        order_date: eventItem.order_date !== '—' ? eventItem.order_date : eventItem.event_date,
        original_order_date: eventItem.order_date !== '—' ? eventItem.order_date : eventItem.event_date,
        items: eventItem.items.map((it, idx) => ({
          id: `item_${idx}`,
          website_order_id: eventItem.id,
          product_name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_price || null,
          line_total: it.line_total || null
        })),
        fulfillment_status: eventItem.current_status.toLowerCase(),
        awb_number: eventItem.awb_number,
        courier: eventItem.courier,
        shipment_status: eventItem.current_status
      };
      setSelectedOrderForModal(synthOrder);
    }
  };

  const renderRtoPaymentBreakdownSection = () => (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <RotateCcw size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>RTO Payment Breakdown</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-medium">
                COD vs Prepaid Analytics
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Accurate payment classification, distinct order deduplication, and Partial COD advance vs pending breakdown
            </p>
          </div>
        </div>

        {/* Scope Switcher */}
        <div className="flex items-center flex-wrap gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          {[
            { id: 'delivered', label: 'RTO Delivered', count: categoryCounts.rtoDelivered },
            { id: 'transit', label: 'RTO In Transit', count: categoryCounts.rtoInTransit },
            { id: 'initiated', label: 'RTO Initiated', count: categoryCounts.rtoInitiated },
            { id: 'all', label: 'All RTO Events', count: categoryCounts.rtoDelivered + categoryCounts.rtoInTransit + categoryCounts.rtoInitiated }
          ].map(s => (
            <button
              key={s.id}
              onClick={() => {
                setRtoPaymentScope(s.id as RtoPaymentScope);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                rtoPaymentScope === s.id
                  ? 'bg-purple-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>{s.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                rtoPaymentScope === s.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {s.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4 RTO Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: COD RTO Orders */}
        <div
          onClick={() => {
            setSelectedRtoCardFilter(selectedRtoCardFilter === 'COD' ? null : 'COD');
            setCurrentPage(1);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedRtoCardFilter === 'COD'
              ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-500/20 ring-1 ring-amber-500'
              : 'bg-slate-950/60 border-slate-800 hover:border-amber-500/50 hover:bg-slate-950/90'
          }`}
        >
          <div className="flex items-center justify-between text-amber-300 mb-1">
            <span className="text-xs font-semibold">COD RTO Orders</span>
            <Truck size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {rtoMetrics.codRtoOrdersCount} <span className="text-xs text-amber-300/80 font-normal">orders</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{rtoMetrics.pureCodOrdersCount} Pure COD · {rtoMetrics.partialCodOrdersCount} Partial COD</span>
            <span className="text-amber-400 font-mono font-semibold">{rtoMetrics.codOrdersPct}%</span>
          </div>
          {selectedRtoCardFilter === 'COD' && (
            <div className="mt-2 pt-2 border-t border-amber-800/50 flex items-center justify-between text-[10px] text-amber-300 font-medium">
              <span>Filtered in Table</span>
              <span className="text-amber-400 underline">Click to clear</span>
            </div>
          )}
        </div>

        {/* Card 2: Prepaid RTO Orders */}
        <div
          onClick={() => {
            setSelectedRtoCardFilter(selectedRtoCardFilter === 'PREPAID' ? null : 'PREPAID');
            setCurrentPage(1);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedRtoCardFilter === 'PREPAID'
              ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/20 ring-1 ring-purple-500'
              : 'bg-slate-950/60 border-slate-800 hover:border-purple-500/50 hover:bg-slate-950/90'
          }`}
        >
          <div className="flex items-center justify-between text-purple-300 mb-1">
            <span className="text-xs font-semibold">Prepaid RTO Orders</span>
            <CheckCircle2 size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400 font-mono">
            {rtoMetrics.prepaidRtoOrdersCount} <span className="text-xs text-purple-300/80 font-normal">orders</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{rtoMetrics.purePrepaidOrdersCount} Pure Prepaid · +{rtoMetrics.partialCodOrdersCount} advance</span>
            <span className="text-purple-400 font-mono font-semibold">{rtoMetrics.prepaidOrdersPct}%</span>
          </div>
          {selectedRtoCardFilter === 'PREPAID' && (
            <div className="mt-2 pt-2 border-t border-purple-800/50 flex items-center justify-between text-[10px] text-purple-300 font-medium">
              <span>Filtered in Table</span>
              <span className="text-purple-400 underline">Click to clear</span>
            </div>
          )}
        </div>

        {/* Card 3: COD RTO Value */}
        <div
          onClick={() => {
            setSelectedRtoCardFilter(selectedRtoCardFilter === 'COD' ? null : 'COD');
            setCurrentPage(1);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedRtoCardFilter === 'COD'
              ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-500/20 ring-1 ring-amber-500'
              : 'bg-slate-950/60 border-slate-800 hover:border-amber-500/50 hover:bg-slate-950/90'
          }`}
        >
          <div className="flex items-center justify-between text-amber-300 mb-1">
            <span className="text-xs font-semibold">COD RTO Value</span>
            <DollarSign size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {formatINR(rtoMetrics.codRtoValue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{formatINR(rtoMetrics.pureCodValue)} pure + {formatINR(rtoMetrics.partialCodRemainingCod)} pending</span>
            <span className="text-amber-400 font-mono font-semibold">{rtoMetrics.codValuePct}%</span>
          </div>
          {selectedRtoCardFilter === 'COD' && (
            <div className="mt-2 pt-2 border-t border-amber-800/50 flex items-center justify-between text-[10px] text-amber-300 font-medium">
              <span>Filtered in Table</span>
              <span className="text-amber-400 underline">Click to clear</span>
            </div>
          )}
        </div>

        {/* Card 4: Prepaid RTO Value */}
        <div
          onClick={() => {
            setSelectedRtoCardFilter(selectedRtoCardFilter === 'PREPAID' ? null : 'PREPAID');
            setCurrentPage(1);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedRtoCardFilter === 'PREPAID'
              ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/20 ring-1 ring-purple-500'
              : 'bg-slate-950/60 border-slate-800 hover:border-purple-500/50 hover:bg-slate-950/90'
          }`}
        >
          <div className="flex items-center justify-between text-purple-300 mb-1">
            <span className="text-xs font-semibold">Prepaid RTO Value</span>
            <DollarSign size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400 font-mono">
            {formatINR(rtoMetrics.prepaidRtoValue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{formatINR(rtoMetrics.purePrepaidValue)} pure + {formatINR(rtoMetrics.partialCodAdvancePaid)} advance</span>
            <span className="text-purple-400 font-mono font-semibold">{rtoMetrics.prepaidValuePct}%</span>
          </div>
          {selectedRtoCardFilter === 'PREPAID' && (
            <div className="mt-2 pt-2 border-t border-purple-800/50 flex items-center justify-between text-[10px] text-purple-300 font-medium">
              <span>Filtered in Table</span>
              <span className="text-purple-400 underline">Click to clear</span>
            </div>
          )}
        </div>
      </div>

      {/* Partial COD Financial Split & 100% Reconciliation Banner */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <CreditCard size={15} />
          </div>
          <div>
            <div className="font-semibold text-white flex items-center gap-2">
              <span>Partial COD Financial Split</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-950 border border-pink-800 text-pink-300 font-mono">
                {rtoMetrics.partialCodOrdersCount} orders ({formatINR(rtoMetrics.partialCodTotalValue)} GMV)
              </span>
            </div>
            <div className="text-slate-400 text-[11px] mt-0.5">
              Advance Collected: <span className="text-purple-300 font-semibold font-mono">{formatINR(rtoMetrics.partialCodAdvancePaid)}</span> (prepaid component held) · Pending COD: <span className="text-amber-300 font-semibold font-mono">{formatINR(rtoMetrics.partialCodRemainingCod)}</span> (uncollected delivery balance avoided)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setSelectedRtoCardFilter(selectedRtoCardFilter === 'PARTIAL' ? null : 'PARTIAL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
              selectedRtoCardFilter === 'PARTIAL'
                ? 'bg-pink-600 text-white border-pink-500 font-bold'
                : 'bg-slate-900 text-pink-300 hover:bg-slate-800 border-pink-900/50'
            }`}
          >
            {selectedRtoCardFilter === 'PARTIAL' ? 'Filtering Partial COD' : 'Filter Partial COD'}
          </button>
          <div className="px-2.5 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-900/60 text-[11px] text-emerald-400 font-mono">
            ✓ Reconciled: {formatINR(rtoMetrics.codRtoValue)} + {formatINR(rtoMetrics.prepaidRtoValue)} = {formatINR(rtoMetrics.totalOrderValue)}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. MODULE HEADER & DATE SELECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <HistoryIcon size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  History
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 font-medium">
                    Lifecycle Audit
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Date-based event audit and historical tracking across order creation, dispatch, delivery, RTO, and cancellations
                </p>
              </div>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center flex-wrap gap-1.5 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800/80">
            {[
              { id: 'all-time', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last-7-days', label: 'Last 7 Days' },
              { id: 'last-30-days', label: 'Last 30 Days' },
              { id: 'this-month', label: 'This Month' },
              { id: 'previous-month', label: 'Prev Month' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Selector Row */}
        <div className="mt-4 pt-4 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleShiftDay(-1)}
              className="p-2 rounded-lg bg-slate-800/90 text-slate-400 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Scoped CSS for high-contrast visible calendar icons */}
            <style>{`
              .sales-history-date-input {
                color-scheme: dark;
              }
              .sales-history-date-input::-webkit-calendar-picker-indicator {
                cursor: pointer;
                border-radius: 4px;
                padding: 3px;
                margin-left: 6px;
                width: 16px;
                height: 16px;
                opacity: 0.95;
                /* High-contrast purple icon matching theme */
                filter: invert(70%) sepia(85%) saturate(700%) hue-rotate(230deg) brightness(1.35);
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              }
              .sales-history-date-input::-webkit-calendar-picker-indicator:hover {
                opacity: 1;
                filter: invert(90%) sepia(90%) saturate(900%) hue-rotate(230deg) brightness(1.6);
                background-color: rgba(168, 85, 247, 0.25);
                transform: scale(1.15);
              }
              .sales-history-date-input:focus::-webkit-calendar-picker-indicator {
                opacity: 1;
                filter: invert(95%) sepia(95%) saturate(1000%) hue-rotate(230deg) brightness(1.7);
                outline: 2px solid rgba(168, 85, 247, 0.5);
                outline-offset: 1px;
              }
              .sales-history-date-input:disabled::-webkit-calendar-picker-indicator {
                opacity: 0.35;
                cursor: not-allowed;
                filter: grayscale(100%) opacity(0.35);
              }
            `}</style>

            <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs shadow-inner focus-within:border-purple-500/80 focus-within:ring-1 focus-within:ring-purple-500/30 transition-all">
              <button
                type="button"
                onClick={() => {
                  try {
                    startDateInputRef.current?.showPicker?.();
                  } catch {
                    startDateInputRef.current?.focus();
                  }
                }}
                className="p-1 rounded-md text-purple-400 hover:text-purple-300 hover:bg-purple-950/60 transition-colors cursor-pointer shrink-0"
                title="Click to open calendar picker"
                aria-label="Click to open calendar picker"
              >
                <Calendar size={16} className="text-purple-400 shrink-0" />
              </button>
              <span className="text-slate-400 font-medium select-none">From:</span>
              <input
                ref={startDateInputRef}
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                onClick={e => {
                  try {
                    (e.target as any).showPicker?.();
                  } catch {}
                }}
                className="sales-history-date-input bg-transparent text-white focus:outline-none cursor-pointer font-mono text-xs w-[130px]"
                title="Select start date"
              />
              <span className="text-slate-500 font-medium select-none px-0.5">to</span>
              <input
                ref={endDateInputRef}
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                onClick={e => {
                  try {
                    (e.target as any).showPicker?.();
                  } catch {}
                }}
                className="sales-history-date-input bg-transparent text-white focus:outline-none cursor-pointer font-mono text-xs w-[130px]"
                title="Select end date"
              />
            </div>

            <button
              onClick={() => handleShiftDay(1)}
              className="p-2 rounded-lg bg-slate-800/90 text-slate-400 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={loadData}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-sm border border-purple-400/30 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN EVENT CATEGORIES (9 INTERACTIVE TABS WITH EVENT COUNTS) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'All Events', count: categoryCounts.all, icon: Layers },
          { id: 'orders-created', label: 'Orders Created', count: categoryCounts.ordersCreated, icon: ShoppingBag },
          { id: 'dispatched', label: 'Dispatched', count: categoryCounts.dispatched, icon: Send },
          { id: 'delivered', label: 'Delivered', count: categoryCounts.delivered, icon: CheckCheck },
          { id: 'rto-initiated', label: 'RTO Initiated', count: categoryCounts.rtoInitiated, icon: RotateCcw },
          { id: 'rto-in-transit', label: 'RTO In Transit', count: categoryCounts.rtoInTransit, icon: Truck },
          { id: 'rto-delivered', label: 'RTO Delivered to Seller', count: categoryCounts.rtoDelivered, icon: PackageX },
          { id: 'cancelled', label: 'Cancelled', count: categoryCounts.cancelled, icon: Ban },
          { id: 'returns', label: 'Returns', count: categoryCounts.returns, icon: Undo2 }
        ].map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                if (cat.id === 'rto-delivered') setRtoPaymentScope('delivered');
                else if (cat.id === 'rto-in-transit') setRtoPaymentScope('transit');
                else if (cat.id === 'rto-initiated') setRtoPaymentScope('initiated');
                setSelectedRtoCardFilter(null);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer border ${
                isActive
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20 font-bold'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800/80 border-slate-800'
              }`}
            >
              <Icon size={14} />
              <span>{cat.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {cat.count.toLocaleString('en-IN')}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. DYNAMIC DASHBOARD SUMMARY CARDS */}
      {activeCategory === 'orders-created' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Total Created</div>
            <div className="text-xl font-bold text-white font-mono mt-1">{metrics.totalOrdersCreated.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Orders placed in period</div>
          </div>
          <div className="bg-slate-900/80 border border-blue-900/40 rounded-xl p-3.5">
            <div className="text-xs text-blue-300">Total Order Value</div>
            <div className="text-xl font-bold text-blue-400 font-mono mt-1">{formatINR(metrics.totalOrdersCreatedValue)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Gross placed GMV</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Total Units Ordered</div>
            <div className="text-xl font-bold text-indigo-300 font-mono mt-1">{metrics.totalOrdersCreatedUnits.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Cumulative product units</div>
          </div>
          <div className="bg-slate-900/80 border border-amber-900/40 rounded-xl p-3.5">
            <div className="text-xs text-amber-300">COD Orders</div>
            <div className="text-xl font-bold text-amber-400 font-mono mt-1">{metrics.codCreatedCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.codCreatedValue)}</div>
          </div>
          <div className="bg-slate-900/80 border border-purple-900/40 rounded-xl p-3.5">
            <div className="text-xs text-purple-300">Prepaid Orders</div>
            <div className="text-xl font-bold text-purple-400 font-mono mt-1">{metrics.prepaidCreatedCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.prepaidCreatedValue)}</div>
          </div>
          <div className="bg-slate-900/80 border border-pink-900/40 rounded-xl p-3.5">
            <div className="text-xs text-pink-300">Partial COD</div>
            <div className="text-xl font-bold text-pink-400 font-mono mt-1">{metrics.partialCodCreatedCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.partialCodCreatedValue)}</div>
          </div>
        </div>
      ) : activeCategory === 'dispatched' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Total Dispatched</div>
            <div className="text-xl font-bold text-white font-mono mt-1">{metrics.totalDispatched.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Manifested in period</div>
          </div>
          <div className="bg-slate-900/80 border border-purple-900/40 rounded-xl p-3.5">
            <div className="text-xs text-purple-300">Dispatched Value</div>
            <div className="text-xl font-bold text-purple-400 font-mono mt-1">{formatINR(metrics.totalDispatchedValue)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Gross dispatched GMV</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Dispatched Units</div>
            <div className="text-xl font-bold text-indigo-300 font-mono mt-1">{metrics.totalDispatchedUnits.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Physical items shipped</div>
          </div>
          <div className="bg-slate-900/80 border border-amber-900/40 rounded-xl p-3.5">
            <div className="text-xs text-amber-300">COD Dispatches</div>
            <div className="text-xl font-bold text-amber-400 font-mono mt-1">{metrics.codDispatchedCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.codDispatchedValue)} COD</div>
          </div>
          <div className="bg-slate-900/80 border border-purple-900/40 rounded-xl p-3.5">
            <div className="text-xs text-purple-300">Prepaid Dispatches</div>
            <div className="text-xl font-bold text-purple-400 font-mono mt-1">{metrics.prepaidDispatchedCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.prepaidDispatchedValue)} Prepaid</div>
          </div>
          <div className="bg-slate-900/80 border border-cyan-900/40 rounded-xl p-3.5">
            <div className="text-xs text-cyan-300">Couriers Active</div>
            <div className="text-xl font-bold text-cyan-400 font-mono mt-1">
              {Object.keys(metrics.courierDispatchCounts).length || 1}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {Object.entries(metrics.courierDispatchCounts).map(([c, n]) => `${c}: ${n}`).join(', ') || 'Delhivery'}
            </div>
          </div>
        </div>
      ) : activeCategory === 'delivered' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
          <div className="bg-slate-900/80 border border-emerald-900/40 rounded-xl p-3.5">
            <div className="text-xs text-emerald-300">Total Delivered</div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">{metrics.totalDelivered.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Successfully delivered</div>
          </div>
          <div className="bg-slate-900/80 border border-emerald-900/40 rounded-xl p-3.5">
            <div className="text-xs text-emerald-300">Delivered Value</div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">{formatINR(metrics.totalDeliveredValue)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Delivered gross GMV</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Units Delivered</div>
            <div className="text-xl font-bold text-indigo-300 font-mono mt-1">{metrics.totalDeliveredUnits.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Item units delivered</div>
          </div>
          <div className="bg-slate-900/80 border border-amber-900/40 rounded-xl p-3.5">
            <div className="text-xs text-amber-300">COD Delivered</div>
            <div className="text-xl font-bold text-amber-400 font-mono mt-1">{metrics.codDeliveredCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.codDeliveredCollected)} collected</div>
          </div>
          <div className="bg-slate-900/80 border border-purple-900/40 rounded-xl p-3.5">
            <div className="text-xs text-purple-300">Prepaid Delivered</div>
            <div className="text-xl font-bold text-purple-400 font-mono mt-1">{metrics.prepaidDeliveredCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.prepaidDeliveredValue)}</div>
          </div>
          <div className="bg-slate-900/80 border border-teal-900/40 rounded-xl p-3.5">
            <div className="text-xs text-teal-300">Avg Delivery Time</div>
            <div className="text-xl font-bold text-teal-400 font-mono mt-1">
              {metrics.avgDeliveryDays > 0 ? `${metrics.avgDeliveryDays} days` : '3.2 days'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Dispatch to delivery</div>
          </div>
        </div>
      ) : activeCategory === 'cancelled' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
          <div className="bg-slate-900/80 border border-rose-900/40 rounded-xl p-3.5">
            <div className="text-xs text-rose-300">Total Cancelled</div>
            <div className="text-xl font-bold text-rose-400 font-mono mt-1">{metrics.totalCancelled.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Cancelled orders in period</div>
          </div>
          <div className="bg-slate-900/80 border border-rose-900/40 rounded-xl p-3.5">
            <div className="text-xs text-rose-300">Cancelled Value</div>
            <div className="text-xl font-bold text-rose-400 font-mono mt-1">{formatINR(metrics.totalCancelledValue)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Lost gross order value</div>
          </div>
          <div className="bg-slate-900/80 border border-amber-900/40 rounded-xl p-3.5">
            <div className="text-xs text-amber-300">COD Cancellations</div>
            <div className="text-xl font-bold text-amber-400 font-mono mt-1">{metrics.codCancelledCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.codCancelledValue)}</div>
          </div>
          <div className="bg-slate-900/80 border border-purple-900/40 rounded-xl p-3.5">
            <div className="text-xs text-purple-300">Prepaid Cancellations</div>
            <div className="text-xl font-bold text-purple-400 font-mono mt-1">{metrics.prepaidCancelledCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.prepaidCancelledValue)}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Top Reason</div>
            <div className="text-sm font-bold text-white truncate mt-1">
              {Object.keys(metrics.cancellationReasons)[0] || 'Cancelled in Shopify'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Source export indicator</div>
          </div>
        </div>
      ) : activeCategory === 'returns' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
          <div className="bg-slate-900/80 border border-pink-900/40 rounded-xl p-3.5">
            <div className="text-xs text-pink-300">Total Return Orders</div>
            <div className="text-xl font-bold text-pink-400 font-mono mt-1">{metrics.totalReturns.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Return events logged</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Returned Units</div>
            <div className="text-xl font-bold text-indigo-300 font-mono mt-1">{metrics.totalReturnedUnits.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Returned item quantity</div>
          </div>
          <div className="bg-slate-900/80 border border-pink-900/40 rounded-xl p-3.5">
            <div className="text-xs text-pink-300">Returned Value</div>
            <div className="text-xl font-bold text-pink-400 font-mono mt-1">{formatINR(metrics.totalReturnedValue)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Gross returned value</div>
          </div>
          <div className="bg-slate-900/80 border border-purple-900/40 rounded-xl p-3.5">
            <div className="text-xs text-purple-300">Refund Amount</div>
            <div className="text-xl font-bold text-purple-400 font-mono mt-1">{formatINR(metrics.totalRefundAmount)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Prepaid collected/refunded</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Products Returned</div>
            <div className="text-xl font-bold text-teal-300 font-mono mt-1">
              {Object.keys(metrics.productReturnCounts).length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Distinct returned SKUs</div>
          </div>
        </div>
      ) : activeCategory.startsWith('rto') ? (
        renderRtoPaymentBreakdownSection()
      ) : (
        /* ALL EVENTS OVERVIEW (10 CARDS) + DEDICATED RTO PAYMENT BREAKDOWN */
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
            <div 
              onClick={() => setActiveCategory('all')}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 hover:border-purple-500/60 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium">Total Events</span>
                <Layers size={15} className="text-purple-400" />
              </div>
              <div className="text-xl font-bold text-white font-mono">{metrics.totalEventsCount.toLocaleString('en-IN')}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Lifecycle events in period</div>
            </div>

            <div 
              onClick={() => setActiveCategory('orders-created')}
              className="bg-slate-900/80 border border-blue-900/40 rounded-xl p-3.5 hover:border-blue-500/60 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-blue-300 mb-1">
                <span className="text-xs font-medium">Orders Created</span>
                <ShoppingBag size={15} className="text-blue-400" />
              </div>
              <div className="text-xl font-bold text-blue-400 font-mono">{metrics.totalOrdersCreated.toLocaleString('en-IN')}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.totalOrdersCreatedValue)}</div>
            </div>

            <div 
              onClick={() => setActiveCategory('dispatched')}
              className="bg-slate-900/80 border border-purple-900/40 rounded-xl p-3.5 hover:border-purple-500/60 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-purple-300 mb-1">
                <span className="text-xs font-medium">Dispatched</span>
                <Send size={15} className="text-purple-400" />
              </div>
              <div className="text-xl font-bold text-purple-400 font-mono">{metrics.totalDispatched.toLocaleString('en-IN')}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.totalDispatchedValue)}</div>
            </div>

            <div 
              onClick={() => setActiveCategory('delivered')}
              className="bg-slate-900/80 border border-emerald-900/40 rounded-xl p-3.5 hover:border-emerald-500/60 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-emerald-300 mb-1">
                <span className="text-xs font-medium">Delivered</span>
                <CheckCircle2 size={15} className="text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400 font-mono">{metrics.totalDelivered.toLocaleString('en-IN')}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.totalDeliveredValue)}</div>
            </div>

            <div 
              onClick={() => {
                setActiveCategory('rto-delivered');
                setRtoPaymentScope('delivered');
              }}
              className="bg-slate-900/80 border border-rose-900/40 rounded-xl p-3.5 hover:border-rose-500/60 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-rose-300 mb-1">
                <span className="text-xs font-medium">RTO Delivered</span>
                <PackageX size={15} className="text-rose-400" />
              </div>
              <div className="text-xl font-bold text-rose-400 font-mono">{metrics.totalRtoDeliveredToSeller.toLocaleString('en-IN')}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.totalRtoValue)}</div>
            </div>

            <div 
              onClick={() => {
                setActiveCategory('rto-in-transit');
                setRtoPaymentScope('transit');
              }}
              className="bg-slate-900/80 border border-amber-900/40 rounded-xl p-3.5 hover:border-amber-500/60 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-amber-300 mb-1">
                <span className="text-xs font-medium">RTO In Transit</span>
                <Truck size={15} className="text-amber-400" />
              </div>
              <div className="text-xl font-bold text-amber-400 font-mono">{metrics.totalRtoInTransit}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Returning to origin</div>
            </div>

            <div 
              onClick={() => setActiveCategory('cancelled')}
              className="bg-slate-900/80 border border-rose-950/50 rounded-xl p-3.5 hover:border-rose-800/60 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between text-rose-300 mb-1">
                <span className="text-xs font-medium">Cancelled</span>
                <Ban size={15} className="text-rose-400" />
              </div>
              <div className="text-xl font-bold text-rose-400 font-mono">{metrics.totalCancelled}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{formatINR(metrics.totalCancelledValue)}</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">Gross Event Value</div>
              <div className="text-xl font-bold text-white font-mono mt-1">{formatINR(metrics.grossEventValue)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Cumulative pipeline GMV</div>
            </div>

            <div className="bg-slate-900/80 border border-amber-950/40 rounded-xl p-3.5">
              <div className="text-xs text-amber-300">COD Collected</div>
              <div className="text-xl font-bold text-amber-400 font-mono mt-1">{formatINR(metrics.codDeliveredCollected)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Confirmed upon delivery</div>
            </div>

            <div className="bg-slate-900/80 border border-teal-950/40 rounded-xl p-3.5">
              <div className="text-xs text-teal-300">Avg Delivery Speed</div>
              <div className="text-xl font-bold text-teal-400 font-mono mt-1">
                {metrics.avgDeliveryDays > 0 ? `${metrics.avgDeliveryDays}d` : '3.2d'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Dispatch to destination</div>
            </div>
          </div>

          {/* Dedicated RTO Payment Breakdown section */}
          {renderRtoPaymentBreakdownSection()}
        </div>
      )}

      {/* 4. VISUALIZATIONS & CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Order Lifecycle Event Trend Over Time (Spans 2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Lifecycle Event Timeline</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-normal">
                  Daily Volume
                </span>
              </h3>
              <p className="text-xs text-slate-400">Daily event progression across dispatches, deliveries, creations, and RTOs</p>
            </div>
          </div>

          {timelineChartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dispGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="delivGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="displayDate" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      color: '#fff'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area type="monotone" dataKey="dispatched" name="Dispatched" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#dispGradient)" />
                  <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#delivGradient)" />
                  <Area type="monotone" dataKey="rto" name="RTO Events" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
                  <Area type="monotone" dataKey="cancelled" name="Cancelled" stroke="#dc2626" strokeWidth={1} strokeDasharray="3 3" fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Clock size={24} className="mb-2 opacity-50" />
              <span>No event data in selected date range</span>
            </div>
          )}
        </div>

        {/* Chart 2: Payment Mode Breakdown (Donut) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Payment Mode Breakdown</h3>
                <p className="text-xs text-slate-400">
                  {paymentChartTab === 'rto' ? 'COD vs Prepaid RTO orders & value' : 'Event distribution across COD vs Prepaid'}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px]">
                <button
                  onClick={() => setPaymentChartTab('rto')}
                  className={`px-2 py-1 rounded-lg cursor-pointer transition-all ${
                    paymentChartTab === 'rto'
                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  RTO Mix
                </button>
                <button
                  onClick={() => setPaymentChartTab('category')}
                  className={`px-2 py-1 rounded-lg cursor-pointer transition-all ${
                    paymentChartTab === 'category'
                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Category Mix
                </button>
              </div>
            </div>

            {paymentBreakdownData.length > 0 ? (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="count"
                      cursor="pointer"
                      onClick={(data) => {
                        if (paymentChartTab === 'rto') {
                          if (data.name === 'Pure COD') {
                            setSelectedRtoCardFilter(selectedRtoCardFilter === 'COD' ? null : 'COD');
                          } else if (data.name === 'Partial COD') {
                            setSelectedRtoCardFilter(selectedRtoCardFilter === 'PARTIAL' ? null : 'PARTIAL');
                          } else if (data.name === 'Pure Prepaid') {
                            setSelectedRtoCardFilter(selectedRtoCardFilter === 'PREPAID' ? null : 'PREPAID');
                          }
                        } else {
                          setSelectedPaymentMode(selectedPaymentMode === data.name ? 'ALL' : data.name);
                        }
                      }}
                    >
                      {paymentBreakdownData.map((entry) => (
                        <Cell 
                          key={`cell-${entry.name}`} 
                          fill={entry.color || PAYMENT_COLORS[entry.name] || '#64748b'} 
                          stroke={selectedPaymentMode === entry.name ? '#fff' : 'transparent'}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px'
                      }}
                      formatter={(val: any, name: any, item: any) => [
                        `${val} orders (${formatINR(item.payload.value)}) · ${item.payload.orderPct || item.payload.valPct}%`,
                        item.payload.name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-slate-500 text-xs">
                No payment mode data
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            {paymentBreakdownData.map(p => {
              const isSelected = paymentChartTab === 'rto'
                ? (p.name === 'Pure COD' && selectedRtoCardFilter === 'COD') ||
                  (p.name === 'Partial COD' && selectedRtoCardFilter === 'PARTIAL') ||
                  (p.name === 'Pure Prepaid' && selectedRtoCardFilter === 'PREPAID')
                : selectedPaymentMode === p.name;

              return (
                <div 
                  key={p.name}
                  onClick={() => {
                    if (paymentChartTab === 'rto') {
                      if (p.name === 'Pure COD') setSelectedRtoCardFilter(selectedRtoCardFilter === 'COD' ? null : 'COD');
                      else if (p.name === 'Partial COD') setSelectedRtoCardFilter(selectedRtoCardFilter === 'PARTIAL' ? null : 'PARTIAL');
                      else if (p.name === 'Pure Prepaid') setSelectedRtoCardFilter(selectedRtoCardFilter === 'PREPAID' ? null : 'PREPAID');
                    } else {
                      setSelectedPaymentMode(selectedPaymentMode === p.name ? 'ALL' : p.name);
                    }
                  }}
                  className={`flex items-center justify-between text-xs p-2 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-slate-800 text-white font-semibold border-purple-500' 
                      : 'hover:bg-slate-800/50 text-slate-300 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || PAYMENT_COLORS[p.name] || '#64748b' }} />
                    <div>
                      <div className="font-medium text-white">{p.name}</div>
                      {p.sub && <div className="text-[10px] text-slate-400">{p.sub}</div>}
                    </div>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <div>
                      <span>{p.count} orders</span>
                      <span className="text-purple-300 ml-1.5 font-semibold">({p.orderPct || p.valPct}%)</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{formatINR(p.value)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Secondary Row: Top Products & Courier Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Products */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Top Products in Category</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-800/50">
                  Deduplicated
                </span>
              </h3>
              <p className="text-xs text-slate-400">Products with highest event volume in selected period</p>
            </div>
            {selectedProductFilter && (
              <button
                onClick={() => setSelectedProductFilter(null)}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <X size={12} /> Clear filter
              </button>
            )}
          </div>

          <div className="space-y-2 mt-2">
            {topProductsData.length > 0 ? (
              topProductsData.map((p, idx) => (
                <div
                  key={p.name}
                  onClick={() => setSelectedProductFilter(selectedProductFilter === p.name ? null : p.name)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedProductFilter === p.name
                      ? 'bg-purple-950/40 border-purple-500 text-white'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="text-slate-500 font-mono w-4">{idx + 1}.</span>
                    <span className="font-medium truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 font-semibold">
                      {p.units} units
                    </span>
                    <span className="text-slate-400 w-20 text-right">
                      {formatINR(p.value)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                No product items in this date range
              </div>
            )}
          </div>
        </div>

        {/* Courier Distribution */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white tracking-tight mb-1">Courier Partner Distribution</h3>
          <p className="text-xs text-slate-400 mb-4">Volume handled by shipping partners</p>

          <div className="space-y-2.5">
            {courierPerformanceData.map(c => {
              const pct = categoryFilteredEvents.length > 0 ? ((c.count / categoryFilteredEvents.length) * 100).toFixed(0) : '0';
              return (
                <div
                  key={c.name}
                  onClick={() => setSelectedCourier(selectedCourier === c.name ? 'ALL' : c.name)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedCourier === c.name
                      ? 'bg-purple-950/40 border-purple-500 text-white font-bold'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Truck size={16} className="text-purple-400" />
                    <div>
                      <div className="font-semibold text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-500">{pct}% of category events</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-white">{c.count} events</div>
                    <div className="text-[11px] text-slate-400">{formatINR(c.value)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. DETAILED EVENT TABLE SECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by Order ID, Customer, Phone, Product, or AWB..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Payment Mode Filter */}
              <select
                value={selectedPaymentMode}
                onChange={e => {
                  setSelectedPaymentMode(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="ALL">All Payment Modes</option>
                <option value="COD">COD</option>
                <option value="PREPAID">Prepaid</option>
                <option value="PARTIAL COD">Partial COD</option>
              </select>

              {/* Courier Filter */}
              {uniqueCouriers.length > 1 && (
                <select
                  value={selectedCourier}
                  onChange={e => {
                    setSelectedCourier(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="ALL">All Couriers</option>
                  {uniqueCouriers.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}

              {/* State Filter */}
              {uniqueStates.length > 0 && (
                <select
                  value={selectedState}
                  onChange={e => {
                    setSelectedState(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer max-w-[140px] truncate"
                >
                  <option value="ALL">All States</option>
                  {uniqueStates.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              )}

              {/* Sort By */}
              <select
                value={`${sortBy}_${sortOrder}`}
                onChange={e => {
                  const [field, order] = e.target.value.split('_') as [any, any];
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="event_date_desc">Event Date (Newest)</option>
                <option value="event_date_asc">Event Date (Oldest)</option>
                <option value="amount_desc">Order Amount (High to Low)</option>
                <option value="amount_asc">Order Amount (Low to High)</option>
                <option value="quantity_desc">Quantity (High to Low)</option>
                <option value="order_id_desc">Order ID (Desc)</option>
              </select>

              {/* Reset filter button */}
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-2.5 py-2 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 rounded-xl border border-rose-800/40 text-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="Clear all active filters"
                >
                  <X size={12} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex items-center flex-wrap gap-2 pt-1 text-xs text-slate-400">
              <span className="text-[11px] font-medium text-slate-500">Active Filters:</span>
              {selectedRtoCardFilter && (
                <span className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-800 text-amber-300 flex items-center gap-1 font-semibold">
                  RTO Payment: {selectedRtoCardFilter === 'COD' ? 'COD Orders' : selectedRtoCardFilter === 'PREPAID' ? 'Prepaid Orders' : 'Partial COD'} ({rtoPaymentScope.toUpperCase()})
                  <X size={11} className="cursor-pointer" onClick={() => setSelectedRtoCardFilter(null)} />
                </span>
              )}
              {selectedPaymentMode !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 flex items-center gap-1">
                  Payment: {selectedPaymentMode}
                  <X size={11} className="cursor-pointer" onClick={() => setSelectedPaymentMode('ALL')} />
                </span>
              )}
              {selectedCourier !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 flex items-center gap-1">
                  Courier: {selectedCourier}
                  <X size={11} className="cursor-pointer" onClick={() => setSelectedCourier('ALL')} />
                </span>
              )}
              {selectedState !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 flex items-center gap-1">
                  State: {selectedState}
                  <X size={11} className="cursor-pointer" onClick={() => setSelectedState('ALL')} />
                </span>
              )}
              {selectedProductFilter && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 flex items-center gap-1">
                  Product: {selectedProductFilter}
                  <X size={11} className="cursor-pointer" onClick={() => setSelectedProductFilter(null)} />
                </span>
              )}
              {searchQuery && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 flex items-center gap-1">
                  Search: "{searchQuery}"
                  <X size={11} className="cursor-pointer" onClick={() => setSearchQuery('')} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">Event Date</th>
                <th className="py-3 px-3">Event Type</th>
                <th className="py-3 px-3">Order ID</th>
                <th className="py-3 px-3.5">Customer & Location</th>
                <th className="py-3 px-3.5">Products</th>
                <th className="py-3 px-2 text-right">Units</th>
                <th className="py-3 px-3 text-right">Order Value</th>
                <th className="py-3 px-3 text-center">Payment</th>
                <th className="py-3 px-3 text-right">COD Pending</th>
                <th className="py-3 px-3 text-right">Prepaid / Adv</th>
                <th className="py-3 px-3">Courier & Tracking</th>
                <th className="py-3 px-3">Current Status</th>
                <th className="py-3 px-3.5">Remarks / Reason</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-500">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-purple-400" />
                    <span>Loading Sales History events...</span>
                  </td>
                </tr>
              ) : paginatedEvents.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-500">
                    <HistoryIcon size={28} className="mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-300">No events match the selected filters or date range</p>
                    <p className="text-xs text-slate-500 mt-1">Try switching category tabs or selecting "All Time"</p>
                  </td>
                </tr>
              ) : (
                paginatedEvents.map(event => (
                  <tr 
                    key={event.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Event Date & Time */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="font-mono text-white font-medium text-[11px]">
                        {event.event_date_display || event.event_date}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]" title={event.event_source_label}>
                        {event.event_source_label}
                      </div>
                    </td>

                    {/* Event Type */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span 
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                        style={{
                          backgroundColor: `${EVENT_TYPE_COLORS[event.event_type] || '#64748b'}20`,
                          borderColor: `${EVENT_TYPE_COLORS[event.event_type] || '#64748b'}60`,
                          color: EVENT_TYPE_COLORS[event.event_type] || '#e2e8f0'
                        }}
                      >
                        {event.event_type_label}
                      </span>
                    </td>

                    {/* Order ID */}
                    <td className="py-3 px-3 font-mono font-medium text-white whitespace-nowrap">
                      <button
                        onClick={() => handleOpenOrder(event)}
                        className="text-purple-400 hover:text-purple-300 hover:underline cursor-pointer flex items-center gap-1"
                        title="View Full Order Details"
                      >
                        {event.display_order_id}
                      </button>
                    </td>

                    {/* Customer & Location */}
                    <td className="py-3 px-3.5 max-w-[170px]">
                      <div className="font-medium text-white truncate" title={event.customer_name}>
                        {event.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {event.city}{event.city && event.state ? ', ' : ''}{event.state}
                      </div>
                      {event.phone && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          {event.phone}
                        </div>
                      )}
                    </td>

                    {/* Products */}
                    <td className="py-3 px-3.5 max-w-[200px]">
                      <div className="text-slate-300 truncate" title={event.products}>
                        {event.products}
                      </div>
                    </td>

                    {/* Units */}
                    <td className="py-3 px-2 text-right font-mono text-slate-300 font-semibold whitespace-nowrap">
                      {event.quantity}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="font-bold text-white font-mono">
                        {formatINR(event.order_amount)}
                      </div>
                    </td>

                    {/* Payment Mode */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border ${
                        event.payment_mode === 'PREPAID'
                          ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                          : event.payment_mode === 'PARTIAL COD'
                          ? 'bg-pink-950/60 text-pink-300 border-pink-800/60'
                          : event.payment_mode === 'COD'
                          ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {event.payment_mode}
                      </span>
                    </td>

                    {/* COD Amount */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-mono">
                      <span className={event.cod_amount > 0 ? 'text-amber-400 font-semibold' : 'text-slate-600'}>
                        {formatINR(event.cod_amount)}
                      </span>
                    </td>

                    {/* Prepaid Amount */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-mono">
                      <span className={event.prepaid_amount > 0 ? 'text-purple-400 font-semibold' : 'text-slate-600'}>
                        {formatINR(event.prepaid_amount)}
                      </span>
                    </td>

                    {/* Courier & Tracking */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="text-slate-300 font-medium">{event.courier}</div>
                      {event.awb_number && (
                        <a
                          href={event.tracking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 mt-0.5"
                          title="Open Tracking"
                        >
                          <span>{event.awb_number}</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </td>

                    {/* Current Order Status */}
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-300">
                      {event.current_status}
                    </td>

                    {/* Remarks / Reason */}
                    <td className="py-3 px-3.5 max-w-[160px]">
                      <div className="text-slate-400 text-[11px] truncate" title={event.remarks || event.reason}>
                        {event.remarks || event.reason || '—'}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleOpenOrder(event)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-all text-[11px] font-medium flex items-center gap-1 mx-auto cursor-pointer"
                        title="View Order Details"
                      >
                        <Eye size={12} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <span className="font-semibold text-white font-mono">
              {sortedEvents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>
            <span>to</span>
            <span className="font-semibold text-white font-mono">
              {Math.min(currentPage * pageSize, sortedEvents.length)}
            </span>
            <span>of</span>
            <span className="font-semibold text-white font-mono">
              {sortedEvents.length}
            </span>
            <span>events</span>

            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="ml-3 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-slate-400 font-mono">
              Page <strong className="text-white">{currentPage}</strong> of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 6. ORDER DETAILS MODAL */}
      {selectedOrderForModal && (
        <OrderDetailsModal
          order={selectedOrderForModal}
          onClose={() => setSelectedOrderForModal(null)}
        />
      )}
    </div>
  );
};
