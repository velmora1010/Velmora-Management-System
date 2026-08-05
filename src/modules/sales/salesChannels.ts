import { Globe, ShoppingCart, ShoppingBag, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SalesChannelConfig {
  id: string;
  name: string;
  description: string;
  route: string;
  icon: LucideIcon;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  glowShadow: string;
}

export const SALES_CHANNELS: SalesChannelConfig[] = [
  {
    id: 'website',
    name: 'Website',
    description: 'Manage direct website sales.',
    route: '/sales/website',
    icon: Globe,
    accentColor: '#38bdf8',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'group-hover:border-cyan-500/50',
    iconBg: 'bg-cyan-500/10 group-hover:bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    glowShadow: 'hover:shadow-[0_0_20px_rgba(56,189,248,0.15)]'
  },
  {
    id: 'amazon',
    name: 'Amazon',
    description: 'Manage Amazon marketplace sales.',
    route: '/sales/amazon',
    icon: ShoppingCart,
    accentColor: '#f97316',
    bgColor: 'bg-orange-500/10',
    borderColor: 'group-hover:border-orange-500/50',
    iconBg: 'bg-orange-500/10 group-hover:bg-orange-500/20',
    iconColor: 'text-orange-400',
    glowShadow: 'hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]'
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    description: 'Manage Flipkart marketplace sales.',
    route: '/sales/flipkart',
    icon: ShoppingBag,
    accentColor: '#3b82f6',
    bgColor: 'bg-blue-500/10',
    borderColor: 'group-hover:border-blue-500/50',
    iconBg: 'bg-blue-500/10 group-hover:bg-blue-500/20',
    iconColor: 'text-blue-400',
    glowShadow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]'
  },
  {
    id: 'meesho',
    name: 'Meesho',
    description: 'Manage Meesho marketplace sales.',
    route: '/sales/meesho',
    icon: Store,
    accentColor: '#ec4899',
    bgColor: 'bg-pink-500/10',
    borderColor: 'group-hover:border-pink-500/50',
    iconBg: 'bg-pink-500/10 group-hover:bg-pink-500/20',
    iconColor: 'text-pink-400',
    glowShadow: 'hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]'
  }
];
