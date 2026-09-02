import type { CampaignInfluencer } from '../types';
import { formatDisplayProductName, parseProductsFromCombination } from '../modules/marketing/AddCampaignInfluencer';

export interface SKUMapping {
  code: string;
  name: string;
  aliases: string[];
}

export const SKU_MASTER: SKUMapping[] = [
  { code: '1B', name: 'Detergent', aliases: ['detergent', 'detergent liquid', 'diy detergent', 'diy detergent liquid'] },
  { code: '1Y', name: 'Dishwash', aliases: ['dishwash', 'dishwash liquid', 'diy dishwash', 'diy dishwash liquid'] },
  { code: '1P', name: 'Fabric Conditioner', aliases: ['fabric conditioner', 'fabric softener', 'conditioner'] },
  { code: '1S', name: 'Magic Sponge', aliases: ['magic sponge', 'sponge'] },
  { code: '1C', name: 'Car Shampoo', aliases: ['car shampoo', 'car wash'] },
  { code: '1BI', name: 'Bike Shampoo', aliases: ['bike shampoo', 'bike wash'] },
  { code: '1BC', name: 'BBC Cleaner', aliases: ['bbc cleaner', 'bbc'] },
  { code: '1K', name: 'Kitchen Cleaner', aliases: ['kitchen cleaner', 'kitchen'] },
  { code: '1F', name: 'Floor Cleaner', aliases: ['floor cleaner', 'floor'] },
  { code: '1G', name: 'Glass Cleaner', aliases: ['glass cleaner', 'glass'] },
  { code: '1BA', name: 'Bamboo Kitchen Towel', aliases: ['bamboo kitchen towel', 'bamboo towel', 'kitchen towel'] },
  { code: '1H', name: 'Hand Wash', aliases: ['hand wash', 'handwash'] }
];

export const getSKUForProduct = (productName: string): { sku: string; matchedName: string } => {
  if (!productName || typeof productName !== 'string' || !productName.trim()) {
    return { sku: 'Unmapped', matchedName: productName || 'Unknown Product' };
  }

  const cleanName = productName.trim().toLowerCase();

  for (const item of SKU_MASTER) {
    if (item.name.toLowerCase() === cleanName || item.code.toLowerCase() === cleanName) {
      return { sku: item.code, matchedName: item.name };
    }
    for (const alias of item.aliases) {
      if (cleanName.includes(alias.toLowerCase())) {
        return { sku: item.code, matchedName: item.name };
      }
    }
  }

  return { sku: 'Unmapped', matchedName: productName };
};

export interface PickListProductItem {
  product_name: string;
  sku: string;
  qty: number;
}

export interface PickListInfluencerRecord {
  sNo: number;
  influencerId: string | number;
  influencerCode: string;
  influencerName: string;
  username: string;
  products: PickListProductItem[];
  downloadDate: string;
}

export const getInfluencerProducts = (influencer: CampaignInfluencer): PickListProductItem[] => {
  const prodMap = new Map<string, { product_name: string; sku: string; qty: number }>();

  const explicitProducts = Array.isArray(influencer.products) ? influencer.products : [];
  const pricingVideos = Array.isArray(influencer.pricing?.product_pricing?.videos) 
    ? influencer.pricing.product_pricing.videos.filter((v: any) => v && (v.combination || v.name))
    : [];

  if (explicitProducts.length > 0) {
    explicitProducts.forEach((p: any) => {
      if (p && (p.selected === undefined || p.selected === true)) {
        const rawName = p.product_name || p.name || '';
        if (!rawName) return;
        const displayName = formatDisplayProductName(rawName);
        const qty = Number(p.qty) || 1;
        const { sku } = getSKUForProduct(displayName);
        const key = `${sku}_${displayName.toLowerCase()}`;
        if (prodMap.has(key)) {
          prodMap.get(key)!.qty += qty;
        } else {
          prodMap.set(key, { product_name: displayName, sku, qty });
        }
      }
    });
  } else if (pricingVideos.length > 0) {
    pricingVideos.forEach((v: any) => {
      const rawCombName = v.combination || v.name || '';
      const explicitProds = Array.isArray(v.products) && v.products.length > 0 ? v.products : [];
      const parsedProdNames = parseProductsFromCombination(rawCombName);

      if (explicitProds.length > 0) {
        explicitProds.forEach((p: any) => {
          const rawName = p.product_name || p.name || '';
          if (!rawName) return;
          const displayName = formatDisplayProductName(rawName);
          const qty = Number(p.qty) || 1;
          const { sku } = getSKUForProduct(displayName);
          const key = `${sku}_${displayName.toLowerCase()}`;
          if (prodMap.has(key)) {
            prodMap.get(key)!.qty += qty;
          } else {
            prodMap.set(key, { product_name: displayName, sku, qty });
          }
        });
      } else if (parsedProdNames.length > 0) {
        parsedProdNames.forEach(pName => {
          const displayName = formatDisplayProductName(pName);
          const { sku } = getSKUForProduct(displayName);
          const key = `${sku}_${displayName.toLowerCase()}`;
          if (prodMap.has(key)) {
            prodMap.get(key)!.qty += 1;
          } else {
            prodMap.set(key, { product_name: displayName, sku, qty: 1 });
          }
        });
      }
    });
  }

  return Array.from(prodMap.values());
};

export const buildPickListRecords = (
  influencers: CampaignInfluencer[],
  downloadDateStr?: string
): PickListInfluencerRecord[] => {
  const now = new Date();
  const defaultDateStr = `${String(now.getDate()).padStart(2, '0')} ${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}`;
  const currentDate = downloadDateStr || defaultDateStr;

  return influencers.map((inf, idx) => {
    const products = getInfluencerProducts(inf);
    const code = (inf.code || '').trim() || (inf.influencer_name || '').trim() || String(inf.id);
    const name = (inf.name || inf.influencer_name || (inf as any).username || 'Influencer').trim();
    const username = ((inf as any).username || '').trim();

    return {
      sNo: idx + 1,
      influencerId: inf.id,
      influencerCode: code,
      influencerName: name,
      username,
      products,
      downloadDate: currentDate
    };
  });
};
