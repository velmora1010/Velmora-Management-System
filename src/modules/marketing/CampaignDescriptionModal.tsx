import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, FileText, Check } from 'lucide-react';
import type { Campaign, CampaignDescription } from '../../types';
import { SCRIPT_PRODUCTS } from '../../services/campaignScriptService';
import { 
  createCampaignDescription, 
  updateCampaignDescription 
} from '../../services/campaignDescriptionService';
import toast from 'react-hot-toast';

interface CampaignDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  descriptionToEdit?: CampaignDescription | null;
  onSuccess: (savedDescription: CampaignDescription) => void;
}

export const CampaignDescriptionModal: React.FC<CampaignDescriptionModalProps> = ({
  isOpen,
  onClose,
  campaign,
  descriptionToEdit,
  onSuccess
}) => {
  const [product, setProduct] = useState<string>('');
  const [descriptionText, setDescriptionText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ product?: string; description?: string }>({});

  const isEditMode = Boolean(descriptionToEdit);

  useEffect(() => {
    if (isOpen) {
      if (descriptionToEdit) {
        setProduct(descriptionToEdit.product || '');
        setDescriptionText(descriptionToEdit.description || '');
      } else {
        setProduct('');
        setDescriptionText('');
      }
      setErrors({});
    }
  }, [isOpen, descriptionToEdit]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: { product?: string; description?: string } = {};

    if (!product || !product.trim()) {
      newErrors.product = 'Please select a product title.';
    }

    if (!descriptionText || !descriptionText.trim()) {
      newErrors.description = 'Please enter a description for the product.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const toastId = toast.loading(isEditMode ? 'Updating description...' : 'Saving description...');

    try {
      let saved: CampaignDescription;
      if (isEditMode && descriptionToEdit) {
        saved = await updateCampaignDescription(descriptionToEdit.id, campaign.id, {
          product,
          description: descriptionText
        });
        toast.success('Description updated successfully', { id: toastId });
      } else {
        saved = await createCampaignDescription({
          campaign_id: campaign.id,
          product,
          description: descriptionText
        });
        toast.success('Description saved successfully', { id: toastId });
      }

      onSuccess(saved);
      onClose();
    } catch (err: any) {
      console.error('Error saving description:', err);
      toast.error(err?.message || 'Failed to save description', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = product.trim().length > 0 && descriptionText.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                {isEditMode ? 'Edit Description' : 'Create Description'}
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
          {/* Product Title dropdown */}
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

          {/* Description Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Description <span className="text-purple-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500">Multiline supported & line-breaks preserved</span>
            </div>
            <textarea
              rows={8}
              value={descriptionText}
              onChange={(e) => {
                setDescriptionText(e.target.value);
                if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
              }}
              placeholder="Enter the product description here... e.g., features, usage directions, offers, hashtags"
              className={`w-full bg-[#070c18] border ${
                errors.description ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              } rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors min-h-[180px] resize-y leading-relaxed whitespace-pre-wrap break-words`}
            />
            {errors.description && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.description}
              </p>
            )}
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
                  <span>{isEditMode ? 'Update Description' : 'Save Description'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
