import type { CourierAdapter, TrackingResult } from './CourierAdapter';
import { AmazonAdapter } from './AmazonAdapter';
import { STCourierAdapter } from './STCourierAdapter';
import { DelhiveryAdapter } from './DelhiveryAdapter';
import { normalizeCourier } from '../../../config/courierConfig';

export class FileBasedCourierAdapter implements CourierAdapter {
  private courierName: string;

  constructor(courierName: string) {
    this.courierName = courierName;
  }

  async track(_awb: string, _timeoutMs?: number): Promise<TrackingResult> {
    return {
      status: '',
      success: false,
      supported: false,
      error: `Live API sync is not configured for ${this.courierName}. Please use "Upload Tracking File" to sync tracking updates.`,
      rawResponse: JSON.stringify({
        success: false,
        status: '',
        trackingError: `Live API sync is not configured for ${this.courierName}. Use tracking file import.`
      })
    };
  }
}

export class CourierAdapterFactory {
  static getAdapter(courier?: string): CourierAdapter {
    const normalized = normalizeCourier(courier);
    
    switch (normalized) {
      case 'Delhivery':
        return new DelhiveryAdapter();
      case 'ST Courier':
        return new STCourierAdapter();
      case 'India Post':
        return new FileBasedCourierAdapter('India Post');
      case 'iThink Logistics – Ekart':
        return new FileBasedCourierAdapter('iThink Logistics – Ekart');
      case 'iThink Logistics – Delhivery':
        return new FileBasedCourierAdapter('iThink Logistics – Delhivery');
      case 'iThink Logistics – Amazon':
        return new FileBasedCourierAdapter('iThink Logistics – Amazon');
      case 'Amazon':
        return new AmazonAdapter();
      default:
        if (normalized.toLowerCase().includes('delhivery') && !normalized.toLowerCase().includes('ithink')) {
          return new DelhiveryAdapter();
        }
        if (normalized.toLowerCase().includes('st courier')) {
          return new STCourierAdapter();
        }
        return new FileBasedCourierAdapter(courier || 'this courier');
    }
  }
}
