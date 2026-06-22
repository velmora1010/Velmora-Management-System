import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(serviceFile, 'utf8');

// 1. Replace addRawMaterialReleasedToProduct
const oldRawAddBlock = /addRawMaterialReleasedToProduct\(record: any\) \{\s*const list = this\.getRawMaterialsReleasedToProduct\(\);\s*if \(\!list\.find\(\(r: any\) => r\.sourceBarcode === record\.sourceBarcode\)\) \{\s*this\.upsertBarcodeByNumber\('raw_material_released_to_product', record\);\s*\}\s*\}/s;

const newRawAddBlock = `addRawMaterialReleasedToProduct(record: any) {
    const list = this.getRawMaterialsReleasedToProduct();
    if (!list.find((r: any) => r.sourceBarcode === record.sourceBarcode)) {
      list.push(record);
      this.saveList('raw_material_released_to_product', list);
      console.log("ALL RAW RELEASED TO PRODUCT", this.getRawMaterialsReleasedToProduct());
    }
  }`;

if (content.match(oldRawAddBlock)) {
  content = content.replace(oldRawAddBlock, newRawAddBlock);
} else {
  console.log("Could not find addRawMaterialReleasedToProduct");
}

// 2. Replace addProductReleasedToCombo
const oldProductAddBlock = /addProductReleasedToCombo\(record: any\) \{\s*const list = this\.getProductsReleasedToCombo\(\);\s*if \(\!list\.find\(\(r: any\) => r\.sourceBarcode === record\.sourceBarcode\)\) \{\s*this\.upsertBarcodeByNumber\('product_released_to_combo', record\);\s*\}\s*\}/s;

const newProductAddBlock = `addProductReleasedToCombo(record: any) {
    const list = this.getProductsReleasedToCombo();
    if (!list.find((r: any) => r.sourceBarcode === record.sourceBarcode)) {
      list.push(record);
      this.saveList('product_released_to_combo', list);
    }
  }`;

if (content.match(oldProductAddBlock)) {
  content = content.replace(oldProductAddBlock, newProductAddBlock);
} else {
  console.log("Could not find addProductReleasedToCombo");
}

fs.writeFileSync(serviceFile, content);
console.log('Fixed handoff functions to explicitly append instead of overwrite.');
