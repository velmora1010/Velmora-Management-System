import * as XLSX from 'xlsx';
import type { 
  ColumnMapping, 
  PaymentModeCategory, 
  PriceInterpretationMode, 
  WebsiteConsolidatedOrder, 
  WebsiteOrderItem, 
  WebsiteRawOrderRow,
  WebsiteUploadBatch 
} from './types';
import type { OptionItem } from './components/MultiSelectDropdown';
import {
  MASTER_LOCATIONS,
  PINCODE_TO_LOCATION,
  CITY_ALIASES,
  STATE_ALIASES,
} from '../../../data/indiaLocations';

// ============================================================================
// 1. COLUMN MATCHING UTILITIES WITH PRECISE HEADER DETECTION
// ============================================================================

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    orderId: '',
    customerName: '',
    address: '',
    state: '',
    city: '',
    pincode: '',
    productName: '',
    quantity: '',
    offer: '',
    price: '',
    phone: '',
    paymentMode: '',
    orderDate: ''
  };

  const cleanHeaders = headers.map(h => h.trim());
  const lowerHeaders = cleanHeaders.map(h => h.toLowerCase());

  // 1. ORDER ID DETECTION
  const orderIdCandidates = [
    'order id', 'order_id', 'order number', 'order_number', 'order no', 'order_no', 'order #', 'order#', 'order', 'name'
  ];
  for (const candidate of orderIdCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.orderId = cleanHeaders[idx];
      break;
    }
  }

  // 2. CUSTOMER NAME DETECTION
  const nameCandidates = [
    'shipping name', 'shipping_name', 'shippingname',
    'billing name', 'billing_name', 'billingname',
    'customer name', 'customer_name', 'customername',
    'full name', 'full_name', 'fullname',
    'buyer name', 'buyer_name'
  ];
  for (const candidate of nameCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.customerName = cleanHeaders[idx];
      break;
    }
  }

  if (!mapping.customerName) {
    const idxCustomer = lowerHeaders.findIndex(h => h === 'customer');
    if (idxCustomer !== -1) {
      mapping.customerName = cleanHeaders[idxCustomer];
    } else {
      const idxName = lowerHeaders.findIndex(h => h === 'name');
      if (idxName !== -1 && cleanHeaders[idxName] !== mapping.orderId) {
        mapping.customerName = cleanHeaders[idxName];
      } else {
        const firstNameIdx = lowerHeaders.findIndex(h => ['shipping first name', 'billing first name', 'first name', 'first_name'].includes(h));
        if (firstNameIdx !== -1) {
          mapping.customerName = cleanHeaders[firstNameIdx];
        }
      }
    }
  }

  // 3. STATE DETECTION
  const stateCandidates = [
    'shipping province name', 'shipping_province_name',
    'shipping state', 'shipping_state',
    'shipping province', 'shipping_province',
    'billing province name', 'billing_province_name',
    'billing state', 'billing_state',
    'billing province', 'billing_province',
    'state', 'province', 'state/province', 'region'
  ];
  for (const candidate of stateCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.state = cleanHeaders[idx];
      break;
    }
  }

  // 4. ADDRESS DETECTION
  const addressCandidates = [
    'shipping address', 'shipping_address', 'shipping address 1', 'shipping address line 1',
    'billing address', 'billing_address',
    'address', 'address1', 'address 1', 'address line 1', 'street'
  ];
  for (const candidate of addressCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.address = cleanHeaders[idx];
      break;
    }
  }

  // 5. CITY DETECTION
  const cityCandidates = [
    'shipping city', 'shipping_city',
    'billing city', 'billing_city',
    'city', 'town'
  ];
  for (const candidate of cityCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.city = cleanHeaders[idx];
      break;
    }
  }

  // 6. PINCODE DETECTION
  const pincodeCandidates = [
    'shipping zip', 'shipping_zip', 'shipping postal code', 'shipping_postal_code',
    'billing zip', 'billing_zip',
    'pincode', 'postal code', 'postal_code', 'zip', 'zip code', 'zip_code'
  ];
  for (const candidate of pincodeCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.pincode = cleanHeaders[idx];
      break;
    }
  }

  // 7. PRODUCT NAME DETECTION
  const productCandidates = [
    'lineitem name', 'lineitem_name', 'item name', 'item_name',
    'product name', 'product_name', 'product', 'title', 'sku'
  ];
  for (const candidate of productCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.productName = cleanHeaders[idx];
      break;
    }
  }

  // 8. QUANTITY DETECTION
  const quantityCandidates = [
    'lineitem quantity', 'lineitem_quantity', 'quantity', 'qty', 'item quantity'
  ];
  for (const candidate of quantityCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.quantity = cleanHeaders[idx];
      break;
    }
  }

  // 9. OFFER / DISCOUNT DETECTION
  const offerCandidates = [
    'discount code', 'discount_code', 'coupon', 'coupon code', 'offer', 'promotion', 'discount'
  ];
  for (const candidate of offerCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.offer = cleanHeaders[idx];
      break;
    }
  }

  // 10. PRICE / AMOUNT DETECTION
  const priceCandidates = [
    'total', 'order total', 'order_total', 'total price', 'total_price',
    'grand total', 'grand_total', 'current total price', 'current_total_price',
    'total paid', 'total_paid', 'amount', 'net amount', 'net_amount',
    'price', 'lineitem price', 'lineitem_price', 'line price'
  ];
  for (const candidate of priceCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.price = cleanHeaders[idx];
      break;
    }
  }

  // 11. PHONE DETECTION
  const phoneCandidates = [
    'shipping phone', 'shipping_phone', 'billing phone', 'billing_phone',
    'phone', 'ph', 'mobile', 'contact', 'telephone', 'phone number'
  ];
  for (const candidate of phoneCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.phone = cleanHeaders[idx];
      break;
    }
  }

  // 12. PAYMENT MODE DETECTION
  const paymentCandidates = [
    'payment method', 'payment_method', 'paymentmethod',
    'payment mode', 'payment_mode', 'paymentmode',
    'payment gateway', 'payment_gateway', 'paymentgateway',
    'gateway',
    'financial status', 'financial_status', 'financialstatus',
    'payment status', 'payment_status', 'paymentstatus',
    'payment terms name', 'payment_terms_name', 'paymenttermsname',
    'cod/prepaid', 'cod', 'paid'
  ];
  for (const candidate of paymentCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.paymentMode = cleanHeaders[idx];
      break;
    }
  }

  if (!mapping.paymentMode) {
    const idxFallback = lowerHeaders.findIndex(h => 
      h.includes('payment') || h.includes('financial') || h.includes('gateway')
    );
    if (idxFallback !== -1) {
      mapping.paymentMode = cleanHeaders[idxFallback];
    }
  }

  // 13. ORDER DATE DETECTION
  const orderDateCandidates = [
    'order date', 'order_date', 'orderdate',
    'created at', 'created_at', 'createdat',
    'order created at', 'order_created_at',
    'created date', 'created_date',
    'created on', 'created_on',
    'processed at', 'processed_at',
    'date'
  ];
  for (const candidate of orderDateCandidates) {
    const idx = lowerHeaders.findIndex(h => h === candidate);
    if (idx !== -1) {
      mapping.orderDate = cleanHeaders[idx];
      break;
    }
  }

  return mapping;
}

