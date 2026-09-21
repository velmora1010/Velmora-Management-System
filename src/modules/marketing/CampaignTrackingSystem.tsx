import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import type { DispatchDetails } from '../../hooks/marketing/useCampaignDispatch';
import type { DispatchBatch } from '../../services/dispatchBatchService';
import {
  syncSingleShipment,
  syncAllShipments,
  normalizeTrackingStatus,
  resolveDelhiveryCategory,
  getCourierTrackingUrl,
  getTrackingStatusBadgeStyle,
  getTrackingCache,
  getLastCampaignSyncTime,
  getCampaignShipments,
  fetchCampaignShipmentsFromDb,
  pruneUnmatchedCampaignTrackingShipments,
  TrackingStatusCategory,
  InfluencerDispatchedShipment,
  getTrackingDisplayStatus,
  formatEstimatedDeliveryDate,
  formatDispatchedDate,
  formatDeliveredDate,
  parseToYMD,
  getTodayLocalYMD,
  isShipmentDelivered
} from '../../services/influencerTrackingService';
import { formatDDMMYYYY } from '../../utils/influencerDateUtils';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import {
  Truck,
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  FileSpreadsheet,
  X,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Phone,
  Calendar,
  Layers,
  Copy,
  AlertTriangle,
  Navigation,
  MoreVertical,
  SlidersHorizontal,
  Info,
  History,
  Target,
  Upload,
  ChevronDown,
  Eye,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { UploadCourierShipmentModal } from '../../components/marketing/UploadCourierShipmentModal';
import {
  handoffDeliveredShipmentToStatusTracking,
  bulkHandoffDeliveredShipments,
  fetchCampaignStatusTrackingInfluencerIds,
  matchShipmentToInfluencer,
  deleteShipmentWithStatusTrackingSync,
  clearAllCampaignTrackingWithStatusSync,
  sortInfluencerShipmentsNaturally,
  naturalCompareInfluencerCodes
} from '../../services/influencerStatusHandoffService';

interface CampaignTrackingSystemProps {
  campaign: Campaign;
  dispatchedInfluencers: CampaignInfluencer[];
  dispatchRecords: DispatchDetails[];
  savedBatches?: DispatchBatch[];
  onBackToDispatched?: () => void;
  allActiveInfluencers?: CampaignInfluencer[];
  onRefreshData?: () => void | Promise<void>;
}

const STATUS_PILLS: TrackingStatusCategory[] = [
  'All',
  'Exception',
  'Failed Attempt',
  'Pending',
  'In Transit',
  'Delivered',
  'Out for Delivery',
  'Info Received',
  'Expired'
];

export const getShipmentCategory = (s: InfluencerDispatchedShipment): TrackingStatusCategory => {
  const displayStatus = getTrackingDisplayStatus(s);
  return resolveDelhiveryCategory(displayStatus, s.rawStatus, s.currentStatus);
};

export const CampaignTrackingSystem: React.FC<CampaignTrackingSystemProps> = ({
  campaign,
  dispatchedInfluencers,
  dispatchRecords,
  savedBatches = [],
  onBackToDispatched,
  allActiveInfluencers,
  onRefreshData
}) => {

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<TrackingStatusCategory>('All');
  const [selectedCourier, setSelectedCourier] = useState('All');
  const [selectedStatusDropdown, setSelectedStatusDropdown] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estimated Delivery Calendar & Filter State
  const [isDeliveryCalendarOpen, setIsDeliveryCalendarOpen] = useState(false);
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<string | null>(null); // YYYY-MM-DD
  const [selectedDeliveryDateEnd, setSelectedDeliveryDateEnd] = useState<string | null>(null); // YYYY-MM-DD (for range)
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth()); // 0-11

  // Upload Dropdown & Modal State
  const uploadDropdownRef = useRef<HTMLDivElement>(null);
  const stFileInputRef = useRef<HTMLInputElement>(null);
  const delhiveryFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDropdownOpen, setIsUploadDropdownOpen] = useState(false);
  const [selectedUploadCourier, setSelectedUploadCourier] = useState<'ST Courier' | 'Delhivery'>('ST Courier');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleTriggerCourierUpload = (courier: 'ST Courier' | 'Delhivery') => {
    console.log(`[Tracking System] Opening file picker for ${courier}...`);
    setIsUploadDropdownOpen(false);
    if (courier === 'ST Courier') {
      if (stFileInputRef.current) {
        stFileInputRef.current.value = '';
        stFileInputRef.current.click();
      }
    } else {
      if (delhiveryFileInputRef.current) {
        delhiveryFileInputRef.current.value = '';
        delhiveryFileInputRef.current.click();
      }
    }
  };

  const handleCourierFileChange = (e: React.ChangeEvent<HTMLInputElement>, courier: 'ST Courier' | 'Delhivery') => {
    const chosen = e.target.files?.[0];
    console.log(`[Tracking System] File selected for ${courier}:`, chosen?.name, 'Size:', chosen?.size, 'Type:', chosen?.type);
    if (!chosen) return;
    setSelectedUploadCourier(courier);
    setSelectedUploadFile(chosen);
    setIsUploadModalOpen(true);
    e.target.value = '';
  };

  // Close upload dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uploadDropdownRef.current && !uploadDropdownRef.current.contains(event.target as Node)) {
        setIsUploadDropdownOpen(false);
      }
    };
    if (isUploadDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUploadDropdownOpen]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Syncing state
  const [syncingIds, setSyncingIds] = useState<string[]>([]);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => getLastCampaignSyncTime(campaign.id));

  // Modals state
  const [activeTrackingModalShipment, setActiveTrackingModalShipment] = useState<InfluencerDispatchedShipment | null>(null);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  // Set of influencer IDs that already exist in Status Tracking for this campaign
  const [existingStatusInfluencerIds, setExistingStatusInfluencerIds] = useState<Set<string>>(new Set());
  const [isMovingToStatus, setIsMovingToStatus] = useState(false);
  const [movingShipmentId, setMovingShipmentId] = useState<string | null>(null);

  // Load Status Tracking influencer IDs
  const loadStatusTrackingInfluencerIds = useCallback(async () => {
    if (!campaign?.id) return;
    try {
      const set = await fetchCampaignStatusTrackingInfluencerIds(campaign.id);
      setExistingStatusInfluencerIds(set);
    } catch (e) {
      console.error('Failed loading status tracking influencer IDs:', e);
    }
  }, [campaign?.id]);

  // Campaign active influencers from DB (fallback if parent did not supply allActiveInfluencers)
  const [dbActiveInfluencers, setDbActiveInfluencers] = useState<CampaignInfluencer[]>([]);

  useEffect(() => {
    const fetchActive = async () => {
      if (!campaign?.id) return;
      try {
        const { data } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .select('*')
          .eq('campaign_id', String(campaign.id));
        if (data && data.length > 0) {
          const active = data.filter((i: any) => String(i.is_archived).toLowerCase() !== 'true');
          setDbActiveInfluencers(active as any[]);
        }
      } catch (e) {
        console.warn('Failed loading campaign active influencers:', e);
      }
    };
    fetchActive();
  }, [campaign?.id]);

  // Candidate influencers: pool all active influencers and dispatched influencers for the campaign
  const candidateInfluencers = useMemo(() => {
    const map = new Map<string, CampaignInfluencer>();
    (allActiveInfluencers || []).forEach(inf => {
      if (inf?.id) map.set(String(inf.id), inf);
    });
    (dbActiveInfluencers || []).forEach(inf => {
      if (inf?.id && !map.has(String(inf.id))) map.set(String(inf.id), inf);
    });
    (dispatchedInfluencers || []).forEach(inf => {
      if (inf?.id && !map.has(String(inf.id))) map.set(String(inf.id), inf);
    });
    return Array.from(map.values());
  }, [allActiveInfluencers, dbActiveInfluencers, dispatchedInfluencers]);

  // Campaign imported shipments (ST Courier + Delhivery) - loads from DB with local storage cache fallback
  const [campaignShipments, setCampaignShipments] = useState<InfluencerDispatchedShipment[]>(() => getCampaignShipments(campaign.id));
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  // Local tracking overrides/cache state
  const [trackingCache, setTrackingCache] = useState<Record<string, any>>(() => getTrackingCache(campaign.id));

  // Load shipments directly from Supabase database scoped to current campaign
  const loadShipments = useCallback(async () => {
    setIsLoadingDb(true);
    try {
      // 1. Ensure we have candidate influencers to validate against
      let activeInfs = candidateInfluencers;
      if (activeInfs.length === 0) {
        const { data } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .select('*')
          .eq('campaign_id', String(campaign.id));
        if (data && data.length > 0) {
          activeInfs = data.filter((i: any) => String(i.is_archived).toLowerCase() !== 'true') as any[];
          setDbActiveInfluencers(activeInfs);
        }
      }

      // 2. Prune any orphaned customer records from Supabase for this campaign
      if (activeInfs.length > 0) {
        await pruneUnmatchedCampaignTrackingShipments(campaign.id, activeInfs);
      }

      // 3. Fetch clean shipments from DB
      const dbShipments = await fetchCampaignShipmentsFromDb(campaign.id);
      setCampaignShipments(dbShipments);
      setTrackingCache(getTrackingCache(campaign.id));
      setLastSyncTime(getLastCampaignSyncTime(campaign.id));
      await loadStatusTrackingInfluencerIds();
    } catch (err) {
      console.error('Failed to load campaign shipments from Supabase:', err);
    } finally {
      setIsLoadingDb(false);
    }
  }, [campaign.id, candidateInfluencers, loadStatusTrackingInfluencerIds]);

  // Reload cache and shipments when campaign changes
  useEffect(() => {
    loadShipments();
    setCurrentPage(1);
  }, [loadShipments]);

  // Listen to external tracking and status updates across tabs or modules
  useEffect(() => {
    const handleTrackingUpdated = (e: any) => {
      const updatedCampaignId = e?.detail?.campaignId;
      if (!updatedCampaignId || String(updatedCampaignId) === String(campaign.id)) {
        loadShipments();
      }
    };
    const handleStatusUpdated = (e: any) => {
      const updatedCampaignId = e?.detail?.campaignId;
      if (!updatedCampaignId || String(updatedCampaignId) === String(campaign.id)) {
        loadStatusTrackingInfluencerIds();
      }
    };
    window.addEventListener('influencer_tracking_updated', handleTrackingUpdated);
    window.addEventListener('status_tracking_updated', handleStatusUpdated);
    return () => {
      window.removeEventListener('influencer_tracking_updated', handleTrackingUpdated);
      window.removeEventListener('status_tracking_updated', handleStatusUpdated);
    };
  }, [campaign.id, loadShipments, loadStatusTrackingInfluencerIds]);

  // Build unified dispatched shipments strictly for the current campaign
  // Combines uploaded campaign shipments (ST Courier & Delhivery) and matched campaign influencers
  // Excludes any customer shipments that do not belong to an active campaign influencer
  const allShipments: InfluencerDispatchedShipment[] = useMemo(() => {
    const shipmentMap = new Map<string, InfluencerDispatchedShipment>();

    // 1. First index uploaded campaign shipments that strictly resolve to an active campaign influencer
    for (const cs of campaignShipments) {
      const matchResult = matchShipmentToInfluencer(cs, candidateInfluencers, dispatchRecords);
      const matchedInf = matchResult.matchedInfluencer;

      // REJECT/EXCLUDE: If shipment does not match any active campaign influencer, exclude it!
      if (!matchedInf) {
        continue;
      }

      const infId = String(matchedInf.id);
      const dispatch = matchResult.matchedDispatch || matchedInf.dispatchDetails || dispatchRecords.find(d => String(d.influencer_id) === infId);
      const batch = (savedBatches || []).find(b => b.members && b.members.some(m => String(m.influencer_id) === infId));
      const batchCode = batch?.batch_name || '—';
      const batchId = batch?.id;

      const username = matchedInf.platforms?.find(p => p.username && p.username.trim())?.username?.trim()
        || matchedInf.influencer_name?.trim()
        || (matchedInf as any).username?.trim()
        || matchedInf.name?.trim()
        || '—';
      const cleanUsername = username.startsWith('@') ? username : `@${username}`;

      const awbKey = (cs.awbNumber || '').toLowerCase().trim();
      const courierLower = (cs.courier || '').toLowerCase().trim();
      const uniqueKey = `${courierLower}__${awbKey || (cs.id ? cs.id.toLowerCase().trim() : '')}`;
      if (!uniqueKey || uniqueKey === '__') continue;

      const cached = cs.awbNumber ? trackingCache[cs.awbNumber] : null;
      const isDelhivery = courierLower.includes('delhivery');
      const isSTCourier = courierLower.includes('st courier');

      const statusSource = isDelhivery 
        ? 'Uploaded Delhivery File'
        : (isSTCourier ? 'Live ST Courier Tracking' : (cs.statusSource || 'Uploaded File'));
      const sourceType = isDelhivery ? 'UPLOADED_FILE' : (isSTCourier ? 'LIVE_API' : (cs.sourceType || 'UPLOADED_FILE'));

      const rawStatus = cached?.rawStatus || cs.rawStatus || cs.status || '';
      const displayStatus = getTrackingDisplayStatus({
        ...cs,
        rawStatus,
        status: cached?.status || cs.status
      });
      const edd = cs.estimatedDeliveryDate || cs.expectedDeliveryDate || dispatch?.expected_delivery_date || '';

      let resolvedRemarks = (cs.remarks && cs.remarks.trim()) ? cs.remarks.trim() : undefined;
      let resolvedDeliveredDate = cs.deliveredDate || (cs as any).delivered_date || undefined;
      const rawSyncError = cs.syncError || cached?.syncError;
      if ((!resolvedRemarks || !resolvedDeliveredDate) && rawSyncError && typeof rawSyncError === 'string' && rawSyncError.startsWith('{')) {
        try {
          const meta = JSON.parse(rawSyncError);
          if (!resolvedRemarks && meta.remarks) resolvedRemarks = String(meta.remarks).trim();
          if (!resolvedDeliveredDate && meta.delivered_date) resolvedDeliveredDate = String(meta.delivered_date).trim();
        } catch (e) {}
      }

      shipmentMap.set(uniqueKey, {
        ...cs,
        influencerId: infId,
        creatorName: matchedInf.influencer_name || matchedInf.name || cs.creatorName,
        username: cleanUsername,
        influencerCode: matchedInf.code || cs.influencerCode || '',
        orderId: cs.orderId || matchedInf.code || '',
        profilePhoto: cs.profilePhoto || matchedInf.profile_file_url || '',
        phoneNumber: cs.phoneNumber || matchedInf.phone_number || dispatch?.phone_number || '',
        altPhoneNumber: cs.altPhoneNumber || matchedInf.alternative_number || dispatch?.alternative_phone_number || '',
        state: cs.state || matchedInf.state || dispatch?.state || '',
        batchId: cs.batchId || batchId,
        batchCode: cs.batchCode !== '—' ? cs.batchCode : batchCode,
        dispatchDate: cs.dispatchDate || dispatch?.dispatch_date || '',
        expectedDeliveryDate: edd,
        estimatedDeliveryDate: edd,
        deliveredDate: resolvedDeliveredDate,
        remarks: resolvedRemarks,
        status: displayStatus,
        statusCategory: resolveDelhiveryCategory(displayStatus, rawStatus, cs.currentStatus),
        rawStatus: rawStatus || 'In Transit',
        statusSource,
        sourceType,
        lastLocation: cached?.lastLocation || cs.lastLocation,
        trackingDateTime: cached?.trackingDateTime || cs.trackingDateTime,
        lastSyncedAt: cached?.lastSyncedAt || cs.lastSyncedAt,
        syncError: cached?.syncError || cs.syncError,
        trackingUrl: cs.trackingUrl || getCourierTrackingUrl(cs.courier, cs.awbNumber)
      });
    }

    const unsorted = Array.from(shipmentMap.values());
    return sortInfluencerShipmentsNaturally(unsorted);
  }, [candidateInfluencers, dispatchRecords, savedBatches, campaignShipments, trackingCache]);

  // True if valid campaign tracking shipments exist in the database
  const hasTrackingData = allShipments.length > 0;

  // Unique couriers present in this campaign (case-insensitive deduplicated)
  const availableCouriers = useMemo(() => {
    const map = new Map<string, string>();
    allShipments.forEach(s => {
      if (s.courier && s.courier.trim()) {
        const clean = s.courier.trim();
        const lower = clean.toLowerCase();
        if (!map.has(lower)) {
          map.set(lower, clean);
        }
      }
    });
    return Array.from(map.values());
  }, [allShipments]);

  // 9 KPI Calculations strictly from real campaign shipment data
  const kpis = useMemo(() => {
    let total = allShipments.length;
    let inTransit = 0;
    let outForDelivery = 0;
    let delivered = 0;
    let exception = 0;
    let failedAttempt = 0;
    let pending = 0;
    let infoReceived = 0;
    let expired = 0;

    for (const s of allShipments) {
      const cat = getShipmentCategory(s);
      if (cat === 'In Transit') inTransit++;
      else if (cat === 'Out for Delivery') outForDelivery++;
      else if (cat === 'Delivered') delivered++;
      else if (cat === 'Exception') exception++;
      else if (cat === 'Failed Attempt') failedAttempt++;
      else if (cat === 'Pending') pending++;
      else if (cat === 'Info Received') infoReceived++;
      else if (cat === 'Expired') expired++;
    }

    return {
      total,
      inTransit,
      outForDelivery,
      delivered,
      exception,
      failedAttempt,
      pending,
      infoReceived,
      expired
    };
  }, [allShipments]);

  // Status Tab Counts for the pills
  const statusTabCounts = useMemo(() => {
    const counts: Record<TrackingStatusCategory, number> = {
      All: allShipments.length,
      Exception: kpis.exception,
      'Failed Attempt': kpis.failedAttempt,
      Pending: kpis.pending,
      'In Transit': kpis.inTransit,
      Delivered: kpis.delivered,
      'Out for Delivery': kpis.outForDelivery,
      'Info Received': kpis.infoReceived,
      Expired: kpis.expired
    };
    return counts;
  }, [allShipments, kpis]);

  // Delivery Schedule grouping from allShipments
  const deliverySchedule = useMemo(() => {
    const map = new Map<string, { ymd: string; formattedDate: string; count: number; shipments: InfluencerDispatchedShipment[] }>();
    const todayYmd = getTodayLocalYMD();
    let totalWithDate = 0;
    let todayCount = 0;

    for (const s of allShipments) {
      const edd = s.estimatedDeliveryDate || s.expectedDeliveryDate;
      if (!edd) continue;
      const ymd = parseToYMD(edd);
      if (!ymd) continue;

      totalWithDate++;
      if (ymd === todayYmd) {
        todayCount++;
      }

      const existing = map.get(ymd);
      if (existing) {
        existing.count++;
        existing.shipments.push(s);
      } else {
        map.set(ymd, {
          ymd,
          formattedDate: formatEstimatedDeliveryDate(ymd),
          count: 1,
          shipments: [s]
        });
      }
    }

    const sortedList = Array.from(map.values()).sort((a, b) => a.ymd.localeCompare(b.ymd));

    return {
      byDateMap: map,
      sortedList,
      totalWithDate,
      todayCount,
      todayYmd
    };
  }, [allShipments]);

  // Auto-focus calendar view to selected date or scheduled deliveries when modal opens
  useEffect(() => {
    if (isDeliveryCalendarOpen) {
      if (selectedDeliveryDate) {
        const parts = selectedDeliveryDate.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
            setCalendarYear(y);
            setCalendarMonth(m);
            return;
          }
        }
      }
      if (deliverySchedule.sortedList.length > 0) {
        const parts = deliverySchedule.sortedList[0].ymd.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
            setCalendarYear(y);
            setCalendarMonth(m);
            return;
          }
        }
      }
      const today = new Date();
      setCalendarYear(today.getFullYear());
      setCalendarMonth(today.getMonth());
    }
  }, [isDeliveryCalendarOpen]);

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 0) {
        setCalendarYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 11) {
        setCalendarYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleSelectCalendarDate = (ymd: string) => {
    if (!selectedDeliveryDate) {
      setSelectedDeliveryDate(ymd);
      setSelectedDeliveryDateEnd(null);
    } else if (!selectedDeliveryDateEnd) {
      if (selectedDeliveryDate === ymd) {
        setSelectedDeliveryDate(null);
        setSelectedDeliveryDateEnd(null);
      } else if (ymd < selectedDeliveryDate) {
        setSelectedDeliveryDate(ymd);
        setSelectedDeliveryDateEnd(null);
      } else {
        setSelectedDeliveryDateEnd(ymd);
      }
    } else {
      if (selectedDeliveryDate === ymd || selectedDeliveryDateEnd === ymd) {
        setSelectedDeliveryDate(null);
        setSelectedDeliveryDateEnd(null);
      } else {
        setSelectedDeliveryDate(ymd);
        setSelectedDeliveryDateEnd(null);
      }
    }
  };

  const MONTH_NAMES = useMemo(() => [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ], []);

  const monthLabel = `${MONTH_NAMES[calendarMonth]} ${calendarYear}`;

  const calendarCells = useMemo(() => {
    const cells: {
      ymd: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      count: number;
    }[] = [];

    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    // Previous month padding
    const prevYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
    const prevMonth = calendarMonth === 0 ? 11 : calendarMonth - 1;
    for (let i = 0; i < firstDayOfWeek; i++) {
      const dayNum = daysInPrevMonth - firstDayOfWeek + 1 + i;
      const ymd = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const count = deliverySchedule.byDateMap.get(ymd)?.count || 0;
      cells.push({
        ymd,
        dayNum,
        isCurrentMonth: false,
        isToday: ymd === deliverySchedule.todayYmd,
        count
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const ymd = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const count = deliverySchedule.byDateMap.get(ymd)?.count || 0;
      cells.push({
        ymd,
        dayNum,
        isCurrentMonth: true,
        isToday: ymd === deliverySchedule.todayYmd,
        count
      });
    }

    // Next month padding to fill out 7-column rows
    const nextYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
    const nextMonth = calendarMonth === 11 ? 0 : calendarMonth + 1;
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const ymd = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const count = deliverySchedule.byDateMap.get(ymd)?.count || 0;
      cells.push({
        ymd,
        dayNum: i,
        isCurrentMonth: false,
        isToday: ymd === deliverySchedule.todayYmd,
        count
      });
    }

    return cells;
  }, [calendarYear, calendarMonth, deliverySchedule.byDateMap, deliverySchedule.todayYmd]);

  // Filtered Shipments
  const filteredShipments = useMemo(() => {
    const filtered = allShipments.filter(s => {
      // 0. Estimated Delivery Date Filter (canonical estimated_delivery_date)
      const edd = s.estimatedDeliveryDate || s.expectedDeliveryDate;
      const eddYmd = edd ? parseToYMD(edd) : '';

      if (selectedDeliveryDate && selectedDeliveryDateEnd) {
        if (!eddYmd) return false;
        if (eddYmd < selectedDeliveryDate || eddYmd > selectedDeliveryDateEnd) {
          return false;
        }
      } else if (selectedDeliveryDate) {
        if (!eddYmd || eddYmd !== selectedDeliveryDate) {
          return false;
        }
      } else if (selectedDeliveryDateEnd) {
        if (!eddYmd || eddYmd > selectedDeliveryDateEnd) {
          return false;
        }
      }

      // 1. Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const cleanQuery = query.replace(/^#+/, '');
        const matchesName = s.creatorName.toLowerCase().includes(query);
        const matchesUser = s.username.toLowerCase().includes(query);
        const matchesPhone = s.phoneNumber.toLowerCase().includes(query) || s.altPhoneNumber.toLowerCase().includes(query);
        const matchesAwb = s.awbNumber.toLowerCase().includes(query);
        const matchesBatch = s.batchCode.toLowerCase().includes(query);
        const matchesCourier = s.courier.toLowerCase().includes(query);
        const matchesCode = s.influencerCode.toLowerCase().includes(query) || s.influencerCode.toLowerCase().includes(cleanQuery);
        const matchesOrderId = (s.orderId || '').toLowerCase().includes(query) || (s.orderId || '').toLowerCase().includes(cleanQuery) || (s.id || '').toLowerCase().includes(query);

        if (!matchesName && !matchesUser && !matchesPhone && !matchesAwb && !matchesBatch && !matchesCourier && !matchesCode && !matchesOrderId) {
          return false;
        }
      }

      // 2. Courier filter
      if (selectedCourier !== 'All' && s.courier.toLowerCase() !== selectedCourier.toLowerCase()) {
        return false;
      }

      // 3. Status Tab filter (pills)
      if (selectedStatusTab !== 'All') {
        const cat = getShipmentCategory(s);
        if (cat !== selectedStatusTab) {
          return false;
        }
      }

      // 4. Status Dropdown filter
      if (selectedStatusDropdown !== 'All') {
        const cat = getShipmentCategory(s);
        const display = getTrackingDisplayStatus(s);
        if (cat !== selectedStatusDropdown && display !== selectedStatusDropdown) {
          return false;
        }
      }

      // 5. Date Range filter (strictly on canonical Estimated Delivery Date, not dispatchDate/upload/order)
      if (startDate || endDate) {
        if (!eddYmd) return false;
        if (startDate && eddYmd < startDate) return false;
        if (endDate && eddYmd > endDate) return false;
      }

      return true;
    });

    // Natural ascending sort on the filtered influencer shipments BEFORE pagination
    return sortInfluencerShipmentsNaturally(filtered);
  }, [allShipments, selectedDeliveryDate, selectedDeliveryDateEnd, searchTerm, selectedCourier, selectedStatusTab, selectedStatusDropdown, startDate, endDate]);

  // Reset pagination whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCourier, selectedStatusTab, selectedStatusDropdown, startDate, endDate, selectedDeliveryDate, selectedDeliveryDateEnd]);

  // Paginated Shipments
  const totalShipmentsCount = filteredShipments.length;
  const totalPages = Math.max(1, Math.ceil(totalShipmentsCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedShipments = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredShipments.slice(startIdx, startIdx + pageSize);
  }, [filteredShipments, safeCurrentPage, pageSize]);

  // Generate clean, strictly non-colliding pagination items
  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => ({
        type: 'page' as const,
        page: i + 1,
        key: `page-${i + 1}`
      }));
    }

    const items: Array<{ type: 'page' | 'ellipsis'; page?: number; key: string }> = [];
    items.push({ type: 'page', page: 1, key: 'page-1' });

    let start = Math.max(2, safeCurrentPage - 1);
    let end = Math.min(totalPages - 1, safeCurrentPage + 1);

    if (safeCurrentPage <= 3) {
      start = 2;
      end = 4;
    } else if (safeCurrentPage >= totalPages - 2) {
      start = totalPages - 3;
      end = totalPages - 1;
    }

    if (start > 2) {
      items.push({ type: 'ellipsis', key: 'ellipsis-start' });
    }

    for (let p = start; p <= end; p++) {
      items.push({ type: 'page', page: p, key: `page-${p}` });
    }

    if (end < totalPages - 1) {
      items.push({ type: 'ellipsis', key: 'ellipsis-end' });
    }

    items.push({ type: 'page', page: totalPages, key: `page-${totalPages}` });
    return items;
  }, [totalPages, safeCurrentPage]);

  // Delete All Tracking Records Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Single Shipment Deletion Modal State
  const [shipmentToDelete, setShipmentToDelete] = useState<InfluencerDispatchedShipment | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Clear All: Permanently deletes all tracking records for this campaign from Supabase
  // and removes corresponding Status Tracking records for these tracking influencers
  const handleClearAllTrackingData = async () => {
    if (!campaign?.id) {
      toast.error('Unable to clear tracking data because the current campaign could not be identified.');
      return;
    }

    setIsDeleting(true);
    const toastId = toast.loading('Deleting tracking data and syncing status tracking...');

    try {
      const result = await clearAllCampaignTrackingWithStatusSync(
        campaign.id,
        candidateInfluencers,
        dispatchRecords
      );

      if (!result.success) {
        toast.error(`Failed to clear tracking data: ${result.error || 'Unknown error'}`, { id: toastId });
        await loadShipments();
        return;
      }

      // Reset local state immediately
      setCampaignShipments([]);
      setTrackingCache({});
      setLastSyncTime(null);
      setActiveTrackingModalShipment(null);

      // Reset search and filter states
      setSearchTerm('');
      setSelectedCourier('All');
      setSelectedStatusTab('All');
      setSelectedStatusDropdown('All');
      setSelectedDeliveryDate(null);
      setStartDate('');
      setEndDate('');
      setCurrentPage(1);

      // Re-verify from DB
      await loadShipments();

      const statusMsg = result.deletedStatusCount > 0
        ? `Tracking data cleared (${result.deletedShipmentCount} shipments, ${result.deletedStatusCount} status tracking records removed).`
        : `Tracking data cleared (${result.deletedShipmentCount} shipments removed).`;
      toast.success(statusMsg, { id: toastId });

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      console.error('Clear All error:', err);
      toast.error(`Failed to clear tracking data: ${err?.message || String(err)}`, { id: toastId });
      await loadShipments();
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  // Delete Single Shipment
  const handleDeleteSingleShipment = async () => {
    if (!shipmentToDelete || !campaign?.id) return;
    setIsDeletingSingle(true);
    const toastId = toast.loading('Deleting tracking shipment...');

    try {
      const res = await deleteShipmentWithStatusTrackingSync(
        campaign.id,
        shipmentToDelete,
        candidateInfluencers,
        dispatchRecords
      );

      if (!res.success) {
        toast.error(`Failed to delete shipment: ${res.error || 'Unknown error'}`, { id: toastId });
      } else {
        toast.success(
          res.deletedStatusTracking
            ? 'Tracking shipment and corresponding Status Tracking record deleted.'
            : 'Tracking shipment deleted successfully.',
          { id: toastId }
        );
        await loadShipments();
        if (onRefreshData) {
          await onRefreshData();
        }
      }
    } catch (err: any) {
      console.error('Delete single shipment error:', err);
      toast.error(`Failed to delete shipment: ${err?.message || String(err)}`, { id: toastId });
    } finally {
      setIsDeletingSingle(false);
      setShipmentToDelete(null);
    }
  };

  // Copy AWB Helper
  const handleCopyAwb = (awb: string) => {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopiedAwb(awb);
    toast.success(`AWB ${awb} copied to clipboard!`);
    setTimeout(() => setCopiedAwb(null), 2000);
  };

  // Delivered shipments eligible to move to Status Tracking (not yet added)
  const eligibleForStatusTrackingCount = useMemo(() => {
    let count = 0;
    const seen = new Set<string>();
    for (const s of allShipments) {
      if (isShipmentDelivered(s)) {
        const { matchedInfluencer } = matchShipmentToInfluencer(s, candidateInfluencers, dispatchRecords);
        if (matchedInfluencer) {
          const infId = String(matchedInfluencer.id);
          if (!existingStatusInfluencerIds.has(infId) && !seen.has(infId)) {
            count++;
            seen.add(infId);
          }
        }
      }
    }
    return count;
  }, [allShipments, candidateInfluencers, dispatchRecords, existingStatusInfluencerIds]);

  // Move single delivered shipment to Status Tracking
  const handleMoveToStatusTracking = async (shipment: InfluencerDispatchedShipment) => {
    if (!isShipmentDelivered(shipment)) {
      toast.error(`Shipment status is "${shipment.status}". Only Delivered shipments qualify for Status Tracking.`);
      return;
    }

    setMovingShipmentId(shipment.id);
    const toastId = toast.loading('Moving to Status Tracking...');

    try {
      const res = await handoffDeliveredShipmentToStatusTracking(
        campaign.id,
        shipment,
        candidateInfluencers,
        dispatchRecords
      );

      if (!res.success) {
        toast.error(res.error || 'Failed to move to Status Tracking.', { id: toastId });
        return;
      }

      if (res.matchedInfluencer) {
        const infId = String(res.matchedInfluencer.id);
        setExistingStatusInfluencerIds(prev => new Set(prev).add(infId));
      }

      if (res.alreadyExisted) {
        toast.success(`Influencer is already in Status Tracking. Progress preserved.`, { id: toastId });
      } else {
        const infName = res.matchedInfluencer?.code || res.matchedInfluencer?.influencer_name || 'Influencer';
        toast.success(`Moved ${infName} to Status Tracking!`, { id: toastId });
      }

      await loadStatusTrackingInfluencerIds();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail: { campaignId: String(campaign.id) } }));
        window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail: { campaignId: String(campaign.id) } }));
      }

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      toast.error(`Error: ${err?.message || String(err)}`, { id: toastId });
    } finally {
      setMovingShipmentId(null);
    }
  };

  // Bulk move all eligible delivered shipments to Status Tracking
  const handleBulkMoveToStatusTracking = async () => {
    const delivered = allShipments.filter(s => isShipmentDelivered(s));
    if (delivered.length === 0) {
      toast.error('No Delivered shipments found.');
      return;
    }

    setIsMovingToStatus(true);
    const toastId = toast.loading(`Moving delivered influencers to Status Tracking...`);

    try {
      const summary = await bulkHandoffDeliveredShipments(
        campaign.id,
        delivered,
        candidateInfluencers,
        dispatchRecords
      );

      await loadStatusTrackingInfluencerIds();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('status_tracking_updated', { detail: { campaignId: String(campaign.id) } }));
        window.dispatchEvent(new CustomEvent('influencer_tracking_updated', { detail: { campaignId: String(campaign.id) } }));
      }

      if (summary.addedCount > 0) {
        toast.success(`Added ${summary.addedCount} influencer(s) to Status Tracking (${summary.alreadyPresentCount} already present).`, { id: toastId, duration: 5000 });
      } else if (summary.alreadyPresentCount > 0) {
        toast.success(`All ${summary.alreadyPresentCount} delivered influencer(s) are already in Status Tracking.`, { id: toastId });
      } else if (summary.unmatchedCount > 0) {
        toast.error(`Could not match ${summary.unmatchedCount} shipment(s) to influencers in this campaign.`, { id: toastId });
      } else {
        toast('No new influencers to move.', { id: toastId, icon: 'ℹ️' });
      }

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      toast.error(`Bulk move error: ${err?.message || String(err)}`, { id: toastId });
    } finally {
      setIsMovingToStatus(false);
    }
  };

  // Single Shipment Sync
  const handleSyncShipment = async (shipment: InfluencerDispatchedShipment) => {
    if ((shipment.courier || '').toLowerCase().includes('delhivery')) {
      toast('Status is based on the uploaded Delhivery file. Live API sync is only for ST Courier.', { icon: 'ℹ️' });
      return;
    }

    if (!shipment.awbNumber) {
      toast.error('Cannot sync: Missing AWB number.');
      return;
    }

    setSyncingIds(prev => [...prev, shipment.id]);
    const toastId = toast.loading(`Syncing tracking for AWB ${shipment.awbNumber}...`);

    try {
      const updated = await syncSingleShipment(shipment, campaign.id);
      await loadShipments();

      if (updated.syncError) {
        toast.error(`Sync: ${updated.syncError}`, { id: toastId });
      } else {
        toast.success(`Synced: ${updated.status}`, { id: toastId });
      }

      // Automatic handoff if shipment became Delivered
      if (isShipmentDelivered(updated)) {
        const handoffRes = await handoffDeliveredShipmentToStatusTracking(
          campaign.id,
          updated,
          candidateInfluencers,
          dispatchRecords
        );
        if (handoffRes.success && !handoffRes.alreadyExisted) {
          toast.success(`Automatically added ${handoffRes.matchedInfluencer?.code || 'influencer'} to Status Tracking!`, { duration: 4000 });
        }
        await loadStatusTrackingInfluencerIds();
      }

      if (activeTrackingModalShipment && activeTrackingModalShipment.id === shipment.id) {
        setActiveTrackingModalShipment(updated);
      }
    } catch (err: any) {
      toast.error('Sync failed.', { id: toastId });
    } finally {
      setSyncingIds(prev => prev.filter(id => id !== shipment.id));
    }
  };

  // Auto Sync All Eligible Shipments (ST Courier only; skips Delhivery file-sourced shipments)
  const handleAutoSyncAll = async () => {
    const stEligible = allShipments.filter(s => 
      (s.courier || '').toLowerCase().includes('st courier') && 
      s.awbNumber && 
      !isShipmentDelivered(s)
    );

    const delhiveryCount = allShipments.filter(s => 
      (s.courier || '').toLowerCase().includes('delhivery')
    ).length;

    if (stEligible.length === 0) {
      if (delhiveryCount > 0) {
        toast(`Skipped ${delhiveryCount} Delhivery shipment(s) (Status source: Uploaded file). No eligible ST Courier shipments to sync.`, { icon: 'ℹ️' });
      } else {
        toast.error('No active ST Courier shipments eligible to sync.');
      }
      return;
    }

    setIsBulkSyncing(true);
    const progressToastId = 'bulk-sync-progress';
    toast.loading(`Syncing ${stEligible.length} ST Courier shipments...`, { id: progressToastId });

    try {
      const result = await syncAllShipments(allShipments, campaign.id, (p) => {
        toast.loading(`Syncing ST Courier (${p.completed}/${p.total})...`, { id: progressToastId });
      });

      await loadShipments();

      // Automatic handoff for all delivered shipments
      const refreshedShipments = await fetchCampaignShipmentsFromDb(campaign.id);
      const deliveredAfterSync = refreshedShipments.filter(s => isShipmentDelivered(s));
      if (deliveredAfterSync.length > 0) {
        const handoffSummary = await bulkHandoffDeliveredShipments(
          campaign.id,
          deliveredAfterSync,
          candidateInfluencers,
          dispatchRecords
        );
        if (handoffSummary.addedCount > 0) {
          toast.success(`Handoff: Added ${handoffSummary.addedCount} newly delivered influencer(s) to Status Tracking!`, { duration: 5000 });
        }
        await loadStatusTrackingInfluencerIds();
      }

      toast.dismiss(progressToastId);
      const summary = delhiveryCount > 0
        ? `ST Courier: Synced ${result.successful}, Failed ${result.failed}\nDelhivery: Skipped live sync (${delhiveryCount} shipments - Status source: Uploaded file)`
        : `ST Courier: Synced ${result.successful}, Failed ${result.failed}`;
      toast.success(summary, { duration: 6000 });
    } catch (err) {
      toast.dismiss(progressToastId);
      toast.error('Bulk sync encountered an error.');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* SEARCH & CONTROLS TOOLBAR (Always visible) */}
      <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-3 shadow-sm flex flex-wrap items-center gap-2.5">
        {/* 1. Search Box (Adjusts size based on data presence) */}
        <div className={`relative ${hasTrackingData ? 'w-full sm:w-72 lg:w-80' : 'w-full sm:w-80 lg:w-96'} shrink-0`}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order ID, AWB, influencer name, phone, batch code..."
            className="w-full h-10 bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* 2. Upload Dropdown [Upload ▼] (Always available) */}
        <div className="relative shrink-0" ref={uploadDropdownRef}>
          {/* Hidden File Inputs for ST Courier and Delhivery */}
          <input
            type="file"
            ref={stFileInputRef}
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => handleCourierFileChange(e, 'ST Courier')}
          />
          <input
            type="file"
            ref={delhiveryFileInputRef}
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => handleCourierFileChange(e, 'Delhivery')}
          />

          <button
            type="button"
            onClick={() => setIsUploadDropdownOpen(prev => !prev)}
            className="h-10 px-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/30 cursor-pointer border-0 outline-none focus:outline-none shrink-0"
            title="Upload Shipments"
          >
            <Upload size={13} />
            <span>Upload</span>
            <ChevronDown size={12} className={`transition-transform duration-200 ${isUploadDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isUploadDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-64 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => handleTriggerCourierUpload('ST Courier')}
                className="w-full text-left p-2.5 rounded-lg hover:bg-purple-600/20 hover:border-purple-500/40 border border-transparent transition-all group flex items-start gap-3 cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-purple-950/80 border border-purple-800/60 text-purple-400 group-hover:text-purple-300 group-hover:bg-purple-900/60 shrink-0 mt-0.5">
                  <Upload size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-100 group-hover:text-white">Upload for ST Courier</div>
                  <div className="text-[11px] text-slate-400 group-hover:text-slate-300 mt-0.5">Upload shipments for ST Courier</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerCourierUpload('Delhivery')}
                className="w-full text-left p-2.5 rounded-lg hover:bg-purple-600/20 hover:border-purple-500/40 border border-transparent transition-all group flex items-start gap-3 cursor-pointer mt-1"
              >
                <div className="p-2 rounded-lg bg-purple-950/80 border border-purple-800/60 text-purple-400 group-hover:text-purple-300 group-hover:bg-purple-900/60 shrink-0 mt-0.5">
                  <Upload size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-100 group-hover:text-white">Upload for Delhivery</div>
                  <div className="text-[11px] text-slate-400 group-hover:text-slate-300 mt-0.5">Upload shipments for Delhivery</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Controls displayed ONLY when tracking data exists */}
        {hasTrackingData && (
          <>
            {/* 3. Sync (Renamed from Auto Sync All, preserves identical sync workflow) */}
            <button
              type="button"
              onClick={handleAutoSyncAll}
              disabled={isBulkSyncing}
              className="h-10 px-3.5 bg-[#141b2d] hover:bg-[#1c263f] text-slate-200 border border-slate-700/80 hover:border-purple-500/50 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Sync shipments with courier status"
            >
              <RefreshCw size={13} className={isBulkSyncing ? 'animate-spin text-purple-400' : 'text-purple-400'} />
              <span>{isBulkSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* 4. All Couriers */}
            <select
              value={selectedCourier}
              onChange={(e) => setSelectedCourier(e.target.value)}
              className="h-10 bg-slate-900 border border-slate-700/80 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer shrink-0"
            >
              <option value="All">All Couriers</option>
              {availableCouriers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* 5. All Status */}
            <select
              value={selectedStatusDropdown}
              onChange={(e) => setSelectedStatusDropdown(e.target.value)}
              className="h-10 bg-slate-900 border border-slate-700/80 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer shrink-0"
            >
              <option value="All">All Status</option>
              <option value="Delivered">Delivered</option>
              <option value="In Transit">In Transit</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Exception">Exception</option>
              <option value="Failed Attempt">Failed Attempt</option>
              <option value="Pending">Pending</option>
              <option value="Info Received">Info Received</option>
              <option value="Expired">Expired</option>
            </select>

            {/* 6. Date Range Inputs (From - To for Estimated Delivery Date) */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 h-10 shrink-0">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="From Estimated Delivery Date"
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer w-28"
              />
              <span className="text-slate-500 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="To Estimated Delivery Date"
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer w-28"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Clear dates"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* 7. Clear All Button (Destructive: Permanently clears all tracking records for this campaign) */}
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={isDeleting || allShipments.length === 0}
              className="h-10 px-3.5 bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 text-xs font-semibold rounded-xl border border-slate-700/80 hover:border-rose-700/60 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Delete all tracking shipment records for this campaign"
            >
              <Trash2 size={13} className="text-rose-400" />
              <span>Clear All</span>
            </button>

            {/* 8. Last Sync Info + DB Refresh */}
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium shrink-0 sm:ml-auto">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 h-10 shadow-sm">
                <span className={`w-2 h-2 rounded-full ${isLoadingDb ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'}`} />
                <span className="text-slate-300 whitespace-nowrap text-xs">
                  {isLoadingDb ? 'Syncing...' : `Last Sync: ${lastSyncTime || 'Pending initial sync'}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => loadShipments()}
                disabled={isLoadingDb}
                className="w-10 h-10 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
                title="Refresh shipments from Supabase database"
              >
                <RefreshCw size={13} className={isLoadingDb ? 'animate-spin text-purple-400' : ''} />
              </button>
            </div>
          </>
        )}
      </div>

      {allShipments.length === 0 ? (
        <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-12 text-center text-slate-400 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-800/50 flex items-center justify-center text-purple-400 mx-auto mb-4 shadow-sm">
            <Truck size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-100 mb-1">No Shipments Tracked Yet</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Upload courier shipments above or dispatch influencers to begin tracking.
          </p>
        </div>
      ) : (
        <>

      {/* 4. STATUS FILTER PILLS + ESTIMATED DELIVERY DATE + BULK MOVE */}
      <div className="flex items-center justify-between gap-3 w-full">
        {/* Status Pills + Calendar Icon (Kept together on the same row) */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 overflow-x-auto [scrollbar-width:none]">
          {STATUS_PILLS.map((pill) => {
            const count = statusTabCounts[pill] || 0;
            const isActive = selectedStatusTab === pill;

            let badgeBorderClass = 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200';
            if (pill === 'All') {
              badgeBorderClass = isActive
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                : 'border-purple-800/40 text-purple-300 hover:border-purple-600';
            } else if (pill === 'Exception') {
              badgeBorderClass = isActive
                ? 'bg-rose-600 text-white border-rose-500'
                : 'border-rose-800/40 text-rose-400 hover:border-rose-600';
            } else if (pill === 'Failed Attempt') {
              badgeBorderClass = isActive
                ? 'bg-amber-600 text-white border-amber-500'
                : 'border-amber-800/40 text-amber-400 hover:border-amber-600';
            } else if (pill === 'Pending') {
              badgeBorderClass = isActive
                ? 'bg-amber-500 text-white border-amber-400'
                : 'border-amber-700/40 text-amber-300 hover:border-amber-500';
            } else if (pill === 'In Transit') {
              badgeBorderClass = isActive
                ? 'bg-blue-600 text-white border-blue-500'
                : 'border-blue-800/40 text-blue-400 hover:border-blue-600';
            } else if (pill === 'Delivered') {
              badgeBorderClass = isActive
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'border-emerald-800/40 text-emerald-400 hover:border-emerald-600';
            } else if (pill === 'Out for Delivery') {
              badgeBorderClass = isActive
                ? 'bg-cyan-600 text-white border-cyan-500'
                : 'border-cyan-800/40 text-cyan-400 hover:border-cyan-600';
            }

            return (
              <button
                key={pill}
                type="button"
                onClick={() => setSelectedStatusTab(pill)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border bg-[#0b1220] ${badgeBorderClass}`}
              >
                <span>{pill}</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-slate-300'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Calendar Icon Button: Positioned immediately after Expired on the SAME row */}
          <button
            type="button"
            onClick={() => setIsDeliveryCalendarOpen(true)}
            className={`h-8 w-8 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0 flex-shrink-0 border ${
              selectedDeliveryDate || isDeliveryCalendarOpen
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                : 'bg-[#0b1220] border-purple-800/50 text-purple-300 hover:border-purple-500 hover:text-white'
            }`}
            title={
              selectedDeliveryDate
                ? `Estimated Delivery Date: ${formatDDMMYYYY(selectedDeliveryDate)}`
                : 'Estimated Delivery Date Calendar'
            }
            aria-label="Estimated Delivery Date Calendar"
          >
            <Calendar size={15} />
          </button>
        </div>

        {/* Right Action Group: Move to Status Tracking aligned to FAR RIGHT */}
        <div className="ml-auto shrink-0 flex-shrink-0">
          <button
            type="button"
            onClick={handleBulkMoveToStatusTracking}
            disabled={isMovingToStatus || eligibleForStatusTrackingCount === 0}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 flex-shrink-0 ${
              eligibleForStatusTrackingCount > 0
                ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-sm shadow-purple-600/30'
                : 'bg-slate-900/80 text-slate-500 border-slate-800 cursor-not-allowed'
            }`}
            title={eligibleForStatusTrackingCount > 0 ? `Move all ${eligibleForStatusTrackingCount} eligible delivered influencers to Status Tracking` : 'No delivered influencers waiting to be added'}
          >
            <RefreshCw size={13} className={isMovingToStatus ? 'animate-spin' : ''} />
            <span>Move to Status Tracking ({eligibleForStatusTrackingCount})</span>
          </button>
        </div>
      </div>

      {/* Active Estimated Delivery Date Filter Banner */}
      {(selectedDeliveryDate || selectedDeliveryDateEnd) && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-purple-950/40 border border-purple-800/60 rounded-xl text-xs text-purple-200 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span>Filtering by Estimated Delivery Date:</span>
            <span className="font-bold text-white px-2 py-0.5 rounded bg-purple-900/60 border border-purple-700/60 font-mono">
              {selectedDeliveryDate && selectedDeliveryDateEnd
                ? `[ ${formatDDMMYYYY(selectedDeliveryDate)} ] - [ ${formatDDMMYYYY(selectedDeliveryDateEnd)} ]`
                : `[ ${formatDDMMYYYY(selectedDeliveryDate)} ]`}
            </span>
            <span className="text-purple-300">({filteredShipments.length} shipment{filteredShipments.length === 1 ? '' : 's'})</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedDeliveryDate(null);
              setSelectedDeliveryDateEnd(null);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 hover:text-white border border-purple-700/50 text-xs font-semibold transition-colors cursor-pointer"
          >
            <X size={12} />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* 5. SHIPMENT TABLE + PAGINATION (FULL WIDTH) */}
      <div className="flex flex-col bg-[#0b1220] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl w-full">
          {/* Table Container with Internal Vertical Scroll */}
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto [scrollbar-width:thin]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0e1626] text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-bold sticky top-0 z-10 select-none">
                <tr>
                  <th className="px-5 py-3.5 bg-[#0e1626] text-left">ORDER ID</th>
                  <th className="px-5 py-3.5 bg-[#0e1626] text-left">AWB NUMBER</th>
                  <th className="px-5 py-3.5 bg-[#0e1626] text-left">COURIER</th>
                  <th className="px-5 py-3.5 bg-[#0e1626] text-left">STATUS</th>
                  <th className="px-5 py-3.5 bg-[#0e1626] text-left">REMARKS</th>
                  <th className="px-5 py-3.5 bg-[#0e1626] text-left whitespace-nowrap">DISPATCHED DATE</th>
                  <th className="px-5 py-3.5 bg-[#0e1626] text-left whitespace-nowrap">ESTIMATED DELIVERY DATE</th>
                  <th className="px-5 py-3.5 bg-[#0e1626] text-left whitespace-nowrap">DELIVERED DATE</th>
                  <th className="px-5 py-3.5 bg-[#0e1626] text-right min-w-[120px]">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paginatedShipments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 italic">
                      No shipments matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedShipments.map((s) => {
                    const displayOrderId = s.orderId 
                      ? (s.orderId.startsWith('#') ? s.orderId : `#${s.orderId}`)
                      : (s.influencerCode || (s.id.length > 8 ? `#${s.id.slice(0, 8)}` : `#${s.id}`));
                    const displayStatus = getTrackingDisplayStatus(s);
                    const badgeStyle = getTrackingStatusBadgeStyle(displayStatus);

                    return (
                      <tr
                        key={s.id}
                        className="transition-colors hover:bg-slate-850/40"
                      >
                        {/* 1. ORDER ID */}
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-200">
                          {displayOrderId}
                        </td>

                        {/* 2. AWB NUMBER */}
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-200">
                          {s.awbNumber ? (
                            <div className="flex items-center gap-2">
                              <span>{s.awbNumber}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyAwb(s.awbNumber)}
                                className="p-1 text-slate-500 hover:text-purple-300 rounded transition-colors cursor-pointer"
                                title="Copy AWB"
                                aria-label="Copy AWB"
                              >
                                {copiedAwb === s.awbNumber ? <Check size={12} className="text-emerald-400" /> : <Copy size={11} />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">Unassigned</span>
                          )}
                        </td>

                        {/* 3. COURIER */}
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap border ${
                            s.courier.toLowerCase().includes('delhivery')
                              ? 'bg-cyan-950/60 border-cyan-800/60 text-cyan-300'
                              : 'bg-purple-950/60 border-purple-800/60 text-purple-300'
                          }`}>
                            {s.courier}
                          </span>
                        </td>

                        {/* 4. STATUS */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                            <span>{displayStatus}</span>
                          </span>
                        </td>

                        {/* 5. REMARKS */}
                        <td className="px-5 py-3.5 text-slate-300">
                          {s.remarks && s.remarks.trim() ? (
                            <span 
                              className="block max-w-[150px] truncate text-slate-300 font-medium cursor-help hover:text-white transition-colors" 
                              title={s.remarks.trim()}
                            >
                              {s.remarks.trim()}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* 6. DISPATCHED DATE */}
                        <td className="px-5 py-3.5 font-medium text-slate-200 whitespace-nowrap">
                          {(() => {
                            const dateVal = s.dispatchedDate || s.dispatchDate;
                            const formatted = formatDispatchedDate(dateVal);
                            if (formatted === '—') {
                              return <span className="text-slate-500 italic text-[11px]">—</span>;
                            }
                            return (
                              <span className="text-slate-200 font-mono">
                                {formatted}
                              </span>
                            );
                          })()}
                        </td>

                        {/* 6. ESTIMATED DELIVERY DATE */}
                        <td className="px-5 py-3.5 font-medium text-slate-200 whitespace-nowrap">
                          {(() => {
                            const dateVal = s.estimatedDeliveryDate || s.expectedDeliveryDate;
                            const formatted = formatEstimatedDeliveryDate(dateVal);
                            if (formatted === '—') {
                              return <span className="text-slate-500 italic text-[11px]">—</span>;
                            }
                            return (
                              <span className="text-slate-200 font-mono">
                                {formatted}
                              </span>
                            );
                          })()}
                        </td>

                        {/* 7. DELIVERED DATE */}
                        <td className="px-5 py-3.5 font-medium text-slate-200 whitespace-nowrap">
                          {(() => {
                            const formatted = formatDeliveredDate(s.deliveredDate);
                            if (formatted === '—') {
                              return <span className="text-slate-500 italic text-[11px]">—</span>;
                            }
                            return (
                              <span className="text-slate-200 font-mono">
                                {formatted}
                              </span>
                            );
                          })()}
                        </td>

                        {/* 8. ACTIONS */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActiveTrackingModalShipment(s)}
                              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-purple-950/70 text-slate-400 hover:text-purple-300 border border-slate-700/80 hover:border-purple-600/60 transition-all flex items-center justify-center cursor-pointer shadow-sm group shrink-0"
                              title="View Shipment Details"
                              aria-label="View Shipment Details"
                            >
                              <Eye size={13} className="group-hover:scale-110 transition-transform text-slate-400 group-hover:text-purple-300" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setShipmentToDelete(s)}
                              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-600/60 transition-all flex items-center justify-center cursor-pointer shadow-sm group shrink-0"
                              title="Delete Shipment"
                              aria-label="Delete Shipment"
                            >
                              <Trash2 size={13} className="group-hover:scale-110 transition-transform text-slate-400 group-hover:text-rose-400" />
                            </button>

                            {(() => {
                              const isDelivered = isShipmentDelivered(s);
                              const { matchedInfluencer } = matchShipmentToInfluencer(s, candidateInfluencers, dispatchRecords);
                              const isAlreadyAdded = matchedInfluencer && existingStatusInfluencerIds.has(String(matchedInfluencer.id));
                              const isMoving = movingShipmentId === s.id;

                              if (isDelivered) {
                                if (isAlreadyAdded) {
                                  return (
                                    <button
                                      type="button"
                                      disabled
                                      className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 transition-all flex items-center justify-center cursor-default shadow-sm shrink-0"
                                      title={`Already added to Status Tracking (${matchedInfluencer?.code || matchedInfluencer?.influencer_name || ''})`}
                                      aria-label="Already added to Status Tracking"
                                    >
                                      <Check size={13} className="text-emerald-400" />
                                    </button>
                                  );
                                }

                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveToStatusTracking(s)}
                                    disabled={isMoving || isMovingToStatus}
                                    className="w-7 h-7 rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-sm hover:shadow-purple-600/30 transition-all flex items-center justify-center cursor-pointer group shrink-0 disabled:opacity-50"
                                    title={matchedInfluencer ? `Move ${matchedInfluencer.code || matchedInfluencer.influencer_name} to Status Tracking` : 'Move to Status Tracking'}
                                    aria-label="Move to Status Tracking"
                                  >
                                    {isMoving ? (
                                      <RefreshCw size={13} className="animate-spin text-white" />
                                    ) : (
                                      <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform text-white" />
                                    )}
                                  </button>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  disabled
                                  className="w-7 h-7 rounded-lg bg-slate-900/60 text-slate-600 border border-slate-800/80 transition-all flex items-center justify-center cursor-not-allowed shadow-sm shrink-0"
                                  title="Only Delivered shipments qualify for Status Tracking"
                                  aria-label="Move to Status Tracking (Disabled - Only Delivered shipments qualify)"
                                >
                                  <ArrowRight size={13} className="opacity-30" />
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer (Matching Screenshot) */}
          <div className="px-4 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 bg-[#0e1626]">
            <div>
              Showing {filteredShipments.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1} – {Math.min(safeCurrentPage * pageSize, filteredShipments.length)} of {filteredShipments.length} shipments
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 flex items-center justify-center text-slate-300 cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Page Number Pills */}
              {paginationItems.map((item) => {
                if (item.type === 'ellipsis') {
                  return (
                    <span key={item.key} className="text-slate-600 px-1 select-none">
                      ...
                    </span>
                  );
                }

                const pageNum = item.page!;
                const isActive = safeCurrentPage === pageNum;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 flex items-center justify-center text-slate-300 cursor-pointer"
                title="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page</span>
            </div>
          </div>
        </div>
        </>
      )}

      {/* 6. TRACKING DETAIL MODAL POPUP */}
      {activeTrackingModalShipment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0e1626] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#121c30]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Truck size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    Shipment Tracking Details
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono">
                    AWB: {activeTrackingModalShipment.awbNumber || 'None'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTrackingModalShipment(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-5 [scrollbar-width:thin]">
              {/* Influencer & Dispatch Info Summary Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Influencer:</span>
                  <span className="font-bold text-white text-sm">
                    {activeTrackingModalShipment.creatorName} {activeTrackingModalShipment.username !== '—' ? `(${activeTrackingModalShipment.username})` : ''}
                  </span>
                </div>
                {(activeTrackingModalShipment.orderId || activeTrackingModalShipment.influencerCode) && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Order / Reference:</span>
                    <span className="font-mono text-slate-200">
                      {activeTrackingModalShipment.orderId
                        ? (activeTrackingModalShipment.orderId.startsWith('#') ? activeTrackingModalShipment.orderId : `#${activeTrackingModalShipment.orderId}`)
                        : activeTrackingModalShipment.influencerCode}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">AWB / Waybill:</span>
                  <span className="font-mono font-bold text-purple-300">{activeTrackingModalShipment.awbNumber || '—'}</span>
                </div>
                {activeTrackingModalShipment.phoneNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Phone:</span>
                    <span className="font-mono text-slate-200">{activeTrackingModalShipment.phoneNumber}</span>
                  </div>
                )}
                {activeTrackingModalShipment.batchCode && activeTrackingModalShipment.batchCode !== '—' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Batch Code:</span>
                    <span className="font-mono font-bold text-purple-300">{activeTrackingModalShipment.batchCode}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Courier Partner:</span>
                  <span className="font-semibold text-slate-200">{activeTrackingModalShipment.courier}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Dispatch Date:</span>
                  <span className="text-slate-200">{activeTrackingModalShipment.dispatchDate || '—'}</span>
                </div>
                {(activeTrackingModalShipment.estimatedDeliveryDate || activeTrackingModalShipment.expectedDeliveryDate) && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Estimated Delivery:</span>
                    <span className="text-slate-200 font-semibold font-mono">
                      {formatEstimatedDeliveryDate(activeTrackingModalShipment.estimatedDeliveryDate || activeTrackingModalShipment.expectedDeliveryDate)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Delivered Date:</span>
                  <span className="text-emerald-400 font-semibold font-mono">
                    {formatDeliveredDate(activeTrackingModalShipment.deliveredDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status Source:</span>
                  {activeTrackingModalShipment.courier.toLowerCase().includes('delhivery') ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950/70 border border-cyan-800/60 text-cyan-300">
                      <span>Uploaded Delhivery File</span>
                      <span className="text-[9px] font-bold px-1 bg-cyan-900/60 rounded text-cyan-200">UPLOADED FILE</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950/70 border border-purple-800/60 text-purple-300">
                      <span>Live ST Courier Tracking</span>
                      <span className="text-[9px] font-bold px-1 bg-purple-900/60 rounded text-purple-200">LIVE API</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">
                    {activeTrackingModalShipment.courier.toLowerCase().includes('delhivery') ? 'Imported:' : 'Last Synced:'}
                  </span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {activeTrackingModalShipment.lastSyncedAt || activeTrackingModalShipment.trackingDateTime || activeTrackingModalShipment.dispatchDate || '—'}
                  </span>
                </div>
                {(() => {
                  const modalDisplayStatus = getTrackingDisplayStatus(activeTrackingModalShipment);
                  const badgeStyle = getTrackingStatusBadgeStyle(modalDisplayStatus);
                  return (
                    <>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                        <span className="text-slate-400">Status:</span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                          <span>{modalDisplayStatus}</span>
                        </span>
                      </div>
                      {activeTrackingModalShipment.rawStatus && activeTrackingModalShipment.rawStatus !== modalDisplayStatus && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Raw Courier Status:</span>
                          <span className="font-mono text-slate-400 text-[11px]">{activeTrackingModalShipment.rawStatus}</span>
                        </div>
                      )}
                      {activeTrackingModalShipment.remarks && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Remarks:</span>
                          <span className="text-slate-300 text-[11px] max-w-[260px] truncate text-right font-medium" title={activeTrackingModalShipment.remarks}>{activeTrackingModalShipment.remarks}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Courier Tracking Timeline Visualizer */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} className="text-purple-400" />
                  <span>Shipment Timeline Progression</span>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
                  {(() => {
                    const cat = getShipmentCategory(activeTrackingModalShipment);
                    const isDelivered = cat === 'Delivered';
                    const isOut = isDelivered || cat === 'Out for Delivery';
                    const isTransit = isOut || cat === 'In Transit';
                    const isPicked = isTransit || cat === 'Info Received';

                    const steps = [
                      { label: 'Dispatch Created', done: true, current: !isPicked },
                      { label: 'Picked Up', done: isPicked, current: isPicked && !isTransit },
                      { label: 'In Transit', done: isTransit, current: isTransit && !isOut },
                      { label: 'Out for Delivery', done: isOut, current: isOut && !isDelivered },
                      { label: 'Delivered', done: isDelivered, current: isDelivered }
                    ];

                    return (
                      <div className="space-y-4">
                        {steps.map((step, idx) => (
                          <div key={step.label} className="flex items-start gap-3 relative">
                            {idx < steps.length - 1 && (
                              <div className={`absolute left-3 top-6 w-0.5 h-6 -ml-px ${
                                step.done ? 'bg-purple-500' : 'bg-slate-800'
                              }`} />
                            )}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 shrink-0 ${
                              step.done
                                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                            }`}>
                              {step.done ? <Check size={12} /> : idx + 1}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className={`text-xs font-bold ${
                                step.done ? 'text-white' : 'text-slate-500'
                              }`}>
                                {step.label}
                              </div>
                              {step.current && (
                                <div className="text-[10px] text-purple-400 font-semibold mt-0.5">
                                  Current Status
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Latest Scraped Location / Activity */}
              {activeTrackingModalShipment.lastLocation && activeTrackingModalShipment.lastLocation !== '-' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Latest Activity / Location
                  </div>
                  <div className="text-slate-200 font-medium leading-relaxed">
                    {activeTrackingModalShipment.lastLocation}
                  </div>
                  {activeTrackingModalShipment.trackingDateTime && activeTrackingModalShipment.trackingDateTime !== '-' && (
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                      {activeTrackingModalShipment.trackingDateTime}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-[#121c30] flex items-center justify-between gap-3">
              {activeTrackingModalShipment.trackingUrl ? (
                <a
                  href={activeTrackingModalShipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-purple-200 border border-purple-800/50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Open Courier Tracking</span>
                  <ExternalLink size={12} />
                </a>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {activeTrackingModalShipment.courier.toLowerCase().includes('delhivery') ? (
                  <div className="px-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <FileSpreadsheet size={13} className="text-cyan-400" />
                    <span>Status Sourced from Uploaded File</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSyncShipment(activeTrackingModalShipment)}
                    disabled={syncingIds.includes(activeTrackingModalShipment.id)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/30"
                  >
                    <RefreshCw size={12} className={syncingIds.includes(activeTrackingModalShipment.id) ? 'animate-spin' : ''} />
                    <span>Sync Now</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTrackingModalShipment(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload for Courier Shipments Modal (ST Courier or Delhivery) */}
      {isUploadModalOpen && (
        <UploadCourierShipmentModal
          campaign={campaign}
          courier={selectedUploadCourier}
          influencers={allActiveInfluencers || dispatchedInfluencers}
          initialFile={selectedUploadFile}
          onClose={() => {
            setIsUploadModalOpen(false);
            setSelectedUploadFile(null);
          }}
          onSuccess={async () => {
            setIsUploadModalOpen(false);
            setSelectedUploadFile(null);
            await loadShipments();
            if (onRefreshData) {
              await onRefreshData();
            }
          }}
        />
      )}

      {/* Confirmation Modal for Clearing/Deleting All Campaign Tracking Data */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete All Tracking Data?"
        message="This will permanently delete all tracking shipment records for this campaign from Supabase and local storage. Corresponding Status Tracking records for these shipments will also be automatically removed. Master influencer profiles will NOT be deleted. This action cannot be undone."
        confirmText={isDeleting ? "Deleting..." : "Delete All"}
        cancelText="Cancel"
        isDestructive={true}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
          }
        }}
        onConfirm={handleClearAllTrackingData}
      />

      {/* Confirmation Modal for Deleting a Single Tracking Record */}
      <ConfirmModal
        isOpen={Boolean(shipmentToDelete)}
        title="Delete Tracking Shipment?"
        message={`Are you sure you want to delete tracking shipment ${shipmentToDelete?.awbNumber || shipmentToDelete?.influencerCode || shipmentToDelete?.orderId || ''}? If this shipment was added to Status Tracking, its status tracking record will also be removed. Master influencer profiles will NOT be deleted.`}
        confirmText={isDeletingSingle ? "Deleting..." : "Delete Shipment"}
        cancelText="Cancel"
        isDestructive={true}
        onClose={() => {
          if (!isDeletingSingle) {
            setShipmentToDelete(null);
          }
        }}
        onConfirm={handleDeleteSingleShipment}
      />

      {/* 8. ESTIMATED DELIVERY DATE CENTERED MODAL */}
      {isDeliveryCalendarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDeliveryCalendarOpen(false);
            }
          }}
        >
          <div
            className="bg-[#0e1626] border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-[580px] max-h-[92vh] flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Modal Header (Fixed) */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#121c30] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-800/60 text-purple-400">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Estimated Delivery Date</h3>
                  <p className="text-[11px] text-slate-400">Filter shipments by estimated delivery schedule</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeliveryCalendarOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 flex items-center justify-center transition-colors cursor-pointer"
                title="Close modal"
                aria-label="Close modal"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body: Scrollable if necessary, but fits naturally */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 [scrollbar-width:thin]">
              {/* 2. DATE FILTER CARD */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Select Date or Range</span>
                  {(selectedDeliveryDate || selectedDeliveryDateEnd) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDeliveryDate(null);
                        setSelectedDeliveryDateEnd(null);
                      }}
                      className="text-purple-400 hover:text-purple-300 text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block mb-1">Start Date</span>
                    <input
                      type="date"
                      value={selectedDeliveryDate || ''}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        setSelectedDeliveryDate(val);
                        if (val) {
                          const [y, m] = val.split('-').map(Number);
                          if (y && m) {
                            setCalendarYear(y);
                            setCalendarMonth(m - 1);
                          }
                        }
                      }}
                      title="Start Date"
                      className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-purple-500 w-full cursor-pointer"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block mb-1">End Date</span>
                    <input
                      type="date"
                      value={selectedDeliveryDateEnd || ''}
                      onChange={(e) => setSelectedDeliveryDateEnd(e.target.value || null)}
                      title="End Date"
                      className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-purple-500 w-full cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* 3. DELIVERY SUMMARY CARDS */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Today's Estimated</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-lg sm:text-xl font-black font-mono ${deliverySchedule.todayCount > 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {deliverySchedule.todayCount}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Deliveries</span>
                    {deliverySchedule.todayCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-bold ml-auto">
                        Due Today
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Scheduled</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg sm:text-xl font-black font-mono text-purple-300">
                        {deliverySchedule.totalWithDate}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Shipments</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {deliverySchedule.sortedList.length} {deliverySchedule.sortedList.length === 1 ? 'Date' : 'Dates'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. MONTH CALENDAR VIEW (MAIN UI) */}
              <div className="space-y-2">
                {/* Month / Year Header with Navigation */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="w-8 h-8 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 flex items-center justify-center transition-colors cursor-pointer"
                    title="Previous Month"
                    aria-label="Previous Month"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-white font-mono">
                    {monthLabel}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="w-8 h-8 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 flex items-center justify-center transition-colors cursor-pointer"
                    title="Next Month"
                    aria-label="Next Month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                    <div key={d} className="py-0.5">{d}</div>
                  ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 px-0.5">
                  {calendarCells.map((cell) => {
                    const isStart = selectedDeliveryDate === cell.ymd;
                    const isEnd = selectedDeliveryDateEnd === cell.ymd;
                    const isSelected = isStart || isEnd;
                    const isInRange = Boolean(
                      selectedDeliveryDate &&
                      selectedDeliveryDateEnd &&
                      cell.ymd > selectedDeliveryDate &&
                      cell.ymd < selectedDeliveryDateEnd
                    );

                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        onClick={() => handleSelectCalendarDate(cell.ymd)}
                        className={`min-h-[50px] sm:min-h-[54px] rounded-xl p-1 sm:p-1.5 flex flex-col items-center justify-between text-xs transition-all relative cursor-pointer border ${
                          isSelected
                            ? 'bg-purple-600 border-purple-400 text-white font-bold shadow-md shadow-purple-600/40 z-10'
                            : isInRange
                            ? 'bg-purple-900/40 border-purple-800/60 text-purple-100'
                            : cell.count > 0
                            ? 'bg-slate-900/90 border-purple-900/40 hover:border-purple-600 hover:bg-slate-800 text-slate-100'
                            : cell.isCurrentMonth
                            ? 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700 hover:bg-slate-800/60 text-slate-300'
                            : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400 hover:bg-slate-900/30'
                        } ${cell.isToday && !isSelected ? 'ring-1.5 ring-emerald-500/80' : ''}`}
                        title={cell.count > 0 ? `${cell.ymd}: ${cell.count} estimated delivery(ies)` : cell.ymd}
                      >
                        {/* Top row: Day Number + Today micro-badge */}
                        <div className="w-full flex items-center justify-between px-0.5 leading-none">
                          <span className={`text-[11px] sm:text-xs font-bold ${
                            isSelected
                              ? 'text-white'
                              : cell.isCurrentMonth
                              ? 'text-slate-200'
                              : 'text-slate-600'
                          }`}>
                            {cell.dayNum}
                          </span>
                          {cell.isToday && (
                            <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded leading-none ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/60'
                            }`}>
                              Today
                            </span>
                          )}
                        </div>

                        {/* Bottom row: Delivery count badge (ONLY if cell.count > 0) */}
                        <div className="w-full flex items-center justify-center min-h-[18px]">
                          {cell.count > 0 && (
                            <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md leading-none shadow-sm ${
                              isSelected
                                ? 'bg-white/25 text-white border border-white/40'
                                : isInRange
                                ? 'bg-purple-800 text-purple-100 border border-purple-700'
                                : 'bg-purple-950 border border-purple-700/70 text-purple-300'
                            }`}>
                              {cell.count}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 5. Modal Footer (Fixed) */}
            <div className="px-5 py-3 border-t border-slate-800 bg-[#121c30] flex items-center justify-between text-xs flex-shrink-0">
              <span className="text-[11px] text-slate-400 truncate max-w-[280px]">
                {selectedDeliveryDate
                  ? `Filter: ${formatDDMMYYYY(selectedDeliveryDate)}${selectedDeliveryDateEnd ? ` to ${formatDDMMYYYY(selectedDeliveryDateEnd)}` : ''}`
                  : 'Select a date or range to filter shipments'}
              </span>
              <div className="flex items-center gap-2">
                {(selectedDeliveryDate || selectedDeliveryDateEnd) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDeliveryDate(null);
                      setSelectedDeliveryDateEnd(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-purple-400 hover:text-purple-300 font-bold cursor-pointer text-xs transition-colors border border-slate-700/80"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDeliveryCalendarOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer text-xs transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
