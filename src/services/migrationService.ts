import { supabase } from '../lib/supabase';

export interface MigrationReport {
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export const getLocalCounts = () => {
  return {
    rawMaterials: JSON.parse(localStorage.getItem('raw_material_barcodes') || '[]').length,
    products: JSON.parse(localStorage.getItem('finished_product_barcodes') || '[]').length,
    comboBoxes: JSON.parse(localStorage.getItem('combo_boxes') || '[]').length,
    qcBarcodes: JSON.parse(localStorage.getItem('quality_check_barcodes') || '[]').length,
  };
};

export const getSupabaseCounts = async () => {
  const [raw, prod, combo, qc] = await Promise.all([
    supabase.from('raw_material_barcodes').select('*', { count: 'exact', head: true }),
    supabase.from('product_barcodes').select('*', { count: 'exact', head: true }),
    supabase.from('combo_boxes').select('*', { count: 'exact', head: true }),
    supabase.from('qc_barcodes').select('*', { count: 'exact', head: true }),
  ]);

  return {
    rawMaterials: raw.count || 0,
    products: prod.count || 0,
    comboBoxes: combo.count || 0,
    qcBarcodes: qc.count || 0,
  };
};

export const migrateRawMaterials = async (): Promise<MigrationReport> => {
  const items = JSON.parse(localStorage.getItem('raw_material_barcodes') || '[]');
  const report: MigrationReport = { migrated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of items) {
    try {
      const barcodeValue = item.barcodeNumber || item.displayBarcode || item.barcode || item.code || item.id;
      if (!barcodeValue) {
        report.failed++;
        report.errors.push(`Missing barcode for RM: ${JSON.stringify(item)}`);
        continue;
      }
      
      const { data: existing } = await supabase
        .from('raw_material_barcodes')
        .select('barcode')
        .eq('barcode', barcodeValue)
        .limit(1);

      if (existing && existing.length > 0) {
        report.skipped++;
        continue;
      }

      // We preserve the full item payload in Supabase, but add explicitly mapped fields based on user request.
      const payload = {
        ...item,
        barcode: barcodeValue
      };

      const { error } = await supabase.from('raw_material_barcodes').insert(payload);
      if (error) throw error;
      report.migrated++;
    } catch (err: any) {
      report.failed++;
      report.errors.push(err.message);
    }
  }
  return report;
};

export const migrateProducts = async (): Promise<MigrationReport> => {
  const items = JSON.parse(localStorage.getItem('finished_product_barcodes') || '[]');
  const report: MigrationReport = { migrated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of items) {
    try {
      const barcodeValue = item.barcodeNumber || item.displayBarcode || item.barcode || item.code || item.id;
      if (!barcodeValue) {
        report.failed++;
        report.errors.push(`Missing barcode for Product: ${JSON.stringify(item)}`);
        continue;
      }
      
      const { data: existing } = await supabase
        .from('product_barcodes')
        .select('barcode')
        .eq('barcode', barcodeValue)
        .limit(1);

      if (existing && existing.length > 0) {
        report.skipped++;
        continue;
      }

      const payload = {
        ...item,
        barcode: barcodeValue
      };

      const { error } = await supabase.from('product_barcodes').insert(payload);
      if (error) throw error;
      report.migrated++;
    } catch (err: any) {
      report.failed++;
      report.errors.push(err.message);
    }
  }
  return report;
};

export const migrateComboBoxes = async (): Promise<MigrationReport> => {
  const items = JSON.parse(localStorage.getItem('combo_boxes') || '[]');
  const report: MigrationReport = { migrated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of items) {
    try {
      const barcodeValue = item.comboBoxBarcode || item.displayBarcode || item.barcodeNumber || item.id;
      if (!barcodeValue) {
        report.failed++;
        report.errors.push(`Missing combo barcode for Combo: ${JSON.stringify(item)}`);
        continue;
      }
      
      const { data: existing } = await supabase
        .from('combo_boxes')
        .select('combo_box_barcode')
        .eq('combo_box_barcode', barcodeValue)
        .limit(1);

      if (existing && existing.length > 0) {
        report.skipped++;
        continue;
      }

      const payload = {
        ...item,
        combo_box_barcode: barcodeValue
      };

      const { error } = await supabase.from('combo_boxes').insert(payload);
      if (error) throw error;
      report.migrated++;
    } catch (err: any) {
      report.failed++;
      report.errors.push(err.message);
    }
  }
  return report;
};

export const migrateQCBarcodes = async (): Promise<MigrationReport> => {
  const items = JSON.parse(localStorage.getItem('quality_check_barcodes') || '[]');
  const report: MigrationReport = { migrated: 0, skipped: 0, failed: 0, errors: [] };

  for (const item of items) {
    try {
      const barcodeValue = item.qcBarcode || item.displayBarcode || item.barcodeNumber || item.id;
      if (!barcodeValue) {
        report.failed++;
        report.errors.push(`Missing qc barcode for QC: ${JSON.stringify(item)}`);
        continue;
      }
      
      const { data: existing } = await supabase
        .from('qc_barcodes')
        .select('qc_barcode')
        .eq('qc_barcode', barcodeValue)
        .limit(1);

      if (existing && existing.length > 0) {
        report.skipped++;
        continue;
      }

      const payload = {
        ...item,
        qc_barcode: barcodeValue
      };

      const { error } = await supabase.from('qc_barcodes').insert(payload);
      if (error) throw error;
      report.migrated++;
    } catch (err: any) {
      report.failed++;
      report.errors.push(err.message);
    }
  }
  return report;
};
