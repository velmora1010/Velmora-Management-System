export interface FormulaIngredient {
  name: string;
  quantity_for_500_units: number; // Formula based on 500 units
}

export interface ProductConfig {
  id: string;
  name: string;
  description: string;
  iconType: 'liquid' | 'bottle' | 'sponge' | 'package';
  microBatchSize?: number; // Micro-batch size in units (30 for 1B/1Y, 40 for 1P)
  formula?: FormulaIngredient[];
}

export const PRODUCTS: ProductConfig[] = [
  {
    id: 'LA',
    name: 'Liquid A',
    description: 'Standard cleaning liquid',
    iconType: 'liquid',
    microBatchSize: 30,
    formula: [
      { name: 'SLES Paste', quantity_for_500_units: 175 },
      { name: 'AOS', quantity_for_500_units: 50 },
      { name: 'CAPB', quantity_for_500_units: 50 },
      { name: 'Salt', quantity_for_500_units: 150 },
      { name: 'Sodium Benzoate', quantity_for_500_units: 2.5 },
      { name: 'Water', quantity_for_500_units: 65 },
      { name: 'White Flower Fragrance', quantity_for_500_units: 10 },
      { name: 'Blue Colour', quantity_for_500_units: 0.5 }
    ]
  },
  {
    id: 'LB',
    name: 'Liquid B',
    description: 'Advanced formula',
    iconType: 'liquid',
    microBatchSize: 30,
    formula: [
      { name: 'SLES Paste', quantity_for_500_units: 175 },
      { name: 'AOS', quantity_for_500_units: 50 },
      { name: 'CAPB', quantity_for_500_units: 50 },
      { name: 'Salt', quantity_for_500_units: 150 },
      { name: 'Sodium Benzoate', quantity_for_500_units: 2.5 },
      { name: 'Water', quantity_for_500_units: 67.5 },
      { name: 'Lemon Blast Fragrance', quantity_for_500_units: 7.5 },
      { name: 'Yellow Colour', quantity_for_500_units: 0.75 }
    ]
  },
  {
    id: 'COND',
    name: 'Conditioner',
    description: 'Fabric softener base',
    iconType: 'bottle',
    microBatchSize: 40,
    formula: [
      { name: 'Comfort Base', quantity_for_500_units: 11.25 },
      { name: 'N-Cap', quantity_for_500_units: 11.25 },
      { name: 'Fragrance (Milk Saffron)', quantity_for_500_units: 15 },
      { name: 'Phenoxy Ethanol', quantity_for_500_units: 2.5 },
      { name: 'Water', quantity_for_500_units: 406.25 },
      { name: 'Pink Colour', quantity_for_500_units: 0.175 }
    ]
  },
  {
    id: 'SPNG',
    name: 'Sponge',
    description: 'Scrub pad',
    iconType: 'sponge',
    microBatchSize: 30
  }
];

export const getProductMicroBatchSize = (productId?: string | null): number => {
  if (!productId) return 30;
  const product = PRODUCTS.find(p => p.id === productId || p.name.toLowerCase().includes(productId.toLowerCase()));
  return product?.microBatchSize || 30;
};

// Helper to scale formula to requested units
export const calculateRequiredIngredients = (productId: string, units: number) => {
  const product = PRODUCTS.find(p => p.id === productId || p.name.toLowerCase().includes(productId.toLowerCase()));
  if (!product || !product.formula) return null;
  
  const scale = units / 500;
  
  return product.formula.map(ing => ({
    name: ing.name,
    required_quantity: Number((ing.quantity_for_500_units * scale).toFixed(3))
  }));
};
