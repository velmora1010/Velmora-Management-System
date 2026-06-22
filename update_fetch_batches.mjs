import fs from 'fs';

const file = 'src/modules/inventory/view-barcode/ViewBarcodeList.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFetchBatches = `  const fetchBatches = async () => {
    setLoading(true);
    try {
      const [data, history, combos] = await Promise.all([
        inventoryService.getBarcodes(),
        inventoryService.getScanHistory(),
        inventoryService.getAllComboBarcodes()
      ]);
      setBatches(data || []);
      setScanHistory(history || []);
      setComboBatches(combos || []);
    } catch (err) {
      console.error('Failed to load barcodes locally', err);
    } finally {
      setLoading(false);
    }
  };`;

const newFetchBatches = `  const fetchBatches = async () => {
    setLoading(true);
    try {
      // 1. First repair all duplicates persistently
      if ((inventoryService as any).repairDuplicateBarcodes) {
        (inventoryService as any).repairDuplicateBarcodes('inventory_batches');
        (inventoryService as any).repairDuplicateBarcodes('finished_product_barcodes');
        (inventoryService as any).repairDuplicateBarcodes('combo_barcodes');
      }

      // 2. Fetch the newly deduplicated lists
      const [data, history, combos] = await Promise.all([
        inventoryService.getBarcodes(),
        inventoryService.getScanHistory(),
        inventoryService.getAllComboBarcodes()
      ]);
      setBatches(data || []);
      setScanHistory(history || []);
      setComboBatches(combos || []);
    } catch (err) {
      console.error('Failed to load barcodes locally', err);
    } finally {
      setLoading(false);
    }
  };`;

if (content.includes('const fetchBatches = async () => {')) {
  // It's safer to use regex or string replacement if we know the exact string
  // Let's just do a manual replacement
  content = content.replace(/const fetchBatches = async \(\) => \{[\s\S]*?setLoading\(false\);\n    \}\n  \};/g, newFetchBatches);
  fs.writeFileSync(file, content);
  console.log('fetchBatches updated to include repairDuplicateBarcodes');
} else {
  console.log('fetchBatches not found exactly as expected.');
}
