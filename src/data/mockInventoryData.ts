export const defaultMaterials = [
  { id: 'mat-1', name: 'SLES Paste', unit: 'KG', category: 'Surfactant', color_code: '#2563eb' },
  { id: 'mat-2', name: 'CAPB', unit: 'KG', category: 'Surfactant', color_code: '#10b981' },
  { id: 'mat-3', name: 'AOS', unit: 'KG', category: 'Surfactant', color_code: '#0284c7' },
  { id: 'mat-4', name: 'Salt', unit: 'KG', category: 'Thickener', color_code: '#64748b' },
  { id: 'mat-5', name: 'Comfort Base', unit: 'KG', category: 'Base', color_code: '#3b82f6' },
  { id: 'mat-6', name: 'N-Cap', unit: 'KG', category: 'Conditioning Agent', color_code: '#8b5cf6' },
  { id: 'mat-7', name: 'Phenoxy Ethanol', unit: 'KG', category: 'Preservative', color_code: '#d946ef' },
  { id: 'mat-8', name: 'Sodium Benzoate', unit: 'KG', category: 'Preservative', color_code: '#ec4899' },
  { id: 'mat-9', name: 'Blue Colour', unit: 'KG', category: 'Colorant', color_code: '#3b82f6' },
  { id: 'mat-10', name: 'Yellow Colour', unit: 'KG', category: 'Colorant', color_code: '#eab308' },
  { id: 'mat-11', name: 'Violet Colour', unit: 'KG', category: 'Colorant', color_code: '#8b5cf6' },
  { id: 'mat-12', name: 'Water', unit: 'KG', category: 'Solvent', color_code: '#0ea5e9' },
  { id: 'mat-13', name: 'Lemon Blast Fragrance', unit: 'KG', category: 'Fragrance', color_code: '#eab308' },
  { id: 'mat-14', name: 'White Flower Fragrance', unit: 'KG', category: 'Fragrance', color_code: '#fcd34d' },
  { id: 'mat-15', name: 'Milk Saffron Fragrance', unit: 'KG', category: 'Fragrance', color_code: '#f59e0b' }
];

export const mockInitialState = {
  inventory_materials: defaultMaterials,
  inventory_batches: [],
  inventory_production: [],
  inventory_ledger: [],
  inventory_in: [],
  production_ingredients: [],
  production_micro_batches: [],
  finished_goods: [],
  combo_templates: [
    { id: 'CB01', name: 'Combo A', code: 'CB01', required_products: { 'Liquid A': 1, 'Liquid B': 1 } },
    { id: 'CB02', name: 'Combo B', code: 'CB02', required_products: { 'Liquid A': 1, 'Liquid B': 1, 'Conditioner': 1 } },
    { id: 'CB03', name: 'Combo C', code: 'CB03', required_products: { 'Liquid A': 1, 'Liquid B': 1, 'Conditioner': 1, 'Sponge': 1 } },
    { id: 'CB04', name: 'Custom Combo', code: 'CB04', required_products: {} }
  ],
  combo_batches: [],
  combo_inventory: [],
  combo_movements: []
};
