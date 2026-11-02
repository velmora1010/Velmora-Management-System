import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Truck, 
  MapPin, 
  Calendar, 
  IndianRupee, 
  RotateCcw, 
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  User,
  Phone,
  CheckSquare,
  Square,
  ArrowRight,
  Eye,
  Trash2,
  Copy,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  History,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { UnifiedLogisticsOrder, UnifiedWorkflowStage } from '../../../types/unifiedLogistics';
import { getCourierTrackingUrl } from '../../../config/courierConfig';
import { parseAndFormatLogisticsDate } from '../../../utils/logisticsDateUtils';
import { 
  resolveCustomerLocationDisplay, 
  formatOrderAmountDisplay 
} from '../../../utils/logisticsOrderUtils';

interface OrderTableViewProps {
  orders: UnifiedLogisticsOrder[];
  stage?: UnifiedWorkflowStage;
  onTrackOrder: (order: UnifiedLogisticsOrder) => void;
  onSyncOrder?: (order: UnifiedLogisticsOrder) => void;
  onViewCustomer?: (customerKey: string) => void;
  onOpenDispatchModal?: (order: UnifiedLogisticsOrder) => void;
  onDeleteOrder?: (order: UnifiedLogisticsOrder) => void;
  onReviewCancellation?: (order: UnifiedLogisticsOrder) => void;
  onViewCancellationHistory?: (order: UnifiedLogisticsOrder) => void;
  syncingOrderIds?: Set<number>;

  // Selection
  isSelectable?: boolean;
  selectedOrderIds?: Set<string>;
  onToggleSelect?: (orderId: string) => void;
  onToggleSelectAll?: () => void;
  allSelected?: boolean;
}

type SortField = 'orderId' | 'date' | 'customer' | 'phone' | 'product' | 'amount' | 'payment' | 'status' | 'awb' | 'courier';
type SortDirection = 'asc' | 'desc';

