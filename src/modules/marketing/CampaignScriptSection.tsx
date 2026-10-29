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
import type { Campaign, CampaignScript } from '../../types';
import { 
  SCRIPT_PRODUCTS, 
  fetchCampaignScripts, 
  deleteCampaignScript 
} from '../../services/campaignScriptService';
import { CampaignScriptModal } from './CampaignScriptModal';
import { CampaignScriptCard } from './CampaignScriptCard';
import toast from 'react-hot-toast';

interface CampaignScriptSectionProps {
  campaign: Campaign;
  onBack: () => void;
}

export const CampaignScriptSection: React.FC<CampaignScriptSectionProps> = ({ campaign, onBack }) => {
  const [scripts, setScripts] = useState<CampaignScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters strictly within this campaign
  const [selectedProduct, setSelectedProduct] = useState<string>('All');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scriptToEdit, setScriptToEdit] = useState<CampaignScript | null>(null);

  // Available languages from current campaign and loaded scripts
  const availableLanguages = useMemo(() => {
    let campaignLangs: string[] = [];
    if (typeof campaign.target_languages === 'string') {
      try {
        const parsed = JSON.parse(campaign.target_languages);
        campaignLangs = Array.isArray(parsed) ? parsed : [campaign.target_languages];
      } catch {
        campaignLangs = [campaign.target_languages];
      }
    } else if (Array.isArray(campaign.target_languages)) {
      campaignLangs = campaign.target_languages;
    }

    const set = new Set<string>();
    campaignLangs.filter(Boolean).forEach(l => set.add(l.trim()));
    scripts.forEach(s => {
      if (s.language) set.add(s.language.trim());
    });

    return Array.from(set).sort();
  }, [campaign.target_languages, scripts]);

  // Load scripts strictly for this campaign
  const loadScripts = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await fetchCampaignScripts(campaign.id);
      // Strict guard: only keep scripts matching this campaign's ID
      const isolated = data.filter(s => String(s.campaign_id) === String(campaign.id));
      setScripts(isolated);
    } catch (err: any) {
      console.error('Error loading scripts:', err);
      const msg = err?.message || 'Failed to load scripts from Supabase.';
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  // Handlers for modal
  const handleOpenCreate = () => {
    setScriptToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (script: CampaignScript) => {
    setScriptToEdit(script);
    setIsModalOpen(true);
  };

  const handleModalSuccess = (savedScript: CampaignScript) => {
    setScripts(prev => {
      const index = prev.findIndex(s => s.id === savedScript.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = savedScript;
        return updated;
      }
      return [savedScript, ...prev];
    });
  };

  // Delete handler
  const handleDelete = async (script: CampaignScript) => {
    try {
      await deleteCampaignScript(script);
      toast.success('Script deleted successfully');
      setScripts(prev => prev.filter(s => s.id !== script.id));
    } catch (err: any) {
      console.error('Error deleting script:', err);
      toast.error(err?.message || 'Failed to delete script');
    }
  };

  // Filter scripts by product and language
  const filteredScripts = useMemo(() => {
    return scripts.filter(s => {
      const matchProduct = selectedProduct === 'All' 
        ? true 
        : s.product.toLowerCase().includes(selectedProduct.toLowerCase()) || 
          selectedProduct.toLowerCase().includes(s.product.toLowerCase());
      const matchLanguage = selectedLanguage === 'All' || s.language.toLowerCase() === selectedLanguage.toLowerCase();
      return matchProduct && matchLanguage;
    });
  }, [scripts, selectedProduct, selectedLanguage]);

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
              <h3 className="text-base font-bold text-white leading-tight">Script Management</h3>
              <p className="text-xs text-purple-300 font-medium mt-0.5">{campaign.campaign_name}</p>
            </div>
          </div>
        </div>

        {/* Top Right: Create Script Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-900/25 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Script</span>
          </button>
        </div>
      </div>

      {/* Filters Bar & Results Summary */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-wrap">
          {/* Filter 1: Title (Product) */}
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

          {/* Filter 2: Language */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">
              Language:
            </span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-[#070c18] border border-slate-700/80 focus:border-purple-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors cursor-pointer w-full sm:w-auto"
            >
              <option value="All">All Languages</option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Count & Refresh */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-400 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
          <span className="font-medium text-slate-300">
            Showing <span className="text-purple-400 font-bold">{filteredScripts.length}</span> {filteredScripts.length === 1 ? 'Script' : 'Scripts'}
          </span>
          <button
            type="button"
            onClick={loadScripts}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-[#070c18] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh scripts"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin text-purple-400' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-[#0b1329]/60 border border-slate-800/90 rounded-2xl p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <Loader2 size={32} className="animate-spin text-purple-400 mb-3" />
          <h4 className="text-sm font-semibold text-slate-300">Loading scripts...</h4>
          <p className="text-xs text-slate-500 mt-1">Connecting to Supabase</p>
        </div>
      ) : fetchError ? (
        <div className="bg-[#0b1329]/60 border border-red-500/30 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mb-3">
            <AlertCircle size={24} />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">Failed to load scripts</h4>
          <p className="text-xs text-red-400 max-w-md mb-4">{fetchError}</p>
          <button
            type="button"
            onClick={loadScripts}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : filteredScripts.length === 0 ? (
        <div className="bg-[#0b1329]/60 border border-slate-800/80 rounded-2xl p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
            {scripts.length === 0 ? <FileText size={24} /> : <SearchX size={24} />}
          </div>
          <h4 className="text-base font-bold text-slate-200">
            {scripts.length === 0 ? 'No scripts found for this campaign' : 'No matching scripts'}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1.5 mb-5">
            {scripts.length === 0 
              ? 'Scripts created here will be saved specifically for this campaign.' 
              : 'Try adjusting your product or language filters to find what you are looking for.'}
          </p>
          {scripts.length === 0 ? (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-900/20 cursor-pointer"
            >
              <Plus size={15} />
              <span>Create First Script</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSelectedProduct('All');
                setSelectedLanguage('All');
              }}
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold underline underline-offset-2 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredScripts.map((script) => (
            <CampaignScriptCard
              key={script.id}
              script={script}
              campaignName={campaign.campaign_name}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <CampaignScriptModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          campaign={campaign}
          scriptToEdit={scriptToEdit}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};
