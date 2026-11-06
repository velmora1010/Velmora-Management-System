import { isCourierActive, normalizeCourier } from '../config/courierConfig';

/**
 * Authoritative courier detection based on AWB format and courier industry standards.
 * 
 * Rules:
 * - Delhivery: 12-14 digits numeric, commonly starting with 572514..., 57..., 14..., 13..., 12..., 2...
 * - ST Courier: Typically 8-11 digits numeric (e.g. 15534544, 14345444, 145345634, 1244563456) or starts with "ST"
 * - Ekart: Starts with IL, FMPC, FK
 * - Amazon: Starts with TBA or 10-12 digit Amazon tracking
 * - India Post: Format like [A-Z]{2}[0-9]{9}IN
 * - Unknown: Ambiguous AWBs must NOT be silently assigned to any courier
 */
export const detectCourier = (awb: string, hintCourier?: string): string => {
  if (hintCourier && hintCourier.trim() && hintCourier !== 'Unknown') {
    const norm = normalizeCourier(hintCourier);
    if (norm && isCourierActive(norm)) return norm;
  }

  if (!awb) return 'Unknown';
  const cleanAwb = awb.replace(/[\s\-_]/g, '').trim();
  if (!cleanAwb) return 'Unknown';

  const isNumeric = /^\d+$/.test(cleanAwb);
  const len = cleanAwb.length;
  const upper = cleanAwb.toUpperCase();

  // 1. Ekart
  if (upper.startsWith('IL') || upper.startsWith('FMPC') || upper.startsWith('FK')) {
    return 'iThink Logistics – Ekart';
  }

  // 2. India Post: 13 chars, typically 2 letters + 9 digits + IN
  if (/^[A-Z]{2}\d{9}IN$/i.test(cleanAwb)) {
    return 'India Post';
  }

  // 3. Amazon
  if (upper.startsWith('TBA') || (/^\d{10,12}$/.test(cleanAwb) && cleanAwb.startsWith('3'))) {
    return 'iThink Logistics – Amazon';
  }

  // 4. ST Courier:
  // Starts with ST or 8-11 digits that match known ST Courier series
  if (upper.startsWith('ST')) {
    return 'ST Courier';
  }

  // 5. Delhivery:
  // Distinctive 14-digit waybills starting with 572514... or 57...
  if (isNumeric && (cleanAwb.startsWith('572514') || cleanAwb.startsWith('57')) && (len === 12 || len === 13 || len === 14)) {
    return 'Delhivery';
  }

  // Delhivery 12-14 digits starting with 14, 13, 12, 11, 21, 22, 33
  if (isNumeric && (len >= 12 && len <= 14) && (
    cleanAwb.startsWith('14') || 
    cleanAwb.startsWith('13') || 
    cleanAwb.startsWith('12') || 
    cleanAwb.startsWith('11') ||
    cleanAwb.startsWith('2') ||
    cleanAwb.startsWith('3')
  )) {
    return 'Delhivery';
  }

  // ST Courier numeric format: typically 8, 9, 10, or 11 digits
  if (isNumeric && (len >= 7 && len <= 11)) {
    return 'ST Courier';
  }

  // General 12-14 numeric fallback to Delhivery only if length matches standard Delhivery waybills
  if (isNumeric && (len === 12 || len === 14)) {
    return 'Delhivery';
  }

  return 'Unknown';
};
