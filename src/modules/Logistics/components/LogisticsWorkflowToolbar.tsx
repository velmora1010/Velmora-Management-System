import React from 'react';
import { 
  Users, 
  Clock, 
  Check, 
  CheckSquare, 
  Truck, 
  Search, 
  SlidersHorizontal, 
  RotateCcw,
  UploadCloud,
  Package
} from 'lucide-react';
import type { UnifiedWorkflowStage, WorkflowStageCounts } from '../../../types/unifiedLogistics';

interface LogisticsWorkflowToolbarProps {
  currentStage: UnifiedWorkflowStage;
  onSelectStage: (stage: UnifiedWorkflowStage) => void;
  counts: WorkflowStageCounts;
  
  // Bulk selection controls
  isBulkSelectMode: boolean;
  onToggleBulkSelect: () => void;
  selectedOrderCount: number;

  // Search & actions
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onToggleFilters: () => void;
  activeFilterCount?: number;
  onRefresh: () => void;
  isRefreshing?: boolean;

  // Upload Orders Action
  onOpenImportModal: () => void;
}

export const LogisticsWorkflowToolbar: React.FC<LogisticsWorkflowToolbarProps> = ({
  currentStage,
  onSelectStage,
  counts,
  isBulkSelectMode,
  onToggleBulkSelect,
  selectedOrderCount,
  searchTerm,
  onSearchChange,
  onToggleFilters,
  activeFilterCount = 0,
  onRefresh,
  isRefreshing = false,
  onOpenImportModal
}) => {
  return (
    <div className="bg-[#0b1220] border border-slate-800/90 p-1.5 rounded-2xl shadow-xl flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar shrink-0 select-none">
      
      {/* LEFT SIDE: Order Workflow Stages (Matching Image 1) */}
      <div className="flex items-center gap-1.5 shrink-0">
        
        {/* 1. Active */}
        <button
          type="button"
          onClick={() => onSelectStage('active')}
          className={`h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 transition-all cursor-pointer border ${
            currentStage === 'active'
              ? 'bg-blue-950/80 text-blue-300 border-blue-500 shadow-sm shadow-blue-500/20 font-bold'
              : 'bg-[#0e1626] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
          }`}
          title="Active Orders Awaiting Dispatch"
        >
          <Users size={14} className={currentStage === 'active' ? 'text-blue-400' : 'text-slate-400'} />
          <span>Active</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[11px] font-mono font-black ${
            currentStage === 'active' ? 'bg-blue-900/80 text-white' : 'bg-slate-800 text-slate-300'
          }`}>
            {counts.active}
          </span>
        </button>

        {/* 2. Pending */}
        <button
          type="button"
          onClick={() => onSelectStage('pending')}
          className={`h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 transition-all cursor-pointer border ${
            currentStage === 'pending'
              ? 'bg-purple-950/80 text-purple-300 border-purple-500 shadow-sm shadow-purple-500/20 font-bold'
              : 'bg-[#0e1626] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
          }`}
          title="Orders Waiting for Required Info"
        >
          <Clock size={14} className={currentStage === 'pending' ? 'text-purple-400' : 'text-slate-400'} />
          <span>Pending</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[11px] font-mono font-black ${
            currentStage === 'pending' ? 'bg-purple-900/80 text-white' : 'bg-slate-800 text-slate-300'
          }`}>
            {counts.pending}
          </span>
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-800 mx-0.5 shrink-0 hidden sm:block" />

        {/* 3. Bulk Select (Toggles selection mode) */}
        <button
          type="button"
          onClick={onToggleBulkSelect}
          className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 shrink-0 cursor-pointer ${
            isBulkSelectMode
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
              : 'bg-[#0e1626] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
          }`}
          title="Toggle Selection Checkboxes"
        >
          {isBulkSelectMode ? (
            <Check size={14} className="text-white" />
          ) : (
            <CheckSquare size={14} className="text-slate-400" />
          )}
          <span>Bulk Select</span>
          {selectedOrderCount > 0 && (
            <span className="bg-white text-purple-900 text-[10px] font-extrabold rounded-full px-1.5 py-0.2">
              {selectedOrderCount}
            </span>
          )}
        </button>

        {/* 4. Prepare Dispatch */}
        <button
          type="button"
          onClick={() => onSelectStage('prepare_dispatch')}
          className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 shrink-0 cursor-pointer ${
            currentStage === 'prepare_dispatch'
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/40'
              : 'bg-[#0e1626] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
          }`}
          title="Prepare Dispatch Queue"
        >
          <Package size={14} className={currentStage === 'prepare_dispatch' ? 'text-white' : 'text-purple-400'} />
          <span>Prepare Dispatch</span>
          {counts.prepareDispatch > 0 && (
            <span className={`px-1.5 py-0.2 rounded-md text-[11px] font-mono font-black ${
              currentStage === 'prepare_dispatch' ? 'bg-purple-900 text-white' : 'bg-purple-950 text-purple-300 border border-purple-800/60'
            }`}>
              {counts.prepareDispatch}
            </span>
          )}
        </button>

        {/* 5. Dispatched */}
        <button
          type="button"
          onClick={() => onSelectStage('dispatched')}
          className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 shrink-0 cursor-pointer ${
            currentStage === 'dispatched'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
              : 'bg-[#0e1626] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
          }`}
          title="Dispatched Orders"
        >
          <Check size={14} className={currentStage === 'dispatched' ? 'text-white' : 'text-emerald-400'} />
          <span>Dispatched</span>
          {counts.dispatched > 0 && (
            <span className={`px-1.5 py-0.2 rounded-md text-[11px] font-mono font-black ${
              currentStage === 'dispatched' ? 'bg-emerald-900 text-white' : 'bg-slate-800 text-slate-300'
            }`}>
              {counts.dispatched}
            </span>
          )}
        </button>

        {/* 6. Tracking */}
        <button
          type="button"
          onClick={() => onSelectStage('tracking')}
          className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 shrink-0 cursor-pointer ${
            currentStage === 'tracking'
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
              : 'bg-[#0e1626] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
          }`}
          title="Shipment Tracking"
        >
          <Truck size={14} className={currentStage === 'tracking' ? 'text-white' : 'text-purple-400'} />
          <span>Tracking</span>
          {counts.tracking > 0 && (
            <span className={`px-1.5 py-0.2 rounded-md text-[11px] font-mono font-black ${
              currentStage === 'tracking' ? 'bg-purple-900 text-white' : 'bg-purple-950 text-purple-300 border border-purple-800/60'
            }`}>
              {counts.tracking}
            </span>
          )}
        </button>

      </div>

      {/* RIGHT SIDE: Search, Filter, Refresh, Upload Orders (Matching Image 1) */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        
        {/* Search */}
        <div className="relative min-w-[130px] w-36 sm:w-44 md:w-56 lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search order, customer, phone..."
            className="w-full h-9 bg-[#0e1626] border border-slate-800 rounded-xl pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Filter Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleFilters}
          className={`w-9 h-9 rounded-xl text-xs font-semibold transition-colors border flex items-center justify-center relative shrink-0 cursor-pointer ${
            activeFilterCount > 0
              ? 'bg-purple-950/70 border-purple-500 text-purple-300 shadow-sm'
              : 'bg-[#0e1626] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
          }`}
          title="Filters"
          aria-label="Toggle Filters"
        >
          <SlidersHorizontal size={14} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="w-9 h-9 bg-[#0e1626] hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors border border-slate-800 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
          title="Refresh Data"
          aria-label="Refresh Data"
        >
          <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-purple-400' : ''} />
        </button>

        {/* Upload Orders Primary Action Button */}
        <button
          type="button"
          onClick={onOpenImportModal}
          className="h-9 px-4 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          title="Import Customer Orders from Excel or CSV"
        >
          <UploadCloud size={14} />
          <span>Upload Orders</span>
        </button>

      </div>

    </div>
  );
};
