import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { 
  Search, 
  RotateCcw, 
  Copy, 
  Edit2, 
  Download, 
  Eye, 
  RefreshCcw, 
  CheckSquare, 
  X, 
  Save, 
  Trash2, 
  ChevronDown, 
  Check, 
  Filter, 
  MessageCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { naturalSortCompare } from '../../config/skuMapping';
import { isActiveStatus, isInfluencerReDispatch } from '../../utils/marketingUtils';
import { 
  reDispatchFormatService, 
  StoredReDispatchMessage, 
  resolveReDispatchProducts, 
  resolveReDispatchShipmentInfo, 
  buildReDispatchMessage,
  resolveInfluencerName,
  isGenuineReDispatchInfluencer
} from '../../services/reDispatchFormatService';
import { resolvePaymentDetails } from '../../services/afterDispatchService';
import { 
  fetchCampaignShipmentsFromDb, 
  InfluencerDispatchedShipment 
} from '../../services/influencerTrackingService';
import { shipmentAttemptService, ShipmentAttempt } from '../../services/shipmentAttemptService';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { 
  generateSingleReDispatchPDF, 
  generateCombinedReDispatchPDF 
} from '../../utils/generateReDispatchPDF';

interface ReDispatchSectionProps {
  campaign: Campaign;
  influencers: CampaignInfluencer[];
  onBackToList: () => void;
  refreshTrigger?: number;
}

export const ReDispatchSection: React.FC<ReDispatchSectionProps> = ({
  campaign,
  influencers,
  onBackToList,
  refreshTrigger
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [messagesMap, setMessagesMap] = useState<Record<string, StoredReDispatchMessage>>({});
  const [shipments, setShipments] = useState<InfluencerDispatchedShipment[]>([]);
  const [shipmentAttempts, setShipmentAttempts] = useState<ShipmentAttempt[]>([]);
  const [dispatchRecords, setDispatchRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [textModalItem, setTextModalItem] = useState<{
    influencer: CampaignInfluencer;
    message: StoredReDispatchMessage;
  } | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [trackingFilter, setTrackingFilter] = useState<'all' | 'with_tracking' | 'no_tracking'>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Deletion modal
  const [deleteModalItem, setDeleteModalItem] = useState<{ id: string | number; code: string } | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Active influencers sorted naturally by code
  const activeInfluencers = useMemo(() => {
    const list = influencers.filter(inf => isActiveStatus(inf.is_archived));
    return list.sort((a, b) => naturalSortCompare(a.code || (a as any).influencer_code || '', b.code || (b as any).influencer_code || ''));
  }, [influencers]);

  // Re-Dispatch identified influencers only (strict workflow criteria, no false positives)
  const reDispatchEligibleInfluencers = useMemo(() => {
    return activeInfluencers.filter(inf => {
      return isGenuineReDispatchInfluencer(inf, dispatchRecords, shipmentAttempts, shipments);
    });
  }, [activeInfluencers, dispatchRecords, shipmentAttempts, shipments]);

  // Handle outside click for filter popover
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setIsFilterPopoverOpen(false);
      }
    };
    if (isFilterPopoverOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isFilterPopoverOpen]);

  // Helper to detect stale messages (e.g. from old delay apology template)
  const isStaleMessage = (text: string): boolean => {
    const lower = (text || '').toLowerCase();
    return (
      lower.includes('sorry for the delay') ||
      lower.includes('replacement dispatch (') ||
      lower.includes('collaboration videos in')
    );
  };

  // Load shipments, attempts & messages with automatic redraft generation
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [msgs, ships, attempts, dispData] = await Promise.all([
        reDispatchFormatService.getMessages(campaign.id),
        fetchCampaignShipmentsFromDb(campaign.id),
        shipmentAttemptService.getCampaignShipmentAttempts(campaign.id),
        supabase.from(SUPABASE_TABLES.influencerDispatch).select('*').eq('campaign_id', campaign.id)
      ]);

      const currentDispatches = Array.isArray(dispData?.data) ? dispData.data : [];
      setShipments(ships || []);
      setShipmentAttempts(attempts || []);
      setDispatchRecords(currentDispatches);

      // Identify genuine re-dispatch influencers strictly based on workflow data
      const eligible = activeInfluencers.filter(inf => {
        return isGenuineReDispatchInfluencer(inf, currentDispatches, attempts || [], ships || []);
      });

      const eligibleIds = new Set(eligible.map(inf => String(inf.id)));

      // Purge any messages from map and local cache that do NOT belong to genuine re-dispatch influencers
      const updatedMap: Record<string, StoredReDispatchMessage> = {};
      Object.entries(msgs).forEach(([k, v]) => {
        if (eligibleIds.has(k) && !isStaleMessage(v.message_text)) {
          updatedMap[k] = v;
        }
      });

      // Eradicate stale non-redispatch keys (such as HIS2/HIS3) from localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(reDispatchFormatService.getLocalKey(campaign.id), JSON.stringify(updatedMap));
        } catch (e) {}
      }

      // Auto-generate Redraft Re-Dispatch messages for genuine re-dispatch records that need one
      const nowIso = new Date().toISOString();
      const autoGenerated: StoredReDispatchMessage[] = [];

      eligible.forEach(inf => {
        const infId = String(inf.id);
        const existing = updatedMap[infId];

        if (!existing || isStaleMessage(existing.message_text)) {
          const shipmentInfo = resolveReDispatchShipmentInfo(inf, ships, attempts, currentDispatches);
          const dispatchedProds = resolveReDispatchProducts(inf, currentDispatches);
          const payment = resolvePaymentDetails(inf, dispatchedProds);
          const msgText = buildReDispatchMessage(inf, shipmentInfo);

          const rec: StoredReDispatchMessage = {
            campaign_id: String(campaign.id),
            influencer_id: infId,
            influencer_code: (inf.code || (inf as any).influencer_code || '').trim(),
            username: inf.influencer_name || (inf as any).username || inf.name || '',
            creator_name: ((inf as any).creator_name || (inf as any).real_name || '').trim(),
            dispatch_status: shipmentInfo.dispatchStatus || 'Dispatched',
            courier: shipmentInfo.courier,
            tracking_id: shipmentInfo.trackingId,
            tracking_url: shipmentInfo.trackingUrl,
            attempt_number: shipmentInfo.attemptNumber,
            payment_amount: payment.amount,
            payment_text: payment.paymentText,
            dispatched_products: dispatchedProds,
            message_text: msgText,
            generated_at: nowIso,
            updated_at: nowIso
          };

          autoGenerated.push(rec);
          updatedMap[infId] = rec;
        }
      });

      if (autoGenerated.length > 0) {
        await reDispatchFormatService.batchPersistMessages(campaign.id, autoGenerated);
      }

      setMessagesMap(updatedMap);
    } catch (err) {
      console.error('Failed loading Re-Dispatch data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaign.id, refreshTrigger]);

  // Filter options derived from actual Re-Dispatch data
  const filterOptions = useMemo(() => {
    const statuses = new Set<string>();
    const couriers = new Set<string>();
    const states = new Set<string>();

    reDispatchEligibleInfluencers.forEach(inf => {
      const msg = messagesMap[String(inf.id)];
      const resolved = resolveReDispatchShipmentInfo(inf, shipments, shipmentAttempts, dispatchRecords);
      const st = msg?.dispatch_status || resolved.dispatchStatus;
      const cr = msg?.courier || resolved.courier;

      if (st) statuses.add(st.trim());
      if (cr) couriers.add(cr.trim());
      if (inf.state) states.add(inf.state.trim());
    });

    return {
      statuses: Array.from(statuses).filter(Boolean).sort(),
      couriers: Array.from(couriers).filter(Boolean).sort(),
      states: Array.from(states).filter(Boolean).sort()
    };
  }, [reDispatchEligibleInfluencers, messagesMap, shipments, shipmentAttempts, dispatchRecords]);

  // Filtered list based on search and popover filters
  const filteredList = useMemo(() => {
    return reDispatchEligibleInfluencers.filter(inf => {
      const infId = String(inf.id);
      const msg = messagesMap[infId];
      const resolved = resolveReDispatchShipmentInfo(inf, shipments, shipmentAttempts, dispatchRecords);

      const code = (inf.code || (inf as any).influencer_code || '').toLowerCase();
      const username = (inf.influencer_name || inf.name || (inf as any).username || '').toLowerCase();
      const creatorName = ((inf as any).creator_name || (inf as any).real_name || '').toLowerCase();
      const tracking = (msg?.tracking_id || resolved.trackingId || '').toLowerCase();
      const currentStatus = (msg?.dispatch_status || resolved.dispatchStatus || '').toLowerCase();
      const currentCourier = (msg?.courier || resolved.courier || '').toLowerCase();

      // Search term (username or influencer code, plus tracking)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        if (!code.includes(q) && !username.includes(q) && !creatorName.includes(q) && !tracking.includes(q)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (!currentStatus.includes(statusFilter.toLowerCase())) return false;
      }

      // Courier filter
      if (courierFilter !== 'all') {
        if (!currentCourier.includes(courierFilter.toLowerCase())) return false;
      }

      // Tracking ID filter
      if (trackingFilter === 'with_tracking' && !tracking) return false;
      if (trackingFilter === 'no_tracking' && tracking) return false;

      // State filter
      if (stateFilter !== 'all') {
        if ((inf.state || '').toLowerCase() !== stateFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [reDispatchEligibleInfluencers, messagesMap, shipments, shipmentAttempts, dispatchRecords, searchTerm, statusFilter, courierFilter, trackingFilter, stateFilter]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (courierFilter !== 'all') count++;
    if (trackingFilter !== 'all') count++;
    if (stateFilter !== 'all') count++;
    return count;
  }, [statusFilter, courierFilter, trackingFilter, stateFilter]);

  // Selection
  const handleSelectAll = () => {
    if (filteredList.length === 0) return;
    const allSelected = filteredList.every(inf => selectedIds.has(inf.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredList.map(inf => inf.id)));
    }
  };

  const handleToggleSelect = (id: string | number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Redraft / Regenerate single message
  const handleRedraftMessage = async (influencer: CampaignInfluencer) => {
    const infId = String(influencer.id);
    const shipmentInfo = resolveReDispatchShipmentInfo(influencer, shipments, shipmentAttempts, dispatchRecords);
    const dispatchedProds = resolveReDispatchProducts(influencer, dispatchRecords);
    const payment = resolvePaymentDetails(influencer, dispatchedProds);
    const msgText = buildReDispatchMessage(influencer, shipmentInfo);
    const nowIso = new Date().toISOString();

    const updated: StoredReDispatchMessage = {
      campaign_id: String(campaign.id),
      influencer_id: infId,
      influencer_code: (influencer.code || (influencer as any).influencer_code || '').trim(),
      username: influencer.influencer_name || (influencer as any).username || influencer.name || '',
      creator_name: ((influencer as any).creator_name || (influencer as any).real_name || '').trim(),
      dispatch_status: shipmentInfo.dispatchStatus || 'Dispatched',
      courier: shipmentInfo.courier,
      tracking_id: shipmentInfo.trackingId,
      tracking_url: shipmentInfo.trackingUrl,
      attempt_number: shipmentInfo.attemptNumber,
      payment_amount: payment.amount,
      payment_text: payment.paymentText,
      dispatched_products: dispatchedProds,
      message_text: msgText,
      generated_at: messagesMap[infId]?.generated_at || nowIso,
      updated_at: nowIso
    };

    await reDispatchFormatService.persistSingleMessage(campaign.id, updated);
    setMessagesMap(prev => ({
      ...prev,
      [infId]: updated
    }));

    if (textModalItem && String(textModalItem.influencer.id) === infId) {
      setTextModalItem({ influencer, message: updated });
      setEditingText(msgText);
    }

    toast.success(`Re-drafted message for ${updated.influencer_code || 'influencer'}!`);
  };

  // View / Copy / Edit
  const handleOpenTextModal = (influencer: CampaignInfluencer) => {
    const infId = String(influencer.id);
    let msg = messagesMap[infId];

    if (!msg) {
      const shipmentInfo = resolveReDispatchShipmentInfo(influencer, shipments, shipmentAttempts, dispatchRecords);
      const dispatchedProds = resolveReDispatchProducts(influencer, dispatchRecords);
      const payment = resolvePaymentDetails(influencer, dispatchedProds);
      const msgText = buildReDispatchMessage(influencer, shipmentInfo);
      const nowIso = new Date().toISOString();

      msg = {
        campaign_id: String(campaign.id),
        influencer_id: infId,
        influencer_code: influencer.code || '',
        username: influencer.influencer_name || '',
        creator_name: (influencer as any).creator_name || '',
        dispatch_status: shipmentInfo.dispatchStatus || 'Dispatched',
        courier: shipmentInfo.courier,
        tracking_id: shipmentInfo.trackingId,
        tracking_url: shipmentInfo.trackingUrl,
        attempt_number: shipmentInfo.attemptNumber,
        payment_amount: payment.amount,
        payment_text: payment.paymentText,
        dispatched_products: dispatchedProds,
        message_text: msgText,
        generated_at: nowIso,
        updated_at: nowIso
      };
    }

    setTextModalItem({ influencer, message: msg });
    setEditingText(msg.message_text);
    setIsEditingMode(false);
  };

  const handleCopyText = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      toast.success('Copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy.');
    }
  };

  const handleSaveEditedText = async () => {
    if (!textModalItem) return;
    const updated: StoredReDispatchMessage = {
      ...textModalItem.message,
      message_text: editingText,
      updated_at: new Date().toISOString()
    };

    try {
      await reDispatchFormatService.persistSingleMessage(campaign.id, updated);
      setMessagesMap(prev => ({
        ...prev,
        [updated.influencer_id]: updated
      }));
      setTextModalItem({
        influencer: textModalItem.influencer,
        message: updated
      });
      setIsEditingMode(false);
      toast.success('Re-Dispatch message updated successfully!');
    } catch (err) {
      toast.error('Failed to save message.');
    }
  };

  const handleOpenWhatsApp = (influencer: CampaignInfluencer, text: string) => {
    const phone = (influencer.phone_number || (influencer as any).phone || '').replace(/\D/g, '');
    if (!phone) {
      toast.error('No phone number recorded for this influencer.');
      return;
    }
    const cleanPhone = phone.startsWith('91') && phone.length === 12 ? phone : `91${phone.replace(/^0+/, '')}`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // PDF Downloads
  const handleDownloadSinglePDF = (influencer: CampaignInfluencer) => {
    const infId = String(influencer.id);
    const msg = messagesMap[infId];
    if (!msg) {
      toast.error('Re-Dispatch message not ready for this influencer.');
      return;
    }

    try {
      generateSingleReDispatchPDF(campaign.campaign_name, {
        influencerCode: msg.influencer_code,
        username: msg.username,
        creatorName: msg.creator_name,
        courier: msg.courier,
        trackingId: msg.tracking_id,
        trackingUrl: msg.tracking_url,
        dispatchStatus: msg.dispatch_status,
        messageText: msg.message_text
      });
      toast.success(`PDF downloaded for ${msg.influencer_code || 'influencer'}!`);
    } catch (err) {
      toast.error('Failed to generate PDF.');
    }
  };

  const handleDownloadCombinedPDF = () => {
    const targetInfluencers = selectedIds.size > 0
      ? filteredList.filter(inf => selectedIds.has(inf.id))
      : filteredList;

    const items = targetInfluencers
      .map(inf => messagesMap[String(inf.id)])
      .filter((m): m is StoredReDispatchMessage => Boolean(m))
      .map(m => ({
        influencerCode: m.influencer_code,
        username: m.username,
        creatorName: m.creator_name,
        courier: m.courier,
        trackingId: m.tracking_id,
        trackingUrl: m.tracking_url,
        dispatchStatus: m.dispatch_status,
        messageText: m.message_text
      }));

    if (items.length === 0) {
      toast.error('No Re-Dispatch messages found to download.');
      return;
    }

    try {
      generateCombinedReDispatchPDF(campaign.campaign_name, items);
      toast.success(`Combined PDF downloaded for ${items.length} influencer(s)!`);
    } catch (err) {
      toast.error('Failed to generate combined PDF.');
    }
  };

  // Deletion
  const handleConfirmSingleDelete = async () => {
    if (!deleteModalItem) return;
    const { id, code } = deleteModalItem;

    try {
      await reDispatchFormatService.deleteMessage(campaign.id, id);
      setMessagesMap(prev => {
        const next = { ...prev };
        delete next[String(id)];
        return next;
      });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeleteModalItem(null);
      toast.success(`Re-Dispatch message for ${code || 'influencer'} deleted.`);
    } catch (err) {
      toast.error('Failed to delete Re-Dispatch message.');
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idList = Array.from(selectedIds);

    try {
      await reDispatchFormatService.batchDeleteMessages(campaign.id, idList);
      setMessagesMap(prev => {
        const next = { ...prev };
        idList.forEach(id => {
          delete next[String(id)];
        });
        return next;
      });
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
      toast.success(`Deleted ${idList.length} Re-Dispatch message(s).`);
    } catch (err) {
      toast.error('Failed to delete selected messages.');
    }
  };

  // Format payment display matching After Dispatch table
  const formatPaymentDisplay = (msg?: StoredReDispatchMessage, inf?: CampaignInfluencer) => {
    if (msg?.payment_amount !== null && msg?.payment_amount !== undefined && msg.payment_amount > 0) {
      return `₹${msg.payment_amount.toLocaleString('en-IN')} / video`;
    }
    if (msg?.payment_text && msg.payment_text.trim()) {
      const match = msg.payment_text.match(/₹([0-9,]+)/);
      if (match) return `₹${match[1]} / video`;
      return msg.payment_text.trim();
    }
    if (inf) {
      const payment = resolvePaymentDetails(inf, resolveReDispatchProducts(inf, dispatchRecords));
      if (payment.amount && payment.amount > 0) {
        return `₹${payment.amount.toLocaleString('en-IN')} / video`;
      }
      if (payment.paymentText) {
        const match = payment.paymentText.match(/₹([0-9,]+)/);
        if (match) return `₹${match[1]} / video`;
        return payment.paymentText.trim();
      }
    }
    return '—';
  };

  // Status color helper matching After Dispatch table
  const getStatusBadgeStyle = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    if (s.includes('delivered')) {
      return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40';
    }
    if (s.includes('in transit') || s.includes('transit') || s.includes('forwarded')) {
      return 'bg-blue-950/60 text-blue-400 border-blue-800/40';
    }
    if (s.includes('out for delivery')) {
      return 'bg-cyan-950/60 text-cyan-400 border-cyan-800/40';
    }
    if (s.includes('failed') || s.includes('exception') || s.includes('rto')) {
      return 'bg-rose-950/60 text-rose-400 border-rose-800/40';
    }
    if (s.includes('dispatched') || s.includes('re-dispatch')) {
      return 'bg-purple-950/60 text-purple-300 border-purple-800/40';
    }
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
      {/* Top Header Bar */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToList}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-700"
          >
            ← Back to List
          </button>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <RotateCcw size={18} className="text-purple-400" />
            Re-Dispatch
          </h3>
          <span className="px-2.5 py-0.5 bg-purple-950/60 border border-purple-800/40 rounded-full text-purple-300 text-xs font-semibold">
            {reDispatchEligibleInfluencers.length} Re-Dispatch Messages
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer border border-slate-700"
            title="Refresh"
          >
            <RefreshCcw size={14} className={isLoading ? 'animate-spin text-purple-400' : ''} />
          </button>
          <button
            type="button"
            onClick={handleDownloadCombinedPDF}
            disabled={filteredList.length === 0}
            className="px-3.5 py-1.5 bg-purple-900/50 hover:bg-purple-800/60 disabled:opacity-40 disabled:cursor-not-allowed text-purple-200 border border-purple-700/50 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Download Combined PDF in Numeric Code Order"
          >
            <Download size={14} /> Download Combined PDF
          </button>
        </div>
      </div>

      {/* Search, Filters, Selection Toolbar */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex flex-col lg:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by username or influencer code..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          </div>

          {/* Filter Popover */}
          <div className="relative" ref={filterPopoverRef}>
            <button
              type="button"
              onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm select-none ${
                activeFilterCount > 0
                  ? 'bg-purple-950/60 text-purple-300 border-purple-600/50 hover:bg-purple-900/60'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Filter Messages"
            >
              <Filter size={13} className={activeFilterCount > 0 ? 'text-purple-400' : 'text-slate-400'} />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="font-bold text-[11px] text-purple-300">
                  • {activeFilterCount}
                </span>
              )}
              <ChevronDown size={12} className={`transition-transform duration-200 opacity-60 ml-0.5 ${isFilterPopoverOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterPopoverOpen && (
              <div className="absolute left-0 mt-1.5 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Filter Options</span>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('all');
                        setCourierFilter('all');
                        setTrackingFilter('all');
                        setStateFilter('all');
                      }}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer lowercase"
                    >
                      clear all
                    </button>
                  )}
                </div>

                {/* Dispatch Status */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dispatch Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">All Statuses</option>
                    {filterOptions.statuses.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* Courier */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Courier Partner</label>
                  <select
                    value={courierFilter}
                    onChange={e => setCourierFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">All Couriers</option>
                    {filterOptions.couriers.map(cr => (
                      <option key={cr} value={cr}>{cr}</option>
                    ))}
                  </select>
                </div>

                {/* Tracking ID Available */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tracking ID</label>
                  <select
                    value={trackingFilter}
                    onChange={e => setTrackingFilter(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">All (Available & Blank)</option>
                    <option value="with_tracking">With Tracking ID</option>
                    <option value="no_tracking">Without Tracking ID (Blank)</option>
                  </select>
                </div>

                {/* State */}
                {filterOptions.states.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">State</label>
                    <select
                      value={stateFilter}
                      onChange={e => setStateFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value="all">All States</option>
                      {filterOptions.states.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selection Actions */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300 select-none">
            <input
              type="checkbox"
              checked={filteredList.length > 0 && filteredList.every(inf => selectedIds.has(inf.id))}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <span>Select All ({filteredList.length})</span>
          </label>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-3 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Delete Selected Re-Dispatch Messages"
            >
              <Trash2 size={13} /> Delete Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Main Table or Empty State */}
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 text-xs">
            <RefreshCcw size={20} className="animate-spin text-purple-400 mr-2" />
            Loading Re-Dispatch messages...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-600 shadow-inner">
              <RotateCcw size={28} className="text-purple-400/50" />
            </div>
            <h4 className="text-base font-bold text-slate-200 mb-1">
              No Re-Dispatch messages found.
            </h4>
            <p className="text-xs text-slate-500 max-w-md">
              Influencers marked for replacement or re-dispatch will automatically appear here with their generated messages.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-xs text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredList.length > 0 && filteredList.every(inf => selectedIds.has(inf.id))}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </th>
                <th className="p-3 min-w-[80px]">CODE</th>
                <th className="p-3 min-w-[140px]">USERNAME</th>
                <th className="p-3 min-w-[130px]">DISPATCH STATUS</th>
                <th className="p-3 min-w-[150px]">TRACKING ID</th>
                <th className="p-3 min-w-[130px]">PAYMENT</th>
                <th className="p-3 text-center min-w-[140px]">MESSAGE / TEXT FORMAT</th>
                <th className="p-3 text-center min-w-[120px]">PDF FORMAT</th>
                <th className="p-3 text-center w-16">DELETE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {filteredList.map(inf => {
                const infId = String(inf.id);
                const msg = messagesMap[infId];
                const resolved = resolveReDispatchShipmentInfo(inf, shipments, shipmentAttempts, dispatchRecords);

                const code = (inf.code || (inf as any).influencer_code || (inf as any).influencerCode || '—').trim();
                const user = resolveInfluencerName(inf) || '—';
                const creator = ((inf as any).creator_name || (inf as any).real_name || '').trim();

                const dispatchStatus = msg?.dispatch_status || resolved.dispatchStatus || 'Dispatched';
                const trackingId = msg?.tracking_id || resolved.trackingId || '';
                const courier = msg?.courier || resolved.courier || 'Delhivery';
                const hasTracking = Boolean(trackingId && trackingId.trim());

                return (
                  <tr key={infId} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inf.id)}
                        onChange={() => handleToggleSelect(inf.id)}
                        className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-100">
                      {code}
                    </td>
                    <td className="p-3 text-slate-200">
                      <div className="font-medium truncate max-w-[160px]" title={user}>
                        @{user.replace(/^@+/, '')}
                      </div>
                      {creator && creator !== user && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                          {creator}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getStatusBadgeStyle(dispatchStatus)}`}>
                        {dispatchStatus}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">
                      {hasTracking ? (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[130px] font-bold text-slate-200" title={trackingId}>
                            {trackingId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(trackingId, `track_${inf.id}`)}
                            className="p-1 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Copy Tracking ID"
                          >
                            {copiedId === `track_${inf.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px] italic">Not Available</span>
                      )}
                      {courier && (
                        <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                          via {courier}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-slate-300 font-medium">
                      {formatPaymentDisplay(msg, inf)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenTextModal(inf)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 hover:border-purple-500/50 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Eye size={12} /> View / Copy / Edit
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDownloadSinglePDF(inf)}
                        className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:border-purple-500/60 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Download size={12} /> Download PDF
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setDeleteModalItem({ id: inf.id, code })}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Delete Re-Dispatch Message"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* View / Copy / Edit Modal */}
      {textModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <RotateCcw size={15} className="text-purple-400" />
                  Re-Dispatch Message — {textModalItem.message.influencer_code || 'Influencer'}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  @{textModalItem.message.username.replace(/^@+/, '')} {textModalItem.message.creator_name ? `(${textModalItem.message.creator_name})` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTextModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
              {isEditingMode ? (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Edit Message Content
                  </label>
                  <textarea
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    rows={12}
                    className="w-full bg-slate-950 border border-purple-500/50 rounded-lg p-3 text-xs text-slate-200 leading-relaxed font-sans focus:outline-none focus:border-purple-400 custom-scrollbar"
                  />
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Message Preview
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRedraftMessage(textModalItem.influencer)}
                      className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      title="Re-generate using Re-Dispatch template"
                    >
                      <RefreshCcw size={11} /> Redraft Template
                    </button>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap select-text max-h-[420px] overflow-y-auto custom-scrollbar">
                    {editingText}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyText(editingText)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Copy size={13} /> Copy Message
                </button>
                {textModalItem.influencer.phone_number && (
                  <button
                    type="button"
                    onClick={() => handleOpenWhatsApp(textModalItem.influencer, editingText)}
                    className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEditingMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingText(textModalItem.message.message_text);
                        setIsEditingMode(false);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditedText}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Save size={13} /> Save
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditingMode(true)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setTextModalItem(null)}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      {deleteModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-5 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-100 mb-2">Delete Re-Dispatch Message?</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Are you sure you want to remove the Re-Dispatch message for <strong className="text-slate-200">{deleteModalItem.code}</strong>? Original influencer and shipment records remain unaffected.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalItem(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-5 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-100 mb-2">Delete Selected Messages?</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Are you sure you want to delete Re-Dispatch messages for <strong className="text-slate-200">{selectedIds.size} influencer(s)</strong>?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Delete {selectedIds.size} Messages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
