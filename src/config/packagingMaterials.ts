export interface PackagingMaterial {
  id: string;
  name: string;
  category: string;
  badge: string;
  unit: string;
  colorTheme: {
    bg: string;
    border: string;
    glow: string;
    iconBg: string;
    iconColor: string;
  };
}

export interface PackagingTheme {
  background: string;
  isGradientBorder?: boolean;
  borderGradientHex?: string;
  borderColorHex?: string;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  arrowBorder: string;
  arrowColor: string;
  arrowHoverBg: string;
  arrowHoverColor: string;
}

export function getPackagingTheme(matName: string, category: string = ''): PackagingTheme {
  const name = matName.trim().toLowerCase();
  const cat = category.trim().toLowerCase();

  // 1. Bottle & Cap & Set (Blue -> Yellow -> Pink Gradient)
  if (name.includes('bottle') || name.includes('cap') || name.includes('set')) {
    return {
      background: 'linear-gradient(90deg, #DDEBFF 0%, #FFF4B5 50%, #FFE2EE 100%)',
      isGradientBorder: true,
      borderGradientHex: 'linear-gradient(90deg, #4F8DFF 0%, #FFC83D 50%, #FF6FA8 100%)',
      borderColorHex: '#4F8DFF',
      iconBg: 'bg-gradient-to-r from-[#3B82F6] to-[#EC4899]',
      iconColor: 'text-white',
      badgeBg: 'bg-[#4F8DFF]',
      badgeText: 'text-white font-bold',
      arrowBorder: 'border-[#FF6FA8]',
      arrowColor: 'text-[#FF6FA8]',
      arrowHoverBg: 'group-hover:bg-[#FF6FA8]',
      arrowHoverColor: 'group-hover:text-white group-hover:border-[#FF6FA8]'
    };
  }

  // 2. Blue Brand Sticker
  if (name.includes('blue brand sticker') || (name.includes('blue') && name.includes('sticker'))) {
    return {
      background: '#EAF3FF',
      borderColorHex: '#4F8DFF',
      iconBg: 'bg-[#3B82F6]',
      iconColor: 'text-white',
      badgeBg: 'bg-[#4F8DFF]',
      badgeText: 'text-white font-bold',
      arrowBorder: 'border-[#4F8DFF]',
      arrowColor: 'text-[#4F8DFF]',
      arrowHoverBg: 'group-hover:bg-[#4F8DFF]',
      arrowHoverColor: 'group-hover:text-white group-hover:border-[#4F8DFF]'
    };
  }

  // 3. Yellow Brand Sticker
  if (name.includes('yellow brand sticker') || (name.includes('yellow') && name.includes('sticker'))) {
    return {
      background: '#FFF7D9',
      borderColorHex: '#FFC83D',
      iconBg: 'bg-[#FFC83D]',
      iconColor: 'text-white',
      badgeBg: 'bg-[#FFC83D]',
      badgeText: 'text-slate-900 font-bold',
      arrowBorder: 'border-[#FFC83D]',
      arrowColor: 'text-[#D97706]',
      arrowHoverBg: 'group-hover:bg-[#FFC83D]',
      arrowHoverColor: 'group-hover:text-slate-900 group-hover:border-[#FFC83D]'
    };
  }

  // 4. Pink Brand Sticker
  if (name.includes('pink brand sticker') || (name.includes('pink') && name.includes('sticker'))) {
    return {
      background: '#FFEAF3',
      borderColorHex: '#FF6FA8',
      iconBg: 'bg-[#FF6FA8]',
      iconColor: 'text-white',
      badgeBg: 'bg-[#FF6FA8]',
      badgeText: 'text-white font-bold',
      arrowBorder: 'border-[#FF6FA8]',
      arrowColor: 'text-[#FF6FA8]',
      arrowHoverBg: 'group-hover:bg-[#FF6FA8]',
      arrowHoverColor: 'group-hover:text-white group-hover:border-[#FF6FA8]'
    };
  }

  // 5. Sponge Brand Sticker (Neutral White Theme)
  if (name.includes('sponge brand sticker') || (name.includes('sponge') && name.includes('sticker'))) {
    return {
      background: '#F7F7F7',
      borderColorHex: '#C8CDD6',
      iconBg: 'bg-[#9CA3AF]',
      iconColor: 'text-white',
      badgeBg: 'bg-[#9CA3AF]',
      badgeText: 'text-white font-bold',
      arrowBorder: 'border-[#C8CDD6]',
      arrowColor: 'text-[#6B7280]',
      arrowHoverBg: 'group-hover:bg-[#9CA3AF]',
      arrowHoverColor: 'group-hover:text-white group-hover:border-[#9CA3AF]'
    };
  }

  // 6. Secondary Packaging (WAD Seal, Shrink Wrap, Bubble Wrap) -> Blue -> Yellow -> Pink Gradient
  if (cat.includes('secondary') || name.includes('wad') || name.includes('shrink') || name.includes('bubble')) {
    return {
      background: 'linear-gradient(90deg, #DDEBFF 0%, #FFF4B5 50%, #FFE2EE 100%)',
      isGradientBorder: true,
      borderGradientHex: 'linear-gradient(90deg, #4F8DFF 0%, #FFC83D 50%, #FF6FA8 100%)',
      borderColorHex: '#8B5CF6',
      iconBg: 'bg-gradient-to-r from-[#3B82F6] to-[#EC4899]',
      iconColor: 'text-white',
      badgeBg: 'bg-[#8B5CF6]',
      badgeText: 'text-white font-bold',
      arrowBorder: 'border-[#8B5CF6]',
      arrowColor: 'text-[#8B5CF6]',
      arrowHoverBg: 'group-hover:bg-[#8B5CF6]',
      arrowHoverColor: 'group-hover:text-white group-hover:border-[#8B5CF6]'
    };
  }

  // 7. Tertiary Packaging (Carton Boxes)
  if (cat.includes('tertiary') || name.includes('carton') || name.includes('box')) {
    return {
      background: '#FFF7D9',
      borderColorHex: '#FFC83D',
      iconBg: 'bg-[#FFC83D]',
      iconColor: 'text-white',
      badgeBg: 'bg-[#FFC83D]',
      badgeText: 'text-slate-900 font-bold',
      arrowBorder: 'border-[#FFC83D]',
      arrowColor: 'text-[#D97706]',
      arrowHoverBg: 'group-hover:bg-[#FFC83D]',
      arrowHoverColor: 'group-hover:text-slate-900 group-hover:border-[#FFC83D]'
    };
  }

  // 8. Inventory Packaging (Tape, Address Rolls, Barcode Roll, Ink Roll)
  if (cat.includes('inventory') || name.includes('tape') || name.includes('address') || name.includes('barcode') || name.includes('ink')) {
    return {
      background: '#E6F4EA',
      borderColorHex: '#10B981',
      iconBg: 'bg-[#10B981]',
      iconColor: 'text-white',
      badgeBg: 'bg-[#10B981]',
      badgeText: 'text-white font-bold',
      arrowBorder: 'border-[#10B981]',
      arrowColor: 'text-[#10B981]',
      arrowHoverBg: 'group-hover:bg-[#10B981]',
      arrowHoverColor: 'group-hover:text-white group-hover:border-[#10B981]'
    };
  }

  // Default Fallback
  return {
    background: '#EAF3FF',
    borderColorHex: '#4F8DFF',
    iconBg: 'bg-[#3B82F6]',
    iconColor: 'text-white',
    badgeBg: 'bg-[#4F8DFF]',
    badgeText: 'text-white font-bold',
    arrowBorder: 'border-[#4F8DFF]',
    arrowColor: 'text-[#3B82F6]',
    arrowHoverBg: 'group-hover:bg-[#3B82F6]',
    arrowHoverColor: 'group-hover:text-white group-hover:border-[#3B82F6]'
  };
}

