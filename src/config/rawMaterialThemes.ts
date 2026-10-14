export type RawMaterialThemeKey = 'blueYellow' | 'pink' | 'blue' | 'yellow' | 'blueYellowPink';

export interface RawMaterialTheme {
  themeKey: RawMaterialThemeKey;
  background: string;
  borderColor: string;
  glow: string;
  iconBg: string;
  iconColor: string;
  arrowBorder: string;
  arrowColor: string;
  arrowHoverBg: string;
  arrowHoverColor: string;
}

export const RAW_MATERIAL_THEMES: Record<RawMaterialThemeKey, RawMaterialTheme> = {
  blueYellow: {
    themeKey: 'blueYellow',
    background: 'linear-gradient(90deg, #93c5fd 0%, #e0f2fe 30%, #fefce8 70%, #fde047 100%)',
    borderColor: 'border-[#60a5fa]/70',
    glow: 'hover:shadow-md hover:shadow-blue-500/10',
    iconBg: 'bg-[#2563eb]',
    iconColor: 'text-white',
    arrowBorder: 'border-blue-200',
    arrowColor: 'text-[#2563eb]',
    arrowHoverBg: 'group-hover:bg-[#2563eb]',
    arrowHoverColor: 'group-hover:text-white group-hover:border-[#2563eb]'
  },
  pink: {
    themeKey: 'pink',
    background: 'linear-gradient(90deg, #fbcfe8 0%, #fff1f2 50%, #fce7f3 100%)',
    borderColor: 'border-[#f472b6]/60',
    glow: 'hover:shadow-md hover:shadow-pink-500/10',
    iconBg: 'bg-[#ec4899]',
    iconColor: 'text-white',
    arrowBorder: 'border-pink-200',
    arrowColor: 'text-[#ec4899]',
    arrowHoverBg: 'group-hover:bg-[#ec4899]',
    arrowHoverColor: 'group-hover:text-white group-hover:border-[#ec4899]'
  },
  blue: {
    themeKey: 'blue',
    background: 'linear-gradient(90deg, #93c5fd 0%, #eff6ff 50%, #dbeafe 100%)',
    borderColor: 'border-[#60a5fa]/60',
    glow: 'hover:shadow-md hover:shadow-blue-500/10',
    iconBg: 'bg-[#2563eb]',
    iconColor: 'text-white',
    arrowBorder: 'border-blue-200',
    arrowColor: 'text-[#2563eb]',
    arrowHoverBg: 'group-hover:bg-[#2563eb]',
    arrowHoverColor: 'group-hover:text-white group-hover:border-[#2563eb]'
  },
  yellow: {
    themeKey: 'yellow',
    background: 'linear-gradient(90deg, #fef08a 0%, #fefce8 50%, #fde047 100%)',
    borderColor: 'border-[#facc15]/80',
    glow: 'hover:shadow-md hover:shadow-amber-500/10',
    iconBg: 'bg-[#eab308]',
    iconColor: 'text-white',
    arrowBorder: 'border-amber-200',
    arrowColor: 'text-[#d97706]',
    arrowHoverBg: 'group-hover:bg-[#d97706]',
    arrowHoverColor: 'group-hover:text-white group-hover:border-[#d97706]'
  },
  blueYellowPink: {
    themeKey: 'blueYellowPink',
    background: 'linear-gradient(90deg, #93c5fd 0%, #fef08a 50%, #f472b6 100%)',
    borderColor: 'border-[#60a5fa]/60',
    glow: 'hover:shadow-md hover:shadow-pink-500/10',
    iconBg: 'bg-[#2563eb]',
    iconColor: 'text-white',
    arrowBorder: 'border-pink-200',
    arrowColor: 'text-[#ec4899]',
    arrowHoverBg: 'group-hover:bg-[#ec4899]',
    arrowHoverColor: 'group-hover:text-white group-hover:border-[#ec4899]'
  }
};

