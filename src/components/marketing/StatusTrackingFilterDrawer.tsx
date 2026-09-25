import React, { useState, useEffect, useMemo } from 'react';
import { 
  SlidersHorizontal, X, RotateCcw, Check, Video, Globe, 
  IndianRupee, Tag, Activity, Share2, Truck 
} from 'lucide-react';
import { areFilterValuesEqual } from '../../utils/filterUtils';

export interface StatusTrackingFilterState {
  videos: number[];
  languages: string[];
  priceRanges: string[];
  categories: string[];
  workflowStatuses: string[];
  platforms: string[];
  deliveryStatuses: string[];
}

export const initialStatusTrackingFilterState: StatusTrackingFilterState = {
  videos: [],
  languages: [],
  priceRanges: [],
  categories: [],
  workflowStatuses: [],
  platforms: [],
  deliveryStatuses: []
};

export const STATUS_TRACKING_PRICE_RANGES = [
  { id: 'below_1000', label: 'Below ₹1,000', min: 0, max: 999 },
  { id: '1000_2000', label: '₹1,000 – ₹2,000', min: 1000, max: 2000 },
  { id: '2000_3000', label: '₹2,000 – ₹3,000', min: 2000, max: 3000 },
  { id: '3000_4000', label: '₹3,000 – ₹4,000', min: 3000, max: 4000 },
  { id: '4000_5000', label: '₹4,000 – ₹5,000', min: 4000, max: 5000 },
  { id: '5000_6000', label: '₹5,000 – ₹6,000', min: 5000, max: 6000 },
  { id: '6000_7000', label: '₹6,000 – ₹7,000', min: 6000, max: 7000 },
  { id: '7000_8000', label: '₹7,000 – ₹8,000', min: 7000, max: 8000 },
  { id: '8000_9000', label: '₹8,000 – ₹9,000', min: 8000, max: 9000 },
  { id: '9000_10000', label: '₹9,000 – ₹10,000', min: 9000, max: 10000 },
  { id: 'above_10000', label: 'Above ₹10,000', min: 10001, max: Infinity }
];

export const STATUS_TRACKING_WORKFLOW_STATUSES = [
  'Not Started',
  'In Progress',
  'Pending',
  'On Hold',
  'Completed'
];

export const STATUS_TRACKING_DELIVERY_STATUSES = [
  'Not Delivered',
  'Delivered',
  'Delivery Confirmed'
];

export interface StatusTrackingFilterAvailableOptions {
  videos: number[];
  languages: string[];
  categories: string[];
  platforms: string[];
  deliveryStatuses?: string[];
}

interface StatusTrackingFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: StatusTrackingFilterState;
  onApplyFilters: (newFilters: StatusTrackingFilterState) => void;
  onResetFilters: () => void;
  availableOptions: StatusTrackingFilterAvailableOptions;
}

