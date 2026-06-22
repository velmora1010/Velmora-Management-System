import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

const handoffMethods = `

  // ==========================================
  // DEPARTMENT HANDOFF RECORDS
  // ==========================================

  getRawMaterialsReleasedToProduct() {
    return this.getList('raw_material_released_to_product');
  }

  addRawMaterialReleasedToProduct(record: any) {
    const list = this.getRawMaterialsReleasedToProduct();
    if (!list.find((r: any) => r.sourceBarcode === record.sourceBarcode)) {
      list.push(record);
      this.saveList('raw_material_released_to_product', list);
    }
  }

  getProductsReleasedToCombo() {
    return this.getList('product_released_to_combo');
  }

  addProductReleasedToCombo(record: any) {
    const list = this.getProductsReleasedToCombo();
    if (!list.find((r: any) => r.sourceBarcode === record.sourceBarcode)) {
      list.push(record);
      this.saveList('product_released_to_combo', list);
    }
  }

`;

if (!serviceContent.includes('getRawMaterialsReleasedToProduct')) {
  // Insert before processBarcodeScan
  const insertIndex = serviceContent.indexOf('async processBarcodeScan');
  if (insertIndex > -1) {
    serviceContent = serviceContent.substring(0, insertIndex) + handoffMethods + serviceContent.substring(insertIndex);
    fs.writeFileSync(serviceFile, serviceContent);
    console.log("Added handoff collections methods.");
  } else {
    console.log("Could not find processBarcodeScan");
  }
} else {
  console.log("Handoff methods already exist.");
}
