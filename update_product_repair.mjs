import fs from 'fs';

const productFile = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let content = fs.readFileSync(productFile, 'utf8');

const fetchBlock = `  const fetchBarcodes = async () => {
    setIsLoading(true);
    try {
      const bcs = await inventoryService.getFinishedGoodsBarcodes();
      setBarcodes(bcs || []);
      const drafts = await inventoryService.getComboDrafts();
      setComboDrafts(drafts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };`;

const newFetchBlock = `  const fetchBarcodes = async () => {
    setIsLoading(true);
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
      }

      const bcs = await inventoryService.getFinishedGoodsBarcodes();
      setBarcodes(bcs || []);
      const drafts = await inventoryService.getComboDrafts();
      setComboDrafts(drafts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };`;

if (content.includes(fetchBlock)) {
  content = content.replace(fetchBlock, newFetchBlock);
  fs.writeFileSync(productFile, content);
  console.log('Added repair to ProductBarcodeList.tsx');
} else {
  console.log('Could not find fetchBlock in ProductBarcodeList.tsx');
}
