import React from 'react';
import { 
  X, 
  History, 
  User, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  FileText,
  Truck
} from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';

interface CancellationHistoryModalProps {
  isOpen: boolean;
  order: WebsiteConsolidatedOrder | null;
  onClose: () => void;
}

export const CancellationHistoryModal: React.FC<CancellationHistoryModalProps> = ({
  isOpen,
  order,
  onClose
}) => {
  if (!isOpen || !order) return null;

  const cancellation = order.cancellation;
  const auditTrail = cancellation?.audit_trail || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-xl bg-[#141824] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-wide">
                Cancellation & Audit History
              </h2>
              <p className="text-xs text-gray-400">Order ID: #{order.order_id.replace(/^#/, '')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Main Cancellation Summary Card */}
          <div className="p-4 bg-gray-900/80 border border-gray-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <span className="text-xs text-gray-400">Current Status:</span>
              <span className={`px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider ${
                cancellation?.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                cancellation?.status === 'PENDING_LOGISTICS_APPROVAL' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                'bg-gray-800 text-gray-300'
              }`}>
                {cancellation?.status === 'CANCELLED' ? 'Order Cancelled' :
                 cancellation?.status === 'PENDING_LOGISTICS_APPROVAL' ? 'Pending Logistics Approval' :
                 'Active'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 block">Primary Reason</span>
                <span className="font-medium text-gray-200">{cancellation?.reason || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Notes / Remarks</span>
                <span className="font-medium text-gray-300 italic">{cancellation?.notes || 'None'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Requested At</span>
                <span className="text-gray-300">
                  {cancellation?.requested_at ? new Date(cancellation.requested_at).toLocaleString('en-IN') : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Requested By</span>
                <span className="text-gray-300">{cancellation?.requested_by || 'Sales System'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Confirmed At</span>
                <span className="text-gray-300">
                  {cancellation?.confirmed_at ? new Date(cancellation.confirmed_at).toLocaleString('en-IN') : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Confirmed By</span>
                <span className="text-gray-300">{cancellation?.confirmed_by || 'Pending / N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Logistics Shipment Status</span>
                <span className="text-gray-300 font-medium">
                  {cancellation?.logistics_status ? cancellation.logistics_status.toUpperCase() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">AWB Number</span>
                <span className="text-gray-300 font-mono">{order.awb || 'None'}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
              Event Timeline & Audit Trail
            </h3>

            {auditTrail.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-xs border border-dashed border-gray-800 rounded-xl">
                No detailed audit records found for this order.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800">
                {auditTrail.map((entry, idx) => {
                  const isCancel = entry.action === 'CANCELLED' || entry.action === 'CONFIRMED';
                  const isReject = entry.action === 'REJECTED';
                  const isRequest = entry.action === 'REQUESTED';

                  return (
                    <div key={idx} className="relative flex flex-col gap-1 text-xs">
                      {/* Bullet icon */}
                      <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center border ${
                        isCancel ? 'bg-red-950 border-red-500 text-red-400' :
                        isReject ? 'bg-amber-950 border-amber-500 text-amber-400' :
                        'bg-blue-950 border-blue-500 text-blue-400'
                      }`}>
                        {isCancel ? <CheckCircle2 className="w-3 h-3" /> :
                         isReject ? <XCircle className="w-3 h-3" /> :
                         <Clock className="w-3 h-3" />}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          {entry.action === 'REQUESTED' ? 'Cancellation Requested' :
                           entry.action === 'CONFIRMED' ? 'Logistics Confirmed Cancellation' :
                           entry.action === 'REJECTED' ? 'Logistics Rejected Cancellation' :
                           entry.action === 'CANCELLED' ? 'Direct Cancellation Applied' :
                           entry.action}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(entry.timestamp).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="text-gray-300">
                        <span className="text-gray-500">Actor: </span>
                        <span>{entry.performed_by}</span>
                        {entry.reason && (
                          <span className="ml-2">
                            <span className="text-gray-500">• Reason: </span>
                            <span className="text-gray-200 font-medium">"{entry.reason}"</span>
                          </span>
                        )}
                      </div>

                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <div className="text-[11px] text-gray-400 bg-gray-900/50 p-2 rounded border border-gray-800/80 mt-1">
                          {entry.details.notes && <div><strong>Notes:</strong> {entry.details.notes}</div>}
                          {entry.details.rejection_reason && <div><strong>Rejection Reason:</strong> {entry.details.rejection_reason}</div>}
                          {entry.details.awb && <div><strong>AWB:</strong> {entry.details.awb}</div>}
                          {entry.details.shipment_action && <div><strong>Shipment Action:</strong> {entry.details.shipment_action}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-800/80 bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
