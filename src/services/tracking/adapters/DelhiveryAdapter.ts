import type { CourierAdapter, TrackingResult } from './CourierAdapter';

export class DelhiveryAdapter implements CourierAdapter {
  async track(awb: string, timeoutMs?: number): Promise<TrackingResult> {
    try {
      const response = await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courier: 'Delhivery',
          awbNumber: awb
        }),
        signal: AbortSignal.timeout(timeoutMs || 25000)
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
        supported: true,
        deliveredDate: data.deliveryDate,
        location: data.lastLocation
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
