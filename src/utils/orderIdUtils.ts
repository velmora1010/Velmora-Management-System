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
      attemptNumber: 1
    };
  }

  // 1. Check for explicit replacement pattern with separator:
  // e.g. "R HIS1", "R#HIS1", "#R HIS1", "#RHIS1", "R-HIS1", "R_HIS1", "R2 HIS1"
  const sepMatch = trimmed.match(/^#?R(\d*)[\s#_\-]+([A-Za-z0-9]+)$/i);
  if (sepMatch && sepMatch[2]) {
    const attemptFromNum = sepMatch[1] ? parseInt(sepMatch[1], 10) + 1 : 2;
    const base = sepMatch[2].replace(/^#+/, '').toUpperCase();
    return {
      raw,
      cleanDisplay: `R ${base}`,
      normalized: `R${base}`,
      baseCode: base,
      isResend: true,
      resendPrefix: 'R',
      attemptNumber: isNaN(attemptFromNum) ? 2 : attemptFromNum
    };
  }

  // Clean hash and internal whitespace for compact evaluation
  const withoutHash = trimmed.replace(/^#+/, '').trim();
  const compact = withoutHash.replace(/\s+/g, '').toUpperCase();

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
      attemptNumber: 1
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
        attemptNumber: rPrefix.length + 1
      };
    }
  }

  // Generic match: R (or multiple Rs / R2) followed by alphanumeric base code
  // e.g. "RHIS1", "R#HIS1", "R2HIS1", "RRMHS114"
  const rMatch = compact.match(/^R+(\d*)([A-Za-z0-9]+)$/i);
  if (rMatch && rMatch[2]) {
    const rawRPrefix = compact.slice(0, compact.length - rMatch[2].length);
    const rCount = (rawRPrefix.match(/R/gi) || []).length;
    const attempt = rMatch[1] ? (parseInt(rMatch[1], 10) + 1) : Math.max(2, rCount + 1);
    const base = rMatch[2].replace(/^#+/, '').toUpperCase();
    return {
      raw,
      cleanDisplay: `R ${base}`,
      normalized: compact,
      baseCode: base,
      isResend: true,
      resendPrefix: rawRPrefix,
      attemptNumber: isNaN(attempt) ? 2 : attempt
    };
  }

  // Fallback for standard original code (e.g. "HIS1", "#HIS1", "MHS114")
  const baseCode = compact.replace(/^#+/, '');
  return {
    raw,
    cleanDisplay: `#${baseCode}`,
    normalized: compact,
    baseCode,
    isResend: false,
    resendPrefix: '',
    attemptNumber: 1
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
 * Checks if two order IDs or an order ID and a search query represent the same underlying order / influencer.
 * Supports:
 * - "#HIS1", "HIS1", "R HIS1", "RHIS1", "#RHIS1", "R#HIS1" all match each other.
 */
export function isSameUnderlyingOrder(
  orderA?: string | null,
  orderB?: string | null,
  knownCodesSet?: Set<string>
): boolean {
  if (!orderA || !orderB) return false;
  const a = normalizeOrderId(orderA, knownCodesSet);
  const b = normalizeOrderId(orderB, knownCodesSet);
  if (!a.baseCode || !b.baseCode) return false;

  // Exact base match: HIS1 === HIS1
  if (a.baseCode === b.baseCode) return true;
  // Compact normalized match: RHIS1 === RHIS1
  if (a.normalized === b.normalized) return true;
  // Substring matching for search filtering: e.g. searching "HIS" matches "HIS1"
  if (a.baseCode.includes(b.baseCode) || b.baseCode.includes(a.baseCode)) return true;
  if (a.normalized.includes(b.normalized) || b.normalized.includes(a.normalized)) return true;

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
