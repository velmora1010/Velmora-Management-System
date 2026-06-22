import fs from 'fs';

// 1. Update localInventoryService.ts
const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

const processRegex = /async processBarcodeScan\([\s\S]*?async handleInventoryOutHandoff/s;

const newProcessBlock = `async processBarcodeScan(params: {
    barcodeNumber: string;
    department: 'RAW_MATERIAL' | 'PRODUCT' | 'COMBO';
    scanAction: 'IN' | 'OUT' | 'PACK';
    payload?: any;
  }): Promise<{ success: boolean; message: string; stage: string; item: any }> {
    const { barcodeNumber, department, scanAction, payload } = params;
    const now = new Date().toISOString();

    let record: any = null;
    let listKey = '';
    
    if (department === 'RAW_MATERIAL') {
      const batches = this.getList('inventory_batches');
      record = batches.find(b => b.serial_number === barcodeNumber || b.barcode_no === barcodeNumber);
      listKey = 'inventory_batches';
    } else if (department === 'PRODUCT') {
      const fgList = this.getList('finished_goods');
      record = fgList.find(b => b.barcode_no === barcodeNumber);
      listKey = 'finished_goods';
    } else if (department === 'COMBO') {
      const comboBarcodes = this.getList('combo_barcodes');
      record = comboBarcodes.find(b => b.barcode_no === barcodeNumber || b.batch_id === barcodeNumber);
      listKey = 'combo_barcodes';
    }

    if (!record) throw new Error(\`Barcode \${barcodeNumber} not found in \${department}.\`);

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

    // Enforce singleton upsert by barcode
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
  }

  async handleInventoryOutHandoff`;

if (serviceContent.match(processRegex)) {
  serviceContent = serviceContent.replace(processRegex, newProcessBlock);
  fs.writeFileSync(serviceFile, serviceContent);
}

// 2. Update ViewBarcodeList.tsx
const viewBarcodeFile = 'src/modules/inventory/view-barcode/ViewBarcodeList.tsx';
let viewBarcodeContent = fs.readFileSync(viewBarcodeFile, 'utf8');

const oldViewCall = /const result = await inventoryService\.processBarcodeScan\(cleanCode, activeTab\);/g;
const newViewCall = `let scanAction = 'IN';
        if (activeTab === 'RAW_MATERIAL') scanAction = (rawMaterialSubTab === 'OUT') ? 'OUT' : 'IN';
        if (activeTab === 'COMBO') scanAction = (comboSubTab === 'OUT') ? 'OUT' : 'IN';
        
        const result = await inventoryService.processBarcodeScan({
          barcodeNumber: cleanCode,
          department: activeTab,
          scanAction: scanAction as any
        });`;

if (viewBarcodeContent.match(oldViewCall)) {
  viewBarcodeContent = viewBarcodeContent.replace(oldViewCall, newViewCall);
  fs.writeFileSync(viewBarcodeFile, viewBarcodeContent);
}

// 3. Update ProductBarcodeList.tsx
const productFile = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let productContent = fs.readFileSync(productFile, 'utf8');

const oldProductCall = /const result = await inventoryService\.processBarcodeScan\(scannedCode, 'PRODUCT', payload\);/g;
const newProductCall = `let scanAction = 'IN';
      if (productSubTab === 'OUT') scanAction = 'OUT';
      if (productSubTab === 'PACKED') scanAction = 'PACK';

      const result = await inventoryService.processBarcodeScan({
        barcodeNumber: scannedCode,
        department: 'PRODUCT',
        scanAction: scanAction as any,
        payload
      });`;

if (productContent.match(oldProductCall)) {
  productContent = productContent.replace(oldProductCall, newProductCall);
  fs.writeFileSync(productFile, productContent);
}

console.log('Duplicate scan validation implemented in service and UI components.');
