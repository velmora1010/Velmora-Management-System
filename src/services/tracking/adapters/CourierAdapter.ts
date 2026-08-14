export interface TrackingResult {
  status: string;
  location?: string;
  lastUpdated?: string;
  deliveredDate?: string;
  rawResponse?: string;
  success: boolean;
  error?: string;
  supported?: boolean;
}

export interface CourierAdapter {
  track(awb: string, timeoutMs?: number): Promise<TrackingResult>;
}
