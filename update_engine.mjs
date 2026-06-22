import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

const regex = /async handleInventoryOutHandoff\(barcodeRecord: any, fromDepartment: 'RAW_MATERIAL' \| 'PRODUCT' \| 'COMBO'\) \{[\s\S]*?referenceId: `HANDOFF-\$\{now\}`\n    \}\);\n  \}/s;

const newCode = `async handleInventoryOutHandoff(barcodeRecord: any, fromDepartment: 'RAW_MATERIAL' | 'PRODUCT' | 'COMBO') {
    if (barcodeRecord.handoffCompleted) {
      console.warn("Handoff already completed for this barcode:", barcodeRecord);
      return;
    }

    const now = new Date().toISOString();
    let toLoc = '';

    if (fromDepartment === 'RAW_MATERIAL') {
      this.addRawMaterialReleasedToProduct({
        type: 'RAW_MATERIAL_RELEASED_TO_PRODUCT',
        sourceBarcode: barcodeRecord.serial_number || barcodeRecord.barcode_no,
        materialName: barcodeRecord.material_name || barcodeRecord.name,
        quantity: barcodeRecord.quantity || barcodeRecord.available_quantity || barcodeRecord.original_quantity || 0,
        unit: barcodeRecord.unit || 'kg',
        batch: barcodeRecord.batch_number || '',
        vendor: barcodeRecord.vendor_name || '',
        releasedAt: now
      });
      toLoc = 'PRODUCTION_AVAILABLE';
      barcodeRecord.handoffToDepartment = 'PRODUCTION';
    } else if (fromDepartment === 'PRODUCT') {
      this.addProductReleasedToCombo({
        type: 'PRODUCT_RELEASED_TO_COMBO',
        sourceBarcode: barcodeRecord.barcode_no || barcodeRecord.serial_number,
        productName: barcodeRecord.product_name || barcodeRecord.name,
        quantity: 1,
        unit: 'Unit',
        batch: barcodeRecord.production_batch_id || '',
        microBatch: barcodeRecord.micro_batch_id || '',
        releasedAt: now
      });
      toLoc = 'COMBO_AVAILABLE';
      barcodeRecord.handoffToDepartment = 'COMBO';
    } else if (fromDepartment === 'COMBO') {
      // User explicitly asked to remove dispatch logic for now
      /*
      this.addComboReleasedToDispatch({
        type: 'COMBO_RELEASED_TO_DISPATCH',
        sourceBarcode: barcodeRecord.barcode_no || barcodeRecord.batch_id,
        comboName: barcodeRecord.combo_name || barcodeRecord.name,
        releasedAt: now
      });
      */
      toLoc = 'DISPATCH_AVAILABLE';
      barcodeRecord.handoffToDepartment = 'DISPATCH';
    }

    barcodeRecord.handoffCompleted = true;

    // We no longer manually mutate legacy available_stock items.
    // The UI must read from getRawMaterialsReleasedToProduct() or getProductsReleasedToCombo()
  }`;

if (serviceContent.match(regex)) {
  serviceContent = serviceContent.replace(regex, newCode);
  fs.writeFileSync(serviceFile, serviceContent);
  console.log('Successfully updated handleInventoryOutHandoff');
} else {
  console.log('Regex did not match');
}
