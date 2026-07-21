import db from '../lib/db';
import { type DeliveryHistory } from '../types/logistics';
import { normalizePincode } from '../utils/pincodeUtils';

export interface CourierPerformance {
  courier: string;
  deliveredOrders: number;
  averageDeliveryDays: number;
  fastestDelivery: number;
  slowestDelivery: number;
}

export interface RecommendationDetail {
  matchType: 'Exact' | 'Nearest' | 'No Data';
  matchedPincode: string;
  recommendedCourier: string;
  averageDeliveryDays: number;
  deliveredOrdersCount: number;
  fastestCourier: string;
  performance: CourierPerformance[];
}

export function parseDate(dateVal: any): Date | null {
  if (dateVal === undefined || dateVal === null || dateVal === '') return null;
  if (dateVal instanceof Date) return dateVal;
  
  if (typeof dateVal === 'number') {
    if (dateVal >= 35000 && dateVal <= 60000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      return new Date(excelEpoch.getTime() + dateVal * 24 * 60 * 60 * 1000);
    }
    return null;
  }

  const str = String(dateVal).trim();
  if (str === '') return null;

  const parts = str.split(/\s+/);
  const datePart = parts[0];

  const dateSplit = datePart.split(/[/\-]/);
  if (dateSplit.length !== 3) return null;

  if (dateSplit[0].length === 4) {
    const year = parseInt(dateSplit[0], 10);
    const month = parseInt(dateSplit[1], 10);
    const day = parseInt(dateSplit[2], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return new Date(year, month - 1, day, 0, 0, 0);
    }
  } else {
    const day = parseInt(dateSplit[0], 10);
    const month = parseInt(dateSplit[1], 10);
    const year = parseInt(dateSplit[2], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return new Date(year, month - 1, day, 0, 0, 0);
    }
  }

  return null;
}

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function extractDateOnly(value: any): string {
  if (value === undefined || value === null || value === '') return "-";
  
  const text = String(value).trim();
  if (!text || text === '-' || text === 'None') return "-";

  // Take only the first space-separated part (removing time components)
  const firstPart = text.split(/\s+/)[0];

  // Standardize separator to '-'
  const standardized = firstPart.replace(/\//g, '-');

  // Split by '-'
  const parts = standardized.split('-');
  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];

    // Handle YYYY-MM-DD -> DD-MM-YYYY
    if (day.length === 4) {
      const temp = day;
      day = year;
      year = temp;
    }

    // Pad single digits with leading zero
    if (day.length === 1) {
      day = '0' + day;
    }
    if (month.length === 1) {
      month = '0' + month;
    }
    
    // If year is 2 digits, convert to 4 digits (e.g. "26" -> "2026")
    if (year.length === 2) {
      year = '20' + year;
    }

    const dNum = parseInt(day, 10);
    const mNum = parseInt(month, 10);
    const yNum = parseInt(year, 10);
    
    if (!isNaN(dNum) && !isNaN(mNum) && !isNaN(yNum) && dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12 && yNum >= 1900 && yNum <= 2100) {
      return `${day}-${month}-${year}`;
    }
  }

  return firstPart;
}

