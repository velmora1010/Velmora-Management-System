/**
 * Centralized Influencer Payment Normalization & Resolution Utility
 * Single canonical source of truth for:
 * - Normalizing UPI / GPay / Google Pay -> 'UPI'
 * - Normalizing Bank / Account Details -> 'ACCOUNT_DETAILS'
 * - Parsing Excel columns: 'Payment Mode', 'Payments', 'Details'
 * - Inferring payment method when Payment Mode is empty/unconfigured
 * - Extracting structured account holder, account number, IFSC, bank name, PAN
 */

export type NormalizedPaymentMethod = 'UPI' | 'ACCOUNT_DETAILS' | null;

export interface NormalizedPaymentDetails {
  payment_method: NormalizedPaymentMethod;
  upi_number: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  pan_number: string | null;
}

export interface ParseExcelPaymentParams {
  paymentMode?: any;
  payments?: any;
  details?: any;
  upiNumber?: any;
  accountHolderName?: any;
  accountNumber?: any;
  ifscCode?: any;
  bankName?: any;
  panNumber?: any;
}

/**
 * Common Bank Names mapped from Indian IFSC prefixes
 */
const IFSC_BANK_MAP: Record<string, string> = {
  SBIN: 'State Bank of India',
  HDFC: 'HDFC Bank',
  ICIC: 'ICICI Bank',
  UTIB: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank',
  PUNB: 'Punjab National Bank',
  BARB: 'Bank of Baroda',
  CNRB: 'Canara Bank',
  UBIN: 'Union Bank of India',
  IDFB: 'IDFC First Bank',
  YESB: 'Yes Bank',
  INDB: 'IndusInd Bank',
  IOBA: 'Indian Overseas Bank',
  CBIN: 'Central Bank of India',
  CORP: 'Corporation Bank',
  ANDB: 'Andhra Bank',
  ALLA: 'Allahabad Bank',
  SYNB: 'Syndicate Bank',
  VIJB: 'Vijaya Bank',
  MAHB: 'Bank of Maharashtra',
  BCOI: 'Bank of India',
  PSIB: 'Punjab & Sind Bank',
  UCOB: 'UCO Bank',
  FDRL: 'Federal Bank',
  KVBL: 'Karur Vysya Bank',
  SIBL: 'South Indian Bank',
  TMBL: 'Tamilnad Mercantile Bank',
  CSBK: 'CSB Bank',
  DCBL: 'DCB Bank',
  RBLN: 'RBL Bank'
};

/**
 * Normalizes payment mode / method string to 'UPI' or 'ACCOUNT_DETAILS'
 * Case-insensitive, trims whitespace and punctuation.
 * Treats UPI, GPay, Google Pay, PhonePe, Paytm as UPI.
 * Treats Account, Bank, Bank Details as ACCOUNT_DETAILS.
 */
export function normalizePaymentMethod(rawMethod: any): NormalizedPaymentMethod {
  if (!rawMethod) return null;
  const str = String(rawMethod).trim();
  if (!str) return null;

  // Clean alphanumeric + lowercase
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Combined mode like "bank / upi"
  if (clean.includes('bank') && clean.includes('upi')) {
    return 'UPI';
  }

  // 1. UPI / GPay / Google Pay (Must all normalize to 'UPI')
  if (
    clean === 'upi' ||
    clean === 'gpay' ||
    clean === 'googlepay' ||
    clean === 'gpayupi' ||
    clean === 'upigpay' ||
    clean === 'phonepe' ||
    clean === 'phonepay' ||
    clean === 'phonepaynumber' ||
    clean === 'phonepenumber' ||
    clean === 'paytm' ||
    clean === 'bhim' ||
    clean === 'bhimupi' ||
    clean === 'upiid' ||
    clean === 'upinumber' ||
    clean === 'gpaynumber' ||
    clean.includes('googlepay') ||
    clean.includes('gpay') ||
    clean.includes('phonepe') ||
    clean.includes('phonepay') ||
    clean.includes('upi')
  ) {
    return 'UPI';
  }

  // 2. Account Details / Bank (Must normalize to 'ACCOUNT_DETAILS')
  if (
    clean === 'acc' ||
    clean === 'account' ||
    clean === 'ac' ||
    clean === 'bank' ||
    clean === 'bankaccount' ||
    clean === 'bankdetails' ||
    clean === 'accountdetails' ||
    clean === 'accounttransfer' ||
    clean === 'banktransfer' ||
    clean === 'neft' ||
    clean === 'rtgs' ||
    clean === 'imps' ||
    clean === 'netbanking' ||
    clean.includes('account') ||
    clean.includes('bank')
  ) {
    return 'ACCOUNT_DETAILS';
  }

  return null;
}

