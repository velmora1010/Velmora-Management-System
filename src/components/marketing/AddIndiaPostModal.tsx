import React, { useState } from 'react';
import { X, Send, PlusCircle, AlertCircle, Calendar } from 'lucide-react';
import type { Campaign } from '../../types';
import { createIndiaPostRecord } from '../../services/indiaPostTrackingService';
import toast from 'react-hot-toast';

interface AddIndiaPostModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const STATUS_OPTIONS = [
  'Exception',
  'Failed Attempt',
  'Pending',
  'In Transit',
  'Delivered',
  'Out For Delivery',
  'Info Received',
  'Expired'
];

export const AddIndiaPostModal: React.FC<AddIndiaPostModalProps> = ({
  campaign,
  onClose,
  onSuccess
}) => {
  const [orderId, setOrderId] = useState('');
  const [awbNumber, setAwbNumber] = useState('');
  const [courier] = useState('India Post');
  const [status, setStatus] = useState('In Transit');
  const [dispatchDate, setDispatchDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [deliveredDate, setDeliveredDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validate form
  const isValid = Boolean(
    orderId.trim() &&
    awbNumber.trim() &&
    status.trim() &&
    dispatchDate.trim()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanOrderId = orderId.trim();
    const cleanAwb = awbNumber.trim();
    const cleanStatus = status.trim();
    const cleanDispatchDate = dispatchDate.trim();

    if (!cleanOrderId) {
      setValidationError('Order ID is required.');
      return;
    }
    if (!cleanAwb) {
      setValidationError('AWB Number is required.');
      return;
    }
    if (!cleanStatus) {
      setValidationError('Status is required.');
      return;
    }
    if (!cleanDispatchDate) {
      setValidationError('Dispatched Date is required.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Adding India Post tracking entry...');

    try {
      // Map Out For Delivery label to canonical Out for Delivery
      const canonicalStatus = cleanStatus.toLowerCase() === 'out for delivery' ? 'Out for Delivery' : cleanStatus;

      const res = await createIndiaPostRecord({
        campaign_id: campaign.id,
        order_id: cleanOrderId,
        awb_number: cleanAwb,
        courier: 'India Post',
        status: canonicalStatus,
        dispatch_date: cleanDispatchDate,
        estimated_delivery_date: estimatedDeliveryDate.trim() || null,
        delivered_date: deliveredDate.trim() || null
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to save tracking record.');
      }

      toast.success('India Post tracking entry added successfully.', { id: toastId });

      // Notify other components of the tracking update
      window.dispatchEvent(
        new CustomEvent('influencer_tracking_updated', {
          detail: { campaignId: campaign.id }
        })
      );

      if (onSuccess) {
        await onSuccess();
      }

      onClose();
    } catch (err: any) {
      console.error('[AddIndiaPostModal] Submission error:', err);
      setValidationError(err.message || 'Failed to save entry.');
      toast.error(err.message || 'Failed to add entry.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131d36]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <PlusCircle size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Add Tracking Entry
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60">
                  India Post
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Campaign: <span className="text-slate-200 font-semibold">{campaign.campaign_name}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Row 1: Order ID & AWB Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Order ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Order ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. #MHS114 or ORD1001"
                className="w-full h-10 px-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Duplicates allowed for IP entry
              </span>
            </div>

            {/* AWB Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                AWB Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={awbNumber}
                onChange={(e) => setAwbNumber(e.target.value)}
                placeholder="e.g. IP123456789IN"
                className="w-full h-10 px-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Duplicates allowed for IP entry
              </span>
            </div>
          </div>

          {/* Row 2: Courier & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Courier (Read-only / Pre-filled) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Courier <span className="text-rose-400">*</span>
              </label>
              <div className="w-full h-10 px-3 bg-slate-900/60 border border-slate-700/60 rounded-xl text-xs text-amber-300 font-semibold flex items-center gap-2 select-none">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>{courier}</span>
                <span className="ml-auto text-[10px] text-slate-500 font-normal">Auto-filled</span>
              </div>
            </div>

            {/* Status (Required Dropdown) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Status <span className="text-rose-400">*</span>
              </label>
              <select
                required
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Dispatched Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Dispatched Date <span className="text-rose-400">*</span></span>
              <Calendar size={13} className="text-slate-400" />
            </label>
            <input
              type="date"
              required
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="w-full h-10 px-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
            />
          </div>

          {/* Row 4: Estimated Delivery Date & Delivered Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Estimated Delivery Date (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Estimated Delivery Date</span>
                <span className="text-[10px] text-slate-500 font-normal">Optional</span>
              </label>
              <input
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                className="w-full h-10 px-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
              />
            </div>

            {/* Delivered Date (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Delivered Date</span>
                <span className="text-[10px] text-slate-500 font-normal">Optional</span>
              </label>
              <input
                type="date"
                value={deliveredDate}
                onChange={(e) => setDeliveredDate(e.target.value)}
                className="w-full h-10 px-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#131d36]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={13} />
            <span>{isSubmitting ? 'Saving Entry...' : 'Confirm'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
