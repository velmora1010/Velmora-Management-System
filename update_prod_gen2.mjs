import fs from 'fs';

const prodFile = 'src/modules/inventory/production/ProductionBatchDetail.tsx';
let content = fs.readFileSync(prodFile, 'utf8');

const finalBarcodesRegex = /const finalBarcodes = generatedBarcodes\.map\(\(b: any\) => \(\{\s*\.\.\.b,\s*productId: productionBatch\.product_id,\s*productName: productionBatch\.product_name,\s*microBatchId: mb\.id,\s*microBatchNo: mb\.micro_batch_no,\s*barcodeNumber: b\.no,\s*barcode_no: b\.no, \/\/ Keeping for backward compatibility temporarily\s*quantity: 1,\s*unit: 'Unit',\s*status: 'NOT_SCANNED', \/\/ For UI compatibility during refactor\s*scan_status: 'NOT_SCANNED', \s*comboReady: false,\s*createdAt: new Date\(\)\.toISOString\(\),\s*created_at: new Date\(\)\.toISOString\(\),\s*scannedAt: null,\s*addedToComboAt: null\s*\}\)\);/;

const newFinalBarcodes = `const finalBarcodes = generatedBarcodes.map((b: any) => ({
      ...b,
      productId: productionBatch.product_id,
      productName: productionBatch.product_name,
      microBatchId: mb.id,
      microBatchNo: mb.micro_batch_no,
      barcodeNumber: b.no,
      barcode_no: b.no, 
      displayBarcode: b.no,
      barcode: b.no,
      code: b.no,
      currentStage: 'READY_FOR_FIRST_SCAN',
      quantity: 1,
      unit: 'Unit',
      status: 'NOT_SCANNED', 
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
  console.log("Could not find exact finalBarcodes block");
}
