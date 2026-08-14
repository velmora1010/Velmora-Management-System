export interface LogisticsImport {
  id?: number;
  fileName: string;
  uploadedAt: string;
  headers: string[];
  rows: any[][];
  rawCount?: number;
  savedCount?: number;
  duplicateCount?: number;
  skippedCount?: number;
  invalidDateCount?: number;
  missingDeliveredCount?: number;
  missingOrderCount?: number;
  parsedCount?: number;
  columnsDetected?: boolean;
}

export interface LogisticsOrder {
  id?: number;
  orderId: string;
  orderDate?: string;
  orderDateDisplay?: string;
  orderDateTooltip?: string;
  createdAtRaw?: string;
  createdAtDisplay?: string;
  customerName: string;
  phoneNumber: string;
  orderType: string;
  amount: string;
  products: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  awbNumber?: string;
  courier?: string;
  status?: string;
  stage: 'order_data' | 'tracking' | 'trash';
  uploadedAt: string;
  syncedAt?: string;
  trackingError?: string;
  lastFailedAt?: string;
  // Source tracking file fields
  sourceStatus?: string;
  sourceSubStatus?: string;
  lastEvent?: string;
  lastMileCourier?: string;
  syncState?: 'queued' | 'checking' | 'retrying' | 'idle';
}

export interface TrackingLog {
  id?: number;
  awb: string;
  courier: string;
  startedAt: string;
  finishedAt: string;
  duration: number; // in ms
  success: boolean;
  error?: string;
  rawResponse?: string;
}

export interface HistoricalDeliveryData {
  id?: number;
  pincode: string;
  state: string;
  courier: string;
  orderDate: string;
  deliveredDate: string;
  deliveryDays: number;
}

export interface DeliveryHistory {
  id?: number;
  orderNo?: string;
  pincode: string;
  state: string;
  courier: string;
  orderDate: string;
  orderDateRaw?: string;
  deliveredDate: string;
  deliveredDateRaw?: string;
  deliveryDays: number;
  sourceFileName: string;
  importedAt: string;
}
