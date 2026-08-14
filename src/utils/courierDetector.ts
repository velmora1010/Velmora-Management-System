import { isCourierActive } from '../config/courierConfig';

export const detectCourier = (awb: string): string => {
  if (!awb) return 'Unknown';
  const cleanAwb = awb.trim();
  let detected = 'Unknown';
  if (cleanAwb.startsWith('5')) {
    detected = 'ST Courier';
  } else if (cleanAwb.startsWith('1')) {
    detected = 'Delhivery';
  } else if (cleanAwb.startsWith('3')) {
    detected = 'Amazon';
  } else if (cleanAwb.startsWith('IL') || cleanAwb.startsWith('il')) {
    detected = 'Ekart';
  }

  if (detected === 'Unknown') return 'Unknown';
  return isCourierActive(detected) ? detected : 'Unsupported Courier';
};

