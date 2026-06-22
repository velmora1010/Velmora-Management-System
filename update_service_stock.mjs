import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(serviceFile, 'utf8');

const newMethod = `getReleasedRawMaterialStock() {
    const released = this.getRawMaterialsReleasedToProduct();
    const normalize = (name: string) => String(name || "").trim().toLowerCase();
    
    const stock: any = {};
    
    released.forEach((item: any) => {
      const key = normalize(item.materialName || item.name || item.itemName || item.material);
      const qty = Number(item.quantity || item.availableKg || item.available || 0);
      if (!key || qty <= 0) return;
      stock[key] = (stock[key] || 0) + qty;
    });

    let consumed = {};
    if (this.getProductionConsumedStock) {
      consumed = this.getProductionConsumedStock();
    }

    Object.keys(consumed).forEach((key) => {
      stock[key] = Number(stock[key] || 0) - Number((consumed as any)[key] || 0);
    });

    return stock;
  }`;

if (!content.includes('getReleasedRawMaterialStock() {')) {
  // Insert it below getRawMaterialsReleasedToProduct()
  const insertRegex = /getRawMaterialsReleasedToProduct\(\) \{\s*return this\.getList\('raw_material_released_to_product'\);\s*\}/;
  content = content.replace(insertRegex, `getRawMaterialsReleasedToProduct() {
    return this.getList('raw_material_released_to_product');
  }\n\n  ${newMethod}`);
  fs.writeFileSync(serviceFile, content);
  console.log("Added getReleasedRawMaterialStock");
} else {
  console.log("Already exists");
}
