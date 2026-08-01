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

export const PRIMARY_PACKAGING: PackagingMaterial[] = [
  {
    id: 'pack-1',
    name: 'Bottle',
    category: 'Primary Packaging',
    badge: 'PRIMARY',
    unit: 'PCS',
    colorTheme: {
      bg: 'from-cyan-500/10 to-blue-900/10',
      border: 'border-cyan-500/30',
      glow: 'hover:shadow-cyan-500/20',
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400'
    }
  },
  {
    id: 'pack-2',
    name: 'Cap',
    category: 'Primary Packaging',
    badge: 'PRIMARY',
    unit: 'PCS',
    colorTheme: {
      bg: 'from-cyan-500/10 to-blue-900/10',
      border: 'border-cyan-500/30',
      glow: 'hover:shadow-cyan-500/20',
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400'
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
