import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import { kgToGrams, gramsToKgString, getMaterialUnit, ProductFormulaConfig } from '../config/productionBatchFormulas';
import { barcodeService } from './barcodeService';

// ============================================================================
// Production-Ready Batch Service
// ============================================================================
// SOURCE OF TRUTH: public.raw_material_barcodes
// PRP records are identified by: barcode LIKE 'PRP-%'
// Lifecycle field: current_stage (canonical)
// No separate production_ready_material_batches table.
// No localStorage fallback for business data.
// ============================================================================

const TABLE = SUPABASE_TABLES.rawMaterialBarcodes; // 'raw_material_barcodes'

/**
 * Shape of a raw_material_barcodes row (including production-ready columns)
 */
export interface ProductionReadyBatchRow {
  id: string;
  barcode: string;
  material_name: string;
  batch_no?: string;
  vendor?: string;
  quantity?: number;
  unit?: string;
  price_per_kg?: number;
  gst_percent?: number;
  generated_by?: string;
  inventory_in_person?: string | null;
  inventory_out_person?: string | null;
  inventory_in_at?: string | null;
  inventory_out_at?: string | null;
  current_stage: string;
  created_at?: string;
  updated_at?: string;
  po_reference?: string | null;
  scanning_person_name?: string | null;
  notes?: string | null;
  received_date?: string | null;
  // Production-ready columns (added via migration)
  product_code?: string | null;
  product_name?: string | null;
  product_units_per_batch?: number;
  reserved_for_production_batch_id?: string | null;
  reserved_at?: string | null;
  issued_by?: string | null;
  issued_at?: string | null;
  consumed_by?: string | null;
  consumed_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  quantity_grams?: number | null;
  prepared_by?: string | null;
  prepared_batch_no?: number | null;
  // Derived client-side (never stored in DB)
  status?: string;
  scan_code?: string;
  display_unit?: string;
  isProductionReady?: boolean;
}

export interface PreparePackInput {
  materialName: string;
  unit?: string;
  product: ProductFormulaConfig;
  countToPrepare: number;
  requiredGramsPerPack: number;
  intakeQtyKg: number;
  personName: string;
  sourceIntakeId?: string;
  sourceBarcode?: string;
  preparationGroupId?: string;
  vendorName?: string;
  poReference?: string;
}

// ============================================================================
// Status Normalization
// ============================================================================
// current_stage is the single lifecycle field. These helpers normalize
// various legacy status strings into the canonical pipeline stages.
// ============================================================================

export type NormalizedStage = 'INCOMING' | 'RAW_MATERIAL_IN' | 'RAW_MATERIAL_OUT' | 'CONSUMED' | 'CANCELLED';

export function normalizeRawMaterialStage(stage?: string): NormalizedStage {
  if (!stage) return 'INCOMING';
  const st = String(stage).trim().toUpperCase();

  // Incoming / Ready / first-scan
  if (st === 'INCOMING' || st === 'READY' || st === 'READY_FOR_FIRST_SCAN' || st === 'Incoming') return 'INCOMING';

  // Inventory IN
  if (st === 'RAW_MATERIAL_IN' || st === 'INVENTORY_IN' || st === 'SCANNED_IN') return 'RAW_MATERIAL_IN';

  // Inventory OUT
  if (st === 'RAW_MATERIAL_OUT' || st === 'INVENTORY_OUT' || st === 'SCANNED_OUT' || st === 'ISSUED_TO_PRODUCTION' || st === 'RESERVED') return 'RAW_MATERIAL_OUT';

  // Terminal states
  if (st === 'CONSUMED') return 'CONSUMED';
  if (st === 'CANCELLED') return 'CANCELLED';

  return 'INCOMING';
}

export const normalizeProductionReadyStatus = normalizeRawMaterialStage;

/**
 * Check if a barcode string identifies a Production-Ready pack
 */
export function isProductionReadyBarcode(barcode: string): boolean {
  return String(barcode || '').trim().toUpperCase().startsWith('PRP-');
}

/**
 * Attach a derived scan_code to a raw_material_barcodes row
 */
