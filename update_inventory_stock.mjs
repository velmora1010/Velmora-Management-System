import fs from 'fs';
const file = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(file, 'utf8');

// Inject the new functions
const newFunctions = `
  getProductionMaterialStock() {
    return JSON.parse(localStorage.getItem('production_material_stock') || '{}');
  }

  saveProductionMaterialStock(stock: any) {
    localStorage.setItem('production_material_stock', JSON.stringify(stock));
  }

  addRawMaterialToProductionStock(rawMaterialBarcode: any) {
    const stock = this.getProductionMaterialStock();

    const materialKey =
      rawMaterialBarcode.materialName ||
      rawMaterialBarcode.name ||
      rawMaterialBarcode.itemName ||
      rawMaterialBarcode.material_name ||
      rawMaterialBarcode.item_name;

    const qty = Number(rawMaterialBarcode.quantity || rawMaterialBarcode.original_quantity || 0);

    if (!materialKey || qty <= 0) {
      throw new Error("Invalid raw material barcode quantity or material name.");
    }

    if (stock[materialKey]?.sourceBarcodes?.includes(rawMaterialBarcode.barcodeNumber || rawMaterialBarcode.barcode_no || rawMaterialBarcode.serial_number)) {
        throw new Error("Raw material already released for production.");
    }

    stock[materialKey] = {
      materialName: materialKey,
      availableKg: Number(stock[materialKey]?.availableKg || 0) + qty,
      unit: rawMaterialBarcode.unit || "KG",
      sourceBarcodes: [
        ...(stock[materialKey]?.sourceBarcodes || []),
        rawMaterialBarcode.barcodeNumber || rawMaterialBarcode.barcode_no || rawMaterialBarcode.serial_number
      ],
      updatedAt: new Date().toISOString()
    };

    this.saveProductionMaterialStock(stock);
  }
`;

// Insert the functions right before `processBarcodeScan`
const processBarcodeIndex = content.indexOf('async processBarcodeScan');
if (processBarcodeIndex > -1) {
    content = content.substring(0, processBarcodeIndex) + newFunctions + "\n  " + content.substring(processBarcodeIndex);
}

// Update `processBarcodeScan` for RAW_MATERIAL transition
// Find: successMessage = 'Raw material moved to Inventory OUT (Ready for Production).';
const rawMaterialOutRegex = /successMessage = 'Raw material moved to Inventory OUT \(Ready for Production\)\.';/g;
const replacement = `successMessage = 'Raw material moved to Inventory OUT (Ready for Production).';
        // NEW LOGIC: add quantity to production stock
        this.addRawMaterialToProductionStock(record);`;

content = content.replace(rawMaterialOutRegex, replacement);

fs.writeFileSync(file, content);
console.log('Successfully added production material stock logic.');
