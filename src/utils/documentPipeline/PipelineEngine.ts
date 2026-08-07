import { DocumentSource, DocumentType, FileType, NormalizedTransaction, PdfTextItem } from './types';
import { DocumentClassifier } from './DocumentClassifier';
import { ExcelExpenseParser } from './parsers/ExcelExpenseParser';
import { BankStatementPdfParser } from './parsers/BankStatementPdfParser';
import { IciciBankStatementPdfParser } from './parsers/IciciBankStatementPdfParser';
import { IciciBankStatementExcelParser } from './parsers/IciciBankStatementExcelParser';
import * as xlsx from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure pdfjs worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export class PipelineEngine {
  static async process(file: File): Promise<{
    transactions: NormalizedTransaction[];
    documentType: DocumentType;
  }> {
    try {
      console.log(`[PipelineEngine] Starting process for file: ${file.name}`);
      const source = await this.extractContent(file);
      
      console.log(`[PipelineEngine] Sending to DocumentClassifier...`);
      const documentType = DocumentClassifier.classify(source);
      console.log(`[PipelineEngine] DocumentClassifier returned: ${documentType}`);

      if (documentType === DocumentType.UNKNOWN) {
        throw new Error(`The file ${file.name} could not be classified. Please ensure it is a supported Bank Statement or Excel Template.`);
      }

      let parser: any;
      switch (documentType) {
        case DocumentType.EXCEL_TEMPLATE:
          console.log(`[PipelineEngine] Selecting ExcelExpenseParser...`);
          parser = new ExcelExpenseParser();
          break;
        case DocumentType.BANK_STATEMENT:
          console.log(`[PipelineEngine] Selecting generic BankStatementPdfParser...`);
          parser = new BankStatementPdfParser();
          break;
        case DocumentType.ICICI_BANK_STATEMENT:
          console.log(`[PipelineEngine] Selecting specialized IciciBankStatementPdfParser...`);
          parser = new IciciBankStatementPdfParser();
          break;
        case DocumentType.ICICI_BANK_STATEMENT_EXCEL:
          console.log(`[PipelineEngine] Selecting specialized IciciBankStatementExcelParser...`);
          parser = new IciciBankStatementExcelParser();
          break;
        default:
          throw new Error(`No parser implemented for document type: ${documentType}`);
      }

      console.log(`[PipelineEngine] Executing parser...`);
      const transactions = await parser.parse(source.rawContent, file);
      console.log(`[PipelineEngine] Parser completed. Returned ${transactions.length} normalized transactions.`);

      return { transactions, documentType };
    } catch (error: any) {
      console.error(`[PipelineEngine] Pipeline processing error:`, error);
      throw error;
    }
  }

  private static async extractContent(file: File): Promise<DocumentSource> {
    console.log(`[PipelineEngine] 4. Processing file in Pipeline Engine...`);
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'xlsx' || extension === 'xls') {
      const data = await file.arrayBuffer();
      const workbook = xlsx.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawContent = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      return { file, fileType: FileType.EXCEL, rawContent };
    }

    if (extension === 'pdf') {
      console.log(`[PipelineEngine] 5. PDF detected, loading pdfjs...`);
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log(`[PipelineEngine] PDF loaded with ${pdf.numPages} pages.`);
      
      let allItems: PdfTextItem[] = [];
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        for (const item of textContent.items) {
          if ('str' in item && 'transform' in item) {
            allItems.push({
              text: item.str,
              x: item.transform[4],
              y: item.transform[5],
              width: item.width,
              height: item.height
            });
            fullText += item.str + ' ';
          }
        }
      }
      console.log(`[PipelineEngine] 6. Extracted ${allItems.length} text items.`);

      // We attach the fullText as a special property just so DocumentClassifier can read it easily
      (allItems as any)._fullText = fullText;

      return { file, fileType: FileType.PDF, rawContent: allItems };
    }

    throw new Error(`Unsupported file type: ${extension}`);
  }
}
