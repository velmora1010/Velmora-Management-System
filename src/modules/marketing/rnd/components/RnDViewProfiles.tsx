import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  ChevronsDown,
  ChevronsUp
} from 'lucide-react';
import { ResearchInputProfile, ProfileResearchResult } from '../types/rndTypes';

interface RnDViewProfilesProps {
  profiles: ResearchInputProfile[];
  researchResults: Record<string, ProfileResearchResult>;
  selectedProfileCode?: string | null;
  onSelectProfile: (influencerCode: string) => void;
  currentRunningCode?: string | null;
}

type StatusFilter = 'all' | 'completed' | 'failed' | 'partial';

export const RnDViewProfiles: React.FC<RnDViewProfilesProps> = ({
  profiles,
  researchResults,
  selectedProfileCode,
  onSelectProfile,
  currentRunningCode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isSectionCollapsed, setIsSectionCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // 1. Filter only profiles that are either in researchResults or currently running
  const activeProfiles = useMemo(() => {
    return profiles.filter(
      p => researchResults[p.influencerCode] || p.influencerCode === currentRunningCode
    );
  }, [profiles, researchResults, currentRunningCode]);

  // 2. Compute aggregate summary metrics
  const summary = useMemo(() => {
    let completed = 0;
    let failed = 0;
    let partial = 0;

    activeProfiles.forEach(p => {
      const res = researchResults[p.influencerCode];
      if (!res) return;
      if (res.status === 'completed') {
        completed++;
      } else if (res.status === 'failed' || res.status === 'reels_not_found') {
        failed++;
      } else if (res.status === 'partial' || res.status === 'reels_not_enough') {
        partial++;
      }
    });

    return {
      total: activeProfiles.length,
      completed,
      failed,
      partial
    };
  }, [activeProfiles, researchResults]);

  // 3. Helper to determine failure reason cleanly
  const getFailureReason = (res?: ProfileResearchResult): string => {
    if (!res) return 'Failed';
    return res.failureReason || res.error || 'Page Not Found';
  };

  // 4. Extract prefix key for grouping (e.g. HIS, TNS, KLS, TGS)
  const getGroupKey = (p: ResearchInputProfile): string => {
    const code = (p.influencerCode || '').trim();
    const alphaMatch = code.match(/^[A-Za-z]+/);
    if (alphaMatch && alphaMatch[0]) {
      return alphaMatch[0].toUpperCase();
    }
    if (p.category && p.category.trim()) {
      return p.category.trim().toUpperCase();
    }
    return 'OTHER';
  };

  // 5. Filter by search term & status tab
  const filteredProfiles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return activeProfiles.filter(p => {
      const res = researchResults[p.influencerCode];
      const isRunning = p.influencerCode === currentRunningCode;

      // Status Filter
      if (statusFilter === 'completed' && res?.status !== 'completed') {
        return false;
      }
      if (statusFilter === 'failed' && res?.status !== 'failed' && res?.status !== 'reels_not_found') {
        return false;
      }
      if (statusFilter === 'partial' && res?.status !== 'partial' && res?.status !== 'reels_not_enough') {
        return false;
      }

      // Search Query
      if (!query) return true;

      const code = (p.influencerCode || '').toLowerCase();
      const username = (p.username || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const reason = res ? getFailureReason(res).toLowerCase() : '';

      return (
        code.includes(query) ||
        username.includes(query) ||
        name.includes(query) ||
        reason.includes(query)
      );
    });
  }, [activeProfiles, researchResults, currentRunningCode, searchTerm, statusFilter]);

  // 6. Group profiles by prefix
  const groupedData = useMemo(() => {
    const map = new Map<string, ResearchInputProfile[]>();

    filteredProfiles.forEach(p => {
      const key = getGroupKey(p);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(p);
    });

    // Natural sort: alphabetical group keys
    const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

    // Natural sort profiles inside each group
    sortedKeys.forEach(k => {
      map.get(k)!.sort((a, b) =>
        a.influencerCode.localeCompare(b.influencerCode, undefined, { numeric: true, sensitivity: 'base' })
      );
    });

    return sortedKeys.map(key => ({
      groupKey: key,
      items: map.get(key)!
    }));
  }, [filteredProfiles]);

  // Toggle group expansion
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key]
    }));
  };

  // Global Expand / Collapse All
  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    groupedData.forEach(g => {
      allExpanded[g.groupKey] = true;
    });
    setExpandedGroups(allExpanded);
  };

  const handleCollapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    groupedData.forEach(g => {
      allCollapsed[g.groupKey] = false;
    });
    setExpandedGroups(allCollapsed);
  };

  if (activeProfiles.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#171F2B] rounded-xl border border-[#293548] shadow-sm flex flex-col overflow-hidden animate-fade-in">
      {/* Section Header */}
      <div className="p-4 sm:p-5 border-b border-[#293548] flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg border border-[#3B82F6]/20">
              <Users size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#F1F5F9]">View Profiles</h3>
                <button
                  type="button"
                  onClick={() => setIsSectionCollapsed(prev => !prev)}
                  className="text-xs text-[#64748B] hover:text-[#94A3B8] flex items-center gap-1 transition-colors"
                  aria-label={isSectionCollapsed ? 'Expand section' : 'Collapse section'}
                >
                  {isSectionCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Browse researched influencer profiles grouped by category prefix
              </p>
            </div>
          </div>

          {/* Compact Summary Counters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors border ${
                statusFilter === 'all'
                  ? 'bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/40 font-semibold'
                  : 'bg-[#111827] text-[#94A3B8] border-[#293548] hover:border-[#3B82F6]/30'
              }`}
            >
              <span>Total:</span>
              <span className="font-bold font-mono text-[#F1F5F9]">{summary.total}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors border ${
                statusFilter === 'completed'
                  ? 'bg-[#10B981]/25 text-[#10B981] border-[#10B981]/50 font-semibold'
                  : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 hover:bg-[#10B981]/15'
              }`}
            >
              <CheckCircle2 size={13} />
              <span>Completed:</span>
              <span className="font-bold font-mono">{summary.completed}</span>
            </button>

            {summary.failed > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('failed')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors border ${
                  statusFilter === 'failed'
                    ? 'bg-[#EF4444]/25 text-[#EF4444] border-[#EF4444]/50 font-semibold'
                    : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 hover:bg-[#EF4444]/15'
                }`}
              >
                <XCircle size={13} />
                <span>Failed:</span>
                <span className="font-bold font-mono">{summary.failed}</span>
              </button>
            )}

            {summary.partial > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('partial')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors border ${
                  statusFilter === 'partial'
                    ? 'bg-[#F59E0B]/25 text-[#F59E0B] border-[#F59E0B]/50 font-semibold'
                    : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 hover:bg-[#F59E0B]/15'
                }`}
              >
                <AlertTriangle size={13} />
                <span>Partial:</span>
                <span className="font-bold font-mono">{summary.partial}</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & Global Controls */}
        {!isSectionCollapsed && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#293548]/60">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={14} />
              <input
                type="text"
                placeholder="Search by code (e.g. HIS), @username, or error..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#111827] border border-[#293548] rounded-lg pl-9 pr-8 py-1.5 text-xs text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F1F5F9]"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Expand / Collapse All Controls */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {statusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="text-xs text-[#3B82F6] hover:underline mr-1"
                >
                  Reset filter
                </button>
              )}
              <button
                type="button"
                onClick={handleExpandAll}
                className="px-2.5 py-1 text-xs text-[#94A3B8] hover:text-[#F1F5F9] bg-[#111827] hover:bg-[#1A2332] border border-[#293548] rounded-md transition-colors flex items-center gap-1"
              >
                <ChevronsDown size={12} />
                <span>Expand All</span>
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="px-2.5 py-1 text-xs text-[#94A3B8] hover:text-[#F1F5F9] bg-[#111827] hover:bg-[#1A2332] border border-[#293548] rounded-md transition-colors flex items-center gap-1"
              >
                <ChevronsUp size={12} />
                <span>Collapse All</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Groups Content */}
      {!isSectionCollapsed && (
        <div className="p-4 sm:p-5 flex flex-col gap-4 max-h-[560px] overflow-y-auto">
          {groupedData.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#64748B] bg-[#111827] rounded-xl border border-[#293548]">
              No profiles match your current search or filter.
            </div>
          ) : (
            groupedData.map(({ groupKey, items }) => {
              // Group is expanded if not explicitly collapsed, or if search term is active
              const isExpanded = searchTerm.trim().length > 0
                ? true
                : (expandedGroups[groupKey] ?? true);

              const groupCompleted = items.filter(p => researchResults[p.influencerCode]?.status === 'completed').length;
              const groupFailed = items.filter(p => {
                const s = researchResults[p.influencerCode]?.status;
                return s === 'failed' || s === 'reels_not_found';
              }).length;

              return (
                <div
                  key={groupKey}
                  className="rounded-xl border border-[#293548] bg-[#111827]/60 overflow-hidden flex flex-col"
                >
                  {/* Group Header Button */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full px-3.5 py-2.5 bg-[#141A22] hover:bg-[#1D2736] flex items-center justify-between text-left transition-colors border-b border-[#293548]/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="text-[#64748B]">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                      <span className="text-xs font-bold font-mono text-[#F1F5F9] tracking-wider">
                        {groupKey}
                      </span>
                      <span className="text-[11px] text-[#64748B] font-mono">
                        ({items.length} {items.length === 1 ? 'profile' : 'profiles'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      {groupCompleted > 0 && (
                        <span className="text-[#10B981] font-mono bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/20">
                          {groupCompleted} completed
                        </span>
                      )}
                      {groupFailed > 0 && (
                        <span className="text-[#EF4444] font-mono bg-[#EF4444]/10 px-2 py-0.5 rounded border border-[#EF4444]/20">
                          {groupFailed} failed
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Group Items Grid */}
                  {isExpanded && (
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                      {items.map(p => {
                        const res = researchResults[p.influencerCode];
                        const isRunning = p.influencerCode === currentRunningCode;
                        const isSelected = selectedProfileCode === p.influencerCode;

                        const isCompleted = res?.status === 'completed';
                        const isFailed = res?.status === 'failed' || res?.status === 'reels_not_found';
                        const isPartial = res?.status === 'partial' || res?.status === 'reels_not_enough';

                        const failureReason = isFailed ? getFailureReason(res) : '';
                        const tooltipText = isFailed
                          ? `${p.influencerCode} (@${p.username}): ${failureReason}`
                          : `${p.influencerCode} (@${p.username}) - ${res?.status || 'Processing'}`;

                        return (
                          <button
                            key={p.influencerCode}
                            type="button"
                            onClick={() => onSelectProfile(p.influencerCode)}
                            title={tooltipText}
                            className={`text-left p-2.5 rounded-lg border transition-all flex flex-col justify-between gap-1.5 focus:outline-none focus:ring-1 focus:ring-[#3B82F6] min-w-0 ${
                              isSelected
                                ? 'bg-[#1E293B] border-[#3B82F6] shadow-sm shadow-blue-500/25 ring-1 ring-[#3B82F6]'
                                : isFailed
                                ? 'bg-[#141A22] hover:bg-[#1C2431] border-[#EF4444]/30 hover:border-[#EF4444]/60'
                                : 'bg-[#141A22] hover:bg-[#1C2431] border-[#293548] hover:border-[#3B82F6]/50'
                            }`}
                          >
                            {/* Top row: Code + Status Indicator */}
                            <div className="flex items-center justify-between gap-1 w-full">
                              <span className="font-mono font-bold text-xs text-[#F1F5F9] truncate">
                                {p.influencerCode}
                              </span>

                              <div className="shrink-0 flex items-center">
                                {isRunning && (
                                  <Loader2 size={12} className="animate-spin text-[#3B82F6]" />
                                )}
                                {!isRunning && isCompleted && (
                                  <CheckCircle2 size={12} className="text-[#10B981]" />
                                )}
                                {!isRunning && isFailed && (
                                  <XCircle size={12} className="text-[#EF4444]" />
                                )}
                                {!isRunning && isPartial && (
                                  <AlertTriangle size={12} className="text-[#F59E0B]" />
                                )}
                              </div>
                            </div>

                            {/* Middle row: Instagram handle */}
                            <span className="text-[11px] text-[#94A3B8] truncate w-full block">
                              @{p.username}
                            </span>

                            {/* Bottom row: Category badge or Restrained Error Snippet */}
                            <div className="flex items-center justify-between text-[10px] w-full pt-1 border-t border-[#293548]/40">
                              {isFailed ? (
                                <span
                                  className="text-[#EF4444] font-medium truncate block max-w-full"
                                  title={failureReason}
                                >
                                  {failureReason}
                                </span>
                              ) : isCompleted && res?.category ? (
                                <span className="text-[#3B82F6] font-mono font-semibold">
                                  {res.category}
                                </span>
                              ) : isPartial ? (
                                <span className="text-[#F59E0B] font-mono">
                                  {res?.validViewCountsCount ?? 0}/15
                                </span>
                              ) : isRunning ? (
                                <span className="text-[#3B82F6] font-medium">Running</span>
                              ) : (
                                <span className="text-[#64748B]">Ready</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
