import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

// 1. Add dedupe helpers to localInventoryService
const helpers = `
export const normalizeBarcode = (value: any) => String(value || "").trim().toUpperCase().replace(/\\s+/g, "");

export const getStagePriority = (stage: string) => {
  const priority: any = {
    READY_FOR_FIRST_SCAN: 0,
    RAW_MATERIAL_IN: 1,
    RAW_MATERIAL_OUT: 2,
    PRODUCT_IN: 1,
    PRODUCT_OUT: 2,
    PACKED_IN_COMBO: 3,
    COMBO_IN: 1,
    COMBO_OUT: 2
  };
  return priority[stage || "READY_FOR_FIRST_SCAN"] || 0;
};

export const dedupeBarcodes = (items: any[]) => {
  const map = new Map();

  items.forEach((item) => {
    const key = normalizeBarcode(item.barcodeNumber || item.barcode_no || item.serial_number || item.barcode || item.code || item.id);
    if (!key) return;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      return;
    }

    if (getStagePriority(item.currentStage) >= getStagePriority(existing.currentStage)) {
      map.set(key, {
        ...existing,
        ...item,
        currentStage: item.currentStage
      });
    }
  });

  return Array.from(map.values());
};

`;

if (!serviceContent.includes('export const dedupeBarcodes')) {
  const insertIndex = serviceContent.indexOf('export const normalizeMaterialKey');
  if (insertIndex > -1) {
    serviceContent = serviceContent.substring(0, insertIndex) + helpers + serviceContent.substring(insertIndex);
  }
}

// 2. Add repairDuplicateBarcodes inside the class
const repairMethod = `
  repairDuplicateBarcodes(collectionKey: string) {
    const items = JSON.parse(localStorage.getItem(collectionKey) || "[]");
    const cleaned = dedupeBarcodes(items);
    localStorage.setItem(collectionKey, JSON.stringify(cleaned));
    return cleaned;
  }
`;

if (!serviceContent.includes('repairDuplicateBarcodes(')) {
  const initIndex = serviceContent.indexOf('private init()');
  if (initIndex > -1) {
    serviceContent = serviceContent.substring(0, initIndex) + repairMethod + serviceContent.substring(initIndex);
  }
}

// 3. Update processBarcodeScan findIndex
const oldFindIndex = /const idx = list\.findIndex\(\(x: any\) => x\.id === record\.id \|\| x\.barcode_no === record\.barcode_no \|\| x\.serial_number === record\.serial_number\);/g;
const newFindIndex = `const scannedNormalized = normalizeBarcode(record.serial_number || record.barcode_no || record.id || barcodeNumber);
    const idx = list.findIndex((x: any) => normalizeBarcode(x.id || x.barcode_no || x.serial_number) === scannedNormalized);`;

if (serviceContent.match(oldFindIndex)) {
  serviceContent = serviceContent.replace(oldFindIndex, newFindIndex);
}

// 4. Update the RAW_MATERIAL_OUT error message
const oldRawOutError = /throw new Error\('Raw material already moved to Inventory OUT\.'\);/g;
const newRawOutError = `throw new Error('This raw material is already released to Product department.');`;

if (serviceContent.match(oldRawOutError)) {
  serviceContent = serviceContent.replace(oldRawOutError, newRawOutError);
}

fs.writeFileSync(serviceFile, serviceContent);
console.log('localInventoryService updated with dedupe logic');
