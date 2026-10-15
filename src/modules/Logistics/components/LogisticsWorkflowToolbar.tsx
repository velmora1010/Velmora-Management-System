import React from 'react';
import { 
  Users, 
  Package, 
  Check, 
  Truck, 
  Search, 
  SlidersHorizontal, 
  RotateCcw,
  UploadCloud,
  X
} from 'lucide-react';
import type { UnifiedWorkflowStage, WorkflowStageCounts } from '../../../types/unifiedLogistics';

export interface LogisticsWorkflowToolbarProps {
  // Row 1: Workflow Stages Navigation
  currentStage: UnifiedWorkflowStage;
  onSelectStage: (stage: UnifiedWorkflowStage) => void;
  counts: WorkflowStageCounts;

  // Row 2: Search & Global Actions
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onToggleFilters: () => void;
  isFilterOpen?: boolean;
  activeFilterCount?: number;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onOpenImportModal: () => void;
}

export const LogisticsWorkflowToolbar: React.FC<LogisticsWorkflowToolbarProps> = ({
  currentStage,
  onSelectStage,
  counts,
  searchTerm,
  onSearchChange,
  onToggleFilters,
  isFilterOpen = false,
  activeFilterCount = 0,
  onRefresh,
  isRefreshing = false,
  onOpenImportModal
}) => {
  // The 4 canonical workflow stages in single evenly spaced navigation group
  const workflowStages: Array<{
    id: UnifiedWorkflowStage;
    label: string;
    icon: React.ReactNode;
    count: number;
    title: string;
  }> = [
    {
      id: 'active',
      label: 'Active',
      icon: <Users size={16} />,
      count: counts.active,
      title: 'Active orders awaiting dispatch'
    },
    {
      id: 'prepare_dispatch',
      label: 'Prepare Dispatch',
      icon: <Package size={16} />,
      count: counts.prepareDispatch,
      title: 'Grouped orders ready for courier & AWB assignment'
    },
    {
      id: 'dispatched',
      label: 'Dispatched',
      icon: <Check size={16} />,
      count: counts.dispatched,
      title: 'Orders confirmed dispatched with courier & AWB'
    },
    {
      id: 'tracking',
      label: 'Tracking',
      icon: <Truck size={16} />,
      count: counts.tracking,
      title: 'Shipments tracking and delivery updates'
    }
  ];

  return (
    <div className="flex flex-col gap-2.5 w-full shrink-0 select-none">
      
      {/* ROW 1: MAIN WORKFLOW NAVIGATION (Active, Prepare Dispatch, Dispatched, Tracking) */}
      <div className="bg-[#0b1220] border border-slate-800/90 p-1.5 sm:p-2 rounded-2xl shadow-xl w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5 w-full">
          {workflowStages.map((stage) => {
            const isSelected = currentStage === stage.id;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectStage(stage.id)}
                className={`h-11 sm:h-12 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 sm:gap-2.5 transition-all cursor-pointer border select-none w-full ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30 font-bold'
                    : 'bg-[#0e1626] text-slate-300 border-slate-800/90 hover:border-slate-700 hover:text-white hover:bg-slate-800/60'
                }`}
                title={stage.title}
              >
                <span className={`shrink-0 transition-colors ${isSelected ? 'text-white' : 'text-purple-400'}`}>
                  {stage.icon}
                </span>
                <span className="truncate">{stage.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-mono font-bold shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-white/20 text-white shadow-inner'
                      : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  {stage.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ROW 2: SEARCH AND GLOBAL ACTIONS (Search, Filters, Refresh, Upload Orders) */}
      <div className="bg-[#0b1220] border border-slate-800/90 p-2 sm:p-2.5 rounded-2xl shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
        
        {/* Search Field (Wide and practical) */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              currentStage === 'tracking' || currentStage === 'dispatched'
                ? "Search by Order ID, customer, phone, AWB, or courier..."
                : "Search by Order ID, customer name, phone number, city, or state..."
            }
            className="w-full h-10 bg-[#0e1626] border border-slate-800 rounded-xl pl-10 pr-9 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer p-0.5"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 justify-end">
          
          {/* Filters Button */}
          <button
            type="button"
            onClick={onToggleFilters}
            className={`h-10 px-3.5 rounded-xl text-xs font-semibold transition-colors border flex items-center gap-2 cursor-pointer relative shrink-0 ${
              isFilterOpen || activeFilterCount > 0
                ? 'bg-purple-950/70 border-purple-500 text-purple-300 shadow-sm'
                : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
            title="Filter Options"
            aria-label="Toggle Filters"
          >
            <SlidersHorizontal size={14} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-10 px-3.5 bg-[#0e1626] hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors border border-slate-800 flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            title="Refresh Data"
            aria-label="Refresh Data"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-purple-400' : 'text-slate-400'} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Upload Orders Button (Primary CTA) */}
          <button
            type="button"
            onClick={onOpenImportModal}
            className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 flex items-center gap-2 transition-all cursor-pointer shrink-0"
            title="Import Customer Orders from Excel or CSV"
          >
            <UploadCloud size={15} />
            <span>Upload Orders</span>
          </button>

        </div>

      </div>

    </div>
  );
};
