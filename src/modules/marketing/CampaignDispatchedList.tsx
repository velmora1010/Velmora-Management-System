import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { 
  Search, 
  Package, 
  RefreshCcw, 
  ArrowLeft, 
  SlidersHorizontal, 
  X, 
  Truck, 
  Scale, 
  MapPin, 
  Building, 
  RotateCcw, 
  CheckSquare, 
  Square, 
  Users, 
  AlertCircle, 
  Check, 
  ArrowRight,
  Eye,
  ChevronDown,
  Clock,
  Calendar,
  Layers,
  MoreVertical,
  Tag,
  User,
  Hash
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCampaignDispatch } from '../../hooks/marketing/useCampaignDispatch';
import { useCampaignInfluencers, compareInfluencerCodesAsc } from '../../hooks/marketing/useCampaignInfluencers';
import { isActiveStatus } from '../../utils/marketingUtils';
import { 
  getUniqueFilterOptions, 
  areFilterValuesEqual 
} from '../../utils/filterUtils';
import { 
  getAllIndianStates, 
  getIndianCitiesForState, 
  MASTER_LOCATIONS, 
  STATE_ALIASES 
} from '../../data/indiaLocations';
import { parseInfluencerCodeRanges, type RangeParseResult } from '../../utils/influencerRangeParser';
import { logisticsWorkflowService } from '../../services/logisticsWorkflowService';
import { 
  dispatchBatchService, 
  formatBatchDateTime, 
  type DispatchBatch 
} from '../../services/dispatchBatchService';
import { DispatchInfluencerModal } from './DispatchInfluencerModal';

export type LogisticsTab = 'logistics' | 'prepare_dispatch' | 'dispatched';

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
  
  for (const [key, stateObj] of Object.entries(MASTER_LOCATIONS)) {
    if (key === clean || stateObj.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean) {
      return stateObj.name;
    }
  }

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

