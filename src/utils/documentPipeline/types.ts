import { FinanceExpense } from '../../../hooks/finance/useExpenses';

export enum DocumentType {
  BANK_STATEMENT = 'BANK_STATEMENT',
  ICICI_BANK_STATEMENT = 'ICICI_BANK_STATEMENT',
  EXCEL_TEMPLATE = 'EXCEL_TEMPLATE',
  PURCHASE_BILL = 'PURCHASE_BILL',
  SUPPLIER_INVOICE = 'SUPPLIER_INVOICE',
  UNKNOWN = 'UNKNOWN'
}

export enum FileType {
  EXCEL = 'excel',
  PDF = 'pdf'
}

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  height: number;
  width: number;
}

export interface DocumentSource {
  file: File;
  fileType: FileType;
  rawContent: any; // e.g., PdfTextItem[] (for PDF) or any[][] (for Excel)
}

export interface NormalizedTransaction extends Partial<FinanceExpense> {
  sequence: number;
  transactionDate?: string;
  postedDateTime?: string;
  amount: number;
  date?: string; // Formatted date
  notes?: string; 
}

export interface DocumentParser {
  parse(rawContent: any, file: File): Promise<NormalizedTransaction[]>;
}
