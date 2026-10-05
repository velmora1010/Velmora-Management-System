import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Link2, Check, Sparkles, User } from 'lucide-react';
import type { Campaign, CampaignInfluencer, InfluencerTrackingLink } from '../../types';
import { SCRIPT_PRODUCTS } from '../../services/campaignScriptService';
import { 
  createInfluencerTrackingLink, 
  updateInfluencerTrackingLink 
} from '../../services/influencerTrackingLinkService';
import toast from 'react-hot-toast';

interface CampaignTrackingLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  influencers: CampaignInfluencer[];
  linkToEdit?: InfluencerTrackingLink | null;
  onSuccess: (savedLink: InfluencerTrackingLink) => void;
}

export const CampaignTrackingLinkModal: React.FC<CampaignTrackingLinkModalProps> = ({
  isOpen,
  onClose,
  campaign,
  influencers,
  linkToEdit,
  onSuccess
}) => {
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string>('');
  const [product, setProduct] = useState<string>('');
  const [trackingUrl, setTrackingUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ influencer?: string; product?: string; trackingUrl?: string }>({});

  const isEditMode = Boolean(linkToEdit);

  useEffect(() => {
    if (isOpen) {
      if (linkToEdit) {
        setSelectedInfluencerId(String(linkToEdit.influencer_id || ''));
        setProduct(linkToEdit.product || '');
        setTrackingUrl(linkToEdit.tracking_url || '');
        setNotes(linkToEdit.notes || '');
      } else {
        setSelectedInfluencerId('');
        setProduct('');
        setTrackingUrl('');
        setNotes('');
      }
      setErrors({});
    }
  }, [isOpen, linkToEdit]);

  if (!isOpen) return null;

  // Auto-generate standard tracking URL helper
  const handleGenerateLink = () => {
    const selectedInf = influencers.find(i => String(i.id) === selectedInfluencerId);
    const infIdentifier = selectedInf?.code || selectedInf?.name || selectedInf?.influencer_name || 'influencer';
    const cleanInf = infIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanProd = (product || 'product').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const campSlug = (campaign.campaign_name || 'camp').toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    const generated = `https://velmora.com/ref?camp=${campSlug}&inf=${cleanInf}&p=${cleanProd}`;
    setTrackingUrl(generated);
    if (errors.trackingUrl) setErrors(prev => ({ ...prev, trackingUrl: '' }));
  };

  const validate = (): boolean => {
    const newErrors: { influencer?: string; product?: string; trackingUrl?: string } = {};

    if (!selectedInfluencerId) {
      newErrors.influencer = 'Please select an influencer.';
    }

    if (!product || !product.trim()) {
      newErrors.product = 'Please select a product title.';
    }

    if (!trackingUrl || !trackingUrl.trim()) {
      newErrors.trackingUrl = 'Please enter or generate a tracking link.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const toastId = toast.loading(isEditMode ? 'Updating tracking link...' : 'Saving tracking link...');

    const matchedInf = influencers.find(i => String(i.id) === selectedInfluencerId);
    const infName = matchedInf?.influencer_name || matchedInf?.name || linkToEdit?.influencer_name || '';
    const infCode = matchedInf?.code || linkToEdit?.influencer_code || '';

    try {
      let saved: InfluencerTrackingLink;
      if (isEditMode && linkToEdit) {
        saved = await updateInfluencerTrackingLink(linkToEdit.id, campaign.id, {
          influencer_id: selectedInfluencerId,
          influencer_name: infName,
          influencer_code: infCode,
          product,
          tracking_url: trackingUrl,
          notes
        });
        toast.success('Tracking link updated successfully', { id: toastId });
      } else {
        saved = await createInfluencerTrackingLink({
          campaign_id: campaign.id,
          influencer_id: selectedInfluencerId,
          influencer_name: infName,
          influencer_code: infCode,
          product,
          tracking_url: trackingUrl,
          notes
        });
        toast.success('Tracking link saved successfully', { id: toastId });
      }

      onSuccess(saved);
      onClose();
    } catch (err: any) {
      console.error('Error saving tracking link:', err);
      toast.error(err?.message || 'Failed to save tracking link', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = selectedInfluencerId && product.trim().length > 0 && trackingUrl.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Link2 size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                {isEditMode ? 'Edit Tracking Link' : 'Create Influencer Tracking Link'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{campaign.campaign_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Influencer Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Influencer <span className="text-purple-400">*</span>
            </label>
            <select
              value={selectedInfluencerId}
              onChange={(e) => {
                setSelectedInfluencerId(e.target.value);
                if (errors.influencer) setErrors(prev => ({ ...prev, influencer: '' }));
              }}
              className={`w-full bg-[#070c18] border ${
                errors.influencer ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors cursor-pointer`}
            >
              <option value="" disabled>Select Influencer</option>
              {influencers.map((inf) => {
                const displayName = inf.influencer_name || inf.name || `Influencer #${inf.id}`;
                const codeSuffix = inf.code ? ` (${inf.code})` : '';
                return (
                  <option key={inf.id} value={String(inf.id)}>
                    {displayName}{codeSuffix}
                  </option>
                );
              })}
            </select>
            {errors.influencer && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.influencer}
              </p>
            )}
          </div>

          {/* Product Title Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Product Title <span className="text-purple-400">*</span>
            </label>
            <select
              value={product}
              onChange={(e) => {
                setProduct(e.target.value);
                if (errors.product) setErrors(prev => ({ ...prev, product: '' }));
              }}
              className={`w-full bg-[#070c18] border ${
                errors.product ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors cursor-pointer`}
            >
              <option value="" disabled>Select Product</option>
              {SCRIPT_PRODUCTS.map((prod) => (
                <option key={prod} value={prod}>
                  {prod}
                </option>
              ))}
            </select>
            {errors.product && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.product}
              </p>
            )}
          </div>

          {/* Tracking Link Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Tracking Link <span className="text-purple-400">*</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateLink}
                disabled={!selectedInfluencerId}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Generate standard tracking link based on selected influencer & product"
              >
                <Sparkles size={12} />
                <span>Auto-Generate Link</span>
              </button>
            </div>
            <input
              type="text"
              value={trackingUrl}
              onChange={(e) => {
                setTrackingUrl(e.target.value);
                if (errors.trackingUrl) setErrors(prev => ({ ...prev, trackingUrl: '' }));
              }}
              placeholder="https://example.com/ref/..."
              className={`w-full bg-[#070c18] border ${
                errors.trackingUrl ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors`}
            />
            {errors.trackingUrl && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.trackingUrl}
              </p>
            )}
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Notes <span className="text-slate-500 text-[10px] font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Campaign promo code, affiliate tag, custom UTM parameters"
              className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer ${
                isFormValid && !isSubmitting
                  ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-900/25'
                  : 'bg-purple-600/50 text-purple-200/50 cursor-not-allowed shadow-none'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>{isEditMode ? 'Update Tracking Link' : 'Save Tracking Link'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
