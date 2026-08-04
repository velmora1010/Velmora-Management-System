import { DocumentParser, NormalizedTransaction, PdfTextItem } from '../types';

export class IciciBankStatementPdfParser implements DocumentParser {
  async parse(rawContent: PdfTextItem[], file: File): Promise<NormalizedTransaction[]> {
    if (!rawContent || rawContent.length === 0) {
      throw new Error(`The PDF ${file.name} appears to be empty or scanned.`);
    }

    // Sort items top-to-bottom, then left-to-right
    const sortedItems = [...rawContent].sort((a, b) => {
      if (Math.abs(b.y - a.y) > 12) {
        return b.y - a.y; 
      }
      return a.x - b.x; 
    });

    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentY = sortedItems.length > 0 ? sortedItems[0].y : 0;

    for (const item of sortedItems) {
      const text = item.text.trim();
      if (!text) continue;

      if (Math.abs(item.y - currentY) > 12) {
        if (currentLine.length > 0) {
          lines.push([...currentLine]);
        }
        currentLine = [text];
        currentY = item.y;
      } else {
        currentLine.push(text);
      }
    }
    if (currentLine.length > 0) {
      lines.push([...currentLine]);
    }

    const transactions: NormalizedTransaction[] = [];
    let currentTx: NormalizedTransaction | null = null;

    const isDate = (str: string) => {
      return /^\d{2}[\/\-][A-Za-z]{3}[\/\-]\d{4}$/.test(str) || /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(str);
    };

    const isTime = (str: string) => {
      return /^\d{2}:\d{2}:\d{2}$/.test(str) || /^(AM|PM)$/i.test(str);
    };

    const isIgnoredLine = (lineArr: string[]) => {
      const str = lineArr.join(' ').toLowerCase();
      if (str.includes('page') && str.includes('of')) return true;
      if (str.includes('sl no') && str.includes('tran id')) return true;
      if (str.includes('value date') && str.includes('transaction date')) return true;
      if (str.includes('withdrawal (dr)') || str.includes('deposit (cr)')) return true;
      if (str.includes('balance') && str.includes('transaction remarks')) return true;
      return false;
    };

    console.log("=== ICICI PDF PARSER DEBUG ===");
    console.log("Total Raw Items:", rawContent.length);
    console.log("Grouped Lines:", lines);

    for (const line of lines) {
      const fullLineStr = line.join(' ');
      const strippedStr = fullLineStr.replace(/\s+/g, '');

      // Check if this line is a new transaction by searching for a date anywhere in the condensed string
      const dateMatch = strippedStr.match(/(\d{2}[\/\-][A-Za-z]{3}[\/\-]\d{4}|\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
      const hasDate = dateMatch !== null;

      if (hasDate) {
        if (currentTx) {
          transactions.push(currentTx);
        }

        const dateStr = dateMatch![1];

        let balanceStr = '';
        let amountStr = '';
        let remarksStartIdx = 0;
        let remarksEndIdx = line.length - 1;

        for (let i = 0; i < line.length; i++) {
          if (isDate(line[i]) || isTime(line[i])) {
            remarksStartIdx = i + 1;
          }
        }

        const isNumber = (str: string) => /^[\d,]+\.\d{2}$/.test(str);

        if (isNumber(line[line.length - 1])) {
          balanceStr = line[line.length - 1];
          remarksEndIdx = line.length - 2;
          
          if (remarksEndIdx >= 0 && isNumber(line[remarksEndIdx])) {
            amountStr = line[remarksEndIdx];
            remarksEndIdx--;
          }
        }

        const notes = line.slice(remarksStartIdx, remarksEndIdx + 1).join(' ');
        const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
        const balance = parseFloat(balanceStr.replace(/,/g, '')) || 0;

        currentTx = {
          date: dateStr,
          amount: amount,
          notes: notes.trim(),
          vendor: 'ICICI Bank Transaction', 
          payment_mode: 'Bank Transfer'
        };
      } else {
        // Not a new transaction line, append to notes of currentTx
        if (currentTx && !isIgnoredLine(line)) {
          const additionalNotes = fullLineStr.trim();
          if (additionalNotes) {
            currentTx.notes += ' ' + additionalNotes;
          }
        }
      }
    }

    if (currentTx) {
      transactions.push(currentTx);
    }

    if (transactions.length === 0) {
      throw new Error(`Could not find any valid transaction rows in ${file.name}. Please ensure this is an ICICI bank statement.`);
    }

    return transactions;
  }
}
