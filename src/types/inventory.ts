export interface RawMaterial {
  id?: number;
  name: string;
  unit: string;
  category: string;
  description?: string;
  hsn_code?: string;
  color_code: string;
  image_url?: string;
  created_at: string;
}

export interface ProductBarcode {
  id?: string;
  barcodeNumber?: string;
  displayBarcode?: string;
  department?: string;
  batchId?: string;
  productCode?: string;
  productName?: string;
  producedBy?: string;
  status?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ComboBox {
  id?: string;
  comboBoxBarcode?: string;
  type?: string;
  description?: string;
  createdAt?: string;
  products?: ProductBarcode[];
  status?: string;
  packedBy?: string;
  [key: string]: any;
}

export interface QCBarcode {
  id?: string;
  qcBarcode?: string;
  displayBarcode?: string;
  batchId?: string;
  microBatchNo?: number;
  productCode?: string;
  productName?: string;
  totalUnits?: number;
  createdAt?: string;
  currentStage?: string;
  childBarcodes?: string[];
  [key: string]: any;
}

export interface ProductionBatch {
  id?: number;
  production_batch_id: string; // e.g. PROD-20260529-001
  product_name: string;
  total_units: number;
  batch_type: string; // Full Set, Micro Batch, Custom
  produced_by: string;
  notes: string;
  status: 'Prep' | 'In Progress' | 'Complete' | 'Saved';
  total_micro_batches: number;
  completed_micro_batches: number;
  produced_units: number;
  inventory_units: number;
  created_at: string;
}

export interface ProductionMicroBatch {
  id?: number;
  production_batch_id: string;
  micro_batch_no: number;
  units: number;
  status: 'Waiting' | 'In Progress' | 'Passed' | 'Failed';
  barcode_data?: string;
  failure_reason?: string;
  created_at: string;
  completed_at?: string;
  scanned_into_inventory_at?: string;
}

export interface ProductionIngredient {
  id?: number;
  production_batch_id: string;
  material_name: string;
  required_quantity: number;
  available_quantity_at_start: number;
  scanned_quantity: number;
  status: 'Pending' | 'Ready';
}

export interface InventoryIn {
  id?: number;
  material_id: number;
  material_name: string;
  quantity_received: number;
  vendor_name: string;
  po_reference: string;
  price_per_kg: number;
  gst_percent: number;
  base_amount: number;
  gst_amount: number;
  total_amount: number;
  date_received: string;
  notes?: string;
  created_at: string;
}

export interface Batch {
  id?: number;
  batch_id: string; // Legacy / Internal
  serial_number: string; // Unique string MAT-YYYYMMDD-PRODUCTCODE-001
  inventory_in_id: number;
  material_id: number;
  material_name: string;
  batch_number: number;
  original_quantity: number;
  available_quantity: number;
  vendor_name: string;
  po_reference: string;
  price_per_kg: number;
  gst_percent: number;
  batch_value: number;
  barcode_data: string;
  status: 'Active' | 'Low Stock' | 'Completed' | 'Depleted';
  created_at: string;
}

export interface InventoryOut {
  id?: number;
  batch_id: string;
  product_id: number;
  quantity_out: number;
  purpose: string;
  reference_no: string;
  date: string;
  notes?: string;
  created_at: string;
}

export interface RawMaterialIssue {
  id?: number;
  production_batch_id: string;
  raw_material_batch_id: string;
  material_name: string;
  quantity_issued: number;
  issued_at: string;
}

export interface FinishedGoodsInventory {
  id?: number;
  production_batch_id: string;
  micro_batch_id: number;
  product_name: string;
  units: number;
  barcode_data: string;
  scanned_at: string;
  status: 'In Stock' | 'Shipped';
}