/**
 * Check whether a payment method represents UPI
 */
export function isUpiPaymentMethod(rawMethod: any): boolean {
  return normalizePaymentMethod(rawMethod) === 'UPI';
}

/**
 * Check whether a payment method represents Bank Account Details
 */
export function isAccountPaymentMethod(rawMethod: any): boolean {
  return normalizePaymentMethod(rawMethod) === 'ACCOUNT_DETAILS';
}

/**
 * Detect and extract a valid UPI ID from text
 * Matches patterns like example@okaxis, 8180890209@axl, user@upi, etc.
 */
export function detectUpiId(input?: any): string | null {
  if (!input) return null;
  const str = String(input).trim();
  if (!str) return null;

  // 1. Standard UPI ID format: username@bank / number@bank
  const upiRegex = /([a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64})/i;
  const match = str.match(upiRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // 2. 10-digit mobile number in a UPI field
  const phoneOnly = str.replace(/[^0-9]/g, '');
  if (phoneOnly.length === 10 && /^[6-9]\d{9}$/.test(phoneOnly)) {
    return phoneOnly;
  }

  return null;
}

/**
 * Parse structured or free-text bank account details from text
 * Handles formats like:
 * Account name: Sonu yadav
 * Account number: 37933811461
 * IFSC code: SBIN0011872
 * PAN NUMBER: AMRPY7859G
 */
export function parseBankDetailsText(input?: any): {
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  pan_number: string | null;
} {
  const result = {
    account_holder_name: null as string | null,
    account_number: null as string | null,
    ifsc_code: null as string | null,
    bank_name: null as string | null,
    pan_number: null as string | null
  };

  if (!input) return result;
  const text = String(input).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const segments = text.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);

  const cleanVal = (v: string): string => {
    return v.trim().replace(/^[:=\-\s]+/, '').replace(/[,;]+$/, '').trim();
  };

  for (const segment of segments) {
    // IFSC
    if (!result.ifsc_code) {
      const ifscMatch = segment.match(/(?:ifsc(?:\s*code)?|ifs\s*code)\s*[:=\-]?\s*([A-Za-z0-9]+)/i);
      if (ifscMatch && ifscMatch[1]) {
        result.ifsc_code = ifscMatch[1].trim().toUpperCase();
      }
    }

    // Account Number
    if (!result.account_number) {
      const accMatch = segment.match(/(?:account\s*(?:number|no\.?|#)?|a\/c\s*(?:number|no\.?|#)?|acc(?:ount)?\s*(?:number|no\.?|#)?|acc\s*no\.?)\s*[:=\-]?\s*([A-Za-z0-9\-]+)/i);
      if (accMatch && accMatch[1]) {
        result.account_number = accMatch[1].trim();
      }
    }

    // Account Name / Account Holder (supports "Name - ...", "Holder - ...", "A/C Name - ...")
    if (!result.account_holder_name) {
      const nameMatch = segment.match(/(?:account\s*holder(?:\s*name)?|acc(?:ount)?\s*name|beneficiary(?:\s*name)?|holder(?:\s*name)?|a\/c\s*name|\bname)\s*[:=\-]\s*(.+)/i);
      if (nameMatch && nameMatch[1]) {
        const val = cleanVal(nameMatch[1]);
        if (val && !val.toLowerCase().startsWith('bank') && !val.toLowerCase().startsWith('ifsc') && !val.toLowerCase().startsWith('pan')) {
          result.account_holder_name = val;
        }
      }
    }

    // Bank Name
    if (!result.bank_name) {
      const bankMatch = segment.match(/(?:bank\s*name|\bbank)\s*[:=\-]\s*(.+)/i);
      if (bankMatch && bankMatch[1]) {
        const val = cleanVal(bankMatch[1]);
        if (val && !val.toLowerCase().includes('account') && !val.toLowerCase().includes('holder')) {
          result.bank_name = val;
        }
      }
    }

    // PAN Number
    if (!result.pan_number) {
      const panMatch = segment.match(/(?:pan(?:\s*number|\s*no\.?)?)\s*[:=\-]?\s*([A-Za-z0-9]+)/i);
      if (panMatch && panMatch[1]) {
        result.pan_number = panMatch[1].trim().toUpperCase();
      }
    }
  }

  // Fallback regex search across full text if labels were missing or formatted differently
  if (!result.ifsc_code) {
    const rawIfsc = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
    if (rawIfsc) {
      result.ifsc_code = rawIfsc[1].toUpperCase();
    }
  }

  if (!result.account_number) {
    const numMatches = text.match(/\b(\d{9,18})\b/g);
    if (numMatches && numMatches.length > 0) {
      result.account_number = numMatches[0];
    }
  }

  if (!result.pan_number) {
    const rawPan = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
    if (rawPan) {
      result.pan_number = rawPan[1].toUpperCase();
    }
  }

  // Infer Bank Name from IFSC prefix if bank_name is still missing
  if (!result.bank_name && result.ifsc_code) {
    const prefix = result.ifsc_code.substring(0, 4).toUpperCase();
    if (IFSC_BANK_MAP[prefix]) {
      result.bank_name = IFSC_BANK_MAP[prefix];
    }
  }

  return result;
}

/**
 * Main Centralized Parser for Excel Upload Payment Information
 * Evaluates:
 * 1. Payment Details / Payment Mode column
 * 2. UPI Number / Payments column
 * 3. Name (Account Holder Name) column
 * 4. Account No column
 * 5. IFSC Code column
 * 6. Bank Name column
 * 7. PAN Number column
 * 8. Details column (composite unstructured text)
 * Returns canonical NormalizedPaymentDetails preserving both UPI and Bank fields if present.
 */
export function parseExcelPaymentDetails(params: ParseExcelPaymentParams): NormalizedPaymentDetails {
  const rawMode = params.paymentMode !== undefined && params.paymentMode !== null ? String(params.paymentMode).trim() : '';
  
  // Safe string coercion for financial identifiers
  let rawUpi = params.upiNumber !== undefined && params.upiNumber !== null
    ? String(params.upiNumber).trim()
    : (params.payments !== undefined && params.payments !== null ? String(params.payments).trim() : '');
  if (rawUpi.toLowerCase() === 'null' || rawUpi.toLowerCase() === 'undefined' || rawUpi === '—') {
    rawUpi = '';
  }

  let rawAccNum = params.accountNumber !== undefined && params.accountNumber !== null ? String(params.accountNumber).trim() : '';
  if (rawAccNum.toLowerCase() === 'null' || rawAccNum.toLowerCase() === 'undefined' || rawAccNum === '—' || rawAccNum.toLowerCase() === 'available') {
    rawAccNum = '';
  }

  let rawAccHolder = params.accountHolderName !== undefined && params.accountHolderName !== null ? String(params.accountHolderName).trim() : '';
  if (rawAccHolder.toLowerCase() === 'null' || rawAccHolder.toLowerCase() === 'undefined' || rawAccHolder === '—') {
    rawAccHolder = '';
  }

  let rawIfsc = params.ifscCode !== undefined && params.ifscCode !== null ? String(params.ifscCode).trim().toUpperCase() : '';
  if (rawIfsc.toLowerCase() === 'null' || rawIfsc.toLowerCase() === 'undefined' || rawIfsc === '—') {
    rawIfsc = '';
  }

  let rawBank = params.bankName !== undefined && params.bankName !== null ? String(params.bankName).trim() : '';
  if (rawBank.toLowerCase() === 'null' || rawBank.toLowerCase() === 'undefined' || rawBank === '—') {
    rawBank = '';
  }

  let rawPan = params.panNumber !== undefined && params.panNumber !== null ? String(params.panNumber).trim().toUpperCase() : '';
  if (rawPan.toLowerCase() === 'null' || rawPan.toLowerCase() === 'undefined' || rawPan === '—') {
    rawPan = '';
  }

  const rawDetails = params.details !== undefined && params.details !== null ? String(params.details).trim() : '';

  // If unstructured details string is provided and structured fields are missing, extract from details:
  if (rawDetails) {
    const parsedBank = parseBankDetailsText(rawDetails);
    if (!rawAccNum && parsedBank.account_number) rawAccNum = parsedBank.account_number;
    if (!rawIfsc && parsedBank.ifsc_code) rawIfsc = parsedBank.ifsc_code;
    if (!rawAccHolder && parsedBank.account_holder_name) rawAccHolder = parsedBank.account_holder_name;
    if (!rawBank && parsedBank.bank_name) rawBank = parsedBank.bank_name;
    if (!rawPan && parsedBank.pan_number) rawPan = parsedBank.pan_number;

    if (!rawUpi) {
      const detected = detectUpiId(rawDetails);
      if (detected) rawUpi = detected;
    }
  }

  // Infer bank name from IFSC prefix if bank is still missing
  if (!rawBank && rawIfsc && rawIfsc.length >= 4) {
    const prefix = rawIfsc.substring(0, 4);
    if (IFSC_BANK_MAP[prefix]) {
      rawBank = IFSC_BANK_MAP[prefix];
    }
  }

  // Check if rawUpi can be refined with detectUpiId
  if (rawUpi) {
    const refinedUpi = detectUpiId(rawUpi);
    if (refinedUpi) {
      rawUpi = refinedUpi;
    }
  }

  // Determine the primary payment_method
  let payment_method: NormalizedPaymentMethod = null;
  const cleanMode = rawMode.toLowerCase().replace(/[^a-z0-9]/g, '');

  const hasUpiInfo = Boolean(rawUpi && rawUpi.trim());
  const hasBankInfo = Boolean(rawAccNum || rawIfsc || rawAccHolder || rawBank);

  const isExplicitUpi = cleanMode === 'upi' || cleanMode === 'gpay' || cleanMode === 'googlepay' || cleanMode === 'gpaynumber' || cleanMode === 'phonepe' || cleanMode === 'phonepaynumber' || cleanMode === 'paytm' || cleanMode.includes('upi') || cleanMode.includes('gpay');
  const isExplicitBank = cleanMode === 'bank' || cleanMode === 'acc' || cleanMode === 'account' || cleanMode === 'bankaccount' || cleanMode === 'bankdetails' || cleanMode === 'accountdetails' || cleanMode.includes('bank') || cleanMode.includes('account');

  if (isExplicitUpi && isExplicitBank) {
    // Mixed mode like "bank / upi": prefer UPI when valid UPI exists, else ACCOUNT_DETAILS
    payment_method = hasUpiInfo ? 'UPI' : (hasBankInfo ? 'ACCOUNT_DETAILS' : 'UPI');
  } else if (isExplicitUpi) {
    payment_method = 'UPI';
  } else if (isExplicitBank) {
    payment_method = 'ACCOUNT_DETAILS';
  } else if (hasUpiInfo && !hasBankInfo) {
    payment_method = 'UPI';
  } else if (hasBankInfo && !hasUpiInfo) {
    payment_method = 'ACCOUNT_DETAILS';
  } else if (hasUpiInfo && hasBankInfo) {
    payment_method = 'UPI';
  } else {
    payment_method = null;
  }

  return {
    payment_method,
    upi_number: rawUpi || null,
    account_holder_name: rawAccHolder || null,
    account_number: rawAccNum || null,
    ifsc_code: rawIfsc || null,
    bank_name: rawBank || null,
    pan_number: rawPan || null
  };
}

/**
 * Resolves current payment details from an influencer record or dispatch record
 */
export function resolveInfluencerPaymentDetails(record: any): NormalizedPaymentDetails {
  if (!record) {
    return {
      payment_method: null,
      upi_number: null,
      account_holder_name: null,
      account_number: null,
      ifsc_code: null,
      bank_name: null,
      pan_number: null
    };
  }

  const rawMethod = record.payment_method || null;
  const upi = record.upi_number ? String(record.upi_number).trim() : null;
  const accNum = record.account_number ? String(record.account_number).trim() : null;
  const accHolder = record.account_holder_name ? String(record.account_holder_name).trim() : null;
  const ifsc = record.ifsc_code ? String(record.ifsc_code).trim().toUpperCase() : null;
  const bank = record.bank_name ? String(record.bank_name).trim() : null;
  const pan = record.pan_number ? String(record.pan_number).trim().toUpperCase() : null;

  const normalizedMethod = normalizePaymentMethod(rawMethod);

  if (normalizedMethod === 'ACCOUNT_DETAILS' || (!normalizedMethod && accNum)) {
    return {
      payment_method: 'ACCOUNT_DETAILS',
      upi_number: null,
      account_holder_name: accHolder,
      account_number: accNum,
      ifsc_code: ifsc,
      bank_name: bank,
      pan_number: pan
    };
  }

  if (normalizedMethod === 'UPI' || (!normalizedMethod && upi)) {
    return {
      payment_method: 'UPI',
      upi_number: upi,
      account_holder_name: null,
      account_number: null,
      ifsc_code: null,
      bank_name: null,
      pan_number: null
    };
  }

  return {
    payment_method: null,
    upi_number: null,
    account_holder_name: null,
    account_number: null,
    ifsc_code: null,
    bank_name: null,
    pan_number: null
  };
}
