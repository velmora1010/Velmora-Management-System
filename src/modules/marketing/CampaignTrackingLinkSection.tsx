import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Link2, 
  ArrowLeft, 
  Plus, 
  Filter, 
  Loader2, 
  SearchX, 
  AlertCircle,
  RefreshCw,
  Copy, 
  Check, 
  ExternalLink, 
  Globe, 
  ShoppingBag, 
  ShoppingCart,
  Store,
  Video, 
  LayoutGrid, 
  Table as TableIcon, 
  Search, 
  Trash2, 
  Edit3, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  MousePointerClick
} from 'lucide-react';
import type { Campaign, CampaignInfluencer, InfluencerTrackingLink } from '../../types';
import { SCRIPT_PRODUCTS } from '../../services/campaignScriptService';
import { 
  fetchInfluencerTrackingLinks, 
  deleteInfluencerTrackingLink,
  fetchTrackingLinkClicks,
  TRACKING_PLATFORMS, 
  TRACKING_VIDEOS, 
  compareTrackingLinksByCodeAsc 
} from '../../services/influencerTrackingLinkService';
import { CampaignTrackingLinkModal } from './CampaignTrackingLinkModal';
import { CampaignTrackingLinkCard } from './CampaignTrackingLinkCard';
import { useCampaignInfluencers } from '../../hooks/marketing/useCampaignInfluencers';
import { isActiveStatus } from '../../utils/marketingUtils';
import toast from 'react-hot-toast';

interface CampaignTrackingLinkSectionProps {
  campaign: Campaign;
  onBack: () => void;
}

// Data structures for hierarchical grouping: Product -> Category -> Platform -> Links
interface PlatformGroup {
  platformName: string;
  category: 'WEBSITE' | 'MARKETPLACE' | string;
  brandColor: string;
  links: InfluencerTrackingLink[];
}

interface CategoryGroup {
  category: 'WEBSITE' | 'MARKETPLACE' | string;
  platforms: PlatformGroup[];
  totalLinks: number;
}

interface ProductGroup {
  product: string;
  totalLinks: number;
  categories: CategoryGroup[];
}

// Platform Icon with recognizable brand styling
const PlatformBrandIcon: React.FC<{ platform: string; color?: string }> = ({ platform, color }) => {
  const norm = platform.toLowerCase();
  if (norm.includes('instagram')) {
    return (
      <span className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
        </svg>
      </span>
    );
  }
  if (norm.includes('youtube')) {
    return (
      <span className="w-5 h-5 rounded-md bg-red-600 flex items-center justify-center text-white shrink-0 shadow-xs">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
        </svg>
      </span>
    );
  }
  if (norm.includes('facebook')) {
    return (
      <span className="w-5 h-5 rounded-md bg-[#1877F2] flex items-center justify-center text-white shrink-0 font-bold text-[13px] leading-none shadow-xs">
        f
      </span>
    );
  }
  if (norm.includes('flipkart')) {
    return (
      <span className="w-5 h-5 rounded-md bg-[#2874F0] flex items-center justify-center text-amber-300 shrink-0 shadow-xs">
        <ShoppingCart size={12} />
      </span>
    );
  }
  if (norm.includes('amazon')) {
    return (
      <span className="w-5 h-5 rounded-md bg-[#FF9900] flex items-center justify-center text-slate-950 shrink-0 shadow-xs">
        <ShoppingBag size={12} />
      </span>
    );
  }
  if (norm.includes('meesho')) {
    return (
      <span className="w-5 h-5 rounded-md bg-[#F43397] flex items-center justify-center text-white shrink-0 shadow-xs">
        <Store size={12} />
      </span>
    );
  }
  return (
    <span
      className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs"
      style={{ backgroundColor: color || '#A855F7' }}
    >
      <Globe size={12} />
    </span>
  );
};

