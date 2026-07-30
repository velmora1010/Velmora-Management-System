import { mockInitialState } from '../data/mockInventoryData';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import toast from 'react-hot-toast';

export const getMasterBarcode = (item: any) => {
  return (
    item.displayBarcode ||
    item.barcodeNumber ||
    item.barcode ||
    item.code ||
    item.serial_number ||
    item.barcode_no ||
    item.barcodeValue ||
    item.batchNo ||
    item.id ||
    ""
  ).toString().trim().toUpperCase().replace(/\s+/g, "");
};

export const normalizeBarcode = (value: any) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");

export const getStagePriority = (stage: string) => {
  const priority: any = {
    READY_FOR_FIRST_SCAN: 0,
    RAW_MATERIAL_IN: 1,
    RAW_MATERIAL_OUT: 2,
    PRODUCT_IN: 1,
    PRODUCT_OUT: 2,
    PACKED_IN_COMBO: 3,
    COMBO_IN: 1,
    COMBO_OUT: 2
  };
  return priority[stage || "READY_FOR_FIRST_SCAN"] || 0;
};

export const dedupeBarcodes = (items: any[]) => {
  const map = new Map();

  items.forEach((item) => {
    const key = normalizeBarcode(item.barcodeNumber || item.barcode_no || item.serial_number || item.barcode || item.code || item.id);
    if (!key) return;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      return;
    }

    if (getStagePriority(item.currentStage) >= getStagePriority(existing.currentStage)) {
      map.set(key, {
        ...existing,
        ...item,
        currentStage: item.currentStage
      });
    }
  });

  return Array.from(map.values());
};

export const normalizeMaterialKey = (name: string) => String(name || "").trim().toLowerCase();

export const convertToStandardUnit = (qty: number, unit: string): number => {
  const u = String(unit || "KG").trim().toUpperCase();
  if (u === "G" || u === "GRAM" || u === "GRAMS") {
    return qty / 1000;
  }
  if (u === "ML" || u === "MILLILITER" || u === "MILLILITERS") {
    return qty / 1000;
  }
  return qty;
};

class LocalInventoryService {
  private dataSourceMode: 'local' | 'supabase' | 'hybrid' = 'supabase';

  constructor() {
    this.init();
  }

  private init() {
    this.initializeSystemSettings();
    this.autoMigrateLocalStorage();
  }

  private async initializeSystemSettings() {
    try {
      const keysToInit = [
        { key: 'inventory_materials', value: mockInitialState.inventory_materials },
        { key: 'combo_templates', value: mockInitialState.combo_templates }
      ];
      
      for (const item of keysToInit) {
        const { data, error } = await supabase
          .from('system_settings')
          .select('id')
          .eq('setting_key', item.key)
          .maybeSingle();
        
        if (!error && !data) {
          await supabase.from('system_settings').insert({
            setting_key: item.key,
            setting_value: item.value,
            description: `Default system config for ${item.key}`
          });
        }
      }
    } catch (err) {
      console.error('Error initializing system settings:', err);
    }
  }

