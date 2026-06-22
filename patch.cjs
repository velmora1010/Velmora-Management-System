const fs = require('fs');
const file = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(file, 'utf8');

const newMethods = `  async getProductBarcodes(): Promise<any[]> {
    return this.getList('finished_product_barcodes').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async deleteProductBarcode(barcode_no: string): Promise<boolean> {
    let list = this.getList('finished_product_barcodes');
    list = list.filter((item: any) => item.barcode_no !== barcode_no);
    this.saveList('finished_product_barcodes', list);
    return true;
  }

  async updateProductBarcodeStatus(barcode_no: string, status: string): Promise<boolean> {
    let list = this.getList('finished_product_barcodes');
    const idx = list.findIndex((item: any) => item.barcode_no === barcode_no);
    if (idx !== -1) {
      list[idx].scan_status = status;
      list[idx].scanned_at = new Date().toISOString();
      this.saveList('finished_product_barcodes', list);
    }
    return true;
  }

  async saveProductBarcodes`;

content = content.replace('  async saveProductBarcodes', newMethods);

fs.writeFileSync(file, content);
console.log('Updated localInventoryService.ts');
