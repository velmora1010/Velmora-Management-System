import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(serviceFile, 'utf8');

// Replace getProductionMaterialStock
const oldGetProdStockBlock = /async getProductionMaterialStock\(\) \{\s*return JSON\.parse\(localStorage\.getItem\('production_material_stock'\) \|\| '\{\}'\);\s*\}/s;

const newGetProdStockBlock = `async getProductionMaterialStock() {
    const rawStock = this.getReleasedRawMaterialStock();
    const formatted: any = {};
    Object.keys(rawStock).forEach(key => {
      formatted[key] = { availableKg: Number(rawStock[key].toFixed(3)) };
    });
    return formatted;
  }`;

if (content.match(oldGetProdStockBlock)) {
  content = content.replace(oldGetProdStockBlock, newGetProdStockBlock);
  fs.writeFileSync(serviceFile, content);
  console.log("Replaced getProductionMaterialStock");
} else {
  console.log("Could not find getProductionMaterialStock");
}
