import fs from 'fs';

const prodFile = 'src/modules/inventory/production/ProductionBatchDetail.tsx';
let content = fs.readFileSync(prodFile, 'utf8');

const finalBarcodesRegex = /const finalBarcodes = generatedBarcodes\.map\(\(b: any\) => \(\{[\s\S]*?status: 'NOT_SCANNED', \/\/ For UI compatibility during refactor[\s\S]*?\}\)\);/s;

const newFinalBarcodes = `const finalBarcodes = generatedBarcodes.map((b: any) => ({
      ...b,
      displayBarcode: b.barcodeNumber,
      barcode: b.barcodeNumber,
      code: b.barcodeNumber,
      productId: productionBatch.product_id,
      productName: productionBatch.product_name,
      microBatchId: mb.id,
      microBatchNo: mb.batch_number,
      quantity: 1,
      currentStage: 'READY_FOR_FIRST_SCAN',
      status: 'NOT_SCANNED', // For UI compatibility during refactor
      scan_status: 'NOT_SCANNED', 
      comboReady: false,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
      scannedAt: null,
      addedToComboAt: null
    }));`;

if (content.match(finalBarcodesRegex)) {
  content = content.replace(finalBarcodesRegex, newFinalBarcodes);
  fs.writeFileSync(prodFile, content);
  console.log("Fixed ProductionBatchDetail.tsx generation fields");
} else {
  console.log("Could not find finalBarcodes block in ProductionBatchDetail.tsx");
}
