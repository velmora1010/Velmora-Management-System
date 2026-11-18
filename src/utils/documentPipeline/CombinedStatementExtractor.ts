import * as pdfjsLib from 'pdfjs-dist';
import { PdfTextItem } from './types';

export type CombinedClassification = 'debit' | 'credit' | 'unclassified';

export type CombinedReviewStatus =
  | 'ready'
  | 'zero_value'
  | 'ambiguous_both_populated'
  | 'ambiguous'
  | 'duplicate';

export interface CombinedExtractedRow {
  id: string;
  sequence: number;
  transactionDate: string;
  normalizedDate: string | null;
  createdAtIso: string | null;
  postedDateTime: string;
  postedDateTimeIso: string | null;
  chequeRef: string;
  description: string;
  withdrawalAmount: number | null;
  depositAmount: number | null;
  balance: number | null;
  rawWithdrawalText: string;
  rawDepositText: string;
  rawBalanceText: string;
  classification: CombinedClassification;
  targetModule: 'Expense' | 'Credit' | 'Review Required';
  reviewStatus: CombinedReviewStatus;
  classificationReason?: string;
  fingerprint: string;
}

interface RawLogicalRow {
  sequence: number;
  valueDate: string;
  transactionDate: string;
  postedDate: string;
  chequeRef: string;
  remarks: string;
  withdrawal: string;
  deposit: string;
  balance: string;
}

const DATE_PATTERN = /(\d{2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}|\d{2}[\/\-]\d{2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/;

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12'
};

export function parseTransactionDateStrings(rawDate: string): {
  pureTransactionDate: string | null;
  createdAtIso: string | null;
} {
  const trimmed = (rawDate || '').trim();
  if (!trimmed) return { pureTransactionDate: null, createdAtIso: null };

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return {
      pureTransactionDate: `${year}-${month}-${day}`,
      createdAtIso: !isNaN(d.getTime()) ? d.toISOString() : null
    };
  }

  const parts = trimmed.split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    let monthPart = parts[1];
    let year = parts[2];
    if (year.length === 2) {
      year = `20${year}`;
    }

    let parsedDateForCreatedAt: Date | null = null;
    if (!isNaN(Number(monthPart))) {
      parsedDateForCreatedAt = new Date(Number(year), Number(monthPart) - 1, Number(day));
      monthPart = monthPart.padStart(2, '0');
    } else {
      const mapped = MONTH_MAP[monthPart.toLowerCase()];
      monthPart = mapped || '01';
      parsedDateForCreatedAt = new Date(Number(year), Number(monthPart) - 1, Number(day));
    }

    return {
      pureTransactionDate: `${year}-${monthPart}-${day}`,
      createdAtIso:
        parsedDateForCreatedAt && !isNaN(parsedDateForCreatedAt.getTime())
          ? parsedDateForCreatedAt.toISOString()
          : null
    };
  }

  const fallback = new Date(trimmed);
  return {
    pureTransactionDate: trimmed,
    createdAtIso: !isNaN(fallback.getTime()) ? fallback.toISOString() : null
  };
}

export function parsePostedDateTimeIso(rawPostedDateTime: string): string | null {
  const trimmed = (rawPostedDateTime || '').trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(.*)/);
  if (match) {
    const day = match[1];
    const month = match[2];
    const year = match[3];
    const time = match[4];
    const d = new Date(`${month}/${day}/${year} ${time}`);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  const d = new Date(trimmed);
  return !isNaN(d.getTime()) ? d.toISOString() : null;
}

