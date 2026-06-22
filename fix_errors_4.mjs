import fs from 'fs';

let content;

// 1. CreateCombo.tsx
content = fs.readFileSync('src/modules/inventory/combos/CreateCombo.tsx', 'utf8');
content = content.replace(/const \[activeStock, boxes\] = await Promise\.all/g, 'const [, boxes] = await Promise.all');
content = content.replace(/const activeStock = await inventoryService\.getComboStockBalance\(\);\n/g, '');
fs.writeFileSync('src/modules/inventory/combos/CreateCombo.tsx', content);

// 2. ProductBarcodeList.tsx
content = fs.readFileSync('src/modules/inventory/view-barcode/ProductBarcodeList.tsx', 'utf8');
content = content.replace(/const drafts = localInventoryService\.getActiveComboDrafts\(\);\n/g, '/* const drafts = localInventoryService.getActiveComboDrafts(); */\n');
content = content.replace(/Object\.entries\(\(item as any\) \|\| \{\}\)/g, 'Object.entries((item as any) || {})');
content = content.replace(/\(\(item as any\) \|\| \{\}\)\.map/g, '((item as any) || {}).map');
content = content.replace(/const found = releasedProducts\.find\(\n\s*item =>/g, 'const found = releasedProducts.find(\n      (item: any) =>');
content = content.replace(/item => normalizeProductCode\(item\)/g, '(item: any) => normalizeProductCode(item)');
fs.writeFileSync('src/modules/inventory/view-barcode/ProductBarcodeList.tsx', content);

// 3. localInventoryService.ts
content = fs.readFileSync('src/services/localInventoryService.ts', 'utf8');
content = content.replace(/const toLoc = toLocation \|\| 'PRODUCTION';/g, "/* const toLoc = toLocation || 'PRODUCTION'; */");
content = content.replace(/explicitActiveDraft\?: any/g, "/* explicitActiveDraft?: any */");
content = content.replace(/explicitActiveDraft: any = null/g, "/* explicitActiveDraft: any = null */");
content = content.replace(/reason: scanData\.reason \|\| 'Manual Scan',/g, "");
fs.writeFileSync('src/services/localInventoryService.ts', content);
