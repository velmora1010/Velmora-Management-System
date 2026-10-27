export type PriceInterpretationMode = 'Order Total' | 'Line Total' | 'Unit Price x Quantity';

export type PaymentModeCategory = 'PREPAID' | 'PARTIAL COD' | 'COD' | 'UNKNOWN';

export type UploadBatchStatus = 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIALLY_COMPLETED';

export interface ColumnMapping {
  orderId: string;
  customerName: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  productName: string;
  quantity: string;
  offer: string;
  price: string;
  phone: string;
  paymentMode: string;
  orderDate?: string;
  fulfillmentStatus?: string;
  financialStatus?: string;
  awbNumber?: string;
  courier?: string;
}

export interface WebsiteUploadBatch {
  id: string;
  file_name: string;
  uploaded_by: string;
  uploaded_at: string;
  total_source_rows: number;
  total_unique_orders: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_order_count: number;
  price_interpretation: PriceInterpretationMode;
  status: UploadBatchStatus;
  column_mapping?: ColumnMapping;
  file_hash?: string;
  order_date?: string;
  order_date_range?: string;
}

export interface WebsiteRawOrderRow {
  id: string;
  upload_batch_id: string;
  row_number: number;
  raw_data: Record<string, any>;
  order_id?: string;
  customer_name?: string;
  product_name?: string;
  quantity?: string;
  price?: string;
  payment_mode?: string;
  order_date?: string;
  original_order_date?: string;
  validation_status: 'VALID' | 'INVALID' | 'DUPLICATE';
  validation_errors?: string[];
  created_at?: string;
}

export interface WebsiteOrderItem {
  id: string;
  website_order_id?: string;
  product_name: string;
  product_code?: string;
  quantity: number;
  unit_price?: number | null;
  line_total?: number | null;
  source_row_number?: number;
}

export interface WebsiteConsolidatedOrder {
  id: string;
  order_id: string;
  customer_name: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  order_formatted: string; // e.g. "2B × 2 | 1Y × 1"
  product_name: string;   // e.g. "2B, 1Y"
  total_quantity: number;
  offer: string;
  price: number;
  phone: string;
  payment_mode: PaymentModeCategory;
  source_payment_mode: string;
  source_payment_method?: string;
  advance_paid?: number;
  remaining_payable?: number;
  payment_classification_reason?: string;
  order_date: string; // Normalized YYYY-MM-DD
  original_order_date?: string;
  upload_batch_id: string;
  batch_file_name?: string;
  data_conflict?: boolean;
  conflict_details?: string;
  created_at: string;
  items?: WebsiteOrderItem[];
  canonicalState?: string;
  canonicalStateKey?: string;
  canonicalCity?: string;
  canonicalCityKey?: string;
  canonicalPincode?: string;
  fulfillment_status?: string;
  financial_status?: string;
  awb_number?: string;
  courier?: string;
  fulfilled_date?: string;
  email?: string;
  billing_address?: string;
  subtotal?: number;
  shipping_charges?: number;
  taxes?: number;
  discount_amount?: number;
  refund_amount?: number;
  shipment_status?: string;
  tracking_url?: string;
  manifested_date?: string;
  dispatched_date?: string;
  delivered_date?: string;
}

export interface WebsiteFullOrderDetails {
  order: WebsiteConsolidatedOrder;
  rawRows?: Record<string, any>[];
  email?: string;
  billingAddress?: {
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    phone?: string;
  };
  shippingAddress?: {
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    product_name: string;
    sku?: string;
    quantity: number;
    unit_price?: number;
    line_total?: number;
    compare_at_price?: number;
    fulfillment_status?: string;
  }>;
  financials: {
    subtotal: number;
    discount_amount: number;
    discount_code?: string;
    shipping_charges: number;
    taxes: number;
    total: number;
    advance_paid: number;
    remaining_cod: number;
    refunded_amount: number;
    payment_method: string;
    financial_status: string;
  };
  logistics: {
    stage?: string;
    status?: string;
    courier?: string;
    awb_number?: string;
    tracking_url?: string;
    manifested_date?: string;
    dispatched_date?: string;
    delivered_date?: string;
    tracking_history?: Array<{
      status: string;
      location?: string;
      timestamp: string;
      activity?: string;
    }>;
  };
  sourceFile?: {
    id?: string;
    file_name?: string;
    uploaded_at?: string;
  };
  timeline: Array<{
    title: string;
    timestamp: string;
    description?: string;
    type?: 'order' | 'payment' | 'fulfillment' | 'system';
  }>;
}

export interface GetOrdersPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMode?: string;
  fulfillmentStatus?: string;
  shipmentStatus?: string;
  state?: string;
  sortBy?: 'order_date' | 'order_id' | 'customer_name' | 'order_total' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export interface ShipmentStatusCounts {
  all: number;
  pendingAwb: number;
  readyToShip: number;
  readyForPickup: number;
  inTransit: number;
  rtoInTransit: number;
  delivered: number;
}

export interface PaginatedOrdersResult {
  orders: WebsiteConsolidatedOrder[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WebsiteSalesFilterState {
  orderIdSearch?: string;
  customerNameSearch?: string;
  phoneSearch?: string;
  batchIds?: string[];
  states?: string[];
  cities?: string[];
  pincodes?: string[];
  paymentModes?: string[];
  minPrice?: string;
  maxPrice?: string;
  minRemainingCod?: string;
  maxRemainingCod?: string;
  products?: string[];
  quantities?: string[];
  orderTypes?: string[];
  offers?: string[];
  searchQuery?: string;
  batchId?: string;
  state?: string;
  city?: string;
  product?: string;
  offer?: string;
  paymentMode?: string;
  dateRange?: 'all' | 'today' | '7days' | '30days' | 'custom';
  selectedDate?: string;
  startDate?: string;
  endDate?: string;
}