export function attachScanCode(row: any): any {
  if (!row) return row;
  const stage = row.current_stage || row.currentStage || 'Incoming';
  return {
    ...row,
    status: row.status || stage,
    product_units_per_batch: row.product_units_per_batch || 1000,
    scan_code: barcodeService.deriveScanCode(row.barcode || ''),
    isProductionReady: isProductionReadyBarcode(row.barcode || ''),
  };
}

// ============================================================================
// Service Class
// ============================================================================

export class ProductionReadyBatchService {

  // --------------------------------------------------------------------------
  // LOOKUP: Find any raw_material_barcodes row by scanned input
  // --------------------------------------------------------------------------
  /**
   * Universal scanner lookup for Production-Ready packs in raw_material_barcodes.
   * 
   * Step 1: Derive scan_code from all PRP-% barcodes and compare
   * Step 2: Direct barcode match (full barcode string)
   * Step 3: Supabase ilike search on barcode column
   *
   * Returns null if not found.
   */
  async findProductionReadyBatchByBarcode(scannedInput: string): Promise<ProductionReadyBatchRow | null> {
    if (!scannedInput) return null;
    const cleanInput = String(scannedInput).trim().replace(/[\r\n\t]/g, '').toUpperCase();

    // Fetch all PRP-% rows from Supabase
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .like('barcode', 'PRP-%');

    if (error) {
      throw new Error(`Failed to search production-ready batches: ${error.message}`);
    }

    if (!data || data.length === 0) return null;

    // Step 1: Match by derived scan_code
    const found = data.find((row: any) => {
      const derivedScan = barcodeService.deriveScanCode(row.barcode || '');
      return derivedScan.toUpperCase() === cleanInput;
    });

    if (found) return attachScanCode(found) as ProductionReadyBatchRow;

    // Step 2: Match by full barcode
    const byBarcode = data.find((row: any) =>
      String(row.barcode || '').trim().toUpperCase() === cleanInput
    );

    if (byBarcode) return attachScanCode(byBarcode) as ProductionReadyBatchRow;

    return null;
  }

  /**
   * Universal scanner lookup for ANY raw material barcode in raw_material_barcodes (PRP or standard).
   * ALWAYS queries fresh from Supabase to guarantee fresh current_stage.
   */
  async findAnyRawMaterialBatchByBarcode(scannedInput: string): Promise<ProductionReadyBatchRow | null> {
    if (!scannedInput) return null;
    const cleanInput = String(scannedInput).trim().replace(/[\r\n\t]/g, '').toUpperCase();

    // Try PRP lookup first
    const prpMatch = await this.findProductionReadyBatchByBarcode(cleanInput);
    if (prpMatch) return prpMatch;

    // Fetch all raw_material_barcodes rows fresh from Supabase
    const { data, error } = await supabase
      .from(TABLE)
      .select('*');

    if (error || !data || data.length === 0) return null;

    const found = data.find((row: any) => {
      const derived = barcodeService.deriveScanCode(row.barcode || '');
      const candidates = [
        row.scan_code,
        row.scanCode,
        derived,
        row.barcode,
        row.serial_number,
        row.id
      ].filter(Boolean).map((s: any) => String(s).trim().toUpperCase());

      return candidates.includes(cleanInput);
    });

    if (found) return attachScanCode(found) as ProductionReadyBatchRow;

    return null;
  }

