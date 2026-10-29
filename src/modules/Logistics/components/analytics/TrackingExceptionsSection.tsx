import React, { useMemo, useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Truck, 
  RotateCcw, 
  ExternalLink, 
  CheckCircle, 
  Copy, 
  Filter, 
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import type { UnifiedLogisticsOrder } from '../../../../types/unifiedLogistics';
import { getCanonicalStatus, checkDeliverySla } from '../../utils/logisticsAnalyticsUtils';
import { normalizeCourier } from '../../../../config/courierConfig';
import { isDispatchedOrder } from '../../../../utils/logisticsOrderUtils';
import toast from 'react-hot-toast';

interface TrackingExceptionsSectionProps {
  orders: UnifiedLogisticsOrder[];
  onTrackOrder?: (order: any) => void;
  onViewCustomer?: (customerKey: string) => void;
  onDrillDown: (title: string, subtitle: string, filterFn: (o: UnifiedLogisticsOrder) => boolean) => void;
}

type ExceptionType = 
  | 'all' 
  | 'failed_attempt' 
  | 'stuck_in_transit' 
  | 'missing_courier_awb' 
  | 'sla_overdue' 
  | 'address_issue'
  | 'rto_alert';

export const TrackingExceptionsSection: React.FC<TrackingExceptionsSectionProps> = ({
  orders,
  onTrackOrder,
  onViewCustomer,
  onDrillDown
}) => {
  const [selectedFilter, setSelectedFilter] = useState<ExceptionType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Identify all shipments needing operator attention
  const exceptionRecords = useMemo(() => {
    const list: Array<{
      order: UnifiedLogisticsOrder;
      type: ExceptionType;
      typeLabel: string;
      reason: string;
      courierName: string;
      awb: string;
      ageDays: number;
      lastUpdatedDisplay: string;
      badgeColor: string;
      recommendedAction: string;
    }> = [];

    const todayMs = new Date().getTime();

    orders.forEach(o => {
      const canonical = getCanonicalStatus(o);
      const sla = checkDeliverySla(o);
      const courierName = normalizeCourier(o.courier) || 'Unassigned';
      const awb = (o.awbNumber || '').trim();
      const rawText = `${o.remarks || ''} ${o.lastEvent || ''} ${o.trackingError || ''}`.toLowerCase();

      // 1. Missing Courier or AWB on prepare dispatch or active
      if (!courierName || courierName === 'Unassigned' || !awb) {
        if (o.workflowStage === 'prepare_dispatch') {
          list.push({
            order: o,
            type: 'missing_courier_awb',
            typeLabel: 'Missing AWB / Courier',
            reason: !courierName || courierName === 'Unassigned' ? 'Carrier not allocated' : 'AWB barcode unassigned',
            courierName,
            awb: awb || '—',
            ageDays: sla.ageDays,
            lastUpdatedDisplay: o.syncedAt ? o.syncedAt.slice(0, 16).replace('T', ' ') : 'Pending first scan',
            badgeColor: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
            recommendedAction: 'Assign Courier & AWB'
          });
          return;
        }
      }

      // 2. Failed Delivery Attempt
      if (canonical === 'Delivery Attempt Failed' || rawText.includes('failed attempt') || rawText.includes('undelivered')) {
        list.push({
          order: o,
          type: 'failed_attempt',
          typeLabel: 'Failed Attempt',
          reason: rawText.includes('door') ? 'Door closed / locked' : (rawText.includes('unreachable') ? 'Customer unreachable' : 'Delivery attempt failed'),
          courierName,
          awb: awb || '—',
          ageDays: sla.ageDays,
          lastUpdatedDisplay: o.syncedAt ? o.syncedAt.slice(0, 16).replace('T', ' ') : (o.dispatchDate || '—'),
          badgeColor: 'bg-orange-950/80 text-orange-300 border-orange-800/60',
          recommendedAction: 'Request Re-attempt / Call Customer'
        });
        return;
      }

      // 3. Address Issue / Exception
      if (rawText.includes('address') || rawText.includes('pincode') || rawText.includes('incomplete') || canonical === 'Shipment Exception') {
        list.push({
          order: o,
          type: 'address_issue',
          typeLabel: 'Address Exception',
          reason: 'Incomplete or unverified destination address',
          courierName,
          awb: awb || '—',
          ageDays: sla.ageDays,
          lastUpdatedDisplay: o.syncedAt ? o.syncedAt.slice(0, 16).replace('T', ' ') : (o.dispatchDate || '—'),
          badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
          recommendedAction: 'Verify Address with Buyer'
        });
        return;
      }

      // 4. SLA Overdue
      if (sla.isOverdue) {
        list.push({
          order: o,
          type: 'sla_overdue',
          typeLabel: 'SLA Overdue',
          reason: `Breached delivery target (${sla.ageDays} days in transit)`,
          courierName,
          awb: awb || '—',
          ageDays: sla.ageDays,
          lastUpdatedDisplay: o.syncedAt ? o.syncedAt.slice(0, 16).replace('T', ' ') : (o.dispatchDate || '—'),
          badgeColor: 'bg-yellow-950/80 text-yellow-300 border-yellow-800/60',
          recommendedAction: 'Escalate to Carrier Ops'
        });
        return;
      }

      // 5. Stuck in Transit (>4 days in transit without progress)
      if (canonical === 'In Transit' && sla.ageDays >= 4) {
        list.push({
          order: o,
          type: 'stuck_in_transit',
          typeLabel: 'Stuck in Transit',
          reason: `No hub progression for ${sla.ageDays} days`,
          courierName,
          awb: awb || '—',
          ageDays: sla.ageDays,
          lastUpdatedDisplay: o.syncedAt ? o.syncedAt.slice(0, 16).replace('T', ' ') : (o.dispatchDate || '—'),
          badgeColor: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
          recommendedAction: 'Track & Ping Hub'
        });
        return;
      }

      // 6. RTO Initiated
      if (canonical === 'RTO Initiated') {
        list.push({
          order: o,
          type: 'rto_alert',
          typeLabel: 'RTO Initiated',
          reason: 'Return initiated by carrier',
          courierName,
          awb: awb || '—',
          ageDays: sla.ageDays,
          lastUpdatedDisplay: o.syncedAt ? o.syncedAt.slice(0, 16).replace('T', ' ') : (o.dispatchDate || '—'),
          badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
          recommendedAction: 'Stop RTO / Re-attempt'
        });
      }
    });

    return list;
  }, [orders]);

  // Filtered exception records
  const filteredRecords = useMemo(() => {
    let result = exceptionRecords;
    if (selectedFilter !== 'all') {
      result = result.filter(r => r.type === selectedFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(r => 
        (r.order.orderId || '').toLowerCase().includes(q) ||
        (r.order.displayOrderId || '').toLowerCase().includes(q) ||
        (r.order.customerName || '').toLowerCase().includes(q) ||
        (r.awb || '').toLowerCase().includes(q) ||
        r.courierName.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    }
    return result;
  }, [exceptionRecords, selectedFilter, searchQuery]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}: ${text}`);
  };

  const filterTabs: Array<{ id: ExceptionType; label: string; count: number }> = [
    { id: 'all', label: 'All Issues', count: exceptionRecords.length },
    { id: 'failed_attempt', label: 'Failed Attempts', count: exceptionRecords.filter(r => r.type === 'failed_attempt').length },
    { id: 'stuck_in_transit', label: 'Stuck in Transit', count: exceptionRecords.filter(r => r.type === 'stuck_in_transit').length },
    { id: 'sla_overdue', label: 'SLA Overdue', count: exceptionRecords.filter(r => r.type === 'sla_overdue').length },
    { id: 'address_issue', label: 'Address Issues', count: exceptionRecords.filter(r => r.type === 'address_issue').length },
    { id: 'rto_alert', label: 'RTO Initiated', count: exceptionRecords.filter(r => r.type === 'rto_alert').length },
    { id: 'missing_courier_awb', label: 'Missing AWB', count: exceptionRecords.filter(r => r.type === 'missing_courier_awb').length }
  ];

  return (
    <div className="space-y-4">
      {/* SECTION HEADER */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert size={18} className="text-rose-400" />
            <span>Tracking & Exception Action Center</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time feed of shipments stuck, failed, breached SLA, or requiring customer intervention
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950/80 border border-rose-800/60 px-3 py-1 rounded-xl">
            {exceptionRecords.length} Flagged Shipments
          </span>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-3.5 space-y-3">
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedFilter === tab.id
                    ? 'bg-rose-600 text-white font-bold shadow-md shadow-rose-900/40'
                    : 'bg-[#0e1626] text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exceptions..."
              className="w-full bg-[#0e1626] border border-slate-800 focus:border-cyan-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* EXCEPTIONS TABLE */}
        <div className="overflow-x-auto custom-scrollbar max-h-96 rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0e1626] text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Exception Category</th>
                <th className="px-4 py-3">Issue Reason</th>
                <th className="px-4 py-3">Courier & AWB</th>
                <th className="px-4 py-3 text-center">Transit Age</th>
                <th className="px-4 py-3">Last Sync</th>
                <th className="px-4 py-3 text-right">Available Next Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-[#0b1220]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-500">
                    No exceptions flagged in current filter view
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item, idx) => (
                  <tr key={`${item.order.id}-${idx}`} className="hover:bg-slate-900/60 transition-colors">
                    
                    {/* Order ID */}
                    <td className="px-4 py-3 font-mono font-bold text-cyan-300 whitespace-nowrap">
                      {item.order.displayOrderId || item.order.orderId}
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3 text-slate-200 font-semibold max-w-[160px] truncate">
                      {item.order.customerName || '—'}
                      {item.order.phoneNumber && (
                        <div className="text-[10px] font-mono text-slate-500">{item.order.phoneNumber}</div>
                      )}
                    </td>

                    {/* Category Badge */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.badgeColor}`}>
                        {item.typeLabel}
                      </span>
                    </td>

                    {/* Issue Reason */}
                    <td className="px-4 py-3 text-slate-300 max-w-[200px] truncate" title={item.reason}>
                      {item.reason}
                    </td>

                    {/* Courier & AWB */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200">{item.courierName}</div>
                      {item.awb && item.awb !== '—' && (
                        <div 
                          onClick={() => copyToClipboard(item.awb, 'AWB')}
                          className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
                          title="Click to copy AWB"
                        >
                          <span>{item.awb}</span>
                          <Copy size={10} />
                        </div>
                      )}
                    </td>

                    {/* Transit Age */}
                    <td className="px-4 py-3 text-center font-mono font-bold text-yellow-400">
                      {item.ageDays}d
                    </td>

                    {/* Last Sync */}
                    <td className="px-4 py-3 text-[11px] font-mono text-slate-400 whitespace-nowrap">
                      {item.lastUpdatedDisplay}
                    </td>

                    {/* Next Action Button */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {onTrackOrder && item.awb && item.awb !== '—' && (
                          <button
                            type="button"
                            onClick={() => onTrackOrder(item.order as any)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Track
                          </button>
                        )}
                        {onViewCustomer && item.order.customerKey && (
                          <button
                            type="button"
                            onClick={() => onViewCustomer(item.order.customerKey)}
                            className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Customer
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};
