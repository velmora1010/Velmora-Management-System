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

import { parseAndFormatLogisticsDate } from '../../../utils/logisticsDateUtils';

interface OrderCardProps {
  order: UnifiedLogisticsOrder;
  onTrackOrder: (order: UnifiedLogisticsOrder) => void;
  onSyncOrder?: (order: UnifiedLogisticsOrder) => void;
  onViewCustomer?: (customerKey: string) => void;
  onOpenDispatchModal?: (order: UnifiedLogisticsOrder) => void;
  isSyncing?: boolean;
  
  // Selection
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (orderId: string) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onTrackOrder,
  onSyncOrder,
  onViewCustomer,
  onOpenDispatchModal,
  isSyncing = false,
  isSelectable = false,
  isSelected = false,
  onToggleSelect
}) => {
  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'Unfulfilled':
      case 'Awaiting Dispatch':
        return {
          badge: 'bg-purple-950/70 text-purple-300 border-purple-700/60',
          icon: <Package size={11} className="text-purple-400" />
        };
      case 'Delivered':
        return {
          badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60',
          icon: <CheckCircle2 size={11} className="text-emerald-400" />
        };
      case 'In Transit':
      case 'Out for Delivery':
        return {
          badge: 'bg-sky-950/60 text-sky-300 border-sky-700/60',
          icon: <Truck size={11} className="text-sky-400" />
        };
      case 'Delivery Exception':
      case 'Failed Attempt':
      case 'RTO':
        return {
          badge: 'bg-rose-950/60 text-rose-300 border-rose-700/60',
          icon: <AlertTriangle size={11} className="text-rose-400" />
        };
      default:
        return {
          badge: 'bg-slate-800 text-slate-300 border-slate-700/60',
          icon: <Clock size={11} className="text-slate-400" />
        };
    }
  };

  const effectiveStatus = order.workflowStage === 'active' ? 'Unfulfilled' : order.status;
  const style = getBadgeStyle(effectiveStatus);
  const formattedDate = parseAndFormatLogisticsDate(order.orderDateDisplay || order.orderDate).displayDate || order.orderDateDisplay || '';

  return (
    <div 
      className={`bg-slate-900/80 hover:bg-slate-900 border rounded-2xl p-3.5 transition-all duration-200 shadow-lg flex flex-col justify-between group relative ${
        isSelected
          ? 'border-purple-500 shadow-purple-500/15 bg-purple-950/10'
          : 'border-slate-800/90 hover:border-purple-500/40'
      }`}
    >
      <div>
        {/* Top Header: Select Checkbox, Order ID, Date & Amount */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {isSelectable && onToggleSelect && (
              <button
                type="button"
                onClick={() => onToggleSelect(order.id)}
                className="text-slate-400 hover:text-purple-400 transition-colors cursor-pointer mr-0.5"
              >
                {isSelected ? (
                  <CheckSquare size={17} className="text-purple-400" />
                ) : (
                  <Square size={17} className="text-slate-500" />
                )}
              </button>
            )}

            <div className="w-7 h-7 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-300 shrink-0">
              <Package size={14} />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-xs sm:text-sm">
                  {order.displayOrderId}
                </span>
                {order.source === 'shopify' && (
                  <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                    Website
                  </span>
                )}
              </div>
              {formattedDate ? (
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Calendar size={10} className="text-purple-400" />
                  <span>{formattedDate}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs sm:text-sm font-bold text-emerald-400 flex items-center justify-end gap-0.5">
              <IndianRupee size={11} />
              <span>{Math.round(order.amount).toLocaleString('en-IN')}</span>
            </div>
            <span className="text-[9px] text-slate-500 uppercase font-semibold">
              {order.orderType || 'Prepaid'}
            </span>
          </div>
        </div>

        {/* Customer Info */}
        <div 
          onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
          className={`flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/60 mb-2 ${
            onViewCustomer ? 'cursor-pointer hover:border-purple-600/50' : ''
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <User size={12} className="text-purple-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-200 block truncate">
                {order.customerName}
              </span>
              <span className="text-[10px] font-mono text-slate-500 block truncate">
                {order.phoneNumber || 'No phone'}
              </span>
            </div>
          </div>

          {(order.city || order.state) && (
            <div className="text-right text-[10px] text-slate-400 shrink-0 max-w-[110px] truncate">
              {[order.city, order.state].filter(Boolean).join(', ')}
            </div>
          )}
        </div>

        {/* Products line */}
        <div className="text-[11px] text-slate-400 bg-slate-950/20 px-2 py-1 rounded-lg line-clamp-1 mb-2">
          {order.products || 'Standard order items'}
        </div>
      </div>

      {/* Courier & Action Footer */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${style.badge}`}>
            {style.icon}
            <span className="truncate max-w-[90px]">{effectiveStatus}</span>
          </div>

          {order.courier && (
            <span className="text-[10px] text-slate-400 font-medium truncate hidden sm:inline">
              {order.courier}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Dispatch Action button when in Prepare Dispatch */}
          {order.workflowStage === 'prepare_dispatch' && onOpenDispatchModal && (
            <button
              type="button"
              onClick={() => onOpenDispatchModal(order)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Dispatch</span>
              <ArrowRight size={11} />
            </button>
          )}

          {/* Tracking button when AWB exists */}
          {order.awbNumber && (
            <button
              type="button"
              onClick={() => onTrackOrder(order)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-950/60 hover:bg-purple-900 text-purple-300 border border-purple-800/60 cursor-pointer"
            >
              <span className="font-mono">{order.awbNumber}</span>
              <ExternalLink size={10} />
            </button>
          )}

          {/* Sync Button */}
          {onSyncOrder && order.rawId && order.awbNumber && (
            <button
              type="button"
              onClick={() => onSyncOrder(order)}
              disabled={isSyncing}
              title="Sync Live Courier Status"
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={11} className={isSyncing ? 'animate-spin text-purple-400' : ''} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
