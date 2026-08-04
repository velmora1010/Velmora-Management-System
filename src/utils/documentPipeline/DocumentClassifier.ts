import { DocumentType, FileType, DocumentSource } from './types';

export class DocumentClassifier {
  static classify(source: DocumentSource): DocumentType {
    if (source.fileType === FileType.EXCEL) {
      // For now, any Excel uploaded through this module is assumed to be an Excel template
      return DocumentType.EXCEL_TEMPLATE;
    }

    if (source.fileType === FileType.PDF) {
      let text = '';
      if (typeof source.rawContent === 'string') {
        text = source.rawContent.toLowerCase();
      } else if (Array.isArray(source.rawContent) && (source.rawContent as any)._fullText) {
        text = (source.rawContent as any)._fullText.toLowerCase();
      }
      
      // Detect ICICI Statement
      if (text.includes('icici bank') && text.includes('detailed statement')) {
        return DocumentType.ICICI_BANK_STATEMENT;
      }

      // Simple heuristic for Bank Statements
      if (
        text.includes('statement of account') ||
        text.includes('bank statement') ||
        text.includes('account statement') ||
        text.includes('transaction history') ||
        text.includes('withdrawal') ||
        text.includes('deposit') ||
        text.includes('balance')
      ) {
        return DocumentType.BANK_STATEMENT;
      }
      
      // Simple heuristic for Invoices/Bills
      if (
        text.includes('tax invoice') ||
        text.includes('purchase bill') ||
        text.includes('invoice no') ||
        text.includes('bill to')
      ) {
        return DocumentType.PURCHASE_BILL; // Or SUPPLIER_INVOICE
      }
      
      // Could not reliably classify
      return DocumentType.UNKNOWN;
    }

    return DocumentType.UNKNOWN;
  }
}
