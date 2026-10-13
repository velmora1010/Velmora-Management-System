import React, { useState } from 'react';
import { 
  X, 
  Truck, 
  Package, 
  User, 
  Phone, 
  MapPin, 
  IndianRupee, 
  Calendar,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import { confirmOrderDispatch } from '../../../services/unifiedLogisticsService';
import { ACTIVE_COURIERS } from '../../../config/courierConfig';

interface DispatchOrderModalProps {
  order: UnifiedLogisticsOrder | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DispatchOrderModal: React.FC<DispatchOrderModalProps> = ({
  order,
  onClose,
  onSuccess
}) => {
  if (!order) return null;

  const [courier, setCourier] = useState(order.courier || ACTIVE_COURIERS[0] || 'ST Courier');
  const [awbNumber, setAwbNumber] = useState(order.awbNumber || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!order.rawId) {
      setError('Cannot dispatch: order ID is not linked to local database.');
      return;
    }

    if (!awbNumber.trim()) {
      setError('AWB / Tracking Number is required to confirm dispatch.');
      return;
    }

    if (!courier.trim()) {
      setError('Please select a valid courier partner.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await confirmOrderDispatch({
        rawId: order.rawId,
        courier,
        awbNumber: awbNumber.trim()
      });

      if (res.success) {
        toast.success(`Order ${order.displayOrderId} successfully dispatched!`);
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to dispatch order');
      }
    } catch (err: any) {
      setError(err.message || 'Network error confirming dispatch');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-300">
              <Truck size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Confirm Dispatch</h2>
              <p className="text-xs text-slate-400">Order {order.displayOrderId}</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Summary Card */}
          <div className="bg-slate-950/50 border border-slate-800/80 p-3.5 rounded-2xl space-y-2 text-xs">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-bold text-white">{order.customerName}</span>
                <span className="text-slate-500 font-mono block">{order.phoneNumber}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-emerald-400 flex items-center justify-end">
                  <IndianRupee size={11} />
                  {order.amount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-500 uppercase">{order.orderType}</span>
              </div>
            </div>

            {(order.address || order.city || order.state) && (
              <div className="flex items-start gap-1.5 text-slate-400 pt-2 border-t border-slate-800/60">
                <MapPin size={12} className="text-purple-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  {[order.address, order.city, order.state, order.pincode].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Courier Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Courier Partner
            </label>
            <select
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              className="w-full h-10 bg-slate-950 border border-slate-700/80 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            >
              {ACTIVE_COURIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* AWB Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              AWB / Tracking Number *
            </label>
            <input
              type="text"
              required
              value={awbNumber}
              onChange={(e) => setAwbNumber(e.target.value)}
              placeholder="e.g. 58214838511 or ST12345"
              className="w-full h-10 bg-slate-950 border border-slate-700/80 rounded-xl px-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              <span>{isSubmitting ? 'Dispatching...' : 'Confirm Dispatch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
