import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { 
  Search, 
  Package, 
  RefreshCcw, 
  ArrowLeft, 
  ChevronDown,
  SlidersHorizontal,
  X,
  Plus,
  Truck,
  Scale,
  MapPin,
  Building,
  RotateCcw,
  CheckSquare,
  Square,
  Users,
  Layers,
  AlertCircle,
  Check,
  ArrowRight
} from 'lucide-react';
import { useCampaignDispatch } from '../../hooks/marketing/useCampaignDispatch';
import { useCampaignInfluencers, compareInfluencerCodesAsc } from '../../hooks/marketing/useCampaignInfluencers';
import { isActiveStatus } from '../../utils/marketingUtils';
import { 
  getUniqueFilterOptions, 
  areFilterValuesEqual, 
  normalizeFilterKey 
} from '../../utils/filterUtils';
import { 
  getAllIndianStates, 
  getIndianCitiesForState, 
  MASTER_LOCATIONS, 
  STATE_ALIASES 
} from '../../data/indiaLocations';
import { parseInfluencerCodeRanges, type RangeParseResult } from '../../utils/influencerRangeParser';
import { dispatchBatchService, type DispatchBatch } from '../../services/dispatchBatchService';
import { PrepareDispatchModal } from './PrepareDispatchModal';

interface CampaignDispatchedListProps {
  campaign: Campaign;
  influencers?: CampaignInfluencer[];
  onBack: () => void;
  onDispatch?: (influencer: CampaignInfluencer) => void;
  onMoveToStatus?: (record: any) => void;
}

export const KNOWN_COURIERS = [
  'ST Courier',
  'Delhivery',
  'Ekart',
  'Amazon',
  'IThink Delhivery',
  'IThink Ekart',
  'IThink Amazon',
  'India Post',
  'DTDC'
];

export const WEIGHT_RANGES = [
  { id: 'all', label: 'All Weights' },
  { id: 'below_500g', label: 'Below 500 g' },
  { id: '500g_1kg', label: '500 g – 1 kg' },
  { id: '1kg_2kg', label: '1 kg – 2 kg' },
  { id: '2kg_5kg', label: '2 kg – 5 kg' },
  { id: 'above_5kg', label: 'Above 5 kg' },
];

export const normalizeStateName = (stateStr?: string | null): string => {
  if (!stateStr) return '';
  const trimmed = stateStr.trim();
  const clean = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean === 'telanagana' || clean === 'telangana') return 'Telangana';
  if (clean === 'tamilnadu' || clean === 'tamil nadu') return 'Tamil Nadu';
  
  // Check direct master location match
  for (const [key, stateObj] of Object.entries(MASTER_LOCATIONS)) {
    if (key === clean || stateObj.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean) {
      return stateObj.name;
    }
  }

  // Check alias match
  const aliasKey = STATE_ALIASES[clean];
  if (aliasKey && MASTER_LOCATIONS[aliasKey]) {
    return MASTER_LOCATIONS[aliasKey].name;
  }

  return trimmed;
};

export const parseWeightInGrams = (raw?: string | number | null): number | null => {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim().toLowerCase();
  if (!str) return null;

  if (str.includes('kg')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? null : num * 1000;
  }

  if (str.includes('g')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? null : num;
  }

  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return null;

  // Numbers under 25 in shipping context represent kilograms (e.g. 0.5, 3.5, 4.5)
  if (num < 25) {
    return num * 1000;
  }
  return num;
};

export const matchesWeightRange = (weightGrams: number | null, rangeId: string): boolean => {
  if (rangeId === 'all') return true;
  if (weightGrams === null) return false;

  switch (rangeId) {
    case 'below_500g':
      return weightGrams < 500;
    case '500g_1kg':
      return weightGrams >= 500 && weightGrams <= 1000;
    case '1kg_2kg':
      return weightGrams > 1000 && weightGrams <= 2000;
    case '2kg_5kg':
      return weightGrams > 2000 && weightGrams <= 5000;
    case 'above_5kg':
      return weightGrams > 5000;
    default:
      return true;
  }
};

