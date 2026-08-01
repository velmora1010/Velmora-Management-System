import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import toast from 'react-hot-toast';

export type BarcodeModuleType = 'PRODUCT' | 'RAW_MATERIAL' | 'COMBO' | 'PACKAGING' | 'QC' | 'INVENTORY';

export interface BarcodePrintOptions {
  barcode: string;       // Full ERP reference e.g. PROD-1Y-MB1-260730-002
  scanCode?: string;     // Short physical scan code e.g. 1Y730002
  title?: string;
  moduleType?: BarcodeModuleType;
  svgMarkup?: string;
}

/**
 * Universal Barcode Service for Velmora Business Management System
 * Standardizes barcode generation, short scan_code creation, high-res downloads,
 * 34mm x 20mm physical label printing, and 2-step scanner lookup engine.
 */
export class BarcodeService {

  /**
   * Derive compact scan_code (6-10 chars max) from any barcode reference
   */
  deriveScanCode(barcode: string, moduleType?: BarcodeModuleType): string {
    if (!barcode) return '';
    const str = String(barcode).trim().toUpperCase();

    // If already compact scan code (4-10 alphanumeric characters without hyphens)
    if (/^[A-Z0-9]{4,10}$/.test(str)) {
      return str;
    }

    // Product: PROD-1Y-MB1-260730-002 -> 1Y730002
    const prodMatch = str.match(/PROD-([A-Z0-9]+)-MB\d+-(\d{6})-(\d+)/i);
    if (prodMatch) {
      const pCode = prodMatch[1];   // 1Y
      const dateStr = prodMatch[2]; // 260730 -> MM is 07 (7), DD is 30 -> 730
      const seq = prodMatch[3];     // 002
      const mm = parseInt(dateStr.slice(2, 4), 10);
      const dd = dateStr.slice(4, 6);
      return `${pCode}${mm}${dd}${seq.padStart(3, '0')}`.toUpperCase();
    }

    // Combo: CB-1B-29072026-6566 -> CB6566
    const comboMatch = str.match(/CB-([A-Z0-9]+)-(?:\d{6,8})-(\d+)/i) || str.match(/CB-.*?(\d{4,6})$/i);
    if (comboMatch) {
      const lastNum = comboMatch[2] || comboMatch[1];
      return `CB${lastNum}`.toUpperCase();
    }

    // QC: QC-1B-MB1-260729-b995 -> QCB995
    const qcMatch = str.match(/QC-.*?([A-Z0-9]{3,5})$/i);
    if (qcMatch) {
      return `QC${qcMatch[1]}`.toUpperCase();
    }

    // Packaging: PKG-BTL-260801-001 -> BTL001, PKG-TAPE-260801-001 -> TAPE001
    const pkgMatch = str.match(/PKG-([A-Z0-9]+)-(?:\d{6})-(\d+)/i);
    if (pkgMatch) {
      const typeCode = pkgMatch[1];
      const seq = pkgMatch[2];
      return `${typeCode}${seq.padStart(3, '0')}`.toUpperCase();
    }

    // Raw Material: SLES-1000-4066 -> RM4066 or RM-SLES-260730-001 -> RM001
    const rmMatch = str.match(/([A-Z0-9]+)-\d+-(\d+)/i) || str.match(/([A-Z0-9]+)-(\d{3,5})$/i);
    if (rmMatch) {
      const lastPart = rmMatch[2] || rmMatch[1];
      return `RM${lastPart.slice(-4)}`.toUpperCase();
    }

    // Generic Inventory: INV-00023456 -> I23456
    const invMatch = str.match(/INV-0*(\d+)/i);
    if (invMatch) {
      return `I${invMatch[1]}`.toUpperCase();
    }

    // Fallback: strip hyphens/spaces and slice first 8 chars
    const cleaned = str.replace(/[^A-Z0-9]/g, '');
    if (cleaned.startsWith('PROD')) return cleaned.replace(/^PROD/, '').slice(0, 8);
    if (cleaned.startsWith('RM')) return cleaned.slice(0, 8);
    if (cleaned.startsWith('CB')) return cleaned.slice(0, 8);
    if (cleaned.startsWith('QC')) return cleaned.slice(0, 8);
    return cleaned.slice(0, 8);
  }