  // --- Automatic One-Time Migration ---
  private async autoMigrateLocalStorage() {
    if (localStorage.getItem('supabase_inventory_migration_completed') === 'true') {
      return;
    }

    try {
      // 1. Raw Materials
      const rawMaterialsStr = localStorage.getItem('inventory_materials');
      if (rawMaterialsStr) {
        const rawMaterials = JSON.parse(rawMaterialsStr);
        if (Array.isArray(rawMaterials) && rawMaterials.length > 0) {
          const currentMaterials = await this.getMaterials();
          const merged = [...currentMaterials];
          for (const item of rawMaterials) {
            if (!merged.some(x => x.id === item.id || x.name.toLowerCase() === item.name.toLowerCase())) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('inventory_materials', merged);
        }
      }

      // 2. Raw Material Barcodes
      const rmBarcodesStr = localStorage.getItem('raw_material_barcodes') || localStorage.getItem('inventory_batches');
      if (rmBarcodesStr) {
        const rmBarcodes = JSON.parse(rmBarcodesStr);
        if (Array.isArray(rmBarcodes) && rmBarcodes.length > 0) {
          for (const item of rmBarcodes) {
            const barcodeValue = item.barcode || item.barcodeNumber || item.displayBarcode || item.serial_number;
            if (!barcodeValue) continue;

            const { data: existing, error: checkError } = await supabase
              .from(SUPABASE_TABLES.rawMaterialBarcodes)
              .select('id')
              .eq('barcode', barcodeValue)
              .maybeSingle();

            if (checkError) throw checkError;

            if (!existing) {
              const payload = {
                barcode: barcodeValue,
                material_name: item.materialName || item.material_name || '',
                batch_no: item.batchNo || item.batch_no || '',
                vendor: item.vendor || item.vendor_name || '',
                quantity: Number(item.quantity || item.original_quantity || item.available_quantity || 0),
                unit: String(item.unit || 'kg').toLowerCase(),
                price_per_kg: Number(item.price_per_kg || 0),
                gst_percent: Number(item.gst_percent || 0),
                generated_by: item.generated_by || 'Admin',
                inventory_in_person: item.inventory_in_person || null,
                inventory_out_person: item.inventory_out_person || null,
                inventory_in_at: item.inventory_in_at || null,
                inventory_out_at: item.inventory_out_at || null,
                current_stage: item.currentStage || item.current_stage || 'Incoming',
                created_at: item.created_at || new Date().toISOString(),
                updated_at: item.updated_at || new Date().toISOString(),
                po_reference: item.po_reference || null,
                scanning_person_name: item.scanning_person_name || item.scanningPersonName || null,
                notes: item.notes || null,
                received_date: item.received_date || item.date_received || new Date().toISOString()
              };
              const { error: insError } = await supabase.from(SUPABASE_TABLES.rawMaterialBarcodes).insert(payload);
              if (insError) throw insError;
            }
          }
        }
      }

      // 3. Product Barcodes
      const prodBarcodesStr = localStorage.getItem('finished_product_barcodes') || localStorage.getItem('product_barcodes');
      if (prodBarcodesStr) {
        const prodBarcodes = JSON.parse(prodBarcodesStr);
        if (Array.isArray(prodBarcodes) && prodBarcodes.length > 0) {
          for (const item of prodBarcodes) {
            const barcodeValue = item.barcode || item.barcode_no || item.barcodeNumber || item.displayBarcode;
            if (!barcodeValue) continue;

            const { data: existing, error: checkError } = await supabase
              .from(SUPABASE_TABLES.productBarcodes)
              .select('id')
              .eq('barcode', barcodeValue)
              .maybeSingle();

            if (checkError) throw checkError;

            if (!existing) {
              const payload = {
                barcode: barcodeValue,
                product_name: item.productName || item.product_name || '',
                product_code: item.productCode || item.product_code || '',
                batch_id: item.batchId || item.batch_id || '',
                micro_batch_no: item.microBatchNo || item.micro_batch_no || '',
                quantity: item.quantity || 1,
                unit: item.unit || 'Unit',
                produced_by: item.producedBy || item.produced_by || null,
                labeled_by: item.labeledBy || item.labeled_by || null,
                inventory_in_person: item.inventory_in_person || null,
                inventory_out_person: item.inventory_out_person || null,
                inventory_in_at: item.inventory_in_at || null,
                inventory_out_at: item.inventory_out_at || null,
                packed_combo_box_barcode: item.packedComboBoxBarcode || item.packed_combo_box_barcode || null,
                current_stage: item.currentStage || item.current_stage || 'Production',
                created_at: item.created_at || new Date().toISOString()
              };
              const { error: insError } = await supabase.from(SUPABASE_TABLES.productBarcodes).insert(payload);
              if (insError) throw insError;
            }
          }
        }
      }

      // 4. Combo Boxes
      const comboBoxesStr = localStorage.getItem('combo_boxes');
      if (comboBoxesStr) {
        const comboBoxes = JSON.parse(comboBoxesStr);
        if (Array.isArray(comboBoxes) && comboBoxes.length > 0) {
          for (const item of comboBoxes) {
            const barcodeValue = item.comboBoxBarcode || item.combo_box_barcode;
            if (!barcodeValue) continue;

            const { data: existing, error: checkError } = await supabase
              .from(SUPABASE_TABLES.comboBoxes)
              .select('id')
              .eq('combo_box_barcode', barcodeValue)
              .maybeSingle();

            if (checkError) throw checkError;

            if (!existing) {
              const payload = {
                combo_box_barcode: barcodeValue,
                combo_name: item.comboName || item.combo_name || '',
                combo_type: item.comboType || item.combo_type || '',
                generated_by: item.generated_by || null,
                generated_at: item.generated_at || null,
                inventory_in_person: item.inventory_in_person || null,
                inventory_out_person: item.inventory_out_person || null,
                inventory_in_at: item.inventory_in_at || null,
                inventory_out_at: item.inventory_out_at || null,
                packed_items: item.packedItems || item.packed_items || [],
                status: item.status || 'EMPTY',
                current_stage: item.currentStage || item.current_stage || 'Packed',
                created_at: item.created_at || new Date().toISOString()
              };
              const { error: insError } = await supabase.from(SUPABASE_TABLES.comboBoxes).insert(payload);
              if (insError) throw insError;
            }
          }
        }
      }

      // 5. QC Barcodes
      const qcBarcodesStr = localStorage.getItem('quality_check_barcodes') || localStorage.getItem('qc_barcodes');
      if (qcBarcodesStr) {
        const qcBarcodes = JSON.parse(qcBarcodesStr);
        if (Array.isArray(qcBarcodes) && qcBarcodes.length > 0) {
          for (const item of qcBarcodes) {
            const barcodeValue = item.qcBarcode || item.qc_barcode;
            if (!barcodeValue) continue;

            const { data: existing, error: checkError } = await supabase
              .from(SUPABASE_TABLES.qcBarcodes)
              .select('id')
              .eq('qc_barcode', barcodeValue)
              .maybeSingle();

            if (checkError) throw checkError;

            if (!existing) {
              const payload = {
                qc_barcode: barcodeValue,
                product_name: item.productName || item.product_name || '',
                product_code: item.productCode || item.product_code || '',
                batch_id: item.batchId || item.batch_id || '',
                micro_batch_no: item.microBatchNo || item.micro_batch_no || '',
                total_units: item.totalUnits || item.total_units || 0,
                produced_by: item.producedBy || item.produced_by || null,
                labeled_by: item.labeledBy || item.labeled_by || null,
                product_barcodes: item.productBarcodes || item.product_barcodes || [],
                qc_in_person: item.qcInPerson || item.qc_in_person || null,
                qc_in_at: item.qcInAt || item.qc_in_at || null,
                current_stage: item.currentStage || item.current_stage || 'QC',
                created_at: item.created_at || new Date().toISOString()
              };
              const { error: insError } = await supabase.from(SUPABASE_TABLES.qcBarcodes).insert(payload);
              if (insError) throw insError;
            }
          }
        }
      }

      // 6. Production Batches
      const prodBatchesStr = localStorage.getItem('inventory_production') || localStorage.getItem('production_batches');
      if (prodBatchesStr) {
        const prodBatches = JSON.parse(prodBatchesStr);
        if (Array.isArray(prodBatches) && prodBatches.length > 0) {
          for (const item of prodBatches) {
            const batchId = item.batchId || item.batch_id;
            if (!batchId) continue;

            const { data: existing, error: checkError } = await supabase
              .from(SUPABASE_TABLES.productionBatches)
              .select('id')
              .eq('batch_id', batchId)
              .maybeSingle();

            if (checkError) throw checkError;

            if (!existing) {
              const payload = {
                batch_id: batchId,
                product_name: item.productName || item.product_name || '',
                product_code: item.productCode || item.product_code || '',
                batch_size: item.batchSize || item.batch_size || 0,
                total_micro_batches: item.totalMicroBatches || item.total_micro_batches || 0,
                produced_by: item.producedBy || item.produced_by || 'Admin',
                status: item.status || 'Saved',
                created_at: item.createdAt || item.created_at || new Date().toISOString(),
                completed_at: item.completedAt || item.completed_at || null
              };
              const { error: insError } = await supabase.from(SUPABASE_TABLES.productionBatches).insert(payload);
              if (insError) throw insError;
            }
          }
        }
      }

      // 7. Micro Batches
      const microBatchesStr = localStorage.getItem('production_micro_batches');
      if (microBatchesStr) {
        const microBatches = JSON.parse(microBatchesStr);
        if (Array.isArray(microBatches) && microBatches.length > 0) {
          const currentMicro = await this.getSettingsList('production_micro_batches');
          const merged = [...currentMicro];
          for (const item of microBatches) {
            if (!merged.some(x => x.id === item.id || x.microBatchNo === item.microBatchNo)) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('production_micro_batches', merged);
        }
      }

      // 8. Ingredients
      const ingredientsStr = localStorage.getItem('production_ingredients');
      if (ingredientsStr) {
        const ingredients = JSON.parse(ingredientsStr);
        if (Array.isArray(ingredients) && ingredients.length > 0) {
          const currentIng = await this.getSettingsList('production_ingredients');
          const merged = [...currentIng];
          for (const item of ingredients) {
            if (!merged.some(x => x.id === item.id)) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('production_ingredients', merged);
        }
      }

      // 9. Combo Drafts
      const comboDraftsStr = localStorage.getItem('combo_drafts');
      if (comboDraftsStr) {
        const comboDrafts = JSON.parse(comboDraftsStr);
        if (Array.isArray(comboDrafts) && comboDrafts.length > 0) {
          const currentDrafts = await this.getSettingsList('combo_drafts');
          const merged = [...currentDrafts];
          for (const item of comboDrafts) {
            if (!merged.some(x => x.comboDraftId === item.comboDraftId)) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('combo_drafts', merged);
        }
      }

      // 10. Combo Batches
      const comboBatchesStr = localStorage.getItem('combo_batches');
      if (comboBatchesStr) {
        const comboBatches = JSON.parse(comboBatchesStr);
        if (Array.isArray(comboBatches) && comboBatches.length > 0) {
          const currentBatches = await this.getSettingsList('combo_batches');
          const merged = [...currentBatches];
          for (const item of comboBatches) {
            if (!merged.some(x => x.id === item.id)) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('combo_batches', merged);
        }
      }

      // 11. Combo Inventory
      const comboInvStr = localStorage.getItem('combo_inventory');
      if (comboInvStr) {
        const comboInv = JSON.parse(comboInvStr);
        if (Array.isArray(comboInv) && comboInv.length > 0) {
          const currentInv = await this.getSettingsList('combo_inventory');
          const merged = [...currentInv];
          for (const item of comboInv) {
            if (!merged.some(x => x.id === item.id)) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('combo_inventory', merged);
        }
      }

      // 12. Combo Movements
      const comboMovementsStr = localStorage.getItem('combo_movements');
      if (comboMovementsStr) {
        const comboMovements = JSON.parse(comboMovementsStr);
        if (Array.isArray(comboMovements) && comboMovements.length > 0) {
          const currentMovements = await this.getSettingsList('combo_movements');
          const merged = [...currentMovements];
          for (const item of comboMovements) {
            if (!merged.some(x => x.id === item.id)) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('combo_movements', merged);
        }
      }

      // 13. Audit Log
      const auditLogStr = localStorage.getItem('inventory_audit_log');
      if (auditLogStr) {
        const auditLog = JSON.parse(auditLogStr);
        if (Array.isArray(auditLog) && auditLog.length > 0) {
          const currentLogs = await this.getSettingsList('inventory_audit_log');
          const merged = [...currentLogs];
          for (const item of auditLog) {
            if (!merged.some(x => x.id === item.id)) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('inventory_audit_log', merged);
        }
      }

      // 14. Ledger
      const ledgerStr = localStorage.getItem('inventory_ledger');
      if (ledgerStr) {
        const ledger = JSON.parse(ledgerStr);
        if (Array.isArray(ledger) && ledger.length > 0) {
          const currentLedger = await this.getSettingsList('inventory_ledger');
          const merged = [...currentLedger];
          for (const item of ledger) {
            if (!merged.some(x => x.id === item.id)) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('inventory_ledger', merged);
        }
      }

      // 15. Scan History
      const scanHistoryStr = localStorage.getItem('inventory_scan_history');
      if (scanHistoryStr) {
        const scanHistory = JSON.parse(scanHistoryStr);
        if (Array.isArray(scanHistory) && scanHistory.length > 0) {
          const currentHist = await this.getSettingsList('inventory_scan_history');
          const merged = [...currentHist];
          for (const item of scanHistory) {
            if (!merged.some(x => x.id === item.id)) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('inventory_scan_history', merged);
        }
      }

      // 16. Transactions
      const transactionsStr = localStorage.getItem('inventory_transactions');
      if (transactionsStr) {
        const transactions = JSON.parse(transactionsStr);
        if (Array.isArray(transactions) && transactions.length > 0) {
          const currentTx = await this.getSettingsList('inventory_transactions');
          const merged = [...currentTx];
          for (const item of transactions) {
            if (!merged.some(x => x.id === item.id)) {
              merged.push(item);
            }
          }
          await this.saveSettingsList('inventory_transactions', merged);
        }
      }

      localStorage.setItem('supabase_inventory_migration_completed', 'true');
      console.log('Safe automatic migration from LocalStorage to Supabase completed successfully!');
    } catch (err) {
      console.error('Error during auto compatibility migration:', err);
    }
  }

  // --- Helper Settings Methods ---
  private async getSettingsList(key: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle();
    
    if (error) {
      toast.error(`Database error loading ${key}: ${error.message}`);
      throw error;
    }
    
    if (data && data.setting_value) {
      return Array.isArray(data.setting_value) ? data.setting_value : [];
    }
    
    return [];
  }

  private async saveSettingsList(key: string, data: any[]): Promise<void> {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        setting_key: key,
        setting_value: data,
        description: `Inventory list for ${key}`
      }, { onConflict: 'setting_key' });
    
    if (error) {
      toast.error(`Failed to save setting ${key} to database: ` + error.message);
      throw error;
    }
  }

  setDataSourceMode(mode: 'local' | 'supabase' | 'hybrid') {
    this.dataSourceMode = mode;
  }

  getDataSourceMode() {
    return this.dataSourceMode;
  }
  
  repairDuplicateBarcodes(collectionKey: string) {
    return [];
  }

  upsertBarcodeByNumber(collectionKey: string, updatedBarcode: any) {
    return [];
  }

  repairBarcodeValues(collectionKey: string) {
  }

  // ---- NEW SUPABASE HYBRID GETTERS ----

  async getRawMaterialBarcodes(): Promise<any[]> {
    const { data, error } = await supabase.from(SUPABASE_TABLES.rawMaterialBarcodes).select('*');
    if (error) {
      toast.error('Failed to load raw material barcodes: ' + error.message);
      throw error;
    }
    return (data || []).map((item: any) => ({
      ...item,
      barcodeNumber: item.barcode,
      displayBarcode: item.barcode,
      materialName: item.material_name,
      batchNo: item.batch_no,
      currentStage: item.current_stage
    }));
  }

  async getRawMaterialBarcodesFromSupabase(): Promise<any[]> {
    return this.getRawMaterialBarcodes();
  }

  async getRawMaterialBarcodesHybrid(): Promise<any[]> {
    return this.getRawMaterialBarcodes();
  }

  async getProductBarcodesFromSupabase(): Promise<any[]> {
    return this.getProductBarcodes();
  }

  async getProductBarcodesHybrid(): Promise<any[]> {
    return this.getProductBarcodes();
  }

  async getComboBoxesFromSupabase(): Promise<any[]> {
    return this.getComboBoxes();
  }

  async getComboBoxesHybrid(): Promise<any[]> {
    return this.getComboBoxes();
  }

  async getQCBarcodesFromSupabase(): Promise<any[]> {
    return this.getQCBarcodes();
  }

  async getQCBarcodesHybrid(): Promise<any[]> {
    return this.getQCBarcodes();
  }

  // ---- MATERIALS ----
  async getMaterials() {
    return this.getSettingsList('inventory_materials');
  }

  async saveMaterial(material: any) {
    const list = await this.getMaterials();
    const payload = { ...material, id: material.id || crypto.randomUUID() };
    list.push(payload);
    await this.saveSettingsList('inventory_materials', list);
  }

  async updateMaterial(id: string, updates: any) {
    const list = await this.getMaterials();
    const idx = list.findIndex(x => x.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      await this.saveSettingsList('inventory_materials', list);
    }
  }

  // ---- BATCHES / BARCODES ----
  async getBatches() {
    const { data, error } = await supabase.from(SUPABASE_TABLES.rawMaterialBarcodes).select('*');
    if (error) {
      toast.error('Failed to load raw material batches: ' + error.message);
      throw error;
    }
    return (data || []).map((item: any) => ({
      ...item,
      serial_number: item.barcode,
      barcodeNumber: item.barcode,
      displayBarcode: item.barcode,
      materialName: item.material_name,
      material_name: item.material_name,
      batchNo: item.batch_no,
      batch_id: item.batch_no,
      currentStage: item.current_stage || 'Incoming',
      original_quantity: item.quantity,
      vendor_name: item.vendor
    }));
  }

  async saveBatch(batch: any) {
    const payload = {
      id: batch.id || crypto.randomUUID(),
      barcode: batch.barcodeNumber || batch.barcode || batch.serial_number || batch.code || batch.id,
      material_name: batch.materialName || batch.material_name || '',
      batch_no: batch.batchNo || batch.batch_no || '',
      vendor: batch.vendor || batch.vendor_name || '',
      quantity: Number(batch.quantity || batch.original_quantity || batch.available_quantity || 0),
      unit: String(batch.unit || 'kg').toLowerCase(),
      price_per_kg: Number(batch.price_per_kg || 0),
      gst_percent: Number(batch.gst_percent || 0),
      generated_by: batch.generated_by || 'Admin',
      inventory_in_person: batch.inventory_in_person || null,
      inventory_out_person: batch.inventory_out_person || null,
      inventory_in_at: batch.inventory_in_at || null,
      inventory_out_at: batch.inventory_out_at || null,
      current_stage: batch.currentStage || batch.current_stage || 'Incoming',
      created_at: batch.created_at || batch.createdAt || new Date().toISOString(),
      updated_at: batch.updated_at || new Date().toISOString(),
      po_reference: batch.po_reference || null,
      scanning_person_name: batch.scanning_person_name || batch.scanningPersonName || null,
      notes: batch.notes || null,
      received_date: batch.received_date || batch.date_received || new Date().toISOString()
    };
    const { error } = await supabase.from(SUPABASE_TABLES.rawMaterialBarcodes).insert(payload);
    if (error) {
      toast.error('Failed to save batch: ' + error.message);
      throw error;
    }
  }

  async saveBatches(batches: any[]) {
    const payloads = batches.map(batch => ({
      id: batch.id || crypto.randomUUID(),
      barcode: batch.barcodeNumber || batch.barcode || batch.serial_number || batch.code || batch.id,
      material_name: batch.materialName || batch.material_name || '',
      batch_no: batch.batchNo || batch.batch_no || '',
      vendor: batch.vendor || batch.vendor_name || '',
      quantity: Number(batch.quantity || batch.original_quantity || batch.available_quantity || 0),
      unit: String(batch.unit || 'kg').toLowerCase(),
      price_per_kg: Number(batch.price_per_kg || 0),
      gst_percent: Number(batch.gst_percent || 0),
      generated_by: batch.generated_by || 'Admin',
      inventory_in_person: batch.inventory_in_person || null,
      inventory_out_person: batch.inventory_out_person || null,
      inventory_in_at: batch.inventory_in_at || null,
      inventory_out_at: batch.inventory_out_at || null,
      current_stage: batch.currentStage || batch.current_stage || 'Incoming',
      created_at: batch.created_at || batch.createdAt || new Date().toISOString(),
      updated_at: batch.updated_at || new Date().toISOString(),
      po_reference: batch.po_reference || null,
      scanning_person_name: batch.scanning_person_name || batch.scanningPersonName || null,
      notes: batch.notes || null,
      received_date: batch.received_date || batch.date_received || new Date().toISOString()
    }));
    const { error } = await supabase.from(SUPABASE_TABLES.rawMaterialBarcodes).insert(payloads);
    if (error) {
      toast.error('Failed to save batches: ' + error.message);
      throw error;
    }
  }

  async updateBatch(id: string, updates: any) {
    const payload: any = {};
    if (updates.materialName !== undefined || updates.material_name !== undefined) payload.material_name = updates.materialName || updates.material_name;
    if (updates.batchNo !== undefined || updates.batch_no !== undefined) payload.batch_no = updates.batchNo || updates.batch_no;
    if (updates.vendor !== undefined) payload.vendor = updates.vendor;
    if (updates.quantity !== undefined) payload.quantity = updates.quantity;
    if (updates.unit !== undefined) payload.unit = updates.unit;
    if (updates.price_per_kg !== undefined) payload.price_per_kg = updates.price_per_kg;
    if (updates.gst_percent !== undefined) payload.gst_percent = updates.gst_percent;
    if (updates.currentStage !== undefined || updates.current_stage !== undefined) payload.current_stage = updates.currentStage || updates.current_stage;
    if (updates.inventory_in_person !== undefined) payload.inventory_in_person = updates.inventory_in_person;
    if (updates.inventory_out_person !== undefined) payload.inventory_out_person = updates.inventory_out_person;
    if (updates.inventory_in_at !== undefined) payload.inventory_in_at = updates.inventory_in_at;
    if (updates.inventory_out_at !== undefined) payload.inventory_out_at = updates.inventory_out_at;

    const { error } = await supabase
      .from(SUPABASE_TABLES.rawMaterialBarcodes)
      .update(payload)
      .or(`id.eq.${id},barcode.eq.${id}`);
    if (error) {
      toast.error('Failed to update batch: ' + error.message);
      throw error;
    }
  }

  async getBarcodes() {
    return this.getBatches();
  }

  async saveBarcode(batchId: string, updates: any) {
    return this.updateBatch(batchId, updates);
  }

  // ---- RAW MATERIAL INTAKE SPECIFIC ----
  async saveRawMaterialIntake(inventoryInRecord: any, batchesData: any[]) {
    const invId = crypto.randomUUID();
    const invInList = await this.getSettingsList('inventory_in');
    invInList.push({ ...inventoryInRecord, id: invId });
    await this.saveSettingsList('inventory_in', invInList);

    const newBatches = batchesData.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      inventory_in_id: invId,
      created_at: new Date().toISOString()
    }));
    
    await this.saveBatches(newBatches);
    return newBatches.map(b => b.id);
  }

  async getInventoryIn() {
    return this.getSettingsList('inventory_in');
  }

  // ---- PRODUCTION ----
  async getProductionBatches() {
    const { data, error } = await supabase.from(SUPABASE_TABLES.productionBatches).select('*');
    if (error) {
      toast.error('Failed to load production batches: ' + error.message);
      throw error;
    }
    const batches = data || [];
    let updated = false;

    const microBatches = await this.getMicroBatches();
    for (const batch of batches) {
      if (batch.status !== 'COMPLETE' && batch.status !== 'Complete' && batch.status !== 'Saved' && batch.status !== 'DELETED') {
        const mbs = microBatches.filter((m: any) => m.production_batch_id === batch.batch_id || m.production_batch_id === batch.id);
        if (mbs.length > 0 && mbs.length >= (batch.total_micro_batches || 0)) {
          const isComplete = mbs.every((mb: any) => ["PASSED", "FAILED", "BARCODE_SAVED", "COMPLETED"].includes(mb.status));
          if (isComplete) {
            batch.status = "COMPLETE";
            if (!batch.completed_at) batch.completed_at = new Date().toISOString();
            updated = true;
            await supabase.from(SUPABASE_TABLES.productionBatches).update({ status: 'COMPLETE', completed_at: batch.completed_at }).eq('id', batch.id);
          }
        }
      }
    }

    return batches.map((b: any) => ({
      ...b,
      batch_id: b.batch_id,
      productName: b.product_name,
      productCode: b.product_code,
      batchSize: Number(b.batch_size || 0),
      total_units: Number(b.batch_size || 0),
      totalMicroBatches: Number(b.total_micro_batches || 0),
      total_micro_batches: Number(b.total_micro_batches || 0),
      completed_micro_batches: Number(b.completed_micro_batches || 0),
      produced_units: Number(b.produced_units || 0),
      inventory_units: Number(b.inventory_units || 0),
      notes: b.notes || '',
      department_id: b.department_id || '',
      section_id: b.section_id || '',
      producedBy: b.produced_by || 'Admin',
      produced_by: b.produced_by || 'Admin',
      status: b.status,
      createdAt: b.created_at,
      completedAt: b.completed_at
    }));
  }

  async saveProductionBatch(batch: any) {
    const payload = {
      id: batch.id || crypto.randomUUID(),
      batch_id: batch.batchId || batch.batch_id || batch.production_batch_id || '',
      product_name: batch.productName || batch.product_name || '',
      product_code: batch.productCode || batch.product_code || '',
      batch_size: Number(batch.batchSize || batch.batch_size || batch.total_units || 0),
      total_micro_batches: Number(batch.totalMicroBatches || batch.total_micro_batches || 0),
      produced_by: batch.producedBy || batch.produced_by || 'Admin',
      status: batch.status || 'Saved',
      created_at: batch.createdAt || batch.created_at || new Date().toISOString(),
      completed_at: batch.completedAt || batch.completed_at || null,
      notes: batch.notes || '',
      department_id: batch.department_id || '',
      section_id: batch.section_id || '',
      completed_micro_batches: Number(batch.completed_micro_batches || 0),
      produced_units: Number(batch.produced_units || 0),
      inventory_units: Number(batch.inventory_units || batch.inventory_ready || 0)
    };
    const { error } = await supabase.from(SUPABASE_TABLES.productionBatches).insert(payload);
    if (error) {
      toast.error('Failed to save production batch: ' + error.message);
      throw error;
    }
  }

  async updateProductionBatch(id: string, updates: any) {
    const payload: any = {};
    if (updates.batchId !== undefined || updates.batch_id !== undefined) payload.batch_id = updates.batchId || updates.batch_id;
    if (updates.productName !== undefined || updates.product_name !== undefined) payload.product_name = updates.productName || updates.product_name;
    if (updates.productCode !== undefined || updates.product_code !== undefined) payload.product_code = updates.productCode || updates.product_code;
    if (updates.batchSize !== undefined || updates.batch_size !== undefined) payload.batch_size = Number(updates.batchSize || updates.batch_size);
    if (updates.totalMicroBatches !== undefined || updates.total_micro_batches !== undefined) payload.total_micro_batches = Number(updates.totalMicroBatches || updates.total_micro_batches);
    if (updates.producedBy !== undefined || updates.produced_by !== undefined) payload.produced_by = updates.producedBy || updates.produced_by;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.completedAt !== undefined || updates.completed_at !== undefined) payload.completed_at = updates.completedAt || updates.completed_at;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.department_id !== undefined) payload.department_id = updates.department_id;
    if (updates.section_id !== undefined) payload.section_id = updates.section_id;
    if (updates.completed_micro_batches !== undefined) payload.completed_micro_batches = Number(updates.completed_micro_batches);
    if (updates.produced_units !== undefined) payload.produced_units = Number(updates.produced_units);
    if (updates.inventory_units !== undefined) payload.inventory_units = Number(updates.inventory_units);

    const { error } = await supabase
      .from(SUPABASE_TABLES.productionBatches)
      .update(payload)
      .or(`id.eq.${id},batch_id.eq.${id}`);
    if (error) {
      toast.error('Failed to update production batch: ' + error.message);
      throw error;
    }
  }

  async deleteProductionBatch(batchId: string) {
    const { error } = await supabase
      .from(SUPABASE_TABLES.productionBatches)
      .update({ status: 'DELETED' })
      .or(`id.eq.${batchId},batch_id.eq.${batchId}`);
    if (error) {
      toast.error('Failed to delete production batch: ' + error.message);
      throw error;
    }
  }

  // ---- PRODUCTION INGREDIENTS ----
  async getProductionIngredients(batchId?: string, humanReadableBatchId?: string) {
    const list = await this.getSettingsList('production_ingredients');
    if (batchId) {
      return list.filter((x: any) => 
        x.production_batch_id === batchId || 
        (humanReadableBatchId && x.production_batch_id === humanReadableBatchId)
      );
    }
    return list;
  }

  async saveProductionIngredients(ingredients: any[]) {
    const list = await this.getSettingsList('production_ingredients');
    list.push(...ingredients.map(x => ({ ...x, id: x.id || crypto.randomUUID() })));
    await this.saveSettingsList('production_ingredients', list);
  }

  async updateProductionIngredient(id: string, updates: any) {
    const list = await this.getSettingsList('production_ingredients');
    const idx = list.findIndex(x => x.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      await this.saveSettingsList('production_ingredients', list);
    }
  }

  async getMicroBatches(batchId?: string, humanReadableBatchId?: string) {
    const list = await this.getSettingsList('production_micro_batches');
    if (batchId) {
      return list.filter((x: any) => 
        x.production_batch_id === batchId || x.productId === batchId ||
        (humanReadableBatchId && (x.production_batch_id === humanReadableBatchId || x.productId === humanReadableBatchId))
      );
    }
    return list;
  }

  async saveMicroBatches(microBatches: any[]) {
    const list = await this.getSettingsList('production_micro_batches');
    list.push(...microBatches.map(x => ({ ...x, id: x.id || crypto.randomUUID() })));
    await this.saveSettingsList('production_micro_batches', list);
  }

  async updateMicroBatch(id: string, updates: any) {
    const list = await this.getSettingsList('production_micro_batches');
    const idx = list.findIndex(x => x.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      await this.saveSettingsList('production_micro_batches', list);
    }
  }

  // ---- FINISHED GOODS ----
  async getFinishedGoods() {
    const list = await this.getSettingsList('finished_goods');
    return list.map((b: any) => ({ ...b, currentStage: b.currentStage || 'READY_FOR_FIRST_SCAN' }));
  }

  async saveFinishedGood(fg: any) {
    const list = await this.getFinishedGoods();
    list.push({ ...fg, id: fg.id || crypto.randomUUID() });
    await this.saveSettingsList('finished_goods', list);
  }

  dedupeProductBarcodes(items: any[]) {
    const map = new Map();

    items.forEach((item) => {
      const code = String(
        item.displayBarcode ||
        item.barcodeNumber ||
        item.barcode ||
        item.code ||
        ""
      ).trim().toUpperCase();

      if (!code) return;

      map.set(code, {
        ...item,
        displayBarcode: code,
        barcodeNumber: code,
        barcode: code,
        code: code,
        currentStage: item.currentStage || "READY_FOR_FIRST_SCAN"
      });
    });

    return Array.from(map.values());
  }

  async getProductBarcodes() {
    const { data, error } = await supabase.from(SUPABASE_TABLES.productBarcodes).select('*');
    if (error) {
      toast.error('Failed to load product barcodes: ' + error.message);
      throw error;
    }
    return (data || []).map((item: any) => ({
      ...item,
      barcode_no: item.barcode,
      barcodeNumber: item.barcode,
      displayBarcode: item.barcode,
      productName: item.product_name,
      productCode: item.product_code,
      batchId: item.batch_id,
      batch_no: item.batch_id,
      microBatchNo: item.micro_batch_no,
      mb_no: item.micro_batch_no,
      currentStage: item.current_stage || 'Production'
    }));
  }

  async getProductBarcodesForMicroBatch(batchId: string, microBatchNo: string | number, altBatchId?: string) {
    let query = supabase
      .from(SUPABASE_TABLES.productBarcodes)
      .select('*')
      .eq('micro_batch_no', String(microBatchNo));

    if (altBatchId && altBatchId !== batchId) {
      query = query.or(`batch_id.eq.${batchId},batch_id.eq.${altBatchId}`);
    } else {
      query = query.eq('batch_id', batchId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return (data || []).map((item: any) => ({
      ...item,
      barcode_no: item.barcode,
      barcodeNumber: item.barcode,
      displayBarcode: item.barcode,
      no: item.barcode,
      productName: item.product_name,
      productCode: item.product_code,
      batchId: item.batch_id,
      batch_no: item.batch_id,
      microBatchNo: item.micro_batch_no,
      mb_no: item.micro_batch_no,
      currentStage: item.current_stage || 'Production'
    }));
  }

  async getNextProductBarcodeSerials(productCode: string, mbNo: string | number, dateStr: string, count: number): Promise<string[]> {
    const prefix = `PROD-${productCode}-MB${mbNo}-${dateStr}-`;
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.productBarcodes)
      .select('barcode')
      .like('barcode', `${prefix}%`);

    if (error) {
      console.error('Error fetching existing barcode serials:', error);
    }

    let maxSerial = 0;
    if (data && data.length > 0) {
      for (const row of data) {
        if (row.barcode) {
          const parts = row.barcode.split('-');
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          if (!isNaN(num) && num > maxSerial) {
            maxSerial = num;
          }
        }
      }
    }

    const serials: string[] = [];
    for (let i = 1; i <= count; i++) {
      const nextNum = maxSerial + i;
      serials.push(`${prefix}${nextNum.toString().padStart(3, '0')}`);
    }
    return serials;
  }

  async saveProductBarcodes(newBarcodes: any[]) {
    if (!newBarcodes || newBarcodes.length === 0) return;

    const payloads = newBarcodes.map(item => ({
      id: item.id || crypto.randomUUID(),
      barcode: item.barcode_no || item.barcode || item.barcodeNumber || item.displayBarcode,
      product_name: item.productName || item.product_name || '',
      product_code: item.productCode || item.product_code || '',
      batch_id: item.batchId || item.batch_id || '',
      micro_batch_no: String(item.microBatchNo || item.micro_batch_no || ''),
      quantity: Number(item.quantity || 1),
      unit: item.unit || 'Unit',
      produced_by: item.producedBy || item.produced_by || null,
      labeled_by: item.labeledBy || item.labeled_by || null,
      current_stage: item.currentStage || item.current_stage || 'Production',
      created_at: item.created_at || new Date().toISOString(),
      updated_at: item.updated_at || new Date().toISOString()
    }));

    const barcodeList = payloads.map(p => p.barcode).filter(Boolean);
    const existingBarcodes = new Set<string>();

    if (barcodeList.length > 0) {
      const { data: existingData } = await supabase
        .from(SUPABASE_TABLES.productBarcodes)
        .select('barcode')
        .in('barcode', barcodeList);

      if (existingData && existingData.length > 0) {
        existingData.forEach((row: any) => {
          if (row.barcode) existingBarcodes.add(row.barcode);
        });
      }
    }

    const missingPayloads = payloads.filter(p => !existingBarcodes.has(p.barcode));

    if (missingPayloads.length === 0) {
      // All barcodes already exist in Supabase - idempotent completion
      return;
    }

    const { error } = await supabase.from(SUPABASE_TABLES.productBarcodes).insert(missingPayloads);
    if (error) {
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
        console.warn('Product barcodes already exist in Supabase, duplicate ignored:', error);
        return;
      }
      toast.error('Failed to save product barcodes: ' + error.message);
      throw error;
    }
  }

  async updateProductBarcode(updatedBarcode: any): Promise<boolean> {
    const barcodeValue = updatedBarcode.barcode_no || updatedBarcode.barcode || updatedBarcode.barcodeNumber || updatedBarcode.displayBarcode;
    const payload: any = {};
    if (updatedBarcode.productName !== undefined || updatedBarcode.product_name !== undefined) payload.product_name = updatedBarcode.productName || updatedBarcode.product_name;
    if (updatedBarcode.productCode !== undefined || updatedBarcode.product_code !== undefined) payload.product_code = updatedBarcode.productCode || updatedBarcode.product_code;
    if (updatedBarcode.batchId !== undefined || updatedBarcode.batch_id !== undefined) payload.batch_id = updatedBarcode.batchId || updatedBarcode.batch_id;
    if (updatedBarcode.microBatchNo !== undefined || updatedBarcode.micro_batch_no !== undefined) payload.micro_batch_no = updatedBarcode.microBatchNo || updatedBarcode.micro_batch_no;
    if (updatedBarcode.quantity !== undefined) payload.quantity = updatedBarcode.quantity;
    if (updatedBarcode.unit !== undefined) payload.unit = updatedBarcode.unit;
    if (updatedBarcode.produced_by !== undefined) payload.produced_by = updatedBarcode.produced_by;
    if (updatedBarcode.labeled_by !== undefined) payload.labeled_by = updatedBarcode.labeled_by;
    if (updatedBarcode.inventory_in_person !== undefined) payload.inventory_in_person = updatedBarcode.inventory_in_person;
    if (updatedBarcode.inventory_out_person !== undefined) payload.inventory_out_person = updatedBarcode.inventory_out_person;
    if (updatedBarcode.inventory_in_at !== undefined) payload.inventory_in_at = updatedBarcode.inventory_in_at;
    if (updatedBarcode.inventory_out_at !== undefined) payload.inventory_out_at = updatedBarcode.inventory_out_at;
    if (updatedBarcode.packed_combo_box_barcode !== undefined) payload.packed_combo_box_barcode = updatedBarcode.packed_combo_box_barcode;
    if (updatedBarcode.currentStage !== undefined || updatedBarcode.current_stage !== undefined) payload.current_stage = updatedBarcode.currentStage || updatedBarcode.current_stage;

    const { error } = await supabase
      .from(SUPABASE_TABLES.productBarcodes)
      .update(payload)
      .eq('barcode', barcodeValue);
    if (error) {
      toast.error('Failed to update product barcode: ' + error.message);
      throw error;
    }
    return true;
  }

  async updateProductBarcodeStatus(barcode_no: string, status: string): Promise<boolean> {
    const { error } = await supabase
      .from(SUPABASE_TABLES.productBarcodes)
      .update({ current_stage: status })
      .eq('barcode', barcode_no);
    if (error) {
      toast.error('Failed to update product barcode status: ' + error.message);
      throw error;
    }
    return true;
  }

  // ---- QC BARCODES ----
  async getQCBarcodes() {
    const { data, error } = await supabase.from(SUPABASE_TABLES.qcBarcodes).select('*');
    if (error) {
      toast.error('Failed to load QC barcodes: ' + error.message);
      throw error;
    }
    return (data || []).map((item: any) => ({
      ...item,
      qcBarcode: item.qc_barcode,
      displayBarcode: item.qc_barcode,
      productName: item.product_name,
      productCode: item.product_code,
      batchId: item.batch_id,
      microBatchNo: item.micro_batch_no,
      totalUnits: item.total_units,
      producedBy: item.produced_by,
      labeledBy: item.labeled_by,
      productBarcodes: item.product_barcodes,
      qcInPerson: item.qc_in_person,
      qcInAt: item.qc_in_at,
      currentStage: item.current_stage
    }));
  }

  async addQCBarcode(record: any) {
    const batchId = record.batchId || record.batch_id || '';
    const microBatchNo = String(record.microBatchNo || record.micro_batch_no || '');

    // Check if a QC barcode already exists for this batch + micro batch
    const { data: existing } = await supabase
      .from(SUPABASE_TABLES.qcBarcodes)
      .select('id')
      .eq('batch_id', batchId)
      .eq('micro_batch_no', microBatchNo)
      .limit(1);

    if (existing && existing.length > 0) {
      return { isDuplicate: true };
    }

    const payload = {
      qc_barcode: record.qcBarcode || record.qc_barcode,
      product_name: record.productName || record.product_name || '',
      product_code: record.productCode || record.product_code || '',
      batch_id: batchId,
      micro_batch_no: microBatchNo,
      total_units: record.totalUnits || record.total_units || 0,
      produced_by: record.producedBy || record.produced_by || null,
      labeled_by: record.labeledBy || record.labeled_by || null,
      product_barcodes: record.productBarcodes || record.product_barcodes || [],
      qc_in_person: record.qcInPerson || record.qc_in_person || null,
      qc_in_at: record.qcInAt || record.qc_in_at || null,
      current_stage: record.currentStage || record.current_stage || 'QC'
    };
    const { error } = await supabase.from(SUPABASE_TABLES.qcBarcodes).insert(payload);
    if (error) {
      toast.error('Failed to save QC barcode: ' + error.message);
      throw error;
    }
    return { isDuplicate: false };
  }

  async updateQCBarcode(updatedRecord: any) {
    const barcodeValue = updatedRecord.qcBarcode || updatedRecord.qc_barcode;
    const payload: any = {};
    if (updatedRecord.productName !== undefined || updatedRecord.product_name !== undefined) payload.product_name = updatedRecord.productName || updatedRecord.product_name;
    if (updatedRecord.productCode !== undefined || updatedRecord.product_code !== undefined) payload.product_code = updatedRecord.productCode || updatedRecord.product_code;
    if (updatedRecord.batchId !== undefined || updatedRecord.batch_id !== undefined) payload.batch_id = updatedRecord.batchId || updatedRecord.batch_id;
    if (updatedRecord.microBatchNo !== undefined || updatedRecord.micro_batch_no !== undefined) payload.micro_batch_no = updatedRecord.microBatchNo || updatedRecord.micro_batch_no;
    if (updatedRecord.totalUnits !== undefined || updatedRecord.total_units !== undefined) payload.total_units = updatedRecord.totalUnits || updatedRecord.total_units;
    if (updatedRecord.producedBy !== undefined || updatedRecord.produced_by !== undefined) payload.produced_by = updatedRecord.producedBy || updatedRecord.produced_by;
    if (updatedRecord.labeledBy !== undefined || updatedRecord.labeled_by !== undefined) payload.labeled_by = updatedRecord.labeledBy || updatedRecord.labeled_by;
    if (updatedRecord.productBarcodes !== undefined || updatedRecord.product_barcodes !== undefined) payload.product_barcodes = updatedRecord.productBarcodes || updatedRecord.product_barcodes;
    if (updatedRecord.qcInPerson !== undefined || updatedRecord.qc_in_person !== undefined) payload.qc_in_person = updatedRecord.qcInPerson || updatedRecord.qc_in_person;
    if (updatedRecord.qcInAt !== undefined || updatedRecord.qc_in_at !== undefined) payload.qc_in_at = updatedRecord.qcInAt || updatedRecord.qc_in_at;
    if (updatedRecord.currentStage !== undefined || updatedRecord.current_stage !== undefined) payload.current_stage = updatedRecord.currentStage || updatedRecord.current_stage;

    const { error } = await supabase
      .from(SUPABASE_TABLES.qcBarcodes)
      .update(payload)
      .eq('qc_barcode', barcodeValue);
    if (error) {
      toast.error('Failed to update QC barcode: ' + error.message);
      throw error;
    }
  }

  async deleteQCBarcode(barcodeValue: string) {
    const { error } = await supabase
      .from(SUPABASE_TABLES.qcBarcodes)
      .delete()
      .eq('qc_barcode', barcodeValue);
    if (error) {
      toast.error('Failed to delete QC barcode: ' + error.message);
      throw error;
    }
  }

  // ---- TRANSACTIONS / HISTORY ----
  async getInventoryTransactions(): Promise<any[]> {
    return this.getSettingsList('inventory_transactions');
  }

  async saveInventoryTransactions(transactions: any[]) {
    await this.saveSettingsList('inventory_transactions', transactions);
  }

  async createInventoryTransaction(transaction: any): Promise<any> {
    const list = await this.getInventoryTransactions();
    const payload = {
      ...transaction,
      id: transaction.id || crypto.randomUUID(),
      createdAt: transaction.createdAt || new Date().toISOString()
    };
    list.push(payload);
    await this.saveInventoryTransactions(list);
    return payload;
  }

  async getCurrentLocation(barcodeNumber: string): Promise<string | null> {
    const history = await this.getTransactionHistory(barcodeNumber);
    if (history.length > 0) {
      return history[0].toLocation || null;
    }
    return null;
  }

  async getInventoryAuditLogs(): Promise<any[]> {
    return this.getSettingsList('inventory_audit_log');
  }

  async createAuditLog(log: { barcodeNumber?: string, userId: string, action: string, details: string }): Promise<void> {
    const logs = await this.getInventoryAuditLogs();
    const newLog = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };
    logs.push(newLog);
    await this.saveSettingsList('inventory_audit_log', logs);
  }

  async createInventoryTransfer(params: { barcodeNumber: string, itemType: string, itemName: string, productId?: string, quantity: number, unit: string, fromLocation: string, toLocation: string, referenceType: string, referenceId: string, userId: string }): Promise<any> {
    try {
      const transaction = {
        barcodeNumber: params.barcodeNumber,
        itemType: params.itemType,
        itemName: params.itemName,
        productId: params.productId || '',
        quantity: params.quantity,
        unit: params.unit,
        fromLocation: params.fromLocation,
        toLocation: params.toLocation,
        transactionType: 'TRANSFER',
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        createdAt: new Date().toISOString()
      };
      
      const savedTx = await this.createInventoryTransaction(transaction);
      
      await this.createAuditLog({
        barcodeNumber: params.barcodeNumber,
        userId: params.userId,
        action: 'INVENTORY_TRANSFER',
        details: `${params.fromLocation} → ${params.toLocation} (${params.referenceType}: ${params.referenceId})`
      });

      return savedTx;
    } catch (error: any) {
      throw error;
    }
  }

  async moveBarcodeLocation(params: { barcodeNumber: string, itemType: string, itemName: string, productId?: string, quantity: number, unit: string, fromLocation: string, toLocation: string, referenceType: string, referenceId: string, userId?: string }): Promise<any> {
    return this.createInventoryTransfer({
      ...params,
      userId: params.userId || localStorage.getItem('current_user') || 'Admin'
    });
  }

  async getTransactionHistory(barcodeNumber: string): Promise<any[]> {
    const transactions = await this.getInventoryTransactions();
    return transactions
      .filter((tx: any) => tx.barcodeNumber === barcodeNumber)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async addToComboStock(comboProductUnit: any): Promise<{success: boolean, message?: string}> {
    let list = await this.getSettingsList('combo_available_products');
    const exists = list.some((item: any) => item.sourceBarcodeId === comboProductUnit.sourceBarcodeId);
    if (exists) {
      return { success: false, message: "Already added to Combo stock" };
    }
    
    list.push({ ...comboProductUnit, id: crypto.randomUUID() });
    await this.saveSettingsList('combo_available_products', list);
    return { success: true };
  }

  async getComboStockBalance(): Promise<any[]> {
    const releasedProducts = await this.getProductsReleasedToCombo();
    const allProducts = await this.getProductBarcodes();

    const packedMap: Record<string, number> = {};
    allProducts.forEach((p: any) => {
      if (p.currentStage === 'PACKED_IN_COMBO') {
        const key = normalizeMaterialKey(p.product_name || p.name);
        packedMap[key] = (packedMap[key] || 0) + 1;
      }
    });

    const releasedMap: Record<string, number> = {};
    releasedProducts.forEach((p: any) => {
      const key = normalizeMaterialKey(p.productName || p.name);
      releasedMap[key] = (releasedMap[key] || 0) + (Number(p.quantity) || 1);
    });

    const stockItems = [];
    for (const [key, qty] of Object.entries(releasedMap)) {
      const available = qty - (packedMap[key] || 0);
      if (available > 0) {
        stockItems.push({
          productCode: key,
          product_name: key,
          available_units: available
        });
      }
    }

    return stockItems;
  }

  async verifyAndCompleteMicroBatchScan(micro_batch_id: string): Promise<boolean> {
    return true;
  }

  async getLedger() {
    return this.getSettingsList('inventory_ledger');
  }

  async saveLedgerEntry(entry: any) {
    const list = await this.getLedger();
    list.push({ ...entry, id: entry.id || crypto.randomUUID(), created_at: new Date().toISOString() });
    await this.saveSettingsList('inventory_ledger', list);
  }

  async saveRawMaterialIssue(issue: any) {
    const list = await this.getLedger();
    list.push({ ...issue, id: issue.id || crypto.randomUUID(), type: 'issue', created_at: new Date().toISOString() });
    await this.saveSettingsList('inventory_ledger', list);
  }

  async getScanHistory() {
    return this.getSettingsList('inventory_scan_history');
  }

  async saveScanHistory(scanData: any) {
    const list = await this.getScanHistory();
    list.push({ ...scanData, id: crypto.randomUUID(), scanned_at: scanData.scanned_at || new Date().toISOString() });
    await this.saveSettingsList('inventory_scan_history', list);
  }

  // ---- COMBO BOXES ----
  async getComboBoxes() {
    const { data, error } = await supabase.from(SUPABASE_TABLES.comboBoxes).select('*');
    if (error) {
      toast.error('Failed to load combo boxes: ' + error.message);
      throw error;
    }
    return (data || []).map((item: any) => ({
      ...item,
      comboBoxBarcode: item.combo_box_barcode,
      displayBarcode: item.combo_box_barcode,
      comboName: item.combo_name,
      comboType: item.combo_type,
      packedItems: item.packed_items || [],
      requiredItems: item.required_items || [],
      currentStage: item.current_stage,
      createdAt: item.created_at,
      generatedBy: item.generated_by,
      generatedAt: item.generated_at,
      comboInventoryInPersonName: item.inventory_in_person,
      comboInventoryOutPersonName: item.inventory_out_person,
      comboInventoryInAt: item.inventory_in_at,
      comboInventoryOutAt: item.inventory_out_at
    }));
  }

  async saveComboBox(box: any) {
    const barcodeValue = box.comboBoxBarcode || box.combo_box_barcode;
    const payload = {
      combo_box_barcode: barcodeValue,
      combo_name: box.comboName || box.combo_name || '',
      combo_type: box.comboType || box.combo_type || '',
      generated_by: box.generatedBy || box.generated_by || null,
      generated_at: box.generatedAt || box.generated_at || null,
      inventory_in_person: box.comboInventoryInPersonName || box.inventory_in_person || null,
      inventory_out_person: box.comboInventoryOutPersonName || box.inventory_out_person || null,
      inventory_in_at: box.comboInventoryInAt || box.inventory_in_at || null,
      inventory_out_at: box.comboInventoryOutAt || box.inventory_out_at || null,
      packed_items: box.packedItems || box.packed_items || [],
      required_items: box.requiredItems || box.required_items || [],
      status: box.status || 'EMPTY',
      current_stage: box.currentStage || box.current_stage || 'Packed'
    };
    const { error } = await supabase.from(SUPABASE_TABLES.comboBoxes).upsert(payload, { onConflict: 'combo_box_barcode' });
    if (error) {
      toast.error('Failed to save combo box: ' + error.message);
      throw error;
    }
  }

  async removeProductFromBox(comboBoxBarcode: string, productBarcode: string) {
    const boxes = await this.getComboBoxes();
    const boxIndex = boxes.findIndex((b: any) => b.comboBoxBarcode === comboBoxBarcode);
    if (boxIndex === -1) throw new Error('Combo box not found');
    
    const box = boxes[boxIndex];
    if (box.status === 'READY') throw new Error('Cannot remove products from a READY combo box');
    
    const productIndex = box.packedItems.findIndex((item: any) => 
      normalizeBarcode(item.sourceBarcode || item.barcodeNumber || item.barcode) === normalizeBarcode(productBarcode)
    );
    
    if (productIndex === -1) throw new Error('Product not found in this combo box');
    
    box.packedItems.splice(productIndex, 1)[0];
    
    if (box.packedItems.length === 0) {
      box.status = 'EMPTY';
    } else {
      box.status = 'PARTIAL';
    }
    
    await this.saveComboBox(box);
    
    const mBar = normalizeBarcode(productBarcode);
    const { error: prodError } = await supabase
      .from(SUPABASE_TABLES.productBarcodes)
      .update({ current_stage: 'PRODUCT_OUT', packed_combo_box_barcode: null })
      .eq('barcode', mBar);

    if (prodError) {
      toast.error('Failed to update product barcode status: ' + prodError.message);
      throw prodError;
    }
    
    return box;
  }

  // ---- COMBOS ----
  async getComboDrafts() {
    return this.getSettingsList('combo_drafts');
  }

  getActiveComboDrafts() {
    try {
      const draftsStr = localStorage.getItem("combo_drafts") || "[]";
      const drafts = JSON.parse(draftsStr);
      return drafts.filter((draft: any) => draft.status === "DRAFT" || !draft.status);
    } catch {
      return [];
    }
  }

  async saveComboDraft(draft: any) {
    const list = await this.getComboDrafts();
    const existingIndex = list.findIndex(d => d.comboDraftId === draft.comboDraftId);
    if (existingIndex > -1) {
      list[existingIndex] = { ...list[existingIndex], ...draft };
    } else {
      list.push({ ...draft, created_at: new Date().toISOString() });
    }
    await this.saveSettingsList('combo_drafts', list);

    localStorage.setItem("combo_drafts", JSON.stringify(list));
  }

  async deleteComboDraft(draftId: string) {
    const list = await this.getComboDrafts();
    const filtered = list.filter(d => d.comboDraftId !== draftId);
    await this.saveSettingsList('combo_drafts', filtered);
    localStorage.setItem("combo_drafts", JSON.stringify(filtered));
  }

  async getComboTemplates() {
    return this.getSettingsList('combo_templates');
  }

  async getComboBatches() {
    return this.getSettingsList('combo_batches');
  }

  async getAllComboBarcodes() {
    const boxes = await this.getComboBoxes();
    const comboBoxes = boxes.map((b: any) => ({ 
      ...b, 
      type: 'COMBO_BOX',
      currentStage: b.currentStage || 'READY_FOR_FIRST_SCAN' 
    }));
    
    const products = await this.getProductBarcodes();
    
    const comboProducts = products.filter(b => b.packedComboBoxBarcode).map(b => {
      const box = comboBoxes.find(cb => cb.comboBoxBarcode === b.packedComboBoxBarcode);
      return {
        ...b,
        type: 'PRODUCT',
        combo_name: box ? box.comboName : b.productName || b.product_name,
        batch_id: box ? box.comboBoxBarcode : 'UNASSIGNED_COMBO_STOCK'
      };
    });
    
    return [...comboBoxes, ...comboProducts];
  }

  async getComboBarcodes(batchId: string) {
    const barcodes = await this.getSettingsList('combo_barcodes');
    return barcodes.filter((bc: any) => bc.batch_id === batchId);
  }

  async saveComboBatch(batch: any, comboInventory: any, fgDeductions: any[], barcodes: any[] = []) {
    const batches = await this.getSettingsList('combo_batches');
    const batchRecord = { ...batch, id: batch.id || crypto.randomUUID(), created_at: new Date().toISOString() };
    batches.push(batchRecord);
    await this.saveSettingsList('combo_batches', batches);

    const comboInvList = await this.getSettingsList('combo_inventory');
    comboInvList.push({ ...comboInventory, id: comboInventory.id || crypto.randomUUID(), batch_id: batchRecord.id, created_at: batchRecord.created_at });
    await this.saveSettingsList('combo_inventory', comboInvList);

    for (const deduction of fgDeductions) {
      const barcodeToDeduct = deduction.barcode;
      if (barcodeToDeduct) {
        await this.moveBarcodeLocation({
          barcodeNumber: barcodeToDeduct,
          itemType: 'PRODUCT',
          itemName: deduction.productName || deduction.product_name || 'Combo Deducted Product',
          quantity: 1,
          unit: 'Unit',
          fromLocation: 'PRODUCT',
          toLocation: 'COMBO_OUT',
          referenceType: 'COMBO_PRODUCTION',
          referenceId: batchRecord.id,
          userId: 'Admin'
        });
        await this.updateProductBarcodeStatus(barcodeToDeduct, 'COMBO_OUT');
      }
    }

    if (barcodes.length > 0) {
      const barcodesList = await this.getSettingsList('combo_barcodes');
      barcodesList.push(...barcodes.map(bc => ({ ...bc, batch_id: batchRecord.id })));
      await this.saveSettingsList('combo_barcodes', barcodesList);
    }
  }

  async createComboMovement(movement: any) {
    const movements = await this.getSettingsList('combo_movements');
    movements.push({ ...movement, id: movement.id || crypto.randomUUID(), created_at: new Date().toISOString() });
    await this.saveSettingsList('combo_movements', movements);
  }

  async updateComboBatchStatus(batchId: string, status: string) {
    const batches = await this.getSettingsList('combo_batches');
    const idx = batches.findIndex(b => b.id === batchId || b.batch_id === batchId);
    if (idx > -1) {
      batches[idx].status = status;
      await this.saveSettingsList('combo_batches', batches);
    }
  }

  async markComboBatchSaved(batchId: string) {
    const batches = await this.getSettingsList('combo_batches');
    const idx = batches.findIndex(b => b.id === batchId || b.batch_id === batchId);
    if (idx > -1) {
      batches[idx].isSaved = true;
      await this.saveSettingsList('combo_batches', batches);
    }
  }

  async getProductsReleasedToCombo() {
    return this.getSettingsList('product_released_to_combo');
  }

  async packProductIntoComboBox(param1: any, param2?: string, param3?: string) {
    let comboBoxBarcode: string = '';
    let productBarcode: string = '';
    let addedBy: string = 'Admin';

    if (typeof param1 === 'object' && param1 !== null) {
      comboBoxBarcode = String(param1.comboBoxBarcode || param1.combo_box_barcode || param1.comboBox || '').trim();
      productBarcode = String(param1.productBarcode || param1.barcode || param1.product_barcode || '').trim();
      addedBy = String(param1.addedBy || param1.scannedBy || param1.added_by || 'Admin').trim();
    } else {
      comboBoxBarcode = String(param1 || '').trim();
      productBarcode = String(param2 || '').trim();
      addedBy = String(param3 || 'Admin').trim();
    }

    if (!comboBoxBarcode || !productBarcode) {
      return { success: false, message: 'Missing combo box barcode or product barcode.' };
    }

    try {
      const normalizeProductCode = (item: any) => {
        const code = String(item.productCode || item.product_code || item.variantCode || "").toUpperCase();
        const name = String(item.productName || item.product_name || "").toLowerCase();
        if (code) return code;
        if (name.includes("liquid a") || name.includes("blue") || name.includes("1b")) return "1B";
        if (name.includes("liquid y") || name.includes("yellow") || name.includes("1y")) return "1Y";
        if (name.includes("fabric") || name.includes("pink") || name.includes("1p")) return "1P";
        if (name.includes("sponge") || name.includes("1s")) return "1S";
        return "";
      };

      const getMasterBarcode = (item: any) => String(item.barcode_no || item.barcodeNumber || item.barcode || item.displayBarcode || "").trim().toUpperCase();
      const mBar = productBarcode.toUpperCase();

      // 1. Fetch product barcode directly from Supabase
      const { data: prodData, error: prodErr } = await supabase
        .from(SUPABASE_TABLES.productBarcodes)
        .select('*')
        .eq('barcode', mBar)
        .maybeSingle();

      if (prodErr) {
        toast.error('Error querying product barcode: ' + prodErr.message);
        return { success: false, message: 'Error querying product barcode: ' + prodErr.message };
      }

      if (!prodData) {
        return { success: false, message: 'Product barcode not found.' };
      }

      // Validate product state
      if (prodData.packed_combo_box_barcode) {
        return { success: false, message: `Product is already packed in box: ${prodData.packed_combo_box_barcode}` };
      }

      if (prodData.current_stage !== 'PRODUCT_OUT') {
        return { success: false, message: 'Product is not released to Combo yet (Must be PRODUCT_OUT).' };
      }

      // 2. Fetch combo box directly from Supabase
      const { data: boxData, error: boxErr } = await supabase
        .from(SUPABASE_TABLES.comboBoxes)
        .select('*')
        .eq('combo_box_barcode', comboBoxBarcode)
        .maybeSingle();

      if (boxErr) {
        toast.error('Error querying combo box: ' + boxErr.message);
        return { success: false, message: 'Error querying combo box: ' + boxErr.message };
      }

      if (!boxData) {
        return { success: false, message: 'Combo box not found.' };
      }

      if (boxData.status === 'READY') {
        return { success: false, message: 'This combo box is already fully packed.' };
      }

      const pCode = normalizeProductCode(prodData);
      const requiredItems = boxData.required_items || [];
      const packedItems = boxData.packed_items || [];

      // Check if product is already in packed_items of this box
      if (packedItems.some((item: any) => getMasterBarcode(item) === mBar)) {
        return { success: false, message: 'This product is already packed in this combo box.' };
      }

      let requiredMatch = requiredItems.find((req: any) => req.productCode === pCode);
      if (!requiredMatch && requiredItems.length > 0) {
        return { success: false, message: `Wrong product. This combo requires: ${requiredItems.map((r: any) => r.productCode).join(' + ')}.` };
      }

      if (requiredMatch) {
        const alreadyPackedCount = packedItems.filter((p: any) => normalizeProductCode(p) === pCode).length;
        if (alreadyPackedCount >= requiredMatch.requiredQty) {
          return { success: false, message: `Box already has enough ${pCode} (${alreadyPackedCount}/${requiredMatch.requiredQty}).` };
        }
      }

      // 3. Update product_barcodes in Supabase
      const { error: updateProdErr } = await supabase
        .from(SUPABASE_TABLES.productBarcodes)
        .update({
          packed_combo_box_barcode: comboBoxBarcode,
          current_stage: 'PACKED_IN_COMBO',
          updated_at: new Date().toISOString()
        })
        .eq('barcode', mBar);

      if (updateProdErr) {
        toast.error('Failed to update product barcode in Supabase: ' + updateProdErr.message);
        return { success: false, message: 'Failed to update product barcode: ' + updateProdErr.message };
      }

      // 4. Update combo_boxes in Supabase
      const packedProduct = {
        ...prodData,
        barcode: mBar,
        barcode_no: mBar,
        barcodeNumber: mBar,
        displayBarcode: mBar,
        productName: prodData.product_name,
        product_name: prodData.product_name,
        productCode: pCode,
        product_code: pCode,
        currentStage: 'PACKED_IN_COMBO',
        current_stage: 'PACKED_IN_COMBO',
        packedComboBoxBarcode: comboBoxBarcode,
        packed_combo_box_barcode: comboBoxBarcode,
        addedAt: new Date().toISOString(),
        addedBy: addedBy
      };

      const updatedPackedItems = [...packedItems, packedProduct];

      let isReady = true;
      let totalPacked = 0;
      if (requiredItems.length > 0) {
        requiredItems.forEach((req: any) => {
          const count = updatedPackedItems.filter((p: any) => normalizeProductCode(p) === req.productCode).length;
          totalPacked += count;
          if (count < req.requiredQty) isReady = false;
        });
      } else {
        totalPacked = updatedPackedItems.length;
      }

      const newStatus = totalPacked === 0 ? 'EMPTY' : (isReady ? 'READY' : 'PARTIAL');

      const { error: updateBoxErr } = await supabase
        .from(SUPABASE_TABLES.comboBoxes)
        .update({
          packed_items: updatedPackedItems,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('combo_box_barcode', comboBoxBarcode);

      if (updateBoxErr) {
        // Rollback product barcode update if combo box update fails
        await supabase
          .from(SUPABASE_TABLES.productBarcodes)
          .update({
            packed_combo_box_barcode: null,
            current_stage: 'PRODUCT_OUT',
            updated_at: new Date().toISOString()
          })
          .eq('barcode', mBar);

        toast.error('Failed to update combo box in Supabase: ' + updateBoxErr.message);
        return { success: false, message: 'Failed to update combo box: ' + updateBoxErr.message };
      }

      const updatedBoxMapped = {
        ...boxData,
        comboBoxBarcode: boxData.combo_box_barcode,
        displayBarcode: boxData.combo_box_barcode,
        comboName: boxData.combo_name,
        comboType: boxData.combo_type,
        packedItems: updatedPackedItems,
        requiredItems: requiredItems,
        status: newStatus,
        currentStage: boxData.current_stage
      };

      return { success: true, message: 'Product added to combo box.', comboBox: updatedBoxMapped };
    } catch (err: any) {
      console.error(err);
      return { success: false, message: err.message || 'Failed to pack product.' };
    }
  }

  async packProductIntoCombo(param1: any, param2?: string, param3?: string) {
    return this.packProductIntoComboBox(param1, param2, param3);
  }

  async getComboAvailableProductStock() {
    const products = await this.getProductBarcodes();

    const normalizeProductCode = (item: any) => {
      const code = String(item.productCode || item.variantCode || "").toUpperCase();
      const name = String(item.productName || "").toLowerCase();

      if (code) return code;
      if (name.includes("blue") || name.includes("liquid a") || name.includes("1b")) return "1B";
      if (name.includes("yellow") || name.includes("dishwash") || name.includes("1y")) return "1Y";
      if (name.includes("pink") || name.includes("conditioner") || name.includes("1p")) return "1P";
      if (name.includes("sponge") || name.includes("1s")) return "1S";

      return "";
    };

    return products.reduce((acc: any, item: any) => {
      if (item.currentStage !== "PRODUCT_OUT") return acc;
      if (item.packedComboBoxBarcode) return acc;

      const code = normalizeProductCode(item);
      if (!code) return acc;

      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});
  }

  // ---- COMBOS EXTENSIONS ----
  async saveComboBarcode(barcodeData: any) {
    const list = await this.getSettingsList('combo_barcodes');
    list.push({ ...barcodeData, id: barcodeData.id || crypto.randomUUID(), created_at: new Date().toISOString() });
    await this.saveSettingsList('combo_barcodes', list);
  }

  async getComboMovements(batchId?: string) {
    const list = await this.getSettingsList('combo_movements');
    if (batchId) {
      return list.filter((m: any) => m.batch_id === batchId || m.id === batchId);
    }
    return list;
  }

  async deleteComboBatch(id: string) {
    const list = await this.getSettingsList('combo_batches');
    const filtered = list.filter(b => b.id !== id && b.batch_id !== id);
    await this.saveSettingsList('combo_batches', filtered);
  }

  async getComboInventory() {
    return this.getSettingsList('combo_inventory');
  }

  // ---- PRODUCTION STOCK EXTENSIONS ----
  async getProductionConsumedStock() {
    const transactions = await this.getInventoryTransactions();
    const consumed: Record<string, number> = {};

    transactions.forEach((tx: any) => {
      if (tx.transactionType !== "PRODUCTION_CONSUME") return;

      const key = normalizeMaterialKey(tx.itemName || tx.materialName);
      consumed[key] = (consumed[key] || 0) + Number(tx.quantity || 0);
    });

    return consumed;
  }

  async getProductionMaterialStock() {
    const rawStock = await this.getReleasedRawMaterialStock();
    const formatted: any = {};
    Object.keys(rawStock).forEach(key => {
      formatted[key] = { availableKg: Number(rawStock[key].toFixed(3)) };
    });
    return formatted;
  }

  async deductFromProductionMaterialStock(ingredients: any[]) {
    const stock = await this.getProductionMaterialStock();
    
    for (const ing of ingredients) {
      const rawName = ing.material_name || ing.name;
      const materialKey = normalizeMaterialKey(rawName);
      const requiredQty = Number(ing.required_quantity || ing.quantity || 0);
      
      if (!materialKey || requiredQty <= 0) continue;
      
      const available = stock[materialKey]?.availableKg || 0;
      if (available < requiredQty) {
        throw new Error(`Insufficient production stock for ${rawName}. Required: ${requiredQty}, Available: ${available}`);
      }
      
      await this.createInventoryTransaction({
        transactionType: 'PRODUCTION_CONSUME',
        itemName: rawName,
        quantity: requiredQty,
        unit: ing.unit || 'KG',
        createdAt: new Date().toISOString()
      });
    }
  }

  // ---- HARD DELETIONS ----
  async deleteRawMaterialBarcode(serialNumber: string) {
    const { error } = await supabase
      .from(SUPABASE_TABLES.rawMaterialBarcodes)
      .delete()
      .eq('barcode', serialNumber);
    if (error) {
      toast.error('Failed to delete raw material barcode: ' + error.message);
      throw error;
    }
  }

  async deleteProductBarcode(barcodeNo: string) {
    const { error } = await supabase
      .from(SUPABASE_TABLES.productBarcodes)
      .delete()
      .eq('barcode', barcodeNo);
    if (error) {
      toast.error('Failed to delete product barcode: ' + error.message);
      throw error;
    }
    
    const released = await this.getProductsReleasedToCombo();
    const filteredReleased = released.filter(r => r.barcodeNumber !== barcodeNo && r.barcode !== barcodeNo && r.code !== barcodeNo && r.displayBarcode !== barcodeNo && r.sourceBarcode !== barcodeNo);
    await this.saveSettingsList('product_released_to_combo', filteredReleased);
  }

  async deleteProductBarcodes(barcodeNos: string[]) {
    const { error } = await supabase
      .from(SUPABASE_TABLES.productBarcodes)
      .delete()
      .in('barcode', barcodeNos);
    if (error) {
      toast.error('Failed to delete product barcodes: ' + error.message);
      throw error;
    }

    const released = await this.getProductsReleasedToCombo();
    const filteredReleased = released.filter(r => {
      const matchValue = r.barcodeNumber || r.barcode || r.code || r.displayBarcode || r.sourceBarcode;
      return !barcodeNos.includes(matchValue);
    });
    await this.saveSettingsList('product_released_to_combo', filteredReleased);
  }

  async deleteComboBox(comboBoxBarcode: string) {
    const boxes = await this.getComboBoxes();
    const box = boxes.find((b: any) => b.comboBoxBarcode === comboBoxBarcode);
    if (!box) return;

    if (box.packedItems && box.packedItems.length > 0) {
      const barcodesToRestore = box.packedItems.map((item: any) => 
        normalizeBarcode(item.sourceBarcode || item.barcodeNumber || item.barcode)
      );

      await supabase
        .from(SUPABASE_TABLES.productBarcodes)
        .update({ current_stage: 'PRODUCT_OUT', packed_combo_box_barcode: null })
        .in('barcode', barcodesToRestore);

      const released = await this.getProductsReleasedToCombo();
      released.forEach((r: any) => {
        const matchVal = normalizeBarcode(r.sourceBarcode || r.barcodeNumber || r.barcode || r.code || r.displayBarcode);
        if (barcodesToRestore.includes(matchVal)) {
          r.status = 'AVAILABLE_FOR_COMBO';
          delete r.packedComboBoxBarcode;
        }
      });
      await this.saveSettingsList('product_released_to_combo', released);
    }

    const { error } = await supabase
      .from(SUPABASE_TABLES.comboBoxes)
      .delete()
      .eq('combo_box_barcode', comboBoxBarcode);
    
    if (error) {
      toast.error('Failed to delete combo box: ' + error.message);
      throw error;
    }
  }

  async deleteComboBoxesBulk(comboBoxBarcodes: string[]) {
    for (const barcode of comboBoxBarcodes) {
      await this.deleteComboBox(barcode);
    }
  }

  async deleteComboBoxBarcode(batchId: string) {
    const barcodes = await this.getSettingsList('combo_barcodes');
    const filteredBarcodes = barcodes.filter(b => b.batch_id !== batchId);
    await this.saveSettingsList('combo_barcodes', filteredBarcodes);

    const comboInvList = await this.getSettingsList('combo_inventory');
    const filteredInvList = comboInvList.filter(inv => inv.batch_id !== batchId);
    await this.saveSettingsList('combo_inventory', filteredInvList);

    const batches = await this.getSettingsList('combo_batches');
    const filteredBatches = batches.filter(b => b.id !== batchId);
    await this.saveSettingsList('combo_batches', filteredBatches);

    const movements = await this.getSettingsList('combo_movements');
    const consumedMovements = movements.filter((m: any) => m.batch_id === batchId && m.type === 'consumed');
    
    const fgList = await this.getSettingsList('finished_goods');
    for (const move of consumedMovements) {
      const quantityToRestore = Math.abs(move.quantity);
      fgList.push({
        id: crypto.randomUUID(),
        production_batch_id: 'RESTORED-COMBO',
        micro_batch_id: 'RESTORED',
        product_name: move.product_name,
        units: quantityToRestore,
        status: 'Restored',
        scanned_at: new Date().toISOString()
      });
    }
    await this.saveSettingsList('finished_goods', fgList);
  }

  // ---- BARCODE SCAN WORKFLOW ENGINE ----
  async processBarcodeScan(params: {
    barcodeNumber: string;
    department: 'RAW_MATERIAL' | 'PRODUCT' | 'COMBO' | 'QC';
    scanAction: 'IN' | 'OUT' | 'PACK';
    payload?: any;
    comboDraftId?: string;
    activeDraft?: any;
  }): Promise<{ success: boolean; message: string; stage: string; item: any }> {
    const { barcodeNumber, department, scanAction, payload } = params;
    const now = new Date().toISOString();
    const userId = localStorage.getItem('current_user') || 'Warehouse Admin';

    let record: any = null;
    const scannedCode = normalizeBarcode(barcodeNumber);

    if (department === 'RAW_MATERIAL') {
      const batches = await this.getBatches();
      record = batches.find((item: any) => normalizeBarcode(item.barcode) === scannedCode);
      if (!record) {
        throw new Error(`Barcode ${barcodeNumber} does not exist in Raw Materials.`);
      }
    } else if (department === 'PRODUCT') {
      const allProducts = await this.getProductBarcodes();
      record = allProducts.find((item: any) => normalizeBarcode(item.barcode) === scannedCode);
      if (!record) {
        throw new Error(`Barcode ${barcodeNumber} does not exist in Products.`);
      }
    } else if (department === 'COMBO') {
      const boxes = await this.getComboBoxes();
      record = boxes.find((item: any) => normalizeBarcode(item.comboBoxBarcode) === scannedCode);
      if (!record) {
        throw new Error(`Barcode ${barcodeNumber} does not exist in Combo Boxes.`);
      }
    } else if (department === 'QC') {
      const qcList = await this.getQCBarcodes();
      record = qcList.find((item: any) => normalizeBarcode(item.qcBarcode) === scannedCode);
      if (!record) {
        throw new Error(`Barcode ${barcodeNumber} does not exist in Quality Check.`);
      }
    }

    const currentStage = record.currentStage || 'READY_FOR_FIRST_SCAN';
    let nextStage = '';
    let successMessage = '';

    if (department === 'RAW_MATERIAL') {
      if (scanAction === 'IN') {
        if (currentStage === 'READY_FOR_FIRST_SCAN' || currentStage === 'Incoming') {
          nextStage = 'RAW_MATERIAL_IN';
          successMessage = 'Raw material received into Inventory IN.';
          record.inventory_in_person = payload?.personName || userId;
          record.inventory_in_at = new Date().toISOString();
        } else {
          throw new Error('Already scanned to Inventory IN. Go to Inventory OUT to release.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'RAW_MATERIAL_IN') {
          nextStage = 'RAW_MATERIAL_OUT';
          successMessage = 'Raw material moved to Inventory OUT (Ready for Production).';
          record.inventory_out_person = payload?.personName || userId;
          record.inventory_out_at = new Date().toISOString();
          
          const released = await this.getRawMaterialsReleasedToProduct();
          released.push({
            type: 'RAW_MATERIAL_RELEASED_TO_PRODUCT',
            sourceBarcode: record.barcode,
            materialName: record.material_name,
            quantity: record.quantity || 0,
            unit: record.unit || 'kg',
            batch: record.batch_no || '',
            vendor: record.vendor || '',
            releasedAt: now
          });
          await this.saveSettingsList('raw_material_released_to_product', released);
        } else if (currentStage === 'RAW_MATERIAL_OUT') {
          throw new Error('Already scanned to Inventory OUT / Released to Product.');
        } else {
          throw new Error('Scan to Inventory IN first.');
        }
      }
    } else if (department === 'PRODUCT') {
      if (scanAction === 'IN') {
        if (currentStage === 'READY_FOR_FIRST_SCAN' || currentStage === 'Production') {
          nextStage = 'PRODUCT_IN';
          successMessage = 'Product received into Product Inventory IN.';
          record.inventory_in_person = payload?.personName || userId;
          record.inventory_in_at = new Date().toISOString();
        } else {
          throw new Error('Already scanned to Product Inventory IN.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'PRODUCT_IN') {
          nextStage = 'PRODUCT_OUT';
          successMessage = 'Product reserved for Combo (Inventory OUT).';
          record.inventory_out_person = payload?.personName || userId;
          record.inventory_out_at = new Date().toISOString();

          const released = await this.getProductsReleasedToCombo();
          released.push({
            type: 'PRODUCT_RELEASED_TO_COMBO',
            sourceBarcode: record.barcode,
            productName: record.product_name,
            productCode: record.product_code,
            quantity: 1,
            unit: 'Unit',
            batch: record.batch_id || '',
            microBatch: record.micro_batch_no || '',
            status: 'AVAILABLE_FOR_COMBO',
            releasedAt: now
          });
          await this.saveSettingsList('product_released_to_combo', released);
        } else if (currentStage === 'PRODUCT_OUT' || currentStage === 'PACKED_IN_COMBO') {
          throw new Error('Already released to Combo.');
        } else {
          throw new Error('Scan to Inventory IN first.');
        }
      }
    } else if (department === 'COMBO') {
      if (scanAction === 'IN') {
        if (record.status !== 'READY') {
          throw new Error('This combo box is empty or partially packed. Add products first.');
        }
        if (currentStage === 'READY_FOR_FIRST_SCAN' || currentStage === 'Packed') {
          nextStage = 'COMBO_IN';
          successMessage = 'Combo received into Combo Inventory IN.';
          record.inventory_in_person = payload?.personName || userId;
          record.inventory_in_at = new Date().toISOString();
        } else {
          throw new Error('Already scanned to Combo Inventory IN.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'COMBO_IN') {
          nextStage = 'COMBO_OUT';
          successMessage = 'Combo moved to Inventory OUT (Ready for Dispatch).';
          record.inventory_out_person = payload?.personName || userId;
          record.inventory_out_at = new Date().toISOString();
        } else if (currentStage === 'COMBO_OUT' || currentStage === 'DISPATCHED') {
          throw new Error('Already moved out.');
        } else {
          throw new Error('Scan to Inventory IN first.');
        }
      }
    } else if (department === 'QC') {
      if (scanAction === 'IN') {
        if (currentStage === 'READY_FOR_QC_IN' || currentStage === 'QC') {
          nextStage = 'QC_IN';
          successMessage = 'Quality Check barcode received into QC Inventory IN.';
          record.qc_in_person = payload?.personName || userId;
          record.qc_in_at = new Date().toISOString();
        } else {
          throw new Error('Already scanned to QC Inventory IN.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'QC_IN') {
          nextStage = 'QC_OUT';
          successMessage = 'Quality Check barcode moved to QC Inventory OUT.';
          record.qc_out_person = payload?.personName || userId;
          record.qc_out_at = new Date().toISOString();
        } else if (currentStage === 'QC_OUT') {
          throw new Error('Already scanned out.');
        } else {
          throw new Error('Scan to QC IN first.');
        }
      }
    }

    record.currentStage = nextStage;
    record.current_stage = nextStage;
    
    if (department === 'RAW_MATERIAL') {
      await this.updateBatch(record.id, record);
    } else if (department === 'PRODUCT') {
      await this.updateProductBarcode(record);
    } else if (department === 'COMBO') {
      await this.saveComboBox(record);
    } else if (department === 'QC') {
      await this.updateQCBarcode(record);
    }

    await this.createInventoryTransaction({
      barcodeNumber: barcodeNumber,
      itemType: department,
      itemName: record.material_name || record.product_name || record.combo_name || 'Unknown',
      productId: record.id || record.productId,
      quantity: record.quantity || 1,
      unit: record.unit || 'KG',
      fromLocation: currentStage,
      toLocation: nextStage,
      referenceType: 'SCAN',
      referenceId: record.batch_id || record.id,
      userId: userId
    });

    return { success: true, message: successMessage, stage: nextStage, item: record };
  }

  async getRawMaterialsReleasedToProduct() {
    return this.getSettingsList('raw_material_released_to_product');
  }

  async getReleasedRawMaterialStock() {
    const released = await this.getRawMaterialsReleasedToProduct();
    const normalize = (name: string) => String(name || "").trim().toLowerCase();
    
    const stock: any = {};
    
    released.forEach((item: any) => {
      const key = normalize(item.materialName || item.name || item.itemName || item.material || item.material_name);
      const qty = convertToStandardUnit(Number(item.quantity || item.availableKg || item.available || 0), item.unit);
      if (!key || qty <= 0) return;
      stock[key] = (stock[key] || 0) + qty;
    });

    const consumed = await this.getProductionConsumedStock();
    Object.keys(consumed).forEach((key) => {
      stock[key] = Number(stock[key] || 0) - Number((consumed as any)[key] || 0);
    });

    return stock;
  }

  async validateIngredientAvailability(ingredients: any[]) {
    const { data: barcodes, error: dbError } = await supabase
      .from(SUPABASE_TABLES.rawMaterialBarcodes)
      .select('*')
      .eq('current_stage', 'RAW_MATERIAL_OUT');

    if (dbError) {
      toast.error('Failed to load raw material stock: ' + dbError.message);
      throw dbError;
    }

    const normalize = (name: string) => String(name || "").trim().toLowerCase();

    const releasedStock: Record<string, number> = {};
    (barcodes || []).forEach((item: any) => {
      const key = normalize(item.material_name);
      const qty = convertToStandardUnit(Number(item.quantity || 0), item.unit);
      if (key && qty > 0) {
        releasedStock[key] = (releasedStock[key] || 0) + qty;
      }
    });

    const consumedStock = await this.getProductionConsumedStock();

    const status = [];
    for (const ing of ingredients) {
      const key = normalize(ing.name);
      const availableKg = (releasedStock[key] || 0) - (consumedStock[key] || 0);
      const requiredQty = Number(ing.required_quantity || ing.quantity || 0);

      const materials = await this.getMaterials();
      const hasMapping = materials.some(m => normalize(m.name) === key);

      status.push({
        name: ing.name,
        required: requiredQty,
        available: Number(Math.max(0, availableKg).toFixed(4)),
        sufficient: availableKg >= requiredQty && requiredQty > 0 && hasMapping,
        hasMapping: hasMapping,
        shortage: availableKg < requiredQty ? requiredQty - availableKg : 0
      });
    }

    return status;
  }

  async deductRawMaterialsForProduction(ingredients: any[], productionBatchId: string, productCode: string) {
    const status = await this.validateIngredientAvailability(ingredients);
    
    for (const item of status) {
      if (!item.sufficient) {
        throw new Error(`Insufficient stock or material not linked for ${item.name}. Required: ${item.required}, Available: ${item.available}`);
      }
    }

    const list = await this.getInventoryTransactions();
    const now = new Date().toISOString();

    for (const ing of ingredients) {
      list.push({
        id: crypto.randomUUID(),
        transactionType: "PRODUCTION_CONSUME",
        itemName: ing.name,
        quantity: ing.required_quantity,
        fromStage: "RAW_MATERIAL_OUT",
        toStage: "PRODUCTION_CONSUMED",
        production_batch_id: productionBatchId,
        product_code: productCode,
        createdAt: now
      });
    }

    await this.saveInventoryTransactions(list);
    return true;
  }
}

export const inventoryService = new LocalInventoryService();