export const isInfluencerDispatched = (inf: CampaignInfluencer, dispatchRecords: any[]): boolean => {
  const dispatch = inf.dispatchDetails || dispatchRecords.find(d => String(d.influencer_id) === String(inf.id));
  if (!dispatch) return false;
  const status = (dispatch.dispatch_status || '').trim().toLowerCase();
  return status === 'dispatched' || status === 'tracking';
};

export const CampaignDispatchedList: React.FC<CampaignDispatchedListProps> = ({ 
  campaign, 
  influencers,
  onBack, 
  onDispatch,
  onMoveToStatus: _onMoveToStatus 
}) => {
  const { influencers: hookInfluencers, isLoading: isInfluencersLoading, refresh: refreshInfluencers } = useCampaignInfluencers(campaign.id);
  const { dispatchRecords, isLoading: isDispatchLoading, refresh: refreshDispatch } = useCampaignDispatch(campaign.id);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCourier, setSelectedCourier] = useState('all');
  const [customCourierInput, setCustomCourierInput] = useState('');
  const [isAddingCustomCourier, setIsAddingCustomCourier] = useState(false);
  const [selectedWeightRange, setSelectedWeightRange] = useState('all');
  const [selectedDispatchStatus, setSelectedDispatchStatus] = useState('all');
  
  // Slide-over Filter Drawer State (matches Image 1)
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [draftState, setDraftState] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftCourier, setDraftCourier] = useState('all');
  const [draftWeightRange, setDraftWeightRange] = useState('all');
  const [draftDispatchStatus, setDraftDispatchStatus] = useState('all');

  // Sync draft filters when drawer opens
  useEffect(() => {
    if (isFilterDrawerOpen) {
      setDraftState(selectedState);
      setDraftCity(selectedCity);
      setDraftCourier(selectedCourier);
      setDraftWeightRange(selectedWeightRange);
      setDraftDispatchStatus(selectedDispatchStatus);
      setIsAddingCustomCourier(false);
      setCustomCourierInput('');
    }
  }, [isFilterDrawerOpen, selectedState, selectedCity, selectedCourier, selectedWeightRange, selectedDispatchStatus]);

  // Active influencers only (single authoritative source of truth)
  const baseInfluencers = useMemo(() => {
    if (influencers && influencers.length > 0) return influencers;
    return hookInfluencers || [];
  }, [influencers, hookInfluencers]);

  const activeOnly = useMemo(() => {
    return baseInfluencers.filter(inf => isActiveStatus(inf.is_archived));
  }, [baseInfluencers]);

  const getDispatchData = (inf: CampaignInfluencer) => {
    return inf.dispatchDetails || dispatchRecords.find(d => String(d.influencer_id) === String(inf.id));
  };

  const getInfluencerUsername = (inf: CampaignInfluencer): string => {
    const platformUser = inf.platforms?.find(p => p.username && p.username.trim())?.username?.trim();
    const raw = platformUser || inf.influencer_name?.trim() || (inf as any).username?.trim() || inf.name?.trim() || '';
    if (!raw) return '—';
    const clean = raw.replace(/^@+/, '');
    return `@${clean}`;
  };

  // Master Indian States + active campaign influencer states (normalized & deduplicated)
  const availableStates = useMemo(() => {
    const rawList: string[] = [...getAllIndianStates()];
    activeOnly.forEach(inf => {
      const dispatch = getDispatchData(inf);
      const st = inf.state || dispatch?.state;
      if (st && String(st).trim()) {
        const norm = normalizeStateName(st);
        rawList.push(norm || st);
      }
    });
    return getUniqueFilterOptions(rawList);
  }, [activeOnly, dispatchRecords]);

  // Master Indian Cities scoped to draftState (or all Indian cities) + influencer cities (normalized & deduplicated)
  const draftAvailableCities = useMemo(() => {
    const rawList: string[] = [...getIndianCitiesForState(draftState)];
    activeOnly.forEach(inf => {
      const dispatch = getDispatchData(inf);
      const infState = normalizeStateName(inf.state || dispatch?.state || '');
      
      // If draftState is selected, strictly scope cities to that state
      if (draftState) {
        if (!areFilterValuesEqual(draftState, infState)) {
          return;
        }
      }

      if (inf.city && String(inf.city).trim()) {
        rawList.push(String(inf.city).trim());
      }
    });
    return getUniqueFilterOptions(rawList);
  }, [activeOnly, dispatchRecords, draftState]);

  // Unique Courier Partners
  const availableCouriers = useMemo(() => {
    const rawList: string[] = [...KNOWN_COURIERS];
    dispatchRecords.forEach(d => {
      if (d.courier_partner && String(d.courier_partner).trim()) {
        rawList.push(String(d.courier_partner).trim());
      }
    });
    return getUniqueFilterOptions(rawList);
  }, [dispatchRecords]);

  // Counts for summary pills
  const dispatchedCount = useMemo(() => {
    return activeOnly.filter(inf => isInfluencerDispatched(inf, dispatchRecords)).length;
  }, [activeOnly, dispatchRecords]);

  const pendingCount = useMemo(() => {
    return Math.max(0, activeOnly.length - dispatchedCount);
  }, [activeOnly.length, dispatchedCount]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedState) count++;
    if (selectedCity) count++;
    if (selectedCourier !== 'all') count++;
    if (selectedWeightRange !== 'all') count++;
    if (selectedDispatchStatus !== 'all') count++;
    return count;
  }, [selectedState, selectedCity, selectedCourier, selectedWeightRange, selectedDispatchStatus]);

  const handleClearAllFilters = () => {
    setSelectedState('');
    setSelectedCity('');
    setSelectedCourier('all');
    setCustomCourierInput('');
    setIsAddingCustomCourier(false);
    setSelectedWeightRange('all');
    setSelectedDispatchStatus('all');
  };

  const handleResetDraftFilters = () => {
    setDraftState('');
    setDraftCity('');
    setDraftCourier('all');
    setDraftWeightRange('all');
    setDraftDispatchStatus('all');
    setCustomCourierInput('');
    setIsAddingCustomCourier(false);
  };

  const handleApplyDrawerFilters = () => {
    setSelectedState(draftState);
    setSelectedCity(draftCity);
    setSelectedCourier(draftCourier);
    setSelectedWeightRange(draftWeightRange);
    setSelectedDispatchStatus(draftDispatchStatus);
    setIsFilterDrawerOpen(false);
  };

  const handleDraftStateChange = (newState: string) => {
    setDraftState(newState);
    if (!newState) {
      return;
    }
    // Check if current draftCity is valid for new state
    if (draftCity) {
      const validCitiesForNewState = getIndianCitiesForState(newState);
      const isStillValid = validCitiesForNewState.some(c => areFilterValuesEqual(c, draftCity)) ||
        activeOnly.some(inf => {
          const st = normalizeStateName(inf.state || getDispatchData(inf)?.state || '');
          return areFilterValuesEqual(st, newState) && areFilterValuesEqual(inf.city, draftCity);
        });
      if (!isStillValid) {
        setDraftCity('');
      }
    }
  };

  const handleApplyCustomCourier = () => {
    if (!customCourierInput.trim()) return;
    const val = customCourierInput.trim();
    setDraftCourier(val);
    setCustomCourierInput('');
    setIsAddingCustomCourier(false);
  };

  // Filtered influencers based on Search + ALL active filters
  const filteredInfluencers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return activeOnly.filter(inf => {
      const dispatch = getDispatchData(inf);
      const username = getInfluencerUsername(inf).toLowerCase();
      const code = (inf.code || '').toLowerCase();
      const name = (inf.name || inf.influencer_name || '').toLowerCase();
      const phone = (inf.phone_number || dispatch?.phone_number || '').toLowerCase();
      const state = normalizeStateName(inf.state || dispatch?.state || '');
      const city = (inf.city || '').trim();
      const courierPartner = (dispatch?.courier_partner || '').trim();

      // 1. Search Query
      const matchesSearch = !term || 
        code.includes(term) ||
        username.includes(term) ||
        name.includes(term) ||
        phone.includes(term) ||
        city.toLowerCase().includes(term) ||
        state.toLowerCase().includes(term) ||
        courierPartner.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // 2. State Filter (case-insensitive & whitespace-safe)
      if (selectedState) {
        if (!areFilterValuesEqual(selectedState, state)) return false;
      }

      // 3. City Filter (case-insensitive & whitespace-safe)
      if (selectedCity) {
        if (!areFilterValuesEqual(selectedCity, city)) return false;
      }

      // 4. Courier Filter (case-insensitive & whitespace-safe)
      if (selectedCourier !== 'all') {
        if (selectedCourier === 'Not Dispatched') {
          if (isInfluencerDispatched(inf, dispatchRecords)) return false;
        } else {
          if (!areFilterValuesEqual(selectedCourier, courierPartner)) return false;
        }
      }

      // 5. Weight Filter
      if (selectedWeightRange !== 'all') {
        const grams = parseWeightInGrams(dispatch?.total_weight);
        if (!matchesWeightRange(grams, selectedWeightRange)) return false;
      }

      // 6. Dispatch Status Filter
      if (selectedDispatchStatus !== 'all') {
        const isDispatched = isInfluencerDispatched(inf, dispatchRecords);
        if (selectedDispatchStatus === 'dispatched' && !isDispatched) return false;
        if (selectedDispatchStatus === 'pending' && isDispatched) return false;
      }

      return true;
    }).sort(compareInfluencerCodesAsc);
  }, [activeOnly, searchTerm, selectedState, selectedCity, selectedCourier, selectedWeightRange, selectedDispatchStatus, dispatchRecords]);

  // Bulk Selection & Prepare Dispatch State
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
  const [selectedInfluencerIds, setSelectedInfluencerIds] = useState<string[]>([]);
  const [rangeInput, setRangeInput] = useState('');
  const [rangeFeedback, setRangeFeedback] = useState<RangeParseResult | null>(null);
  const [isPrepareModalOpen, setIsPrepareModalOpen] = useState(false);
  const [savedBatches, setSavedBatches] = useState<DispatchBatch[]>([]);

  // Load saved batches from persistent storage
  const loadSavedBatches = useCallback(async () => {
    try {
      const b = await dispatchBatchService.getBatches(campaign.id);
      setSavedBatches(b);
    } catch (e) {
      console.warn('Failed to load batches in CampaignDispatchedList:', e);
    }
  }, [campaign.id]);

  useEffect(() => {
    loadSavedBatches();
  }, [loadSavedBatches]);

  // Selected influencer objects (strictly active)
  const selectedInfluencerObjects = useMemo(() => {
    const idSet = new Set(selectedInfluencerIds);
    return activeOnly.filter(inf => idSet.has(String(inf.id)));
  }, [selectedInfluencerIds, activeOnly]);

  // Compact code summary formatted with dots (e.g. HIS1 · HIS2 · HIS3 · HIS4 · HIS5 · HIS7)
  const selectedCodesSummary = useMemo(() => {
    const codes = selectedInfluencerObjects
      .map(inf => inf.code)
      .filter(Boolean) as string[];

    if (codes.length === 0) return '';
    const maxDisplay = 8;
    if (codes.length <= maxDisplay) {
      return codes.join(' · ');
    }
    const slice = codes.slice(0, maxDisplay);
    const remaining = codes.length - maxDisplay;
    return `${slice.join(' · ')} + ${remaining} more`;
  }, [selectedInfluencerObjects]);

  const toggleSelectInfluencer = (id: string) => {
    setSelectedInfluencerIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedInfluencerIds([]);
    setRangeInput('');
    setRangeFeedback(null);
  };

  // Range input submission
  const handleApplyRange = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rangeInput.trim()) return;

    // Parse against active influencers (and all influencers to detect inactive/eliminated)
    const result = parseInfluencerCodeRanges(rangeInput, activeOnly, baseInfluencers);
    setRangeFeedback(result);

    if (result.selectedInfluencerIds.length > 0) {
      setSelectedInfluencerIds(prev => {
        const combined = new Set([...prev, ...result.selectedInfluencerIds]);
        return Array.from(combined);
      });
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refreshDispatch(), refreshInfluencers(), loadSavedBatches()]);
  };

  const isLoading = (isInfluencersLoading || isDispatchLoading) && baseInfluencers.length === 0;

  return (
    <div className="space-y-6 animate-fade-in text-slate-200">
      {/* Header Container */}
      <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-slate-700/80 rounded-xl transition-colors text-slate-400 hover:text-slate-200 cursor-pointer"
            title="Back to Campaign"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Package className="text-purple-400" size={22} />
              <h2 className="text-lg font-bold text-slate-100">
                Influencer Logistics ({activeOnly.length} Active Influencers)
              </h2>
            </div>
            
            {/* Summary Pills */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="px-2 py-0.5 bg-slate-900/90 text-slate-300 border border-slate-700/80 rounded-md text-[11px] font-medium">
                Active: <strong className="text-slate-100">{activeOnly.length}</strong>
              </span>
              <span className="px-2 py-0.5 bg-emerald-950/50 text-emerald-300 border border-emerald-800/50 rounded-md text-[11px] font-medium">
                Dispatched: <strong className="text-emerald-200">{dispatchedCount}</strong>
              </span>
              <span className="px-2 py-0.5 bg-purple-950/50 text-purple-300 border border-purple-800/50 rounded-md text-[11px] font-medium">
                Pending: <strong className="text-purple-200">{pendingCount}</strong>
              </span>
            </div>
            
            <p className="text-xs text-slate-400 mt-1">
              Manage dispatch, shipment tracking, and logistics for active influencers in {campaign.campaign_name}
            </p>
          </div>
        </div>

        {/* Right Search and Filter Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 md:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search code, user..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Filter Button (Icon only) */}
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(true)}
            className={`p-2.5 rounded-xl text-sm font-medium transition-colors border flex items-center justify-center relative cursor-pointer ${
              activeFilterCount > 0 
                ? 'bg-purple-950/60 border-purple-500 text-purple-300 font-semibold' 
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
            }`}
            title="Filters"
          >
            <SlidersHorizontal size={17} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Bulk Select Button */}
          <button
            type="button"
            onClick={() => setIsBulkSelectMode(prev => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
              isBulkSelectMode
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
            }`}
            title="Bulk Select"
          >
            {isBulkSelectMode ? <Check size={16} className="text-white" /> : <CheckSquare size={16} />}
            <span>Bulk Select</span>
            {selectedInfluencerObjects.length > 0 && (
              <span className="bg-white text-purple-900 text-[11px] font-extrabold rounded-full px-1.5 py-0.2 ml-0.5">
                {selectedInfluencerObjects.length}
              </span>
            )}
          </button>

          {/* Batches Button */}
          <button
            type="button"
            onClick={() => setIsPrepareModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors border bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 cursor-pointer"
            title="Batches"
          >
            <Truck size={16} className="text-purple-400" />
            <span>Batches</span>
            {savedBatches.length > 0 && (
              <span className="bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold rounded-full px-1.5 py-0.2">
                {savedBatches.length}
              </span>
            )}
          </button>

          {/* Refresh Button (Icon only with hover tooltip) */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-colors border border-slate-700 flex items-center justify-center cursor-pointer"
            title="Refresh"
          >
            <RefreshCcw size={17} className={(isDispatchLoading || isInfluencersLoading) ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* DEDICATED PREPARE DISPATCH SECTION (Visible when influencers are selected) */}
      {selectedInfluencerObjects.length > 0 && (
        <div className="bg-[#121929] border border-purple-600/40 rounded-2xl p-5 sm:p-6 shadow-xl shadow-purple-950/20 animate-fade-in flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded bg-purple-600/20 border border-purple-500/30 text-purple-300 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Truck size={12} className="text-purple-400" />
                PREPARE DISPATCH
              </span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs text-slate-400 hover:text-slate-200 underline font-medium cursor-pointer transition-colors"
              >
                Clear Selection
              </button>
            </div>

            <div className="pt-0.5">
              <h3 className="text-lg sm:text-xl font-bold text-slate-100">
                {selectedInfluencerObjects.length} {selectedInfluencerObjects.length === 1 ? 'influencer' : 'influencers'} selected
              </h3>
            </div>

            {selectedCodesSummary && (
              <p className="text-xs sm:text-sm font-mono font-semibold text-purple-300 break-words pt-0.5 tracking-wide">
                {selectedCodesSummary}
              </p>
            )}

            <p className="text-xs text-slate-400 pt-0.5">
              Review the selected influencers and organize them into dispatch batches.
            </p>
          </div>

          {/* Main CTA */}
          <div className="shrink-0 w-full md:w-auto flex justify-end">
            <button
              type="button"
              onClick={() => setIsPrepareModalOpen(true)}
              className="w-full md:w-auto px-6 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Prepare Dispatch</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Code & Range Input Bar (When Bulk Select is active) */}
      {isBulkSelectMode && (
        <div className="bg-[#141a29] border border-slate-800 rounded-2xl p-4 sm:p-4.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Users size={15} className="text-purple-400" />
              <span>Range & Code Selection:</span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Enter single codes or ranges separated by commas
            </span>
          </div>

          <form onSubmit={handleApplyRange} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={rangeInput}
                onChange={(e) => {
                  setRangeInput(e.target.value);
                  if (rangeFeedback) setRangeFeedback(null);
                }}
                placeholder="Enter codes or ranges (e.g. HIS1 - HIS5, HIS7, TNS20 - TNS25)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!rangeInput.trim()}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer shrink-0"
            >
              Select Codes
            </button>
          </form>

          {/* Validation Feedback */}
          {rangeFeedback && (
            <div className="space-y-1.5 text-xs pt-1">
              {rangeFeedback.invalidRanges.map((err, idx) => (
                <div key={idx} className="px-3.5 py-2 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-400" />
                  <span>{err}</span>
                </div>
              ))}

              {rangeFeedback.inactiveCodes.map((msg, idx) => (
                <div key={idx} className="px-3.5 py-2 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-300 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-amber-400" />
                  <span>{msg}</span>
                </div>
              ))}

              {rangeFeedback.notFoundCodes.map((msg, idx) => (
                <div key={idx} className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-slate-400" />
                  <span>{msg}</span>
                </div>
              ))}

              {rangeFeedback.selectedInfluencers.length > 0 && (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 flex items-center gap-2">
                  <Check size={15} className="shrink-0 text-emerald-400" />
                  <span>Selected {rangeFeedback.selectedInfluencers.length} active influencer{rangeFeedback.selectedInfluencers.length === 1 ? '' : 's'} from range.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Filters Bar */}
      {(activeFilterCount > 0 || searchTerm.trim()) && (
        <div className="px-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Active Filters:</span>
            
            {searchTerm.trim() && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Search: "{searchTerm.trim()}"
                <button onClick={() => setSearchTerm('')} className="hover:text-white text-slate-400 cursor-pointer">&times;</button>
              </span>
            )}

            {selectedState && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                <MapPin size={11} /> State: {selectedState}
                <button onClick={() => { setSelectedState(''); setSelectedCity(''); }} className="hover:text-white text-slate-400 cursor-pointer">&times;</button>
              </span>
            )}

            {selectedCity && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                <Building size={11} /> City: {selectedCity}
                <button onClick={() => setSelectedCity('')} className="hover:text-white text-slate-400 cursor-pointer">&times;</button>
              </span>
            )}

            {selectedCourier !== 'all' && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                <Truck size={11} /> Courier: {selectedCourier}
                <button onClick={() => setSelectedCourier('all')} className="hover:text-white text-slate-400 cursor-pointer">&times;</button>
              </span>
            )}

            {selectedWeightRange !== 'all' && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                <Scale size={11} /> Weight: {WEIGHT_RANGES.find(w => w.id === selectedWeightRange)?.label || selectedWeightRange}
                <button onClick={() => setSelectedWeightRange('all')} className="hover:text-white text-slate-400 cursor-pointer">&times;</button>
              </span>
            )}

            {selectedDispatchStatus !== 'all' && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Status: {selectedDispatchStatus === 'dispatched' ? 'Dispatched' : 'Not Dispatched'}
                <button onClick={() => setSelectedDispatchStatus('all')} className="hover:text-white text-slate-400 cursor-pointer">&times;</button>
              </span>
            )}
          </div>

          <button 
            type="button"
            onClick={handleClearAllFilters} 
            className="text-purple-400 hover:text-purple-300 underline font-semibold ml-2 text-xs cursor-pointer flex items-center gap-1"
          >
            <RotateCcw size={12} /> Clear all
          </button>
        </div>
      )}

      {/* Slide-over Filter Drawer (Exact layout as Image 1) */}
      {isFilterDrawerOpen && (
        <div 
          onClick={() => setIsFilterDrawerOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity animate-fade-in" 
        />
      )}

      <aside 
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#141a29] text-slate-200 shadow-2xl border-l border-slate-700/80 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isFilterDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
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
            onClick={() => setIsFilterDrawerOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
          
          {/* LOCATION */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Location
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">State</label>
                <select
                  value={draftState}
                  onChange={(e) => handleDraftStateChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
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
                  value={draftCity}
                  onChange={(e) => setDraftCity(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="">All Cities</option>
                  {draftAvailableCities.map(ct => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* COURIER PARTNER */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Courier Partner</span>
              <button
                type="button"
                onClick={() => setIsAddingCustomCourier(!isAddingCustomCourier)}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5 cursor-pointer"
              >
                <Plus size={12} /> Add Custom Courier
              </button>
            </div>

            {isAddingCustomCourier && (
              <div className="flex items-center gap-1.5 p-2 bg-slate-900/90 border border-slate-800 rounded-xl">
                <input
                  type="text"
                  value={customCourierInput}
                  onChange={(e) => setCustomCourierInput(e.target.value)}
                  placeholder="Enter courier partner name..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCustomCourier();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleApplyCustomCourier}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}

            <select
              value={draftCourier}
              onChange={(e) => setDraftCourier(e.target.value)}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all">All Couriers</option>
              <option value="Not Dispatched">Not Dispatched</option>
              {availableCouriers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              {draftCourier !== 'all' && 
               draftCourier !== 'Not Dispatched' && 
               !availableCouriers.some(c => areFilterValuesEqual(c, draftCourier)) && (
                <option value={draftCourier}>{draftCourier} (Custom)</option>
              )}
            </select>
          </div>

          <hr className="border-slate-800" />

          {/* TOTAL WEIGHT (WEIGHT BASED) */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Total Weight
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WEIGHT_RANGES.map(range => {
                const active = draftWeightRange === range.id;
                return (
                  <button
                    type="button"
                    key={range.id}
                    onClick={() => setDraftWeightRange(range.id)}
                    className={`p-2.5 text-xs rounded-xl font-medium transition-all text-center border cursor-pointer ${
                      active 
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30 font-semibold' 
                        : 'bg-slate-900 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* DISPATCH STATUS */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Dispatch Status
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'All Statuses' },
                { id: 'dispatched', label: 'Dispatched' },
                { id: 'pending', label: 'Not Dispatched' }
              ].map(item => {
                const active = draftDispatchStatus === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setDraftDispatchStatus(item.id)}
                    className={`p-2.5 text-xs rounded-xl font-medium transition-all text-center border cursor-pointer ${
                      active 
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30 font-semibold' 
                        : 'bg-slate-900 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/80 bg-[#1e2638] flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDraftFilters}
            className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
            Reset All
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyDrawerFilters}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </aside>

      {/* Content Section */}
      {isLoading ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center text-slate-400">
          <RefreshCcw className="animate-spin mx-auto mb-3 text-purple-400" size={32} />
          <p>Loading influencer logistics...</p>
        </div>
      ) : filteredInfluencers.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center text-slate-400">
          <Package className="mx-auto mb-3 text-slate-600" size={40} />
          <h3 className="text-base font-semibold text-slate-300 mb-1">No Influencers Found</h3>
          <p className="text-sm text-slate-500">
            {searchTerm || activeFilterCount > 0
              ? 'No active influencers matched your filter criteria.'
              : 'No active influencers available in this campaign.'}
          </p>
        </div>
      ) : (
        /* Compact 3-column Grid Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredInfluencers.map((inf) => {
            const isSelected = selectedInfluencerIds.includes(String(inf.id));
            const username = getInfluencerUsername(inf);

            return (
              <div 
                key={inf.id}
                onClick={() => {
                  if (isBulkSelectMode) {
                    toggleSelectInfluencer(String(inf.id));
                  }
                }}
                className={`bg-[#0e1626]/80 hover:bg-[#111a2e] border rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 transition-colors shadow-sm ${
                  isSelected && isBulkSelectMode
                    ? 'border-purple-500 bg-purple-950/20 shadow-purple-500/10' 
                    : 'border-slate-800/90 hover:border-slate-700/80'
                } ${isBulkSelectMode ? 'cursor-pointer select-none' : ''}`}
              >
                {/* Left: Checkbox (in Bulk Select mode) + Profile Photo + Username */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {isBulkSelectMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectInfluencer(String(inf.id));
                      }}
                      className="text-purple-400 hover:text-purple-300 focus:outline-none shrink-0 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare size={19} className="text-purple-500" />
                      ) : (
                        <Square size={19} className="text-slate-500 hover:text-slate-300" />
                      )}
                    </button>
                  )}

                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center text-white font-bold text-sm sm:text-base border-2 border-purple-500/30 shrink-0 shadow-sm">
                    {inf.profile_file_url ? (
                      <img 
                        src={inf.profile_file_url} 
                        alt={inf.name || 'Influencer'} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('.fallback-initial');
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <span className={`fallback-initial ${inf.profile_file_url ? 'hidden' : ''}`}>
                      {(inf.influencer_name || inf.name || 'A').charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 
                      className="font-bold text-slate-100 text-sm sm:text-base truncate hover:text-purple-300 transition-colors"
                      title={username}
                    >
                      {username}
                    </h3>
                  </div>
                </div>

                {/* Right: Influencer Code */}
                {inf.code && (
                  <span className="px-2.5 py-1 bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-bold font-mono rounded shrink-0 shadow-sm">
                    {inf.code}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Prepare Dispatch Modal */}
      {isPrepareModalOpen && (
        <PrepareDispatchModal
          campaign={campaign}
          selectedInfluencers={selectedInfluencerObjects}
          allActiveInfluencers={activeOnly}
          onClose={() => setIsPrepareModalOpen(false)}
          onBatchesUpdated={async () => {
            await Promise.all([loadSavedBatches(), refreshDispatch()]);
          }}
        />
      )}
    </div>
  );
};

