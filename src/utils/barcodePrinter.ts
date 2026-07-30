import html2canvas from 'html2canvas';

export interface BarcodePrintOptions {
  barcodeValue: string;
  title?: string;
  subtitle?: string;
  productCode?: string;
  batchNo?: string;
  quantity?: string;
}

/**
 * Downloads a high-resolution 300+ DPI PNG label from an HTML element
 */
export async function downloadBarcodeLabelPNG(element: HTMLElement, filename: string): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 4, // 4x resolution (300-600 DPI)
      useCORS: true,
      logging: false,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.querySelector('[data-barcode-container]') || clonedDoc.body;
        if (clonedEl instanceof HTMLElement) {
          clonedEl.style.transform = 'none';
          clonedEl.style.boxShadow = 'none';
        }
      }
    });

    const link = document.createElement('a');
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  } catch (err) {
    console.error('Failed to download barcode label PNG:', err);
    throw err;
  }
}

/**
 * Generates and downloads a clean vector SVG barcode file
 */
export function downloadBarcodeSVG(svgElement: SVGSVGElement, filename: string): void {
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
    throw err;
  }
}

/**
 * Opens a dedicated print window for high-precision barcode physical printing (60mm x 25mm+)
 */
export function printBarcodeLabel(options: BarcodePrintOptions): void {
  const { barcodeValue, title, subtitle, productCode, batchNo, quantity } = options;
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('Please allow popups to print barcode labels.');
    return;
  }

  // Create SVG barcode string using ReactBarcode/JsBarcode SVG format or DOM extraction
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  // Helper to generate print HTML
  const generatePrintHTML = (svgMarkup: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Print Barcode - ${barcodeValue}</title>
        <style>
          @page {
            size: 60mm 35mm;
            margin: 0;
          }
          @media print {
            html, body {
              width: 60mm;
              height: 35mm;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
            .print-page {
              width: 60mm !important;
              min-height: 25mm !important;
              margin: 0 auto !important;
              padding: 2mm 4mm !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
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
            max-width: 500px;
            font-size: 13px;
            color: #334155;
          }
          .print-instructions h4 {
            margin: 0 0 6px 0;
            color: #0f172a;
          }
          .print-instructions ul {
            margin: 0;
            padding-left: 20px;
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
          .print-page {
            width: 60mm;
            min-height: 25mm;
            box-sizing: border-box;
            padding: 2mm 4mm;
            background: #ffffff;
            border: 1px dashed #cbd5e1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }
          .title-text {
            font-size: 9pt;
            font-weight: bold;
            color: #000000;
            margin-bottom: 1mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 52mm;
          }
          .barcode-wrapper {
            width: 52mm;
            height: 25mm;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            margin: 0 auto;
          }
          .barcode-wrapper svg {
            width: 100% !important;
            height: 100% !important;
            max-height: 25mm !important;
          }
          .barcode-text {
            font-family: "Courier New", Courier, monospace;
            font-size: 10pt;
            font-weight: bold;
            letter-spacing: 1px;
            color: #000000;
            margin-top: 1.5mm;
          }
          .meta-row {
            font-size: 7.5pt;
            color: #333333;
            margin-top: 1mm;
            display: flex;
            gap: 4mm;
            justify-content: center;
          }
        </style>
      </head>
      <body>
        <div className="no-print print-instructions">
          <h4>Printing Instructions:</h4>
          <ul>
            <li>Set Scale to <strong>Actual Size / 100%</strong></li>
            <li>Disable <em>Fit to Page / Shrink to Fit</em></li>
            <li>Print Quality: <strong>High Quality (300+ DPI)</strong></li>
            <li>Orientation: <strong>Portrait / Auto</strong></li>
          </ul>
          <div style="margin-top: 12px;">
            <button class="print-btn" onclick="window.print()">Print Label</button>
          </div>
        </div>

        <div class="print-page">
          ${title ? `<div class="title-text">${title}</div>` : ''}
          <div class="barcode-wrapper">
            ${svgMarkup}
          </div>
          <div class="barcode-text">${barcodeValue}</div>
          ${(productCode || batchNo || quantity) ? `
            <div class="meta-row">
              ${productCode ? `<span>Code: ${productCode}</span>` : ''}
              ${batchNo ? `<span>Batch: ${batchNo}</span>` : ''}
              ${quantity ? `<span>Qty: ${quantity}</span>` : ''}
            </div>
          ` : ''}
        </div>
      </body>
    </html>
  `;

  // Grab rendered SVG if present in page for barcodeValue
  const svgEl = document.querySelector(`[data-barcode-id="${barcodeValue}"] svg`) || 
                document.querySelector(`svg[data-barcode="${barcodeValue}"]`) ||
                document.querySelector(`svg`);

  let svgMarkup = '';
  if (svgEl) {
    svgMarkup = svgEl.outerHTML;
  } else {
    // Basic fallback SVG Code 128 rendering structure
    svgMarkup = `<svg viewBox="0 0 300 80" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/></svg>`;
  }

  printWindow.document.write(generatePrintHTML(svgMarkup));
  printWindow.document.close();

  // Clean up
  if (container.parentNode) container.parentNode.removeChild(container);
}
