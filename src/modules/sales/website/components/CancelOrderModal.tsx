import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  Truck, 
  Package, 
  User, 
  DollarSign, 
  Clock, 
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';
import { websiteSalesService } from '../websiteSalesService';
import toast from 'react-hot-toast';

interface CancelOrderModalProps {
  isOpen: boolean;
  order: WebsiteConsolidatedOrder | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const PREDEFINED_REASONS = [
  'Customer requested cancellation',
  'Incorrect delivery address / phone number',
  'Duplicate order placed by customer',
  'Item out of stock / unavailable',
  'Payment verification / fraud risk',
  'Pricing or promotion error',
  'Customer found alternative / changed mind',
  'Other (specify custom reason)'
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  isOpen,
  order,
  onClose,
  onSuccess
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Reset state on modal open
  useEffect(() => {
    if (isOpen) {
      setSelectedReason('');
      setCustomReason('');
      setNotes('');
      setIsSubmitting(false);
    }
  }, [isOpen, order?.order_id]);

  if (!isOpen || !order) return null;

  const rawShipmentStatus = (order.shipment_status || '').toLowerCase().trim();
  const rawFulfillmentStatus = (order.fulfillment_status || '').toLowerCase().trim();
  const rawOrderStatus = (order.order_status || '').toUpperCase().trim();

  const isDelivered = rawShipmentStatus === 'delivered' || rawFulfillmentStatus === 'delivered';
  const hasAwb = Boolean(order.awb && order.awb.trim() !== '');
  const isDispatchedOrInTransit = 
    hasAwb || 
    ['in transit', 'out for delivery', 'dispatched', 'ready for pickup', 'manifested'].includes(rawShipmentStatus);

  const isAlreadyCancelled = 
    rawOrderStatus === 'CANCELLED' || 
    order.cancellation?.status === 'CANCELLED';

  const isPendingApproval = 
    order.cancellation?.status === 'PENDING_LOGISTICS_APPROVAL';

  const finalReason = selectedReason === 'Other (specify custom reason)' 
    ? customReason.trim() 
    : selectedReason.trim();

  const handleConfirm = async () => {
    if (isDelivered) {
      toast.error('Delivered orders cannot be cancelled directly. Please initiate a return or refund.');
      return;
    }

    if (isAlreadyCancelled) {
      toast.error('This order is already cancelled.');
      return;
    }

    if (!finalReason) {
      toast.error('Please select or specify a cancellation reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await websiteSalesService.cancelOrder({
        orderId: order.order_id,
        reason: finalReason,
        notes: notes.trim(),
        cancelledBy: 'Sales Representative'
      });

      if (result.success) {
        toast.success(result.message);
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.message || 'Failed to cancel order.');
      }
    } catch (err: any) {
      console.error('Cancellation error:', err);
      toast.error(err.message || 'An unexpected error occurred while processing cancellation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-[#141824] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-900/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isDelivered ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
              {isDelivered ? <AlertTriangle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-wide">
                {isDelivered 
                  ? 'Order Delivered' 
                  : isDispatchedOrInTransit 
                    ? 'Request Order Cancellation' 
                    : 'Confirm Order Cancellation'}
              </h2>
              <p className="text-xs text-gray-400">Order ID: #{order.order_id.replace(/^#/, '')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Order Snapshot Card */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-900/80 border border-gray-800 rounded-xl text-xs">
            <div className="space-y-1">
              <div className="text-gray-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-500" /> Customer
              </div>
              <div className="font-medium text-white truncate">{order.customer_name || 'Anonymous'}</div>
            </div>

            <div className="space-y-1">
              <div className="text-gray-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-gray-500" /> Total Amount
              </div>
              <div className="font-semibold text-white">
                ₹{Number(order.total_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-gray-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-gray-500" /> Fulfillment Status
              </div>
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider ${
                  rawFulfillmentStatus === 'fulfilled' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {order.fulfillment_status || 'Unfulfilled'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-gray-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-gray-500" /> Shipment Status
              </div>
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider ${
                  rawShipmentStatus === 'delivered' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  isDispatchedOrInTransit ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                  'bg-gray-800 text-gray-300 border border-gray-700'
                }`}>
                  {order.shipment_status || 'Pending AWB'}
                </span>
                {order.awb && (
                  <span className="block mt-0.5 text-[10px] text-gray-400 truncate">
                    AWB: {order.awb}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Business Rule Banner */}
          {isDelivered ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Ordinary Cancellation Blocked</span>
              </div>
              <p>
                This order has already been marked as <strong>Delivered</strong> to the customer. Ordinary cancellation cannot be processed at this stage.
              </p>
              <p className="text-amber-300/80">
                To process an item exchange, return, or refund, please navigate to the Return & Refund section or initiate a reverse pickup ticket.
              </p>
            </div>
          ) : isAlreadyCancelled ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-red-200">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Order Already Cancelled</span>
              </div>
              <p className="mt-1">
                This order was already cancelled on {order.cancellation?.cancelled_at ? new Date(order.cancellation.cancelled_at).toLocaleDateString() : 'earlier date'}.
              </p>
            </div>
          ) : isPendingApproval ? (
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-300 text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-purple-200">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Cancellation Awaiting Logistics Confirmation</span>
              </div>
              <p className="mt-1">
                A cancellation request was already submitted and is currently pending verification by the Logistics department to stop courier delivery.
              </p>
            </div>
          ) : isDispatchedOrInTransit ? (
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-200 text-xs leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>Logistics Courier Interception Required</span>
              </div>
              <p>
                This order is already <strong>manifested or in-transit</strong> with the courier. Submitting this form will create a <strong>Cancellation Request</strong> for the Logistics team.
              </p>
              <p className="text-blue-300/80">
                The order shipment status will remain active until Logistics confirms that the physical package has been intercepted and returned.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-gray-900 border border-gray-800 rounded-xl text-gray-300 text-xs leading-relaxed">
              <p>
                This order has <strong>not yet been dispatched</strong>. Confirming cancellation will immediately update the order status to <strong className="text-red-400">Cancelled</strong>, remove it from active fulfillment queues, and log this event in the audit trail.
              </p>
            </div>
          )}

          {/* Cancellation Reason Inputs (Only if not delivered and not already cancelled) */}
          {!isDelivered && !isAlreadyCancelled && !isPendingApproval && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Cancellation Reason <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-[#1c2234] border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 transition-colors"
                >
                  <option value="">-- Select a cancellation reason --</option>
                  {PREDEFINED_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {selectedReason === 'Other (specify custom reason)' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Specify Reason <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter detailed cancellation reason..."
                    disabled={isSubmitting}
                    className="w-full bg-[#1c2234] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional internal remarks or customer communication notes..."
                  disabled={isSubmitting}
                  className="w-full bg-[#1c2234] border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/80 bg-gray-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {isDelivered || isAlreadyCancelled ? 'Close' : 'Keep Order'}
          </button>

          {!isDelivered && !isAlreadyCancelled && !isPendingApproval && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || !finalReason}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isDispatchedOrInTransit
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                  : 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isDispatchedOrInTransit ? (
                'Request Cancellation'
              ) : (
                'Confirm Cancellation'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
