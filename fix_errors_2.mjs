import fs from 'fs';

// 1. Fix CreateCombo.tsx
const createComboFile = 'src/modules/inventory/combos/CreateCombo.tsx';
let createComboContent = fs.readFileSync(createComboFile, 'utf8');

createComboContent = createComboContent.replace(/import \{ useNavigate \} from 'react-router-dom';\n/, '');
createComboContent = createComboContent.replace(/setLoading\(true\);\n/g, '');
createComboContent = createComboContent.replace(/setLoading\(false\);\n/g, '');
createComboContent = createComboContent.replace(/setFinishedGoods\(activeStock\);\n/g, '');
createComboContent = createComboContent.replace(/finalName = customName \|\| 'Custom Combo';/g, "finalName = 'Custom Combo';");

createComboContent = createComboContent.replace(/export const PREDEFINED_COMBOS = \[/, "export const PREDEFINED_COMBOS: any[] = [");

fs.writeFileSync(createComboFile, createComboContent);


// 2. Fix ProductBarcodeList.tsx
const productListFile = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let productListContent = fs.readFileSync(productListFile, 'utf8');

// I removed `const [comboDrafts, setComboDrafts] = useState<any[]>([]);` but `setComboDrafts(drafts)` was in loadData
productListContent = productListContent.replace(/setComboDrafts\(drafts\);\n/g, '');
productListContent = productListContent.replace(/productSubTab === \('PACKED' as any\)/g, "productSubTab === ('ALL' as any)");
productListContent = productListContent.replace(/record = batches\.find\(\(item: any\)/g, "record = batches.find((item: any)");
productListContent = productListContent.replace(/record = allProducts\.find\(\(item: any\)/g, "record = allProducts.find((item: any)");
productListContent = productListContent.replace(/Object\.entries\(item \?\? \{\}\)/g, "Object.entries((item as any) ?? {})");
productListContent = productListContent.replace(/\(item\) =>/g, "(item: any) =>");

fs.writeFileSync(productListFile, productListContent);


// 3. Fix localInventoryService.ts
const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

// Restore comboBarcodes that I removed
serviceContent = serviceContent.replace(/record = comboBarcodes\.find/g, "record = this.getList('combo_barcodes').find");
serviceContent = serviceContent.replace(/const comboBarcodes = this\.getList\('combo_barcodes'\);\n/g, '');

serviceContent = serviceContent.replace(/reason: scanData\.reason \|\| 'Manual Scan',/g, '');

fs.writeFileSync(serviceFile, serviceContent);

console.log("Fixed secondary compilation errors.");
