import fs from 'fs';

const file = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(file, 'utf8');

const handoffFunction = `
  async handleInventoryOutHandoff(barcodeRecord: any, fromDepartment: 'RAW_MATERIAL' | 'PRODUCT' | 'COMBO') {
    if (barcodeRecord.handoffCompleted) {
      console.warn("Handoff already completed for this barcode:", barcodeRecord);
      return;
    }

    const now = new Date().toISOString();
    let toLoc = '';

    if (fromDepartment === 'RAW_MATERIAL') {
      await this.addRawMaterialToProductionStock(barcodeRecord);
      toLoc = 'PRODUCTION_AVAILABLE';
      barcodeRecord.handoffToDepartment = 'PRODUCTION';
    } else if (fromDepartment === 'PRODUCT') {
      // Add product unit to combo_available_stock
      const comboStock = JSON.parse(localStorage.getItem('combo_available_stock') || '{}');
      const prodKey = normalizeMaterialKey(barcodeRecord.productName || barcodeRecord.productCode || barcodeRecord.name || barcodeRecord.itemName);
      if (!comboStock[prodKey]) {
        comboStock[prodKey] = {
          productName: barcodeRecord.productName || barcodeRecord.name || barcodeRecord.itemName,
          availableUnits: 0,
          sourceBarcodes: []
        };
      }
      comboStock[prodKey].availableUnits += 1;
      comboStock[prodKey].sourceBarcodes.push(barcodeRecord.barcode_no || barcodeRecord.barcodeNumber);
      localStorage.setItem('combo_available_stock', JSON.stringify(comboStock));
      
      toLoc = 'COMBO_AVAILABLE';
      barcodeRecord.handoffToDepartment = 'COMBO';
    } else if (fromDepartment === 'COMBO') {
      // Add combo to dispatch_available_stock
      const dispatchStock = JSON.parse(localStorage.getItem('dispatch_available_stock') || '{}');
      const comboKey = normalizeMaterialKey(barcodeRecord.comboName || barcodeRecord.name || barcodeRecord.batch_id);
      if (!dispatchStock[comboKey]) {
        dispatchStock[comboKey] = {
          comboName: barcodeRecord.comboName || barcodeRecord.name,
          availableUnits: 0,
          sourceBarcodes: []
        };
      }
      dispatchStock[comboKey].availableUnits += 1;
      dispatchStock[comboKey].sourceBarcodes.push(barcodeRecord.barcode_no || barcodeRecord.barcodeNumber || barcodeRecord.batch_id);
      localStorage.setItem('dispatch_available_stock', JSON.stringify(dispatchStock));
      
      toLoc = 'DISPATCH_AVAILABLE';
      barcodeRecord.handoffToDepartment = 'DISPATCH';
    }

    barcodeRecord.handoffCompleted = true;
    barcodeRecord.handoffCompletedAt = now;

    // Add clear movement transaction for handoff
    await this.createInventoryTransaction({
      barcodeNumber: barcodeRecord.barcode_no || barcodeRecord.barcodeNumber || barcodeRecord.serial_number || barcodeRecord.batch_id,
      itemType: fromDepartment,
      itemName: barcodeRecord.materialName || barcodeRecord.productName || barcodeRecord.comboName || barcodeRecord.name,
      quantity: Number(barcodeRecord.quantity || barcodeRecord.original_quantity || 1),
      unit: barcodeRecord.unit || 'Unit',
      fromLocation: \`\${fromDepartment}_OUT\`,
      toLocation: toLoc,
      transactionType: 'TRANSFER',
      referenceType: 'HANDOFF',
      referenceId: \`HANDOFF-\${now}\`
    });
  }
`;

// Insert the handoffFunction before processBarcodeScan
const processRegex = /async processBarcodeScan\(/;
if (content.match(processRegex)) {
  content = content.replace(processRegex, handoffFunction + '\n  async processBarcodeScan(');
}

// Replace RAW_MATERIAL_OUT logic
const rawMatOutRegex = /\/\/ NEW LOGIC: add quantity to production stock\n\s*await this\.addRawMaterialToProductionStock\(record\);\n\s*record\.releasedToProduction = true;\n\s*console\.log\("PRODUCTION MATERIAL STOCK UPDATED", await this\.getProductionMaterialStock\(\)\);/g;
content = content.replace(rawMatOutRegex, `// Global Handoff Engine
        await this.handleInventoryOutHandoff(record, 'RAW_MATERIAL');
        successMessage = 'Raw material moved to Inventory OUT (Ready for Production).';`);

// Replace PRODUCT_OUT logic
const prodOutRegex = /successMessage = 'Product reserved for Combo \(Inventory OUT\)\.';/g;
content = content.replace(prodOutRegex, `// Global Handoff Engine
        await this.handleInventoryOutHandoff(record, 'PRODUCT');
        successMessage = 'Product reserved for Combo (Inventory OUT).';`);

// Replace COMBO_OUT logic
const comboOutRegex = /successMessage = 'Combo moved to Inventory OUT \(Ready for Dispatch\)\.';/g;
content = content.replace(comboOutRegex, `// Global Handoff Engine
        await this.handleInventoryOutHandoff(record, 'COMBO');
        successMessage = 'Combo moved to Inventory OUT (Ready for Dispatch).';`);

fs.writeFileSync(file, content);
console.log('Added global handoff engine');
