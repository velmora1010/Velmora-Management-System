import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, FileText } from 'lucide-react';
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
          campaign_id: String(campaign.id),
          product,
          description: descriptionText
        });
        toast.success('Description updated successfully', { id: toastId });
      } else {
        saved = await createCampaignDescription({
          campaign_id: String(campaign.id),
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
              <p className="text-xs text-purple-300 font-medium mt-0.5">
                Campaign: {campaign.campaign_name}
              </p>
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
          {/* Title (Product) Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Title (Product) <span className="text-purple-400">*</span>
            </label>
            <select
              value={product}
              onChange={(e) => {
                setProduct(e.target.value);
                if (errors.product) setErrors(prev => ({ ...prev, product: undefined }));
              }}
              className={`w-full bg-[#070c18] border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors cursor-pointer ${
                errors.product ? 'border-red-500/80 focus:border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              }`}
            >
              <option value="">Select a product...</option>
              {SCRIPT_PRODUCTS.map((prod) => (
                <option key={prod} value={prod}>
                  {prod}
                </option>
              ))}
            </select>
            {errors.product && (
              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle size={12} />
                {errors.product}
              </p>
            )}
          </div>

          {/* Description Text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Product Description <span className="text-purple-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {descriptionText.length} characters
              </span>
            </div>
            <textarea
              rows={6}
              value={descriptionText}
              onChange={(e) => {
                setDescriptionText(e.target.value);
                if (errors.description) setErrors(prev => ({ ...prev, description: undefined }));
              }}
              placeholder="Enter product description, key highlights, hashtags, or call to actions..."
              className={`w-full bg-[#070c18] border rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors resize-y leading-relaxed font-sans ${
                errors.description ? 'border-red-500/80 focus:border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              }`}
            />
            {errors.description && (
              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle size={12} />
                {errors.description}
              </p>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 transition-all shadow-md shadow-purple-900/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditMode ? 'Update Description' : 'Save Description'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
