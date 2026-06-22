import { mockInitialState } from '../data/mockInventoryData';
import { supabase } from '../lib/supabase';
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


class LocalInventoryService {
  private dataSourceMode: 'local' | 'supabase' | 'hybrid' = 'hybrid';

  setDataSourceMode(mode: 'local' | 'supabase' | 'hybrid') {
    this.dataSourceMode = mode;
  }

  getDataSourceMode() {
    return this.dataSourceMode;
  }
  
  repairDuplicateBarcodes(collectionKey: string) {
    const items = JSON.parse(localStorage.getItem(collectionKey) || "[]");
    const cleaned = dedupeBarcodes(items);
    localStorage.setItem(collectionKey, JSON.stringify(cleaned));
    return cleaned;
  }

  upsertBarcodeByNumber(collectionKey: string, updatedBarcode: any) {
    const code = normalizeBarcode(updatedBarcode.comboBoxBarcode || updatedBarcode.barcodeNumber || updatedBarcode.barcode || updatedBarcode.code || updatedBarcode.serial_number || updatedBarcode.barcode_no || updatedBarcode.id);

    const list = JSON.parse(localStorage.getItem(collectionKey) || "[]");

    const existingIndex = list.findIndex((item: any) =>
      normalizeBarcode(item.comboBoxBarcode || item.barcodeNumber || item.barcode || item.code || item.serial_number || item.barcode_no || item.id) === code
    );

    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        ...updatedBarcode,
        barcodeNumber: list[existingIndex].barcodeNumber || updatedBarcode.barcodeNumber,
        currentStage: updatedBarcode.currentStage
      };
    } else {
      list.push(updatedBarcode);
    }

    localStorage.setItem(collectionKey, JSON.stringify(list));
    return list;
  }

  repairBarcodeValues(collectionKey: string) {
    const list = JSON.parse(localStorage.getItem(collectionKey) || "[]");
    let changed = false;
    
    list.forEach((item: any) => {
      const visibleCode = item.barcodeNumber || item.barcode || item.code || item.batchNo || item.serial_number || item.barcode_no || item.id;
      if (visibleCode && (item.barcodeNumber !== visibleCode || item.barcode !== visibleCode || item.code !== visibleCode || item.serial_number !== visibleCode || item.barcode_no !== visibleCode)) {
        item.barcodeNumber = visibleCode;
        item.barcode = visibleCode;
        item.code = visibleCode;
        item.serial_number = visibleCode;
        item.barcode_no = visibleCode;
        changed = true;
      }
    });
    
    if (changed) {
      localStorage.setItem(collectionKey, JSON.stringify(list));
    }
  }
