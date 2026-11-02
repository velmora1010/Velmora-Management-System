import React from 'react';
import { SlidersHorizontal, X, Calendar, Truck, MapPin, CreditCard, ShieldAlert } from 'lucide-react';
import type { LogisticsFilterState, LogisticsSection } from '../../types/logisticsFilters';
import { formatRangeDisplay } from '../../types/logisticsFilters';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { ShipmentStatusDropdown } from './ShipmentStatusDropdown';
import { PickupLocationDropdown } from './PickupLocationDropdown';
import { TransportModeDropdown } from './TransportModeDropdown';
import { PaymentModeDropdown } from './PaymentModeDropdown';
import { LogisticsDateDropdown } from './LogisticsDateDropdown';
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
  const section = filters.activeSection || 'all_shipments';

  // Check if any filters are active to show chips
  const hasActiveFilters = 
    filters.shipmentStatuses.length > 0 ||
    filters.pickupLocations.length > 0 ||
    filters.datePreset !== 'all' ||
    Boolean(filters.startDate) ||
    filters.manifestDatePreset !== 'all' ||
    Boolean(filters.manifestStartDate) ||
    filters.deliveredDatePreset !== 'all' ||
    Boolean(filters.deliveredStartDate) ||
    filters.returnedDatePreset !== 'all' ||
    Boolean(filters.returnedStartDate) ||
    filters.transportModes.length > 0 ||
    filters.paymentModes.length > 0 ||
    filters.riskOfReturn.length > 0 ||
    filters.channels.length > 0 ||
    filters.verifiedStatuses.length > 0 ||
    filters.orderTags.length > 0 ||
    filters.addressScores.length > 0 ||
    filters.zones.length > 0 ||
    filters.bulkAwbs.length > 0;

  return (
    <div className="flex flex-col gap-2.5 w-full shrink-0">
      
      {/* Dynamic Primary Filters Toolbar based on Section */}
      <div className="flex flex-wrap items-center gap-2.5 w-full">
        
        {/* 1. Combined Search Input (Common to all sections) */}
        <div className="w-full sm:w-64 md:w-72 lg:w-80 shrink-0">
          <BulkAwbSearchInput
            searchMode={filters.searchMode}
            onSearchModeChange={mode => onUpdateFilters(prev => ({ ...prev, searchMode: mode }))}
            searchTerm={searchTerm}
            onSearchTermChange={onSearchTermChange}
            bulkAwbs={filters.bulkAwbs}
            onBulkAwbsChange={awbs => onUpdateFilters(prev => ({ ...prev, bulkAwbs: awbs }))}
          />
        </div>

        {/* SECTION 1: PENDING AWB -> Date Range, All Filters */}
        {section === 'pending_awb' && (
          <>
            <LogisticsDateDropdown
              label="Date Range"
              preset={filters.datePreset}
              startDate={filters.startDate}
              endDate={filters.endDate}
              onApply={data => onUpdateFilters(prev => ({
                ...prev,
                datePreset: data.preset,
                startDate: data.startDate,
                endDate: data.endDate
              }))}
              onClear={() => onUpdateFilters(prev => ({
                ...prev,
                datePreset: 'all',
                startDate: '',
                endDate: ''
              }))}
            />
          </>
        )}

        {/* SECTION 2: READY TO SHIP -> Date Range, All Filters */}
        {section === 'ready_to_ship' && (
          <>
            <LogisticsDateDropdown
              label="Date Range"
              preset={filters.datePreset}
              startDate={filters.startDate}
              endDate={filters.endDate}
              onApply={data => onUpdateFilters(prev => ({
                ...prev,
                datePreset: data.preset,
                startDate: data.startDate,
                endDate: data.endDate
              }))}
              onClear={() => onUpdateFilters(prev => ({
                ...prev,
                datePreset: 'all',
                startDate: '',
                endDate: ''
              }))}
            />
          </>
        )}

        {/* SECTION 3: READY FOR PICKUP -> Date Range, Transport Mode, All Filters */}
        {section === 'ready_for_pickup' && (
          <>
            <LogisticsDateDropdown
              label="Date Range"
              preset={filters.datePreset}
              startDate={filters.startDate}
              endDate={filters.endDate}
              onApply={data => onUpdateFilters(prev => ({
                ...prev,
                datePreset: data.preset,
                startDate: data.startDate,
                endDate: data.endDate
              }))}
              onClear={() => onUpdateFilters(prev => ({
                ...prev,
                datePreset: 'all',
                startDate: '',
                endDate: ''
              }))}
            />
            <TransportModeDropdown
              selectedModes={filters.transportModes}
              onChange={modes => onUpdateFilters(prev => ({ ...prev, transportModes: modes }))}
              orders={orders}
            />
          </>
        )}

        {/* SECTION 4: IN TRANSIT (Image 3) -> Shipment Status, Pickup Location, Manifested Date, Transport Mode, Payment Mode, All Filters */}
        {section === 'in_transit' && (
          <>
            <ShipmentStatusDropdown
              selectedStatuses={filters.shipmentStatuses}
              onChange={st => onUpdateFilters(prev => ({ ...prev, shipmentStatuses: st }))}
              orders={orders}
              customOptions={['In-transit', 'Out for Delivery']}
            />
            <PickupLocationDropdown
              selectedLocations={filters.pickupLocations}
              onChange={locs => onUpdateFilters(prev => ({ ...prev, pickupLocations: locs }))}
              orders={orders}
            />
            <LogisticsDateDropdown
              label="Manifested date"
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
            <TransportModeDropdown
              selectedModes={filters.transportModes}
              onChange={modes => onUpdateFilters(prev => ({ ...prev, transportModes: modes }))}
              orders={orders}
            />
            <PaymentModeDropdown
              selectedModes={filters.paymentModes}
              onChange={modes => onUpdateFilters(prev => ({ ...prev, paymentModes: modes }))}
              orders={orders}
            />
          </>
        )}

        {/* SECTION 5: RTO - IN TRANSIT (Image 4) -> Returned Date, Pickup Location, Transport Mode, Payment Mode, All Filters */}
        {section === 'rto_in_transit' && (
          <>
            <LogisticsDateDropdown
              label="Returned date"
              preset={filters.returnedDatePreset}
              startDate={filters.returnedStartDate}
              endDate={filters.returnedEndDate}
              onApply={data => onUpdateFilters(prev => ({
                ...prev,
                returnedDatePreset: data.preset,
                returnedStartDate: data.startDate,
                returnedEndDate: data.endDate
              }))}
              onClear={() => onUpdateFilters(prev => ({
                ...prev,
                returnedDatePreset: 'all',
                returnedStartDate: '',
                returnedEndDate: ''
              }))}
            />
            <PickupLocationDropdown
              selectedLocations={filters.pickupLocations}
              onChange={locs => onUpdateFilters(prev => ({ ...prev, pickupLocations: locs }))}
              orders={orders}
            />
            <TransportModeDropdown
              selectedModes={filters.transportModes}
              onChange={modes => onUpdateFilters(prev => ({ ...prev, transportModes: modes }))}
              orders={orders}
            />
            <PaymentModeDropdown
              selectedModes={filters.paymentModes}
              onChange={modes => onUpdateFilters(prev => ({ ...prev, paymentModes: modes }))}
              orders={orders}
            />
          </>
        )}

        {/* SECTION 6: DELIVERED -> Delivered Date (Strictly delivery timestamp), Transport Mode, Payment Mode, Pickup Location, All Filters */}
        {section === 'delivered' && (
          <>
            <LogisticsDateDropdown
              label="Delivered Date"
              preset={filters.deliveredDatePreset}
              startDate={filters.deliveredStartDate}
              endDate={filters.deliveredEndDate}
              onApply={data => onUpdateFilters(prev => ({
                ...prev,
                deliveredDatePreset: data.preset,
                deliveredStartDate: data.startDate,
                deliveredEndDate: data.endDate
              }))}
              onClear={() => onUpdateFilters(prev => ({
                ...prev,
                deliveredDatePreset: 'all',
                deliveredStartDate: '',
                deliveredEndDate: ''
              }))}
            />
            <PickupLocationDropdown
              selectedLocations={filters.pickupLocations}
              onChange={locs => onUpdateFilters(prev => ({ ...prev, pickupLocations: locs }))}
              orders={orders}
            />
            <TransportModeDropdown
              selectedModes={filters.transportModes}
              onChange={modes => onUpdateFilters(prev => ({ ...prev, transportModes: modes }))}
              orders={orders}
            />
            <PaymentModeDropdown
              selectedModes={filters.paymentModes}
              onChange={modes => onUpdateFilters(prev => ({ ...prev, paymentModes: modes }))}
              orders={orders}
            />
          </>
        )}

        {/* SECTION 7: ALL SHIPMENTS (Image 5) -> Shipment Status, Pickup Location, Manifested Date, All Filters */}
        {section === 'all_shipments' && (
          <>
            <ShipmentStatusDropdown
              selectedStatuses={filters.shipmentStatuses}
              onChange={st => onUpdateFilters(prev => ({ ...prev, shipmentStatuses: st }))}
              orders={orders}
              customOptions={[
                'All',
                'Ready to Ship',
                'Ready for Pickup',
                'In-transit',
                'Out for Delivery',
                'Delivered',
                'RTO - In Transit',
                'Returned to Origin',
                'Lost',
                'Not Picked'
              ]}
            />
            <PickupLocationDropdown
              selectedLocations={filters.pickupLocations}
              onChange={locs => onUpdateFilters(prev => ({ ...prev, pickupLocations: locs }))}
              orders={orders}
            />
            <LogisticsDateDropdown
              label="Manifested date"
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
          </>
        )}

        {/* SECTION 8: CANCELLED ORDERS -> Date Range, Pickup Location, Transport Mode, Payment Mode, All Filters */}
        {(section === 'cancelled_orders' || section === 'third_party') && (
          <>
            <LogisticsDateDropdown
              label="Date Range"
              preset={filters.datePreset}
              startDate={filters.startDate}
              endDate={filters.endDate}
              onApply={data => onUpdateFilters(prev => ({
                ...prev,
                datePreset: data.preset,
                startDate: data.startDate,
                endDate: data.endDate
              }))}
              onClear={() => onUpdateFilters(prev => ({
                ...prev,
                datePreset: 'all',
                startDate: '',
                endDate: ''
              }))}
            />
            <PickupLocationDropdown
              selectedLocations={filters.pickupLocations}
              onChange={locs => onUpdateFilters(prev => ({ ...prev, pickupLocations: locs }))}
              orders={orders}
            />
            <TransportModeDropdown
              selectedModes={filters.transportModes}
              onChange={modes => onUpdateFilters(prev => ({ ...prev, transportModes: modes }))}
              orders={orders}
            />
            <PaymentModeDropdown
              selectedModes={filters.paymentModes}
              onChange={modes => onUpdateFilters(prev => ({ ...prev, paymentModes: modes }))}
              orders={orders}
            />
          </>
        )}

        {/* All Filters Button (Common to all sections) */}
        <button
          type="button"
          onClick={onOpenAllFilters}
          className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-[#0e1626] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 flex items-center gap-2 transition-all cursor-pointer shadow-sm ml-auto sm:ml-0"
          title="Open comprehensive filters modal"
        >
          <SlidersHorizontal size={14} className="text-purple-400" />
          <span>All filters</span>
        </button>

      </div>

      {/* Row 2: Active Filter Chips */}
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

          {/* Pickup Locations */}
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

          {/* General Date Range */}
          {(filters.datePreset !== 'all' || filters.startDate) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/70 border border-cyan-700/60 text-cyan-200 text-xs shrink-0">
              <Calendar size={11} className="text-cyan-400 shrink-0" />
              <span>
                Date: {formatRangeDisplay(filters.startDate, filters.endDate)}
                {filters.datePreset !== 'all' && filters.datePreset !== 'custom' ? ` (${filters.datePreset})` : ''}
              </span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({ ...prev, datePreset: 'all', startDate: '', endDate: '' }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Manifested Date */}
          {(filters.manifestDatePreset !== 'all' || filters.manifestStartDate) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/70 border border-cyan-700/60 text-cyan-200 text-xs shrink-0">
              <Calendar size={11} className="text-cyan-400 shrink-0" />
              <span>
                Manifest: {formatRangeDisplay(filters.manifestStartDate, filters.manifestEndDate)}
                {filters.manifestDatePreset !== 'all' && filters.manifestDatePreset !== 'custom' ? ` (${filters.manifestDatePreset})` : ''}
              </span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({ ...prev, manifestDatePreset: 'all', manifestStartDate: '', manifestEndDate: '' }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Delivered Date */}
          {(filters.deliveredDatePreset !== 'all' || filters.deliveredStartDate) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-xs shrink-0">
              <Calendar size={11} className="text-emerald-400 shrink-0" />
              <span>
                Delivered: {formatRangeDisplay(filters.deliveredStartDate, filters.deliveredEndDate)}
              </span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({ ...prev, deliveredDatePreset: 'all', deliveredStartDate: '', deliveredEndDate: '' }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Returned Date */}
          {(filters.returnedDatePreset !== 'all' || filters.returnedStartDate) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/70 border border-amber-700/60 text-amber-200 text-xs shrink-0">
              <Calendar size={11} className="text-amber-400 shrink-0" />
              <span>
                Returned: {formatRangeDisplay(filters.returnedStartDate, filters.returnedEndDate)}
              </span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({ ...prev, returnedDatePreset: 'all', returnedStartDate: '', returnedEndDate: '' }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Transport Mode */}
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

          {/* Payment Mode */}
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

          {/* Risk of Return */}
          {filters.riskOfReturn.map(r => (
            <span
              key={r}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/70 border border-rose-700/60 text-rose-200 text-xs shrink-0"
            >
              <ShieldAlert size={11} className="text-rose-400 shrink-0" />
              <span>Risk: {r}</span>
              <button
                type="button"
                onClick={() => onUpdateFilters(prev => ({
                  ...prev,
                  riskOfReturn: prev.riskOfReturn.filter(x => x !== r)
                }))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Reset All */}
          <button
            type="button"
            onClick={onResetFilters}
            className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer ml-auto shrink-0 pl-2 font-medium"
          >
            Clear all
          </button>
        </div>
      )}

    </div>
  );
};
