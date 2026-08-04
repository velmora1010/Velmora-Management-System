import { DocumentParser, NormalizedTransaction } from '../types';

export class ExcelExpenseParser implements DocumentParser {
  async parse(rawContent: any[][], file: File): Promise<NormalizedTransaction[]> {
    if (!rawContent || rawContent.length === 0) {
      throw new Error(`The worksheet in ${file.name} is empty.`);
    }

    const rawHeaders = rawContent[0];
    const headers = rawHeaders.map(h => String(h ?? '').trim());
    
    // Strict column mapping logic as planned
    const colMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase().replace(/\s+/g, ''); // normalize spaces and case
      colMap[lowerHeader] = index;
    });

    const rows = rawContent.slice(1);
    const transactions: NormalizedTransaction[] = [];

    for (const row of rows) {
      // Check if row is completely empty
      if (row.every(cell => cell === undefined || cell === null || cell === '')) {
        continue;
      }

      const getVal = (possibleHeaders: string[]) => {
        for (const h of possibleHeaders) {
          const lowerH = h.toLowerCase().replace(/\s+/g, '');
          if (colMap[lowerH] !== undefined) {
            return row[colMap[lowerH]]?.toString().trim() || null;
          }
        }
        return null;
      };

      const dateStr = getVal(['Date', 'Date of Transaction', 'Transaction Date']);
      const amountStr = getVal(['Amount', 'Total Amount', 'Value']);
      const quantityStr = getVal(['Quantity', 'Qty']);
      
      const amount = amountStr ? parseFloat(amountStr.replace(/[^0-9.-]+/g, '')) : 0;
      const quantity = quantityStr ? parseFloat(quantityStr.replace(/[^0-9.-]+/g, '')) : null;

      if (!amountStr || isNaN(amount)) {
        // Required field missing, skip or throw depending on strictness
        continue;
      }

      transactions.push({
        date: dateStr || undefined,
        amount,
        quantity,
        vendor: getVal(['Vendor', 'Vendor Name', 'Supplier']),
        gst_status: getVal(['GST Status', 'GST']),
        payment_mode: getVal(['Payment Mode', 'Payment Method']),
        bank_account: getVal(['Bank Account', 'Account']),
        purchased_by: getVal(['Purchased By', 'Buyer']),
        approved_by: getVal(['Approved By', 'Approver']),
        main_category: getVal(['Department', 'Main Category']),
        sub_category1: getVal(['Category', 'Sub Category 1']),
        sub_category2: getVal(['Sub Category 1', 'Sub Category 2']),
        sub_category3: getVal(['Sub Category 2', 'Sub Category 3']),
        notes: getVal(['Notes', 'Description', 'Remarks', 'Narration']),
      });
    }

    if (transactions.length === 0) {
      throw new Error(`Could not find any valid transaction rows in ${file.name}. Please ensure the template includes an 'Amount' column.`);
    }

    return transactions;
  }
}
