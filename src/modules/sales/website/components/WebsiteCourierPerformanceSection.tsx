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
  Ban,
  Trash2,
  Activity
} from 'lucide-react';
import type { WebsiteConsolidatedOrder } from '../types';
import type { CourierPerformanceSummary, OtherStatusOrderDetail } from '../../../Logistics/utils/logisticsAnalyticsUtils';
import { formatINR, getCanonicalStatus, isDeletedOrder, getOtherStatusDetail, getOrderOriginalCarrierStatus } from '../../../Logistics/utils/logisticsAnalyticsUtils';
import { formatSalesDateShort } from '../websiteSalesUtils';
import { isCourierActive } from '../../../../config/courierConfig';
import { OrderDetailsModal } from './OrderDetailsModal';

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
    filterStatus?: 'ALL' | 'DELIVERED' | 'RTO' | 'IN_TRANSIT' | 'OTHER' | 'CANCELLED' | 'DELETED'
  ) => void;
}

type OutcomeFilter = 'ALL' | 'DELIVERED' | 'RTO' | 'IN_TRANSIT' | 'OTHER' | 'CANCELLED' | 'DELETED';

export const WebsiteCourierPerformanceSection: React.FC<WebsiteCourierPerformanceSectionProps> = ({
  courierPerformance,
  allOrders = [],
  isLoading = false,
  onViewCourierOrders
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('ALL');
  const [sortField, setSortField] = useState<'courier' | 'cancelled' | 'total' | 'delivered' | 'rto' | 'inTransit' | 'otherStatuses' | 'deliveryRate' | 'rtoRate'>('total');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [selectedDiagnosticKey, setSelectedDiagnosticKey] = useState<string>('ALL');
  const [diagnosticSearch, setDiagnosticSearch] = useState('');

  // ST Courier Reconciliation Diagnostic Modal State
  const [isStDiagnosticModalOpen, setIsStDiagnosticModalOpen] = useState(false);
  const [stDiagnosticOutcomeFilter, setStDiagnosticOutcomeFilter] = useState<'ALL' | 'RTO' | 'CANCELLED' | 'DELIVERED' | 'CONFLICT'>('ALL');
  const [stDiagnosticSearch, setStDiagnosticSearch] = useState('');

  // Other Status Details Modal State
  const [isOtherStatusModalOpen, setIsOtherStatusModalOpen] = useState(false);
  const [selectedOtherCourierFilter, setSelectedOtherCourierFilter] = useState<string>('ALL');
  const [selectedOtherStatusFilter, setSelectedOtherStatusFilter] = useState<string>('ALL');
  const [otherStatusSearch, setOtherStatusSearch] = useState('');
  const [inspectedOrderForModal, setInspectedOrderForModal] = useState<WebsiteConsolidatedOrder | null>(null);

  // Dedicated Cancelled Orders Modal State
  const [isCancelledOrdersModalOpen, setIsCancelledOrdersModalOpen] = useState(false);
  const [selectedCancelledCourierFilter, setSelectedCancelledCourierFilter] = useState<string>('ALL');
  const [cancelledSearchQuery, setCancelledSearchQuery] = useState('');

  const handleOpenCancelledOrdersModal = (courierName: string) => {
    setSelectedCancelledCourierFilter(courierName === 'All Couriers' ? 'ALL' : courierName);
    setCancelledSearchQuery('');
    setIsCancelledOrdersModalOpen(true);
  };

  const handleOpenOtherStatusModal = (courierName: string, statusName: string = 'ALL') => {
    setSelectedOtherCourierFilter(courierName === 'All Couriers' ? 'ALL' : courierName);
    setSelectedOtherStatusFilter(statusName);
    setOtherStatusSearch('');
    setIsOtherStatusModalOpen(true);
  };

  // 1. Overall totals across all couriers
  const totals = useMemo(() => {
    let totalShipments = 0;
    let totalDelivered = 0;
    let totalRto = 0;
    let totalInTransit = 0;
    let totalOther = 0;
    let totalCancelled = 0;
    let totalDeleted = 0;

    courierPerformance.forEach(c => {
      totalShipments += c.total;
      totalDelivered += c.delivered;
      totalRto += c.rto;
      totalInTransit += c.inTransit;
      totalOther += c.otherStatuses || 0;
      totalCancelled += c.cancelled || 0;
      totalDeleted += (c as any).deleted || 0;
    });

    const activeShipments = Math.max(0, totalShipments - totalCancelled - totalDeleted);
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
      totalDeleted,
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
      },
      DELETED_ORDERS: {
        label: 'Deleted Orders',
        description: 'Orders deleted from Sales or Logistics; excluded from dispatch and carrier manifests.',
        orders: []
      }
    };

    list.forEach(o => {
      const canonical = getCanonicalStatus(o);
      const isCancelled =
        canonical === 'Cancelled' ||
        o.order_status === 'CANCELLED' ||
        Boolean(o.cancellation && (o.cancellation.status === 'CANCELLED' || String(o.cancellation.status).toLowerCase() === 'cancelled')) ||
        Boolean((o as any).extra_data?.cancellation && ((o as any).extra_data.cancellation.status === 'CANCELLED' || String((o as any).extra_data.cancellation.status).toLowerCase() === 'cancelled'));
      const isDeleted = !isCancelled && (canonical === 'Deleted' || isDeletedOrder(o));
      const awb = (o.awb_number || (o as any).extra_data?.awb_number || '').trim();
      const courier = (o.courier || (o as any).extra_data?.courier || '').trim();

      if (isCancelled) {
        categories.CANCELLED_PRIOR_DISPATCH.orders.push(o);
        return;
      }

      if (isDeleted) {
        categories.DELETED_ORDERS.orders.push(o);
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
      deletedCount: categories.DELETED_ORDERS.orders.length,
      allDiagnosticOrders: list.filter(o => {
        const canonical = getCanonicalStatus(o);
        const isCancelled =
          canonical === 'Cancelled' ||
          o.order_status === 'CANCELLED' ||
          Boolean(o.cancellation && (o.cancellation.status === 'CANCELLED' || String(o.cancellation.status).toLowerCase() === 'cancelled')) ||
          Boolean((o as any).extra_data?.cancellation && ((o as any).extra_data.cancellation.status === 'CANCELLED' || String((o as any).extra_data.cancellation.status).toLowerCase() === 'cancelled'));
        const isDeleted = !isCancelled && (canonical === 'Deleted' || isDeletedOrder(o));
        const awb = (o.awb_number || (o as any).extra_data?.awb_number || '').trim();
        const courier = (o.courier || (o as any).extra_data?.courier || '').trim();
        return isDeleted || isCancelled || !awb || !courier;
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
      if (outcomeFilter === 'DELETED' && (c.deleted || 0) === 0) return false;

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
    const isCancelled =
      canonical === 'Cancelled' ||
      order.order_status === 'CANCELLED' ||
      Boolean(order.cancellation && (order.cancellation.status === 'CANCELLED' || String(order.cancellation.status).toLowerCase() === 'cancelled')) ||
      Boolean((order as any).extra_data?.cancellation && ((order as any).extra_data.cancellation.status === 'CANCELLED' || String((order as any).extra_data.cancellation.status).toLowerCase() === 'cancelled'));

    if (isCancelled) {
      const extra = order.extra_data || {};
      const cancelInfo = order.cancellation || extra.cancellation || {};
      const cancelDate = cancelInfo.cancelled_at || extra.cancelled_at || extra.cancellation_requested_at || order.order_date;
      const formattedDate = cancelDate ? formatSalesDateShort(cancelDate) : '';

      const finStatus = (order.financial_status || extra.financial_status || '').toLowerCase();
      const finTag = finStatus ? ` (${finStatus.charAt(0).toUpperCase() + finStatus.slice(1)})` : '';

      const reasonText = String(cancelInfo.reason || extra.cancellation_reason || '');
      const source = reasonText.toLowerCase().includes('shopify') ? 'in Shopify ' : '';

      if (formattedDate) {
        return `Cancelled ${source}on ${formattedDate}${finTag}; excluded from carrier manifest.`;
      }
      return `Cancelled ${source}${finTag ? finTag + ' ' : ''}pre-fulfillment; excluded from carrier manifest.`;
    }

    if (canonical === 'Deleted' || isDeletedOrder(order)) {
      const extra = order.extra_data || {};
      const delDate = extra.deleted_at || (order as any).deletedAt;
      const delReason = extra.deletion_reason || (order as any).trashReason || (order as any).remarks;
      const datePart = delDate ? `Deleted on ${formatSalesDateShort(delDate)}` : 'Order marked as DELETED';
      const reasonPart = delReason ? `: ${delReason}` : '; excluded from logistics manifests and dispatch.';
      return `${datePart}${reasonPart}`;
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

  // 3. ST Courier Status Reconciliation Diagnostics dataset
  const stReconciliationItems = useMemo(() => {
    const list = (allOrders.length > 0 ? allOrders : courierPerformance.flatMap(c => c.orders));
    const stOrders = list.filter(o => {
      const c = (o.courier || o.extra_data?.courier || '').toLowerCase();
      return c.includes('st') || c === 'st courier';
    });

    return stOrders.map(o => {
      const extra = o.extra_data || {};
      const stTrack = extra.st_courier_tracking || {};
      const botEvents: Array<{ activity?: string; location?: string; timestamp?: string }> = Array.isArray(stTrack.events) ? stTrack.events : [];
      
      const rawStatus = o.raw_status || extra.raw_status || o.fulfillment_status || 'N/A';
      const statusType = extra.status_type || extra['Status Type'] || o.status_type || 'N/A';
      const currentStatus = extra.current_status || extra['Current Status'] || extra['Current stauts'] || extra.st_current_status || o.current_status || 'N/A';
      const awb = o.awb_number || extra.awb_number || 'N/A';
      const canonical = getCanonicalStatus(o);

      // Identify conflicts
      let conflict = 'None';
      let isConflict = false;
      const normSt = statusType.toLowerCase().replace(/[^a-z]/g, '');
      const normCs = currentStatus.toLowerCase().replace(/[^a-z]/g, '');

      if (normSt === 'delivered' && (normCs.includes('returntoorigin') || normCs.includes('returntoorgin') || normCs.includes('rto'))) {
        conflict = `Status Type is 'Delivered' but Current Status confirms RTO ('${currentStatus}')`;
        isConflict = true;
      } else if (normSt === 'undelivered' && normCs === 'canceled') {
        conflict = `Status Type is 'Un Delivered' but Current Status is 'Canceled'`;
        isConflict = true;
      } else if (normSt === 'delivered' && normCs === 'undelivered') {
        conflict = `Status Type is 'Delivered' but Current Status is 'Un Delivered'`;
        isConflict = true;
      } else if (normSt === 'undelivered' && normCs === 'delivered') {
        conflict = `Status Type is 'Un Delivered' but Current Status is 'Delivered'`;
        isConflict = true;
      }

      // Determine Precedence Reason
      let reason = '';
      let source = 'Carrier Report';
      if (botEvents.length > 0) {
        source = 'Tracking BOT + Carrier Report';
      }

      if (canonical.includes('RTO')) {
        const matchingEv = botEvents.find(e => {
          const act = (e.activity || '').toLowerCase();
          return act.includes('rto') || act.includes('party refused') || act.includes('address not found') || act.includes('no service') || act.includes('return to origin') || act.includes('return to orgin');
        });

        if (matchingEv) {
          reason = `Precedence 1 (BOT Event): '${matchingEv.activity}' overrides dispatch status`;
        } else if (normCs.includes('returntoorigin') || normCs.includes('returntoorgin') || normCs.includes('rto')) {
          reason = `Precedence 2 (Carrier Report): Current Status '${currentStatus}' confirms RTO over Status Type '${statusType}'`;
        } else {
          reason = `Precedence 3: Dispatch status/waybill confirmed RTO return`;
        }
      } else if (canonical === 'Cancelled') {
        if (normCs === 'canceled' || normCs === 'cancelled') {
          reason = `Precedence 2 (Carrier Report): Current Status '${currentStatus}' maps to Cancelled (Never generic RTO)`;
        } else if (o.order_status === 'CANCELLED') {
          reason = `Source Order Cancelled in Shopify/Sales`;
        } else {
          reason = `Status Type indicates cancellation`;
        }
      } else if (canonical === 'Delivered') {
        if (botEvents.length > 0 && (botEvents[0]?.activity === 'Delivered' || (botEvents[0]?.activity || '').toLowerCase().includes('delivered'))) {
          reason = `Precedence 1 (BOT Event): Final delivery verified at ${botEvents[0]?.location || 'destination'}`;
        } else if (normCs === 'delivered') {
          reason = `Precedence 2 (Carrier Report): Current Status confirms physical delivery`;
        } else {
          reason = `Precedence 3: Order dispatch status / verified delivery date confirms delivery`;
        }
      } else {
        reason = `In transit / pending delivery scan`;
      }

      return {
        orderId: o.order_id,
        awb,
        customerName: o.customer_name || 'Customer',
        rawStatus,
        statusType,
        currentStatus,
        canonical,
        conflict,
        isConflict,
        source,
        reason,
        latestBotEvent: botEvents[0]?.activity || stTrack.latest_activity || 'None',
        order: o
      };
    });
  }, [allOrders, courierPerformance]);

  const handleExportStReconciliationCsv = () => {
    if (stReconciliationItems.length === 0) return;

    const rows = stReconciliationItems.map(item => {
      return [
        `"#${item.orderId}"`,
        `"${item.awb}"`,
        `"${(item.customerName || '').replace(/"/g, '""')}"`,
        `"${(item.source || '').replace(/"/g, '""')}"`,
        `"${(item.rawStatus || '').replace(/"/g, '""')}"`,
        `"${(item.statusType || '').replace(/"/g, '""')}"`,
        `"${(item.currentStatus || '').replace(/"/g, '""')}"`,
        `"${(item.latestBotEvent || '').replace(/"/g, '""')}"`,
        `"${(item.conflict || '').replace(/"/g, '""')}"`,
        `"${item.canonical}"`,
        `"${(item.reason || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = [
      'Order ID,AWB Number,Customer Name,Source,Raw Status,Status Type,Current Status,BOT Event,Conflicting Fields,Final Classification,Precedence Reason',
      ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ST_Courier_Status_Reconciliation_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4. Other Status Details Diagnostics dataset
  const allOtherStatusDetails = useMemo<OtherStatusOrderDetail[]>(() => {
    const list: OtherStatusOrderDetail[] = [];
    courierPerformance.forEach(c => {
      const orders = c.otherOrders || [];
      orders.forEach(o => {
        list.push(getOtherStatusDetail(o));
      });
    });
    return list;
  }, [courierPerformance]);

  const couriersWithOtherStatuses = useMemo(() => {
    const counts = new Map<string, number>();
    allOtherStatusDetails.forEach(item => {
      counts.set(item.courier, (counts.get(item.courier) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [allOtherStatusDetails]);

  const availableOtherStatusesForFilter = useMemo(() => {
    let sourceList = allOtherStatusDetails;
    if (selectedOtherCourierFilter !== 'ALL') {
      sourceList = sourceList.filter(i => i.courier.toLowerCase() === selectedOtherCourierFilter.toLowerCase());
    }
    const counts = new Map<string, number>();
    sourceList.forEach(item => {
      counts.set(item.originalCarrierStatus, (counts.get(item.originalCarrierStatus) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [allOtherStatusDetails, selectedOtherCourierFilter]);

  const filteredOtherStatusOrders = useMemo(() => {
    let list = allOtherStatusDetails;

    // Filter by Courier
    if (selectedOtherCourierFilter !== 'ALL') {
      list = list.filter(i => i.courier.toLowerCase() === selectedOtherCourierFilter.toLowerCase());
    }

    // Filter by Original Carrier Status
    if (selectedOtherStatusFilter !== 'ALL') {
      list = list.filter(i => i.originalCarrierStatus === selectedOtherStatusFilter);
    }

    // Search query
    if (otherStatusSearch.trim()) {
      const q = otherStatusSearch.toLowerCase().trim();
      list = list.filter(i =>
        i.orderId.toLowerCase().includes(q) ||
        i.awbNumber.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        (i.city && i.city.toLowerCase().includes(q)) ||
        (i.state && i.state.toLowerCase().includes(q)) ||
        i.originalCarrierStatus.toLowerCase().includes(q) ||
        i.normalizedStatus.toLowerCase().includes(q) ||
        i.classificationReason.toLowerCase().includes(q) ||
        i.latestTrackingEvent.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allOtherStatusDetails, selectedOtherCourierFilter, selectedOtherStatusFilter, otherStatusSearch]);

  const handleExportOtherStatusCsv = () => {
    if (filteredOtherStatusOrders.length === 0) return;

    const rows = filteredOtherStatusOrders.map(item => {
      return [
        `"#${item.orderId}"`,
        `"${item.awbNumber}"`,
        `"${(item.customerName || '').replace(/"/g, '""')}"`,
        `"${item.courier}"`,
        `"${(item.city || '').replace(/"/g, '""')}"`,
        `"${(item.state || '').replace(/"/g, '""')}"`,
        `"${(item.originalCarrierStatus || '').replace(/"/g, '""')}"`,
        `"${item.normalizedStatus}"`,
        `"${item.orderDate}"`,
        `"${(item.latestTrackingEvent || '').replace(/"/g, '""')}"`,
        `"${(item.classificationReason || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = [
      'Order ID,AWB Number,Customer Name,Courier Partner,City,State,Original Carrier Status,Normalized Status,Order Date,Latest Tracking Event,Classification Reason',
      ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Other_Status_Details_${selectedOtherCourierFilter.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 5. Cancelled Orders Details dataset
  const allCancelledOrdersWithDetails = useMemo(() => {
    const list: Array<{
      orderId: string;
      customerName: string;
      city?: string;
      state?: string;
      awbNumber: string;
      orderDate: string;
      cancellationDate: string;
      courier: string;
      cancellationReason: string;
      dispatchStatus: string;
      orderAmount: number;
      order: WebsiteConsolidatedOrder;
    }> = [];

    courierPerformance.forEach(c => {
      const orders = c.cancelledOrders || [];
      orders.forEach(o => {
        const extra = o.extra_data || {};
        const rawId = o.order_id || (o as any).orderId || o.id || '';
        const orderId = String(rawId).replace(/^[#]/, '').trim();
        const customerName = o.customer_name || (o as any).customerName || 'Customer';
        const city = o.city || extra.city || '';
        const state = o.state || extra.state || '';
        const awbNumber = (o.awb_number || (o as any).awbNumber || extra.awb_number || extra.awb || '').trim() || '—';
        const orderDate = o.order_date || (o as any).orderDate || 'N/A';
        const courier = c.courier || (o.courier || extra.courier || 'Unknown');

        // Cancellation date if available from source
        const rawCancelDate = 
          o.cancellation?.cancelled_at || 
          o.cancellation?.requested_at || 
          extra.cancellation?.cancelled_at || 
          extra.cancellation?.requested_at || 
          extra.cancellation_date || 
          extra.cancellation_requested_at || 
          extra.cancelled_at;
        
        const cancellationDate = rawCancelDate ? formatSalesDateShort(rawCancelDate) : '—';

        // Cancellation reason if available from source (Strictly DO NOT INFER)
        const rawReason = 
          o.cancellation?.reason || 
          extra.cancellation?.reason || 
          extra.cancellation_reason || 
          (extra.current_status && String(extra.current_status).toLowerCase().includes('cancel') ? extra.current_status : null) || 
          (extra['Current Status'] && String(extra['Current Status']).toLowerCase().includes('cancel') ? extra['Current Status'] : null);
        
        const cancellationReason = (rawReason && typeof rawReason === 'string' && rawReason.trim()) ? rawReason.trim() : '—';
        const dispatchStatus = o.dispatch_status || extra.dispatch_status || 'Pre-Dispatch Cancelled';
        const orderAmount = Number(o.price || (o as any).amount || 0);

        list.push({
          orderId,
          customerName,
          city,
          state,
          awbNumber,
          orderDate,
          cancellationDate,
          courier,
          cancellationReason,
          dispatchStatus,
          orderAmount,
          order: o
        });
      });
    });

    return list;
  }, [courierPerformance]);

  const couriersWithCancelledOrders = useMemo(() => {
    const counts = new Map<string, number>();
    allCancelledOrdersWithDetails.forEach(item => {
      counts.set(item.courier, (counts.get(item.courier) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([courier, count]) => ({ courier, count }));
  }, [allCancelledOrdersWithDetails]);

  const filteredCancelledOrders = useMemo(() => {
    let list = allCancelledOrdersWithDetails;

    if (selectedCancelledCourierFilter !== 'ALL') {
      list = list.filter(i => i.courier.toLowerCase() === selectedCancelledCourierFilter.toLowerCase());
    }

    if (cancelledSearchQuery.trim()) {
      const q = cancelledSearchQuery.toLowerCase().trim();
      list = list.filter(i =>
        i.orderId.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        i.awbNumber.toLowerCase().includes(q) ||
        (i.city && i.city.toLowerCase().includes(q)) ||
        (i.state && i.state.toLowerCase().includes(q)) ||
        i.cancellationReason.toLowerCase().includes(q) ||
        i.courier.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allCancelledOrdersWithDetails, selectedCancelledCourierFilter, cancelledSearchQuery]);

  const handleExportCancelledOrdersCsv = () => {
    if (filteredCancelledOrders.length === 0) return;

    const rows = filteredCancelledOrders.map(item => {
      return [
        `"#${item.orderId}"`,
        `"${(item.customerName || '').replace(/"/g, '""')}"`,
        `"${item.awbNumber}"`,
        `"${item.orderDate}"`,
        `"${item.cancellationDate}"`,
        `"${item.courier}"`,
        `"${(item.city || '').replace(/"/g, '""')}"`,
        `"${(item.state || '').replace(/"/g, '""')}"`,
        `"${(item.cancellationReason || '').replace(/"/g, '""')}"`,
        `"${item.dispatchStatus}"`
      ].join(',');
    });

    const csvContent = [
      'Order ID,Customer Name,AWB Number,Order Date,Cancellation Date,Courier Partner,City,State,Cancellation Reason,Dispatch Status',
      ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Cancelled_Orders_${selectedCancelledCourierFilter.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
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
            onClick={() => setIsStDiagnosticModalOpen(true)}
            className="px-3 py-1.5 bg-sky-950/50 hover:bg-sky-900/60 text-sky-300 hover:text-white border border-sky-800/60 hover:border-sky-600 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Inspect ST Courier Status Reconciliation Diagnostics & 3-Tier Precedence"
          >
            <Activity size={13} className="text-sky-400" />
            <span>ST Courier Status Reconciliation ({stReconciliationItems.length})</span>
          </button>

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
          {totals.totalDeleted > 0 && (
            <button
              type="button"
              onClick={() => setOutcomeFilter('DELETED')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                outcomeFilter === 'DELETED'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <Trash2 size={12} />
              <span>Deleted ({totals.totalDeleted})</span>
            </button>
          )}
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
              {/* EXACT COLUMN 5: CANCELLED ORDERS */}
              <th
                onClick={() => handleSort('cancelled')}
                className="py-3 px-3 text-right cursor-pointer hover:text-rose-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Cancelled Orders</span>
                  <ArrowUpDown size={12} className={sortField === 'cancelled' ? 'text-rose-400' : 'text-slate-600'} />
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
              {/* EXACT COLUMN: OTHER STATUS DETAILS */}
              <th className="py-3 px-3 text-left">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  Other Status Details
                </span>
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
                  <td className="py-3 px-3 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto" /></td>
                  <td className="py-3 px-3 text-left"><div className="h-4 w-28 bg-slate-800 rounded" /></td>
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
                          onViewCourierOrders(row.courier, row.orders, 'DELIVERED');
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
                          onViewCourierOrders(row.courier, row.orders, 'RTO');
                        }}
                        className="hover:text-rose-300 hover:underline cursor-pointer"
                      >
                        {row.rto.toLocaleString('en-IN')}
                      </button>
                    </td>

                    {/* EXACT COLUMN 5: CANCELLED ORDERS */}
                    <td className="py-3 px-3 text-right font-bold font-mono">
                      {row.cancelled > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCancelledOrdersModal(row.courier);
                          }}
                          className="text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                          title={`Click to inspect ${row.cancelled} cancelled orders for ${row.courier}`}
                        >
                          {row.cancelled.toLocaleString('en-IN')}
                        </button>
                      ) : (
                        <span className="text-slate-600 font-mono text-xs">-</span>
                      )}
                    </td>

                    {/* In Transit */}
                    <td className="py-3 px-3 text-right text-blue-400">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewCourierOrders(row.courier, row.orders, 'IN_TRANSIT');
                        }}
                        className="hover:text-blue-300 hover:underline cursor-pointer"
                      >
                        {row.inTransit.toLocaleString('en-IN')}
                      </button>
                    </td>

                    {/* Other Statuses */}
                    <td className="py-3 px-3 text-right text-indigo-300 font-bold">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenOtherStatusModal(row.courier, 'ALL');
                        }}
                        className="hover:text-indigo-200 hover:underline cursor-pointer"
                        title={`Click to inspect all ${row.otherStatuses || 0} Other Status orders for ${row.courier}`}
                      >
                        {(row.otherStatuses || 0).toLocaleString('en-IN')}
                      </button>
                    </td>

                    {/* OTHER STATUS DETAILS */}
                    <td className="py-3 px-3 text-left">
                      {(() => {
                        const breakdown = row.otherStatusBreakdown || (() => {
                          const counts: Record<string, number> = {};
                          (row.otherOrders || []).forEach(o => {
                            const st = getOrderOriginalCarrierStatus(o);
                            counts[st] = (counts[st] || 0) + 1;
                          });
                          return counts;
                        })();
                        const entries = Object.entries(breakdown);
                        if (entries.length === 0) {
                          return <span className="text-slate-600 font-mono text-xs pl-2">-</span>;
                        }
                        return (
                          <div className="flex flex-col gap-1 items-start">
                            {entries.map(([statusName, count]) => (
                              <button
                                key={statusName}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenOtherStatusModal(row.courier, statusName);
                                }}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-950/60 hover:bg-indigo-900/90 text-indigo-300 hover:text-white border border-indigo-800/40 hover:border-indigo-600 transition-all cursor-pointer shadow-xs group/btn"
                                title={`Click to view ${count} orders with status '${statusName}'`}
                              >
                                <span className="truncate max-w-[140px] text-left">{statusName}</span>
                                <span className="font-bold font-mono px-1 py-0.2 rounded bg-indigo-900/80 group-hover/btn:bg-indigo-800 text-indigo-200 group-hover/btn:text-white text-[10px]">
                                  {count}
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
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
                      <div className="flex items-center justify-center gap-1.5">
                        {isStCourier && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsStDiagnosticModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-950/70 hover:bg-sky-900/80 text-sky-300 text-xs font-sans font-bold transition-all border border-sky-800/60 hover:border-sky-500/50 cursor-pointer"
                            title="Inspect ST Courier Status Reconciliation Diagnostic Details"
                          >
                            <Activity size={12} className="text-sky-400" />
                            <span>Diagnose</span>
                          </button>
                        )}
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
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-500 font-sans">
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
                {/* EXACT COLUMN 5: TOTAL CANCELLED ORDERS */}
                <td className="py-3 px-3 text-right font-bold font-mono text-rose-400">
                  {totals.totalCancelled > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleOpenCancelledOrdersModal('All Couriers')}
                      className="hover:text-rose-300 hover:underline cursor-pointer"
                      title="Click to inspect all cancelled orders across couriers"
                    >
                      {totals.totalCancelled.toLocaleString('en-IN')}
                    </button>
                  ) : (
                    <span className="text-slate-600 font-mono text-xs">-</span>
                  )}
                </td>
                <td className="py-3 px-3 text-right text-blue-400">
                  {totals.totalInTransit.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-3 text-right text-indigo-300">
                  {totals.totalOther.toLocaleString('en-IN')}
                </td>
                {/* OTHER STATUS DETAILS TOTAL */}
                <td className="py-3 px-3 text-left">
                  {totals.totalOther > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleOpenOtherStatusModal('All Couriers', 'ALL')}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-800/50 hover:border-indigo-600 transition-all cursor-pointer font-sans"
                      title="Inspect all Other Status records across couriers"
                    >
                      <Layers size={11} className="text-indigo-400" />
                      <span>{totals.totalOther} breakdown</span>
                    </button>
                  ) : (
                    <span className="text-slate-600 font-mono text-xs pl-2">-</span>
                  )}
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
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 bg-slate-950/40 border-b border-slate-800">
              {diagnosticAnalysis.categoryList.map(cat => {
                const isSelected = selectedDiagnosticKey === cat.key;
                const isDeletedCat = cat.key === 'DELETED_ORDERS';
                const isCancelledCat = cat.key === 'CANCELLED_PRIOR_DISPATCH';
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedDiagnosticKey(isSelected ? 'ALL' : cat.key)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? isDeletedCat 
                          ? 'bg-rose-950/40 border-rose-500/50 shadow-sm'
                          : 'bg-purple-600/20 border-purple-500/50 shadow-sm'
                        : isDeletedCat && cat.count > 0
                        ? 'bg-slate-900/90 border-rose-900/40 hover:border-rose-700/60'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 line-clamp-1">{cat.label}</span>
                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                        cat.count > 0 
                          ? isDeletedCat
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isCancelledCat
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-500'
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
                          const isCancelled = canonical === 'Cancelled' || o.order_status === 'CANCELLED' || Boolean(o.cancellation && (o.cancellation.status === 'CANCELLED' || String(o.cancellation.status).toLowerCase() === 'cancelled'));
                          const isDeleted = !isCancelled && (canonical === 'Deleted' || isDeletedOrder(o));
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
                                  isDeleted
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : isCancelled
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : canonical === 'Delivered'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-blue-500/20 text-blue-300'
                                }`}>
                                  {isDeleted ? 'DELETED' : isCancelled ? 'CANCELLED' : canonical}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-sans">
                                <div className="text-slate-300 font-semibold">{courier || 'Unassigned'}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{awb || 'No AWB'}</div>
                              </td>
                              <td className={`py-2.5 px-3 font-sans text-[11px] ${
                                isDeleted ? 'text-rose-300/90' : 'text-amber-300/90'
                              }`}>
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

      {/* 6. ST Courier Status Reconciliation Diagnostic Modal */}
      {isStDiagnosticModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                  <Activity size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">ST Courier Status Reconciliation Diagnostics</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                      3-Tier Precedence Engine
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Precedence: (1) BOT Verified Event &gt; (2) Carrier Current Status / stauts &gt; (3) Status Type fallback
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportStReconciliationCsv}
                  className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Download ST Courier Status Reconciliation as CSV"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsStDiagnosticModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStDiagnosticOutcomeFilter('ALL')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    stDiagnosticOutcomeFilter === 'ALL'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  All Records ({stReconciliationItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStDiagnosticOutcomeFilter('RTO')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    stDiagnosticOutcomeFilter === 'RTO'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  RTO ({stReconciliationItems.filter(i => i.canonical.includes('RTO')).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStDiagnosticOutcomeFilter('CANCELLED')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    stDiagnosticOutcomeFilter === 'CANCELLED'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Cancelled ({stReconciliationItems.filter(i => i.canonical === 'Cancelled').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStDiagnosticOutcomeFilter('DELIVERED')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    stDiagnosticOutcomeFilter === 'DELIVERED'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Delivered ({stReconciliationItems.filter(i => i.canonical === 'Delivered').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStDiagnosticOutcomeFilter('CONFLICT')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    stDiagnosticOutcomeFilter === 'CONFLICT'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Conflicting Fields ({stReconciliationItems.filter(i => i.isConflict).length})
                </button>
              </div>

              <div className="relative min-w-[240px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search order ID, AWB, customer..."
                  value={stDiagnosticSearch}
                  onChange={e => setStDiagnosticSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto p-4">
              {(() => {
                let displayed = stReconciliationItems;
                if (stDiagnosticOutcomeFilter === 'RTO') {
                  displayed = displayed.filter(i => i.canonical.includes('RTO'));
                } else if (stDiagnosticOutcomeFilter === 'CANCELLED') {
                  displayed = displayed.filter(i => i.canonical === 'Cancelled');
                } else if (stDiagnosticOutcomeFilter === 'DELIVERED') {
                  displayed = displayed.filter(i => i.canonical === 'Delivered');
                } else if (stDiagnosticOutcomeFilter === 'CONFLICT') {
                  displayed = displayed.filter(i => i.isConflict);
                }

                if (stDiagnosticSearch.trim()) {
                  const q = stDiagnosticSearch.toLowerCase().trim();
                  displayed = displayed.filter(i =>
                    String(i.orderId).toLowerCase().includes(q) ||
                    String(i.awb).toLowerCase().includes(q) ||
                    String(i.customerName).toLowerCase().includes(q) ||
                    String(i.currentStatus).toLowerCase().includes(q) ||
                    String(i.statusType).toLowerCase().includes(q)
                  );
                }

                if (displayed.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No records match the selected diagnostic criteria.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-2.5 px-3">Order ID</th>
                          <th className="py-2.5 px-3">AWB No</th>
                          <th className="py-2.5 px-3">Source</th>
                          <th className="py-2.5 px-3">Status Type</th>
                          <th className="py-2.5 px-3">Current Status</th>
                          <th className="py-2.5 px-3">BOT Event</th>
                          <th className="py-2.5 px-3">Conflicting Fields</th>
                          <th className="py-2.5 px-3 text-center">Final Classification</th>
                          <th className="py-2.5 px-3">Precedence Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {displayed.slice(0, 150).map(item => {
                          const isRto = item.canonical.includes('RTO');
                          const isDeliv = item.canonical === 'Delivered';
                          const isCanc = item.canonical === 'Cancelled';

                          return (
                            <tr key={item.orderId} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-white">#{item.orderId}</td>
                              <td className="py-2.5 px-3 text-slate-300">{item.awb}</td>
                              <td className="py-2.5 px-3 font-sans text-[10px] text-slate-400">{item.source}</td>
                              <td className="py-2.5 px-3 font-sans">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  item.statusType.toLowerCase().includes('deliv')
                                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                                    : (item.statusType.toLowerCase().includes('un delivered')
                                      ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                                      : 'bg-slate-800 text-slate-300')
                                }`}>
                                  {item.statusType}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-sans">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  item.currentStatus.toLowerCase().includes('return') || item.currentStatus.toLowerCase().includes('rto')
                                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40 font-bold'
                                    : (item.currentStatus.toLowerCase().includes('cancel')
                                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                      : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40')
                                }`}>
                                  {item.currentStatus}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-sans text-[10px] text-slate-300 max-w-[160px] truncate" title={item.latestBotEvent}>
                                {item.latestBotEvent}
                              </td>
                              <td className="py-2.5 px-3 font-sans text-[10px]">
                                {item.isConflict ? (
                                  <span className="text-amber-300 font-semibold">{item.conflict}</span>
                                ) : (
                                  <span className="text-slate-500">None</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isRto
                                    ? 'bg-rose-950/90 text-rose-300 border border-rose-600/50'
                                    : (isCanc
                                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                      : (isDeliv
                                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-600/40'
                                        : 'bg-blue-950/60 text-blue-400 border border-blue-600/40'))
                                }`}>
                                  {item.canonical}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-sans text-[10px] text-slate-300">
                                {item.reason}
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
                Showing {stReconciliationItems.length} ST Courier records reconciled according to 3-tier precedence rules.
              </span>
              <button
                type="button"
                onClick={() => setIsStDiagnosticModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Other Status Details & Root Cause Investigation Modal */}
      {isOtherStatusModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <Layers size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Other Status Details & Root Cause Investigation
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                      {allOtherStatusDetails.length} {allOtherStatusDetails.length === 1 ? 'Order' : 'Orders'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Individual database shipment records with un-normalized carrier statuses, held shipments, or pending tracking updates
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportOtherStatusCsv}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Export filtered records to CSV"
                >
                  <Download size={13} className="text-indigo-400" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOtherStatusModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Controls: Filters & Search */}
            <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-3">
              {/* Courier Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                  <Truck size={12} className="text-indigo-400" />
                  Courier:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOtherCourierFilter('ALL');
                    setSelectedOtherStatusFilter('ALL');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedOtherCourierFilter === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800/70 text-slate-400 hover:text-indigo-300 border border-slate-700/60'
                  }`}
                >
                  <span>All Couriers ({allOtherStatusDetails.length})</span>
                </button>
                {couriersWithOtherStatuses.map(c => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setSelectedOtherCourierFilter(c.name);
                      setSelectedOtherStatusFilter('ALL');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedOtherCourierFilter.toLowerCase() === c.name.toLowerCase()
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/70 text-slate-400 hover:text-indigo-300 border border-slate-700/60'
                    }`}
                  >
                    <span>{c.name} ({c.count})</span>
                  </button>
                ))}
              </div>

              {/* Status Filter Pills & Search Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                {/* Status Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                    <Filter size={12} className="text-indigo-400" />
                    Status:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedOtherStatusFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedOtherStatusFilter === 'ALL'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-800/60 text-slate-400 hover:text-purple-300 border border-slate-800'
                    }`}
                  >
                    All Statuses
                  </button>
                  {availableOtherStatusesForFilter.map(s => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setSelectedOtherStatusFilter(s.name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedOtherStatusFilter === s.name
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-slate-800/60 text-slate-400 hover:text-purple-300 border border-slate-800'
                      }`}
                    >
                      <span className="truncate max-w-[160px]">{s.name}</span>
                      <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-900/80 text-purple-200">
                        {s.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[260px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search Order ID, AWB, Customer, Status, Reason..."
                    value={otherStatusSearch}
                    onChange={e => setOtherStatusSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {otherStatusSearch && (
                    <button
                      type="button"
                      onClick={() => setOtherStatusSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Informative Callout Banner for ST Courier */}
              {(selectedOtherCourierFilter === 'ST Courier' || (selectedOtherCourierFilter === 'ALL' && filteredOtherStatusOrders.some(o => o.courier === 'ST Courier'))) && (
                <div className="bg-sky-950/30 border border-sky-800/40 rounded-xl p-3 flex items-start gap-2.5">
                  <div className="p-1 rounded-lg bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
                    <Info size={14} />
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-0.5">
                    <span className="font-bold text-sky-200 block">
                      ST Courier Investigation — 4 Active Orders Classified as Other:
                    </span>
                    <span className="text-slate-400 leading-relaxed block">
                      Orders <strong className="text-white font-mono">#11491</strong> (AWB: 1244563456), <strong className="text-white font-mono">#10918</strong> (AWB: 14534544), <strong className="text-white font-mono">#10919</strong> (AWB: 145345634), and <strong className="text-white font-mono">#10916</strong> (AWB: 15534544) were booked in dispatch with manual waybills (8 to 10 digits instead of standard 11 digits starting with 582...). Because these AWBs were never present in uploaded carrier consignment manifests and have no terminal delivery or RTO scan, they legitimately remain in <strong className="text-indigo-300">Other Statuses (Awaiting Tracking Update)</strong> and are not converted to Delivered or RTO.
                    </span>
                  </div>
                </div>
              )}

              {/* Informative Callout Banner for Delhivery */}
              {(selectedOtherCourierFilter === 'Delhivery' || (selectedOtherCourierFilter === 'ALL' && filteredOtherStatusOrders.some(o => o.courier === 'Delhivery'))) && (
                <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-xl p-3 flex items-start gap-2.5">
                  <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
                    <Info size={14} />
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-0.5">
                    <span className="font-bold text-cyan-200 block">
                      Delhivery Investigation — 6 Active Shipments Held in Transit:
                    </span>
                    <span className="text-slate-400 leading-relaxed block">
                      3 shipments have carrier remarks <strong className="text-rose-300">"Shipment damaged"</strong> at Erode hub (#11325, #11366, #11560), 2 shipments have <strong className="text-amber-300">"Package found in Audit"</strong> (#11839, #11936), and 1 shipment has <strong className="text-blue-300">"Consignee Unavailable"</strong> (#11926). None of these orders have reached a terminal Delivered or RTO state.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
              {filteredOtherStatusOrders.length > 0 ? (
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-3">Order ID</th>
                        <th className="py-3 px-3">AWB Number</th>
                        <th className="py-3 px-3">Customer Name</th>
                        <th className="py-3 px-3">Courier Partner</th>
                        <th className="py-3 px-3 text-center">Original Carrier Status</th>
                        <th className="py-3 px-3 text-center">Normalized Status</th>
                        <th className="py-3 px-3 text-center">Order Date</th>
                        <th className="py-3 px-3">Latest Tracking Event</th>
                        <th className="py-3 px-4">Classification Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {filteredOtherStatusOrders.map((item) => {
                        const isSt = item.courier === 'ST Courier';
                        const isDeliv = item.courier === 'Delhivery';
                        const isDamaged = item.originalCarrierStatus.toLowerCase().includes('damaged');
                        const isAudit = item.originalCarrierStatus.toLowerCase().includes('audit');
                        const isAwaiting = item.originalCarrierStatus.toLowerCase().includes('awaiting');

                        return (
                          <tr
                            key={item.orderId}
                            className="hover:bg-slate-800/40 transition-colors group"
                          >
                            {/* Order ID */}
                            <td className="py-2.5 px-3 font-sans font-bold text-white">
                              <button
                                type="button"
                                onClick={() => setInspectedOrderForModal(item.order)}
                                className="text-indigo-300 hover:text-indigo-200 hover:underline cursor-pointer flex items-center gap-1 font-mono"
                                title="Click to view full order details"
                              >
                                <span>#{item.orderId}</span>
                              </button>
                            </td>

                            {/* AWB Number */}
                            <td className="py-2.5 px-3 text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-200">{item.awbNumber}</span>
                                {isSt && item.awbNumber.replace(/[^0-9]/g, '').length !== 11 && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 font-sans" title="Non-standard waybill length">
                                    {item.awbNumber.replace(/[^0-9]/g, '').length} digits
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Customer Name & Location */}
                            <td className="py-2.5 px-3 font-sans text-slate-300">
                              <div className="font-medium text-white">{item.customerName}</div>
                              {(item.city || item.state) && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                                  {[item.city, item.state].filter(Boolean).join(', ')}
                                </div>
                              )}
                            </td>

                            {/* Courier Partner */}
                            <td className="py-2.5 px-3 font-sans">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  isSt ? 'bg-sky-400' : (isDeliv ? 'bg-cyan-400' : 'bg-indigo-400')
                                }`} />
                                <span className="font-semibold text-slate-200">{item.courier}</span>
                              </div>
                            </td>

                            {/* Original Carrier Status */}
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isDamaged
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-600/50'
                                  : (isAudit
                                    ? 'bg-amber-950/80 text-amber-300 border border-amber-600/50'
                                    : (isAwaiting
                                      ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-600/50'
                                      : 'bg-slate-800 text-slate-300 border border-slate-700'))
                              }`}>
                                {item.originalCarrierStatus}
                              </span>
                            </td>

                            {/* Normalized Status */}
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/60 text-purple-300 border border-purple-600/40">
                                {item.normalizedStatus}
                              </span>
                            </td>

                            {/* Order Date */}
                            <td className="py-2.5 px-3 text-center text-slate-400 text-[11px]">
                              {item.orderDate}
                            </td>

                            {/* Latest Tracking Event */}
                            <td className="py-2.5 px-3 font-sans text-[11px] text-slate-300">
                              <span className="line-clamp-2" title={item.latestTrackingEvent}>
                                {item.latestTrackingEvent}
                              </span>
                            </td>

                            {/* Classification Reason */}
                            <td className="py-2.5 px-4 font-sans text-[11px] text-slate-400">
                              <span className="line-clamp-2" title={item.classificationReason}>
                                {item.classificationReason}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 font-sans space-y-2">
                  <Layers size={32} className="mx-auto text-slate-600 opacity-60" />
                  <p className="text-sm">No other status records found matching your current filter.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing {filteredOtherStatusOrders.length} of {allOtherStatusDetails.length} total Other Status records across couriers.
              </span>
              <button
                type="button"
                onClick={() => setIsOtherStatusModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Dedicated Cancelled Orders Modal */}
      {isCancelledOrdersModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                  <Ban size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Cancelled Orders Details</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                      {filteredCancelledOrders.length} records
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Pre-dispatch cancellations and return requests tracked across logistics courier manifests
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCancelledOrdersCsv}
                  className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Download Cancelled Orders as CSV"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCancelledOrdersModalOpen(false)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                  title="Close Dialog"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Subheader: Filter Pills & Search */}
            <div className="p-3 bg-slate-950/60 border-b border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Courier Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                    Courier:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCancelledCourierFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      selectedCancelledCourierFilter === 'ALL'
                        ? 'bg-rose-600 text-white font-bold shadow-xs'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    All Couriers ({allCancelledOrdersWithDetails.length})
                  </button>
                  {couriersWithCancelledOrders.map(({ courier, count }) => (
                    <button
                      key={courier}
                      type="button"
                      onClick={() => setSelectedCancelledCourierFilter(courier)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedCancelledCourierFilter.toLowerCase() === courier.toLowerCase()
                          ? 'bg-rose-600 text-white font-bold shadow-xs'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span>{courier}</span>
                      <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-black/30">
                        {count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[240px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Order ID, Customer, AWB, Reason..."
                    value={cancelledSearchQuery}
                    onChange={(e) => setCancelledSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                  />
                  {cancelledSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCancelledSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4">
              {filteredCancelledOrders.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Order ID</th>
                        <th className="py-2.5 px-3">Customer Name</th>
                        <th className="py-2.5 px-3">AWB Number</th>
                        <th className="py-2.5 px-3 text-center">Order Date</th>
                        <th className="py-2.5 px-3 text-center">Cancellation Date</th>
                        <th className="py-2.5 px-3">Courier Partner</th>
                        <th className="py-2.5 px-3">Cancellation Reason</th>
                        <th className="py-2.5 px-3 text-center">Dispatch Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {filteredCancelledOrders.map((item) => {
                        const isSt = item.courier.toLowerCase().includes('st');
                        const isDeliv = item.courier.toLowerCase().includes('delhivery');
                        const isAmz = item.courier.toLowerCase().includes('amazon');

                        return (
                          <tr
                            key={item.orderId}
                            className="hover:bg-slate-800/40 transition-colors"
                          >
                            {/* Order ID */}
                            <td className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={() => setInspectedOrderForModal(item.order)}
                                className="font-bold text-rose-400 hover:text-rose-300 hover:underline cursor-pointer flex items-center gap-1"
                                title="Click to view complete order record"
                              >
                                #{item.orderId}
                              </button>
                            </td>

                            {/* Customer Name & Location */}
                            <td className="py-2.5 px-3 font-sans text-slate-300">
                              <div className="font-medium text-white">{item.customerName}</div>
                              {(item.city || item.state) && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                                  {[item.city, item.state].filter(Boolean).join(', ')}
                                </div>
                              )}
                            </td>

                            {/* AWB Number */}
                            <td className="py-2.5 px-3 text-slate-300">
                              <span className="font-mono text-slate-200">{item.awbNumber}</span>
                            </td>

                            {/* Order Date */}
                            <td className="py-2.5 px-3 text-center text-slate-400 text-[11px]">
                              {item.orderDate}
                            </td>

                            {/* Cancellation Date */}
                            <td className="py-2.5 px-3 text-center text-slate-300 text-[11px]">
                              {item.cancellationDate}
                            </td>

                            {/* Courier Partner */}
                            <td className="py-2.5 px-3 font-sans">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  isSt ? 'bg-sky-400' : (isDeliv ? 'bg-cyan-400' : (isAmz ? 'bg-amber-400' : 'bg-rose-400'))
                                }`} />
                                <span className="font-semibold text-slate-200">{item.courier}</span>
                              </div>
                            </td>

                            {/* Cancellation Reason */}
                            <td className="py-2.5 px-3 font-sans text-[11px] text-slate-300">
                              <span className="line-clamp-2" title={item.cancellationReason}>
                                {item.cancellationReason}
                              </span>
                            </td>

                            {/* Dispatch Status */}
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-600/40 font-sans">
                                {item.dispatchStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 font-sans space-y-2">
                  <Ban size={32} className="mx-auto text-slate-600 opacity-60" />
                  <p className="text-sm">No cancelled order records found matching your current filter.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-sans">
              <span>
                Showing {filteredCancelledOrders.length} of {allCancelledOrdersWithDetails.length} total Cancelled orders across couriers.
              </span>
              <button
                type="button"
                onClick={() => setIsCancelledOrdersModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Nested Full Order Details Modal */}
      {inspectedOrderForModal && (
        <OrderDetailsModal
          order={inspectedOrderForModal}
          onClose={() => setInspectedOrderForModal(null)}
        />
      )}
    </div>
  );
};
