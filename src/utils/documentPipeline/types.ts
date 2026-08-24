import { FinanceExpense } from '../../hooks/finance/useExpenses';

export enum DocumentType {
  BANK_STATEMENT = 'BANK_STATEMENT',
  ICICI_BANK_STATEMENT = 'ICICI_BANK_STATEMENT',
  ICICI_BANK_STATEMENT_EXCEL = 'ICICI_BANK_STATEMENT_EXCEL',
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
  main_category?: string | null;
  sub_category1?: string | null;
  sub_category2?: string | null;
  sub_category3?: string | null;
  vendor?: string | null;
  payment_mode?: string | null;
  gst_status?: string | null;
  purchased_by?: string | null;
  approved_by?: string | null;
  source?: string | null; // Credit specific
}

export interface DocumentParser {
  parse(rawContent: any, file: File): Promise<NormalizedTransaction[]>;
}
