import React, { useState, useRef, useEffect, useMemo } from 'react';
import db from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import * as XLSX from 'xlsx';
import { Search, UploadCloud, Eye, Trash2, Package, X, HelpCircle, Truck, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { TrackingModal } from './TrackingModal';
import type { LogisticsOrder } from '../../types/logistics';
import { getBestCourierRecommendation } from '../../services/deliveryRecommendationService';
import { normalizePincode } from '../../utils/pincodeUtils';
import { recommendationRefreshManager } from '../../services/recommendationRefreshManager';
import { detectCourier } from '../../utils/courierDetector';
import { isCourierActive, ACTIVE_COURIERS } from '../../config/courierConfig';
import { normalizeState } from '../../utils/analyticsCalculations';

export const OrderData: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<LogisticsOrder | null>(null);
  const [trackOrder, setTrackOrder] = useState<LogisticsOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [recOrder, setRecOrder] = useState<LogisticsOrder | null>(null);
  const [recommendationDetail, setRecommendationDetail] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(recommendationRefreshManager.isRefreshing());

  useEffect(() => {
    const unsubscribe = recommendationRefreshManager.subscribe((refreshing) => {
      setIsRefreshing(refreshing);
    });
    return unsubscribe;
  }, []);

  const handleViewRecommendation = async (order: LogisticsOrder) => {
    setRecOrder(order);
    const detail = await getBestCourierRecommendation(normalizePincode(order.pincode) || '', order.state || '');
    setRecommendationDetail(detail);
  };
  const shipmentFileInputRef = useRef<HTMLInputElement>(null);

  const [isTrackAllModalOpen, setIsTrackAllModalOpen] = useState(false);
  const [isBulkTracking, setIsBulkTracking] = useState(false);
  const [bulkTrackingCompleted, setBulkTrackingCompleted] = useState(0);
  const [bulkTrackingTotal, setBulkTrackingTotal] = useState(0);
  const [bulkProgress, setBulkProgress] = useState<{
    completed: number;
    total: number;
    checking: number;
    queued: number;
    success: number;
    failed: number;
    phase: 'first-pass' | 'retrying' | 'complete';
    retryCount?: number;
  } | null>(null);

  // Load all active order data items (stage is not 'trash')
  const orders = useLiveQuery(
    () => db.logistics_orders.where('stage').notEqual('trash').reverse().toArray(),
    []
  ) ?? [];

  const normalizeOrderId = (val: any): string => {
    if (val === undefined || val === null) return '';
    let str = String(val).trim();
    if (str.startsWith('#')) {
      str = str.slice(1).trim();
    }
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      str = str.slice(1, -1).trim();
    }
    if (str.startsWith('#')) {
      str = str.slice(1).trim();
    }
    return str;
  };

  const getOrderTrackingStatus = (ord: LogisticsOrder): string => {
    if (ord.stage === 'order_data') {
      return 'Not Tracked';
    }

    let statusText = (ord.status || '').trim();
    if (statusText === '') {
      return 'Pending';
    }
    const s = statusText.toLowerCase();
    
    // Priority ordered check
    if (s.includes('rto') || s.includes('returned')) {
      return 'RTO';
    }
    if (s.includes('delivered')) {
      return 'Delivered';
    }
    if (s.includes('out for delivery') || s.includes('out_for_delivery')) {
      return 'Out for Delivery';
    }
    if (
      s.includes('transit') ||
      s.includes('processed') ||
      s.includes('forwarded')
    ) {
      return 'In Transit';
    }
    if (
      s.includes('booked') ||
      s.includes('info received') ||
      s.includes('manifest')
    ) {
      return 'Info Received';
    }
    if (s.includes('pending')) {
      return 'Pending';
    }
    if (
      s.includes('exception') || 
      s.includes('error') || 
      s.includes('unable to fetch') || 
      s.includes('unknown')
    ) {
      return 'Exception';
    }
    if (s.includes('failed') || ord.trackingError) {
      return 'Sync Failed';
    }
    return statusText || 'Not Tracked';
  };

  // Helper: Parse date to raw, display (DD MMM YY), and tooltip (12-hour IST format)
  const parseShopifyDate = (val: any) => {
    if (!val) return { raw: '', display: '', tooltip: '' };
    let dateObj: Date | null = null;
    const rawStr = String(val).trim();

    // 1. Check if it's a number (Excel serial date)
    if (typeof val === 'number') {
      if (val > 35000 && val < 60000) {
        dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
      }
    }

    // 2. Parse Shopify date string format e.g. "2026-06-29 17:16:54 +0530"
    if (!dateObj) {
      let formattedStr = rawStr;
      const tzMatch = rawStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})$/);
      if (tzMatch) {
        const datePart = tzMatch[1];
        const timePart = tzMatch[2];
        const tzPart = tzMatch[3];
        const tzFormatted = tzPart.slice(0, 3) + ':' + tzPart.slice(3);
        formattedStr = `${datePart}T${timePart}${tzFormatted}`;
      }

      try {
        const parsedMs = Date.parse(formattedStr);
        if (!isNaN(parsedMs)) {
          dateObj = new Date(parsedMs);
        }
      } catch (e) {}
    }

    // 3. Fallback to native constructor
    if (!dateObj) {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          dateObj = d;
        }
      } catch (e) {}
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return { raw: rawStr, display: rawStr, tooltip: rawStr };
    }

    // Format display as "DD MMM YY" (e.g. "29 Jun 26")
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = monthNames[dateObj.getMonth()];
    const year = String(dateObj.getFullYear()).slice(-2);
    const display = `${day} ${month} ${year}`;

    // Format tooltip as "29 Jun 2026, 05:16:54 PM IST"
    const fullYear = dateObj.getFullYear();
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedHours = String(hours).padStart(2, '0');
    const tooltip = `${day} ${month} ${fullYear}, ${formattedHours}:${minutes}:${seconds} ${ampm} IST`;

    return {
      raw: rawStr,
      display,
      tooltip
    };
  };

  // Helper: Get epoch milliseconds for chronological sorting
  const getEpochTime = (val: string): number => {
    if (!val) return 0;
    try {
      const tzMatch = val.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})$/);
      if (tzMatch) {
        const datePart = tzMatch[1];
        const timePart = tzMatch[2];
        const tzPart = tzMatch[3];
        const tzFormatted = tzPart.slice(0, 3) + ':' + tzPart.slice(3);
        const parsedMs = Date.parse(`${datePart}T${timePart}${tzFormatted}`);
        if (!isNaN(parsedMs)) return parsedMs;
      }
      const d = Date.parse(val);
      if (!isNaN(d)) return d;
    } catch (e) {}
    return 0;
  };

  const handleShipmentImport = async (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCsv = file.name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      toast.error('Invalid file format. Please upload an Excel (.xlsx/.xls) or CSV (.csv) file.');
      return;
    }

    const loadToast = toast.loading(`Parsing ${file.name}...`);
    try {
      try {
        await db.open();
      } catch (openErr: any) {
        console.error('Dexie database open/upgrade failed:', openErr);
        throw new Error(`Database initialization/migration failed: ${openErr.message || String(openErr)}`);
      }

      const parsedData = await new Promise<any[]>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const parsed = XLSX.utils.sheet_to_json(sheet) as any[];
            resolve(parsed);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('File reading failed.'));
        reader.readAsBinaryString(file);
      });

      if (parsedData.length === 0) {
        throw new Error('The uploaded file is empty.');
      }

      const headers = Object.keys(parsedData[0]);
      if (!headers.includes('Order') || !headers.includes('Tracking number')) {
        throw new Error('Required columns ("Order" and "Tracking number") not found.');
      }

      let stCourierCount = 0;
      let existingUpdated = 0;
      let duplicatesSkipped = 0;
      let nonStBlankIgnored = 0;
      let conflictsCount = 0;

      const allDbOrders = await db.logistics_orders.toArray();
      const dbOrderMapByOrderId = new Map<string, typeof allDbOrders[0]>();
      allDbOrders.forEach(o => {
        if (o.stage !== 'trash') {
          dbOrderMapByOrderId.set(normalizeOrderId(o.orderId), o);
        }
      });

      await db.transaction('rw', [db.logistics_orders, db.delivery_history], async () => {
        for (const row of parsedData) {
          const rawId = row['Order'];
          const rawAwb = row['Tracking number'];
          const rawCarrier = row['Carrier'] || row['Last mile carrier'];
          const rawStatus = row['Status'];
          const rawSubStatus = row['Sub-status'];
          const rawLastEvent = row['Last event'];
          const rawOrderDate = row['Order date'];

          let awbNumber = '';
          if (rawAwb !== undefined && rawAwb !== null) {
            awbNumber = String(rawAwb)
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
              .replace(/^\s+|\s+$/g, '')
              .trim();
            if ((awbNumber.startsWith('"') && awbNumber.endsWith('"')) || (awbNumber.startsWith("'") && awbNumber.endsWith("'"))) {
              awbNumber = awbNumber.slice(1, -1).trim();
            }
          }

          const orderId = normalizeOrderId(rawId);
          const carrierStr = String(rawCarrier || '').trim().toLowerCase();
          const matchedActiveCourier = ACTIVE_COURIERS.find(c => c.toLowerCase() === carrierStr);

          if (!matchedActiveCourier || !awbNumber || !orderId) {
            nonStBlankIgnored++;
            continue;
          }

          stCourierCount++;

          const existingOrder = dbOrderMapByOrderId.get(orderId);

          // Resolve state priority:
          // 1. Existing Order Data state already saved for same normalized Order ID
          // 2. Existing historical/order record state if available in delivery_history
          // 3. Imported shipment record state if present
          // 4. Otherwise mark internally as Unknown
          let resolvedState = 'Unknown';
          let pincode = '';
          
          if (existingOrder && existingOrder.state && existingOrder.state.toLowerCase() !== 'unknown') {
            resolvedState = normalizeState(existingOrder.state, rawLastEvent);
            pincode = existingOrder.pincode || '';
          } else {
            const hist = await db.delivery_history.where('orderNo').equals(orderId).first();
            if (hist && hist.state) {
              resolvedState = normalizeState(hist.state, rawLastEvent);
              pincode = hist.pincode || '';
            } else {
              const rowState = row['State'] || row['state'] || row['Customer State'] || row['customer state'];
              resolvedState = normalizeState(rowState || '', rawLastEvent);
            }
          }

          if (existingOrder) {
            const existingAwb = (existingOrder.awbNumber || '').trim();
            if (existingAwb === awbNumber) {
              await db.logistics_orders.update(existingOrder.id!, {
                state: resolvedState,
                pincode: pincode || existingOrder.pincode,
                sourceStatus: rawStatus ? String(rawStatus).trim() : existingOrder.sourceStatus,
                sourceSubStatus: rawSubStatus ? String(rawSubStatus).trim() : existingOrder.sourceSubStatus,
                lastEvent: rawLastEvent ? String(rawLastEvent).trim() : existingOrder.lastEvent,
                lastMileCourier: row['Last mile carrier'] ? String(row['Last mile carrier']).trim() : existingOrder.lastMileCourier,
                orderDate: rawOrderDate ? String(rawOrderDate).trim() : existingOrder.orderDate
              });
              duplicatesSkipped++;
            } else if (existingAwb === '') {
              await db.logistics_orders.update(existingOrder.id!, {
                awbNumber,
                courier: matchedActiveCourier,
                state: resolvedState,
                pincode: pincode || existingOrder.pincode,
                sourceStatus: rawStatus ? String(rawStatus).trim() : undefined,
                sourceSubStatus: rawSubStatus ? String(rawSubStatus).trim() : undefined,
                lastEvent: rawLastEvent ? String(rawLastEvent).trim() : undefined,
                lastMileCourier: row['Last mile carrier'] ? String(row['Last mile carrier']).trim() : undefined,
                orderDate: rawOrderDate ? String(rawOrderDate).trim() : existingOrder.orderDate,
                syncedAt: new Date().toLocaleString()
              });
              existingUpdated++;
            } else {
              conflictsCount++;
            }
          } else {
            await db.logistics_orders.add({
              orderId,
              awbNumber,
              courier: matchedActiveCourier,
              sourceStatus: rawStatus ? String(rawStatus).trim() : undefined,
              sourceSubStatus: rawSubStatus ? String(rawSubStatus).trim() : undefined,
              lastEvent: rawLastEvent ? String(rawLastEvent).trim() : undefined,
              lastMileCourier: row['Last mile carrier'] ? String(row['Last mile carrier']).trim() : undefined,
              orderDate: rawOrderDate ? String(rawOrderDate).trim() : undefined,
              customerName: `Order #${orderId}`,
              phoneNumber: '',
              orderType: 'Unknown',
              amount: '0',
              products: 'ST Shipment',
              stage: 'order_data',
              uploadedAt: new Date().toLocaleString(),
              status: 'Not Tracked',
              state: resolvedState,
              pincode
            });
          }
        }
      });

      toast.dismiss(loadToast);
      toast.success('Shipment file imported successfully.');

      toast.custom((t) => (
        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex flex-col gap-2.5 text-xs text-slate-300 font-semibold shadow-2xl animate-in slide-in-from-bottom duration-300 w-80 animate-in fade-in duration-200">
          <div className="text-white font-bold text-sm border-b border-slate-700/60 pb-1.5 flex items-center gap-2">
            <Package className="text-primary" size={16} /> Import Summary
          </div>
          <div className="grid grid-cols-2 gap-y-1">
            <span className="text-slate-400">ST Courier shipments:</span>
            <span className="text-white text-right font-mono font-bold">{stCourierCount}</span>

            <span className="text-slate-400">Existing updated:</span>
            <span className="text-emerald-400 text-right font-mono font-bold">{existingUpdated}</span>
            
            <span className="text-slate-400">Duplicates skipped:</span>
            <span className="text-slate-400 text-right font-mono font-bold">{duplicatesSkipped}</span>

            {conflictsCount > 0 && (
              <>
                <span className="text-slate-400">Conflicts skipped:</span>
                <span className="text-red-400 text-right font-mono font-bold">{conflictsCount}</span>
              </>
            )}

            <span className="text-slate-400">Non-ST/blank ignored:</span>
            <span className="text-amber-400 text-right font-mono font-bold">{nonStBlankIgnored}</span>
          </div>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            className="w-full mt-2 py-1.5 bg-slate-750 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ), { duration: 8000 });

    } catch (err: any) {
      toast.dismiss(loadToast);
      toast.error(`Import failed: ${err.message || String(err)}`);
    }
  };

  const startTrackAllProcess = async () => {
    setIsTrackAllModalOpen(false);
    setIsBulkTracking(true);
    setBulkTrackingTotal(trackAllStats.eligible);
    setBulkTrackingCompleted(0);

    const total = trackAllStats.eligible;
    const ordersToTrack = [...trackAllStats.toTrackOrders];

    const progressToastId = 'track-all-progress-toast';
    toast.loading(
      `ST Courier Bulk Tracking\n\nCompleted: 0 / ${total}\nChecking: 0\nQueued: ${total}\nSuccessful: 0\nFailed: 0`,
      { id: progressToastId }
    );

    const { trackingEngine } = await import('../../services/tracking/trackingEngine');

    try {
      const res = await trackingEngine.syncBulkOptimized(ordersToTrack, (stats) => {
        setBulkTrackingCompleted(stats.completed);
        setBulkProgress(stats);

        if (stats.phase === 'first-pass') {
          toast.loading(
            `ST Courier Bulk Tracking\n\nCompleted: ${stats.completed} / ${stats.total}\nChecking: ${stats.checking}\nQueued: ${stats.queued}\nSuccessful: ${stats.success}\nFailed: ${stats.failed}`,
            { id: progressToastId }
          );
        } else if (stats.phase === 'retrying') {
          toast.loading(
            `ST Courier Bulk Tracking (Retrying Failed Shipments...)\n\nCompleted: ${stats.completed} / ${stats.total}\nChecking: ${stats.checking}\nQueued: ${stats.queued}\nSuccessful: ${stats.success}\nFailed: ${stats.failed}`,
            { id: progressToastId }
          );
        }
      });

      toast.dismiss(progressToastId);
      toast.success('Tracking completed.');

      toast.custom((t) => (
        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex flex-col gap-2.5 text-xs text-slate-300 font-semibold shadow-2xl animate-in slide-in-from-bottom duration-300 w-80 animate-in fade-in duration-200">
          <div className="text-white font-bold text-sm border-b border-slate-700/60 pb-1.5 flex items-center gap-2">
            <Truck className="text-primary" size={16} /> Tracking Complete
          </div>
          <div className="grid grid-cols-2 gap-y-1">
            <span className="text-slate-400">Successful:</span>
            <span className="text-emerald-400 text-right font-mono font-bold">{res.success}</span>

            <span className="text-slate-400">Failed:</span>
            <span className="text-red-400 text-right font-mono font-bold">{res.failed}</span>

            <span className="text-slate-400">Total:</span>
            <span className="text-white text-right font-mono font-bold">{total}</span>
          </div>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            className="w-full mt-2 py-1.5 bg-slate-750 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ), { duration: 8000 });

    } catch (err) {
      toast.error('Bulk tracking failed.');
    } finally {
      setIsBulkTracking(false);
      setBulkProgress(null);
    }
  };

  const trackAllStats = useMemo(() => {
    let eligible = 0;
    let newTracking = 0;
    let alreadyTracked = 0;
    let invalidSkipped = 0;
    const toTrackOrders: typeof orders = [];

    orders.forEach(o => {
      const isStCourier = isCourierActive(o.courier);
      const hasAwb = o.awbNumber && o.awbNumber.trim() !== '';

      if (isStCourier && hasAwb) {
        const statusLower = (o.status || '').toLowerCase().trim();
        const isDelivered = statusLower.includes('delivered');
        const isRto = statusLower.includes('rto') || statusLower.includes('returned') || statusLower.includes('return to origin');

        if (isDelivered || isRto) {
          invalidSkipped++;
          return;
        }

        eligible++;
        toTrackOrders.push(o);
        if (o.stage === 'tracking') {
          alreadyTracked++;
        } else {
          newTracking++;
        }
      } else {
        invalidSkipped++;
      }
    });

    return { eligible, newTracking, alreadyTracked, invalidSkipped, toTrackOrders };
  }, [orders]);

  const filteredOrders = orders.filter((ord) => {
    if (!isCourierActive(ord.courier)) return false;

    const search = searchTerm.toLowerCase().trim();
    const matchesSearch = !search ||
      ord.orderId.toLowerCase().includes(search) ||
      (ord.awbNumber && ord.awbNumber.toLowerCase().includes(search)) ||
      (ord.sourceStatus && ord.sourceStatus.toLowerCase().includes(search)) ||
      (ord.sourceSubStatus && ord.sourceSubStatus.toLowerCase().includes(search)) ||
      (ord.lastEvent && ord.lastEvent.toLowerCase().includes(search));

    return matchesSearch;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const timeA = getEpochTime(a.orderDate || '');
    const timeB = getEpochTime(b.orderDate || '');
    if (timeA && timeB) return timeB - timeA;
    return (b.orderDate || '').localeCompare(a.orderDate || '');
  });

  const handleDelete = async (order: LogisticsOrder) => {
    if (confirm(`Are you sure you want to delete Shipment ${order.orderId}? This moves it to COD Restore.`)) {
      try {
        await db.logistics_orders.update(order.id!, {
          stage: 'trash'
        });
        toast.success(`Shipment ${order.orderId} moved to COD Restore.`);
      } catch (err: any) {
        toast.error(`Delete failed: ${err.message}`);
      }
    }
  };

  const handleClearAllData = async () => {
    if (orders.length === 0) {
      toast.error('No Shipment records to clear.');
      return;
    }
    if (confirm('WARNING: Are you sure you want to permanently delete all active Shipment records? This will NOT affect Tracking Status or COD Restore.')) {
      try {
        const ids = orders.map(o => o.id!).filter(Boolean);
        await db.logistics_orders.bulkDelete(ids);
        toast.success('All active Shipment records cleared.');
      } catch (err: any) {
        toast.error(`Clear failed: ${err.message}`);
      }
    }
  };

  const handleOpenDetail = (order: LogisticsOrder) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-5">
      {isRefreshing && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400 font-semibold flex items-center gap-3 animate-pulse shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
          <span>Refreshing recommendations...</span>
        </div>
      )}
      
      {/* Header action panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Order Data</h2>
          <p className="text-muted text-[11px] mt-1 font-semibold">Import shipment file and manage tracking status.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ID, AWB, Status, Event..."
              className="h-9 bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 text-xs text-slate-200 focus:outline-none focus:border-primary w-60 placeholder:text-slate-600 shadow-sm"
            />
            <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
          </div>

          {/* Track All Button */}
          <button
            onClick={() => {
              if (trackAllStats.eligible === 0) {
                toast.error('No eligible ST Courier shipments to track.');
              } else {
                setIsTrackAllModalOpen(true);
              }
            }}
            disabled={isBulkTracking || trackAllStats.eligible === 0}
            className="h-9 flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700 hover:border-slate-600 text-xs px-4 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
          >
            <Truck size={13} className="text-primary" />
            <span>
              {isBulkTracking 
                ? `Tracking ${bulkTrackingCompleted} / ${bulkTrackingTotal}`
                : 'Track All'
              }
            </span>
          </button>

          {/* Import Shipment File Button */}
          <button
            onClick={() => shipmentFileInputRef.current?.click()}
            className="h-9 flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs px-4 rounded-xl font-semibold transition-all shadow-sm shadow-primary/10 cursor-pointer"
          >
            <UploadCloud size={13} />
            <span>Import Shipment File</span>
          </button>
          <input
            type="file"
            ref={shipmentFileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleShipmentImport(e.target.files[0]);
              }
              if (e.target) e.target.value = '';
            }}
            accept=".csv, .xlsx, .xls"
            className="hidden"
          />

          {/* Clear All Data */}
          {orders.length > 0 && (
            <button
              onClick={handleClearAllData}
              className="h-9 flex items-center gap-1.5 bg-red-650/10 hover:bg-red-650 border border-red-500/20 text-red-400 hover:text-white text-xs px-4 rounded-xl font-semibold transition-all shadow-sm cursor-pointer"
            >
              <Trash2 size={13} /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Main Grid View - Horizontally Scrollable */}
      <div className="flex-1 min-h-0 bg-slate-950/40 border border-border/10 rounded-xl flex flex-col overflow-hidden">
        {sortedOrders.length > 0 ? (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs table-auto min-w-[1200px]">
              <thead className="bg-slate-900/85 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider w-12 text-center">S.No</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Order ID</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Order Date</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">AWB Number</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Courier</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Sub-Status</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Last Event</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {sortedOrders.map((ord, idx) => {
                  return (
                    <tr 
                      key={ord.id} 
                      className="hover:bg-slate-900/35 text-slate-300 transition-colors border-b border-border/10"
                    >
                      <td className="px-4 py-2 text-slate-500 font-mono text-center font-bold">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono font-bold text-slate-200">#{ord.orderId}</td>
                      <td className="px-4 py-2 text-slate-400 font-medium">
                        {ord.orderDate ? parseShopifyDate(ord.orderDate).display : '-'}
                      </td>
                      <td className="px-4 py-2 text-slate-200 font-mono font-semibold select-all">
                        {ord.awbNumber || <span className="text-slate-650 italic">-</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-300 font-semibold">{ord.courier || '-'}</td>
                      <td className="px-4 py-2 text-slate-400 font-medium">{ord.sourceSubStatus || '-'}</td>
                      <td className="px-4 py-2 text-slate-400 font-medium">{ord.lastEvent || '-'}</td>
                      <td className="px-4 py-2 text-center bg-transparent">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setTrackOrder(ord)}
                            className="px-2.5 py-1 bg-primary/10 border border-primary/20 hover:bg-primary text-primary hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            title="Add tracking / AWB"
                          >
                            Track
                          </button>
                          
                          <button
                            onClick={() => handleDelete(ord)}
                            className="p-1.5 border border-slate-700 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Delete Shipment"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 italic p-6 space-y-3">
            <Package size={36} className="opacity-40 text-primary" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-400">No active shipments</p>
              <p className="text-xs text-muted mt-1 font-normal">Import a shipment file using the button above.</p>
            </div>
          </div>
        )}
      </div>

      {/* Track All Confirmation Modal */}
      {isTrackAllModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden relative">
            <div className="p-5 border-b border-border/10 bg-slate-800/30">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Truck size={16} className="text-primary" /> Track All ST Courier Shipments?
              </h3>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950/40 p-3.5 rounded-xl border border-border/5 space-y-2">
                <div className="flex justify-between">
                  <span>Total eligible:</span>
                  <span className="text-white font-mono font-bold">{trackAllStats.eligible}</span>
                </div>
                <div className="flex justify-between">
                  <span>New tracking records:</span>
                  <span className="text-emerald-400 font-mono font-bold">{trackAllStats.newTracking}</span>
                </div>
                <div className="flex justify-between">
                  <span>Already tracked / will resync:</span>
                  <span className="text-blue-400 font-mono font-bold">{trackAllStats.alreadyTracked}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800/60 pt-2">
                  <span className="text-slate-500 font-medium">Invalid / skipped:</span>
                  <span className="text-slate-500 font-mono font-bold">{trackAllStats.invalidSkipped}</span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0 flex justify-end gap-3">
              <button
                onClick={() => setIsTrackAllModalOpen(false)}
                className="h-9 px-4 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={startTrackAllProcess}
                className="h-9 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-primary/20 cursor-pointer"
              >
                Start Tracking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track Popup Modal */}
      {trackOrder && (
        <TrackingModal
          order={trackOrder}
          onClose={() => setTrackOrder(null)}
          onSaved={() => {}}
        />
      )}

      {/* Recommendation Modal */}
      {recOrder && recommendationDetail && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-border/10 bg-slate-850 shrink-0">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <HelpCircle size={16} className="text-primary" /> Delivery Recommendation
              </h3>
              <button 
                onClick={() => { setRecOrder(null); setRecommendationDetail(null); }} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800 rounded-lg border border-slate-700/60 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto text-xs flex-1 custom-scrollbar">
              
              {/* Order Info & Match Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Left card: Current Order */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-border/5 space-y-2.5">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[9px] border-b border-border/5 pb-1.5">Order Information</h4>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Order No:</span>
                    <span className="text-white font-mono font-bold">{recOrder.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pincode:</span>
                    <span className="text-slate-200 font-mono font-semibold">{normalizePincode(recOrder.pincode) || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">State:</span>
                    <span className="text-slate-200 font-semibold">{recOrder.state || '-'}</span>
                  </div>
                </div>

                {/* Right card: Recommendation Result */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-border/5 space-y-2.5">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[9px] border-b border-border/5 pb-1.5">Recommendation Summary</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Match Type:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                      recommendationDetail.matchType === 'Exact'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : recommendationDetail.matchType === 'Nearest'
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {recommendationDetail.matchType === 'Exact'
                        ? 'Exact Match'
                        : recommendationDetail.matchType === 'Nearest'
                        ? 'Nearest Pincode'
                        : 'No Data'}
                    </span>
                  </div>
                  
                  {recommendationDetail.matchType === 'Nearest' && (
                    <div className="text-[10px] text-yellow-400/90 font-medium py-1 bg-yellow-500/5 px-2 rounded-lg border border-yellow-500/10 text-center">
                      Exact pincode not found. Based on nearest pincode {recommendationDetail.matchedPincode}.
                    </div>
                  )}

                  {recommendationDetail.matchType !== 'No Data' ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Recommended Courier:</span>
                        <span className="text-primary font-bold">{recommendationDetail.recommendedCourier}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Estimated Delivery Time:</span>
                        <span className="text-slate-200 font-bold">{Math.round(recommendationDetail.averageDeliveryDays)} days</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-red-400 font-medium py-1 bg-red-500/5 px-2 rounded-lg border border-red-500/10 text-center">
                      No historical data found for this location.
                    </div>
                  )}
                </div>

              </div>

              {recommendationDetail.matchType !== 'No Data' && (
                <>
                  {/* Courier stats overview */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-border/10 text-center">
                      <p className="text-[10px] text-slate-500 font-medium">Delivered Orders</p>
                      <p className="text-base font-bold text-slate-200 mt-1">{recommendationDetail.deliveredOrdersCount}</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-border/10 text-center">
                      <p className="text-[10px] text-slate-500 font-medium">Avg Delivery Days</p>
                      <p className="text-base font-bold text-slate-200 mt-1">{recommendationDetail.averageDeliveryDays} d</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-border/10 text-center">
                      <p className="text-[10px] text-slate-500 font-medium">Fastest Courier</p>
                      <p className="text-sm font-bold text-emerald-400 mt-1.5 truncate" title={recommendationDetail.fastestCourier}>{recommendationDetail.fastestCourier}</p>
                    </div>
                  </div>

                  {/* Courier Performance table */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Courier Performance Details</h4>
                    <div className="bg-slate-950/40 border border-border/10 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-900/80">
                            <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Courier</th>
                            <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Delivered Orders</th>
                            <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Avg Days</th>
                            <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center text-emerald-400">Fastest</th>
                            <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center text-red-400">Slowest</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                          {recommendationDetail.performance.map((perf: any, pIdx: number) => (
                            <tr key={pIdx} className="hover:bg-slate-900/35 transition-colors">
                              <td className="px-4 py-2 font-semibold text-slate-200">{perf.courier}</td>
                              <td className="px-4 py-2 text-center text-slate-300 font-medium">{perf.deliveredOrders}</td>
                              <td className="px-4 py-2 text-center text-slate-300 font-bold">{perf.averageDeliveryDays} days</td>
                              <td className="px-4 py-2 text-center text-emerald-400/90 font-medium font-mono">{perf.fastestDelivery} days</td>
                              <td className="px-4 py-2 text-center text-red-400/90 font-medium font-mono">{perf.slowestDelivery} days</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-border/10 bg-slate-800/10 flex justify-end h-16 items-center shrink-0">
              <button
                onClick={() => { setRecOrder(null); setRecommendationDetail(null); }}
                className="px-5 h-9 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkTracking && bulkProgress && (
        <div className="fixed bottom-6 right-6 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl p-5 w-80 text-xs text-slate-300 font-semibold z-50 animate-in slide-in-from-bottom duration-300">
          <div className="text-white font-bold text-sm border-b border-slate-800/80 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="text-primary animate-spin" size={14} />
              {bulkProgress.phase === 'first-pass' ? 'ST Courier Bulk Tracking' : 'Retrying Failed Shipments'}
            </span>
            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              {Math.round((bulkProgress.completed / bulkProgress.total) * 100) || 0}%
            </span>
          </div>
          
          <div className="space-y-2 mt-3.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Completed:</span>
              <span className="text-white font-mono font-bold">{bulkProgress.completed} / {bulkProgress.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Checking (Active):</span>
              <span className="text-blue-400 font-mono font-bold">{bulkProgress.checking}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Queued:</span>
              <span className="text-slate-500 font-mono font-bold">{bulkProgress.queued}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/60 pt-2">
              <span className="text-emerald-400">Successful:</span>
              <span className="text-emerald-400 font-mono font-bold">{bulkProgress.success}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-400">Failed:</span>
              <span className="text-red-400 font-mono font-bold">{bulkProgress.failed}</span>
            </div>
          </div>
          
          {bulkProgress.phase === 'retrying' && (
            <div className="mt-3.5 pt-2.5 border-t border-slate-850 text-[10px] text-yellow-400/90 flex items-center gap-1.5">
              <AlertCircle size={12} />
              <span>Retrying failed shipments (Attempt {bulkProgress.retryCount || 2})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
