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
  MousePointerClick,
  Clock
} from 'lucide-react';
import type { Campaign, CampaignInfluencer, InfluencerTrackingLink } from '../../types';
import { SCRIPT_PRODUCTS } from '../../services/campaignScriptService';
import { 
  fetchInfluencerTrackingLinks, 
  deleteInfluencerTrackingLink,
  bulkDeleteInfluencerTrackingLinks,
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
  const [clicksError, setClicksError] = useState<string | null>(null);
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

  // Bulk Selection & Deletion state
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Pagination state (default: 20 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Dedicated Marketplace View state within a selected product
  const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(null);

  // Click refresh tracking
  const [isRefreshingClicks, setIsRefreshingClicks] = useState<boolean>(false);
  const [lastClicksUpdated, setLastClicksUpdated] = useState<Date | null>(null);

  // Clear selection, selected marketplace, and reset page whenever selected product changes
  useEffect(() => {
    setSelectedLinkIds(new Set());
    setSelectedMarketplace(null);
    setCurrentPage(1);
  }, [selectedProduct]);

  // Reset pagination to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMarketplace, selectedPlatform, selectedVideo, searchQuery, pageSize]);

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
          setClicksError(res.error || null);
          setClicksMap(prev => ({ ...prev, ...(res.clicks || {}) }));
          setLastClicksUpdated(new Date());
        } catch (e: any) {
          console.warn('Failed to fetch clicks:', e);
          setClicksError(e?.message || 'Failed to connect to clicks service');
        } finally {
          setIsLoadingClicks(false);
        }
      } else {
        setClicksMap({});
        setClicksError(null);
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

  // Target-aware reliable Click Count Refresh: only queries relevant IDs and safely merges without clobbering
  const handleRefreshClickCounts = useCallback(async (targetLinks: InfluencerTrackingLink[]) => {
    if (isRefreshingClicks) return;

    const idsToQuery = targetLinks.map(l => String(l.id)).filter(Boolean);
    if (idsToQuery.length === 0) {
      toast('No tracking links to refresh for current view', { icon: 'ℹ️' });
      return;
    }

    setIsRefreshingClicks(true);
    try {
      const res = await fetchTrackingLinkClicks(idsToQuery);
      setIsClicksConfigured(res.configured);

      if (res.isError) {
        const errorText = res.error || 'Failed to refresh click counts';
        setClicksError(errorText);
        toast.error(errorText);
      } else {
        setClicksError(null);
        // Merge into previous state so existing counts for other links are preserved
        setClicksMap(prev => ({
          ...prev,
          ...(res.clicks || {})
        }));
        setLastClicksUpdated(new Date());
        toast.success(`Click counts updated (${idsToQuery.length} links checked)`);
      }
    } catch (err: any) {
      console.error('Error refreshing click counts:', err);
      const msg = err?.message || 'Failed to refresh click counts from Redis';
      setClicksError(msg);
      toast.error(msg);
    } finally {
      setIsRefreshingClicks(false);
    }
  }, [isRefreshingClicks]);

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

  // Single Delete handler
  const handleDeleteConfirm = async () => {
    if (!linkToDelete) return;
    try {
      await deleteInfluencerTrackingLink(linkToDelete.id, campaign.id);
      toast.success('Tracking link deleted successfully');
      setLinks(prev => prev.filter(l => l.id !== linkToDelete.id));
      setSelectedLinkIds(prev => {
        const next = new Set(prev);
        next.delete(linkToDelete.id);
        return next;
      });
      setLinkToDelete(null);
    } catch (err: any) {
      console.error('Error deleting tracking link:', err);
      toast.error(err?.message || 'Failed to delete tracking link');
    }
  };

  // Bulk Delete handler
  const handleBulkDeleteConfirm = async () => {
    const idsToDelete = Array.from(selectedLinkIds);
    if (idsToDelete.length === 0 || isBulkDeleting) return;

    setIsBulkDeleting(true);
    try {
      const result = await bulkDeleteInfluencerTrackingLinks(idsToDelete, campaign.id);
      if (result.success) {
        toast.success(`Successfully deleted ${idsToDelete.length} tracking link${idsToDelete.length === 1 ? '' : 's'}`);
        const idSet = new Set(idsToDelete);
        setLinks(prev => prev.filter(l => !idSet.has(l.id)));
        setSelectedLinkIds(new Set());
        setIsBulkDeleteModalOpen(false);
      } else {
        toast.error(result.error || 'Failed to delete selected tracking links');
      }
    } catch (err: any) {
      console.error('Error during bulk deletion:', err);
      toast.error(err?.message || 'Failed to delete selected tracking links');
    } finally {
      setIsBulkDeleting(false);
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

      // Dedicated Selected Marketplace Filter (Drill-down level)
      const matchMarketplace = !selectedMarketplace ||
        (l.platform && l.platform.toLowerCase() === selectedMarketplace.toLowerCase()) ||
        (l.utm_source && l.utm_source.toLowerCase() === selectedMarketplace.toLowerCase());

      // Search Query
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q || 
        (l.influencer_name && l.influencer_name.toLowerCase().includes(q)) ||
        (l.influencer_code && l.influencer_code.toLowerCase().includes(q)) ||
        (l.creator_code && l.creator_code.toLowerCase().includes(q)) ||
        (l.tracking_url && l.tracking_url.toLowerCase().includes(q)) ||
        (l.product && l.product.toLowerCase().includes(q)) ||
        (l.platform && l.platform.toLowerCase().includes(q));

      return matchProduct && matchPlatform && matchVideo && matchMarketplace && matchSearch;
    });

    return filtered.sort(compareTrackingLinksByCodeAsc);
  }, [links, eliminatedInfluencerIds, selectedProduct, selectedPlatform, selectedVideo, selectedMarketplace, searchQuery]);

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

  // Product Summaries for the 4-column Product Card Grid (Includes all standard products and DB products)
  const allProductSummaries = useMemo(() => {
    // Collect active links
    const activeEligibleLinks = links.filter(
      l => !eliminatedInfluencerIds.has(String(l.influencer_id))
    );

    // Group links by normalized product name
    const countMap = new Map<string, { total: number; platforms: Set<string>; categories: Set<string> }>();
    activeEligibleLinks.forEach(l => {
      const pName = l.product || 'Unassigned';
      if (!countMap.has(pName)) {
        countMap.set(pName, { total: 0, platforms: new Set(), categories: new Set() });
      }
      const entry = countMap.get(pName)!;
      entry.total += 1;
      if (l.platform) entry.platforms.add(l.platform);
      if (l.platform_category) entry.categories.add(l.platform_category);
    });

    // Ensure all standard SCRIPT_PRODUCTS are presented, plus any extra products found in DB
    const allProdNames = Array.from(new Set([
      ...SCRIPT_PRODUCTS,
      ...Array.from(countMap.keys())
    ]));

    return allProdNames.map(name => {
      // Find matching case-insensitive entry if any
      let matchedEntry = countMap.get(name);
      if (!matchedEntry) {
        for (const [key, val] of countMap.entries()) {
          if (key.toLowerCase() === name.toLowerCase()) {
            matchedEntry = val;
            break;
          }
        }
      }

      return {
        name,
        totalLinks: matchedEntry ? matchedEntry.total : 0,
        platformsCount: matchedEntry ? matchedEntry.platforms.size : 0,
        categoriesCount: matchedEntry ? matchedEntry.categories.size : 0
      };
    }).sort((a, b) => {
      // Products with links first, then alphabetical
      if (b.totalLinks !== a.totalLinks) {
        return b.totalLinks - a.totalLinks;
      }
      return a.name.localeCompare(b.name);
    });
  }, [links, eliminatedInfluencerIds]);

  // Marketplaces and platforms summaries specifically for the currently selected product
  const selectedProductMarketplaces = useMemo(() => {
    if (selectedProduct === 'All') return [];

    // Filter links for this product
    const prodLinks = links.filter(
      l => !eliminatedInfluencerIds.has(String(l.influencer_id)) &&
           (l.product || '').toLowerCase() === selectedProduct.toLowerCase()
    );

    // Group by platform name
    const platMap = new Map<string, {
      name: string;
      category: 'MARKETPLACE' | 'WEBSITE' | string;
      count: number;
      brandColor: string;
      description: string;
    }>();

    // Default channels to display for easy link creation/viewing
    const defaultChannels = [
      { name: 'Amazon', category: 'MARKETPLACE', brandColor: '#FF9900', description: 'Amazon short links redirecting to product ASINs' },
      { name: 'Flipkart', category: 'MARKETPLACE', brandColor: '#2874F0', description: 'Flipkart marketplace influencer tracking' },
      { name: 'Meesho', category: 'MARKETPLACE', brandColor: '#F43397', description: 'Meesho reseller & influencer campaign links' },
      { name: 'Instagram', category: 'WEBSITE', brandColor: '#E1306C', description: 'Instagram bio and story UTM campaign links' },
      { name: 'YouTube', category: 'WEBSITE', brandColor: '#FF0000', description: 'YouTube video description and pinned comment links' }
    ];

    defaultChannels.forEach(c => {
      platMap.set(c.name.toLowerCase(), {
        name: c.name,
        category: c.category,
        count: 0,
        brandColor: c.brandColor,
        description: c.description
      });
    });

    // Populate actual counts
    prodLinks.forEach(l => {
      const pName = (l.platform || l.utm_source || 'Amazon').trim();
      const matched = TRACKING_PLATFORMS.find(
        p => p.name.toLowerCase() === pName.toLowerCase() ||
             p.utmSource.toLowerCase() === pName.toLowerCase() ||
             p.id.toLowerCase() === pName.toLowerCase()
      );
      const canonical = matched?.name || pName;
      const key = canonical.toLowerCase();

      if (!platMap.has(key)) {
        platMap.set(key, {
          name: canonical,
          category: l.platform_category || matched?.category || 'MARKETPLACE',
          count: 0,
          brandColor: matched?.brandColor || '#A855F7',
          description: `${canonical} campaign tracking links`
        });
      }

      platMap.get(key)!.count += 1;
    });

    // Return list sorted: Marketplaces with links first, then marketplaces, then websites
    return Array.from(platMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.category === 'MARKETPLACE' && b.category !== 'MARKETPLACE') return -1;
      if (b.category === 'MARKETPLACE' && a.category !== 'MARKETPLACE') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [links, eliminatedInfluencerIds, selectedProduct]);

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

  // Toggle single row selection
  const handleToggleSelectLink = (linkId: string) => {
    setSelectedLinkIds(prev => {
      const next = new Set(prev);
      if (next.has(linkId)) {
        next.delete(linkId);
      } else {
        next.add(linkId);
      }
      return next;
    });
  };

  // Toggle select all filtered links
  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredLinks.map(l => l.id);
    const areAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedLinkIds.has(id));

    if (areAllSelected) {
      // Deselect all filtered links
      setSelectedLinkIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // Select all filtered links
      setSelectedLinkIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  // Toggle select all links within a specific platform group
  const handleToggleSelectPlatformGroup = (groupLinks: InfluencerTrackingLink[]) => {
    const groupIds = groupLinks.map(l => l.id);
    const areAllInGroupSelected = groupIds.length > 0 && groupIds.every(id => selectedLinkIds.has(id));

    setSelectedLinkIds(prev => {
      const next = new Set(prev);
      if (areAllInGroupSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Selection statistics for filtered links
  const selectedFilteredCount = useMemo(() => {
    return filteredLinks.filter(l => selectedLinkIds.has(l.id)).length;
  }, [filteredLinks, selectedLinkIds]);

  const isAllFilteredSelected = filteredLinks.length > 0 && selectedFilteredCount === filteredLinks.length;
  const isPartiallyFilteredSelected = selectedFilteredCount > 0 && !isAllFilteredSelected;

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

      {/* Notice Banners */}
      <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
            <Globe size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">Active Tracking Endpoint:</span>
              <span className="font-mono text-emerald-300 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/30">
                velmora-management-system.vercel.app/r
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Live & Verified
              </span>
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5 truncate">
              Amazon tracking links resolve directly via the production Vercel endpoint (e.g. <span className="font-mono text-emerald-300">velmora-management-system.vercel.app/r/his4-v1</span>) without third-party DNS dependency.
            </p>
          </div>
        </div>
      </div>

      {!isClicksConfigured ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-200">
          <AlertTriangle size={18} className="shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-300">Click Tracking Not Configured</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {clicksError || 'The persistent Redis click tracking counter is currently unconfigured. Clicks on Amazon links will redirect visitors, but counts will display as unconfigured until UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set in Vercel.'}
            </p>
          </div>
        </div>
      ) : clicksError ? (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-200">
          <AlertCircle size={18} className="shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-rose-300">Unable to Load Click Counts</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {clicksError}
            </p>
          </div>
        </div>
      ) : null}

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
      ) : selectedProduct === 'All' && !isSearching ? (
        /* =========================================================================
           1. PRODUCT CARD GRID OVERVIEW (Desktop: 4 cols, Tablet: 2 cols, Mobile: 1 col)
           ========================================================================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <ShoppingBag size={15} className="text-purple-400" />
                <span>Select a Product to View Tracking Links</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any product card to access its dedicated tracking links and influencer assignments
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-[#070c18] border border-slate-800 px-3 py-1 rounded-xl">
              {allProductSummaries.length} Products Available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {allProductSummaries.map((pSummary) => {
              const hasLinks = pSummary.totalLinks > 0;
              return (
                <div
                  key={pSummary.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedProduct(pSummary.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedProduct(pSummary.name);
                    }
                  }}
                  className="group relative flex flex-col justify-between bg-[#0b1329] hover:bg-[#0f1938] border border-slate-800/90 hover:border-purple-500/50 rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-purple-950/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-600/15 border border-purple-500/30 text-purple-300 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 group-hover:border-purple-500/50 transition-all shadow-sm">
                        🧴
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                          hasLinks
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 group-hover:bg-purple-500/30'
                            : 'bg-slate-800/60 text-slate-500 border-slate-700/40'
                        }`}
                      >
                        {pSummary.totalLinks} {pSummary.totalLinks === 1 ? 'Link' : 'Links'}
                      </span>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold text-white uppercase tracking-wide group-hover:text-purple-300 transition-colors line-clamp-1">
                        {pSummary.name}
                      </h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {hasLinks
                          ? `${pSummary.categoriesCount} channel category • ${pSummary.platformsCount} platforms`
                          : 'No tracking links generated yet'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-purple-300 transition-colors">
                    <span className="font-medium text-[11px]">
                      {hasLinks ? 'Open tracking table' : 'Create tracking link'}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 group-hover:border-purple-500/40 flex items-center justify-center text-slate-400 group-hover:text-purple-300 transition-colors">
                      <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
          <div className="flex items-center gap-3">
            {selectedProduct !== 'All' && (
              <button
                type="button"
                onClick={() => setSelectedProduct('All')}
                className="flex items-center gap-2 bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Back to All Products</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenCreate(selectedProduct !== 'All' ? selectedProduct : undefined)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-900/25 cursor-pointer"
            >
              <Plus size={16} />
              <span>Create Tracking Link</span>
            </button>
          </div>
        </div>
      ) : (
        /* =========================================================================
           2. DEDICATED SELECTED PRODUCT VIEW / SEARCH RESULTS VIEW
           ========================================================================= */
        <div className="space-y-5">
          {/* Top Breadcrumb & Product Scope Header */}
          {selectedProduct !== 'All' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0b1329] border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMarketplace) {
                      setSelectedMarketplace(null);
                    } else {
                      setSelectedProduct('All');
                    }
                  }}
                  className="flex items-center gap-2 bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-purple-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                >
                  <ArrowLeft size={15} />
                  <span>{selectedMarketplace ? 'Back to Marketplaces' : 'Back to Products'}</span>
                </button>
                <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 font-medium">Product:</span>
                  <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide px-2.5 py-0.5 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300">
                    {selectedProduct}
                  </span>
                  {selectedMarketplace && (
                    <>
                      <ChevronRight size={14} className="text-slate-600" />
                      <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide px-2.5 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-amber-300">
                        {selectedMarketplace}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto text-xs text-slate-400">
                <span className="font-semibold text-slate-300">
                  {filteredLinks.length} {filteredLinks.length === 1 ? 'Tracking Link' : 'Tracking Links'}
                </span>
                {selectedMarketplace && (
                  <button
                    type="button"
                    onClick={() => setSelectedMarketplace(null)}
                    className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 underline cursor-pointer"
                  >
                    View All Channels
                  </button>
                )}
              </div>
            </div>
          )}

          {/* BULK DELETE TOOLBAR (Shown whenever at least 1 link is selected) */}
          {selectedFilteredCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-950/40 via-[#111a38] to-[#0d142d] border border-purple-500/40 p-3 sm:p-4 rounded-2xl shadow-lg shadow-purple-950/20 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 flex items-center justify-center font-bold text-xs">
                  {selectedFilteredCount}
                </div>
                <div>
                  <span className="text-xs font-bold text-white tracking-wide">
                    {selectedFilteredCount} {selectedFilteredCount === 1 ? 'tracking link selected' : 'tracking links selected'}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {selectedMarketplace
                      ? `${selectedProduct} • ${selectedMarketplace}`
                      : selectedProduct !== 'All'
                        ? `From ${selectedProduct}`
                        : 'Across filtered results'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  {isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredLinks.length})`}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLinkIds(new Set())}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>

                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white transition-all shadow-md shadow-rose-950/30 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Delete Selected ({selectedFilteredCount})</span>
                </button>
              </div>
            </div>
          )}

          {/* LEVEL 2: MARKETPLACE CARDS GRID (When product is selected and no single marketplace is drilled down, unless searching) */}
          {selectedProduct !== 'All' && !selectedMarketplace && !isSearching && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <ShoppingBag size={15} className="text-amber-400" />
                    <span>Select Marketplace / Channel</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose a marketplace card below to view, manage, and bulk delete its tracking links
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400 bg-[#070c18] border border-slate-800 px-3 py-1 rounded-xl">
                  {selectedProductMarketplaces.length} Channels Available
                </span>
              </div>

              {/* 3 cards/row desktop (lg:grid-cols-3), 2 tablet (sm:grid-cols-2), 1 mobile (grid-cols-1) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedProductMarketplaces.map((mkt) => {
                  const hasLinks = mkt.count > 0;
                  const isAmazon = mkt.name.toLowerCase() === 'amazon';

                  return (
                    <div
                      key={mkt.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMarketplace(mkt.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedMarketplace(mkt.name);
                        }
                      }}
                      className="group relative flex flex-col justify-between bg-[#0b1329] hover:bg-[#0f1938] border border-slate-800/90 hover:border-purple-500/50 rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-purple-950/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <PlatformBrandIcon platform={mkt.name} color={mkt.brandColor} />
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                              {mkt.category}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                              hasLinks
                                ? isAmazon
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 group-hover:bg-amber-500/30'
                                  : 'bg-purple-500/20 text-purple-300 border-purple-500/30 group-hover:bg-purple-500/30'
                                : 'bg-slate-800/60 text-slate-500 border-slate-700/40'
                            }`}
                          >
                            {mkt.count} {mkt.count === 1 ? 'Link' : 'Links'}
                          </span>
                        </div>

                        <div>
                          <h5 className="text-base font-bold text-white uppercase tracking-wide group-hover:text-purple-300 transition-colors">
                            {mkt.name}
                          </h5>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {mkt.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-purple-300 transition-colors">
                        <span className="font-semibold text-xs">
                          {hasLinks ? 'View Links' : 'Generate Links'}
                        </span>
                        <div className="flex items-center gap-1 font-bold text-xs text-purple-400 group-hover:text-purple-300">
                          <span>Open</span>
                          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEVEL 3: TRACKING LINKS TABLE / LIST (When marketplace is chosen, or during search/multi-product mode) */}
          {((selectedProduct !== 'All' && selectedMarketplace) || (selectedProduct === 'All') || isSearching) && (
            <div className="space-y-5 animate-fade-in">
              {productGroups.map((productGroup) => (
                <div 
                  key={productGroup.product}
                  className="bg-[#0b1329] border border-slate-800/90 rounded-2xl overflow-hidden shadow-sm transition-all duration-200"
                >
                  {/* Clean Product Header */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0e1733] to-[#0b1329] border-b border-slate-800/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-500/30 text-purple-300 flex items-center justify-center text-xl shrink-0 shadow-sm">
                        🧴
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="text-base sm:text-lg font-bold text-white tracking-wide uppercase truncate">
                            {productGroup.product}
                          </h4>
                          {selectedMarketplace && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                              {selectedMarketplace}
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                            {productGroup.totalLinks} {productGroup.totalLinks === 1 ? 'Link' : 'Links'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Influencer Tracking Table</p>
                      </div>
                    </div>

                    {selectedMarketplace && (
                      <button
                        type="button"
                        onClick={() => setSelectedMarketplace(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <ArrowLeft size={13} />
                        <span>All Marketplaces</span>
                      </button>
                    )}
                  </div>

                  {/* Product Body: Categories & Platform Tables */}
                  <div className="p-4 sm:p-5 space-y-6 bg-[#080d1c]/40">
                    {productGroup.categories.map((catGroup) => (
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

                        {/* Platform Groups */}
                        <div className="space-y-4">
                          {catGroup.platforms.map((platformGroup) => {
                            const platformKey = `${productGroup.product}::${platformGroup.platformName}`;
                            const isPlatformExpanded = expandedPlatforms[platformKey] !== false;

                            const allInPlatformSelected = platformGroup.links.length > 0 && 
                              platformGroup.links.every(l => selectedLinkIds.has(l.id));
                            const someInPlatformSelected = platformGroup.links.some(l => selectedLinkIds.has(l.id));

                            return (
                              <div
                                key={platformGroup.platformName}
                                className="border border-slate-800 rounded-xl overflow-hidden bg-[#070c18] shadow-sm transition-all"
                              >
                                {/* Platform Header Bar */}
                                <div className="w-full flex items-center justify-between px-4 py-3 bg-[#0a1124] hover:bg-[#0f1730] transition-colors border-b border-slate-800/60">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {/* Platform Select All Checkbox */}
                                    <input
                                      type="checkbox"
                                      checked={allInPlatformSelected}
                                      ref={(el) => {
                                        if (el) el.indeterminate = !allInPlatformSelected && someInPlatformSelected;
                                      }}
                                      onChange={() => handleToggleSelectPlatformGroup(platformGroup.links)}
                                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer accent-purple-600"
                                      title={allInPlatformSelected ? `Deselect all ${platformGroup.platformName} links` : `Select all ${platformGroup.platformName} links`}
                                    />

                                    <button
                                      type="button"
                                      onClick={() => togglePlatform(productGroup.product, platformGroup.platformName)}
                                      className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                                    >
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
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2 text-slate-400 shrink-0 ml-2">
                                    <button
                                      type="button"
                                      onClick={() => togglePlatform(productGroup.product, platformGroup.platformName)}
                                      className="w-6 h-6 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                                    >
                                      {isPlatformExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                  </div>
                                </div>

                                {/* Platform Content (Table or Grid) */}
                                {isPlatformExpanded && (() => {
                                  // Pagination logic for this platform group
                                  const totalPlatformLinks = platformGroup.links.length;
                                  const totalPages = Math.max(1, Math.ceil(totalPlatformLinks / pageSize));
                                  const safePage = Math.min(Math.max(1, currentPage), totalPages);
                                  const startIndex = (safePage - 1) * pageSize;
                                  const endIndex = Math.min(startIndex + pageSize, totalPlatformLinks);
                                  const paginatedLinks = platformGroup.links.slice(startIndex, endIndex);

                                  const allInPageSelected = paginatedLinks.length > 0 &&
                                    paginatedLinks.every(l => selectedLinkIds.has(l.id));
                                  const someInPageSelected = paginatedLinks.some(l => selectedLinkIds.has(l.id));

                                  // Toggle select all on current page
                                  const handleToggleSelectPage = () => {
                                    const pageIds = paginatedLinks.map(l => l.id);
                                    setSelectedLinkIds(prev => {
                                      const next = new Set(prev);
                                      if (allInPageSelected) {
                                        pageIds.forEach(id => next.delete(id));
                                      } else {
                                        pageIds.forEach(id => next.add(id));
                                      }
                                      return next;
                                    });
                                  };

                                  // Select all across all pages in this platform
                                  const handleSelectAllPlatformPages = () => {
                                    const allIds = platformGroup.links.map(l => l.id);
                                    setSelectedLinkIds(prev => {
                                      const next = new Set(prev);
                                      allIds.forEach(id => next.add(id));
                                      return next;
                                    });
                                  };

                                  return (
                                    <div className="border-t border-slate-800/80 bg-[#070c18]">
                                      {/* Sub-toolbar: Refresh Click Counts & Selection stats */}
                                      <div className="px-4 py-2.5 bg-[#090f21] border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                          <button
                                            type="button"
                                            onClick={() => handleRefreshClickCounts(platformGroup.links)}
                                            disabled={isRefreshingClicks}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/40 text-purple-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 font-semibold"
                                            title="Refresh Click Counts for all links in this channel from Redis"
                                          >
                                            <RefreshCw size={13} className={isRefreshingClicks ? 'animate-spin text-purple-400' : 'text-purple-400'} />
                                            <span>{isRefreshingClicks ? 'Refreshing...' : 'Refresh Click Counts'}</span>
                                          </button>

                                          {lastClicksUpdated && (
                                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                              <Clock size={11} className="text-slate-500" />
                                              <span>Last updated: {lastClicksUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                          <span>
                                            Showing <span className="text-purple-300 font-bold">{totalPlatformLinks === 0 ? 0 : startIndex + 1}–{endIndex}</span> of <span className="text-slate-200 font-bold">{totalPlatformLinks}</span> links
                                          </span>
                                        </div>
                                      </div>

                                      {/* Select All Page banner if all on page selected and more exist */}
                                      {allInPageSelected && totalPlatformLinks > paginatedLinks.length && !allInPlatformSelected && (
                                        <div className="px-4 py-2 bg-purple-950/30 border-b border-purple-500/30 flex items-center justify-between text-xs text-purple-300">
                                          <span>
                                            All <strong className="text-white">{paginatedLinks.length}</strong> links on page {safePage} are selected.
                                          </span>
                                          <button
                                            type="button"
                                            onClick={handleSelectAllPlatformPages}
                                            className="font-bold underline text-purple-300 hover:text-white cursor-pointer ml-2"
                                          >
                                            Select all {totalPlatformLinks} links in {platformGroup.platformName}
                                          </button>
                                        </div>
                                      )}

                                      {viewMode === 'table' ? (
                                        /* 7-Column Clean Table: Checkbox, Influencer, Creator Code, Video, Tracking Link, Clicks, Actions */
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-left text-xs text-slate-300">
                                            <thead className="bg-[#050914] border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                              <tr>
                                                <th scope="col" className="w-10 px-3 py-3 text-center">
                                                  <input
                                                    type="checkbox"
                                                    checked={allInPageSelected}
                                                    ref={(el) => {
                                                      if (el) el.indeterminate = !allInPageSelected && someInPageSelected;
                                                    }}
                                                    onChange={handleToggleSelectPage}
                                                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer accent-purple-600"
                                                    title={allInPageSelected ? 'Deselect all rows on this page' : 'Select all rows on this page'}
                                                  />
                                                </th>
                                                <th scope="col" className="px-4 py-3 min-w-[170px]">Influencer</th>
                                                <th scope="col" className="px-4 py-3 min-w-[110px]">Creator Code</th>
                                                <th scope="col" className="px-4 py-3 min-w-[90px]">Video</th>
                                                <th scope="col" className="px-4 py-3 min-w-[280px]">Tracking Link</th>
                                                <th scope="col" className="px-4 py-3 text-center min-w-[100px]">Clicks</th>
                                                <th scope="col" className="px-4 py-3 text-right min-w-[140px]">Actions</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/60">
                                              {paginatedLinks.map((link) => {
                                                const isCopied = copiedId === link.id;
                                                const isSelected = selectedLinkIds.has(link.id);
                                                const videoText = link.video_number || 'Video 1';

                                                return (
                                                  <tr
                                                    key={link.id}
                                                    className={`transition-colors group ${
                                                      isSelected ? 'bg-purple-950/25 hover:bg-purple-950/35' : 'hover:bg-slate-900/50'
                                                    }`}
                                                  >
                                                    {/* 0. Row Selection Checkbox */}
                                                    <td className="w-10 px-3 py-2.5 text-center">
                                                      <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelectLink(link.id)}
                                                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer accent-purple-600"
                                                        title={`Select ${link.influencer_name || link.creator_code || 'link'}`}
                                                      />
                                                    </td>

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
                                                      {(() => {
                                                        const isAmazonLink =
                                                          link.destination_type === 'amazon' ||
                                                          Boolean(link.custom_slug) ||
                                                          Boolean(link.branded_url) ||
                                                          (link.tracking_url && (link.tracking_url.includes('/r/') || link.tracking_url.includes('link.justmixx.com') || (link.tracking_url.includes('justmixx.com') && !link.tracking_url.includes('utm_source')))) ||
                                                          (link.platform && link.platform.toLowerCase() === 'amazon');

                                                        if (!isAmazonLink) {
                                                          return (
                                                            <span
                                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-950/40 text-purple-300/80 border border-purple-500/20"
                                                              title="Direct Shopify link. Clicks and sales are tracked natively in Shopify Analytics via UTM tags"
                                                            >
                                                              Shopify UTM
                                                            </span>
                                                          );
                                                        }

                                                        if (isLoadingClicks || isRefreshingClicks) {
                                                          return (
                                                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                                              <Loader2 size={11} className="animate-spin text-purple-400" />
                                                              <span>...</span>
                                                            </span>
                                                          );
                                                        }

                                                        if (!isClicksConfigured) {
                                                          return (
                                                            <span
                                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-950/40 text-amber-300 border border-amber-500/30"
                                                              title={clicksError || 'Redis click counter not configured on server'}
                                                            >
                                                              Unconfigured
                                                            </span>
                                                          );
                                                        }

                                                        if (clicksError) {
                                                          return (
                                                            <span
                                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-950/40 text-rose-300 border border-rose-500/30"
                                                              title={`Unable to load click counts: ${clicksError}`}
                                                            >
                                                              Unavailable
                                                            </span>
                                                          );
                                                        }

                                                        const count = clicksMap[link.id] ?? 0;
                                                        return (
                                                          <span
                                                            className={`inline-flex items-center justify-center min-w-[36px] px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                                                              count > 0
                                                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                                                                : 'bg-slate-900 border-slate-800 text-slate-400'
                                                            }`}
                                                            title={`${count} recorded clicks`}
                                                          >
                                                            {count.toLocaleString()}
                                                          </span>
                                                        );
                                                      })()}
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
                                          {paginatedLinks.map((link) => (
                                            <CampaignTrackingLinkCard
                                              key={link.id}
                                              link={link}
                                              clicks={clicksMap[link.id] ?? 0}
                                              isClicksConfigured={isClicksConfigured}
                                              clicksError={clicksError}
                                              isLoadingClicks={isLoadingClicks || isRefreshingClicks}
                                              onEdit={handleOpenEdit}
                                              onDelete={(l) => setLinkToDelete(l)}
                                            />
                                          ))}
                                        </div>
                                      )}

                                      {/* COMPACT RESPONSIVE PAGINATION FOOTER */}
                                      <div className="px-4 py-3 bg-[#080e1e] border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                                        {/* Status & Page Size Selector */}
                                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                                          <span className="text-slate-400">
                                            Showing <span className="font-semibold text-slate-200">{totalPlatformLinks === 0 ? 0 : startIndex + 1}–{endIndex}</span> of{' '}
                                            <span className="font-semibold text-purple-300">{totalPlatformLinks}</span> links
                                          </span>

                                          <div className="flex items-center gap-1.5 bg-[#050914] border border-slate-800 rounded-lg px-2 py-1">
                                            <span className="text-[11px] text-slate-500">Per page:</span>
                                            <select
                                              value={pageSize}
                                              onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setCurrentPage(1);
                                              }}
                                              className="bg-transparent text-xs text-purple-300 font-bold focus:outline-none cursor-pointer"
                                            >
                                              <option value={10} className="bg-slate-900 text-slate-200">10</option>
                                              <option value={20} className="bg-slate-900 text-slate-200">20</option>
                                              <option value={50} className="bg-slate-900 text-slate-200">50</option>
                                              <option value={100} className="bg-slate-900 text-slate-200">100</option>
                                            </select>
                                          </div>
                                        </div>

                                        {/* Page Navigation Buttons (Previous, 1 2 3 ... Next) */}
                                        {totalPages > 1 && (
                                          <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                            <button
                                              type="button"
                                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                              disabled={safePage <= 1}
                                              className="px-2.5 py-1 rounded-lg bg-[#0a1124] hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                              Previous
                                            </button>

                                            {/* Page numbers with ellipsis */}
                                            {(() => {
                                              const pages: (number | string)[] = [];
                                              if (totalPages <= 7) {
                                                for (let p = 1; p <= totalPages; p++) pages.push(p);
                                              } else {
                                                pages.push(1);
                                                if (safePage > 3) pages.push('...');
                                                const start = Math.max(2, safePage - 1);
                                                const end = Math.min(totalPages - 1, safePage + 1);
                                                for (let p = start; p <= end; p++) pages.push(p);
                                                if (safePage < totalPages - 2) pages.push('...');
                                                pages.push(totalPages);
                                              }

                                              return pages.map((page, pIdx) => {
                                                if (typeof page === 'string') {
                                                  return (
                                                    <span key={`ellipsis-${pIdx}`} className="px-1 text-slate-500 font-bold">
                                                      ...
                                                    </span>
                                                  );
                                                }
                                                const isCurrent = page === safePage;
                                                return (
                                                  <button
                                                    key={`page-${page}`}
                                                    type="button"
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                      isCurrent
                                                        ? 'bg-purple-600 text-white shadow-sm shadow-purple-900/50'
                                                        : 'bg-[#0a1124] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80'
                                                    }`}
                                                  >
                                                    {page}
                                                  </button>
                                                );
                                              });
                                            })()}

                                            <button
                                              type="button"
                                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                              disabled={safePage >= totalPages}
                                              className="px-2.5 py-1 rounded-lg bg-[#0a1124] hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                              Next
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
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

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && selectedFilteredCount > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={22} />
              </div>
              <div>
                <h4 className="text-base font-bold text-white leading-tight">
                  Delete {selectedFilteredCount} selected tracking {selectedFilteredCount === 1 ? 'link' : 'links'}?
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  This action permanently removes the <strong className="text-rose-300">{selectedFilteredCount}</strong> selected tracking-link record{selectedFilteredCount === 1 ? '' : 's'} from <strong className="text-purple-300">{selectedProduct !== 'All' ? selectedProduct : 'the current view'}</strong> and cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between text-slate-300 font-medium">
                <span>Selected Records:</span>
                <span className="text-purple-300 font-mono font-bold">{selectedFilteredCount}</span>
              </div>
              <div className="flex justify-between text-slate-300 font-medium">
                <span>Product Scope:</span>
                <span className="text-slate-300 uppercase">{selectedProduct}</span>
              </div>
              <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                Untouched products and unselected links will remain completely intact.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleBulkDeleteConfirm}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-all cursor-pointer shadow-md shadow-rose-950/40 disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Delete {selectedFilteredCount} Links</span>
                  </>
                )}
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
