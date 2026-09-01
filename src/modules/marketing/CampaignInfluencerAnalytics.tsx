import React, { useMemo } from 'react';
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
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';
import { AnalyticsDonutChart, DonutSliceData } from '../sales/website/components/AnalyticsDonutChart';
import { normalizeStateName } from '../../components/marketing/InfluencerFilterDrawer';
import { formatDisplayProductName, formatDisplayCombination, parseProductsFromCombination } from './AddCampaignInfluencer';
import type { CampaignAnalyticsFilterState } from '../../components/marketing/CampaignInfluencerAnalyticsFilterDrawer';
import { getSingleVideoPrices } from './CampaignInfluencerList';
import { isArchived } from '../../utils/marketingUtils';

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
  '#64748b'  // Slate
];

export const CampaignInfluencerAnalytics: React.FC<CampaignInfluencerAnalyticsProps> = ({
  campaign,
  influencers,
  filterState,
  onOpenFilter,
  activeFilterCount,
  onResetFilters
}) => {

  // 1. In-Memory Filter Evaluation (AND Logic)
  const filteredInfluencers = useMemo(() => {
    return influencers.filter(inf => {
      // Exclude archived influencers if needed or match active status
      if (isArchived(inf.is_archived)) return false;

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

      // Languages (Multi-select: influencer matching any selected language qualifies)
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

  // Helper for generating sorted slice data with colors & percentages
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

  // 3. PRICE WISE (Single video price ranges as specified)
  const priceData = useMemo(() => {
    const map: Record<string, number> = {
      'Below ₹500': 0,
      '₹500–₹749': 0,
      '₹750–₹999': 0,
      '₹1,000–₹1,249': 0,
      '₹1,250–₹1,499': 0,
      '₹1,500–₹1,999': 0,
      '₹2,000 and above': 0,
      'Not Provided': 0
    };

    filteredInfluencers.forEach(inf => {
      const prices = getSingleVideoPrices(inf);
      if (prices.length === 0) {
        map['Not Provided']++;
      } else {
        // Count influencer in range of their video prices
        prices.forEach((price: number) => {
          if (price < 500) map['Below ₹500']++;
          else if (price >= 500 && price <= 749) map['₹500–₹749']++;
          else if (price >= 750 && price <= 999) map['₹750–₹999']++;
          else if (price >= 1000 && price <= 1249) map['₹1,000–₹1,249']++;
          else if (price >= 1250 && price <= 1499) map['₹1,250–₹1,499']++;
          else if (price >= 1500 && price <= 1999) map['₹1,500–₹1,999']++;
          else if (price >= 2000) map['₹2,000 and above']++;
        });
      }
    });

    const activeMap: Record<string, number> = {};
    Object.entries(map).forEach(([key, count]) => {
      if (count > 0) activeMap[key] = count;
    });
    return createSliceDataset(activeMap);
  }, [filteredInfluencers]);

  // 4. PRODUCT WISE (Multi-valued: counts each product assigned)
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

  // 6. LANGUAGES (Multi-valued: counts each language selected)
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
      else if (maxF >= 25000 && maxF < 50000) map['25K–500K']++;
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

  // Render Card with Donut Chart + Right/Below Detailed Legend List
  const renderAnalyticsCard = (
    title: string,
    Icon: React.ElementType,
    sliceData: DonutSliceData[],
    isMultiSelect: boolean = false
  ) => {
    const totalVal = sliceData.reduce((sum, item) => sum + item.value, 0);

    return (
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col justify-between">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-950/60 border border-purple-800/40 rounded-lg text-purple-400">
              <Icon size={18} />
            </div>
            <h4 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">{title}</h4>
          </div>
          {isMultiSelect && (
            <span className="text-[10px] bg-purple-950/40 border border-purple-800/30 text-purple-300 font-semibold px-2 py-0.5 rounded">
              Multi-Select
            </span>
          )}
        </div>

        {/* Content Layout: Chart Left, Legend Right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center flex-1">
          {/* Chart Ring */}
          <div className="md:col-span-6 flex justify-center">
            <AnalyticsDonutChart
              data={sliceData}
              centerValue={totalInfluencerCount}
              centerLabel="INFLUENCERS"
              height={200}
              innerRadius={55}
              outerRadius={80}
            />
          </div>

          {/* Legend Details List */}
          <div className="md:col-span-6 space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
            {sliceData.length > 0 ? (
              sliceData.map((item) => {
                const pct = totalVal > 0 ? ((item.value / (isMultiSelect ? totalInfluencerCount : totalVal)) * 100).toFixed(1) : '0';
                return (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-300 font-medium truncate" title={item.name}>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 font-mono">
                      <span className="text-slate-100 font-bold">{item.value}</span>
                      <span className="text-purple-400 text-[11px] font-semibold w-12 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs italic">No data available</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">

      {/* Analytics Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            Campaign Influencer Analytics
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time analytics computed from {totalInfluencerCount} campaign influencer records
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={onResetFilters}
              className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={14} /> Clear Filters
            </button>
          )}
          <button
            onClick={onOpenFilter}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Filter size={14} />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 bg-white text-purple-900 rounded-full font-bold text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 8 Breakdown Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Row 1 */}
        {renderAnalyticsCard('State Wise', MapPin, stateData)}
        {renderAnalyticsCard('City Wise', Building2, cityData)}

        {/* Row 2 */}
        {renderAnalyticsCard('Price Wise', CreditCard, priceData)}
        {renderAnalyticsCard('Product Wise', Package, productData, true)}

        {/* Row 3 */}
        {renderAnalyticsCard('Creator Category', Award, categoryData)}
        {renderAnalyticsCard('Languages', Globe, languageData, true)}

        {/* Row 4 */}
        {renderAnalyticsCard('Followers Based', Users, followerData)}
        {renderAnalyticsCard('Platform Combination', Share2, platformData)}
      </div>

    </div>
  );
};
