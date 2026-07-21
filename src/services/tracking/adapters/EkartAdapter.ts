import type { CourierAdapter, TrackingResult } from './CourierAdapter';

export class EkartAdapter implements CourierAdapter {
  async track(_awb: string): Promise<TrackingResult> {
    return {
      status: '',
      success: false,
      supported: false,
      error: 'Sync not available for this courier',
      rawResponse: JSON.stringify({
        success: false,
        status: '',
        trackingError: 'Sync not available for this courier'
      })
    };
  }
}
