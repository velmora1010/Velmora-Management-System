import React from 'react';
import { 
  X, 
  User, 
  Phone, 
  MapPin, 
  Package, 
  IndianRupee, 
  Truck, 
  Calendar, 
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw
} from 'lucide-react';
import type { UnifiedCustomer, UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { parseAndFormatLogisticsDate } from '../../../utils/logisticsDateUtils';

interface CustomerDetailModalProps {
  customer: UnifiedCustomer | null;
  onClose: () => void;
  onTrackOrder?: (order: UnifiedLogisticsOrder) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  onClose,
  onTrackOrder
}) => {
  if (!customer) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-300">
              <User size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{customer.name}</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60">
                  {customer.totalOrders} {customer.totalOrders === 1 ? 'Order' : 'Orders'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                <div className="flex items-center gap-1 font-mono">
                  <Phone size={12} className="text-slate-500" />
                  <span>{customer.phoneNumber || 'N/A'}</span>
                </div>
                {(customer.city || customer.state) && (
                  <div className="flex items-center gap-1">
                    <MapPin size={12} className="text-purple-400" />
                    <span>{[customer.city, customer.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700/60"
          >
            <X size={16} />
          </button>
        </div>

        {/* Stats Row */}
        <div className="px-6 py-4 grid grid-cols-3 gap-3 bg-slate-950/20 border-b border-slate-800/80 text-xs">
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Lifetime Spend</span>
            <div className="text-base font-extrabold text-emerald-400 mt-0.5 flex items-center gap-0.5">
              <IndianRupee size={14} />
              <span>{Math.round(customer.totalSpent).toLocaleString('en-IN')}</span>
            </div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Delivered Success</span>
            <div className="text-base font-extrabold text-white mt-0.5 flex items-center gap-1">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>{customer.deliveredOrders}</span>
            </div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Exceptions / RTO</span>
            <div className="text-base font-extrabold text-rose-400 mt-0.5 flex items-center gap-1">
              <AlertTriangle size={14} />
              <span>{customer.exceptionOrders}</span>
            </div>
          </div>
        </div>

        {/* Address Card (if available) */}
        {customer.address && (
          <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
            <MapPin size={14} className="text-purple-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-500 font-medium">Delivery Address: </span>
              <span>{customer.address}</span>
              {customer.pincode ? ` - ${customer.pincode}` : ''}
            </div>
          </div>
        )}

        {/* Order History Timeline / List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Order & Shipment History ({customer.orders.length})
          </h4>

          {customer.orders.map((order, idx) => (
            <div 
              key={order.id || idx}
              className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-300 shrink-0">
                    <Package size={15} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {order.displayOrderId}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getBadgeStyle(order.status)}`}>
                        {order.status}
                      </span>
                      {order.source === 'shopify' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                          Shopify
                        </span>
                      )}
                    </div>
                    {order.orderDate && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <Calendar size={11} className="text-purple-400" />
                        <span>{parseAndFormatLogisticsDate(order.orderDateDisplay || order.orderDate).displayDate || order.orderDateDisplay || order.orderDate}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-white flex items-center justify-end gap-0.5">
                    <IndianRupee size={12} />
                    <span>{order.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    {order.orderType || 'Prepaid'}
                  </span>
                </div>
              </div>

              {/* Products summary */}
              <div className="text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 mb-2.5">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-0.5">Products</span>
                <p className="line-clamp-2">{order.products || 'Standard order items'}</p>
              </div>

              {/* Courier & AWB Footer */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
                <div className="flex items-center gap-2">
                  <Truck size={13} className="text-slate-500" />
                  <span className="text-slate-400 font-medium">{order.courier || 'Unassigned'}</span>
                  {order.awbNumber && (
                    <span className="font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-lg border border-purple-800/50 text-[11px]">
                      {order.awbNumber}
                    </span>
                  )}
                </div>

                {onTrackOrder && order.awbNumber && (
                  <button
                    type="button"
                    onClick={() => onTrackOrder(order)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 cursor-pointer"
                  >
                    <span>Track</span>
                    <ExternalLink size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-slate-700/60"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
