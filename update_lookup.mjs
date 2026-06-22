import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

const oldLookupRegex = /if \(department === 'RAW_MATERIAL'\) \{\s*const batches = this\.getList\('inventory_batches'\);\s*record = batches\.find\(b => b\.serial_number === barcodeNumber \|\| b\.barcode_no === barcodeNumber\);\s*listKey = 'inventory_batches';\s*\} else if \(department === 'PRODUCT'\) \{\s*const fgList = this\.getList\('finished_goods'\);\s*record = fgList\.find\(b => b\.barcode_no === barcodeNumber\);\s*listKey = 'finished_goods';\s*\} else if \(department === 'COMBO'\) \{\s*const comboBarcodes = this\.getList\('combo_barcodes'\);\s*record = comboBarcodes\.find\(b => b\.barcode_no === barcodeNumber \|\| b\.batch_id === barcodeNumber\);\s*listKey = 'combo_barcodes';\s*\}/s;

const newLookupBlock = `const getBarcodeValue = (item: any) =>
      normalizeBarcode(
        item.barcodeNumber ||
        item.barcode ||
        item.code ||
        item.barcodeValue ||
        item.batchNo ||
        item.serial_number ||
        item.barcode_no ||
        item.id
      );

    const scannedCode = normalizeBarcode(barcodeNumber);

    if (department === 'RAW_MATERIAL') {
      const batches = this.getList('inventory_batches');
      record = batches.find((item: any) => getBarcodeValue(item) === scannedCode);
      listKey = 'inventory_batches';
      
      console.log("SCANNED:", scannedCode);
      console.log("RAW MATERIAL BARCODES:", batches.map((item: any) => ({
        name: item.material_name || item.materialName || item.name,
        barcodeNumber: item.barcodeNumber,
        barcode: item.barcode,
        code: item.code,
        batchNo: item.batchNo || item.batch_id,
        serial_number: item.serial_number,
        id: item.id,
        currentStage: item.currentStage
      })));
      
    } else if (department === 'PRODUCT') {
      const fgList = this.getList('finished_goods');
      record = fgList.find((item: any) => getBarcodeValue(item) === scannedCode);
      listKey = 'finished_goods';
    } else if (department === 'COMBO') {
      const comboBarcodes = this.getList('combo_barcodes');
      record = comboBarcodes.find((item: any) => getBarcodeValue(item) === scannedCode);
      listKey = 'combo_barcodes';
    }`;

if (serviceContent.match(oldLookupRegex)) {
  serviceContent = serviceContent.replace(oldLookupRegex, newLookupBlock);
  fs.writeFileSync(serviceFile, serviceContent);
  console.log('Lookup updated successfully');
} else {
  console.log('Regex did not match');
}
