import React, { useMemo, useState } from 'react';
import { 
  Truck, 
  Search, 
  CheckCircle2, 
  RotateCcw, 
  Clock, 
  ArrowUpDown, 
  ChevronRight, 
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  Download,
  X,
  Filter,
  HelpCircle,
  Info,
  Package,
  Layers,
  FileQuestion,
  Ban
} from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';
import type { CourierPerformanceSummary } from '../../../Logistics/utils/logisticsAnalyticsUtils';
import { formatINR, getCanonicalStatus } from '../../../Logistics/utils/logisticsAnalyticsUtils';
import { isCourierActive } from '../../../../config/courierConfig';

export interface DiagnosticCategorySummary {
  key: string;
  label: string;
  count: number;
  description: string;
  sampleOrders: WebsiteConsolidatedOrder[];
}

interface WebsiteCourierPerformanceSectionProps {
  courierPerformance: CourierPerformanceSummary[];
  allOrders?: WebsiteConsolidatedOrder[];
  isLoading?: boolean;
  onViewCourierOrders: (
    courierName: string, 
    orders: WebsiteConsolidatedOrder[], 
    filterStatus?: 'ALL' | 'DELIVERED' | 'RTO' | 'IN_TRANSIT' | 'OTHER' | 'CANCELLED'
  ) => void;
}

type OutcomeFilter = 'ALL' | 'DELIVERED' | 'RTO' | 'IN_TRANSIT' | 'OTHER' | 'CANCELLED';

