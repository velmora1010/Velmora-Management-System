const fs = require('fs');
const file = 'src/modules/inventory/production/ProductionBatchDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

const missingBlock = `        const newMicroBatches = Array.from({ length: productionBatch.total_micro_batches }, (_, i) => ({
          id: crypto.randomUUID(),
          production_batch_id: productionBatch.id,
          micro_batch_no: i + 1,
          units: unitsPerBatch,
          status: 'Waiting'
        }));

        await inventoryService.saveMicroBatches(newMicroBatches);
      }

      await inventoryService.updateProductionBatch(productionBatch.id, { status: 'In Progress' });

      await fetchData();
    } catch (error: any) {
      console.error("Start Micro Batches failed:", error);
      alert(error.message || "Failed to start micro batches");
    }
  };

  const handlePassQCClick = (mb: any) => {
    setPendingBarcodeMB(mb);
  };

  const handleCancelBarcode = () => {
    setPendingBarcodeMB(null);
  };

  const handleBarcodeScanSuccess = async (mb: any) => {
    if (!productionBatch) return;
    
    const productCode = getProductDisplayName(productionBatch.product_name) || 'XX';
    const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,''); // e.g. 260609
    
    await inventoryService.updateMicroBatch(mb.id, {
      status: 'Passed',
      barcode_data: \`PROD-\${productCode}-MB\${mb.micro_batch_no}-\${dateStr}-001\`,
      barcode_saved: true,
      completed_at: new Date().toISOString()
    });

    const completedCount = productionBatch.completed_micro_batches + 1;
    const isNowComplete = completedCount === productionBatch.total_micro_batches;
    
    if (isNowComplete) {
      const finalBarcodes = [];
      const totalUnits = productionBatch.total_units || 0;
      
      for (let i = 1; i <= totalUnits; i++) {
        const unitSerial = i.toString().padStart(4, '0');
        finalBarcodes.push({
          id: crypto.randomUUID(),
          type: 'PRODUCT_UNIT',
          production_batch_id: productionBatch.id,
          product_code: productCode,
          product_name: productionBatch.product_name,
          unit_no: i,
          barcode_no: \`PROD-\${productCode}-\${dateStr}-\${unitSerial}\`,
          status: 'READY',
          created_at: new Date().toISOString()
        });
      }
      
      if (finalBarcodes.length > 0) {
        await inventoryService.saveProductBarcodes(finalBarcodes);
      }

      const fg = await inventoryService.getFinishedGoods();
      const existingFg = fg.find((f: any) => f.production_batch_id === productionBatch.id && f.total_units === totalUnits);
      
      if (!existingFg) {
        await inventoryService.saveFinishedGood({
          product_code: productCode,
          product_name: productionBatch.product_name,
          production_batch_id: productionBatch.id,
          total_units: totalUnits,
          available_units: totalUnits,
          used_units: 0,
          status: 'READY',
          scanned_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
      }
      
      await inventoryService.updateProductionBatch(productionBatch.id, {
        completed_micro_batches: completedCount,
        produced_units: totalUnits,
        inventory_units: totalUnits,
        status: 'Complete'
      });
    } else {
      await inventoryService.updateProductionBatch(productionBatch.id, {
        completed_micro_batches: completedCount,
        produced_units: productionBatch.produced_units + mb.units,
      });
    }
    
    setPendingBarcodeMB(null);
    await fetchData();
  };

  const handleFailMicroBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failingMicroBatch || !productionBatch) return;

    await inventoryService.updateMicroBatch(failingMicroBatch.id, {
      status: 'Failed',
      failure_reason: failReason,
      completed_at: new Date().toISOString()
    });

    const completedCount = productionBatch.completed_micro_batches + 1;
    await inventoryService.updateProductionBatch(productionBatch.id, {
      completed_micro_batches: completedCount
    });

    await fetchData();
    setFailModalOpen(false);
    setFailingMicroBatch(null);
  };

  const handleFinishProduction = async () => {
    if (!productionBatch) return;
    await inventoryService.updateProductionBatch(productionBatch.id, { status: 'Saved' });
    await fetchData();
  };

  if (!productionBatch) return <div style={{ padding: '48px', textAlign: 'center' }}>Loading...</div>;

  const checkedIngredientsCount = ingredients?.filter((i: any) => i.status === 'Ready').length || 0;
  const allIngredientsPrepared = ingredients && ingredients.length > 0 && checkedIngredientsCount === ingredients.length;

  let progress = 0;
  if (productionBatch.status === 'Prep') {
    progress = ingredients.length > 0 ? Math.round((checkedIngredientsCount / ingredients.length) * 100) : 0;
  } else {
    progress = productionBatch.total_micro_batches > 0 ? Math.round((productionBatch.completed_micro_batches / productionBatch.total_micro_batches) * 100) : 0;
  }

  const isFullyComplete = productionBatch.status === 'Complete';
`;

const startIdx = content.indexOf('const unitsPerBatch = Math.floor(productionBatch.total_units / productionBatch.total_micro_batches);');
if (startIdx === -1) {
  console.error("Start index not found!");
  process.exit(1);
}

const endIdx = content.indexOf('const showMicroBatches');
if (endIdx === -1) {
  console.error("End index not found!");
  process.exit(1);
}

const newContent = content.substring(0, startIdx + 'const unitsPerBatch = Math.floor(productionBatch.total_units / productionBatch.total_micro_batches);'.length) + '\n' + missingBlock + '\n  ' + content.substring(endIdx);

fs.writeFileSync(file, newContent);
console.log("Successfully restored the missing block!");
