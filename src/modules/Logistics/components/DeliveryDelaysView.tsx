import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle,
  Clock,
  AlertCircle,
  Flame,
  HelpCircle,
  ShieldAlert,
  Search,
  Download,
  RotateCcw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Truck,
  Copy,
  Check,
  CheckCircle2,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { 
  calculateDeliveryDelaySummary, 
  getDelayedShipments,
  type DelaySeverity,
  type DeliveryDelayInfo 
} from '../utils/deliveryDelayUtils';
import { getCanonicalStatus, STATUS_METADATA_MAP, formatINR } from '../utils/logisticsAnalyticsUtils';
import { normalizeCourier } from '../../../config/courierConfig';
import { resolveCustomerLocationDisplay, parseOrderAmount } from '../../../utils/logisticsOrderUtils';
import { parseAndFormatLogisticsDate } from '../../../utils/logisticsDateUtils';

interface DeliveryDelaysViewProps {
  orders: UnifiedLogisticsOrder[];
  onTrackOrder?: (order: any) => void;
  onViewCustomer?: (customerKey: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const DeliveryDelaysView: React.FC<DeliveryDelaysViewProps> = ({
  orders,
  onTrackOrder,
  onViewCustomer,
  onRefresh,
  isRefreshing = false
}) => {
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourier, setSelectedCourier] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'moderate' | 'severe' | 'critical' | 'missing_eta' | 'invalid_eta'>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Sorting
  const [sortField, setSortField] = useState<'overdueDays' | 'amount' | 'orderDate' | 'edd'>('overdueDays');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Summary Metrics
  const summary = useMemo(() => calculateDeliveryDelaySummary(orders), [orders]);

  // Extract all available Couriers
  const availableCouriers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.courier) {
        const norm = normalizeCourier(o.courier);
        if (norm) set.add(norm);
      }
    });
    return Array.from(set).sort();
  }, [orders]);

  // Filtered and Sorted Delayed Shipments
  const delayedItems = useMemo(() => {
    const list = getDelayedShipments(orders, {
      filterSeverity: selectedSeverity,
      courier: selectedCourier,
      status: selectedStatus,
      search: searchTerm
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'overdueDays') {
        cmp = a.delayInfo.overdueDays - b.delayInfo.overdueDays;
      } else if (sortField === 'amount') {
        const amtA = parseOrderAmount(a.order.amount ?? a.order.totalAmount) || 0;
        const amtB = parseOrderAmount(b.order.amount ?? b.order.totalAmount) || 0;
        cmp = amtA - amtB;
      } else if (sortField === 'orderDate') {
        cmp = (a.order.orderDate || '').localeCompare(b.order.orderDate || '');
      } else if (sortField === 'edd') {
        cmp = (a.delayInfo.eddIsoDate || '').localeCompare(b.delayInfo.eddIsoDate || '');
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [orders, selectedSeverity, selectedCourier, selectedStatus, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(delayedItems.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedItems = delayedItems.slice(startIndex, startIndex + pageSize);

  // Clipboard copy helper
  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(`Copied ${label}: ${text}`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (delayedItems.length === 0) {
      toast.error('No shipments to export');
      return;
    }

    const headers = [
      'Order ID',
      'Customer Name',
      'Phone Number',
      'City',
      'State',
      'Pincode',
      'Courier',
      'AWB Number',
      'Expected Delivery Date',
      'ETA Source',
      'Days Overdue',
      'Shipment Status',
      'Delay Severity',
      'Validation Status',
      'Order Amount',
      'Dispatch Date',
      'Last Tracking Event'
    ];

    const rows = delayedItems.map(({ order, delayInfo }) => [
      `"${order.displayOrderId || order.orderId}"`,
      `"${(order.customerName || '').replace(/"/g, '""')}"`,
      `"${order.phoneNumber || order.phone || ''}"`,
      `"${(order.city || '').replace(/"/g, '""')}"`,
      `"${(order.state || '').replace(/"/g, '""')}"`,
      `"${order.pincode || ''}"`,
      `"${normalizeCourier(order.courier) || 'Unassigned'}"`,
      `"${order.awbNumber || ''}"`,
      `"${delayInfo.eddIsoDate || 'Missing'}"`,
      `"${delayInfo.etaSource || 'Courier Tracking'}"`,
      delayInfo.overdueDays,
      `"${getCanonicalStatus(order)}"`,
      `"${delayInfo.severity}"`,
      `"${delayInfo.isValidEdd ? 'Valid' : (delayInfo.severity === 'invalid_eta' ? 'ETA Earlier Than Dispatch' : 'Missing ETA')}"`,
      parseOrderAmount(order.amount ?? order.totalAmount) || 0,
      `"${order.dispatchDate || ''}"`,
      `"${(order.lastEvent || order.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Delivery_Delays_${selectedSeverity}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${delayedItems.length} shipments to CSV`);
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full animate-fade-in select-none shrink-0">
      
      {/* 1. TOP ALERT & KPI CARDS BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Card 1: Total Overdue (10+ Days) */}
        <div 
          onClick={() => { setSelectedSeverity('all'); setCurrentPage(1); }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedSeverity === 'all'
              ? 'bg-rose-950/60 border-rose-500/80 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50'
              : 'bg-[#0b1220] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">Total Delayed (10+ Days)</span>
            <AlertTriangle size={15} className="text-rose-400" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">
            {summary.totalDelayed.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Trapped: <strong className="text-white font-mono">{formatINR(summary.totalDelayedValue)}</strong></span>
            {summary.oldestOverdueDays > 0 && (
              <span className="text-rose-400 font-bold font-mono">Max +{summary.oldestOverdueDays}d</span>
            )}
          </div>
        </div>

        {/* Card 2: Critical Overdue (21+ Days) */}
        <div 
          onClick={() => { setSelectedSeverity('critical'); setCurrentPage(1); }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedSeverity === 'critical'
              ? 'bg-red-950/70 border-red-500/80 shadow-lg shadow-red-950/40 ring-1 ring-red-500/50'
              : 'bg-[#0b1220] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">Critical (21+ Days)</span>
            <Flame size={15} className="text-red-400" />
          </div>
          <div className="text-2xl font-black font-mono text-red-400">
            {summary.criticalCount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            <span>3+ weeks overdue past ETA</span>
          </div>
        </div>

        {/* Card 3: Severe Overdue (15–20 Days) */}
        <div 
          onClick={() => { setSelectedSeverity('severe'); setCurrentPage(1); }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedSeverity === 'severe'
              ? 'bg-orange-950/70 border-orange-500/80 shadow-lg shadow-orange-950/40 ring-1 ring-orange-500/50'
              : 'bg-[#0b1220] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-300">Severe (15–20 Days)</span>
            <AlertCircle size={15} className="text-orange-400" />
          </div>
          <div className="text-2xl font-black font-mono text-orange-400">
            {summary.severeCount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            <span>2+ weeks overdue past ETA</span>
          </div>
        </div>

        {/* Card 4: Moderate Overdue (10–14 Days) */}
        <div 
          onClick={() => { setSelectedSeverity('moderate'); setCurrentPage(1); }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedSeverity === 'moderate'
              ? 'bg-amber-950/70 border-amber-500/80 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/50'
              : 'bg-[#0b1220] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Moderate (10–14 Days)</span>
            <Clock size={15} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {summary.moderateCount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            <span>Reached 10d overdue threshold</span>
          </div>
        </div>

        {/* Card 5: Missing ETA / Un-dated */}
        <div 
          onClick={() => { setSelectedSeverity('missing_eta'); setCurrentPage(1); }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedSeverity === 'missing_eta'
              ? 'bg-slate-800/90 border-slate-500 shadow-lg ring-1 ring-slate-400/50'
              : 'bg-[#0b1220] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Missing ETA</span>
            <HelpCircle size={15} className="text-slate-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-300">
            {summary.missingEtaCount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 truncate" title="Shipments without courier promised delivery date">
            <span>No courier ETA provided</span>
          </div>
        </div>

        {/* Card 6: Invalid ETA / Data Issue */}
        <div 
          onClick={() => { setSelectedSeverity('invalid_eta'); setCurrentPage(1); }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedSeverity === 'invalid_eta'
              ? 'bg-amber-950/70 border-amber-500/90 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/60'
              : 'bg-[#0b1220] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Invalid ETA</span>
            <ShieldAlert size={15} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {summary.invalidEtaCount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate" title="Shipments where ETA is earlier than dispatch date or invalid">
            <span>Data Issue: ETA &lt; Dispatch</span>
          </div>
        </div>

      </div>

      {/* ETA DATA ISSUE ALERT BANNER (If any invalid ETA shipments detected) */}
      {summary.invalidEtaCount > 0 && (
        <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-400 shrink-0" />
            <span>
              <strong>ETA Data Issue Detected:</strong> {summary.invalidEtaCount} shipment(s) have expected delivery dates earlier than their dispatch date. These records are isolated and excluded from valid overdue delay counts.
            </span>
          </div>
          <button 
            type="button" 
            onClick={() => { setSelectedSeverity('invalid_eta'); setCurrentPage(1); }}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold underline transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
          >
            Review {summary.invalidEtaCount} Data Issue(s)
          </button>
        </div>
      )}

      {/* 2. FILTER & ACTION TOOLBAR */}
      <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        
        {/* Left Side: Search & Quick Filters */}
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search by Order ID, AWB, Customer, Phone..."
              className="w-full pl-9 pr-8 py-2 bg-slate-900/90 border border-slate-700/80 focus:border-rose-500/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Courier Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold shrink-0">Courier:</span>
            <select
              value={selectedCourier}
              onChange={(e) => { setSelectedCourier(e.target.value); setCurrentPage(1); }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium outline-none focus:border-rose-500 transition-colors"
            >
              <option value="All">All Couriers ({availableCouriers.length})</option>
              {availableCouriers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold shrink-0">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium outline-none focus:border-rose-500 transition-colors"
            >
              <option value="All">All Statuses</option>
              <option value="In Transit">In Transit</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Pending">Pending AWB / Manifest</option>
              <option value="RTO - In Transit">RTO - In Transit</option>
            </select>
          </div>

          {/* Severity View Tag */}
          {selectedSeverity !== 'all' && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/70 border border-rose-500/40 text-xs text-rose-300 font-medium">
              <span>View: <strong>{selectedSeverity.replace('_', ' ').toUpperCase()}</strong></span>
              <button
                type="button"
                onClick={() => setSelectedSeverity('all')}
                className="hover:text-white ml-1 p-0.5"
                title="Reset severity filter"
              >
                <X size={11} />
              </button>
            </div>
          )}

        </div>

        {/* Right Side: Refresh & Export */}
        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Delay Records"
            >
              <RotateCcw size={13} className={isRefreshing ? 'animate-spin text-rose-400' : ''} />
              <span>Refresh</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-950/60 transition-all cursor-pointer active:scale-95"
            title="Export Delayed Shipments CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>

      </div>

      {/* 3. DELAYED SHIPMENTS TABLE */}
      <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl flex flex-col">
        
        {/* Table Header Bar */}
        <div className="px-4 py-3 bg-[#0d1627] border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">
              {selectedSeverity === 'missing_eta' 
                ? `Showing ${delayedItems.length} undated shipments (Missing ETA)`
                : selectedSeverity === 'invalid_eta'
                ? `Showing ${delayedItems.length} shipments with ETA data issues`
                : `Showing ${delayedItems.length} overdue shipments (>= 10 days)`}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Ordered by: <span className="text-rose-400 font-semibold">{sortField === 'overdueDays' ? 'Most Overdue First' : sortField}</span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1000px]">
            <thead className="bg-[#080d18] text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th 
                  onClick={() => toggleSort('orderDate')}
                  className="px-4 py-3 cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Order ID</span>
                    <span className="text-[10px] text-slate-600">⇅</span>
                  </div>
                </th>
                <th className="px-4 py-3">Customer & Location</th>
                <th className="px-4 py-3">Phone Number</th>
                <th className="px-4 py-3">Courier & AWB</th>
                <th 
                  onClick={() => toggleSort('edd')}
                  className="px-4 py-3 cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Expected Delivery (ETA)</span>
                    <span className="text-[10px] text-slate-600">⇅</span>
                  </div>
                </th>
                <th className="px-4 py-3">Shipment Status</th>
                <th 
                  onClick={() => toggleSort('overdueDays')}
                  className="px-4 py-3 cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1 text-rose-300">
                    <span>Days Overdue</span>
                    <span className="text-[10px]">⇅</span>
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('amount')}
                  className="px-4 py-3 cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Amount</span>
                    <span className="text-[10px] text-slate-600">⇅</span>
                  </div>
                </th>
                <th className="px-4 py-3">Last Tracking Event</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-normal">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                      <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-700/60 flex items-center justify-center text-emerald-400 mb-3 shadow-md">
                        <CheckCircle2 size={24} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-200 mb-1">
                        {summary.totalDelayed === 0 
                          ? 'All Shipments On Schedule' 
                          : 'No Shipments Match Selected Filters'}
                      </h4>
                      <p className="text-xs text-slate-500 text-center">
                        {summary.totalDelayed === 0
                          ? 'Zero shipments have exceeded their expected delivery date by 10 or more days.'
                          : 'Try selecting All Couriers or resetting filter criteria to view overdue shipments.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(({ order, delayInfo }) => {
                  const canonical = getCanonicalStatus(order);
                  const meta = STATUS_METADATA_MAP[canonical];
                  const amt = parseOrderAmount(order.amount ?? order.totalAmount) || 0;
                  const courierName = normalizeCourier(order.courier) || 'Unassigned';

                  // Overdue severity alert style
                  let alertBadgeClass = 'bg-amber-950/80 border-amber-600/60 text-amber-300';
                  let alertDotClass = 'bg-amber-400 animate-pulse';

                  if (delayInfo.severity === 'critical') {
                    alertBadgeClass = 'bg-red-950/90 border-red-500/70 text-red-200 shadow-sm shadow-red-950';
                    alertDotClass = 'bg-red-500 animate-ping';
                  } else if (delayInfo.severity === 'severe') {
                    alertBadgeClass = 'bg-orange-950/80 border-orange-500/70 text-orange-200';
                    alertDotClass = 'bg-orange-400 animate-pulse';
                  } else if (delayInfo.severity === 'invalid_eta') {
                    alertBadgeClass = 'bg-amber-950/80 border-amber-500/80 text-amber-300';
                    alertDotClass = 'bg-amber-400';
                  } else if (delayInfo.severity === 'missing_eta') {
                    alertBadgeClass = 'bg-slate-800/80 border-slate-600 text-slate-400';
                    alertDotClass = 'bg-slate-500';
                  }

                  return (
                    <tr 
                      key={order.id} 
                      className={`hover:bg-slate-900/60 transition-colors ${
                        delayInfo.severity === 'critical' ? 'bg-red-950/10' : ''
                      }`}
                    >
                      
                      {/* 1. Order ID */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span 
                            onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                            className="font-mono font-bold text-rose-300 hover:text-rose-200 cursor-pointer"
                            title="Click to view customer details"
                          >
                            {order.displayOrderId || order.orderId}
                          </span>
                          {order.orderDate && (
                            <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {parseAndFormatLogisticsDate(order.orderDate).displayDate || order.orderDate}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Customer & Location */}
                      <td className="px-4 py-3.5 max-w-[170px]">
                        <div className="flex flex-col">
                          <span 
                            onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                            className="font-semibold text-slate-200 hover:text-rose-300 cursor-pointer truncate"
                            title={order.customerName}
                          >
                            {order.customerName}
                          </span>
                          <span 
                            className="text-[11px] text-slate-400 truncate mt-0.5"
                            title={resolveCustomerLocationDisplay(order.state, order.city, order.pincode)}
                          >
                            {resolveCustomerLocationDisplay(order.state, order.city, order.pincode)}
                          </span>
                        </div>
                      </td>

                      {/* 3. Phone */}
                      <td className="px-4 py-3.5 font-mono text-slate-300 whitespace-nowrap">
                        {order.phoneNumber || order.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span>{order.phoneNumber || order.phone}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(order.phoneNumber || order.phone || '', 'Phone')}
                              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                              title="Copy phone"
                            >
                              {copiedText === (order.phoneNumber || order.phone) ? (
                                <Check size={11} className="text-emerald-400" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic">—</span>
                        )}
                      </td>

                      {/* 4. Courier & AWB */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200 text-xs">
                            {courierName}
                          </span>
                          {order.awbNumber ? (
                            <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[11px] text-cyan-400">
                              <span>{order.awbNumber}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(order.awbNumber!, 'AWB')}
                                className="p-0.5 text-slate-500 hover:text-cyan-300 transition-colors"
                                title="Copy AWB"
                              >
                                {copiedText === order.awbNumber ? (
                                  <Check size={11} className="text-emerald-400" />
                                ) : (
                                  <Copy size={10} />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 italic">No AWB</span>
                          )}
                        </div>
                      </td>

                      {/* 5. Expected Delivery Date & Authoritative Source */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {delayInfo.severity === 'invalid_eta' ? (
                          <div className="flex flex-col" title={delayInfo.validationIssue}>
                            <div className="flex items-center gap-1 text-amber-400 font-bold font-mono text-xs">
                              <ShieldAlert size={12} className="shrink-0" />
                              <span>{delayInfo.eddDisplayDate}</span>
                            </div>
                            <span className="text-[10px] text-amber-500 font-semibold mt-0.5">
                              ETA &lt; Dispatch Date
                            </span>
                          </div>
                        ) : delayInfo.hasEdd ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-200 font-mono">
                              {delayInfo.eddDisplayDate}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]" title={delayInfo.etaSource || 'Courier ETA'}>
                              {delayInfo.etaSource || 'ETA Promised'}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-500 border border-slate-800">
                            Missing ETA
                          </span>
                        )}
                      </td>

                      {/* 6. Current Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText}`}>
                          {canonical}
                        </span>
                      </td>

                      {/* 7. Days Overdue (Alert Highlight) */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {delayInfo.severity === 'invalid_eta' ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border font-bold text-xs font-mono bg-amber-950/80 border-amber-600/60 text-amber-300" title={delayInfo.validationIssue}>
                            <ShieldAlert size={12} className="text-amber-400 shrink-0" />
                            <span>ETA Data Issue</span>
                          </div>
                        ) : delayInfo.severity === 'missing_eta' ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border font-bold text-xs font-mono bg-slate-900 border-slate-700 text-slate-400">
                            <Clock size={12} className="text-slate-500 shrink-0" />
                            <span>Unscheduled</span>
                          </div>
                        ) : (
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border font-bold text-xs font-mono ${alertBadgeClass}`}>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${alertDotClass}`} />
                            <span>{delayInfo.alertLabel}</span>
                          </div>
                        )}
                      </td>

                      {/* 8. Order Amount */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-slate-200">
                        {formatINR(amt)}
                      </td>

                      {/* 9. Last Tracking Event */}
                      <td className="px-4 py-3.5 max-w-[200px]">
                        <div className="flex flex-col text-[11px]">
                          <span className="truncate text-slate-300" title={order.lastEvent || order.remarks || 'No event log'}>
                            {order.lastEvent || order.remarks || 'In transit to destination'}
                          </span>
                          {order.dispatchDate && (
                            <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Dispatched: {parseAndFormatLogisticsDate(order.dispatchDate).displayDate || order.dispatchDate.slice(0, 10)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 10. Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {onTrackOrder && order.awbNumber && (
                            <button
                              type="button"
                              onClick={() => onTrackOrder(order)}
                              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Truck size={10} />
                              <span>Track</span>
                            </button>
                          )}
                          {onViewCustomer && order.customerKey && (
                            <button
                              type="button"
                              onClick={() => onViewCustomer(order.customerKey)}
                              className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              Customer
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. PAGINATION FOOTER */}
        {delayedItems.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800 bg-[#0d1627] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-500 ml-2">
                Showing {startIndex + 1}–{Math.min(startIndex + pageSize, delayedItems.length)} of {delayedItems.length}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage === 1}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="First Page"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safeCurrentPage === 1}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>

              <span className="px-3 py-1 font-mono font-bold text-slate-200">
                Page {safeCurrentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage === totalPages}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage === totalPages}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Last Page"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

export default DeliveryDelaysView;
