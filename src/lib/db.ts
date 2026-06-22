import Dexie, { type EntityTable } from 'dexie';

import type {
  RawMaterial,
  InventoryIn,
  Batch,
  InventoryOut,
  ProductionBatch,
  ProductionMicroBatch,
  ProductionIngredient,
  RawMaterialIssue,
  FinishedGoodsInventory
} from '../types/inventory';

const db = new Dexie('MaterialManagementDB') as Dexie & {
  raw_materials: EntityTable<RawMaterial, 'id'>;
  inventory_in: EntityTable<InventoryIn, 'id'>;
  batches: EntityTable<Batch, 'id'>;
  inventory_out: EntityTable<InventoryOut, 'id'>;
  
  production_batches: EntityTable<ProductionBatch, 'id'>;
  production_micro_batches: EntityTable<ProductionMicroBatch, 'id'>;
  production_ingredients: EntityTable<ProductionIngredient, 'id'>;
  raw_material_issues: EntityTable<RawMaterialIssue, 'id'>;
  finished_goods_inventory: EntityTable<FinishedGoodsInventory, 'id'>;
};

// Schema declaration
db.version(1).stores({
  raw_materials: '++id, name, category, created_at',
  inventory_in: '++id, product_id, vendor_name, date_received, created_at',
  batches: '++id, batch_id, inventory_in_id, product_id, status, created_at',
  inventory_out: '++id, batch_id, product_id, date, created_at'
});

db.version(2).stores({
  raw_materials: '++id, name, category, created_at',
  inventory_in: '++id, product_id, vendor_name, date_received, created_at',
  batches: '++id, batch_id, inventory_in_id, product_id, status, created_at',
  inventory_out: '++id, batch_id, product_id, date, created_at'
});

db.version(3).stores({
  raw_materials: '++id, name, category, created_at',
  inventory_in: '++id, material_id, material_name, vendor_name, date_received, created_at',
  batches: '++id, batch_id, serial_number, inventory_in_id, material_id, status, created_at',
  inventory_out: '++id, batch_id, product_id, date, created_at'
});

db.version(4).stores({
  raw_materials: '++id, name, category, created_at',
  inventory_in: '++id, material_id, material_name, vendor_name, date_received, created_at',
  batches: '++id, batch_id, serial_number, inventory_in_id, material_id, status, created_at',
  inventory_out: '++id, batch_id, product_id, date, created_at',
  production_batches: '++id, production_batch_id, product_name, status, created_at',
  production_micro_batches: '++id, production_batch_id, status',
  production_ingredients: '++id, production_batch_id, material_name, status',
  raw_material_issues: '++id, production_batch_id, raw_material_batch_id',
  finished_goods_inventory: '++id, production_batch_id, micro_batch_id, product_name, status'
}).upgrade(tx => {
  // Migrate batches if necessary
  return tx.table('batches').toCollection().modify(record => {
    record.status = record.status || 'Active';
  });
});

let isSeeding = false;

// Default data seed
export const seedDatabase = async () => {
  if (isSeeding) return;
  isSeeding = true;
  try {
    const now = new Date().toISOString();
    
    // Check and add initial materials
    const count = await db.raw_materials.count();
    if (count === 0) {
      await db.raw_materials.bulkAdd([
        { name: 'SLES Paste', unit: 'KG', category: 'Surfactant', color_code: '#2563eb', description: 'Std 235kg container', created_at: now },
        { name: 'CAPB', unit: 'KG', category: 'Surfactant', color_code: '#10b981', description: 'Std 235kg container', created_at: now },
        { name: 'Salt', unit: 'KG', category: 'Thickener', color_code: '#64748b', description: 'Std 50kg container', created_at: now },
        { name: 'AOS', unit: 'KG', category: 'Surfactant', color_code: '#f59e0b', created_at: now },
        { name: 'Sodium Benzoate', unit: 'KG', category: 'Preservative', color_code: '#3b82f6', created_at: now },
        { name: 'Water', unit: 'KG', category: 'Base', color_code: '#0ea5e9', created_at: now },
        { name: 'Blue Colour', unit: 'KG', category: 'Colorant', color_code: '#1d4ed8', created_at: now },
        { name: 'Fragrance - Lemon Blast', unit: 'KG', category: 'Fragrance', color_code: '#8b5cf6', created_at: now },
        { name: 'Comfort Base', unit: 'KG', category: 'Base', color_code: '#f97316', created_at: now },
      ]);
    }

    // Force add missing materials for Liquid B & Conditioner if they don't exist
    const ensureMaterials = [
      { name: 'Yellow Colour', unit: 'KG', category: 'Colorant', color_code: '#eab308', created_at: now },
      { name: 'Violet Colour', unit: 'KG', category: 'Colorant', color_code: '#8b5cf6', created_at: now },
      { name: 'Fragrance (White Flower)', unit: 'KG', category: 'Fragrance', color_code: '#d946ef', created_at: now },
      { name: 'Fragrance (Milk Saffron)', unit: 'KG', category: 'Fragrance', color_code: '#f43f5e', created_at: now },
      { name: 'N-Cap', unit: 'KG', category: 'Additive', color_code: '#14b8a6', created_at: now },
      { name: 'Phenoxy Ethanol', unit: 'KG', category: 'Preservative', color_code: '#6366f1', created_at: now }
    ];

    for (const mat of ensureMaterials) {
      const exists = await db.raw_materials.where('name').equals(mat.name).first();
      if (!exists) {
        await db.raw_materials.add(mat);
      }
    }

  } finally {
    isSeeding = false;
  }
};

export default db;
