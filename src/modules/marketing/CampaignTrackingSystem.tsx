import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import db from '../../lib/db';
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
  MapPin,
  Phone,
  Calendar,
  Layers,
  Copy,
  AlertTriangle,
  Send,
  Navigation
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

const STATUS_TABS: TrackingStatusCategory[] = [
  'All',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Exception',
  'Failed Attempt',
  'Pending',
  'Info Received',
  'Expired'
];

export const CampaignTrackingSystem: React.FC<CampaignTrackingSystemProps> = ({
  campaign,
  dispatchedInfluencers,
  dispatchRecords,
  savedBatches,
  onBackToDispatched,
  onRefreshData
}) => {
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<TrackingStatusCategory>('All');
  const [selectedCourier, setSelectedCourier] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Table selection
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);

  // Syncing state
  const [syncingIds, setSyncingIds] = useState<string[]>([]);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    completed: number;
    total: number;
    successful: number;
    failed: number;
    currentAwb: string;
  } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => getLastCampaignSyncTime(campaign.id));

  // Modals state
  const [activeTrackingModalShipment, setActiveTrackingModalShipment] = useState<InfluencerDispatchedShipment | null>(null);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  // Local tracking overrides/cache state (refreshed on sync or component mount)
  const [trackingCache, setTrackingCache] = useState<Record<string, any>>(() => getTrackingCache(campaign.id));

  // Reload cache when campaign changes
  useEffect(() => {
    setTrackingCache(getTrackingCache(campaign.id));
    setLastSyncTime(getLastCampaignSyncTime(campaign.id));
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

  // Unique couriers present in this campaign
  const availableCouriers = useMemo(() => {
    const set = new Set<string>();
    allShipments.forEach(s => {
      if (s.courier && s.courier.trim()) set.add(s.courier.trim());
    });
    return Array.from(set);
  }, [allShipments]);

  // KPI Calculations strictly from real shipment data
  const kpis = useMemo(() => {
    let total = allShipments.length;
    let inTransit = 0;
    let outForDelivery = 0;
    let delivered = 0;
    let exceptions = 0;

    for (const s of allShipments) {
      if (s.status === 'In Transit') inTransit++;
      else if (s.status === 'Out for Delivery') outForDelivery++;
      else if (s.status === 'Delivered') delivered++;
      else if (s.status === 'Exception' || s.status === 'Failed Attempt') exceptions++;
    }

    return { total, inTransit, outForDelivery, delivered, exceptions };
  }, [allShipments]);

  // Status Tab Counts
  const statusTabCounts = useMemo(() => {
    const counts: Record<TrackingStatusCategory, number> = {
      All: allShipments.length,
      'In Transit': 0,
      'Out for Delivery': 0,
      Delivered: 0,
      Exception: 0,
      'Failed Attempt': 0,
      Pending: 0,
      'Info Received': 0,
      Expired: 0
    };

    for (const s of allShipments) {
      if (counts[s.status] !== undefined) {
        counts[s.status]++;
      }
    }

    return counts;
  }, [allShipments]);

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

        if (!matchesName && !matchesUser && !matchesPhone && !matchesAwb && !matchesBatch && !matchesCourier && !matchesCode) {
          return false;
        }
      }

      // 2. Courier filter
      if (selectedCourier !== 'All' && s.courier !== selectedCourier) {
        return false;
      }

      // 3. Status Tab filter
      if (selectedStatusTab !== 'All' && s.status !== selectedStatusTab) {
        return false;
      }

      // 4. Date Range filter (matches dispatchDate)
      if (startDate || endDate) {
        if (!s.dispatchDate) return false;
        const d = new Date(s.dispatchDate);
        if (isNaN(d.getTime())) return true; // keep if invalid date format
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
  }, [allShipments, searchTerm, selectedCourier, selectedStatusTab, startDate, endDate]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCourier('All');
    setSelectedStatusTab('All');
    setStartDate('');
    setEndDate('');
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
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(nowStr);

      if (updated.syncError) {
        toast.error(`Sync: ${updated.syncError}`, { id: toastId });
      } else {
        toast.success(`Synced: ${updated.status}`, { id: toastId });
      }

      // If active modal is open for this shipment, update modal view
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
        setBulkProgress(p);
        toast.loading(`Syncing shipments (${p.completed}/${p.total})...`, { id: progressToastId });
      });

      setTrackingCache(getTrackingCache(campaign.id));
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(nowStr);

      toast.dismiss(progressToastId);
      toast.success(`Sync complete! Successfully synced: ${result.successful}, Failed: ${result.failed}`);
    } catch (err) {
      toast.dismiss(progressToastId);
      toast.error('Bulk sync encountered an error.');
    } finally {
      setIsBulkSyncing(false);
      setBulkProgress(null);
    }
  };

  // Table selection handlers
  const handleToggleSelectAll = () => {
    if (selectedShipmentIds.length === filteredShipments.length) {
      setSelectedShipmentIds([]);
    } else {
      setSelectedShipmentIds(filteredShipments.map(s => s.id));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedShipmentIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Render Empty State if no shipments at all
  if (allShipments.length === 0) {
    return (
      <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-12 text-center text-slate-400 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-800/50 flex items-center justify-center text-purple-400 mx-auto mb-4">
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
    <div className="space-y-5 animate-fade-in">
      {/* 1. TOP HEADER */}
      <div className="bg-[#0b1220] border border-purple-900/40 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm">
        {/* Left: Back button + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToDispatched}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-purple-400 hover:text-purple-300 text-xs font-semibold rounded-xl border border-slate-700/80 hover:border-purple-600 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 group"
            title="Return to Dispatched Batches"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Dispatched</span>
          </button>

          <div className="h-6 w-px bg-slate-800 shrink-0" />

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
              <span className="w-6 h-6 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0">
                <Truck size={14} />
              </span>
              <span>Tracking System</span>
            </h2>
            <p className="text-xs text-slate-400 truncate">
              Track and monitor all dispatched influencer shipments for this campaign.
            </p>
          </div>
        </div>

        {/* Right: Auto Sync All + Last Sync */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          {lastSyncTime && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl">
              <Clock size={12} className="text-purple-400" />
              <span>Last Sync: <strong className="text-slate-200">{lastSyncTime}</strong></span>
            </div>
          )}

          <button
            type="button"
            onClick={handleAutoSyncAll}
            disabled={isBulkSyncing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCw size={13} className={isBulkSyncing ? 'animate-spin' : ''} />
            <span>{isBulkSyncing ? 'Syncing...' : 'Auto Sync All'}</span>
          </button>
        </div>
      </div>

      {/* 2. SHIPMENT KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Shipments */}
        <div className="bg-[#0e1626] border border-slate-800/90 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Shipments</span>
            <div className="w-8 h-8 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400">
              <Package size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2 leading-none font-mono">
            {kpis.total}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Confirmed Dispatched</div>
        </div>

        {/* In Transit */}
        <div className="bg-[#0e1626] border border-blue-950/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">In Transit</span>
            <div className="w-8 h-8 rounded-xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400">
              <Navigation size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-400 mt-2 leading-none font-mono">
            {kpis.inTransit}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Moving between hubs</div>
        </div>

        {/* Out for Delivery */}
        <div className="bg-[#0e1626] border border-cyan-950/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Out for Delivery</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
              <Truck size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-cyan-400 mt-2 leading-none font-mono">
            {kpis.outForDelivery}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Arriving today</div>
        </div>

        {/* Delivered */}
        <div className="bg-[#0e1626] border border-emerald-950/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Delivered</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <CheckCircle size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 leading-none font-mono">
            {kpis.delivered}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Completed delivery</div>
        </div>

        {/* Exceptions */}
        <div className="bg-[#0e1626] border border-rose-950/60 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Exceptions</span>
            <div className="w-8 h-8 rounded-xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2 leading-none font-mono">
            {kpis.exceptions}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Issues or Failed</div>
        </div>
      </div>

      {/* 3. SEARCH, FILTERS & CONTROLS */}
      <div className="bg-[#0e1626] border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search influencer name, username, phone, AWB, batch code..."
              className="w-full h-10 bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Filters Group */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Courier Dropdown */}
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

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2 h-10">
              <Calendar size={13} className="text-slate-400 shrink-0 ml-1" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Dispatch date from"
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer w-28"
              />
              <span className="text-slate-500 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="Dispatch date to"
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer w-28"
              />
            </div>

            {/* Reset Button */}
            {(searchTerm || selectedCourier !== 'All' || selectedStatusTab !== 'All' || startDate || endDate) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-10 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700/80 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                title="Reset filters"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. STATUS FILTER PILLS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {STATUS_TABS.map((tab) => {
            const count = statusTabCounts[tab] || 0;
            const isActive = selectedStatusTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedStatusTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                    : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{tab}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold leading-none ${
                  isActive
                    ? 'bg-purple-950 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. SHIPMENTS TABLE */}
      <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
        {filteredShipments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Truck size={36} className="mx-auto mb-2.5 text-slate-600" />
            <div className="text-sm font-semibold text-slate-300">No shipments match your criteria</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Try adjusting your search terms or clearing the selected filters.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-3 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-400 text-xs font-semibold rounded-xl border border-slate-700 cursor-pointer inline-flex items-center gap-1.5"
            >
              <RotateCcw size={12} />
              <span>Reset Filters</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto [scrollbar-width:thin]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800/90 uppercase text-[10px] tracking-wider font-bold select-none">
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedShipmentIds.length === filteredShipments.length && filteredShipments.length > 0}
                      onChange={handleToggleSelectAll}
                      className="rounded accent-purple-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Influencer</th>
                  <th className="px-4 py-3">Batch Code</th>
                  <th className="px-4 py-3">AWB Number</th>
                  <th className="px-4 py-3">Courier</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Last Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredShipments.map((s) => {
                  const isSyncing = syncingIds.includes(s.id);
                  const isSelected = selectedShipmentIds.includes(s.id);
                  const badgeStyle = getTrackingStatusBadgeStyle(s.status);

                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors hover:bg-slate-850/40 ${
                        isSelected ? 'bg-purple-950/15' : ''
                      }`}
                    >
                      {/* 1. Checkbox */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(s.id)}
                          className="rounded accent-purple-600 cursor-pointer"
                        />
                      </td>

                      {/* 2. Influencer Info */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-purple-600 border border-purple-500/30 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                            {s.profilePhoto ? (
                              <img src={s.profilePhoto} alt={s.creatorName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{(s.creatorName || 'A').charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-100 truncate flex items-center gap-1.5">
                              <span>{s.creatorName}</span>
                              {s.influencerCode && (
                                <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-950/70 border border-purple-800/40 px-1.5 py-0.2 rounded">
                                  {s.influencerCode}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate flex items-center gap-2 mt-0.5">
                              <span className="text-purple-400 font-medium">{s.username}</span>
                              {s.phoneNumber && (
                                <>
                                  <span className="text-slate-600">·</span>
                                  <span className="font-mono text-slate-500">{s.phoneNumber}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Batch Code */}
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/70 text-slate-300 font-mono text-[11px] font-semibold">
                          {s.batchCode}
                        </span>
                      </td>

                      {/* 4. AWB Number */}
                      <td className="px-4 py-3">
                        {s.awbNumber ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-200 text-xs">
                              {s.awbNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyAwb(s.awbNumber)}
                              className="p-1 text-slate-500 hover:text-purple-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Copy AWB"
                            >
                              {copiedAwb === s.awbNumber ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">No AWB</span>
                        )}
                      </td>

                      {/* 5. Courier */}
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                          {s.courier}
                        </span>
                      </td>

                      {/* 6. Status Badge */}
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                            {isSyncing ? (
                              <RefreshCw size={11} className="animate-spin" />
                            ) : (
                              <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                            )}
                            <span>{isSyncing ? 'Syncing...' : s.status}</span>
                          </span>

                          {s.lastLocation && s.lastLocation !== '-' && (
                            <span className="text-[10px] text-slate-500 truncate max-w-[150px] mt-0.5" title={s.lastLocation}>
                              {s.lastLocation}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Last Updated */}
                      <td className="px-4 py-3 text-center text-slate-400 font-mono text-[11px]">
                        {s.lastSyncedAt || s.trackingDateTime || s.dispatchDate || '—'}
                      </td>

                      {/* 8. Actions ([Track] [Sync]) */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveTrackingModalShipment(s)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700/80 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                            title="View tracking history & details"
                          >
                            <span>Track</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSyncShipment(s)}
                            disabled={isSyncing || !s.awbNumber}
                            className="px-3 py-1.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 hover:text-purple-300 disabled:opacity-40 text-xs font-semibold rounded-xl border border-purple-500/30 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                            title={s.awbNumber ? "Sync live status from courier" : "AWB missing"}
                          >
                            <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
                  <span className="text-slate-400">Batch:</span>
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
