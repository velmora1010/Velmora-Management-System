import { MASTER_LOCATIONS, PINCODE_TO_LOCATION } from '../data/indiaLocations';

// Comprehensive Indian State Normalization Map
export const STATE_NORMALIZATION_MAP: Record<string, string> = {
  'tn': 'Tamil Nadu',
  'tamil nadu': 'Tamil Nadu',
  'tamilnadu': 'Tamil Nadu',
  'ta': 'Tamil Nadu',
  'mh': 'Maharashtra',
  'maharashtra': 'Maharashtra',
  'ka': 'Karnataka',
  'karnataka': 'Karnataka',
  'kl': 'Kerala',
  'kerala': 'Kerala',
  'dl': 'Delhi',
  'delhi': 'Delhi',
  'new delhi': 'Delhi',
  'up': 'Uttar Pradesh',
  'uttar pradesh': 'Uttar Pradesh',
  'uttarpradesh': 'Uttar Pradesh',
  'ap': 'Andhra Pradesh',
  'andhra pradesh': 'Andhra Pradesh',
  'andhrapradesh': 'Andhra Pradesh',
  'tg': 'Telangana',
  'ts': 'Telangana',
  'telangana': 'Telangana',
  'wb': 'West Bengal',
  'west bengal': 'West Bengal',
  'westbengal': 'West Bengal',
  'gj': 'Gujarat',
  'gujarat': 'Gujarat',
  'rj': 'Rajasthan',
  'rajasthan': 'Rajasthan',
  'mp': 'Madhya Pradesh',
  'madhya pradesh': 'Madhya Pradesh',
  'madhyapradesh': 'Madhya Pradesh',
  'hr': 'Haryana',
  'haryana': 'Haryana',
  'pb': 'Punjab',
  'punjab': 'Punjab',
  'br': 'Bihar',
  'bihar': 'Bihar',
  'od': 'Odisha',
  'odisha': 'Odisha',
  'orissa': 'Odisha',
  'or': 'Odisha',
  'as': 'Assam',
  'assam': 'Assam',
  'jh': 'Jharkhand',
  'jharkhand': 'Jharkhand',
  'cg': 'Chhattisgarh',
  'ct': 'Chhattisgarh',
  'chhattisgarh': 'Chhattisgarh',
  'chattisgarh': 'Chhattisgarh',
  'uk': 'Uttarakhand',
  'ua': 'Uttarakhand',
  'uttarakhand': 'Uttarakhand',
  'uttaranchal': 'Uttarakhand',
  'hp': 'Himachal Pradesh',
  'himachal pradesh': 'Himachal Pradesh',
  'ga': 'Goa',
  'goa': 'Goa',
  'jk': 'Jammu & Kashmir',
  'jammu & kashmir': 'Jammu & Kashmir',
  'jammu and kashmir': 'Jammu & Kashmir',
  'py': 'Puducherry',
  'puducherry': 'Puducherry',
  'pondicherry': 'Puducherry',
  'ch': 'Chandigarh',
  'chandigarh': 'Chandigarh',
  'tr': 'Tripura',
  'tripura': 'Tripura',
  'ml': 'Meghalaya',
  'meghalaya': 'Meghalaya',
  'mn': 'Manipur',
  'manipur': 'Manipur',
  'nl': 'Nagaland',
  'nagaland': 'Nagaland',
  'mz': 'Mizoram',
  'mizoram': 'Mizoram',
  'sk': 'Sikkim',
  'sikkim': 'Sikkim',
  'ar': 'Arunachal Pradesh',
  'arunachal pradesh': 'Arunachal Pradesh',
  'an': 'Andaman & Nicobar Islands',
  'andaman & nicobar islands': 'Andaman & Nicobar Islands',
  'andaman and nicobar': 'Andaman & Nicobar Islands',
  'dn': 'Dadra & Nagar Haveli',
  'dd': 'Daman & Diu',
  'ld': 'Lakshadweep',
  'la': 'Ladakh',
  'ladakh': 'Ladakh'
};

/**
 * Normalizes Indian state names and codes to canonical format.
 * Prevents showing country ("India") as state.
 */
export const normalizeState = (val?: string | null): string => {
  if (!val) return '';
  let clean = String(val).replace(/^'/, '').trim();
  clean = clean.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ');
  if (!clean || clean === '-' || clean === 'undefined' || clean === 'null') return '';

  const lower = clean.toLowerCase();
  // Never treat country name as state
  if (lower === 'india' || lower === 'in' || lower === 'ind') {
    return '';
  }

  if (STATE_NORMALIZATION_MAP[lower]) {
    return STATE_NORMALIZATION_MAP[lower];
  }

  // Capitalize words
  return clean.replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Resolves state by pincode fallback if state is missing
 */
export const resolveStateFromPincode = (pincode?: string | null): string => {
  if (!pincode) return '';
  const cleanPin = String(pincode).replace(/\D/g, '').slice(0, 6);
  if (cleanPin.length !== 6) return '';

  const loc = PINCODE_TO_LOCATION[cleanPin];
  if (loc?.stateKey) {
    return STATE_NORMALIZATION_MAP[loc.stateKey.toLowerCase()] || 
           loc.stateKey.replace(/\b\w/g, c => c.toUpperCase());
  }
  return '';
};

/**
 * Resolves the display customer location line:
 * Prefer state (e.g. "Tamil Nadu"), fallback to city (e.g. "Hosur"), never "India".
 */
export const resolveCustomerLocationDisplay = (
  state?: string | null,
  city?: string | null,
  pincode?: string | null
): string => {
  const normState = normalizeState(state);
  if (normState) return normState;

  const pinState = resolveStateFromPincode(pincode);
  if (pinState) return pinState;

  if (city && city.trim() && city.trim().toLowerCase() !== 'india') {
    return city.trim().replace(/\b\w/g, c => c.toUpperCase());
  }

  return '—';
};

/**
 * Parses and validates order total amount safely.
 * Returns null if amount is genuinely unknown or missing.
 */
export const parseOrderAmount = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const str = String(val).trim();
  if (str === '' || str === '-' || str === 'undefined' || str === 'null') return null;

  const cleaned = str.replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Formats order amount for UI display.
 * Returns "—" if amount is unknown, or "₹ X,XXX" if known.
 */
export const formatOrderAmountDisplay = (amount: any): string => {
  const parsed = parseOrderAmount(amount);
  if (parsed === null) return '—';
  return `₹ ${Math.round(parsed).toLocaleString('en-IN')}`;
};

/**
 * Normalizes phone numbers safely. Preserves leading digits and handles 10-12 digit numbers.
 * Returns canonical 10-digit number or cleaned digits. Returns empty string if missing.
 */
export const normalizeOrderPhone = (val?: any): string => {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/^'/, '').trim();
  if (!str || str === '-' || str === 'undefined' || str === 'null') return '';

  const digits = str.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  if (digits.length >= 10) {
    return digits.length > 10 && digits.startsWith('91') ? digits.slice(2) : digits;
  }
  return digits || str;
};
