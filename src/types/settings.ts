export interface CompanyProfile {
  company_name: string;
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  gst_number: string;
  pan_number: string;
}

export interface BusinessPreferences {
  currency: string;
  timezone: string;
  date_format: string;
  language: string;
  default_department_id: string;
  default_section_id: string;
}

export interface FinancialSettings {
  financial_year: string;
  default_tax_percentage: number;
  default_payment_terms: string;
}

export interface SequenceConfig {
  prefix: string;
  starting_number: number;
  current_number: number;
  auto_increment: boolean;
}

export interface NumberingSequences {
  po: SequenceConfig;
  production_batch: SequenceConfig;
  inventory_item: SequenceConfig;
  task: SequenceConfig;
  campaign: SequenceConfig;
  vendor: SequenceConfig;
}

export interface NotificationPreferences {
  task_notifications: boolean;
  marketing_notifications: boolean;
  finance_notifications: boolean;
  inventory_notifications: boolean;
  production_notifications: boolean;
  qc_notifications: boolean;
  system_notifications: boolean;
}

export interface ApplicationPreferences {
  theme: 'dark' | 'light' | 'system';
  default_landing_page: string;
  session_timeout_minutes: number;
  maintenance_mode: boolean;
}

export interface SystemSettings {
  company_profile: CompanyProfile;
  business_preferences: BusinessPreferences;
  financial_settings: FinancialSettings;
  numbering_sequences: NumberingSequences;
  notification_preferences: NotificationPreferences;
  application_preferences: ApplicationPreferences;
}

export type SettingsSectionKey = keyof SystemSettings;