export const StatusTrackingFilterDrawer: React.FC<StatusTrackingFilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
  availableOptions
}) => {
  const [draft, setDraft] = useState<StatusTrackingFilterState>(filters);

  // Sync draft state with external filters whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setDraft(filters);
    }
  }, [isOpen, filters]);

  // Check if draft has any active filters
  const hasDraftFilters = useMemo(() => {
    return (
      draft.videos.length > 0 ||
      draft.languages.length > 0 ||
      draft.priceRanges.length > 0 ||
      draft.categories.length > 0 ||
      draft.workflowStatuses.length > 0 ||
      draft.platforms.length > 0 ||
      draft.deliveryStatuses.length > 0
    );
  }, [draft]);

  if (!isOpen) return null;

  // Toggle Video selection
  const toggleVideo = (videoNum: number) => {
    setDraft(prev => {
      const exists = prev.videos.includes(videoNum);
      return {
        ...prev,
        videos: exists ? prev.videos.filter(v => v !== videoNum) : [...prev.videos, videoNum].sort((a, b) => a - b)
      };
    });
  };

  const handleSelectAllVideos = () => {
    setDraft(prev => {
      if (prev.videos.length === availableOptions.videos.length) {
        return { ...prev, videos: [] };
      }
      return { ...prev, videos: [...availableOptions.videos] };
    });
  };

  // Toggle Language selection
  const toggleLanguage = (lang: string) => {
    setDraft(prev => {
      const exists = prev.languages.some(l => areFilterValuesEqual(l, lang));
      return {
        ...prev,
        languages: exists 
          ? prev.languages.filter(l => !areFilterValuesEqual(l, lang))
          : [...prev.languages, lang]
      };
    });
  };

  // Toggle Price Range
  const togglePriceRange = (rangeId: string) => {
    setDraft(prev => {
      const exists = prev.priceRanges.includes(rangeId);
      return {
        ...prev,
        priceRanges: exists 
          ? prev.priceRanges.filter(id => id !== rangeId)
          : [...prev.priceRanges, rangeId]
      };
    });
  };

  // Toggle Category
  const toggleCategory = (cat: string) => {
    setDraft(prev => {
      const exists = prev.categories.some(c => areFilterValuesEqual(c, cat));
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter(c => !areFilterValuesEqual(c, cat))
          : [...prev.categories, cat]
      };
    });
  };

  // Toggle Workflow Status
  const toggleWorkflowStatus = (status: string) => {
    setDraft(prev => {
      const exists = prev.workflowStatuses.some(s => areFilterValuesEqual(s, status));
      return {
        ...prev,
        workflowStatuses: exists
          ? prev.workflowStatuses.filter(s => !areFilterValuesEqual(s, status))
          : [...prev.workflowStatuses, status]
      };
    });
  };

  // Toggle Platform
  const togglePlatform = (plat: string) => {
    setDraft(prev => {
      const exists = prev.platforms.some(p => areFilterValuesEqual(p, plat));
      return {
        ...prev,
        platforms: exists
          ? prev.platforms.filter(p => !areFilterValuesEqual(p, plat))
          : [...prev.platforms, plat]
      };
    });
  };

  // Toggle Delivery Status
  const toggleDeliveryStatus = (delStatus: string) => {
    setDraft(prev => {
      const exists = prev.deliveryStatuses.some(d => areFilterValuesEqual(d, delStatus));
      return {
        ...prev,
        deliveryStatuses: exists
          ? prev.deliveryStatuses.filter(d => !areFilterValuesEqual(d, delStatus))
          : [...prev.deliveryStatuses, delStatus]
      };
    });
  };

  const handleReset = () => {
    setDraft(initialStatusTrackingFilterState);
    onResetFilters();
  };

  const handleApply = () => {
    onApplyFilters(draft);
    onClose();
  };

  const deliveryOptions = availableOptions.deliveryStatuses && availableOptions.deliveryStatuses.length > 0
    ? availableOptions.deliveryStatuses
    : STATUS_TRACKING_DELIVERY_STATUSES;

  return (
    <>
      {/* Dark Overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 transition-opacity animate-fade-in" 
      />

      {/* Slide-over Drawer */}
      <aside 
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#0d1527] text-slate-200 shadow-2xl border-l border-slate-700/80 flex flex-col animate-slide-left overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-700/80 flex items-center justify-between bg-[#131d35]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400 border border-purple-500/30">
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Filter Status Tracking</h2>
              <p className="text-xs text-slate-400">Refine your influencer list by multiple criteria</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">

          {/* 1. WORKFLOW STATUS */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Activity size={14} />
              <span>WORKFLOW STATUS</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDraft(prev => ({ ...prev, workflowStatuses: [] }))}
                className={`p-2.5 text-xs rounded-lg border text-center transition-colors font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                  draft.workflowStatuses.length === 0
                    ? 'bg-purple-600/25 border-purple-500 text-purple-300 font-semibold shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                {draft.workflowStatuses.length === 0 && <Check size={12} />}
                All Workflow Status
              </button>
              {STATUS_TRACKING_WORKFLOW_STATUSES.map(status => {
                const active = draft.workflowStatuses.some(s => areFilterValuesEqual(s, status));
                return (
                  <button
                    type="button"
                    key={status}
                    onClick={() => toggleWorkflowStatus(status)}
                    className={`p-2.5 text-xs rounded-lg border text-center transition-colors font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                      active
                        ? 'bg-purple-600/25 border-purple-500 text-purple-300 font-semibold shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    {active && <Check size={12} />}
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* 2. DELIVERY STATUS */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Truck size={14} />
              <span>DELIVERY STATUS</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDraft(prev => ({ ...prev, deliveryStatuses: [] }))}
                className={`p-2.5 text-xs rounded-lg border text-center transition-colors font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                  draft.deliveryStatuses.length === 0
                    ? 'bg-purple-600/25 border-purple-500 text-purple-300 font-semibold shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                {draft.deliveryStatuses.length === 0 && <Check size={12} />}
                All Delivery Status
              </button>
              {deliveryOptions.map(delStatus => {
                const active = draft.deliveryStatuses.some(d => areFilterValuesEqual(d, delStatus));
                return (
                  <button
                    type="button"
                    key={delStatus}
                    onClick={() => toggleDeliveryStatus(delStatus)}
                    className={`p-2.5 text-xs rounded-lg border text-center transition-colors font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                      active
                        ? 'bg-purple-600/25 border-purple-500 text-purple-300 font-semibold shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    {active && <Check size={12} />}
                    {delStatus}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* 3. PLATFORM */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Share2 size={14} />
              <span>PLATFORM</span>
            </div>
            {availableOptions.platforms.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No platform data found</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(prev => ({ ...prev, platforms: [] }))}
                  className={`p-2.5 text-xs rounded-lg border text-left transition-colors font-medium flex items-center justify-between cursor-pointer ${
                    draft.platforms.length === 0
                      ? 'bg-purple-600/25 border-purple-500 text-purple-300 font-semibold shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <span>All Platforms</span>
                  {draft.platforms.length === 0 && <Check size={14} className="text-purple-400" />}
                </button>
                {availableOptions.platforms.map(plat => {
                  const active = draft.platforms.some(p => areFilterValuesEqual(p, plat));
                  return (
                    <button
                      type="button"
                      key={plat}
                      onClick={() => togglePlatform(plat)}
                      className={`p-2.5 text-xs rounded-lg border text-left transition-colors font-medium flex items-center justify-between cursor-pointer ${
                        active
                          ? 'bg-purple-600/25 border-purple-500 text-purple-300 font-semibold shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <span>{plat}</span>
                      {active && <Check size={14} className="text-purple-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <hr className="border-slate-800" />

          {/* 4. LANGUAGE */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Globe size={14} />
              <span>LANGUAGE</span>
            </div>
            {availableOptions.languages.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No language data found in campaign influencers</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
                {availableOptions.languages.map(lang => {
                  const active = draft.languages.some(l => areFilterValuesEqual(l, lang));
                  return (
                    <button
                      type="button"
                      key={lang}
                      onClick={() => toggleLanguage(lang)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors flex items-center gap-1.5 cursor-pointer ${
                        active
                          ? 'bg-purple-600 text-white font-medium shadow-sm'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {active && <Check size={12} />}
                      {lang}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <hr className="border-slate-800" />

          {/* 5. PRICE */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <IndianRupee size={14} />
              <span>PRICE</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDraft(prev => ({ ...prev, priceRanges: [] }))}
                className={`col-span-2 p-2.5 text-xs rounded-lg border text-center transition-colors font-medium cursor-pointer ${
                  draft.priceRanges.length === 0
                    ? 'bg-purple-600/25 border-purple-500 text-purple-300 font-semibold shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                {draft.priceRanges.length === 0 && <Check size={12} className="inline mr-1" />}
                All Price Ranges
              </button>
              {STATUS_TRACKING_PRICE_RANGES.map(range => {
                const active = draft.priceRanges.includes(range.id);
                return (
                  <button
                    type="button"
                    key={range.id}
                    onClick={() => togglePriceRange(range.id)}
                    className={`p-2.5 text-xs rounded-lg border text-center transition-colors font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                      active
                        ? 'bg-purple-600/25 border-purple-500 text-purple-300 font-semibold shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    {active && <Check size={12} />}
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 border-t border-slate-700/80 bg-[#131d35] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasDraftFilters}
            className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              hasDraftFilters 
                ? 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white' 
                : 'border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <RotateCcw size={14} /> Reset Filters
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700/60 rounded-lg transition-colors border border-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-md cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
