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

/**
 * Validates courier selection and AWB/tracking number according to courier partner format.
 */
export const validateCourierAwb = (
  courier?: string | null,
  awb?: string | null
): { valid: boolean; error?: string } => {
  if (!courier || !courier.trim()) {
    return { valid: false, error: 'Please select a courier partner' };
  }
  if (!awb || !awb.trim()) {
    return { valid: false, error: 'AWB / Tracking number is required' };
  }

  const cleanAwb = awb.trim();
  if (cleanAwb.length < 5) {
    return { valid: false, error: 'AWB number is too short (minimum 5 characters)' };
  }
  if (/\s/.test(cleanAwb)) {
    return { valid: false, error: 'AWB number must not contain spaces' };
  }

  const lowerCourier = courier.toLowerCase();

  // India Post: usually 13 characters (e.g. EM123456789IN)
  if (lowerCourier.includes('india post')) {
    if (cleanAwb.length < 9) {
      return { valid: false, error: 'India Post consignment numbers typically contain at least 9 characters' };
    }
  }

  // ST Courier: numeric or ST-prefixed
  if (lowerCourier.includes('st courier') || lowerCourier.includes('stcourier')) {
    if (cleanAwb.length < 8) {
      return { valid: false, error: 'ST Courier AWB should contain at least 8 digits' };
    }
  }

  // Delhivery: numeric digits (usually 12-14 digits)
  if (lowerCourier.includes('delhivery') && !lowerCourier.includes('ithink')) {
    if (cleanAwb.length < 9) {
      return { valid: false, error: 'Delhivery waybill numbers typically contain at least 9 digits' };
    }
  }

  return { valid: true };
};

/**
 * Identifies whether an order has entered the dispatch or tracking lifecycle.
 */
export const isDispatchedOrder = (order: any): boolean => {
  if (!order) return false;
  if (order.stage === 'trash') return false;
  const stage = (order.stage || '').toLowerCase();
  const workflowStage = (order.workflowStage || '').toLowerCase();
  const status = (order.status || '').toLowerCase();
  const hasAwb = !!(order.awbNumber && String(order.awbNumber).trim().length > 0);

  if (stage === 'dispatched' || stage === 'tracking') return true;
  if (workflowStage === 'dispatched' || workflowStage === 'tracking') return true;
  if (status.includes('dispatched') || status.includes('in transit') || status.includes('delivered') || status.includes('out for delivery')) {
    return true;
  }
  if (hasAwb && stage !== 'prepare_dispatch' && stage !== 'order_data') {
    return true;
  }
  return false;
};

/**
 * Detects importable field updates between an existing local order and an incoming parsed order.
 * Strictly adheres to non-destructive rule: NEVER overwrites valid existing data with empty/blank values!
 */
export const detectOrderChanges = (
  existing: any,
  incoming: any
): { hasChanges: boolean; patch: Record<string, any>; changedFields: string[] } => {
  const patch: Record<string, any> = {};
  const changedFields: string[] = [];

  // 1. Customer Name
  if (incoming.customerName && incoming.customerName.trim() !== '' && incoming.customerName !== 'Customer') {
    if (incoming.customerName.trim() !== (existing.customerName || '').trim()) {
      patch.customerName = incoming.customerName.trim();
      changedFields.push('Customer Name');
    }
  }

  // 2. Phone Number (validate length >= 10)
  if (incoming.phoneNumber && incoming.phoneNumber.trim().length >= 10) {
    const cleanIn = normalizeOrderPhone(incoming.phoneNumber);
    const cleanEx = normalizeOrderPhone(existing.phoneNumber);
    if (cleanIn && cleanIn !== cleanEx) {
      patch.phoneNumber = cleanIn;
      changedFields.push('Phone Number');
    }
  }

  // 3. Address
  if (incoming.address && incoming.address.trim() !== '') {
    if (incoming.address.trim() !== (existing.address || '').trim()) {
      patch.address = incoming.address.trim();
      changedFields.push('Address');
    }
  }

  // 4. City
  if (incoming.city && incoming.city.trim() !== '') {
    if (incoming.city.trim() !== (existing.city || '').trim()) {
      patch.city = incoming.city.trim();
      changedFields.push('City');
    }
  }

  // 5. State
  if (incoming.state && incoming.state.trim() !== '' && incoming.state.toLowerCase() !== 'india') {
    const normIn = normalizeState(incoming.state) || incoming.state.trim();
    const normEx = normalizeState(existing.state) || (existing.state || '').trim();
    if (normIn !== normEx) {
      patch.state = normIn;
      changedFields.push('State');
    }
  }

  // 6. Pincode
  if (incoming.pincode && incoming.pincode.trim() !== '') {
    if (incoming.pincode.trim() !== (existing.pincode || '').trim()) {
      patch.pincode = incoming.pincode.trim();
      changedFields.push('Pincode');
    }
  }

  // 7. Products Summary
  if (incoming.products && incoming.products.trim() !== '' && incoming.products !== 'Standard Products') {
    if (incoming.products.trim() !== (existing.products || '').trim()) {
      patch.products = incoming.products.trim();
      changedFields.push('Products');
    }
  }

  // 8. Amount
  if (incoming.amount !== undefined && incoming.amount !== null && String(incoming.amount).trim() !== '' && String(incoming.amount) !== '0') {
    const inAmt = parseOrderAmount(incoming.amount);
    const exAmt = parseOrderAmount(existing.amount);
    if (inAmt !== null && inAmt !== exAmt) {
      patch.amount = String(inAmt);
      changedFields.push('Amount');
    }
  }

  // 9. Payment Mode
  if (incoming.orderType && incoming.orderType.trim() !== '') {
    if (incoming.orderType.trim().toLowerCase() !== (existing.orderType || '').trim().toLowerCase()) {
      patch.orderType = incoming.orderType.trim();
      changedFields.push('Payment Method');
    }
  }

  // 10. Order Date (if missing on existing)
  if (incoming.orderDate && (!existing.orderDate || existing.orderDate.trim() === '')) {
    patch.orderDate = incoming.orderDate;
    patch.orderDateDisplay = incoming.orderDateDisplay || incoming.orderDate;
    changedFields.push('Order Date');
  }

  return {
    hasChanges: changedFields.length > 0,
    patch,
    changedFields
  };
};

