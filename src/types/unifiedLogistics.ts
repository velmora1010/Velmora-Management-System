export type OrderSource = 'shopify' | 'upload' | 'dexie';

export type UnifiedWorkflowStage =
  | 'all'
  | 'imported'
  | 'order_verification'
  | 'ready_to_dispatch'
  | 'prepare_dispatch'
  | 'dispatched'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exceptions'
  | 'rto';

export type UnifiedTrackingStatus =
  | 'Not Tracked'
  | 'Info Received'
  | 'Pending'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Failed Attempt'
  | 'Delivery Exception'
  | 'Cancelled'
  | 'RTO'
  | 'Returned'
  | 'COD Reconciliation';

export interface UnifiedLogisticsOrder {
  id: string; // unique string id (e.g. 'dexie_123' or 'shopify_456')
  rawId?: number; // dexie primary key if source === 'dexie' or 'upload'
  supabaseId?: number;
  orderId: string; // Clean normalized order ID, e.g. "6674" or "ORD-101"
  displayOrderId: string; // e.g. "#6674"
  source: OrderSource;
  
  // Customer info
  customerKey: string; // normalized phone e.g. "9567022022" or fallback "order_6674"
  customerName: string;
  phoneNumber: string;
  rawPhoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;

  // Order Details
  orderDate?: string; // YYYY-MM-DD or display
  orderDateDisplay?: string;
  orderType: string; // 'Prepaid' | 'COD' | 'Partial COD' | etc.
  amount: number; // numeric amount in INR
  products: string; // summarized product names or SKU list
  lineItems?: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;

  // Logistics & Shipment
  courier?: string; // 'Delhivery' | 'ST Courier' | 'Amazon' | 'Ekart' | 'India Post'
  awbNumber?: string;
  stage: 'order_data' | 'tracking' | 'trash';
  workflowStage: UnifiedWorkflowStage;
  status: UnifiedTrackingStatus;
  rawStatus?: string;

  // Tracking metadata
  lastEvent?: string;
  lastLocation?: string;
  lastUpdated?: string;
  syncedAt?: string;
  trackingError?: string;
  syncState?: 'queued' | 'checking' | 'retrying' | 'idle';
  deliveryDays?: number;
  expectedDeliveryDate?: string;
}

export interface UnifiedCustomer {
  customerKey: string;
  name: string;
  phoneNumber: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  
  // Aggregated metrics
  totalOrders: number;
  totalSpent: number;
  deliveredOrders: number;
  activeOrders: number;
  exceptionOrders: number;
  latestOrderId: string;
  latestOrderDate?: string;
  latestStatus: UnifiedTrackingStatus;
  
  // Associated order references
  orders: UnifiedLogisticsOrder[];
}

export interface LogisticsSummaryCounts {
  totalOrders: number;
  totalCustomers: number;
  imported: number;
  readyToDispatch: number;
  dispatched: number;
  inTransit: number;
  outForDelivery: number;
  delivered: number;
  exceptions: number;
  rto: number;
  totalValue: number;
}
