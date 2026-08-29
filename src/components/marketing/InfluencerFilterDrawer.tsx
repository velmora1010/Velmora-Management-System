import React from 'react';
import { SlidersHorizontal, X, RotateCcw, Check } from 'lucide-react';
import type { CampaignInfluencer } from '../../types';

export interface InfluencerFilterState {
  missingPhone: boolean;
  missingAltPhone: boolean;
  missingUpi: boolean;
  missingCity: boolean;
  missingState: boolean;
  missingAddress: boolean;
  missingInfluencerName: boolean;
  missingUserName: boolean;
  missingLanguage: boolean;
  missingProfileImage: boolean;

  state: string;
  city: string;
  creatorCategory: string;
  followerRange: string;
  languages: string[];
  platformCombo: string;
  product: string;
  minPrice: string;
  maxPrice: string;
}

export const initialFilterState: InfluencerFilterState = {
  missingPhone: false,
  missingAltPhone: false,
  missingUpi: false,
  missingCity: false,
  missingState: false,
  missingAddress: false,
  missingInfluencerName: false,
  missingUserName: false,
  missingLanguage: false,
  missingProfileImage: false,

  state: '',
  city: '',
  creatorCategory: '',
  followerRange: '',
  languages: [],
  platformCombo: 'all',
  product: '',
  minPrice: '',
  maxPrice: ''
};

export const CREATOR_CATEGORIES = [
  'C1L1',
  'C1L2',
  'C2L1',
  'C2L2',
  'C3L1',
  'C3L2',
  'C4L1',
  'C4L2'
];

export const FOLLOWER_RANGES = [
  { id: 'below_10k', label: 'Below 10K' },
  { id: '10k_25k', label: '10K - 25K' },
  { id: '25k_50k', label: '25K - 50K' },
  { id: '50k_100k', label: '50K - 100K' },
  { id: '100k_200k', label: '100K - 200K' },
  { id: '200k_300k', label: '200K - 300K' },
  { id: '300k_400k', label: '300K - 400K' },
  { id: '400k_500k', label: '400K - 500K' },
  { id: 'above_500k', label: 'Above 500K' }
];

export const PLATFORM_COMBOS = [
  { id: 'all', label: 'All Platforms' },
  { id: 'instagram', label: 'Instagram Only' },
  { id: 'youtube', label: 'YouTube Only' },
  { id: 'facebook', label: 'Facebook Only' },
  { id: 'instagram_youtube', label: 'Instagram + YouTube' },
  { id: 'instagram_facebook', label: 'Instagram + Facebook' },
  { id: 'youtube_facebook', label: 'YouTube + Facebook' },
  { id: 'instagram_youtube_facebook', label: 'Instagram + YouTube + FB' },
  { id: 'none', label: 'No Platform' }
];

interface InfluencerFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  influencers: CampaignInfluencer[];
  filterState: InfluencerFilterState;
  onApplyFilter: (newState: InfluencerFilterState) => void;
  onResetFilter: () => void;
}

