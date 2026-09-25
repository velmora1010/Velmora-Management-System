/**
 * Centralized Order ID & Influencer Reference Normalization Utility
 *
 * Handles canonical relationships between Original Orders and Replacement Orders:
 * - Original order:     #HIS1  -> baseCode: "HIS1", display: "#HIS1", isResend: false
 * - Replacement order:  R HIS1 -> baseCode: "HIS1", display: "R HIS1", isResend: true
 *
 * Accepts replacement variations:
 * - "R HIS1", "RHIS1", "#RHIS1", "R#HIS1", "#R HIS1", "R-HIS1", "R_HIS1", "R2 HIS1", "RR HIS1"
 * - Never stacks prefixes into nonsense like "RR HIS1" or "R R HIS1"
 * - Maintains canonical base code "HIS1" for relational joins & influencer matching
 */

export interface NormalizedOrderIdInfo {
  raw: string;
  cleanDisplay: string;
  normalized: string;
  baseCode: string;
  isResend: boolean;
  resendPrefix: string;
  attemptNumber: number;
  isNumericCustomerOrder?: boolean;
}

/**
 * Normalizes an order ID, reference number, or influencer code for comparison, search, and storage.
 */
export function normalizeOrderId(
  input?: string | null,
  knownCodesSet?: Set<string>
): NormalizedOrderIdInfo {
  const raw = input != null ? String(input) : '';
  const trimmed = raw.replace(/[\t\r\n]/g, ' ').trim();
  if (!trimmed) {
    return {
      raw,
      cleanDisplay: '',
      normalized: '',
      baseCode: '',
      isResend: false,
      resendPrefix: '',
      attemptNumber: 1,
      isNumericCustomerOrder: false
    };
  }

  // 1. Check for explicit replacement pattern with separator:
  // e.g. "R HIS1", "R#HIS1", "#R HIS1", "#RHIS1", "R-HIS1", "R_HIS1", "R2 HIS1"
  const sepMatch = trimmed.match(/^#?R(\d*)[\s#_\-]+([A-Za-z0-9]+)$/i);
  if (sepMatch && sepMatch[2]) {
    const attemptFromNum = sepMatch[1] ? parseInt(sepMatch[1], 10) + 1 : 2;
    const base = sepMatch[2].replace(/^#+/, '').toUpperCase();
    const isPureDigits = /^\d+$/.test(base);
    return {
      raw,
      cleanDisplay: `R ${base}`,
      normalized: `R${base}`,
      baseCode: base,
      isResend: true,
      resendPrefix: 'R',
      attemptNumber: isNaN(attemptFromNum) ? 2 : attemptFromNum,
      isNumericCustomerOrder: isPureDigits
    };
  }

  // Clean hash and internal whitespace for compact evaluation
  const withoutHash = trimmed.replace(/^#+/, '').trim();
  const compact = withoutHash.replace(/\s+/g, '').toUpperCase();
  const isPureDigits = /^\d+$/.test(compact);

  // If exact compact matches a known influencer code, it is not a resend
  // (e.g. an influencer code that genuinely starts with R such as "ROHINI")
  if (knownCodesSet && knownCodesSet.has(compact)) {
    return {
      raw,
      cleanDisplay: `#${compact}`,
      normalized: compact,
      baseCode: compact,
      isResend: false,
      resendPrefix: '',
      attemptNumber: 1,
      isNumericCustomerOrder: false
    };
  }

  // If known codes set is provided, check stripping leading 'R's progressively:
  if (knownCodesSet) {
    let rPrefix = '';
    let temp = compact;
    let found = false;
    while (temp.length > 1 && temp.startsWith('R')) {
      rPrefix += 'R';
      temp = temp.slice(1);
      if (knownCodesSet.has(temp)) {
        found = true;
        break;
      }
    }
    if (found) {
      return {
        raw,
        cleanDisplay: `R ${temp}`,
        normalized: compact,
        baseCode: temp,
        isResend: true,
        resendPrefix: rPrefix,
        attemptNumber: rPrefix.length + 1,
        isNumericCustomerOrder: /^\d+$/.test(temp)
      };
    }
  }

  // Note: We do NOT blindly strip leading 'R' from compact codes without separators
  // unless knownCodesSet explicitly matched above. Codes like "RJS136", "RJ01", "ROHINI"
  // are genuine original influencer/state codes, NOT resends. Resends always feature
  // an explicit separator (e.g. "R RJS136", "R-HIS1", "R#HIS1") or knownCodesSet confirmation.

  // Fallback for standard original code (e.g. "HIS1", "#HIS1", "MHS114")
  const baseCode = compact.replace(/^#+/, '');
  return {
    raw,
    cleanDisplay: `#${baseCode}`,
    normalized: compact,
    baseCode,
    isResend: false,
    resendPrefix: '',
    attemptNumber: 1,
    isNumericCustomerOrder: isPureDigits
  };
}

/**
 * Result structure for parseDelhiveryReferenceNo
 */
export interface ParsedDelhiveryReference {
  rawOrderId: string;
  displayOrderId: string;
  logicalOrderId: string;
  influencerCode: string;
  isReplacement: boolean;
  attemptNumber: number;
  isValid: boolean;
  rejectReason?: string;
}

/**
 * Centralized Delhivery Reference No. validator & normalizer.
 *
 * VALID RULES:
 * 1. Original format:     #<VALID_INFLUENCER_CODE> or <VALID_INFLUENCER_CODE> (e.g. "#HIS1", "HIS1")
 * 2. Replacement format:  R <VALID_INFLUENCER_CODE> or RHIS1 or #RHIS1 or R#HIS1
 *
 * REJECT RULES:
 * 1. Purely numeric customer orders (e.g. "#122334", "122334", "#0055", "#9789", "#00317")
 * 2. Arbitrary non-existent codes (e.g. "#00JH")
 * 3. Blank or empty references
 * 4. Any Reference No. that does not exist in the active campaign influencer records
 */
export function parseDelhiveryReferenceNo(
  referenceNo?: string | null,
  validCampaignCodesSet?: Set<string>
): ParsedDelhiveryReference {
  const raw = referenceNo != null ? String(referenceNo) : '';
  const trimmed = raw.replace(/[\t\r\n]/g, ' ').trim();

  if (!trimmed) {
    return {
      rawOrderId: raw,
      displayOrderId: '',
      logicalOrderId: '',
      influencerCode: '',
      isReplacement: false,
      attemptNumber: 1,
      isValid: false,
      rejectReason: 'Reference No. is blank or missing'
    };
  }

  // 1. Check for replacement patterns:
  let isReplacement = false;
  let attemptNumber = 1;
  let codePart = '';

  const sepMatch = trimmed.match(/^#?R(\d*)[\s#_\-]+([A-Za-z0-9]+)$/i);
  if (sepMatch && sepMatch[2]) {
    isReplacement = true;
    attemptNumber = sepMatch[1] ? parseInt(sepMatch[1], 10) + 1 : 2;
    codePart = sepMatch[2].replace(/^#+/, '').trim().toUpperCase();
  } else {
    const withoutHash = trimmed.replace(/^#+/, '').trim();
    const compact = withoutHash.replace(/\s+/g, '').toUpperCase();

    // Check if compact itself is in valid campaign codes before stripping R
    if (validCampaignCodesSet && validCampaignCodesSet.has(compact)) {
      isReplacement = false;
      attemptNumber = 1;
      codePart = compact;
    } else if (validCampaignCodesSet) {
      // Check stripping leading 'R' progressively only if confirmed by valid campaign codes (e.g. "RHIS1" -> "HIS1")
      let rPrefix = '';
      let temp = compact;
      let found = false;
      while (temp.length > 1 && temp.startsWith('R')) {
        rPrefix += 'R';
        temp = temp.slice(1);
        if (validCampaignCodesSet.has(temp)) {
          found = true;
          break;
        }
      }
      if (found) {
        isReplacement = true;
        attemptNumber = rPrefix.length + 1;
        codePart = temp;
      } else {
        isReplacement = false;
        attemptNumber = 1;
        codePart = compact;
      }
    } else {
      isReplacement = false;
      attemptNumber = 1;
      codePart = compact;
    }
  }

  // 2. Reject purely numeric references (normal customer order IDs like 122334, 0055, 9789, 00317)
  if (/^\d+$/.test(codePart)) {
    return {
      rawOrderId: raw,
      displayOrderId: trimmed,
      logicalOrderId: codePart,
      influencerCode: codePart,
      isReplacement,
      attemptNumber,
      isValid: false,
      rejectReason: 'Invalid influencer order format (purely numeric customer order)'
    };
  }

  // 3. Strict Campaign Scoping Validation:
  // If validCampaignCodesSet is provided, verify the extracted code actually exists in the database
  if (validCampaignCodesSet) {
    if (!validCampaignCodesSet.has(codePart)) {
      return {
        rawOrderId: raw,
        displayOrderId: isReplacement ? `R ${codePart}` : `#${codePart}`,
        logicalOrderId: codePart,
        influencerCode: codePart,
        isReplacement,
        attemptNumber,
        isValid: false,
        rejectReason: `Influencer code "${codePart}" not found in current campaign`
      };
    }
  }

  // Accepted!
  return {
    rawOrderId: raw,
    displayOrderId: isReplacement ? `R ${codePart}` : `#${codePart}`,
    logicalOrderId: codePart,
    influencerCode: codePart,
    isReplacement,
    attemptNumber,
    isValid: true
  };
}

/**
 * Checks if an Order ID or reference represents a replacement shipment.
 */
export function isReplacementOrderId(
  orderId?: string | null,
  knownCodesSet?: Set<string>
): boolean {
  if (!orderId) return false;
  return normalizeOrderId(orderId, knownCodesSet).isResend;
}

/**
 * Extracts the canonical original influencer code from any order ID format.
 * Examples:
 * - "#HIS1"  -> "HIS1"
 * - "R HIS1" -> "HIS1"
 * - "RHIS1"  -> "HIS1"
 * - "#RHIS1" -> "HIS1"
 * - "R#HIS1" -> "HIS1"
 */
export function getOriginalOrderId(
  orderId?: string | null,
  knownCodesSet?: Set<string>
): string {
  if (!orderId) return '';
  return normalizeOrderId(orderId, knownCodesSet).baseCode;
}

/**
 * Returns uppercase canonical base code for reliable relational lookups.
 */
export function normalizeOrderIdForMatching(
  orderId?: string | null,
  knownCodesSet?: Set<string>
): string {
  return getOriginalOrderId(orderId, knownCodesSet).toUpperCase();
}

/**
 * Formats order ID cleanly for user-facing display:
 * - Original shipment:     #HIS1
 * - Replacement shipment:  R HIS1
 */
export function normalizeOrderIdForDisplay(
  orderId?: string | null,
  isReplacement?: boolean,
  _attemptNumber?: number
): string {
  const info = normalizeOrderId(orderId);
  const base = info.baseCode;
  if (!base) return '—';

  const isRep = isReplacement !== undefined ? isReplacement : info.isResend;
  if (isRep) {
    return `R ${base}`;
  }
  return `#${base}`;
}

/**
 * Generates the standard replacement order ID for a base code or order ID.
 * Always returns "R <base>" (never stacks "RR <base>" or "R R <base>").
 */
export function getReplacementOrderId(
  orderId?: string | null,
  _attemptNumber: number = 2
): string {
  const base = getOriginalOrderId(orderId);
  if (!base) return '';
  return `R ${base}`;
}

/**
 * Checks if two order IDs represent the same underlying influencer order.
 * - Exact base code matching by default (e.g. "#HIS1", "HIS1", "R HIS1", "RHIS1").
 * - Substring matching is ONLY enabled when allowSubstring is explicitly true for search bar queries.
 */
export function isSameUnderlyingOrder(
  orderA?: string | null,
  orderB?: string | null,
  knownCodesSet?: Set<string>,
  allowSubstring: boolean = false
): boolean {
  if (!orderA || !orderB) return false;
  const a = normalizeOrderId(orderA, knownCodesSet);
  const b = normalizeOrderId(orderB, knownCodesSet);
  if (!a.baseCode || !b.baseCode) return false;

  // Never match numeric customer orders to each other or to influencer codes
  if (a.isNumericCustomerOrder || b.isNumericCustomerOrder) {
    return a.normalized === b.normalized;
  }

  // Exact base match: HIS1 === HIS1
  if (a.baseCode === b.baseCode) return true;
  // Compact normalized match: RHIS1 === RHIS1
  if (a.normalized === b.normalized) return true;

  // Substring matching: ONLY when explicitly allowed for user search filtering!
  if (allowSubstring) {
    if (a.baseCode.includes(b.baseCode) || b.baseCode.includes(a.baseCode)) return true;
    if (a.normalized.includes(b.normalized) || b.normalized.includes(a.normalized)) return true;
  }

  return false;
}

/**
 * Formats display Order ID following application business rules:
 * - Original shipment -> #HIS1
 * - Resend / replacement shipment -> R HIS1
 */
export function formatDisplayOrderId(
  orderId?: string | null,
  rawOrderId?: string | null,
  influencerCode?: string | null,
  isResend?: boolean,
  attemptNumber?: number
): string {
  const orderInfo = normalizeOrderId(orderId || rawOrderId || influencerCode);
  const base = orderInfo.baseCode || (influencerCode ? influencerCode.replace(/^#+/, '').trim().toUpperCase() : '');
  if (!base) return '—';

  const shouldBeResend = Boolean(
    isResend || 
    (attemptNumber && attemptNumber > 1) || 
    orderInfo.isResend
  );

  if (shouldBeResend) {
    return `R ${base}`;
  }

  return `#${base}`;
}
