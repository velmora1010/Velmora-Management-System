import React, { useState, useEffect, useMemo } from 'react';
import { SlidersHorizontal, X, RotateCcw, Check, Search, MapPin, Award, Globe, Users, Share2, CreditCard, Package } from 'lucide-react';
import type { CampaignInfluencer } from '../../types';
import { normalizeStateName, CREATOR_CATEGORIES, FOLLOWER_RANGES, PLATFORM_COMBOS, PRICE_RANGES } from './InfluencerFilterDrawer';
import { PRODUCT_LIST, formatDisplayProductName } from '../../modules/marketing/AddCampaignInfluencer';

export interface CampaignAnalyticsFilterState {
  searchTerm: string;
  states: string[];
  cities: string[];
  creatorCategories: string[];
  languages: string[];
  followerRange: string;
  platformCombo: string;
  priceRange: string;
  products: string[];
}

export const initialAnalyticsFilterState: CampaignAnalyticsFilterState = {
  searchTerm: '',
  states: [],
  cities: [],
  creatorCategories: [],
  languages: [],
  followerRange: '',
  platformCombo: '',
  priceRange: '',
  products: []
};

const ALL_LANGUAGES = [
  'English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 
  'Bengali', 'Gujarati', 'Punjabi', 'Magahi', 'Odia', 'Rajasthani', 'Haryanvi', 'Bhojpuri'
];

interface CampaignInfluencerAnalyticsFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  influencers: CampaignInfluencer[];
  filterState: CampaignAnalyticsFilterState;
  onApplyFilter: (newState: CampaignAnalyticsFilterState) => void;
}