export const CampaignTrackingLinkSection: React.FC<CampaignTrackingLinkSectionProps> = ({ 
  campaign, 
  onBack 
}) => {
  const [links, setLinks] = useState<InfluencerTrackingLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Click tracking state
  const [clicksMap, setClicksMap] = useState<Record<string, number>>({});
  const [isClicksConfigured, setIsClicksConfigured] = useState<boolean>(true);
  const [isLoadingClicks, setIsLoadingClicks] = useState<boolean>(false);

  // Filters: Product, Platform, Video
  const [selectedProduct, setSelectedProduct] = useState<string>('All');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');
  const [selectedVideo, setSelectedVideo] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // View Mode: 'table' or 'grid'
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [linkToEdit, setLinkToEdit] = useState<InfluencerTrackingLink | null>(null);
  const [createProductDefault, setCreateProductDefault] = useState<string | undefined>(undefined);

  // Delete modal state
  const [linkToDelete, setLinkToDelete] = useState<InfluencerTrackingLink | null>(null);

  // Copy tracking state for feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Accordion expansion state:
  // expandedProducts: { [productName: string]: boolean }
  // expandedPlatforms: { [`${productName}::${platformName}`]: boolean }
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});

  // Fetch campaign influencers
  const { influencers, refresh: refreshInfluencers } = useCampaignInfluencers(campaign.id);

  // Set of eliminated influencer IDs to strictly exclude from active tracking links
  const eliminatedInfluencerIds = useMemo(() => {
    const set = new Set<string>();
    influencers.forEach(inf => {
      if (!isActiveStatus(inf.is_archived)) {
        set.add(String(inf.id));
      }
    });
    return set;
  }, [influencers]);

  // Load tracking links & fetch server-side click counts
  const loadLinks = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await fetchInfluencerTrackingLinks(campaign.id);
      setLinks(data);

      const linkIds = data.map(l => String(l.id));
      if (linkIds.length > 0) {
        setIsLoadingClicks(true);
        try {
          const res = await fetchTrackingLinkClicks(linkIds);
          setIsClicksConfigured(res.configured);
          setClicksMap(res.clicks || {});
        } catch (e) {
          console.warn('Failed to fetch clicks:', e);
        } finally {
          setIsLoadingClicks(false);
        }
      } else {
        setClicksMap({});
      }
    } catch (err: any) {
      console.error('Error loading influencer tracking links:', err);
      const msg = err?.message || 'Failed to load tracking links.';
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  // Open Create Modal
  const handleOpenCreate = (preselectedProduct?: string) => {
    setLinkToEdit(null);
    setCreateProductDefault(preselectedProduct);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (link: InfluencerTrackingLink) => {
    setLinkToEdit(link);
    setCreateProductDefault(link.product);
    setIsModalOpen(true);
  };

  // Modal success handler
  const handleModalSuccess = (savedLinks: InfluencerTrackingLink[]) => {
    setLinks(prev => {
      const copy = [...prev];
      savedLinks.forEach(saved => {
        const idx = copy.findIndex(l => l.id === saved.id);
        if (idx >= 0) {
          copy[idx] = saved;
        } else {
          copy.push(saved);
        }
      });
      return copy.sort(compareTrackingLinksByCodeAsc);
    });

    const savedIds = savedLinks.map(l => String(l.id));
    if (savedIds.length > 0) {
      fetchTrackingLinkClicks(savedIds).then(res => {
        setIsClicksConfigured(res.configured);
        setClicksMap(prev => ({ ...prev, ...(res.clicks || {}) }));
      });
    }
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!linkToDelete) return;
    try {
      await deleteInfluencerTrackingLink(linkToDelete.id, campaign.id);
      toast.success('Tracking link deleted successfully');
      setLinks(prev => prev.filter(l => l.id !== linkToDelete.id));
      setLinkToDelete(null);
    } catch (err: any) {
      console.error('Error deleting tracking link:', err);
      toast.error(err?.message || 'Failed to delete tracking link');
    }
  };

  // Copy tracking URL helper
  const handleCopyLink = async (link: InfluencerTrackingLink) => {
    const textToCopy = link.tracking_url || '';
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(link.id);
      setTimeout(() => {
        setCopiedId(null);
      }, 1800);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Open tracking URL helper
  const handleOpenLink = (url: string) => {
    if (!url) return;
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    window.open(clean, '_blank', 'noopener,noreferrer');
  };

  // Filtered links list: Excludes eliminated influencers
  const filteredLinks = useMemo(() => {
    // 1. Exclude records belonging to eliminated influencers
    const activeEligibleLinks = links.filter(
      l => !eliminatedInfluencerIds.has(String(l.influencer_id))
    );

    // 2. Apply Product, Platform, Video, and Search filters
    const filtered = activeEligibleLinks.filter(l => {
      // Product Filter
      const matchProduct = selectedProduct === 'All' || 
        l.product.toLowerCase() === selectedProduct.toLowerCase();

      // Platform Filter
      const matchPlatform = selectedPlatform === 'All' || 
        (l.platform && l.platform.toLowerCase() === selectedPlatform.toLowerCase()) ||
        (l.utm_source && l.utm_source.toLowerCase() === selectedPlatform.toLowerCase());

      // Video Filter
      const matchVideo = selectedVideo === 'All' || 
        (l.video_number && l.video_number.toLowerCase() === selectedVideo.toLowerCase()) ||
        (l.utm_content && l.utm_content.toLowerCase() === selectedVideo.toLowerCase());

      // Search Query
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q || 
        (l.influencer_name && l.influencer_name.toLowerCase().includes(q)) ||
        (l.influencer_code && l.influencer_code.toLowerCase().includes(q)) ||
        (l.creator_code && l.creator_code.toLowerCase().includes(q)) ||
        (l.tracking_url && l.tracking_url.toLowerCase().includes(q)) ||
        (l.product && l.product.toLowerCase().includes(q)) ||
        (l.platform && l.platform.toLowerCase().includes(q));

      return matchProduct && matchPlatform && matchVideo && matchSearch;
    });

    return filtered.sort(compareTrackingLinksByCodeAsc);
  }, [links, eliminatedInfluencerIds, selectedProduct, selectedPlatform, selectedVideo, searchQuery]);

  // Hierarchical Grouping: PRODUCT -> PLATFORM CATEGORY (WEBSITE / MARKETPLACE) -> PLATFORM -> LINKS
  const productGroups: ProductGroup[] = useMemo(() => {
    // Group filtered links by product
    const prodMap = new Map<string, InfluencerTrackingLink[]>();

    filteredLinks.forEach(link => {
      const prodName = link.product || 'Unassigned Product';
      if (!prodMap.has(prodName)) {
        prodMap.set(prodName, []);
      }
      prodMap.get(prodName)!.push(link);
    });

    const groups: ProductGroup[] = [];

    prodMap.forEach((pLinks, prodName) => {
      // Within this product, categorize by category: WEBSITE and MARKETPLACE
      const catMap = new Map<string, Map<string, InfluencerTrackingLink[]>>();
      catMap.set('WEBSITE', new Map());
      catMap.set('MARKETPLACE', new Map());

      pLinks.forEach(link => {
        const platName = (link.platform || link.utm_source || 'Instagram').trim();
        const matched = TRACKING_PLATFORMS.find(
          p => p.name.toLowerCase() === platName.toLowerCase() ||
               p.utmSource.toLowerCase() === platName.toLowerCase() ||
               p.id.toLowerCase() === platName.toLowerCase()
        );

        const canonicalName = matched?.name || platName;
        const category: 'WEBSITE' | 'MARKETPLACE' =
          link.platform_category === 'MARKETPLACE' || matched?.category === 'MARKETPLACE'
            ? 'MARKETPLACE'
            : 'WEBSITE';

        if (!catMap.has(category)) {
          catMap.set(category, new Map());
        }
        const platformMap = catMap.get(category)!;
        if (!platformMap.has(canonicalName)) {
          platformMap.set(canonicalName, []);
        }
        platformMap.get(canonicalName)!.push(link);
      });

      const categories: CategoryGroup[] = [];
      const categoryOrder = ['WEBSITE', 'MARKETPLACE'];

      categoryOrder.forEach(catName => {
        const platformMap = catMap.get(catName);
        if (!platformMap || platformMap.size === 0) return;

        const platforms: PlatformGroup[] = [];

        // Preferred canonical platform order
        const preferredPlatforms = catName === 'WEBSITE'
          ? ['Instagram', 'YouTube', 'Facebook']
          : ['Flipkart', 'Amazon', 'Meesho'];

        // Add preferred platforms first if present
        preferredPlatforms.forEach(pName => {
          if (platformMap.has(pName)) {
            const linksForPlat = platformMap.get(pName)!;
            if (linksForPlat.length > 0) {
              const matched = TRACKING_PLATFORMS.find(p => p.name.toLowerCase() === pName.toLowerCase());
              platforms.push({
                platformName: pName,
                category: catName,
                brandColor: matched?.brandColor || '#A855F7',
                links: linksForPlat.sort(compareTrackingLinksByCodeAsc)
              });
              platformMap.delete(pName);
            }
          }
        });

        // Add any remaining platforms under this category
        platformMap.forEach((linksForPlat, pName) => {
          if (linksForPlat.length > 0) {
            const matched = TRACKING_PLATFORMS.find(p => p.name.toLowerCase() === pName.toLowerCase());
            platforms.push({
              platformName: pName,
              category: catName,
              brandColor: matched?.brandColor || '#A855F7',
              links: linksForPlat.sort(compareTrackingLinksByCodeAsc)
            });
          }
        });

        if (platforms.length > 0) {
          const catTotal = platforms.reduce((acc, p) => acc + p.links.length, 0);
          categories.push({
            category: catName,
            platforms,
            totalLinks: catTotal
          });
        }
      });

      // Include any other non-standard categories if present
      catMap.forEach((platformMap, catName) => {
        if (!categoryOrder.includes(catName) && platformMap.size > 0) {
          const platforms: PlatformGroup[] = [];
          platformMap.forEach((linksForPlat, pName) => {
            if (linksForPlat.length > 0) {
              platforms.push({
                platformName: pName,
                category: catName,
                brandColor: '#A855F7',
                links: linksForPlat.sort(compareTrackingLinksByCodeAsc)
              });
            }
          });
          if (platforms.length > 0) {
            const catTotal = platforms.reduce((acc, p) => acc + p.links.length, 0);
            categories.push({
              category: catName,
              platforms,
              totalLinks: catTotal
            });
          }
        }
      });

      if (categories.length > 0) {
        groups.push({
          product: prodName,
          totalLinks: pLinks.length,
          categories
        });
      }
    });

    return groups;
  }, [filteredLinks]);

  // Toggle handlers for collapsible sections
  const toggleProduct = (prodName: string) => {
    setExpandedProducts(prev => {
      const current = prev[prodName];
      // If undefined, default was true only for 1st product; toggling flips it
      const isCurrentlyExpanded = current !== undefined ? current : false;
      return { ...prev, [prodName]: !isCurrentlyExpanded };
    });
  };

  const togglePlatform = (prodName: string, platName: string) => {
    const key = `${prodName}::${platName}`;
    setExpandedPlatforms(prev => {
      const current = prev[key];
      const isCurrentlyExpanded = current !== undefined ? current : false;
      return { ...prev, [key]: !isCurrentlyExpanded };
    });
  };

  // Helper: Are all products expanded?
  const allExpanded = useMemo(() => {
    if (productGroups.length === 0) return false;
    return productGroups.every((p, idx) => {
      const isPExp = expandedProducts[p.product] ?? (idx === 0);
      return isPExp;
    });
  }, [productGroups, expandedProducts]);

  const handleToggleAll = () => {
    const nextState = !allExpanded;
    const newProducts: Record<string, boolean> = {};
    const newPlatforms: Record<string, boolean> = {};

    productGroups.forEach(p => {
      newProducts[p.product] = nextState;
      p.categories.forEach(c => {
        c.platforms.forEach(plat => {
          newPlatforms[`${p.product}::${plat.platformName}`] = nextState;
        });
      });
    });

    setExpandedProducts(newProducts);
    setExpandedPlatforms(newPlatforms);
  };

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="w-full space-y-5 animate-fade-in text-slate-200">
      {/* Top Header Bar */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            <ArrowLeft size={16} />
            <span>Back to Campaign</span>
          </button>
          <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shadow-sm">
              <Link2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Influencer Tracking Link</h3>
              <p className="text-xs text-slate-400 mt-0.5">{campaign.campaign_name}</p>
            </div>
          </div>
        </div>

        {/* Top Right: Create Tracking Link Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleOpenCreate(selectedProduct !== 'All' ? selectedProduct : undefined)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-900/25 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Tracking Link</span>
          </button>
        </div>
      </div>

      {/* Filters Bar & Controls */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
        {/* Row 1: PRODUCT, PLATFORM, VIDEO Filters in clean 3-column layout */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Filter 1: Product */}
          <div className="flex items-center gap-2 bg-[#070c18] border border-slate-800 rounded-xl px-3 py-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <Filter size={12} className="text-purple-400" />
              <span>Product:</span>
            </span>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full truncate"
            >
              <option value="All" className="bg-slate-900">All Products</option>
              {SCRIPT_PRODUCTS.map((prod) => (
                <option key={prod} value={prod} className="bg-slate-900">
                  {prod}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Platform */}
          <div className="flex items-center gap-2 bg-[#070c18] border border-slate-800 rounded-xl px-3 py-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <Globe size={12} className="text-purple-400" />
              <span>Platform:</span>
            </span>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full truncate"
            >
              <option value="All" className="bg-slate-900">All Platforms</option>
              {TRACKING_PLATFORMS.map((plat) => (
                <option key={plat.id} value={plat.name} className="bg-slate-900">
                  {plat.name} ({plat.category})
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Video */}
          <div className="flex items-center gap-2 bg-[#070c18] border border-slate-800 rounded-xl px-3 py-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <Video size={12} className="text-purple-400" />
              <span>Video:</span>
            </span>
            <select
              value={selectedVideo}
              onChange={(e) => setSelectedVideo(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full truncate"
            >
              <option value="All" className="bg-slate-900">All Videos</option>
              {TRACKING_VIDEOS.map((vid) => (
                <option key={vid.id} value={vid.name} className="bg-slate-900">
                  {vid.name} ({vid.utmContent})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Search, Count, Expand All, & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {/* Quick Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by creator name, #code, product, or URL..."
              className="w-full bg-[#070c18] border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Right Controls: Count, Expand/Collapse All, View Mode, Refresh */}
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              Showing <span className="text-purple-400 font-bold">{filteredLinks.length}</span>{' '}
              {filteredLinks.length === 1 ? 'Link' : 'Links'}
            </span>

            {/* Expand / Collapse All Toggle Button */}
            {productGroups.length > 0 && (
              <button
                type="button"
                onClick={handleToggleAll}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#070c18] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold"
                title={allExpanded ? 'Collapse all sections' : 'Expand all sections'}
              >
                <ChevronsUpDown size={13} className="text-purple-400" />
                <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#070c18] border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Table View"
              >
                <TableIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Grid / Card View"
              >
                <LayoutGrid size={14} />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                loadLinks();
                refreshInfluencers();
              }}
              disabled={isLoading}
              className="p-1.5 rounded-xl bg-[#070c18] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh links"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-purple-400' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-[#0b1329]/60 border border-slate-800/90 rounded-2xl p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <Loader2 size={32} className="animate-spin text-purple-400 mb-3" />
          <h4 className="text-sm font-semibold text-slate-300">Loading tracking links...</h4>
          <p className="text-xs text-slate-500 mt-1">Connecting to Supabase</p>
        </div>
      ) : fetchError ? (
        <div className="bg-[#0b1329]/60 border border-red-500/30 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mb-3">
            <AlertCircle size={24} />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">Failed to load tracking links</h4>
          <p className="text-xs text-red-400 max-w-md mb-4">{fetchError}</p>
          <button
            type="button"
            onClick={loadLinks}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : filteredLinks.length === 0 ? (
        /* Empty States: Distinct for specific filtered product vs general empty */
        <div className="bg-[#0b1329]/60 border border-slate-800/90 rounded-2xl p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 shadow-inner">
            {links.length === 0 ? <Link2 size={32} /> : <SearchX size={32} />}
          </div>
          <h4 className="text-base sm:text-lg font-bold text-white mb-1.5">
            {selectedProduct !== 'All'
              ? `No tracking links created for ${selectedProduct} yet`
              : links.length === 0
                ? 'No tracking links created yet'
                : 'No matching tracking links found'}
          </h4>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            {selectedProduct !== 'All'
              ? `Click below to generate UTM tracking links for ${selectedProduct} across eligible campaign influencers.`
              : links.length === 0
                ? `Get started by clicking Create Tracking Link to automatically generate unique UTM tracking links for all eligible influencers in ${campaign.campaign_name}.`
                : 'No tracking links match the selected filters or search query. Try adjusting filters or create a new link.'}
          </p>
          <button
            type="button"
            onClick={() => handleOpenCreate(selectedProduct !== 'All' ? selectedProduct : undefined)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-900/25 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Tracking Link</span>
          </button>
        </div>
      ) : (
        /* Hierarchical Grouped View: PRODUCT -> PLATFORM CATEGORY -> PLATFORM -> INFLUENCER TABLE */
        <div className="space-y-6">
          {productGroups.map((productGroup, prodIndex) => {
            // Collapsible state: first product is expanded by default (index === 0)
            // or if user searched, auto-expand
            const isProductExpanded = isSearching
              ? true
              : (expandedProducts[productGroup.product] !== undefined
                  ? expandedProducts[productGroup.product]
                  : prodIndex === 0);

            return (
              <div 
                key={productGroup.product}
                className="bg-[#0b1329] border border-slate-800/90 hover:border-slate-700/80 rounded-2xl overflow-hidden shadow-sm transition-all duration-200"
              >
                {/* 1. PRODUCT HEADER BAR (Collapsible) */}
                <button
                  type="button"
                  onClick={() => toggleProduct(productGroup.product)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-[#0e1733] to-[#0b1329] hover:from-[#121d42] hover:to-[#0e1935] transition-all cursor-pointer text-left border-b border-slate-800/80"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-500/30 text-purple-300 flex items-center justify-center text-xl shrink-0 shadow-sm">
                      🧴
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="text-base sm:text-lg font-bold text-white tracking-wide uppercase truncate">
                          {productGroup.product}
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                          {productGroup.totalLinks} {productGroup.totalLinks === 1 ? 'Link' : 'Links'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Product Tracking Links</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-slate-400 shrink-0 ml-3">
                    <span className="text-xs font-medium hidden md:inline text-slate-500">
                      {isProductExpanded ? 'Click to collapse' : 'Click to expand'}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-center text-slate-300">
                      {isProductExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>
                </button>

                {/* 2. PRODUCT BODY: PLATFORM CATEGORIES (Shown when product is expanded) */}
                {isProductExpanded && (
                  <div className="p-4 sm:p-5 space-y-6 bg-[#080d1c]/40">
                    {productGroup.categories.map((catGroup, catIdx) => (
                      <div key={catGroup.category} className="space-y-3">
                        {/* Category Label with Divider */}
                        <div className="flex items-center gap-2.5 pb-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-slate-400">
                            {catGroup.category === 'WEBSITE' ? (
                              <Globe size={13} className="text-purple-400" />
                            ) : (
                              <ShoppingBag size={13} className="text-amber-400" />
                            )}
                            <span className="text-slate-300">{catGroup.category}</span>
                          </div>
                          <div className="h-[1px] flex-1 bg-slate-800/80" />
                          <span className="text-[11px] font-semibold text-slate-500">
                            {catGroup.totalLinks} {catGroup.totalLinks === 1 ? 'Link' : 'Links'}
                          </span>
                        </div>

                        {/* Platform Cards */}
                        <div className="space-y-3">
                          {catGroup.platforms.map((platformGroup, platIdx) => {
                            const platformKey = `${productGroup.product}::${platformGroup.platformName}`;
                            // Platform collapsible state:
                            // By default, first platform in first category is expanded, or auto-expand if searching
                            const isPlatformExpanded = isSearching
                              ? true
                              : (expandedPlatforms[platformKey] !== undefined
                                  ? expandedPlatforms[platformKey]
                                  : (catIdx === 0 && platIdx === 0));

                            return (
                              <div
                                key={platformGroup.platformName}
                                className="border border-slate-800 rounded-xl overflow-hidden bg-[#070c18] shadow-sm transition-all"
                              >
                                {/* Platform Header Bar (Collapsible) */}
                                <button
                                  type="button"
                                  onClick={() => togglePlatform(productGroup.product, platformGroup.platformName)}
                                  className="w-full flex items-center justify-between px-4 py-3 bg-[#0a1124] hover:bg-[#0f1730] transition-colors cursor-pointer text-left"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <PlatformBrandIcon
                                      platform={platformGroup.platformName}
                                      color={platformGroup.brandColor}
                                    />
                                    <span className="text-sm font-bold text-white tracking-wide truncate">
                                      {platformGroup.platformName.toUpperCase()}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800/90 text-slate-300 border border-slate-700/60 shrink-0">
                                      {platformGroup.links.length}{' '}
                                      {platformGroup.links.length === 1 ? 'Link' : 'Links'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-slate-400 shrink-0 ml-2">
                                    <div className="w-6 h-6 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
                                      {isPlatformExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </div>
                                  </div>
                                </button>

                                {/* Platform Content (Table or Grid) when platform is expanded */}
                                {isPlatformExpanded && (
                                  <div className="border-t border-slate-800/80 bg-[#070c18]">
                                    {viewMode === 'table' ? (
                                      /* 6-Column Clean Table: Influencer, Creator Code, Video, Tracking Link, Clicks, Actions */
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs text-slate-300">
                                          <thead className="bg-[#050914] border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            <tr>
                                              <th scope="col" className="px-4 py-3 min-w-[170px]">Influencer</th>
                                              <th scope="col" className="px-4 py-3 min-w-[110px]">Creator Code</th>
                                              <th scope="col" className="px-4 py-3 min-w-[90px]">Video</th>
                                              <th scope="col" className="px-4 py-3 min-w-[280px]">Tracking Link</th>
                                              <th scope="col" className="px-4 py-3 text-center min-w-[100px]">Clicks</th>
                                              <th scope="col" className="px-4 py-3 text-right min-w-[140px]">Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-800/60">
                                            {platformGroup.links.map((link) => {
                                              const isCopied = copiedId === link.id;
                                              const videoText = link.video_number || 'Video 1';

                                              return (
                                                <tr
                                                  key={link.id}
                                                  className="hover:bg-slate-900/50 transition-colors group"
                                                >
                                                  {/* 1. Influencer */}
                                                  <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                      <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[11px] font-bold shrink-0">
                                                        {(link.influencer_name || 'U').charAt(0).toUpperCase()}
                                                      </div>
                                                      <span className="truncate max-w-[170px]">
                                                        {link.influencer_name || 'Influencer'}
                                                      </span>
                                                    </div>
                                                  </td>

                                                  {/* 2. Creator Code (Ascending Numerical Order preserved) */}
                                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                                    <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-bold text-[11px] border border-purple-500/30">
                                                      {link.influencer_code || link.creator_code
                                                        ? `#${(link.creator_code || link.influencer_code || '').replace(/^#+/, '').toUpperCase()}`
                                                        : '-'}
                                                    </span>
                                                  </td>

                                                  {/* 3. Video */}
                                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                                    <span className="px-2 py-0.5 rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-300 font-bold text-[11px]">
                                                      {videoText}
                                                    </span>
                                                  </td>

                                                  {/* 4. Tracking Link */}
                                                  <td className="px-4 py-2.5 font-mono text-[11px]">
                                                    <div
                                                      className="max-w-md truncate text-purple-300 bg-purple-950/20 px-2 py-1 rounded-lg border border-purple-500/20 select-all cursor-pointer hover:text-purple-200 transition-colors"
                                                      title={link.tracking_url}
                                                      onClick={() => handleCopyLink(link)}
                                                    >
                                                      {link.tracking_url}
                                                    </div>
                                                  </td>

                                                  {/* 5. Clicks (Atomic server-side counter) */}
                                                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                                                    {isLoadingClicks ? (
                                                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                                        <Loader2 size={11} className="animate-spin text-purple-400" />
                                                        <span>...</span>
                                                      </span>
                                                    ) : !isClicksConfigured ? (
                                                      <span
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60"
                                                        title="Redis click tracking not configured"
                                                      >
                                                        N/A
                                                      </span>
                                                    ) : (
                                                      <span
                                                        className={`inline-flex items-center justify-center min-w-[36px] px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                                                          (clicksMap[link.id] || 0) > 0
                                                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                                            : 'bg-slate-900 border-slate-800 text-slate-400'
                                                        }`}
                                                        title={`${clicksMap[link.id] || 0} recorded clicks`}
                                                      >
                                                        {(clicksMap[link.id] || 0).toLocaleString()}
                                                      </span>
                                                    )}
                                                  </td>

                                                  {/* 6. Actions (Copy, Open, Edit, Delete) */}
                                                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                      <button
                                                        type="button"
                                                        onClick={() => handleCopyLink(link)}
                                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                                          isCopied
                                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                            : 'bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border-purple-500/30'
                                                        }`}
                                                        title="Copy complete tracking link"
                                                      >
                                                        {isCopied ? (
                                                          <Check size={12} className="text-emerald-400" />
                                                        ) : (
                                                          <Copy size={12} />
                                                        )}
                                                        <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                                                      </button>

                                                      <button
                                                        type="button"
                                                        onClick={() => handleOpenLink(link.tracking_url)}
                                                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                                                        title="Open tracking URL in new tab"
                                                      >
                                                        <ExternalLink size={13} />
                                                      </button>

                                                      <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(link)}
                                                        className="p-1 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                                                        title="Edit tracking link"
                                                      >
                                                        <Edit3 size={13} />
                                                      </button>

                                                      <button
                                                        type="button"
                                                        onClick={() => setLinkToDelete(link)}
                                                        className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-slate-800 transition-colors cursor-pointer"
                                                        title="Delete tracking link"
                                                      >
                                                        <Trash2 size={13} />
                                                      </button>
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      /* Grid View inside platform */
                                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                                        {platformGroup.links.map((link) => (
                                          <CampaignTrackingLinkCard
                                            key={link.id}
                                            link={link}
                                            clicks={clicksMap[link.id] ?? 0}
                                            isClicksConfigured={isClicksConfigured}
                                            isLoadingClicks={isLoadingClicks}
                                            onEdit={handleOpenEdit}
                                            onDelete={(l) => setLinkToDelete(l)}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {linkToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Delete tracking link?</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to delete the tracking link for{' '}
                <strong className="text-purple-300">
                  {linkToDelete.influencer_name || linkToDelete.influencer_code}
                </strong>{' '}
                ({linkToDelete.product} - {linkToDelete.platform || 'Instagram'})?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setLinkToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
              >
                Delete Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <CampaignTrackingLinkModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setLinkToEdit(null);
          setCreateProductDefault(undefined);
        }}
        campaign={campaign}
        influencers={influencers}
        linkToEdit={linkToEdit}
        defaultProduct={createProductDefault}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};