export const PRIMARY_PACKAGING: PackagingMaterial[] = [
  {
    id: 'pack-set-1',
    name: 'Bottle + Cap Set',
    category: 'Primary Packaging',
    badge: 'PRIMARY',
    unit: 'PCS',
    colorTheme: {
      bg: 'from-cyan-500/10 via-amber-500/10 to-pink-900/10',
      border: 'border-cyan-500/30',
      glow: 'hover:shadow-cyan-500/20',
      iconBg: 'bg-gradient-to-r from-[#3B82F6] to-[#EC4899]',
      iconColor: 'text-white'
    }
  },
  {
    id: 'pack-3',
    name: 'Blue Brand Sticker',
    category: 'Primary Packaging',
    badge: 'STICKER',
    unit: 'PCS',
    colorTheme: {
      bg: 'from-blue-500/10 to-indigo-900/10',
      border: 'border-blue-500/30',
      glow: 'hover:shadow-blue-500/20',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400'
    }
  },
  {
    id: 'pack-4',
    name: 'Yellow Brand Sticker',
    category: 'Primary Packaging',
    badge: 'STICKER',
    unit: 'PCS',
    colorTheme: {
      bg: 'from-yellow-500/10 to-amber-900/10',
      border: 'border-yellow-500/30',
      glow: 'hover:shadow-yellow-500/20',
      iconBg: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400'
    }
  },
  {
    id: 'pack-5',
    name: 'Pink Brand Sticker',
    category: 'Primary Packaging',
    badge: 'STICKER',
    unit: 'PCS',
    colorTheme: {
      bg: 'from-pink-500/15 to-rose-950/40',
      border: 'border-pink-500/50',
      glow: 'hover:shadow-pink-500/30',
      iconBg: 'bg-pink-500/20',
      iconColor: 'text-pink-400'
    }
  },
  {
    id: 'pack-6',
    name: 'Sponge Brand Sticker',
    category: 'Primary Packaging',
    badge: 'STICKER',
    unit: 'PCS',
    colorTheme: {
      bg: 'from-slate-400/10 to-slate-800/10',
      border: 'border-slate-500/30',
      glow: 'hover:shadow-slate-500/20',
      iconBg: 'bg-slate-500/20',
      iconColor: 'text-slate-400'
    }
  }
];

