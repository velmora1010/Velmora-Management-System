import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  TrendingUp, 
  Package, 
  Users, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Download, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import type { WebsiteConsolidatedOrder, WebsiteUploadBatch } from './types';
import { websiteSalesService } from './websiteSalesService';
import { useWebsiteSalesDateRange } from './context/WebsiteSalesDateRangeContext';
import { DateRangePickerModal, DateRangePreset } from './components/DateRangePickerModal';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import { SalesRevenueIntelligenceSection } from './components/SalesRevenueIntelligenceSection';
import { ProductPerformanceSection } from './components/ProductPerformanceSection';
import { CustomerIntelligenceSection } from './components/CustomerIntelligenceSection';
import { 
  getTodayInBusinessTimezone, 
  formatSalesDateShort, 
  formatSalesDateDisplay,
  shiftDateString,
  calculateDaysBetween
} from './websiteSalesUtils';
import toast from 'react-hot-toast';

export type AnalyticsSectionType = 'sales' | 'products' | 'customers';

export const WebsiteAnalytics: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Main Section State
  const [activeSection, setActiveSection] = useState<AnalyticsSectionType>('sales');

  // Shared Date Range Context
  const { 
    startDate: analyticsStartDate, 
    endDate: analyticsEndDate, 
    setDateRange,
    shiftRange 
  } = useWebsiteSalesDateRange();

  // Modal States
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<WebsiteConsolidatedOrder | null>(null);

  // Data Loading States
  const [orders, setOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [previousOrders, setPreviousOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Compute previous equivalent period dates
  const { prevStartDate, prevEndDate } = useMemo(() => {
    const days = calculateDaysBetween(analyticsStartDate, analyticsEndDate);
    const pEnd = shiftDateString(analyticsStartDate, -1);
    const pStart = shiftDateString(pEnd, -(days - 1));
    return { prevStartDate: pStart, prevEndDate: pEnd };
  }, [analyticsStartDate, analyticsEndDate]);

  // Load Data for Current Period and Previous Period
  const loadData = async () => {
    setLoading(true);
    try {
      const bList = await websiteSalesService.getUploadBatches();
      setBatches(bList);

      const [currentData, prevData] = await Promise.all([
        websiteSalesService.getConsolidatedOrders({
          startDate: analyticsStartDate,
          endDate: analyticsEndDate
        }),
        websiteSalesService.getConsolidatedOrders({
          startDate: prevStartDate,
          endDate: prevEndDate
        })
      ]);

      setOrders(currentData);
      setPreviousOrders(prevData);
    } catch (err: any) {
      console.error('Failed to load analytics data:', err);
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from && to && from.match(/^\d{4}-\d{2}-\d{2}$/) && to.match(/^\d{4}-\d{2}-\d{2}$/)) {
      if (from !== analyticsStartDate || to !== analyticsEndDate) {
        setDateRange(from, to, 'custom');
      }
    }
  }, [analyticsStartDate, analyticsEndDate, prevStartDate, prevEndDate]);

  // --- SUMMARY METRICS FOR NAVIGATION CARDS ---
  const navMetrics = useMemo(() => {
    // 01 Sales & Revenue Summary
    const grossSales = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
    const totalOrdersCount = orders.length;

    // 02 Product Performance Summary
    let totalUnits = 0;
    const prodCounts: Record<string, number> = {};
    orders.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach(it => {
          totalUnits += it.quantity || 1;
          const p = (it.product_name || 'Item').trim();
          prodCounts[p] = (prodCounts[p] || 0) + (it.quantity || 1);
        });
      } else {
        totalUnits += o.total_quantity || 1;
        const p = (o.product_name || 'Item').trim();
        prodCounts[p] = (prodCounts[p] || 0) + (o.total_quantity || 1);
      }
    });

    const sortedProds = Object.entries(prodCounts).sort((a, b) => b[1] - a[1]);
    const topProdName = sortedProds.length > 0 ? sortedProds[0][0] : 'N/A';

    // 03 Customer Intelligence Summary
    const custSet = new Set<string>();
    const custOrderCounts: Record<string, number> = {};
    orders.forEach(o => {
      const rawDigits = String(o.phone || '').replace(/\D/g, '');
      const cleanPhone = rawDigits.length === 12 && rawDigits.startsWith('91')
        ? rawDigits.slice(2)
        : (rawDigits.length === 11 && rawDigits.startsWith('0') ? rawDigits.slice(1) : rawDigits);
      const key = cleanPhone || (o.customer_name || 'unknown').toLowerCase().trim();
      custSet.add(key);
      custOrderCounts[key] = (custOrderCounts[key] || 0) + 1;
    });

    const uniqueCustomers = custSet.size;
    const repeatCustomers = Object.values(custOrderCounts).filter(c => c > 1).length;
    const repeatRate = uniqueCustomers > 0 ? ((repeatCustomers / uniqueCustomers) * 100).toFixed(1) : '0';

    return {
      grossSales,
      totalOrdersCount,
      totalUnits,
      topProdName,
      uniqueCustomers,
      repeatRate
    };
  }, [orders]);

  // Export report to CSV
  const handleExportCSV = () => {
    if (orders.length === 0) {
      toast.error('No orders available to export in selected date range.');
      return;
    }

    const headers = [
      'Order ID',
      'Order Date',
      'Customer Name',
      'Phone',
      'State',
      'City',
      'Pincode',
      'Products',
      'Total Quantity',
      'Payment Mode',
      'Order Total (INR)',
      'Fulfillment Status',
      'Dispatch Status'
    ];

    const csvRows = [headers.join(',')];

    orders.forEach(o => {
      const row = [
        `"${o.order_id}"`,
        `"${o.order_date}"`,
        `"${(o.customer_name || '').replace(/"/g, '""')}"`,
        `"${o.phone || ''}"`,
        `"${(o.state || '').replace(/"/g, '""')}"`,
        `"${(o.city || '').replace(/"/g, '""')}"`,
        `"${o.pincode || ''}"`,
        `"${(o.product_name || o.order_formatted || '').replace(/"/g, '""')}"`,
        o.total_quantity || 1,
        `"${o.payment_mode || ''}"`,
        Number(o.price) || 0,
        `"${o.fulfillment_status || 'unfulfilled'}"`,
        `"${o.dispatch_status || 'UNFULFILLED'}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Website_Sales_Report_${analyticsStartDate}_to_${analyticsEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Sales report downloaded successfully!');
  };

  const getResolvedDateLabel = () => {
    const todayStr = getTodayInBusinessTimezone();
    if (analyticsStartDate === todayStr && analyticsEndDate === todayStr) return 'Today';
    if (analyticsStartDate === analyticsEndDate) return formatSalesDateShort(analyticsStartDate);
    return `${formatSalesDateShort(analyticsStartDate)} – ${formatSalesDateShort(analyticsEndDate)}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. TOP HEADER & DATE RANGE CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            Website Sales Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Understand revenue, products, and customer behaviour
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector Pill */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={() => shiftRange(-1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
              title="Previous period"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={() => setIsDateModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white hover:text-purple-300 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Calendar size={14} className="text-purple-400" />
              <span>{getResolvedDateLabel()}</span>
            </button>

            <button
              type="button"
              onClick={() => shiftRange(1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
              title="Next period"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-purple-400' : ''} />
          </button>

          {/* Export Report Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-xl border border-slate-700/80 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            title="Export filtered orders report to CSV"
          >
            <Download size={14} className="text-purple-300" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 2. THREE MAIN ANALYTICS NAVIGATION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 01 — Sales & Revenue Intelligence */}
        <div
          onClick={() => setActiveSection('sales')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeSection === 'sales'
              ? 'bg-gradient-to-b from-purple-950/40 to-slate-900 border-purple-500 shadow-xl shadow-purple-600/10 ring-1 ring-purple-500/30'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeSection === 'sales'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-800/80 text-purple-400 group-hover:bg-slate-800'
            }`}>
              <TrendingUp size={20} />
            </div>
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
              activeSection === 'sales'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}>
              01
            </span>
          </div>

          <div className="mt-3.5 space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Sales & Revenue Intelligence
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Revenue trends, order performance and sales growth
            </p>
          </div>

          {/* Real Summary KPI Pill */}
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Gross Sales</span>
            <span className="font-mono font-bold text-cyan-400">
              ₹{Math.round(navMetrics.grossSales).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Card 02 — Product Performance Analytics */}
        <div
          onClick={() => setActiveSection('products')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeSection === 'products'
              ? 'bg-gradient-to-b from-purple-950/40 to-slate-900 border-purple-500 shadow-xl shadow-purple-600/10 ring-1 ring-purple-500/30'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeSection === 'products'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-800/80 text-cyan-400 group-hover:bg-slate-800'
            }`}>
              <Package size={20} />
            </div>
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
              activeSection === 'products'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}>
              02
            </span>
          </div>

          <div className="mt-3.5 space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Product Performance Analytics
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Best sellers, product revenue and product trends
            </p>
          </div>

          {/* Real Summary KPI Pill */}
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Units Sold</span>
            <span className="font-mono font-bold text-emerald-400">
              {navMetrics.totalUnits.toLocaleString('en-IN')} units
            </span>
          </div>
        </div>

        {/* Card 03 — Customer Intelligence */}
        <div
          onClick={() => setActiveSection('customers')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeSection === 'customers'
              ? 'bg-gradient-to-b from-purple-950/40 to-slate-900 border-purple-500 shadow-xl shadow-purple-600/10 ring-1 ring-purple-500/30'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeSection === 'customers'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-800/80 text-indigo-400 group-hover:bg-slate-800'
            }`}>
              <Users size={20} />
            </div>
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
              activeSection === 'customers'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}>
              03
            </span>
          </div>

          <div className="mt-3.5 space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Customer Intelligence
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Customer behaviour, repeat purchases and customer value
            </p>
          </div>

          {/* Real Summary KPI Pill */}
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Unique Buyers</span>
            <span className="font-mono font-bold text-purple-300">
              {navMetrics.uniqueCustomers.toLocaleString('en-IN')} ({navMetrics.repeatRate}% repeat)
            </span>
          </div>
        </div>
      </div>

      {/* 3. ACTIVE SECTION VIEW */}
      {loading ? (
        <div className="p-16 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={24} className="animate-spin text-purple-400" />
          <p className="text-xs text-slate-400 font-medium">
            Loading business intelligence metrics for {getResolvedDateLabel()}...
          </p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-200">
          {activeSection === 'sales' && (
            <SalesRevenueIntelligenceSection
              orders={orders}
              previousOrders={previousOrders}
              startDate={analyticsStartDate}
              endDate={analyticsEndDate}
              onSelectOrder={setSelectedOrderForModal}
            />
          )}

          {activeSection === 'products' && (
            <ProductPerformanceSection
              orders={orders}
              onSelectOrder={setSelectedOrderForModal}
            />
          )}

          {activeSection === 'customers' && (
            <CustomerIntelligenceSection
              orders={orders}
              startDate={analyticsStartDate}
              endDate={analyticsEndDate}
              onSelectOrder={setSelectedOrderForModal}
            />
          )}
        </div>
      )}

      {/* Date Range Picker Modal */}
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

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={!!selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
        order={selectedOrderForModal}
      />
    </div>
  );
};