// ============================================================================
// 2. TIMEZONE & DATE UTILITIES (Indian Standard Time Asia/Kolkata)
// ============================================================================

export function getTodayInBusinessTimezone(): string {
  try {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d); // Returns YYYY-MM-DD
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

export function normalizeOrderDate(rawVal: any, fallbackDate?: string): string {
  const fallback = fallbackDate || getTodayInBusinessTimezone();
  if (rawVal === null || rawVal === undefined) return fallback;
  const str = String(rawVal).replace(/^'/, '').trim();
  if (!str || str === '-' || str === 'undefined' || str === 'null') {
    return fallback;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Parse using Date object
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(parsed);
    } catch {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  return fallback;
}

export function formatSalesDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }
  }
  return dateStr;
}

export function formatSalesDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  }
  return dateStr;
}

export function shiftDateString(dateStr: string, daysDelta: number): string {
  const parts = (dateStr || getTodayInBusinessTimezone()).split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    dt.setDate(dt.getDate() + daysDelta);
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  }
  return getTodayInBusinessTimezone();
}

export function calculateDaysBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1;
  const p1 = startDate.split('-').map(Number);
  const p2 = endDate.split('-').map(Number);
  const dt1 = new Date(p1[0], p1[1] - 1, p1[2]);
  const dt2 = new Date(p2[0], p2[1] - 1, p2[2]);
  const diffTime = Math.abs(dt2.getTime() - dt1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Inclusive count
}

export function shiftDateRange(startDate: string, endDate: string, direction: -1 | 1): { startDate: string; endDate: string } {
  if (startDate === endDate) {
    const s = shiftDateString(startDate, direction);
    return { startDate: s, endDate: s };
  }
  const span = calculateDaysBetween(startDate, endDate);
  const delta = span * direction;
  return {
    startDate: shiftDateString(startDate, delta),
    endDate: shiftDateString(endDate, delta)
  };
}

export function formatDateRangeDisplay(startDate: string, endDate: string): string {
  if (!startDate) return '';
  if (!endDate || startDate === endDate) {
    return formatSalesDateDisplay(startDate);
  }
  return `${formatSalesDateShort(startDate)} - ${formatSalesDateShort(endDate)}`;
}

export function formatSectionDateHeader(title: string, startDate: string, endDate: string): string {
  if (!startDate) return title;
  if (!endDate || startDate === endDate) {
    return `${title} (${formatSalesDateShort(startDate).toUpperCase()})`;
  }
  return `${title} (${formatSalesDateShort(startDate).toUpperCase()} - ${formatSalesDateShort(endDate).toUpperCase()})`;
}

// ============================================================================
// 3. NORMALIZATION & HELPER UTILITIES
// ============================================================================

export function normalizeOrderId(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  str = str.replace(/[\r\n\t]/g, '').trim();
  return str;
}

