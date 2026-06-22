import fs from 'fs';

const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add allProductBarcodes state
if (!content.includes('const [allProductBarcodes, setAllProductBarcodes]')) {
  content = content.replace(
    /const \[finishedGoods, setFinishedGoods\] = useState<any\[\]>\(\[\]\);/,
    `const [finishedGoods, setFinishedGoods] = useState<any[]>([]);\n  const [allProductBarcodes, setAllProductBarcodes] = useState<any[]>([]);`
  );
}

// Update fetchData
if (!content.includes('inventoryService.getProductBarcodes()')) {
  content = content.replace(
    /const \[rb, pb, fg, cb, ci, allCombo\] = await Promise\.all\(\[/,
    `const [rb, pb, fg, cb, ci, allCombo, allProducts] = await Promise.all([`
  );
  content = content.replace(
    /inventoryService\.getAllComboBarcodes\(\)\n\s*\]\);/,
    `inventoryService.getAllComboBarcodes(),\n          (inventoryService as any).getProductBarcodes()\n        ]);`
  );
  content = content.replace(
    /setAllComboBarcodes\(allCombo\);/,
    `setAllComboBarcodes(allCombo);\n        setAllProductBarcodes(allProducts);`
  );
}

// Update filteredProducts to map over allProductBarcodes instead of finishedGoods
const filteredProductsRegex = /const filteredProducts = finishedGoods\.filter\(\(item: any\) => \{/;
if (content.match(filteredProductsRegex)) {
  content = content.replace(
    filteredProductsRegex,
    `const filteredProducts = allProductBarcodes.filter((item: any) => {`
  );
}

fs.writeFileSync(file, content);
console.log('Fixed Product Barcodes state mapping');
