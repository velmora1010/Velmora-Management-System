import React from 'react';
import { SlidersHorizontal, X, Calendar, Truck, MapPin, CreditCard, RotateCcw } from 'lucide-react';
import type { LogisticsFilterState, LogisticsDatePreset } from '../../types/logisticsFilters';
import { formatRangeDisplay } from '../../types/logisticsFilters';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { ShipmentStatusDropdown } from './ShipmentStatusDropdown';
import { PickupLocationDropdown } from './PickupLocationDropdown';
import { ManifestDateDropdown } from './ManifestDateDropdown';
import { BulkAwbSearchInput } from './BulkAwbSearchInput';

interface LogisticsFilterToolbarProps {
  filters: LogisticsFilterState;
  onUpdateFilters: (updater: (prev: LogisticsFilterState) => LogisticsFilterState) => void;
  onResetFilters: () => void;
  orders?: UnifiedLogisticsOrder[];
  onOpenAllFilters: () => void;
  searchTerm: string;
  onSearchTermChange: (val: string) => void;
}

export const LogisticsFilterToolbar: React.FC<LogisticsFilterToolbarProps> = ({
  filters,
  onUpdateFilters,
  onResetFilters,
  orders = [],
  onOpenAllFilters,
  searchTerm,
  onSearchTermChange
}) => {
  // Count active quick filters
  const hasActiveFilters = 
    filters.shipmentStatuses.length > 0 ||
    filters.pickupLocations.length > 0 ||
    filters.manifestDatePreset !== 'all' ||
    Boolean(filters.manifestStartDate) ||
    Boolean(filters.manifestEndDate) ||
    filters.transportModes.length > 0 ||
    filters.paymentModes.length > 0 ||
    filters.cancellationStatuses.length > 0 ||
    filters.bulkAwbs.length > 0;

  return (
    <div className="flex flex-col gap-2.5 w-full shrink-0">
      
      {/* Top Filter Controls Bar */}
      <div className="flex flex-wrap items-center gap-2.5 w-full">
        
        {/* 1. Combined AWB / Order Search with Bulk Paste */}
        <div className="w-full sm:w-72 md:w-80 lg:w-96 shrink-0">
          <BulkAwbSearchInput
            searchMode={filters.searchMode}
            onSearchModeChange={mode => onUpdateFilters(prev => ({ ...prev, searchMode: mode }))}
            searchTerm={searchTerm}
            onSearchTermChange={onSearchTermChange}
            bulkAwbs={filters.bulkAwbs}
            onBulkAwbsChange={awbs => onUpdateFilters(prev => ({ ...prev, bulkAwbs: awbs }))}
          />
        </div>

        {/* 2. Shipment Status Dropdown */}
        <ShipmentStatusDropdown
          selectedStatuses={filters.shipmentStatuses}
          onChange={statuses => onUpdateFilters(prev => ({ ...prev, shipmentStatuses: statuses }))}
          orders={orders}
        />

        {/* 3. Pickup Location Dropdown */}
        <PickupLocationDropdown
          selectedLocations={filters.pickupLocations}
          onChange={locs => onUpdateFilters(prev => ({ ...prev, pickupLocations: locs }))}
          orders={orders}
        />

        {/* 4. Manifested Date Dropdown */}
        <ManifestDateDropdown
          preset={filters.manifestDatePreset}
          startDate={filters.manifestStartDate}
          endDate={filters.manifestEndDate}
          onApply={data => onUpdateFilters(prev => ({
            ...prev,
            manifestDatePreset: data.preset,
            manifestStartDate: data.startDate,
            manifestEndDate: data.endDate
          }))}
          onClear={() => onUpdateFilters(prev => ({
            ...prev,
            manifestDatePreset: 'all',
            manifestStartDate: '',
            manifestEndDate: ''
          }))}
        />

        {/* 5. All Filters Button */}
        <button
          type="button"
          onClick={onOpenAllFilters}
          className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-[#0e1626] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          title="Open comprehensive filters dialog"
        >
          <SlidersHorizontal size={14} className="text-purple-400" />
          <span>All filters</span>
        </button>

      </div>

      {/* Row 2: Active Filter Chips Row */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0b1220] border border-purple-900/40 rounded-xl overflow-x-auto custom-scrollbar shrink-0 text-xs text-slate-300">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 shrink-0 flex items-center gap-1">
            <SlidersHorizontal size={12} /> Active:
          </span>

          {/* Shipment Status Chips */}
          {filters.shipmentStatuses.map(st => (
            <span
              key={st}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/70 border border-purple-700/60 text-purple-200 text-xs shrink-0"
            >
              <span>Status: {st}</span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({
                  ...prev,
                  shipmentStatuses: prev.shipmentStatuses.filter(s => s !== st)
                }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Pickup Location Chips */}
          {filters.pickupLocations.map(loc => (
            <span
              key={loc}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/70 border border-blue-700/60 text-blue-200 text-xs shrink-0 max-w-[200px]"
            >
              <MapPin size={11} className="text-blue-400 shrink-0" />
              <span className="truncate">{loc}</span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({
                  ...prev,
                  pickupLocations: prev.pickupLocations.filter(l => l !== loc)
                }))}
                className="hover:text-white cursor-pointer ml-0.5 shrink-0"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Manifested Date Chip */}
          {(filters.manifestDatePreset !== 'all' || filters.manifestStartDate) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/70 border border-cyan-700/60 text-cyan-200 text-xs shrink-0">
              <Calendar size={11} className="text-cyan-400 shrink-0" />
              <span>
                Manifest: {formatRangeDisplay(filters.manifestStartDate, filters.manifestEndDate)}
                {filters.manifestDatePreset !== 'all' && filters.manifestDatePreset !== 'custom' ? ` (${filters.manifestDatePreset})` : ''}
              </span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({
                  ...prev,
                  manifestDatePreset: 'all',
                  manifestStartDate: '',
                  manifestEndDate: ''
                }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Transport Modes */}
          {filters.transportModes.map(tm => (
            <span
              key={tm}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/70 border border-indigo-700/60 text-indigo-200 text-xs shrink-0"
            >
              <Truck size={11} className="text-indigo-400 shrink-0" />
              <span>Transport: {tm}</span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({
                  ...prev,
                  transportModes: prev.transportModes.filter(m => m !== tm)
                }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Payment Modes */}
          {filters.paymentModes.map(pm => (
            <span
              key={pm}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-xs shrink-0"
            >
              <CreditCard size={11} className="text-emerald-400 shrink-0" />
              <span>Payment: {pm}</span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({
                  ...prev,
                  paymentModes: prev.paymentModes.filter(m => m !== pm)
                }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Cancellation Statuses */}
          {filters.cancellationStatuses.map(cs => (
            <span
              key={cs}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/70 border border-rose-700/60 text-rose-200 text-xs shrink-0"
            >
              <span>Cancellation: {cs}</span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({
                  ...prev,
                  cancellationStatuses: prev.cancellationStatuses.filter(s => s !== cs)
                }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Bulk AWBs Chip */}
          {filters.bulkAwbs.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/70 border border-purple-700/60 text-purple-200 text-xs shrink-0">
              <span>{filters.bulkAwbs.length} AWBs searched</span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({ ...prev, bulkAwbs: [] }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Clear All */}
          <button
            type="button"
            onClick={onResetFilters}
            className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer ml-auto shrink-0 pl-2 font-medium"
          >
            Clear All
          </button>
        </div>
      )}

    </div>
  );
};
