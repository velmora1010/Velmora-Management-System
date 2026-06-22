import fs from 'fs';

const file = 'src/modules/inventory/production/NewProductionBatch.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const checkStock = async \(\) => \{\n\s*if \(!requiredIngredients\) \{/g;

const newBlock = `const checkStock = async () => {
      if (!requiredIngredients) {`;

if (content.match(regex)) {
  content = content.replace(regex, `const checkStock = async () => {
      console.log("RELEASED STOCK", (inventoryService as any).getProductionAvailableStock());
      console.log("CONSUMED STOCK", (inventoryService as any).getProductionConsumedStock());
      if (!requiredIngredients) {`);
}

fs.writeFileSync(file, content);
console.log('Added console logs to NewProductionBatch');
