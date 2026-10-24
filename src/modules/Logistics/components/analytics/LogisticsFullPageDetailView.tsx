import React, { useMemo, useState } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Download, 
  Copy, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  ArrowUpDown,
  Truck,
  ExternalLink,
  Package,
  Calendar,
  X,
  CreditCard
} from 'lucide-react';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { 
  getCanonicalStatus, 
  STATUS_METADATA_MAP, 
  formatINR, 
  isCodOrder 
} from '../../utils/logisticsAnalyticsUtils';
import { normalizeCourier } from '../../../../config/courierConfig';
import { resolveCustomerLocationDisplay, parseOrderAmount } from '../../../../utils/logisticsOrderUtils';
import { parseAndFormatLogisticsDate } from '../../../../utils/logisticsDateUtils';
import toast from 'react-hot-toast';

interface LogisticsFullPageDetailViewProps {
  title: string;
  subtitle: string;
  orders: UnifiedLogisticsOrder[];
  onClose: () => void;
  onTrackOrder?: (order: any) => void;
  onViewCustomer?: (customerKey: string) => void;
}

export const LogisticsFullPageDetailView: React.FC<LogisticsFullPageDetailViewProps> = ({
  title,
  subtitle,
  orders,
  onClose,
  onTrackOrder,
  onViewCustomer
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortField, setSortField] = useState<'date' | 'amount' | 'orderId' | 'status'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Filter orders by search query
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(o => 
        (o.orderId || '').toLowerCase().includes(q) ||
        (o.displayOrderId || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.phoneNumber || '').includes(q) ||
        (o.awbNumber || '').toLowerCase().includes(q) ||
        (o.products || '').toLowerCase().includes(q) ||
        (o.city || '').toLowerCase().includes(q) ||
        (o.state || '').toLowerCase().includes(q)
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      let diff = 0;
      if (sortField === 'date') {
        const d1 = a.orderDate || a.dispatchDate || '';
        const d2 = b.orderDate || b.dispatchDate || '';
        diff = d2.localeCompare(d1);
      } else if (sortField === 'amount') {
        const amt1 = parseOrderAmount(a.amount ?? a.totalAmount) || 0;
        const amt2 = parseOrderAmount(b.amount ?? b.totalAmount) || 0;
        diff = amt2 - amt1;
      } else if (sortField === 'orderId') {
        diff = (b.orderId || '').localeCompare(a.orderId || '');
      } else if (sortField === 'status') {
        diff = getCanonicalStatus(a).localeCompare(getCanonicalStatus(b));
      }

      return sortAsc ? -diff : diff;
    });
  }, [orders, searchQuery, sortField, sortAsc]);

  // Pagination calculation
  const totalRecords = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedOrders = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredOrders.slice(startIdx, startIdx + pageSize);
  }, [filteredOrders, safeCurrentPage, pageSize]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}: ${text}`);
  };

  // CSV Export handler
  const handleExportCsv = () => {
    if (filteredOrders.length === 0) {
      toast.error('No records to export');
      return;
    }

    const headers = [
      'Order ID',
      'Customer Name',
      'Phone Number',
      'Location',
      'Order Date',
      'Dispatch Date',
      'Delivered Date',
      'Courier',
      'AWB Number',
      'Payment Mode',
      'Amount (INR)',
      'Canonical Status',
      'Products'
    ];

    const rows = filteredOrders.map(o => [
      `"${o.displayOrderId || o.orderId}"`,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${o.phoneNumber || ''}"`,
      `"${resolveCustomerLocationDisplay(o.state, o.city, o.pincode)}"`,
      `"${o.orderDate || ''}"`,
      `"${o.dispatchDate || ''}"`,
      `"${o.deliveredDate || ''}"`,
      `"${normalizeCourier(o.courier) || 'Unassigned'}"`,
      `"${o.awbNumber || ''}"`,
      `"${o.orderType || 'Prepaid'}"`,
      parseOrderAmount(o.amount ?? o.totalAmount) || 0,
      `"${getCanonicalStatus(o)}"`,
      `"${(o.products || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}_records.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredOrders.length} records to CSV`);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#070d18] text-slate-200">
      
      {/* TOP BAR / BREADCRUMB HEADER */}
      <div className="bg-[#0b1220] border-b border-slate-800 p-4 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-md">
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-xl bg-[#0e1626] hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white flex items-center gap-2 text-xs font-bold transition-all cursor-pointer shadow-sm group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform text-cyan-400" />
            <span>Back to Analytics</span>
          </button>

          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>{title}</span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                {totalRecords.toLocaleString('en-IN')} Orders
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* ACTIONS: EXPORT & CLOSE */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={handleExportCsv}
            className="h-9 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-purple-900/40 transition-colors cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>

      </div>

      {/* FILTER & PAGINATION TOOLBAR */}
      <div className="bg-[#0b1220]/80 border-b border-slate-800/80 px-4 py-3 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search order ID, customer, phone, AWB, city..."
            className="w-full bg-[#0e1626] border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Page Size & Pagination Controls */}
        <div className="flex items-center gap-3 justify-between sm:justify-end">
          
          {/* Rows Per Page Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[11px]">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#0e1626] border border-slate-800 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono font-bold focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Page Indicators & Buttons */}
          <div className="flex items-center gap-1 text-xs font-mono">
            <span className="text-slate-400 text-[11px] mr-1">
              Page <strong className="text-white">{safeCurrentPage}</strong> of {totalPages}
            </span>

            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded-lg bg-[#0e1626] hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-800 cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1 rounded-lg bg-[#0e1626] hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-800 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-1 rounded-lg bg-[#0e1626] hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-800 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded-lg bg-[#0e1626] hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-800 cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>

        </div>

      </div>

      {/* TABLE VIEW (FLEX-1 SCROLLABLE) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0e1626] text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5">Order ID</th>
                <th className="px-4 py-3.5">Customer & Phone</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5">Courier & AWB</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Payment</th>
                <th className="px-4 py-3.5 text-right">Order Value</th>
                <th className="px-4 py-3.5 text-center">Key Dates</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-xs text-slate-500">
                    No orders match your current drill-down search
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o) => {
                  const canonical = getCanonicalStatus(o);
                  const meta = STATUS_METADATA_MAP[canonical];
                  const amt = parseOrderAmount(o.amount ?? o.totalAmount) || 0;
                  const isCod = isCodOrder(o);

                  return (
                    <tr key={o.id} className="hover:bg-slate-900/60 transition-colors">
                      
                      {/* Order ID */}
                      <td className="px-4 py-3.5 font-mono font-bold text-cyan-300 whitespace-nowrap">
                        {o.displayOrderId || o.orderId}
                      </td>

                      {/* Customer Name & Phone */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-200">{o.customerName || '—'}</div>
                        {o.phoneNumber && (
                          <div className="text-[10px] font-mono text-slate-400">{o.phoneNumber}</div>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3.5 text-slate-300 max-w-[140px] truncate">
                        {resolveCustomerLocationDisplay(o.state, o.city, o.pincode)}
                      </td>

                      {/* Courier & AWB */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-200">{normalizeCourier(o.courier) || 'Unassigned'}</div>
                        {o.awbNumber && (
                          <div 
                            onClick={() => copyToClipboard(o.awbNumber!, 'AWB')}
                            className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
                            title="Click to copy AWB"
                          >
                            <span>{o.awbNumber}</span>
                            <Copy size={10} />
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText}`}>
                          {canonical}
                        </span>
                      </td>

                      {/* Payment */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                          isCod 
                            ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60' 
                            : 'bg-purple-950/60 text-purple-400 border-purple-800/60'
                        }`}>
                          {isCod ? 'COD' : 'Prepaid'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-200">
                        {formatINR(amt)}
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3.5 text-center font-mono text-[11px] text-slate-400">
                        {o.orderDate && <div>Order: {o.orderDate}</div>}
                        {o.dispatchDate && <div className="text-cyan-400">Disp: {o.dispatchDate.slice(0, 10)}</div>}
                        {o.deliveredDate && <div className="text-emerald-400">Deliv: {o.deliveredDate.slice(0, 10)}</div>}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {onTrackOrder && o.awbNumber && (
                            <button
                              type="button"
                              onClick={() => onTrackOrder(o as any)}
                              className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              Track
                            </button>
                          )}
                          {onViewCustomer && o.customerKey && (
                            <button
                              type="button"
                              onClick={() => onViewCustomer(o.customerKey)}
                              className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold transition-colors cursor-pointer"
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
      </div>

    </div>
  );
};
