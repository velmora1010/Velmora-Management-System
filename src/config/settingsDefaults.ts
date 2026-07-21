import type { SystemSettings } from '../types/settings';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  company_profile: {
    company_name: 'Velmora Home Care',
    logo_url: '',
    address: '123 Business Boulevard, Industrial Area, Sector 5',
    phone: '+91 98765 43210',
    email: 'contact@velmora.com',
    website: 'https://velmora.com',
    gst_number: '27AAAAA0000A1Z5',
    pan_number: 'AAAAA0000A',
  },
  business_preferences: {
    currency: 'INR (₹)',
    timezone: 'Asia/Kolkata (IST)',
    date_format: 'YYYY-MM-DD',
    language: 'English',
    default_department_id: '',
    default_section_id: '',
  },
  financial_settings: {
    financial_year: 'FY 2026-2027',
    default_tax_percentage: 18,
    default_payment_terms: 'Net 30',
  },
  numbering_sequences: {
    po: { prefix: 'PO-2026-', starting_number: 1001, current_number: 1001, auto_increment: true },
    production_batch: { prefix: 'BATCH-', starting_number: 5001, current_number: 5001, auto_increment: true },
    inventory_item: { prefix: 'RM-', starting_number: 101, current_number: 101, auto_increment: true },
    task: { prefix: 'TASK-', starting_number: 201, current_number: 201, auto_increment: true },
    campaign: { prefix: 'CAMP-', starting_number: 1, current_number: 1, auto_increment: true },
    vendor: { prefix: 'VEND-', starting_number: 50, current_number: 50, auto_increment: true },
  },
  notification_preferences: {
    task_notifications: true,
    marketing_notifications: true,
    finance_notifications: true,
    inventory_notifications: true,
    production_notifications: true,
    qc_notifications: true,
    system_notifications: true,
  },
  application_preferences: {
    theme: 'dark',
    default_landing_page: '/',
    session_timeout_minutes: 60,
    maintenance_mode: false,
  },
};
