import fs from 'fs';

const file = 'src/modules/inventory/production/ProductionBatchDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add productionStock state
if (!content.includes('const [productionStock, setProductionStock]')) {
  content = content.replace(
    'const [loading, setLoading] = useState(true);',
    'const [loading, setLoading] = useState(true);\n  const [productionStock, setProductionStock] = useState<any>({});'
  );
}

// 2. Fetch productionStock in fetchData
const fetchRegex = /const \[ings, mbs\] = await Promise\.all\(\[\s*inventoryService\.getProductionIngredients\(prodBatchId\),\s*inventoryService\.getMicroBatches\(prodBatchId\)\s*\]\);/s;
const newFetch = `const [ings, mbs, prodStock] = await Promise.all([
          inventoryService.getProductionIngredients(prodBatchId),
          inventoryService.getMicroBatches(prodBatchId),
          inventoryService.getProductionMaterialStock()
        ]);`;
if (content.match(fetchRegex)) {
  content = content.replace(fetchRegex, newFetch);
  content = content.replace('setMicroBatches(mbs);', 'setMicroBatches(mbs);\n        setProductionStock(prodStock);');
}

// 3. Delete handleToggleIngredient and handleScanRawMaterialSubmit
// This might be tricky with regex, so I'll just replace their entire implementation or usages.
// Let's replace the button inside the map.

const uiRegex = /\{ingredients\.map\(\(ing: any\) => \{[\s\S]*?const isReady = ing\.status === 'Ready';/g;

// In UI, instead of ing.status === 'Ready', we do:
// const avail = productionStock[ing.material_name]?.availableKg || 0;
// const isReady = avail >= ing.required_quantity;

const newUiStart = `{ingredients.map((ing: any) => {
              const avail = productionStock[ing.material_name]?.availableKg || 0;
              const isReady = avail >= ing.required_quantity;`;

content = content.replace(uiRegex, newUiStart);

// We need to change the subtext in the UI to show required and available.
// "Required: 50 KG" -> "Required: 50 KG | Available: 1000 KG"
const requiredTextRegex = /<div style=\{\{ fontSize: '13px', color: 'var\(--text-muted\)' \}\}>Required: <strong style=\{\{ color: isReady \? '#10b981' : 'white' \}\}>\{ing\.required_quantity\} KG<\/strong><\/div>/g;
const newRequiredText = `<div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Required: <strong style={{ color: isReady ? '#10b981' : 'white' }}>{ing.required_quantity} KG</strong> | Available: <strong style={{ color: isReady ? '#10b981' : '#ef4444' }}>{avail} KG</strong></div>`;
content = content.replace(requiredTextRegex, newRequiredText);

// Remove the Scan button completely
const scanButtonRegex = /\{!showMicroBatches && \(\s*<button[\s\S]*?<\/button>\s*\)\}/g;
content = content.replace(scanButtonRegex, '');

// 4. Update handleStartMicroBatches
const startMicroBatchesRegex = /const handleStartMicroBatches = async \(\) => \{([\s\S]*?)try \{/g;
// We just need to add the deduction logic right after "setForceShowMicroBatches(true);"
// But wait, the deduction must happen inside the try block.

const tryRegex = /try \{\s*if \(microBatches\.length === 0/g;
const newTry = `try {
      await inventoryService.deductFromProductionMaterialStock(ingredients);
      
      if (microBatches.length === 0`;

content = content.replace(tryRegex, newTry);

// 5. Update the checkedIngredientsCount calculation
const countRegex = /const checkedIngredientsCount = ingredients\?\.filter\(\(i: any\) => i\.status === 'Ready'\)\.length \|\| 0;/g;
const newCount = `const checkedIngredientsCount = ingredients?.filter((i: any) => {
    const avail = productionStock[i.material_name]?.availableKg || 0;
    return avail >= i.required_quantity;
  }).length || 0;`;

content = content.replace(countRegex, newCount);

fs.writeFileSync(file, content);
console.log('ProductionBatchDetail UI updated.');
