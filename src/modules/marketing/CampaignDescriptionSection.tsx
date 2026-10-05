import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FileText, 
  ArrowLeft, 
  Plus, 
  Filter, 
  Loader2, 
  SearchX, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import type { Campaign, CampaignDescription } from '../../types';
import { SCRIPT_PRODUCTS } from '../../services/campaignScriptService';
import { 
  fetchCampaignDescriptions, 
  deleteCampaignDescription 
} from '../../services/campaignDescriptionService';
import { CampaignDescriptionModal } from './CampaignDescriptionModal';
import { CampaignDescriptionCard } from './CampaignDescriptionCard';
import toast from 'react-hot-toast';

interface CampaignDescriptionSectionProps {
  campaign: Campaign;
  onBack: () => void;
}

export const CampaignDescriptionSection: React.FC<CampaignDescriptionSectionProps> = ({ 
  campaign, 
  onBack 
}) => {
  const [descriptions, setDescriptions] = useState<CampaignDescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [selectedProduct, setSelectedProduct] = useState<string>('All');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [descriptionToEdit, setDescriptionToEdit] = useState<CampaignDescription | null>(null);

  // Load descriptions
  const loadDescriptions = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await fetchCampaignDescriptions(campaign.id);
      setDescriptions(data);
    } catch (err: any) {
      console.error('Error loading campaign descriptions:', err);
      const msg = err?.message || 'Failed to load descriptions.';
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => {
    loadDescriptions();
  }, [loadDescriptions]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setDescriptionToEdit(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (desc: CampaignDescription) => {
    setDescriptionToEdit(desc);
    setIsModalOpen(true);
  };

  // Modal success handler
  const handleModalSuccess = (savedDesc: CampaignDescription) => {
    setDescriptions(prev => {
      const index = prev.findIndex(d => d.id === savedDesc.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = savedDesc;
        return updated;
      }
      return [savedDesc, ...prev];
    });
  };

  // Delete handler
  const handleDelete = async (desc: CampaignDescription) => {
    try {
      await deleteCampaignDescription(desc.id, campaign.id);
      toast.success('Description deleted successfully');
      setDescriptions(prev => prev.filter(d => d.id !== desc.id));
    } catch (err: any) {
      console.error('Error deleting description:', err);
      toast.error(err?.message || 'Failed to delete description');
    }
  };

  // Filtered list
  const filteredDescriptions = useMemo(() => {
    return descriptions.filter(d => {
      if (selectedProduct === 'All') return true;
      return d.product.toLowerCase() === selectedProduct.toLowerCase();
    });
  }, [descriptions, selectedProduct]);

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
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Description Management</h3>
              <p className="text-xs text-slate-400 mt-0.5">{campaign.campaign_name}</p>
            </div>
          </div>
        </div>

        {/* Top Right: Create Description Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-900/25 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Description</span>
          </button>
        </div>
      </div>

      {/* Filters Bar & Results Summary */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
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

        {/* Count & Refresh */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-400 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
          <span className="font-medium text-slate-300">
            Showing <span className="text-purple-400 font-bold">{filteredDescriptions.length}</span>{' '}
            {filteredDescriptions.length === 1 ? 'Description' : 'Descriptions'}
          </span>
          <button
            type="button"
            onClick={loadDescriptions}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-[#070c18] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh descriptions"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin text-purple-400' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-[#0b1329]/60 border border-slate-800/90 rounded-2xl p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <Loader2 size={32} className="animate-spin text-purple-400 mb-3" />
          <h4 className="text-sm font-semibold text-slate-300">Loading product descriptions...</h4>
          <p className="text-xs text-slate-500 mt-1">Connecting to Supabase</p>
        </div>
      ) : fetchError ? (
        <div className="bg-[#0b1329]/60 border border-red-500/30 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mb-3">
            <AlertCircle size={24} />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">Failed to load descriptions</h4>
          <p className="text-xs text-red-400 max-w-md mb-4">{fetchError}</p>
          <button
            type="button"
            onClick={loadDescriptions}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : filteredDescriptions.length === 0 ? (
        /* Empty State */
        <div className="bg-[#0b1329]/60 border border-slate-800/90 rounded-2xl p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 shadow-inner">
            {descriptions.length === 0 ? <FileText size={32} /> : <SearchX size={32} />}
          </div>
          <h4 className="text-base sm:text-lg font-bold text-white mb-1.5">
            {descriptions.length === 0 ? 'No descriptions created yet' : 'No descriptions found'}
          </h4>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            {descriptions.length === 0
              ? `Get started by creating your first product description for ${campaign.campaign_name}.`
              : 'No descriptions match the selected product filter. Try selecting another product or create a new description.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-900/25 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Description</span>
          </button>
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredDescriptions.map((desc) => (
            <CampaignDescriptionCard
              key={desc.id}
              description={desc}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <CampaignDescriptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setDescriptionToEdit(null);
        }}
        campaign={campaign}
        descriptionToEdit={descriptionToEdit}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};
