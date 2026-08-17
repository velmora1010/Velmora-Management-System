import { DocumentSource, DocumentType, FileType, NormalizedTransaction, PdfTextItem } from './types';
import { DocumentClassifier } from './DocumentClassifier';
import { IciciCreditPdfParser } from './parsers/IciciCreditPdfParser';
import { CreditRuleEngine } from '../rules/CreditRuleEngine';
import * as xlsx from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure pdfjs worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export class CreditPipelineEngine {
  static async process(file: File): Promise<{
    transactions: NormalizedTransaction[];
    documentType: DocumentType;
  }> {
    try {
      console.log(`[CreditPipelineEngine] Starting process for file: ${file.name}`);
      const source = await this.extractContent(file);
      
      console.log(`[CreditPipelineEngine] Sending to DocumentClassifier...`);
      const documentType = DocumentClassifier.classify(source);
      console.log(`[CreditPipelineEngine] DocumentClassifier returned: ${documentType}`);

      if (documentType === DocumentType.UNKNOWN) {
        throw new Error(`The file ${file.name} could not be classified. Please ensure it is a supported Bank Statement or Excel Template.`);
      }

      let parser: any;
      switch (documentType) {
        case DocumentType.ICICI_BANK_STATEMENT:
          console.log(`[CreditPipelineEngine] Selecting specialized IciciCreditPdfParser...`);
          parser = new IciciCreditPdfParser();
          break;
        default:
          throw new Error(`No credit parser implemented for document type: ${documentType}. Currently, only ICICI statements are supported for credit extraction.`);
      }

      console.log(`[CreditPipelineEngine] Executing parser...`);
      let transactions = await parser.parse(source.rawContent, file);
      console.log(`[CreditPipelineEngine] Parser completed. Returned ${transactions.length} normalized transactions.`);

      console.log(`[CreditPipelineEngine] Executing Credit Rules...`);
      const activeRules = await CreditRuleEngine.fetchActiveRules();
      transactions = transactions.map((t: NormalizedTransaction) => CreditRuleEngine.applyCreditRules(t, activeRules));
      console.log(`[CreditPipelineEngine] Rules applied.`);

      return { transactions, documentType };
    } catch (error: any) {
      console.error(`[CreditPipelineEngine] Pipeline processing error:`, error);
      throw error;
    }
  }

  private static async extractContent(file: File): Promise<DocumentSource> {
    console.log(`[CreditPipelineEngine] 4. Processing file in Pipeline Engine...`);
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
      console.log(`[CreditPipelineEngine] 5. PDF detected, loading pdfjs...`);
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log(`[CreditPipelineEngine] PDF loaded with ${pdf.numPages} pages.`);
      
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
      console.log(`[CreditPipelineEngine] 6. Extracted ${allItems.length} text items.`);

      // We attach the fullText as a special property just so DocumentClassifier can read it easily
      (allItems as any)._fullText = fullText;

      return { file, fileType: FileType.PDF, rawContent: allItems };
    }

    throw new Error(`Unsupported file type: ${extension}`);
  }
}
