import type { PurchaseOrderDocumentProps } from '../services/pdf/pdfTemplates';

// ─── Vendor Types ───

export interface VendorProduct {
  product_name: string;
  moq: string;
  batch_size: string;
  price: number;
  price_per_unit?: number;
  gst_percent: number;
  gst?: string;
  total_amount?: number;
  used_in?: string;
}

export interface Vendor {
  id: string;
  created_at?: string;
  status?: string;
  
  // Classification
  vendor_type_1?: string;
  vendor_type_2?: string;
  vendor_category?: string;
  sub_category?: string;
  sub_sub_category?: string;
  sub_category_3?: string[];
  gst_available?: boolean;
  
  // Vendor Details
  vendor_name: string;
  representative_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  delivery_time?: string;
  gst_number?: string;
  
  // Bank Details
  account_holder?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  
  // Products
  products: VendorProduct[] | null;
}

// ─── Purchase Order Types ───

export interface POProductRow {
  product_name: string;
  moq: string;
  batch_size: string;
  quantity: number;
  price: number;
  gst_percent: number;
  total_amount: number;
  used_in: string;
  hasVendorData: boolean;
}

export interface POFormState {
  poNumber: string;
  date: string;
  vendorId: string;
  vendorName: string;
  mainCategory: string;
  subCategory1: string;
  subCategory2: string;
  selectedProductNames: string[];
  paymentMode: string;
  initiatedBy: string;
  approvedBy: string;
  deliveryAddress: string;
  expectedDeliveryDate: string;
  shippingCharges: number;
  products: POProductRow[];
  termsConditions: string;
}

export interface POUIState {
  isSaving: boolean;
  isLoadingPONumber: boolean;
  saveError: string;
  saveSuccess: boolean;
  lastSavedPO: PurchaseOrderDocumentProps | null;
}

export interface POHeaderPayload {
  po_number: string;
  vendor_id: string;
  vendor_name: string;
  category: string | null;
  sub_category_1: string | null;
  sub_category_2: string | null;
  sub_category_3: string | null;
  payment_mode: string | null;
  initiated_by: string | null;
  approved_by: string | null;
  delivery_address: string | null;
  expected_delivery_date: string | null;
  shipping_charges: number;
  subtotal: number;
  gst_total: number;
  terms_conditions: string;
  created_at?: string;
  created_by?: string | null;
}

export interface POProductPayload {
  purchase_order_id: string;
  product_name: string;
  moq: string;
  batch_size: string;
  quantity: number;
  unit_price: number;
  gst: number;
  total_amount: number;
  used_in: string;
}

// ─── Category Master Data Types ───

export interface CategoryMasterData {
  mains: string[];
  sub1: Record<string, string[]>;
  sub2: Record<string, string[]>;
  sub3: Record<string, string[]>;
}

// ─── Task Management Types ───

export interface TaskCategory {
  id: string;
  department: string;
  sub_category_1?: string;
  sub_category_2?: string;
  sub_category_3?: string;
  created_at?: string;
}

export interface TaskItem {
  id: string;
  task_id: string;
  sub_task: string;
  is_completed: boolean;
  status: string;
}

export interface Task {
  id: string;
  department: string;
  sub_category1?: string;
  sub_category2?: string;
  task_title: string;
  task_description?: string;
  assigned_by?: string;
  assigned_to?: string;
  priority: string;
  main_task_id?: string;
  due_date?: string;
  due_time?: string;
  status: string;
  created_at?: string;
  created_by?: string | null;
  task_items?: TaskItem[];
}

export interface MainTask {
  id: string;
  task_title: string;
  status?: string;
  created_at?: string;
}

export interface SubTask {
  id: string;
  main_task_id: string;
  sub_task: string;
  status?: string;
  created_at?: string;
}

// ─── Marketing Types ───

export interface LocalInfluencerPlatform {
  platform: string;
  username: string;
  link: string;
  count: number;
}

export interface LocalInfluencer {
  id: number;
  name: string;
  handle: string;
  payment: string;
  brand: string;
  product: string;
  contact: {
    phone: string;
    altPhone: string;
    upi: string;
    city: string;
    state: string;
    language: string;
    address: string;
  };
  availability: LocalInfluencerPlatform[];
  performance: LocalInfluencerPlatform[];
  createdAt: string;
}

export interface Campaign {
  id: string;
  campaign_name: string;
  campaign_type: string;
  total_budget: number;
  expected_influencers: number;
  expected_total_videos: number;
  avg_per_video_cost: number;
  target_languages: string[] | string;
  campaign_goal: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at?: string;
}

export interface InfluencerPlatformDetail {
  id?: string;
  influencer_id?: string;
  platform: string;
  username: string;
  followers_count: number;
  profile_link: string;
  video_views: number[];
}

export interface InfluencerBargainHistory {
  id?: string;
  pricing_id?: string;
  creator_request: number;
  brand_request: number;
  created_at?: string;
}

export interface InfluencerPricing {
  id?: string;
  influencer_id?: string;
  video1_count: number;
  video1_price: number;
  video2_count: number;
  video2_price: number;
  total_videos: number;
  final_price: number;
  bargainHistory?: InfluencerBargainHistory[];
}

export interface InfluencerProduct {
  id?: string;
  influencer_id?: string;
  video_number: number;
  product_name: string;
  selected: boolean;
  qty: number;
}

export interface InfluencerBrandPerformance {
  id?: string;
  influencer_id?: string;
  brand_name: string;
  product_name: string;
  views: string;
  uploaded_platforms: string;
  instagram_link?: string;
  youtube_link?: string;
  facebook_link?: string;
}

export interface CampaignInfluencer {
  id: string;
  campaign_id: string;
  code: string;
  name: string;
  influencer_name: string;
  phone_number: string;
  alternative_number: string;
  upi_number: string;
  complete_address: string;
  city: string;
  state: string;
  languages: string[];
  profile_file_url: string;
  auto_dm: boolean;
  status?: string;
  is_archived?: boolean;
  created_at?: string;
  
  // Relational data mapped in hooks
  platforms?: InfluencerPlatformDetail[];
  pricing?: InfluencerPricing;
  products?: InfluencerProduct[];
  performance?: InfluencerBrandPerformance[];
  dispatchDetails?: any;
}

export * from './inventory';
