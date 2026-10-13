import React from 'react';
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
  ArrowRight
} from 'lucide-react';
import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';

interface OrderTableViewProps {
  orders: UnifiedLogisticsOrder[];
  onTrackOrder: (order: UnifiedLogisticsOrder) => void;
  onSyncOrder?: (order: UnifiedLogisticsOrder) => void;
  onViewCustomer?: (customerKey: string) => void;
  onOpenDispatchModal?: (order: UnifiedLogisticsOrder) => void;
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
  syncingOrderIds = new Set(),
  isSelectable = false,
  selectedOrderIds = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  allSelected = false
}) => {
  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'Delivered':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60';
      case 'In Transit':
      case 'Out for Delivery':
        return 'bg-sky-950/60 text-sky-300 border-sky-700/60';
      case 'Delivery Exception':
      case 'Failed Attempt':
      case 'RTO':
        return 'bg-rose-950/60 text-rose-300 border-rose-700/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700/60';
    }
  };

  return (
    <div className="w-full overflow-x-auto bg-slate-900/80 border border-slate-800/90 rounded-2xl shadow-xl custom-scrollbar">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-800/90 bg-slate-950/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {isSelectable && (
              <th className="py-3 px-3 w-8">
                <button
                  type="button"
                  onClick={onToggleSelectAll}
                  className="text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                >
                  {allSelected ? (
                    <CheckSquare size={16} className="text-purple-400" />
                  ) : (
                    <Square size={16} className="text-slate-500" />
                  )}
                </button>
              </th>
            )}
            <th className="py-3 px-4">Order ID</th>
            <th className="py-3 px-4">Customer</th>
            <th className="py-3 px-4">Products</th>
            <th className="py-3 px-4">Amount</th>
            <th className="py-3 px-4">Courier & AWB</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Date</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 font-medium">
          {orders.map((order) => {
            const isSyncing = order.rawId ? syncingOrderIds.has(order.rawId) : false;
            const isSelected = selectedOrderIds.has(order.id);

            return (
              <tr 
                key={order.id} 
                className={`transition-colors group ${
                  isSelected ? 'bg-purple-950/20 hover:bg-purple-950/30' : 'hover:bg-slate-800/40'
                }`}
              >
                {/* Select Checkbox */}
                {isSelectable && (
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => onToggleSelect && onToggleSelect(order.id)}
                      className="text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare size={16} className="text-purple-400" />
                      ) : (
                        <Square size={16} className="text-slate-500" />
                      )}
                    </button>
                  </td>
                )}

                {/* Order ID */}
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-[13px]">
                      {order.displayOrderId}
                    </span>
                    {order.source === 'shopify' && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                        Shopify
                      </span>
                    )}
                  </div>
                </td>

                {/* Customer */}
                <td className="py-3 px-4 min-w-[160px]">
                  <div 
                    onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
                    className={`${onViewCustomer ? 'cursor-pointer group-hover:text-purple-300' : ''}`}
                  >
                    <div className="font-bold text-slate-200">{order.customerName}</div>
                    <div className="text-[11px] font-mono text-slate-500">{order.phoneNumber || 'N/A'}</div>
                    {(order.city || order.state) && (
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {[order.city, order.state].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </td>

                {/* Products */}
                <td className="py-3 px-4 max-w-[200px]">
                  <p className="line-clamp-2 text-slate-300 text-[11px]" title={order.products}>
                    {order.products || 'Standard order items'}
                  </p>
                </td>

                {/* Amount */}
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="font-bold text-emerald-400 flex items-center gap-0.5">
                    <IndianRupee size={11} />
                    <span>{Math.round(order.amount).toLocaleString('en-IN')}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    {order.orderType || 'Prepaid'}
                  </span>
                </td>

                {/* Courier & AWB */}
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="text-slate-300 font-semibold">{order.courier || 'Unassigned'}</div>
                  {order.awbNumber ? (
                    <span className="font-mono text-[11px] text-purple-300 bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-800/50">
                      {order.awbNumber}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-[11px] italic">No AWB</span>
                  )}
                </td>

                {/* Status */}
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(order.status)}`}>
                    {order.status}
                  </span>
                </td>

                {/* Date */}
                <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                  {order.orderDateDisplay || order.orderDate || '—'}
                </td>

                {/* Actions */}
                <td className="py-3 px-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {order.workflowStage === 'prepare_dispatch' && onOpenDispatchModal && (
                      <button
                        type="button"
                        onClick={() => onOpenDispatchModal(order)}
                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Dispatch</span>
                        <ArrowRight size={11} />
                      </button>
                    )}

                    {order.awbNumber && (
                      <button
                        type="button"
                        onClick={() => onTrackOrder(order)}
                        title="View Live Tracking"
                        className="px-2 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/60 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Track</span>
                        <ExternalLink size={10} />
                      </button>
                    )}

                    {onSyncOrder && order.rawId && order.awbNumber && (
                      <button
                        type="button"
                        onClick={() => onSyncOrder(order)}
                        disabled={isSyncing}
                        title="Sync Courier Status"
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw size={11} className={isSyncing ? 'animate-spin text-purple-400' : ''} />
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
  );
};
