import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

// 1. Rewrite validateIngredientAvailability
const vRegex = /async validateIngredientAvailability\(ingredients: any\[\]\) \{[\s\S]*?return status;\n  \}/;

const newValidate = `async validateIngredientAvailability(ingredients: any[]) {
    const releasedList = this.getRawMaterialsReleasedToProduct();
    const consumedStock = this.getProductionConsumedStock();
    
    const releasedStock = releasedList.reduce((acc: any, item: any) => {
      const key = normalizeMaterialKey(item.materialName || item.name || item.itemName);
      const qty = Number(item.quantity || 0);
      acc[key] = (acc[key] || 0) + qty;
      return acc;
    }, {});

    console.log("RELEASED LIST", releasedList);
    console.log("CONSUMED STOCK", consumedStock);

    const status = [];
    
    for (const ing of ingredients) {
      const key = normalizeMaterialKey(ing.name);
      const availableKg = (releasedStock[key] || 0) - (consumedStock[key] || 0);
      
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
  }`;

if(serviceContent.match(vRegex)) {
  serviceContent = serviceContent.replace(vRegex, newValidate);
} else {
  console.log("Failed to match validateIngredientAvailability");
}

// 2. Rewrite deductRawMaterialsForProduction
const dRegex = /async deductRawMaterialsForProduction\(ingredients: any\[\], productionBatchId: string, productCode: string\) \{[\s\S]*?this\.saveList\('inventory_transactions', ledger\);\n    return true;\n  \}/;

const newDeduct = `async deductRawMaterialsForProduction(ingredients: any[], productionBatchId: string, productCode: string) {
    const releasedList = this.getRawMaterialsReleasedToProduct();
    const consumedStock = this.getProductionConsumedStock();
    const ledger = this.getList('inventory_transactions');
    
    const releasedStock = releasedList.reduce((acc: any, item: any) => {
      const key = normalizeMaterialKey(item.materialName || item.name || item.itemName);
      const qty = Number(item.quantity || 0);
      acc[key] = (acc[key] || 0) + qty;
      return acc;
    }, {});

    // Step 1: Validate
    for (const ing of ingredients) {
      const key = normalizeMaterialKey(ing.name);
      const availableKg = (releasedStock[key] || 0) - (consumedStock[key] || 0);
      
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
    return true;
  }`;

if(serviceContent.match(dRegex)) {
  serviceContent = serviceContent.replace(dRegex, newDeduct);
} else {
  console.log("Failed to match deductRawMaterialsForProduction");
}

// 3. Rewrite getComboStockBalance
const cRegex = /async getComboStockBalance\(\): Promise<any\[\]> \{[\s\S]*?return stockItems;\n  \}/;

const newCombo = `async getComboStockBalance(): Promise<any[]> {
    const releasedProducts = this.getProductsReleasedToCombo();
    // Consumed products would be products already PACKED_IN_COMBO
    const comboBarcodes = this.getList('combo_barcodes'); // actually, packed products are in finished_product_barcodes
    const allProducts = this.getList('finished_product_barcodes');

    const packedMap: Record<string, number> = {};
    allProducts.forEach((p: any) => {
      if (p.currentStage === 'PACKED_IN_COMBO') {
        const key = normalizeMaterialKey(p.product_name || p.name);
        packedMap[key] = (packedMap[key] || 0) + 1;
      }
    });

    const releasedMap: Record<string, number> = {};
    releasedProducts.forEach((p: any) => {
      const key = normalizeMaterialKey(p.productName || p.name);
      releasedMap[key] = (releasedMap[key] || 0) + (Number(p.quantity) || 1);
    });

    const stockItems = [];
    for (const [key, qty] of Object.entries(releasedMap)) {
      const available = qty - (packedMap[key] || 0);
      if (available > 0) {
        stockItems.push({
          productCode: key,
          product_name: key, // Keep capitalised name if possible, but key is normalized. We will use key for simplicity.
          available_units: available
        });
      }
    }

    return stockItems;
  }`;

if(serviceContent.match(cRegex)) {
  serviceContent = serviceContent.replace(cRegex, newCombo);
} else {
  console.log("Failed to match getComboStockBalance");
}

fs.writeFileSync(serviceFile, serviceContent);
console.log("Done updating validations and combo logic!");
