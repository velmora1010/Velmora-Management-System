import { DocumentParser, NormalizedTransaction } from '../types';

export class IciciBankStatementExcelParser implements DocumentParser {
  async parse(rawContent: any[][], file: File): Promise<NormalizedTransaction[]> {
    if (!rawContent || rawContent.length === 0) {
      throw new Error(`The worksheet in ${file.name} is empty.`);
    }

    let headerRowIndex = -1;
    let colMap: Record<string, number> = {};

    // 1. Locate the header row
    for (let i = 0; i < rawContent.length; i++) {
      const row = rawContent[i];
      if (!row || row.length === 0) continue;

      const rowText = row.join(' ').toLowerCase();
      // Heuristic to find the main transaction table
      if (
        rowText.includes('transaction date') &&
        rowText.includes('withdrawal') &&
        rowText.includes('deposit')
      ) {
        headerRowIndex = i;
        
        // Build column map with extreme normalization
        row.forEach((header: any, index: number) => {
          if (header) {
            // lowercase, remove spaces, underscores, hyphens, slashes, parentheses, periods
            const normalizedHeader = String(header).toLowerCase().replace(/[\s_\-\/\(\)\.]/g, '');
            colMap[normalizedHeader] = index;
          }
        });
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error(`Could not locate the transaction headers in ${file.name}.`);
    }

    const transactions: NormalizedTransaction[] = [];
    let sequenceCounter = 1;

    // 2. Process rows after the header
    for (let i = headerRowIndex + 1; i < rawContent.length; i++) {
      const row = rawContent[i];
      
      // Skip empty rows
      if (!row || row.every(cell => cell === undefined || cell === null || cell === '')) {
        continue;
      }

      // Helper to safely get column value using flexible keyword matching (includes)
      const getVal = (keyword: string) => {
        const keywordNorm = keyword.toLowerCase().replace(/[\s_\-\/\(\)\.]/g, '');
        for (const [mappedHeader, index] of Object.entries(colMap)) {
          if (mappedHeader.includes(keywordNorm)) {
            return row[index]?.toString().trim() || null;
          }
        }
        return null;
      };

      // Extract raw strings using keyword matching
      const txDateStr = getVal('transactiondate') || getVal('date');
      const postedDateStr = getVal('transactionposteddate') || getVal('posteddate');
      const remarksStr = getVal('transactionremarks') || getVal('remarks') || getVal('narration') || getVal('description');
      const withdrawalStr = getVal('withdrawal') || getVal('debit');
      const depositStr = getVal('deposit') || getVal('credit');

      // End of statement summary check (e.g. "Opening Balance", "Total")
      if (!txDateStr && !withdrawalStr && !depositStr) {
        continue; // Skip footer or summary rows
      }

      // We only care about debits/withdrawals
      const depositAmount = depositStr ? parseFloat(depositStr.replace(/[^0-9.-]+/g, '')) : 0;
      if (depositAmount > 0) {
        continue;
      }

      const amount = withdrawalStr ? parseFloat(withdrawalStr.replace(/[^0-9.-]+/g, '')) : 0;
      if (!amount || isNaN(amount) || amount <= 0) {
        continue;
      }

      transactions.push({
        sequence: sequenceCounter++,
        transactionDate: txDateStr || undefined,
        postedDateTime: postedDateStr || undefined,
        date: txDateStr || undefined,
        amount,
        notes: remarksStr || '',
        vendor: 'ICICI Bank Transaction',
      });
    }

    if (transactions.length === 0) {
      throw new Error(`Could not extract any valid debit transactions from ${file.name}.`);
    }

    return transactions;
  }
}
