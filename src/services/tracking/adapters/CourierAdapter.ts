export interface TrackingResult {
  status: string;
  rawStatus?: string;
  location?: string;
  lastUpdated?: string;
  deliveredDate?: string;
  estimatedDeliveryDate?: string;
  remarks?: string;
  rawResponse?: string;
  success: boolean;
  error?: string;
  supported?: boolean;
}

export interface CourierAdapter {
  track(awb: string, timeoutMs?: number): Promise<TrackingResult>;
}
