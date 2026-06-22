import fs from 'fs';

const prodFile = 'src/modules/inventory/production/ProductionBatchDetail.tsx';
let content = fs.readFileSync(prodFile, 'utf8');

const regex = /const finalBarcodes = generatedBarcodes\.map\(\(b: any\) => \(\{[\s\S]*?addedToComboAt: null\s*\}\)\);/s;

const newBlock = `const finalBarcodes = pendingBarcodesList.map((b: any) => ({
      id: crypto.randomUUID(),
      type: 'PRODUCT',
      productId: productionBatch.id,
      productName: productionBatch.product_name,
      productCode: productCode,
      microBatchNo: mb.micro_batch_no,
      barcodeNumber: b.no,
      barcode_no: b.no, // Keeping for backward compatibility temporarily
      displayBarcode: b.no,
      barcode: b.no,
      code: b.no,
      currentStage: 'READY_FOR_FIRST_SCAN',
      quantity: 1,
      unit: 'Unit',
      status: 'NOT_SCANNED', // For UI compatibility during refactor
      scan_status: 'NOT_SCANNED', 
      comboReady: false,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
      scannedAt: null,
      addedToComboAt: null
    }));`;

if (content.match(regex)) {
  content = content.replace(regex, newBlock);
  fs.writeFileSync(prodFile, content);
  console.log("Restored finalBarcodes block");
} else {
  console.log("Regex not found");
}
