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
  TrackingStatusCategory,
  InfluencerDispatchedShipment
} from '../../services/influencerTrackingService';
import {
  Truck,
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  X,
  RotateCcw,
  Check,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Phone,
  Calendar,
  Layers,
  Copy,
  AlertTriangle,
  Send,
  Navigation,
  Bot,
  Sparkles,
  MoreVertical,
  SlidersHorizontal,
  Info,
  History,
  Target
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CampaignTrackingSystemProps {
  campaign: Campaign;
  dispatchedInfluencers: CampaignInfluencer[];
  dispatchRecords: DispatchDetails[];
  savedBatches: DispatchBatch[];
  onBackToDispatched: () => void;
  onRefreshData?: () => Promise<void>;
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

interface BotMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  action?: {
    label: string;
    filterStatus?: TrackingStatusCategory;
    filterCourier?: string;
    searchQuery?: string;
  };
}

export const CampaignTrackingSystem: React.FC<CampaignTrackingSystemProps> = ({
  campaign,
  dispatchedInfluencers,
  dispatchRecords,
  savedBatches,
  onBackToDispatched,
  onRefreshData
}) => {
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<TrackingStatusCategory>('All');
  const [selectedCourier, setSelectedCourier] = useState('All');
  const [selectedStatusDropdown, setSelectedStatusDropdown] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Table selection
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);

  // Syncing state
  const [syncingIds, setSyncingIds] = useState<string[]>([]);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => getLastCampaignSyncTime(campaign.id));

  // Modals state
  const [activeTrackingModalShipment, setActiveTrackingModalShipment] = useState<InfluencerDispatchedShipment | null>(null);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  // Local tracking overrides/cache state
  const [trackingCache, setTrackingCache] = useState<Record<string, any>>(() => getTrackingCache(campaign.id));

  // Bot State
  const [botMessages, setBotMessages] = useState<BotMessage[]>([]);
  const [botInput, setBotInput] = useState('');
  const [lastBotQueryContext, setLastBotQueryContext] = useState<string | null>(null);
  const campaignTitle = campaign.campaign_name || (campaign as any).name || 'Campaign';
  const botChatEndRef = useRef<HTMLDivElement>(null);

  // Reload cache when campaign changes
  useEffect(() => {
    setTrackingCache(getTrackingCache(campaign.id));
    setLastSyncTime(getLastCampaignSyncTime(campaign.id));
    setCurrentPage(1);
    setSelectedShipmentIds([]);
    setBotMessages([]);
    setLastBotQueryContext(null);
  }, [campaign.id]);

  // Build unified dispatched shipments strictly for the current campaign
  const allShipments: InfluencerDispatchedShipment[] = useMemo(() => {
    const list: InfluencerDispatchedShipment[] = [];
    const seenIds = new Set<string>();

    for (const inf of dispatchedInfluencers) {
      const infId = String(inf.id);
      if (seenIds.has(infId)) continue;
      seenIds.add(infId);

      // Find matching dispatch record
      const dispatch = inf.dispatchDetails || dispatchRecords.find(d => String(d.influencer_id) === infId);
      
      // Find associated batch
      const batch = savedBatches.find(b => b.members && b.members.some(m => String(m.influencer_id) === infId));
      const batchCode = batch?.batch_name || '—';
      const batchId = batch?.id;

      const rawAwb = (dispatch?.tracking_id || '').trim();
      const rawCourier = (dispatch?.courier_partner || 'ST Courier').trim();
      const rawStatus = (dispatch?.dispatch_status || 'Dispatched').trim();
      const dispatchDate = dispatch?.dispatch_date || (batch as any)?.dispatched_date || dispatch?.created_at || '';
      const expectedDeliveryDate = dispatch?.expected_delivery_date || '';

      // Check local cache for live updates
      const cached = rawAwb ? trackingCache[rawAwb] : null;

      const effectiveStatus: TrackingStatusCategory = cached
        ? cached.status
        : normalizeTrackingStatus(rawStatus);

      const username = inf.platforms?.find(p => p.username && p.username.trim())?.username?.trim()
        || inf.influencer_name?.trim()
        || (inf as any).username?.trim()
        || inf.name?.trim()
        || '—';
      const cleanUsername = username.startsWith('@') ? username : `@${username}`;

      list.push({
        id: dispatch?.id || infId,
        influencerId: infId,
        creatorName: inf.influencer_name || inf.name || 'Influencer',
        username: cleanUsername,
        influencerCode: inf.code || '',
        profilePhoto: inf.profile_file_url || '',
        phoneNumber: inf.phone_number || dispatch?.phone_number || '',
        altPhoneNumber: dispatch?.alternative_phone_number || '',
        state: inf.state || dispatch?.state || '',
        batchId,
        batchCode,
        awbNumber: rawAwb,
        courier: rawCourier,
        dispatchDate,
        expectedDeliveryDate,
        status: effectiveStatus,
        rawStatus: cached?.rawStatus || rawStatus,
        lastLocation: cached?.lastLocation,
        trackingDateTime: cached?.trackingDateTime,
        lastSyncedAt: cached?.lastSyncedAt,
        trackingUrl: getCourierTrackingUrl(rawCourier, rawAwb),
        syncError: cached?.syncError
      });
    }

    return list;
  }, [dispatchedInfluencers, dispatchRecords, savedBatches, trackingCache]);

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

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCourier('All');
    setSelectedStatusTab('All');
    setSelectedStatusDropdown('All');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
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
    if (!shipment.awbNumber) {
      toast.error('Cannot sync: Missing AWB number.');
      return;
    }

    setSyncingIds(prev => [...prev, shipment.id]);
    const toastId = toast.loading(`Syncing tracking for AWB ${shipment.awbNumber}...`);

    try {
      const updated = await syncSingleShipment(shipment, campaign.id);
      setTrackingCache(getTrackingCache(campaign.id));
      const nowStr = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setLastSyncTime(nowStr);

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

  // Auto Sync All Eligible Shipments
  const handleAutoSyncAll = async () => {
    const eligible = allShipments.filter(s => s.awbNumber && s.status !== 'Delivered');

    if (eligible.length === 0) {
      toast.error('No active shipments with AWB numbers eligible to sync.');
      return;
    }

    setIsBulkSyncing(true);
    const progressToastId = 'bulk-sync-progress';
    toast.loading(`Syncing ${eligible.length} shipments...`, { id: progressToastId });

    try {
      const result = await syncAllShipments(allShipments, campaign.id, (p) => {
        toast.loading(`Syncing shipments (${p.completed}/${p.total})...`, { id: progressToastId });
      });

      setTrackingCache(getTrackingCache(campaign.id));
      const nowStr = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setLastSyncTime(nowStr);

      toast.dismiss(progressToastId);
      toast.success(`Sync complete! Successfully synced: ${result.successful}, Failed: ${result.failed}`);
    } catch (err) {
      toast.dismiss(progressToastId);
      toast.error('Bulk sync encountered an error.');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  // Table selection handlers
  const handleToggleSelectAll = () => {
    if (selectedShipmentIds.length === paginatedShipments.length) {
      setSelectedShipmentIds([]);
    } else {
      setSelectedShipmentIds(paginatedShipments.map(s => s.id));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedShipmentIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // -------------------------------------------------------------
  // DETERMINISTIC TRACKING ASSISTANT BOT ENGINE
  // -------------------------------------------------------------
  const executeBotQuery = useCallback((queryText: string) => {
    const q = queryText.toLowerCase().trim();
    const nowTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Helper to add user + bot message
    const addExchange = (botAnswer: string, action?: BotMessage['action']) => {
      const userMsg: BotMessage = {
        id: `user-${Date.now()}-${Math.random()}`,
        sender: 'user',
        text: queryText,
        timestamp: nowTimestamp
      };
      const botMsg: BotMessage = {
        id: `bot-${Date.now()}-${Math.random()}`,
        sender: 'bot',
        text: botAnswer,
        timestamp: nowTimestamp,
        action
      };
      setBotMessages(prev => [...prev, userMsg, botMsg]);
      setTimeout(() => {
        botChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    };

    // If campaign has zero shipments
    if (allShipments.length === 0) {
      addExchange(`There are currently 0 dispatched influencer shipments in "${campaignTitle}". Once batches are dispatched, I can help you track delivery statuses.`);
      return;
    }

    // Follow-up handler: "show them", "show", "view", "filter"
    if (q === 'show them' || q === 'show' || q === 'show it' || q === 'view them' || q === 'filter') {
      if (lastBotQueryContext === 'delivered') {
        setSelectedStatusTab('Delivered');
        addExchange(`Showing all ${kpis.delivered} delivered shipments in the table.`);
        return;
      } else if (lastBotQueryContext === 'in_transit') {
        setSelectedStatusTab('In Transit');
        addExchange(`Showing all ${kpis.inTransit} in-transit shipments in the table.`);
        return;
      } else if (lastBotQueryContext === 'exception') {
        setSelectedStatusTab('Exception');
        addExchange(`Showing all ${kpis.exception} exception shipments in the table.`);
        return;
      } else if (lastBotQueryContext === 'pending') {
        setSelectedStatusTab('Pending');
        addExchange(`Showing all ${kpis.pending} pending shipments in the table.`);
        return;
      } else if (lastBotQueryContext?.startsWith('courier:')) {
        const cName = lastBotQueryContext.replace('courier:', '');
        setSelectedCourier(cName);
        addExchange(`Filtered table to ${cName} shipments.`);
        return;
      }
    }

    // Question 1: Delivered shipments
    if (q.includes('delivered') || q.includes('completed')) {
      setLastBotQueryContext('delivered');
      const count = kpis.delivered;
      const percent = Math.round((count / allShipments.length) * 100) || 0;
      addExchange(
        `${count} of ${allShipments.length} shipments (${percent}%) are currently marked as Delivered in ${campaignTitle}.`,
        count > 0 ? {
          label: `View ${count} Delivered Shipments`,
          filterStatus: 'Delivered'
        } : undefined
      );
      return;
    }

    // Question 2: Exception / Failed shipments
    if (q.includes('exception') || q.includes('fail') || q.includes('error') || q.includes('issue') || q.includes('rto')) {
      setLastBotQueryContext('exception');
      const count = kpis.exception + kpis.failedAttempt;
      addExchange(
        count > 0 
          ? `Found ${count} shipment(s) with delivery exceptions or failed attempts in this campaign.`
          : `Great news! There are 0 exception shipments in ${campaignTitle}.`,
        count > 0 ? {
          label: `View ${count} Exception Shipments`,
          filterStatus: 'Exception'
        } : undefined
      );
      return;
    }

    // Question 3: Pending shipments
    if (q.includes('pending') || q.includes('waiting')) {
      setLastBotQueryContext('pending');
      const count = kpis.pending;
      addExchange(
        `${count} shipment(s) are currently in Pending status awaiting carrier scan or sync updates.`,
        count > 0 ? {
          label: `View ${count} Pending Shipments`,
          filterStatus: 'Pending'
        } : undefined
      );
      return;
    }

    // Question 4: In Transit shipments
    if (q.includes('in transit') || q.includes('transit') || q.includes('on the way')) {
      setLastBotQueryContext('in_transit');
      const count = kpis.inTransit;
      addExchange(
        `${count} shipment(s) are currently In Transit between distribution centers.`,
        count > 0 ? {
          label: `View ${count} In-Transit Shipments`,
          filterStatus: 'In Transit'
        } : undefined
      );
      return;
    }

    // Question 5: Out for delivery
    if (q.includes('out for delivery') || q.includes('out for') || q.includes('today')) {
      const count = kpis.outForDelivery;
      addExchange(
        `${count} shipment(s) are Out for Delivery today.`,
        count > 0 ? {
          label: `View ${count} Out for Delivery`,
          filterStatus: 'Out for Delivery'
        } : undefined
      );
      return;
    }

    // Question 6: Courier comparison / Most deliveries
    if (q.includes('courier') || q.includes('carrier') || q.includes('partner')) {
      const courierStats: Record<string, { total: number; delivered: number }> = {};
      allShipments.forEach(s => {
        const c = s.courier || 'Unassigned';
        if (!courierStats[c]) courierStats[c] = { total: 0, delivered: 0 };
        courierStats[c].total++;
        if (s.status === 'Delivered') courierStats[c].delivered++;
      });

      let topCourier = '';
      let topDeliveries = -1;
      Object.entries(courierStats).forEach(([c, stat]) => {
        if (stat.delivered > topDeliveries) {
          topDeliveries = stat.delivered;
          topCourier = c;
        }
      });

      if (topCourier && topDeliveries > 0) {
        setLastBotQueryContext(`courier:${topCourier}`);
        addExchange(
          `${topCourier} has the most deliveries with ${topDeliveries} successfully delivered shipments out of ${courierStats[topCourier].total} total handled.`,
          {
            label: `Show ${topCourier} Shipments`,
            filterCourier: topCourier
          }
        );
      } else {
        const couriersList = Object.keys(courierStats).join(', ');
        addExchange(`Current courier partners for this campaign: ${couriersList || 'ST Courier'}.`);
      }
      return;
    }

    // Question 7: Specific influencer search (e.g. "show shipments for @..." or "influencer John")
    if (q.includes('influencer') || q.includes('@') || q.includes('creator')) {
      // Extract possible username or name
      const atMatch = queryText.match(/@([a-zA-Z0-9._-]+)/);
      const searchTarget = atMatch ? atMatch[1].toLowerCase() : queryText.replace(/show|shipments|for|influencer|creator|the|find/gi, '').trim().toLowerCase();

      if (searchTarget) {
        const matches = allShipments.filter(s => 
          s.username.toLowerCase().includes(searchTarget) || 
          s.creatorName.toLowerCase().includes(searchTarget) ||
          s.influencerCode.toLowerCase().includes(searchTarget)
        );

        if (matches.length > 0) {
          const first = matches[0];
          addExchange(
            `Found ${matches.length} shipment(s) for ${first.creatorName} (${first.username}): AWB ${first.awbNumber || 'None'}, Status: ${first.status}, Courier: ${first.courier}.`,
            {
              label: `Show ${matches.length} Shipment(s)`,
              searchQuery: searchTarget
            }
          );
          return;
        } else {
          addExchange(`I couldn't find any dispatched shipments matching "${searchTarget}" in ${campaignTitle}.`);
          return;
        }
      }
    }

    // Question 8: Batch comparison / which batch
    if (q.includes('batch')) {
      const batchStats: Record<string, { total: number; pending: number }> = {};
      allShipments.forEach(s => {
        const b = s.batchCode || 'Unassigned';
        if (!batchStats[b]) batchStats[b] = { total: 0, pending: 0 };
        batchStats[b].total++;
        if (s.status !== 'Delivered') batchStats[b].pending++;
      });

      let topBatch = '';
      let topPending = -1;
      Object.entries(batchStats).forEach(([b, stat]) => {
        if (stat.pending > topPending) {
          topPending = stat.pending;
          topBatch = b;
        }
      });

      if (topBatch && topPending > 0) {
        addExchange(
          `${topBatch} has the most active/pending shipments with ${topPending} undelivered out of ${batchStats[topBatch].total} shipments.`,
          {
            label: `Show ${topBatch} Shipments`,
            searchQuery: topBatch
          }
        );
      } else {
        addExchange(`All batches in this campaign are fully delivered!`);
      }
      return;
    }

    // Question 9: Total shipments count
    if (q.includes('total') || q.includes('how many shipments') || q.includes('all shipments')) {
      addExchange(`There are a total of ${allShipments.length} dispatched shipments recorded for ${campaignTitle}.`);
      return;
    }

    // Safety boundary check for unrelated questions (e.g. weather, sports, general knowledge)
    const unrelatedKeywords = ['weather', 'president', 'movie', 'song', 'capital', 'joke', 'recipe', 'code', 'python', 'stock', 'crypto'];
    const isUnrelated = unrelatedKeywords.some(w => q.includes(w));

    if (isUnrelated) {
      addExchange(`I am your dedicated shipment Tracking Assistant for "${campaignTitle}". I can only answer questions regarding influencer dispatches, courier tracking, AWBs, delivery statuses, and batches for this campaign.`);
      return;
    }

    // Default fallback intelligent assistance
    addExchange(
      `Here is the live shipment summary for ${campaignTitle}: ${kpis.total} Total Shipments · ${kpis.delivered} Delivered · ${kpis.inTransit} In Transit · ${kpis.exception} Exceptions · ${kpis.pending} Pending. What would you like to explore?`
    );
  }, [allShipments, campaignTitle, kpis, lastBotQueryContext]);

  const handleBotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botInput.trim()) return;
    const query = botInput.trim();
    setBotInput('');
    executeBotQuery(query);
  };

  const handleBotActionClick = (action: BotMessage['action']) => {
    if (!action) return;
    if (action.filterStatus) {
      setSelectedStatusTab(action.filterStatus);
    }
    if (action.filterCourier) {
      setSelectedCourier(action.filterCourier);
    }
    if (action.searchQuery) {
      setSearchTerm(action.searchQuery);
    }
    toast.success('Applied filter from Tracking Assistant!');
  };

  // Render Empty State if no shipments at all in this campaign
  if (allShipments.length === 0) {
    return (
      <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-12 text-center text-slate-400 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-800/50 flex items-center justify-center text-purple-400 mx-auto mb-4 shadow-sm">
          <Truck size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">No Shipments to Track</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
          No dispatched influencer shipments are available for tracking in this campaign yet.
        </p>
        <button
          type="button"
          onClick={onBackToDispatched}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft size={15} />
          <span>Back to Dispatched</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 1. TOP HEADER */}
      <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm">
        {/* Left: Back button + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToDispatched}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700/80 hover:border-purple-600 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 group shadow-sm"
            title="Return to Dispatched Batches"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform text-purple-400" />
            <span>Back to Dispatched</span>
          </button>

          <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400 shrink-0 shadow-sm">
            <Truck size={20} />
          </div>

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
              Tracking System
            </h2>
            <p className="text-xs text-slate-400 truncate">
              Track and monitor all dispatched influencer shipments for this campaign.
            </p>
          </div>
        </div>

        {/* Right: Auto Sync All + Last Sync */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleAutoSyncAll}
            disabled={isBulkSyncing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCw size={13} className={isBulkSyncing ? 'animate-spin' : ''} />
            <span>{isBulkSyncing ? 'Syncing...' : 'Auto Sync All'}</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <span>Last Sync: {lastSyncTime || 'Pending initial sync'}</span>
          </div>
        </div>
      </div>

      {/* 2. 9 SHIPMENT KPI CARDS (Matching Reference Screenshot) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9 gap-2.5">
        {/* 1. Total Shipments */}
        <div className="bg-[#0b1220] border border-purple-900/40 rounded-2xl p-3 flex items-center gap-3 shadow-sm min-w-0">
          <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400 shrink-0">
            <Package size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-400 truncate">Total Shipments</div>
            <div className="text-base font-black text-white leading-tight font-mono">{kpis.total}</div>
          </div>
        </div>

        {/* 2. In Transit */}
        <div className="bg-[#0b1220] border border-blue-950/60 rounded-2xl p-3 flex items-center gap-3 shadow-sm min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-700/60 flex items-center justify-center text-blue-400 shrink-0">
            <Navigation size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-400 truncate">In Transit</div>
            <div className="text-base font-black text-white leading-tight font-mono">{kpis.inTransit}</div>
          </div>
        </div>

        {/* 3. Out for Delivery */}
        <div className="bg-[#0b1220] border border-cyan-950/60 rounded-2xl p-3 flex items-center gap-3 shadow-sm min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shrink-0">
            <Target size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-400 truncate">Out for Delivery</div>
            <div className="text-base font-black text-white leading-tight font-mono">{kpis.outForDelivery}</div>
          </div>
        </div>

        {/* 4. Delivered */}
        <div className="bg-[#0b1220] border border-emerald-950/60 rounded-2xl p-3 flex items-center gap-3 shadow-sm min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-400 truncate">Delivered</div>
            <div className="text-base font-black text-white leading-tight font-mono">{kpis.delivered}</div>
          </div>
        </div>

        {/* 5. Exception */}
        <div className="bg-[#0b1220] border border-rose-950/60 rounded-2xl p-3 flex items-center gap-3 shadow-sm min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-400 truncate">Exception</div>
            <div className="text-base font-black text-white leading-tight font-mono">{kpis.exception}</div>
          </div>
        </div>

        {/* 6. Failed Attempt */}
        <div className="bg-[#0b1220] border border-amber-950/60 rounded-2xl p-3 flex items-center gap-3 shadow-sm min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-400 shrink-0">
            <History size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-400 truncate">Failed Attempt</div>
            <div className="text-base font-black text-white leading-tight font-mono">{kpis.failedAttempt}</div>
          </div>
        </div>

        {/* 7. Pending */}
        <div className="bg-[#0b1220] border border-amber-950/60 rounded-2xl p-3 flex items-center gap-3 shadow-sm min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-300 shrink-0">
            <Clock size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-400 truncate">Pending</div>
            <div className="text-base font-black text-white leading-tight font-mono">{kpis.pending}</div>
          </div>
        </div>

        {/* 8. Info Received */}
        <div className="bg-[#0b1220] border border-slate-800/80 rounded-2xl p-3 flex items-center gap-3 shadow-sm min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/70 flex items-center justify-center text-slate-300 shrink-0">
            <Info size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-400 truncate">Info Received</div>
            <div className="text-base font-black text-white leading-tight font-mono">{kpis.infoReceived}</div>
          </div>
        </div>

        {/* 9. Expired */}
        <div className="bg-[#0b1220] border border-slate-800/80 rounded-2xl p-3 flex items-center gap-3 shadow-sm min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/70 flex items-center justify-center text-slate-300 shrink-0">
            <Calendar size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-400 truncate">Expired</div>
            <div className="text-base font-black text-white leading-tight font-mono">{kpis.expired}</div>
          </div>
        </div>
      </div>

      {/* 3. SEARCH & CONTROLS ROW */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0b1220] border border-slate-800/90 rounded-2xl p-3 shadow-sm">
        {/* Search Box */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order ID, AWB, influencer name, phone, batch code..."
            className="w-full h-10 bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Courier Filter */}
          <select
            value={selectedCourier}
            onChange={(e) => setSelectedCourier(e.target.value)}
            className="h-10 bg-slate-900 border border-slate-700/80 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
          >
            <option value="All">All Couriers</option>
            {availableCouriers.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Status Filter Dropdown */}
          <select
            value={selectedStatusDropdown}
            onChange={(e) => setSelectedStatusDropdown(e.target.value)}
            className="h-10 bg-slate-900 border border-slate-700/80 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
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

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2 h-10">
            <Calendar size={13} className="text-slate-400 shrink-0 ml-1" />
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

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-10 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700/80 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            title="Reset filters"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

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

      {/* 5. MAIN WORKSPACE: SPLIT GRID (TABLE ON LEFT, ASSISTANT ON RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: SHIPMENT TABLE + PAGINATION */}
        <div className="lg:col-span-8 flex flex-col bg-[#0b1220] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
          {/* Table Container with Internal Vertical Scroll */}
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto [scrollbar-width:thin]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0e1626] text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-bold sticky top-0 z-10 select-none">
                <tr>
                  <th className="px-3.5 py-3 w-10 text-center bg-[#0e1626]">
                    <input
                      type="checkbox"
                      checked={selectedShipmentIds.length === paginatedShipments.length && paginatedShipments.length > 0}
                      onChange={handleToggleSelectAll}
                      className="rounded accent-purple-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-3.5 py-3 bg-[#0e1626]">ORDER ID / CODE</th>
                  <th className="px-3.5 py-3 bg-[#0e1626]">INFLUENCER</th>
                  <th className="px-3.5 py-3 bg-[#0e1626]">AWB NUMBER</th>
                  <th className="px-3.5 py-3 bg-[#0e1626]">COURIER</th>
                  <th className="px-3.5 py-3 text-center bg-[#0e1626]">STATUS</th>
                  <th className="px-3.5 py-3 text-center bg-[#0e1626]">LAST SYNCED</th>
                  <th className="px-3.5 py-3 text-right bg-[#0e1626]">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paginatedShipments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                      No shipments matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedShipments.map((s) => {
                    const isSyncing = syncingIds.includes(s.id);
                    const isSelected = selectedShipmentIds.includes(s.id);
                    const badgeStyle = getTrackingStatusBadgeStyle(s.status);

                    return (
                      <tr
                        key={s.id}
                        className={`transition-colors hover:bg-slate-850/40 ${
                          isSelected ? 'bg-purple-950/20' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3.5 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(s.id)}
                            className="rounded accent-purple-600 cursor-pointer"
                          />
                        </td>

                        {/* Order ID / Code */}
                        <td className="px-3.5 py-3 font-mono font-bold text-slate-200">
                          {s.influencerCode || (s.id.length > 8 ? s.id.slice(0, 8) : s.id)}
                        </td>

                        {/* Influencer Details */}
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-2.5 min-w-[140px]">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                              {s.profilePhoto ? (
                                <img src={s.profilePhoto} alt={s.creatorName} className="w-full h-full object-cover" />
                              ) : (
                                <span>{(s.creatorName || 'A').charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-100 truncate hover:text-purple-300 transition-colors">
                                {s.creatorName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {s.username} {s.phoneNumber ? `· ${s.phoneNumber}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* AWB Number */}
                        <td className="px-3.5 py-3 font-mono font-bold text-slate-200">
                          {s.awbNumber ? (
                            <div className="flex items-center gap-1.5">
                              <span>{s.awbNumber}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyAwb(s.awbNumber)}
                                className="p-1 text-slate-500 hover:text-purple-300 rounded transition-colors cursor-pointer"
                                title="Copy AWB"
                              >
                                {copiedAwb === s.awbNumber ? <Check size={12} className="text-emerald-400" /> : <Copy size={11} />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">Unassigned</span>
                          )}
                        </td>

                        {/* Courier */}
                        <td className="px-3.5 py-3">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-900 border border-slate-800 text-slate-300 whitespace-nowrap">
                            {s.courier}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3.5 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                            {isSyncing ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : (
                              <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                            )}
                            <span>{isSyncing ? 'Syncing...' : s.status}</span>
                          </span>
                        </td>

                        {/* Last Synced */}
                        <td className="px-3.5 py-3 text-center font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {s.lastSyncedAt || s.trackingDateTime || s.dispatchDate || '—'}
                        </td>

                        {/* Actions */}
                        <td className="px-3.5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActiveTrackingModalShipment(s)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700/80 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                              title="View details & timeline"
                            >
                              <Truck size={12} className="text-purple-400" />
                              <span>Track</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSyncShipment(s)}
                              disabled={isSyncing || !s.awbNumber}
                              className="px-2.5 py-1.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 hover:text-purple-300 disabled:opacity-40 text-xs font-semibold rounded-xl border border-purple-500/30 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                              title="Sync live status"
                            >
                              <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                              <span>Sync</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setActiveTrackingModalShipment(s)}
                              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                              title="More options"
                            >
                              <MoreVertical size={13} />
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

        {/* RIGHT COLUMN: REAL TRACKING ASSISTANT BOT */}
        <div className="lg:col-span-4 bg-[#0b1220] border border-slate-800/90 rounded-2xl p-4 shadow-xl flex flex-col h-full min-h-[640px]">
          {/* Bot Header */}
          <div className="flex items-center gap-3 pb-3.5 border-b border-slate-800">
            <div className="w-11 h-11 rounded-2xl bg-purple-950/80 border border-purple-600/50 flex items-center justify-center text-purple-400 shadow-md shadow-purple-950/50 relative shrink-0">
              <Bot size={24} />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 border-2 border-[#0b1220]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white">Tracking Assistant</h3>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800/60">
                  Beta
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Ask anything about influencer shipments in this campaign.
              </p>
            </div>
          </div>

          {/* Quick Questions List */}
          <div className="py-3 space-y-1.5 border-b border-slate-800/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Quick Inquiries
            </div>
            {[
              'How many shipments are delivered?',
              'Show exception shipments',
              'List pending shipments',
              'Which courier has the most deliveries?',
              'Show shipments for a specific influencer'
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => executeBotQuery(q)}
                className="w-full px-3 py-2 bg-slate-900/80 hover:bg-purple-950/30 text-slate-300 hover:text-purple-300 rounded-xl border border-slate-800 hover:border-purple-800/50 transition-all text-xs font-medium flex items-center gap-2 text-left cursor-pointer group"
              >
                <ChevronRight size={13} className="text-purple-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                <span className="truncate">{q}</span>
              </button>
            ))}
          </div>

          {/* Chat Messages History Area */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3 max-h-[300px] [scrollbar-width:thin]">
            {botMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
                <Sparkles size={24} className="text-purple-400/60 mb-2" />
                <p className="text-xs">Ask a question or click any quick inquiry above to query real shipment data.</p>
              </div>
            ) : (
              botMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}
                >
                  <div className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}>
                    {msg.text}

                    {/* Interactive Result Action Button */}
                    {msg.action && (
                      <div className="mt-2 pt-2 border-t border-slate-800 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleBotActionClick(msg.action)}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>{msg.action.label}</span>
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
                </div>
              ))
            )}
            <div ref={botChatEndRef} />
          </div>

          {/* Chat Input at Bottom */}
          <form onSubmit={handleBotSubmit} className="pt-2 border-t border-slate-800">
            <div className="relative flex items-center">
              <input
                type="text"
                value={botInput}
                onChange={(e) => setBotInput(e.target.value)}
                placeholder="Type your question..."
                className="w-full h-11 bg-slate-900 border border-slate-700/80 rounded-xl pl-3.5 pr-11 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!botInput.trim()}
                className="absolute right-1.5 w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Send inquiry"
              >
                <Send size={13} />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center">
              I can help you check shipment status, find influencers, analyze delivery data, and more.
            </p>
          </form>
        </div>
      </div>

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
                  <span className="font-bold text-white text-sm">{activeTrackingModalShipment.creatorName} ({activeTrackingModalShipment.username})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-mono text-slate-200">{activeTrackingModalShipment.phoneNumber || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Batch Code:</span>
                  <span className="font-mono font-bold text-purple-300">{activeTrackingModalShipment.batchCode}</span>
                </div>
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
                <button
                  type="button"
                  onClick={() => handleSyncShipment(activeTrackingModalShipment)}
                  disabled={syncingIds.includes(activeTrackingModalShipment.id)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/30"
                >
                  <RefreshCw size={12} className={syncingIds.includes(activeTrackingModalShipment.id) ? 'animate-spin' : ''} />
                  <span>Sync Now</span>
                </button>

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
    </div>
  );
};
