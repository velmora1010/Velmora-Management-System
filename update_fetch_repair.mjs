import fs from 'fs';

const viewBarcodeFile = 'src/modules/inventory/view-barcode/ViewBarcodeList.tsx';
let content = fs.readFileSync(viewBarcodeFile, 'utf8');

const repairBlock = `if ((inventoryService as any).repairDuplicateBarcodes) {
        (inventoryService as any).repairDuplicateBarcodes('inventory_batches');
        (inventoryService as any).repairDuplicateBarcodes('finished_product_barcodes');
        (inventoryService as any).repairDuplicateBarcodes('combo_barcodes');
      }`;

const newRepairBlock = `if ((inventoryService as any).repairDuplicateBarcodes) {
        (inventoryService as any).repairDuplicateBarcodes('inventory_batches');
        (inventoryService as any).repairDuplicateBarcodes('finished_product_barcodes');
        (inventoryService as any).repairDuplicateBarcodes('combo_barcodes');
        
        if ((inventoryService as any).repairBarcodeValues) {
           (inventoryService as any).repairBarcodeValues('inventory_batches');
           (inventoryService as any).repairBarcodeValues('finished_product_barcodes');
           (inventoryService as any).repairBarcodeValues('combo_barcodes');
        }
      }`;

if (content.includes(repairBlock)) {
  content = content.replace(repairBlock, newRepairBlock);
  fs.writeFileSync(viewBarcodeFile, content);
  console.log('Added repairBarcodeValues to fetchBatches in ViewBarcodeList');
} else {
  // Let's just do a regex replace if spacing is off
  content = content.replace(/if \(\(inventoryService as any\)\.repairDuplicateBarcodes\) \{[\s\S]*?\}\n/g, newRepairBlock + '\n');
  fs.writeFileSync(viewBarcodeFile, content);
  console.log('Added via fallback replace');
}
