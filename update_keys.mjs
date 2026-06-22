import fs from 'fs';

const file = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add normalizeMaterialKey helper
const normalizeHelper = `
export const normalizeMaterialKey = (name: string) => String(name || "").trim().toLowerCase();
`;

// Insert it somewhere at the top, e.g., after imports.
// Since localInventoryService is a class or object, we can add it before the class/object definition or just inside the file.
// Let's add it before `class LocalInventoryService` or `const localInventoryService = {`
if (!content.includes('export const normalizeMaterialKey')) {
  // Let's just put it near the top after imports
  content = content.replace(/(import .*;\n)+/g, match => match + normalizeHelper + '\n');
}

// Update addRawMaterialToProductionStock
const addRawMatRegex = /async addRawMaterialToProductionStock\(rawMaterialBarcode: any\) \{([\s\S]*?)await this\.saveProductionMaterialStock\(stock\);\n  \}/;
content = content.replace(addRawMatRegex, `async addRawMaterialToProductionStock(rawMaterialBarcode: any) {
    const stock = await this.getProductionMaterialStock();

    const rawName =
      rawMaterialBarcode.materialName ||
      rawMaterialBarcode.name ||
      rawMaterialBarcode.itemName ||
      rawMaterialBarcode.material_name ||
      rawMaterialBarcode.item_name;

    const materialKey = normalizeMaterialKey(rawName);
    const qty = Number(rawMaterialBarcode.quantity || rawMaterialBarcode.original_quantity || 0);

    if (!materialKey || qty <= 0) {
      throw new Error("Invalid raw material barcode quantity or material name.");
    }

    const barcodeToSave = rawMaterialBarcode.barcodeNumber || rawMaterialBarcode.barcode_no || rawMaterialBarcode.serial_number;

    // We must find by normalized key. Wait, previous records might not be normalized. But we are starting fresh or normalizing now.
    // Duplicate protection
    if (stock[materialKey]?.sourceBarcodes?.includes(barcodeToSave)) {
        throw new Error("Raw material already released for production.");
    }

    stock[materialKey] = {
      materialName: rawName || "Unknown",
      availableKg: Number(stock[materialKey]?.availableKg || 0) + qty,
      unit: rawMaterialBarcode.unit || "KG",
      sourceBarcodes: [
        ...(stock[materialKey]?.sourceBarcodes || []),
        barcodeToSave
      ],
      updatedAt: new Date().toISOString()
    };

    await this.saveProductionMaterialStock(stock);
  }`);

// Update deductFromProductionMaterialStock
const deductRegex = /async deductFromProductionMaterialStock\(ingredients: any\[\]\) \{([\s\S]*?)await this\.saveProductionMaterialStock\(stock\);\n  \}/;
content = content.replace(deductRegex, `async deductFromProductionMaterialStock(ingredients: any[]) {
    const stock = await this.getProductionMaterialStock();
    
    for (const ing of ingredients) {
      const rawName = ing.material_name || ing.name;
      const materialKey = normalizeMaterialKey(rawName);
      const requiredQty = Number(ing.required_quantity || 0);
      
      if (!materialKey || requiredQty <= 0) continue;
      
      if (!stock[materialKey] || stock[materialKey].availableKg < requiredQty) {
        throw new Error(\`Insufficient production stock for \${rawName}. Required: \${requiredQty}, Available: \${stock[materialKey]?.availableKg || 0}\`);
      }
      
      stock[materialKey].availableKg -= requiredQty;
    }
    
    await this.saveProductionMaterialStock(stock);
  }`);

// Update processBarcodeScan to mark releasedToProduction and console.log
const processRegex = /\/\/ NEW LOGIC: add quantity to production stock\n\s*await this\.addRawMaterialToProductionStock\(record\);/g;
content = content.replace(processRegex, `// NEW LOGIC: add quantity to production stock
        await this.addRawMaterialToProductionStock(record);
        record.releasedToProduction = true;
        console.log("PRODUCTION MATERIAL STOCK UPDATED", await this.getProductionMaterialStock());`);

fs.writeFileSync(file, content);
console.log('localInventoryService updated with normalization');
