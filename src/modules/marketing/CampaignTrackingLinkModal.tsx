import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  AlertCircle, 
  Loader2, 
  Link2, 
  Check, 
  Sparkles, 
  Globe, 
  ShoppingBag, 
  ShoppingCart,
  Store,
  CheckCircle2, 
  RefreshCw,
  UserCheck, 
  UserX,
  ChevronDown,
  Search,
  Package
} from 'lucide-react';
import type { Campaign, CampaignInfluencer, InfluencerTrackingLink } from '../../types';
import { 
  SCRIPT_PRODUCTS, 
  COMBO_PRODUCTS, 
  ALL_CAMPAIGN_PRODUCTS, 
  isComboProduct 
} from '../../services/campaignScriptService';
import { 
  TRACKING_MARKETPLACES,
  TRACKING_PLATFORMS, 
  TRACKING_VIDEOS, 
  buildInfluencerTrackingUrl, 
  isValidAmazonUrl,
  isValidFlipkartUrl,
  isValidMeeshoUrl,
  isValidMarketplaceRedirectUrl,
  extractBaseProductUrl, 
  extractCodeNumber,
  batchGenerateInfluencerTrackingLinks,
  updateInfluencerTrackingLink,
  buildTrackingSlug,
  buildBrandedTrackingUrl,
  type TrackingMarketplaceConfig,
  type MarketplaceType,
  type TrackingPlatformConfig,
  type TrackingVideoConfig
} from '../../services/influencerTrackingLinkService';
import { isActiveStatus } from '../../utils/marketingUtils';
import toast from 'react-hot-toast';

export const getDefaultProductUrl = (prodName: string): string => {
  if (!prodName) return '';
  const slug = prodName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `https://www.justmixx.com/products/${slug}`;
};

