import React, { useState, useMemo } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { 
  MapPin, 
  Building2, 
  CreditCard, 
  Package, 
  Award, 
  Globe, 
  Users, 
  Share2, 
  Filter, 
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { AnalyticsDonutChart, DonutSliceData } from '../sales/website/components/AnalyticsDonutChart';
import { normalizeStateName } from '../../components/marketing/InfluencerFilterDrawer';
import { formatDisplayProductName, parseProductsFromCombination } from './AddCampaignInfluencer';
import type { CampaignAnalyticsFilterState } from '../../components/marketing/CampaignInfluencerAnalyticsFilterDrawer';
import { getSingleVideoPrices } from './CampaignInfluencerList';
import { isArchived, isActiveStatus } from '../../utils/marketingUtils';

interface CampaignInfluencerAnalyticsProps {
  campaign: Campaign;
  influencers: CampaignInfluencer[];
  filterState: CampaignAnalyticsFilterState;
  onOpenFilter: () => void;
  activeFilterCount: number;
  onResetFilters: () => void;
}

const PALETTE = [
  '#9333ea', // Purple
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#eab308', // Yellow
  '#ef4444', // Red
  '#14b8a6', // Teal
  '#6366f1'  // Indigo
];

export const getUniqueInfluencerPrice = (inf: CampaignInfluencer): number | null => {
  if (inf.pricing?.product_pricing?.videos && Array.isArray(inf.pricing.product_pricing.videos)) {
    for (const v of inf.pricing.product_pricing.videos) {
      const p = Number(v.amount);
      if (!isNaN(p) && p > 0) return p;
    }
  }
  if (inf.pricing) {
    const v1 = Number(inf.pricing.video1_price);
    if (!isNaN(v1) && v1 > 0) return v1;
    const v2 = Number(inf.pricing.video2_price);
    if (!isNaN(v2) && v2 > 0) return v2;
  }
  const topV1 = Number((inf as any).video1_price);
  if (!isNaN(topV1) && topV1 > 0) return topV1;
  const topV2 = Number((inf as any).video2_price);
  if (!isNaN(topV2) && topV2 > 0) return topV2;
  if (inf.pricing?.final_price) {
    const fp = Number(inf.pricing.final_price);
    const count = Number(inf.pricing.total_videos) || Number((inf.pricing as any).video_count) || (inf.pricing.product_pricing?.videos?.length) || 1;
    if (!isNaN(fp) && fp > 0 && count > 0) {
      return fp / count;
    }
  }
  return null;
};

export const getUniqueInfluencerPricingAnalytics = (filteredInfluencers: CampaignInfluencer[]): { sliceData: DonutSliceData[]; countsMap: Record<string, number> } => {
  const map: Record<string, number> = {
    'Below ₹500': 0,
    '₹500–₹749': 0,
    '₹750–₹999': 0,
    '₹1,000–₹1,249': 0,
    '₹1,250–₹1,499': 0,
    '₹1,500–₹1,999': 0,
    '₹2,000 and above': 0,
    'Price Not Available': 0
  };

  filteredInfluencers.forEach(inf => {
    const price = getUniqueInfluencerPrice(inf);
    if (price === null) {
      map['Price Not Available']++;
    } else if (price < 500) {
      map['Below ₹500']++;
    } else if (price >= 500 && price <= 749) {
      map['₹500–₹749']++;
    } else if (price >= 750 && price <= 999) {
      map['₹750–₹999']++;
    } else if (price >= 1000 && price <= 1249) {
      map['₹1,000–₹1,249']++;
    } else if (price >= 1250 && price <= 1499) {
      map['₹1,250–₹1,499']++;
    } else if (price >= 1500 && price <= 1999) {
      map['₹1,500–₹1,999']++;
    } else if (price >= 2000) {
      map['₹2,000 and above']++;
    }
  });

  const categoriesOrder = [
    'Below ₹500',
    '₹500–₹749',
    '₹750–₹999',
    '₹1,000–₹1,249',
    '₹1,250–₹1,499',
    '₹1,500–₹1,999',
    '₹2,000 and above',
    'Price Not Available'
  ];

  const sliceData: DonutSliceData[] = [];
  categoriesOrder.forEach((cat, idx) => {
    const count = map[cat];
    if (count > 0) {
      sliceData.push({
        name: cat,
        value: count,
        color: PALETTE[idx % PALETTE.length]
      });
    }
  });

  return { sliceData, countsMap: map };
};

export interface UniqueInfluencerOneVideoPricingRecord {
  influencerId: string;
  influencerCode: string;
  username: string;
  pricePerVideo: number | null;
}

export const getUniqueInfluencerOneVideoPricing = (
  filteredInfluencers: CampaignInfluencer[]
): {
  uniqueRecords: UniqueInfluencerOneVideoPricingRecord[];
  sliceData: DonutSliceData[];
  totalUniqueCount: number;
} => {
  const uniqueRecords: UniqueInfluencerOneVideoPricingRecord[] = [];
  const seenKeys = new Set<string>();

  filteredInfluencers.forEach(inf => {
    const key = String(inf.id || inf.code || inf.influencer_name || inf.name).trim();
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    const price = getUniqueInfluencerPrice(inf);
    uniqueRecords.push({
      influencerId: String(inf.id || ''),
      influencerCode: inf.code || '',
      username: inf.influencer_name || inf.name || '',
      pricePerVideo: price
    });
  });

  const map: Map<number | 'missing', number> = new Map();

  uniqueRecords.forEach(rec => {
    if (rec.pricePerVideo === null || isNaN(rec.pricePerVideo) || rec.pricePerVideo <= 0) {
      map.set('missing', (map.get('missing') || 0) + 1);
    } else {
      const roundedPrice = Math.round(rec.pricePerVideo);
      map.set(roundedPrice, (map.get(roundedPrice) || 0) + 1);
    }
  });

  const numericEntries = Array.from(map.entries())
    .filter(([k]) => k !== 'missing')
    .sort((a, b) => (a[0] as number) - (b[0] as number));

  const sliceData: DonutSliceData[] = [];
  let colorIdx = 0;

  numericEntries.forEach(([priceVal, count]) => {
    const formattedPrice = `₹${(priceVal as number).toLocaleString('en-IN')}`;
    sliceData.push({
      name: formattedPrice,
      value: count as number,
      priceNum: priceVal as number,
      color: PALETTE[colorIdx % PALETTE.length]
    });
    colorIdx++;
  });

  const missingCount = map.get('missing') || 0;
  if (missingCount > 0) {
    sliceData.push({
      name: 'Price Not Available',
      value: missingCount,
      priceNum: -1,
      color: '#64748b'
    });
  }

  return {
    uniqueRecords,
    sliceData,
    totalUniqueCount: uniqueRecords.length
  };
};

export const CampaignInfluencerAnalytics: React.FC<CampaignInfluencerAnalyticsProps> = ({
  campaign,
  influencers,
  filterState,
  onOpenFilter,
  activeFilterCount,
  onResetFilters
}) => {
  // State for expanded lists in breakdown cards (default shows top 6)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleExpand = (cardTitle: string) => {
    setExpandedCards(prev => ({ ...prev, [cardTitle]: !prev[cardTitle] }));
  };

  // 1. In-Memory Filter Evaluation (AND Logic)
  const filteredInfluencers = useMemo(() => {
    return influencers.filter(inf => {
      // Exclude non-active influencers
      if (!isActiveStatus(inf.is_archived)) return false;

      // Search term
      if (filterState.searchTerm.trim()) {
        const term = filterState.searchTerm.toLowerCase().trim();
        const matchTerm = 
          (inf.name || '').toLowerCase().includes(term) ||
          (inf.influencer_name || '').toLowerCase().includes(term) ||
          (inf.code || '').toLowerCase().includes(term) ||
          (inf.phone_number || '').toLowerCase().includes(term) ||
          (inf.city || '').toLowerCase().includes(term) ||
          (inf.state || '').toLowerCase().includes(term);
        if (!matchTerm) return false;
      }

      // States
      if (filterState.states.length > 0) {
        const infState = normalizeStateName(inf.state).toLowerCase();
        const matchState = filterState.states.some(s => s.toLowerCase() === infState);
        if (!matchState) return false;
      }

      // Cities
      if (filterState.cities.length > 0) {
        const infCity = (inf.city || '').trim().toLowerCase();
        const matchCity = filterState.cities.some(c => c.toLowerCase() === infCity);
        if (!matchCity) return false;
      }

      // Creator Categories
      if (filterState.creatorCategories.length > 0) {
        let infCat = (inf as any).creatorCategory || '';
        if (!infCat && inf.platforms) {
          const matchP = inf.platforms.find(p => (p as any).performance_code);
          if (matchP) infCat = (matchP as any).performance_code;
        }
        const matchCat = filterState.creatorCategories.some(c => c.toLowerCase() === infCat.toLowerCase());
        if (!matchCat) return false;
      }

      // Languages (Multi-select)
      if (filterState.languages.length > 0) {
        let infLangs: string[] = [];
        if (Array.isArray(inf.languages)) {
          infLangs = inf.languages.filter(l => typeof l === 'string' && !l.startsWith('views_data:'));
        } else if (typeof inf.languages === 'string') {
          infLangs = (inf.languages as string).split(/[,/]+/).map(s => s.trim()).filter(Boolean);
        }
        const matchLang = filterState.languages.some(targetL => 
          infLangs.some(l => l.toLowerCase() === targetL.toLowerCase())
        );
        if (!matchLang) return false;
      }

      // Follower Range
      if (filterState.followerRange) {
        let maxFollowers = 0;
        if (inf.platforms && inf.platforms.length > 0) {
          maxFollowers = Math.max(...inf.platforms.map(p => Number(p.followers_count) || 0));
        }
        let matchFR = true;
        switch (filterState.followerRange) {
          case 'below_10k': matchFR = maxFollowers < 10000; break;
          case '10k_25k': matchFR = maxFollowers >= 10000 && maxFollowers < 25000; break;
          case '25k_50k': matchFR = maxFollowers >= 25000 && maxFollowers < 50000; break;
          case '50k_100k': matchFR = maxFollowers >= 50000 && maxFollowers < 100000; break;
          case '100k_200k': matchFR = maxFollowers >= 100000 && maxFollowers < 200000; break;
          case '200k_300k': matchFR = maxFollowers >= 200000 && maxFollowers < 300000; break;
          case '300k_400k': matchFR = maxFollowers >= 300000 && maxFollowers < 400000; break;
          case '400k_500k': matchFR = maxFollowers >= 400000 && maxFollowers < 500000; break;
          case 'above_500k': matchFR = maxFollowers >= 500000; break;
        }
        if (!matchFR) return false;
      }

      // Platform Combination
      if (filterState.platformCombo && filterState.platformCombo !== 'all') {
        const activePlatforms: string[] = [];
        if (inf.platforms) {
          inf.platforms.forEach(p => {
            if (p.username || (p.followers_count && p.followers_count > 0) || p.profile_link) {
              const name = p.platform.toLowerCase();
              if (name.includes('insta')) activePlatforms.push('instagram');
              else if (name.includes('you')) activePlatforms.push('youtube');
              else if (name.includes('face')) activePlatforms.push('facebook');
            }
          });
        }
        const hasInsta = activePlatforms.includes('instagram');
        const hasYoutube = activePlatforms.includes('youtube');
        const hasFb = activePlatforms.includes('facebook');

        let matchCombo = true;
        switch (filterState.platformCombo) {
          case 'instagram': matchCombo = hasInsta && !hasYoutube && !hasFb; break;
          case 'youtube': matchCombo = hasYoutube && !hasInsta && !hasFb; break;
          case 'facebook': matchCombo = hasFb && !hasInsta && !hasYoutube; break;
          case 'instagram_youtube': matchCombo = hasInsta && hasYoutube && !hasFb; break;
          case 'instagram_facebook': matchCombo = hasInsta && hasFb && !hasYoutube; break;
          case 'youtube_facebook': matchCombo = hasYoutube && hasFb && !hasInsta; break;
          case 'instagram_youtube_facebook': matchCombo = hasInsta && hasYoutube && hasFb; break;
          case 'none': matchCombo = !hasInsta && !hasYoutube && !hasFb; break;
        }
        if (!matchCombo) return false;
      }

      // Price Range
      if (filterState.priceRange) {
        const singlePrices = getSingleVideoPrices(inf);
        if (singlePrices.length === 0) return false;
        let matchP = false;
        switch (filterState.priceRange) {
          case 'below_1000': matchP = singlePrices.some((pr: number) => pr < 1000); break;
          case '1000_2000': matchP = singlePrices.some((pr: number) => pr >= 1000 && pr <= 2000); break;
          case '2000_3000': matchP = singlePrices.some((pr: number) => pr >= 2000 && pr <= 3000); break;
          case '3000_4000': matchP = singlePrices.some((pr: number) => pr >= 3000 && pr <= 4000); break;
          case '4000_5000': matchP = singlePrices.some((pr: number) => pr >= 4000 && pr <= 5000); break;
          case '5000_6000': matchP = singlePrices.some((pr: number) => pr >= 5000 && pr <= 6000); break;
          case '6000_7000': matchP = singlePrices.some((pr: number) => pr >= 6000 && pr <= 7000); break;
          case '7000_8000': matchP = singlePrices.some((pr: number) => pr >= 7000 && pr <= 8000); break;
          case '8000_9000': matchP = singlePrices.some((pr: number) => pr >= 8000 && pr <= 9000); break;
          case '9000_10000': matchP = singlePrices.some((pr: number) => pr >= 9000 && pr <= 10000); break;
          case 'above_10000': matchP = singlePrices.some((pr: number) => pr > 10000); break;
        }
        if (!matchP) return false;
      }

      // Products (Multi-select)
      if (filterState.products.length > 0) {
        const infProds = (inf.products || []).map((p: any) => formatDisplayProductName(p.product_name || p.name).toLowerCase());
        const matchProduct = filterState.products.some(targetP => 
          infProds.some(p => p.includes(targetP.toLowerCase()))
        );
        if (!matchProduct) return false;
      }

      return true;
    });
  }, [influencers, filterState]);

  const totalInfluencerCount = filteredInfluencers.length;

  // Helper for generating sorted slice dataset
  const createSliceDataset = (countsMap: Record<string, number>): DonutSliceData[] => {
    const sorted = Object.entries(countsMap).sort((a, b) => b[1] - a[1]);
    return sorted.map(([name, count], idx) => ({
      name,
      value: count,
      color: PALETTE[idx % PALETTE.length]
    }));
  };

  // 1. STATE WISE
  const stateData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInfluencers.forEach(inf => {
      const st = normalizeStateName(inf.state) || 'Not Provided';
      map[st] = (map[st] || 0) + 1;
    });
    return createSliceDataset(map);
  }, [filteredInfluencers]);

  // 2. CITY WISE
  const cityData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInfluencers.forEach(inf => {
      const ct = (inf.city || '').trim() || 'Not Provided';
      map[ct] = (map[ct] || 0) + 1;
    });
    return createSliceDataset(map);
  }, [filteredInfluencers]);

  // 3. PRICE WISE & INFLUENCER PRICE — ONE VIDEO (Single unique price per influencer)
  const pricingAnalytics = useMemo(() => {
    return getUniqueInfluencerPricingAnalytics(filteredInfluencers);
  }, [filteredInfluencers]);

  const priceData = pricingAnalytics.sliceData;

  const oneVideoPricingAnalytics = useMemo(() => {
    return getUniqueInfluencerOneVideoPricing(filteredInfluencers);
  }, [filteredInfluencers]);

  // 4. PRODUCT WISE (Multi-valued)
  const productData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInfluencers.forEach(inf => {
      const prodsSet = new Set<string>();
      if (Array.isArray(inf.products) && inf.products.length > 0) {
        inf.products.forEach((p: any) => {
          if (p.product_name) prodsSet.add(formatDisplayProductName(p.product_name));
        });
      } else if (inf.pricing?.product_pricing?.videos) {
        inf.pricing.product_pricing.videos.forEach((v: any) => {
          const comb = v.combination || v.name;
          if (comb) {
            const parsed = parseProductsFromCombination(comb);
            parsed.forEach(pName => prodsSet.add(formatDisplayProductName(pName)));
          }
        });
      }

      if (prodsSet.size === 0) {
        map['Not Provided'] = (map['Not Provided'] || 0) + 1;
      } else {
        prodsSet.forEach(pName => {
          map[pName] = (map[pName] || 0) + 1;
        });
      }
    });
    return createSliceDataset(map);
  }, [filteredInfluencers]);

  // 5. CREATOR CATEGORY
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInfluencers.forEach(inf => {
      let cat = (inf as any).creatorCategory || '';
      if (!cat && inf.platforms) {
        const pMatch = inf.platforms.find(p => (p as any).performance_code);
        if (pMatch) cat = (pMatch as any).performance_code;
      }
      const catName = cat.trim() || 'Not Provided';
      map[catName] = (map[catName] || 0) + 1;
    });
    return createSliceDataset(map);
  }, [filteredInfluencers]);

  // 6. LANGUAGES (Multi-valued)
  const languageData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInfluencers.forEach(inf => {
      let langs: string[] = [];
      if (Array.isArray(inf.languages)) {
        langs = inf.languages.filter(l => typeof l === 'string' && !l.startsWith('views_data:'));
      } else if (typeof inf.languages === 'string') {
        langs = (inf.languages as string).split(/[,/]+/).map(s => s.trim()).filter(Boolean);
      }

      if (langs.length === 0) {
        map['Not Provided'] = (map['Not Provided'] || 0) + 1;
      } else {
        langs.forEach(lang => {
          const cleanLang = lang.trim();
          if (cleanLang) {
            map[cleanLang] = (map[cleanLang] || 0) + 1;
          }
        });
      }
    });
    return createSliceDataset(map);
  }, [filteredInfluencers]);

  // 7. FOLLOWERS BASED
  const followerData = useMemo(() => {
    const map: Record<string, number> = {
      'Below 1K': 0,
      '1K–5K': 0,
      '5K–10K': 0,
      '10K–25K': 0,
      '25K–50K': 0,
      '50K–100K': 0,
      '100K–500K': 0,
      '500K+': 0,
      'Not Provided': 0
    };

    filteredInfluencers.forEach(inf => {
      let maxF = 0;
      if (inf.platforms && inf.platforms.length > 0) {
        maxF = Math.max(...inf.platforms.map(p => Number(p.followers_count) || 0));
      }
      if (maxF === 0) {
        map['Not Provided']++;
      } else if (maxF < 1000) map['Below 1K']++;
      else if (maxF >= 1000 && maxF < 5000) map['1K–5K']++;
      else if (maxF >= 5000 && maxF < 10000) map['5K–10K']++;
      else if (maxF >= 10000 && maxF < 25000) map['10K–25K']++;
      else if (maxF >= 25000 && maxF < 50000) map['25K–50K']++;
      else if (maxF >= 50000 && maxF < 100000) map['50K–100K']++;
      else if (maxF >= 100000 && maxF < 500000) map['100K–500K']++;
      else if (maxF >= 500000) map['500K+']++;
    });

    const activeMap: Record<string, number> = {};
    Object.entries(map).forEach(([key, count]) => {
      if (count > 0) activeMap[key] = count;
    });
    return createSliceDataset(activeMap);
  }, [filteredInfluencers]);

  // 8. PLATFORM COMBINATION
  const platformData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInfluencers.forEach(inf => {
      const set = new Set<string>();
      if (inf.platforms) {
        inf.platforms.forEach(p => {
          if (p.username || (p.followers_count && p.followers_count > 0) || p.profile_link) {
            const name = p.platform.toLowerCase();
            if (name.includes('insta')) set.add('Instagram');
            else if (name.includes('you')) set.add('YouTube');
            else if (name.includes('face')) set.add('Facebook');
          }
        });
      }
      const comboArr = Array.from(set).sort();
      const comboStr = comboArr.length > 0 ? comboArr.join(' + ') : 'Not Provided';
      map[comboStr] = (map[comboStr] || 0) + 1;
    });
    return createSliceDataset(map);
  }, [filteredInfluencers]);

  // Render Redesigned Spacious Breakdown Card (No nested duplicate scrollbars)
  const renderAnalyticsCard = (
    title: string,
    Icon: React.ElementType,
    sliceData: DonutSliceData[],
    isMultiSelect: boolean = false,
    customCenterLabel: string = 'INFLUENCERS'
  ) => {
    const totalVal = sliceData.reduce((sum, item) => sum + item.value, 0);
    const isExpanded = !!expandedCards[title];
    const visibleData = isExpanded ? sliceData : sliceData.slice(0, 6);
    const hasMore = sliceData.length > 6;

    return (
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/20 rounded-2xl border border-slate-800/90 hover:border-purple-500/40 p-6 shadow-xl flex flex-col justify-between min-h-[360px] transition-all group">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-900/50 to-indigo-900/40 border border-purple-700/40 rounded-xl text-purple-300 shadow-inner">
              <Icon size={20} />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-100 uppercase tracking-wide group-hover:text-purple-200 transition-colors">{title}</h4>
              <p className="text-xs text-slate-400 font-medium">
                {sliceData.length} {sliceData.length === 1 ? 'category' : 'categories'}
              </p>
            </div>
          </div>
          {isMultiSelect && (
            <span className="text-xs bg-purple-950/80 border border-purple-700/50 text-purple-300 font-semibold px-2.5 py-1 rounded-lg shadow-xs">
              Multi-Select
            </span>
          )}
        </div>

        {/* Card Content Grid: Donut Chart Left (45%), Breakdown List Right (55%) */}
        {totalInfluencerCount > 0 && sliceData.length > 0 ? (
          <div className="flex flex-col lg:flex-row items-center gap-6 flex-1">
            
            {/* Donut Chart Ring (45% Width) */}
            <div className="w-full lg:w-[45%] flex items-center justify-center p-2">
              <AnalyticsDonutChart
                data={sliceData}
                centerValue={totalVal}
                centerLabel={customCenterLabel}
                height={230}
                innerRadius={65}
                outerRadius={95}
                showLegend={false}
              />
            </div>

            {/* Breakdown List (55% Width, Clean spacious rows) */}
            <div className="w-full lg:w-[55%] flex flex-col justify-center space-y-2 pl-0 lg:pl-4 border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-4 lg:pt-0">
              <div className="space-y-2">
                {visibleData.map((item) => {
                  const pct = totalVal > 0 ? ((item.value / (isMultiSelect ? totalInfluencerCount : totalVal)) * 100).toFixed(1) : '0';
                  return (
                    <div 
                      key={item.name} 
                      className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-purple-500/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-semibold text-slate-200 leading-snug break-words" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-right font-mono">
                        <span className="text-xs font-bold text-slate-100">{item.value}</span>
                        <span className="text-xs font-bold text-purple-400 min-w-[48px] text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Show More / Show Less Button */}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => toggleExpand(title)}
                  className="mt-2 text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg border border-purple-900/40 hover:border-purple-700/60 bg-purple-950/20 transition-all cursor-pointer w-full"
                >
                  {isExpanded ? (
                    <>
                      <span>Show Less</span> <ChevronUp size={14} />
                    </>
                  ) : (
                    <>
                      <span>Show All ({sliceData.length})</span> <ChevronDown size={14} />
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 space-y-2">
            <AlertCircle size={32} className="text-slate-600" />
            <p className="text-xs font-medium">No data available for this category</p>
          </div>
        )}
      </div>
    );
  };

  const renderOneVideoPriceDistributionCard = (
    sliceData: DonutSliceData[],
    totalUniqueCount: number
  ) => {
    const isExpanded = !!expandedCards['OneVideoPrice'];
    const visibleData = isExpanded ? sliceData : sliceData.slice(0, 7);
    const hasMore = sliceData.length > 7;
    const maxVal = Math.max(...sliceData.map(d => d.value), 1);

    return (
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/20 rounded-2xl border border-slate-800/90 hover:border-purple-500/40 p-6 shadow-xl flex flex-col justify-between min-h-[360px] transition-all group">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-900/50 to-indigo-900/40 border border-purple-700/40 rounded-xl text-purple-300 shadow-inner">
              <CreditCard size={20} />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-100 uppercase tracking-wide group-hover:text-purple-200 transition-colors">
                INFLUENCER PRICE — ONE VIDEO
              </h4>
              <p className="text-xs text-slate-400 font-medium">
                Unique influencers by agreed price per video
              </p>
            </div>
          </div>
          <span className="text-xs bg-purple-950/80 border border-purple-700/50 text-purple-300 font-semibold px-2.5 py-1 rounded-lg shadow-xs">
            Bar Chart
          </span>
        </div>

        {/* Bar Chart Content */}
        {totalUniqueCount > 0 && sliceData.length > 0 ? (
          <div className="flex-1 flex flex-col justify-center space-y-3">
            {visibleData.map((item) => {
              const pct = totalUniqueCount > 0 ? ((item.value / totalUniqueCount) * 100).toFixed(1) : '0';
              const widthPct = Math.max((item.value / maxVal) * 100, 2);

              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-200 font-sans">{item.name}</span>
                    <div className="flex items-center gap-3 font-mono shrink-0">
                      <span className="text-slate-100 font-bold">{item.value} {item.value === 1 ? 'influencer' : 'influencers'}</span>
                      <span className="text-purple-400 min-w-[48px] text-right font-bold">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: item.color || '#9333ea'
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <button
                type="button"
                onClick={() => toggleExpand('OneVideoPrice')}
                className="mt-2 text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg border border-purple-900/40 hover:border-purple-700/60 bg-purple-950/20 transition-all cursor-pointer w-full"
              >
                {isExpanded ? (
                  <>
                    <span>Show Less</span> <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    <span>Show All ({sliceData.length} price points)</span> <ChevronDown size={14} />
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 space-y-2">
            <AlertCircle size={32} className="text-slate-600" />
            <p className="text-xs font-medium">No pricing data available</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 p-4 lg:p-6 animate-fade-in text-slate-200 pb-12">

      {/* Analytics Toolbar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h3 className="text-xl font-black text-slate-100 flex items-center gap-2 tracking-tight">
            Campaign Influencer Analytics
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Real-time analytics dynamically generated from {totalInfluencerCount} influencer records
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw size={14} /> Reset Filters
            </button>
          )}
          <button
            type="button"
            onClick={onOpenFilter}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Filter size={15} />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-white text-purple-900 rounded-full font-black text-[11px]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Empty State when filters return 0 records */}
      {totalInfluencerCount === 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-xl">
          <div className="p-4 bg-purple-950/40 border border-purple-800/30 rounded-2xl text-purple-400">
            <AlertCircle size={40} />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-100">No Influencers Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              No campaign influencers match the selected filter combination. Try clearing or relaxing some filters.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetFilters}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw size={14} /> Clear All Filters
          </button>
        </div>
      ) : (
        /* 2-Column Dashboard Grid for Breakdown Cards */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Row 1 */}
          {renderAnalyticsCard('State Wise', MapPin, stateData)}
          {renderAnalyticsCard('City Wise', Building2, cityData)}

          {/* Row 2 */}
          {renderAnalyticsCard('Price Wise', CreditCard, priceData, false, 'TOTAL UNIQUE INFLUENCERS')}
          {renderOneVideoPriceDistributionCard(oneVideoPricingAnalytics.sliceData, oneVideoPricingAnalytics.totalUniqueCount)}

          {/* Row 3 */}
          {renderAnalyticsCard('Product Wise', Package, productData, true)}
          {renderAnalyticsCard('Creator Category', Award, categoryData)}

          {/* Row 4 */}
          {renderAnalyticsCard('Languages', Globe, languageData, true)}
          {renderAnalyticsCard('Followers Based', Users, followerData)}

          {/* Row 5 */}
          {renderAnalyticsCard('Platform Combination', Share2, platformData)}
        </div>
      )}

    </div>
  );
};
