import React from 'react';
import { 
  Truck, 
  X, 
  CheckSquare, 
  Package, 
  Calendar, 
  User, 
  AlertCircle
} from 'lucide-react';
import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { parseAndFormatLogisticsDate } from '../../../utils/logisticsDateUtils';

interface MoveToPrepareSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedOrders: UnifiedLogisticsOrder[];
  isMoving: boolean;
  onDeselectOrder?: (orderId: string) => void;
}

export const MoveToPrepareSidePanel: React.FC<MoveToPrepareSidePanelProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedOrders,
  isMoving,
  onDeselectOrder
}) => {
  if (!isOpen) return null;

  const totalAmount = selectedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <>
      {/* Mobile Backdrop (only on small screens < 1024px) */}
      <div 
        className="lg:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Side Panel Container (Side column on desktop, Drawer on mobile) */}
      <div className="fixed lg:static inset-y-0 right-0 z-50 lg:z-auto w-full sm:w-[460px] lg:w-[440px] xl:w-[480px] shrink-0 bg-[#0b1220] border-l lg:border border-slate-800/90 lg:rounded-2xl shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
        
        {/* Panel Header matching Image 1 */}
        <div className="p-4 bg-[#0e1626] border-b border-slate-800/90 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 shadow-sm mt-0.5">
              <Truck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Move to Prepare Dispatch
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-snug">
                You have selected <strong className="text-purple-300 font-bold">{selectedOrders.length} eligible order{selectedOrders.length === 1 ? '' : 's'}</strong> totaling{' '}
                <strong className="text-emerald-400 font-bold font-mono">₹{Math.round(totalAmount).toLocaleString('en-IN')}</strong>.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Review the orders below and confirm to move them to Prepare Dispatch.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
            title="Close panel"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Order Cards List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-3 bg-[#080d16]">
          {selectedOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <AlertCircle size={28} className="text-slate-600" />
              <span>No orders selected. Please select at least one order.</span>
            </div>
          ) : (
            selectedOrders.map((order) => {
              const dateInfo = parseAndFormatLogisticsDate(order.orderDateDisplay || order.orderDate);
              const isCod = (order.orderType || '').toLowerCase().includes('cod');

              return (
                <div 
                  key={order.id}
                  className="bg-[#0e1626] border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-3 space-y-2.5 transition-all shadow-md group"
                >
                  {/* Top Row: Checkbox, Order ID, Amount, Payment Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => onDeselectOrder && onDeselectOrder(order.id)}
                        className="text-purple-400 hover:text-purple-300 transition-colors cursor-pointer shrink-0"
                        title="Click to remove from selection"
                      >
                        <CheckSquare size={16} className="text-purple-400" />
                      </button>
                      <span className="font-mono font-bold text-slate-100 text-xs sm:text-sm">
                        {order.displayOrderId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-emerald-400 font-bold font-mono text-xs sm:text-sm">
                        ₹{Math.round(order.totalAmount || 0).toLocaleString('en-IN')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isCod 
                          ? 'bg-amber-950/70 text-amber-300 border border-amber-700/60' 
                          : 'bg-blue-950/70 text-blue-300 border border-blue-700/60'
                      }`}>
                        {isCod ? 'COD' : 'Prepaid'}
                      </span>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Calendar size={12} className="text-slate-500 shrink-0" />
                    <span>
                      {dateInfo.displayDate || '14 Oct 2026'}
                      {dateInfo.timeStr ? ` • ${dateInfo.timeStr}` : ''}
                    </span>
                  </div>

                  {/* Customer & Location */}
                  <div className="flex items-start justify-between text-xs pt-1.5 border-t border-slate-800/60 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 text-slate-200">
                      <User size={12} className="text-slate-500 shrink-0" />
                      <span className="font-semibold truncate">{order.customerName}</span>
                      {order.phone && (
                        <span className="text-slate-400 font-mono text-[11px] truncate">
                          ({order.phone})
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[11px] truncate shrink-0 max-w-[140px] text-right">
                      {order.shippingCity || order.shippingState || '—'}
                    </div>
                  </div>

                  {/* Products Box */}
                  <div className="bg-[#0b1220] border border-slate-800/80 rounded-lg p-2.5 space-y-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Products ({order.items && order.items.length > 0 ? order.items.length : 1})
                    </div>

                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-purple-950/40 border border-purple-800/40 flex items-center justify-center text-purple-300 shrink-0">
                              <Package size={14} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-slate-200 font-medium block truncate text-[11px]">
                                {item.productName}
                              </span>
                              <span className="text-slate-400 text-[10px] font-mono">
                                Qty: {item.quantity}
                              </span>
                            </div>
                          </div>
                          <span className="text-slate-300 font-mono font-bold text-xs shrink-0">
                            ₹{Math.round(item.price || (order.totalAmount / (order.items?.length || 1))).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-purple-950/40 border border-purple-800/40 flex items-center justify-center text-purple-300 shrink-0">
                            <Package size={14} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-slate-200 font-medium block truncate text-[11px]">
                              {order.productSummary || 'Combo Pack / Products'}
                            </span>
                            <span className="text-slate-400 text-[10px] font-mono">
                              Qty: {order.totalQuantity || 1}
                            </span>
                          </div>
                        </div>
                        <span className="text-slate-300 font-mono font-bold text-xs shrink-0">
                          ₹{Math.round(order.totalAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Panel Footer matching Image 1: 3-column stats + Buttons */}
        <div className="p-4 bg-[#0e1626] border-t border-slate-800/90 space-y-3 shrink-0">
          
          {/* Summary Metric Box */}
          <div className="bg-[#0b1220] border border-slate-800/80 rounded-xl p-3 grid grid-cols-3 gap-2 text-center divide-x divide-slate-800/80">
            <div className="px-1">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Orders to Move</span>
              <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                {selectedOrders.length}
              </span>
            </div>
            <div className="px-1">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Total Amount</span>
              <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
                ₹{Math.round(totalAmount).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="px-1">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Destination</span>
              <span className="text-[11px] font-semibold text-purple-300 mt-0.5 block truncate" title="Prepare Dispatch Queue">
                Prepare Dispatch
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isMoving}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-colors cursor-pointer text-center disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isMoving || selectedOrders.length === 0}
              className="flex-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMoving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Moving...</span>
                </>
              ) : (
                <>
                  <Truck size={14} />
                  <span>Move to Prepare Dispatch ({selectedOrders.length})</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </>
  );
};
