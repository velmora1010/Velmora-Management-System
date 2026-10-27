/**
 * Types and interfaces for the Delhivery One dedicated import workflow.
 */

export interface DelhiveryRawRow {
  Waybill?: string;
  'Reference No.'?: string;
  Client?: string;
  'Master Waybill Number'?: string;
  'Seller Name'?: string;
  'Pickup Location Name'?: string;
  'Pick Up Date'?: string;
  'Origin Center'?: string;
  'Consignee Name'?: string;
  City?: string;
  'Destination State'?: string;
  PIN?: string;
  'Consignee Address Score'?: string;
  'Product Description'?: string;
  Type?: string;
  Amount?: string | number;
  'COD Amount'?: string | number;
  'MPS Amount'?: string | number;
  'Status Type'?: string;
  'Current Status'?: string;
  Remarks?: string;
  'Pending / Returned Remarks'?: string;
  'Action Date'?: string;
  'Promised Delivery Date'?: string;
  'Estimated Delivery Date'?: string;
  'Delivered Date'?: string;
  'First Bagging Date'?: string;
  'Risk Of Return'?: string;
  'Dispatch Count'?: string | number;
  'Attempt count'?: string | number;
  'Shipment Type'?: string;
  MOT?: string;
  [key: string]: any;
}

export interface DelhiveryNormalizedRecord {
  rowNumber: number;
  waybill: string;
  referenceNo: string;
  cleanReferenceNo: string;
  client: string;
  sellerName: string;
  pickupLocation: string;
  originCenter: string;
  consigneeName: string;
  city: string;
  state: string;
  pincode: string;
  addressScore?: string;
  productDescription: string;
  paymentMode: 'PREPAID' | 'COD' | 'UNKNOWN';
  amount: number;
  codAmount: number | null;
  statusType: string;
  currentStatus: string;
  canonicalStatus: string;
  salesDispatchStatus: 'DELIVERED' | 'DISPATCHED' | 'RTO' | 'CANCELLED' | 'UNFULFILLED';
  logisticsStage: 'fulfilled' | 'dispatched' | 'tracking' | 'trash';
  fulfillmentStatus: 'fulfilled' | 'unfulfilled';
  remarks: string;
  pendingReturnedRemarks: string;
  pickUpDate: string;
  estimatedDeliveryDate: string;
  deliveredDate: string;
  riskOfReturn: string;
  dispatchCount: number;
  attemptCount: number;
  mot: 'Surface' | 'Express' | string;
  masterWaybillNumber?: string;
  mpsAmount?: number;
  isExistingInDb?: boolean;
  matchedSalesOrderId?: string;
  isValid: boolean;
  validationError?: string;
}

export interface DelhiveryValidationResult {
  fileName: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateWaybillCount: number;
  missingWaybillCount: number;
  existingDbWaybillCount: number;
  matchedSalesOrderCount: number;
  detectedHeaders: string[];
  statusBreakdown: Record<string, number>;
  paymentBreakdown: Record<string, number>;
  records: DelhiveryNormalizedRecord[];
  errors: { rowNumber: number; waybill?: string; reason: string }[];
}

export interface DelhiveryImportResult {
  success: boolean;
  totalProcessed: number;
  importedCount: number;
  updatedCount: number;
  salesOrdersUpdatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
  durationMs: number;
}
