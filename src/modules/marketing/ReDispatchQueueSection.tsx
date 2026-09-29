import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Campaign } from '../../types';
import {
  RotateCcw,
  RefreshCw,
  Search,
  X,
  Check,
  CheckSquare,
  Square,
  ArrowLeft,
  Truck,
  AlertTriangle,
  ExternalLink,
  Copy,
  Clock,
  CheckCircle2,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  reDispatchQueueService,
  ReDispatchQueueItem
} from '../../services/reDispatchQueueService';

interface ReDispatchQueueSectionProps {
  campaign: Campaign;
  onBackToList: () => void;
  onRefreshCounts?: () => void;
}

export const ReDispatchQueueSection: React.FC<ReDispatchQueueSectionProps> = ({
  campaign,
  onBackToList,
  onRefreshCounts
}) => {
  const [items, setItems] = useState<ReDispatchQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [movingItemIds, setMovingItemIds] = useState<Set<string>>(new Set());
  const [isBulkMoving, setIsBulkMoving] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'moved' | 'completed'>('all');
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  // Load items from database
  const loadQueue = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await reDispatchQueueService.fetchQueueItems(campaign.id);
      setItems(data);
    } catch (err) {
      console.error('Failed to load Re-Dispatch queue:', err);
      toast.error('Failed to load Re-Dispatch queue');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => {
    loadQueue(true);

    const handleSync = () => {
      loadQueue(false);
    };

    window.addEventListener('influencer_tracking_updated', handleSync);
    window.addEventListener('influencer_status_updated', handleSync);
    window.addEventListener('velmora:influencer-updated', handleSync);

    return () => {
      window.removeEventListener('influencer_tracking_updated', handleSync);
      window.removeEventListener('influencer_status_updated', handleSync);
      window.removeEventListener('velmora:influencer-updated', handleSync);
    };
  }, [loadQueue]);

  // Counts
  const pendingCount = useMemo(() => {
    return items.filter(i => i.status === 'pending' || i.redispatch_status === 'PENDING_REDISPATCH').length;
  }, [items]);

  const movedCount = useMemo(() => {
    return items.filter(i => i.status === 'moved_to_active' || i.redispatch_status === 'MOVED_TO_ACTIVE').length;
  }, [items]);

  const completedCount = useMemo(() => {
    return items.filter(i => i.status === 'completed' || i.redispatch_status === 'COMPLETED').length;
  }, [items]);

  // Filtering based on search query and status filter
  const filteredItems = useMemo(() => {
    let result = items;

    if (statusFilter === 'pending') {
      result = result.filter(i => i.status === 'pending' || i.redispatch_status === 'PENDING_REDISPATCH');
    } else if (statusFilter === 'moved') {
      result = result.filter(i => i.status === 'moved_to_active' || i.redispatch_status === 'MOVED_TO_ACTIVE');
    } else if (statusFilter === 'completed') {
      result = result.filter(i => i.status === 'completed' || i.redispatch_status === 'COMPLETED');
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return result;

    return result.filter(item => {
      const code = (item.code || '').toLowerCase();
      const rdCode = (item.redispatch_code || '').toLowerCase();
      const name = (item.influencer_name || '').toLowerCase();
      const user = (item.username || '').toLowerCase();
      const awb = (item.previous_awb || '').toLowerCase();
      const courier = (item.courier || '').toLowerCase();
      const phone = (item.phone_number || '').toLowerCase();
      const issue = (item.issue_type || '').toLowerCase();

      return (
        code.includes(q) ||
        rdCode.includes(q) ||
        name.includes(q) ||
        user.includes(q) ||
        awb.includes(q) ||
        courier.includes(q) ||
        phone.includes(q) ||
        issue.includes(q)
      );
    });
  }, [items, searchQuery, statusFilter]);

  // Eligible for selection (strictly pending items in filtered view)
  const selectableFilteredItems = useMemo(() => {
    return filteredItems.filter(i => i.status === 'pending');
  }, [filteredItems]);

  const isAllSelectableSelected = useMemo(() => {
    if (selectableFilteredItems.length === 0) return false;
    return selectableFilteredItems.every(i => selectedIds.has(i.id));
  }, [selectableFilteredItems, selectedIds]);

  // Select all toggle
  const handleToggleSelectAll = () => {
    if (isAllSelectableSelected) {
      // Deselect visible
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableFilteredItems.forEach(i => next.delete(i.id));
        return next;
      });
    } else {
      // Select all visible pending
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableFilteredItems.forEach(i => next.add(i.id));
        return next;
      });
    }
  };

  // Single row selection
  const handleToggleSelectRow = (id: string, isPending: boolean) => {
    if (!isPending) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Copy AWB
  const handleCopyAwb = (awb: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopiedAwb(awb);
    toast.success(`Copied AWB: ${awb}`);
    setTimeout(() => {
      setCopiedAwb(null);
    }, 2000);
  };

  // Individual Move to Active
  const handleMoveSingleToActive = async (item: ReDispatchQueueItem) => {
    if (item.status === 'moved_to_active' || movingItemIds.has(item.id)) return;

    setMovingItemIds(prev => new Set(prev).add(item.id));
    try {
      const res = await reDispatchQueueService.moveInfluencerToActive(campaign.id, item);
      if (res.success) {
        toast.success(`Shipment for ${item.code || 'influencer'} moved to Active for Re-Dispatch.`);
        // Immediately transition moved record to 'moved_to_active' so it remains in All and moves to Moved tab
        setItems(prev => prev.map(i => i.id === item.id ? {
          ...i,
          status: 'moved_to_active',
          redispatch_status: 'MOVED_TO_ACTIVE',
          status_display: 'Moved to Active'
        } : i));
        // Remove from selection
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        if (onRefreshCounts) onRefreshCounts();
      } else {
        toast.error(res.error || 'Failed to move to Active for Re-Dispatch');
      }
    } catch (err: any) {
      console.error('Error moving influencer to active:', err);
      toast.error(err.message || 'Error moving shipment to Active');
    } finally {
      setMovingItemIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // Bulk Move to Active
  const handleBulkMoveToActive = async () => {
    if (selectedIds.size === 0 || isBulkMoving) return;

    const itemsToMove = items.filter(i => selectedIds.has(i.id) && (i.status === 'pending' || i.redispatch_status === 'PENDING_REDISPATCH'));
    if (itemsToMove.length === 0) return;

    setIsBulkMoving(true);
    const toastId = toast.loading(`Moving ${itemsToMove.length} shipments to Active for Re-Dispatch...`);

    try {
      const res = await reDispatchQueueService.bulkMoveInfluencersToActive(campaign.id, itemsToMove);
      if (res.success) {
        toast.success(`Successfully moved ${res.movedCount} shipments to Active for Re-Dispatch.`, { id: toastId });
        const movedIdSet = new Set(itemsToMove.map(i => i.id));
        // Immediately transition all moved records to 'moved_to_active' so they remain in All and move to Moved tab
        setItems(prev => prev.map(i => movedIdSet.has(i.id) ? {
          ...i,
          status: 'moved_to_active',
          redispatch_status: 'MOVED_TO_ACTIVE',
          status_display: 'Moved to Active'
        } : i));
        setSelectedIds(new Set());
        if (onRefreshCounts) onRefreshCounts();
      } else {
        toast.error(res.error || 'Failed to complete bulk move', { id: toastId });
      }
    } catch (err: any) {
      console.error('Error in bulk move:', err);
      toast.error(err.message || 'Error occurred during bulk move', { id: toastId });
    } finally {
      setIsBulkMoving(false);
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 box-border flex flex-col gap-4 animate-fade-in text-slate-200">
      {/* 1. TOP HEADER & NAVIGATION */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b1220] border border-slate-800/80 p-3.5 sm:p-4 rounded-2xl shadow-sm w-full max-w-full min-w-0 box-border">
        {/* Left Side: Back button + Title + Counts */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onBackToList}
            className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
            title="Back to Tracking"
          >
            <ArrowLeft size={14} />
            <span>Back to Tracking</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <RotateCcw size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Re-Dispatch Queue</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {pendingCount} Pending
                </span>
                {movedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {movedCount} Moved
                  </span>
                )}
                {completedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {completedCount} Completed
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Exception & return shipments awaiting re-dispatch back into the active logistics workflow
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Status Filter Pills + Refresh */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Status filter buttons */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'pending' ? 'bg-amber-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('moved')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'moved' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Moved ({movedCount})
            </button>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'completed' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Completed ({completedCount})
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => loadQueue(true)}
            disabled={isLoading || isBulkMoving}
            className="w-9 h-9 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50"
            title="Refresh queue"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-purple-400' : ''} />
          </button>
        </div>
      </div>

      {/* 2. SEARCH & BULK ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b1220]/70 border border-slate-800/80 px-4 py-3 rounded-2xl w-full max-w-full min-w-0 box-border">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Code, Username, Name, AWB, Courier..."
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Bulk Action Controls */}
        <div className="flex items-center gap-2.5 ml-auto">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 animate-fade-in">
              <span className="text-xs font-semibold text-purple-300 bg-purple-950/60 border border-purple-800/60 px-2.5 py-1.5 rounded-xl">
                {selectedIds.size} Selected
              </span>
              <button
                type="button"
                onClick={handleBulkMoveToActive}
                disabled={isBulkMoving}
                className="h-9 px-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 select-none"
              >
                <RotateCcw size={13} className={isBulkMoving ? 'animate-spin' : ''} />
                <span>Move Selected to Active ({selectedIds.size})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="h-9 px-2.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Deselect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. TABLE / LIST VIEW */}
      {isLoading ? (
        <div className="bg-[#0b1220] border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400">
          <RefreshCw size={28} className="animate-spin text-purple-400 mx-auto mb-3" />
          <p className="text-sm font-medium">Loading Re-Dispatch requests...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-[#0b1220] border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400">
          {searchQuery ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Search size={22} />
              </div>
              <h3 className="text-sm font-bold text-slate-200 mb-1">No matching re-dispatch records found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                No shipments in the queue match "{searchQuery}". Try searching with a different Code, AWB or username.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-amber-950/40 border border-amber-800/50 flex items-center justify-center text-amber-400 mx-auto mb-3 shadow-sm">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-1">No Re-Dispatch Requests</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                All exception shipments have been processed or no shipments currently require re-dispatch.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-[#0b1220] border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm w-full max-w-full min-w-0 box-border">
          <div className="overflow-x-auto w-full max-w-full [scrollbar-width:thin]">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                  {/* 1. Checkbox */}
                  <th className="py-3 px-2 w-9 sm:w-10 text-center shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      disabled={selectableFilteredItems.length === 0}
                      className="cursor-pointer text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
                      title={isAllSelectableSelected ? 'Deselect All' : `Select All (${selectableFilteredItems.length})`}
                    >
                      {isAllSelectableSelected ? (
                        <CheckSquare size={16} className="text-purple-400" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>

                  {/* 2. Code */}
                  <th className="py-3 px-2 w-[75px] text-left">Code</th>

                  {/* 3. Username / Influencer */}
                  <th className="py-3 px-2.5 w-[190px] text-left">Username / Influencer</th>

                  {/* 4. Previous AWB */}
                  <th className="py-3 px-2 w-[140px] text-left">Previous AWB</th>

                  {/* 5. Courier */}
                  <th className="py-3 px-2 w-[90px] text-left">Courier</th>

                  {/* 6. Issue / Remark */}
                  <th className="py-3 px-3 text-left">Issue / Remark</th>

                  {/* 7. Re-Dispatch Status */}
                  <th className="py-3 px-2 w-[145px] text-left">Re-Dispatch Status</th>

                  {/* 8. Date */}
                  <th className="py-3 px-2 w-[95px] text-left">Date</th>

                  {/* 9. Action */}
                  <th className="py-3 px-2 w-14 sm:w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredItems.map(item => {
                  const isSelected = selectedIds.has(item.id);
                  const isPending = item.status === 'pending' || item.redispatch_status === 'PENDING_REDISPATCH';
                  const isMoving = movingItemIds.has(item.id);
                  const isMoved = item.status === 'moved_to_active' || item.redispatch_status === 'MOVED_TO_ACTIVE';
                  const isCompleted = item.status === 'completed' || item.redispatch_status === 'COMPLETED';

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-purple-950/20 hover:bg-purple-950/30'
                          : isCompleted
                          ? 'bg-slate-950/40 opacity-70 hover:bg-slate-900/40'
                          : isMoved
                          ? 'bg-slate-950/30 opacity-75 hover:bg-slate-900/40'
                          : 'hover:bg-slate-900/50'
                      }`}
                    >
                      {/* 1. Checkbox */}
                      <td className="py-3 px-2 text-center w-9 sm:w-10">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => handleToggleSelectRow(item.id, isPending)}
                            className="cursor-pointer text-slate-400 hover:text-white transition-colors inline-flex items-center justify-center"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-purple-400" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        ) : isCompleted ? (
                          <CheckCircle2 size={16} className="text-blue-500/60 mx-auto" />
                        ) : (
                          <CheckCircle2 size={16} className="text-emerald-500/60 mx-auto" />
                        )}
                      </td>

                      {/* 2. Code */}
                      <td className="py-3 px-2 font-mono font-bold text-purple-300 whitespace-nowrap w-[90px]">
                        <span className="px-2 py-0.5 rounded-lg bg-purple-950/50 border border-purple-800/50 text-[11px] inline-block">
                          {item.redispatch_code || `R ${item.code}`}
                        </span>
                      </td>

                      {/* 3. Username / Influencer */}
                      <td className="py-3 px-2.5 w-[190px]">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.profile_photo_url ? (
                            <img
                              src={item.profile_photo_url}
                              alt={item.influencer_name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                              onError={e => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-purple-900/40 border border-purple-700/50 flex items-center justify-center text-[11px] font-bold text-purple-300 shrink-0">
                              {(item.influencer_name || item.code || 'I').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-white truncate text-xs" title={item.influencer_name}>
                              {item.influencer_name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate" title={item.username}>
                              {item.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 4. Previous AWB */}
                      <td className="py-3 px-2 whitespace-nowrap w-[140px]">
                        {item.previous_awb ? (
                          <div className="flex items-center gap-1 font-mono text-xs">
                            <span className="text-slate-200" title={item.previous_awb}>{item.previous_awb}</span>
                            <button
                              type="button"
                              onClick={e => handleCopyAwb(item.previous_awb, e)}
                              className="text-slate-500 hover:text-white p-0.5 rounded transition-colors cursor-pointer shrink-0"
                              title="Copy AWB"
                            >
                              {copiedAwb === item.previous_awb ? (
                                <Check size={12} className="text-emerald-400" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                            {item.tracking_url && (
                              <a
                                href={item.tracking_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-500 hover:text-purple-400 p-0.5 rounded transition-colors shrink-0"
                                title="Open tracking in courier portal"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">No AWB</span>
                        )}
                      </td>

                      {/* 5. Courier */}
                      <td className="py-3 px-2 whitespace-nowrap w-[90px]">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-900 border border-slate-700 text-slate-300 inline-block">
                          {item.courier || 'Delhivery'}
                        </span>
                      </td>

                      {/* 6. Issue / Remark */}
                      <td className="py-3 px-3 min-w-0">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 truncate" title={item.issue_type}>
                            <AlertTriangle size={12} className="shrink-0 text-amber-400" />
                            <span className="truncate">{item.issue_type}</span>
                          </span>
                          {item.issue_remarks && (
                            <span className="text-[11px] text-slate-400 truncate" title={item.issue_remarks}>
                              {item.issue_remarks}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Re-Dispatch Status */}
                      <td className="py-3 px-2 whitespace-nowrap w-[145px]">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                            Pending Re-Dispatch
                          </span>
                        ) : isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-blue-950/60 text-blue-300 border border-blue-800/60">
                            <Check size={11} className="text-blue-400 shrink-0" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                            <Check size={11} className="text-emerald-400 shrink-0" />
                            {item.redispatch_awb ? 'Dispatched' : 'Moved to Active'}
                          </span>
                        )}
                      </td>

                      {/* 8. Date */}
                      <td className="py-3 px-2 text-slate-400 text-xs whitespace-nowrap w-[95px]">
                        {item.date_display}
                      </td>

                      {/* 9. Action Button (ICON ONLY) */}
                      <td className="py-3 px-2 text-center whitespace-nowrap w-14 sm:w-16">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => handleMoveSingleToActive(item)}
                            disabled={isMoving || isBulkMoving}
                            className="w-8 h-8 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-sm shadow-purple-600/30 flex items-center justify-center mx-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                            title="Move to Active"
                            aria-label="Move to Active"
                          >
                            <RotateCcw size={14} className={isMoving ? 'animate-spin' : ''} />
                          </button>
                        ) : isCompleted ? (
                          <div
                            className="w-8 h-8 rounded-xl bg-blue-950/40 border border-blue-800/50 text-blue-400 flex items-center justify-center mx-auto select-none"
                            title="Completed"
                            aria-label="Completed"
                          >
                            <CheckCircle2 size={14} />
                          </div>
                        ) : (
                          <div
                            className="w-8 h-8 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 flex items-center justify-center mx-auto select-none"
                            title={item.redispatch_awb ? `Dispatched (AWB: ${item.redispatch_awb})` : "Active — Re-Dispatch"}
                            aria-label={item.redispatch_awb ? "Dispatched" : "Active — Re-Dispatch"}
                          >
                            <CheckCircle2 size={14} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer status summary */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950/40 border-t border-slate-800/60 text-xs text-slate-400">
            <div>
              Showing <span className="text-white font-bold">{filteredItems.length}</span> of{' '}
              <span className="text-white font-bold">{items.length}</span> total Re-Dispatch records
            </div>
            {selectedIds.size > 0 && (
              <div className="text-purple-300 font-semibold">
                {selectedIds.size} of {selectableFilteredItems.length} pending items selected
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
