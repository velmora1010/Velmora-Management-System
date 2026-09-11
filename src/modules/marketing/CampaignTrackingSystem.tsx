import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import type { DispatchDetails } from '../../hooks/marketing/useCampaignDispatch';
import type { DispatchBatch } from '../../services/dispatchBatchService';
import {
  syncSingleShipment,
  syncAllShipments,
  normalizeTrackingStatus,
  getCourierTrackingUrl,
  getTrackingStatusBadgeStyle,
  getTrackingCache,
  getLastCampaignSyncTime,
  getCampaignShipments,
  fetchCampaignShipmentsFromDb,
  deleteCampaignShipmentsFromDb,
  TrackingStatusCategory,
  InfluencerDispatchedShipment
} from '../../services/influencerTrackingService';
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
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { UploadCourierShipmentModal } from '../../components/marketing/UploadCourierShipmentModal';

interface CampaignTrackingSystemProps {
  campaign: Campaign;
  dispatchedInfluencers: CampaignInfluencer[];
  dispatchRecords: DispatchDetails[];
  savedBatches: DispatchBatch[];
  onBackToDispatched?: () => void;
  onRefreshData?: () => Promise<void>;
  allActiveInfluencers?: CampaignInfluencer[];
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


export const CampaignTrackingSystem: React.FC<CampaignTrackingSystemProps> = ({
  campaign,
  dispatchedInfluencers,
  dispatchRecords,
  savedBatches,
  onBackToDispatched: _onBackToDispatched,
  onRefreshData,
  allActiveInfluencers
}) => {
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<TrackingStatusCategory>('All');
  const [selectedCourier, setSelectedCourier] = useState('All');
  const [selectedStatusDropdown, setSelectedStatusDropdown] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  // Campaign imported shipments (ST Courier + Delhivery) - loads from DB with local storage cache fallback
  const [campaignShipments, setCampaignShipments] = useState<InfluencerDispatchedShipment[]>(() => getCampaignShipments(campaign.id));
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  // Local tracking overrides/cache state
  const [trackingCache, setTrackingCache] = useState<Record<string, any>>(() => getTrackingCache(campaign.id));

  // Load shipments directly from Supabase database scoped to current campaign
  const loadShipments = useCallback(async () => {
    setIsLoadingDb(true);
    try {
      const dbShipments = await fetchCampaignShipmentsFromDb(campaign.id);
      setCampaignShipments(dbShipments);
      setTrackingCache(getTrackingCache(campaign.id));
      setLastSyncTime(getLastCampaignSyncTime(campaign.id));
    } catch (err) {
      console.error('Failed to load campaign shipments from Supabase:', err);
    } finally {
      setIsLoadingDb(false);
    }
  }, [campaign.id]);

  // Reload cache and shipments when campaign changes
  useEffect(() => {
    loadShipments();
    setCurrentPage(1);
  }, [loadShipments]);

  // Build unified dispatched shipments strictly for the current campaign
  // Combines uploaded campaign shipments (ST Courier & Delhivery) and dispatched influencers
  const allShipments: InfluencerDispatchedShipment[] = useMemo(() => {
    const shipmentMap = new Map<string, InfluencerDispatchedShipment>();

    // 1. First index uploaded campaign shipments (ST Courier & Delhivery)
    for (const cs of campaignShipments) {
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

      shipmentMap.set(uniqueKey, {
        ...cs,
        status: cached?.status || cs.status,
        rawStatus: cached?.rawStatus || cs.rawStatus,
        statusSource,
        sourceType,
        lastLocation: cached?.lastLocation || cs.lastLocation,
        trackingDateTime: cached?.trackingDateTime || cs.trackingDateTime,
        lastSyncedAt: cached?.lastSyncedAt || cs.lastSyncedAt,
        syncError: cached?.syncError || cs.syncError,
        trackingUrl: cs.trackingUrl || getCourierTrackingUrl(cs.courier, cs.awbNumber)
      });
    }

    // 2. Enrich uploaded campaign tracking shipments with matched influencer details
    for (const inf of dispatchedInfluencers) {
      const infId = String(inf.id);
      const dispatch = inf.dispatchDetails || dispatchRecords.find(d => String(d.influencer_id) === infId);
      const batch = savedBatches.find(b => b.members && b.members.some(m => String(m.influencer_id) === infId));
      const batchCode = batch?.batch_name || '—';
      const batchId = batch?.id;

      const rawAwb = (dispatch?.tracking_id || '').trim();
      const rawCode = (inf.code || '').trim().toLowerCase();
      const dispatchDate = dispatch?.dispatch_date || (batch as any)?.dispatched_date || dispatch?.created_at || '';
      const expectedDeliveryDate = dispatch?.expected_delivery_date || '';

      const username = inf.platforms?.find(p => p.username && p.username.trim())?.username?.trim()
        || inf.influencer_name?.trim()
        || (inf as any).username?.trim()
        || inf.name?.trim()
        || '—';
      const cleanUsername = username.startsWith('@') ? username : `@${username}`;

      const awbKey = rawAwb ? rawAwb.toLowerCase().trim() : '';

      shipmentMap.forEach((existing, key) => {
        const matchesAwb = awbKey && (existing.awbNumber || '').toLowerCase().trim() === awbKey;
        const matchesId = existing.influencerId && String(existing.influencerId) === infId;
        const matchesCode = rawCode && (existing.influencerCode || existing.orderId || '').toLowerCase().trim() === rawCode;

        if (matchesAwb || matchesId || matchesCode) {
          shipmentMap.set(key, {
            ...existing,
            influencerId: infId,
            creatorName: existing.creatorName === 'Influencer Not Matched' ? (inf.influencer_name || inf.name || 'Influencer') : existing.creatorName,
            username: existing.username === '—' ? cleanUsername : existing.username,
            influencerCode: existing.influencerCode || inf.code || '',
            profilePhoto: existing.profilePhoto || inf.profile_file_url || '',
            phoneNumber: existing.phoneNumber || inf.phone_number || dispatch?.phone_number || '',
            altPhoneNumber: existing.altPhoneNumber || dispatch?.alternative_phone_number || '',
            state: existing.state || inf.state || dispatch?.state || '',
            batchId: existing.batchId || batchId,
            batchCode: existing.batchCode !== '—' ? existing.batchCode : batchCode,
            dispatchDate: existing.dispatchDate || dispatchDate,
            expectedDeliveryDate: existing.expectedDeliveryDate || expectedDeliveryDate
          });
        }
      });
    }

    return Array.from(shipmentMap.values());
  }, [dispatchedInfluencers, dispatchRecords, savedBatches, campaignShipments, trackingCache]);

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
      if (s.status === 'In Transit') inTransit++;
      else if (s.status === 'Out for Delivery') outForDelivery++;
      else if (s.status === 'Delivered') delivered++;
      else if (s.status === 'Exception') exception++;
      else if (s.status === 'Failed Attempt') failedAttempt++;
      else if (s.status === 'Pending') pending++;
      else if (s.status === 'Info Received') infoReceived++;
      else if (s.status === 'Expired') expired++;
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

  // Filtered Shipments
  const filteredShipments = useMemo(() => {
    return allShipments.filter(s => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = s.creatorName.toLowerCase().includes(query);
        const matchesUser = s.username.toLowerCase().includes(query);
        const matchesPhone = s.phoneNumber.toLowerCase().includes(query) || s.altPhoneNumber.toLowerCase().includes(query);
        const matchesAwb = s.awbNumber.toLowerCase().includes(query);
        const matchesBatch = s.batchCode.toLowerCase().includes(query);
        const matchesCourier = s.courier.toLowerCase().includes(query);
        const matchesCode = s.influencerCode.toLowerCase().includes(query);
        const matchesOrderId = (s.id || '').toLowerCase().includes(query);

        if (!matchesName && !matchesUser && !matchesPhone && !matchesAwb && !matchesBatch && !matchesCourier && !matchesCode && !matchesOrderId) {
          return false;
        }
      }

      // 2. Courier filter
      if (selectedCourier !== 'All' && s.courier.toLowerCase() !== selectedCourier.toLowerCase()) {
        return false;
      }

      // 3. Status Tab filter (pills)
      if (selectedStatusTab !== 'All' && s.status !== selectedStatusTab) {
        return false;
      }

      // 4. Status Dropdown filter
      if (selectedStatusDropdown !== 'All' && s.status !== selectedStatusDropdown) {
        return false;
      }

      // 5. Date Range filter (matches dispatchDate)
      if (startDate || endDate) {
        if (!s.dispatchDate) return false;
        const d = new Date(s.dispatchDate);
        if (isNaN(d.getTime())) return true;
        if (startDate) {
          const start = new Date(startDate);
          if (d < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
      }

      return true;
    });
  }, [allShipments, searchTerm, selectedCourier, selectedStatusTab, selectedStatusDropdown, startDate, endDate]);

  // Reset pagination whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCourier, selectedStatusTab, selectedStatusDropdown, startDate, endDate]);

  // Paginated Shipments
  const totalShipmentsCount = filteredShipments.length;
  const totalPages = Math.max(1, Math.ceil(totalShipmentsCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedShipments = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredShipments.slice(startIdx, startIdx + pageSize);
  }, [filteredShipments, safeCurrentPage, pageSize]);

  // Delete All Tracking Records Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Clear All: Permanently deletes all tracking records for this campaign from Supabase
  const handleClearAllTrackingData = async () => {
    if (!campaign?.id) {
      toast.error('Unable to clear tracking data because the current campaign could not be identified.');
      return;
    }

    setIsDeleting(true);
    const toastId = toast.loading('Deleting tracking data...');

    try {
      const result = await deleteCampaignShipmentsFromDb(campaign.id);

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
      setStartDate('');
      setEndDate('');
      setCurrentPage(1);

      // Re-verify from DB
      await loadShipments();

      toast.success('Tracking data cleared successfully.', { id: toastId });

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

  // Copy AWB Helper
  const handleCopyAwb = (awb: string) => {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopiedAwb(awb);
    toast.success(`AWB ${awb} copied to clipboard!`);
    setTimeout(() => setCopiedAwb(null), 2000);
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
      s.status !== 'Delivered'
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

            {/* 6. Date Range Inputs (From - To) */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 h-10 shrink-0">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="From date"
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer w-28"
              />
              <span className="text-slate-500 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="To date"
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer w-28"
              />
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

      {/* 4. STATUS FILTER PILLS (Matching Screenshot order & color schemes) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border bg-[#0b1220] ${badgeBorderClass}`}
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
      </div>

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
                  <th className="px-5 py-3.5 bg-[#0e1626] text-right w-24">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paginatedShipments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                      No shipments matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedShipments.map((s) => {
                    const displayOrderId = s.orderId 
                      ? (s.orderId.startsWith('#') ? s.orderId : `#${s.orderId}`)
                      : (s.influencerCode || (s.id.length > 8 ? `#${s.id.slice(0, 8)}` : `#${s.id}`));
                    const badgeStyle = getTrackingStatusBadgeStyle(s.status);

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
                            <span>{s.status}</span>
                          </span>
                        </td>

                        {/* 5. ACTIONS */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => setActiveTrackingModalShipment(s)}
                              className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-purple-950/70 text-slate-400 hover:text-purple-300 border border-slate-700/80 hover:border-purple-600/60 transition-all flex items-center justify-center cursor-pointer shadow-sm group"
                              title="View Shipment Details"
                              aria-label="View Shipment Details"
                            >
                              <Eye size={15} className="group-hover:scale-110 transition-transform text-slate-400 group-hover:text-purple-300" />
                            </button>
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
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && safeCurrentPage > 3) {
                  pageNum = safeCurrentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      safeCurrentPage === pageNum
                        ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {totalPages > 5 && safeCurrentPage < totalPages - 2 && (
                <>
                  <span className="text-slate-600 px-0.5">...</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {totalPages}
                  </button>
                </>
              )}

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
                {activeTrackingModalShipment.expectedDeliveryDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Expected Delivery:</span>
                    <span className="text-slate-200">{activeTrackingModalShipment.expectedDeliveryDate}</span>
                  </div>
                )}
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
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400">Current Status:</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getTrackingStatusBadgeStyle(activeTrackingModalShipment.status).bg} ${getTrackingStatusBadgeStyle(activeTrackingModalShipment.status).text} ${getTrackingStatusBadgeStyle(activeTrackingModalShipment.status).border}`}>
                    {activeTrackingModalShipment.status}
                  </span>
                </div>
              </div>

              {/* Courier Tracking Timeline Visualizer */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} className="text-purple-400" />
                  <span>Shipment Timeline Progression</span>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
                  {(() => {
                    const st = activeTrackingModalShipment.status;
                    const isDelivered = st === 'Delivered';
                    const isOut = isDelivered || st === 'Out for Delivery';
                    const isTransit = isOut || st === 'In Transit';
                    const isPicked = isTransit || st === 'Info Received';

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
        message="This will permanently delete all imported ST Courier and Delhivery shipment tracking records for this campaign. This action cannot be undone."
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
    </div>
  );
};
