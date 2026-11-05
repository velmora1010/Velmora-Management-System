import React, { useState, useEffect, useMemo } from 'react';
import { 
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
  Undo2
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
  Bar 
} from 'recharts';
import { rtoReturnsService, RtoReturnOrderRecord, RtoSummaryMetrics, formatINR } from '../rtoReturnsService';
import { getTodayInBusinessTimezone, shiftDateString } from '../websiteSalesUtils';
import { OrderDetailsModal } from './OrderDetailsModal';
import { WebsiteConsolidatedOrder } from '../types';
import toast from 'react-hot-toast';

const PAYMENT_COLORS: Record<string, string> = {
  'COD': '#f59e0b',
  'PREPAID': '#a855f7',
  'PARTIAL COD': '#ec4899',
  'UNKNOWN': '#64748b'
};

const STAGE_COLORS: Record<string, string> = {
  'Delivered to Seller': '#10b981',
  'RTO - In Transit': '#f59e0b',
  'Initiated': '#3b82f6'
};

export const RtoReturnsHistoryView: React.FC = () => {
  const todayStr = getTodayInBusinessTimezone();

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [allRecords, setAllRecords] = useState<RtoReturnOrderRecord[]>([]);
  
  // Date selection state
  // Default to 'all-time' or last 30 days so users immediately see historical RTO records
  const [datePreset, setDatePreset] = useState<string>('all-time');
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('ALL');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');
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

  // Load records
  const loadData = async () => {
    setLoading(true);
    try {
      const records = await rtoReturnsService.getRtoReturnHistory();
      setAllRecords(records);
    } catch (err: any) {
      console.error('Failed to load RTO records:', err);
      toast.error('Failed to load RTO & Returns history');
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
      setStartDate('2026-08-01');
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
    setSelectedStage('ALL');
    setSelectedCourier('ALL');
    setSelectedState('ALL');
    setSelectedProductFilter(null);
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    searchQuery.trim() !== '' || 
    selectedPaymentMode !== 'ALL' || 
    selectedStage !== 'ALL' || 
    selectedCourier !== 'ALL' || 
    selectedState !== 'ALL' || 
    selectedProductFilter !== null;

  // Filter records based on selected date range (applied strictly to rto_event_date)
  const dateFilteredRecords = useMemo(() => {
    return allRecords.filter(r => {
      if (!r.rto_event_date) return false;
      return r.rto_event_date >= startDate && r.rto_event_date <= endDate;
    });
  }, [allRecords, startDate, endDate]);

  // Secondary filtering for table and interactive chart clicks
  const tableFilteredRecords = useMemo(() => {
    return dateFilteredRecords.filter(r => {
      // Payment mode filter
      if (selectedPaymentMode !== 'ALL' && r.payment_mode !== selectedPaymentMode) {
        return false;
      }

      // Stage filter
      if (selectedStage !== 'ALL' && r.rto_status !== selectedStage) {
        return false;
      }

      // Courier filter
      if (selectedCourier !== 'ALL' && r.courier !== selectedCourier) {
        return false;
      }

      // State filter
      if (selectedState !== 'ALL' && r.state !== selectedState) {
        return false;
      }

      // Product filter
      if (selectedProductFilter) {
        const hasProd = r.items.some(it => it.name.toLowerCase().includes(selectedProductFilter.toLowerCase())) ||
                        r.products.toLowerCase().includes(selectedProductFilter.toLowerCase());
        if (!hasProd) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchOid = r.order_id.toLowerCase().includes(q) || r.display_order_id.toLowerCase().includes(q);
        const matchCust = r.customer_name.toLowerCase().includes(q);
        const matchPhone = r.phone.toLowerCase().includes(q);
        const matchAwb = r.awb_number.toLowerCase().includes(q);
        const matchProd = r.products.toLowerCase().includes(q);
        const matchReason = r.rto_reason.toLowerCase().includes(q);
        if (!matchOid && !matchCust && !matchPhone && !matchAwb && !matchProd && !matchReason) {
          return false;
        }
      }

      return true;
    });
  }, [dateFilteredRecords, selectedPaymentMode, selectedStage, selectedCourier, selectedState, selectedProductFilter, searchQuery]);

  // Summary Metrics (based on dateFilteredRecords)
  const metrics: RtoSummaryMetrics = useMemo(() => {
    return rtoReturnsService.calculateMetrics(dateFilteredRecords, dateFilteredRecords.length);
  }, [dateFilteredRecords]);

  // Sorting
  const sortedRecords = useMemo(() => {
    const list = [...tableFilteredRecords];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'event_date') {
        cmp = (a.rto_event_date || '').localeCompare(b.rto_event_date || '');
      } else if (sortBy === 'amount') {
        cmp = a.order_amount - b.order_amount;
      } else if (sortBy === 'quantity') {
        cmp = a.quantity_returned - b.quantity_returned;
      } else if (sortBy === 'order_id') {
        cmp = a.order_id.localeCompare(b.order_id, undefined, { numeric: true });
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [tableFilteredRecords, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Chart 1: RTO Events Over Time (Daily)
  const timelineChartData = useMemo(() => {
    const countsByDate = new Map<string, { date: string; displayDate: string; count: number; value: number }>();
    dateFilteredRecords.forEach(r => {
      const d = r.rto_event_date;
      if (!countsByDate.has(d)) {
        countsByDate.set(d, {
          date: d,
          displayDate: r.rto_event_date_display || d,
          count: 0,
          value: 0
        });
      }
      const item = countsByDate.get(d)!;
      item.count += 1;
      item.value += r.order_amount;
    });
    return Array.from(countsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [dateFilteredRecords]);

  // Chart 2: Payment Mode Breakdown
  const paymentBreakdownData = useMemo(() => {
    const map = new Map<string, { name: string; count: number; value: number }>();
    dateFilteredRecords.forEach(r => {
      const mode = r.payment_mode || 'UNKNOWN';
      if (!map.has(mode)) {
        map.set(mode, { name: mode, count: 0, value: 0 });
      }
      const item = map.get(mode)!;
      item.count += 1;
      item.value += r.order_amount;
    });
    return Array.from(map.values());
  }, [dateFilteredRecords]);

  // Chart 3: RTO Stage Breakdown
  const stageBreakdownData = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    dateFilteredRecords.forEach(r => {
      const stage = r.rto_status || 'Other';
      if (!map.has(stage)) {
        map.set(stage, { name: stage, count: 0 });
      }
      map.get(stage)!.count += 1;
    });
    return Array.from(map.values());
  }, [dateFilteredRecords]);

  // Chart 4: Top Returned Products
  const topReturnedProducts = useMemo(() => {
    const map = new Map<string, { name: string; units: number; ordersCount: number; value: number }>();
    dateFilteredRecords.forEach(r => {
      r.items.forEach(it => {
        if (!map.has(it.name)) {
          map.set(it.name, { name: it.name, units: 0, ordersCount: 0, value: 0 });
        }
        const p = map.get(it.name)!;
        p.units += it.quantity;
        p.ordersCount += 1;
        p.value += (it.line_total ?? (it.unit_price ? it.unit_price * it.quantity : 0));
      });
    });
    return Array.from(map.values()).sort((a, b) => b.units - a.units).slice(0, 7);
  }, [dateFilteredRecords]);

  // Unique Lists for Dropdown Filters
  const uniqueCouriers = useMemo(() => {
    return Array.from(new Set(dateFilteredRecords.map(r => r.courier).filter(Boolean)));
  }, [dateFilteredRecords]);

  const uniqueStates = useMemo(() => {
    return Array.from(new Set(dateFilteredRecords.map(r => r.state).filter(Boolean))).sort();
  }, [dateFilteredRecords]);

  // Export to CSV
  const handleExportCSV = () => {
    if (sortedRecords.length === 0) {
      toast.error('No RTO records to export');
      return;
    }

    const headers = [
      'Order ID',
      'Order Date',
      'RTO Event Date',
      'Date Type',
      'Customer Name',
      'Phone Number',
      'State',
      'City',
      'Pincode',
      'Products',
      'Quantity Returned',
      'Order Amount',
      'Payment Mode',
      'COD Amount',
      'Prepaid Amount',
      'RTO Status',
      'Courier',
      'AWB Number',
      'RTO Reason'
    ];

    const rows = sortedRecords.map(r => [
      `"${r.display_order_id}"`,
      `"${r.order_date}"`,
      `"${r.rto_event_date}"`,
      `"${r.date_label_type}"`,
      `"${r.customer_name.replace(/"/g, '""')}"`,
      `"${r.phone}"`,
      `"${r.state.replace(/"/g, '""')}"`,
      `"${r.city.replace(/"/g, '""')}"`,
      `"${r.pincode}"`,
      `"${r.products.replace(/"/g, '""')}"`,
      r.quantity_returned,
      r.order_amount,
      `"${r.payment_mode}"`,
      r.cod_amount,
      r.prepaid_amount,
      `"${r.rto_status}"`,
      `"${r.courier}"`,
      `"${r.awb_number}"`,
      `"${r.rto_reason.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rto_returns_history_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${sortedRecords.length} RTO records to CSV`);
  };

  // Open Order Modal handler
  const handleOpenOrder = (record: RtoReturnOrderRecord) => {
    if (record.raw_sales_order) {
      setSelectedOrderForModal(record.raw_sales_order);
    } else {
      // Synthesize Consolidated Order object
      const synthOrder: WebsiteConsolidatedOrder = {
        id: record.id,
        order_id: record.order_id,
        customer_name: record.customer_name,
        address: '',
        state: record.state,
        city: record.city,
        pincode: record.pincode,
        order_formatted: record.products,
        product_name: record.products,
        total_quantity: record.quantity_returned,
        offer: 'Standard',
        price: record.order_amount,
        phone: record.phone,
        payment_mode: record.payment_mode,
        source_payment_mode: record.source_payment_method,
        source_payment_method: record.source_payment_method,
        advance_paid: record.prepaid_amount,
        remaining_payable: record.cod_amount,
        order_date: record.order_date !== '—' ? record.order_date : record.rto_event_date,
        original_order_date: record.order_date !== '—' ? record.order_date : record.rto_event_date,
        items: record.items.map((it, idx) => ({
          id: `item_${idx}`,
          website_order_id: record.id,
          product_name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_price || null,
          line_total: it.line_total || null
        })),
        fulfillment_status: 'rto',
        awb_number: record.awb_number,
        courier: record.courier,
        shipment_status: record.rto_status
      };
      setSelectedOrderForModal(synthOrder);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. HEADER & DATE FILTER CONTROLS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <RotateCcw size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  RTO & Returns History
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 font-medium">
                    Historical Analytics
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Date-based tracking of RTO returns, seller receipts, uncollected COD, and courier scan events
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

            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs">
              <Calendar size={14} className="text-purple-400 shrink-0" />
              <span className="text-slate-400">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent text-white focus:outline-none cursor-pointer font-mono"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent text-white focus:outline-none cursor-pointer font-mono"
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

      {/* 2. 10 SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
        {/* Card 1: Total RTO Orders */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Total RTO Orders</span>
            <PackageX size={15} className="text-rose-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {metrics.totalRtoOrders.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Events in selected period
          </div>
        </div>

        {/* Card 2: RTO Delivered to Seller */}
        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-xl p-3.5 hover:border-emerald-800/60 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium text-emerald-400">Delivered to Seller</span>
            <CheckCircle2 size={15} className="text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {metrics.rtoDeliveredToSeller.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Parcels returned & received
          </div>
        </div>

        {/* Card 3: Total Products Returned */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Products Returned</span>
            <Package size={15} className="text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-indigo-300 font-mono">
            {metrics.totalProductsReturned.toLocaleString('en-IN')} units
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Cumulative item quantity
          </div>
        </div>

        {/* Card 4: RTO Order Value */}
        <div className="bg-slate-900/80 border border-rose-950/50 rounded-xl p-3.5 hover:border-rose-900/70 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium text-rose-300">RTO Order Value</span>
            <DollarSign size={15} className="text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400 font-mono">
            {formatINR(metrics.rtoOrderValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Gross returned GMV
          </div>
        </div>

        {/* Card 5: COD Amount */}
        <div className="bg-slate-900/80 border border-amber-950/40 rounded-xl p-3.5 hover:border-amber-900/60 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium text-amber-300">RTO COD Value</span>
            <CreditCard size={15} className="text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {formatINR(metrics.codAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Uncollected upon return
          </div>
        </div>

        {/* Card 6: Prepaid Amount */}
        <div className="bg-slate-900/80 border border-purple-950/40 rounded-xl p-3.5 hover:border-purple-900/60 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium text-purple-300">RTO Prepaid Value</span>
            <CreditCard size={15} className="text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-400 font-mono">
            {formatINR(metrics.prepaidAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Collected advance/online
          </div>
        </div>

        {/* Card 7: COD Recoverable / Collected */}
        <div className="bg-slate-900/80 border border-cyan-950/40 rounded-xl p-3.5 hover:border-cyan-900/60 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium text-cyan-300">Payment Balance</span>
            <DollarSign size={15} className="text-cyan-400" />
          </div>
          <div className="text-sm font-semibold text-white">
            <span className="text-amber-400 font-mono">{formatINR(metrics.codUncollected)}</span>
            <span className="text-slate-500 text-xs font-normal"> pending</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            <span className="text-purple-400 font-mono">{formatINR(metrics.prepaidCollected)}</span> advance held
          </div>
        </div>

        {/* Card 8: RTO Average Order Value */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium">RTO Avg Value (AOV)</span>
            <TrendingDown size={15} className="text-teal-400" />
          </div>
          <div className="text-xl font-bold text-teal-300 font-mono">
            {formatINR(metrics.rtoAvgValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Avg ticket size of RTOs
          </div>
        </div>

        {/* Card 9: RTO Rate */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium">RTO Percentage</span>
            <HelpCircle size={14} className="text-slate-500" title="Calculated as RTO Orders / Period Orders" />
          </div>
          <div className="text-xl font-bold text-rose-400 font-mono">
            {metrics.rtoRate > 0 ? `${metrics.rtoRate}%` : '100%'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Of returned shipment cohort
          </div>
        </div>

        {/* Card 10: RTO In Transit / Initiated */}
        <div className="bg-slate-900/80 border border-amber-950/40 rounded-xl p-3.5 hover:border-amber-900/60 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium text-amber-300">RTO In Transit</span>
            <Truck size={15} className="text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {metrics.rtoInTransit.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Shipments returning to seller
          </div>
        </div>
      </div>

      {/* 3. VISUALIZATIONS & CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: RTO Events Over Time (Spans 2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>RTO Events Over Time</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-normal">
                  Daily Volume
                </span>
              </h3>
              <p className="text-xs text-slate-400">RTO event count and returned value trends</p>
            </div>
          </div>

          {timelineChartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rtoCountGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="displayDate" 
                    stroke="#64748b" 
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      color: '#fff'
                    }}
                    formatter={(val: any, name: any) => [
                      name === 'count' ? `${val} orders` : formatINR(val),
                      name === 'count' ? 'RTO Orders' : 'Returned Value'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#rtoCountGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Clock size={24} className="mb-2 opacity-50" />
              <span>No RTO timeline data for the selected period</span>
            </div>
          )}
        </div>

        {/* Chart 2: Payment Mode Breakdown (Donut) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white tracking-tight">Payment Mode Breakdown</h3>
              <span className="text-[11px] text-slate-400">Click to filter</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">RTO distribution across COD vs Prepaid</p>

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
                        if (selectedPaymentMode === data.name) {
                          setSelectedPaymentMode('ALL');
                        } else {
                          setSelectedPaymentMode(data.name);
                        }
                      }}
                    >
                      {paymentBreakdownData.map((entry) => (
                        <Cell 
                          key={`cell-${entry.name}`} 
                          fill={PAYMENT_COLORS[entry.name] || '#64748b'} 
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
                        `${val} orders (${formatINR(item.payload.value)})`,
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
            {paymentBreakdownData.map(p => (
              <div 
                key={p.name}
                onClick={() => setSelectedPaymentMode(selectedPaymentMode === p.name ? 'ALL' : p.name)}
                className={`flex items-center justify-between text-xs p-1.5 rounded-lg cursor-pointer transition-all ${
                  selectedPaymentMode === p.name ? 'bg-slate-800 text-white font-semibold' : 'hover:bg-slate-800/50 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[p.name] || '#64748b' }} />
                  <span>{p.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span>{p.count} orders</span>
                  <span className="text-slate-500">({formatINR(p.value)})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Breakdown Row: Top Returned Products & RTO Stages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Returned Products */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Top Returned Products</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-800/50">
                  Deduplicated
                </span>
              </h3>
              <p className="text-xs text-slate-400">Products with highest return volume</p>
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
            {topReturnedProducts.length > 0 ? (
              topReturnedProducts.map((p, idx) => (
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
                    <span className="text-slate-400 w-16 text-right">
                      {p.ordersCount} orders
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                No product return records in this date range
              </div>
            )}
          </div>
        </div>

        {/* Courier & Status Stages */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white tracking-tight mb-1">RTO Status & Courier Summary</h3>
          <p className="text-xs text-slate-400 mb-4">Stage transitions and delivery distribution</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {stageBreakdownData.map(st => (
              <div
                key={st.name}
                onClick={() => setSelectedStage(selectedStage === st.name ? 'ALL' : st.name)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedStage === st.name
                    ? 'bg-slate-800 border-purple-500 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: STAGE_COLORS[st.name] || '#64748b' }} 
                  />
                  <span className="text-xs text-slate-300 font-medium truncate">{st.name}</span>
                </div>
                <div className="text-lg font-bold text-white font-mono">{st.count} orders</div>
              </div>
            ))}
          </div>

          {/* Courier distribution */}
          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Courier Partners</span>
              <span>Distribution</span>
            </div>
            <div className="space-y-1.5">
              {uniqueCouriers.map(c => {
                const count = dateFilteredRecords.filter(r => r.courier === c).length;
                const pct = dateFilteredRecords.length > 0 ? ((count / dateFilteredRecords.length) * 100).toFixed(0) : '0';
                return (
                  <div
                    key={c}
                    onClick={() => setSelectedCourier(selectedCourier === c ? 'ALL' : c)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                      selectedCourier === c ? 'bg-slate-800 text-white font-bold' : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Truck size={14} className="text-purple-400" />
                      <span>{c}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span>{count} orders</span>
                      <span className="text-slate-500">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. DETAILED HISTORY TABLE SECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Table Controls Toolbar */}
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

              {/* Stage Filter */}
              <select
                value={selectedStage}
                onChange={e => {
                  setSelectedStage(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="ALL">All RTO Stages</option>
                <option value="Delivered to Seller">Delivered to Seller</option>
                <option value="RTO - In Transit">RTO - In Transit</option>
                <option value="Initiated">Initiated</option>
              </select>

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

              {/* Clear filters pill */}
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
              {selectedPaymentMode !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 flex items-center gap-1">
                  Payment: {selectedPaymentMode}
                  <X size={11} className="cursor-pointer" onClick={() => setSelectedPaymentMode('ALL')} />
                </span>
              )}
              {selectedStage !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300 flex items-center gap-1">
                  Stage: {selectedStage}
                  <X size={11} className="cursor-pointer" onClick={() => setSelectedStage('ALL')} />
                </span>
              )}
              {selectedState !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 flex items-center gap-1">
                  State: {selectedState}
                  <X size={11} className="cursor-pointer" onClick={() => setSelectedState('ALL')} />
                </span>
              )}
              {selectedProductFilter && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 flex items-center gap-1">
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
                <th className="py-3 px-3.5">Order ID</th>
                <th className="py-3 px-3">Order Date</th>
                <th className="py-3 px-3">RTO Event Date</th>
                <th className="py-3 px-3.5">Customer & Location</th>
                <th className="py-3 px-3.5">Products Returned</th>
                <th className="py-3 px-3 text-right">Units</th>
                <th className="py-3 px-3.5 text-right">Order Amount</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3">Status / Stage</th>
                <th className="py-3 px-3">Courier & Tracking</th>
                <th className="py-3 px-3.5">RTO Remarks / Reason</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-purple-400" />
                    <span>Loading RTO & Returns history...</span>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    <PackageX size={28} className="mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-300">No RTO orders match the selected filters or date range</p>
                    <p className="text-xs text-slate-500 mt-1">Try selecting a broader date preset such as "All Time" or "Last 30 Days"</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => (
                  <tr 
                    key={record.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Order ID */}
                    <td className="py-3 px-3.5 font-mono font-medium text-white whitespace-nowrap">
                      <button
                        onClick={() => handleOpenOrder(record)}
                        className="text-purple-400 hover:text-purple-300 hover:underline cursor-pointer flex items-center gap-1"
                        title="View Full Order Details"
                      >
                        {record.display_order_id}
                      </button>
                    </td>

                    {/* Order Date */}
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                      {record.order_date}
                    </td>

                    {/* RTO Event Date */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-mono text-white font-medium text-[11px]">
                        {record.rto_event_date_display || record.rto_event_date}
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {record.date_label_type === 'DELIVERED_TO_SELLER' ? (
                          <span className="text-emerald-400 font-medium">Delivered to Seller</span>
                        ) : record.date_label_type === 'STATUS_TRANSITION' ? (
                          <span className="text-amber-400 font-medium">Status Transition Date</span>
                        ) : (
                          <span className="text-slate-500">Dispatch Fallback</span>
                        )}
                      </div>
                    </td>

                    {/* Customer & Location */}
                    <td className="py-3 px-3.5 max-w-[180px]">
                      <div className="font-medium text-white truncate" title={record.customer_name}>
                        {record.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {record.city}{record.city && record.state ? ', ' : ''}{record.state}
                      </div>
                      {record.phone && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          {record.phone}
                        </div>
                      )}
                    </td>

                    {/* Products Returned */}
                    <td className="py-3 px-3.5 max-w-[220px]">
                      <div className="text-slate-300 truncate" title={record.products}>
                        {record.products}
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-3 text-right font-mono text-slate-300 font-semibold whitespace-nowrap">
                      {record.quantity_returned}
                    </td>

                    {/* Order Amount */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="font-bold text-white font-mono">
                        {formatINR(record.order_amount)}
                      </div>
                      {record.payment_mode === 'PARTIAL COD' && (
                        <div className="text-[10px] text-slate-400">
                          <span className="text-purple-300 font-mono">₹{record.prepaid_amount}</span> / <span className="text-amber-300 font-mono">₹{record.cod_amount}</span>
                        </div>
                      )}
                    </td>

                    {/* Payment Mode */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border ${
                        record.payment_mode === 'PREPAID'
                          ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                          : record.payment_mode === 'PARTIAL COD'
                          ? 'bg-pink-950/60 text-pink-300 border-pink-800/60'
                          : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                      }`}>
                        {record.payment_mode}
                      </span>
                    </td>

                    {/* Status / Stage */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        record.rto_status === 'Delivered to Seller'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          : record.rto_status === 'RTO - In Transit'
                          ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                          : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                      }`}>
                        {record.rto_status}
                      </span>
                    </td>

                    {/* Courier & Tracking */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="text-slate-300 font-medium">{record.courier}</div>
                      {record.awb_number && (
                        <a
                          href={record.tracking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 mt-0.5"
                          title="Open Courier Tracking"
                        >
                          <span>{record.awb_number}</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </td>

                    {/* RTO Remarks / Reason */}
                    <td className="py-3 px-3.5 max-w-[180px]">
                      <div className="text-slate-400 text-[11px] truncate" title={record.rto_reason}>
                        {record.rto_reason}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleOpenOrder(record)}
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

        {/* Table Footer with Pagination */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <span className="font-semibold text-white font-mono">
              {sortedRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>
            <span>to</span>
            <span className="font-semibold text-white font-mono">
              {Math.min(currentPage * pageSize, sortedRecords.length)}
            </span>
            <span>of</span>
            <span className="font-semibold text-white font-mono">
              {sortedRecords.length}
            </span>
            <span>RTO orders</span>

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

      {/* 5. ORDER DETAILS MODAL */}
      {selectedOrderForModal && (
        <OrderDetailsModal
          order={selectedOrderForModal}
          onClose={() => setSelectedOrderForModal(null)}
        />
      )}
    </div>
  );
};
