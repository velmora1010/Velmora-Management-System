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
  User
} from 'lucide-react';
import type { Campaign, CampaignInfluencer, InfluencerTrackingLink } from '../../types';
import { SCRIPT_PRODUCTS } from '../../services/campaignScriptService';
import { 
  fetchInfluencerTrackingLinks, 
  deleteInfluencerTrackingLink 
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

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [linkToEdit, setLinkToEdit] = useState<InfluencerTrackingLink | null>(null);

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
  const handleModalSuccess = (savedLink: InfluencerTrackingLink) => {
    setLinks(prev => {
      const index = prev.findIndex(l => l.id === savedLink.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = savedLink;
        return updated;
      }
      return [savedLink, ...prev];
    });
  };

  // Delete handler
  const handleDelete = async (link: InfluencerTrackingLink) => {
    try {
      await deleteInfluencerTrackingLink(link.id, campaign.id);
      toast.success('Tracking link deleted successfully');
      setLinks(prev => prev.filter(l => l.id !== link.id));
    } catch (err: any) {
      console.error('Error deleting tracking link:', err);
      toast.error(err?.message || 'Failed to delete tracking link');
    }
  };

  // Filtered list
  const filteredLinks = useMemo(() => {
    return links.filter(l => {
      const matchProduct = selectedProduct === 'All' || l.product.toLowerCase() === selectedProduct.toLowerCase();
      const matchInfluencer = selectedInfluencerId === 'All' || String(l.influencer_id) === selectedInfluencerId;
      return matchProduct && matchInfluencer;
    });
  }, [links, selectedProduct, selectedInfluencerId]);

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

      {/* Filters Bar & Results Summary */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Filter 1: Product */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <Filter size={13} className="text-purple-400" />
              <span>Product:</span>
            </span>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors cursor-pointer w-full sm:w-auto"
            >
              <option value="All">All Products</option>
              {SCRIPT_PRODUCTS.map((prod) => (
                <option key={prod} value={prod}>
                  {prod}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Influencer */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <User size={13} className="text-purple-400" />
              <span>Influencer:</span>
            </span>
            <select
              value={selectedInfluencerId}
              onChange={(e) => setSelectedInfluencerId(e.target.value)}
              className="bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors cursor-pointer w-full sm:w-auto max-w-xs truncate"
            >
              <option value="All">All Influencers</option>
              {influencers.map((inf) => {
                const displayName = inf.influencer_name || inf.name || `ID ${inf.id}`;
                const code = inf.code ? ` (${inf.code})` : '';
                return (
                  <option key={inf.id} value={String(inf.id)}>
                    {displayName}{code}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Count & Refresh */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-400 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
          <span className="font-medium text-slate-300">
            Showing <span className="text-purple-400 font-bold">{filteredLinks.length}</span>{' '}
            {filteredLinks.length === 1 ? 'Link' : 'Links'}
          </span>
          <button
            type="button"
            onClick={() => {
              loadLinks();
              refreshInfluencers();
            }}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-[#070c18] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh tracking links"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin text-purple-400' : ''} />
          </button>
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
            {links.length === 0 ? 'No tracking links created yet' : 'No tracking links found'}
          </h4>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            {links.length === 0
              ? `Get started by creating your first influencer-specific tracking link for ${campaign.campaign_name}.`
              : 'No tracking links match the selected product and influencer filters. Try adjusting your filters or create a new link.'}
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
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredLinks.map((link) => (
            <CampaignTrackingLinkCard
              key={link.id}
              link={link}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
          ))}
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
