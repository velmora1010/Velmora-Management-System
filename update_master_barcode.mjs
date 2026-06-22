import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

// 1. Add getMasterBarcode helper
const masterHelper = `
export const getMasterBarcode = (item: any) => {
  return (
    item.displayBarcode ||
    item.barcodeNumber ||
    item.barcode ||
    item.code ||
    item.serial_number ||
    item.barcode_no ||
    item.barcodeValue ||
    item.batchNo ||
    item.id ||
    ""
  ).toString().trim().toUpperCase().replace(/\\s+/g, "");
};
`;

if (!serviceContent.includes('export const getMasterBarcode')) {
  const insertIndex = serviceContent.indexOf('export const normalizeBarcode');
  if (insertIndex > -1) {
    serviceContent = serviceContent.substring(0, insertIndex) + masterHelper + serviceContent.substring(insertIndex);
  }
}

// 2. Update processBarcodeScan lookup
const oldLookupRegex = /const getBarcodeValue = \(item: any\) =>[\s\S]*?const scannedCode = normalizeBarcode\(barcodeNumber\);\s*if \(department === 'RAW_MATERIAL'\) \{\s*const batches = this\.getList\('inventory_batches'\);\s*record = batches\.find\(\(item: any\) => getBarcodeValue\(item\) === scannedCode\);\s*listKey = 'inventory_batches';[\s\S]*?\} else if \(department === 'PRODUCT'\) \{\s*const fgList = this\.getList\('finished_goods'\);\s*record = fgList\.find\(\(item: any\) => getBarcodeValue\(item\) === scannedCode\);\s*listKey = 'finished_goods';\s*\} else if \(department === 'COMBO'\) \{\s*const comboBarcodes = this\.getList\('combo_barcodes'\);\s*record = comboBarcodes\.find\(\(item: any\) => getBarcodeValue\(item\) === scannedCode\);\s*listKey = 'combo_barcodes';\s*\}/;

const newLookupBlock = `const scannedCode = normalizeBarcode(barcodeNumber);

    if (department === 'RAW_MATERIAL') {
      const batches = this.getList('inventory_batches');
      record = batches.find((item: any) => getMasterBarcode(item) === scannedCode);
      // Emergency fallback
      if (!record) {
        record = batches.find((item: any) => [item.displayBarcode, item.barcodeNumber, item.barcode, item.code, item.serial_number, item.barcode_no, item.batchNo, item.id].map(x => normalizeBarcode(x)).includes(scannedCode));
      }
      listKey = 'inventory_batches';
      
      console.log("SCANNED:", scannedCode);
      console.log("RAW MATERIAL BARCODES:", batches.map((item: any) => ({
        name: item.material_name || item.materialName || item.name,
        masterBarcode: getMasterBarcode(item),
        barcodeNumber: item.barcodeNumber,
        barcode: item.barcode,
        code: item.code,
        serial_number: item.serial_number,
        barcode_no: item.barcode_no,
        batchNo: item.batchNo || item.batch_id,
        id: item.id,
        currentStage: item.currentStage
      })));
      
    } else if (department === 'PRODUCT') {
      const fgList = this.getList('finished_goods');
      record = fgList.find((item: any) => getMasterBarcode(item) === scannedCode);
      if (!record) {
        record = fgList.find((item: any) => [item.displayBarcode, item.barcodeNumber, item.barcode, item.code, item.serial_number, item.barcode_no, item.batchNo, item.id].map(x => normalizeBarcode(x)).includes(scannedCode));
      }
      listKey = 'finished_goods';
    } else if (department === 'COMBO') {
      const comboBarcodes = this.getList('combo_barcodes');
      record = comboBarcodes.find((item: any) => getMasterBarcode(item) === scannedCode);
      if (!record) {
        record = comboBarcodes.find((item: any) => [item.displayBarcode, item.barcodeNumber, item.barcode, item.code, item.serial_number, item.barcode_no, item.batchNo, item.id].map(x => normalizeBarcode(x)).includes(scannedCode));
      }
      listKey = 'combo_barcodes';
    }`;

if (serviceContent.match(oldLookupRegex)) {
  serviceContent = serviceContent.replace(oldLookupRegex, newLookupBlock);
}

