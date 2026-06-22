import fs from 'fs';
const file = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(file, 'utf8');

const deductFunction = `
  async deductFromProductionMaterialStock(ingredients: any[]) {
    const stock = await this.getProductionMaterialStock();
    
    for (const ing of ingredients) {
      const materialKey = ing.material_name || ing.name;
      const requiredQty = Number(ing.required_quantity || 0);
      
      if (!materialKey || requiredQty <= 0) continue;
      
      if (!stock[materialKey] || stock[materialKey].availableKg < requiredQty) {
        throw new Error(\`Insufficient production stock for \${materialKey}. Required: \${requiredQty}, Available: \${stock[materialKey]?.availableKg || 0}\`);
      }
      
      stock[materialKey].availableKg -= requiredQty;
    }
    
    await this.saveProductionMaterialStock(stock);
  }
`;

const processBarcodeIndex = content.indexOf('async processBarcodeScan');
if (processBarcodeIndex > -1) {
    content = content.substring(0, processBarcodeIndex) + deductFunction + "\n  " + content.substring(processBarcodeIndex);
}

fs.writeFileSync(file, content);
console.log('Added deductFromProductionMaterialStock');
