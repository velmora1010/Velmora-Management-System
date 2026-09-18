import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { 
  Search, 
  Send, 
  Copy, 
  Edit2, 
  Download, 
  Eye, 
  RefreshCcw, 
  CheckSquare, 
  Sparkles, 
  X, 
  Save, 
  Trash2, 
  ChevronDown, 
  Check, 
  Filter, 
  ExternalLink,
  Package,
  Clock,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { naturalSortCompare } from '../../config/skuMapping';
import { isActiveStatus } from '../../utils/marketingUtils';
import { 
  afterDispatchService, 
  StoredAfterDispatchMessage, 
  resolveDispatchedProducts, 
  resolvePaymentDetails, 
  resolveInfluencerShipment, 
  buildAfterDispatchMessage 
} from '../../services/afterDispatchService';
import { 
  fetchCampaignShipmentsFromDb, 
  InfluencerDispatchedShipment 
} from '../../services/influencerTrackingService';
import { 
  generateSingleAfterDispatchPDF, 
  generateCombinedAfterDispatchPDF 
} from '../../utils/generateAfterDispatchPDF';

interface AfterDispatchSectionProps {
  campaign: Campaign;
  influencers: CampaignInfluencer[];
  onBackToList: () => void;
  refreshTrigger?: number;
}

export const AfterDispatchSection: React.FC<AfterDispatchSectionProps> = ({
  campaign,
  influencers,
  onBackToList,
  refreshTrigger
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [messagesMap, setMessagesMap] = useState<Record<string, StoredAfterDispatchMessage>>({});
  const [shipments, setShipments] = useState<InfluencerDispatchedShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [textModalItem, setTextModalItem] = useState<{
    influencer: CampaignInfluencer;
    message: StoredAfterDispatchMessage;
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

  // Load shipments & messages
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [msgs, ships] = await Promise.all([
        afterDispatchService.getMessages(campaign.id),
        fetchCampaignShipmentsFromDb(campaign.id)
      ]);
      setMessagesMap(msgs);
      setShipments(ships);
    } catch (err) {
      console.error('Failed loading After Dispatch data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaign.id, refreshTrigger]);

  // Active influencers
  const activeInfluencers = useMemo(() => {
    const list = influencers.filter(inf => isActiveStatus(inf.is_archived));
    return list.sort((a, b) => naturalSortCompare(a.code || (a as any).influencer_code || '', b.code || (b as any).influencer_code || ''));
  }, [influencers]);

  // Influencers with generated After Dispatch messages
  const generatedInfluencers = useMemo(() => {
    return activeInfluencers.filter(inf => Boolean(messagesMap[String(inf.id)]));
  }, [activeInfluencers, messagesMap]);

  // Filter options derived from actual data
  const filterOptions = useMemo(() => {
    const statuses = new Set<string>();
    const couriers = new Set<string>();
    const states = new Set<string>();

    generatedInfluencers.forEach(inf => {
      const msg = messagesMap[String(inf.id)];
      if (msg) {
        if (msg.dispatch_status) statuses.add(msg.dispatch_status.trim());
        if (msg.courier) couriers.add(msg.courier.trim());
      }
      if (inf.state) states.add(inf.state.trim());
    });

    return {
      statuses: Array.from(statuses).filter(Boolean).sort(),
      couriers: Array.from(couriers).filter(Boolean).sort(),
      states: Array.from(states).filter(Boolean).sort()
    };
  }, [generatedInfluencers, messagesMap]);

  // Filtered list
  const filteredList = useMemo(() => {
    return generatedInfluencers.filter(inf => {
      const msg = messagesMap[String(inf.id)];
      if (!msg) return false;

      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const code = (inf.code || (inf as any).influencer_code || '').toLowerCase();
        const username = (inf.influencer_name || inf.name || (inf as any).username || '').toLowerCase();
        const creatorName = (msg.creator_name || '').toLowerCase();
        const tracking = (msg.tracking_id || '').toLowerCase();

        if (!code.includes(q) && !username.includes(q) && !creatorName.includes(q) && !tracking.includes(q)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if ((msg.dispatch_status || '').toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // Courier filter
      if (courierFilter !== 'all') {
        if ((msg.courier || '').toLowerCase() !== courierFilter.toLowerCase()) {
          return false;
        }
      }

      // Tracking filter
      if (trackingFilter === 'with_tracking') {
        if (!msg.tracking_id || !msg.tracking_id.trim()) return false;
      } else if (trackingFilter === 'no_tracking') {
        if (msg.tracking_id && msg.tracking_id.trim()) return false;
      }

      // State filter
      if (stateFilter !== 'all') {
        if ((inf.state || '').toLowerCase() !== stateFilter.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [generatedInfluencers, messagesMap, searchTerm, statusFilter, courierFilter, trackingFilter, stateFilter]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (statusFilter !== 'all') c++;
    if (courierFilter !== 'all') c++;
    if (trackingFilter !== 'all') c++;
    if (stateFilter !== 'all') c++;
    return c;
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

  // View / Copy / Edit
  const handleOpenTextModal = (influencer: CampaignInfluencer) => {
    const msg = messagesMap[String(influencer.id)];
    if (!msg) return;
    setTextModalItem({ influencer, message: msg });
    setEditingText(msg.message_text);
    setIsEditingMode(false);
  };

  const handleCopyMessage = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      toast.success('Message copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy message.');
    }
  };

  const handleSaveEditedText = async () => {
    if (!textModalItem) return;
    const updated = {
      ...textModalItem.message,
      message_text: editingText,
      updated_at: new Date().toISOString()
    };

    try {
      await afterDispatchService.persistSingleMessage(campaign.id, updated);
      setMessagesMap(prev => ({
        ...prev,
        [String(textModalItem.influencer.id)]: updated
      }));
      setTextModalItem({ ...textModalItem, message: updated });
      setIsEditingMode(false);
      toast.success('After Dispatch message saved!');
    } catch (err: any) {
      toast.error('Failed to save message.');
    }
  };

  // Single PDF Download
  const handleDownloadSinglePDF = (influencer: CampaignInfluencer) => {
    const msg = messagesMap[String(influencer.id)];
    if (!msg) return;

    generateSingleAfterDispatchPDF(campaign.campaign_name, {
      influencerCode: msg.influencer_code,
      username: msg.username,
      creatorName: msg.creator_name,
      courier: msg.courier,
      trackingId: msg.tracking_id,
      trackingUrl: msg.tracking_url,
      dispatchStatus: msg.dispatch_status,
      messageText: msg.message_text
    });
    toast.success(`PDF downloaded for ${msg.influencer_code || 'Influencer'}!`);
  };

  // Combined PDF Download
  const handleDownloadCombinedPDF = () => {
    const targetInfluencers = selectedIds.size > 0 
      ? filteredList.filter(inf => selectedIds.has(inf.id))
      : filteredList;

    if (targetInfluencers.length === 0) {
      toast.error('No generated After Dispatch messages to download.');
      return;
    }

    const items = targetInfluencers.map(inf => {
      const msg = messagesMap[String(inf.id)]!;
      return {
        influencerCode: msg.influencer_code,
        username: msg.username,
        creatorName: msg.creator_name,
        courier: msg.courier,
        trackingId: msg.tracking_id,
        trackingUrl: msg.tracking_url,
        dispatchStatus: msg.dispatch_status,
        messageText: msg.message_text
      };
    });

    generateCombinedAfterDispatchPDF(campaign.campaign_name, items);
    toast.success(`Combined PDF downloaded for ${items.length} influencer(s)!`);
  };

  // Deletion
  const handleConfirmSingleDelete = async () => {
    if (!deleteModalItem) return;
    const { id, code } = deleteModalItem;

    try {
      await afterDispatchService.deleteMessage(campaign.id, id);
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
      toast.success(`After Dispatch message for ${code || 'influencer'} deleted.`);
    } catch (err) {
      toast.error('Failed to delete After Dispatch message.');
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idList = Array.from(selectedIds);

    try {
      await afterDispatchService.batchDeleteMessages(campaign.id, idList);
      setMessagesMap(prev => {
        const next = { ...prev };
        idList.forEach(id => {
          delete next[String(id)];
        });
        return next;
      });
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
      toast.success(`Deleted ${idList.length} After Dispatch message(s).`);
    } catch (err) {
      toast.error('Failed to delete selected messages.');
    }
  };

  // Format payment display
  const formatPaymentDisplay = (msg: StoredAfterDispatchMessage) => {
    if (msg.payment_amount !== null && msg.payment_amount !== undefined && msg.payment_amount > 0) {
      return `₹${msg.payment_amount.toLocaleString('en-IN')} / video`;
    }
    if (msg.payment_text && msg.payment_text.trim()) {
      const match = msg.payment_text.match(/₹([0-9,]+)/);
      if (match) return `₹${match[1]} / video`;
      return msg.payment_text.trim();
    }
    return '—';
  };

  // Status color helper
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
    if (s.includes('dispatched')) {
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
            onClick={onBackToList}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-700"
          >
            ← Back to List
          </button>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Send size={18} className="text-purple-400" />
            After Dispatch
          </h3>
          <span className="px-2.5 py-0.5 bg-purple-950/60 border border-purple-800/40 rounded-full text-purple-300 text-xs font-semibold">
            {generatedInfluencers.length} After Dispatch Messages
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer border border-slate-700"
            title="Refresh"
          >
            <RefreshCcw size={14} className={isLoading ? 'animate-spin text-purple-400' : ''} />
          </button>
          <button
            onClick={handleDownloadCombinedPDF}
            disabled={generatedInfluencers.length === 0}
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
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-3 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Delete Selected After Dispatch Messages"
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
            Loading After Dispatch messages...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-600 shadow-inner">
              <Send size={28} />
            </div>
            <h4 className="text-base font-bold text-slate-200 mb-1">
              No After Dispatch messages found.
            </h4>
            <p className="text-xs text-slate-500 max-w-md">
              Select active/dispatched influencers from the Campaign Influencer List View and click <span className="text-purple-400 font-semibold">Generate After Dispatch</span> to create messages.
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
                const msg = messagesMap[String(inf.id)]!;
                const code = inf.code || (inf as any).influencer_code || '—';
                const user = inf.influencer_name || inf.name || (inf as any).username || '—';
                const hasTracking = Boolean(msg.tracking_id && msg.tracking_id.trim());

                return (
                  <tr key={inf.id} className="hover:bg-slate-900/50 transition-colors">
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
                      {msg.creator_name && msg.creator_name !== user && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                          {msg.creator_name}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getStatusBadgeStyle(msg.dispatch_status)}`}>
                        {msg.dispatch_status || 'Dispatched'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">
                      {hasTracking ? (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[130px] font-bold text-slate-200" title={msg.tracking_id}>
                            {msg.tracking_id}
                          </span>
                          <button
                            onClick={() => handleCopyMessage(msg.tracking_id, `track_${inf.id}`)}
                            className="p-1 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Copy Tracking ID"
                          >
                            {copiedId === `track_${inf.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px] italic">Not Available</span>
                      )}
                      {msg.courier && (
                        <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                          via {msg.courier}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-slate-300 font-medium">
                      {formatPaymentDisplay(msg)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleOpenTextModal(inf)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 hover:border-purple-500/50 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Eye size={12} /> View / Copy / Edit
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDownloadSinglePDF(inf)}
                        className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:border-purple-500/60 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Download size={12} /> Download PDF
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setDeleteModalItem({ id: inf.id, code })}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Delete After Dispatch Message"
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
                  <Send size={15} className="text-purple-400" />
                  After Dispatch Message — {textModalItem.message.influencer_code || 'Influencer'}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  @{textModalItem.message.username.replace(/^@+/, '')} {textModalItem.message.creator_name ? `(${textModalItem.message.creator_name})` : ''}
                </p>
              </div>
              <button
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
                    rows={14}
                    className="w-full bg-slate-950 border border-purple-500/50 rounded-lg p-3 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Manual edits only update this After Dispatch message and do not modify master pricing, products, or influencer details.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                  {textModalItem.message.message_text}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {!isEditingMode ? (
                  <button
                    onClick={() => setIsEditingMode(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 size={13} /> Edit Message
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditingText(textModalItem.message.message_text);
                      setIsEditingMode(false);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyMessage(isEditingMode ? editingText : textModalItem.message.message_text)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Copy size={13} /> Copy Text
                </button>

                {isEditingMode && (
                  <button
                    onClick={handleSaveEditedText}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Save size={13} /> Save Changes
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      {deleteModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-5 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-800/50 flex items-center justify-center mx-auto text-rose-400">
              <Trash2 size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Delete After Dispatch Message?
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Are you sure you want to delete the message for <span className="font-bold text-slate-200">{deleteModalItem.code}</span>?
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                This only removes the generated message record. The influencer, basic info, pricing, tracking, and offer agreements will NOT be deleted.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteModalItem(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSingleDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Delete Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-5 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-800/50 flex items-center justify-center mx-auto text-rose-400">
              <Trash2 size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Delete {selectedIds.size} Selected Messages?
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                This will only delete the generated After Dispatch messages for the {selectedIds.size} selected influencer(s). Master influencer data remains completely safe.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Confirm Delete ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
