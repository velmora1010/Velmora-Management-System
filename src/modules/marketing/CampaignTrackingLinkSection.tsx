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
  User,
  Copy,
  Check,
  ExternalLink,
  Globe,
  ShoppingBag,
  Video,
  LayoutGrid,
  Table as TableIcon,
  Search,
  Trash2,
  Edit3,
  AlertTriangle
} from 'lucide-react';
import type { Campaign, CampaignInfluencer, InfluencerTrackingLink } from '../../types';
import { SCRIPT_PRODUCTS } from '../../services/campaignScriptService';
import { 
  fetchInfluencerTrackingLinks, 
  deleteInfluencerTrackingLink,
  TRACKING_PLATFORMS,
  TRACKING_VIDEOS
} from '../../services/influencerTrackingLinkService';
import { CampaignTrackingLinkModal } from './CampaignTrackingLinkModal';
import { CampaignTrackingLinkCard } from './CampaignTrackingLinkCard';
import { useCampaignInfluencers } from '../../hooks/marketing/useCampaignInfluencers';
import toast from 'react-hot-toast';

interface CampaignTrackingLinkSectionProps {
  campaign: Campaign;
  onBack: () => void;
}

export const CampaignTrackingLinkSection: React.FC<CampaignTrackingLinkSectionProps> = ({ 
  campaign, 
  onBack 
}) => {
  const [links, setLinks] = useState<InfluencerTrackingLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [selectedProduct, setSelectedProduct] = useState<string>('All');
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string>('All');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');
  const [selectedVideo, setSelectedVideo] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // View Mode: 'table' or 'grid'
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [linkToEdit, setLinkToEdit] = useState<InfluencerTrackingLink | null>(null);

  // Delete modal state
  const [linkToDelete, setLinkToDelete] = useState<InfluencerTrackingLink | null>(null);

  // Copy tracking state for table rows
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch campaign influencers
  const { influencers, refresh: refreshInfluencers } = useCampaignInfluencers(campaign.id);

  // Load tracking links
  const loadLinks = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await fetchInfluencerTrackingLinks(campaign.id);
      setLinks(data);
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
  const handleOpenCreate = () => {
    setLinkToEdit(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (link: InfluencerTrackingLink) => {
    setLinkToEdit(link);
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
          copy.unshift(saved);
        }
      });
      return copy;
    });
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

  // Filtered links list
  const filteredLinks = useMemo(() => {
    return links.filter(l => {
      // 1. Product Filter
      const matchProduct = selectedProduct === 'All' || 
        l.product.toLowerCase() === selectedProduct.toLowerCase();

      // 2. Influencer Filter
      const matchInfluencer = selectedInfluencerId === 'All' || 
        String(l.influencer_id) === selectedInfluencerId;

      // 3. Platform Filter
      const matchPlatform = selectedPlatform === 'All' || 
        (l.platform && l.platform.toLowerCase() === selectedPlatform.toLowerCase()) ||
        (l.utm_source && l.utm_source.toLowerCase() === selectedPlatform.toLowerCase());

      // 4. Video Filter
      const matchVideo = selectedVideo === 'All' || 
        (l.video_number && l.video_number.toLowerCase() === selectedVideo.toLowerCase()) ||
        (l.utm_content && l.utm_content.toLowerCase() === selectedVideo.toLowerCase());

      // 5. Search Query
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q || 
        (l.influencer_name && l.influencer_name.toLowerCase().includes(q)) ||
        (l.influencer_code && l.influencer_code.toLowerCase().includes(q)) ||
        (l.creator_code && l.creator_code.toLowerCase().includes(q)) ||
        (l.tracking_url && l.tracking_url.toLowerCase().includes(q)) ||
        (l.product && l.product.toLowerCase().includes(q));

      return matchProduct && matchInfluencer && matchPlatform && matchVideo && matchSearch;
    });
  }, [links, selectedProduct, selectedInfluencerId, selectedPlatform, selectedVideo, searchQuery]);

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
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-900/25 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Tracking Link</span>
          </button>
        </div>
      </div>

      {/* Filters Bar & Controls */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
        {/* Row 1: Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filter 1: Product */}
          <div className="flex items-center gap-2 bg-[#070c18] border border-slate-800 rounded-xl px-3 py-1.5">
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

          {/* Filter 2: Influencer */}
          <div className="flex items-center gap-2 bg-[#070c18] border border-slate-800 rounded-xl px-3 py-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <User size={12} className="text-purple-400" />
              <span>Influencer:</span>
            </span>
            <select
              value={selectedInfluencerId}
              onChange={(e) => setSelectedInfluencerId(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-full truncate"
            >
              <option value="All" className="bg-slate-900">All Influencers ({influencers.length})</option>
              {influencers.map((inf) => {
                const displayName = inf.influencer_name || inf.name || `ID ${inf.id}`;
                const code = inf.code ? ` (${inf.code})` : '';
                return (
                  <option key={inf.id} value={String(inf.id)} className="bg-slate-900">
                    {displayName}{code}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter 3: Platform */}
          <div className="flex items-center gap-2 bg-[#070c18] border border-slate-800 rounded-xl px-3 py-1.5">
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

          {/* Filter 4: Video */}
          <div className="flex items-center gap-2 bg-[#070c18] border border-slate-800 rounded-xl px-3 py-1.5">
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

        {/* Row 2: Search, Count & View Mode Toggle */}
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

          {/* Right Controls: Count, View Mode, Refresh */}
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              Showing <span className="text-purple-400 font-bold">{filteredLinks.length}</span>{' '}
              {filteredLinks.length === 1 ? 'Link' : 'Links'}
              {links.length > 0 && filteredLinks.length !== links.length && (
                <span className="text-slate-500 text-[11px] ml-1">of {links.length} total</span>
              )}
            </span>

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
        /* Empty State */
        <div className="bg-[#0b1329]/60 border border-slate-800/90 rounded-2xl p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 shadow-inner">
            {links.length === 0 ? <Link2 size={32} /> : <SearchX size={32} />}
          </div>
          <h4 className="text-base sm:text-lg font-bold text-white mb-1.5">
            {links.length === 0 ? 'No tracking links created yet' : 'No matching tracking links found'}
          </h4>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            {links.length === 0
              ? `Get started by clicking Create Tracking Link to automatically generate unique UTM tracking links for all ${influencers.length} influencers in ${campaign.campaign_name}.`
              : 'No tracking links match the selected filters or search query. Try clearing filters or create a new link.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-900/25 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Tracking Link</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-[#0b1329] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#070c18] border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3.5">Influencer</th>
                  <th scope="col" className="px-4 py-3.5">Creator Code</th>
                  <th scope="col" className="px-4 py-3.5">Product</th>
                  <th scope="col" className="px-4 py-3.5">Platform</th>
                  <th scope="col" className="px-4 py-3.5">Video</th>
                  <th scope="col" className="px-4 py-3.5 min-w-[260px]">Tracking Link</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredLinks.map((link) => {
                  const isCopied = copiedId === link.id;
                  const matchedPlat = TRACKING_PLATFORMS.find(
                    p => p.name.toLowerCase() === (link.platform || '').toLowerCase() ||
                         p.utmSource.toLowerCase() === (link.utm_source || '').toLowerCase()
                  );
                  const platColor = matchedPlat?.brandColor || '#A855F7';
                  const platName = link.platform || matchedPlat?.name || 'Instagram';
                  const videoText = link.video_number || 'Video 1';

                  return (
                    <tr
                      key={link.id}
                      className="hover:bg-slate-900/50 transition-colors group"
                    >
                      {/* Influencer Name */}
                      <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[11px] font-bold shrink-0">
                            {(link.influencer_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate max-w-[150px]">
                            {link.influencer_name || 'Influencer'}
                          </span>
                        </div>
                      </td>

                      {/* Creator Code */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-bold text-[11px] border border-purple-500/30">
                          {link.influencer_code || link.creator_code ? `#${(link.creator_code || link.influencer_code || '').replace(/^#+/, '').toUpperCase()}` : '-'}
                        </span>
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-200">
                        {link.product}
                      </td>

                      {/* Platform */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: platColor }}
                          />
                          <span>{platName}</span>
                        </span>
                      </td>

                      {/* Video */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-300 font-bold text-[11px]">
                          {videoText}
                        </span>
                      </td>

                      {/* Tracking Link (Truncated visual, break-all safe) */}
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <div
                          className="max-w-xs truncate text-purple-300 bg-purple-950/20 px-2 py-1 rounded-lg border border-purple-500/20 select-all cursor-pointer hover:text-purple-200"
                          title={link.tracking_url}
                          onClick={() => handleCopyLink(link)}
                        >
                          {link.tracking_url}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(link)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border-purple-500/30'
                            }`}
                            title="Copy link"
                          >
                            {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenLink(link.tracking_url)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                            title="Open link"
                          >
                            <ExternalLink size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(link)}
                            className="p-1 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setLinkToDelete(link)}
                            className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-slate-800 transition-colors cursor-pointer"
                            title="Delete"
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
        </div>
      ) : (
        /* Grid / Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredLinks.map((link) => (
            <CampaignTrackingLinkCard
              key={link.id}
              link={link}
              onEdit={handleOpenEdit}
              onDelete={(l) => setLinkToDelete(l)}
            />
          ))}
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
        }}
        campaign={campaign}
        influencers={influencers}
        linkToEdit={linkToEdit}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};
