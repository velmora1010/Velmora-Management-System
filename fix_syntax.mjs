import fs from 'fs';

// 1. Fix ViewBarcodeList.tsx RAW_MATERIAL map
const viewFile = 'src/modules/inventory/view-barcode/ViewBarcodeList.tsx';
let viewContent = fs.readFileSync(viewFile, 'utf8');

viewContent = viewContent.replace(
  /const stage = b\.currentStage \|\| 'READY_FOR_FIRST_SCAN';\s*const badgeInfo = getRawBadge\(stage, rawMaterialSubTab\);\s*return \(\s*<div key=\{b\.id\}/g,
  `const stage = b.currentStage || 'READY_FOR_FIRST_SCAN';
              const badgeInfo = getRawBadge(stage, rawMaterialSubTab);
              const displayBarcode = b.barcodeNumber || b.barcode || b.code || b.batchNo || b.serial_number || b.barcode_no || b.id;
              
              return (
              <div key={b.id}`
);

viewContent = viewContent.replace(
  /const displayBarcode = b\.barcodeNumber \|\| b\.barcode \|\| b\.code \|\| b\.batchNo \|\| b\.serial_number \|\| b\.barcode_no \|\| b\.id;\s*<div id=\{\`view-barcode-\$\{displayBarcode\}\`\}>/g,
  `<div id={\`view-barcode-\${displayBarcode}\`}>`
);

viewContent = viewContent.replace(
  /\{b\.barcodeNumber \|\| b\.barcode \|\| b\.code \|\| b\.batchNo \|\| b\.serial_number \|\| b\.barcode_no \|\| b\.id\}/g,
  `{displayBarcode}`
);

fs.writeFileSync(viewFile, viewContent);

// 2. Fix ViewBarcodeList.tsx COMBO map
// Wait, did I break COMBO map? Let's check if the replacement hit COMBO map.
// The regex `const displayBarcode = b.barcodeNumber...` only hit RAW_MATERIAL.

// 3. Fix ProductBarcodeList.tsx
const productFile = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let productContent = fs.readFileSync(productFile, 'utf8');

productContent = productContent.replace(
  /\{filteredBarcodes\.map\(item => \{\s*return \(\s*<motion\.div/g,
  `{filteredBarcodes.map(item => {
          const displayBarcode = item.barcodeNumber || item.barcode || item.code || item.batchNo || item.serial_number || item.barcode_no || item.id;
          return (
            <motion.div`
);

productContent = productContent.replace(
  /\{\(\(\) => \{ const displayBarcode = item\.barcodeNumber \|\| item\.barcode \|\| item\.code \|\| item\.batchNo \|\| item\.serial_number \|\| item\.barcode_no \|\| item\.id; return <Barcode value=\{displayBarcode\} width=\{1\.8\} height=\{60\} fontSize=\{14\} margin=\{0\} displayValue=\{false\} \/>; \}\)\(\)\}/g,
  `<Barcode value={displayBarcode} width={1.8} height={60} fontSize={14} margin={0} displayValue={false} />`
);

productContent = productContent.replace(
  /\{item\.barcodeNumber \|\| item\.barcode \|\| item\.code \|\| item\.batchNo \|\| item\.serial_number \|\| item\.barcode_no \|\| item\.id\}/g,
  `{displayBarcode}`
);

fs.writeFileSync(productFile, productContent);

console.log('Fixed syntax errors');
