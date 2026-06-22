import fs from 'fs';

const productFile = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let content = fs.readFileSync(productFile, 'utf8');

const newRepairBlock = `  const fetchBarcodes = async () => {
    setLoading(true);
    try {
      if ((inventoryService as any).repairDuplicateBarcodes) {
        (inventoryService as any).repairDuplicateBarcodes('inventory_batches');
        (inventoryService as any).repairDuplicateBarcodes('finished_product_barcodes');
        (inventoryService as any).repairDuplicateBarcodes('combo_barcodes');
        
        if ((inventoryService as any).repairBarcodeValues) {
           (inventoryService as any).repairBarcodeValues('inventory_batches');
           (inventoryService as any).repairBarcodeValues('finished_product_barcodes');
           (inventoryService as any).repairBarcodeValues('combo_barcodes');
        }
      }`;

content = content.replace(/  const fetchBarcodes = async \(\) => \{\s*setLoading\(true\);\s*try \{/g, newRepairBlock);
fs.writeFileSync(productFile, content);
console.log('ProductBarcodeList.tsx updated successfully');
