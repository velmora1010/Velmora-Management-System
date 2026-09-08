import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { useCampaignDispatch } from '../../hooks/marketing/useCampaignDispatch';
import { useCampaignInfluencers, compareInfluencerCodesAsc } from '../../hooks/marketing/useCampaignInfluencers';
import { isActiveStatus } from '../../utils/marketingUtils';

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
  if (clean === 'karnataka') return 'Karnataka';
  if (clean === 'andhrapradesh' || clean === 'andrapradesh' || clean === 'andhra pradesh') return 'Andhra Pradesh';
  if (clean === 'madhyapradesh' || clean === 'madhya pradesh') return 'Madhya Pradesh';
  if (clean === 'uttarpradesh' || clean === 'uttar pradesh') return 'Uttar Pradesh';
  if (clean === 'maharashtra') return 'Maharashtra';
  if (clean === 'gujarat') return 'Gujarat';
  if (clean === 'rajasthan') return 'Rajasthan';
  if (clean === 'kerala') return 'Kerala';
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
  
  // Filter Dropdown Visibility
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);

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

  // Dynamic Options derived strictly from active influencers/dispatch data
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    activeOnly.forEach(inf => {
      const dispatch = getDispatchData(inf);
      const st = normalizeStateName(inf.state || dispatch?.state || '');
      if (st) set.add(st);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeOnly, dispatchRecords]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    activeOnly.forEach(inf => {
      const dispatch = getDispatchData(inf);
      const st = normalizeStateName(inf.state || dispatch?.state || '');
      
      // If a state is selected, scope cities strictly to that state
      if (selectedState && normalizeStateName(selectedState) !== st) {
        return;
      }

      const ct = (inf.city || '').trim();
      if (ct) set.add(ct);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeOnly, dispatchRecords, selectedState]);

  const availableCouriers = useMemo(() => {
    const couriers = new Set<string>(KNOWN_COURIERS);
    dispatchRecords.forEach(d => {
      if (d.courier_partner && d.courier_partner.trim()) {
        couriers.add(d.courier_partner.trim());
      }
    });
    return Array.from(couriers);
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
    return count;
  }, [selectedState, selectedCity, selectedCourier, selectedWeightRange]);

  const handleClearAllFilters = () => {
    setSelectedState('');
    setSelectedCity('');
    setSelectedCourier('all');
    setCustomCourierInput('');
    setIsAddingCustomCourier(false);
    setSelectedWeightRange('all');
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
      const city = (inf.city || '').toLowerCase();
      const courierPartner = (dispatch?.courier_partner || '').trim();

      // 1. Search Query
      const matchesSearch = !term || 
        code.includes(term) ||
        username.includes(term) ||
        name.includes(term) ||
        phone.includes(term) ||
        city.includes(term) ||
        state.toLowerCase().includes(term) ||
        courierPartner.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // 2. State Filter
      if (selectedState) {
        if (normalizeStateName(selectedState) !== state) return false;
      }

      // 3. City Filter
      if (selectedCity) {
        if (selectedCity.toLowerCase() !== city) return false;
      }

      // 4. Courier Filter
      if (selectedCourier !== 'all') {
        if (selectedCourier === 'Not Dispatched') {
          if (isInfluencerDispatched(inf, dispatchRecords)) return false;
        } else {
          if (courierPartner.toLowerCase() !== selectedCourier.toLowerCase()) return false;
        }
      }

      // 5. Weight Filter
      if (selectedWeightRange !== 'all') {
        const grams = parseWeightInGrams(dispatch?.total_weight);
        if (!matchesWeightRange(grams, selectedWeightRange)) return false;
      }

      return true;
    }).sort(compareInfluencerCodesAsc);
  }, [activeOnly, searchTerm, selectedState, selectedCity, selectedCourier, selectedWeightRange, dispatchRecords]);

  const handleRefresh = async () => {
    await Promise.all([refreshDispatch(), refreshInfluencers()]);
  };

  const handleApplyCustomCourier = () => {
    if (customCourierInput.trim()) {
      setSelectedCourier(customCourierInput.trim());
      setIsAddingCustomCourier(false);
    }
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
            className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
            title="Back to Overview"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Influencer Logistics
              <span className="text-sm font-normal text-slate-400">
                ({activeOnly.length} Active Influencers)
              </span>
            </h2>
            
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
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap relative">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search code, user, phone, city..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Filters Button & Popover */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors border flex items-center gap-2 cursor-pointer ${
                activeFilterCount > 0 
                  ? 'bg-purple-950/60 border-purple-500 text-purple-300 font-semibold' 
                  : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
              title="Filter Logistics"
            >
              <SlidersHorizontal size={15} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-purple-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Filter Dropdown Popover */}
            {isFilterDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#0c121e] border border-slate-700/90 rounded-2xl shadow-2xl p-4 z-40 animate-fade-in space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={15} className="text-purple-400" />
                    <span className="text-sm font-bold text-white">Logistics Filters</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllFilters}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw size={12} /> Clear all
                    </button>
                  )}
                </div>

                {/* 1. State Filter */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                    <MapPin size={13} className="text-purple-400" /> State
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setSelectedCity(''); // Reset city when state changes
                    }}
                    className="w-full bg-[#0b101b] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="">All States ({availableStates.length})</option>
                    {availableStates.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* 2. City Filter (Dynamically scoped to selected state) */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                    <Building size={13} className="text-purple-400" /> City
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full bg-[#0b101b] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="">All Cities ({availableCities.length})</option>
                    {availableCities.map(ct => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Courier Partner Filter */}
                <div>
                  <label className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Truck size={13} className="text-purple-400" /> Courier Partner
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomCourier(!isAddingCustomCourier)}
                      className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus size={12} /> Add +
                    </button>
                  </label>

                  {isAddingCustomCourier ? (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <input
                        type="text"
                        value={customCourierInput}
                        onChange={(e) => setCustomCourierInput(e.target.value)}
                        placeholder="Enter custom courier..."
                        className="flex-1 bg-[#0b101b] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
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
                        className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomCourier(false)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs cursor-pointer"
                      >
                        &times;
                      </button>
                    </div>
                  ) : null}

                  <select
                    value={selectedCourier}
                    onChange={(e) => setSelectedCourier(e.target.value)}
                    className="w-full bg-[#0b101b] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="all">All Couriers</option>
                    <option value="Not Dispatched">Not Dispatched</option>
                    {availableCouriers.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    {selectedCourier !== 'all' && selectedCourier !== 'Not Dispatched' && !availableCouriers.includes(selectedCourier) && (
                      <option value={selectedCourier}>{selectedCourier} (Custom)</option>
                    )}
                  </select>
                </div>

                {/* 4. Total Weight Filter */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                    <Scale size={13} className="text-purple-400" /> Total Weight
                  </label>
                  <select
                    value={selectedWeightRange}
                    onChange={(e) => setSelectedWeightRange(e.target.value)}
                    className="w-full bg-[#0b101b] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {WEIGHT_RANGES.map(w => (
                      <option key={w.id} value={w.id}>{w.label}</option>
                    ))}
                  </select>
                </div>

                {/* Popover Footer */}
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-[11px] text-slate-400">
                    Showing {filteredInfluencers.length} of {activeOnly.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen(false)}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5 text-sm cursor-pointer"
            title="Refresh logistics"
          >
            <RefreshCcw size={16} className={(isDispatchLoading || isInfluencersLoading) ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

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
                State: {selectedState}
                <button onClick={() => { setSelectedState(''); setSelectedCity(''); }} className="hover:text-white text-slate-400 cursor-pointer">&times;</button>
              </span>
            )}

            {selectedCity && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                City: {selectedCity}
                <button onClick={() => setSelectedCity('')} className="hover:text-white text-slate-400 cursor-pointer">&times;</button>
              </span>
            )}

            {selectedCourier !== 'all' && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Courier: {selectedCourier}
                <button onClick={() => setSelectedCourier('all')} className="hover:text-white text-slate-400 cursor-pointer">&times;</button>
              </span>
            )}

            {selectedWeightRange !== 'all' && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Weight: {WEIGHT_RANGES.find(w => w.id === selectedWeightRange)?.label || selectedWeightRange}
                <button onClick={() => setSelectedWeightRange('all')} className="hover:text-white text-slate-400 cursor-pointer">&times;</button>
              </span>
            )}
          </div>

          <button 
            type="button"
            onClick={handleClearAllFilters} 
            className="text-purple-400 hover:text-purple-300 underline font-semibold ml-2 text-xs cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

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
            const isDispatched = isInfluencerDispatched(inf, dispatchRecords);
            const username = getInfluencerUsername(inf);

            return (
              <div 
                key={inf.id}
                className="bg-[#0e1626]/80 hover:bg-[#111a2e] border border-slate-800/90 hover:border-slate-700/80 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 transition-colors shadow-sm"
              >
                {/* Left: Profile Photo & Influencer Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
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
                    <div className="flex items-center gap-2">
                      <h3 
                        className="font-bold text-slate-100 text-sm sm:text-base truncate hover:text-purple-300 transition-colors"
                        title={username}
                      >
                        {username}
                      </h3>
                      {inf.code && (
                        <span className="px-2 py-0.5 bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-bold font-mono rounded shrink-0 shadow-sm">
                          {inf.code}
                        </span>
                      )}
                    </div>

                    {/* Dispatched Badge (Subtle, green, strictly no active online dot) */}
                    {isDispatched && (
                      <div className="mt-1 flex items-center">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                          Dispatched
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Action Button */}
                <div className="shrink-0">
                  {isDispatched ? (
                    <button 
                      type="button"
                      onClick={() => onDispatch?.(inf)} 
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shrink-0 shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      View Dispatch
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => onDispatch?.(inf)} 
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors shrink-0 shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      Dispatch
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

