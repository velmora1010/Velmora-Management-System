import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  AlertCircle, 
  Loader2, 
  Link2, 
  Check, 
  Sparkles, 
  Globe, 
  ShoppingBag, 
  CheckCircle2, 
  RefreshCw,
  Info,
  ExternalLink,
  UserCheck,
  UserX
} from 'lucide-react';
import type { Campaign, CampaignInfluencer, InfluencerTrackingLink } from '../../types';
import { SCRIPT_PRODUCTS } from '../../services/campaignScriptService';
import { 
  TRACKING_PLATFORMS, 
  TRACKING_VIDEOS, 
  buildInfluencerTrackingUrl, 
  buildAmazonRedirectTrackingUrl,
  isValidAmazonUrl,
  extractBaseProductUrl, 
  extractCodeNumber,
  batchGenerateInfluencerTrackingLinks,
  updateInfluencerTrackingLink,
  buildTrackingSlug,
  buildBrandedTrackingUrl,
  BRANDED_TRACKING_DOMAIN,
  type TrackingPlatformConfig,
  type TrackingVideoConfig
} from '../../services/influencerTrackingLinkService';
import { isActiveStatus } from '../../utils/marketingUtils';
import toast from 'react-hot-toast';

interface CampaignTrackingLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  influencers: CampaignInfluencer[];
  linkToEdit?: InfluencerTrackingLink | null;
  defaultProduct?: string;
  onSuccess: (savedLinks: InfluencerTrackingLink[]) => void;
}

