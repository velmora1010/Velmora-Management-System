import React, { useState, useEffect, useMemo } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { 
  X, 
  Package, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  Plus, 
  Trash2, 
  Eye, 
  ArrowRightLeft,
  ChevronRight,
  Sparkles,
  Users
} from 'lucide-react';
import { 
  dispatchBatchService, 
  type DispatchBatch, 
  type DispatchBatchMember, 
  type BatchStatus 
} from '../../services/dispatchBatchService';
import toast from 'react-hot-toast';

interface PrepareDispatchModalProps {
  campaign: Campaign;
  selectedInfluencers: CampaignInfluencer[];
  allActiveInfluencers: CampaignInfluencer[];
  onClose: () => void;
  onBatchesUpdated?: () => void;
  initialBatches?: DispatchBatch[];
}

export const PrepareDispatchModal: React.FC<PrepareDispatchModalProps> = ({
  campaign,
  selectedInfluencers,
  allActiveInfluencers,
  onClose,
  onBatchesUpdated,
  initialBatches,
}) => {
  const [batches, setBatches] = useState<DispatchBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Confirmation dialog state
  const [confirmingBatch, setConfirmingBatch] = useState<DispatchBatch | null>(null);
  const [isConfirmingDispatch, setIsConfirmingDispatch] = useState(false);

  // Inspection view state (View Dispatch)
  const [inspectingBatch, setInspectingBatch] = useState<DispatchBatch | null>(null);

  // Quick split helper modal/popover state
  const [splitSize, setSplitSize] = useState<number>(5);
  const [showSplitControls, setShowSplitControls] = useState<boolean>(false);

  // Today's default date formatted as DD-MMM-YYYY or YYYY-MM-DD
  const getDefaultDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDefaultTime = () => '10:00';

  // Load existing batches on mount
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        let loaded = initialBatches || [];
        if (!loaded || loaded.length === 0) {
          loaded = await dispatchBatchService.getBatches(campaign.id);
        }

        // Prune eliminated/recycled influencers from pending batches
        const { updatedBatches } = dispatchBatchService.pruneInactiveMembers(loaded, allActiveInfluencers);
        loaded = updatedBatches;

        // If there are selected influencers, ensure they are represented in batches
        if (selectedInfluencers && selectedInfluencers.length > 0) {
          // Identify influencers not yet assigned to any batch
          const assignedIds = new Set<string>();
          loaded.forEach(b => b.members.forEach(m => assignedIds.add(String(m.influencer_id))));

          const unassignedSelected = selectedInfluencers.filter(
            inf => !assignedIds.has(String(inf.id))
          );

          if (unassignedSelected.length > 0) {
            // Create a new batch for the newly selected unassigned influencers
            const batchNumber = loaded.length + 1;
            const newBatch: DispatchBatch = {
              id: crypto.randomUUID ? crypto.randomUUID() : `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              campaign_id: String(campaign.id),
              batch_name: `Batch ${batchNumber}`,
              dispatch_date: getDefaultDate(),
              dispatch_time: getDefaultTime(),
              status: 'Ready to Dispatch',
              members: unassignedSelected.map(inf => ({
                id: `member_${inf.id}_${Date.now()}`,
                influencer_id: String(inf.id),
                influencer_code: inf.code || '',
                creator_name: inf.name || inf.influencer_name || '',
                profile_file_url: inf.profile_file_url || '',
                dispatch_status: 'Pending',
              })),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            loaded = [...loaded, newBatch];
          }
        }

        if (isMounted) {
          setBatches(loaded);
          await dispatchBatchService.saveBatches(campaign.id, loaded);
        }
      } catch (err) {
        console.error('Error loading dispatch batches:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [campaign.id, initialBatches, selectedInfluencers, allActiveInfluencers]);

  // Influencer lookup map
  const influencerLookup = useMemo(() => {
    const map = new Map<string, CampaignInfluencer>();
    allActiveInfluencers.forEach(inf => {
      map.set(String(inf.id), inf);
    });
    return map;
  }, [allActiveInfluencers]);

  // Update batch details (e.g. date, time, status, name)
  const updateBatchField = async (
    batchId: string, 
    field: keyof DispatchBatch, 
    value: any
  ) => {
    const updated = batches.map(b => {
      if (b.id === batchId) {
        return {
          ...b,
          [field]: value,
          updated_at: new Date().toISOString(),
        };
      }
      return b;
    });
    setBatches(updated);
    await dispatchBatchService.saveBatches(campaign.id, updated);
  };

  // Add a new empty batch
  const handleAddNewBatch = async () => {
    const batchNumber = batches.length + 1;
    const newBatch: DispatchBatch = {
      id: crypto.randomUUID ? crypto.randomUUID() : `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      campaign_id: String(campaign.id),
      batch_name: `Batch ${batchNumber}`,
      dispatch_date: getDefaultDate(),
      dispatch_time: getDefaultTime(),
      status: 'Ready to Dispatch',
      members: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [...batches, newBatch];
    setBatches(updated);
    await dispatchBatchService.saveBatches(campaign.id, updated);
    toast.success(`Created Batch ${batchNumber}`);
  };

  // Move a member from one batch to another
  const handleMoveMember = async (
    memberInfluencerId: string, 
    sourceBatchId: string, 
    targetBatchId: string
  ) => {
    if (sourceBatchId === targetBatchId) return;

    let movedMember: DispatchBatchMember | null = null;
    const updated = batches.map(b => {
      if (b.id === sourceBatchId) {
        const found = b.members.find(m => String(m.influencer_id) === String(memberInfluencerId));
        if (found) movedMember = found;
        return {
          ...b,
          members: b.members.filter(m => String(m.influencer_id) !== String(memberInfluencerId)),
          updated_at: new Date().toISOString(),
        };
      }
      return b;
    });

    if (movedMember) {
      const finalBatches = updated.map(b => {
        if (b.id === targetBatchId) {
          return {
            ...b,
            members: [...b.members, movedMember!],
            updated_at: new Date().toISOString(),
          };
        }
        return b;
      });
      setBatches(finalBatches);
      await dispatchBatchService.saveBatches(campaign.id, finalBatches);
    }
  };

  // Quick split active pending influencers into batches of size N
  const handleApplyQuickSplit = async () => {
    if (splitSize <= 0) return;

    // Collect all members from pending / ready batches
    const pendingMembers: DispatchBatchMember[] = [];
    const dispatchedBatches: DispatchBatch[] = [];

    batches.forEach(b => {
      if (b.status === 'Dispatched') {
        dispatchedBatches.push(b);
      } else {
        pendingMembers.push(...b.members);
      }
    });

    if (pendingMembers.length === 0) {
      toast.error('No pending influencers to distribute.');
      return;
    }

    // Distribute into chunks of splitSize
    const newPendingBatches: DispatchBatch[] = [];
    let startBatchNum = dispatchedBatches.length + 1;

    for (let i = 0; i < pendingMembers.length; i += splitSize) {
      const chunk = pendingMembers.slice(i, i + splitSize);
      const batchNum = startBatchNum++;
      newPendingBatches.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        campaign_id: String(campaign.id),
        batch_name: `Batch ${batchNum}`,
        dispatch_date: getDefaultDate(),
        dispatch_time: getDefaultTime(),
        status: 'Ready to Dispatch',
        members: chunk,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const finalBatches = [...dispatchedBatches, ...newPendingBatches];
    setBatches(finalBatches);
    await dispatchBatchService.saveBatches(campaign.id, finalBatches);
    setShowSplitControls(false);
    toast.success(`Distributed into ${newPendingBatches.length} batches of up to ${splitSize} influencers.`);
  };

  // Delete an un-dispatched batch
  const handleDeleteBatch = async (batchId: string) => {
    const target = batches.find(b => b.id === batchId);
    if (!target) return;
    if (target.status === 'Dispatched') {
      toast.error('Cannot delete an already dispatched batch.');
      return;
    }

    const updated = batches.filter(b => b.id !== batchId);
    setBatches(updated);
    await dispatchBatchService.saveBatches(campaign.id, updated);
    toast.success(`${target.batch_name} removed.`);
  };

  // Confirm Dispatch Execution
  const handleConfirmDispatchAction = async () => {
    if (!confirmingBatch) return;

    setIsConfirmingDispatch(true);
    try {
      const updatedBatches = await dispatchBatchService.confirmDispatch(
        campaign.id,
        confirmingBatch.id,
        batches,
        allActiveInfluencers
      );

      setBatches(updatedBatches);
      setConfirmingBatch(null);
      toast.success(`${confirmingBatch.batch_name} confirmed and marked as Dispatched!`);
      onBatchesUpdated?.();
    } catch (err) {
      console.error('Failed to confirm dispatch:', err);
      toast.error('Failed to confirm dispatch. Please try again.');
    } finally {
      setIsConfirmingDispatch(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-[#141a29] border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700/80 bg-[#1e2638] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Truck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-100">Prepare Dispatch</h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-950/70 border border-purple-800/50 text-purple-300">
                  {batches.length} {batches.length === 1 ? 'Batch' : 'Batches'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Organize selected influencers into dispatch batches, set date & time, and dispatch independently.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSplitControls(prev => !prev)}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Split influencers into batches"
            >
              <ArrowRightLeft size={14} />
              <span className="hidden sm:inline">Split Batches</span>
            </button>
            <button
              type="button"
              onClick={handleAddNewBatch}
              className="px-3 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-950/60 hover:bg-purple-900/80 rounded-xl border border-purple-800/40 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Batch</span>
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Split Bar (Collapsible) */}
        {showSplitControls && (
          <div className="px-5 py-3 bg-[#182133] border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-400" />
                Distribute Pending Influencers:
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Influencers per batch:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={splitSize}
                  onChange={(e) => setSplitSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100 text-center text-xs focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyQuickSplit}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg shadow transition-colors cursor-pointer"
              >
                Apply Distribution
              </button>
              <button
                type="button"
                onClick={() => setShowSplitControls(false)}
                className="px-2 py-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Batch Cards Grid */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400">
              <Truck size={32} className="animate-bounce mx-auto mb-2 text-purple-400" />
              <p className="text-sm">Loading dispatch batches...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl">
              <Package size={36} className="mx-auto mb-2 text-slate-600" />
              <p className="font-semibold text-slate-300">No Batches Prepared</p>
              <p className="text-xs text-slate-500 mt-1">
                Select influencers and click "Prepare Dispatch" or click "Add Batch" above to start.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {batches.map((batch, batchIdx) => {
                const isDispatched = batch.status === 'Dispatched';
                const memberCount = batch.members.length;

                return (
                  <div
                    key={batch.id}
                    className={`rounded-2xl border transition-all flex flex-col justify-between p-4 shadow-sm ${
                      isDispatched 
                        ? 'bg-[#0d1c1c]/70 border-emerald-500/30' 
                        : 'bg-[#0e1626]/80 border-slate-800 hover:border-slate-700/80'
                    }`}
                  >
                    {/* Card Top: Batch Title & Status */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            disabled={isDispatched}
                            value={batch.batch_name}
                            onChange={(e) => updateBatchField(batch.id, 'batch_name', e.target.value)}
                            className="bg-transparent font-bold text-slate-100 text-base focus:outline-none focus:border-b focus:border-purple-500 w-32 sm:w-40 disabled:opacity-90"
                          />
                          <span className="text-xs text-slate-400 font-medium">
                            ({memberCount} {memberCount === 1 ? 'Influencer' : 'Influencers'})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isDispatched ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Dispatched
                            </span>
                          ) : (
                            <select
                              value={batch.status}
                              onChange={(e) => updateBatchField(batch.id, 'status', e.target.value as BatchStatus)}
                              className={`px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-md text-xs font-medium focus:outline-none cursor-pointer ${
                                batch.status === 'Ready to Dispatch' ? 'text-purple-300 font-semibold' : 'text-amber-300'
                              }`}
                            >
                              <option value="Ready to Dispatch">Ready to Dispatch</option>
                              <option value="Pending">Pending</option>
                            </select>
                          )}

                          {!isDispatched && (
                            <button
                              type="button"
                              onClick={() => handleDeleteBatch(batch.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                              title="Delete batch"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Independent Date & Time Pickers */}
                      <div className="grid grid-cols-2 gap-2 mb-3.5">
                        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 flex items-center gap-2">
                          <CalendarIcon size={14} className="text-purple-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="block text-[10px] uppercase font-semibold text-slate-500">Date</span>
                            <input
                              type="date"
                              disabled={isDispatched}
                              value={batch.dispatch_date}
                              onChange={(e) => updateBatchField(batch.id, 'dispatch_date', e.target.value)}
                              className="w-full bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer disabled:opacity-80"
                            />
                          </div>
                        </div>

                        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 flex items-center gap-2">
                          <Clock size={14} className="text-purple-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="block text-[10px] uppercase font-semibold text-slate-500">Time</span>
                            <input
                              type="time"
                              disabled={isDispatched}
                              value={batch.dispatch_time}
                              onChange={(e) => updateBatchField(batch.id, 'dispatch_time', e.target.value)}
                              className="w-full bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer disabled:opacity-80"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Influencer Chips List */}
                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                          <span>Influencers ({memberCount}):</span>
                        </div>

                        {memberCount === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
                            No influencers assigned. Move influencers here from another batch.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-900/70 border border-slate-800/80 rounded-xl [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
                            {batch.members.map((member) => {
                              const inf = influencerLookup.get(String(member.influencer_id));
                              const displayCode = member.influencer_code || inf?.code || `ID:${member.influencer_id}`;
                              const username = inf?.influencer_name || inf?.name || member.creator_name || '';

                              return (
                                <div
                                  key={member.influencer_id}
                                  className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-slate-800/90 text-slate-200 border border-slate-700/70 hover:border-purple-500/50 transition-colors"
                                  title={`${username} (${displayCode})`}
                                >
                                  <span className="font-mono font-bold text-purple-300 text-[11px]">
                                    {displayCode}
                                  </span>
                                  {username && (
                                    <span className="text-slate-400 text-[10px] max-w-[70px] truncate">
                                      @{username.replace(/^@+/, '')}
                                    </span>
                                  )}

                                  {/* Reassign dropdown button when batch is not dispatched */}
                                  {!isDispatched && batches.length > 1 && (
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleMoveMember(member.influencer_id, batch.id, e.target.value);
                                        }
                                      }}
                                      className="text-[9px] bg-slate-900 text-slate-400 hover:text-purple-300 border-none rounded p-0 cursor-pointer focus:outline-none"
                                      title="Move to another batch"
                                    >
                                      <option value="" disabled>→</option>
                                      {batches
                                        .filter(other => other.id !== batch.id && other.status !== 'Dispatched')
                                        .map(other => (
                                          <option key={other.id} value={other.id}>
                                            Move to {other.batch_name}
                                          </option>
                                        ))}
                                    </select>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Bottom Actions: Dispatch OR View Dispatch */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setInspectingBatch(batch)}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye size={13} />
                        View Details
                      </button>

                      {isDispatched ? (
                        <button
                          type="button"
                          onClick={() => setInspectingBatch(batch)}
                          className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={14} />
                          View Dispatch
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={memberCount === 0}
                          onClick={() => setConfirmingBatch(batch)}
                          className={`px-4 py-2 text-xs font-bold rounded-xl text-white shadow-md transition-all flex items-center gap-1.5 ${
                            memberCount === 0
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30 cursor-pointer'
                          }`}
                        >
                          <Truck size={14} />
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

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/80 bg-[#1e2638] flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            Batches and schedules are automatically saved and persistent across refreshes.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* CONFIRMATION MODAL (Step 12: Confirm Dispatch) */}
      {confirmingBatch && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#141a29] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4 text-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
                <Truck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Confirm Batch Dispatch</h3>
                <p className="text-xs text-slate-400">Please review batch details before confirming.</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 font-medium">
              Are you sure you want to confirm dispatch for this batch?
            </p>

            {/* Details Box */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Batch:</span>
                <span className="font-bold text-slate-200">{confirmingBatch.batch_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Influencers:</span>
                <span className="font-bold text-purple-300">{confirmingBatch.members.length} Influencers</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Dispatch Date:</span>
                <span className="font-bold text-slate-200">{confirmingBatch.dispatch_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Dispatch Time:</span>
                <span className="font-bold text-slate-200">{confirmingBatch.dispatch_time}</span>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <span className="block text-slate-400 font-medium mb-1">Influencer Codes:</span>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
                  {confirmingBatch.members.map(m => (
                    <span 
                      key={m.influencer_id} 
                      className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300 font-mono text-[11px] font-bold"
                    >
                      {m.influencer_code || `ID:${m.influencer_id}`}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isConfirmingDispatch}
                onClick={() => setConfirmingBatch(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isConfirmingDispatch}
                onClick={handleConfirmDispatchAction}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isConfirmingDispatch ? (
                  <>
                    <Truck size={14} className="animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Confirm Dispatch
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DISPATCH MODAL (Step 14: View Dispatch) */}
      {inspectingBatch && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#141a29] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-700/80 bg-[#1e2638] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Truck size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-100">{inspectingBatch.batch_name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      inspectingBatch.status === 'Dispatched'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {inspectingBatch.status === 'Dispatched' ? '● Dispatched' : inspectingBatch.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Dispatch Date: {inspectingBatch.dispatch_date} • Time: {inspectingBatch.dispatch_time}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingBatch(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* List of members in this batch */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
              <div className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
                Batch Influencers ({inspectingBatch.members.length})
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {inspectingBatch.members.map((member) => {
                  const inf = influencerLookup.get(String(member.influencer_id));
                  const username = inf?.influencer_name || inf?.name || member.creator_name || '—';
                  const code = member.influencer_code || inf?.code || `ID:${member.influencer_id}`;
                  const profileUrl = inf?.profile_file_url || member.profile_file_url;

                  return (
                    <div 
                      key={member.influencer_id}
                      className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {profileUrl ? (
                            <img src={profileUrl} alt={username} className="w-full h-full object-cover" />
                          ) : (
                            username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-200 truncate">
                            @{username.replace(/^@+/, '')}
                          </p>
                          <span className="inline-block mt-0.5 px-2 py-0.2 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300 font-mono text-[10px] font-bold">
                            {code}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          inspectingBatch.status === 'Dispatched'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {inspectingBatch.status === 'Dispatched' ? 'Dispatched' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700/80 bg-[#1e2638] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setInspectingBatch(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