export const WebsiteCourierPerformanceSection: React.FC<WebsiteCourierPerformanceSectionProps> = ({
  courierPerformance,
  allOrders = [],
  isLoading = false,
  onViewCourierOrders
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('ALL');
  const [sortField, setSortField] = useState<'courier' | 'total' | 'delivered' | 'rto' | 'inTransit' | 'otherStatuses' | 'deliveryRate' | 'rtoRate'>('total');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [selectedDiagnosticKey, setSelectedDiagnosticKey] = useState<string>('ALL');
  const [diagnosticSearch, setDiagnosticSearch] = useState('');

  // 1. Overall totals across all couriers
  const totals = useMemo(() => {
    let totalShipments = 0;
    let totalDelivered = 0;
    let totalRto = 0;
    let totalInTransit = 0;
    let totalOther = 0;
    let totalCancelled = 0;

    courierPerformance.forEach(c => {
      totalShipments += c.total;
      totalDelivered += c.delivered;
      totalRto += c.rto;
      totalInTransit += c.inTransit;
      totalOther += c.otherStatuses || 0;
      totalCancelled += c.cancelled || 0;
    });

    const activeShipments = totalShipments - totalCancelled;
    const concluded = totalDelivered + totalRto;
    const overallDeliveryRate = concluded > 0 
      ? `${((totalDelivered / concluded) * 100).toFixed(1)}%` 
      : (activeShipments > 0 ? `${((totalDelivered / activeShipments) * 100).toFixed(1)}%` : '0.0%');
    const overallRtoRate = concluded > 0 
      ? `${((totalRto / concluded) * 100).toFixed(1)}%` 
      : (activeShipments > 0 ? `${((totalRto / activeShipments) * 100).toFixed(1)}%` : '0.0%');

    return {
      totalOrders: totalShipments,
      activeShipments,
      totalDelivered,
      totalRto,
      totalInTransit,
      totalOther,
      totalCancelled,
      overallDeliveryRate,
      overallRtoRate
    };
  }, [courierPerformance]);

  // 2. Diagnostic breakdown of Unknown and Non-Reconciled records
  const diagnosticAnalysis = useMemo(() => {
    const list = allOrders.length > 0 
      ? allOrders 
      : courierPerformance.flatMap(c => c.orders);

    const categories: Record<string, { label: string; description: string; orders: WebsiteConsolidatedOrder[] }> = {
      MISSING_SHIPMENT_REPORT: {
        label: 'No Tracking File Uploaded (Missing Shipment Metadata)',
        description: 'Orders with no AWB and no courier assigned in tracking data. Awaiting carrier tracking upload.',
        orders: []
      },
      MISSING_AWB_WITH_COURIER: {
        label: 'Courier Assigned, Missing AWB',
        description: 'Carrier specified (e.g. House courier, direct delivery), but waybill tracking number is blank.',
        orders: []
      },
      AWB_NO_COURIER: {
        label: 'AWB Present, Unknown Courier Name',
        description: 'Tracking waybill exists, but logistics carrier name could not be resolved.',
        orders: []
      },
      AWB_UNMATCHED: {
        label: 'AWB Not Found in Tracking Data',
        description: 'Waybill does not match any imported carrier tracking manifest.',
        orders: []
      },
      UNRECOGNIZED_COURIER: {
        label: 'Unrecognized Courier Partner',
        description: 'Carrier name present but not recognized in configured carrier list.',
        orders: []
      },
      CANCELLED_PRIOR_DISPATCH: {
        label: 'Cancelled Orders (Pre-Fulfillment)',
        description: 'Orders cancelled prior to manifest or shipment dispatch.',
        orders: []
      }
    };

    list.forEach(o => {
      const canonical = getCanonicalStatus(o);
      const awb = (o.awb_number || (o as any).extra_data?.awb_number || '').trim();
      const courier = (o.courier || (o as any).extra_data?.courier || '').trim();

      if (canonical === 'Cancelled' || o.order_status === 'CANCELLED') {
        categories.CANCELLED_PRIOR_DISPATCH.orders.push(o);
        return;
      }

      if (!awb && !courier) {
        categories.MISSING_SHIPMENT_REPORT.orders.push(o);
      } else if (!awb && courier) {
        categories.MISSING_AWB_WITH_COURIER.orders.push(o);
      } else if (awb && !courier) {
        categories.AWB_NO_COURIER.orders.push(o);
      } else if (awb && courier && !isCourierActive(courier)) {
        categories.UNRECOGNIZED_COURIER.orders.push(o);
      } else if (awb && (!o.raw_status && !o.shipment_status && !o.delhivery_remarks)) {
        categories.AWB_UNMATCHED.orders.push(o);
      }
    });

    const categoryList: DiagnosticCategorySummary[] = Object.entries(categories).map(([key, data]) => ({
      key,
      label: data.label,
      description: data.description,
      count: data.orders.length,
      sampleOrders: data.orders
    }));

    return {
      categoryList,
      totalUnknown: categories.MISSING_SHIPMENT_REPORT.orders.length + 
                    categories.MISSING_AWB_WITH_COURIER.orders.length + 
                    categories.AWB_NO_COURIER.orders.length,
      missingAwbCount: categories.MISSING_SHIPMENT_REPORT.orders.length + 
                       categories.MISSING_AWB_WITH_COURIER.orders.length,
      allDiagnosticOrders: list.filter(o => {
        const canonical = getCanonicalStatus(o);
        const awb = (o.awb_number || (o as any).extra_data?.awb_number || '').trim();
        const courier = (o.courier || (o as any).extra_data?.courier || '').trim();
        return !awb || !courier || canonical === 'Cancelled';
      })
    };
  }, [allOrders, courierPerformance]);

  // 3. Filter and sort couriers
  const filteredRows = useMemo(() => {
    let rows = courierPerformance.filter(c => {
      if (outcomeFilter === 'DELIVERED' && c.delivered === 0) return false;
      if (outcomeFilter === 'RTO' && c.rto === 0) return false;
      if (outcomeFilter === 'IN_TRANSIT' && c.inTransit === 0) return false;
      if (outcomeFilter === 'OTHER' && (c.otherStatuses || 0) === 0) return false;
      if (outcomeFilter === 'CANCELLED' && (c.cancelled || 0) === 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!c.courier.toLowerCase().includes(q)) return false;
      }
      return true;
    });

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

  // Helper to get diagnostic reason text for an order
  const getDiagnosticReason = (order: WebsiteConsolidatedOrder): string => {
    const canonical = getCanonicalStatus(order);
    if (canonical === 'Cancelled' || order.order_status === 'CANCELLED') {
      return 'Order cancelled pre-fulfillment; excluded from carrier manifest.';
    }
    const awb = (order.awb_number || (order as any).extra_data?.awb_number || '').trim();
    const courier = (order.courier || (order as any).extra_data?.courier || '').trim();
    if (!awb && !courier) {
      return 'No carrier tracking file uploaded for this order; awaiting report import.';
    }
    if (!awb && courier) {
      return `Carrier assigned (${courier}) but no waybill tracking number generated.`;
    }
    if (awb && !courier) {
      return `Waybill (${awb}) present but carrier name is unrecognized.`;
    }
    if (awb && courier && !isCourierActive(courier)) {
      return `Carrier (${courier}) not recognized in configured carrier list.`;
    }
    if (awb && (!order.raw_status && !order.shipment_status && !order.delhivery_remarks)) {
      return `Waybill (${awb}) present but no tracking events found in manifests.`;
    }
    return 'Carrier tracking data awaiting synchronization.';
  };

  // Export Unknown Orders to CSV
  const handleExportUnknownCsv = () => {
    const rows = diagnosticAnalysis.allDiagnosticOrders.map(o => {
      return [
        `#${o.order_id}`,
        o.order_date,
        `"${(o.customer_name || '').replace(/"/g, '""')}"`,
        o.phone || '',
        `"${(o.city || '').replace(/"/g, '""')}"`,
        `"${(o.state || '').replace(/"/g, '""')}"`,
        o.payment_mode || 'UNKNOWN',
        Number(o.price || 0),
        o.dispatch_status || 'UNFULFILLED',
        o.awb_number || '',
        o.courier || 'Unknown / Not Available',
        `"${getDiagnosticReason(o).replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = [
      'Order ID,Order Date,Customer Name,Phone,City,State,Payment Mode,Order Value (INR),Dispatch Status,AWB Number,Courier,Classification Reason',
      ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Unknown_Courier_Records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* 1. Header & Diagnostic Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Truck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Courier Performance Breakdown</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {courierPerformance.length} {courierPerformance.length === 1 ? 'Carrier' : 'Carriers'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Unique shipment outcomes and delivery SLA performance by logistics carrier for selected period
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDiagnosticModalOpen(true)}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Inspect diagnostic classification of Unknown courier & unlinked shipment records"
          >
            <HelpCircle size={13} className="text-amber-400" />
            <span>Unknown Records Diagnostics ({diagnosticAnalysis.totalUnknown})</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Reconciliation Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3 bg-slate-950/70 border border-slate-800/90 rounded-xl text-xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase text-slate-500">Total Period Orders</span>
          {isLoading ? (
            <div className="h-5 w-16 bg-slate-800 rounded animate-pulse mt-1 mb-0.5" />
          ) : (
            <span className="text-base font-bold text-white font-mono mt-0.5">
              {totals.totalOrders.toLocaleString('en-IN')}
            </span>
          )}
          <span className="text-[10px] text-slate-500">Sales records in scope</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase text-slate-500">Active Shipments</span>
          {isLoading ? (
            <div className="h-5 w-16 bg-slate-800 rounded animate-pulse mt-1 mb-0.5" />
          ) : (
            <span className="text-base font-bold text-indigo-300 font-mono mt-0.5">
              {totals.activeShipments.toLocaleString('en-IN')}
            </span>
          )}
          <span className="text-[10px] text-slate-500">Dispatchable orders</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase text-slate-500">Cancelled Pre-Dispatch</span>
          {isLoading ? (
            <div className="h-5 w-16 bg-slate-800 rounded animate-pulse mt-1 mb-0.5" />
          ) : (
            <button
              type="button"
              onClick={() => {
                const cancOrders = courierPerformance.flatMap(c => c.cancelledOrders || []);
                onViewCourierOrders('All Couriers', cancOrders, 'CANCELLED');
              }}
              className="text-left text-base font-bold text-slate-400 hover:text-rose-300 font-mono mt-0.5 cursor-pointer"
              title="Click to view 5 cancelled orders"
            >
              {totals.totalCancelled.toLocaleString('en-IN')}
              <span className="text-[10px] font-sans font-normal text-purple-400 hover:underline ml-1.5">View →</span>
            </button>
          )}
          <span className="text-[10px] text-slate-500">Excluded from delivery SLA</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase text-slate-500">Delivered Outcomes</span>
          {isLoading ? (
            <div className="h-5 w-16 bg-slate-800 rounded animate-pulse mt-1 mb-0.5" />
          ) : (
            <button
              type="button"
              onClick={() => {
                const delOrders = courierPerformance.flatMap(c => c.deliveredOrders || []);
                onViewCourierOrders('All Couriers', delOrders, 'DELIVERED');
              }}
              className="text-left text-base font-bold text-emerald-400 hover:text-emerald-300 font-mono mt-0.5 cursor-pointer"
            >
              {totals.totalDelivered.toLocaleString('en-IN')}
              <span className="text-[10px] font-sans font-normal text-purple-400 hover:underline ml-1.5">View →</span>
            </button>
          )}
          <span className="text-[10px] text-emerald-400/80">{totals.overallDeliveryRate} delivery rate</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase text-slate-500">Total RTO Returns</span>
          {isLoading ? (
            <div className="h-5 w-16 bg-slate-800 rounded animate-pulse mt-1 mb-0.5" />
          ) : (
            <button
              type="button"
              onClick={() => {
                const rtoOrders = courierPerformance.flatMap(c => c.rtoOrders || []);
                onViewCourierOrders('All Couriers', rtoOrders, 'RTO');
              }}
              className="text-left text-base font-bold text-rose-400 hover:text-rose-300 font-mono mt-0.5 cursor-pointer"
            >
              {totals.totalRto.toLocaleString('en-IN')}
              <span className="text-[10px] font-sans font-normal text-purple-400 hover:underline ml-1.5">View →</span>
            </button>
          )}
          <span className="text-[10px] text-rose-400/80">{totals.overallRtoRate} return rate</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase text-slate-500">Missing Tracking Report</span>
          {isLoading ? (
            <div className="h-5 w-16 bg-slate-800 rounded animate-pulse mt-1 mb-0.5" />
          ) : (
            <button
              type="button"
              onClick={() => setIsDiagnosticModalOpen(true)}
              className="text-left text-base font-bold text-amber-300 hover:text-amber-200 font-mono mt-0.5 cursor-pointer"
            >
              {diagnosticAnalysis.totalUnknown.toLocaleString('en-IN')}
              <span className="text-[10px] font-sans font-normal text-purple-400 hover:underline ml-1.5">Inspect →</span>
            </button>
          )}
          <span className="text-[10px] text-slate-500">No courier file uploaded</span>
        </div>
      </div>

      {/* 3. Toolbar Controls (Outcome Pills + Search) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setOutcomeFilter('ALL')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              outcomeFilter === 'ALL'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Records ({totals.totalOrders})
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
          <button
            type="button"
            onClick={() => setOutcomeFilter('IN_TRANSIT')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              outcomeFilter === 'IN_TRANSIT'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-blue-300'
            }`}
          >
            <Clock size={12} />
            <span>In Transit ({totals.totalInTransit})</span>
          </button>
          <button
            type="button"
            onClick={() => setOutcomeFilter('OTHER')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              outcomeFilter === 'OTHER'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-indigo-300'
            }`}
          >
            <Layers size={12} />
            <span>Other Statuses ({totals.totalOther})</span>
          </button>
          <button
            type="button"
            onClick={() => setOutcomeFilter('CANCELLED')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              outcomeFilter === 'CANCELLED'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ban size={12} />
            <span>Cancelled ({totals.totalCancelled})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search courier partner..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
      </div>

      {/* 4. Responsive Reconciled Table */}
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
                className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Total Orders</span>
                  <ArrowUpDown size={12} className={sortField === 'total' ? 'text-purple-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('delivered')}
                className="py-3 px-3 text-right cursor-pointer hover:text-emerald-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Delivered</span>
                  <ArrowUpDown size={12} className={sortField === 'delivered' ? 'text-emerald-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('rto')}
                className="py-3 px-3 text-right cursor-pointer hover:text-rose-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>RTO</span>
                  <ArrowUpDown size={12} className={sortField === 'rto' ? 'text-rose-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('inTransit')}
                className="py-3 px-3 text-right cursor-pointer hover:text-blue-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>In Transit</span>
                  <ArrowUpDown size={12} className={sortField === 'inTransit' ? 'text-blue-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('otherStatuses')}
                className="py-3 px-3 text-right cursor-pointer hover:text-indigo-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Other Statuses</span>
                  <ArrowUpDown size={12} className={sortField === 'otherStatuses' ? 'text-indigo-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('deliveryRate')}
                className="py-3 px-3 text-right cursor-pointer hover:text-emerald-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Delivery Rate</span>
                  <ArrowUpDown size={12} className={sortField === 'deliveryRate' ? 'text-emerald-400' : 'text-slate-600'} />
                </div>
              </th>
              <th
                onClick={() => handleSort('rtoRate')}
                className="py-3 px-3 text-right cursor-pointer hover:text-rose-300 transition-colors"
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
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3 px-4"><div className="h-4 w-32 bg-slate-800 rounded" /></td>
                  <td className="py-3 px-3 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 text-right"><div className="h-4 w-14 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 text-right"><div className="h-4 w-14 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-4 text-center"><div className="h-6 w-14 bg-slate-800 rounded mx-auto" /></td>
                </tr>
              ))
            ) : filteredRows.length > 0 ? (
              filteredRows.map((row) => {
                const isDelhivery = row.courier.toLowerCase().includes('delhivery');
                const isIndiaPost = row.courier.toLowerCase().includes('india post');
                const isStCourier = row.courier.toLowerCase().includes('st courier');
                const isAmazon = row.courier.toLowerCase().includes('amazon');
                const isEkart = row.courier.toLowerCase().includes('ekart');
                const isUnknown = row.courier.includes('Unknown') || row.courier.includes('Not Available');
                const isHouse = row.courier.toLowerCase() === 'house';

                const courierColor = isIndiaPost ? '#f43f5e' : 
                                     isDelhivery ? '#06b6d4' : 
                                     isStCourier ? '#38bdf8' : 
                                     isAmazon ? '#f59e0b' : 
                                     isEkart ? '#a855f7' : 
                                     isHouse ? '#8b5cf6' : 
                                     isUnknown ? '#eab308' : '#3b82f6';

                return (
                  <tr
                    key={row.courier}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => onViewCourierOrders(row.courier, row.orders, outcomeFilter)}
                  >
                    {/* Courier Name */}
                    <td className="py-3 px-4 font-sans font-medium text-slate-200">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{
                          backgroundColor: courierColor
                        }} />
                        <span className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                          {row.courier}
                        </span>
                        {isUnknown && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 font-sans">
                            Awaiting File Import
                          </span>
                        )}
                        {row.cancelled > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400 font-sans" title={`${row.cancelled} orders cancelled pre-dispatch`}>
                            {row.cancelled} cancelled
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Shipments */}
                    <td className="py-3 px-3 text-right text-slate-300 font-bold">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewCourierOrders(row.courier, row.orders, 'ALL');
                        }}
                        className="hover:text-purple-300 hover:underline cursor-pointer"
                      >
                        {row.total.toLocaleString('en-IN')}
                      </button>
                    </td>

                    {/* Delivered */}
                    <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const list = row.deliveredOrders || row.orders.filter(o => getCanonicalStatus(o) === 'Delivered');
                          onViewCourierOrders(row.courier, list, 'DELIVERED');
                        }}
                        className="hover:text-emerald-300 hover:underline cursor-pointer"
                      >
                        {row.delivered.toLocaleString('en-IN')}
                      </button>
                    </td>

                    {/* RTO */}
                    <td className="py-3 px-3 text-right text-rose-400 font-bold">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const list = row.rtoOrders || row.orders.filter(o => getCanonicalStatus(o).includes('RTO'));
                          onViewCourierOrders(row.courier, list, 'RTO');
                        }}
                        className="hover:text-rose-300 hover:underline cursor-pointer"
                      >
                        {row.rto.toLocaleString('en-IN')}
                      </button>
                    </td>

                    {/* In Transit */}
                    <td className="py-3 px-3 text-right text-blue-400">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const list = row.inTransitOrders || row.orders.filter(o => {
                            const s = getCanonicalStatus(o);
                            return s === 'In Transit' || s === 'Out for Delivery';
                          });
                          onViewCourierOrders(row.courier, list, 'IN_TRANSIT');
                        }}
                        className="hover:text-blue-300 hover:underline cursor-pointer"
                      >
                        {row.inTransit.toLocaleString('en-IN')}
                      </button>
                    </td>

                    {/* Other Statuses */}
                    <td className="py-3 px-3 text-right text-indigo-300">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const list = row.otherOrders || row.orders.filter(o => {
                            const s = getCanonicalStatus(o);
                            return s !== 'Delivered' && !s.includes('RTO') && s !== 'In Transit' && s !== 'Out for Delivery' && s !== 'Cancelled';
                          });
                          onViewCourierOrders(row.courier, list, 'OTHER');
                        }}
                        className="hover:text-indigo-200 hover:underline cursor-pointer"
                      >
                        {(row.otherStatuses || 0).toLocaleString('en-IN')}
                      </button>
                    </td>

                    {/* Delivery Rate */}
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {row.deliveryRate}
                      </span>
                    </td>

                    {/* RTO Rate */}
                    <td className="py-3 px-3 text-right">
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
                          if (isUnknown) {
                            setIsDiagnosticModalOpen(true);
                          } else {
                            onViewCourierOrders(row.courier, row.orders, outcomeFilter);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-purple-600/30 text-purple-300 text-xs font-sans font-bold transition-all border border-slate-700/60 hover:border-purple-500/40 cursor-pointer"
                        title={isUnknown ? "Inspect Unknown Diagnostic Details" : `View underlying shipments for ${row.courier}`}
                      >
                        <span>{isUnknown ? 'Diagnose' : 'View'}</span>
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
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
                <td className="py-3 px-3 text-right text-white">
                  {totals.totalOrders.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-3 text-right text-emerald-400">
                  {totals.totalDelivered.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-3 text-right text-rose-400">
                  {totals.totalRto.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-3 text-right text-blue-400">
                  {totals.totalInTransit.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-3 text-right text-indigo-300">
                  {totals.totalOther.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    {totals.overallDeliveryRate}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-rose-300 bg-rose-500/10 border border-rose-500/20 text-xs">
                    {totals.overallRtoRate}
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-sans text-[11px] text-emerald-400">
                  100% Reconciled
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 5. Unknown Records Diagnostic Modal */}
      {isDiagnosticModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <FileQuestion size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Unknown Records & Courier Reconciliation Diagnostics</h3>
                  <p className="text-xs text-slate-400">
                    Investigate why records lack courier or waybill metadata and reconcile with imported carrier files
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportUnknownCsv}
                  className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Download Unknown & Diagnostic Records as CSV"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDiagnosticModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Diagnostic Categories Grid */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-slate-950/40 border-b border-slate-800">
              {diagnosticAnalysis.categoryList.map(cat => {
                const isSelected = selectedDiagnosticKey === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedDiagnosticKey(isSelected ? 'ALL' : cat.key)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500/50 shadow-sm'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 line-clamp-1">{cat.label}</span>
                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                        cat.count > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {cat.count}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                      {cat.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Search & Sub-Filter Bar */}
            <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Filter size={13} className="text-purple-400" />
                <span>
                  Showing: <strong className="text-white">
                    {selectedDiagnosticKey === 'ALL' ? 'All Diagnostic Records' : diagnosticAnalysis.categoryList.find(c => c.key === selectedDiagnosticKey)?.label}
                  </strong>
                </span>
                {selectedDiagnosticKey !== 'ALL' && (
                  <button
                    onClick={() => setSelectedDiagnosticKey('ALL')}
                    className="text-purple-400 hover:underline text-[11px] ml-1 cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              <div className="relative min-w-[220px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by Order ID, name, phone..."
                  value={diagnosticSearch}
                  onChange={e => setDiagnosticSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Diagnostic Records Table */}
            <div className="flex-1 overflow-auto p-4">
              {(() => {
                let displayedOrders = diagnosticAnalysis.allDiagnosticOrders;
                if (selectedDiagnosticKey !== 'ALL') {
                  const matchCat = diagnosticAnalysis.categoryList.find(c => c.key === selectedDiagnosticKey);
                  displayedOrders = matchCat ? matchCat.sampleOrders : [];
                }

                if (diagnosticSearch.trim()) {
                  const q = diagnosticSearch.toLowerCase().trim();
                  displayedOrders = displayedOrders.filter(o => {
                    const oid = String(o.order_id || '').toLowerCase();
                    const name = (o.customer_name || '').toLowerCase();
                    const phone = (o.phone || '').toLowerCase();
                    return oid.includes(q) || name.includes(q) || phone.includes(q);
                  });
                }

                if (displayedOrders.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      No records match the selected diagnostic criteria.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                          <th className="py-2.5 px-3">Order ID</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Location</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Carrier / AWB</th>
                          <th className="py-2.5 px-3">Diagnostic Classification Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {displayedOrders.slice(0, 300).map(o => {
                          const canonical = getCanonicalStatus(o);
                          const isCancelled = canonical === 'Cancelled';
                          const awb = o.awb_number || (o as any).extra_data?.awb_number || '';
                          const courier = o.courier || (o as any).extra_data?.courier || '';
                          const reason = getDiagnosticReason(o);

                          return (
                            <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-white">#{o.order_id}</td>
                              <td className="py-2.5 px-3 text-slate-400 font-sans">{o.order_date}</td>
                              <td className="py-2.5 px-3 font-sans text-slate-200">
                                <div>{o.customer_name || 'N/A'}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{o.phone || '-'}</div>
                              </td>
                              <td className="py-2.5 px-3 font-sans text-slate-400 text-[10px]">
                                {o.city ? `${o.city}, ` : ''}{o.state || 'Unspecified'}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-200">
                                {formatINR(Number(o.price || 0))}
                              </td>
                              <td className="py-2.5 px-3 font-sans">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isCancelled
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : canonical === 'Delivered'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-blue-500/20 text-blue-300'
                                }`}>
                                  {canonical}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-sans">
                                <div className="text-slate-300 font-semibold">{courier || 'Unassigned'}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{awb || 'No AWB'}</div>
                              </td>
                              <td className="py-2.5 px-3 font-sans text-amber-300/90 text-[11px]">
                                {reason}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing up to 300 records in preview. Use <strong className="text-white">Export CSV</strong> to inspect the complete dataset.
              </span>
              <button
                type="button"
                onClick={() => setIsDiagnosticModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all cursor-pointer"
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