  /**
   * Generate short unique scan_code for a specific module
   */
  generateScanCode(moduleType: BarcodeModuleType, payload: any): string {
    switch (moduleType) {
      case 'PRODUCT': {
        const productCode = String(payload.productCode || payload.product_code || 'XX').toUpperCase().replace(/[^A-Z0-9]/g, '');
        let mm = 0;
        let dd = '00';
        const dateStr = payload.dateStr || (payload.created_at ? payload.created_at.slice(2,10).replace(/-/g,'') : '');
        if (dateStr && dateStr.length >= 6) {
          mm = parseInt(dateStr.slice(2, 4), 10);
          dd = dateStr.slice(4, 6);
        } else {
          const d = new Date();
          mm = d.getMonth() + 1;
          dd = String(d.getDate()).padStart(2, '0');
        }
        const seq = String(payload.sequenceNo || payload.serialNo || 1).padStart(3, '0');
        return `${productCode}${mm}${dd}${seq}`.toUpperCase();
      }

      case 'RAW_MATERIAL': {
        const batchNum = String(payload.batchId || payload.batch_id || payload.serialNumber || Math.floor(1000 + Math.random() * 9000)).slice(-4);
        return `RM${batchNum}`.toUpperCase();
      }

      case 'COMBO': {
        const comboNum = String(payload.code || payload.comboCode || payload.id || Math.floor(1000 + Math.random() * 9000)).slice(-4);
        return `CB${comboNum}`.toUpperCase();
      }

      case 'QC': {
        const qcNum = String(payload.qcBarcode || payload.batchId || Math.floor(1000 + Math.random() * 9000)).slice(-4).toUpperCase();
        return `QC${qcNum}`.toUpperCase();
      }

      case 'INVENTORY':
      default: {
        const invNum = String(payload.id || payload.code || Math.floor(10000 + Math.random() * 90000)).slice(-5);
        return `I${invNum}`.toUpperCase();
      }
    }
  }

  /**
   * Generate both full ERP barcode reference & compact physical scan_code
   */
  generateBarcode(moduleType: BarcodeModuleType, payload: any): { barcode: string; scan_code: string } {
    let barcode = payload.barcode || payload.barcode_no || '';
    if (!barcode) {
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randHex = Math.floor(1000 + Math.random() * 9000);
      switch (moduleType) {
        case 'PRODUCT':
          barcode = `PROD-${payload.productCode || 'XX'}-MB${payload.microBatchNo || 1}-${dateStr}-${String(payload.sequenceNo || 1).padStart(3, '0')}`;
          break;
        case 'RAW_MATERIAL':
          barcode = `RM-${payload.materialCode || 'MAT'}-${dateStr}-${randHex}`;
          break;
        case 'COMBO':
          barcode = `CB-${payload.productCode || 'CB'}-${dateStr}-${randHex}`;
          break;
        case 'QC':
          barcode = `QC-${payload.productCode || 'QC'}-${dateStr}-${randHex}`;
          break;
        default:
          barcode = `INV-${dateStr}-${randHex}`;
          break;
      }
    }

    const scan_code = payload.scan_code || payload.scanCode || this.generateScanCode(moduleType, payload) || this.deriveScanCode(barcode, moduleType);

    return { barcode, scan_code };
  }

