export const INTEGRATION_KEYS = {
  SHOPIFY: 'shopify',
  META: 'meta',
  GOOGLE_ANALYTICS: 'google_analytics',
  GOOGLE_ADS: 'google_ads',
  WHATSAPP: 'whatsapp',
  EMAIL_SMTP: 'email_smtp',
  COURIER_API: 'courier_api',
  RAZORPAY: 'razorpay',
  OPENAI: 'openai',
} as const;

export type IntegrationKey = typeof INTEGRATION_KEYS[keyof typeof INTEGRATION_KEYS];
export type IntegrationStatus = 'connected' | 'not_connected' | 'error';

export interface IntegrationRecord {
  id: string;
  name: string;
  key: IntegrationKey;
  is_enabled: boolean;
  status: IntegrationStatus;
  last_sync: string | null;
  config_data: Record<string, any>;
  updated_at: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  status: IntegrationStatus;
  timestamp: string;
}