// =========================================================================
// CUSTOM SEARCHABLE PRODUCT DROPDOWN COMPONENT
// =========================================================================
interface SearchableProductSelectProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  value,
  onChange,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setHighlightIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filtered lists
  const filteredStandard = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SCRIPT_PRODUCTS;
    return SCRIPT_PRODUCTS.filter(p => p.toLowerCase().includes(q));
  }, [search]);

  const filteredCombos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COMBO_PRODUCTS;
    return COMBO_PRODUCTS.filter(c => c.toLowerCase().includes(q));
  }, [search]);

  const allFilteredItems = useMemo(() => {
    return [...filteredStandard, ...filteredCombos];
  }, [filteredStandard, filteredCombos]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1 < allFilteredItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev - 1 >= 0 ? prev - 1 : allFilteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allFilteredItems[highlightIndex]) {
        onChange(allFilteredItems[highlightIndex]);
        setIsOpen(false);
      }
    }
  };

  const isCurrentCombo = isComboProduct(value);

  return (
    <div className="relative w-full" ref={dropdownRef} onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#070c18] border border-slate-700/80 hover:border-purple-500/80 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-purple-500"
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs ${
            isCurrentCombo 
              ? 'bg-purple-600/25 border border-purple-500/40 text-purple-300' 
              : 'bg-slate-800 border border-slate-700 text-slate-300'
          }`}>
            {isCurrentCombo ? <Package size={14} className="text-purple-300" /> : <span>🧴</span>}
          </div>
          <span className="font-semibold truncate text-white">{value || 'Select a Product or Combo'}</span>
          {isCurrentCombo && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
              COMBO
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-purple-400' : ''}`} />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-[#0c142c] border border-slate-700/90 rounded-xl shadow-2xl p-2 space-y-2 animate-in fade-in-50 zoom-in-95">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIndex(0);
              }}
              placeholder="Search products or combos..."
              className="w-full bg-[#070c18] border border-slate-700 focus:border-purple-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
            {allFilteredItems.length === 0 ? (
              <div className="py-4 text-center text-slate-500 text-xs">
                No products or combos found matching "{search}"
              </div>
            ) : (
              <>
                {/* Standard Products Group */}
                {filteredStandard.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Standard Products</span>
                      <span className="text-slate-500">{filteredStandard.length}</span>
                    </div>
                    {filteredStandard.map((prod) => {
                      const isSelected = value === prod;
                      const globalIndex = allFilteredItems.indexOf(prod);
                      const isHighlighted = highlightIndex === globalIndex;
                      return (
                        <div
                          key={prod}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onChange(prod);
                            setIsOpen(false);
                          }}
                          onMouseEnter={() => setHighlightIndex(globalIndex)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-purple-600/25 text-white font-bold border border-purple-500/40'
                              : isHighlighted
                                ? 'bg-slate-800 text-purple-200'
                                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="text-xs">🧴</span>
                            <span className="truncate">{prod}</span>
                          </div>
                          {isSelected && <Check size={14} className="text-purple-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Combos Group */}
                {filteredCombos.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="flex items-center gap-1">
                        <Package size={11} />
                        Combo Products
                      </span>
                      <span className="text-purple-400/80">{filteredCombos.length}</span>
                    </div>
                    {filteredCombos.map((combo) => {
                      const isSelected = value === combo;
                      const globalIndex = allFilteredItems.indexOf(combo);
                      const isHighlighted = highlightIndex === globalIndex;
                      return (
                        <div
                          key={combo}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onChange(combo);
                            setIsOpen(false);
                          }}
                          onMouseEnter={() => setHighlightIndex(globalIndex)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-purple-600/25 text-white font-bold border border-purple-500/40'
                              : isHighlighted
                                ? 'bg-slate-800 text-purple-200'
                                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <Package size={13} className="text-purple-400 shrink-0" />
                            <span className="truncate">{combo}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              COMBO
                            </span>
                            {isSelected && <Check size={14} className="text-purple-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// MAIN MODAL COMPONENT
// =========================================================================
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

  // Form Fields: Unified Marketplace Selection
  const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceType>('website');
  const [selectedProduct, setSelectedProduct] = useState<string>('Kitchen Cleaner');
  const [productUrl, setProductUrl] = useState<string>(''); // For Website / Shopify
  const [destinationUrl, setDestinationUrl] = useState<string>(''); // For Amazon, Flipkart, Meesho
  const [customSlug, setCustomSlug] = useState<string>('');
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

  // Prevent background page scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Reset or initialize state on open
  useEffect(() => {
    if (isOpen) {
      setValidationError(null);
      setGenerationResult(null);
      setIsGenerating(false);

      if (linkToEdit) {
        // Resolve marketplace from linkToEdit
        let mType: MarketplaceType = 'website';
        const dType = (linkToEdit.destination_type || '').toLowerCase();
        const pName = (linkToEdit.platform || '').toLowerCase();
        const bUrl = linkToEdit.base_product_url || '';

        if (dType === 'flipkart' || pName === 'flipkart' || isValidFlipkartUrl(bUrl)) {
          mType = 'flipkart';
        } else if (dType === 'meesho' || pName === 'meesho' || isValidMeeshoUrl(bUrl)) {
          mType = 'meesho';
        } else if (dType === 'amazon' || pName === 'amazon' || isValidAmazonUrl(bUrl)) {
          mType = 'amazon';
        } else {
          mType = 'website';
        }

        setSelectedMarketplace(mType);
        setSelectedProduct(linkToEdit.product || 'Kitchen Cleaner');
        setEditTrackingUrl(linkToEdit.tracking_url || '');
        setEditNotes(linkToEdit.notes || '');

        const isRedir = mType !== 'website';
        const initialSlug = linkToEdit.custom_slug || (isRedir ? buildTrackingSlug(linkToEdit.creator_code || linkToEdit.influencer_code, linkToEdit.video_number, linkToEdit.utm_content) : '');
        setCustomSlug(initialSlug);

        if (isRedir) {
          setDestinationUrl(linkToEdit.original_destination_url || linkToEdit.base_product_url || '');
          setProductUrl('');
          if (initialSlug && (!linkToEdit.tracking_url || linkToEdit.tracking_url.includes('/r/'))) {
            setEditTrackingUrl(buildBrandedTrackingUrl(initialSlug));
          }
        } else {
          setProductUrl(linkToEdit.base_product_url || getDefaultProductUrl(linkToEdit.product || 'Kitchen Cleaner'));
          setDestinationUrl('');
        }
        setSelectedVideoId(linkToEdit.video_number || 'Video 1');
      } else {
        // Defaults for batch generation
        setSelectedMarketplace('website');
        setCustomSlug('');
        const initialProd = (defaultProduct && defaultProduct !== 'All')
          ? defaultProduct
          : 'Kitchen Cleaner';
        setSelectedProduct(initialProd);
        setProductUrl(getDefaultProductUrl(initialProd));
        setDestinationUrl('');
        setSelectedVideoId('Video 1');
        setEditTrackingUrl('');
        setEditNotes('');
      }
    }
  }, [isOpen, linkToEdit, defaultProduct]);

  // Handle product change in batch form
  const handleProductChange = (newProd: string) => {
    const prevDefault = getDefaultProductUrl(selectedProduct);
    setSelectedProduct(newProd);
    setValidationError(null);

    // Update productUrl if Website is selected and URL was empty, previously default, or had an unencoded space
    if (selectedMarketplace === 'website') {
      if (!productUrl.trim() || productUrl.trim() === prevDefault || productUrl.includes('%20')) {
        setProductUrl(getDefaultProductUrl(newProd));
      }
    }
  };

  // Active marketplace config
  const currentMarketplace: TrackingMarketplaceConfig = useMemo(() => {
    return (
      TRACKING_MARKETPLACES.find(m => m.id === selectedMarketplace) ||
      TRACKING_MARKETPLACES[0]
    );
  }, [selectedMarketplace]);

  const currentVideo: TrackingVideoConfig = useMemo(() => {
    return (
      TRACKING_VIDEOS.find(v => v.id === selectedVideoId) ||
      TRACKING_VIDEOS[0]
    );
  }, [selectedVideoId]);

  // Clean base URL preview for Website
  const cleanBaseUrl = useMemo(() => {
    return extractBaseProductUrl(productUrl);
  }, [productUrl]);

  // Lowest code eligible influencer for preview (e.g. #HIS1)
  const sampleInfluencer = useMemo(() => {
    return sortedEligibleInfluencers.length > 0 ? sortedEligibleInfluencers[0] : null;
  }, [sortedEligibleInfluencers]);

  // Live Sample Preview URL
  const samplePreviewUrl = useMemo(() => {
    const sampleCode = sampleInfluencer?.code || (sampleInfluencer as any)?.influencer_code || 'HIS1';
    if (currentMarketplace.isRedirect) {
      const sampleSlug = buildTrackingSlug(sampleCode, currentVideo.name, currentVideo.utmContent);
      return buildBrandedTrackingUrl(sampleSlug);
    }
    const effectiveUrl = productUrl.trim() || getDefaultProductUrl(selectedProduct);
    return buildInfluencerTrackingUrl(
      effectiveUrl,
      currentMarketplace.utmSource,
      currentVideo.utmContent,
      sampleCode
    );
  }, [currentMarketplace, productUrl, selectedProduct, currentVideo, sampleInfluencer]);

  // Validate form before batch generation
  const validateForm = (): boolean => {
    if (!selectedProduct.trim()) {
      setValidationError('Please select a product.');
      return false;
    }

    if (selectedMarketplace === 'website') {
      if (!productUrl.trim()) {
        setValidationError('Please enter a valid website product link.');
        return false;
      }
      try {
        const test = productUrl.startsWith('http') ? productUrl : `https://${productUrl}`;
        new URL(test);
      } catch {
        setValidationError('Please enter a valid URL (e.g. https://www.justmixx.com/products/kitchen-cleaner).');
        return false;
      }
    } else if (selectedMarketplace === 'amazon') {
      if (!destinationUrl.trim()) {
        setValidationError('Please enter the Amazon product URL.');
        return false;
      }
      if (!isValidAmazonUrl(destinationUrl)) {
        setValidationError('Please enter a valid Amazon product URL (e.g. https://www.amazon.in/dp/... or https://amzn.in/...).');
        return false;
      }
    } else if (selectedMarketplace === 'flipkart') {
      if (!destinationUrl.trim()) {
        setValidationError('Please enter the Flipkart product URL.');
        return false;
      }
      if (!isValidFlipkartUrl(destinationUrl)) {
        setValidationError('Please enter a valid Flipkart product URL (e.g. https://www.flipkart.com/... or https://fkrt.it/...).');
        return false;
      }
    } else if (selectedMarketplace === 'meesho') {
      if (!destinationUrl.trim()) {
        setValidationError('Please enter the Meesho product URL.');
        return false;
      }
      if (!isValidMeeshoUrl(destinationUrl)) {
        setValidationError('Please enter a valid Meesho product URL (e.g. https://www.meesho.com/...).');
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

    const isRedir = currentMarketplace.isRedirect;

    if (selectedMarketplace === 'amazon' && destinationUrl.trim() && !isValidAmazonUrl(destinationUrl)) {
      setValidationError('Please enter a valid Amazon product URL.');
      return;
    }
    if (selectedMarketplace === 'flipkart' && destinationUrl.trim() && !isValidFlipkartUrl(destinationUrl)) {
      setValidationError('Please enter a valid Flipkart product URL.');
      return;
    }
    if (selectedMarketplace === 'meesho' && destinationUrl.trim() && !isValidMeeshoUrl(destinationUrl)) {
      setValidationError('Please enter a valid Meesho product URL.');
      return;
    }
    if (isRedir && !customSlug.trim()) {
      setValidationError('Short code / slug is required for redirect links.');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Updating tracking link...');

    try {
      const cleanSlug = isRedir ? customSlug.trim().toLowerCase() : undefined;
      const finalTrackingUrl = isRedir && cleanSlug 
        ? buildBrandedTrackingUrl(cleanSlug) 
        : editTrackingUrl.trim();

      const effectiveDestUrl = isRedir ? destinationUrl.trim() : productUrl.trim();

      const updated = await updateInfluencerTrackingLink(linkToEdit.id, campaign.id, {
        influencer_id: linkToEdit.influencer_id,
        influencer_name: linkToEdit.influencer_name,
        influencer_code: linkToEdit.influencer_code,
        product: selectedProduct,
        destination_type: currentMarketplace.destinationType,
        original_destination_url: isRedir ? effectiveDestUrl : undefined,
        base_product_url: effectiveDestUrl,
        platform: currentMarketplace.name,
        platform_category: isRedir ? 'MARKETPLACE' : 'WEBSITE',
        video_number: currentVideo.name,
        utm_source: currentMarketplace.utmSource,
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

    const isRedir = currentMarketplace.isRedirect;
    const effectiveBaseUrl = isRedir ? destinationUrl.trim() : productUrl.trim();

    try {
      const result = await batchGenerateInfluencerTrackingLinks({
        campaign_id: campaign.id,
        product: selectedProduct,
        base_product_url: effectiveBaseUrl,
        destination_type: currentMarketplace.destinationType,
        original_destination_url: isRedir ? effectiveBaseUrl : undefined,
        platform: currentMarketplace.name,
        platform_category: isRedir ? 'MARKETPLACE' : 'WEBSITE',
        utm_source: currentMarketplace.utmSource,
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
    if (failedInfluencers.length > 0) {
      handleConfirmAndGenerate(failedInfluencers);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      {/* Centered Modal Container with Responsive Max Width and 90dvh Max Height */}
      <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl max-w-[740px] w-full max-h-[90dvh] flex flex-col shadow-2xl text-slate-200 overflow-hidden">
        
        {/* =========================================================================
            1. FIXED HEADER (Always visible)
            ========================================================================= */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#0b1329]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shadow-inner shrink-0">
              <Link2 size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase truncate">
                {isEditMode ? 'EDIT INFLUENCER TRACKING LINK' : 'CREATE INFLUENCER TRACKING LINKS'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {campaign.campaign_name}
                {!isEditMode && (
                  <span className="text-purple-400 ml-2 font-semibold">
                    • {sortedEligibleInfluencers.length} Eligible Influencers
                    {eliminatedCount > 0 && ` (${eliminatedCount} Excluded)`}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* =========================================================================
            2. SCROLLABLE BODY (Independently scrollable)
            ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 min-h-0">
          
          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Edit Mode Content */}
          {isEditMode && linkToEdit ? (
            <form id="edit-tracking-link-form" onSubmit={handleEditSubmit} className="space-y-4">
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
                  Product / Combo *
                </label>
                <SearchableProductSelect
                  value={selectedProduct}
                  onChange={(val) => setSelectedProduct(val)}
                  disabled={isGenerating}
                />
              </div>

              {currentMarketplace.isRedirect ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-purple-300 uppercase tracking-wider mb-1.5">
                      Branded Short Code / Slug *
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-purple-300/80 font-mono select-none">
                        /r/
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
                        className="flex-1 bg-[#070c18] border border-purple-500/40 focus:border-purple-400 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-purple-300 uppercase tracking-wider mb-1.5">
                      {currentMarketplace.name} Destination URL *
                    </label>
                    <input
                      type="text"
                      value={destinationUrl}
                      onChange={(e) => {
                        setDestinationUrl(e.target.value);
                        setValidationError(null);
                      }}
                      placeholder={`https://www.${selectedMarketplace === 'amazon' ? 'amazon.in/dp/...' : selectedMarketplace === 'flipkart' ? 'flipkart.com/...' : 'meesho.com/...'}`}
                      className="w-full bg-[#070c18] border border-purple-500/40 focus:border-purple-400 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Tracking Link Preview *
                    </label>
                    <input
                      type="text"
                      value={editTrackingUrl}
                      onChange={(e) => setEditTrackingUrl(e.target.value)}
                      placeholder="https://velmora-management-system.vercel.app/r/..."
                      className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-purple-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Shopify Tracking URL *
                  </label>
                  <input
                    type="text"
                    value={editTrackingUrl}
                    onChange={(e) => setEditTrackingUrl(e.target.value)}
                    placeholder="https://www.justmixx.com/products/..."
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
            </form>
          ) : (
            /* Batch Generation Form Content */
            <div className="space-y-4">
              
              {/* 1. PRODUCT & COMBO SELECTION (Searchable Dropdown) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Product / Combo <span className="text-purple-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {ALL_CAMPAIGN_PRODUCTS.length} options available
                  </span>
                </div>
                <SearchableProductSelect
                  value={selectedProduct}
                  onChange={handleProductChange}
                  disabled={isGenerating}
                />
              </div>

              {/* 2. UNIFIED MARKETPLACE SELECTION (4 Selectable Cards in Responsive Grid) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Marketplace <span className="text-purple-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    4 destination options
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {TRACKING_MARKETPLACES.map((m) => {
                    const isSelected = selectedMarketplace === m.id;
                    const getIcon = () => {
                      switch (m.id) {
                        case 'website':
                          return <Globe size={16} className={isSelected ? 'text-purple-400' : 'text-slate-400'} />;
                        case 'amazon':
                          return <ShoppingBag size={16} style={{ color: isSelected ? m.brandColor : undefined }} className={!isSelected ? 'text-slate-400' : ''} />;
                        case 'flipkart':
                          return <ShoppingCart size={16} style={{ color: isSelected ? m.brandColor : undefined }} className={!isSelected ? 'text-slate-400' : ''} />;
                        case 'meesho':
                          return <Store size={16} style={{ color: isSelected ? m.brandColor : undefined }} className={!isSelected ? 'text-slate-400' : ''} />;
                      }
                    };

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMarketplace(m.id);
                          setValidationError(null);
                          if (m.id === 'website' && !productUrl.trim()) {
                            setProductUrl(getDefaultProductUrl(selectedProduct));
                          }
                        }}
                        disabled={isGenerating}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/50'
                            : 'bg-[#070c18] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-center mb-1.5">
                          {getIcon()}
                        </div>
                        <span className="text-xs font-bold leading-none">{m.name}</span>
                        {/* Subtle brand color dot indicator */}
                        <div 
                          className="w-1.5 h-1.5 rounded-full mt-1.5"
                          style={{ backgroundColor: m.brandColor }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. DESTINATION PRODUCT URL (Marketplace-specific) */}
              {selectedMarketplace === 'website' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Shopify Product Link <span className="text-purple-400">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      UTMs auto-appended
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
                    placeholder="https://www.justmixx.com/products/..."
                    className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors disabled:opacity-50"
                  />
                  {cleanBaseUrl && (
                    <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                      <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Base URL:</span>
                      <span className="text-slate-300 font-mono truncate">{cleanBaseUrl}</span>
                    </div>
                  )}
                </div>
              ) : selectedMarketplace === 'amazon' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider">
                      Amazon Product URL <span className="text-amber-400">*</span>
                    </label>
                    <span className="text-[11px] text-amber-400 font-medium">
                      Atomic Click Tracking
                    </span>
                  </div>
                  <input
                    type="text"
                    value={destinationUrl}
                    onChange={(e) => {
                      setDestinationUrl(e.target.value);
                      setValidationError(null);
                    }}
                    disabled={isGenerating}
                    placeholder="https://www.amazon.in/dp/B0... or https://amzn.in/..."
                    className="w-full bg-[#070c18] border border-amber-500/40 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors disabled:opacity-50"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Each influencer receives a unique branded short link (<code className="text-amber-300">/r/{'{slug}'}</code> e.g. <code className="text-amber-300">his1-v1</code>). Visitor clicks are counted atomically in Redis before redirecting to Amazon.
                  </p>
                </div>
              ) : selectedMarketplace === 'flipkart' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider">
                      Flipkart Product URL <span className="text-blue-400">*</span>
                    </label>
                    <span className="text-[11px] text-blue-400 font-medium">
                      Atomic Click Tracking
                    </span>
                  </div>
                  <input
                    type="text"
                    value={destinationUrl}
                    onChange={(e) => {
                      setDestinationUrl(e.target.value);
                      setValidationError(null);
                    }}
                    disabled={isGenerating}
                    placeholder="https://www.flipkart.com/... or https://fkrt.it/..."
                    className="w-full bg-[#070c18] border border-blue-500/40 focus:border-blue-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Each influencer receives a unique branded short link (<code className="text-blue-300">/r/{'{slug}'}</code> e.g. <code className="text-blue-300">his1-v1</code>). Visitor clicks are counted atomically in Redis before redirecting to Flipkart.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-pink-300 uppercase tracking-wider">
                      Meesho Product URL <span className="text-pink-400">*</span>
                    </label>
                    <span className="text-[11px] text-pink-400 font-medium">
                      Atomic Click Tracking
                    </span>
                  </div>
                  <input
                    type="text"
                    value={destinationUrl}
                    onChange={(e) => {
                      setDestinationUrl(e.target.value);
                      setValidationError(null);
                    }}
                    disabled={isGenerating}
                    placeholder="https://www.meesho.com/..."
                    className="w-full bg-[#070c18] border border-pink-500/40 focus:border-pink-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-colors disabled:opacity-50"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Each influencer receives a unique branded short link (<code className="text-pink-300">/r/{'{slug}'}</code> e.g. <code className="text-pink-300">his1-v1</code>). Visitor clicks are counted atomically in Redis before redirecting to Meesho.
                  </p>
                </div>
              )}

              {/* 4. VIDEO */}
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

              {/* 5. COMPACT RESPONSIVE GENERATION SUMMARY & PREVIEW */}
              <div className="bg-slate-900/70 border border-purple-500/30 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <Sparkles size={13} className="text-purple-400" />
                    Generation Summary
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[11px] border border-purple-500/30">
                    {sortedEligibleInfluencers.length} Links to Generate
                  </span>
                </div>

                {/* Compact summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {/* Product Card */}
                  <div 
                    className="col-span-2 sm:col-span-1 bg-[#070c18] p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between min-h-[58px]"
                    title={selectedProduct}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Product</span>
                      {isComboProduct(selectedProduct) && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          COMBO
                        </span>
                      )}
                    </div>
                    <span className="text-slate-100 font-semibold text-xs leading-snug line-clamp-2 mt-0.5 break-words">
                      {selectedProduct}
                    </span>
                  </div>

                  {/* Marketplace Card */}
                  <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between min-h-[58px]">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Marketplace</span>
                    <span className="font-semibold truncate block mt-0.5" style={{ color: currentMarketplace.brandColor }}>
                      {currentMarketplace.name}
                    </span>
                  </div>

                  {/* Video Card */}
                  <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between min-h-[58px]">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Video</span>
                    <span className="text-slate-200 font-semibold truncate block mt-0.5">
                      {currentVideo.name}
                    </span>
                  </div>

                  {/* Eligible Card */}
                  <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between min-h-[58px]">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                      <UserCheck size={11} className="text-emerald-400" />
                      Eligible
                    </span>
                    <span className="text-emerald-400 font-bold truncate block mt-0.5">
                      {sortedEligibleInfluencers.length}
                    </span>
                  </div>

                  {/* Excluded Card */}
                  <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between min-h-[58px]">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                      <UserX size={11} className="text-rose-400" />
                      Excluded
                    </span>
                    <span className="text-rose-400 font-bold truncate block mt-0.5">
                      {eliminatedCount}
                    </span>
                  </div>
                </div>

                {/* Sample Preview Link */}
                {samplePreviewUrl && (
                  <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Link2 size={13} className="text-purple-400" />
                        Sample Link Preview ({sampleInfluencer?.code || '#HIS1'}):
                      </span>
                      {currentMarketplace.isRedirect ? (
                        <span 
                          className="text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md border"
                          style={{
                            color: currentMarketplace.brandColor,
                            backgroundColor: `${currentMarketplace.brandColor}15`,
                            borderColor: `${currentMarketplace.brandColor}30`
                          }}
                        >
                          302 Redirect &bull; Redis Click Tracking
                        </span>
                      ) : (
                        <span className="text-purple-300 text-[10px] font-mono bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                          utm_campaign={(sampleInfluencer?.code || 'his1').replace(/^#+/, '').toLowerCase()}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] font-mono break-all break-words select-all leading-relaxed p-2.5 rounded-lg border max-h-24 overflow-y-auto ${
                      currentMarketplace.isRedirect
                        ? 'text-purple-200/90 bg-purple-950/20 border-purple-500/20'
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

            </div>
          )}
        </div>

        {/* =========================================================================
            3. FIXED FOOTER (Always visible)
            ========================================================================= */}
        <div className="shrink-0 p-4 sm:p-5 border-t border-slate-800 bg-[#0b1329] flex items-center justify-end gap-3">
          {isEditMode && linkToEdit ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleEditSubmit(e as any)}
                disabled={isGenerating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-md shadow-purple-900/25 transition-all cursor-pointer"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>Save Changes</span>
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

      </div>
    </div>
  );
};