// 3. Update repairBarcodeValues
const oldRepairBlock = /repairBarcodeValues\(collectionKey: string\) \{[\s\S]*?\}\n    \}\n  \}/;

const newRepairBlock = `repairBarcodeValues(collectionKey: string) {
    const list = JSON.parse(localStorage.getItem(collectionKey) || "[]");
    let changed = false;
    
    list.forEach((item: any) => {
      const master = getMasterBarcode(item);
      if (master && (
        item.displayBarcode !== master || 
        item.barcodeNumber !== master || 
        item.barcode !== master || 
        item.code !== master || 
        item.serial_number !== master || 
        item.barcode_no !== master
      )) {
        item.displayBarcode = master;
        item.barcodeNumber = master;
        item.barcode = master;
        item.code = master;
        item.serial_number = master;
        item.barcode_no = master;
        changed = true;
      }
    });
    
    if (changed) {
      localStorage.setItem(collectionKey, JSON.stringify(list));
    }
  }`;

if (serviceContent.match(oldRepairBlock)) {
  serviceContent = serviceContent.replace(oldRepairBlock, newRepairBlock);
}

fs.writeFileSync(serviceFile, serviceContent);

// 4. Update ViewBarcodeList.tsx rendering
const viewFile = 'src/modules/inventory/view-barcode/ViewBarcodeList.tsx';
let viewContent = fs.readFileSync(viewFile, 'utf8');

// Replace raw material master computation
viewContent = viewContent.replace(
  /const displayBarcode = b\.barcodeNumber \|\| b\.barcode \|\| b\.code \|\| b\.batchNo \|\| b\.serial_number \|\| b\.barcode_no \|\| b\.id;/g,
  `const displayBarcode = (b.displayBarcode || b.barcodeNumber || b.barcode || b.code || b.serial_number || b.barcode_no || b.batchNo || b.id || "").toString().trim().toUpperCase().replace(/\\s+/g, "");`
);

// We need to make sure the combo map block also gets a master barcode computation if there is one.
// The user explicitly instructed: "Do NOT let Barcode component use any old field. Do NOT let scanner search any old field. Only use displayBarcode/masterBarcode everywhere."
// Let's replace ANY `<Barcode value={boxBc.barcode_no}` in the combo block to use displayBarcode.
const comboBarcodeSearch1 = /<Barcode value=\{boxBc\.barcode_no\} width=\{1\.8\} height=\{60\} displayValue=\{false\} margin=\{0\} \/>/g;
viewContent = viewContent.replace(comboBarcodeSearch1, `{(() => { const master = (boxBc.displayBarcode || boxBc.barcodeNumber || boxBc.barcode || boxBc.code || boxBc.serial_number || boxBc.barcode_no || boxBc.batchNo || boxBc.id || "").toString().trim().toUpperCase().replace(/\\s+/g, ""); return <Barcode value={master} width={1.8} height={60} displayValue={false} margin={0} />; })()}`);

const comboBarcodeSearch2 = /<div style=\{\{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '16px' \}\}>\{boxBc\.barcode_no\}<\/div>/g;
viewContent = viewContent.replace(comboBarcodeSearch2, `<div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '16px' }}>{(boxBc.displayBarcode || boxBc.barcodeNumber || boxBc.barcode || boxBc.code || boxBc.serial_number || boxBc.barcode_no || boxBc.batchNo || boxBc.id || "").toString().trim().toUpperCase().replace(/\\s+/g, "")}</div>`);

fs.writeFileSync(viewFile, viewContent);

// 5. Update ProductBarcodeList.tsx rendering
const productFile = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let productContent = fs.readFileSync(productFile, 'utf8');

productContent = productContent.replace(
  /const displayBarcode = item\.barcodeNumber \|\| item\.barcode \|\| item\.code \|\| item\.batchNo \|\| item\.serial_number \|\| item\.barcode_no \|\| item\.id;/g,
  `const displayBarcode = (item.displayBarcode || item.barcodeNumber || item.barcode || item.code || item.serial_number || item.barcode_no || item.batchNo || item.id || "").toString().trim().toUpperCase().replace(/\\s+/g, "");`
);

fs.writeFileSync(productFile, productContent);

console.log('Master Barcode system completely injected.');
