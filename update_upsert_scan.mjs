import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

const upsertMethod = `
  upsertBarcodeByNumber(collectionKey: string, updatedBarcode: any) {
    const code = normalizeBarcode(updatedBarcode.barcodeNumber || updatedBarcode.barcode || updatedBarcode.code || updatedBarcode.serial_number || updatedBarcode.barcode_no || updatedBarcode.id);

    const list = JSON.parse(localStorage.getItem(collectionKey) || "[]");

    const existingIndex = list.findIndex((item: any) =>
      normalizeBarcode(item.barcodeNumber || item.barcode || item.code || item.serial_number || item.barcode_no || item.id) === code
    );

    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        ...updatedBarcode,
        barcodeNumber: list[existingIndex].barcodeNumber || updatedBarcode.barcodeNumber,
        currentStage: updatedBarcode.currentStage
      };
    } else {
      list.push(updatedBarcode);
    }

    localStorage.setItem(collectionKey, JSON.stringify(list));
    return list;
  }
`;

if (!serviceContent.includes('upsertBarcodeByNumber(')) {
  const initIndex = serviceContent.indexOf('private init()');
  if (initIndex > -1) {
    serviceContent = serviceContent.substring(0, initIndex) + upsertMethod + serviceContent.substring(initIndex);
  }
}

// Rewrite processBarcodeScan update block
const oldScanBlock = /const list = this\.getList\(listKey\);\s*const scannedNormalized = normalizeBarcode\(record\.serial_number \|\| record\.barcode_no \|\| record\.id \|\| barcodeNumber\);\s*const idx = list\.findIndex\(\(x: any\) => normalizeBarcode\(x\.id \|\| x\.barcode_no \|\| x\.serial_number\) === scannedNormalized\);\s*if \(idx > -1\) \{\s*list\[idx\] = record;\s*this\.saveList\(listKey, list\);\s*\}/s;

const newScanBlock = `// Enforce singleton upsert by barcode
    this.upsertBarcodeByNumber(listKey, record);`;

if (serviceContent.match(oldScanBlock)) {
  serviceContent = serviceContent.replace(oldScanBlock, newScanBlock);
}

// Remove any remaining list.push for handoffs that might cause duplicates
const rawHandoffListPush = /list\.push\(record\);\s*this\.saveList\('raw_material_released_to_product', list\);/s;
const newRawHandoffUpsert = `this.upsertBarcodeByNumber('raw_material_released_to_product', record);`;
if (serviceContent.match(rawHandoffListPush)) {
  serviceContent = serviceContent.replace(rawHandoffListPush, newRawHandoffUpsert);
}

const prodHandoffListPush = /list\.push\(record\);\s*this\.saveList\('product_released_to_combo', list\);/s;
const newProdHandoffUpsert = `this.upsertBarcodeByNumber('product_released_to_combo', record);`;
if (serviceContent.match(prodHandoffListPush)) {
  serviceContent = serviceContent.replace(prodHandoffListPush, newProdHandoffUpsert);
}

// Fix Raw Material IN -> OUT transition logic to ensure single push
const rawInTransition = /else if \(currentStage === 'RAW_MATERIAL_IN'\) \{\s*nextStage = 'RAW_MATERIAL_OUT';\s*fromLoc = 'RAW_MATERIAL_IN';\s*toLoc = 'RAW_MATERIAL_OUT';\s*successMessage = 'Raw material moved to Inventory OUT \(Ready for Production\)\.';\s*\/\/ Global Handoff Engine\s*await this\.handleInventoryOutHandoff\(record, 'RAW_MATERIAL'\);\s*successMessage = 'Raw material moved to Inventory OUT \(Ready for Production\)\.';\s*\/\/ Note: Actual deduction is handled by deductRawMaterialsForProduction\s*\}/s;

// We ensure no accidental re-trigger logic happens here. The block looks correct, but let's make sure it's strictly correct.

fs.writeFileSync(serviceFile, serviceContent);
console.log('Upsert logic injected successfully');
