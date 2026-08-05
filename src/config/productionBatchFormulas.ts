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

  // Shared Packaging Materials (Bottle, Cap, WAD Seal)
  if (name.includes('bottle') || name.includes('cap') || name.includes('wad') || name.includes('seal')) {
    return [PRODUCTION_FORMULAS['1B'], PRODUCTION_FORMULAS['1Y'], PRODUCTION_FORMULAS['1P']];
  }

  // Blue-only materials & stickers
  if (name.includes('white flower') || name.includes('blue colour') || name.includes('blue color') || name.includes('blue brand sticker') || name.includes('blue sticker')) {
    return [PRODUCTION_FORMULAS['1B']];
  }

  // Yellow-only materials & stickers
  if (name.includes('lemon blast') || name.includes('yellow colour') || name.includes('yellow color') || name.includes('yellow brand sticker') || name.includes('yellow sticker')) {
    return [PRODUCTION_FORMULAS['1Y']];
  }

  // Pink-only materials & stickers
  if (
    name.includes('comfort') ||
    name.includes('n-cap') ||
    name.includes('milk saffron') ||
    name.includes('phenoxy') ||
    name.includes('pink colour') ||
    name.includes('pink color') ||
    name.includes('pink brand sticker') ||
    name.includes('pink sticker') ||
    name.includes('violet')
  ) {
    return [PRODUCTION_FORMULAS['1P']];
  }

  return [];
}

/**
 * Returns requirement in grams or base units for a material & product combination
 */
export function getMaterialRequirementForProduct(matName: string, productCode: string): IngredientFormula | null {
  const product = PRODUCTION_FORMULAS[productCode];
  if (!product) return null;

  const matLower = matName.trim().toLowerCase();

  // Packaging materials
  if (matLower.includes('bottle') || matLower.includes('cap') || matLower.includes('sticker') || matLower.includes('wad') || matLower.includes('seal')) {
    const pcs = product.unitsPerBatch || 30;
    return { materialName: matName, requiredGrams: pcs * 1000 };
  }

  const ing = product.ingredients.find(i => {
    const iLower = i.materialName.toLowerCase();
    return matLower.includes(iLower) || iLower.includes(matLower);
  });

  return ing || null;
}

/**
 * Returns the canonical unit for any raw material or packaging material.
 */
export function getMaterialUnit(material?: any): string {
  if (!material) return 'KG';

  let matName = '';
  let explicitUnit = '';

  if (typeof material === 'string') {
    matName = material;
  } else if (typeof material === 'object') {
    matName = material.name || material.material_name || material.packaging_name || '';
    explicitUnit = material.unit || material.display_unit || material.unit_of_measure || '';
  }

  // If explicit unit exists and is not default 'KG' for a non-KG material, return it
  if (explicitUnit && explicitUnit.toUpperCase() !== 'KG') {
    return explicitUnit.toUpperCase();
  }

  const nameLower = matName.trim().toLowerCase();

  // Water -> LTR
  if (nameLower.includes('water')) return 'LTR';

  // Packaging materials
  if (nameLower.includes('bottle')) return 'PCS';
  if (nameLower.includes('cap')) return 'PCS';
  if (nameLower.includes('sticker')) return 'PCS';
  if (nameLower.includes('wad') || nameLower.includes('seal')) return 'PCS';
  if (nameLower.includes('shrink')) return 'ROLL';
  if (nameLower.includes('bubble')) return 'ROLL';
  if (nameLower.includes('carton') || nameLower.includes('box')) return 'BOX';

  // Raw materials
  if (
    nameLower.includes('sles') ||
    nameLower.includes('aos') ||
    nameLower.includes('capb') ||
    nameLower.includes('salt') ||
    nameLower.includes('comfort') ||
    nameLower.includes('n-cap') ||
    nameLower.includes('benzoate') ||
    nameLower.includes('fragrance') ||
    nameLower.includes('colour') ||
    nameLower.includes('color')
  ) {
    return 'KG';
  }

  if (explicitUnit) return explicitUnit.toUpperCase();

  return 'KG';
}

/**
 * Formats a quantity stored in base units (grams/milli-units or standard quantity) with unit awareness.
 * For discrete count units (PCS, ROLL, BOX), displays integers (e.g. "100", "30").
 * For continuous units (KG, LTR), displays decimal string (e.g. "100.000").
 */
export function formatMaterialQuantity(quantityGramsOrUnits: number, unit: string): string {
  if (isNaN(quantityGramsOrUnits) || quantityGramsOrUnits < 0) {
    const isDiscrete = ['PCS', 'ROLL', 'BOX'].includes(unit.toUpperCase());
    return isDiscrete ? '0' : '0.000';
  }

  const qty = quantityGramsOrUnits / 1000;
  const isDiscrete = ['PCS', 'ROLL', 'BOX'].includes(unit.toUpperCase());

  if (isDiscrete) {
    return String(Math.round(qty));
  }

  return qty.toFixed(3);
}

/**
 * Formats quantity with unit string (e.g., "100 PCS", "10.000 KG", "250 LTR", "12 ROLL", "20 BOX")
 */
export function formatQuantityWithUnit(quantityGramsOrUnits: number, materialOrUnit: any): string {
  const unit = getMaterialUnit(materialOrUnit);
  const formattedVal = formatMaterialQuantity(quantityGramsOrUnits, unit);
  return `${formattedVal} ${unit}`;
}

/**
 * Helper to convert Kg/unit string/number to integer grams/base units
 */
export function kgToGrams(kg: number | string): number {
  const val = typeof kg === 'string' ? parseFloat(kg) : kg;
  if (isNaN(val) || val <= 0) return 0;
  return Math.round(val * 1000);
}

/**
 * Helper to convert integer grams to Kg/unit formatted string
 */
export function gramsToKgString(grams: number, unit: string = 'KG'): string {
  return formatMaterialQuantity(grams, unit);
}
