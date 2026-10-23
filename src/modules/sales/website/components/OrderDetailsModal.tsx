import React, { useState } from 'react';
import { X, User, Phone, MapPin, Tag, CreditCard, AlertTriangle, Package, Trash2 } from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';
import { formatPhoneNumber } from '../websiteSalesUtils';
import { websiteSalesService } from '../websiteSalesService';
import toast from 'react-hot-toast';

interface OrderDetailsModalProps {
  order: WebsiteConsolidatedOrder | null;
  onClose: () => void;
  onOrderDeleted?: (orderId: string) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose, onOrderDeleted }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!order) return null;

  const displayPhone = formatPhoneNumber(order.phone);

  const handleDelete = async () => {
    if (!order) return;

    const hasAwb = !!order.awb_number;
    const isDispatchedOrDelivered = 
      hasAwb || 
      (order.fulfillment_status && ['fulfilled', 'shipped', 'delivered'].includes(order.fulfillment_status.toLowerCase()));

    let confirmMsg = `Are you sure you want to permanently delete order #${order.order_id}? This will automatically remove it from Sales and Logistics.`;

    if (isDispatchedOrDelivered) {
      confirmMsg = `⚠️ WARNING: Order #${order.order_id} has already been dispatched/fulfilled${hasAwb ? ` with AWB ${order.awb_number}` : ''}.\n\nDeleting this order will permanently remove it from all operational Logistics views, counts, and Analytics while retaining shipment audit records.\n\nAre you sure you want to permanently delete this order?`;
    }

    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    const toastId = toast.loading(`Deleting order #${order.order_id}...`);
    try {
      await websiteSalesService.deleteSalesOrder(order.order_id);
      toast.success(`Order #${order.order_id} successfully deleted from Sales & Logistics!`, { id: toastId });
      onOrderDeleted?.(order.order_id);
      onClose();
    } catch (err: any) {
      toast.error(`Failed to delete order: ${err.message}`, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Package size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Order #{order.order_id}</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Date: {order.order_date || 'N/A'} {order.batch_file_name ? `• ${order.batch_file_name}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
          {/* Customer Info Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                <User size={14} className="text-cyan-400" /> {order.customer_name || 'N/A'}
              </span>
              <span className="font-mono text-slate-300 font-semibold flex items-center gap-1">
                <Phone size={13} className="text-indigo-400" /> {displayPhone}
              </span>
            </div>
            {order.address && (
              <p className="text-slate-400 flex items-start gap-1.5 text-[11px] border-t border-slate-800/80 pt-2 mt-1">
                <MapPin size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <span>{order.address}, {order.city}, {order.state} - {order.pincode}</span>
              </p>
            )}
          </div>

          {/* Items / Product Info */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <span className="font-bold text-slate-300 uppercase text-[10px] tracking-wider flex items-center gap-1">
                <Tag size={12} className="text-pink-400" /> Products & Offer
              </span>
              {order.offer && order.offer !== '-' && (
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold font-mono">
                  {order.offer}
                </span>
              )}
            </div>
            {order.items && order.items.length > 0 ? (
              <div className="space-y-1 font-mono">
                {order.items.map((it, idx) => (
                  <div key={it.id || idx} className="flex justify-between text-slate-200">
                    <span>{it.product_name}</span>
                    <span className="font-bold text-cyan-300">× {it.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-mono text-cyan-300">{order.order_formatted || order.product_name}</p>
            )}
          </div>

          {/* Payment & Price Breakdown Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Payment Mode</span>
              <span className={`font-bold flex items-center gap-1 text-xs ${
                order.payment_mode === 'PREPAID' ? 'text-emerald-400' :
                order.payment_mode === 'PARTIAL COD' ? 'text-purple-400' :
                order.payment_mode === 'COD' ? 'text-amber-400' : 'text-slate-400'
              }`}>
                <CreditCard size={13} /> {order.payment_mode}
              </span>
              {order.source_payment_mode && (
                <span className="text-[10px] text-slate-500 block truncate font-mono">({order.source_payment_mode})</span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Advance Paid</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">₹{(order.advance_paid ?? 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Remaining Payable</span>
              <span className="font-mono font-bold text-purple-300 text-sm">
                {order.payment_mode === 'PREPAID' ? '-' : `₹${(order.remaining_payable ?? order.price).toLocaleString()}`}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">Total Order Price</span>
              <span className="font-mono font-bold text-emerald-300 text-sm">₹{order.price.toLocaleString()}</span>
            </div>
          </div>

          {order.payment_classification_reason && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-0.5">
              <span className="font-bold text-slate-300 block">Classification Reason:</span>
              <span className="font-mono">{order.payment_classification_reason}</span>
            </div>
          )}

          {order.data_conflict && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{order.conflict_details || 'Conflict detected across raw rows'}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-semibold text-xs rounded-xl border border-red-500/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={14} />
            <span>{isDeleting ? 'Deleting...' : 'Delete Order'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
