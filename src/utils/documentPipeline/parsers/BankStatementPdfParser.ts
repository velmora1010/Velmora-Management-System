import { DocumentParser, NormalizedTransaction, PdfTextItem } from '../types';

export class BankStatementPdfParser implements DocumentParser {
  async parse(rawContent: PdfTextItem[], file: File): Promise<NormalizedTransaction[]> {
    if (!rawContent || rawContent.length === 0) {
      throw new Error(`The PDF ${file.name} appears to be scanned or contains no extractable text. Please upload a machine-readable bank statement.`);
    }

    // Sort items top-to-bottom, then left-to-right
    // Note: PDF y-coordinates usually start from bottom-left, so higher Y means higher on page
    const sortedItems = [...rawContent].sort((a, b) => {
      // Allow slight Y variation (e.g. 5 pixels) for items on the same line
      if (Math.abs(b.y - a.y) > 5) {
        return b.y - a.y; // Descending Y (top to bottom)
      }
      return a.x - b.x; // Ascending X (left to right)
    });

    // Group items into lines
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentY = sortedItems.length > 0 ? sortedItems[0].y : 0;

    for (const item of sortedItems) {
      if (Math.abs(item.y - currentY) > 5) {
        if (currentLine.length > 0) {
          lines.push([...currentLine]);
        }
        currentLine = [item.text];
        currentY = item.y;
      } else {
        currentLine.push(item.text);
      }
    }
    if (currentLine.length > 0) {
      lines.push([...currentLine]);
    }

    const transactions: NormalizedTransaction[] = [];
    // Date formats: DD/MM/YYYY, DD-MMM-YYYY, DD/MM/YY, etc.
    const dateRegex = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}[\s\-][a-zA-Z]{3}[\s\-]\d{2,4})$/;

    for (const line of lines) {
      // Filter out empty spaces
      const cols = line.map(c => c.trim()).filter(c => c.length > 0);
      if (cols.length < 3) continue;

      // Check if the first column is a date
      if (dateRegex.test(cols[0])) {
        const date = cols[0];
        
        // Find amount (look for last columns containing numbers)
        let amount = 0;
        let notes = '';

        // Simplistic assumption: Description is right after Date, Amount is near the end
        // Combine middle columns into notes
        notes = cols.slice(1, cols.length - 2).join(' ');

        // Look at the last two columns for amounts (could be withdrawal, deposit, or balance)
        const possibleAmounts = cols.slice(-2);
        for (const amtStr of possibleAmounts) {
          const parsed = parseFloat(amtStr.replace(/,/g, ''));
          if (!isNaN(parsed) && parsed !== 0) {
            amount = parsed; // Grab the last valid non-zero amount
          }
        }

        if (amount !== 0) {
          transactions.push({
            date,
            amount,
            notes,
            vendor: 'Bank Transaction', // Default fallback
            payment_mode: 'Net Banking'
          });
        }
      }
    }

    if (transactions.length === 0) {
      throw new Error(`Could not find any valid transaction rows in ${file.name}. Please ensure this is a standard bank statement.`);
    }

    return transactions;
  }
}
