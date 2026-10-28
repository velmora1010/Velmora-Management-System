import React, { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  Truck, 
  Package, 
  User, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { websiteSalesService } from '../../sales/website/websiteSalesService';
import toast from 'react-hot-toast';

interface LogisticsCancellationReviewModalProps {
  isOpen: boolean;
  order: any; // Can be LogisticsOrder or WebsiteConsolidatedOrder
  onClose: () => void;
  onSuccess?: () => void;
}

export const LogisticsCancellationReviewModal: React.FC<LogisticsCancellationReviewModalProps> = ({
  isOpen,
  order,
  onClose,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'confirm' | 'reject'>('confirm');
  const [confirmNotes, setConfirmNotes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !order) return null;

  const orderId = String(order.orderNumber || order.order_id || order.id || '').replace(/^#/, '');
  const customerName = order.customerName || order.customer_name || 'Customer';
  const awb = order.awb || order.waybill || 'N/A';
  const courier = order.courier || order.carrier || 'Delhivery';
  const shipmentStatus = order.shipmentStatus || order.status || order.shipment_status || 'In Transit';

  const cancellationData = order.cancellation || {};
  const reason = order.cancellationReason || cancellationData.reason || 'Requested by Sales / Customer';
  const requestedBy = order.cancellationRequestedBy || cancellationData.requested_by || 'Sales Team';
  const requestedAt = order.cancellationRequestedAt || cancellationData.requested_at;

  const handleConfirmCancellation = async () => {
    setIsSubmitting(true);
    try {
      const res = await websiteSalesService.confirmLogisticsCancellation({
        orderId,
        confirmedBy: 'Logistics Officer',
        logisticsNotes: confirmNotes.trim() || 'Shipment intercepted and cancelled by Logistics'
      });

      if (res.success) {
        toast.success(res.message);
        onSuccess?.();
        onClose();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      console.error('Error confirming cancellation:', err);
      toast.error(err.message || 'Failed to confirm cancellation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectCancellation = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await websiteSalesService.rejectLogisticsCancellation({
        orderId,
        rejectionReason: rejectionReason.trim(),
        rejectedBy: 'Logistics Officer'
      });

      if (res.success) {
        toast.success(res.message);
        onSuccess?.();
        onClose();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      console.error('Error rejecting cancellation:', err);
      toast.error(err.message || 'Failed to reject cancellation');
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
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                Review Cancellation Request
              </h2>
              <p className="text-xs text-gray-400">Order #{orderId} • AWB: {awb}</p>
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

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Request Banner */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Interception Requested by {requestedBy}</span>
            </div>
            <div className="text-gray-300">
              <strong className="text-white">Reason: </strong> {reason}
            </div>
            {cancellationData.notes && (
              <div className="text-gray-400 italic">
                <strong>Notes: </strong> "{cancellationData.notes}"
              </div>
            )}
            <div className="text-[11px] text-gray-400">
              Requested on: {requestedAt ? new Date(requestedAt).toLocaleString('en-IN') : 'Recently'}
            </div>
          </div>

          {/* Shipment Details */}
          <div className="grid grid-cols-2 gap-2.5 p-3 bg-gray-900/70 border border-gray-800 rounded-xl text-xs">
            <div>
              <span className="text-gray-500 block">Courier</span>
              <span className="text-white font-medium">{courier}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Shipment Status</span>
              <span className="text-blue-400 font-medium uppercase">{shipmentStatus}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Recipient</span>
              <span className="text-white font-medium truncate block">{customerName}</span>
            </div>
            <div>
              <span className="text-gray-500 block">AWB Tracking</span>
              <span className="text-gray-300 font-mono">{awb}</span>
            </div>
          </div>

          {/* Action Tabs */}
          <div>
            <div className="flex border-b border-gray-800 mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('confirm')}
                className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                  activeTab === 'confirm'
                    ? 'border-red-500 text-red-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                1. Intercept & Cancel Order
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reject')}
                className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                  activeTab === 'reject'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                2. Reject (Proceed Shipment)
              </button>
            </div>

            {activeTab === 'confirm' ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Confirm that the courier delivery has been stopped / package recalled. This will set the order status to <strong className="text-red-400">Cancelled</strong> in both Logistics and Website Sales.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Logistics Interception Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={confirmNotes}
                    onChange={(e) => setConfirmNotes(e.target.value)}
                    placeholder="e.g. Shipment cancelled with Delhivery, package returned to hub..."
                    className="w-full bg-[#1c2234] border border-gray-700 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                  If the package cannot be stopped (e.g. already out for delivery or courier handover completed), provide a reason. The order will be restored to the active workflow.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Rejection Reason <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Courier already out for delivery, cannot recall..."
                    className="w-full bg-[#1c2234] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/80 bg-gray-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {activeTab === 'confirm' ? (
            <button
              type="button"
              onClick={handleConfirmCancellation}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-lg shadow-red-500/20 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Confirming...' : 'Confirm Cancellation'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRejectCancellation}
              disabled={isSubmitting || !rejectionReason.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Rejecting...' : 'Reject Cancellation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