export function normalizePdfSpacing(text: string): string {
  if (!text) return text;
  let s = text.trim();
  s = s.replace(/\b([a-zA-Z0-9])\s+([a-zA-Z0-9]{4,})\b/g, '$1$2');
  s = s.replace(/\b([a-zA-Z0-9]{4,})\s+([a-zA-Z0-9])\b/g, '$1$2');
  s = s.replace(/\b([a-zA-Z0-9]{2})\s+([a-zA-Z0-9]{5,})\b/g, '$1$2');
  s = s.replace(/\b([a-zA-Z0-9]{5,})\s+([a-zA-Z0-9]{2})\b/g, '$1$2');
  s = s.replace(/\b([a-zA-Z0-9]{3})\s+([a-zA-Z0-9]{10,})\b/g, '$1$2');
  s = s.replace(/\b([a-zA-Z0-9]{10,})\s+([a-zA-Z0-9]{3})\b/g, '$1$2');
  s = s.replace(/(\d)\s+(\d)/g, '$1$2');
  return s.replace(/\s+/g, ' ').trim();
}

export interface ParsedMoneyResult {
  amount: number | null;
  isValid: boolean;
  isExplicitZeroOrDash: boolean;
}

export function parseMoneyCell(raw: string): ParsedMoneyResult {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed === '-' || trimmed === '--' || trimmed === '—') {
    return { amount: null, isValid: true, isExplicitZeroOrDash: true };
  }

  // Strip currency symbols, spaces, commas, and trailing Cr/Dr markers
  const withoutMarkers = trimmed
    .replace(/₹|rs\.?|inr/gi, '')
    .replace(/\b(dr|cr)\b/gi, '')
    .replace(/,/g, '')
    .trim();

  if (!withoutMarkers || withoutMarkers === '-' || withoutMarkers === '.') {
    return { amount: null, isValid: true, isExplicitZeroOrDash: true };
  }

  // Must look like a clean decimal number
  if (!/^\d+(\.\d+)?$/.test(withoutMarkers)) {
    return { amount: null, isValid: false, isExplicitZeroOrDash: false };
  }

  const parsed = parseFloat(withoutMarkers);
  if (isNaN(parsed)) {
    return { amount: null, isValid: false, isExplicitZeroOrDash: false };
  }

  if (parsed === 0) {
    return { amount: 0, isValid: true, isExplicitZeroOrDash: true };
  }

  return { amount: parsed, isValid: true, isExplicitZeroOrDash: false };
}

