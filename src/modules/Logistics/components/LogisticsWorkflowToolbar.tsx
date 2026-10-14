import React, { useState } from 'react';
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
  Grid,
  List,
  Trash2,
  AlertTriangle
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
  onPrepareDispatch: () => void;
  isMovingToPrepare?: boolean;

  // Search & actions
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onToggleFilters: () => void;
  activeFilterCount?: number;
  onRefresh: () => void;
  isRefreshing?: boolean;

  // Layout mode (Grid vs Table)
  orderLayout?: 'grid' | 'table';
  onToggleLayout?: (layout: 'grid' | 'table') => void;

  // Import Orders Action
  onOpenImportModal: () => void;

  // Reset Logistics Department Data Action
  onResetLogisticsData?: () => void;
  isResetting?: boolean;
}

export const LogisticsWorkflowToolbar: React.FC<LogisticsWorkflowToolbarProps> = ({
  currentStage,
  onSelectStage,
  counts,
  isBulkSelectMode,
  onToggleBulkSelect,
  selectedOrderCount,
  onPrepareDispatch,
  isMovingToPrepare = false,
  searchTerm,
  onSearchChange,
  onToggleFilters,
  activeFilterCount = 0,
  onRefresh,
  isRefreshing = false,
  orderLayout = 'table',
  onToggleLayout,
  onOpenImportModal,
  onResetLogisticsData,
  isResetting = false
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800/90 p-1.5 rounded-2xl shadow-xl flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar shrink-0 select-none">
      
      {/* LEFT SIDE: Order Workflow Stages */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* 1. Active */}
        <button
          type="button"
          onClick={() => onSelectStage('active')}
          className={`h-9 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            currentStage === 'active'
              ? 'bg-blue-950/80 text-blue-300 border border-blue-500 shadow-sm shadow-blue-500/20 font-bold'
              : 'bg-blue-950/40 text-blue-300/80 border border-blue-900/60 hover:bg-blue-950/60'
          }`}
          title="Active Orders"
        >
          <Users size={13} className="text-blue-400 shrink-0" />
          <span>Active:</span>
          <strong className="text-white font-extrabold">{counts.active}</strong>
        </button>

        {/* 2. Pending */}
        <button
          type="button"
          onClick={() => onSelectStage('pending')}
          className={`h-9 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            currentStage === 'pending'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500 shadow-sm shadow-purple-500/20 font-bold'
              : 'bg-purple-950/40 text-purple-300/80 border border-purple-900/60 hover:bg-purple-950/60'
          }`}
          title="Orders Waiting for Required Info"
        >
          <Clock size={13} className="text-purple-400 shrink-0" />
          <span>Pending:</span>
          <strong className="text-white font-extrabold">{counts.pending}</strong>
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-700/80 mx-0.5 shrink-0 hidden sm:block" />

        {/* 3. Bulk Select (Only in Active/Pending) */}
        <button
          type="button"
          onClick={onToggleBulkSelect}
          className={`h-9 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 shrink-0 cursor-pointer ${
            isBulkSelectMode
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
              : 'bg-slate-900 border-slate-700/80 hover:bg-slate-800 text-slate-300'
          }`}
          title="Toggle Bulk Select"
        >
          {isBulkSelectMode ? <Check size={14} className="text-white" /> : <CheckSquare size={14} className="text-slate-400" />}
          <span>Bulk Select</span>
          {selectedOrderCount > 0 && (
            <span className="bg-white text-purple-900 text-[10px] font-extrabold rounded-full px-1.5 py-0.2 ml-0.5">
              {selectedOrderCount}
            </span>
          )}
        </button>

        {/* 4. Prepare Dispatch */}
        <button
          type="button"
          onClick={() => onSelectStage('prepare_dispatch')}
          className={`h-9 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 shrink-0 cursor-pointer ${
            currentStage === 'prepare_dispatch'
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/40'
              : 'bg-slate-900 border-slate-700/80 hover:bg-slate-800 text-slate-300'
          }`}
          title="View Prepare Dispatch Queue"
        >
          <Truck size={14} className={currentStage === 'prepare_dispatch' ? 'text-white' : 'text-purple-400'} />
          <span>Prepare Dispatch</span>
          {counts.prepareDispatch > 0 && (
            <span className={`text-[11px] font-extrabold rounded-full px-2 py-0.5 leading-none ${
              currentStage === 'prepare_dispatch'
                ? 'bg-purple-950 text-white border border-purple-400/40'
                : 'bg-purple-950/90 text-purple-300 border border-purple-800/60'
            }`}>
              {counts.prepareDispatch}
            </span>
          )}
        </button>

        {/* 5. Dispatched */}
        <button
          type="button"
          onClick={() => onSelectStage('dispatched')}
          className={`h-9 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 shrink-0 cursor-pointer ${
            currentStage === 'dispatched'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
              : 'bg-slate-900 border-slate-700/80 hover:bg-slate-800 text-slate-300'
          }`}
          title="Dispatched Orders"
        >
          <Check size={14} className={currentStage === 'dispatched' ? 'text-white' : 'text-emerald-400'} />
          <span>Dispatched</span>
          {counts.dispatched > 0 && (
            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.2 ${
              currentStage === 'dispatched'
                ? 'bg-emerald-950 text-white border border-emerald-400/40'
                : 'bg-emerald-950/90 text-emerald-300 border border-emerald-800/60'
            }`}>
              {counts.dispatched}
            </span>
          )}
        </button>

        {/* 6. Tracking */}
        <button
          type="button"
          onClick={() => onSelectStage('tracking')}
          className={`h-9 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 shrink-0 cursor-pointer ${
            currentStage === 'tracking'
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
              : 'bg-slate-900 border-slate-700/80 hover:bg-slate-800 text-slate-300'
          }`}
          title="Monitor Live Shipment Tracking"
        >
          <Truck size={14} className={currentStage === 'tracking' ? 'text-white' : 'text-purple-400'} />
          <span>Tracking</span>
          {counts.tracking > 0 && (
            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.2 ${
              currentStage === 'tracking'
                ? 'bg-purple-950 text-white border border-purple-400/40'
                : 'bg-purple-950/90 text-purple-300 border border-purple-800/60'
            }`}>
              {counts.tracking}
            </span>
          )}
        </button>
      </div>

      {/* RIGHT SIDE: Search, Filter, Refresh, Layout Switch, Reset & Import Orders */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {/* Search */}
        <div className="relative min-w-[90px] w-28 sm:w-36 md:w-44 lg:w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search code, user..."
            className="w-full h-9 bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Filters */}
        <button
          type="button"
          onClick={onToggleFilters}
          className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors border flex items-center justify-center relative shrink-0 cursor-pointer ${
            activeFilterCount > 0
              ? 'bg-purple-950/60 border-purple-500 text-purple-300 font-semibold shadow-sm'
              : 'bg-purple-950/40 border-purple-700/70 hover:bg-purple-900/50 text-purple-300'
          }`}
          title="Filters"
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
          className="w-9 h-9 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-colors border border-slate-700/80 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
          title="Refresh Data"
        >
          <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-purple-400' : ''} />
        </button>

        {/* Layout Mode (Grid / List) */}
        {onToggleLayout && (
          <div className="hidden sm:flex items-center p-0.5 bg-slate-900 border border-slate-700/80 rounded-xl">
            <button
              type="button"
              onClick={() => onToggleLayout('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                orderLayout === 'table'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Dense Table View"
            >
              <List size={13} />
            </button>
            <button
              type="button"
              onClick={() => onToggleLayout('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                orderLayout === 'grid'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compact Cards View"
            >
              <Grid size={13} />
            </button>
          </div>
        )}

        {/* Reset Logistics Data Button */}
        {onResetLogisticsData && (
          <button
            type="button"
            onClick={onResetLogisticsData}
            disabled={isResetting}
            className="h-9 px-2.5 sm:px-3 rounded-xl text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 hover:border-rose-600 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Reset Logistics Department Data (Clear all orders & start fresh)"
          >
            <Trash2 size={13} className="text-rose-400" />
            <span className="hidden md:inline">Reset Data</span>
          </button>
        )}

        {/* Import Orders Button placed at the far right of the top toolbar */}
        <button
          type="button"
          onClick={onOpenImportModal}
          className="h-9 px-3 sm:px-3.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          title="Import Orders from Shopify or Spreadsheet"
        >
          <UploadCloud size={14} />
          <span className="hidden xs:inline">Import</span>
        </button>
      </div>

    </div>
  );
};