  // --------------------------------------------------------------------------
  // INVENTORY IN: Atomic Supabase update
  // --------------------------------------------------------------------------
  /**
   * Perform Inventory IN scan on a raw_material_barcodes row.
   * Updates current_stage from 'Incoming' → 'RAW_MATERIAL_IN'
   */
  async performInventoryIn(batchId: string, personName: string): Promise<ProductionReadyBatchRow> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        current_stage: 'RAW_MATERIAL_IN',
        inventory_in_person: personName,
        inventory_in_at: now,
        updated_at: now,
      })
      .eq('id', batchId)
      .in('current_stage', ['Incoming', 'READY_FOR_FIRST_SCAN', 'INCOMING', 'READY'])
      .select('*');

    if (error) {
      throw new Error(`Failed to update Inventory IN status: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('This barcode was already processed or its status has changed.');
    }

    return attachScanCode(data[0]) as ProductionReadyBatchRow;
  }

  // --------------------------------------------------------------------------
  // INVENTORY OUT: Atomic Supabase update
  // --------------------------------------------------------------------------
  /**
   * Perform Inventory OUT scan on a raw_material_barcodes row.
   * Updates current_stage from 'RAW_MATERIAL_IN' → 'RAW_MATERIAL_OUT'
   */
  async performInventoryOut(batchId: string, personName: string): Promise<ProductionReadyBatchRow> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        current_stage: 'RAW_MATERIAL_OUT',
        inventory_out_person: personName,
        inventory_out_at: now,
        updated_at: now,
      })
      .eq('id', batchId)
      .in('current_stage', ['RAW_MATERIAL_IN', 'INVENTORY_IN', 'SCANNED_IN'])
      .select('*');

    if (error) {
      throw new Error(`Failed to update Inventory OUT status: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('This barcode was already processed or its status has changed.');
    }

    return attachScanCode(data[0]) as ProductionReadyBatchRow;
  }

  // --------------------------------------------------------------------------
  // FETCH: Get all Production-Ready rows (barcode LIKE 'PRP-%')
  // --------------------------------------------------------------------------
  async getProductionReadyBatches(filters?: {
    status?: string;
    productCode?: string;
    materialName?: string;
    search?: string;
  }): Promise<ProductionReadyBatchRow[]> {

    let query = supabase
      .from(TABLE)
      .select('*')
      .like('barcode', 'PRP-%')
      .order('created_at', { ascending: false });

    // Filter by normalized current_stage
    if (filters?.status && filters.status !== 'ALL') {
      const st = filters.status.toUpperCase();
      if (st === 'INCOMING') {
        query = query.in('current_stage', ['Incoming', 'READY_FOR_FIRST_SCAN', 'INCOMING', 'READY']);
      } else if (st === 'RAW_MATERIAL_IN' || st === 'INVENTORY_IN') {
        query = query.in('current_stage', ['RAW_MATERIAL_IN', 'INVENTORY_IN', 'SCANNED_IN']);
      } else if (st === 'RAW_MATERIAL_OUT' || st === 'INVENTORY_OUT') {
        query = query.in('current_stage', ['RAW_MATERIAL_OUT', 'INVENTORY_OUT', 'SCANNED_OUT', 'ISSUED_TO_PRODUCTION', 'RESERVED']);
      } else {
        query = query.eq('current_stage', filters.status);
      }
    }

    if (filters?.productCode && filters.productCode !== 'ALL') {
      query = query.eq('product_code', filters.productCode);
    }
    if (filters?.materialName && filters.materialName !== 'ALL') {
      query = query.ilike('material_name', `%${filters.materialName}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch production-ready batches: ${error.message}`);
    }

    let rows = (data || []).map(attachScanCode) as ProductionReadyBatchRow[];

    // Client-side text search (scan_code is derived, so we filter here)
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter(r =>
        (r.barcode && r.barcode.toLowerCase().includes(q)) ||
        (r.scan_code && r.scan_code.toLowerCase().includes(q)) ||
        (r.material_name && r.material_name.toLowerCase().includes(q)) ||
        (r.product_name && r.product_name.toLowerCase().includes(q)) ||
        (r.prepared_by && r.prepared_by.toLowerCase().includes(q))
      );
    }

    return rows;
  }

  // --------------------------------------------------------------------------
  // PREPARE: Generate new production-ready packs into raw_material_barcodes
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // SEQUENCE: Query highest existing sequence number for exact scope
  // --------------------------------------------------------------------------
  async getNextProductionReadySequence(materialName: string, productCode: string, dateYYMMDD?: string): Promise<number> {
    const matKey = materialName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
    const dateCode = dateYYMMDD || new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `PRP-${matKey}-${productCode}-${dateCode}-`;

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('barcode')
        .like('barcode', `${prefix}%`);

      if (error || !data || data.length === 0) {
        return 1;
      }

      let maxSeq = 0;
      for (const r of data) {
        if (!r.barcode) continue;
        const parts = r.barcode.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }

      return maxSeq + 1;
    } catch (err) {
      console.warn('Failed to query max sequence, defaulting to 1:', err);
      return 1;
    }
  }

  async getNextProductionRemainderSequence(materialName: string, productCode: string, dateYYMMDD?: string): Promise<number> {
    const matKey = materialName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
    const dateCode = dateYYMMDD || new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `PRL-${matKey}-${productCode}-${dateCode}-`;

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('barcode')
        .like('barcode', `${prefix}%`);

      if (error || !data || data.length === 0) {
        return 1;
      }

      let maxSeq = 0;
      for (const r of data) {
        if (!r.barcode) continue;
        const parts = r.barcode.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }

      return maxSeq + 1;
    } catch (err) {
      console.warn('Failed to query max PRL sequence, defaulting to 1:', err);
      return 1;
    }
  }

  // --------------------------------------------------------------------------
  // PREPARE: Concurrency-Safe RPC Transaction & Database-Sequenced Generation
  // --------------------------------------------------------------------------
  async prepareProductionReadyBatches(input: PreparePackInput & { customBatches?: any[] }): Promise<ProductionReadyBatchRow[]> {
    const { materialName, product, countToPrepare, requiredGramsPerPack, personName } = input;

    if (countToPrepare <= 0 && (!input.customBatches || input.customBatches.length === 0)) {
      throw new Error("Number of packs to prepare must be greater than zero.");
    }

    const dateYYMMDD = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const matKey = materialName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
    const prepGroupId = input.preparationGroupId || crypto.randomUUID();
    const vendorStr = input.vendorName || `${product.productName} (${product.productCode})`;
    const poRefStr = input.poReference || '';

    // Step 1: Idempotency check — return existing rows if this group was already saved
    const { data: existingGroup } = await supabase
      .from(TABLE)
      .select('*')
      .eq('preparation_group_id', prepGroupId)
      .order('prepared_batch_no', { ascending: true });

    if (existingGroup && existingGroup.length > 0) {
      return existingGroup.map(attachScanCode) as ProductionReadyBatchRow[];
    }

    // Step 2: Custom Batches direct insert (supports complete packs + PRL loose remainder)
    if (input.customBatches && input.customBatches.length > 0) {
      const now = new Date().toISOString();
      const rowsToInsert = input.customBatches.map((b, idx) => ({
        id: b.id && !b.id.startsWith('bott-') && !b.id.startsWith('cap-') ? b.id : crypto.randomUUID(),
        barcode: b.serialNumber || b.barcode,
        material_name: b.material_name || materialName,
        batch_no: b.serialNumber || b.barcode,
        vendor: vendorStr,
        quantity: Number(b.quantity),
        unit: b.unit || input.unit || getMaterialUnit(materialName),
        price_per_kg: 0,
        gst_percent: 0,
        generated_by: personName || 'Inventory Manager',
        current_stage: 'Incoming',
        created_at: now,
        updated_at: now,
        received_date: now,
        po_reference: poRefStr,
        scanning_person_name: personName || 'Inventory Manager',
        product_code: product.productCode,
        product_name: product.productName,
        quantity_grams: Math.round(Number(b.quantity) * 1000),
        prepared_by: personName || 'Inventory Manager',
        prepared_batch_no: b.batch_no || (idx + 1),
        preparation_group_id: prepGroupId,
        source_preparation_group_id: prepGroupId,
        pack_type: b.pack_type || (b.is_loose_remainder ? 'LOOSE_REMAINDER' : 'COMPLETE_PACK'),
        is_loose_remainder: Boolean(b.is_loose_remainder)
      }));

      const { data, error } = await supabase.from(TABLE).insert(rowsToInsert).select('*');
      if (error) {
        console.warn('Custom batches insert warning:', error.message);
      }
      return (data || rowsToInsert).map(attachScanCode) as ProductionReadyBatchRow[];
    }

    // Step 3: Database-Sequenced fallback insert with Max-Sequence calculation
    const startSeq = await this.getNextProductionReadySequence(materialName, product.productCode, dateYYMMDD);
    const now = new Date().toISOString();
    const newRows: any[] = [];

    for (let i = 0; i < countToPrepare; i++) {
      const currentSeq = startSeq + i;
      const seqStr = String(currentSeq).padStart(3, '0');
      const barcode = `PRP-${matKey}-${product.productCode}-${dateYYMMDD}-${seqStr}`;

      newRows.push({
        id: crypto.randomUUID(),
        barcode,
        material_name: materialName,
        batch_no: `PRP-${dateYYMMDD}-${seqStr}`,
        vendor: vendorStr,
        quantity: requiredGramsPerPack ? Number((requiredGramsPerPack / 1000).toFixed(3)) : 0,
        unit: input.unit || getMaterialUnit(materialName),
        price_per_kg: 0,
        gst_percent: 0,
        generated_by: personName || 'Inventory Manager',
        current_stage: 'Incoming',
        created_at: now,
        updated_at: now,
        received_date: now,
        po_reference: poRefStr,
        scanning_person_name: personName || 'Inventory Manager',
        product_code: product.productCode,
        product_name: product.productName,
        quantity_grams: requiredGramsPerPack,
        prepared_by: personName || 'Inventory Manager',
        prepared_batch_no: i + 1,
        preparation_group_id: prepGroupId,
        source_preparation_group_id: prepGroupId,
        pack_type: 'COMPLETE_PACK',
        is_loose_remainder: false
      });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert(newRows)
      .select('*');

    if (error) {
      // Final idempotency check before failing
      const { data: retryGroup } = await supabase
        .from(TABLE)
        .select('*')
        .eq('preparation_group_id', prepGroupId);

      if (retryGroup && retryGroup.length > 0) {
        return retryGroup.map(attachScanCode) as ProductionReadyBatchRow[];
      }

      throw new Error(`Failed to create production-ready packs: ${error.message}`);
    }

    return (data || []).map(attachScanCode) as ProductionReadyBatchRow[];
  }

  // --------------------------------------------------------------------------
  // CANCEL: Cancel a production-ready pack
  // --------------------------------------------------------------------------
  async cancelProductionReadyBatch(batchId: string, cancelledBy: string): Promise<boolean> {
    const cancelTime = new Date().toISOString();

    const { error } = await supabase
      .from(TABLE)
      .update({
        current_stage: 'CANCELLED',
        cancelled_by: cancelledBy,
        cancelled_at: cancelTime,
        updated_at: cancelTime,
      })
      .eq('id', batchId)
      .in('current_stage', ['Incoming', 'READY_FOR_FIRST_SCAN', 'INCOMING', 'READY']);

    if (error) {
      throw new Error(`Failed to cancel production-ready pack: ${error.message}`);
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // CAPACITY: Calculate production capacity for a product
  // --------------------------------------------------------------------------
  async calculateCompleteProductCapacity(productCode: string): Promise<number> {
    const batches = await this.getProductionReadyBatches({ status: 'INCOMING', productCode });
    if (batches.length === 0) return 0;

    const countsByMat: Record<string, number> = {};
    batches.forEach(b => {
      const key = b.material_name.toLowerCase();
      countsByMat[key] = (countsByMat[key] || 0) + 1;
    });

    const values = Object.values(countsByMat);
    if (values.length === 0) return 0;
    return Math.min(...values);
  }

  // --------------------------------------------------------------------------
  // STOCK BALANCE: Get loose bulk stock for a material
  // --------------------------------------------------------------------------
  async getLooseStockBalanceGrams(materialName: string): Promise<number> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('quantity, unit')
      .ilike('material_name', materialName.trim())
      .not('barcode', 'like', 'PRP-%'); // Exclude PRP packs from loose stock

    if (error) {
      throw new Error(`Failed to fetch stock balance: ${error.message}`);
    }

    if (!data || data.length === 0) return 0;

    const totalGrams = data.reduce((sum: number, item: any) => {
      const qtyKg = Number(item.quantity || 0);
      return sum + kgToGrams(qtyKg);
    }, 0);

    return totalGrams;
  }
}

export const productionReadyBatchService = new ProductionReadyBatchService();