export function computeTransactionFingerprint(params: {
  type: 'debit' | 'credit';
  normalizedDate: string | null;
  postedDateTimeIso: string | null;
  amount: number | null;
  description: string;
  chequeRef?: string | null;
}): string {
  const datePart = (params.normalizedDate || '').trim();
  const postedPart = (params.postedDateTimeIso || '').trim();
  const amtPart = params.amount !== null && params.amount !== undefined ? Number(params.amount).toFixed(2) : '0.00';
  const descPart = (params.description || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const refPart = (params.chequeRef || '').trim().toLowerCase();

  return refPart
    ? `${params.type}|${datePart}|${postedPart}|${amtPart}|${descPart}|${refPart}`
    : `${params.type}|${datePart}|${postedPart}|${amtPart}|${descPart}`;
}

export function classifyCombinedRow(row: {
  sequence: number;
  transactionDate: string;
  postedDateTime: string;
  chequeRef?: string;
  description: string;
  rawWithdrawal: string;
  rawDeposit: string;
  rawBalance: string;
}): CombinedExtractedRow {
  const dateMatch = (row.transactionDate || '').match(DATE_PATTERN);
  const cleanDate = dateMatch ? dateMatch[1] : (row.transactionDate || '').trim();
  const { pureTransactionDate, createdAtIso } = parseTransactionDateStrings(cleanDate);
  const postedDateTimeIso = parsePostedDateTimeIso(row.postedDateTime);
  const description = normalizePdfSpacing(row.description || '') || '-';

  const withdrawalParsed = parseMoneyCell(row.rawWithdrawal);
  const depositParsed = parseMoneyCell(row.rawDeposit);
  const balanceParsed = parseMoneyCell(row.rawBalance);

  const withdrawalAmount =
    withdrawalParsed.isValid && withdrawalParsed.amount !== null && withdrawalParsed.amount > 0
      ? withdrawalParsed.amount
      : null;
  const depositAmount =
    depositParsed.isValid && depositParsed.amount !== null && depositParsed.amount > 0
      ? depositParsed.amount
      : null;
  const balance =
    balanceParsed.isValid && balanceParsed.amount !== null ? balanceParsed.amount : null;

  let classification: CombinedClassification = 'unclassified';
  let targetModule: 'Expense' | 'Credit' | 'Review Required' = 'Review Required';
  let reviewStatus: CombinedReviewStatus = 'ambiguous';
  let classificationReason: string | undefined;

  if (!cleanDate || !DATE_PATTERN.test(cleanDate)) {
    classification = 'unclassified';
    targetModule = 'Review Required';
    reviewStatus = 'ambiguous';
    classificationReason = 'Missing or invalid transaction date';
  } else if (!withdrawalParsed.isValid || !depositParsed.isValid) {
    classification = 'unclassified';
    targetModule = 'Review Required';
    reviewStatus = 'ambiguous';
    classificationReason = 'Ambiguous or unparseable Debit/Credit amount';
  } else if (withdrawalAmount !== null && depositAmount !== null) {
    classification = 'unclassified';
    targetModule = 'Review Required';
    reviewStatus = 'ambiguous_both_populated';
    classificationReason = 'Both Debit (Dr) and Credit (Cr) columns contain positive amounts';
  } else if (withdrawalAmount !== null && withdrawalAmount > 0) {
    classification = 'debit';
    targetModule = 'Expense';
    reviewStatus = 'ready';
  } else if (depositAmount !== null && depositAmount > 0) {
    classification = 'credit';
    targetModule = 'Credit';
    reviewStatus = 'ready';
  } else {
    classification = 'unclassified';
    targetModule = 'Review Required';
    reviewStatus = 'zero_value';
    classificationReason = 'Zero-value or non-financial row (both Debit and Credit are zero or empty)';
  }

  const fingerprint =
    classification === 'debit' || classification === 'credit'
      ? computeTransactionFingerprint({
          type: classification,
          normalizedDate: pureTransactionDate,
          postedDateTimeIso,
          amount: classification === 'debit' ? withdrawalAmount : depositAmount,
          description,
          chequeRef: row.chequeRef
        })
      : `unclassified|${row.sequence}|${cleanDate}|${description.slice(0, 60)}`;

  return {
    id: `tx_${row.sequence}_${Math.random().toString(36).slice(2, 7)}`,
    sequence: row.sequence,
    transactionDate: cleanDate,
    normalizedDate: pureTransactionDate,
    createdAtIso,
    postedDateTime: (row.postedDateTime || '').trim(),
    postedDateTimeIso,
    chequeRef: (row.chequeRef || '').trim(),
    description,
    withdrawalAmount,
    depositAmount,
    balance,
    rawWithdrawalText: (row.rawWithdrawal || '').trim(),
    rawDepositText: (row.rawDeposit || '').trim(),
    rawBalanceText: (row.rawBalance || '').trim(),
    classification,
    targetModule,
    reviewStatus,
    classificationReason,
    fingerprint
  };
}

export class CombinedStatementExtractor {
  static async computeFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async extractFromFile(file: File): Promise<{
    rows: CombinedExtractedRow[];
    fileHash: string;
    pageCount: number;
  }> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'pdf') {
      throw new Error(`Unsupported file "${file.name}". Please upload a bank statement PDF (.pdf).`);
    }

    if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
    }

    const fileHash = await this.computeFileHash(file);
    const arrayBuffer = await file.arrayBuffer();

    let pdf: any;
    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (err: any) {
      throw new Error(`Could not read PDF "${file.name}". The file may be corrupted or password-protected.`);
    }

    const pages: PdfTextItem[][] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageItems: PdfTextItem[] = [];

      for (const item of textContent.items) {
        if ('str' in item && 'transform' in item && item.str.trim() !== '') {
          pageItems.push({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height
          });
        }
      }
      if (pageItems.length > 0) {
        pages.push(pageItems);
      }
    }

    if (pages.length === 0) {
      throw new Error(
        `The PDF "${file.name}" appears to be scanned or contains no extractable text. Please upload a machine-readable bank statement PDF.`
      );
    }

    const rows = this.extractFromPages(pages, file.name);
    return { rows, fileHash, pageCount: pdf.numPages };
  }

  static extractFromPages(pages: PdfTextItem[][], fileName: string): CombinedExtractedRow[] {
    if (!pages || pages.length === 0) {
      throw new Error(`The PDF "${fileName}" contains no extractable pages.`);
    }

    type ColKey = keyof Omit<RawLogicalRow, 'sequence'>;
    let globalColBounds: Record<ColKey, { xMin: number; xMax: number } | null> | null = null;
    let reachedEndOfStatement = false;
    const allLogicalRows: RawLogicalRow[] = [];
    let globalSequence = 1;

    const isNoiseRow = (rowTextLower: string): boolean => {
      return (
        rowTextLower.includes('opening balance') ||
        rowTextLower.includes('closing balance') ||
        (rowTextLower.includes('page') && /\d+\s*(of|\/)\s*\d+/.test(rowTextLower)) ||
        rowTextLower.includes('generated on') ||
        rowTextLower.includes('this is a computer generated') ||
        rowTextLower.includes('contents of this') ||
        rowTextLower.includes('account no') ||
        rowTextLower.includes('cifno')
      );
    };

    const normalizeRowText = (row: PdfTextItem[]): string =>
      row
        .map(item => item.text)
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    for (const rawPageItems of pages) {
      if (reachedEndOfStatement) break;
      if (!rawPageItems || rawPageItems.length === 0) continue;

      const pageItems = [...rawPageItems].sort((a, b) => b.y - a.y);
      const visualRows: PdfTextItem[][] = [];
      let currentRow: PdfTextItem[] = [];
      let currentY = pageItems[0].y;

      for (const item of pageItems) {
        if (Math.abs(item.y - currentY) > 6) {
          if (currentRow.length > 0) {
            visualRows.push([...currentRow].sort((a, b) => a.x - b.x));
          }
          currentRow = [item];
          currentY = item.y;
        } else {
          currentRow.push(item);
        }
      }
      if (currentRow.length > 0) {
        visualRows.push([...currentRow].sort((a, b) => a.x - b.x));
      }

      // Detect table header (1 to 3 stacked header lines), skipping metadata lines like "Transaction type: CR"
      let headerStartRow = -1;
      let headerEndRow = -1;

      const isMetadataFilterLine = (txt: string): boolean =>
        txt.includes('transaction remarks:') ||
        txt.includes('transaction type:') ||
        txt.includes('amount from:') ||
        txt.includes('cheque number from:') ||
        txt.includes('transaction period:') ||
        txt.includes('statement request');

      for (let i = 0; i < visualRows.length; i++) {
        const line1 = normalizeRowText(visualRows[i]);
        if (isMetadataFilterLine(line1)) continue;
        const line2 = i + 1 < visualRows.length ? normalizeRowText(visualRows[i + 1]) : '';
        const line3 = i + 2 < visualRows.length ? normalizeRowText(visualRows[i + 2]) : '';

        // Try 1-line header first, then 2-line, then 3-line (never consume data rows starting with a date)
        for (const span of [1, 2, 3]) {
          if (i + span - 1 >= visualRows.length) continue;
          if (span >= 2 && (isMetadataFilterLine(line2) || DATE_PATTERN.test(line2))) continue;
          if (span === 3 && (isMetadataFilterLine(line3) || DATE_PATTERN.test(line3))) continue;

          const merged =
            span === 3 ? `${line1} ${line2} ${line3}` : span === 2 ? `${line1} ${line2}` : line1;

          const hasDate = merged.includes('date');
          const hasDesc =
            merged.includes('remark') ||
            merged.includes('particular') ||
            merged.includes('description') ||
            merged.includes('narration');
          const hasDr =
            merged.includes('withdra') ||
            merged.includes('debit') ||
            /\(dr\)/.test(merged);
          const hasCr =
            merged.includes('deposit') ||
            merged.includes('credit') ||
            /\(cr\)/.test(merged);

          if (hasDate && hasDesc && (hasDr || hasCr)) {
            headerStartRow = i;
            headerEndRow = i + span - 1;
            break;
          }
        }
        if (headerStartRow !== -1) break;
      }

      if (headerStartRow !== -1) {
        let valDateX = -1;
        let transDateX = -1;
        let postedDateX = -1;
        let chequeX = -1;
        let remarksX = -1;
        let withdrawalX = -1;
        let depositX = -1;
        let balanceX = -1;

        for (let i = headerStartRow; i <= headerEndRow; i++) {
          for (const item of visualRows[i]) {
            const t = item.text.toLowerCase().trim();
            if (valDateX === -1 && t.includes('value')) valDateX = item.x;
            if (postedDateX === -1 && t.includes('posted')) postedDateX = item.x;
            if (chequeX === -1 && (t.includes('cheque') || t.includes('ref'))) chequeX = item.x;
            if (
              remarksX === -1 &&
              (t.includes('remark') ||
                t.includes('particular') ||
                t.includes('description') ||
                t.includes('narration'))
            ) {
              remarksX = item.x;
            }
            if (
              withdrawalX === -1 &&
              (t.includes('withdra') || t.includes('debit') || t === 'dr' || t === '(dr)')
            ) {
              withdrawalX = item.x;
            }
            if (
              depositX === -1 &&
              (t.includes('deposit') || t.includes('credit') || t === 'cr' || t === '(cr)')
            ) {
              depositX = item.x;
            }
            if (balanceX === -1 && t.includes('balance')) balanceX = item.x;
          }
        }

        // Detect Transaction Date column (distinct from Value Date & Posted Date)
        for (let i = headerStartRow; i <= headerEndRow; i++) {
          for (const item of visualRows[i]) {
            const t = item.text.toLowerCase().trim();
            if (t.includes('date') || t.includes('transact')) {
              const rightBound =
                postedDateX !== -1
                  ? postedDateX
                  : chequeX !== -1
                    ? chequeX
                    : remarksX !== -1
                      ? remarksX
                      : 9999;
              if (valDateX === -1) {
                if (item.x < rightBound - 10 && transDateX === -1) {
                  transDateX = item.x;
                }
              } else if (item.x > valDateX + 20 && item.x < rightBound - 20) {
                if (transDateX === -1) transDateX = item.x;
              }
            }
          }
        }

        if (transDateX === -1 && valDateX !== -1) {
          transDateX = valDateX;
        }

        const validCols = [
          { name: 'valueDate' as ColKey, x: valDateX },
          { name: 'transactionDate' as ColKey, x: transDateX },
          { name: 'postedDate' as ColKey, x: postedDateX },
          { name: 'chequeRef' as ColKey, x: chequeX },
          { name: 'remarks' as ColKey, x: remarksX },
          { name: 'withdrawal' as ColKey, x: withdrawalX },
          { name: 'deposit' as ColKey, x: depositX },
          { name: 'balance' as ColKey, x: balanceX }
        ]
          .filter(c => c.x !== -1)
          .sort((a, b) => a.x - b.x);

        if (validCols.length >= 3) {
          const bounds = {} as Record<ColKey, { xMin: number; xMax: number } | null>;
          (
            [
              'valueDate',
              'transactionDate',
              'postedDate',
              'chequeRef',
              'remarks',
              'withdrawal',
              'deposit',
              'balance'
            ] as ColKey[]
          ).forEach(k => {
            bounds[k] = null;
          });

          for (let i = 0; i < validCols.length; i++) {
            const current = validCols[i];
            const prev = i > 0 ? validCols[i - 1] : null;
            const next = i < validCols.length - 1 ? validCols[i + 1] : null;

            const xMin = prev ? prev.x + (current.x - prev.x) / 2 : 0;
            const xMax = next ? current.x + (next.x - current.x) / 2 : 9999;
            bounds[current.name] = { xMin, xMax };
          }
          globalColBounds = bounds;
        }
      }

      if (headerEndRow === -1 && !globalColBounds) {
        continue;
      }

      const dataRows = headerEndRow !== -1 ? visualRows.slice(headerEndRow + 1) : visualRows;

      const getColumnFromBounds = (x: number): ColKey | null => {
        if (!globalColBounds) return null;
        for (const [col, b] of Object.entries(globalColBounds)) {
          if (b && x >= b.xMin && x < b.xMax) {
            return col as ColKey;
          }
        }
        return null;
      };

      for (const row of dataRows) {
        const rowText = row.map(item => item.text).join(' ');
        const lowerRow = rowText.toLowerCase();

        if (lowerRow.includes('end of statement')) {
          reachedEndOfStatement = true;
          break;
        }

        const stripped = rowText.replace(/[\s\-]/g, '');
        if (row.length === 0 || stripped.length === 0) continue;
        if (isNoiseRow(lowerRow)) continue;
        if (
          (lowerRow.includes('withdra') || lowerRow.includes('debit')) &&
          (lowerRow.includes('deposit') || lowerRow.includes('credit') || lowerRow.includes('remark'))
        ) {
          continue;
        }

        const logicalRow: RawLogicalRow = {
          sequence: globalSequence++,
          valueDate: '',
          transactionDate: '',
          postedDate: '',
          chequeRef: '',
          remarks: '',
          withdrawal: '',
          deposit: '',
          balance: ''
        };

        for (const item of row) {
          const colName = getColumnFromBounds(item.x);
          if (colName) {
            logicalRow[colName] += (logicalRow[colName] ? ' ' : '') + item.text;
          }
        }

        allLogicalRows.push(logicalRow);
      }
    }

    // Merge wrapped continuation rows (remarks / posted time) onto the preceding transaction row
    const mergedRows: RawLogicalRow[] = [];
    for (const row of allLogicalRows) {
      const hasDate = Boolean(row.transactionDate.trim());
      const hasWithdrawal = Boolean(row.withdrawal.trim());
      const hasDeposit = Boolean(row.deposit.trim());
      const hasRemarks = Boolean(row.remarks.trim());
      const hasPosted = Boolean(row.postedDate.trim());

      if (!hasDate && !hasWithdrawal && !hasDeposit && (hasRemarks || hasPosted)) {
        if (mergedRows.length > 0) {
          const prev = mergedRows[mergedRows.length - 1];
          if (hasRemarks) prev.remarks = `${prev.remarks} ${row.remarks.trim()}`.trim();
          if (hasPosted) prev.postedDate = `${prev.postedDate} ${row.postedDate.trim()}`.trim();
        }
      } else if (hasDate || hasWithdrawal || hasDeposit) {
        mergedRows.push({ ...row });
      }
    }

    const extracted = mergedRows.map(row =>
      classifyCombinedRow({
        sequence: row.sequence,
        transactionDate: row.transactionDate,
        postedDateTime: row.postedDate,
        chequeRef: row.chequeRef,
        description: row.remarks,
        rawWithdrawal: row.withdrawal,
        rawDeposit: row.deposit,
        rawBalance: row.balance
      })
    );

    if (extracted.length === 0) {
      throw new Error(
        `Could not extract any statement rows from "${fileName}". Please ensure it is a valid bank statement PDF with Date, Description, and Debit/Credit columns.`
      );
    }

    return extracted;
  }
}
