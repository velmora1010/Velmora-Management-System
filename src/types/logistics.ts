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
  stage: 'active' | 'fulfilled' | 'pending' | 'prepare_dispatch' | 'dispatched' | 'order_data' | 'tracking' | 'trash' | 'archived_legacy';
  uploadedAt: string;
  syncedAt?: string;
  archivedAt?: string;
  archiveReason?: string;
  previousStage?: string;
  dispatchDate?: string;
  estimatedDeliveryDate?: string;
  deliveredDate?: string;
  fulfilledDate?: string;
  sourceFulfillmentStatus?: string;
  remarks?: string;
  trackingError?: string;
  lastFailedAt?: string;
  // Source tracking file fields
  sourceStatus?: string;
  sourceSubStatus?: string;
  lastEvent?: string;
  lastMileCourier?: string;
  // Batch & fulfillment metadata
  batchId?: string;
  batchName?: string;
  fulfillmentStatus?: string;
  financialStatus?: string;
  lineItemsSummary?: string;
  syncState?: 'queued' | 'checking' | 'retrying' | 'idle';
  cancellationStatus?: 'Requested' | 'Approved' | 'Rejected' | 'Completed' | string;
  cancellationReason?: string;
  cancellationNotes?: string;
  cancellationRequestedAt?: string;
  cancellationRequestedBy?: string;
  cancellationConfirmedAt?: string;
  cancellationConfirmedBy?: string;
  cancellationDate?: string;
  previousShipmentStatus?: string;
  cancellation?: any;
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