export const CampaignInfluencerAnalyticsFilterDrawer: React.FC<CampaignInfluencerAnalyticsFilterDrawerProps> = ({
  isOpen,
  onClose,
  influencers,
  filterState,
  onApplyFilter
}) => {
  const [draft, setDraft] = useState<CampaignAnalyticsFilterState>(filterState);

  useEffect(() => {
    setDraft(filterState);
  }, [filterState, isOpen]);

  // Extract unique available states & cities dynamically from influencers dataset
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    influencers.forEach(inf => {
      const st = normalizeStateName(inf.state);
      if (st) set.add(st);
    });
    return Array.from(set).sort();
  }, [influencers]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    influencers.forEach(inf => {
      if (draft.states.length > 0) {
        const infStateNorm = normalizeStateName(inf.state).toLowerCase();
        const matchState = draft.states.some(s => s.toLowerCase() === infStateNorm);
        if (!matchState) return;
      }
      if (inf.city && inf.city.trim()) {
        set.add(inf.city.trim());
      }
    });
    return Array.from(set).sort();
  }, [influencers, draft.states]);

  if (!isOpen) return null;

  const toggleMultiSelect = (key: 'states' | 'cities' | 'creatorCategories' | 'languages' | 'products', item: string) => {
    setDraft(prev => {
      const current = prev[key] || [];
      const exists = current.includes(item);
      const updated = exists ? current.filter(x => x !== item) : [...current, item];
      return { ...prev, [key]: updated };
    });
  };

  const handleReset = () => {
    setDraft(initialAnalyticsFilterState);
  };

  const handleApply = () => {
    onApplyFilter(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-950/60 border border-purple-800/40 rounded-lg text-purple-400">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Analytics Filters</h3>
              <p className="text-xs text-slate-400">Refine influencer analytics by multiple criteria</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

          {/* INFLUENCER SEARCH */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Search size={14} /> Search Influencer
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by Code, Name, Username..."
                value={draft.searchTerm}
                onChange={(e) => setDraft(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 pl-8 focus:outline-none focus:border-purple-500"
              />
              <Search size={14} className="absolute left-2.5 top-3 text-slate-500" />
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* LOCATION */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <MapPin size={14} /> Location
            </div>

            {/* States */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">State (Select Multiple)</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar bg-slate-950 p-2 rounded-lg border border-slate-800">
                {availableStates.length > 0 ? (
                  availableStates.map(st => {
                    const active = draft.states.includes(st);
                    return (
                      <button
                        type="button"
                        key={st}
                        onClick={() => toggleMultiSelect('states', st)}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors flex items-center gap-1 ${
                          active
                            ? 'bg-purple-600/30 border-purple-500 text-purple-300 font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {active && <Check size={10} />}
                        {st}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-500 italic">No states found</span>
                )}
              </div>
            </div>

            {/* Cities */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">City (Select Multiple)</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar bg-slate-950 p-2 rounded-lg border border-slate-800">
                {availableCities.length > 0 ? (
                  availableCities.map(ct => {
                    const active = draft.cities.includes(ct);
                    return (
                      <button
                        type="button"
                        key={ct}
                        onClick={() => toggleMultiSelect('cities', ct)}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors flex items-center gap-1 ${
                          active
                            ? 'bg-purple-600/30 border-purple-500 text-purple-300 font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {active && <Check size={10} />}
                        {ct}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-500 italic">No cities found</span>
                )}
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* CREATOR & LANGUAGES */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Award size={14} /> Creator & Languages
            </div>

            {/* Creator Category */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Creator Category</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CREATOR_CATEGORIES.map(cat => {
                  const active = draft.creatorCategories.includes(cat);
                  return (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => toggleMultiSelect('creatorCategories', cat)}
                      className={`p-2 text-xs rounded-lg border text-center transition-colors flex items-center justify-between ${
                        active
                          ? 'bg-purple-600/30 border-purple-500 text-purple-300 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span>{cat}</span>
                      {active && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Languages */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Languages (Multi-Select)</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar bg-slate-950 p-2 rounded-lg border border-slate-800">
                {ALL_LANGUAGES.map(lang => {
                  const active = draft.languages.includes(lang);
                  return (
                    <button
                      type="button"
                      key={lang}
                      onClick={() => toggleMultiSelect('languages', lang)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors flex items-center gap-1 ${
                        active
                          ? 'bg-purple-600/30 border-purple-500 text-purple-300 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {active && <Check size={10} />}
                      {lang}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* AUDIENCE & PLATFORM */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Users size={14} /> Audience & Platform
            </div>

            {/* Followers Based Range */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Followers Based</label>
              <select
                value={draft.followerRange}
                onChange={(e) => setDraft(prev => ({ ...prev, followerRange: e.target.value }))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="">All Follower Ranges</option>
                {FOLLOWER_RANGES.map(fr => (
                  <option key={fr.id} value={fr.id}>{fr.label}</option>
                ))}
              </select>
            </div>

            {/* Platform Combination */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Platform Combination</label>
              <select
                value={draft.platformCombo}
                onChange={(e) => setDraft(prev => ({ ...prev, platformCombo: e.target.value }))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="">All Platform Combinations</option>
                {PLATFORM_COMBOS.map(pc => (
                  <option key={pc.id} value={pc.id}>{pc.label}</option>
                ))}
              </select>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* PRICING & PRODUCTS */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <CreditCard size={14} /> Pricing & Product
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Price Range</label>
              <select
                value={draft.priceRange}
                onChange={(e) => setDraft(prev => ({ ...prev, priceRange: e.target.value }))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="">All Price Ranges</option>
                {PRICE_RANGES.map(pr => (
                  <option key={pr.id} value={pr.id}>{pr.label}</option>
                ))}
              </select>
            </div>

            {/* Products (Multi-select) */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Product (Select Multiple)</label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar bg-slate-950 p-2 rounded-lg border border-slate-800">
                {PRODUCT_LIST.map(prod => {
                  const dispName = formatDisplayProductName(prod);
                  const active = draft.products.includes(dispName) || draft.products.includes(prod);
                  return (
                    <button
                      type="button"
                      key={prod}
                      onClick={() => toggleMultiSelect('products', dispName)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors flex items-center gap-1 ${
                        active
                          ? 'bg-purple-600/30 border-purple-500 text-purple-300 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {active && <Check size={10} />}
                      {dispName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-xs transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Reset All
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5"
            >
              <Check size={14} /> Apply Filters
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
