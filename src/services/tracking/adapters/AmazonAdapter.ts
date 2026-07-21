import type { CourierAdapter, TrackingResult } from './CourierAdapter';

export class AmazonAdapter implements CourierAdapter {
  async track(awb: string): Promise<TrackingResult> {
    try {
      const response = await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courier: 'Amazon',
          awbNumber: awb
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Tracking API route not found: /api/track');
        }
        throw new Error(`HTTP error ${response.status} (${response.statusText})`);
      }

      const data = await response.json();
      return {
        status: data.status || '',
        success: !!data.success,
        error: data.error,
        rawResponse: JSON.stringify(data),
        supported: data.trackingError !== 'Sync not available for this courier'
      };
    } catch (err: any) {
      const is404 = String(err.message || '').includes('Tracking API route not found');
      return {
        status: is404 ? 'Tracking API not connected' : 'Unable to fetch',
        success: false,
        error: err.message || String(err),
        supported: true
      };
    }
  }
}
