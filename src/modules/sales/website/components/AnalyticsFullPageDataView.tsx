import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShoppingBag,
  Users,
  Truck,
  RotateCcw,
  IndianRupee,
  Layers,
  Calendar
} from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';
import { AnalyticsProductCell } from './AnalyticsProductCell';
import { OrderDetailsModal } from './OrderDetailsModal';
import { resolveCanonicalLocation } from '../websiteSalesUtils';
import { websiteSalesService } from '../websiteSalesService';
import toast from 'react-hot-toast';

export interface CustomerPurchaseProfile {
  customerKey: string;
  customerName: string;
  phone: string;
  totalOrders: number;
  totalQuantity: number;
  totalSpend: number;
  averageOrderValue: number;
  firstPurchaseDate: string;
  mostRecentPurchaseDate: string;
  frequencyGroup: '1 Time' | '2 Times' | '3 Times' | '4 Times' | '5 Times' | '6–10 Times' | '> 10 Times';
}

export interface OperationalOrderRecord {
  orderId: string;
  orderDate: string;
  courier: string;
  awbNumber: string;
  shipmentStatus: string;
  deliveryAttempts: number;
  rtoStatus: string;
  exceptionReason: string;
  dispatchDate: string;
  deliveryDate: string;
  customerName?: string;
  phone?: string;
  state?: string;
  city?: string;
  pincode?: string;
  productName?: string;
  orderFormatted?: string;
  totalQuantity?: number;
  orderValue?: number;
  paymentMode?: string;
}

interface AnalyticsFullPageDataViewProps {
  viewType: 'orders' | 'customers' | 'operations';
  title: string;
  subtitle?: string;
  orders?: WebsiteConsolidatedOrder[];
  customers?: CustomerPurchaseProfile[];
  operations?: OperationalOrderRecord[];
  onBack: () => void;
  onOrderDeleted?: (orderId: string) => void;
}

