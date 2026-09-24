/**
 * Centralized Order ID & Influencer Reference Normalization Utility
 *
 * Normalizes only for matching and search purposes:
 * - trims whitespace
 * - removes leading '#'
 * - collapses and removes internal whitespace (e.g. "R MHS114" -> "RMHS114")
 * - normalizes case (uppercase)
 * - identifies business-level resend markers ('R', 'RR', etc.)
 *
 * Examples:
 * "#MHS114"  -> baseCode: "MHS114", normalized: "MHS114", isResend: false, attemptNumber: 1
 * "MHS114"   -> baseCode: "MHS114", normalized: "MHS114", isResend: false, attemptNumber: 1
 * "R MHS114" -> baseCode: "MHS114", normalized: "RMHS114", isResend: true, attemptNumber: 2
 * "RMHS114"  -> baseCode: "MHS114", normalized: "RMHS114", isResend: true, attemptNumber: 2
 * "#RMHS114" -> baseCode: "MHS114", normalized: "RMHS114", isResend: true, attemptNumber: 2
 * "RR MHS114"-> baseCode: "MHS114", normalized: "RRMHS114", isResend: true, attemptNumber: 3
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
 * Normalizes an order ID, reference number, or influencer code for comparison and search.
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

  // Remove leading # and surrounding spaces
  const withoutHash = trimmed.replace(/^#+/, '').trim();
  // Remove all internal whitespace for compact matching (e.g. "R MHS114" -> "RMHS114")
  const compact = withoutHash.replace(/\s+/g, '').toUpperCase();

  // If exact compact matches a known influencer code, it is not a resend
  // (e.g. an influencer code that genuinely starts with R such as "ROHINI")
  if (knownCodesSet && knownCodesSet.has(compact)) {
    return {
      raw,
      cleanDisplay: trimmed,
      normalized: compact,
      baseCode: compact,
      isResend: false,
      resendPrefix: '',
      attemptNumber: 1
    };
  }

  // If known codes set is provided, check stripping leading 'R's progressively:
  // e.g. "RROHINI" -> strip one 'R' -> "ROHINI" is in known codes!
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
        cleanDisplay: trimmed,
        normalized: compact,
        baseCode: temp,
        isResend: true,
        resendPrefix: rPrefix,
        attemptNumber: rPrefix.length + 1
      };
    }
  }

  // Generic fallback: match leading R+ before remaining alphanumeric code
  // E.g. "R MHS114" or "RMHS114" -> prefix: "R", base: "MHS114"
  const m = compact.match(/^(R+)(.+)$/);
  if (m && m[1] && m[2] && m[2].length > 0) {
    return {
      raw,
      cleanDisplay: trimmed,
      normalized: compact,
      baseCode: m[2],
      isResend: true,
      resendPrefix: m[1],
      attemptNumber: m[1].length + 1
    };
  }

  return {
    raw,
    cleanDisplay: trimmed,
    normalized: compact,
    baseCode: compact,
    isResend: false,
    resendPrefix: '',
    attemptNumber: 1
  };
}

/**
 * Checks if two order IDs or an order ID and a search query represent the same underlying order / influencer.
 * Supports:
 * - "#MHS114", "MHS114", "R MHS114", "RMHS114" all match each other.
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

  // Exact base match: MHS114 === MHS114
  if (a.baseCode === b.baseCode) return true;
  // Compact normalized match: RMHS114 === RMHS114
  if (a.normalized === b.normalized) return true;
  // Substring matching for search filtering: e.g. searching "MHS" matches "MHS114"
  if (a.baseCode.includes(b.baseCode) || b.baseCode.includes(a.baseCode)) return true;
  if (a.normalized.includes(b.normalized) || b.normalized.includes(a.normalized)) return true;

  return false;
}

/**
 * Formats display Order ID following application business rules:
 * - Original shipment -> #MHS114 or MHS114
 * - Resend shipment -> RMHS114 or #RMHS114
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

  const shouldBeResend = Boolean(isResend || (attemptNumber && attemptNumber > 1) || orderInfo.isResend);
  if (shouldBeResend) {
    const attempts = attemptNumber && attemptNumber > 1 ? attemptNumber : (orderInfo.attemptNumber > 1 ? orderInfo.attemptNumber : 2);
    const rPrefix = 'R'.repeat(Math.max(1, attempts - 1));
    return `#${rPrefix}${base}`;
  }

  // Original shipment: preserve raw order ID if it had # or code
  if (rawOrderId && rawOrderId.trim()) {
    const trimmed = rawOrderId.trim();
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }
  if (orderId && orderId.trim()) {
    const trimmed = orderId.trim();
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }
  return `#${base}`;
}
