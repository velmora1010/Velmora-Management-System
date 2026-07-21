import React, { useState, useRef, useEffect } from 'react';
import db from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import * as XLSX from 'xlsx';
import { Search, UploadCloud, Eye, Trash2, Package, X, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { TrackingModal } from './TrackingModal';
import type { LogisticsOrder } from '../../types/logistics';
import { getBestCourierRecommendation } from '../../services/deliveryRecommendationService';
import { normalizePincode } from '../../utils/pincodeUtils';
import { recommendationRefreshManager } from '../../services/recommendationRefreshManager';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state for verification before saving
  const [previewData, setPreviewData] = useState<{
    fileName: string;
    headers: string[];
    orders: LogisticsOrder[];
  } | null>(null);

  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustomFrom, setAppliedCustomFrom] = useState('');
  const [appliedCustomTo, setAppliedCustomTo] = useState('');

  // Load all active order data items (stage: 'order_data')
  const orders = useLiveQuery(
    () => db.logistics_orders.where('stage').equals('order_data').reverse().toArray(),
    []
  ) ?? [];

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
        const parsed = Date.parse(`${datePart}T${timePart}${tzFormatted}`);
        if (!isNaN(parsed)) return parsed;
      }
      const parsed = Date.parse(val);
      if (!isNaN(parsed)) return parsed;
    } catch (e) {}
    return 0;
  };

  // Date bounds calculations helper
  const matchesDateFilter = (orderDateStr: string) => {
    if (!dateFilter) return true;
    const orderMs = getEpochTime(orderDateStr);
    if (!orderMs) return false;

    const now = new Date();
    
    // Start of today (local time)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    // Start of yesterday (local time)
    const startOfYesterday = startOfToday - 86400 * 1000;
    const endOfYesterday = startOfToday - 1;

    // Last 7 days
    const startOf7DaysAgo = startOfToday - 7 * 86400 * 1000;

    // This Month
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    if (dateFilter === 'Today') {
      return orderMs >= startOfToday && orderMs <= endOfToday;
    }
    if (dateFilter === 'Yesterday') {
      return orderMs >= startOfYesterday && orderMs <= endOfYesterday;
    }
    if (dateFilter === 'Last 7 Days') {
      return orderMs >= startOf7DaysAgo && orderMs <= endOfToday;
    }
    if (dateFilter === 'This Month') {
      return orderMs >= startOfThisMonth && orderMs <= endOfToday;
    }
    if (dateFilter === 'Custom Date') {
      if (appliedCustomFrom) {
        const fromMs = new Date(appliedCustomFrom).getTime(); // 00:00:00 local time
        if (orderMs < fromMs) return false;
      }
      if (appliedCustomTo) {
        const toDate = new Date(appliedCustomTo);
        const toMs = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999).getTime();
        if (orderMs > toMs) return false;
      }
      return true;
    }

    return true;
  };

  const matchesOrderTypeFilter = (type?: string) => {
    if (!orderTypeFilter) return true;
    const t = (type || '').toUpperCase().trim();
    const filter = orderTypeFilter.toUpperCase();
    if (filter === 'COD') return t === 'COD';
    if (filter === 'PREPAID') return t === 'PREPAID';
    if (filter === 'VOIDED') return t === 'VOID' || t === 'VOIDED';
    return true;
  };

  // Filter logic: Search by Order No, Name, Phone No, Pincode + Order Type + Date
  const filteredOrders = orders.filter((ord) => {
    const search = searchTerm.toLowerCase().trim();
    const matchesSearch = !search ||
      ord.orderId.toLowerCase().includes(search) ||
      ord.customerName.toLowerCase().includes(search) ||
      ord.phoneNumber.toLowerCase().includes(search) ||
      (ord.pincode && normalizePincode(ord.pincode).toLowerCase().includes(search));

    const matchesType = matchesOrderTypeFilter(ord.orderType);
    const matchesDate = matchesDateFilter(ord.orderDate || '');

    return matchesSearch && matchesType && matchesDate;
  });

  // Sort filtered orders chronologically by the raw timestamp
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const timeA = getEpochTime(a.orderDate || '');
    const timeB = getEpochTime(b.orderDate || '');
    if (timeA && timeB) return timeB - timeA;
    return (b.orderDate || '').localeCompare(a.orderDate || '');
  });

  // Helper: Format raw cells to text
  const formatCellVal = (val: any): string => {
    if (val === undefined || val === null) return '';
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    if (typeof val === 'number') {
      if (val > 35000 && val < 60000) {
        try {
          const d = new Date(Math.round((val - 25569) * 86400 * 1000));
          if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
          }
        } catch (e) {}
      }
      return String(val);
    }
    return String(val).trim();
  };

  // Helper: Parse products quantity codes or names, applying line item quantity multiplier
  const parseProducts = (productStr: string, multiplier: number = 1) => {
    let b = 0;
    let p = 0;
    let y = 0;

    const parts = productStr.split(/[+,\n;/]/);
    for (let part of parts) {
      part = part.trim().toUpperCase();
      if (!part) continue;

      // Match patterns like "2B", "1P", "3Y" or "B", "P", "Y"
      const matchB = part.match(/(\d*)\s*B\b/);
      const matchP = part.match(/(\d*)\s*P\b/);
      const matchY = part.match(/(\d*)\s*Y\b/);

      if (matchB || matchP || matchY) {
        if (matchB) b += parseInt(matchB[1] || '1', 10) * multiplier;
        if (matchP) p += parseInt(matchP[1] || '1', 10) * multiplier;
        if (matchY) y += parseInt(matchY[1] || '1', 10) * multiplier;
        continue;
      }

      // If it is a full name, extract quantity if specified
      const qtyMatch = part.match(/(\d+)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

      if (part.includes('DETERGENT')) {
        b += qty * multiplier;
      } else if (part.includes('CONDITIONER') || part.includes('FABRIC')) {
        p += qty * multiplier;
      } else if (part.includes('DISHWASH') || part.includes('DISH')) {
        y += qty * multiplier;
      }
    }
    return { b, p, y };
  };

  // Helper: Format SKU to required code format e.g. "1B + 1P"
  const formatSku = (b: number, p: number, y: number): string => {
    const parts: string[] = [];
    if (b > 0) parts.push(`${b}B`);
    if (p > 0) parts.push(`${p}P`);
    if (y > 0) parts.push(`${y}Y`);
    return parts.join(' + ');
  };

  // Mapper utility: supports standard and Shopify export headers
  const mapRowToOrder = (headers: string[], row: any[]): Partial<LogisticsOrder> & { productQty?: number } => {
    const hasShopifyBillingName = headers.some(h => h.toLowerCase().trim() === 'billing name');

    let orderNoIdx = -1;
    if (hasShopifyBillingName) {
      orderNoIdx = headers.findIndex(h => h.toLowerCase().trim() === 'name');
    } else {
      orderNoIdx = headers.findIndex(h => h.toLowerCase().trim() === 'order no');
    }

    // Use Shopify column "Created at" as priority, fallback to standard "Order Date"
    const orderDateIdx = headers.findIndex(h => {
      const hn = h.toLowerCase().trim();
      return hn === 'created at' || hn === 'order date';
    });

    // Fallback to Shopify column "Paid at" if Created at is empty
    const fallbackDateIdx = headers.findIndex(h => h.toLowerCase().trim() === 'paid at');

    const orderTypeIdx = headers.findIndex(h => {
      const hn = h.toLowerCase().trim();
      return hn === 'order type' || hn === 'financial status';
    });

    let nameIdx = -1;
    if (hasShopifyBillingName) {
      nameIdx = headers.findIndex(h => h.toLowerCase().trim() === 'billing name');
    } else {
      nameIdx = headers.findIndex(h => h.toLowerCase().trim() === 'name');
    }

    const phoneIdx = headers.findIndex(h => {
      const hn = h.toLowerCase().trim();
      return hn === 'phone no' || hn === 'billing phone';
    });

    const orderValueIdx = headers.findIndex(h => {
      const hn = h.toLowerCase().trim();
      return hn === 'order value' || hn === 'total';
    });

    // Prefer "Lineitem sku" if available, fallback to "Lineitem name"
    let productIdx = headers.findIndex(h => h.toLowerCase().trim() === 'lineitem sku');
    if (productIdx === -1) {
      productIdx = headers.findIndex(h => {
        const hn = h.toLowerCase().trim();
        return hn === 'product (sku)' || hn === 'lineitem name';
      });
    }

    const productQtyIdx = headers.findIndex(h => h.toLowerCase().trim() === 'lineitem quantity');

    const addressIdx = headers.findIndex(h => {
      const hn = h.toLowerCase().trim();
      return hn === 'address' || hn === 'billing address1';
    });

    const cityIdx = headers.findIndex(h => {
      const hn = h.toLowerCase().trim();
      return hn === 'city' || hn === 'billing city';
    });

    const stateIdx = headers.findIndex(h => {
      const hn = h.toLowerCase().trim();
      return hn === 'state' || hn === 'billing province';
    });

    const pincodeIdx = headers.findIndex(h => {
      const hn = h.toLowerCase().trim();
      return hn === 'pincode' || hn === 'billing zip';
    });

    const orderId = orderNoIdx !== -1 ? formatCellVal(row[orderNoIdx]) : '';
    
    // Date mapping with priority and fallback
    let rawDateVal = orderDateIdx !== -1 ? formatCellVal(row[orderDateIdx]) : '';
    if (!rawDateVal && fallbackDateIdx !== -1) {
      rawDateVal = formatCellVal(row[fallbackDateIdx]);
    }
    const dateParsed = parseShopifyDate(rawDateVal);

    const customerName = nameIdx !== -1 ? formatCellVal(row[nameIdx]) : '';
    const phoneNumber = phoneIdx !== -1 ? formatCellVal(row[phoneIdx]) : '';
    
    // Normalize orderType based on Financial Status (Shopify) or Order Type (Standard)
    let orderTypeRaw = orderTypeIdx !== -1 ? formatCellVal(row[orderTypeIdx]) : '';
    let orderType = '';
    const upperRaw = orderTypeRaw.toUpperCase();
    if (upperRaw.includes('PAID')) {
      orderType = 'PREPAID';
    } else if (upperRaw.includes('PENDING') || upperRaw.includes('COD')) {
      orderType = 'COD';
    } else {
      if (upperRaw.includes('COD')) orderType = 'COD';
      else if (upperRaw.includes('PREPAID')) orderType = 'PREPAID';
      else orderType = orderTypeRaw;
    }

    const amount = orderValueIdx !== -1 ? formatCellVal(row[orderValueIdx]) : '';
    const rawProductStr = productIdx !== -1 ? formatCellVal(row[productIdx]) : '';
    const qtyVal = productQtyIdx !== -1 ? parseInt(formatCellVal(row[productQtyIdx]) || '1', 10) : 1;

    const address = addressIdx !== -1 ? formatCellVal(row[addressIdx]) : '';
    const city = cityIdx !== -1 ? formatCellVal(row[cityIdx]) : '';
    const state = stateIdx !== -1 ? formatCellVal(row[stateIdx]) : '';
    const pincode = pincodeIdx !== -1 ? normalizePincode(formatCellVal(row[pincodeIdx])) : '';

    return {
      orderId,
      orderDate: dateParsed.raw,
      orderDateDisplay: dateParsed.display,
      orderDateTooltip: dateParsed.tooltip,
      createdAtRaw: dateParsed.raw,
      createdAtDisplay: dateParsed.display,
      customerName,
      phoneNumber,
      orderType,
      amount,
      products: rawProductStr,
      productQty: qtyVal, // Temporary property for grouping loop
      address,
      city,
      state,
      pincode
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();

      const loadToast = toast.loading(`Parsing ${file.name}...`);

      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];

          if (rawRows.length === 0) {
            toast.dismiss(loadToast);
            toast.error('The uploaded file is empty.');
            return;
          }

          const headers = rawRows[0].map(h => String(h || '').trim());
          const dataRows = rawRows.slice(1);

          // Group rows by Order No in memory
          const groups: { [orderId: string]: any[] } = {};
          
          for (const row of dataRows) {
            const parsedOrder = mapRowToOrder(headers, row);
            if (!parsedOrder.orderId) continue;
            
            if (!groups[parsedOrder.orderId]) {
              groups[parsedOrder.orderId] = [];
            }
            groups[parsedOrder.orderId].push(parsedOrder);
          }

          const parsedOrdersList: LogisticsOrder[] = [];

          for (const orderId in groups) {
            const groupRows = groups[orderId];

            // Aggregate fields (first non-empty value)
            const findFirstNonEmpty = (fieldName: keyof LogisticsOrder) => {
              for (const r of groupRows) {
                if (r[fieldName]) return r[fieldName];
              }
              return '';
            };

            const orderDate = findFirstNonEmpty('orderDate') as string;
            const orderDateDisplay = findFirstNonEmpty('orderDateDisplay') as string;
            const orderDateTooltip = findFirstNonEmpty('orderDateTooltip') as string;
            const createdAtRaw = findFirstNonEmpty('createdAtRaw') as string;
            const createdAtDisplay = findFirstNonEmpty('createdAtDisplay') as string;

            const customerName = (findFirstNonEmpty('customerName') as string) || 'Unknown Customer';
            const phoneNumber = (findFirstNonEmpty('phoneNumber') as string) || '-';
            const orderType = (findFirstNonEmpty('orderType') as string) || 'COD';
            const amount = (findFirstNonEmpty('amount') as string) || '0';
            const address = findFirstNonEmpty('address') as string;
            const city = findFirstNonEmpty('city') as string;
            const state = findFirstNonEmpty('state') as string;
            const pincode = normalizePincode(findFirstNonEmpty('pincode') as string);

            // Aggregate product quantities with multipliers
            let totalB = 0;
            let totalP = 0;
            let totalY = 0;

            for (const r of groupRows) {
              const qty = (r as any).productQty || 1;
              const { b, p, y } = parseProducts(r.products || '', qty);
              totalB += b;
              totalP += p;
              totalY += y;
            }

            const combinedProducts = formatSku(totalB, totalP, totalY);

            parsedOrdersList.push({
              orderId,
              orderDate,
              orderDateDisplay,
              orderDateTooltip,
              createdAtRaw,
              createdAtDisplay,
              customerName,
              phoneNumber,
              orderType,
              amount,
              products: combinedProducts || '-',
              address,
              city,
              state,
              pincode,
              stage: 'order_data',
              uploadedAt: new Date().toLocaleString()
            });
          }

          toast.dismiss(loadToast);
          
          // Debug requirement: console.log detected headers and first 3 parsed rows
          console.log('Detected headers:', headers);
          console.log('First 3 parsed rows:', parsedOrdersList.slice(0, 3));

          // Set preview data to show preview modal
          setPreviewData({
            fileName: file.name,
            headers,
            orders: parsedOrdersList
          });

        } catch (err: any) {
          toast.dismiss(loadToast);
          toast.error(`Error: ${err.message || String(err)}`);
        }
      };

      reader.onerror = () => {
        toast.dismiss(loadToast);
        toast.error('File reading failed.');
      };

      reader.readAsBinaryString(file);
    }
  };

  const handleSavePreview = async () => {
    if (!previewData) return;

    const loadToast = toast.loading('Saving orders to local database...');
    let importedCount = 0;
    let skippedDuplicates = 0;

    try {
      for (const order of previewData.orders) {
        // Duplicate Order Protection based on already imported Order No
        const existingOrder = await db.logistics_orders
          .where('orderId')
          .equals(order.orderId)
          .first();

        if (existingOrder && existingOrder.stage !== 'trash') {
          skippedDuplicates++;
          continue;
        }

        await db.logistics_orders.add(order);
        importedCount++;
      }

      toast.dismiss(loadToast);
      if (importedCount > 0) {
        toast.success(`Imported ${importedCount} unique orders successfully!`);
      }
      if (skippedDuplicates > 0) {
        toast.custom((t) => (
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center gap-3 text-xs text-slate-300 font-semibold shadow-lg">
            <HelpCircle className="text-yellow-400 shrink-0" size={18} />
            <span>Skipped {skippedDuplicates} already active duplicate orders.</span>
            <button onClick={() => toast.dismiss(t.id)} className="ml-auto text-slate-500 hover:text-slate-400 font-bold">Dismiss</button>
          </div>
        ));
      }
    } catch (err: any) {
      toast.dismiss(loadToast);
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setPreviewData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (order: LogisticsOrder) => {
    if (confirm(`Are you sure you want to delete COD Order ${order.orderId}? This moves it to COD Restore.`)) {
      try {
        await db.logistics_orders.update(order.id!, {
          stage: 'trash'
        });
        toast.success(`Order ${order.orderId} moved to COD Restore.`);
      } catch (err: any) {
        toast.error(`Delete failed: ${err.message}`);
      }
    }
  };

  const handleClearAllData = async () => {
    if (orders.length === 0) {
      toast.error('No Order Data records to clear.');
      return;
    }
    if (confirm('WARNING: Are you sure you want to permanently delete all active Order Data records? This will NOT affect Tracking Status or COD Restore.')) {
      try {
        const ids = orders.map(o => o.id!).filter(Boolean);
        await db.logistics_orders.bulkDelete(ids);
        toast.success('All active Order Data records cleared.');
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
          <p className="text-muted text-[11px] mt-1">Upload order sheets and select tracking or delete actions for COD entries.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ID, Name, Phone, Pincode..."
              className="h-9 bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 text-xs text-slate-200 focus:outline-none focus:border-primary w-60 placeholder:text-slate-600 shadow-sm"
            />
            <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
          </div>

          {/* Order Type Filter dropdown */}
          <select
            value={orderTypeFilter}
            onChange={(e) => setOrderTypeFilter(e.target.value)}
            className="h-9 bg-slate-900 border border-slate-700/80 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-primary shadow-sm"
          >
            <option value="">All Orders</option>
            <option value="COD">COD</option>
            <option value="PREPAID">PREPAID</option>
            <option value="Voided">Voided</option>
          </select>

          {/* Date Filter dropdown */}
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              if (e.target.value !== 'Custom Date') {
                setCustomFrom('');
                setCustomTo('');
                setAppliedCustomFrom('');
                setAppliedCustomTo('');
              }
            }}
            className="h-9 bg-slate-900 border border-slate-700/80 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-primary shadow-sm"
          >
            <option value="">All Dates</option>
            <option value="Today">Today</option>
            <option value="Yesterday">Yesterday</option>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="This Month">This Month</option>
            <option value="Custom Date">Custom Date</option>
          </select>

          {/* Custom Date Range */}
          {dateFilter === 'Custom Date' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 bg-slate-900 border border-slate-700/80 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-primary shadow-sm w-36 [color-scheme:dark]"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 bg-slate-900 border border-slate-700/80 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-primary shadow-sm w-36 [color-scheme:dark]"
              />
              <button
                onClick={() => {
                  setAppliedCustomFrom(customFrom);
                  setAppliedCustomTo(customTo);
                  toast.success('Custom date range applied.');
                }}
                className="h-9 px-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                Apply
              </button>
              {(customFrom || customTo || appliedCustomFrom || appliedCustomTo) && (
                <button
                  onClick={() => {
                    setCustomFrom('');
                    setCustomTo('');
                    setAppliedCustomFrom('');
                    setAppliedCustomTo('');
                    setDateFilter('');
                    toast.success('Custom date range cleared.');
                  }}
                  className="h-9 px-3 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold shadow-sm transition-colors"
                >
                  Clear Date
                </button>
              )}
            </div>
          )}

          {/* Clear All Data */}
          {orders.length > 0 && (
            <button
              onClick={handleClearAllData}
              className="h-9 flex items-center gap-1.5 bg-red-650/10 hover:bg-red-650 border border-red-500/20 text-red-400 hover:text-white text-xs px-4 rounded-xl font-semibold transition-all shadow-sm"
            >
              <Trash2 size={13} /> Clear All
            </button>
          )}

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-9 flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs px-4 rounded-xl font-semibold transition-all shadow-sm shadow-primary/10"
          >
            <UploadCloud size={13} /> Upload Order Sheet
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv, .xlsx, .xls"
            className="hidden"
          />
        </div>
      </div>

      {/* Active Filter Chips & Clear Filters row */}
      {(searchTerm || orderTypeFilter || dateFilter) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-1.5 shrink-0 animate-in fade-in duration-200">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Filters:</span>
          
          {searchTerm && (
            <span className="flex items-center gap-1.5 bg-slate-900 border border-slate-800/80 text-slate-300 px-2.5 py-1 rounded-xl text-xs font-semibold shadow-sm">
              Search: "{searchTerm}"
              <button 
                onClick={() => setSearchTerm('')} 
                className="hover:text-red-400 font-bold ml-1 text-slate-500 transition-colors"
                title="Remove filter"
              >
                ×
              </button>
            </span>
          )}

          {orderTypeFilter && (
            <span className="flex items-center gap-1.5 bg-slate-900 border border-slate-800/80 text-slate-300 px-2.5 py-1 rounded-xl text-xs font-semibold shadow-sm">
              Type: {orderTypeFilter}
              <button 
                onClick={() => setOrderTypeFilter('')} 
                className="hover:text-red-400 font-bold ml-1 text-slate-500 transition-colors"
                title="Remove filter"
              >
                ×
              </button>
            </span>
          )}

          {dateFilter && (
            <span className="flex items-center gap-1.5 bg-slate-900 border border-slate-800/80 text-slate-300 px-2.5 py-1 rounded-xl text-xs font-semibold shadow-sm">
              Date: {dateFilter === 'Custom Date' && appliedCustomFrom && appliedCustomTo 
                ? `${appliedCustomFrom} to ${appliedCustomTo}`
                : dateFilter
              }
              <button 
                onClick={() => {
                  setDateFilter('');
                  setCustomFrom('');
                  setCustomTo('');
                  setAppliedCustomFrom('');
                  setAppliedCustomTo('');
                }} 
                className="hover:text-red-400 font-bold ml-1 text-slate-500 transition-colors"
                title="Remove filter"
              >
                ×
              </button>
            </span>
          )}

          <button
            onClick={() => {
              setSearchTerm('');
              setOrderTypeFilter('');
              setDateFilter('');
              setCustomFrom('');
              setCustomTo('');
              setAppliedCustomFrom('');
              setAppliedCustomTo('');
              toast.success('All active filters cleared.');
            }}
            className="text-[11px] font-bold text-primary hover:text-primary-hover hover:underline ml-1.5 transition-all"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Main Grid View - Horizontally Scrollable */}
      <div className="flex-1 min-h-0 bg-slate-950/40 border border-border/10 rounded-xl flex flex-col overflow-hidden">
        {sortedOrders.length > 0 ? (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs table-auto min-w-[1200px]">
              <thead className="bg-slate-900/85 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider w-12 text-center">S.No</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Order No</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Order Date</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider text-center">Order Type</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Name</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Phone No</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider text-right">Order Value</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider w-1/5">Product (SKU)</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider w-1/4">Address</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">City</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">State</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider">Pincode</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider text-center">Recommendation</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-border/20 bg-slate-900 tracking-wider text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {sortedOrders.map((ord, idx) => {
                  const isCod = ord.orderType === 'COD';
                  const isPrepaid = ord.orderType === 'PREPAID';
                  return (
                    <tr 
                      key={ord.id} 
                      className={`transition-colors border-b border-border/10 ${
                        isCod 
                          ? 'bg-[#281e16]/30 hover:bg-[#281e16]/50 border-amber-500/10 text-amber-100/90' 
                          : isPrepaid
                          ? 'bg-[#0f1c2e]/30 hover:bg-[#0f1c2e]/50 border-blue-500/10 text-blue-100/90'
                          : 'hover:bg-slate-900/35 text-slate-300'
                      }`}
                    >
                      <td className="px-4 py-2 text-slate-500 font-mono text-center font-bold">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono font-bold text-slate-200">{ord.orderId}</td>
                      <td 
                        className="px-4 py-2 text-slate-400 font-medium cursor-help" 
                        title={ord.orderDateTooltip || ord.orderDate || ''}
                      >
                        {ord.orderDateDisplay || ord.orderDate || '-'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {ord.orderType ? (
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border ${
                            isCod
                              ? 'bg-[#F59E08]/15 text-[#F59E08] border-[#F59E08]/30'
                              : isPrepaid
                              ? 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700/50'
                          }`}>
                            {ord.orderType}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-2 text-slate-200 font-semibold">{ord.customerName}</td>
                      <td className="px-4 py-2 text-slate-400 font-medium">{ord.phoneNumber}</td>
                      <td className="px-4 py-2 text-slate-200 font-bold text-right">₹{Number(ord.amount).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-slate-300 font-medium truncate max-w-[200px]" title={ord.products}>{ord.products}</td>
                      <td className="px-4 py-2 text-slate-400 font-medium truncate max-w-[240px]" title={ord.address}>{ord.address || '-'}</td>
                      <td className="px-4 py-2 text-slate-300 font-medium">{ord.city || '-'}</td>
                      <td className="px-4 py-2 text-slate-300 font-medium">{ord.state || '-'}</td>
                      <td className="px-4 py-2 text-slate-400 font-mono font-medium">{normalizePincode(ord.pincode) || '-'}</td>
                      <td className="px-4 py-2 text-center bg-transparent">
                        <button
                          onClick={() => handleViewRecommendation(ord)}
                          disabled={isRefreshing}
                          className={`px-2 py-0.5 border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          title={isRefreshing ? "Refreshing recommendations..." : "View delivery recommendations"}
                        >
                          View
                        </button>
                      </td>
                      <td className="px-4 py-2 text-center bg-transparent">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Action (All Orders) */}
                          <button
                            onClick={() => handleOpenDetail(ord)}
                            className="p-1.5 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                            title="View order details"
                          >
                            <Eye size={12} />
                          </button>
                          
                          {/* Track Action (All Orders) */}
                          <button
                            onClick={() => setTrackOrder(ord)}
                            className="px-2 py-1 bg-primary/10 border border-primary/20 hover:bg-primary text-primary hover:text-white rounded-lg text-[10px] font-bold transition-all"
                            title="Add tracking / AWB"
                          >
                            Track
                          </button>
                          
                          {/* Delete Action (COD Only) */}
                          {isCod && (
                            <button
                              onClick={() => handleDelete(ord)}
                              className="p-1.5 border border-slate-700 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                              title="Delete COD Order"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
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
              <p className="text-sm font-semibold text-slate-400">No active orders</p>
              <p className="text-xs text-muted mt-1 font-normal">Upload an order sheet using the button above.</p>
            </div>
          </div>
        )}
      </div>

      {/* Import Preview Verification Modal */}
      {previewData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-border/10 bg-slate-850">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <UploadCloud className="text-primary" size={20} /> Import Preview Verification
                </h3>
                <p className="text-xs text-slate-400 mt-1">Review exactly how the first 3 rows map to required fields before importing.</p>
              </div>
              <button 
                onClick={() => setPreviewData(null)} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800 rounded-lg border border-slate-700/60"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Table */}
            <div className="p-6 overflow-auto custom-scrollbar flex-1 space-y-4">
              <div className="text-xs bg-slate-950/40 p-4 rounded-xl border border-border/5 space-y-2">
                <div><span className="text-muted">Uploaded File:</span> <span className="text-white font-semibold">{previewData.fileName}</span></div>
                <div><span className="text-muted">Unique Orders Grouped:</span> <span className="text-primary font-bold">{previewData.orders.length}</span></div>
                <div className="truncate"><span className="text-muted">Detected Headers:</span> <span className="text-slate-300 font-mono">{previewData.headers.join(', ')}</span></div>
              </div>

              <div className="border border-border/10 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs table-auto">
                  <thead className="bg-slate-950">
                    <tr>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase text-center w-12">S.No</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase">Order No</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase">Order Date</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase text-center">Order Type</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase">Name</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase">Phone No</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase text-right">Order Value</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase">Product (SKU)</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase w-1/5">Address</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase">City</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase">State</th>
                      <th className="px-3 py-2.5 text-[10px] font-bold text-muted uppercase">Pincode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 bg-slate-900/40">
                    {previewData.orders.length > 0 ? (
                      previewData.orders.slice(0, 3).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                          <td className="px-3 py-3 text-slate-500 font-mono text-center font-bold">{idx + 1}</td>
                          <td className="px-3 py-3 font-mono font-bold text-slate-200">{item.orderId || <span className="text-red-400 italic">Missing</span>}</td>
                          <td 
                            className="px-3 py-3 text-slate-400 cursor-help"
                            title={item.orderDateTooltip || item.orderDate || ''}
                          >
                            {item.orderDateDisplay || item.orderDate || <span className="text-slate-600 italic">Empty</span>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                              item.orderType === 'COD'
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                : item.orderType === 'PREPAID'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700/50'
                            }`}>
                              {item.orderType || 'None'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-200 font-semibold">{item.customerName || <span className="text-slate-600 italic">Empty</span>}</td>
                          <td className="px-3 py-3 text-slate-400">{item.phoneNumber || <span className="text-slate-600 italic">Empty</span>}</td>
                          <td className="px-3 py-3 text-slate-200 font-bold text-right">₹{item.amount || '0'}</td>
                          <td className="px-3 py-3 text-slate-300 truncate max-w-[120px]" title={item.products}>{item.products}</td>
                          <td className="px-3 py-3 text-slate-400 truncate max-w-[140px]" title={item.address}>{item.address || <span className="text-slate-600 italic">Empty</span>}</td>
                          <td className="px-3 py-3 text-slate-300">{item.city || <span className="text-slate-600 italic">Empty</span>}</td>
                          <td className="px-3 py-3 text-slate-300">{item.state || <span className="text-slate-600 italic">Empty</span>}</td>
                          <td className="px-3 py-3 text-slate-400 font-mono">{normalizePincode(item.pincode) || <span className="text-slate-600 italic">Empty</span>}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} className="text-center py-8 text-red-400 font-semibold italic bg-red-950/10">
                          No unique orders could be extracted.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {previewData.orders.length > 3 && (
                <div className="text-center text-[10px] text-slate-500 font-semibold italic">
                  Showing first 3 of {previewData.orders.length} unique orders.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border/10 bg-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-4 h-20">
              {previewData.orders.length === 0 ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-xs font-semibold">
                  Could not detect order columns. Please check uploaded file headers.
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 font-semibold italic" />
              )}
              
              <div className="flex justify-end gap-3 h-10 items-center ml-auto">
                <button
                  onClick={() => setPreviewData(null)}
                  className="px-5 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePreview}
                  disabled={previewData.orders.length === 0}
                  className="px-6 py-2 bg-primary hover:bg-primary-hover disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-850 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/10"
                >
                  Save and Import
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Details View Modal */}
      {isDetailOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden relative">
            <div className="flex justify-between items-center p-5 border-b border-border/10 bg-slate-800/30">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Package size={16} className="text-primary" /> Order Details
              </h3>
              <button 
                onClick={() => setIsDetailOpen(false)} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800 rounded-xl border border-slate-700/60 hover:border-slate-600"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-muted block uppercase tracking-wider text-[10px]">Order No</span>
                  <span className="text-white font-mono font-bold text-xs">{selectedOrder.orderId}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted block uppercase tracking-wider text-[10px]">Order Type</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                    selectedOrder.orderType === 'COD'
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      : selectedOrder.orderType === 'PREPAID'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700/50'
                  }`}>{selectedOrder.orderType || 'None'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted block uppercase tracking-wider text-[10px]">Order Date</span>
                  <span className="text-slate-200 font-semibold text-xs cursor-help" title={selectedOrder.orderDateTooltip || selectedOrder.orderDate || ''}>
                    {selectedOrder.orderDateDisplay || selectedOrder.orderDate || '-'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted block uppercase tracking-wider text-[10px]">Order Value</span>
                  <span className="text-slate-100 font-extrabold text-xs">₹{Number(selectedOrder.amount).toLocaleString('en-IN')}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted block uppercase tracking-wider text-[10px]">Customer Name</span>
                  <span className="text-slate-200 font-semibold text-xs">{selectedOrder.customerName}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted block uppercase tracking-wider text-[10px]">Phone Number</span>
                  <span className="text-slate-200 font-medium text-xs">{selectedOrder.phoneNumber}</span>
                </div>
              </div>

              <div className="border-t border-border/10 pt-3 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-muted block uppercase tracking-wider text-[10px]">City</span>
                    <span className="text-slate-200 font-medium">{selectedOrder.city || '-'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted block uppercase tracking-wider text-[10px]">State / Pincode</span>
                    <span className="text-slate-200 font-medium">{selectedOrder.state || '-'} ({normalizePincode(selectedOrder.pincode) || '-'})</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted block uppercase tracking-wider text-[10px]">Full Address</span>
                  <span className="text-slate-300 block bg-slate-950/60 p-2.5 rounded-xl border border-border/5">{selectedOrder.address || '-'}</span>
                </div>
              </div>

              <div className="border-t border-border/10 pt-3 space-y-1.5 text-xs">
                <span className="text-muted block uppercase tracking-wider text-[10px]">Product (SKU)</span>
                <p className="bg-slate-950 p-3 rounded-xl border border-border/5 text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">
                  {selectedOrder.products}
                </p>
              </div>
            </div>

            <div className="p-5 pt-0 border-t border-border/10 bg-slate-800/10 flex justify-between h-14 items-center">
              <span className="text-[10px] text-slate-500 font-medium">Uploaded: {selectedOrder.uploadedAt}</span>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Close
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
    </div>
  );
};