export const InfluencerFilterDrawer: React.FC<InfluencerFilterDrawerProps> = ({
  isOpen,
  onClose,
  influencers,
  filterState,
  onApplyFilter,
  onResetFilter
}) => {
  const [draft, setDraft] = React.useState<InfluencerFilterState>(filterState);

  React.useEffect(() => {
    setDraft(filterState);
  }, [filterState, isOpen]);

  // Dynamically extract unique states, cities, categories, languages, products
  const availableStates = React.useMemo(() => {
    const states = new Set<string>();
    influencers.forEach(inf => {
      if (inf.state && inf.state.trim()) states.add(inf.state.trim());
    });
    return Array.from(states).sort();
  }, [influencers]);

  const availableCities = React.useMemo(() => {
    const cities = new Set<string>();
    influencers.forEach(inf => {
      if (draft.state) {
        if ((inf.state || '').trim().toLowerCase() === draft.state.trim().toLowerCase()) {
          if (inf.city && inf.city.trim()) cities.add(inf.city.trim());
        }
      } else {
        if (inf.city && inf.city.trim()) cities.add(inf.city.trim());
      }
    });
    return Array.from(cities).sort();
  }, [influencers, draft.state]);

  const availableCategories = React.useMemo(() => {
    const cats = new Set<string>();
    influencers.forEach(inf => {
      if (inf.instagram_view_code && inf.instagram_view_code.trim()) cats.add(inf.instagram_view_code.trim());
      if (inf.facebook_view_code && inf.facebook_view_code.trim()) cats.add(inf.facebook_view_code.trim());
      if (inf.youtube_view_code && inf.youtube_view_code.trim()) cats.add(inf.youtube_view_code.trim());
    });
    return Array.from(cats).sort();
  }, [influencers]);

  const availableLanguages = React.useMemo(() => {
    const langs = new Set<string>();
    influencers.forEach(inf => {
      const list = Array.isArray(inf.languages) 
        ? inf.languages 
        : (typeof inf.languages === 'string' ? (inf.languages as string).split(',') : []);
      list.forEach((l: any) => {
        const s = String(l).trim();
        if (s && !s.startsWith('views_data:')) langs.add(s);
      });
    });
    return Array.from(langs).sort();
  }, [influencers]);

  const availableProducts = React.useMemo(() => {
    const prods = new Set<string>();
    influencers.forEach(inf => {
      (inf.products || []).forEach((p: any) => {
        const name = p.product_name || p.name;
        if (name && name.trim()) prods.add(name.trim());
      });
    });
    return Array.from(prods).sort();
  }, [influencers]);

  if (!isOpen) return null;

  const toggleLanguage = (lang: string) => {
    setDraft(prev => {
      const exists = prev.languages.includes(lang);
      return {
        ...prev,
        languages: exists ? prev.languages.filter(l => l !== lang) : [...prev.languages, lang]
      };
    });
  };

  const handleApply = () => {
    onApplyFilter(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(initialFilterState);
    onResetFilter();
  };

  const hasActiveFilters = 
    draft.state || draft.city || draft.creatorCategory || draft.followerRange ||
    draft.languages.length > 0 || (draft.platformCombo && draft.platformCombo !== 'all') || draft.product ||
    draft.minPrice || draft.maxPrice || draft.missingPhone || draft.missingAltPhone ||
    draft.missingUpi || draft.missingCity || draft.missingState || draft.missingAddress ||
    draft.missingInfluencerName || draft.missingUserName || draft.missingLanguage || draft.missingProfileImage;

  return (
    <>
      {/* Dark Overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity animate-fade-in" 
      />

      {/* Slide-over Drawer */}
      <aside 
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#141a29] text-slate-200 shadow-2xl border-l border-slate-700/80 flex flex-col animate-slide-left overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-700/80 flex items-center justify-between bg-[#1e2638]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400 border border-purple-500/30">
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Filter Influencers</h2>
              <p className="text-xs text-slate-400">Refine your influencer list by multiple criteria</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">

          {/* Location */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <span>Location</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">State</label>
                <select
                  value={draft.state}
                  onChange={(e) => setDraft(prev => ({ ...prev, state: e.target.value, city: '' }))}
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="">All States</option>
                  {availableStates.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">City</label>
                <select
                  value={draft.city}
                  onChange={(e) => setDraft(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="">All Cities</option>
                  {availableCities.map(ct => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Creator & Category */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Creator Category & Languages
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Creator Category</label>
              <select
                value={draft.creatorCategory}
                onChange={(e) => setDraft(prev => ({ ...prev, creatorCategory: e.target.value }))}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="">All Categories</option>
                {CREATOR_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Languages (Multi-select)</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-900 border border-slate-800 rounded-lg">
                {availableLanguages.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">No languages available</span>
                ) : (
                  availableLanguages.map(lang => {
                    const active = draft.languages.includes(lang);
                    return (
                      <button
                        type="button"
                        key={lang}
                        onClick={() => toggleLanguage(lang)}
                        className={`px-2.5 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                          active 
                            ? 'bg-purple-600 text-white font-medium' 
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {active && <Check size={12} />}
                        {lang}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Followers Range */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Followers Based
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDraft(prev => ({ ...prev, followerRange: '' }))}
                className={`p-2 text-xs rounded-lg border text-center transition-colors ${
                  !draft.followerRange 
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300 font-semibold' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                All Ranges
              </button>
              {FOLLOWER_RANGES.map(range => {
                const active = draft.followerRange === range.id;
                return (
                  <button
                    type="button"
                    key={range.id}
                    onClick={() => setDraft(prev => ({ ...prev, followerRange: active ? '' : range.id }))}
                    className={`p-2 text-xs rounded-lg border text-center transition-colors ${
                      active 
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 font-semibold' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Platform Combination */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Platform Combination
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PLATFORM_COMBOS.map(combo => {
                const active = draft.platformCombo === combo.id;
                return (
                  <button
                    type="button"
                    key={combo.id}
                    onClick={() => setDraft(prev => ({ ...prev, platformCombo: combo.id }))}
                    className={`p-2.5 text-xs rounded-lg border text-left transition-colors flex items-center justify-between ${
                      active 
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 font-semibold' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{combo.label}</span>
                    {active && <Check size={14} className="text-purple-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Product & Price */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Product & Pricing
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Product</label>
                <select
                  value={draft.product}
                  onChange={(e) => setDraft(prev => ({ ...prev, product: e.target.value }))}
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="">All Products</option>
                  {availableProducts.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Min Price (₹)</label>
                  <input
                    type="number"
                    placeholder="Min ₹"
                    value={draft.minPrice}
                    onChange={(e) => setDraft(prev => ({ ...prev, minPrice: e.target.value }))}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Max Price (₹)</label>
                  <input
                    type="number"
                    placeholder="Max ₹"
                    value={draft.maxPrice}
                    onChange={(e) => setDraft(prev => ({ ...prev, maxPrice: e.target.value }))}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Missing Details Checklist */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Missing Details Checklist
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: 'missingPhone', label: 'Missing Phone Number' },
                { key: 'missingAltPhone', label: 'Missing Alt Phone' },
                { key: 'missingUpi', label: 'Missing UPI' },
                { key: 'missingCity', label: 'Missing City' },
                { key: 'missingState', label: 'Missing State' },
                { key: 'missingAddress', label: 'Missing Address' },
                { key: 'missingInfluencerName', label: 'Missing Name' },
                { key: 'missingUserName', label: 'Missing Username' },
                { key: 'missingLanguage', label: 'Missing Language' },
                { key: 'missingProfileImage', label: 'Missing Profile Image' }
              ].map(item => (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <input
                    type="checkbox"
                    checked={(draft as any)[item.key]}
                    onChange={(e) => setDraft(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 border-t border-slate-700/80 bg-[#1e2638] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasActiveFilters}
            className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              hasActiveFilters 
                ? 'border-slate-600 text-slate-300 hover:bg-slate-700' 
                : 'border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <RotateCcw size={14} /> Reset All
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700/60 rounded-lg transition-colors border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-md"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
