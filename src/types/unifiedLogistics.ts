export type OrderSource = 'shopify' | 'upload' | 'dexie';

export type LogisticsViewSection =
  | 'active'
  | 'fulfilled'
  | 'prepare_dispatch'
  | 'dispatched'
  | 'tracking'
  | 'analytics';

export type UnifiedWorkflowStage =
  | 'active'
  | 'fulfilled'
  | 'pending'
  | 'prepare_dispatch'
  | 'dispatched'
  | 'tracking'
  | 'analytics';

export type UnifiedTrackingStatus =
  | 'Unfulfilled'
  | 'Not Tracked'
  | 'Awaiting Tracking Update'
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
  phone?: string; // compatibility alias
  rawPhoneNumber?: string;
  alternatePhone?: string;
  address?: string;
  shippingAddress?: string; // compatibility alias
  city?: string;
  shippingCity?: string; // compatibility alias
  state?: string;
  shippingState?: string; // compatibility alias
  pincode?: string;

  // Order Details
  orderDate?: string; // YYYY-MM-DD or display
  orderDateDisplay?: string;
  orderType: string; // 'Prepaid' | 'COD' | 'Partial COD' | etc.
  amount: number; // numeric amount in INR
  totalAmount?: number; // compatibility alias
  isAmountKnown?: boolean;
  products: string; // summarized product names or SKU list
  productSummary?: string; // compatibility alias
  quantity?: number;
  totalQuantity?: number;
  lineItems?: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;
  items?: Array<{
    productName: string;
    quantity: number;
    price?: number;
  }>;

  // Logistics & Shipment
  courier?: string; // 'Delhivery' | 'ST Courier' | 'Amazon' | 'Ekart' | 'India Post'
  awbNumber?: string;
  dispatchDate?: string;
  estimatedDeliveryDate?: string;
  deliveredDate?: string;
  remarks?: string;
  // Batch & fulfillment metadata
  batchId?: string;
  batchName?: string;
  fulfillmentStatus?: string;
  sourceFulfillmentStatus?: string;
  fulfilledDate?: string;
  isSourceFulfilled?: boolean;
  financialStatus?: string;
  stage: string;
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

export interface WorkflowStageCounts {
  active: number;
  fulfilled: number;
  pending: number;
  prepareDispatch: number;
  dispatched: number;
  tracking: number;
  totalOrders: number;
  totalCustomers: number;
  analytics?: number;
}

export type LogisticsMainView = 'customers' | 'orders';
