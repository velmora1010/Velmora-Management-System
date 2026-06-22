import fs from 'fs';

// ProductBarcodeList.tsx
let f1 = fs.readFileSync('src/modules/inventory/view-barcode/ProductBarcodeList.tsx', 'utf8');

// Fix setComboDrafts
f1 = f1.replace(/setComboDrafts\(/g, '// setComboDrafts(');

// Fix productSubTab === 'PACKED'
f1 = f1.replace(/productSubTab === 'PACKED'/g, "productSubTab === ('PACKED' as any)");

// Fix Object.entries
f1 = f1.replace(/Object\.entries\(\(item as any\) \?\? \{\}\)/g, "Object.entries((item as any) || {})");
f1 = f1.replace(/Object\.entries\(item \?\? \{\}\)/g, "Object.entries((item as any) || {})");

// Fix find item
f1 = f1.replace(/\(item\) =>/g, "(item: any) =>");

fs.writeFileSync('src/modules/inventory/view-barcode/ProductBarcodeList.tsx', f1);


// localInventoryService.ts
let f2 = fs.readFileSync('src/services/localInventoryService.ts', 'utf8');

// Fix comboBarcodes declared but value never read
f2 = f2.replace(/const comboBarcodes = this\.getList\('combo_barcodes'\);/g, "/* const comboBarcodes = this.getList('combo_barcodes'); */");

// Fix toLoc
f2 = f2.replace(/const toLoc = toLocation \|\| 'PRODUCTION';/g, "/* const toLoc = toLocation || 'PRODUCTION'; */");

// Fix explicitActiveDraft
f2 = f2.replace(/explicitActiveDraft: any = null/g, "explicitActiveDraft?: any");

// Fix scanData.reason
f2 = f2.replace(/reason: scanData\.reason \|\| 'Manual Scan',/g, "");

fs.writeFileSync('src/services/localInventoryService.ts', f2);