export function normalizeIndianPhoneNumber(val: any): string {
  if (val === null || val === undefined) return '-';
  let str = String(val).replace(/^'/, '').trim();
  if (!str || str === '-' || str === 'undefined' || str === 'null') return '-';

  const digits = str.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  if (digits.length === 10) {
    return digits;
  }

  return digits || str;
}

export const formatPhoneNumber = normalizeIndianPhoneNumber;

export function normalizePaymentMode(val: any): PaymentModeCategory {
  if (val === null || val === undefined) return 'UNKNOWN';
  const str = String(val).replace(/^'/, '').trim().toLowerCase();
  if (!str || str === '-' || str === 'undefined' || str === 'null') return 'UNKNOWN';

  // COD Matching
  if (
    str === 'cod' ||
    str === 'cash on delivery' ||
    str === 'cash_on_delivery' ||
    str === 'c.o.d' ||
    str === 'c.o.d.' ||
    str === 'cash' ||
    str === 'pay on delivery' ||
    str === 'payment on delivery' ||
    str.includes('cash on delivery') ||
    str.includes('pay on delivery') ||
    str.includes('cash_on_delivery')
  ) {
    return 'COD';
  }

  // PREPAID Matching
  if (
    str === 'prepaid' ||
    str === 'paid' ||
    str === 'online' ||
    str === 'upi' ||
    str === 'card' ||
    str === 'credit card' ||
    str === 'debit card' ||
    str === 'net banking' ||
    str === 'netbanking' ||
    str === 'razorpay' ||
    str === 'cashfree' ||
    str === 'shopify payments' ||
    str === 'phonepe' ||
    str === 'google pay' ||
    str === 'gpay' ||
    str === 'paytm' ||
    str === 'bank transfer' ||
    str === 'manual payment' ||
    str === 'shopflo' ||
    str === 'shop flo' ||
    str === 'shop_flo' ||
    str === 'shop-flo' ||
    str.includes('shopflo') ||
    str.includes('shop flo') ||
    str.includes('shop_flo') ||
    str.includes('shop-flo') ||
    str.includes('razorpay') ||
    str.includes('cashfree') ||
    str.includes('upi') ||
    str.includes('card') ||
    str.includes('net banking') ||
    str.includes('netbanking') ||
    str.includes('paytm') ||
    str.includes('stripe') ||
    str.includes('phonepe') ||
    str.includes('gpay') ||
    str.includes('prepaid') ||
    str.includes('paid') ||
    str.includes('online') ||
    str.includes('shopify payments')
  ) {
    return 'PREPAID';
  }

  return 'UNKNOWN';
}

const STATE_NORMALIZATION_MAP: Record<string, string> = {
  'tn': 'Tamil Nadu',
  'tamil nadu': 'Tamil Nadu',
  'tamilnadu': 'Tamil Nadu',
  'ta': 'Tamil Nadu',
  'mh': 'Maharashtra',
  'maharashtra': 'Maharashtra',
  'ka': 'Karnataka',
  'karnataka': 'Karnataka',
  'kl': 'Kerala',
  'kerala': 'Kerala',
  'dl': 'Delhi',
  'delhi': 'Delhi',
  'new delhi': 'Delhi',
  'up': 'Uttar Pradesh',
  'uttar pradesh': 'Uttar Pradesh',
  'uttarpradesh': 'Uttar Pradesh',
  'ap': 'Andhra Pradesh',
  'andhra pradesh': 'Andhra Pradesh',
  'andhrapradesh': 'Andhra Pradesh',
  'tg': 'Telangana',
  'telangana': 'Telangana',
  'wb': 'West Bengal',
  'west bengal': 'West Bengal',
  'westbengal': 'West Bengal',
  'gj': 'Gujarat',
  'gujarat': 'Gujarat',
  'rj': 'Rajasthan',
  'rajasthan': 'Rajasthan',
  'mp': 'Madhya Pradesh',
  'madhya pradesh': 'Madhya Pradesh',
  'madhyapradesh': 'Madhya Pradesh',
  'hr': 'Haryana',
  'haryana': 'Haryana',
  'pb': 'Punjab',
  'punjab': 'Punjab',
  'br': 'Bihar',
  'bihar': 'Bihar',
  'od': 'Odisha',
  'odisha': 'Odisha',
  'orissa': 'Odisha',
  'or': 'Odisha',
  'as': 'Assam',
  'assam': 'Assam',
  'jh': 'Jharkhand',
  'jharkhand': 'Jharkhand',
  'cg': 'Chhattisgarh',
  'chhattisgarh': 'Chhattisgarh',
  'chattisgarh': 'Chhattisgarh',
  'uk': 'Uttarakhand',
  'uttarakhand': 'Uttarakhand',
  'uttaranchal': 'Uttarakhand',
  'hp': 'Himachal Pradesh',
  'himachal pradesh': 'Himachal Pradesh',
  'ga': 'Goa',
  'goa': 'Goa',
  'jk': 'Jammu & Kashmir',
  'jammu & kashmir': 'Jammu & Kashmir',
  'jammu and kashmir': 'Jammu & Kashmir',
  'py': 'Puducherry',
  'puducherry': 'Puducherry',
  'pondicherry': 'Puducherry',
  'ch': 'Chandigarh',
  'chandigarh': 'Chandigarh'
};

export function normalizeState(val: any): string {
  if (!val) return '-';
  let clean = String(val).replace(/^'/, '').trim();
  clean = clean.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ');
  if (!clean || clean === '-' || clean === 'undefined' || clean === 'null') return '-';

  const lower = clean.toLowerCase();
  if (STATE_NORMALIZATION_MAP[lower]) {
    return STATE_NORMALIZATION_MAP[lower];
  }

  return clean.replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeCity(val: any): string {
  if (!val) return '-';
  let clean = String(val).replace(/^'/, '').trim();
  clean = clean.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ');
  if (!clean || clean === '-' || clean === 'undefined' || clean === 'null') return '-';

  return clean.replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// 4. REUSABLE CARRY-FORWARD HELPERS & DERIVED PAYMENT STATUS ENGINE
// ============================================================================

export function firstValidValue<T>(rows: any[], getter: (r: any) => T | null | undefined): T | null {
  for (const r of rows) {
    const val = getter(r);
    if (val !== null && val !== undefined) {
      if (typeof val === 'string') {
        const clean = val.replace(/^'/, '').trim();
        if (clean && clean !== '-' && clean !== 'undefined' && clean !== 'null') {
          return clean as unknown as T;
        }
      } else {
        return val;
      }
    }
  }
  return null;
}

export function firstValidOrderAmount(rows: any[], priceColKey?: string): number {
  for (const r of rows) {
    let valStr = r.price !== undefined && r.price !== null ? String(r.price).trim() : '';

    const obj = r.raw_data || r;
    if ((!valStr || valStr === '-' || valStr === 'undefined') && priceColKey && obj[priceColKey] !== undefined) {
      valStr = String(obj[priceColKey]).trim();
    }

    if (!valStr || valStr === '-' || valStr === 'undefined') {
      for (const k of Object.keys(obj)) {
        const l = k.toLowerCase().trim();
        if (['total', 'order total', 'grand total', 'total price', 'amount', 'net amount', 'price'].includes(l)) {
          const v = obj[k];
          if (v !== undefined && v !== null && String(v).trim() !== '-' && String(v).trim() !== '') {
            valStr = String(v).trim();
            break;
          }
        }
      }
    }

    if (valStr && valStr !== '-' && valStr !== 'undefined') {
      const cleanNum = parseFloat(valStr.replace(/[^0-9.]/g, ''));
      if (!isNaN(cleanNum) && cleanNum > 0) {
        return Number(cleanNum.toFixed(2));
      }
    }
  }
  return 0;
}

export interface DerivedPaymentStatus {
  paymentMode: PaymentModeCategory;
  advancePaid: number;
  remainingPayable: number;
  sourcePaymentMethod: string;
  classificationReason: string;
}

export function derivePaymentStatus(
  rows: any[],
  finalOrderAmount: number,
  mappingPaymentKey?: string
): DerivedPaymentStatus {
  let sourcePaymentMethod = '';
  let paidAmountFound: number | null = null;
  let outstandingBalanceFound: number | null = null;

  for (const r of rows) {
    const obj = r.raw_data || r;

    // Detect Payment Method string
    if (!sourcePaymentMethod) {
      if (r.payment_mode && r.payment_mode !== '-' && r.payment_mode !== 'undefined') {
        sourcePaymentMethod = String(r.payment_mode).trim();
      } else if (mappingPaymentKey && obj[mappingPaymentKey]) {
        sourcePaymentMethod = String(obj[mappingPaymentKey]).trim();
      } else {
        for (const k of Object.keys(obj)) {
          const l = k.toLowerCase().trim();
          if (l === 'payment method' || l === 'payment_method' || l === 'gateway' || l.includes('payment') || l.includes('financial')) {
            const v = obj[k];
            if (v !== undefined && v !== null && String(v).trim() !== '-' && String(v).trim() !== '') {
              sourcePaymentMethod = String(v).trim();
              break;
            }
          }
        }
      }
    }

    // Detect Paid Amount
    if (paidAmountFound === null) {
      for (const k of Object.keys(obj)) {
        const l = k.toLowerCase().trim();
        if (l === 'paid amount' || l === 'total paid' || l === 'amount paid' || l === 'paid_amount') {
          const v = obj[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            const p = parseFloat(String(v).replace(/[^0-9.]/g, ''));
            if (!isNaN(p)) {
              paidAmountFound = p;
              break;
            }
          }
        }
      }
    }

    // Detect Outstanding Balance
    if (outstandingBalanceFound === null) {
      for (const k of Object.keys(obj)) {
        const l = k.toLowerCase().trim();
        if (l === 'outstanding balance' || l === 'outstanding_balance' || l === 'balance' || l === 'cod amount') {
          const v = obj[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            const p = parseFloat(String(v).replace(/[^0-9.]/g, ''));
            if (!isNaN(p)) {
              outstandingBalanceFound = p;
              break;
            }
          }
        }
      }
    }
  }

  const finalAmountPaise = Math.round(finalOrderAmount * 100);
  const methodLower = sourcePaymentMethod.toLowerCase();

  // 1. If Outstanding Balance is explicitly specified
  if (outstandingBalanceFound !== null) {
    const outstandingPaise = Math.round(outstandingBalanceFound * 100);
    const calculatedAdvance = Math.max(0, finalOrderAmount - outstandingBalanceFound);

    if (outstandingPaise === 0) {
      return {
        paymentMode: 'PREPAID',
        advancePaid: finalOrderAmount,
        remainingPayable: 0,
        sourcePaymentMethod,
        classificationReason: 'Outstanding balance is 0 (Full Paid)'
      };
    }

    if (outstandingPaise > 0 && calculatedAdvance > 0) {
      return {
        paymentMode: 'PARTIAL COD',
        advancePaid: Number(calculatedAdvance.toFixed(2)),
        remainingPayable: Number(outstandingBalanceFound.toFixed(2)),
        sourcePaymentMethod,
        classificationReason: `Advance paid ₹${calculatedAdvance}, remaining balance ₹${outstandingBalanceFound}`
      };
    }

    if (outstandingPaise >= finalAmountPaise && calculatedAdvance === 0) {
      return {
        paymentMode: 'COD',
        advancePaid: 0,
        remainingPayable: finalOrderAmount,
        sourcePaymentMethod,
        classificationReason: 'No advance paid, full amount outstanding on delivery'
      };
    }
  }

  // 2. If Paid Amount is explicitly specified
  if (paidAmountFound !== null) {
    const paidPaise = Math.round(paidAmountFound * 100);
    if (paidPaise >= finalAmountPaise) {
      return {
        paymentMode: 'PREPAID',
        advancePaid: finalOrderAmount,
        remainingPayable: 0,
        sourcePaymentMethod,
        classificationReason: 'Paid amount equals or exceeds order total'
      };
    }

    if (paidPaise > 0 && paidPaise < finalAmountPaise) {
      const rem = Number((finalOrderAmount - paidAmountFound).toFixed(2));
      return {
        paymentMode: 'PARTIAL COD',
        advancePaid: paidAmountFound,
        remainingPayable: rem,
        sourcePaymentMethod,
        classificationReason: `Partial advance ₹${paidAmountFound} paid, ₹${rem} remaining`
      };
    }
  }

  // 3. Payment Method based detection (Shopflo, COD, Prepaid Gateways)
  if (methodLower === 'cod' || methodLower.includes('cash on delivery') || methodLower.includes('pay on delivery')) {
    return {
      paymentMode: 'COD',
      advancePaid: 0,
      remainingPayable: finalOrderAmount,
      sourcePaymentMethod,
      classificationReason: 'Full Cash on Delivery'
    };
  }

  if (
    methodLower.includes('shopflo') ||
    methodLower.includes('shop flo') ||
    methodLower.includes('shop_flo') ||
    methodLower.includes('shop-flo')
  ) {
    if (finalAmountPaise > 10800) {
      const rem = Number((finalOrderAmount - 108).toFixed(2));
      return {
        paymentMode: 'PARTIAL COD',
        advancePaid: 108,
        remainingPayable: rem,
        sourcePaymentMethod,
        classificationReason: `Shopflo order: ₹108 advance paid, ₹${rem} remaining on delivery`
      };
    } else {
      return {
        paymentMode: 'PREPAID',
        advancePaid: finalOrderAmount,
        remainingPayable: 0,
        sourcePaymentMethod,
        classificationReason: 'Shopflo order paid in full'
      };
    }
  }

  const normalized = normalizePaymentMode(sourcePaymentMethod);
  if (normalized === 'PREPAID') {
    return {
      paymentMode: 'PREPAID',
      advancePaid: finalOrderAmount,
      remainingPayable: 0,
      sourcePaymentMethod,
      classificationReason: 'Online prepaid gateway payment confirmed'
    };
  }

  if (normalized === 'COD') {
    return {
      paymentMode: 'COD',
      advancePaid: 0,
      remainingPayable: finalOrderAmount,
      sourcePaymentMethod,
      classificationReason: 'Cash on delivery'
    };
  }

  return {
    paymentMode: 'UNKNOWN',
    advancePaid: 0,
    remainingPayable: finalOrderAmount,
    sourcePaymentMethod,
    classificationReason: 'Unrecognized payment method'
  };
}

// ============================================================================
// 5. CONSOLIDATION ENGINE WITH RELIABLE CARRY-FORWARD RESOLUTION
// ============================================================================

export function consolidateRawRows(
  rawRows: Record<string, any>[],
  mapping: ColumnMapping,
  priceMode: PriceInterpretationMode,
  batchId: string
): {
  consolidatedOrders: WebsiteConsolidatedOrder[];
  rawRowsProcessed: WebsiteRawOrderRow[];
  totalUniqueOrders: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateOrderCount: number;
  detectedOrderDates: string[];
} {
  const groupedOrders = new Map<string, any[]>();
  const rawRowsProcessed: WebsiteRawOrderRow[] = [];
  const detectedDatesSet = new Set<string>();

  let validRowCount = 0;
  let invalidRowCount = 0;

  const fallbackToday = getTodayInBusinessTimezone();

  rawRows.forEach((row, idx) => {
    const rawDataObj = row.raw_data || row;

    const rawOrderId = normalizeOrderId(row.order_id || rawDataObj[mapping.orderId]);
    const rawProductName = String(row.product_name || rawDataObj[mapping.productName] || '').trim();
    const rawQtyStr = String(row.quantity || rawDataObj[mapping.quantity] || '1').trim();
    const rawQty = parseInt(rawQtyStr, 10) || 1;

    // Detect row order date
    const rawDateVal = row.original_order_date || (mapping.orderDate ? rawDataObj[mapping.orderDate] : null);
    const normalizedRowDate = normalizeOrderDate(rawDateVal, fallbackToday);
    if (normalizedRowDate) {
      detectedDatesSet.add(normalizedRowDate);
    }

    const validationErrors: string[] = [];
    if (!rawOrderId) validationErrors.push('Missing Order ID');
    if (!rawProductName) validationErrors.push('Missing Product Name');

    const isValid = validationErrors.length === 0;
    if (isValid) {
      validRowCount++;
    } else {
      invalidRowCount++;
    }

    const rawRecord: WebsiteRawOrderRow = {
      id: row.id || crypto.randomUUID(),
      upload_batch_id: batchId,
      row_number: row.row_number || (idx + 1),
      raw_data: rawDataObj,
      order_id: rawOrderId || undefined,
      customer_name: String(row.customer_name || rawDataObj[mapping.customerName] || ''),
      product_name: rawProductName || undefined,
      quantity: rawQtyStr,
      price: String(row.price || rawDataObj[mapping.price] || ''),
      payment_mode: String(row.payment_mode || rawDataObj[mapping.paymentMode] || ''),
      order_date: normalizedRowDate,
      original_order_date: rawDateVal ? String(rawDateVal) : undefined,
      validation_status: isValid ? 'VALID' : 'INVALID',
      validation_errors: validationErrors.length > 0 ? validationErrors : undefined
    };

    rawRowsProcessed.push(rawRecord);

    if (isValid && rawOrderId) {
      if (!groupedOrders.has(rawOrderId)) {
        groupedOrders.set(rawOrderId, []);
      }
      groupedOrders.get(rawOrderId)!.push(rawRecord);
    }
  });

  const consolidatedOrders: WebsiteConsolidatedOrder[] = [];
  let duplicateOrderCount = 0;

  groupedOrders.forEach((rows, orderId) => {
    if (rows.length > 1) {
      duplicateOrderCount += (rows.length - 1);
    }

    const getFirstVal = (colKey?: string, propKey?: keyof WebsiteRawOrderRow, excludeVal?: string) => {
      for (const r of rows) {
        if (propKey && r[propKey] !== undefined && r[propKey] !== null) {
          const str = String(r[propKey]).replace(/^'/, '').trim();
          if (str && str !== '-' && str !== 'undefined' && str !== 'null' && str !== excludeVal) {
            return str;
          }
        }
        const obj = r.raw_data || r;
        if (colKey && obj[colKey] !== undefined && obj[colKey] !== null) {
          const str = String(obj[colKey]).replace(/^'/, '').trim();
          if (str && str !== '-' && str !== 'undefined' && str !== 'null' && str !== excludeVal) {
            return str;
          }
        }
      }
      return '';
    };

    const customerName = getFirstVal(mapping.customerName, 'customer_name', orderId) || '-';
    const address = getFirstVal(mapping.address) || '-';
    const rawState = getFirstVal(mapping.state);
    const state = normalizeState(rawState);
    const rawCity = getFirstVal(mapping.city);
    const city = normalizeCity(rawCity);
    const pincode = getFirstVal(mapping.pincode) || '-';
    const rawOffer = getFirstVal(mapping.offer);
    const offer = rawOffer || 'No Offer';

    const rawPhone = getFirstVal(mapping.phone);
    const phone = normalizeIndianPhoneNumber(rawPhone);

    const rawOrderDate = getFirstVal(mapping.orderDate, 'original_order_date');
    const orderDate = normalizeOrderDate(rawOrderDate, fallbackToday);

    const orderTotalPrice = firstValidOrderAmount(rows, mapping.price);
    const { 
      paymentMode, 
      advancePaid, 
      remainingPayable, 
      sourcePaymentMethod, 
      classificationReason 
    } = derivePaymentStatus(rows, orderTotalPrice, mapping.paymentMode);

    let dataConflict = false;
    let conflictDetails = '';

    if (rows.length > 1 && mapping.customerName) {
      const names = new Set(rows.map(r => String(r.customer_name || r.raw_data?.[mapping.customerName] || '').trim()).filter(Boolean));
      if (names.size > 1) {
        dataConflict = true;
        conflictDetails = `Conflicting customer names: ${Array.from(names).join(' vs ')}`;
      }
    }

    const productQtyMap = new Map<string, number>();
    const productOrderList: string[] = [];
    let orderTotalQuantity = 0;

    rows.forEach((r) => {
      const prodName = String(r.product_name || r.raw_data?.[mapping.productName] || '').trim() || 'Unknown Product';
      const qtyNum = parseInt(String(r.quantity || r.raw_data?.[mapping.quantity] || '1').trim(), 10) || 1;

      if (!productQtyMap.has(prodName)) {
        productQtyMap.set(prodName, 0);
        productOrderList.push(prodName);
      }
      productQtyMap.set(prodName, productQtyMap.get(prodName)! + qtyNum);
      orderTotalQuantity += qtyNum;
    });

    const consolidatedProductName = productOrderList.join(', ');

    const orderFormattedParts = productOrderList.map(prod => {
      const qty = productQtyMap.get(prod)!;
      return `${prod} × ${qty}`;
    });
    const orderFormatted = orderFormattedParts.join(' | ');

    const orderItems: WebsiteOrderItem[] = productOrderList.map(prod => ({
      id: crypto.randomUUID(),
      product_name: prod,
      quantity: productQtyMap.get(prod)!
    }));

    const orderRecord: WebsiteConsolidatedOrder = {
      id: crypto.randomUUID(),
      order_id: orderId,
      customer_name: customerName,
      address,
      state,
      city,
      pincode,
      order_formatted: orderFormatted,
      product_name: consolidatedProductName,
      total_quantity: orderTotalQuantity,
      offer,
      price: orderTotalPrice,
      phone,
      payment_mode: paymentMode,
      source_payment_mode: sourcePaymentMethod,
      source_payment_method: sourcePaymentMethod,
      advance_paid: advancePaid,
      remaining_payable: remainingPayable,
      payment_classification_reason: classificationReason,
      order_date: orderDate,
      original_order_date: rawOrderDate || undefined,
      upload_batch_id: batchId,
      data_conflict: dataConflict,
      conflict_details: conflictDetails || undefined,
      created_at: new Date().toISOString(),
      items: orderItems
    };

    consolidatedOrders.push(orderRecord);
  });

  const detectedOrderDates = Array.from(detectedDatesSet).sort();

  return {
    consolidatedOrders,
    rawRowsProcessed,
    totalUniqueOrders: consolidatedOrders.length,
    validRowCount,
    invalidRowCount,
    duplicateOrderCount,
    detectedOrderDates
  };
}

// ============================================================================
// 6. PARSER & EXPORTER UTILITIES
// ============================================================================

export async function parseFileToRawRows(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (jsonRows.length === 0) {
          reject(new Error('File contains no rows or empty sheet.'));
          return;
        }

        const headers = Object.keys(jsonRows[0]);
        resolve({ headers, rows: jsonRows });
      } catch (err: any) {
        reject(new Error(`Failed to parse file: ${err.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file from disk.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function exportOrdersToCSV(orders: WebsiteConsolidatedOrder[], fileName: string = 'Website_Consolidated_Orders.csv') {
  const exportRows = orders.map(o => ({
    'Order ID': o.order_id,
    'Order Date': o.order_date,
    'Customer Name': o.customer_name,
    'State': o.state,
    'City': o.city,
    'Pincode': o.pincode,
    'Order': o.order_formatted,
    'Product Name': o.product_name,
    'Quantity': o.total_quantity,
    'Offer': o.offer,
    'Price': o.price,
    'Payment Mode': o.payment_mode,
    'Advance Paid': o.advance_paid ?? 0,
    'Remaining COD': o.payment_mode === 'PREPAID' ? '-' : (o.remaining_payable ?? o.price),
    'Phone': o.phone
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportOrdersToXLSX(orders: WebsiteConsolidatedOrder[], fileName: string = 'Website_Consolidated_Orders.xlsx') {
  const exportRows = orders.map(o => ({
    'Order ID': o.order_id,
    'Order Date': o.order_date,
    'Customer Name': o.customer_name,
    'State': o.state,
    'City': o.city,
    'Pincode': o.pincode,
    'Order': o.order_formatted,
    'Product Name': o.product_name,
    'Quantity': o.total_quantity,
    'Offer': o.offer,
    'Price': o.price,
    'Payment Mode': o.payment_mode,
    'Advance Paid': o.advance_paid ?? 0,
    'Remaining COD': o.payment_mode === 'PREPAID' ? '-' : (o.remaining_payable ?? o.price),
    'Phone': o.phone
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidated Orders');
  XLSX.writeFile(workbook, fileName);
}

export function getUploadBatchesForAnalyticsPeriod(
  batches: WebsiteUploadBatch[],
  allOrders: WebsiteConsolidatedOrder[],
  startDate: string,
  endDate: string
): OptionItem[] {
  if (!batches || batches.length === 0) return [];

  // Group consolidated orders by upload_batch_id
  const ordersByBatch = new Map<string, WebsiteConsolidatedOrder[]>();
  allOrders.forEach(o => {
    if (!o.upload_batch_id) return;
    if (!ordersByBatch.has(o.upload_batch_id)) {
      ordersByBatch.set(o.upload_batch_id, []);
    }
    ordersByBatch.get(o.upload_batch_id)!.push(o);
  });

  const periodOptions: OptionItem[] = [];

  batches.forEach(b => {
    const batchOrders = ordersByBatch.get(b.id) || [];

    if (batchOrders.length > 0) {
      // Find orders in this batch falling strictly within [startDate, endDate]
      const ordersInPeriod = batchOrders.filter(o => {
        const d = o.order_date;
        return d && d >= startDate && d <= endDate;
      });

      if (ordersInPeriod.length > 0) {
        const datesInBatch = batchOrders.map(o => o.order_date).filter(Boolean).sort();
        const minDate = datesInBatch[0] || startDate;
        const maxDate = datesInBatch[datesInBatch.length - 1] || endDate;

        const dateRangeStr = minDate === maxDate
          ? formatSalesDateShort(minDate)
          : `${formatSalesDateShort(minDate)} – ${formatSalesDateShort(maxDate)}`;

        const countStr = `${ordersInPeriod.length} ${ordersInPeriod.length === 1 ? 'Order' : 'Orders'}`;
        const label = `${b.file_name} (${dateRangeStr} • ${countStr})`;

        periodOptions.push({
          label,
          value: b.id
        });
      }
    } else {
      // Fallback check if batch has no linked orders in allOrders
      const fallbackDate = b.order_date || (b.uploaded_at ? b.uploaded_at.split('T')[0] : '');
      if (fallbackDate && fallbackDate >= startDate && fallbackDate <= endDate) {
        const countStr = `${b.total_unique_orders || 0} Orders`;
        const label = `${b.file_name} (${formatSalesDateShort(fallbackDate)} • ${countStr})`;
        periodOptions.push({
          label,
          value: b.id
        });
      }
    }
  });

  return periodOptions;
}

export interface WebsitePaymentSummary {
  prepaidCount: number;
  prepaidRevenue: number;
  partialCodCount: number;
  partialCodRevenue: number;
  partialCodRemaining: number;
  fullCodCount: number;
  fullCodRevenue: number;
  fullCodPending: number;
  totalCodReceivable: number;
  unknownPaymentCount: number;
}

export function calculateWebsitePaymentSummary(orders: WebsiteConsolidatedOrder[]): WebsitePaymentSummary {
  const prepaidOrders = orders.filter(o => o.payment_mode === 'PREPAID');
  const partialCodOrders = orders.filter(o => o.payment_mode === 'PARTIAL COD');
  const fullCodOrders = orders.filter(o => o.payment_mode === 'COD');
  const unknownPaymentOrders = orders.filter(o => o.payment_mode === 'UNKNOWN');

  const prepaidCount = prepaidOrders.length;
  const prepaidRevenue = prepaidOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);

  const partialCodCount = partialCodOrders.length;
  const partialCodRevenue = partialCodOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const partialCodRemaining = partialCodOrders.reduce((sum, o) => sum + (Number(o.remaining_payable) || 0), 0);

  const fullCodCount = fullCodOrders.length;
  const fullCodRevenue = fullCodOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const fullCodPending = fullCodOrders.reduce((sum, o) => sum + (Number(o.remaining_payable ?? o.price) || 0), 0);

  const totalCodReceivable = partialCodRemaining + fullCodPending;
  const unknownPaymentCount = unknownPaymentOrders.length;

  return {
    prepaidCount,
    prepaidRevenue,
    partialCodCount,
    partialCodRevenue,
    partialCodRemaining,
    fullCodCount,
    fullCodRevenue,
    fullCodPending,
    totalCodReceivable,
    unknownPaymentCount
  };
}

// ============================================================================
// CANONICAL INDIA MASTER LOCATION SYSTEM
// ============================================================================

/**
 * Normalize a raw location text for key-comparison purposes.
 * - trim
 * - lowercase
 * - collapse whitespace
 * - strip harmless punctuation
 */
export function normalizeLocationText(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim().toLowerCase();
  return str.replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').replace(/\s+/g, '');
}

/**
 * Legacy alias – keep for backward compatibility with existing callers.
 * Delegates to normalizeLocationText.
 */
export function normalizeLocationKey(value: any): string {
  return normalizeLocationText(value);
}

/**
 * Resolve a raw state string to its canonical master stateKey.
 * Returns empty string if unresolvable.
 */
export function resolveStateKey(rawState: any): string {
  const norm = normalizeLocationText(rawState);
  if (!norm || norm === 'na' || norm === 'null' || norm === 'undefined' || norm === '-') return '';
  // Check exact key match
  if (MASTER_LOCATIONS[norm]) return norm;
  // Check state alias
  if (STATE_ALIASES[norm]) {
    const aliased = STATE_ALIASES[norm];
    if (MASTER_LOCATIONS[aliased]) return aliased;
  }
  // Try partial key scan for close match (e.g. "tamilnadu" already covered above)
  return '';
}

/**
 * Resolve a raw city string to its canonical master cityKey, optionally
 * constrained to a known stateKey.
 * Returns empty string if unresolvable.
 */
export function resolveCityKey(rawCity: any, stateKey?: string): string {
  const norm = normalizeLocationText(rawCity);
  if (!norm || norm === 'na' || norm === 'null' || norm === 'undefined' || norm === '-') return '';

  // Apply city alias first
  const aliasedCityKey = CITY_ALIASES[norm] ?? norm;

  if (stateKey && MASTER_LOCATIONS[stateKey]) {
    // Constrained search within state
    if (MASTER_LOCATIONS[stateKey].cities[aliasedCityKey]) return aliasedCityKey;
    if (MASTER_LOCATIONS[stateKey].cities[norm]) return norm;
  } else {
    // Global search: return first matching city key across all states
    for (const sk in MASTER_LOCATIONS) {
      if (MASTER_LOCATIONS[sk].cities[aliasedCityKey]) return aliasedCityKey;
      if (MASTER_LOCATIONS[sk].cities[norm]) return norm;
    }
  }
  return '';
}

export interface CanonicalLocation {
  stateKey: string;
  stateName: string;
  cityKey: string;
  cityName: string;
  pincode: string;
  matchMethod: 'pincode' | 'state+city' | 'alias' | 'unmatched';
}

/**
 * Resolve a raw sales order's state/city/pincode to canonical master values.
 *
 * Priority:
 *   1. Valid 6-digit pincode match in master data
 *   2. Exact normalized state + city match
 *   3. Alias match
 *   4. Unmatched (totals still preserved)
 */
export function resolveCanonicalLocation(
  rawState: any,
  rawCity: any,
  rawPincode: any
): CanonicalLocation {
  const pinStr = String(rawPincode || '').replace(/\D/g, '').trim();

  // 1. Pincode strongest signal
  if (pinStr.length === 6 && PINCODE_TO_LOCATION[pinStr]) {
    const { stateKey, cityKey } = PINCODE_TO_LOCATION[pinStr];
    const stateData = MASTER_LOCATIONS[stateKey];
    const cityData = stateData?.cities[cityKey];
    return {
      stateKey,
      stateName: stateData?.name ?? stateKey,
      cityKey,
      cityName: cityData?.name ?? cityKey,
      pincode: pinStr,
      matchMethod: 'pincode',
    };
  }

  // 2. State + City normalized match
  const resolvedStateKey = resolveStateKey(rawState);
  const resolvedCityKey = resolveCityKey(rawCity, resolvedStateKey || undefined);

  if (resolvedStateKey && resolvedCityKey) {
    const stateData = MASTER_LOCATIONS[resolvedStateKey];
    const cityData = stateData?.cities[resolvedCityKey];
    return {
      stateKey: resolvedStateKey,
      stateName: stateData?.name ?? resolvedStateKey,
      cityKey: resolvedCityKey,
      cityName: cityData?.name ?? resolvedCityKey,
      pincode: pinStr,
      matchMethod: CITY_ALIASES[normalizeLocationText(rawCity)] ? 'alias' : 'state+city',
    };
  }

  // 3. Partial: only state resolved
  if (resolvedStateKey) {
    const stateData = MASTER_LOCATIONS[resolvedStateKey];
    return {
      stateKey: resolvedStateKey,
      stateName: stateData?.name ?? resolvedStateKey,
      cityKey: '',
      cityName: '',
      pincode: pinStr,
      matchMethod: 'state+city',
    };
  }

  // 4. Unmatched
  return {
    stateKey: '',
    stateName: '',
    cityKey: '',
    cityName: '',
    pincode: pinStr,
    matchMethod: 'unmatched',
  };
}

/**
 * Get canonical state display name from MASTER_LOCATIONS.
 * Falls back to title-casing the raw value if not found.
 */
export function toCanonicalLocation(value: any): string {
  const rawStr = String(value || '').trim();
  const lower = rawStr.toLowerCase();
  if (!rawStr || lower === 'unspecified' || lower === 'na' || lower === 'n/a' || lower === 'null' || lower === 'undefined') {
    return 'Unspecified';
  }
  const stateKey = resolveStateKey(rawStr);
  if (stateKey && MASTER_LOCATIONS[stateKey]) {
    return MASTER_LOCATIONS[stateKey].name;
  }
  // Default fallback: Title Case
  const words = rawStr.replace(/\s+/g, ' ').split(' ');
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Get all canonical state options from master data for use in filter dropdowns.
 * Returns sorted list of { label, value } pairs.
 */
export function getMasterStateOptions(): Array<{ label: string; value: string }> {
  return Object.keys(MASTER_LOCATIONS)
    .map(key => ({ label: MASTER_LOCATIONS[key].name, value: MASTER_LOCATIONS[key].name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Get canonical city options for a given state name.
 * If no state is selected, returns an empty array (force state selection first).
 */
export function getMasterCityOptions(stateName: string): Array<{ label: string; value: string }> {
  if (!stateName) return [];
  const stateKey = resolveStateKey(stateName);
  if (!stateKey || !MASTER_LOCATIONS[stateKey]) return [];
  return Object.keys(MASTER_LOCATIONS[stateKey].cities)
    .map(cityKey => ({ label: MASTER_LOCATIONS[stateKey].cities[cityKey].name, value: MASTER_LOCATIONS[stateKey].cities[cityKey].name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Get canonical pincode options for a given state name and city name.
 */
export function getMasterPincodeOptions(stateName: string, cityName: string): Array<{ label: string; value: string }> {
  if (!stateName || !cityName) return [];
  const stateKey = resolveStateKey(stateName);
  if (!stateKey || !MASTER_LOCATIONS[stateKey]) return [];
  const cityKey = resolveCityKey(cityName, stateKey);
  if (!cityKey || !MASTER_LOCATIONS[stateKey].cities[cityKey]) return [];
  return (MASTER_LOCATIONS[stateKey].cities[cityKey].pincodes || [])
    .sort()
    .map(p => ({ label: p, value: p }));
}

/**
 * Check if a sales order matches a set of canonical filter selections.
 * Uses resolveCanonicalLocation so raw spelling variants are all caught.
 */
export function orderMatchesLocationFilter(
  order: { state?: string | null; city?: string | null; pincode?: string | null },
  selectedStates: string[],
  selectedCities: string[],
  selectedPincodes: string[]
): boolean {
  if (selectedStates.length === 0 && selectedCities.length === 0 && selectedPincodes.length === 0) {
    return true;
  }
  const resolved = resolveCanonicalLocation(order.state, order.city, order.pincode);

  if (selectedPincodes.length > 0 && resolved.pincode && selectedPincodes.includes(resolved.pincode)) {
    return true;
  }

  if (selectedStates.length > 0 || selectedCities.length > 0) {
    const stateMatch = selectedStates.length === 0 || selectedStates.includes(resolved.stateName);
    const cityMatch = selectedCities.length === 0 || selectedCities.includes(resolved.cityName);
    if (stateMatch && cityMatch && (selectedPincodes.length === 0 || (resolved.pincode && selectedPincodes.includes(resolved.pincode)))) {
      return true;
    }
  }

  if (selectedPincodes.length === 0 && selectedStates.length === 0 && selectedCities.length > 0) {
    return selectedCities.includes(resolved.cityName);
  }

  return false;
}

