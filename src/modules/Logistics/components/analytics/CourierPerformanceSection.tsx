import React, { useMemo, useState } from 'react';
import { 
  Truck, 
  ArrowUpDown, 
  CheckCircle2, 
  TrendingUp, 
  RotateCcw, 
  AlertTriangle, 
  Timer, 
  CheckCheck, 
  Clock, 
  RefreshCw,
  Trophy,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { 
  getCanonicalStatus, 
  checkDeliverySla, 
  formatINR 
} from '../../utils/logisticsAnalyticsUtils';
import { CONFIGURED_COURIERS, normalizeCourier } from '../../../../config/courierConfig';
import { isDispatchedOrder, parseOrderAmount } from '../../../../utils/logisticsOrderUtils';

interface CourierPerformanceSectionProps {
  orders: UnifiedLogisticsOrder[];
  onDrillDown: (title: string, subtitle: string, filterFn: (o: UnifiedLogisticsOrder) => boolean) => void;
}

type SortField = 'volume' | 'success' | 'rto' | 'speed' | 'onTime';

export const CourierPerformanceSection: React.FC<CourierPerformanceSectionProps> = ({
  orders,
  onDrillDown
}) => {
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Group and calculate performance for each courier partner
  const courierData = useMemo(() => {
    // 1. Separate orders awaiting courier assignment from assigned
    const awaitingAssignment: UnifiedLogisticsOrder[] = [];
    const courierMap = new Map<string, {
      id: string;
      name: string;
      shortName: string;
      color: string;
      total: number;
      delivered: number;
      inTransit: number;
      rto: number;
      failedAttempts: number;
      pendingUpdates: number;
      exceptions: number;
      totalDays: number;
      deliveredWithDays: number;
      onTimeCount: number;
      codValue: number;
      codCollected: number;
      orders: UnifiedLogisticsOrder[];
    }>();

    // Initialize configured couriers
    CONFIGURED_COURIERS.forEach(c => {
      courierMap.set(c.name, {
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        color: c.badgeColor.dot || '#8b5cf6',
        total: 0,
        delivered: 0,
        inTransit: 0,
        rto: 0,
        failedAttempts: 0,
        pendingUpdates: 0,
        exceptions: 0,
        totalDays: 0,
        deliveredWithDays: 0,
        onTimeCount: 0,
        codValue: 0,
        codCollected: 0,
        orders: []
      });
    });

    // Unassigned entry
    courierMap.set('Unassigned / Unknown', {
      id: 'unassigned',
      name: 'Unassigned / Unknown',
      shortName: 'Unassigned',
      color: '#64748b',
      total: 0,
      delivered: 0,
      inTransit: 0,
      rto: 0,
      failedAttempts: 0,
      pendingUpdates: 0,
      exceptions: 0,
      totalDays: 0,
      deliveredWithDays: 0,
      onTimeCount: 0,
      codValue: 0,
      codCollected: 0,
      orders: []
    });

    orders.forEach(o => {
      if (!o.courier || o.courier.trim() === '' || o.workflowStage === 'active') {
        awaitingAssignment.push(o);
      }

      const norm = normalizeCourier(o.courier) || 'Unassigned / Unknown';
      const c = courierMap.get(norm) || courierMap.get('Unassigned / Unknown')!;
      c.total++;
      c.orders.push(o);

      const canonical = getCanonicalStatus(o);
      const sla = checkDeliverySla(o);
      const amt = parseOrderAmount(o.amount ?? o.totalAmount) || 0;
      const type = (o.orderType || '').toUpperCase();
      const isCod = type.includes('COD');

      if (isCod) {
        c.codValue += amt;
      }

      if (canonical === 'Delivered') {
        c.delivered++;
        if (isCod) c.codCollected += amt;
        if (sla.deliveryDays !== null && sla.deliveryDays >= 0) {
          c.totalDays += sla.deliveryDays;
          c.deliveredWithDays++;
        }
        if (sla.isOnTime) {
          c.onTimeCount++;
        }
      } else if (canonical === 'In Transit' || canonical === 'Out for Delivery') {
        c.inTransit++;
      } else if (canonical.includes('RTO')) {
        c.rto++;
      } else if (canonical === 'Delivery Attempt Failed') {
        c.failedAttempts++;
      } else if (canonical === 'Pending Tracking Update') {
        c.pendingUpdates++;
      } else if (canonical === 'Delayed / SLA Breached' || canonical === 'Shipment Exception') {
        c.exceptions++;
      }
    });

    // Filter to couriers that have orders or are standard configured
    const rows = Array.from(courierMap.values())
      .filter(item => item.total > 0 || CONFIGURED_COURIERS.some(c => c.name === item.name))
      .map(item => {
        const concluded = item.delivered + item.rto;
        const successRate = concluded > 0
          ? Math.round((item.delivered / concluded) * 100)
          : (item.total > 0 ? Math.round((item.delivered / item.total) * 100) : 0);

        const rtoRate = concluded > 0
          ? parseFloat(((item.rto / concluded) * 100).toFixed(1))
          : 0;

        const avgSpeed = item.deliveredWithDays > 0
          ? parseFloat((item.totalDays / item.deliveredWithDays).toFixed(1))
          : null;

        const onTimePct = item.delivered > 0
          ? Math.round((item.onTimeCount / item.delivered) * 100)
          : null;

        // COD Remittance status
        let codRemittanceStatus = 'N/A';
        if (item.codValue > 0) {
          const remittedPct = item.codValue > 0 ? Math.round((item.codCollected / item.codValue) * 100) : 0;
          codRemittanceStatus = `${remittedPct}% Collected (${formatINR(item.codCollected)})`;
        }

        return {
          ...item,
          successRate,
          rtoRate,
          avgSpeed,
          onTimePct,
          codRemittanceStatus
        };
      });

    // Determine Best and Worst couriers based on sufficient data (total >= 10)
    const eligibleForRanking = rows.filter(r => r.total >= 10 && r.id !== 'unassigned');
    let bestCourier: string | null = null;
    let worstCourier: string | null = null;

    if (eligibleForRanking.length >= 2) {
      const sortedBySuccess = [...eligibleForRanking].sort((a, b) => b.successRate - a.successRate);
      bestCourier = sortedBySuccess[0].name;
      worstCourier = sortedBySuccess[sortedBySuccess.length - 1].name;
    }

    return {
      rows,
      awaitingAssignmentCount: awaitingAssignment.length,
      bestCourier,
      worstCourier
    };
  }, [orders]);

  // Handle column sorting
  const sortedRows = useMemo(() => {
    return [...courierData.rows].sort((a, b) => {
      let diff = 0;
      if (sortField === 'volume') diff = b.total - a.total;
      else if (sortField === 'success') diff = b.successRate - a.successRate;
      else if (sortField === 'rto') diff = a.rtoRate - b.rtoRate;
      else if (sortField === 'speed') diff = (a.avgSpeed || 999) - (b.avgSpeed || 999);
      else if (sortField === 'onTime') diff = (b.onTimePct || 0) - (a.onTimePct || 0);

      return sortAsc ? -diff : diff;
    });
  }, [courierData.rows, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* SECTION HEADER & BENCHMARK CARDS */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck size={18} className="text-purple-400" />
              <span>Courier Partner Performance & SLA Benchmark</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live service comparison, delivery speeds, RTO rates, and COD collection efficiency
            </p>
          </div>

          {courierData.awaitingAssignmentCount > 0 && (
            <button
              type="button"
              onClick={() => onDrillDown(
                'Orders Awaiting Courier Assignment',
                'Unfulfilled orders without courier assigned',
                o => !o.courier || o.courier.trim() === ''
              )}
              className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Clock size={13} />
              <span>{courierData.awaitingAssignmentCount} Awaiting Courier Assignment</span>
            </button>
          )}
        </div>

        {/* BENCHMARK CALLOUTS */}
        {(courierData.bestCourier || courierData.worstCourier) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
            {courierData.bestCourier && (
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Trophy size={16} />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-emerald-400">Top Performing Partner</div>
                  <div className="text-sm font-bold text-white">{courierData.bestCourier}</div>
                </div>
              </div>
            )}
            {courierData.worstCourier && (
              <div className="bg-rose-950/30 border border-rose-800/40 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                  <AlertCircle size={16} />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-rose-400">Partner Needing Review</div>
                  <div className="text-sm font-bold text-white">{courierData.worstCourier}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAILED COURIER PERFORMANCE TABLE */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0e1626] text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Courier Partner</th>
                <th 
                  onClick={() => toggleSort('volume')}
                  className="px-4 py-3.5 text-center cursor-pointer hover:text-white transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Total Shipments</span>
                    <ArrowUpDown size={11} className={sortField === 'volume' ? 'text-cyan-400' : 'text-slate-500'} />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-center text-emerald-400">Delivered</th>
                <th className="px-4 py-3.5 text-center text-blue-400">In Transit</th>
                <th 
                  onClick={() => toggleSort('rto')}
                  className="px-4 py-3.5 text-center text-rose-400 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>RTO Count (Rate)</span>
                    <ArrowUpDown size={11} className={sortField === 'rto' ? 'text-rose-400' : 'text-slate-500'} />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-center text-orange-400">Failed Attempts</th>
                <th 
                  onClick={() => toggleSort('success')}
                  className="px-4 py-3.5 text-center cursor-pointer hover:text-white transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Success Rate</span>
                    <ArrowUpDown size={11} className={sortField === 'success' ? 'text-emerald-400' : 'text-slate-500'} />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('speed')}
                  className="px-4 py-3.5 text-center cursor-pointer hover:text-white transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Avg Delivery Time</span>
                    <ArrowUpDown size={11} className={sortField === 'speed' ? 'text-blue-400' : 'text-slate-500'} />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('onTime')}
                  className="px-4 py-3.5 text-center cursor-pointer hover:text-white transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>On-Time %</span>
                    <ArrowUpDown size={11} className={sortField === 'onTime' ? 'text-emerald-400' : 'text-slate-500'} />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-center text-amber-400">Pending Updates</th>
                <th className="px-4 py-3.5 text-right">COD Remittance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {sortedRows.map((c) => (
                <tr 
                  key={c.id} 
                  onClick={() => onDrillDown(
                    `Courier: ${c.name}`,
                    `All shipments assigned to ${c.name}`,
                    o => normalizeCourier(o.courier) === c.name || (c.id === 'unassigned' && (!o.courier || o.courier.trim() === ''))
                  )}
                  className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-3.5 font-semibold text-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="group-hover:text-cyan-300 transition-colors">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-300">
                    {c.total.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-400">
                    {c.delivered.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-bold text-blue-400">
                    {c.inTransit.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-bold text-rose-400">
                    {c.rto} ({c.rtoRate}%)
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono text-orange-400">
                    {c.failedAttempts}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {c.total > 0 ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                        {c.successRate}%
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono text-slate-300">
                    {c.avgSpeed ? `${c.avgSpeed} days` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono text-emerald-400">
                    {c.onTimePct !== null ? `${c.onTimePct}%` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono text-amber-400">
                    {c.pendingUpdates}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-[11px] text-slate-300">
                    {c.codRemittanceStatus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
