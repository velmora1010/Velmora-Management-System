export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      vendors: {
        Row: {
          id: string
          created_at: string
          status: string | null
          vendor_name: string
          main_category: string
          sub_category_1: string | null
          sub_category_2: string | null
          vendor_category: string | null
          sub_category: string | null
          sub_sub_category: string | null
          products: Json[] | null
          created_by: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          status?: string | null
          vendor_name: string
          main_category: string
          sub_category_1?: string | null
          sub_category_2?: string | null
          vendor_category?: string | null
          sub_category?: string | null
          sub_sub_category?: string | null
          products?: Json[] | null
          created_by?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          status?: string | null
          vendor_name?: string
          main_category?: string
          sub_category_1?: string | null
          sub_category_2?: string | null
          vendor_category?: string | null
          sub_category?: string | null
          sub_sub_category?: string | null
          products?: Json[] | null
          created_by?: string | null
        }
      }
      finance_categories: {
        Row: {
          id: string
          created_at: string
          status: string
          main: string
          sub1: string | null
          sub2: string | null
          sub3: string | null
          sub_sub_sub_category: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          status?: string
          main: string
          sub1?: string | null
          sub2?: string | null
          sub3?: string | null
          sub_sub_sub_category?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          status?: string
          main?: string
          sub1?: string | null
          sub2?: string | null
          sub3?: string | null
          sub_sub_sub_category?: string | null
        }
      }
      purchase_orders: {
        Row: {
          id: string
          created_at: string
          po_number: string
          vendor_id: string
          vendor_name: string
          category: string | null
          sub_category_1: string | null
          sub_category_2: string | null
          sub_category_3: string | null
          payment_mode: string | null
          initiated_by: string | null
          approved_by: string | null
          delivery_address: string | null
          expected_delivery_date: string | null
          shipping_charges: number | null
          subtotal: number | null
          gst_total: number | null
          terms_conditions: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          po_number: string
          vendor_id: string
          vendor_name: string
          category?: string | null
          sub_category_1?: string | null
          sub_category_2?: string | null
          sub_category_3?: string | null
          payment_mode?: string | null
          initiated_by?: string | null
          approved_by?: string | null
          delivery_address?: string | null
          expected_delivery_date?: string | null
          shipping_charges?: number | null
          subtotal?: number | null
          gst_total?: number | null
          terms_conditions?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          po_number?: string
          vendor_id?: string
          vendor_name?: string
          category?: string | null
          sub_category_1?: string | null
          sub_category_2?: string | null
          sub_category_3?: string | null
          payment_mode?: string | null
          initiated_by?: string | null
          approved_by?: string | null
          delivery_address?: string | null
          expected_delivery_date?: string | null
          shipping_charges?: number | null
          subtotal?: number | null
          gst_total?: number | null
          terms_conditions?: string | null
          created_by?: string | null
        }
      }
      purchase_order_products: {
        Row: {
          id: string
          created_at: string
          purchase_order_id: string
          product_name: string
          moq: string | null
          batch_size: string | null
          quantity: number
          unit_price: number
          gst_percentage: number | null
          gst_amount: number | null
          total_amount: number | null
          used_in: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          purchase_order_id: string
          product_name: string
          moq?: string | null
          batch_size?: string | null
          quantity: number
          unit_price: number
          gst_percentage?: number | null
          gst_amount?: number | null
          total_amount?: number | null
          used_in?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          purchase_order_id?: string
          product_name?: string
          moq?: string | null
          batch_size?: string | null
          quantity?: number
          unit_price?: number
          gst_percentage?: number | null
          gst_amount?: number | null
          total_amount?: number | null
          used_in?: string | null
        }
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          role: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: string
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          user_email: string | null
          action: string
          target_table: string | null
          record_id: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          user_email?: string | null
          action: string
          target_table?: string | null
          record_id?: string | null
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          user_email?: string | null
          action?: string
          target_table?: string | null
          record_id?: string | null
          details?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