export const isInfluencerInPrepareDispatch = (inf: CampaignInfluencer, dispatchRecords: any[]): boolean => {
  const dispatch = inf.dispatchDetails || dispatchRecords.find(d => String(d.influencer_id) === String(inf.id));
  if (!dispatch) return false;
  const status = (dispatch.dispatch_status || '').trim().toLowerCase();
  return status === 'prepare_dispatch' || status === 'ready to dispatch';
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

  // Workflow Tab Navigation ('logistics' | 'prepare_dispatch' | 'dispatched')
  const [currentTab, setCurrentTab] = useState<LogisticsTab>('logistics');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCourier, setSelectedCourier] = useState('all');
  const [customCourierInput, setCustomCourierInput] = useState('');
  const [isAddingCustomCourier, setIsAddingCustomCourier] = useState(false);
  const [selectedWeightRange, setSelectedWeightRange] = useState('all');
  const [selectedDispatchStatus, setSelectedDispatchStatus] = useState('all');
  
  // Slide-over Filter Drawer State
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [draftState, setDraftState] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftCourier, setDraftCourier] = useState('all');
  const [draftWeightRange, setDraftWeightRange] = useState('all');
  const [draftDispatchStatus, setDraftDispatchStatus] = useState('all');

  // Bulk Selection & Prepare Dispatch State
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
  const [selectedInfluencerIds, setSelectedInfluencerIds] = useState<string[]>([]);
  const [rangeInput, setRangeInput] = useState('');
  const [rangeFeedback, setRangeFeedback] = useState<RangeParseResult | null>(null);
  const [isMovingToPrepare, setIsMovingToPrepare] = useState(false);

  // Batch-based Prepare Dispatch State
  const [savedBatches, setSavedBatches] = useState<DispatchBatch[]>([]);
  const [openBatchIds, setOpenBatchIds] = useState<string[]>([]);
  const [activeMenuBatchId, setActiveMenuBatchId] = useState<string | null>(null);

  // Batch-level dispatch queue state
  const [batchDispatchContext, setBatchDispatchContext] = useState<{
    batch: DispatchBatch;
    pendingInfluencers: CampaignInfluencer[];
    currentIndex: number;
  } | null>(null);

  // Local fallback for dispatch modal (when clicking Dispatch or View Dispatch)
  const [localDispatchInfluencer, setLocalDispatchInfluencer] = useState<CampaignInfluencer | null>(null);

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

  // Strictly enforce Active influencers (never Eliminated or Recycle Bin)
  const activeOnly = useMemo(() => {
    return baseInfluencers.filter(inf => isActiveStatus(inf.is_archived));
  }, [baseInfluencers]);

  // Active influencer lookup map by ID
  const activeInfluencersMap = useMemo(() => {
    const map = new Map<string, CampaignInfluencer>();
    activeOnly.forEach(inf => {
      map.set(String(inf.id), inf);
    });
    return map;
  }, [activeOnly]);

  const getDispatchData = useCallback((inf: CampaignInfluencer) => {
    return inf.dispatchDetails || dispatchRecords.find(d => String(d.influencer_id) === String(inf.id));
  }, [dispatchRecords]);

  const getInfluencerUsername = (inf: CampaignInfluencer): string => {
    const platformUser = inf.platforms?.find(p => p.username && p.username.trim())?.username?.trim();
    const raw = platformUser || inf.influencer_name?.trim() || (inf as any).username?.trim() || inf.name?.trim() || '';
    if (!raw) return '—';
    const clean = raw.replace(/^@+/, '');
    return `@${clean}`;
  };

  // Master Indian States + active campaign influencer states
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
  }, [activeOnly, getDispatchData]);

  // Master Indian Cities scoped to draftState + influencer cities
  const draftAvailableCities = useMemo(() => {
    const rawList: string[] = [...getIndianCitiesForState(draftState)];
    activeOnly.forEach(inf => {
      const dispatch = getDispatchData(inf);
      const infState = normalizeStateName(inf.state || dispatch?.state || '');
      
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
  }, [activeOnly, getDispatchData, draftState]);

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

  // 1. Partition active influencers into the 3 workflow stages
  const dispatchedInfluencers = useMemo(() => {
    return activeOnly.filter(inf => isInfluencerDispatched(inf, dispatchRecords));
  }, [activeOnly, dispatchRecords]);

  const prepareDispatchInfluencers = useMemo(() => {
    return activeOnly.filter(inf => !isInfluencerDispatched(inf, dispatchRecords) && isInfluencerInPrepareDispatch(inf, dispatchRecords));
  }, [activeOnly, dispatchRecords]);

  const logisticsInfluencers = useMemo(() => {
    return activeOnly.filter(inf => !isInfluencerDispatched(inf, dispatchRecords) && !isInfluencerInPrepareDispatch(inf, dispatchRecords));
  }, [activeOnly, dispatchRecords]);

  // Auto-synthesize an initial batch for any influencers already in prepare_dispatch without a batch
  useEffect(() => {
    if (prepareDispatchInfluencers.length > 0 && savedBatches.length === 0) {
      const now = new Date();
      const { displayDate, displayTime } = formatBatchDateTime(now);
      const initialBatch: DispatchBatch = {
        id: `batch-${Date.now()}`,
        campaign_id: String(campaign.id),
        batch_name: 'BATCH-001',
        dispatch_date: displayDate,
        dispatch_time: displayTime,
        status: 'Preparing',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        created_by: 'Admin',
        members: prepareDispatchInfluencers.map(inf => ({
          influencer_id: String(inf.id),
          influencer_code: inf.code || '',
          creator_name: inf.influencer_name || inf.name || '',
          profile_file_url: inf.profile_file_url,
          dispatch_status: 'Pending'
        }))
      };
      setSavedBatches([initialBatch]);
      dispatchBatchService.saveBatches(campaign.id, [initialBatch]);
    }
  }, [prepareDispatchInfluencers, savedBatches, campaign.id]);

  // Counts for summary pills
  const activeCount = activeOnly.length;
  const dispatchedCount = dispatchedInfluencers.length;
  const pendingCount = logisticsInfluencers.length;

  // Selected influencer objects (strictly active & in Logistics)
  const selectedInfluencerObjects = useMemo(() => {
    const idSet = new Set(selectedInfluencerIds);
    return logisticsInfluencers.filter(inf => idSet.has(String(inf.id)));
  }, [selectedInfluencerIds, logisticsInfluencers]);

  // Compact code summary formatted with dots (e.g. HIS1 · HIS2 · HIS3 · HIS4 · HIS5)
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
    if (!newState) return;
    
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

  // Helper filter function for an influencer against search & active filters
  const matchesFilterCriteria = useCallback((inf: CampaignInfluencer): boolean => {
    const term = searchTerm.trim().toLowerCase();
    const dispatch = getDispatchData(inf);
    const username = getInfluencerUsername(inf).toLowerCase();
    const code = (inf.code || '').toLowerCase();
    const name = (inf.name || inf.influencer_name || '').toLowerCase();
    const phone = (inf.phone_number || dispatch?.phone_number || '').toLowerCase();
    const state = normalizeStateName(inf.state || dispatch?.state || '');
    const city = (inf.city || '').trim();
    const courierPartner = (dispatch?.courier_partner || '').trim();

    // Search query
    const matchesSearch = !term || 
      code.includes(term) ||
      username.includes(term) ||
      name.includes(term) ||
      phone.includes(term) ||
      city.toLowerCase().includes(term) ||
      state.toLowerCase().includes(term) ||
      courierPartner.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    // State filter
    if (selectedState && !areFilterValuesEqual(selectedState, state)) return false;

    // City filter
    if (selectedCity && !areFilterValuesEqual(selectedCity, city)) return false;

    // Courier filter
    if (selectedCourier !== 'all') {
      if (selectedCourier === 'Not Dispatched') {
        if (isInfluencerDispatched(inf, dispatchRecords)) return false;
      } else {
        if (!areFilterValuesEqual(selectedCourier, courierPartner)) return false;
      }
    }

    // Weight filter
    if (selectedWeightRange !== 'all') {
      const grams = parseWeightInGrams(dispatch?.total_weight);
      if (!matchesWeightRange(grams, selectedWeightRange)) return false;
    }

    // Dispatch status filter
    if (selectedDispatchStatus !== 'all') {
      const isDispatched = isInfluencerDispatched(inf, dispatchRecords);
      if (selectedDispatchStatus === 'dispatched' && !isDispatched) return false;
      if (selectedDispatchStatus === 'pending' && isDispatched) return false;
    }

    return true;
  }, [searchTerm, selectedState, selectedCity, selectedCourier, selectedWeightRange, selectedDispatchStatus, getDispatchData, dispatchRecords]);

  // Filtered logistics list
  const filteredLogisticsList = useMemo(() => {
    return logisticsInfluencers.filter(matchesFilterCriteria);
  }, [logisticsInfluencers, matchesFilterCriteria]);

  // Filtered dispatched list
  const filteredDispatchedList = useMemo(() => {
    return dispatchedInfluencers.filter(matchesFilterCriteria);
  }, [dispatchedInfluencers, matchesFilterCriteria]);

  // Selection sorting behavior for Logistics:
  // When selection is active, selected influencers automatically appear FIRST!
  // When selection is cleared, normal ascending order is restored.
  const selectedLogisticsList = useMemo(() => {
    if (currentTab !== 'logistics' || !isBulkSelectMode || selectedInfluencerIds.length === 0) {
      return [];
    }
    const idSet = new Set(selectedInfluencerIds);
    return filteredLogisticsList
      .filter(inf => idSet.has(String(inf.id)))
      .sort(compareInfluencerCodesAsc);
  }, [currentTab, isBulkSelectMode, selectedInfluencerIds, filteredLogisticsList]);

  const unselectedLogisticsList = useMemo(() => {
    if (currentTab !== 'logistics' || !isBulkSelectMode || selectedInfluencerIds.length === 0) {
      return filteredLogisticsList.slice().sort(compareInfluencerCodesAsc);
    }
    const idSet = new Set(selectedInfluencerIds);
    return filteredLogisticsList
      .filter(inf => !idSet.has(String(inf.id)))
      .sort(compareInfluencerCodesAsc);
  }, [currentTab, isBulkSelectMode, selectedInfluencerIds, filteredLogisticsList]);

  // Selection toggles
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

    // Parse against active logistics influencers (ignoring eliminated/recycled)
    const result = parseInfluencerCodeRanges(rangeInput, logisticsInfluencers, baseInfluencers);
    setRangeFeedback(result);

    if (result.selectedInfluencerIds.length > 0) {
      setSelectedInfluencerIds(prev => {
        const combined = new Set([...prev, ...result.selectedInfluencerIds]);
        return Array.from(combined);
      });
    }
  };

  // Action: Move Selected Influencers to Prepare Dispatch (Creates ONE Batch)
  const handleMoveToPrepareDispatch = async () => {
    if (selectedInfluencerObjects.length === 0) return;
    setIsMovingToPrepare(true);
    try {
      const res = await logisticsWorkflowService.moveToPrepareDispatch(campaign, selectedInfluencerObjects);
      if (res.success) {
        const batchName = res.batch?.batch_name || 'New Batch';
        toast.success(`Created ${batchName} with ${res.count} influencer${res.count === 1 ? '' : 's'}`);
        setSelectedInfluencerIds([]);
        setRangeInput('');
        setRangeFeedback(null);
        setIsBulkSelectMode(false);
        await Promise.all([refreshDispatch(), refreshInfluencers(), loadSavedBatches()]);
        if (res.batch?.id) {
          setOpenBatchIds([res.batch.id]);
        }
        setCurrentTab('prepare_dispatch');
      } else {
        toast.error(res.error || 'Failed to move influencers to Prepare Dispatch');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while moving influencers');
    } finally {
      setIsMovingToPrepare(false);
    }
  };

  // Action: Return an influencer from Prepare Dispatch back to Logistics
  const handleReturnToLogistics = async (influencerId: string) => {
    try {
      const res = await logisticsWorkflowService.returnToLogistics(String(campaign.id), influencerId);
      if (res.success) {
        toast.success('Influencer returned to Logistics');
        await Promise.all([refreshDispatch(), refreshInfluencers(), loadSavedBatches()]);
      } else {
        toast.error(res.error || 'Failed to return influencer to Logistics');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error returning to logistics');
    }
  };

  // Dispatch Action: Open modal for dispatch preparation or viewing
  const handleDispatchClick = (inf: CampaignInfluencer) => {
    if (onDispatch) {
      onDispatch(inf);
    } else {
      setLocalDispatchInfluencer(inf);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refreshDispatch(), refreshInfluencers(), loadSavedBatches()]);
  };

  const toggleBatchOpen = (batchId: string) => {
    setOpenBatchIds(prev => 
      prev.includes(batchId) ? prev.filter(id => id !== batchId) : [...prev, batchId]
    );
  };

  // Batches processed with active-only filter
  const processedBatches = useMemo(() => {
    return savedBatches.map(batch => {
      // All members currently active in the campaign
      const allActiveMembersInBatch = batch.members
        .map(m => activeInfluencersMap.get(String(m.influencer_id)))
        .filter((inf): inf is CampaignInfluencer => Boolean(inf));

      // Filtered active members matching search / filters
      const activeMembers = allActiveMembersInBatch.filter(matchesFilterCriteria);

      const totalMembers = allActiveMembersInBatch.length;
      const dispatchedInBatch = allActiveMembersInBatch.filter(inf => isInfluencerDispatched(inf, dispatchRecords)).length;
      const isBatchDispatched = totalMembers > 0 && dispatchedInBatch === totalMembers;
      const dispatchPercentage = totalMembers > 0 ? Math.round((dispatchedInBatch / totalMembers) * 100) : 0;

      // Codes list for summary formatted with bullet separator
      const codes = allActiveMembersInBatch
        .map(inf => inf.code)
        .filter(Boolean) as string[];

      let codesSummary = '';
      if (codes.length > 0) {
        if (codes.length <= 6) {
          codesSummary = codes.join(' • ');
        } else {
          codesSummary = `${codes.slice(0, 6).join(' • ')} • +${codes.length - 6} more`;
        }
      }

      return {
        batch,
        allActiveMembersInBatch,
        activeMembers,
        totalMembers,
        dispatchedInBatch,
        isBatchDispatched,
        dispatchPercentage,
        codesSummary,
      };
    }).filter(b => b.totalMembers > 0); // Exclude empty batches
  }, [savedBatches, activeInfluencersMap, matchesFilterCriteria, dispatchRecords]);

  // Total influencers across all batches in Prepare Dispatch
  const totalInfluencersInBatches = useMemo(() => {
    const idSet = new Set<string>();
    processedBatches.forEach(b => {
      b.allActiveMembersInBatch.forEach(inf => {
        idSet.add(String(inf.id));
      });
    });
    return idSet.size;
  }, [processedBatches]);

  // Handler to start batch dispatch workflow
  const handleStartBatchDispatch = (batch: DispatchBatch, allMembers: CampaignInfluencer[]) => {
    const pendingMembers = allMembers.filter(inf => !isInfluencerDispatched(inf, dispatchRecords));
    if (pendingMembers.length === 0) {
      toast.success(`All influencers in ${batch.batch_name} have already been dispatched!`);
      return;
    }

    setBatchDispatchContext({
      batch,
      pendingInfluencers: pendingMembers,
      currentIndex: 0
    });
    setLocalDispatchInfluencer(pendingMembers[0]);
  };

  // Handler to return all pending influencers in a batch back to Logistics
  const handleReturnBatchToLogistics = async (batch: DispatchBatch) => {
    if (!window.confirm(`Are you sure you want to return all pending influencers in ${batch.batch_name} back to Logistics?`)) {
      return;
    }
    try {
      for (const member of batch.members) {
        const inf = activeInfluencersMap.get(String(member.influencer_id));
        if (inf && !isInfluencerDispatched(inf, dispatchRecords)) {
          await logisticsWorkflowService.returnToLogistics(String(campaign.id), String(member.influencer_id));
        }
      }
      await Promise.all([refreshDispatch(), refreshInfluencers(), loadSavedBatches()]);
      toast.success(`Returned pending influencers in ${batch.batch_name} to Logistics`);
    } catch (err) {
      console.error('Failed to return batch to logistics:', err);
      toast.error('Failed to return batch to logistics');
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
            onClick={() => {
              if (currentTab !== 'logistics') {
                setCurrentTab('logistics');
              } else {
                onBack();
              }
            }}
            className="p-2 hover:bg-slate-700/80 rounded-xl transition-colors text-slate-400 hover:text-slate-200 cursor-pointer"
            title={currentTab !== 'logistics' ? 'Back to Logistics' : 'Back to Campaign'}
          >
            <ArrowLeft size={20} />
          </button>
          
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Package className="text-purple-400" size={22} />
              <h2 className="text-lg font-bold text-slate-100">
                Influencer Logistics ({activeCount} Active Influencers)
              </h2>
            </div>
            
            {/* Summary Pills: Active, Dispatched, Pending */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="px-2 py-0.5 bg-slate-900/90 text-slate-300 border border-slate-700/80 rounded-md text-[11px] font-medium">
                Active: <strong className="text-slate-100">{activeCount}</strong>
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

        {/* Right Header Controls: [ Search ] [ Filter Icon ] [ Bulk Select ] [ Prepare Dispatch ] [ Dispatched ] [ Refresh Icon ] */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 md:w-48">
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

          {/* Bulk Select Button (TEXT + selected count when applicable) */}
          <button
            type="button"
            onClick={() => {
              if (currentTab !== 'logistics') {
                setCurrentTab('logistics');
                setIsBulkSelectMode(true);
              } else {
                setIsBulkSelectMode(prev => !prev);
              }
            }}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              isBulkSelectMode && currentTab === 'logistics'
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
            }`}
            title="Bulk Select"
          >
            {isBulkSelectMode && currentTab === 'logistics' ? <Check size={15} className="text-white" /> : <CheckSquare size={15} />}
            <span>Bulk Select</span>
            {selectedInfluencerObjects.length > 0 && currentTab === 'logistics' && (
              <span className="bg-white text-purple-900 text-[11px] font-extrabold rounded-full px-1.5 py-0.2 ml-0.5">
                {selectedInfluencerObjects.length}
              </span>
            )}
          </button>

          {/* Prepare Dispatch Destination Navigation Button */}
          <button
            type="button"
            onClick={() => {
              if (currentTab === 'prepare_dispatch') {
                setCurrentTab('logistics');
              } else {
                setCurrentTab('prepare_dispatch');
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border flex items-center gap-2 cursor-pointer ${
              currentTab === 'prepare_dispatch'
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
            }`}
            title="Prepare Dispatch"
          >
            <Truck size={16} className={currentTab === 'prepare_dispatch' ? 'text-white' : 'text-purple-400'} />
            <span>Prepare Dispatch</span>
            {(totalInfluencersInBatches > 0 || prepareDispatchInfluencers.length > 0) && (
              <span className={`text-[11px] font-extrabold rounded-full px-2 py-0.5 leading-none ${
                currentTab === 'prepare_dispatch'
                  ? 'bg-purple-950 text-white border border-purple-400/30 shadow-inner'
                  : 'bg-purple-950/90 text-purple-300 border border-purple-800/60'
              }`}>
                {totalInfluencersInBatches > 0 ? totalInfluencersInBatches : prepareDispatchInfluencers.length}
              </span>
            )}
          </button>

          {/* Dispatched Destination Navigation Button */}
          <button
            type="button"
            onClick={() => {
              if (currentTab === 'dispatched') {
                setCurrentTab('logistics');
              } else {
                setCurrentTab('dispatched');
              }
            }}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'dispatched'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
            }`}
            title="Dispatched"
          >
            <Check size={15} className={currentTab === 'dispatched' ? 'text-white' : 'text-emerald-400'} />
            <span>Dispatched</span>
            {dispatchedInfluencers.length > 0 && (
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold rounded-full px-1.5 py-0.2">
                {dispatchedInfluencers.length}
              </span>
            )}
          </button>

          {/* Refresh Button */}
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

      {/* DEDICATED PREPARE DISPATCH BANNER (Visible in Logistics when influencers are selected) */}
      {currentTab === 'logistics' && selectedInfluencerObjects.length > 0 && (
        <div className="bg-[#121929] border border-purple-600/40 rounded-2xl p-5 sm:p-6 shadow-xl shadow-purple-950/20 animate-fade-in flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded bg-purple-600/20 border border-purple-500/30 text-purple-300 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Truck size={12} className="text-purple-400" />
                PREPARE DISPATCH BATCH
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
                {selectedInfluencerObjects.length} {selectedInfluencerObjects.length === 1 ? 'influencer' : 'influencers'} selected for Batch
              </h3>
            </div>

            {selectedCodesSummary && (
              <p className="text-xs sm:text-sm font-mono font-semibold text-purple-300 break-words pt-0.5 tracking-wide">
                {selectedCodesSummary}
              </p>
            )}

            <p className="text-xs text-slate-400 pt-0.5">
              Clicking "Move to Prepare Dispatch" will create ONE new batch for this selection. They will disappear from Logistics and appear in Prepare Dispatch.
            </p>
          </div>

          {/* Move to Prepare Dispatch CTA */}
          <div className="shrink-0 w-full md:w-auto flex justify-end">
            <button
              type="button"
              onClick={handleMoveToPrepareDispatch}
              disabled={isMovingToPrepare}
              className="w-full md:w-auto px-6 py-3.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isMovingToPrepare ? (
                <>
                  <RefreshCcw size={16} className="animate-spin" />
                  <span>Creating Batch...</span>
                </>
              ) : (
                <>
                  <span>Move to Prepare Dispatch</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Prepare Dispatch Tab Header Banner & KPI Cards */}
      {currentTab === 'prepare_dispatch' && (
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-sm animate-fade-in">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/80 border border-purple-800/60 text-purple-300 text-[10px] font-extrabold uppercase tracking-wider">
              <Layers size={12} className="text-purple-400" />
              <span>PREPARE DISPATCH</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Dispatch Preparation Batches
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Influencers grouped into dispatch batches. Click on a batch to view influencers and complete dispatch.
            </p>
          </div>

          {/* Two compact KPI cards on the right */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Total Batches KPI */}
            <div className="flex-1 sm:flex-initial sm:min-w-[150px] bg-[#121929] border border-slate-800/90 rounded-xl p-3.5 sm:p-4 flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400 shrink-0">
                <Package size={20} />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400">Total Batches</div>
                <div className="text-xl font-bold text-white leading-tight mt-0.5">{processedBatches.length}</div>
              </div>
            </div>

            {/* Total Influencers KPI */}
            <div className="flex-1 sm:flex-initial sm:min-w-[150px] bg-[#121929] border border-slate-800/90 rounded-xl p-3.5 sm:p-4 flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400 shrink-0">
                <Users size={20} />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400">Total Influencers</div>
                <div className="text-xl font-bold text-white leading-tight mt-0.5">{totalInfluencersInBatches}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispatched Tab Header Banner */}
      {currentTab === 'dispatched' && (
        <div className="bg-[#0f1d1c] border border-emerald-600/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in shadow-lg shadow-emerald-950/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Check size={12} className="text-emerald-400" />
                DISPATCHED
              </span>
              <span className="text-xs text-emerald-300 font-semibold">
                {filteredDispatchedList.length} {filteredDispatchedList.length === 1 ? 'influencer' : 'influencers'} confirmed
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 mt-1">Dispatched Shipments</h3>
            <p className="text-xs text-slate-400">
              Active campaign influencers with confirmed dispatch. View tracking, courier, and shipping information.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentTab('logistics')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <ArrowLeft size={14} />
            <span>Back to Logistics</span>
          </button>
        </div>
      )}

      {/* Range Input Bar (When Bulk Select is active in Logistics) */}
      {currentTab === 'logistics' && isBulkSelectMode && (
        <div className="bg-[#141a29] border border-slate-800 rounded-2xl p-4 sm:p-4.5 space-y-2.5 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Users size={15} className="text-purple-400" />
              <span>Range & Code Selection:</span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Enter single codes or ranges separated by commas (e.g. HIS1 - HIS5, HIS7, TNS20 - TNS25)
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

      {/* Slide-over Filter Drawer */}
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
        {/* Drawer Header */}
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

        {/* Drawer Scrollable Body */}
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
                onClick={() => setIsAddingCustomCourier(prev => !prev)}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
              >
                {isAddingCustomCourier ? 'Choose from list' : '+ Other Courier'}
              </button>
            </div>

            {isAddingCustomCourier ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCourierInput}
                    onChange={(e) => setCustomCourierInput(e.target.value)}
                    placeholder="Enter custom courier name..."
                    className="flex-1 p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
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
                    disabled={!customCourierInput.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Set
                  </button>
                </div>
                {draftCourier && draftCourier !== 'all' && (
                  <p className="text-[11px] text-purple-300">
                    Current selection: <span className="font-semibold">{draftCourier}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDraftCourier('all')}
                  className={`p-2.5 rounded-lg border text-xs text-left transition-colors cursor-pointer ${
                    draftCourier === 'all'
                      ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  All Couriers
                </button>
                {availableCouriers.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraftCourier(c)}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-colors truncate cursor-pointer ${
                      areFilterValuesEqual(draftCourier, c)
                        ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-semibold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                    title={c}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <hr className="border-slate-800" />

          {/* TOTAL WEIGHT RANGE */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Total Weight</span>
            <div className="grid grid-cols-2 gap-2">
              {WEIGHT_RANGES.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setDraftWeightRange(w.id)}
                  className={`p-2.5 rounded-lg border text-xs text-left transition-colors cursor-pointer ${
                    draftWeightRange === w.id
                      ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* DISPATCH STATUS */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Dispatch Status</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'All' },
                { id: 'dispatched', label: 'Dispatched' },
                { id: 'pending', label: 'Pending' }
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setDraftDispatchStatus(s.id)}
                  className={`p-2.5 rounded-lg border text-xs text-center transition-colors cursor-pointer ${
                    draftDispatchStatus === s.id
                      ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-700/80 bg-[#1e2638] flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDraftFilters}
            className="text-xs text-slate-400 hover:text-slate-200 font-semibold cursor-pointer"
          >
            Reset Filters
          </button>
          <div className="flex gap-2">
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

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center text-slate-400">
          <RefreshCcw className="animate-spin mx-auto mb-3 text-purple-400" size={32} />
          <p>Loading influencer logistics...</p>
        </div>
      ) : currentTab === 'prepare_dispatch' ? (
        /* ==================== PREPARE DISPATCH BATCH-BASED VIEW ==================== */
        processedBatches.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center text-slate-400">
            <Layers className="mx-auto mb-3 text-purple-400/50" size={42} />
            <h3 className="text-base font-semibold text-slate-200 mb-1">No Prepare Dispatch Batches</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {searchTerm || activeFilterCount > 0
                ? 'No batches match your filter criteria.'
                : 'Select active influencers from the Logistics section and click "Move to Prepare Dispatch" to create a new batch.'}
            </p>
            <button
              type="button"
              onClick={() => setCurrentTab('logistics')}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-purple-400 text-xs font-semibold rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Go to Active Logistics</span>
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {processedBatches.map(({ 
              batch, 
              allActiveMembersInBatch, 
              activeMembers, 
              totalMembers, 
              dispatchedInBatch, 
              isBatchDispatched, 
              dispatchPercentage, 
              codesSummary 
            }) => {
              const isOpen = openBatchIds.includes(batch.id);
              const createdBy = batch.created_by || 'Admin';

              return (
                <div 
                  key={batch.id} 
                  className={`bg-[#0c1322] border rounded-2xl p-5 sm:p-6 shadow-md transition-all space-y-4 ${
                    isOpen ? 'border-purple-600/70 bg-[#0d1527]' : 'border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  {/* Top Row: Batch ID, Status Pill, Three Dots Menu */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Batch Code Badge */}
                      <span className="px-3 py-1 rounded-lg bg-purple-600 text-white font-extrabold font-mono text-xs sm:text-sm tracking-wider shadow-sm">
                        {batch.batch_name}
                      </span>

                      {/* Dynamic Status Pill */}
                      {isBatchDispatched ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1.5 shadow-sm">
                          <Check size={13} className="text-emerald-400" />
                          <span>Dispatched</span>
                        </span>
                      ) : dispatchedInBatch > 0 ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/60 flex items-center gap-1.5 shadow-sm">
                          <Clock size={13} className="text-blue-400" />
                          <span>Partially Dispatched ({dispatchedInBatch}/{totalMembers})</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/60 flex items-center gap-1.5 shadow-sm">
                          <Clock size={13} className="text-purple-400" />
                          <span>Preparing</span>
                        </span>
                      )}
                    </div>

                    {/* Three Dots Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuBatchId(activeMenuBatchId === batch.id ? null : batch.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                        title="Batch options"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {activeMenuBatchId === batch.id && (
                        <div 
                          className="absolute right-0 top-8 z-30 w-52 bg-[#141b2c] border border-slate-700/90 rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 animate-fade-in"
                          onMouseLeave={() => setActiveMenuBatchId(null)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              toggleBatchOpen(batch.id);
                              setActiveMenuBatchId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-slate-800/80 flex items-center gap-2.5 cursor-pointer"
                          >
                            <Users size={14} className="text-slate-400" />
                            <span>{isOpen ? 'Collapse Influencers' : 'View Influencers'}</span>
                          </button>

                          {!isBatchDispatched && (
                            <button
                              type="button"
                              onClick={() => {
                                handleStartBatchDispatch(batch, allActiveMembersInBatch);
                                setActiveMenuBatchId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-purple-900/30 text-purple-300 flex items-center gap-2.5 cursor-pointer"
                            >
                              <Truck size={14} className="text-purple-400" />
                              <span>Dispatch Batch</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const codesStr = allActiveMembersInBatch.map(m => m.code).filter(Boolean).join(', ');
                              navigator.clipboard.writeText(codesStr);
                              toast.success(`Copied ${allActiveMembersInBatch.length} codes to clipboard`);
                              setActiveMenuBatchId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-slate-800/80 flex items-center gap-2.5 cursor-pointer"
                          >
                            <Hash size={14} className="text-slate-400" />
                            <span>Copy Codes ({allActiveMembersInBatch.length})</span>
                          </button>

                          <hr className="my-1 border-slate-800" />

                          <button
                            type="button"
                            onClick={() => {
                              handleReturnBatchToLogistics(batch);
                              setActiveMenuBatchId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-rose-950/40 text-rose-400 flex items-center gap-2.5 cursor-pointer"
                          >
                            <RotateCcw size={14} className="text-rose-400" />
                            <span>Return All to Logistics</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metadata Row: Created Date, Time, Created By, Codes */}
                  <div className="flex items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 flex-wrap pt-0.5">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-500" />
                      <span>Created:</span>
                      <strong className="text-slate-200 font-medium">{batch.dispatch_date}</strong>
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-500" />
                      <span>Time:</span>
                      <strong className="text-slate-200 font-medium">{batch.dispatch_time}</strong>
                    </span>

                    <span className="flex items-center gap-1.5">
                      <User size={13} className="text-slate-500" />
                      <span>Created by:</span>
                      <strong className="text-slate-200 font-medium">{createdBy}</strong>
                    </span>

                    {codesSummary && (
                      <span className="flex items-center gap-1.5 font-mono text-purple-300/90 break-words">
                        <Tag size={13} className="text-purple-400" />
                        <span>Codes:</span>
                        <strong className="text-purple-300 font-semibold">{codesSummary}</strong>
                      </span>
                    )}
                  </div>

                  {/* Main Card Body: Left Column (Influencer Preview) & Right Column (Progress + Actions) */}
                  <div className="pt-2 flex flex-col md:flex-row items-stretch justify-between gap-6">
                    {/* LEFT COLUMN: Influencers Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                        Influencers ({totalMembers})
                      </div>

                      {totalMembers <= 4 ? (
                        /* Small Batch Preview: Individual Cards */
                        <div className="flex items-center gap-3 flex-wrap">
                          {allActiveMembersInBatch.map(inf => {
                            const username = getInfluencerUsername(inf);
                            return (
                              <div 
                                key={inf.id}
                                className="flex items-center gap-2 bg-[#121929]/80 border border-slate-800/80 rounded-xl px-2.5 py-1.5 shadow-sm"
                              >
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center text-white font-bold text-xs border-2 border-purple-500/40 shrink-0">
                                  {inf.profile_file_url ? (
                                    <img src={inf.profile_file_url} alt={username} className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{(inf.name || username).charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="min-w-0 max-w-[110px]">
                                  <div className="text-xs font-bold text-slate-100 truncate" title={username}>
                                    {username}
                                  </div>
                                  <span className="inline-block text-[10px] font-mono font-semibold text-purple-300 bg-purple-950/80 border border-purple-800/60 px-1.5 py-0.2 rounded mt-0.5">
                                    {inf.code || '—'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {/* Total Pill */}
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium pl-1">
                            <span className="w-8 h-8 rounded-full bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-[11px] font-bold text-slate-300">
                              +0
                            </span>
                            <span>{totalMembers} total</span>
                          </div>
                        </div>
                      ) : (
                        /* Large Batch Preview: Overlapping Avatar Cluster + Badge */
                        <div className="flex items-center gap-3 pt-1 flex-wrap">
                          <div className="flex items-center -space-x-3 overflow-hidden py-1 pl-1">
                            {allActiveMembersInBatch.slice(0, 7).map((inf, idx) => {
                              const username = getInfluencerUsername(inf);
                              return (
                                <div 
                                  key={inf.id} 
                                  className="relative w-10 h-10 rounded-full border-2 border-[#0c1322] ring-2 ring-purple-600/40 overflow-hidden bg-purple-700 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                                  style={{ zIndex: 10 - idx }}
                                  title={`${username} (${inf.code})`}
                                >
                                  {inf.profile_file_url ? (
                                    <img src={inf.profile_file_url} alt={username} className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{(inf.name || username).charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                              );
                            })}
                            {totalMembers > 7 && (
                              <div 
                                className="relative w-10 h-10 rounded-full bg-slate-800 border-2 border-[#0c1322] ring-2 ring-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0 shadow-sm z-0"
                              >
                                +{totalMembers - 7}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-300">
                            {totalMembers} total
                          </span>
                        </div>
                      )}
                    </div>

                    {/* RIGHT COLUMN: Progress + Action Buttons */}
                    <div className="w-full md:w-80 lg:w-96 shrink-0 md:border-l md:border-slate-800/80 md:pl-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                          <span>{dispatchedInBatch} / {totalMembers} Dispatched</span>
                          <span className="font-mono text-purple-300">{dispatchPercentage}%</span>
                        </div>

                        <div className="w-full bg-slate-800/90 h-2.5 rounded-full overflow-hidden my-2.5">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isBatchDispatched 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                                : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                            }`}
                            style={{ width: `${dispatchPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Action Buttons: ONLY ONE "Dispatch Batch →" Button */}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => toggleBatchOpen(batch.id)}
                          className="flex-1 px-3.5 py-2.5 bg-[#141c2e] hover:bg-[#1a253d] text-slate-200 text-xs font-bold rounded-xl border border-slate-700/80 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <Users size={14} className="text-slate-400" />
                          <span>{isOpen ? `Close (${totalMembers})` : `View Influencers (${totalMembers})`}</span>
                          <ChevronDown size={14} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartBatchDispatch(batch, allActiveMembersInBatch)}
                          disabled={isBatchDispatched}
                          className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                            isBatchDispatched
                              ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 cursor-default'
                              : 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white shadow-purple-600/30'
                          }`}
                        >
                          {isBatchDispatched ? (
                            <>
                              <Check size={14} />
                              <span>Batch Dispatched</span>
                            </>
                          ) : (
                            <>
                              <Truck size={14} />
                              <span>Dispatch Batch →</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* EXPANDED MEMBER GRID (Visible when "View Influencers" is clicked) */}
                  {isOpen && (
                    <div className="pt-4 border-t border-slate-800/80 space-y-3.5 animate-fade-in">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold text-slate-300">
                          Influencers in {batch.batch_name} ({activeMembers.length})
                        </span>
                        <span className="text-[11px] text-slate-500 hidden sm:inline">
                          Process influencers individually or use "Dispatch Batch →" to step through
                        </span>
                      </div>

                      {activeMembers.length === 0 ? (
                        <p className="text-xs text-slate-500 py-3 text-center">
                          No active influencers in this batch match the current filter.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                          {activeMembers.map(inf => renderPrepareDispatchCard(inf))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : currentTab === 'dispatched' ? (
        /* ==================== DISPATCHED SECTION ==================== */
        filteredDispatchedList.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center text-slate-400">
            <Package className="mx-auto mb-3 text-slate-600" size={40} />
            <h3 className="text-base font-semibold text-slate-300 mb-1">No Dispatched Influencers</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchTerm || activeFilterCount > 0
                ? 'No dispatched influencers matched your filter criteria.'
                : 'No influencers have been dispatched yet for this campaign.'}
            </p>
            <button
              type="button"
              onClick={() => setCurrentTab('logistics')}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-purple-400 text-xs font-semibold rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Go to Active Logistics</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredDispatchedList.slice().sort(compareInfluencerCodesAsc).map((inf) => renderDispatchedCard(inf))}
          </div>
        )
      ) : (
        /* ==================== MAIN LOGISTICS VIEW ==================== */
        filteredLogisticsList.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center text-slate-400">
            <Package className="mx-auto mb-3 text-slate-600" size={40} />
            <h3 className="text-base font-semibold text-slate-300 mb-1">No Influencers in Logistics</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchTerm || activeFilterCount > 0
                ? 'No active influencers in Logistics matched your filter criteria.'
                : 'All active influencers in this campaign have been moved to Prepare Dispatch batches or dispatched.'}
            </p>
          </div>
        ) : isBulkSelectMode && selectedInfluencerIds.length > 0 ? (
          /* TEMPORARY TOP-SORTING DURING SELECTION MODE: SELECTED FIRST, THEN UNSELECTED */
          <div className="space-y-6">
            {/* Selected Section */}
            {selectedLogisticsList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
                  <CheckSquare size={14} className="text-purple-400" />
                  <span>Selected ({selectedLogisticsList.length})</span>
                  <div className="h-px flex-1 bg-purple-900/40" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {selectedLogisticsList.map((inf) => renderLogisticsCard(inf, true))}
                </div>
              </div>
            )}

            {/* Unselected Section */}
            {unselectedLogisticsList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Square size={14} className="text-slate-500" />
                  <span>Unselected ({unselectedLogisticsList.length})</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {unselectedLogisticsList.map((inf) => renderLogisticsCard(inf, false))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* STANDARD 3-COLUMN GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredLogisticsList.slice().sort(compareInfluencerCodesAsc).map((inf) => (
              renderLogisticsCard(inf, selectedInfluencerIds.includes(String(inf.id)))
            ))}
          </div>
        )
      )}

      {/* Local Fallback Dispatch Influencer Modal (Individual & Batch Dispatch) */}
      {localDispatchInfluencer && (
        <DispatchInfluencerModal 
          influencer={localDispatchInfluencer} 
          campaign={campaign} 
          batchInfo={batchDispatchContext ? {
            batchName: batchDispatchContext.batch.batch_name,
            current: batchDispatchContext.currentIndex + 1,
            total: batchDispatchContext.pendingInfluencers.length
          } : undefined}
          onClose={() => {
            setLocalDispatchInfluencer(null);
            setBatchDispatchContext(null);
          }} 
          onSuccess={async () => {
            await Promise.all([refreshDispatch(), refreshInfluencers(), loadSavedBatches()]);

            if (batchDispatchContext) {
              const nextIndex = batchDispatchContext.currentIndex + 1;
              if (nextIndex < batchDispatchContext.pendingInfluencers.length) {
                const nextInf = batchDispatchContext.pendingInfluencers[nextIndex];
                setBatchDispatchContext({
                  ...batchDispatchContext,
                  currentIndex: nextIndex
                });
                setLocalDispatchInfluencer(nextInf);
                toast.success(`Dispatched! Now processing ${getInfluencerUsername(nextInf)} (${nextIndex + 1} of ${batchDispatchContext.pendingInfluencers.length})`);
              } else {
                toast.success(`All influencers in ${batchDispatchContext.batch.batch_name} have been dispatched!`);
                setBatchDispatchContext(null);
                setLocalDispatchInfluencer(null);
              }
            } else {
              setLocalDispatchInfluencer(null);
            }
          }} 
        />
      )}
    </div>
  );

  /* Helper to render clean Logistics card: [Checkbox?] [Profile Photo] @username [Code] — NO DISPATCH BUTTON */
  function renderLogisticsCard(inf: CampaignInfluencer, isSelected: boolean) {
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
  }

  /* Helper to render Prepare Dispatch card inside a batch: [Profile Photo] @username [Code] [Dispatch / View Button] */
  function renderPrepareDispatchCard(inf: CampaignInfluencer) {
    const username = getInfluencerUsername(inf);
    const isDispatched = isInfluencerDispatched(inf, dispatchRecords);

    return (
      <div 
        key={inf.id}
        className={`bg-[#0b1220]/90 border rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 transition-colors shadow-sm ${
          isDispatched 
            ? 'border-emerald-900/60 hover:border-emerald-700/60' 
            : 'border-purple-800/50 hover:border-purple-600/70'
        }`}
      >
        {/* Left: Profile Photo + Username */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm sm:text-base border-2 shrink-0 shadow-sm ${
            isDispatched 
              ? 'bg-emerald-600 border-emerald-500/30' 
              : 'bg-purple-600 border-purple-500/30'
          }`}>
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
              className={`font-bold text-sm sm:text-base truncate transition-colors ${
                isDispatched ? 'text-emerald-100 hover:text-emerald-300' : 'text-slate-100 hover:text-purple-300'
              }`}
              title={username}
            >
              {username}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isDispatched ? (
                <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/40 flex items-center gap-1 font-medium">
                  <Check size={10} /> Dispatched
                </span>
              ) : (
                <span className="text-[10px] text-purple-300 bg-purple-950/80 px-1.5 py-0.2 rounded border border-purple-800/40 font-medium">
                  Ready to Dispatch
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Code + Dispatch CTA + Return Button */}
        <div className="flex items-center gap-2 shrink-0">
          {inf.code && (
            <span className="px-2 py-1 bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-bold font-mono rounded shrink-0 shadow-sm">
              {inf.code}
            </span>
          )}

          {isDispatched ? (
            <button
              type="button"
              onClick={() => handleDispatchClick(inf)}
              className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 hover:border-emerald-700 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title="View saved dispatch details"
            >
              <Eye size={14} />
              <span>View</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleDispatchClick(inf)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Dispatch this influencer"
            >
              <Package size={14} />
              <span>Dispatch</span>
            </button>
          )}

          {!isDispatched && (
            <button
              type="button"
              onClick={() => handleReturnToLogistics(String(inf.id))}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Return to Logistics"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  /* Helper to render Dispatched card: [Profile Photo] @username [Code] [View Dispatch Button] */
  function renderDispatchedCard(inf: CampaignInfluencer) {
    const username = getInfluencerUsername(inf);
    const dispatch = getDispatchData(inf);

    return (
      <div 
        key={inf.id}
        className="bg-[#0e1a1b]/90 border border-emerald-900/60 hover:border-emerald-700/60 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 transition-colors shadow-sm"
      >
        {/* Left: Profile Photo + Username */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-emerald-600 flex items-center justify-center text-white font-bold text-sm sm:text-base border-2 border-emerald-500/30 shrink-0 shadow-sm">
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
              className="font-bold text-slate-100 text-sm sm:text-base truncate hover:text-emerald-300 transition-colors"
              title={username}
            >
              {username}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {dispatch?.courier_partner ? `${dispatch.courier_partner}` : 'Dispatched'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Code + View Dispatch Button */}
        <div className="flex items-center gap-2 shrink-0">
          {inf.code && (
            <span className="px-2 py-1 bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-xs font-bold font-mono rounded shrink-0 shadow-sm">
              {inf.code}
            </span>
          )}

          <button
            type="button"
            onClick={() => handleDispatchClick(inf)}
            className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 hover:border-emerald-700 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            title="View saved dispatch details"
          >
            <Eye size={14} />
            <span>View Dispatch</span>
          </button>
        </div>
      </div>
    );
  }
};
