export interface IngredientFormula {
  materialName: string;
  requiredGrams: number;
  isVariable?: boolean;
}

export interface ProductFormulaConfig {
  productCode: string;
  productName: string;
  unitsPerBatch: number;
  themeColor: 'blue' | 'yellow' | 'pink';
  ingredients: IngredientFormula[];
}

export const PRODUCTION_FORMULAS: Record<string, ProductFormulaConfig> = {
  '1B': {
    productCode: '1B',
    productName: 'Blue Detergent',
    unitsPerBatch: 30,
    themeColor: 'blue',
    ingredients: [
      { materialName: 'SLES Paste', requiredGrams: 10500 },
      { materialName: 'AOS', requiredGrams: 3000 },
      { materialName: 'CAPB', requiredGrams: 3000 },
      { materialName: 'Salt', requiredGrams: 9000 },
      { materialName: 'Sodium Benzoate', requiredGrams: 150 },
      { materialName: 'White Flower Fragrance', requiredGrams: 600 },
      { materialName: 'Blue Colour', requiredGrams: 30 },
      { materialName: 'Water', requiredGrams: 0, isVariable: true },
    ],
  },
  '1Y': {
    productCode: '1Y',
    productName: 'Yellow Dish Wash',
    unitsPerBatch: 30,
    themeColor: 'yellow',
    ingredients: [
      { materialName: 'SLES Paste', requiredGrams: 10500 },
      { materialName: 'AOS', requiredGrams: 3000 },
      { materialName: 'CAPB', requiredGrams: 3000 },
      { materialName: 'Salt', requiredGrams: 9000 },
      { materialName: 'Sodium Benzoate', requiredGrams: 150 },
      { materialName: 'Lemon Blast Fragrance', requiredGrams: 450 },
      { materialName: 'Yellow Colour', requiredGrams: 45 },
      { materialName: 'Water', requiredGrams: 0, isVariable: true },
    ],
  },
  '1P': {
    productCode: '1P',
    productName: 'Pink Comfort',
    unitsPerBatch: 40,
    themeColor: 'pink',
    ingredients: [
      { materialName: 'Comfort Base', requiredGrams: 900 },
      { materialName: 'N-Cap', requiredGrams: 900 },
      { materialName: 'Milk Saffron Fragrance', requiredGrams: 1200 },
      { materialName: 'Phenoxy Ethanol', requiredGrams: 200 },
      { materialName: 'Pink Colour', requiredGrams: 14 },
      { materialName: 'Water', requiredGrams: 0, isVariable: true },
    ],
  },
};

/**
 * Returns eligible products for a raw material
 */
export function getEligibleProductsForMaterial(matName: string): ProductFormulaConfig[] {
  const name = matName.trim().toLowerCase();

  // Water is variable and never auto-split
  if (name.includes('water')) {
    return [];
  }

  // Shared Blue & Yellow materials
  if (
    name.includes('sles') ||
    name.includes('aos') ||
    name.includes('capb') ||
    name === 'salt' ||
    name.includes('salt') ||
    name.includes('benzoate')
  ) {
    return [PRODUCTION_FORMULAS['1B'], PRODUCTION_FORMULAS['1Y']];
  }

  // Blue-only materials
  if (name.includes('white flower') || name.includes('blue colour') || name.includes('blue color')) {
    return [PRODUCTION_FORMULAS['1B']];
  }

  // Yellow-only materials
  if (name.includes('lemon blast') || name.includes('yellow colour') || name.includes('yellow color')) {
    return [PRODUCTION_FORMULAS['1Y']];
  }

  // Pink-only materials
  if (
    name.includes('comfort') ||
    name.includes('n-cap') ||
    name.includes('milk saffron') ||
    name.includes('phenoxy') ||
    name.includes('pink colour') ||
    name.includes('pink color') ||
    name.includes('violet')
  ) {
    return [PRODUCTION_FORMULAS['1P']];
  }

  return [];
}

/**
 * Returns requirement in grams for a material & product combination
 */
export function getMaterialRequirementForProduct(matName: string, productCode: string): IngredientFormula | null {
  const product = PRODUCTION_FORMULAS[productCode];
  if (!product) return null;

  const matLower = matName.trim().toLowerCase();
  const ing = product.ingredients.find(i => {
    const iLower = i.materialName.toLowerCase();
    return matLower.includes(iLower) || iLower.includes(matLower);
  });

  return ing || null;
}

/**
 * Helper to convert Kg string/number to integer grams
 */
export function kgToGrams(kg: number | string): number {
  const val = typeof kg === 'string' ? parseFloat(kg) : kg;
  if (isNaN(val) || val <= 0) return 0;
  return Math.round(val * 1000);
}

/**
 * Helper to convert integer grams to Kg formatted string (3 decimals)
 */
export function gramsToKgString(grams: number): string {
  if (isNaN(grams) || grams < 0) return '0.000';
  return (grams / 1000).toFixed(3);
}
