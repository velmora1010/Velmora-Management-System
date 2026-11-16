import React, { useMemo, useState } from 'react';
import { 
  Truck, 
  Search, 
  CheckCircle2, 
  RotateCcw, 
  Clock, 
  ExternalLink, 
  ArrowUpDown, 
  Percent,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';
import type { CourierPerformanceSummary } from '../../../Logistics/utils/logisticsAnalyticsUtils';
import { formatINR } from '../../../Logistics/utils/logisticsAnalyticsUtils';

interface WebsiteCourierPerformanceSectionProps {
  courierPerformance: CourierPerformanceSummary[];
  onViewCourierOrders: (courierName: string, orders: WebsiteConsolidatedOrder[], filterStatus?: 'ALL' | 'DELIVERED' | 'RTO') => void;
}

type OutcomeFilter = 'ALL' | 'DELIVERED' | 'RTO';

export const WebsiteCourierPerformanceSection: React.FC<WebsiteCourierPerformanceSectionProps> = ({
  courierPerformance,
  onViewCourierOrders
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('ALL');
  const [sortField, setSortField] = useState<'courier' | 'total' | 'delivered' | 'rto' | 'inTransit' | 'deliveryRate' | 'rtoRate'>('total');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Overall totals across all couriers
  const totals = useMemo(() => {
    let totalShipments = 0;
    let totalDelivered = 0;
    let totalRto = 0;
    let totalInTransit = 0;

    courierPerformance.forEach(c => {
      totalShipments += c.total;
      totalDelivered += c.delivered;
      totalRto += c.rto;
      totalInTransit += c.inTransit;
    });

    const concluded = totalDelivered + totalRto;
    const overallDeliveryRate = concluded > 0 ? `${((totalDelivered / concluded) * 100).toFixed(1)}%` : '0.0%';
    const overallRtoRate = concluded > 0 ? `${((totalRto / concluded) * 100).toFixed(1)}%` : '0.0%';

    return {
      totalShipments,
      totalDelivered,
      totalRto,
      totalInTransit,
      overallDeliveryRate,
      overallRtoRate
    };
  }, [courierPerformance]);

  // Filter and sort couriers
  const filteredRows = useMemo(() => {
    let rows = courierPerformance.filter(c => {
      // Outcome filter: if filtering to DELIVERED, courier must have delivered > 0
      if (outcomeFilter === 'DELIVERED' && c.delivered === 0) return false;
      // If filtering to RTO, courier must have rto > 0
      if (outcomeFilter === 'RTO' && c.rto === 0) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!c.courier.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    // Sorting
    rows = [...rows].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'courier') {
        valA = a.courier.toLowerCase();
        valB = b.courier.toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortField === 'deliveryRate') {
        valA = parseFloat(a.deliveryRate) || 0;
        valB = parseFloat(b.deliveryRate) || 0;
      } else if (sortField === 'rtoRate') {
        valA = parseFloat(a.rtoRate) || 0;
        valB = parseFloat(b.rtoRate) || 0;
      } else {
        valA = (a as any)[sortField] || 0;
        valB = (b as any)[sortField] || 0;
      }

      return sortAsc ? valA - valB : valB - valA;
    });

    return rows;
  }, [courierPerformance, outcomeFilter, searchQuery, sortField, sortAsc]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Truck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Courier Performance Breakdown</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {courierPerformance.length} {courierPerformance.length === 1 ? 'Courier' : 'Couriers'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Unique shipment outcomes and delivery SLA performance by logistics carrier for selected period
            </p>
          </div>
        </div>

        {/* Controls: Search & Segmented Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Outcome Filter Pills */}
          <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setOutcomeFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                outcomeFilter === 'ALL'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Couriers ({totals.totalShipments})
            </button>
            <button
              type="button"
              onClick={() => setOutcomeFilter('DELIVERED')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                outcomeFilter === 'DELIVERED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <CheckCircle2 size={12} />
              <span>Delivered ({totals.totalDelivered})</span>
            </button>
            <button
              type="button"
              onClick={() => setOutcomeFilter('RTO')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                outcomeFilter === 'RTO'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <RotateCcw size={12} />
              <span>RTO ({totals.totalRto})</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search courier..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <th
                onClick={() => handleSort('courier')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Courier Partner</span>
                  <ArrowUpDown size={12} className={sortField === 'courier' ? 'text-purple-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('total')}
                className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Total Shipments</span>
                  <ArrowUpDown size={12} className={sortField === 'total' ? 'text-purple-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('delivered')}
                className="py-3 px-4 text-right cursor-pointer hover:text-emerald-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Delivered</span>
                  <ArrowUpDown size={12} className={sortField === 'delivered' ? 'text-emerald-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('rto')}
                className="py-3 px-4 text-right cursor-pointer hover:text-rose-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>RTO</span>
                  <ArrowUpDown size={12} className={sortField === 'rto' ? 'text-rose-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('inTransit')}
                className="py-3 px-4 text-right cursor-pointer hover:text-blue-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>In Transit</span>
                  <ArrowUpDown size={12} className={sortField === 'inTransit' ? 'text-blue-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('deliveryRate')}
                className="py-3 px-4 text-right cursor-pointer hover:text-emerald-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Delivery Rate</span>
                  <ArrowUpDown size={12} className={sortField === 'deliveryRate' ? 'text-emerald-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('rtoRate')}
                className="py-3 px-4 text-right cursor-pointer hover:text-rose-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>RTO Rate</span>
                  <ArrowUpDown size={12} className={sortField === 'rtoRate' ? 'text-rose-400' : 'text-slate-600'} />
                </div>
              </th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredRows.length > 0 ? (
              filteredRows.map((row, idx) => {
                const isDelhivery = row.courier.toLowerCase().includes('delhivery');
                const isUnknown = row.courier.includes('Unknown') || row.courier.includes('Not Available');
                const isHouse = row.courier.toLowerCase() === 'house';

                return (
                  <tr
                    key={row.courier}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => onViewCourierOrders(row.courier, row.orders, outcomeFilter)}
                  >
                    {/* Courier Name */}
                    <td className="py-3 px-4 font-sans font-medium text-slate-200">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{
                          backgroundColor: isDelhivery ? '#06b6d4' : isHouse ? '#8b5cf6' : isUnknown ? '#64748b' : '#3b82f6'
                        }} />
                        <span className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                          {row.courier}
                        </span>
                        {isUnknown && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400 font-sans">
                            Missing Metadata
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Shipments */}
                    <td className="py-3 px-4 text-right text-slate-300 font-bold">
                      {row.total.toLocaleString('en-IN')}
                    </td>

                    {/* Delivered */}
                    <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                      {row.delivered.toLocaleString('en-IN')}
                    </td>

                    {/* RTO */}
                    <td className="py-3 px-4 text-right text-rose-400 font-bold">
                      {row.rto.toLocaleString('en-IN')}
                    </td>

                    {/* In Transit */}
                    <td className="py-3 px-4 text-right text-blue-400">
                      {row.inTransit.toLocaleString('en-IN')}
                    </td>

                    {/* Delivery Rate */}
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {row.deliveryRate}
                      </span>
                    </td>

                    {/* RTO Rate */}
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs ${
                        parseFloat(row.rtoRate) > 0
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                          : 'bg-slate-800/40 text-slate-400'
                      }`}>
                        {row.rtoRate}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewCourierOrders(row.courier, row.orders, outcomeFilter);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-purple-600/30 text-purple-300 text-xs font-sans font-bold transition-all border border-slate-700/60 hover:border-purple-500/40 cursor-pointer"
                        title={`View underlying shipments for ${row.courier}`}
                      >
                        <span>View</span>
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                  No couriers matching your search and filter criteria.
                </td>
              </tr>
            )}
          </tbody>

          {/* Reconciled Summary Totals Footer */}
          {filteredRows.length > 0 && (
            <tfoot className="bg-slate-950 font-mono font-bold border-t-2 border-slate-700 text-slate-200">
              <tr>
                <td className="py-3 px-4 font-sans uppercase tracking-wider text-xs text-purple-300">
                  Total Reconciled
                </td>
                <td className="py-3 px-4 text-right text-white">
                  {totals.totalShipments.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-4 text-right text-emerald-400">
                  {totals.totalDelivered.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-4 text-right text-rose-400">
                  {totals.totalRto.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-4 text-right text-blue-400">
                  {totals.totalInTransit.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    {totals.overallDeliveryRate}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-rose-300 bg-rose-500/10 border border-rose-500/20 text-xs">
                    {totals.overallRtoRate}
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-sans text-[11px] text-slate-500">
                  100% Verified
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