export const CampaignTrackingLinkModal: React.FC<CampaignTrackingLinkModalProps> = ({
  isOpen,
  onClose,
  campaign,
  influencers,
  linkToEdit,
  defaultProduct,
  onSuccess
}) => {
  // Modal State
  const isEditMode = Boolean(linkToEdit);

  // Form Fields
  const [destinationType, setDestinationType] = useState<'shopify' | 'amazon'>('shopify');
  const [selectedProduct, setSelectedProduct] = useState<string>('Kitchen Cleaner');
  const [productUrl, setProductUrl] = useState<string>('');
  const [amazonUrl, setAmazonUrl] = useState<string>('');
  const [customSlug, setCustomSlug] = useState<string>('');
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('instagram');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('Video 1');

  // Edit Mode Specific Field
  const [editTrackingUrl, setEditTrackingUrl] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  // Generation / Progress State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  }>({ current: 0, total: 0, percentage: 0 });
  const [generationResult, setGenerationResult] = useState<{
    success: boolean;
    successCount: number;
    failedCount: number;
    failedIds: (string | number)[];
  } | null>(null);

  // Errors
  const [validationError, setValidationError] = useState<string | null>(null);

  // 1. FILTER: Strictly separate eligible vs eliminated influencers
  const eligibleInfluencers = useMemo(() => {
    return influencers.filter(inf => isActiveStatus(inf.is_archived));
  }, [influencers]);

  const eliminatedCount = useMemo(() => {
    return influencers.length - eligibleInfluencers.length;
  }, [influencers, eligibleInfluencers]);

  // 2. SORT: Order eligible influencers in numerical ascending Creator Code order
  const sortedEligibleInfluencers = useMemo(() => {
    return [...eligibleInfluencers].sort((a, b) => {
      const numA = extractCodeNumber(a.code || (a as any).influencer_code);
      const numB = extractCodeNumber(b.code || (b as any).influencer_code);
      if (numA !== numB) return numA - numB;
      return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true });
    });
  }, [eligibleInfluencers]);

  // Reset or initialize state on open
  useEffect(() => {
    if (isOpen) {
      setValidationError(null);
      setGenerationResult(null);
      setIsGenerating(false);

      if (linkToEdit) {
        const dest = linkToEdit.destination_type || (isValidAmazonUrl(linkToEdit.base_product_url || '') ? 'amazon' : 'shopify');
        setDestinationType(dest);
        setSelectedProduct(linkToEdit.product || 'Kitchen Cleaner');
        setEditTrackingUrl(linkToEdit.tracking_url || '');
        setEditNotes(linkToEdit.notes || '');

        const initialSlug = linkToEdit.custom_slug || (dest === 'amazon' ? buildTrackingSlug(linkToEdit.creator_code || linkToEdit.influencer_code, linkToEdit.video_number, linkToEdit.utm_content) : '');
        setCustomSlug(initialSlug);

        if (dest === 'amazon') {
          setAmazonUrl(linkToEdit.original_destination_url || linkToEdit.base_product_url || '');
          setProductUrl('');
          if (initialSlug && (!linkToEdit.tracking_url || linkToEdit.tracking_url.includes('/r/'))) {
            setEditTrackingUrl(buildBrandedTrackingUrl(initialSlug));
          }
        } else {
          setProductUrl(linkToEdit.base_product_url || '');
          setAmazonUrl('');
        }
        const matchedPlat = TRACKING_PLATFORMS.find(
          p => p.name.toLowerCase() === (linkToEdit.platform || '').toLowerCase() ||
               p.utmSource.toLowerCase() === (linkToEdit.utm_source || '').toLowerCase()
        );
        setSelectedPlatformId(matchedPlat ? matchedPlat.id : 'instagram');
        setSelectedVideoId(linkToEdit.video_number || 'Video 1');
      } else {
        // Defaults for batch generation
        setDestinationType('shopify');
        setCustomSlug('');
        const initialProd = (defaultProduct && defaultProduct !== 'All')
          ? defaultProduct
          : (SCRIPT_PRODUCTS.includes('Kitchen Cleaner' as any)
            ? 'Kitchen Cleaner'
            : SCRIPT_PRODUCTS[0] || 'Kitchen Cleaner');
        setSelectedProduct(initialProd);
        setProductUrl(extractBaseProductUrl(initialProd));
        setAmazonUrl('');
        setSelectedPlatformId('instagram');
        setSelectedVideoId('Video 1');
        setEditTrackingUrl('');
        setEditNotes('');
      }
    }
  }, [isOpen, linkToEdit, defaultProduct]);

  // Active configurations
  const currentPlatform: TrackingPlatformConfig = useMemo(() => {
    return (
      TRACKING_PLATFORMS.find(p => p.id === selectedPlatformId) ||
      TRACKING_PLATFORMS[0]
    );
  }, [selectedPlatformId]);

  const currentVideo: TrackingVideoConfig = useMemo(() => {
    return (
      TRACKING_VIDEOS.find(v => v.id === selectedVideoId) ||
      TRACKING_VIDEOS[0]
    );
  }, [selectedVideoId]);

  // Clean base URL preview
  const cleanBaseUrl = useMemo(() => {
    return extractBaseProductUrl(productUrl);
  }, [productUrl]);

  // Lowest code eligible influencer for preview (e.g. #HIS1)
  const sampleInfluencer = useMemo(() => {
    return sortedEligibleInfluencers.length > 0 ? sortedEligibleInfluencers[0] : null;
  }, [sortedEligibleInfluencers]);

  // Live Sample Preview URL
  const samplePreviewUrl = useMemo(() => {
    if (destinationType === 'amazon') {
      if (!amazonUrl.trim()) return '';
      const sampleCode = sampleInfluencer?.code || (sampleInfluencer as any)?.influencer_code || 'HIS1';
      const sampleSlug = buildTrackingSlug(sampleCode, currentVideo.name, currentVideo.utmContent);
      return buildBrandedTrackingUrl(sampleSlug);
    }
    if (!productUrl.trim()) return '';
    const code = sampleInfluencer?.code || (sampleInfluencer as any)?.influencer_code || 'HIS1';
    return buildInfluencerTrackingUrl(
      productUrl,
      currentPlatform.utmSource,
      currentVideo.utmContent,
      code
    );
  }, [destinationType, amazonUrl, productUrl, currentPlatform, currentVideo, sampleInfluencer]);

  if (!isOpen) return null;

  // Validate form before batch generation
  const validateForm = (): boolean => {
    if (!selectedProduct.trim()) {
      setValidationError('Please select a product.');
      return false;
    }
    if (destinationType === 'amazon') {
      if (!amazonUrl.trim()) {
        setValidationError('Please enter the original Amazon product URL.');
        return false;
      }
      if (!isValidAmazonUrl(amazonUrl)) {
        setValidationError('Please enter a valid Amazon product URL (e.g. https://www.amazon.in/dp/B0... or https://www.amazon.com/...).');
        return false;
      }
    } else {
      if (!productUrl.trim()) {
        setValidationError('Please enter a valid product link.');
        return false;
      }
      try {
        const test = productUrl.startsWith('http') ? productUrl : `https://${productUrl}`;
        new URL(test);
      } catch {
        setValidationError('Please enter a valid URL (e.g. https://www.justmixx.com/products/kitchen-cleaner).');
        return false;
      }
    }
    if (sortedEligibleInfluencers.length === 0) {
      setValidationError('No eligible (non-eliminated) influencers found in this campaign.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkToEdit) return;

    if (!editTrackingUrl.trim()) {
      setValidationError('Tracking URL is required.');
      return;
    }

    if (destinationType === 'amazon') {
      if (amazonUrl.trim() && !isValidAmazonUrl(amazonUrl)) {
        setValidationError('Please enter a valid Amazon product URL.');
        return;
      }
      if (!customSlug.trim()) {
        setValidationError('Short code / slug is required for Amazon branded links.');
        return;
      }
    }

    setIsGenerating(true);
    const toastId = toast.loading('Updating tracking link...');

    try {
      const cleanSlug = destinationType === 'amazon' ? customSlug.trim().toLowerCase() : undefined;
      const finalTrackingUrl = destinationType === 'amazon' && cleanSlug 
        ? buildBrandedTrackingUrl(cleanSlug) 
        : editTrackingUrl.trim();

      const updated = await updateInfluencerTrackingLink(linkToEdit.id, campaign.id, {
        influencer_id: linkToEdit.influencer_id,
        influencer_name: linkToEdit.influencer_name,
        influencer_code: linkToEdit.influencer_code,
        product: selectedProduct,
        destination_type: destinationType,
        original_destination_url: destinationType === 'amazon' ? amazonUrl.trim() : undefined,
        base_product_url: destinationType === 'amazon' ? amazonUrl.trim() : productUrl.trim(),
        platform: currentPlatform.name,
        platform_category: currentPlatform.category,
        video_number: currentVideo.name,
        utm_source: currentPlatform.utmSource,
        utm_content: currentVideo.utmContent,
        tracking_url: finalTrackingUrl,
        custom_slug: cleanSlug,
        notes: editNotes.trim()
      });

      toast.success('Tracking link updated successfully', { id: toastId });
      onSuccess([updated]);
      onClose();
    } catch (err: any) {
      console.error('Failed to update tracking link:', err);
      toast.error(err?.message || 'Failed to update tracking link', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Batch Generation (Excluding Eliminated)
  const handleConfirmAndGenerate = async (influencersToProcess = sortedEligibleInfluencers) => {
    if (!validateForm()) return;

    setIsGenerating(true);
    setGenerationResult(null);
    setGenerationProgress({ current: 0, total: influencersToProcess.length, percentage: 0 });

    try {
      const result = await batchGenerateInfluencerTrackingLinks({
        campaign_id: campaign.id,
        product: selectedProduct,
        base_product_url: destinationType === 'amazon' ? amazonUrl.trim() : productUrl.trim(),
        destination_type: destinationType,
        original_amazon_url: destinationType === 'amazon' ? amazonUrl.trim() : undefined,
        platform: currentPlatform.name,
        platform_category: currentPlatform.category,
        utm_source: currentPlatform.utmSource,
        video_number: currentVideo.name,
        utm_content: currentVideo.utmContent,
        influencers: influencersToProcess, // ONLY ELIGIBLE INFLUENCERS
        onProgress: (current, total, percentage) => {
          setGenerationProgress({ current, total, percentage });
        }
      });

      if (result.failedCount === 0) {
        setGenerationResult({
          success: true,
          successCount: result.successCount,
          failedCount: 0,
          failedIds: []
        });
        toast.success(`✓ ${result.successCount} tracking links generated successfully!`);
        onSuccess(result.links);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setGenerationResult({
          success: false,
          successCount: result.successCount,
          failedCount: result.failedCount,
          failedIds: result.failedInfluencerIds
        });
        toast.error(`${result.successCount} generated, ${result.failedCount} failed.`);
        if (result.links.length > 0) {
          onSuccess(result.links);
        }
      }
    } catch (err: any) {
      console.error('Batch generation failed:', err);
      toast.error(err?.message || 'An error occurred during link generation.');
      setGenerationResult({
        success: false,
        successCount: 0,
        failedCount: influencersToProcess.length,
        failedIds: influencersToProcess.map(i => i.id)
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Retry failed records
  const handleRetryFailed = () => {
    if (!generationResult || generationResult.failedIds.length === 0) return;
    const failedInfluencers = sortedEligibleInfluencers.filter(i =>
      generationResult.failedIds.includes(i.id)
    );
    handleConfirmAndGenerate(failedInfluencers);
  };

  const websitePlatforms = TRACKING_PLATFORMS.filter(p => p.category === 'WEBSITE');
  const marketplacePlatforms = TRACKING_PLATFORMS.filter(p => p.category === 'MARKETPLACE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-6 text-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shadow-inner">
              <Link2 size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide uppercase">
                {isEditMode ? 'EDIT INFLUENCER TRACKING LINK' : 'CREATE INFLUENCER TRACKING LINKS'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {campaign.campaign_name}
                {!isEditMode && (
                  <span className="text-purple-400 ml-2 font-semibold">
                    • {sortedEligibleInfluencers.length} Eligible Influencers
                    {eliminatedCount > 0 && ` (${eliminatedCount} Eliminated Excluded)`}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Edit Mode Content */}
        {isEditMode && linkToEdit ? (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Influencer
              </label>
              <div className="bg-[#070c18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 flex items-center justify-between">
                <span className="font-medium text-white">{linkToEdit.influencer_name || 'Influencer'}</span>
                <span className="font-mono text-purple-400 font-bold">{linkToEdit.influencer_code}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Product *
              </label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors cursor-pointer"
              >
                {SCRIPT_PRODUCTS.map((prod) => (
                  <option key={prod} value={prod}>
                    {prod}
                  </option>
                ))}
              </select>
            </div>

            {destinationType === 'amazon' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1.5">
                    Branded Short Code / Slug *
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-amber-300/80 font-mono select-none">
                      link.justmixx.com/
                    </span>
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                        setCustomSlug(val);
                        setEditTrackingUrl(val ? buildBrandedTrackingUrl(val) : '');
                        setValidationError(null);
                      }}
                      placeholder="his1-v1"
                      className="flex-1 bg-[#070c18] border border-amber-500/40 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Custom short link for this influencer (e.g. <span className="text-amber-300 font-mono">his1-v1</span>, <span className="text-amber-300 font-mono">his1-v2</span>, <span className="text-amber-300 font-mono">his2-v1</span>).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1.5">
                    Original Amazon Destination URL *
                  </label>
                  <input
                    type="text"
                    value={amazonUrl}
                    onChange={(e) => {
                      setAmazonUrl(e.target.value);
                      setValidationError(null);
                    }}
                    placeholder="https://www.amazon.in/dp/B0..."
                    className="w-full bg-[#070c18] border border-amber-500/40 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Visitors opening the short link are atomically counted and 302 redirected here.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Tracking Link Preview *
                  </label>
                  <input
                    type="text"
                    value={editTrackingUrl}
                    onChange={(e) => setEditTrackingUrl(e.target.value)}
                    placeholder="https://link.justmixx.com/..."
                    className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-amber-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Tracking URL *
                </label>
                <input
                  type="text"
                  value={editTrackingUrl}
                  onChange={(e) => setEditTrackingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Notes
              </label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notes or comments"
                className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-md shadow-purple-900/25 transition-all cursor-pointer"
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        ) : (
          /* Batch Generation Form */
          <div className="space-y-4">
            {/* 0. DESTINATION TYPE: SHOPIFY VS AMAZON */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Destination Type <span className="text-purple-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDestinationType('shopify');
                    setValidationError(null);
                  }}
                  disabled={isGenerating}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                    destinationType === 'shopify'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/50'
                      : 'bg-[#070c18] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Globe size={15} className={destinationType === 'shopify' ? 'text-purple-400' : 'text-slate-500'} />
                  <span>Shopify (Website)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDestinationType('amazon');
                    setValidationError(null);
                  }}
                  disabled={isGenerating}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                    destinationType === 'amazon'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-sm ring-1 ring-amber-500/50'
                      : 'bg-[#070c18] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <ShoppingBag size={15} className={destinationType === 'amazon' ? 'text-amber-400' : 'text-slate-500'} />
                  <span>Amazon (Marketplace)</span>
                </button>
              </div>
            </div>

            {/* 1. PRODUCT * */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Product <span className="text-purple-400">*</span>
              </label>
              <select
                value={selectedProduct}
                onChange={(e) => {
                  setSelectedProduct(e.target.value);
                  setValidationError(null);
                }}
                disabled={isGenerating}
                className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors cursor-pointer disabled:opacity-50"
              >
                {SCRIPT_PRODUCTS.map((prod) => (
                  <option key={prod} value={prod}>
                    {prod}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. PRODUCT LINK * (Conditional based on Destination Type) */}
            {destinationType === 'shopify' ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Shopify Product Link <span className="text-purple-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    UTMs will be auto-replaced
                  </span>
                </div>
                <input
                  type="text"
                  value={productUrl}
                  onChange={(e) => {
                    setProductUrl(e.target.value);
                    setValidationError(null);
                  }}
                  disabled={isGenerating}
                  placeholder="https://www.justmixx.com/products/kitchen-cleaner"
                  className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors disabled:opacity-50"
                />
                {cleanBaseUrl && (
                  <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Base URL:</span>
                    <span className="text-slate-300 font-mono truncate">{cleanBaseUrl}</span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider">
                    Original Amazon Product URL <span className="text-amber-400">*</span>
                  </label>
                  <span className="text-[11px] text-amber-400 font-medium">
                    Click Tracking Enabled
                  </span>
                </div>
                <input
                  type="text"
                  value={amazonUrl}
                  onChange={(e) => {
                    setAmazonUrl(e.target.value);
                    setValidationError(null);
                  }}
                  disabled={isGenerating}
                  placeholder="https://www.amazon.in/dp/B0... or https://www.amazon.com/..."
                  className="w-full bg-[#070c18] border border-amber-500/40 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors disabled:opacity-50"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  A unique branded short link (<code className="text-amber-300">https://link.justmixx.com/{'{slug}'}</code> e.g. <code className="text-amber-300">his1-v1</code>) will be generated for each influencer. Visitor clicks are atomically tracked in Redis before 302 redirecting to Amazon.
                </p>
              </div>
            )}

            {/* 3. PLATFORM * */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Platform <span className="text-purple-400">*</span>
              </label>
              
              <div className="space-y-3 bg-[#070c18] border border-slate-800 rounded-2xl p-3.5">
                {/* Category 1: WEBSITE */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <Globe size={13} className="text-purple-400" />
                    <span>Website</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {websitePlatforms.map((plat) => {
                      const isSelected = selectedPlatformId === plat.id;
                      return (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlatformId(plat.id);
                            setValidationError(null);
                          }}
                          disabled={isGenerating}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/50'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: plat.brandColor }}
                          />
                          <span>{plat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-[1px] bg-slate-800/80" />

                {/* Category 2: MARKETPLACE */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <ShoppingBag size={13} className="text-purple-400" />
                    <span>Marketplace</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {marketplacePlatforms.map((plat) => {
                      const isSelected = selectedPlatformId === plat.id;
                      return (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlatformId(plat.id);
                            setValidationError(null);
                          }}
                          disabled={isGenerating}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/50'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: plat.brandColor }}
                          />
                          <span>{plat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. VIDEO * */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Video <span className="text-purple-400">*</span>
                </label>
                <span className="text-[11px] text-purple-400 font-mono">
                  utm_content={currentVideo.utmContent}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {TRACKING_VIDEOS.map((vid) => {
                  const isSelected = selectedVideoId === vid.id;
                  return (
                    <button
                      key={vid.id}
                      type="button"
                      onClick={() => {
                        setSelectedVideoId(vid.id);
                        setValidationError(null);
                      }}
                      disabled={isGenerating}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/50'
                          : 'bg-[#070c18] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {vid.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. CONFIRMATION SUMMARY & SAMPLE PREVIEW */}
            <div className="bg-slate-900/70 border border-purple-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Sparkles size={13} className="text-purple-400" />
                  Generation Summary
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[11px] border border-purple-500/30">
                  {sortedEligibleInfluencers.length} Links to Generate
                </span>
              </div>

              {/* Exact summary metrics requested: Product, Platform, Video, Eligible Influencers, Excluded/Eliminated, Links to Generate */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="bg-[#070c18] p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Product</span>
                  <span className="text-slate-200 font-semibold truncate block mt-0.5">{selectedProduct}</span>
                </div>
                <div className="bg-[#070c18] p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Platform</span>
                  <span className="text-purple-300 font-semibold truncate block mt-0.5">{currentPlatform.name}</span>
                </div>
                <div className="bg-[#070c18] p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Video</span>
                  <span className="text-slate-200 font-semibold truncate block mt-0.5">{currentVideo.name}</span>
                </div>
                <div className="bg-[#070c18] p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold flex items-center gap-1">
                    <UserCheck size={11} className="text-emerald-400" />
                    Eligible
                  </span>
                  <span className="text-emerald-400 font-bold truncate block mt-0.5">{sortedEligibleInfluencers.length}</span>
                </div>
                <div className="bg-[#070c18] p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold flex items-center gap-1">
                    <UserX size={11} className="text-rose-400" />
                    Excluded
                  </span>
                  <span className="text-rose-400 font-bold truncate block mt-0.5">{eliminatedCount}</span>
                </div>
              </div>

              {/* Sample Preview Link */}
              {samplePreviewUrl && (
                <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-medium">
                      Sample Link Preview ({sampleInfluencer?.code || '#HIS1'}):
                    </span>
                    {destinationType === 'amazon' ? (
                      <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1">
                        302 Redirect &bull; Redis Click Tracking
                      </span>
                    ) : (
                      <span className="text-purple-400 text-[10px] font-mono">
                        utm_campaign={(sampleInfluencer?.code || 'his1').replace(/^#+/, '').toLowerCase()}
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] font-mono break-all select-all leading-relaxed p-2 rounded-lg border ${
                    destinationType === 'amazon'
                      ? 'text-amber-300/90 bg-amber-950/20 border-amber-500/20'
                      : 'text-purple-300/90 bg-purple-950/20 border-purple-500/20'
                  }`}>
                    {samplePreviewUrl}
                  </p>
                </div>
              )}
            </div>

            {/* 6. PROGRESS BAR / RESULT DISPLAY */}
            {isGenerating && (
              <div className="bg-[#070c18] border border-purple-500/40 rounded-2xl p-4 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-purple-400" />
                    Generating influencer tracking links...
                  </span>
                  <span className="font-mono text-purple-400 font-bold">
                    {generationProgress.current} / {generationProgress.total} links ({generationProgress.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${generationProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Failure Feedback & Retry Option */}
            {generationResult && !generationResult.success && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in">
                <div className="space-y-0.5">
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle size={15} />
                    <span>Generation Partially Failed</span>
                  </div>
                  <p className="text-slate-400">
                    {generationResult.successCount} links generated, {generationResult.failedCount} failed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw size={13} />
                  <span>Retry Failed Records</span>
                </button>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmAndGenerate(sortedEligibleInfluencers)}
                disabled={isGenerating || sortedEligibleInfluencers.length === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer ${
                  !isGenerating && sortedEligibleInfluencers.length > 0
                    ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-900/25'
                    : 'bg-purple-600/50 text-purple-200/50 cursor-not-allowed shadow-none'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Generating Links...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Confirm & Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