export function getCategoryBadgeStyle(matName: string, category: string = '') {
  const name = matName.trim().toLowerCase();
  const cat = category.trim().toLowerCase();

  if (name.includes('comfort') || name.includes('n-cap') || cat.includes('conditioning')) {
    return {
      badge: 'BASE/CONDITIONING',
      bgClass: 'bg-[#fce7f3] border border-[#f472b6] text-[#db2777] font-bold'
    };
  }
  if (name.includes('sles') || name.includes('capb') || name.includes('aos') || cat.includes('surfactant')) {
    return {
      badge: 'SURFACTANT',
      bgClass: 'bg-[#2563eb] text-white font-bold'
    };
  }
  if (name.includes('salt') || cat.includes('thickener')) {
    return {
      badge: 'THICKENER',
      bgClass: 'bg-[#2563eb] text-white font-bold'
    };
  }
  if (name.includes('phenoxy') || cat.includes('preservative')) {
    return {
      badge: 'PRESERVATIVE',
      bgClass: 'bg-[#ec4899] text-white font-bold'
    };
  }
  if (name.includes('benzoate')) {
    return {
      badge: 'PRESERVATIVE',
      bgClass: 'bg-[#2563eb] text-white font-bold'
    };
  }
  if (name.includes('water') || cat.includes('solvent')) {
    return {
      badge: 'SOLVENT',
      bgClass: 'bg-[#2563eb] text-white font-bold'
    };
  }
  if (name.includes('yellow colour') || name.includes('yellow color') || name.includes('lemon blast')) {
    return {
      badge: name.includes('fragrance') ? 'FRAGRANCE' : 'COLORANT',
      bgClass: 'bg-[#eab308] text-white font-bold'
    };
  }
  if (name.includes('pink colour') || name.includes('pink color') || name.includes('milk saffron')) {
    return {
      badge: name.includes('fragrance') ? 'FRAGRANCE' : 'COLORANT',
      bgClass: 'bg-[#ec4899] text-white font-bold'
    };
  }
  if (name.includes('blue colour') || name.includes('blue color') || name.includes('white flower')) {
    return {
      badge: name.includes('fragrance') ? 'FRAGRANCE' : 'COLORANT',
      bgClass: 'bg-[#2563eb] text-white font-bold'
    };
  }

  return {
    badge: 'MATERIAL',
    bgClass: 'bg-[#2563eb] text-white font-bold'
  };
}

/**
 * Helper function mapping each Raw Material to its theme, unit, and badge text
 */
export function getRawMaterialTheme(matName: string, category: string = ''): {
  theme: RawMaterialTheme;
  unit: string;
  badge: string;
  badgeStyle: string;
} {
  const name = matName.trim().toLowerCase();
  const cat = category.trim().toLowerCase();

  let unit = 'KG';
  if (name.includes('fragrance') || name.includes('water') || cat.includes('fragrance') || cat.includes('solvent')) {
    unit = 'LTR';
  }

  const badgeInfo = getCategoryBadgeStyle(matName, category);

  // Theme determination
  if (name === 'water' || name.includes('water')) {
    return { theme: RAW_MATERIAL_THEMES.blueYellowPink, unit, badge: badgeInfo.badge, badgeStyle: badgeInfo.bgClass };
  }

  if (
    name.includes('sles') ||
    name.includes('capb') ||
    name.includes('aos') ||
    name === 'salt' ||
    name.includes('salt') ||
    name.includes('benzoate')
  ) {
    return { theme: RAW_MATERIAL_THEMES.blueYellow, unit, badge: badgeInfo.badge, badgeStyle: badgeInfo.bgClass };
  }

  if (
    name.includes('comfort') ||
    name.includes('n-cap') ||
    name.includes('phenoxy') ||
    name.includes('pink') ||
    name.includes('violet') ||
    name.includes('milk saffron')
  ) {
    return { theme: RAW_MATERIAL_THEMES.pink, unit, badge: badgeInfo.badge, badgeStyle: badgeInfo.bgClass };
  }

  if (
    name.includes('blue colour') ||
    name.includes('blue color') ||
    name.includes('white flower')
  ) {
    return { theme: RAW_MATERIAL_THEMES.blue, unit, badge: badgeInfo.badge, badgeStyle: badgeInfo.bgClass };
  }

  if (
    name.includes('yellow colour') ||
    name.includes('yellow color') ||
    name.includes('lemon blast')
  ) {
    return { theme: RAW_MATERIAL_THEMES.yellow, unit, badge: badgeInfo.badge, badgeStyle: badgeInfo.bgClass };
  }

  return { theme: RAW_MATERIAL_THEMES.blueYellow, unit, badge: badgeInfo.badge, badgeStyle: badgeInfo.bgClass };
}
