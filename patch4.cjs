const fs = require('fs');
const file = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(file, 'utf8');

const newMethod = `  async verifyAndCompleteMicroBatchScan(micro_batch_id: string): Promise<boolean> {
    const barcodes = this.getList('finished_product_barcodes').filter((b: any) => b.micro_batch_id === micro_batch_id);
    if (barcodes.length === 0) return false;

    const allScanned = barcodes.every((b: any) => b.scan_status === 'SCANNED');
    if (!allScanned) return false;

    const mbList = this.getList('micro_batches');
    const mbIdx = mbList.findIndex((m: any) => m.id === micro_batch_id);
    if (mbIdx === -1) return false;

    const mb = mbList[mbIdx];
    if (mb.status === 'Passed') return true; 

    mb.status = 'Passed';
    mb.barcode_saved = true;
    mb.completed_at = new Date().toISOString();
    this.saveList('micro_batches', mbList);

    const pbList = this.getList('production_batches');
    const pbIdx = pbList.findIndex((p: any) => p.id === mb.production_batch_id);
    if (pbIdx !== -1) {
      const pb = pbList[pbIdx];
      pb.completed_micro_batches = (pb.completed_micro_batches || 0) + 1;
      pb.produced_units = (pb.produced_units || 0) + mb.units;
      pb.inventory_units = (pb.inventory_units || 0) + mb.units;
      if (pb.completed_micro_batches >= pb.total_micro_batches) {
        pb.status = 'Complete';
      }
      this.saveList('production_batches', pbList);

      const fgList = this.getList('finished_goods');
      const sample = barcodes[0];
      fgList.push({
        id: crypto.randomUUID(),
        product_code: sample.product_code,
        product_name: sample.product_name,
        production_batch_id: pb.id,
        micro_batch_id: mb.id,
        total_units: mb.units,
        available_units: mb.units,
        used_units: 0,
        status: 'READY',
        scanned_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      this.saveList('finished_goods', fgList);
    }
    return true;
  }

  async saveProductBarcodes`;

content = content.replace('  async saveProductBarcodes', newMethod);
fs.writeFileSync(file, content);
console.log('Added verifyAndCompleteMicroBatchScan');