private init() {
    if (!localStorage.getItem('inventory_materials')) {
      localStorage.setItem('inventory_materials', JSON.stringify(mockInitialState.inventory_materials));
      localStorage.setItem('inventory_batches', JSON.stringify(mockInitialState.inventory_batches));
      localStorage.setItem('inventory_production', JSON.stringify(mockInitialState.inventory_production));
      localStorage.setItem('inventory_ledger', JSON.stringify(mockInitialState.inventory_ledger));
      localStorage.setItem('inventory_in', JSON.stringify(mockInitialState.inventory_in));
      localStorage.setItem('production_ingredients', JSON.stringify(mockInitialState.production_ingredients));
      localStorage.setItem('production_micro_batches', JSON.stringify(mockInitialState.production_micro_batches));
      localStorage.setItem('finished_goods', JSON.stringify(mockInitialState.finished_goods));
      localStorage.setItem('inventory_scan_history', JSON.stringify([]));
    }
    if (!localStorage.getItem('inventory_transactions')) {
      localStorage.setItem('inventory_transactions', JSON.stringify([]));
    }
    // Initialize Combos if missing
    if (!localStorage.getItem('combo_drafts')) {
      localStorage.setItem('combo_drafts', JSON.stringify([]));
    }
    if (!localStorage.getItem('combo_batches')) {
      localStorage.setItem('combo_batches', JSON.stringify([]));
      localStorage.setItem('combo_inventory', JSON.stringify([]));
      localStorage.setItem('combo_movements', JSON.stringify([]));
    }
    if (!localStorage.getItem('quality_check_barcodes')) {
      localStorage.setItem('quality_check_barcodes', JSON.stringify([]));
    }
    if (!localStorage.getItem('product_barcodes')) {
      localStorage.setItem('combo_barcodes', JSON.stringify([]));
    }
    if (!localStorage.getItem('inventory_audit_log')) {
      localStorage.setItem('inventory_audit_log', JSON.stringify([]));
    }
    if (!localStorage.getItem('inventory_transaction_sequence')) {
      localStorage.setItem('inventory_transaction_sequence', '0');
    }

    if (!localStorage.getItem('inventory_migration_v2_done')) {
      const transactions = localStorage.getItem('inventory_transactions') ? JSON.parse(localStorage.getItem('inventory_transactions') as string) : [];
      let txAdded = false;

      // 1 & 2. Migrate old product barcodes to PRODUCT (ignore old SCANNED/NOT_SCANNED distinction for location)
      const productsStr = localStorage.getItem('finished_product_barcodes');
      if (productsStr) {
        const products = JSON.parse(productsStr);
        for (const prod of products) {
          const hasTx = transactions.some((tx: any) => tx.barcodeNumber === prod.barcode_no);
          if (!hasTx) {
            transactions.push({
              id: crypto.randomUUID(),
              barcodeNumber: prod.barcode_no,
              itemType: 'PRODUCT',
              itemName: prod.product_name || 'Legacy Product',
              productId: prod.productId || prod.product_code || '',
              quantity: 1,
              unit: 'Unit',
              fromLocation: 'PRODUCTION',
              toLocation: 'PRODUCT',
              referenceType: 'V2_MIGRATION',
              referenceId: 'MIGRATION',
              createdAt: prod.created_at || new Date().toISOString()
            });
            txAdded = true;
          }
        }
      }

      // 3. Migrate old combo stock items to COMBO
      const combosStr = localStorage.getItem('combo_batches');
      if (combosStr) {
        const combos = JSON.parse(combosStr);
        for (const combo of combos) {
          const hasTx = transactions.some((tx: any) => tx.barcodeNumber === combo.batch_id);
          if (!hasTx && combo.batch_id) {
            transactions.push({
              id: crypto.randomUUID(),
              barcodeNumber: combo.batch_id,
              itemType: 'COMBO',
              itemName: combo.combo_name || 'Legacy Combo',
              productId: combo.combo_name || '',
              quantity: combo.total_units || 1,
              unit: 'Pack',
              fromLocation: 'PRODUCTION',
              toLocation: 'COMBO',
              referenceType: 'V2_MIGRATION',
              referenceId: 'MIGRATION',
              createdAt: combo.created_at || new Date().toISOString()
            });
            txAdded = true;
          }
        }
      }

      if (txAdded) {
        localStorage.setItem('inventory_transactions', JSON.stringify(transactions));
      }
      localStorage.setItem('inventory_migration_v2_done', 'true');
    }
  }

  constructor() {
    this.init();
  }

  private getList(key: string): any[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private saveList(key: string, data: any[]) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // ---- NEW SUPABASE HYBRID GETTERS ----

  // 1. Raw Materials
  getRawMaterialBarcodes(): any[] {
    return this.getList('raw_material_barcodes');
  }

  async getRawMaterialBarcodesFromSupabase(): Promise<any[]> {
    const { data, error } = await supabase.from('raw_material_barcodes').select('*');
    if (error) throw error;
    return data || [];
  }

  async getRawMaterialBarcodesHybrid(): Promise<any[]> {
    if (this.dataSourceMode === 'local') return this.getRawMaterialBarcodes();
    try {
      const data = await this.getRawMaterialBarcodesFromSupabase();
      if (!data || data.length === 0) throw new Error('Empty Supabase data');
      return data;
    } catch (err) {
      if (this.dataSourceMode === 'hybrid') {
        toast.error('Supabase read failed, falling back to Local');
        return this.getRawMaterialBarcodes();
      }
      throw err;
    }
  }

  // 2. Products
  async getProductBarcodesFromSupabase(): Promise<any[]> {
    const { data, error } = await supabase.from('product_barcodes').select('*');
    if (error) throw error;
    return data || [];
  }

  async getProductBarcodesHybrid(): Promise<any[]> {
    if (this.dataSourceMode === 'local') return this.getProductBarcodes();
    try {
      const data = await this.getProductBarcodesFromSupabase();
      if (!data || data.length === 0) throw new Error('Empty Supabase data');
      return data;
    } catch (err) {
      if (this.dataSourceMode === 'hybrid') {
        toast.error('Supabase read failed, falling back to Local');
        return this.getProductBarcodes();
      }
      throw err;
    }
  }

  // 3. Combo Boxes
  async getComboBoxesFromSupabase(): Promise<any[]> {
    const { data, error } = await supabase.from('combo_boxes').select('*');
    if (error) throw error;
    return data || [];
  }

  async getComboBoxesHybrid(): Promise<any[]> {
    if (this.dataSourceMode === 'local') return this.getComboBoxes();
    try {
      const data = await this.getComboBoxesFromSupabase();
      if (!data || data.length === 0) throw new Error('Empty Supabase data');
      return data;
    } catch (err) {
      if (this.dataSourceMode === 'hybrid') {
        toast.error('Supabase read failed, falling back to Local');
        return this.getComboBoxes();
      }
      throw err;
    }
  }

  // 4. QC Barcodes
  async getQCBarcodesFromSupabase(): Promise<any[]> {
    const { data, error } = await supabase.from('qc_barcodes').select('*');
    if (error) throw error;
    return data || [];
  }

  async getQCBarcodesHybrid(): Promise<any[]> {
    if (this.dataSourceMode === 'local') return this.getQCBarcodes();
    try {
      const data = await this.getQCBarcodesFromSupabase();
      if (!data || data.length === 0) throw new Error('Empty Supabase data');
      return data;
    } catch (err) {
      if (this.dataSourceMode === 'hybrid') {
        toast.error('Supabase read failed, falling back to Local');
        return this.getQCBarcodes();
      }
      throw err;
    }
  }


  // ---- MATERIALS ----
  async getMaterials() {
    return this.getList('inventory_materials');
  }
  async saveMaterial(material: any) {
    const list = this.getList('inventory_materials');
    list.push({ ...material, id: material.id || crypto.randomUUID() });
    this.saveList('inventory_materials', list);
  }
  async updateMaterial(id: string, updates: any) {
    const list = this.getList('inventory_materials');
    const idx = list.findIndex(x => x.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      this.saveList('inventory_materials', list);
    }
  }

  // ---- BATCHES / BARCODES ----
  async getBatches() {
    return this.getList('inventory_batches');
  }
  async saveBatch(batch: any) {
    const list = this.getList('inventory_batches');
    list.push(batch);
    this.saveList('inventory_batches', list);
  }
  async saveBatches(batches: any[]) {
    const list = this.getList('inventory_batches');
    const newBatches = batches.map(b => ({ ...b, id: b.id || crypto.randomUUID() }));
    list.push(...newBatches);
    this.saveList('inventory_batches', list);
    return newBatches.map(b => b.id);
  }
  async updateBatch(id: string, updates: any) {
    const list = this.getList('inventory_batches');
    const idx = list.findIndex(x => x.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      this.saveList('inventory_batches', list);
    }
  }

  // Barcode specific aliases (since batches ARE the barcodes mostly)
  async getBarcodes() {
    return this.getList('inventory_batches')
      .filter(b => !!b.barcode_data)
      .map(b => ({ ...b, currentStage: b.currentStage || 'READY_FOR_FIRST_SCAN' }));
  }
  async saveBarcode(batchId: string, updates: any) {
    return this.updateBatch(batchId, updates);
  }

  // ---- RAW MATERIAL INTAKE SPECIFIC ----
  async saveRawMaterialIntake(inventoryInRecord: any, batchesData: any[]) {
    const invInList = this.getList('inventory_in');
    const invId = crypto.randomUUID();
    invInList.push({ ...inventoryInRecord, id: invId });
    this.saveList('inventory_in', invInList);

    const bList = this.getList('inventory_batches');
    const newBatches = batchesData.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      inventory_in_id: invId,
      created_at: new Date().toISOString()
    }));
    
    bList.push(...newBatches);
    this.saveList('inventory_batches', bList);
    
    return newBatches.map(b => b.id);
  }

  async getInventoryIn() {
    return this.getList('inventory_in');
  }

  // ---- PRODUCTION ----
  async getProductionBatches() {
    const batches = this.getList('inventory_production');
    let updated = false;

    batches.forEach((batch: any) => {
      if (batch.status !== 'COMPLETE' && batch.status !== 'Complete' && batch.status !== 'Saved' && batch.status !== 'DELETED') {
        const mbs = this.getList('production_micro_batches').filter((m: any) => m.production_batch_id === batch.production_batch_id || m.production_batch_id === batch.id);
        if (mbs.length > 0 && mbs.length >= (batch.total_micro_batches || 0)) {
          const isComplete = mbs.every((mb: any) => ["PASSED", "FAILED", "BARCODE_SAVED", "COMPLETED"].includes(mb.status));
          if (isComplete) {
            batch.status = "COMPLETE";
            if (!batch.completedAt) batch.completedAt = new Date().toISOString();
            updated = true;
          }
        }
      }
    });

    if (updated) {
      this.saveList('inventory_production', batches);
    }

    return batches;
  }
  async saveProductionBatch(batch: any) {
    const list = this.getList('inventory_production');
    list.push({ ...batch, id: batch.id || crypto.randomUUID(), created_at: new Date().toISOString() });
    this.saveList('inventory_production', list);
  }
  async updateProductionBatch(id: string, updates: any) {
    const list = this.getList('inventory_production');
    const idx = list.findIndex(x => x.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      this.saveList('inventory_production', list);
    }
  }

  async deleteProductionBatch(batchId: string) {
    const batches = this.getList('inventory_production');
    const batchIdx = batches.findIndex(b => b.id === batchId);
    if (batchIdx === -1) throw new Error("Batch not found");
    const batch = batches[batchIdx];

    // 1. Dependency Check for COMPLETE / SAVED batches (Finished Goods)
    if (batch.status === 'Complete' || batch.status === 'Saved') {
      const fgList = this.getList('finished_goods');
      const mbs = this.getList('production_micro_batches').filter((m: any) => m.production_batch_id === batch.production_batch_id);
      
      for (const fg of fgList) {
        if (fg.production_batch_id === batch.production_batch_id) {
          const mb = mbs.find((m: any) => m.id === fg.micro_batch_id);
          if (mb && fg.units < mb.units) {
            throw new Error("Cannot delete. Finished goods already used in Combos.");
          }
        }
      }
    }

    // 2. Soft Delete Production Batch
    batches[batchIdx].status = 'DELETED';
    this.saveList('inventory_production', batches);

    // 3. Soft Delete Micro Batches
    const mbs = this.getList('production_micro_batches');
    let mbUpdated = false;
    for (const mb of mbs) {
      if (mb.production_batch_id === batch.production_batch_id || mb.production_batch_id === batch.id) {
        mb.status = 'DELETED';
        mbUpdated = true;
      }
    }
    if (mbUpdated) {
      this.saveList('production_micro_batches', mbs);
    }

    // 4. Reverse Logic based on original status
    if (batch.status === 'Prep' || batch.status === 'In Progress') {
      await this.restoreRawMaterialsForDeletedBatch(batch.production_batch_id || batchId);
    } else if (batch.status === 'Complete') {
      // Reverse finished goods
      const fgList = this.getList('finished_goods');
      let fgUpdated = false;
      for (const fg of fgList) {
        if (fg.production_batch_id === batch.production_batch_id) {
          fg.units = 0;
          fg.status = 'REVERSED';
          fgUpdated = true;
        }
      }
      if (fgUpdated) this.saveList('finished_goods', fgList);
    }
    // If SAVED, no inventory reversal needed as per rules.
  }

  async getProductionIngredients(batchId?: string) {
    const list = this.getList('production_ingredients');
    return batchId ? list.filter(x => x.production_batch_id === batchId) : list;
  }
  async saveProductionIngredients(ingredients: any[]) {
    const list = this.getList('production_ingredients');
    list.push(...ingredients.map(i => ({...i, id: i.id || crypto.randomUUID()})));
    this.saveList('production_ingredients', list);
  }
  async updateProductionIngredient(id: string, updates: any) {
    const list = this.getList('production_ingredients');
    const idx = list.findIndex(x => x.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      this.saveList('production_ingredients', list);
    }
  }

  async getMicroBatches(batchId?: string) {
    const list = this.getList('production_micro_batches');
    return batchId ? list.filter(x => x.production_batch_id === batchId) : list;
  }
  async saveMicroBatches(microBatches: any[]) {
    const list = this.getList('production_micro_batches');
    const newMbs = microBatches.map(m => ({...m, id: m.id || crypto.randomUUID()}));
    list.push(...newMbs);
    this.saveList('production_micro_batches', list);
    return newMbs;
  }
  async updateMicroBatch(id: string, updates: any) {
    const list = this.getList('production_micro_batches');
    const idx = list.findIndex(x => x.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      this.saveList('production_micro_batches', list);
      
      // Auto-recalculate parent batch status
      const batchId = list[idx].production_batch_id;
      if (batchId) {
        const batches = this.getList('inventory_production');
        const bIdx = batches.findIndex((b: any) => b.production_batch_id === batchId || b.id === batchId);
        if (bIdx > -1) {
          const batch = batches[bIdx];
          if (batch.status !== 'COMPLETE' && batch.status !== 'Complete' && batch.status !== 'Saved' && batch.status !== 'DELETED') {
            const mbs = list.filter((m: any) => m.production_batch_id === batch.production_batch_id || m.production_batch_id === batch.id);
            if (mbs.length > 0 && mbs.length >= (batch.total_micro_batches || 0)) {
              const isComplete = mbs.every((mb: any) => ["PASSED", "FAILED", "BARCODE_SAVED", "COMPLETED"].includes(mb.status));
              if (isComplete) {
                batch.status = "COMPLETE";
                batch.completedAt = new Date().toISOString();
                this.saveList('inventory_production', batches);
              }
            }
          }
        }
      }
    }
  }

  // ---- FINISHED GOODS ----
  async getFinishedGoods() {
    return this.getList('finished_goods')
      .map(b => ({ ...b, currentStage: b.currentStage || 'READY_FOR_FIRST_SCAN' }));
  }
  async saveFinishedGood(fg: any) {
    const list = this.getList('finished_goods');
    list.push({ ...fg, id: fg.id || crypto.randomUUID() });
    this.saveList('finished_goods', list);
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

  getProductBarcodes() {
    try {
      const data = JSON.parse(localStorage.getItem("finished_product_barcodes") || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  // ---- QUALITY CHECK BARCODES ----
  getQCBarcodes() {
    try {
      const data = JSON.parse(localStorage.getItem("quality_check_barcodes") || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  saveQCBarcodes(data: any[]) {
    localStorage.setItem("quality_check_barcodes", JSON.stringify(Array.isArray(data) ? data : []));
  }

  addQCBarcode(record: any) {
    const existing = this.getQCBarcodes();
    const barcodeValue = record.qcBarcode || record.displayBarcode || record.barcodeNumber || record.barcode;

    const existingQC = existing.find((qc: any) =>
      qc.batchId === record.batchId &&
      qc.microBatchNo === record.microBatchNo &&
      qc.productCode === record.productCode
    );

    if (existingQC) {
      return { ...existingQC, isDuplicate: true };
    }

    const newRecord = {
      ...record,
      qcBarcode: barcodeValue,
      displayBarcode: barcodeValue,
      barcodeNumber: barcodeValue,
      barcode: barcodeValue,
      currentStage: record.currentStage || "READY_FOR_QC_IN",
      createdAt: record.createdAt || new Date().toISOString(),
    };

    this.saveQCBarcodes([...existing, newRecord]);
    return newRecord;
  }

  updateQCBarcode(updatedRecord: any) {
    const barcodeValue =
      updatedRecord.qcBarcode ||
      updatedRecord.displayBarcode ||
      updatedRecord.barcodeNumber ||
      updatedRecord.barcode;

    const existing = this.getQCBarcodes();

    const updated = existing.map((item: any) => {
      const itemBarcode = item.qcBarcode || item.displayBarcode || item.barcodeNumber || item.barcode;
      return itemBarcode === barcodeValue ? { ...item, ...updatedRecord } : item;
    });

    this.saveQCBarcodes(updated);
    return updatedRecord;
  }

  deleteQCBarcode(barcodeValue: string) {
    const data = this.getQCBarcodes();
    const updated = data.filter((item: any) => {
      const value =
        item.qcBarcode ||
        item.displayBarcode ||
        item.barcodeNumber ||
        item.barcode;
      return value !== barcodeValue;
    });
    this.saveQCBarcodes(updated);
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

  async updateProductBarcode(updatedBarcode: any): Promise<boolean> {
    let list = this.getList('finished_product_barcodes');
    const idx = list.findIndex((item: any) => 
      (item.id && item.id === updatedBarcode.id) || 
      (item.barcode_no && item.barcode_no === updatedBarcode.barcodeNumber) ||
      (item.barcodeNumber && item.barcodeNumber === updatedBarcode.barcodeNumber)
    );
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updatedBarcode };
      this.saveList('finished_product_barcodes', list);
    }
    return true;
  }

  // ---- INVENTORY TRANSACTIONS ----

  async getInventoryTransactions(): Promise<any[]> {
    return this.getList('inventory_transactions') || [];
  }

  async saveInventoryTransactions(transactions: any[]) {
    this.saveList('inventory_transactions', transactions);
  }

  async createInventoryTransaction(transaction: any): Promise<any> {
    const list = await this.getInventoryTransactions();
    const newTx = { ...transaction, id: crypto.randomUUID(), createdAt: transaction.createdAt || new Date().toISOString() };
    list.push(newTx);
    await this.saveInventoryTransactions(list);
    return newTx;
  }

  async getCurrentLocation(barcodeNumber: string): Promise<string | null> {
    const transactions = await this.getInventoryTransactions();
    // Filter transactions for this barcode and sort by createdAt descending
    const barcodeTxs = transactions
      .filter((tx: any) => tx.barcodeNumber === barcodeNumber)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (barcodeTxs.length === 0) return null;
    return barcodeTxs[0].toLocation;
  }



  // ---- AUDIT LOG ----
  async getInventoryAuditLogs(): Promise<any[]> {
    return this.getList('inventory_audit_log').sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createAuditLog(log: { barcodeNumber?: string, userId: string, action: string, details: string }): Promise<void> {
    const logs = this.getList('inventory_audit_log');
    logs.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...log
    });
    this.saveList('inventory_audit_log', logs);
  }

  // ---- TRANSACTION ENGINE ----
  async createInventoryTransfer(params: { barcodeNumber: string, itemType: string, itemName: string, productId?: string, quantity: number, unit: string, fromLocation: string, toLocation: string, referenceType: string, referenceId: string, userId: string }): Promise<any> {
    try {
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
      let seq = parseInt(localStorage.getItem('inventory_transaction_sequence') || '0', 10);
      seq++;
      localStorage.setItem('inventory_transaction_sequence', seq.toString());
      const transactionId = `TRX-${dateStr}-${seq.toString().padStart(6, '0')}`;

      const transaction = {
        id: crypto.randomUUID(),
        transactionId,
        barcodeNumber: params.barcodeNumber,
        itemType: params.itemType,
        itemName: params.itemName,
        productId: params.productId,
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
      
      // Create audit log
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

  // Aliased for backward compatibility with components that might use old name
  // @ts-ignore
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
    let list = this.getList('combo_available_products') || [];
    
    // Duplicate protection
    const exists = list.some((item: any) => item.sourceBarcodeId === comboProductUnit.sourceBarcodeId);
    if (exists) {
      return { success: false, message: "Already added to Combo stock" };
    }
    
    list.push({ ...comboProductUnit, id: crypto.randomUUID() });
    this.saveList('combo_available_products', list);
    return { success: true };
  }

  async getComboStockBalance(): Promise<any[]> {
    const releasedProducts = this.getProductsReleasedToCombo();
    // Consumed products would be products already PACKED_IN_COMBO
    /* const comboBarcodes = this.getList('combo_barcodes'); */ // actually, packed products are in finished_product_barcodes
    const allProducts = this.getList('finished_product_barcodes');

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
          product_name: key, // Keep capitalised name if possible, but key is normalized. We will use key for simplicity.
          available_units: available
        });
      }
    }

    return stockItems;
  }

  async verifyAndCompleteMicroBatchScan(_micro_batch_id: string): Promise<boolean> {
    // Deprecated for bulk combo adding, MB status is now updated during Save Barcode in Production
    return true;
  }

  async saveProductBarcodes(newBarcodes: any[]) {
    const existing = await this.getProductBarcodes();
    const merged = this.dedupeProductBarcodes([...existing, ...newBarcodes]);
    localStorage.setItem("finished_product_barcodes", JSON.stringify(merged));
  }

  // ---- LEDGER / ISSUES ----
  async getLedger() {
    return this.getList('inventory_ledger');
  }
  async saveLedgerEntry(entry: any) {
    const list = this.getList('inventory_ledger');
    list.push({ ...entry, id: entry.id || crypto.randomUUID(), created_at: new Date().toISOString() });
    this.saveList('inventory_ledger', list);
  }

  async saveRawMaterialIssue(issue: any) {
    const list = this.getList('inventory_ledger'); // Map issues to ledger
    list.push({ ...issue, id: issue.id || crypto.randomUUID(), type: 'issue', created_at: new Date().toISOString() });
    this.saveList('inventory_ledger', list);
  }

  // ---- SCAN HISTORY ----
  async getScanHistory() {
    return this.getList('inventory_scan_history');
  }

  async saveScanHistory(scanData: any) {
    const list = this.getList('inventory_scan_history');
    list.push({ ...scanData, id: crypto.randomUUID(), scanned_at: scanData.scanned_at || new Date().toISOString() });
    this.saveList('inventory_scan_history', list);
  }

  // ---- COMBO BOXES ----
  
  getComboBoxes() {
    try {
      const data = JSON.parse(localStorage.getItem("combo_boxes") || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async saveComboBox(box: any) {
    const list = this.getList('combo_boxes');
    const existingIndex = list.findIndex((b: any) => b.comboBoxBarcode === box.comboBoxBarcode);
    if (existingIndex > -1) {
      list[existingIndex] = { ...list[existingIndex], ...box };
    } else {
      list.push(box);
    }
    this.saveList('combo_boxes', list);
  }

  async removeProductFromBox(comboBoxBarcode: string, productBarcode: string) {
    const boxes = this.getList('combo_boxes');
    const boxIndex = boxes.findIndex((b: any) => b.comboBoxBarcode === comboBoxBarcode);
    if (boxIndex === -1) throw new Error('Combo box not found');
    
    const box = boxes[boxIndex];
    if (box.status === 'READY') throw new Error('Cannot remove products from a READY combo box');
    
    const productIndex = box.packedItems.findIndex((item: any) => 
      normalizeBarcode(item.sourceBarcode || item.barcodeNumber || item.barcode) === normalizeBarcode(productBarcode)
    );
    
    if (productIndex === -1) throw new Error('Product not found in this combo box');
    
    box.packedItems.splice(productIndex, 1)[0];
    
    // Update box status
    if (box.packedItems.length === 0) {
      box.status = 'EMPTY';
    } else {
      box.status = 'PARTIAL';
    }
    
    boxes[boxIndex] = box;
    this.saveList('combo_boxes', boxes);
    
    // Restore product status
    const mBar = normalizeBarcode(productBarcode);
    const released = this.getProductsReleasedToCombo();
    const relIdx = released.findIndex((r: any) => normalizeBarcode(r.sourceBarcode || r.barcodeNumber || r.barcode) === mBar);
    
    if (relIdx > -1) {
      released[relIdx].status = 'PRODUCT_OUT'; // Restore status
      this.saveList('product_released_to_combo', released);
    }
    
    // Attempt to update original product barcode
        let foundProdList = '';
    
    let prodRec = this.getList('finished_product_barcodes').find((p: any) => normalizeBarcode(p.barcode_no || p.barcodeNumber) === mBar);
    if (prodRec) foundProdList = 'finished_product_barcodes';
    
    if (!prodRec) {
      prodRec = this.getList('product_barcodes').find((p: any) => normalizeBarcode(p.barcode_no || p.barcodeNumber) === mBar);
      if (prodRec) foundProdList = 'product_barcodes';
    }
    
    if (prodRec && foundProdList) {
       prodRec.currentStage = 'PRODUCT_OUT';
       delete prodRec.packedComboBoxBarcode;
       const list = this.getList(foundProdList);
       const idx = list.findIndex((p: any) => normalizeBarcode(p.barcode_no || p.barcodeNumber) === mBar);
       if (idx > -1) {
         list[idx] = prodRec;
         this.saveList(foundProdList, list);
       }
    }
    
    return box;
  }

  // ---- COMBOS ----

  getActiveComboDrafts() {
    // Migrate old format if needed
    let drafts = JSON.parse(localStorage.getItem("combo_drafts") || "[]");
    let migrated = false;
    
    drafts = drafts.map((d: any) => {
      if (d.id && !d.comboDraftId) { d.comboDraftId = d.id; migrated = true; }
      if (d.combo_name && !d.comboName) { d.comboName = d.combo_name; migrated = true; }
      return d;
    });

    if (migrated) {
      localStorage.setItem("combo_drafts", JSON.stringify(drafts));
    }

    return drafts.filter((draft: any) =>
      draft.status === "DRAFT" || !draft.status
    );
  }

  async getComboDrafts() {
    return this.getList('combo_drafts');
  }

  async saveComboDraft(draft: any) {
    const list = this.getList('combo_drafts');
    const existingIndex = list.findIndex(d => d.comboDraftId === draft.comboDraftId);
    if (existingIndex > -1) {
      list[existingIndex] = { ...list[existingIndex], ...draft };
    } else {
      list.push({ ...draft, created_at: new Date().toISOString() });
    }
    this.saveList('combo_drafts', list);
  }

  async deleteComboDraft(draftId: string) {
    const list = this.getList('combo_drafts');
    const filtered = list.filter(d => d.comboDraftId !== draftId);
    this.saveList('combo_drafts', filtered);
  }


  async getComboTemplates() {
    return this.getList('combo_templates');
  }

  async getComboBatches() {
    return this.getList('combo_batches');
  }

  async getAllComboBarcodes() {
    const comboBoxes = this.getList('combo_boxes').map((b: any) => ({ 
      ...b, 
      type: 'COMBO_BOX',
      currentStage: b.currentStage || 'READY_FOR_FIRST_SCAN' 
    }));
    
    const products = await this.getProductBarcodes();
    
    const comboProducts = products.filter(b => b.packedComboBoxBarcode).map(b => {
      const box = comboBoxes.find(cb => cb.comboBoxBarcode === b.packedComboBoxBarcode);
      return {
        ...b,
        type: 'PRODUCT', // Explicitly label for combo views
        combo_name: box ? box.comboName : b.productName || b.product_name,
        batch_id: box ? box.comboBoxBarcode : 'UNASSIGNED_COMBO_STOCK'
      };
    });
    
    return [...comboBoxes, ...comboProducts];
  }

  async getComboBarcodes(batchId: string) {
    const barcodes = this.getList('combo_barcodes');
    return barcodes.filter((bc: any) => bc.batch_id === batchId);
  }

  async saveComboBatch(batch: any, comboInventory: any, fgDeductions: any[], barcodes: any[] = []) {
    // 1. Save Combo Batch
    const batches = this.getList('combo_batches');
    const batchRecord = { ...batch, id: batch.id || crypto.randomUUID(), created_at: new Date().toISOString() };
    batches.push(batchRecord);
    this.saveList('combo_batches', batches);

    // 2. Save Combo Inventory
    const comboInvList = this.getList('combo_inventory');
    comboInvList.push({ ...comboInventory, id: comboInventory.id || crypto.randomUUID(), batch_id: batchRecord.id, created_at: batchRecord.created_at });
    this.saveList('combo_inventory', comboInvList);

    // 3. Create OUT transactions from COMBO for the required ingredients
    for (const deduction of fgDeductions) {
      // Find what product code it was. Usually product_name in deductions is the code or name.
      // e.g. '1B'
      await this.createInventoryTransaction({
        barcodeNumber: `BULK-${deduction.product_name}-${batchRecord.id}`, // Bulk transaction since we aren't tracking individual bottle consumption out of combo yet
        itemType: 'PRODUCT',
        itemName: deduction.product_name,
        productCode: deduction.product_name,
        quantity: deduction.quantity,
        unit: 'Unit',
        fromLocation: 'COMBO',
        toLocation: 'CONSUMED',
        transactionType: 'OUT',
        referenceType: 'COMBO_CREATED',
        referenceId: batchRecord.id
      });
    }

    // 4. Create IN transaction for the COMBO BOX
    await this.createInventoryTransaction({
      barcodeNumber: batchRecord.batch_id,
      itemType: 'COMBO',
      itemName: batchRecord.combo_name,
      quantity: batchRecord.total_units,
      unit: 'Pack',
      fromLocation: 'PRODUCTION',
      toLocation: 'COMBO_INVENTORY',
      transactionType: 'IN',
      referenceType: 'COMBO_CREATED',
      referenceId: batchRecord.id
    });

    // 5. Save Movements
    const movements = this.getList('combo_movements');
    movements.push({
      id: crypto.randomUUID(),
      batch_id: batchRecord.id,
      combo_batch_id: batchRecord.id,
      combo_name: batchRecord.combo_name,
      combo_quantity: batchRecord.total_units,
      type: 'COMBO_CREATED',
      deducted_products: fgDeductions.reduce((acc, curr) => ({ ...acc, [curr.product_name]: curr.quantity }), {}),
      created_at: batchRecord.created_at
    });
    this.saveList('combo_movements', movements);

    // 6. Save Barcodes
    if (barcodes && barcodes.length > 0) {
      const barcodesList = this.getList('combo_barcodes');
      barcodes.forEach(bc => {
        barcodesList.push({ ...bc, batch_id: batchRecord.id, combo_batch_id: batchRecord.id, created_at: batchRecord.created_at });
      });
      this.saveList('combo_barcodes', barcodesList);
    }

    return batchRecord;
  }

  async updateComboBatchStatus(batchId: string, status: string) {
    const batches = this.getList('combo_batches');
    const idx = batches.findIndex(b => b.id === batchId);
    if (idx > -1) {
      batches[idx].status = status;
      this.saveList('combo_batches', batches);
    }
  }

  async reserveComboForOrder(comboBarcode: string, orderId: string) {
    const batches = this.getList('combo_batches');
    const batchIdx = batches.findIndex(b => b.batch_id === comboBarcode || b.id === comboBarcode);
    if (batchIdx === -1) throw new Error("Combo batch not found");
    const batch = batches[batchIdx];
    
    if (batch.status !== 'READY' && batch.status !== 'ACTIVE' && batch.status) {
      throw new Error(`Combo is not available. Current status: ${batch.status}`);
    }

    batch.status = 'ORDER_RESERVED';
    batch.reserved_for_order = orderId;
    this.saveList('combo_batches', batches);

    await this.createInventoryTransaction({
      barcodeNumber: batch.batch_id,
      itemType: 'COMBO',
      itemName: batch.combo_name,
      quantity: batch.total_units,
      unit: 'Pack',
      fromLocation: 'COMBO_INVENTORY',
      toLocation: 'ORDER_RESERVED',
      transactionType: 'TRANSFER',
      referenceType: 'ORDER_ALLOCATION',
      referenceId: orderId || batch.id
    });
    
    // movement history
    const m = this.getList('combo_movements');
    m.push({
      id: crypto.randomUUID(),
      batch_id: batch.id,
      combo_batch_id: batch.id,
      combo_name: batch.combo_name,
      combo_quantity: batch.total_units,
      type: 'ORDER_RESERVED',
      referenceId: orderId,
      created_at: new Date().toISOString()
    });
    this.saveList('combo_movements', m);

    return batch;
  }

  async dispatchCombo(comboBarcode: string) {
    const batches = this.getList('combo_batches');
    const batchIdx = batches.findIndex(b => b.batch_id === comboBarcode || b.id === comboBarcode);
    if (batchIdx === -1) throw new Error("Combo batch not found");
    const batch = batches[batchIdx];
    
    if (batch.status !== 'ORDER_RESERVED') {
      throw new Error(`Combo must be reserved for an order before dispatching. Current status: ${batch.status}`);
    }

    batch.status = 'DISPATCHED';
    this.saveList('combo_batches', batches);

    await this.createInventoryTransaction({
      barcodeNumber: batch.batch_id,
      itemType: 'COMBO',
      itemName: batch.combo_name,
      quantity: batch.total_units,
      unit: 'Pack',
      fromLocation: 'ORDER_RESERVED',
      toLocation: 'DISPATCHED',
      transactionType: 'OUT',
      referenceType: 'COMBO_DISPATCH',
      referenceId: batch.reserved_for_order || batch.id
    });

    const m = this.getList('combo_movements');
    m.push({
      id: crypto.randomUUID(),
      batch_id: batch.id,
      combo_batch_id: batch.id,
      combo_name: batch.combo_name,
      combo_quantity: batch.total_units,
      type: 'DISPATCHED',
      referenceId: batch.reserved_for_order,
      created_at: new Date().toISOString()
    });
    this.saveList('combo_movements', m);

    return batch;
  }

  async saveComboBarcode(barcodeData: any) {
    const list = this.getList('combo_barcodes');
    list.push({ ...barcodeData, id: crypto.randomUUID(), created_at: new Date().toISOString() });
    this.saveList('combo_barcodes', list);
    
    if (barcodeData.batch_id) {
      await this.updateComboBatchStatus(barcodeData.batch_id, 'READY');
    }
  }

  async getComboInventory() {
    return this.getList('combo_inventory');
  }

  async getComboMovements(batchId?: string) {
    const list = this.getList('combo_movements');
    return batchId ? list.filter((m: any) => m.batch_id === batchId) : list;
  }


  async deleteComboBatch(id: string): Promise<boolean> {
    const batches = this.getList('combo_batches');
    const batchIndex = batches.findIndex((b: any) => b.id === id);
    if (batchIndex === -1) throw new Error('Combo batch not found');

    const batch = batches[batchIndex];

    // Find movement to know what was deducted
    const movements = this.getList('combo_movements');
    const movement = movements.find((m: any) => m.combo_batch_id === id && m.type === 'COMBO_CREATED');

    if (movement && movement.deducted_products) {
      // 1. Create IN transactions to restore the stock back to COMBO location
      for (const [productCode, quantity] of Object.entries(movement.deducted_products)) {
        await this.createInventoryTransaction({
          barcodeNumber: `RESTORE-${productCode}-${batch.id}`,
          itemType: 'PRODUCT',
          itemName: productCode,
          productCode: productCode,
          quantity: quantity,
          unit: 'Unit',
          fromLocation: 'CONSUMED',
          toLocation: 'COMBO',
          transactionType: 'IN',
          referenceType: 'COMBO_DELETED',
          referenceId: batch.id
        });
      }
    }

    // 2. Create OUT transaction to destroy the COMBO BOX
    await this.createInventoryTransaction({
      barcodeNumber: batch.batch_id,
      itemType: 'COMBO',
      itemName: batch.combo_name,
      quantity: batch.total_units,
      unit: 'Pack',
      fromLocation: 'COMBO_INVENTORY',
      toLocation: 'DELETED',
      transactionType: 'OUT',
      referenceType: 'COMBO_DELETED',
      referenceId: batch.id
    });

    batches[batchIndex].status = 'DELETED';
    this.saveList('combo_batches', batches);

    const inventories = this.getList('combo_inventory');
    const invIndex = inventories.findIndex((i: any) => i.batch_id === id);
    if (invIndex !== -1) {
      inventories[invIndex].status = 'DELETED';
      this.saveList('combo_inventory', inventories);
    }

    const m = this.getList('combo_movements');
    m.push({
      id: crypto.randomUUID(),
      batch_id: id,
      combo_batch_id: id,
      combo_name: batch.combo_name,
      combo_quantity: batch.total_units,
      type: 'COMBO_DELETED',
      created_at: new Date().toISOString()
    });
    this.saveList('combo_movements', m);

    return true;
  }

  // ---- PERMANENT DELETION WORKFLOW (HARD DELETES) ----
  async deleteRawMaterialBarcode(serialNumber: string) {
    const batches = this.getList('inventory_batches');
    const filteredBatches = batches.filter(b => b.serial_number !== serialNumber);
    this.saveList('inventory_batches', filteredBatches);
  }

  async deleteProductBarcode(barcodeNo: string) {
    const barcodes = this.getList('finished_product_barcodes');
    const filteredBarcodes = barcodes.filter(b => b.barcode_no !== barcodeNo);
    this.saveList('finished_product_barcodes', filteredBarcodes);

    const released = this.getList('product_released_to_combo');
    const filteredReleased = released.filter(r => r.barcodeNumber !== barcodeNo && r.barcode !== barcodeNo && r.code !== barcodeNo && r.displayBarcode !== barcodeNo && r.sourceBarcode !== barcodeNo);
    this.saveList('product_released_to_combo', filteredReleased);
  }

  async deleteProductBarcodes(barcodeNos: string[]) {
    const barcodes = this.getList('finished_product_barcodes');
    const filteredBarcodes = barcodes.filter(b => !barcodeNos.includes(b.barcode_no));
    this.saveList('finished_product_barcodes', filteredBarcodes);

    const released = this.getList('product_released_to_combo');
    const filteredReleased = released.filter(r => {
      const matchValue = r.barcodeNumber || r.barcode || r.code || r.displayBarcode || r.sourceBarcode;
      return !barcodeNos.includes(matchValue);
    });
    this.saveList('product_released_to_combo', filteredReleased);
  }

  async deleteComboBox(comboBoxBarcode: string) {
    const boxes = this.getList('combo_boxes');
    const boxIndex = boxes.findIndex((b: any) => b.comboBoxBarcode === comboBoxBarcode);
    if (boxIndex === -1) return;
    
    const box = boxes[boxIndex];
    if (box.packedItems && box.packedItems.length > 0) {
      let releasedToCombo = this.getList('product_released_to_combo');
      let finishedBarcodes = this.getList('finished_product_barcodes');

      box.packedItems.forEach((item: any) => {
        const itemBarcode = normalizeBarcode(item.sourceBarcode || item.barcodeNumber || item.barcode);
        
        // Return to PRODUCT_OUT for product_released_to_combo
        const rIndex = releasedToCombo.findIndex((r: any) => normalizeBarcode(r.sourceBarcode || r.barcodeNumber || r.barcode || r.code || r.displayBarcode) === itemBarcode);
        if (rIndex > -1) {
          releasedToCombo[rIndex].status = 'AVAILABLE_FOR_COMBO';
          delete releasedToCombo[rIndex].packedComboBoxBarcode;
        }

        // For finished_product_barcodes
        const fIndex = finishedBarcodes.findIndex((f: any) => normalizeBarcode(f.barcode_no) === itemBarcode);
        if (fIndex > -1) {
          finishedBarcodes[fIndex].currentStage = 'PRODUCT_OUT';
          delete finishedBarcodes[fIndex].packedComboBoxBarcode;
        }
      });

      this.saveList('product_released_to_combo', releasedToCombo);
      this.saveList('finished_product_barcodes', finishedBarcodes);
    }

    boxes.splice(boxIndex, 1);
    this.saveList('combo_boxes', boxes);
  }

  async deleteComboBoxesBulk(comboBoxBarcodes: string[]) {
    for (const barcode of comboBoxBarcodes) {
      await this.deleteComboBox(barcode);
    }
  }

  async deleteComboBoxBarcode(batchId: string) {
    // 1. Delete COMBO_BOX and all linked PRODUCT barcodes
    const barcodes = this.getList('combo_barcodes');
    const filteredBarcodes = barcodes.filter(b => b.batch_id !== batchId);
    this.saveList('combo_barcodes', filteredBarcodes);

    // 2. Delete combo inventory
    const comboInvList = this.getList('combo_inventory');
    const filteredInvList = comboInvList.filter(inv => inv.batch_id !== batchId);
    this.saveList('combo_inventory', filteredInvList);

    // 3. Delete combo batch
    const batches = this.getList('combo_batches');
    const filteredBatches = batches.filter(b => b.id !== batchId);
    this.saveList('combo_batches', filteredBatches);

    // 4. Restore stock back to Finished Goods Inventory
    const movements = this.getList('combo_movements');
    const consumedMovements = movements.filter((m: any) => m.batch_id === batchId && m.type === 'consumed');
    
    const fgList = this.getList('finished_goods');
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
    this.saveList('finished_goods', fgList);
  }

  // ---- RAW MATERIAL DEDUCTION FOR PRODUCTION ----
  
  async validateIngredientAvailability(ingredients: any[]) {
    const releasedList = this.getRawMaterialsReleasedToProduct();
    const consumedStock = this.getProductionConsumedStock();
    
    const releasedStock = releasedList.reduce((acc: any, item: any) => {
      const key = normalizeMaterialKey(item.materialName || item.name || item.itemName);
      const qty = Number(item.quantity || 0);
      acc[key] = (acc[key] || 0) + qty;
      return acc;
    }, {});


    const status = [];
    
    for (const ing of ingredients) {
      const key = normalizeMaterialKey(ing.name);
      const availableKg = (releasedStock[key] || 0) - (consumedStock[key] || 0);
      
      
      status.push({
        name: ing.name,
        required: ing.required_quantity,
        available: Number(availableKg.toFixed(3)),
        sufficient: availableKg >= ing.required_quantity,
        shortage: availableKg < ing.required_quantity ? ing.required_quantity - availableKg : 0
      });
    }
    
    return status;
  }

  async deductRawMaterialsForProduction(ingredients: any[], productionBatchId: string, productCode: string) {
    const releasedList = this.getRawMaterialsReleasedToProduct();
    const consumedStock = this.getProductionConsumedStock();
    const ledger = this.getList('inventory_transactions');
    
    const releasedStock = releasedList.reduce((acc: any, item: any) => {
      const key = normalizeMaterialKey(item.materialName || item.name || item.itemName);
      const qty = Number(item.quantity || 0);
      acc[key] = (acc[key] || 0) + qty;
      return acc;
    }, {});

    // Step 1: Validate
    for (const ing of ingredients) {
      const key = normalizeMaterialKey(ing.name);
      const availableKg = (releasedStock[key] || 0) - (consumedStock[key] || 0);
      
      if (availableKg < ing.required_quantity) {
        throw new Error(`Insufficient stock for ${ing.name}. Required: ${ing.required_quantity}, Available: ${availableKg}`);
      }
    }

    // Step 2: Create Consume Transactions
    for (const ing of ingredients) {
      ledger.push({
        id: crypto.randomUUID(),
        transactionType: "PRODUCTION_CONSUME",
        itemName: ing.name,
        quantity: ing.required_quantity,
        fromStage: "RAW_MATERIAL_OUT",
        toStage: "PRODUCTION_CONSUMED",
        production_batch_id: productionBatchId,
        product_code: productCode,
        createdAt: new Date().toISOString()
      });
    }

    this.saveList('inventory_transactions', ledger);
    return true;
  }

  async restoreRawMaterialsForDeletedBatch(productionBatchId: string) {
    const ledger = this.getList('inventory_ledger');
    const rawBatches = this.getList('inventory_batches');
    let updated = false;
    
    // Find all issues for this batch
    const issues = ledger.filter((l: any) => l.production_batch_id === productionBatchId && (l.type === 'RAW_MATERIAL_ISSUE' || l.type === 'issue') && !l.is_returned);
    
    for (const issue of issues) {
      issue.is_returned = true; // Mark old record so we don't double return if somehow called twice
      
      const rawBatchIdx = rawBatches.findIndex((rb: any) => rb.serial_number === issue.raw_material_batch_id || rb.id === issue.raw_material_batch_id);
      
      if (rawBatchIdx > -1) {
        const batch = rawBatches[rawBatchIdx];
        const beforeAvail = Number(batch.available_quantity) || 0;
        const returnQty = Number(issue.quantity_issued);
        
        batch.available_quantity = beforeAvail + returnQty;
        batch.used_quantity = Math.max(0, (Number(batch.used_quantity) || 0) - returnQty);
        
        if (batch.status === 'Depleted') {
          batch.status = batch.available_quantity < (Number(batch.original_quantity) * 0.2) ? 'Low Stock' : 'Active';
        }
        
        // Create RETURN ledger
        ledger.push({
          id: crypto.randomUUID(),
          type: 'RAW_MATERIAL_RETURN',
          production_batch_id: productionBatchId,
          product_code: issue.product_code,
          ingredient: issue.ingredient || issue.material_name,
          material_name: issue.material_name,
          raw_material_batch_id: issue.raw_material_batch_id,
          barcode_no: issue.barcode_no,
          vendor: issue.vendor,
          quantity_issued: returnQty,
          before_available: beforeAvail,
          after_available: batch.available_quantity,
          issued_at: new Date().toISOString(),
          issued_by: 'System',
          status: 'ACTIVE'
        });
        
        updated = true;
      }
    }
    
    if (updated) {
      this.saveList('inventory_batches', rawBatches);
      this.saveList('inventory_ledger', ledger);
    }
  }

  async getProductionMaterialConsumption(batchId: string) {
    const ledger = this.getList('inventory_ledger');
    return ledger.filter((l: any) => l.production_batch_id === batchId && l.type === 'RAW_MATERIAL_ISSUE');
  }

  // ---- NEW: 3-DEPARTMENT BARCODE WORKFLOW ENGINE ----
  

  getProductionAvailableStock() {
    const rawBarcodes = this.getList('inventory_batches'); 
    const stock: Record<string, any> = {};

    rawBarcodes.forEach((item: any) => {
      if (item.currentStage !== "RAW_MATERIAL_OUT") return;

      const key = normalizeMaterialKey(
        item.materialName || item.name || item.itemName || item.material_name || item.material
      );

      const qty = Number(item.quantity || item.available_quantity || item.original_quantity || item.available || 0);

      if (!key || qty <= 0) return;

      if (!stock[key]) {
        stock[key] = {
          materialName: item.materialName || item.name || item.itemName || item.material_name || item.material,
          availableKg: 0,
          unit: item.unit || "KG",
          sourceBarcodes: []
        };
      }

      const bc = item.barcodeNumber || item.barcode_no || item.serial_number || item.barcode;
      if (!stock[key].sourceBarcodes.includes(bc)) {
        stock[key].availableKg += qty;
        stock[key].sourceBarcodes.push(bc);
      }
    });

    return stock;
  }

  getProductionConsumedStock() {
    const transactions = this.getList('inventory_transactions');
    const consumed: Record<string, number> = {};

    transactions.forEach((tx: any) => {
      if (tx.transactionType !== "PRODUCTION_CONSUME") return;

      const key = normalizeMaterialKey(tx.itemName || tx.materialName);
      consumed[key] = (consumed[key] || 0) + Number(tx.quantity || 0);
    });

    return consumed;
  }

  async getProductionMaterialStock() {
    const rawStock = this.getReleasedRawMaterialStock();
    const formatted: any = {};
    Object.keys(rawStock).forEach(key => {
      formatted[key] = { availableKg: Number(rawStock[key].toFixed(3)) };
    });
    return formatted;
  }

  async saveProductionMaterialStock(stock: any) {
    localStorage.setItem('production_material_stock', JSON.stringify(stock));
  }

  async addRawMaterialToProductionStock(rawMaterialBarcode: any) {
    const stock = await this.getProductionMaterialStock();

    const rawName =
      rawMaterialBarcode.materialName ||
      rawMaterialBarcode.name ||
      rawMaterialBarcode.itemName ||
      rawMaterialBarcode.material_name ||
      rawMaterialBarcode.item_name;

    const materialKey = normalizeMaterialKey(rawName);
    const qty = Number(rawMaterialBarcode.quantity || rawMaterialBarcode.original_quantity || 0);

    if (!materialKey || qty <= 0) {
      throw new Error("Invalid raw material barcode quantity or material name.");
    }

    const barcodeToSave = rawMaterialBarcode.barcodeNumber || rawMaterialBarcode.barcode_no || rawMaterialBarcode.serial_number;

    // We must find by normalized key. Wait, previous records might not be normalized. But we are starting fresh or normalizing now.
    // Duplicate protection
    if (stock[materialKey]?.sourceBarcodes?.includes(barcodeToSave)) {
        throw new Error("Raw material already released for production.");
    }

    stock[materialKey] = {
      materialName: rawName || "Unknown",
      availableKg: Number(stock[materialKey]?.availableKg || 0) + qty,
      unit: rawMaterialBarcode.unit || "KG",
      sourceBarcodes: [
        ...(stock[materialKey]?.sourceBarcodes || []),
        barcodeToSave
      ],
      updatedAt: new Date().toISOString()
    };

    await this.saveProductionMaterialStock(stock);
  }

  
  async deductFromProductionMaterialStock(ingredients: any[]) {
    const stock = await this.getProductionMaterialStock();
    
    for (const ing of ingredients) {
      const rawName = ing.material_name || ing.name;
      const materialKey = normalizeMaterialKey(rawName);
      const requiredQty = Number(ing.required_quantity || 0);
      
      if (!materialKey || requiredQty <= 0) continue;
      
      if (!stock[materialKey] || stock[materialKey].availableKg < requiredQty) {
        throw new Error(`Insufficient production stock for ${rawName}. Required: ${requiredQty}, Available: ${stock[materialKey]?.availableKg || 0}`);
      }
      
      stock[materialKey].availableKg -= requiredQty;
    }
    
    await this.saveProductionMaterialStock(stock);
  }

  
  async handleInventoryOutHandoff(barcodeRecord: any, fromDepartment: 'RAW_MATERIAL' | 'PRODUCT' | 'COMBO') {
    if (barcodeRecord.handoffCompleted) {
      return;
    }

    const now = new Date().toISOString();
    // let toLoc = '';

    if (fromDepartment === 'RAW_MATERIAL') {
      this.addRawMaterialReleasedToProduct({
        type: 'RAW_MATERIAL_RELEASED_TO_PRODUCT',
        sourceBarcode: getMasterBarcode(barcodeRecord) || barcodeRecord.serial_number || barcodeRecord.barcode_no,
        materialName: barcodeRecord.material_name || barcodeRecord.name,
        quantity: barcodeRecord.quantity || barcodeRecord.available_quantity || barcodeRecord.original_quantity || 0,
        unit: barcodeRecord.unit || 'kg',
        batch: barcodeRecord.batch_number || '',
        vendor: barcodeRecord.vendor_name || '',
        releasedAt: now
      });
      /* toLoc = 'PRODUCTION_AVAILABLE'; */
      barcodeRecord.handoffToDepartment = 'PRODUCTION';
    } else if (fromDepartment === 'PRODUCT') {
      this.addProductReleasedToCombo({
        type: 'PRODUCT_RELEASED_TO_COMBO',
        sourceBarcode: getMasterBarcode(barcodeRecord) || barcodeRecord.barcodeNumber || barcodeRecord.displayBarcode,
        productName: barcodeRecord.productName || barcodeRecord.product_name || barcodeRecord.name,
        productCode: barcodeRecord.productCode || barcodeRecord.product_code || '',
        quantity: 1,
        unit: 'Unit',
        batch: barcodeRecord.production_batch_id || barcodeRecord.batchNo || '',
        microBatch: barcodeRecord.microBatchNo || barcodeRecord.micro_batch_id || '',
        status: 'AVAILABLE_FOR_COMBO',
        releasedAt: now
      });
      /* toLoc = 'COMBO_AVAILABLE'; */
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
      /* toLoc = 'DISPATCH_AVAILABLE'; */
      barcodeRecord.handoffToDepartment = 'DISPATCH';
    }

    barcodeRecord.handoffCompleted = true;

    // We no longer manually mutate legacy available_stock items.
    // The UI must read from getRawMaterialsReleasedToProduct() or getProductsReleasedToCombo()
  }

  

  // ==========================================
  // DEPARTMENT HANDOFF RECORDS
  // ==========================================

  getRawMaterialsReleasedToProduct() {
    return this.getList('raw_material_released_to_product');
  }

  getReleasedRawMaterialStock() {
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
      const allProducts = [
        ...this.getProductsReleasedToCombo(),
        ...this.getList('finished_product_barcodes'),
        ...this.getList('finished_goods'),
        ...this.getList('product_barcodes'),
        ...this.getList('production_micro_batches')
      ];

      record = allProducts.find((item: any) => getMasterBarcode(item) === scannedCode);
      if (!record) {
        record = allProducts.find((item: any) => [item.displayBarcode, item.barcodeNumber, item.barcode, item.code, item.serial_number, item.barcode_no, item.batchNo, item.id].map(x => normalizeBarcode(x)).includes(scannedCode));
      }
      listKey = 'finished_product_barcodes';
    } else if (department === 'COMBO') {
      record = this.getList('combo_boxes').find((item: any) => getMasterBarcode(item) === scannedCode);
      if (!record) {
        record = this.getList('combo_boxes').find((item: any) => [item.comboBoxBarcode, item.displayBarcode, item.barcodeNumber, item.barcode, item.code, item.serial_number, item.barcode_no, item.batchNo, item.id].map(x => normalizeBarcode(x)).includes(scannedCode));
      }
      listKey = 'combo_boxes';
    } else if (department === 'QC') {
      record = this.getList('quality_check_barcodes').find((item: any) => getMasterBarcode(item) === scannedCode);
      if (!record) {
        record = this.getList('quality_check_barcodes').find((item: any) => [item.qcBarcode, item.displayBarcode, item.barcodeNumber].map(x => normalizeBarcode(x)).includes(scannedCode));
      }
      listKey = 'quality_check_barcodes';
    }

    if (!record) {
       console.error("FAILED SCAN. SCANNED CODE:", scannedCode, "DEPARTMENT:", department);
       if (department === 'RAW_MATERIAL')
       throw new Error(`Barcode ${barcodeNumber} does not exist in ${department === 'RAW_MATERIAL' ? 'Raw Materials' : department === 'PRODUCT' ? 'Products' : department === 'QC' ? 'Quality Check' : 'Combos'}.`);
    }

    const currentStage = record.currentStage || 'READY_FOR_FIRST_SCAN';
    let nextStage = '';
    let successMessage = '';

    if (department === 'RAW_MATERIAL') {
      if (scanAction === 'IN') {
        if (currentStage === 'READY_FOR_FIRST_SCAN') {
          nextStage = 'RAW_MATERIAL_IN';
          successMessage = 'Raw material received into Inventory IN.';
          record.inventoryInPersonName = payload?.personName || record.scanningPersonName || userId;
          record.inventoryInAt = new Date().toISOString();
        } else {
          throw new Error('Already scanned to Inventory IN. Go to Inventory OUT to release.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'RAW_MATERIAL_IN') {
          nextStage = 'RAW_MATERIAL_OUT';
          successMessage = 'Raw material moved to Inventory OUT (Ready for Production).';
          record.inventoryOutPersonName = payload?.personName || userId;
          record.inventoryOutAt = new Date().toISOString();
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
          record.inventoryInPersonName = payload?.personName || record.scanningPersonName || userId;
          record.inventoryInAt = new Date().toISOString();
        } else {
          throw new Error('Already scanned to Product Inventory IN.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'PRODUCT_IN') {
          nextStage = 'PRODUCT_OUT';
          successMessage = 'Product reserved for Combo (Inventory OUT).';
          record.inventoryOutPersonName = payload?.personName || userId;
          record.inventoryOutAt = new Date().toISOString();
          await this.handleInventoryOutHandoff(record, 'PRODUCT');
        } else if (currentStage === 'PRODUCT_OUT' || currentStage === 'PACKED_IN_COMBO') {
          throw new Error('Already released to Combo.');
        } else {
          throw new Error('Scan to Inventory IN first.');
        }
      } else if (scanAction === 'PACK') {
        const mBar = getMasterBarcode(record);
        
        if (currentStage === 'PACKED_IN_COMBO') throw new Error('This product is already packed in a combo.');
        if (currentStage !== 'PRODUCT_OUT') throw new Error('This product is not released to Combo yet.');

        const comboBoxBarcode = payload?.comboBoxBarcode;
        if (!comboBoxBarcode) throw new Error('Please specify a combo box barcode before packing.');

        const boxes = this.getList('combo_boxes');
        const boxIndex = boxes.findIndex((b: any) => b.comboBoxBarcode === comboBoxBarcode);
        if (boxIndex === -1) throw new Error('Combo box not found.');
        const activeBox = boxes[boxIndex];

        if (activeBox.status === 'READY') throw new Error('This combo box is already fully packed.');

        if (activeBox.packedItems.find((item: any) => getMasterBarcode(item) === mBar)) {
          throw new Error('This product is already packed in this combo box.');
        }

        const normalizeProductCode = (item: any) => {
          const name = String(item.productName || item.product_name || "").toLowerCase();
          const code = String(item.productCode || item.product_code || item.variantCode || "").toUpperCase();
          if (code) return code;
          if (name.includes("liquid a") || name.includes("blue") || name.includes("1b")) return "1B";
          if (name.includes("liquid y") || name.includes("yellow") || name.includes("1y")) return "1Y";
          if (name.includes("fabric") || name.includes("pink") || name.includes("1p")) return "1P";
          if (name.includes("sponge") || name.includes("1s")) return "1S";
          return "";
        };

        const pCode = normalizeProductCode(record);
        
        let requiredMatch = activeBox.requiredItems.find((req: any) => req.productCode === pCode);
        
        if (!requiredMatch) {
           throw new Error(`Wrong product. This combo requires: ${activeBox.requiredItems.map((r:any) => r.productCode).join(' + ')}.`);
        }
        
        const alreadyPackedOfThisType = activeBox.packedItems.filter((p:any) => normalizeProductCode(p) === pCode).length;
        if (alreadyPackedOfThisType >= requiredMatch.requiredQty) {
           throw new Error(`Box already has enough ${pCode} (${alreadyPackedOfThisType}/${requiredMatch.requiredQty}).`);
        }
        
        const fullBarcodes = this.getProductBarcodes();
        const bIndex = fullBarcodes.findIndex((b: any) => getMasterBarcode(b) === mBar);
        if (bIndex !== -1) {
            fullBarcodes[bIndex].currentStage = 'PACKED_IN_COMBO';
            fullBarcodes[bIndex].packedComboBoxBarcode = comboBoxBarcode;
            this.saveProductBarcodes(fullBarcodes);
        }

        record.packedAt = now;
        record.packedBy = userId;
        record.packedComboBoxBarcode = comboBoxBarcode;
        activeBox.packedItems.push(record);

        // @ts-ignore
        const totalRequired = activeBox.requiredItems.reduce((acc: number, cur: any) => acc + (cur.requiredQty || 1), 0);
        
        // Check if fully packed
        let isReady = true;
        activeBox.requiredItems.forEach((req: any) => {
           const count = activeBox.packedItems.filter((p:any) => normalizeProductCode(p) === req.productCode).length;
           if (count < req.requiredQty) isReady = false;
        });
        
        activeBox.status = isReady ? 'READY' : 'PARTIAL';
        
        boxes[boxIndex] = activeBox;
        this.saveList('combo_boxes', boxes);

        nextStage = 'PACKED_IN_COMBO';
        successMessage = `Product ${pCode} packed into Box ${comboBoxBarcode}.`;
      }
    } else if (department === 'COMBO') {
      if (scanAction === 'IN') {
        const boxes = this.getList('combo_boxes');
        const box = boxes.find((b: any) => b.comboBoxBarcode === record.comboBoxBarcode || b.comboBoxBarcode === record.barcode_no);
        if (box && box.status !== 'READY') {
          throw new Error('This combo box is empty or partially packed. Add products first.');
        }

        if (currentStage === 'READY_FOR_FIRST_SCAN') {
          nextStage = 'COMBO_IN';
          successMessage = 'Combo received into Combo Inventory IN.';
          record.comboInventoryInPersonName = payload?.personName || userId;
          record.comboInventoryInAt = new Date().toISOString();
        } else {
          throw new Error('Already scanned to Combo Inventory IN.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'COMBO_IN') {
          nextStage = 'COMBO_OUT';
          successMessage = 'Combo moved to Inventory OUT (Ready for Dispatch).';
          record.comboInventoryOutPersonName = payload?.personName || userId;
          record.comboInventoryOutAt = new Date().toISOString();
          await this.handleInventoryOutHandoff(record, 'COMBO');
        } else if (currentStage === 'COMBO_OUT' || currentStage === 'DISPATCHED') {
          throw new Error('Already moved out.');
        } else {
          throw new Error('Scan to Inventory IN first.');
        }
      }
    } else if (department === 'QC') {
      if (scanAction === 'IN') {
        if (currentStage === 'READY_FOR_QC_IN') {
          nextStage = 'QC_IN';
          successMessage = 'Quality Check barcode received into QC Inventory IN.';
          record.qcInPersonName = payload?.personName || userId;
          record.qcInAt = new Date().toISOString();
        } else {
          throw new Error('Already scanned to QC Inventory IN.');
        }
      } else if (scanAction === 'OUT') {
        if (currentStage === 'QC_IN') {
          nextStage = 'QC_OUT';
          successMessage = 'Quality Check barcode moved to QC Inventory OUT.';
          record.qcOutPersonName = payload?.personName || userId;
          record.qcOutAt = new Date().toISOString();
        } else if (currentStage === 'QC_OUT') {
          throw new Error('Already scanned out.');
        } else {
          throw new Error('Scan to QC IN first.');
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
      referenceType: 'SCAN',
      referenceId: record.batch_id || record.id,
      userId: userId
    });

    return { success: true, message: successMessage, stage: nextStage, item: record };
  }

  packProductIntoComboBox({ comboBoxBarcode, productBarcode, addedBy }: any) {
    try {
      const normalizeProductCode = (item: any) => {
        const name = String(item.productName || item.product_name || "").toLowerCase();
        const code = String(item.productCode || item.product_code || item.variantCode || "").toUpperCase();
        if (code) return code;
        if (name.includes("liquid a") || name.includes("blue") || name.includes("1b")) return "1B";
        if (name.includes("liquid y") || name.includes("yellow") || name.includes("1y")) return "1Y";
        if (name.includes("fabric") || name.includes("pink") || name.includes("1p")) return "1P";
        if (name.includes("sponge") || name.includes("1s")) return "1S";
        return "";
      };

      const getMasterBarcode = (item: any) => String(item.barcode_no || item.barcodeNumber || item.barcode || "").trim().toUpperCase();
      const mBar = String(productBarcode || "").trim().toUpperCase();

      const combo_boxes = this.getList("combo_boxes");
      const boxIndex = combo_boxes.findIndex((b: any) => b.comboBoxBarcode === comboBoxBarcode);
      if (boxIndex === -1) return { success: false, message: "Combo box not found." };
      const comboBox = combo_boxes[boxIndex];

      if (comboBox.status === 'READY') return { success: false, message: "This combo box is already fully packed." };

      if (comboBox.packedItems?.find((item: any) => getMasterBarcode(item) === mBar)) {
        return { success: false, message: "This product is already packed in this combo box." };
      }

      const products = this.getProductBarcodes();
      const prodIndex = products.findIndex((p: any) => getMasterBarcode(p) === mBar);
      if (prodIndex === -1) return { success: false, message: "Product barcode not found." };
      const product = products[prodIndex];

      if (product.currentStage !== "PRODUCT_OUT") {
        return { success: false, message: "Product is not released to Combo yet (Must be PRODUCT_OUT)." };
      }

      if (product.packedComboBoxBarcode) {
        return { success: false, message: `Product is already packed in box: ${product.packedComboBoxBarcode}` };
      }

      const pCode = normalizeProductCode(product);
      if (!comboBox.requiredItems) return { success: false, message: "Combo box has no required items." };

      let requiredMatch = comboBox.requiredItems.find((req: any) => req.productCode === pCode);
      if (!requiredMatch) {
        return { success: false, message: `Wrong product. This combo requires: ${comboBox.requiredItems.map((r:any) => r.productCode).join(' + ')}.` };
      }

      if (!comboBox.packedItems) comboBox.packedItems = [];
      const alreadyPacked = comboBox.packedItems.filter((p:any) => normalizeProductCode(p) === pCode).length;
      if (alreadyPacked >= requiredMatch.requiredQty) {
        return { success: false, message: `Box already has enough ${pCode} (${alreadyPacked}/${requiredMatch.requiredQty}).` };
      }

      // Pack it
      const packedProduct = { ...product };
      packedProduct.currentStage = "PACKED_IN_COMBO";
      packedProduct.packedComboBoxBarcode = comboBoxBarcode;
      packedProduct.addedAt = new Date().toISOString();
      packedProduct.addedBy = addedBy || "Admin";

      comboBox.packedItems.push(packedProduct);

      // Update product in master list
      products[prodIndex] = packedProduct;

      // Update box status
      let isReady = true;
      let totalPacked = 0;
      comboBox.requiredItems.forEach((req: any) => {
        const count = comboBox.packedItems.filter((p:any) => normalizeProductCode(p) === req.productCode).length;
        totalPacked += count;
        if (count < req.requiredQty) isReady = false;
      });

      comboBox.status = totalPacked === 0 ? 'EMPTY' : (isReady ? 'READY' : 'PARTIAL');
      
      combo_boxes[boxIndex] = comboBox;

      this.saveList("combo_boxes", combo_boxes);
      this.saveList("finished_product_barcodes", products);

      return { success: true, message: "Product added to combo box.", comboBox };
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to pack product." };
    }
  }

  getComboAvailableProductStock() {
    const products = this.getProductBarcodes();

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
}

export const inventoryService = new LocalInventoryService();
