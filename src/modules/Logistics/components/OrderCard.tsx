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
  Phone
} from 'lucide-react';
import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';

interface OrderCardProps {
  order: UnifiedLogisticsOrder;
  onTrackOrder: (order: UnifiedLogisticsOrder) => void;
  onSyncOrder?: (order: UnifiedLogisticsOrder) => void;
  onViewCustomer?: (customerKey: string) => void;
  isSyncing?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onTrackOrder,
  onSyncOrder,
  onViewCustomer,
  isSyncing = false
}) => {
  const getBadgeStyle = (status: string) => {
    switch (status) {
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

  const style = getBadgeStyle(order.status);

  return (
    <div className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800/90 hover:border-purple-500/60 rounded-2xl p-4 transition-all duration-200 shadow-lg hover:shadow-purple-500/10 flex flex-col justify-between group">
      <div>
        {/* Top Header: Order ID, Amount and Status Pill */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-300 shrink-0">
              <Package size={15} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm">
                  {order.displayOrderId}
                </span>
                {order.source === 'shopify' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                    Website
                  </span>
                )}
              </div>
              {order.orderDate && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                  <Calendar size={10} />
                  <span>{order.orderDateDisplay || order.orderDate}</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm font-bold text-emerald-400 flex items-center justify-end gap-0.5">
              <IndianRupee size={12} />
              <span>{Math.round(order.amount).toLocaleString('en-IN')}</span>
            </div>
            <span className="text-[10px] text-slate-500 block uppercase font-medium">
              {order.orderType || 'Prepaid'}
            </span>
          </div>
        </div>

        {/* Customer Information Row */}
        <div 
          onClick={() => onViewCustomer && onViewCustomer(order.customerKey)}
          className={`flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/60 mb-2.5 ${
            onViewCustomer ? 'cursor-pointer hover:border-purple-600/50' : ''
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <User size={13} className="text-purple-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-200 block truncate">
                {order.customerName}
              </span>
              <span className="text-[11px] font-mono text-slate-500 block truncate">
                {order.phoneNumber || 'No phone'}
              </span>
            </div>
          </div>

          {(order.city || order.state) && (
            <div className="text-right text-[11px] text-slate-400 shrink-0 max-w-[120px] truncate">
              {[order.city, order.state].filter(Boolean).join(', ')}
            </div>
          )}
        </div>

        {/* Products */}
        <div className="text-xs text-slate-300 mb-2.5">
          <p className="line-clamp-2 text-[11px] text-slate-400 bg-slate-950/20 px-2 py-1 rounded-lg">
            {order.products || 'Standard order items'}
          </p>
        </div>
      </div>

      {/* Courier, AWB and Actions Footer */}
      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${style.badge}`}>
            {style.icon}
            <span className="truncate max-w-[85px]">{order.status}</span>
          </div>

          {order.courier && (
            <span className="text-[11px] text-slate-400 font-medium truncate">
              {order.courier}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {order.awbNumber && (
            <button
              type="button"
              onClick={() => onTrackOrder(order)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/60 hover:border-purple-600 transition-colors cursor-pointer"
            >
              <span>{order.awbNumber}</span>
              <ExternalLink size={11} />
            </button>
          )}

          {onSyncOrder && order.rawId && order.awbNumber && (
            <button
              type="button"
              onClick={() => onSyncOrder(order)}
              disabled={isSyncing}
              title="Sync Tracking Status"
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={12} className={isSyncing ? 'animate-spin text-purple-400' : ''} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
