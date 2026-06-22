import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

const newMethods = `
  getProductionAvailableStock() {
    const rawBarcodes = this.getList('inventory_batches'); 
    const stock: Record<string, any> = {};

    rawBarcodes.forEach((item: any) => {
      if (item.currentStage !== "RAW_MATERIAL_OUT") return;

      const key = normalizeMaterialKey(
        item.materialName || item.name || item.itemName || item.material_name || item.material
      );

      const qty = Number(item.quantity || item.available_quantity || item.original_quantity || item.available || 0);

      if (!key || qty <= 0) return;

      if (!stock[key]) {
        stock[key] = {
          materialName: item.materialName || item.name || item.itemName || item.material_name || item.material,
          availableKg: 0,
          unit: item.unit || "KG",
          sourceBarcodes: []
        };
      }

      const bc = item.barcodeNumber || item.barcode_no || item.serial_number || item.barcode;
      if (!stock[key].sourceBarcodes.includes(bc)) {
        stock[key].availableKg += qty;
        stock[key].sourceBarcodes.push(bc);
      }
    });

    return stock;
  }

  getProductionConsumedStock() {
    const transactions = this.getList('inventory_transactions');
    const consumed: Record<string, number> = {};

    transactions.forEach((tx: any) => {
      if (tx.transactionType !== "PRODUCTION_CONSUME") return;

      const key = normalizeMaterialKey(tx.itemName || tx.materialName);
      consumed[key] = (consumed[key] || 0) + Number(tx.quantity || 0);
    });

    return consumed;
  }
`;

if (!serviceContent.includes('getProductionAvailableStock() {')) {
  serviceContent = serviceContent.replace('  async getProductionMaterialStock() {', newMethods + '\n  async getProductionMaterialStock() {');
  fs.writeFileSync(serviceFile, serviceContent);
  console.log('Injected new methods correctly!');
} else {
  console.log('Methods already present.');
}
