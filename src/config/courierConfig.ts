export interface CourierOption {
  id: string;
  name: string;
  shortName: string;
  integrationType: 'live_api' | 'bot' | 'file_sync';
  trackingUrlTemplate?: (awb: string) => string;
  badgeColor: {
    bg: string;
    border: string;
    text: string;
    indicator: string;
  };
}

export const CONFIGURED_COURIERS: CourierOption[] = [
  {
    id: 'delhivery',
    name: 'Delhivery',
    shortName: 'Delhivery',
    integrationType: 'live_api',
    trackingUrlTemplate: (awb: string) => `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`,
    badgeColor: {
      bg: 'bg-cyan-950/60',
      border: 'border-cyan-800/60',
      text: 'text-cyan-300',
      indicator: 'bg-cyan-400'
    }
  },
  {
    id: 'st_courier',
    name: 'ST Courier',
    shortName: 'ST Courier',
    integrationType: 'bot',
    trackingUrlTemplate: (awb: string) => `https://stcourier.com/track/shipment?awb=${encodeURIComponent(awb)}`,
    badgeColor: {
      bg: 'bg-purple-950/60',
      border: 'border-purple-800/60',
      text: 'text-purple-300',
      indicator: 'bg-purple-400'
    }
  },
  {
    id: 'amazon_shipping',
    name: 'Amazon Shipping',
    shortName: 'Amazon Shipping',
    integrationType: 'file_sync',
    trackingUrlTemplate: (awb: string) => `https://track.amazon.in/tracking/${encodeURIComponent(awb)}`,
    badgeColor: {
      bg: 'bg-orange-950/60',
      border: 'border-orange-800/60',
      text: 'text-orange-300',
      indicator: 'bg-orange-400'
    }
  },
  {
    id: 'ekart',
    name: 'Ekart',
    shortName: 'Ekart',
    integrationType: 'file_sync',
    trackingUrlTemplate: (awb: string) => `https://ekartlogistics.com/shipmenttrack/${encodeURIComponent(awb)}`,
    badgeColor: {
      bg: 'bg-amber-950/60',
      border: 'border-amber-800/60',
      text: 'text-amber-300',
      indicator: 'bg-amber-400'
    }
  },
  {
    id: 'india_post',
    name: 'India Post',
    shortName: 'India Post',
    integrationType: 'file_sync',
    trackingUrlTemplate: (awb: string) => `https://www.indiapost.gov.in/_layouts/15/dpt.cept.tracking/trackconsignment.aspx`,
    badgeColor: {
      bg: 'bg-rose-950/60',
      border: 'border-rose-800/60',
      text: 'text-rose-300',
      indicator: 'bg-rose-400'
    }
  },
  {
    id: 'house',
    name: 'House',
    shortName: 'House / Other',
    integrationType: 'file_sync',
    trackingUrlTemplate: () => '',
    badgeColor: {
      bg: 'bg-slate-900/60',
      border: 'border-slate-700/60',
      text: 'text-slate-300',
      indicator: 'bg-slate-400'
    }
  }
];

export const ACTIVE_COURIER_NAMES = CONFIGURED_COURIERS.map(c => c.name);

// Legacy support array
export const ACTIVE_COURIERS = ACTIVE_COURIER_NAMES;

export const isCourierActive = (courierName: string | undefined | null): boolean => {
  if (!courierName) return false;
  const lower = courierName.toLowerCase().trim();
  return CONFIGURED_COURIERS.some(c => 
    c.name.toLowerCase() === lower || 
    c.shortName.toLowerCase() === lower ||
    c.id === lower
  ) || lower.includes('delhivery') || lower.includes('st courier') || lower.includes('amazon') || lower.includes('ekart') || lower.includes('india post');
};

export const normalizeCourier = (courierName?: string | null): string => {
  if (!courierName || !courierName.trim()) return '';
  const lower = courierName.toLowerCase().trim();
  
  // Specific checks (Ekart before Amazon/iThink)
  if (lower.includes('ekart')) return 'Ekart';
  if (lower.includes('amazon')) return 'Amazon Shipping';
  if (lower.includes('india post') || lower.includes('speed post')) return 'India Post';
  if (
    lower === 'st' ||
    lower.startsWith('st ') ||
    lower.includes('st courier') ||
    lower.includes('st-courier') ||
    lower.includes('st_courier') ||
    lower.includes('stcourier')
  ) return 'ST Courier';
  if (lower.includes('delhivery')) return 'Delhivery';
  if (
    lower === 'house' ||
    lower === 'house courier' ||
    lower === 'in-house' ||
    lower === 'in house' ||
    lower === 'internal' ||
    lower === 'internal courier' ||
    lower === 'direct delivery' ||
    lower === 'self delivery'
  ) return 'House';

  return courierName.trim();
};

export const getCourierTrackingUrl = (courier?: string | null, awb?: string | null): string | null => {
  if (!awb || !awb.trim()) return null;
  const cleanAwb = awb.trim();
  const norm = normalizeCourier(courier);
  const found = CONFIGURED_COURIERS.find(c => c.name === norm);
  if (found && found.trackingUrlTemplate) {
    return found.trackingUrlTemplate(cleanAwb);
  }
  return null;
};
