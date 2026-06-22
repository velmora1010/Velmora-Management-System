import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(serviceFile, 'utf8');

const processRegex = /async processBarcodeScan\([\s\S]*?return \{ success: true, message: successMessage, stage: nextStage, item: record \};\n  \}/s;

const newProcessBlock = `async processBarcodeScan(params: {
    barcodeNumber: string;
    department: 'RAW_MATERIAL' | 'PRODUCT' | 'COMBO';
    scanAction: 'IN' | 'OUT' | 'PACK';
    payload?: any;
  }): Promise<{ success: boolean; message: string; stage: string; item: any }> {
    const { barcodeNumber, department, scanAction, payload } = params;
    const now = new Date().toISOString();
    const userId = localStorage.getItem('current_user') || 'Warehouse Admin';

    let record: any = null;
    let listKey = '';
    
    const scannedCode = normalizeBarcode(barcodeNumber);

    if (department === 'RAW_MATERIAL') {
      const batches = this.getList('inventory_batches');
      record = batches.find((item: any) => getMasterBarcode(item) === scannedCode);
      if (!record) {
        record = batches.find((item: any) => [item.displayBarcode, item.barcodeNumber, item.barcode, item.code, item.serial_number, item.barcode_no, item.batchNo, item.id].map(x => normalizeBarcode(x)).includes(scannedCode));
      }
      listKey = 'inventory_batches';
    } else if (department === 'PRODUCT') {
      const fgList = this.getList('finished_goods');
      record = fgList.find((item: any) => getMasterBarcode(item) === scannedCode);
      if (!record) {
        record = fgList.find((item: any) => [item.displayBarcode, item.barcodeNumber, item.barcode, item.code, item.serial_number, item.barcode_no, item.batchNo, item.id].map(x => normalizeBarcode(x)).includes(scannedCode));
      }
      listKey = 'finished_goods';
    } else if (department === 'COMBO') {
      const comboBarcodes = this.getList('combo_barcodes');
      record = comboBarcodes.find((item: any) => getMasterBarcode(item) === scannedCode);
      if (!record) {
        record = comboBarcodes.find((item: any) => [item.displayBarcode, item.barcodeNumber, item.barcode, item.code, item.serial_number, item.barcode_no, item.batchNo, item.id].map(x => normalizeBarcode(x)).includes(scannedCode));
      }
      listKey = 'combo_barcodes';
    }

    if (!record) {
       console.error("FAILED SCAN. SCANNED CODE:", scannedCode, "DEPARTMENT:", department);
       if (department === 'RAW_MATERIAL') console.log("AVAILABLE IN DB:", this.getList('inventory_batches').map(b => getMasterBarcode(b)));
       throw new Error(\`Barcode \${barcodeNumber} does not exist in \${department === 'RAW_MATERIAL' ? 'Raw Materials' : department === 'PRODUCT' ? 'Products' : 'Combos'}.\`);
    }

    const currentStage = record.currentStage || 'READY_FOR_FIRST_SCAN';
    let nextStage = '';
    let successMessage = '';

    if (department === 'RAW_MATERIAL') {
      if (scanAction === 'IN') {
        if (currentStage === 'READY_FOR_FIRST_SCAN') {
          nextStage = 'RAW_MATERIAL_IN';
          successMessage = 'Raw material received into Inventory IN.';
        } else {
          throw new Error('Already scanned to Inventory IN. Go to Inventory OUT to release.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'RAW_MATERIAL_IN') {
          nextStage = 'RAW_MATERIAL_OUT';
          successMessage = 'Raw material moved to Inventory OUT (Ready for Production).';
          await this.handleInventoryOutHandoff(record, 'RAW_MATERIAL');
        } else if (currentStage === 'RAW_MATERIAL_OUT') {
          throw new Error('Already scanned to Inventory OUT / Released to Product.');
        } else {
          throw new Error('Scan to Inventory IN first.');
        }
      }
    } else if (department === 'PRODUCT') {
      if (scanAction === 'IN') {
        if (currentStage === 'READY_FOR_FIRST_SCAN') {
          nextStage = 'PRODUCT_IN';
          successMessage = 'Product received into Product Inventory IN.';
        } else {
          throw new Error('Already scanned to Product Inventory IN.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'PRODUCT_IN') {
          nextStage = 'PRODUCT_OUT';
          successMessage = 'Product reserved for Combo (Inventory OUT).';
          await this.handleInventoryOutHandoff(record, 'PRODUCT');
        } else if (currentStage === 'PRODUCT_OUT' || currentStage === 'PACKED_IN_COMBO') {
          throw new Error('Already released to Combo.');
        } else {
          throw new Error('Scan to Inventory IN first.');
        }
      } else if (scanAction === 'PACK') {
        if (currentStage === 'PRODUCT_OUT') {
          const comboDraftId = payload?.selectedComboDraftId || record.reservedDraftId;
          if (!comboDraftId) throw new Error('Please select a combo draft before packing.');
          nextStage = 'PACKED_IN_COMBO';
          record.packedComboId = comboDraftId;
          successMessage = \`Product packed inside Combo \${comboDraftId}.\`;
        } else if (currentStage === 'PACKED_IN_COMBO') {
          throw new Error('Already packed in combo.');
        } else {
          throw new Error('Must be released to Inventory OUT before packing.');
        }
      }
    } else if (department === 'COMBO') {
      if (scanAction === 'IN') {
        if (currentStage === 'READY_FOR_FIRST_SCAN') {
          nextStage = 'COMBO_IN';
          successMessage = 'Combo received into Combo Inventory IN.';
        } else {
          throw new Error('Already scanned to Combo Inventory IN.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'COMBO_IN') {
          nextStage = 'COMBO_OUT';
          successMessage = 'Combo moved to Inventory OUT (Ready for Dispatch).';
          await this.handleInventoryOutHandoff(record, 'COMBO');
        } else if (currentStage === 'COMBO_OUT' || currentStage === 'DISPATCHED') {
          throw new Error('Already moved out.');
        } else {
          throw new Error('Scan to Inventory IN first.');
        }
      }
    }

    record.currentStage = nextStage;
    record.scanCount = (record.scanCount || 0) + 1;
    if (nextStage.endsWith('_IN')) record.inventoryInTime = now;
    if (nextStage.endsWith('_OUT')) record.inventoryOutTime = now;

    this.upsertBarcodeByNumber(listKey, record);

    await this.createInventoryTransfer({
      barcodeNumber: barcodeNumber,
      itemType: department,
      itemName: record.material_name || record.product_name || record.combo_name || 'Unknown',
      productId: record.id || record.productId,
      quantity: record.original_quantity || record.quantity || 1,
      unit: record.unit || 'KG',
      fromLocation: currentStage,
      toLocation: nextStage,
      reason: successMessage,
      action: 'SCAN',
      referenceId: record.batch_id || record.id
    });

    return { success: true, message: successMessage, stage: nextStage, item: record };
  }`;

if (content.match(processRegex)) {
  content = content.replace(processRegex, newProcessBlock);
  fs.writeFileSync(serviceFile, content);
  console.log('Fixed signature mismatch for processBarcodeScan');
} else {
  console.log('Could not find processBarcodeScan to replace');
}
