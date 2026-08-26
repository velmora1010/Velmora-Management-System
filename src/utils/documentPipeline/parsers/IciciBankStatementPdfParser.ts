import { DocumentParser, NormalizedTransaction, PdfTextItem } from '../types';

interface LogicalRow {
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

const DATE_PATTERN = /(\d{2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}|\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/;

export class IciciBankStatementPdfParser implements DocumentParser {
  async parse(rawContent: PdfTextItem[], file: File): Promise<NormalizedTransaction[]> {
    console.log('================ PARSER START ================');
    console.log(`Total PdfTextItems: ${rawContent?.length || 0}`);

    if (!rawContent || rawContent.length === 0) {
      throw new Error(`The PDF ${file.name} appears to be empty or scanned.`);
    }

    // ── Stage 1: Extract PDF Items ──
    const pages: PdfTextItem[][] = [];
    let currentPage: PdfTextItem[] = [];
    let lastY = rawContent[0].y;

    for (const item of rawContent) {
      if (item.y - lastY > 300) {
        if (currentPage.length > 0) {
          pages.push(currentPage);
        }
        currentPage = [];
      }
      currentPage.push(item);
      lastY = item.y;
    }
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    // ── Shared Diagnostics & State ──
    let globalColBounds: Record<keyof LogicalRow, { xMin: number, xMax: number } | null> | null = null;
    let reachedEndOfStatement = false;
    
    let diagTotalGroupedRows = 0;
    let diagHeaderRowIndex = -1;
    let diagLogicalRowsBuilt = 0;
    let diagMergedRemarkRows = 0;
    const allLogicalRows: LogicalRow[] = [];
    let globalSequence = 1;

    const isNoiseRow = (rowTextLower: string): boolean => {
      return (
        rowTextLower.includes('opening balance') ||
        rowTextLower.includes('closing balance') ||
        (rowTextLower.includes('page') && /\d+\s*(of|\/)\s*\d+/.test(rowTextLower)) ||
        rowTextLower.includes('generated on') ||
        rowTextLower.includes('this is a computer generated') ||
        rowTextLower.includes('contents of this') ||
        rowTextLower.includes('icici bank') ||
        rowTextLower.includes('account no') ||
        rowTextLower.includes('cifno')
      );
    };

    const normalizeRowText = (row: PdfTextItem[]): string => {
      return row.map(item => item.text).join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
    };

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      if (reachedEndOfStatement) break;

      const pageItems = pages[pageIdx];

      // ── Stage 2: Build Visual Rows ──
      pageItems.sort((a, b) => b.y - a.y);

      const rows: PdfTextItem[][] = [];
      let currentRow: PdfTextItem[] = [];
      let currentY = pageItems[0].y;

      for (const item of pageItems) {
        if (Math.abs(item.y - currentY) > 6) {
          if (currentRow.length > 0) {
            rows.push([...currentRow].sort((a, b) => a.x - b.x));
          }
          currentRow = [item];
          currentY = item.y;
        } else {
          currentRow.push(item);
        }
      }
      if (currentRow.length > 0) {
        rows.push([...currentRow].sort((a, b) => a.x - b.x));
      }

      diagTotalGroupedRows += rows.length;

      // ── Stage 3: Detect Table Header ──
      let headerStartRow = -1;
      let headerRowIndex = -1;

      for (let i = 0; i < rows.length - 2; i++) {
        const mergedText = normalizeRowText(rows[i]) + ' ' + normalizeRowText(rows[i+1]) + ' ' + normalizeRowText(rows[i+2]);
        const hasDate = mergedText.includes('date');
        const hasRemarks = mergedText.includes('remark') || mergedText.includes('particular');
        const hasWithdrawal = mergedText.includes('withdra') || mergedText.includes('withdraw');
        
        if (hasDate && hasRemarks && hasWithdrawal) {
          headerStartRow = i;
          headerRowIndex = i + 2;
          if (diagHeaderRowIndex === -1) {
            diagHeaderRowIndex = headerRowIndex;
          }
          break;
        }
      }

      // ── Stage 4: Detect ALL Column Boundaries ──
      if (headerStartRow !== -1) {
        let valDateX = -1, transDateX = -1, postedDateX = -1, chequeX = -1, remarksX = -1, withdrawalX = -1, depositX = -1, balanceX = -1;

        for (let i = headerStartRow; i <= headerRowIndex; i++) {
          for (const item of rows[i]) {
            const t = item.text.toLowerCase().trim();
            if (valDateX === -1 && t.includes('value')) valDateX = item.x;
            if (postedDateX === -1 && t.includes('posted')) postedDateX = item.x;
            if (chequeX === -1 && (t.includes('cheque') || t.includes('ref'))) chequeX = item.x;
            if (remarksX === -1 && (t.includes('remark') || t.includes('particular'))) remarksX = item.x;
            if (withdrawalX === -1 && (t.includes('withdra') || t.includes('withdraw'))) withdrawalX = item.x;
            if (depositX === -1 && t.includes('deposit')) depositX = item.x;
            if (balanceX === -1 && t.includes('balance')) balanceX = item.x;
          }
        }
        
        // Find Transaction Date reliably
        for (let i = headerStartRow; i <= headerRowIndex; i++) {
          for (const item of rows[i]) {
            const t = item.text.toLowerCase().trim();
            if (t.includes('date') || t.includes('transact')) {
              const rightBound = postedDateX !== -1 ? postedDateX : (remarksX !== -1 ? remarksX : 9999);
              if (item.x > valDateX + 20 && item.x < rightBound - 20) {
                if (transDateX === -1) transDateX = item.x;
              }
            }
          }
        }

        type ColName = keyof LogicalRow;
        const validCols = [
          { name: 'valueDate' as ColName, x: valDateX },
          { name: 'transactionDate' as ColName, x: transDateX },
          { name: 'postedDate' as ColName, x: postedDateX },
          { name: 'chequeRef' as ColName, x: chequeX },
          { name: 'remarks' as ColName, x: remarksX },
          { name: 'withdrawal' as ColName, x: withdrawalX },
          { name: 'deposit' as ColName, x: depositX },
          { name: 'balance' as ColName, x: balanceX }
        ].filter(c => c.x !== -1).sort((a, b) => a.x - b.x);

        const bounds = {} as Record<ColName, { xMin: number, xMax: number } | null>;
        
        ['valueDate', 'transactionDate', 'postedDate', 'chequeRef', 'remarks', 'withdrawal', 'deposit', 'balance'].forEach(k => {
          bounds[k as ColName] = null;
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

      if (headerRowIndex === -1 && !globalColBounds) {
        continue; // Skip noise pages before table starts
      }

      const dataRows = headerRowIndex !== -1 ? rows.slice(headerRowIndex + 1) : rows;

      const getColumnFromBounds = (x: number): Exclude<keyof LogicalRow, 'sequence'> | null => {
        if (!globalColBounds) return null;
        for (const [col, bounds] of Object.entries(globalColBounds)) {
          if (bounds && x >= bounds.xMin && x < bounds.xMax) {
            return col as Exclude<keyof LogicalRow, 'sequence'>;
          }
        }
        return null;
      };

      // ── Stage 5: Build LogicalRow Objects ──
      for (const row of dataRows) {
        const rowText = row.map(item => item.text).join(' ');
        const lowerRow = rowText.toLowerCase();

        if (lowerRow.includes('end of statement')) {
          reachedEndOfStatement = true;
          break;
        }

        const stripped = rowText.replace(/[\s\-]/g, '');
        if (row.length === 0 || stripped.length === 0) {
          continue;
        }

        if (isNoiseRow(lowerRow)) {
          continue;
        }

        if (lowerRow.includes('withdra') && (lowerRow.includes('deposit') || lowerRow.includes('remark'))) {
          continue; // Repeated header
        }

        const logicalRow: LogicalRow = {
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
        diagLogicalRowsBuilt++;
      }
    }

    // ── Stage 6: Merge Wrapped Remarks ──
    const mergedRows: LogicalRow[] = [];
    for (const row of allLogicalRows) {
      if (!row.transactionDate.trim() && !row.withdrawal.trim() && row.remarks.trim()) {
        if (mergedRows.length > 0) {
          mergedRows[mergedRows.length - 1].remarks += ' ' + row.remarks.trim();
          diagMergedRemarkRows++;
        }
      } else if (row.transactionDate.trim() || row.withdrawal.trim() || row.deposit.trim()) {
        mergedRows.push({ ...row });
      }
    }

    // ── Stage 7: Convert to NormalizedTransaction ──
    const normalizePdfSpacing = (text: string): string => {
      if (!text) return text;
      let s = text.trim();
      // Fix 1 char separated from >= 4 chars
      s = s.replace(/\b([a-zA-Z0-9])\s+([a-zA-Z0-9]{4,})\b/g, '$1$2');
      s = s.replace(/\b([a-zA-Z0-9]{4,})\s+([a-zA-Z0-9])\b/g, '$1$2');
      // Fix 2 chars separated from >= 5 chars
      s = s.replace(/\b([a-zA-Z0-9]{2})\s+([a-zA-Z0-9]{5,})\b/g, '$1$2');
      s = s.replace(/\b([a-zA-Z0-9]{5,})\s+([a-zA-Z0-9]{2})\b/g, '$1$2');
      // Fix 3 chars separated from >= 10 chars
      s = s.replace(/\b([a-zA-Z0-9]{3})\s+([a-zA-Z0-9]{10,})\b/g, '$1$2');
      s = s.replace(/\b([a-zA-Z0-9]{10,})\s+([a-zA-Z0-9]{3})\b/g, '$1$2');
      // Fix space between numbers
      s = s.replace(/(\d)\s+(\d)/g, '$1$2');
      return s;
    };

    const extractDate = (str: string): string | null => {
      const match = str.match(DATE_PATTERN);
      return match ? match[1] : null;
    };

    const cleanMoney = (str: string): number => {
      const cleaned = str.replace(/,/g, '').replace(/[^\d.]/g, '');
      if (cleaned === '' || cleaned === '.') return 0;
      const val = parseFloat(cleaned);
      return isNaN(val) ? 0 : val;
    };

    const validTransactions: NormalizedTransaction[] = [];

    for (const row of mergedRows) {
      if (!row.transactionDate.trim()) {
        continue;
      }
      
      const withdrawalAmt = cleanMoney(row.withdrawal);
      if (withdrawalAmt <= 0) {
        continue;
      }

      validTransactions.push({
        sequence: row.sequence,
        transactionDate: row.transactionDate.trim(),
        postedDateTime: row.postedDate.trim(),
        date: extractDate(row.transactionDate) || row.transactionDate,
        amount: withdrawalAmt,
        notes: normalizePdfSpacing(row.remarks) || '-'
      });
    }

    // ── Stage 8: Diagnostics ──
    console.log('========== RECONSTRUCTED LOGICAL TABLE (FIRST 10) ==========');
    
    for (let idx = 0; idx < Math.min(10, mergedRows.length); idx++) {
      const row = mergedRows[idx];
      console.log('--------------------------------------------------');
      console.log(`LogicalRow ${idx}`);
      console.log(`sequence: ${row.sequence}`);
      console.log(`transactionDate: ${row.transactionDate}`);
      console.log(`valueDate: ${row.valueDate}`);
      console.log(`postedDate: ${row.postedDate}`);
      console.log(`remarks: ${row.remarks}`);
      console.log(`withdrawal: ${row.withdrawal}`);
      
      const withdrawalAmt = cleanMoney(row.withdrawal);
      const parsedDate = extractDate(row.transactionDate) || row.transactionDate;
      
      console.log(`↓`);
      console.log(`NormalizedTransaction`);
      console.log(`sequence         : ${row.sequence}`);
      console.log(`transactionDate  : ${row.transactionDate.trim()}`);
      console.log(`postedDateTime   : ${row.postedDate.trim()}`);
      console.log(`date             : ${parsedDate}`);
      console.log(`amount           : ${withdrawalAmt}`);
      console.log(`notes            : ${row.remarks.trim() || '-'}`);
    }
    console.log('--------------------------------------------------');

    console.log('========== PARSER DIAGNOSTICS ==========');
    console.log(`Total PDF items               : ${rawContent.length}`);
    console.log(`Total grouped rows            : ${diagTotalGroupedRows}`);
    console.log(`Header row index (Page 1)     : ${diagHeaderRowIndex}`);
    console.log(`Detected column bounds        : ${JSON.stringify(globalColBounds, null, 2)}`);
    console.log(`Logical rows built            : ${diagLogicalRowsBuilt}`);
    console.log(`Merged remark rows            : ${diagMergedRemarkRows}`);
    console.log(`Normalized transactions built : ${validTransactions.length}`);
    console.log('========================================');

    // ── VALIDATION ──
    if (validTransactions.length === 0) {
      throw new Error(
        `Could not find any valid withdrawal transactions in ${file.name}. ` +
        `Reconstructed ${mergedRows.length} logical rows but none passed validation. ` +
        `Please ensure this is an ICICI bank debit statement.`
      );
    }

    return validTransactions;
  }
}