export const SECONDARY_PACKAGING: PackagingMaterial[] = [
  {
    id: 'pack-7',
    name: 'WAD Seal',
    category: 'Secondary Packaging',
    badge: 'SECONDARY',
    unit: 'PCS',
    colorTheme: {
      bg: 'from-purple-500/10 to-indigo-900/10',
      border: 'border-purple-500/30',
      glow: 'hover:shadow-purple-500/20',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400'
    }
  },
  {
    id: 'pack-8',
    name: 'Shrink Wrap',
    category: 'Secondary Packaging',
    badge: 'SECONDARY',
    unit: 'ROLL',
    colorTheme: {
      bg: 'from-purple-500/10 to-indigo-900/10',
      border: 'border-purple-500/30',
      glow: 'hover:shadow-purple-500/20',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400'
    }
  },
  {
    id: 'pack-9',
    name: 'Bubble Wrap',
    category: 'Secondary Packaging',
    badge: 'SECONDARY',
    unit: 'ROLL',
    colorTheme: {
      bg: 'from-purple-500/10 to-indigo-900/10',
      border: 'border-purple-500/30',
      glow: 'hover:shadow-purple-500/20',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400'
    }
  }
];

export const TERTIARY_PACKAGING: PackagingMaterial[] = [
  {
    id: 'pack-10',
    name: '1B Carton Box',
    category: 'Tertiary Packaging',
    badge: 'TERTIARY',
    unit: 'BOX',
    colorTheme: {
      bg: 'from-amber-500/10 to-orange-900/10',
      border: 'border-amber-500/30',
      glow: 'hover:shadow-amber-500/20',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400'
    }
  },
  {
    id: 'pack-11',
    name: '2B Carton Box',
    category: 'Tertiary Packaging',
    badge: 'TERTIARY',
    unit: 'BOX',
    colorTheme: {
      bg: 'from-amber-500/10 to-orange-900/10',
      border: 'border-amber-500/30',
      glow: 'hover:shadow-amber-500/20',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400'
    }
  },
  {
    id: 'pack-12',
    name: '3B Carton Box',
    category: 'Tertiary Packaging',
    badge: 'TERTIARY',
    unit: 'BOX',
    colorTheme: {
      bg: 'from-amber-500/10 to-orange-900/10',
      border: 'border-amber-500/30',
      glow: 'hover:shadow-amber-500/20',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400'
    }
  },
  {
    id: 'pack-13',
    name: '4B Carton Box',
    category: 'Tertiary Packaging',
    badge: 'TERTIARY',
    unit: 'BOX',
    colorTheme: {
      bg: 'from-amber-500/10 to-orange-900/10',
      border: 'border-amber-500/30',
      glow: 'hover:shadow-amber-500/20',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400'
    }
  },
  {
    id: 'pack-14',
    name: '6B Carton Box',
    category: 'Tertiary Packaging',
    badge: 'TERTIARY',
    unit: 'BOX',
    colorTheme: {
      bg: 'from-amber-500/10 to-orange-900/10',
      border: 'border-amber-500/30',
      glow: 'hover:shadow-amber-500/20',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400'
    }
  }
];

export const INVENTORY_PACKAGING: PackagingMaterial[] = [
  {
    id: 'pack-15',
    name: 'Transparent Tape',
    category: 'Inventory Packaging',
    badge: 'INVENTORY',
    unit: 'ROLL',
    colorTheme: {
      bg: 'from-emerald-500/10 to-teal-900/10',
      border: 'border-emerald-500/30',
      glow: 'hover:shadow-emerald-500/20',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400'
    }
  },
  {
    id: 'pack-16',
    name: 'Address Rolls',
    category: 'Inventory Packaging',
    badge: 'INVENTORY',
    unit: 'ROLL',
    colorTheme: {
      bg: 'from-emerald-500/10 to-teal-900/10',
      border: 'border-emerald-500/30',
      glow: 'hover:shadow-emerald-500/20',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400'
    }
  },
  {
    id: 'pack-17',
    name: 'Barcode Roll',
    category: 'Inventory Packaging',
    badge: 'INVENTORY',
    unit: 'ROLL',
    colorTheme: {
      bg: 'from-emerald-500/10 to-teal-900/10',
      border: 'border-emerald-500/30',
      glow: 'hover:shadow-emerald-500/20',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400'
    }
  },
  {
    id: 'pack-18',
    name: 'Ink Roll',
    category: 'Inventory Packaging',
    badge: 'INVENTORY',
    unit: 'ROLL',
    colorTheme: {
      bg: 'from-emerald-500/10 to-teal-900/10',
      border: 'border-emerald-500/30',
      glow: 'hover:shadow-emerald-500/20',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400'
    }
  }
];
