import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Upload, 
  Music, 
  Video, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  Search, 
  Check, 
  ChevronDown
} from 'lucide-react';
import type { Campaign, CampaignScript } from '../../types';
import { 
  SCRIPT_PRODUCTS_CATALOG, 
  formatCombinedProductTitle,
  resolveCatalogProduct,
  parseScriptContent,
  createCampaignScript, 
  updateCampaignScript 
} from '../../services/campaignScriptService';
import toast from 'react-hot-toast';

interface CampaignScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  scriptToEdit?: CampaignScript | null;
  onSuccess: (savedScript: CampaignScript) => void;
}

const DEFAULT_LANGUAGES = [
  "Tamil", "English", "Hindi", "Telugu", "Kannada", 
  "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Magahi", "Other"
];

export const CampaignScriptModal: React.FC<CampaignScriptModalProps> = ({
  isOpen,
  onClose,
  campaign,
  scriptToEdit,
  onSuccess
}) => {
  // Multi-product selection states
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Single shared Model Script and Key Points fields
  const [modelScript, setModelScript] = useState('');
  const [keyPoints, setKeyPoints] = useState('');

  // Common script fields
  const [language, setLanguage] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // File states
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [removeExistingAudio, setRemoveExistingAudio] = useState(false);
  const [removeExistingVideo, setRemoveExistingVideo] = useState(false);

  // Validation & UI states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Available languages: merge campaign target_languages with default languages
  const availableLanguages = useMemo(() => {
    let campaignLangs: string[] = [];
    if (typeof campaign.target_languages === 'string') {
      try {
        const parsed = JSON.parse(campaign.target_languages);
        campaignLangs = Array.isArray(parsed) ? parsed : [campaign.target_languages];
      } catch {
        campaignLangs = [campaign.target_languages];
      }
    } else if (Array.isArray(campaign.target_languages)) {
      campaignLangs = campaign.target_languages;
    }

    const set = new Set<string>();
    campaignLangs.filter(Boolean).forEach(l => set.add(l.trim()));
    DEFAULT_LANGUAGES.forEach(l => set.add(l.trim()));
    return Array.from(set);
  }, [campaign.target_languages]);

  // Combined product title computed deterministically
  const combinedProductTitle = useMemo(() => {
    return formatCombinedProductTitle(selectedProductIds);
  }, [selectedProductIds]);

  // Reset or populate form on open / scriptToEdit change
  useEffect(() => {
    if (!isOpen) return;

    if (scriptToEdit) {
      const parsed = parseScriptContent(scriptToEdit);
      setSelectedProductIds(parsed.productIds);
      setModelScript(parsed.modelScript || '');
      setKeyPoints(parsed.keyPoints || '');
      setLanguage(scriptToEdit.language || '');
      setAudioUrl(scriptToEdit.reference_audio_url || '');
      setVideoUrl(scriptToEdit.reference_video_url || '');
    } else {
      setSelectedProductIds([]);
      setModelScript('');
      setKeyPoints('');
      setLanguage(availableLanguages[0] || 'Tamil');
      setAudioUrl('');
      setVideoUrl('');
    }

    setProductSearchQuery('');
    setIsDropdownOpen(false);
    setAudioFile(null);
    setVideoFile(null);
    setRemoveExistingAudio(false);
    setRemoveExistingVideo(false);
    setErrors({});
    setSubmitError(null);
  }, [isOpen, scriptToEdit, availableLanguages]);

  // Filter catalog products for search dropdown
  const filteredCatalogProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return SCRIPT_PRODUCTS_CATALOG;
    const q = productSearchQuery.toLowerCase().trim();
    return SCRIPT_PRODUCTS_CATALOG.filter(
      p => p.name.toLowerCase().includes(q) || p.aliases.some(a => a.toLowerCase().includes(q))
    );
  }, [productSearchQuery]);

  // Toggle product selection
  const handleToggleProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      let updated: string[];
      if (prev.includes(productId)) {
        updated = prev.filter(id => id !== productId);
      } else {
        // Add and sort deterministically based on catalog order
        updated = [...prev, productId].sort((a, b) => {
          const idxA = SCRIPT_PRODUCTS_CATALOG.findIndex(p => p.id === a);
          const idxB = SCRIPT_PRODUCTS_CATALOG.findIndex(p => p.id === b);
          return idxA - idxB;
        });
      }

      if (errors.product) setErrors(e => ({ ...e, product: '' }));
      return updated;
    });
  };

  // Remove single product chip
  const handleRemoveProductChip = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleToggleProduct(productId);
  };

  // Clear all selected products
  const handleClearAllProducts = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProductIds([]);
  };

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (selectedProductIds.length === 0) {
      newErrors.product = 'Please select at least one product.';
    }

    if (!language.trim()) {
      newErrors.language = 'Language is required.';
    }

    if (!modelScript.trim()) {
      newErrors.modelScript = 'Model script is required.';
    }

    if (!keyPoints.trim()) {
      newErrors.keyPoints = 'Key points are required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      if (scriptToEdit) {
        // Edit existing script
        const updated = await updateCampaignScript({
          id: scriptToEdit.id,
          campaign_id: String(campaign.id),
          product: combinedProductTitle,
          product_ids: selectedProductIds,
          language,
          model_script: modelScript.trim(),
          key_points: keyPoints.trim(),
          reference_audio_url: audioUrl,
          reference_video_url: videoUrl,
          audioFile,
          videoFile,
          existingAudioFilePath: scriptToEdit.reference_audio_file_path,
          existingVideoFilePath: scriptToEdit.reference_video_file_path,
          removeAudioFile: removeExistingAudio,
          removeVideoFile: removeExistingVideo
        });
        toast.success('Script updated successfully');
        onSuccess(updated);
        onClose();
      } else {
        // Create new script strictly for current campaign
        const created = await createCampaignScript({
          campaign_id: String(campaign.id),
          product: combinedProductTitle,
          product_ids: selectedProductIds,
          language,
          model_script: modelScript.trim(),
          key_points: keyPoints.trim(),
          reference_audio_url: audioUrl,
          reference_video_url: videoUrl,
          audioFile,
          videoFile
        });
        toast.success('Script created successfully');
        onSuccess(created);
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to save script:', err);
      const msg = err?.message || 'Failed to save script. Please try again.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasExistingAudio = !!scriptToEdit?.reference_audio_file_path && !removeExistingAudio;
  const hasExistingVideo = !!scriptToEdit?.reference_video_file_path && !removeExistingVideo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#0b1329] rounded-t-2xl">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {scriptToEdit ? 'Edit Script' : 'Create Script'}
            </h3>
            <p className="text-xs text-purple-300 font-medium mt-0.5">
              Campaign: {campaign.campaign_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-slate-200">
          {submitError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300 text-xs">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Row 1: Searchable Multi-Select Product Dropdown with Combined Title Display */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Title (Product) <span className="text-purple-400">*</span>
              </label>
              {selectedProductIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllProducts}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                >
                  Clear All ({selectedProductIds.length})
                </button>
              )}
            </div>

            {/* Custom Multi-Select Dropdown Container */}
            <div className="relative" ref={dropdownRef}>
              <div
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className={`w-full bg-[#070c18] border ${
                  errors.product ? 'border-red-500/80' : 'border-slate-700/80 focus-within:border-purple-500'
                } rounded-xl px-3.5 py-2.5 min-h-[46px] flex items-center justify-between gap-2 cursor-pointer transition-colors shadow-inner`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {selectedProductIds.length === 0 ? (
                    <span className="text-xs sm:text-sm text-slate-500 select-none">
                      Select one or more products...
                    </span>
                  ) : (
                    <span
                      className="text-xs sm:text-sm font-semibold text-purple-200 truncate select-none"
                      title={combinedProductTitle}
                    >
                      {combinedProductTitle}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                  {selectedProductIds.length > 1 && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-bold">
                      {selectedProductIds.length} Products
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-purple-400' : ''}`}
                  />
                </div>
              </div>

              {/* Dropdown Menu when Expanded */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#0b1329] border border-slate-700 rounded-xl shadow-2xl z-40 max-h-72 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                  {/* Search Bar inside dropdown */}
                  <div className="p-2.5 border-b border-slate-800 bg-[#070c18]">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        placeholder="Search products..."
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  {/* Selected Products Chips with Remove Buttons */}
                  {selectedProductIds.length > 0 && (
                    <div className="p-2 border-b border-slate-800 bg-[#070c18]/70">
                      <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Selected Products ({selectedProductIds.length}):</span>
                        <button
                          type="button"
                          onClick={handleClearAllProducts}
                          className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {selectedProductIds.map(pid => {
                          const item = resolveCatalogProduct(pid);
                          return (
                            <span
                              key={pid}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/40"
                            >
                              <span>{item?.name || pid}</span>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveProductChip(pid, e)}
                                className="hover:bg-purple-500/40 rounded p-0.5 text-purple-300 hover:text-white transition-colors cursor-pointer"
                                title="Remove product"
                              >
                                <X size={11} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Product Catalog List with Checkboxes */}
                  <div className="overflow-y-auto divide-y divide-slate-800/60 p-1">
                    {filteredCatalogProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No products matching &ldquo;{productSearchQuery}&rdquo;
                      </div>
                    ) : (
                      filteredCatalogProducts.map(p => {
                        const isSelected = selectedProductIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleToggleProduct(p.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-purple-600/20 text-purple-200 font-semibold'
                                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                  isSelected
                                    ? 'bg-purple-600 border-purple-500 text-white'
                                    : 'border-slate-600 bg-slate-900'
                                }`}
                              >
                                {isSelected && <Check size={11} strokeWidth={3} />}
                              </div>
                              <span className="truncate">{p.name}</span>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider shrink-0 ml-2">
                                Selected
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errors.product && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.product}
              </p>
            )}
          </div>

          {/* Row 2: Language Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Language <span className="text-purple-400">*</span>
            </label>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                if (errors.language) setErrors(prev => ({ ...prev, language: '' }));
              }}
              className={`w-full bg-[#070c18] border ${
                errors.language ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              } rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors cursor-pointer`}
            >
              <option value="" disabled>Select Language</option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            {errors.language && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.language}
              </p>
            )}
          </div>

          {/* Single Shared Model Script Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Model Script <span className="text-purple-400">*</span>
              </label>
              {modelScript && (
                <span className="text-[11px] text-slate-500">
                  {modelScript.length} characters
                </span>
              )}
            </div>
            <textarea
              rows={5}
              value={modelScript}
              onChange={(e) => {
                setModelScript(e.target.value);
                if (errors.modelScript) setErrors(prev => ({ ...prev, modelScript: '' }));
              }}
              placeholder="Enter or paste complete model script dialogue, hook, body, and CTA covering the selected product(s)..."
              className={`w-full bg-[#070c18] border ${
                errors.modelScript ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              } rounded-xl p-3.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors resize-y leading-relaxed`}
            />
            {errors.modelScript && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.modelScript}
              </p>
            )}
          </div>

          {/* Single Shared Key Points Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Key Points <span className="text-purple-400">*</span>
              </label>
              {keyPoints && (
                <span className="text-[11px] text-slate-500">
                  {keyPoints.length} characters
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={keyPoints}
              onChange={(e) => {
                setKeyPoints(e.target.value);
                if (errors.keyPoints) setErrors(prev => ({ ...prev, keyPoints: '' }));
              }}
              placeholder="1. 1 Bottle makes 5 Litres&#10;2. Eco-friendly formula&#10;3. Non-irritating... (Enter key points for the selected product(s))"
              className={`w-full bg-[#070c18] border ${
                errors.keyPoints ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              } rounded-xl p-3.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors resize-y leading-relaxed`}
            />
            {errors.keyPoints && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.keyPoints}
              </p>
            )}
          </div>

          {/* Reference Audio Section */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Music size={14} className="text-purple-400" />
              <span>Reference Audio (Optional)</span>
            </label>

            {hasExistingAudio && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-700/60 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Music size={14} className="text-purple-400" />
                  <span className="truncate max-w-[280px]">Existing reference audio attached</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveExistingAudio(true)}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  type="file"
                  ref={audioInputRef}
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="w-full py-2.5 px-3 border border-dashed border-slate-700 hover:border-purple-500/70 rounded-xl bg-[#070c18] hover:bg-slate-900/60 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload size={14} />
                  <span className="truncate">
                    {audioFile ? audioFile.name : 'Upload Audio File (.mp3, .wav)'}
                  </span>
                </button>
                {audioFile && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-purple-300 px-1">
                    <span className="truncate max-w-[200px]">{audioFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setAudioFile(null)}
                      className="text-red-400 hover:text-red-300 cursor-pointer ml-2"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div>
                <input
                  type="url"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="Or paste external Audio Link..."
                  className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Reference Video Section */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Video size={14} className="text-purple-400" />
              <span>Reference Video (Optional)</span>
            </label>

            {hasExistingVideo && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-700/60 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Video size={14} className="text-purple-400" />
                  <span className="truncate max-w-[280px]">Existing reference video attached</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveExistingVideo(true)}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  type="file"
                  ref={videoInputRef}
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="w-full py-2.5 px-3 border border-dashed border-slate-700 hover:border-purple-500/70 rounded-xl bg-[#070c18] hover:bg-slate-900/60 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload size={14} />
                  <span className="truncate">
                    {videoFile ? videoFile.name : 'Upload Video File (.mp4, .mov)'}
                  </span>
                </button>
                {videoFile && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-purple-300 px-1">
                    <span className="truncate max-w-[200px]">{videoFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setVideoFile(null)}
                      className="text-red-400 hover:text-red-300 cursor-pointer ml-2"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Or paste external Video Link..."
                  className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 transition-all flex items-center gap-2 shadow-lg shadow-purple-900/30 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{scriptToEdit ? 'Save Changes' : 'Create Script'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