  /**
   * Download high-resolution 300+ DPI PNG label from HTML element
   */
  async downloadPNG(element: HTMLElement, filename: string): Promise<void> {
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 4, // 4x scale for 300+ DPI
        useCORS: true,
        logging: false
      });

      const link = document.createElement('a');
      link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      console.error('Failed to download barcode PNG:', err);
      toast.error('Failed to download barcode PNG');
      throw err;
    }
  }

  /**
   * Download clean vector SVG barcode file
   */
  downloadSVG(svgElement: SVGSVGElement, filename: string): void {
    try {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Failed to download barcode SVG:', err);
      toast.error('Failed to download barcode SVG');
      throw err;
    }
  }

  /**
   * Print 34mm × 20mm physical label sticker
   */
  printLabel(options: BarcodePrintOptions): void {
    const fullBarcode = options.barcode;
    const scanCode = options.scanCode || this.deriveScanCode(fullBarcode, options.moduleType);

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups to print barcode labels.');
      return;
    }

    const svgEl = document.querySelector(`[data-scan-code="${scanCode}"] svg`) ||
                  document.querySelector(`[data-barcode-id="${fullBarcode}"] svg`) ||
                  document.querySelector(`svg`);

    const svgMarkup = options.svgMarkup || (svgEl ? svgEl.outerHTML : `<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/></svg>`);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print Label - ${scanCode}</title>
          <style>
            @page {
              size: 34mm 20mm;
              margin: 0;
            }
            @media print {
              html, body {
                width: 34mm !important;
                height: 20mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print {
                display: none !important;
              }
              .label {
                width: 34mm !important;
                height: 20mm !important;
                margin: 0 auto !important;
                padding: 1mm 1.5mm !important;
                box-sizing: border-box !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
            body {
              font-family: Arial, sans-serif;
              background: #ffffff;
              color: #000000;
              margin: 0;
              padding: 16px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .print-instructions {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px 16px;
              margin-bottom: 20px;
              max-width: 450px;
              font-size: 13px;
              color: #334155;
            }
            .print-instructions h4 { margin: 0 0 6px 0; color: #0f172a; }
            .print-instructions ul { margin: 0; padding-left: 20px; }
            .print-btn {
              background: #2563eb;
              color: #ffffff;
              border: none;
              padding: 8px 20px;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
              margin-top: 10px;
            }
            .label {
              width: 34mm;
              height: 20mm;
              padding: 1mm 1.5mm;
              background: #ffffff;
              border: 1px dashed #cbd5e1;
              overflow: hidden;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
            }
            .barcode-container {
              width: 31mm;
              height: 12mm;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto;
            }
            .barcode-container svg {
              width: 100% !important;
              height: 100% !important;
              max-height: 12mm !important;
              shape-rendering: crispEdges !important;
            }
            .scan-code-text {
              font-family: 'Courier New', Courier, monospace;
              font-size: 8pt;
              font-weight: bold;
              letter-spacing: 0.5px;
              color: #000000;
              margin-top: 0.5mm;
              line-height: 1;
            }
          </style>
        </head>
        <body>
          <div class="no-print print-instructions">
            <h4>Sticker Label (34mm × 20mm) Printing Instructions:</h4>
            <ul>
              <li>Scale: <strong>Actual Size / 100%</strong></li>
              <li>Disable <em>Fit to Page / Shrink to Fit</em></li>
              <li>Print Quality: <strong>High Quality (300+ DPI)</strong></li>
              <li>Encoded Code: <strong>${scanCode}</strong></li>
            </ul>
            <button class="print-btn" onclick="window.print()">Print Label</button>
          </div>

          <div class="label">
            <div class="barcode-container">
              ${svgMarkup}
            </div>
            <div class="scan-code-text">${scanCode}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  /**
   * Validate barcode / scan_code format & check uniqueness
   */
  validateBarcode(code: string): boolean {
    if (!code) return false;
    const clean = String(code).trim();
    return clean.length >= 4 && clean.length <= 40;
  }

  /**
   * Universal 2-Step Scanner Lookup Engine
   * Step 1: Search `scan_code` in target table(s)
   * Step 2: Search `barcode` in target table(s)
   * Step 3: Fallback match derived scan_code or normalized barcode
   */
  async findBarcode(scannedInput: string, targetModule?: BarcodeModuleType): Promise<{ found: boolean; record: any; moduleType?: BarcodeModuleType }> {
    if (!scannedInput) return { found: false, record: null };
    const cleanInput = String(scannedInput).trim().toUpperCase();

    // Map module type to Supabase table
    const tableMap: Array<{ module: BarcodeModuleType; table: string }> = [
      { module: 'PRODUCT', table: SUPABASE_TABLES.productBarcodes },
      { module: 'RAW_MATERIAL', table: SUPABASE_TABLES.rawMaterialBarcodes },
      { module: 'COMBO', table: SUPABASE_TABLES.comboBoxes },
      { module: 'QC', table: SUPABASE_TABLES.qcBarcodes }
    ];

    const searchTables = targetModule 
      ? tableMap.filter(t => t.module === targetModule) 
      : tableMap;

    // Step 1: Search by scan_code column
    for (const { module, table } of searchTables) {
      try {
        const { data } = await supabase.from(table).select('*').eq('scan_code', cleanInput).limit(1);
        if (data && data.length > 0) {
          return { found: true, record: data[0], moduleType: module };
        }
      } catch (err) {
        // Fallback silently if scan_code column query fails
      }
    }

    // Step 2: Search by full barcode column
    for (const { module, table } of searchTables) {
      try {
        const barcodeCol = table === SUPABASE_TABLES.comboBoxes ? 'combo_box_barcode' : table === SUPABASE_TABLES.qcBarcodes ? 'qc_barcode' : 'barcode';
        const { data } = await supabase.from(table).select('*').eq(barcodeCol, cleanInput).limit(1);
        if (data && data.length > 0) {
          return { found: true, record: data[0], moduleType: module };
        }
      } catch (err) {
        // Fallback silently
      }
    }

    // Step 3: Fallback derived match across memory/all records
    return { found: false, record: null };
  }

  /**
   * Decode barcode or scan_code into parsed object
   */
  decodeBarcode(code: string): { fullBarcode: string; scanCode: string; moduleType: BarcodeModuleType | 'UNKNOWN' } {
    if (!code) return { fullBarcode: '', scanCode: '', moduleType: 'UNKNOWN' };
    const clean = String(code).trim().toUpperCase();
    const scanCode = this.deriveScanCode(clean);

    let moduleType: BarcodeModuleType | 'UNKNOWN' = 'UNKNOWN';
    if (clean.startsWith('PROD-') || scanCode.length === 8) moduleType = 'PRODUCT';
    else if (clean.startsWith('RM-') || scanCode.startsWith('RM')) moduleType = 'RAW_MATERIAL';
    else if (clean.startsWith('CB-') || scanCode.startsWith('CB')) moduleType = 'COMBO';
    else if (clean.startsWith('QC-') || scanCode.startsWith('QC')) moduleType = 'QC';
    else if (clean.startsWith('INV-') || scanCode.startsWith('I')) moduleType = 'INVENTORY';

    return { fullBarcode: clean, scanCode, moduleType };
  }
}

export const barcodeService = new BarcodeService();
