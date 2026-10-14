import React, { useState } from 'react';
import { 
  Package, 
  Truck, 
  MapPin, 
  Calendar, 
  IndianRupee, 
  RotateCcw, 
  ExternalLink,
  AlertTriangle,
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
  Check
} from 'lucide-react';
import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { getCourierTrackingUrl } from '../../../config/courierConfig';

interface OrderTableViewProps {
  orders: UnifiedLogisticsOrder[];
  onTrackOrder: (order: UnifiedLogisticsOrder) => void;
  onSyncOrder?: (order: UnifiedLogisticsOrder) => void;
  onViewCustomer?: (customerKey: string) => void;
  onOpenDispatchModal?: (order: UnifiedLogisticsOrder) => void;
  onDeleteOrder?: (order: UnifiedLogisticsOrder) => void;
  syncingOrderIds?: Set<number>;

  // Selection
  isSelectable?: boolean;
  selectedOrderIds?: Set<string>;
  onToggleSelect?: (orderId: string) => void;
  onToggleSelectAll?: () => void;
  allSelected?: boolean;
}

export const OrderTableView: React.FC<OrderTableViewProps> = ({
  orders,
  onTrackOrder,
  onSyncOrder,
  onViewCustomer,
  onOpenDispatchModal,
  onDeleteOrder,
  syncingOrderIds = new Set(),
  isSelectable = false,
  selectedOrderIds = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  allSelected = false
}) => {
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  const handleCopyAwb = (awb?: string) => {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopiedAwb(awb);
    setTimeout(() => setCopiedAwb(null), 2000);
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = (status || '').toLowerCase();
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

  return (
    <div className="flex flex-col bg-[#0b1220] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl w-full max-w-full min-w-0">
      <div className="w-full max-w-full min-w-0 overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#0e1626] text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-bold sticky top-0 z-10 select-none">
            <tr>
              {isSelectable && (
                <th className="px-3 py-3.5 bg-[#0e1626] w-9">
                  <button
                    type="button"
                    onClick={onToggleSelectAll}
                    className="text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    {allSelected ? (
                      <CheckSquare size={15} className="text-purple-400" />
                    ) : (
                      <Square size={15} className="text-slate-500" />
                    )}
                  </button>
                </th>
              )}
              <th className="px-3 py-3.5 bg-[#0e1626]">ORDER ID</th>
              <th className="px-3 py-3.5 bg-[#0e1626]">AWB NUMBER</th>
              <th className="px-3 py-3.5 bg-[#0e1626]">COURIER</th>
              <th className="px-3 py-3.5 bg-[#0e1626]">STATUS</th>
              <th className="px-3 py-3.5 bg-[#0e1626]">REMARKS</th>
              <th className="px-3 py-3.5 bg-[#0e1626] whitespace-nowrap">DISPATCHED DATE</th>
              <th className="px-3 py-3.5 bg-[#0e1626] leading-tight whitespace-nowrap">ESTIMATED DELIVERY DATE</th>
              <th className="px-3 py-3.5 bg-[#0e1626] whitespace-nowrap">DELIVERED DATE</th>
              <th className="px-3 py-3.5 bg-[#0e1626] whitespace-nowrap">LAST SYNCED</th>
              <th className="px-3 py-3.5 bg-[#0e1626] text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {orders.map((order) => {
              const isSyncing = order.rawId ? syncingOrderIds.has(order.rawId) : false;
              const isSelected = selectedOrderIds.has(order.id);
              const badgeStyle = getStatusBadgeStyle(order.status);

              return (
                <tr 
                  key={order.id} 
                  className={`transition-colors hover:bg-slate-850/40 ${
                    isSelected ? 'bg-purple-950/20 hover:bg-purple-950/30' : ''
                  }`}
                >
                  {/* Select Checkbox */}
                  {isSelectable && (
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onToggleSelect && onToggleSelect(order.id)}
                        className="text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare size={15} className="text-purple-400" />
                        ) : (
                          <Square size={15} className="text-slate-500" />
                        )}
                      </button>
                    </td>
                  )}

                  {/* 1. ORDER ID */}
                  <td className="px-3 py-3 font-mono font-bold text-slate-200">
                    <div className="flex flex-col gap-0.5 items-start">
                      <div className="flex items-center gap-1.5">
                        <span className="whitespace-nowrap text-slate-100 font-bold">
                          {order.displayOrderId}
                        </span>
                        {order.source === 'shopify' && (
                          <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                            Shopify
                          </span>
                        )}
                      </div>
                      <div 
                        onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                        className="text-[11px] font-sans font-normal text-slate-400 hover:text-purple-300 transition-colors cursor-pointer truncate max-w-[150px]"
                        title={order.customerName}
                      >
                        {order.customerName}
                      </div>
                    </div>
                  </td>

                  {/* 2. AWB NUMBER */}
                  <td className="px-3 py-3 font-mono font-bold text-slate-200">
                    {order.awbNumber ? (
                      <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                        <span className="truncate" title={order.awbNumber}>{order.awbNumber}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyAwb(order.awbNumber)}
                          className="p-1 text-slate-500 hover:text-purple-300 rounded transition-colors cursor-pointer shrink-0"
                          title="Copy AWB Number"
                          aria-label="Copy AWB Number"
                        >
                          {copiedAwb === order.awbNumber ? (
                            <Check size={12} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">Unassigned</span>
                    )}
                  </td>

                  {/* 3. COURIER */}
                  <td className="px-3 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border ${getCourierBadgeClass(order.courier)}`}>
                      {order.courier || 'Unassigned'}
                    </span>
                  </td>

                  {/* 4. STATUS */}
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot} shrink-0`} />
                      <span className="truncate">{order.status}</span>
                    </span>
                  </td>

                  {/* 5. REMARKS */}
                  <td className="px-3 py-3 text-slate-300 max-w-[200px]">
                    {order.remarks && order.remarks.trim() ? (
                      <span 
                        className="block w-full truncate text-slate-300 font-medium cursor-help hover:text-white transition-colors text-[11px]" 
                        title={order.remarks.trim()}
                      >
                        {order.remarks.trim()}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">—</span>
                    )}
                  </td>

                  {/* 6. DISPATCHED DATE */}
                  <td className="px-3 py-3 font-medium text-slate-200 whitespace-nowrap text-[11px]">
                    {order.dispatchDate ? (
                      <span className="text-slate-200 font-mono">{order.dispatchDate}</span>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">—</span>
                    )}
                  </td>

                  {/* 7. ESTIMATED DELIVERY DATE */}
                  <td className="px-3 py-3 font-medium text-slate-200 whitespace-nowrap text-[11px]">
                    {order.estimatedDeliveryDate ? (
                      <span className="text-slate-200 font-mono">{order.estimatedDeliveryDate}</span>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">—</span>
                    )}
                  </td>

                  {/* 8. DELIVERED DATE */}
                  <td className="px-3 py-3 font-medium text-slate-200 whitespace-nowrap text-[11px]">
                    {order.deliveredDate ? (
                      <span className="text-slate-200 font-mono">{order.deliveredDate}</span>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">—</span>
                    )}
                  </td>

                  {/* 9. LAST SYNCED AT */}
                  <td className="px-3 py-3 text-slate-400 whitespace-nowrap text-[10px] font-mono">
                    {order.syncedAt ? (
                      <span>{order.syncedAt}</span>
                    ) : (
                      <span className="text-slate-600 italic">Not synced</span>
                    )}
                  </td>

                  {/* 10. ACTIONS */}
                  <td className="px-2 sm:px-3 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1 shrink-0">
                      {order.workflowStage === 'prepare_dispatch' && onOpenDispatchModal && (
                        <button
                          type="button"
                          onClick={() => onOpenDispatchModal(order)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer mr-1"
                          title="Confirm Dispatch"
                        >
                          <span>Dispatch</span>
                          <ArrowRight size={10} />
                        </button>
                      )}

                      {/* Official Courier Tracking Page Link */}
                      {order.awbNumber && getCourierTrackingUrl(order.courier, order.awbNumber) && (
                        <a
                          href={getCourierTrackingUrl(order.courier, order.awbNumber)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-600/60 transition-all flex items-center justify-center cursor-pointer shadow-sm group shrink-0"
                          title={`Open ${order.courier || 'Courier'} Official Tracking Page`}
                          aria-label="Open Courier Official Tracking"
                        >
                          <ExternalLink size={12} className="group-hover:scale-110 transition-transform text-slate-400 group-hover:text-cyan-300" />
                        </a>
                      )}

                      {/* View Shipment Details */}
                      <button
                        type="button"
                        onClick={() => onTrackOrder(order)}
                        className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-purple-950/70 text-slate-400 hover:text-purple-300 border border-slate-700/80 hover:border-purple-600/60 transition-all flex items-center justify-center cursor-pointer shadow-sm group shrink-0"
                        title="View Shipment Details & Tracking Events"
                        aria-label="View Shipment Details"
                      >
                        <Eye size={12} className="group-hover:scale-110 transition-transform text-slate-400 group-hover:text-purple-300" />
                      </button>

                      {/* Sync Courier Status */}
                      {onSyncOrder && order.rawId && order.awbNumber && (
                        <button
                          type="button"
                          onClick={() => onSyncOrder(order)}
                          disabled={isSyncing}
                          className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
                          title="Sync Courier Tracking Status"
                          aria-label="Sync Courier Tracking Status"
                        >
                          <RotateCcw size={11} className={isSyncing ? 'animate-spin text-purple-400' : ''} />
                        </button>
                      )}

                      {/* Delete Shipment if requested */}
                      {onDeleteOrder && (
                        <button
                          type="button"
                          onClick={() => onDeleteOrder(order)}
                          className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-600/60 transition-all flex items-center justify-center cursor-pointer shadow-sm group shrink-0"
                          title="Delete Order / Shipment"
                          aria-label="Delete Order"
                        >
                          <Trash2 size={12} className="group-hover:scale-110 transition-transform text-slate-400 group-hover:text-rose-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
