import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(serviceFile, 'utf8');

const scanRegex = /\} else if \(department === 'PRODUCT'\) \{\s*const fgList = this\.getList\('finished_goods'\);\s*record = fgList\.find\(\(item: any\) => getMasterBarcode\(item\) === scannedCode\);\s*if \(!record\) \{\s*record = fgList\.find\(\(item: any\) => \[item\.displayBarcode, item\.barcodeNumber, item\.barcode, item\.code, item\.serial_number, item\.barcode_no, item\.batchNo, item\.id\]\.map\(x => normalizeBarcode\(x\)\)\.includes\(scannedCode\)\);\s*\}\s*listKey = 'finished_goods';\s*\}/s;

const newScanBlock = `} else if (department === 'PRODUCT') {
      const allProducts = [
        ...this.getList('finished_product_barcodes'),
        ...this.getList('finished_goods'),
        ...this.getList('product_barcodes'),
        ...this.getList('production_micro_batches')
      ];

      record = allProducts.find((item: any) => getMasterBarcode(item) === scannedCode);
      if (!record) {
        record = allProducts.find((item: any) => [item.displayBarcode, item.barcodeNumber, item.barcode, item.code, item.serial_number, item.barcode_no, item.batchNo, item.id].map(x => normalizeBarcode(x)).includes(scannedCode));
      }
      listKey = 'finished_product_barcodes';
    }`;

if (content.match(scanRegex)) {
  content = content.replace(scanRegex, newScanBlock);
  fs.writeFileSync(serviceFile, content);
  console.log("Fixed processBarcodeScan to search all product sources");
} else {
  console.log("Could not find processBarcodeScan PRODUCT block");
}
