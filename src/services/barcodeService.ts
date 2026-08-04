import html2canvas from 'html2canvas';
import JsBarcode from 'jsbarcode';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import toast from 'react-hot-toast';

export type BarcodeModuleType = 'PRODUCT' | 'RAW_MATERIAL' | 'PRODUCTION_READY' | 'COMBO' | 'PACKAGING' | 'QC' | 'INVENTORY';

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

    // Production-Ready Batch: PRP-SLES-1B-260804-001 -> PB...
    if (str.startsWith('PRP-')) {
      const parts = str.split('-');
      if (parts.length >= 5) {
        const mat = parts[1];
        const prod = parts[2];
        const seq = parts[4];
        return `PB${mat}${prod}${seq}`.toUpperCase().slice(0, 10);
      }
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

    // Packaging: PKG-BTL-260801-001 -> BTL001
    const pkgMatch = str.match(/PKG-([A-Z0-9]+)-(?:\d{6})-(\d+)/i);
    if (pkgMatch) {
      const typeCode = pkgMatch[1];
      const seq = pkgMatch[2];
      return `${typeCode}${seq.padStart(3, '0')}`.toUpperCase();
    }

    // Raw Material: SLES-1000-4066 -> RM4066 or MAT-260804-SLES-001
    const rmMatch = str.match(/([A-Z0-9]+)-\d+-(\d+)/i) || str.match(/([A-Z0-9]+)-(\d{3,5})$/i);
    if (rmMatch) {
      const lastPart = rmMatch[2] || rmMatch[1];
      return `RM${lastPart.slice(-4)}`.toUpperCase();
    }

    // Fallback: strip hyphens/spaces and slice first 8 chars
    const cleaned = str.replace(/[^A-Z0-9]/g, '');
    if (cleaned.startsWith('PROD')) return cleaned.replace(/^PROD/, '').slice(0, 8);
    if (cleaned.startsWith('PRP')) return cleaned.replace(/^PRP/, 'PB').slice(0, 8);
    if (cleaned.startsWith('RM')) return cleaned.slice(0, 8);
    if (cleaned.startsWith('CB')) return cleaned.slice(0, 8);
    if (cleaned.startsWith('QC')) return cleaned.slice(0, 8);
    return cleaned.slice(0, 8);
  }

  /**
   * Generate compact scanCode
   */
  generateScanCode(moduleType: BarcodeModuleType, payload?: any): string {
    if (payload?.scan_code || payload?.scanCode) {
      return String(payload.scan_code || payload.scanCode).trim().toUpperCase();
    }
    const ref = payload?.barcode || payload?.qc_barcode || payload?.combo_box_barcode || payload?.id || '';
    return this.deriveScanCode(String(ref), moduleType);
  }

  /**
   * Generate barcode object
   */
  generateBarcode(moduleType: BarcodeModuleType, payload: any): { barcode: string; scan_code: string } {
    const barcode = payload?.barcode || payload?.barcode_no || payload?.qc_barcode || payload?.combo_box_barcode || 'INV-001';
    const scan_code = this.generateScanCode(moduleType, payload);
    return { barcode, scan_code };
  }

  /**
   * Extract clean scanCode from any record
   */
  extractScanCode(record: any): string {
    if (!record) return 'BARCODE';
    if (typeof record === 'string') return this.deriveScanCode(record);

    const val = record.scan_code || record.scanCode || record.scan_number;
    if (val && String(val).trim()) {
      return String(val).trim().toUpperCase();
    }

    const fallback = record.barcode || record.serial_number || record.barcode_no || record.qc_barcode || record.qcBarcode || record.combo_box_barcode || record.serialNumber || record.id || '';
    return this.deriveScanCode(String(fallback));
  }

  /**
   * Generate clean formatted filename (e.g. Blue-Detergent-SLES-PB934471.png)
   */
  generateCleanFileName(record: any, moduleType?: BarcodeModuleType): string {
    if (!record) return 'Barcode.png';

    const parts: string[] = [];
    const prodName = record.product_name || record.productName;
    const matName = record.material_name || record.materialName;
    const pkgName = record.packaging_name || record.packagingName;
    const comboName = record.combo_name || record.comboName || record.combo_code;

    if (prodName) {
      const cleanProd = String(prodName).trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
      if (cleanProd) parts.push(cleanProd);
    }

    if (matName && matName !== prodName) {
      const cleanMat = String(matName).trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
      if (cleanMat && !parts.includes(cleanMat)) parts.push(cleanMat);
    }

    if (pkgName && !parts.length) {
      const cleanPkg = String(pkgName).trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
      if (cleanPkg) parts.push(cleanPkg);
    }

    if (comboName && !parts.length) {
      const cleanCombo = String(comboName).trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
      if (cleanCombo) parts.push(cleanCombo);
    }

    const scanCode = this.extractScanCode(record);
    const cleanScan = scanCode.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanScan && !parts.includes(cleanScan)) {
      parts.push(cleanScan);
    }

    const baseName = parts.length > 0 ? parts.join('-') : 'Barcode';
    return `${baseName}.png`;
  }

  /**
   * Render pure 34mm x 20mm barcode-only label canvas (1360px x 800px at 4x resolution)
   * Contains ONLY Code 128 barcode + short scan code below.
   */
  async renderCleanBarcodeOnlyCanvas(scanCode: string): Promise<HTMLCanvasElement> {
    const width = 1360;
    const height = 800;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    // 1. Pure White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Generate Code 128 SVG string via JsBarcode
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svgEl, scanCode, {
      format: 'CODE128',
      width: 4,
      height: 340,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000'
    });

    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // 3. Load SVG onto image & draw onto canvas centered
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Draw barcode image in top 65% area with padding (left/right quiet zones)
        const targetWidth = Math.min(width - 160, img.width * 2.2);
        const targetHeight = 440;
        const targetX = (width - targetWidth) / 2;
        const targetY = 80;

        ctx.drawImage(img, targetX, targetY, targetWidth, targetHeight);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });

    // 4. Draw bold human-readable scanCode text centered below
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 68px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(scanCode, width / 2, 690);

    return canvas;
  }

  /**
   * Single Barcode-Only Label Download (Image 3 Format)
   */
  async downloadBarcodeOnlyLabel(record: any, moduleType?: BarcodeModuleType): Promise<void> {
    try {
      const scanCode = this.extractScanCode(record);
      const fileName = this.generateCleanFileName(record, moduleType);

      const canvas = await this.renderCleanBarcodeOnlyCanvas(scanCode);
      const dataUrl = canvas.toDataURL('image/png', 1.0);

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();

      toast.success(`Downloaded ${fileName}`);
    } catch (err: any) {
      console.error('Failed to download barcode label:', err);
      toast.error(`Download failed: ${err.message || 'Unknown error'}`);
    }
  }

  /**
   * Download All Barcode-Only Labels as ZIP (Image 3 Format for every file)
   */
  async downloadMultipleBarcodeOnlyLabels(records: any[], zipName = 'barcodes.zip', moduleType?: BarcodeModuleType): Promise<void> {
    if (!records || records.length === 0) {
      toast.error('No barcode records to download.');
      return;
    }

    const toastId = toast.loading(`Generating ${records.length} barcode labels...`);

    try {
      const zip = new JSZip();
      const folder = zip.folder('Barcodes') || zip;

      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const scanCode = this.extractScanCode(rec);
        const fileName = this.generateCleanFileName(rec, moduleType);

        const canvas = await this.renderCleanBarcodeOnlyCanvas(scanCode);
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const base64Data = dataUrl.split(',')[1];

        // Ensure unique filename inside zip
        let finalName = fileName;
        if (folder.file(finalName)) {
          finalName = `${fileName.replace('.png', '')}_${i + 1}.png`;
        }

        folder.file(finalName, base64Data, { base64: true });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
      link.click();

      toast.success(`Successfully downloaded ${records.length} labels ZIP!`, { id: toastId });
    } catch (err: any) {
      console.error('Failed to generate barcode ZIP:', err);
      toast.error(`ZIP creation failed: ${err.message || 'Unknown error'}`, { id: toastId });
    }
  }

  /**
   * Print 34mm × 20mm physical label sticker (Barcode-Only Output)
   */
  printBarcodeOnlyLabel(record: any): void {
    const scanCode = this.extractScanCode(record);

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups to print barcode labels.');
      return;
    }

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svgEl, scanCode, {
      format: 'CODE128',
      width: 2,
      height: 60,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000'
    });
    const svgMarkup = svgEl.outerHTML;

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
                padding: 1.5mm !important;
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
            .print-btn {
              background: #2563eb;
              color: #ffffff;
              border: none;
              padding: 8px 20px;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
              margin-bottom: 16px;
            }
            .label {
              width: 34mm;
              height: 20mm;
              padding: 1.5mm;
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
              width: 30mm;
              height: 12mm;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto;
            }
            .barcode-container svg {
              width: 90% !important;
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
              margin-top: 1mm;
              line-height: 1;
            }
          </style>
        </head>
        <body>
          <button class="no-print print-btn" onclick="window.print()">Print Label (34mm × 20mm)</button>
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
   * Print Multiple 34mm × 20mm Labels
   */
  printMultipleBarcodeOnlyLabels(records: any[]): void {
    if (!records || records.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups to print barcode labels.');
      return;
    }

    const labelHtmls = records.map(r => {
      const scanCode = this.extractScanCode(r);
      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svgEl, scanCode, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000'
      });
      return `
        <div class="label">
          <div class="barcode-container">
            ${svgEl.outerHTML}
          </div>
          <div class="scan-code-text">${scanCode}</div>
        </div>
      `;
    }).join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print ${records.length} Labels</title>
          <style>
            @page {
              size: 34mm 20mm;
              margin: 0;
            }
            @media print {
              html, body {
                width: 34mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
              }
              .no-print { display: none !important; }
              .label {
                width: 34mm !important;
                height: 20mm !important;
                margin: 0 auto !important;
                padding: 1.5mm !important;
                box-sizing: border-box !important;
                page-break-after: always !important;
                break-after: always !important;
              }
            }
            body { font-family: Arial, sans-serif; background: #ffffff; padding: 16px; text-align: center; }
            .print-btn { background: #2563eb; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-bottom: 16px; }
            .label { width: 34mm; height: 20mm; padding: 1.5mm; background: #ffffff; border: 1px dashed #cbd5e1; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 8px auto; }
            .barcode-container { width: 30mm; height: 12mm; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
            .barcode-container svg { width: 90% !important; height: 100% !important; shape-rendering: crispEdges !important; }
            .scan-code-text { font-family: 'Courier New', monospace; font-size: 8pt; font-weight: bold; color: #000; margin-top: 1mm; }
          </style>
        </head>
        <body>
          <button class="no-print print-btn" onclick="window.print()">Print All ${records.length} Labels</button>
          ${labelHtmls}
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  /**
   * Compatibility methods
   */
  async downloadPNG(element: HTMLElement, filename: string): Promise<void> {
    return this.downloadBarcodeOnlyLabel({ barcode: filename }, 'INVENTORY');
  }

  downloadSVG(svgElement: SVGSVGElement, filename: string): void {
    return this.downloadSVGDirect(svgElement, filename);
  }

  private downloadSVGDirect(svgElement: SVGSVGElement, filename: string): void {
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
    }
  }

  printLabel(options: BarcodePrintOptions): void {
    return this.printBarcodeOnlyLabel({ scan_code: options.scanCode || options.barcode, barcode: options.barcode });
  }

  validateBarcode(code: string): boolean {
    if (!code) return false;
    const clean = String(code).trim();
    return clean.length >= 4 && clean.length <= 40;
  }

  async findBarcode(scannedInput: string, targetModule?: BarcodeModuleType): Promise<{ found: boolean; record: any; moduleType?: BarcodeModuleType }> {
    if (!scannedInput) return { found: false, record: null };
    const cleanInput = String(scannedInput).trim().toUpperCase();

    const tableMap: Array<{ module: BarcodeModuleType; table: string }> = [
      { module: 'PRODUCT', table: SUPABASE_TABLES.productBarcodes },
      { module: 'RAW_MATERIAL', table: SUPABASE_TABLES.rawMaterialBarcodes },
      { module: 'COMBO', table: SUPABASE_TABLES.comboBoxes },
      { module: 'QC', table: SUPABASE_TABLES.qcBarcodes }
    ];

    const searchTables = targetModule 
      ? tableMap.filter(t => t.module === targetModule) 
      : tableMap;

    for (const { module, table } of searchTables) {
      try {
        const { data } = await supabase.from(table).select('*').eq('scan_code', cleanInput).limit(1);
        if (data && data.length > 0) {
          return { found: true, record: data[0], moduleType: module };
        }
      } catch (err) {}
    }

    for (const { module, table } of searchTables) {
      try {
        const barcodeCol = table === SUPABASE_TABLES.comboBoxes ? 'combo_box_barcode' : table === SUPABASE_TABLES.qcBarcodes ? 'qc_barcode' : 'barcode';
        const { data } = await supabase.from(table).select('*').eq(barcodeCol, cleanInput).limit(1);
        if (data && data.length > 0) {
          return { found: true, record: data[0], moduleType: module };
        }
      } catch (err) {}
    }

    return { found: false, record: null };
  }
}

export const barcodeService = new BarcodeService();
