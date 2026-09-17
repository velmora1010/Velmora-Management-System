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
 * Treats UPI, GPay, Google Pay as UPI.
 * Treats Account, Bank, Bank Details as ACCOUNT_DETAILS.
 */
export function normalizePaymentMethod(rawMethod: any): NormalizedPaymentMethod {
  if (!rawMethod) return null;
  const str = String(rawMethod).trim();
  if (!str) return null;

  // Clean alphanumeric + lowercase
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. UPI / GPay / Google Pay (Must all normalize to 'UPI')
  if (
    clean === 'upi' ||
    clean === 'gpay' ||
    clean === 'googlepay' ||
    clean === 'gpayupi' ||
    clean === 'upigpay' ||
    clean === 'phonepe' ||
    clean === 'paytm' ||
    clean === 'bhim' ||
    clean === 'bhimupi' ||
    clean === 'upiid' ||
    clean === 'upinumber' ||
    clean.includes('googlepay') ||
    clean.includes('gpay') ||
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
export function detectUpiId(input: any): string | null {
  if (!input) return null;
  const str = String(input).trim();
  if (!str) return null;

  // Standard UPI ID pattern: [handle]@[provider]
  const upiRegex = /[a-zA-Z0-9.\-_]{2,}@[a-zA-Z0-9.\-_]{2,}/;
  const match = str.match(upiRegex);

  if (match) {
    let upi = match[0].trim();
    upi = upi.replace(/[.,;:]+$/, '');
    return upi;
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
export function parseBankDetailsText(input: any): {
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
 * 1. Payment Mode column
 * 2. Payments column
 * 3. Details column
 * Returns canonical NormalizedPaymentDetails
 */
export function parseExcelPaymentDetails(params: ParseExcelPaymentParams): NormalizedPaymentDetails {
  const rawMode = params.paymentMode !== undefined && params.paymentMode !== null ? String(params.paymentMode).trim() : '';
  const rawPayments = params.payments !== undefined && params.payments !== null ? String(params.payments).trim() : '';
  const rawDetails = params.details !== undefined && params.details !== null ? String(params.details).trim() : '';

  const explicitMethod = normalizePaymentMethod(rawMode);

  // -------------------------------------------------------------
  // RULE 1: Explicit Payment Mode is recognized as UPI (or GPay/Google Pay)
  // -------------------------------------------------------------
  if (explicitMethod === 'UPI') {
    const upiId = detectUpiId(rawPayments) || detectUpiId(rawDetails) || (rawPayments ? rawPayments.trim() : null);

    return {
      payment_method: 'UPI',
      upi_number: upiId || null,
      account_holder_name: null,
      account_number: null,
      ifsc_code: null,
      bank_name: null,
      pan_number: null
    };
  }

  // -------------------------------------------------------------
  // RULE 2: Explicit Payment Mode is recognized as Account Details / Bank
  // -------------------------------------------------------------
  if (explicitMethod === 'ACCOUNT_DETAILS') {
    const combinedBankText = [rawDetails, rawPayments].filter(Boolean).join('\n');
    const parsedBank = parseBankDetailsText(combinedBankText);

    return {
      payment_method: 'ACCOUNT_DETAILS',
      upi_number: null,
      account_holder_name: parsedBank.account_holder_name || null,
      account_number: parsedBank.account_number || null,
      ifsc_code: parsedBank.ifsc_code || null,
      bank_name: parsedBank.bank_name || null,
      pan_number: parsedBank.pan_number || null
    };
  }

  // -------------------------------------------------------------
  // RULE 3: Empty / Unknown Payment Mode - Inferred from Payments & Details
  // -------------------------------------------------------------
  // 3A. Check if Payments or Details clearly contains a valid UPI ID
  const detectedUpi = detectUpiId(rawPayments) || detectUpiId(rawDetails);
  if (detectedUpi) {
    return {
      payment_method: 'UPI',
      upi_number: detectedUpi,
      account_holder_name: null,
      account_number: null,
      ifsc_code: null,
      bank_name: null,
      pan_number: null
    };
  }

  // 3B. Check if Details or Payments clearly contains bank account fields
  const combinedText = [rawDetails, rawPayments].filter(Boolean).join('\n');
  const parsedBank = parseBankDetailsText(combinedText);

  const hasClearBankInfo = Boolean(
    (parsedBank.account_number && (parsedBank.ifsc_code || parsedBank.account_holder_name || parsedBank.bank_name)) ||
    (parsedBank.ifsc_code && (parsedBank.account_holder_name || parsedBank.account_number)) ||
    (parsedBank.account_number && parsedBank.pan_number)
  );

  if (hasClearBankInfo) {
    return {
      payment_method: 'ACCOUNT_DETAILS',
      upi_number: null,
      account_holder_name: parsedBank.account_holder_name || null,
      account_number: parsedBank.account_number || null,
      ifsc_code: parsedBank.ifsc_code || null,
      bank_name: parsedBank.bank_name || null,
      pan_number: parsedBank.pan_number || null
    };
  }

  // -------------------------------------------------------------
  // RULE 4: Insufficient information / Unconfigured
  // Do NOT guess. Leave payment method unconfigured.
  // -------------------------------------------------------------
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