export function calculateDeliveryDays(orderDateVal: any, deliveredDateVal: any): number {
  const oStr = extractDateOnly(orderDateVal);
  const dStr = extractDateOnly(deliveredDateVal);
  
  if (oStr === '-' || dStr === '-') return -1;

  // Check if both dates match exact format DD-MM-YYYY
  if (!oStr.match(/^\d{2}-\d{2}-\d{4}$/) || !dStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
    return -1;
  }

  // Manual split of "DD-MM-YYYY"
  const oParts = oStr.split('-');
  const dParts = dStr.split('-');

  const oDay = parseInt(oParts[0], 10);
  const oMonth = parseInt(oParts[1], 10);
  const oYear = parseInt(oParts[2], 10);

  const dDay = parseInt(dParts[0], 10);
  const dMonth = parseInt(dParts[1], 10);
  const dYear = parseInt(dParts[2], 10);

  const oDate = new Date(oYear, oMonth - 1, oDay);
  const dDate = new Date(dYear, dMonth - 1, dDay);

  const diffTime = dDate.getTime() - oDate.getTime();
  if (diffTime < 0) return -1;

  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export async function findExactPincodeHistory(pincode: string): Promise<DeliveryHistory[]> {
  const cleanPin = normalizePincode(pincode);
  if (!cleanPin) return [];
  return await db.delivery_history.where('pincode').equals(cleanPin).toArray();
}

export async function findNearestPincodeHistory(pincode: string, state: string): Promise<{ matchedPincode: string; history: DeliveryHistory[] } | null> {
  const targetPinNum = parseInt(normalizePincode(pincode), 10);
  const cleanState = state.trim();
  if (isNaN(targetPinNum) || !cleanState) return null;

  const stateData = await db.delivery_history.where('state').equals(cleanState).toArray();
  if (stateData.length === 0) return null;

  let minDiff = Infinity;
  let nearestPincode = '';

  for (const item of stateData) {
    const pinNum = parseInt(item.pincode, 10);
    if (!isNaN(pinNum)) {
      const diff = Math.abs(pinNum - targetPinNum);
      if (diff < minDiff) {
        minDiff = diff;
        nearestPincode = item.pincode;
      }
    }
  }

  if (!nearestPincode) return null;

  const history = stateData.filter(item => item.pincode === nearestPincode);
  return { matchedPincode: nearestPincode, history };
}

export function calculateCourierPerformance(history: DeliveryHistory[]): CourierPerformance[] {
  const groups: Record<string, number[]> = {};
  for (const item of history) {
    const courier = item.courier || 'Unknown';
    if (!groups[courier]) {
      groups[courier] = [];
    }
    groups[courier].push(item.deliveryDays);
  }

  const performance: CourierPerformance[] = [];
  for (const courier in groups) {
    const daysList = groups[courier];
    const deliveredOrders = daysList.length;
    const sum = daysList.reduce((a, b) => a + b, 0);
    const averageDeliveryDays = parseFloat((sum / deliveredOrders).toFixed(1));
    const fastestDelivery = Math.min(...daysList);
    const slowestDelivery = Math.max(...daysList);

    performance.push({
      courier,
      deliveredOrders,
      averageDeliveryDays,
      fastestDelivery,
      slowestDelivery
    });
  }

  return performance.sort((a, b) => a.averageDeliveryDays - b.averageDeliveryDays);
}

export async function getBestCourierRecommendation(pincode: string, state: string): Promise<RecommendationDetail> {
  const cleanPin = normalizePincode(pincode);
  const cleanState = (state || '').trim();
  
  if (!cleanPin) {
    return {
      matchType: 'No Data',
      matchedPincode: '',
      recommendedCourier: 'N/A',
      averageDeliveryDays: 0,
      deliveredOrdersCount: 0,
      fastestCourier: 'N/A',
      performance: []
    };
  }

  const exactHistory = await findExactPincodeHistory(cleanPin);
  
  if (exactHistory.length > 0) {
    const performance = calculateCourierPerformance(exactHistory);
    const best = performance[0];
    const sortedByFastest = [...performance].sort((a, b) => a.fastestDelivery - b.fastestDelivery);
    const fastest = sortedByFastest[0]?.courier || '';

    return {
      matchType: 'Exact',
      matchedPincode: cleanPin,
      recommendedCourier: best.courier,
      averageDeliveryDays: best.averageDeliveryDays,
      deliveredOrdersCount: exactHistory.length,
      fastestCourier: fastest,
      performance
    };
  }

  if (cleanState) {
    const nearestResult = await findNearestPincodeHistory(cleanPin, cleanState);
    if (nearestResult && nearestResult.history.length > 0) {
      const performance = calculateCourierPerformance(nearestResult.history);
      const best = performance[0];
      const sortedByFastest = [...performance].sort((a, b) => a.fastestDelivery - b.fastestDelivery);
      const fastest = sortedByFastest[0]?.courier || '';

      return {
        matchType: 'Nearest',
        matchedPincode: nearestResult.matchedPincode,
        recommendedCourier: best.courier,
        averageDeliveryDays: best.averageDeliveryDays,
        deliveredOrdersCount: nearestResult.history.length,
        fastestCourier: fastest,
        performance
      };
    }
  }

  return {
    matchType: 'No Data',
    matchedPincode: '',
    recommendedCourier: 'N/A',
    averageDeliveryDays: 0,
    deliveredOrdersCount: 0,
    fastestCourier: 'N/A',
    performance: []
  };
}

export interface MappedRow {
  orderId: string;
  customerName: string;
  pincode: string;
  orderDate: string;
  city: string;
  state: string;
  deliveryDate: string;
  courier: string;
  deliveryDays: number | string;
}

export interface ColumnMapping {
  orderNoIdx: number;
  customerNameIdx: number;
  pincodeIdx: number;
  orderDateIdx: number;
  cityIdx: number;
  stateIdx: number;
  deliveredDateIdx: number;
  courierIdx: number;
  statusIdx: number;
}

export function detectColumns(headers: string[]): ColumnMapping {
  const h = headers.map(v => String(v || '').trim().toLowerCase());

  // Hard-coded exact mappings, completely stopping guessing
  return {
    orderNoIdx: h.indexOf("order number"),
    customerNameIdx: h.indexOf("customer name"),
    pincodeIdx: h.indexOf("customer pincode"),
    orderDateIdx: h.indexOf("order date"),
    cityIdx: h.indexOf("customer city"),
    stateIdx: h.indexOf("customer state"),
    deliveredDateIdx: h.indexOf("order delivered date"),
    courierIdx: h.indexOf("courier company"),
    statusIdx: h.indexOf("order status")
  };
}

function cellStr(row: any[], idx: number): string {
  if (idx === -1) return '';
  const v = row[idx];
  return v !== undefined && v !== null ? String(v).trim() : '';
}

function cleanOrderId(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val).replace(/^'+/, '').trim();
}

function getFirstNonEmptyVal(groupRows: any[][], colIdx: number): any {
  if (colIdx === -1) return '';
  for (const r of groupRows) {
    const val = r[colIdx];
    if (val !== undefined && val !== null) {
      const s = String(val).trim();
      if (s !== '' && s !== '-' && s !== 'None') {
        return val;
      }
    }
  }
  return groupRows[0] ? groupRows[0][colIdx] : '';
}

export function scoreRow(row: any[], cols: ColumnMapping): number {
  let score = 0;
  const orderId = cellStr(row, cols.orderNoIdx);
  if (!orderId) return -1; // Blank row gets lowest score

  const customerName = cellStr(row, cols.customerNameIdx);
  const pincode = cellStr(row, cols.pincodeIdx);
  const orderDate = cellStr(row, cols.orderDateIdx);
  const deliveredDate = cellStr(row, cols.deliveredDateIdx);
  const courier = cellStr(row, cols.courierIdx);

  // Priority row selection weights:
  if (deliveredDate) score += 100; // Prefer row where "Order Delivered Date" is not empty
  if (orderDate) score += 50;      // Prefer row where "Order Date" is not empty
  
  if (customerName) score += 10;
  if (pincode) score += 10;
  if (courier) score += 10;

  return score;
}

export function mapRow(row: any[], cols: ColumnMapping): MappedRow | null {
  const pincode = normalizePincode(cellStr(row, cols.pincodeIdx));
  const courier = cellStr(row, cols.courierIdx);
  const rawOrderDate = cols.orderDateIdx !== -1 ? row[cols.orderDateIdx] : undefined;
  const rawDelivDate = cols.deliveredDateIdx !== -1 ? row[cols.deliveredDateIdx] : undefined;

  const orderDisplay = extractDateOnly(rawOrderDate);
  const delivDisplay = extractDateOnly(rawDelivDate);

  const deliveryDays = calculateDeliveryDays(rawOrderDate, rawDelivDate);

  let displayDays: number | string = '-';
  if (orderDisplay !== '-' && delivDisplay !== '-') {
    if (deliveryDays < 0) {
      displayDays = "Invalid Dates";
    } else {
      displayDays = deliveryDays;
    }
  } else {
    displayDays = '-';
  }

  return {
    orderId: cellStr(row, cols.orderNoIdx),
    customerName: cellStr(row, cols.customerNameIdx),
    pincode,
    orderDate: orderDisplay,
    city: cellStr(row, cols.cityIdx),
    state: cellStr(row, cols.stateIdx),
    deliveryDate: delivDisplay,
    courier,
    deliveryDays: displayDays
  };
}

export function mapAllRows(headers: string[], rows: any[][]): { cols: ColumnMapping; mapped: MappedRow[] } {
  const cols = detectColumns(headers);
  if (cols.pincodeIdx === -1 || cols.courierIdx === -1 || cols.orderDateIdx === -1 || cols.deliveredDateIdx === -1) {
    return { cols, mapped: [] };
  }

  // Step 1: Immediately map raw rows to an intermediate structure before grouping
  const intermediateRows = rows.map((row) => {
    const rawOrderId = cols.orderNoIdx !== -1 ? row[cols.orderNoIdx] : undefined;
    const rawOrderDate = cols.orderDateIdx !== -1 ? row[cols.orderDateIdx] : undefined;
    const rawDeliveryDate = cols.deliveredDateIdx !== -1 ? row[cols.deliveredDateIdx] : undefined;

    const orderId = cleanOrderId(rawOrderId);
    const orderDateDisplay = extractDateOnly(rawOrderDate);
    const deliveryDateDisplay = extractDateOnly(rawDeliveryDate);

    return {
      row,
      orderId,
      orderDateDisplay,
      deliveryDateDisplay
    };
  });

  // Step 2: Group by orderId (case-insensitive, trimmed)
  const rowsByOrderId: Record<string, typeof intermediateRows> = {};
  for (const item of intermediateRows) {
    if (!item.orderId) continue;
    const key = item.orderId.toLowerCase().trim();
    if (!rowsByOrderId[key]) {
      rowsByOrderId[key] = [];
    }
    rowsByOrderId[key].push(item);
  }

  const mapped: MappedRow[] = [];

  for (const orderKey in rowsByOrderId) {
    const groupItems = rowsByOrderId[orderKey];
    
    // Find the first non-empty deliveryDateDisplay and orderDateDisplay
    let finalDeliveryDate = "-";
    for (const item of groupItems) {
      if (item.deliveryDateDisplay && item.deliveryDateDisplay !== "-") {
        finalDeliveryDate = item.deliveryDateDisplay;
        break;
      }
    }

    let finalOrderDate = "-";
    for (const item of groupItems) {
      if (item.orderDateDisplay && item.orderDateDisplay !== "-") {
        finalOrderDate = item.orderDateDisplay;
        break;
      }
    }

    // Merge all duplicate rows by taking the first non-empty value for each column index
    const mergedRow: any[] = [];
    const numCols = headers.length;
    const groupRowsOnly = groupItems.map(item => item.row);
    for (let i = 0; i < numCols; i++) {
      mergedRow.push(getFirstNonEmptyVal(groupRowsOnly, i));
    }

    // Step 4: Validate #2701
    if (orderKey === '2701') {
      let hasTargetRawDate = false;
      for (const item of groupItems) {
        const rawDeliv = cols.deliveredDateIdx !== -1 ? item.row[cols.deliveredDateIdx] : undefined;
        const cleanRaw = rawDeliv ? String(rawDeliv).trim() : '';
        if (cleanRaw === "02-06-2026 22:16:31" || cleanRaw === "2-6-26 22:16:31" || cleanRaw === "2-6-26") {
          hasTargetRawDate = true;
        }
      }
      if (hasTargetRawDate && finalDeliveryDate !== "02-06-2026") {
        console.error("2701 delivery date mapping failed");
      }
    }

    // Debug logging for Order ID 2701
    if (orderKey === '2701') {
      console.log("=== DEBUG LOG FOR ORDER ID 2701 (mapAllRows) ===");
      console.table(groupItems.map(item => ({
        "Order Number": item.orderId,
        "Order Date": item.row[cols.orderDateIdx],
        "Order Delivered Date": item.row[cols.deliveredDateIdx],
        "mapped deliveryDateDisplay": item.deliveryDateDisplay
      })));
      console.log("final merged row for 2701:", mergedRow);
      console.log("==================================================");
    }

    const mr = mapRow(mergedRow, cols);
    if (mr) {
      mr.orderDate = finalOrderDate;
      mr.deliveryDate = finalDeliveryDate;
      const deliveryDays = calculateDeliveryDays(finalOrderDate, finalDeliveryDate);
      mr.deliveryDays = (finalOrderDate !== '-' && finalDeliveryDate !== '-') ? (deliveryDays >= 0 ? deliveryDays : "Invalid Dates") : '-';
      mapped.push(mr);
    }
  }

  return { cols, mapped };
}

export async function importHistoricalData(
  headers: string[],
  rows: any[][],
  fileName: string
): Promise<{
  rawCount: number;
  savedCount: number;
  duplicateCount: number;
  skippedCount: number;
  invalidDateCount: number;
  missingDeliveredCount: number;
  missingOrderCount: number;
  parsedCount: number;
  columnsDetected: boolean;
}> {

  const cols = detectColumns(headers);

  if (cols.pincodeIdx === -1 || cols.courierIdx === -1 || cols.orderDateIdx === -1 || cols.deliveredDateIdx === -1) {
    return { 
      rawCount: rows.length, 
      savedCount: 0, 
      duplicateCount: 0, 
      skippedCount: rows.length, 
      invalidDateCount: 0,
      missingDeliveredCount: 0,
      missingOrderCount: 0,
      parsedCount: 0,
      columnsDetected: false 
    };
  }

  // Step 1: Immediately map raw rows to an intermediate structure before grouping
  const intermediateRows = rows.map((row) => {
    const rawOrderId = cols.orderNoIdx !== -1 ? row[cols.orderNoIdx] : undefined;
    const rawOrderDate = cols.orderDateIdx !== -1 ? row[cols.orderDateIdx] : undefined;
    const rawDeliveryDate = cols.deliveredDateIdx !== -1 ? row[cols.deliveredDateIdx] : undefined;

    const orderId = cleanOrderId(rawOrderId);
    const orderDateDisplay = extractDateOnly(rawOrderDate);
    const deliveryDateDisplay = extractDateOnly(rawDeliveryDate);

    return {
      row,
      orderId,
      orderDateDisplay,
      deliveryDateDisplay
    };
  });

  // Step 2: Group by orderId (case-insensitive, trimmed)
  const rowsByOrderId: Record<string, typeof intermediateRows> = {};
  let emptyOrderNoCount = 0;

  for (const item of intermediateRows) {
    if (!item.orderId) {
      emptyOrderNoCount++;
      continue;
    }
    const key = item.orderId.toLowerCase().trim();
    if (!rowsByOrderId[key]) {
      rowsByOrderId[key] = [];
    }
    rowsByOrderId[key].push(item);
  }

  const selectedRows: any[][] = [];
  const groupFinalDates: { orderId: string; orderDate: string; deliveryDate: string }[] = [];
  let duplicateCount = 0;

  for (const orderKey in rowsByOrderId) {
    const groupItems = rowsByOrderId[orderKey];
    const N = groupItems.length;
    duplicateCount += (N - 1);

    // Find the first non-empty deliveryDateDisplay and orderDateDisplay
    let finalDeliveryDate = "-";
    for (const item of groupItems) {
      if (item.deliveryDateDisplay && item.deliveryDateDisplay !== "-") {
        finalDeliveryDate = item.deliveryDateDisplay;
        break;
      }
    }

    let finalOrderDate = "-";
    for (const item of groupItems) {
      if (item.orderDateDisplay && item.orderDateDisplay !== "-") {
        finalOrderDate = item.orderDateDisplay;
        break;
      }
    }

    // Merge all duplicate rows by taking the first non-empty value for each column index
    const mergedRow: any[] = [];
    const numCols = headers.length;
    const groupRowsOnly = groupItems.map(item => item.row);
    for (let i = 0; i < numCols; i++) {
      mergedRow.push(getFirstNonEmptyVal(groupRowsOnly, i));
    }

    // Step 4: Validate #2701
    if (orderKey === '2701') {
      let hasTargetRawDate = false;
      for (const item of groupItems) {
        const rawDeliv = cols.deliveredDateIdx !== -1 ? item.row[cols.deliveredDateIdx] : undefined;
        const cleanRaw = rawDeliv ? String(rawDeliv).trim() : '';
        if (cleanRaw === "02-06-2026 22:16:31" || cleanRaw === "2-6-26 22:16:31" || cleanRaw === "2-6-26") {
          hasTargetRawDate = true;
        }
      }
      if (hasTargetRawDate && finalDeliveryDate !== "02-06-2026") {
        console.error("2701 delivery date mapping failed");
      }
    }

    // Debug logging for Order ID 2701
    if (orderKey === '2701') {
      console.log("=== DEBUG LOG FOR ORDER ID 2701 (importHistoricalData) ===");
      console.table(groupItems.map(item => ({
        "Order Number": item.orderId,
        "Order Date": item.row[cols.orderDateIdx],
        "Order Delivered Date": item.row[cols.deliveredDateIdx],
        "mapped deliveryDateDisplay": item.deliveryDateDisplay
      })));
      console.log("final merged row for 2701:", mergedRow);
      console.log("========================================================");
    }

    selectedRows.push(mergedRow);
    groupFinalDates.push({
      orderId: orderKey,
      orderDate: finalOrderDate,
      deliveryDate: finalDeliveryDate
    });
  }

  let savedCount = 0;
  let invalidDateCount = 0;
  let missingOrderCount = 0;
  let missingDeliveredCount = 0;
  let parsedCount = 0;
  
  const recordsToInsert: DeliveryHistory[] = [];
  const importedAt = new Date().toLocaleString();

  console.log("=== HARD-CODED MAPPED IMPORT LOGS ===");

  for (let idx = 0; idx < selectedRows.length; idx++) {
    const row = selectedRows[idx];
    const finalDates = groupFinalDates[idx];
    
    const orderId = finalDates.orderId;
    const orderDisplay = finalDates.orderDate;
    const delivDisplay = finalDates.deliveryDate;

    if (orderDisplay === '-' || orderDisplay === '') {
      missingOrderCount++;
    }
    if (delivDisplay === '-' || delivDisplay === '') {
      missingDeliveredCount++;
    }

    if (orderDisplay !== '-' && orderDisplay !== '' && delivDisplay !== '-' && delivDisplay !== '') {
      parsedCount++;
      const deliveryDays = calculateDeliveryDays(orderDisplay, delivDisplay);
      
      const displayDaysStr = deliveryDays >= 0 ? `${deliveryDays} days` : "Invalid Dates";

      console.log(`Order ID: ${orderId}`);
      console.log(`  Raw Order Date: ${orderDisplay}`);
      console.log(`  Raw Order Delivered Date: ${delivDisplay}`);
      console.log(`  Mapped Delivery Date shown in table: ${delivDisplay}`);
      console.log(`  Delivery Days: ${displayDaysStr}`);

      if (deliveryDays < 0) {
        invalidDateCount++;
      } else {
        recordsToInsert.push({
          orderNo: orderId,
          pincode: normalizePincode(cellStr(row, cols.pincodeIdx)),
          state: cellStr(row, cols.stateIdx),
          courier: cellStr(row, cols.courierIdx),
          orderDate: orderDisplay,
          orderDateRaw: orderDisplay,
          deliveredDate: delivDisplay,
          deliveredDateRaw: delivDisplay,
          deliveryDays,
          sourceFileName: fileName,
          importedAt
        });
        savedCount++;
      }
    } else {
      console.log(`Order ID: ${orderId}`);
      console.log(`  Raw Order Date: ${orderDisplay}`);
      console.log(`  Raw Order Delivered Date: ${delivDisplay}`);
      console.log(`  Mapped Delivery Date shown in table: -`);
      console.log(`  Delivery Days: -`);
    }
  }
  
  console.log("=====================================");

  if (recordsToInsert.length > 0) {
    await db.delivery_history.bulkAdd(recordsToInsert);
  }

  return {
    rawCount: rows.length,
    savedCount,
    duplicateCount,
    skippedCount: emptyOrderNoCount + missingOrderCount + missingDeliveredCount + invalidDateCount,
    invalidDateCount,
    missingDeliveredCount,
    missingOrderCount,
    parsedCount,
    columnsDetected: true
  };
}
