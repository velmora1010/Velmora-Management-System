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
