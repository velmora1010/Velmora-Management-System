import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

const regex = /async validateIngredientAvailability\(ingredients: any\[\]\) \{[\s\S]*?async recordInventoryIssue/s;

const newCode = `async validateIngredientAvailability(ingredients: any[]) {
    const rawBarcodes = this.getList('inventory_batches');

    const releasedStock = rawBarcodes.reduce((acc: any, item: any) => {
      if (item.currentStage !== "RAW_MATERIAL_OUT") return acc;

      const key = normalizeMaterialKey(
        item.materialName || item.name || item.itemName || item.material
      );

      const qty = Number(item.quantity || item.available_quantity || item.original_quantity || item.available || 0);

      acc[key] = (acc[key] || 0) + qty;
      return acc;
    }, {});

    console.log("RAW BARCODES", rawBarcodes);
    console.log("RELEASED STOCK", releasedStock);

    const status = [];
    
    for (const ing of ingredients) {
      const key = normalizeMaterialKey(ing.name);
      const availableKg = releasedStock[key] || 0;
      
      console.log("INGREDIENT", ing.name, availableKg);
      
      status.push({
        name: ing.name,
        required: ing.required_quantity,
        available: Number(availableKg.toFixed(3)),
        sufficient: availableKg >= ing.required_quantity,
        shortage: availableKg < ing.required_quantity ? ing.required_quantity - availableKg : 0
      });
    }
    
    return status;
  }

  async deductRawMaterialsForProduction(ingredients: any[], productionBatchId: string, productCode: string) {
    const rawBarcodes = this.getList('inventory_batches');
    const ledger = this.getList('inventory_transactions');
    
    const releasedStock = rawBarcodes.reduce((acc: any, item: any) => {
      if (item.currentStage !== "RAW_MATERIAL_OUT") return acc;
      const key = normalizeMaterialKey(
        item.materialName || item.name || item.itemName || item.material
      );
      const qty = Number(item.quantity || item.available_quantity || item.original_quantity || item.available || 0);
      acc[key] = (acc[key] || 0) + qty;
      return acc;
    }, {});

    // Step 1: Validate
    for (const ing of ingredients) {
      const key = normalizeMaterialKey(ing.name);
      const availableKg = releasedStock[key] || 0;
      
      if (availableKg < ing.required_quantity) {
        throw new Error(\`Insufficient stock for \${ing.name}. Required: \${ing.required_quantity}, Available: \${availableKg}\`);
      }
    }

    // Step 2: Create Consume Transactions
    for (const ing of ingredients) {
      ledger.push({
        id: crypto.randomUUID(),
        transactionType: "PRODUCTION_CONSUME",
        itemName: ing.name,
        quantity: ing.required_quantity,
        fromStage: "RAW_MATERIAL_OUT",
        toStage: "PRODUCTION_CONSUMED",
        production_batch_id: productionBatchId,
        product_code: productCode,
        createdAt: new Date().toISOString()
      });
    }

    this.saveList('inventory_transactions', ledger);
  }

  async recordInventoryIssue`;

if (serviceContent.match(regex)) {
  serviceContent = serviceContent.replace(regex, newCode);
  fs.writeFileSync(serviceFile, serviceContent);
  console.log("Replaced validation logic exactly as user requested.");
} else {
  console.log("Could not match regex.");
}
