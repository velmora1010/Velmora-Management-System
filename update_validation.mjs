import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

// Replace validateIngredientAvailability
const validateRegex = /async validateIngredientAvailability\(ingredients: any\[\]\) \{([\s\S]*?)\}\n\n  async deductRawMaterialsForProduction/s;
const newValidate = `async validateIngredientAvailability(ingredients: any[]) {
    const releasedStock = this.getProductionAvailableStock();
    const consumedStock = this.getProductionConsumedStock();
    
    const status = [];
    
    for (const ing of ingredients) {
      const key = normalizeMaterialKey(ing.name);
      const released = Number(releasedStock[key]?.availableKg || 0);
      const consumed = Number(consumedStock[key] || 0);
      const available = released - consumed;
        
      status.push({
        name: ing.name,
        required: ing.required_quantity,
        available: Number(available.toFixed(3)),
        sufficient: available >= ing.required_quantity,
        shortage: available < ing.required_quantity ? ing.required_quantity - available : 0
      });
    }
    
    return status;
  }

  async deductRawMaterialsForProduction`;

if (serviceContent.match(validateRegex)) {
  serviceContent = serviceContent.replace(validateRegex, newValidate);
}

// Replace deductRawMaterialsForProduction
const deductRawRegex = /async deductRawMaterialsForProduction\(ingredients: any\[\], productionBatchId: string, productCode: string\) \{([\s\S]*?)    this\.saveList\('inventory_batches', rawBatches\);\n    this\.saveList\('inventory_ledger', ledger\);\n  \}/s;

const newDeductRaw = `async deductRawMaterialsForProduction(ingredients: any[], productionBatchId: string, productCode: string) {
    const releasedStock = this.getProductionAvailableStock();
    const consumedStock = this.getProductionConsumedStock();
    const ledger = this.getList('inventory_transactions');
    
    // Step 1: Validate
    for (const ing of ingredients) {
      const key = normalizeMaterialKey(ing.name);
      const released = Number(releasedStock[key]?.availableKg || 0);
      const consumed = Number(consumedStock[key] || 0);
      const available = released - consumed;
      
      if (available < ing.required_quantity) {
        throw new Error(\`Insufficient stock for \${ing.name}. Required: \${ing.required_quantity}, Available: \${available}\`);
      }
    }

    // Step 2: Create Consume Transactions
    for (const ing of ingredients) {
      const key = normalizeMaterialKey(ing.name);
      
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
  }`;

if (serviceContent.match(deductRawRegex)) {
  serviceContent = serviceContent.replace(deductRawRegex, newDeductRaw);
}

fs.writeFileSync(serviceFile, serviceContent);
console.log('Updated validation and deduction in localInventoryService');
