export interface FormulaIngredient {
  name: string;
  quantity_for_500_units: number; // Formula based on 500 units
}

export interface ProductConfig {
  id: string;
  name: string;
  description: string;
  iconType: 'liquid' | 'bottle' | 'sponge' | 'package';
  formula?: FormulaIngredient[];
}

export const PRODUCTS: ProductConfig[] = [
  {
    id: 'LA',
    name: 'Liquid A',
    description: 'Standard cleaning liquid',
    iconType: 'liquid',
    formula: [
      { name: 'SLES Paste', quantity_for_500_units: 175 },
      { name: 'AOS', quantity_for_500_units: 50 },
      { name: 'CAPB', quantity_for_500_units: 50 },
      { name: 'Salt', quantity_for_500_units: 150 },
      { name: 'Sodium Benzoate', quantity_for_500_units: 2.5 },
      { name: 'Water', quantity_for_500_units: 65 }
    ]
  },
  {
    id: 'LB',
    name: 'Liquid B',
    description: 'Advanced formula',
    iconType: 'liquid',
    formula: [
      { name: 'SLES Paste', quantity_for_500_units: 175 },
      { name: 'AOS', quantity_for_500_units: 50 },
      { name: 'CAPB', quantity_for_500_units: 50 },
      { name: 'Salt', quantity_for_500_units: 150 },
      { name: 'Sodium Benzoate', quantity_for_500_units: 2.5 },
      { name: 'Water', quantity_for_500_units: 67.5 }
    ]
  },
  {
    id: 'COND',
    name: 'Conditioner',
    description: 'Fabric softener base',
    iconType: 'bottle',
    formula: [
      { name: 'Comfort Base', quantity_for_500_units: 11.25 },
      { name: 'N-Cap', quantity_for_500_units: 7.5 },
      { name: 'Fragrance (Milk Saffron)', quantity_for_500_units: 25 },
      { name: 'Phenoxy Ethanol', quantity_for_500_units: 2.5 },
      { name: 'Water', quantity_for_500_units: 406.25 },
      { name: 'Violet Colour', quantity_for_500_units: 0.75 }
    ]
  },
  {
    id: 'SPNG',
    name: 'Sponge',
    description: 'Scrub pad',
    iconType: 'sponge'
  }
];

// Helper to scale formula to requested units
export const calculateRequiredIngredients = (productId: string, units: number) => {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product || !product.formula) return null;
  
  const scale = units / 500;
  
  return product.formula.map(ing => ({
    name: ing.name,
    required_quantity: Number((ing.quantity_for_500_units * scale).toFixed(3))
  }));
};