export const OrderTableView: React.FC<OrderTableViewProps> = ({
  orders,
  stage = 'active',
  onTrackOrder,
  onSyncOrder,
  onViewCustomer,
  onOpenDispatchModal,
  onDeleteOrder,
  onReviewCancellation,
  onViewCancellationHistory,
  syncingOrderIds = new Set(),
  isSelectable = false,
  selectedOrderIds = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  allSelected = false
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Reset to page 1 if orders or filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [orders.length, stage]);

  const handleCopy = (text: string, id: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort orders
  const sortedOrders = useMemo(() => {
    const list = [...orders];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'orderId':
          cmp = (a.displayOrderId || '').localeCompare(b.displayOrderId || '', undefined, { numeric: true });
          break;
        case 'date':
          cmp = (a.orderDate || '').localeCompare(b.orderDate || '');
          break;
        case 'customer':
          cmp = (a.customerName || '').localeCompare(b.customerName || '');
          break;
        case 'phone':
          cmp = (a.phoneNumber || a.phone || '').localeCompare(b.phoneNumber || b.phone || '');
          break;
        case 'amount':
          cmp = (a.amount ?? a.totalAmount ?? 0) - (b.amount ?? b.totalAmount ?? 0);
          break;
        case 'payment':
          cmp = (a.orderType || '').localeCompare(b.orderType || '');
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
        case 'awb':
          cmp = (a.awbNumber || '').localeCompare(b.awbNumber || '');
          break;
        case 'courier':
          cmp = (a.courier || '').localeCompare(b.courier || '');
          break;
        default:
          cmp = 0;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [orders, sortField, sortDirection]);

  // Paginated slice
  const totalOrders = sortedOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalOrders);
  const currentOrders = useMemo(() => {
    return sortedOrders.slice(startIndex, endIndex);
  }, [sortedOrders, startIndex, endIndex]);

  const getStatusBadgeStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('fulfilled') && !s.includes('unfulfilled') && !s.includes('partial')) {
      return {
        bg: 'bg-emerald-950/70',
        text: 'text-emerald-300',
        border: 'border-emerald-700/60',
        dot: 'bg-emerald-400'
      };
    }
    if (s.includes('partial')) {
      return {
        bg: 'bg-amber-950/70',
        text: 'text-amber-300',
        border: 'border-amber-700/60',
        dot: 'bg-amber-400'
      };
    }
    if (s.includes('restocked')) {
      return {
        bg: 'bg-cyan-950/70',
        text: 'text-cyan-300',
        border: 'border-cyan-700/60',
        dot: 'bg-cyan-400'
      };
    }
    if (s.includes('unfulfilled') || s.includes('awaiting')) {
      return {
        bg: 'bg-purple-950/70',
        text: 'text-purple-300',
        border: 'border-purple-700/60',
        dot: 'bg-purple-400'
      };
    }
    if (s.includes('delivered')) {
      return {
        bg: 'bg-emerald-950/60',
        text: 'text-emerald-400',
        border: 'border-emerald-600/60',
        dot: 'bg-emerald-400'
      };
    }
    if (s.includes('out for delivery')) {
      return {
        bg: 'bg-cyan-950/60',
        text: 'text-cyan-400',
        border: 'border-cyan-600/60',
        dot: 'bg-cyan-400'
      };
    }
    if (s.includes('in transit') || s.includes('transit')) {
      return {
        bg: 'bg-blue-950/60',
        text: 'text-blue-400',
        border: 'border-blue-600/60',
        dot: 'bg-blue-400'
      };
    }
    if (s.includes('failed attempt')) {
      return {
        bg: 'bg-amber-950/60',
        text: 'text-amber-400',
        border: 'border-amber-600/60',
        dot: 'bg-amber-400'
      };
    }
    if (s.includes('exception') || s.includes('rto') || s.includes('error')) {
      return {
        bg: 'bg-rose-950/60',
        text: 'text-rose-400',
        border: 'border-rose-600/60',
        dot: 'bg-rose-400'
      };
    }
    return {
      bg: 'bg-slate-900',
      text: 'text-slate-300',
      border: 'border-slate-700/80',
      dot: 'bg-slate-400'
    };
  };

  const getCourierBadgeClass = (courier?: string) => {
    const c = (courier || '').toLowerCase();
    if (c.includes('ithink') && c.includes('ekart')) return 'bg-amber-950/60 border-amber-800/60 text-amber-300';
    if (c.includes('ithink') && c.includes('delhivery')) return 'bg-indigo-950/60 border-indigo-800/60 text-indigo-300';
    if (c.includes('ithink') && c.includes('amazon')) return 'bg-orange-950/60 border-orange-800/60 text-orange-300';
    if (c.includes('india post')) return 'bg-rose-950/60 border-rose-800/60 text-rose-300';
    if (c.includes('delhivery')) return 'bg-cyan-950/60 border-cyan-800/60 text-cyan-300';
    if (c.includes('st courier') || c.includes('stcourier')) return 'bg-purple-950/60 border-purple-800/60 text-purple-300';
    if (c.includes('amazon')) return 'bg-amber-950/60 border-amber-800/60 text-amber-300';
    return 'bg-slate-900 border-slate-800 text-slate-300';
  };

  const renderSortArrow = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={11} className="text-slate-500 opacity-60 group-hover:opacity-100 shrink-0" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={11} className="text-purple-400 shrink-0" />
    ) : (
      <ArrowDown size={11} className="text-purple-400 shrink-0" />
    );
  };

  const isDispatchedView = stage === 'dispatched';
  const isTrackingView = stage === 'tracking';
  const isFulfilledView = stage === 'fulfilled';

  return (
    <div className="flex flex-col bg-[#0b1220] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl w-full max-w-full min-w-0">
      
      {/* Table Container with Horizontal Scroll */}
      <div className="w-full max-w-full min-w-0 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          
          {/* THEAD */}
          <thead className="bg-[#0e1626] text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-bold sticky top-0 z-10 select-none">
            <tr>
              {/* Checkbox (Only when isSelectable is true and not fulfilled) */}
              {isSelectable && !isFulfilledView && (
                <th className="px-3.5 py-3.5 bg-[#0e1626] w-10 text-center">
                  <button
                    type="button"
                    onClick={onToggleSelectAll}
                    className="text-slate-400 hover:text-purple-400 transition-colors cursor-pointer inline-flex items-center justify-center"
                    title={allSelected ? "Deselect All" : "Select All"}
                  >
                    {allSelected ? (
                      <CheckSquare size={16} className="text-purple-400" />
                    ) : (
                      <Square size={16} className="text-slate-500 hover:text-slate-300" />
                    )}
                  </button>
                </th>
              )}

              {/* 1. ORDER ID */}
              <th 
                className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                onClick={() => handleSort('orderId')}
              >
                <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                  <span>{isTrackingView ? 'ORDER ID / AWB' : 'ORDER ID'}</span>
                  {renderSortArrow('orderId')}
                </div>
              </th>

              {isDispatchedView ? (
                /* DISPATCHED COLUMNS */
                <>
                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>ORDER DATE</span>
                      {renderSortArrow('date')}
                    </div>
                  </th>

                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('customer')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>CUSTOMER</span>
                      {renderSortArrow('customer')}
                    </div>
                  </th>

                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('phone')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>PHONE</span>
                      {renderSortArrow('phone')}
                    </div>
                  </th>

                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('courier')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>COURIER</span>
                      {renderSortArrow('courier')}
                    </div>
                  </th>

                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('awb')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>AWB NUMBER</span>
                      {renderSortArrow('awb')}
                    </div>
                  </th>

                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300 whitespace-nowrap">
                    <span>DISPATCH DATE</span>
                  </th>

                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300 whitespace-nowrap">
                    <span>DISPATCH STATUS</span>
                  </th>
                </>
              ) : isTrackingView ? (
                /* TRACKING COLUMNS (Matching Courier Dashboard Reference) */
                <>
                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>MANIFESTED DATE</span>
                      {renderSortArrow('date')}
                    </div>
                  </th>

                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>STATUS</span>
                      {renderSortArrow('status')}
                    </div>
                  </th>

                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300">
                    <span>PICKUP & DELIVERY</span>
                  </th>

                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300">
                    <span>TRANSPORT & ZONE</span>
                  </th>

                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('payment')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>PAYMENT MODE</span>
                      {renderSortArrow('payment')}
                    </div>
                  </th>

                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300">
                    <span>LAST UPDATE</span>
                  </th>
                </>
              ) : isFulfilledView ? (
                /* FULFILLED VIEW HEADERS */
                <>
                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>ORDER DATE</span>
                      {renderSortArrow('date')}
                    </div>
                  </th>

                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('customer')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>CUSTOMER</span>
                      {renderSortArrow('customer')}
                    </div>
                  </th>

                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('phone')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>PHONE</span>
                      {renderSortArrow('phone')}
                    </div>
                  </th>

                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300">
                    <span>LOCATION</span>
                  </th>

                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300">
                    <span>PRODUCTS (QTY)</span>
                  </th>

                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>AMOUNT</span>
                      {renderSortArrow('amount')}
                    </div>
                  </th>

                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('payment')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>PAYMENT</span>
                      {renderSortArrow('payment')}
                    </div>
                  </th>

                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300 whitespace-nowrap">
                    <span>FULFILMENT STATUS</span>
                  </th>

                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300 whitespace-nowrap">
                    <span>FULFILLED DATE</span>
                  </th>

                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300 whitespace-nowrap">
                    <span>SHIPMENT / COURIER</span>
                  </th>
                </>
              ) : (
                /* ACTIVE COLUMNS (Matching Image 1) */
                <>
                  {/* 2. ORDER DATE */}
                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>ORDER DATE</span>
                      {renderSortArrow('date')}
                    </div>
                  </th>

                  {/* 3. CUSTOMER */}
                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('customer')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>CUSTOMER</span>
                      {renderSortArrow('customer')}
                    </div>
                  </th>

                  {/* 4. PHONE */}
                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('phone')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>PHONE</span>
                      {renderSortArrow('phone')}
                    </div>
                  </th>

                  {/* 5. PRODUCTS (QTY) */}
                  <th className="px-3.5 py-3.5 bg-[#0e1626] text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span>PRODUCTS (QTY)</span>
                    </div>
                  </th>

                  {/* 6. AMOUNT */}
                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>AMOUNT</span>
                      {renderSortArrow('amount')}
                    </div>
                  </th>

                  {/* 7. PAYMENT */}
                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('payment')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>PAYMENT</span>
                      {renderSortArrow('payment')}
                    </div>
                  </th>

                  {/* 8. STATUS */}
                  <th 
                    className="px-3.5 py-3.5 bg-[#0e1626] cursor-pointer group"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-white">
                      <span>STATUS</span>
                      {renderSortArrow('status')}
                    </div>
                  </th>
                </>
              )}

              {/* ACTIONS */}
              <th className="px-3.5 py-3.5 bg-[#0e1626] text-center w-28">
                <span>ACTIONS</span>
              </th>
            </tr>
          </thead>

          {/* TBODY */}
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {currentOrders.map((order) => {
              const isSyncing = order.rawId ? syncingOrderIds.has(order.rawId) : false;
              const isSelected = selectedOrderIds.has(order.id);
              const isCancelled = order.status === 'Cancelled' || 
                                  order.cancellationStatus === 'Completed' || 
                                  (order.fulfillmentStatus || '').toLowerCase() === 'cancelled';
              const effectiveStatus = order.workflowStage === 'active' ? 'Unfulfilled' : order.status;
              const badgeStyle = getStatusBadgeStyle(effectiveStatus);
              const dateInfo = parseAndFormatLogisticsDate(order.orderDateDisplay || order.orderDate);
              const isCod = (order.orderType || '').toLowerCase().includes('cod');

              return (
                <tr 
                  key={order.id} 
                  className={`transition-colors hover:bg-slate-800/40 ${
                    isSelected ? 'bg-purple-950/25 hover:bg-purple-950/35' : ''
                  }`}
                >
                  {/* Select Checkbox (Only when isSelectable is true) */}
                  {isSelectable && (
                    <td className="px-3.5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => onToggleSelect && onToggleSelect(order.id)}
                        className="text-slate-400 hover:text-purple-400 transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-purple-400" />
                        ) : (
                          <Square size={16} className="text-slate-500 hover:text-slate-300" />
                        )}
                      </button>
                    </td>
                  )}

                  {/* 1. ORDER ID / AWB */}
                  <td className="px-3.5 py-3.5 whitespace-nowrap">
                    {isTrackingView ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span 
                            onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                            className="font-bold text-purple-300 text-xs hover:text-purple-200 cursor-pointer"
                          >
                            {order.displayOrderId || (order.orderId ? `#${order.orderId}` : '—')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(order.displayOrderId || order.orderId, order.id + '-ord', 'Order ID')}
                            className="p-0.5 text-slate-500 hover:text-purple-300 transition-colors cursor-pointer"
                            title="Copy Order ID"
                          >
                            {copiedId === order.id + '-ord' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          </button>
                        </div>
                        {order.awbNumber ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-cyan-300">
                            <span>{order.awbNumber}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(order.awbNumber!, order.id + '-awb', 'AWB')}
                              className="p-0.5 text-slate-500 hover:text-cyan-300 transition-colors cursor-pointer"
                              title="Copy AWB"
                            >
                              {copiedId === order.id + '-awb' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            </button>
                            {order.courier && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-sans">
                                {order.courier}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">No AWB</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span 
                            onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                            className="whitespace-nowrap text-slate-100 font-bold hover:text-purple-300 cursor-pointer transition-colors"
                          >
                            {order.displayOrderId}
                          </span>
                        </div>
                        {isCancelled && order.previousShipmentStatus && (
                          <span className="text-[10px] text-cyan-400 font-mono">
                            Prior: {order.previousShipmentStatus}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* DISPATCHED VIEW ROW COLUMNS */}
                  {isDispatchedView ? (
                    <>
                      {/* 2. ORDER DATE */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-medium text-xs">
                            {dateInfo.displayDate || '14 Oct 2026'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {dateInfo.timeStr || '10:00 AM'}
                          </span>
                        </div>
                      </td>

                      {/* 3. CUSTOMER */}
                      <td className="px-3.5 py-3.5">
                        <div className="flex flex-col max-w-[170px]">
                          <span 
                            onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                            className="font-semibold text-slate-200 hover:text-purple-300 transition-colors cursor-pointer truncate"
                            title={order.customerName}
                          >
                            {order.customerName}
                          </span>
                          <span 
                            className="text-[11px] text-slate-400 truncate mt-0.5" 
                            title={resolveCustomerLocationDisplay(order.state || order.shippingState, order.city || order.shippingCity, order.pincode)}
                          >
                            {resolveCustomerLocationDisplay(order.state || order.shippingState, order.city || order.shippingCity, order.pincode)}
                          </span>
                        </div>
                      </td>

                      {/* 4. PHONE */}
                      <td className="px-3.5 py-3.5 font-mono text-slate-300 text-xs whitespace-nowrap">
                        {order.phoneNumber || order.phone || order.rawPhoneNumber || '—'}
                      </td>

                      {/* 5. COURIER */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border ${getCourierBadgeClass(order.courier)}`}>
                          {order.courier || 'ST Courier'}
                        </span>
                      </td>

                      {/* 6. AWB NUMBER */}
                      <td className="px-3.5 py-3.5 font-mono text-xs whitespace-nowrap">
                        {order.awbNumber ? (
                          <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                            <span className="font-bold text-purple-300 truncate" title={order.awbNumber}>{order.awbNumber}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(order.awbNumber!, order.id, 'AWB')}
                              className="p-1 text-slate-500 hover:text-purple-300 rounded transition-colors cursor-pointer shrink-0"
                              title="Copy AWB Number"
                            >
                              {copiedId === order.id ? (
                                <Check size={12} className="text-emerald-400" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* 7. DISPATCH DATE */}
                      <td className="px-3.5 py-3.5 font-medium text-slate-200 whitespace-nowrap text-[11px]">
                        {order.dispatchDate ? (
                          <span className="text-slate-200 font-mono">
                            {parseAndFormatLogisticsDate(order.dispatchDate).displayDate || order.dispatchDate}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* 8. DISPATCH STATUS */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border bg-emerald-950/60 text-emerald-400 border-emerald-600/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span>Dispatched</span>
                        </span>
                      </td>
                    </>
                  ) : isTrackingView ? (
                    /* TRACKING VIEW ROW COLUMNS (Matching Courier Dashboard Reference) */
                    <>
                      {/* 2. MANIFESTED DATE */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-medium text-xs">
                            {order.dispatchDate ? parseAndFormatLogisticsDate(order.dispatchDate).displayDate || order.dispatchDate : 'Pending Manifest'}
                          </span>
                          {order.dispatchDate && (
                            <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {parseAndFormatLogisticsDate(order.dispatchDate).timeStr || '11:50 AM'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. STATUS */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot} shrink-0`} />
                          <span className="truncate">{effectiveStatus}</span>
                        </span>
                      </td>

                      {/* 4. PICKUP & DELIVERY */}
                      <td className="px-3.5 py-3.5 min-w-[220px] max-w-[280px]">
                        <div className="flex flex-col gap-1 text-[11px]">
                          <div className="flex items-start gap-1 text-slate-400">
                            <MapPin size={11} className="text-purple-400 shrink-0 mt-0.5" />
                            <span className="truncate font-medium text-slate-300" title={order.pickupLocation || 'VELMORA CONSUMER B2C Erode 638002'}>
                              {order.pickupLocation || 'VELMORA CONSUMER B2C Erode 638002'}
                            </span>
                          </div>
                          <div className="flex items-start gap-1 pl-1 border-l-2 border-slate-700/60 ml-1 py-0.5 text-slate-300">
                            <span className="truncate">
                              <strong className="text-slate-200">{order.customerName}</strong>
                              {resolveCustomerLocationDisplay(order.state || order.shippingState, order.city || order.shippingCity, order.pincode) && (
                                <span className="text-slate-400"> • {resolveCustomerLocationDisplay(order.state || order.shippingState, order.city || order.shippingCity, order.pincode)}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 5. TRANSPORT & ZONE */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 font-semibold text-slate-200 text-xs">
                            <Truck size={12} className="text-indigo-400 shrink-0" />
                            <span>{order.transportMode || 'Surface'}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {order.zone || (order.state ? `${order.state.slice(0, 8)} Zone` : 'Zone S4')}
                          </span>
                        </div>
                      </td>

                      {/* 6. PAYMENT MODE */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold w-fit ${
                            isCod 
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-700/60' 
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/60'
                          }`}>
                            {isCod ? 'Cash on Delivery' : 'Prepaid'}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-200 mt-0.5">
                            {formatOrderAmountDisplay(order.amount ?? order.totalAmount)}
                          </span>
                        </div>
                      </td>

                      {/* 7. LAST UPDATE */}
                      <td className="px-3.5 py-3.5 max-w-[200px]">
                        <div className="flex flex-col text-[11px]">
                          <span className="truncate text-slate-200 font-medium" title={order.lastEvent || order.remarks || 'Order processed'}>
                            {order.lastEvent || order.remarks || 'Order processed and ready'}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px] mt-0.5">
                            {order.syncedAt || order.lastUpdated ? parseAndFormatLogisticsDate(order.syncedAt || order.lastUpdated).displayDate : 'Updated recently'}
                          </span>
                        </div>
                      </td>
                    </>
                  ) : isFulfilledView ? (
                    /* FULFILLED VIEW ROW COLUMNS */
                    <>
                      {/* 2. ORDER DATE */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-medium text-xs">
                            {dateInfo.displayDate || '14 Oct 2026'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {dateInfo.timeStr || '10:00 AM'}
                          </span>
                        </div>
                      </td>

                      {/* 3. CUSTOMER */}
                      <td className="px-3.5 py-3.5">
                        <div className="flex flex-col max-w-[170px]">
                          <span 
                            onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                            className="font-semibold text-slate-200 hover:text-purple-300 transition-colors cursor-pointer truncate"
                            title={order.customerName}
                          >
                            {order.customerName}
                          </span>
                          <span 
                            className="text-[11px] text-slate-400 truncate mt-0.5" 
                            title={resolveCustomerLocationDisplay(order.state || order.shippingState, order.city || order.shippingCity, order.pincode)}
                          >
                            {resolveCustomerLocationDisplay(order.state || order.shippingState, order.city || order.shippingCity, order.pincode)}
                          </span>
                        </div>
                      </td>

                      {/* 4. PHONE */}
                      <td className="px-3.5 py-3.5 font-mono text-slate-300 text-xs whitespace-nowrap">
                        {order.phoneNumber || order.phone || order.rawPhoneNumber || '—'}
                      </td>

                      {/* 5. LOCATION */}
                      <td className="px-3.5 py-3.5 text-slate-300 text-xs whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200">
                            {order.shippingState || order.state || '—'}
                          </span>
                          {(order.shippingCity || order.city) && (
                            <span className="text-[11px] text-slate-400">
                              {order.shippingCity || order.city}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. PRODUCTS (QTY) */}
                      <td className="px-3.5 py-3.5 text-slate-300 max-w-[240px]">
                        <span className="truncate block font-medium text-xs" title={order.products || order.productSummary}>
                          {order.products || order.productSummary || '—'}
                        </span>
                      </td>

                      {/* 7. AMOUNT */}
                      <td className="px-3.5 py-3.5 font-mono font-bold text-slate-100 whitespace-nowrap text-xs">
                        {formatOrderAmountDisplay(order.amount ?? order.totalAmount)}
                      </td>

                      {/* 8. PAYMENT */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          isCod 
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-700/60' 
                            : 'bg-blue-950/60 text-blue-300 border border-blue-700/60'
                        }`}>
                          {isCod ? 'COD' : 'Prepaid'}
                        </span>
                      </td>

                      {/* 9. FULFILMENT STATUS */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span>Fulfilled</span>
                        </span>
                      </td>

                      {/* 10. FULFILLED DATE */}
                      <td className="px-3.5 py-3.5 font-medium text-slate-200 whitespace-nowrap text-[11px]">
                        {order.fulfilledDate ? (
                          <span className="text-slate-200 font-mono">
                            {parseAndFormatLogisticsDate(order.fulfilledDate).displayDate || order.fulfilledDate}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* 11. SHIPMENT / COURIER */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap text-xs">
                        {order.awbNumber || order.courier ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-200">
                              {order.courier || 'Standard Courier'}
                            </span>
                            {order.awbNumber && (
                              <span className="text-[11px] font-mono text-cyan-400">
                                AWB: {order.awbNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Direct / External</span>
                        )}
                      </td>
                    </>
                  ) : (
                    /* ACTIVE VIEW ROW COLUMNS (Matching Image 1) */
                    <>
                      {/* 2. ORDER DATE */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-medium text-xs">
                            {dateInfo.displayDate || '14 Oct 2026'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {dateInfo.timeStr || '10:00 AM'}
                          </span>
                        </div>
                      </td>

                      {/* 3. CUSTOMER */}
                      <td className="px-3.5 py-3.5">
                        <div className="flex flex-col max-w-[170px]">
                          <span 
                            onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                            className="font-semibold text-slate-200 hover:text-purple-300 transition-colors cursor-pointer truncate"
                            title={order.customerName}
                          >
                            {order.customerName}
                          </span>
                          <span 
                            className="text-[11px] text-slate-400 truncate mt-0.5" 
                            title={resolveCustomerLocationDisplay(order.state || order.shippingState, order.city || order.shippingCity, order.pincode)}
                          >
                            {resolveCustomerLocationDisplay(order.state || order.shippingState, order.city || order.shippingCity, order.pincode)}
                          </span>
                        </div>
                      </td>

                      {/* 4. PHONE */}
                      <td className="px-3.5 py-3.5 font-mono text-slate-300 text-xs whitespace-nowrap">
                        {order.phoneNumber || order.phone || order.rawPhoneNumber || '—'}
                      </td>

                      {/* 5. PRODUCTS (QTY) */}
                      <td className="px-3.5 py-3.5 text-slate-300 max-w-[240px]">
                        <span className="truncate block font-medium text-xs" title={order.products || order.productSummary}>
                          {order.products || order.productSummary || '—'}
                        </span>
                      </td>

                      {/* 6. AMOUNT */}
                      <td className="px-3.5 py-3.5 font-mono font-bold text-slate-100 whitespace-nowrap text-xs">
                        {formatOrderAmountDisplay(order.amount ?? order.totalAmount)}
                      </td>

                      {/* 7. PAYMENT */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          isCod 
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-700/60' 
                            : 'bg-blue-950/60 text-blue-300 border border-blue-700/60'
                        }`}>
                          {isCod ? 'COD' : 'Prepaid'}
                        </span>
                      </td>

                      {/* 8. STATUS */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        {isCancelled ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-rose-950/60 text-rose-300 border-rose-800/60 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                              <span>Cancelled</span>
                            </span>
                            {order.cancellationReason && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[150px]" title={order.cancellationReason}>
                                {order.cancellationReason}
                              </span>
                            )}
                            {order.cancellationDate && (
                              <span className="text-[9px] font-mono text-slate-500">
                                {new Date(order.cancellationDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (() => {
                          const fRaw = (order.fulfillmentStatus || order.sourceFulfillmentStatus || order.status || 'Unfulfilled').trim();
                          const fLower = fRaw.toLowerCase();
                          const displayStatus = fLower === 'fulfilled' 
                            ? 'Fulfilled' 
                            : (fLower.includes('partial') ? 'Partially Fulfilled' : (fLower === 'restocked' ? 'Restocked' : 'Unfulfilled'));
                          const colBadge = getStatusBadgeStyle(displayStatus);
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${colBadge.bg} ${colBadge.text} ${colBadge.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${colBadge.dot} shrink-0`} />
                              <span>{displayStatus}</span>
                            </span>
                          );
                        })()}
                      </td>
                    </>
                  )}

                  {/* ACTIONS COLUMN */}
                  <td className="px-3.5 py-3.5 text-center whitespace-nowrap">
                    {isTrackingView ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onTrackOrder(order)}
                          className="h-7 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1"
                          title="View full tracking lifecycle"
                        >
                          <Truck size={12} />
                          <span>Track</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                          className="h-7 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-semibold transition-colors cursor-pointer"
                          title="View Customer Details"
                        >
                          Customer
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        {order.cancellationStatus === 'Requested' && onReviewCancellation && (
                          <button
                            type="button"
                            onClick={() => onReviewCancellation(order)}
                            className="h-7 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                            title="Review Cancellation Request"
                          >
                            <ShieldAlert size={12} />
                            <span>Review</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                          className="w-7 h-7 rounded-lg bg-slate-900/80 hover:bg-purple-950/70 text-slate-400 hover:text-purple-300 border border-slate-700/80 hover:border-purple-600/60 transition-all flex items-center justify-center cursor-pointer shadow-sm group shrink-0"
                          title="View Customer & Order Details"
                          aria-label="View Details"
                        >
                          <Eye size={13} className="group-hover:scale-110 transition-transform text-slate-400 group-hover:text-purple-300" />
                        </button>

                        {isCancelled && onViewCancellationHistory && (
                          <button
                            type="button"
                            onClick={() => onViewCancellationHistory(order)}
                            className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-white border border-rose-500/30 transition-all flex items-center justify-center cursor-pointer shadow-sm group shrink-0"
                            title="View Cancellation Audit History"
                            aria-label="View Cancellation History"
                          >
                            <History size={13} className="group-hover:scale-110 transition-transform text-rose-400" />
                          </button>
                        )}

                        {(isFulfilledView) && order.awbNumber && getCourierTrackingUrl(order.courier, order.awbNumber) && (
                          <a
                            href={getCourierTrackingUrl(order.courier, order.awbNumber)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-600/60 transition-all flex items-center justify-center cursor-pointer shadow-sm group shrink-0"
                            title={`Open ${order.courier || 'Courier'} Tracking`}
                          >
                            <ExternalLink size={12} className="text-slate-400 group-hover:text-cyan-300" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => onTrackOrder(order)}
                          className="w-7 h-7 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                          title="More Actions"
                          aria-label="More"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                      </div>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FOOTER PAGINATION BAR (Matching Image 1) */}
      <div className="px-5 py-3 bg-[#0e1626] border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 select-none">
        
        {/* Left: Showing range */}
        <div>
          Showing <span className="font-bold text-white font-mono">{totalOrders > 0 ? startIndex + 1 : 0}-{endIndex}</span> of{' '}
          <span className="font-bold text-white font-mono">{totalOrders}</span>
        </div>

        {/* Center: Rows per page selector */}
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-white font-semibold text-xs outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Right: Page Navigation Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
            aria-label="Previous Page"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Page numbers */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum = i + 1;
            if (totalPages > 5 && currentPage > 3) {
              pageNum = currentPage - 2 + i;
              if (pageNum > totalPages) pageNum = totalPages - 4 + i;
            }
            if (pageNum <= 0) pageNum = 1;

            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white border border-purple-500 shadow-sm shadow-purple-600/30'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          {totalPages > 5 && currentPage < totalPages - 2 && (
            <>
              <span className="px-1 text-slate-500">...</span>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  totalPages === currentPage
                    ? 'bg-purple-600 text-white border border-purple-500 shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
                }`}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
            aria-label="Next Page"
          >
            <ChevronRight size={14} />
          </button>
        </div>

      </div>

    </div>
  );
};
