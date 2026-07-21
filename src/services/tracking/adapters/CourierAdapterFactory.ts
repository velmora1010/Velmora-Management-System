import type { CourierAdapter } from './CourierAdapter';
import { AmazonAdapter } from './AmazonAdapter';
import { STCourierAdapter } from './STCourierAdapter';
import { DelhiveryAdapter } from './DelhiveryAdapter';
import { EkartAdapter } from './EkartAdapter';

export class CourierAdapterFactory {
  static getAdapter(courier?: string): CourierAdapter {
    const name = (courier || '').trim();
    switch (name) {
      case 'Amazon':
        return new AmazonAdapter();
      case 'ST Courier':
        return new STCourierAdapter();
      case 'Delhivery':
        return new DelhiveryAdapter();
      case 'Ekart':
        return new EkartAdapter();
      default:
        // Default fallback for any other/unsupported couriers
        return new DelhiveryAdapter();
    }
  }
}