export const AnalyticsFullPageDataView: React.FC<AnalyticsFullPageDataViewProps> = ({
  viewType,
  title,
  subtitle,
  orders = [],
  customers = [],
  operations = [],
  onBack,
  onOrderDeleted
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<WebsiteConsolidatedOrder | null>(null);
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());

  // Filter-specific dropdowns
  const [filterPaymentMode, setFilterPaymentMode] = useState<string>('ALL');
  const [filterFrequencyGroup, setFilterFrequencyGroup] = useState<string>('ALL');
  const [filterCourier, setFilterCourier] = useState<string>('ALL');
  const [filterShipmentStatus, setFilterShipmentStatus] = useState<string>('ALL');

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rowsPerPage, filterPaymentMode, filterFrequencyGroup, filterCourier, filterShipmentStatus]);

  // Handle order deletion
  const handleDeleteOrder = async (order: WebsiteConsolidatedOrder) => {
    if (!window.confirm(`Are you sure you want to permanently delete order #${order.order_id}? This will remove it from Sales and Logistics.`)) return;
    const toastId = toast.loading(`Deleting order #${order.order_id}...`);
    try {
      await websiteSalesService.deleteSalesOrder(order.order_id);
      toast.success(`Order #${order.order_id} deleted successfully!`, { id: toastId });
      setLocallyDeletedIds(prev => new Set(prev).add(order.order_id));
      onOrderDeleted?.(order.order_id);
    } catch (err: any) {
      toast.error(`Failed to delete order: ${err.message}`, { id: toastId });
    }
  };

  // 1. Process Orders View Dataset
  const filteredOrders = useMemo(() => {
    if (viewType !== 'orders') return [];
    let list = orders.filter(o => !locallyDeletedIds.has(o.order_id));

    if (filterPaymentMode !== 'ALL') {
      list = list.filter(o => o.payment_mode === filterPaymentMode);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(o => {
        return (
          o.order_id.toLowerCase().includes(q) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
          (o.phone && o.phone.includes(q)) ||
          (o.city && o.city.toLowerCase().includes(q)) ||
          (o.state && o.state.toLowerCase().includes(q)) ||
          (o.pincode && o.pincode.includes(q)) ||
          (o.product_name && o.product_name.toLowerCase().includes(q)) ||
          (o.order_formatted && o.order_formatted.toLowerCase().includes(q))
        );
      });
    }

    // Sort
    if (sortField) {
      list = [...list].sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return list;
  }, [viewType, orders, locallyDeletedIds, filterPaymentMode, searchQuery, sortField, sortOrder]);

  // 2. Process Customers View Dataset
  const filteredCustomers = useMemo(() => {
    if (viewType !== 'customers') return [];
    let list = [...customers];

    if (filterFrequencyGroup !== 'ALL') {
      list = list.filter(c => c.frequencyGroup === filterFrequencyGroup);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => {
        return (
          c.customerName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.customerKey.toLowerCase().includes(q)
        );
      });
    }

    // Sort
    if (sortField) {
      list = [...list].sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return list;
  }, [viewType, customers, filterFrequencyGroup, searchQuery, sortField, sortOrder]);

  // 3. Process Operations View Dataset
  const filteredOperations = useMemo(() => {
    if (viewType !== 'operations') return [];
    let list = [...operations];

    if (filterCourier !== 'ALL') {
      list = list.filter(op => op.courier === filterCourier);
    }

    if (filterShipmentStatus !== 'ALL') {
      list = list.filter(op => op.shipmentStatus === filterShipmentStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(op => {
        return (
          op.orderId.toLowerCase().includes(q) ||
          (op.customerName && op.customerName.toLowerCase().includes(q)) ||
          (op.phone && op.phone.includes(q)) ||
          (op.awbNumber && op.awbNumber.toLowerCase().includes(q)) ||
          (op.courier && op.courier.toLowerCase().includes(q)) ||
          (op.shipmentStatus && op.shipmentStatus.toLowerCase().includes(q)) ||
          (op.city && op.city.toLowerCase().includes(q)) ||
          (op.state && op.state.toLowerCase().includes(q))
        );
      });
    }

    // Sort
    if (sortField) {
      list = [...list].sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return list;
  }, [viewType, operations, filterCourier, filterShipmentStatus, searchQuery, sortField, sortOrder]);

  // Total count based on active view type
  const totalRecords =
    viewType === 'orders' ? filteredOrders.length :
    viewType === 'customers' ? filteredCustomers.length :
    filteredOperations.length;

  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);

  // Paginated Slices
  const paginatedOrders = useMemo(() => {
    const start = (validCurrentPage - 1) * rowsPerPage;
    return filteredOrders.slice(start, start + rowsPerPage);
  }, [filteredOrders, validCurrentPage, rowsPerPage]);

  const paginatedCustomers = useMemo(() => {
    const start = (validCurrentPage - 1) * rowsPerPage;
    return filteredCustomers.slice(start, start + rowsPerPage);
  }, [filteredCustomers, validCurrentPage, rowsPerPage]);

  const paginatedOperations = useMemo(() => {
    const start = (validCurrentPage - 1) * rowsPerPage;
    return filteredOperations.slice(start, start + rowsPerPage);
  }, [filteredOperations, validCurrentPage, rowsPerPage]);

  // Sorting handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // CSV Export handler
  const handleExportCSV = () => {
    let csvContent = '';
    if (viewType === 'orders') {
      const headers = ['Order ID', 'Order Date', 'Customer Name', 'Phone', 'State', 'City', 'Pincode', 'Payment Mode', 'Order Value', 'Remaining COD', 'Quantity', 'Products'];
      const rows = filteredOrders.map(o => [
        `"${o.order_id}"`,
        `"${o.order_date || ''}"`,
        `"${(o.customer_name || '').replace(/"/g, '""')}"`,
        `"${o.phone || ''}"`,
        `"${(o.canonicalState || o.state || '').replace(/"/g, '""')}"`,
        `"${(o.canonicalCity || o.city || '').replace(/"/g, '""')}"`,
        `"${o.pincode || ''}"`,
        `"${o.payment_mode}"`,
        o.price,
        o.remaining_payable || 0,
        o.total_quantity || 1,
        `"${(o.order_formatted || o.product_name || '').replace(/"/g, '""')}"`
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (viewType === 'customers') {
      const headers = ['Customer Name', 'Phone', 'Frequency Group', 'Total Orders', 'Total Quantity', 'Total Spend', 'AOV', 'First Purchase', 'Recent Purchase'];
      const rows = filteredCustomers.map(c => [
        `"${(c.customerName || '').replace(/"/g, '""')}"`,
        `"${c.phone || ''}"`,
        `"${c.frequencyGroup}"`,
        c.totalOrders,
        c.totalQuantity,
        c.totalSpend,
        c.averageOrderValue,
        `"${c.firstPurchaseDate}"`,
        `"${c.mostRecentPurchaseDate}"`
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else {
      const headers = ['Order ID', 'Order Date', 'Courier', 'AWB', 'Shipment Status', 'RTO Status', 'Exception Reason', 'Dispatch Date', 'Delivery Date'];
      const rows = filteredOperations.map(op => [
        `"${op.orderId}"`,
        `"${op.orderDate}"`,
        `"${op.courier}"`,
        `"${op.awbNumber || ''}"`,
        `"${op.shipmentStatus}"`,
        `"${op.rtoStatus || ''}"`,
        `"${(op.exceptionReason || '').replace(/"/g, '""')}"`,
        `"${op.dispatchDate || ''}"`,
        `"${op.deliveryDate || ''}"`
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.replace(/\s+/g, '_').toLowerCase()}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Export downloaded successfully!');
  };

  // Pagination Window Calculator
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (validCurrentPage > 3) pages.push('...');
      const start = Math.max(2, validCurrentPage - 1);
      const end = Math.min(totalPages - 1, validCurrentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (validCurrentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, validCurrentPage]);

  // Summary Metrics for KPI Pills
  const metrics = useMemo(() => {
    if (viewType === 'orders') {
      const totalOrdersCount = filteredOrders.length;
      const totalRev = filteredOrders.reduce((sum, o) => sum + (o.price || 0), 0);
      const totalUnits = filteredOrders.reduce((sum, o) => sum + (o.total_quantity || 1), 0);
      const aov = totalOrdersCount > 0 ? Math.round(totalRev / totalOrdersCount) : 0;
      const prepaidCount = filteredOrders.filter(o => o.payment_mode === 'PREPAID').length;
      const codRem = filteredOrders.reduce((sum, o) => sum + (o.remaining_payable || 0), 0);
      return { totalOrdersCount, totalRev, totalUnits, aov, prepaidCount, codRem };
    } else if (viewType === 'customers') {
      const totalCust = filteredCustomers.length;
      const repeatCust = filteredCustomers.filter(c => c.totalOrders > 1).length;
      const totalSpend = filteredCustomers.reduce((sum, c) => sum + c.totalSpend, 0);
      const avgOrders = totalCust > 0 ? (filteredCustomers.reduce((sum, c) => sum + c.totalOrders, 0) / totalCust).toFixed(2) : '0';
      return { totalCust, repeatCust, totalSpend, avgOrders };
    } else {
      const totalFulfil = filteredOperations.length;
      const delivered = filteredOperations.filter(op => op.shipmentStatus === 'Delivered').length;
      const rto = filteredOperations.filter(op => op.shipmentStatus.includes('RTO') || op.rtoStatus).length;
      const pending = filteredOperations.filter(op => op.shipmentStatus === 'Pending' || op.shipmentStatus === 'In Transit' || op.shipmentStatus === 'Awaiting Tracking Update').length;
      return { totalFulfil, delivered, rto, pending };
    }
  }, [viewType, filteredOrders, filteredCustomers, filteredOperations]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={onBack}
              className="hover:text-cyan-400 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to Analytics
            </button>
            <span>/</span>
            <span className="text-slate-300 font-medium">Full Dataset View</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
            {viewType === 'orders' ? (
              <ShoppingBag size={20} className="text-purple-400" />
            ) : viewType === 'customers' ? (
              <Users size={20} className="text-cyan-400" />
            ) : (
              <Truck size={20} className="text-emerald-400" />
            )}
            <span>{title}</span>
          </h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download size={14} className="text-cyan-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onBack}
            className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>

      {/* 2. KPI SUMMARY METRIC CHIPS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {viewType === 'orders' && metrics && (
          <>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Filtered</span>
              <span className="text-base font-mono font-extrabold text-white">{metrics.totalOrdersCount?.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Revenue</span>
              <span className="text-base font-mono font-extrabold text-emerald-400">₹{Math.round(metrics.totalRev || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Units</span>
              <span className="text-base font-mono font-extrabold text-cyan-300">{metrics.totalUnits?.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Order Value</span>
              <span className="text-base font-mono font-extrabold text-purple-300">₹{metrics.aov?.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Prepaid Orders</span>
              <span className="text-base font-mono font-extrabold text-emerald-300">{metrics.prepaidCount?.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">COD Receivable</span>
              <span className="text-base font-mono font-extrabold text-amber-300">₹{Math.round(metrics.codRem || 0).toLocaleString('en-IN')}</span>
            </div>
          </>
        )}

        {viewType === 'customers' && metrics && (
          <>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Customers</span>
              <span className="text-base font-mono font-extrabold text-white">{metrics.totalCust?.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Repeat Buyers</span>
              <span className="text-base font-mono font-extrabold text-purple-400">{metrics.repeatCust?.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Repeat Rate</span>
              <span className="text-base font-mono font-extrabold text-emerald-400">
                {metrics.totalCust && metrics.totalCust > 0 ? `${((metrics.repeatCust / metrics.totalCust) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Orders / Cust</span>
              <span className="text-base font-mono font-extrabold text-cyan-300">{metrics.avgOrders}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer Lifetime Spend</span>
              <span className="text-base font-mono font-extrabold text-emerald-300">₹{Math.round(metrics.totalSpend || 0).toLocaleString('en-IN')}</span>
            </div>
          </>
        )}

        {viewType === 'operations' && metrics && (
          <>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total In Fulfilment</span>
              <span className="text-base font-mono font-extrabold text-white">{metrics.totalFulfil?.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivered</span>
              <span className="text-base font-mono font-extrabold text-emerald-400">{metrics.delivered?.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">RTO / Returned</span>
              <span className="text-base font-mono font-extrabold text-rose-400">{metrics.rto?.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending / In-Transit</span>
              <span className="text-base font-mono font-extrabold text-amber-300">{metrics.pending?.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivery Success Rate</span>
              <span className="text-base font-mono font-extrabold text-cyan-300">
                {metrics.totalFulfil && metrics.totalFulfil > 0 ? `${((metrics.delivered / metrics.totalFulfil) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* 3. SEARCH & TABLE FILTER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={
              viewType === 'orders' ? 'Search by Order ID, Customer, Phone, City, Product...' :
              viewType === 'customers' ? 'Search by Customer Name, Phone, Identifier...' :
              'Search by Order ID, AWB, Courier, Status...'
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Secondary Context Filters */}
        <div className="flex items-center gap-2">
          {viewType === 'orders' && (
            <select
              value={filterPaymentMode}
              onChange={e => setFilterPaymentMode(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">All Payment Modes</option>
              <option value="PREPAID">Prepaid</option>
              <option value="PARTIAL COD">Partial COD</option>
              <option value="COD">Full COD</option>
            </select>
          )}

          {viewType === 'customers' && (
            <select
              value={filterFrequencyGroup}
              onChange={e => setFilterFrequencyGroup(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">All Frequency Groups</option>
              <option value="1 Time">1 Time Buyers</option>
              <option value="2 Times">2 Times</option>
              <option value="3 Times">3 Times</option>
              <option value="4 Times">4 Times</option>
              <option value="5 Times">5 Times</option>
              <option value="6–10 Times">6–10 Times</option>
              <option value="> 10 Times">&gt; 10 Times</option>
            </select>
          )}

          {viewType === 'operations' && (
            <>
              <select
                value={filterCourier}
                onChange={e => setFilterCourier(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="ALL">All Couriers</option>
                <option value="ST Courier">ST Courier</option>
                <option value="Delhivery">Delhivery</option>
                <option value="Ekart">Ekart</option>
                <option value="India Post">India Post</option>
                <option value="Pending Courier Assignment">Pending Courier</option>
              </select>

              <select
                value={filterShipmentStatus}
                onChange={e => setFilterShipmentStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="ALL">All Shipment Statuses</option>
                <option value="Ready for dispatch">Ready for dispatch</option>
                <option value="Dispatched">Dispatched</option>
                <option value="In Transit">In Transit</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Delivered">Delivered</option>
                <option value="RTO Initiated">RTO Initiated</option>
                <option value="RTO Delivered">RTO Delivered</option>
                <option value="Exception">Exception</option>
              </select>
            </>
          )}

          {/* Rows per page selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 pl-2 border-l border-slate-800">
            <span>Rows:</span>
            <select
              value={rowsPerPage}
              onChange={e => setRowsPerPage(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500 cursor-pointer font-bold"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. MAIN DATA TABLE */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        {totalRecords === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-slate-400 text-sm font-semibold">No records match your criteria.</p>
            <p className="text-slate-500 text-xs">Try clearing the search query or adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* VIEW A: ORDERS TABLE */}
            {viewType === 'orders' && (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 whitespace-nowrap">
                  <tr>
                    <th onClick={() => handleSort('order_id')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Order ID <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('order_date')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Date <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('customer_name')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Customer <ArrowUpDown size={11} /></div>
                    </th>
                    <th className="py-3 px-3">State</th>
                    <th className="py-3 px-3">City</th>
                    <th onClick={() => handleSort('price')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Order Value <ArrowUpDown size={11} /></div>
                    </th>
                    <th className="py-3 px-3 text-center">Payment Mode</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Pincode</th>
                    {/* WIDE COLUMN WITH FULL PRODUCT NAMES */}
                    <th className="py-3 px-3 min-w-[240px] max-w-[380px]">Product / Items</th>
                    <th onClick={() => handleSort('total_quantity')} className="py-3 px-3 text-center cursor-pointer hover:text-white">
                      <div className="flex items-center justify-center gap-1">Qty <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('remaining_payable')} className="py-3 px-3 text-right cursor-pointer hover:text-white">
                      <div className="flex items-center justify-end gap-1">Remaining COD <ArrowUpDown size={11} /></div>
                    </th>
                    <th className="py-3 px-3 text-center w-[80px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {paginatedOrders.map(o => {
                    const resolvedLoc = resolveCanonicalLocation(o.state, o.city, o.pincode);
                    const canonicalState = o.canonicalState || resolvedLoc.stateName || o.state || '—';
                    const canonicalCity = o.canonicalCity || resolvedLoc.cityName || o.city || '—';
                    const canonicalPincode = o.canonicalPincode || resolvedLoc.pincode || o.pincode || '—';

                    return (
                      <tr key={o.order_id} className="hover:bg-slate-800/40 transition-colors text-[11px]">
                        <td className="py-3 px-3 font-mono font-bold text-indigo-300 whitespace-nowrap">#{o.order_id}</td>
                        <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">{o.order_date || '—'}</td>
                        <td className="py-3 px-3 font-bold text-white max-w-[160px] truncate" title={o.customer_name}>
                          {o.customer_name || 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{canonicalState}</td>
                        <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{canonicalCity}</td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          ₹{(o.price ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {o.payment_mode === 'PREPAID' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              PREPAID
                            </span>
                          ) : o.payment_mode === 'PARTIAL COD' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              PARTIAL COD
                            </span>
                          ) : o.payment_mode === 'COD' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              COD
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                              {o.payment_mode || 'UNKNOWN'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">{o.phone || '—'}</td>
                        <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">{canonicalPincode}</td>
                        {/* FULL PRODUCT VISIBILITY CELL */}
                        <td className="py-3 px-3">
                          <AnalyticsProductCell order={o} />
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-white whitespace-nowrap">
                          {o.total_quantity ?? 1}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                          {o.payment_mode === 'PARTIAL COD' ? (
                            <span className="text-purple-300">₹{(o.remaining_payable ?? 0).toLocaleString('en-IN')}</span>
                          ) : o.payment_mode === 'COD' ? (
                            <span className="text-amber-300">₹{(o.remaining_payable ?? o.price ?? 0).toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-slate-500">₹0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedOrderForModal(o)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-md transition-colors cursor-pointer"
                              title="Inspect Details"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(o)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                              title="Delete Order"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* VIEW B: CUSTOMERS TABLE */}
            {viewType === 'customers' && (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 whitespace-nowrap">
                  <tr>
                    <th onClick={() => handleSort('customerName')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Customer Name <ArrowUpDown size={11} /></div>
                    </th>
                    <th className="py-3 px-3">Customer Identifier (Phone)</th>
                    <th className="py-3 px-3 text-center">Frequency Group</th>
                    <th onClick={() => handleSort('totalOrders')} className="py-3 px-3 text-center cursor-pointer hover:text-white">
                      <div className="flex items-center justify-center gap-1">Total Orders <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('totalQuantity')} className="py-3 px-3 text-center cursor-pointer hover:text-white">
                      <div className="flex items-center justify-center gap-1">Total Qty <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('totalSpend')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Total Spend <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('averageOrderValue')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Average Order Value <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('firstPurchaseDate')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">First Purchase <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('mostRecentPurchaseDate')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Recent Purchase <ArrowUpDown size={11} /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {paginatedCustomers.map((c, idx) => (
                    <tr key={c.customerKey || idx} className="hover:bg-slate-800/40 transition-colors text-[11px]">
                      <td className="py-3 px-3 font-bold text-white whitespace-nowrap">{c.customerName || 'N/A'}</td>
                      <td className="py-3 px-3 font-mono text-cyan-300 whitespace-nowrap">{c.phone || c.customerKey}</td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          c.frequencyGroup === '1 Time' ? 'bg-slate-800 text-slate-300 border-slate-700' :
                          c.frequencyGroup === '2 Times' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                          c.frequencyGroup === '3 Times' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                          'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {c.frequencyGroup}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-white whitespace-nowrap">{c.totalOrders}</td>
                      <td className="py-3 px-3 text-center font-mono text-slate-300 whitespace-nowrap">{c.totalQuantity}</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400 whitespace-nowrap">₹{Math.round(c.totalSpend).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 font-mono text-purple-300 whitespace-nowrap">₹{Math.round(c.averageOrderValue).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">{c.firstPurchaseDate || '—'}</td>
                      <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">{c.mostRecentPurchaseDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* VIEW C: OPERATIONS TABLE */}
            {viewType === 'operations' && (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 whitespace-nowrap">
                  <tr>
                    <th onClick={() => handleSort('orderId')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Order ID <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('orderDate')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Order Date <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('courier')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Courier <ArrowUpDown size={11} /></div>
                    </th>
                    <th className="py-3 px-3">AWB / Tracking</th>
                    <th className="py-3 px-3 text-center">Current Status</th>
                    <th className="py-3 px-3 text-center">Attempts</th>
                    <th className="py-3 px-3 text-center">RTO Status</th>
                    <th className="py-3 px-3">Exception Reason</th>
                    <th onClick={() => handleSort('dispatchDate')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Dispatch Date <ArrowUpDown size={11} /></div>
                    </th>
                    <th onClick={() => handleSort('deliveryDate')} className="py-3 px-3 cursor-pointer hover:text-white">
                      <div className="flex items-center gap-1">Delivery Date <ArrowUpDown size={11} /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {paginatedOperations.map((op, idx) => (
                    <tr key={op.orderId || idx} className="hover:bg-slate-800/40 transition-colors text-[11px]">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-300 whitespace-nowrap">#{op.orderId}</td>
                      <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">{op.orderDate || '—'}</td>
                      <td className="py-3 px-3 font-medium text-white whitespace-nowrap">{op.courier || '—'}</td>
                      <td className="py-3 px-3 font-mono text-cyan-300 whitespace-nowrap">{op.awbNumber || '—'}</td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          op.shipmentStatus === 'Delivered' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          op.shipmentStatus === 'In Transit' || op.shipmentStatus === 'Out for Delivery' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                          op.shipmentStatus.includes('RTO') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                          'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {op.shipmentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-300 whitespace-nowrap">{op.deliveryAttempts || 0}</td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {op.rtoStatus ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {op.rtoStatus}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400 max-w-[200px] truncate" title={op.exceptionReason}>
                        {op.exceptionReason || 'None'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">{op.dispatchDate || '—'}</td>
                      <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">{op.deliveryDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 5. PAGINATION FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-950 border-t border-slate-800 text-xs">
          <div className="text-slate-400">
            Showing <span className="font-bold text-white">{totalRecords === 0 ? 0 : (validCurrentPage - 1) * rowsPerPage + 1}</span>–
            <span className="font-bold text-white">{Math.min(validCurrentPage * rowsPerPage, totalRecords)}</span> of{' '}
            <span className="font-bold text-white">{totalRecords.toLocaleString()}</span> {viewType === 'orders' ? 'orders' : viewType === 'customers' ? 'customers' : 'shipments'}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={validCurrentPage === 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>

            {pageNumbers.map((num, i) => {
              if (num === '...') {
                return (
                  <span key={`dots-${i}`} className="px-2 py-1 text-slate-500 font-bold select-none">
                    ...
                  </span>
                );
              }
              const pageNum = Number(num);
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    validCurrentPage === pageNum
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={validCurrentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* SINGLE ORDER DETAILS MODAL */}
      <OrderDetailsModal
        order={selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
        onOrderDeleted={deletedId => {
          setLocallyDeletedIds(prev => new Set(prev).add(deletedId));
          setSelectedOrderForModal(null);
          onOrderDeleted?.(deletedId);
        }}
      />
    </div>
  );
};
