import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, RefreshCcw, BarChart2, Users, Package, DollarSign, Menu, X, ChevronLeft, ChevronRight, MoreVertical, Edit, Download, Archive } from 'lucide-react';
import { useCampaigns } from '../../hooks/marketing/useCampaigns';
import type { Campaign } from '../../types';
import { CampaignForm } from './CampaignForm';
import { CampaignDetails } from './CampaignDetails';
import { EditCampaignModal } from './EditCampaignModal';
import { useLocation } from 'react-router-dom';
import { getDepartmentNavigation, saveDepartmentNavigation } from '../../utils/navigationPersistence';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { isActiveStatus } from '../../utils/marketingUtils';
import { buildPickListRecords } from '../../config/skuMapping';
import { generatePickListPDF } from '../../utils/generatePickListPDF';
import toast from 'react-hot-toast';

interface InfluencerDashboardProps {
  onBack: () => void;
}

type DashboardView = 'overview' | 'create-campaign' | 'campaign-details';

export const InfluencerDashboard: React.FC<InfluencerDashboardProps> = ({ onBack }) => {
  const { campaigns, isLoading, error, refreshCampaigns, updateCampaign } = useCampaigns();
  
  const [activeMenuCampaignId, setActiveMenuCampaignId] = useState<string | number | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const [view, setView] = useState<DashboardView>(() => {
    const nav = getDepartmentNavigation('marketing');
    return nav?.dashboardView || 'overview';
  });
  
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(() => {
    const nav = getDepartmentNavigation('marketing');
    return nav?.selectedCampaignId || null;
  });

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  
  const location = useLocation();
  const state = location.state as { openCampaignId?: string } | null;

  // Resolve Campaign ID against campaigns data without resetting view on refetch
  useEffect(() => {
    if (selectedCampaignId && campaigns.length > 0) {
      const match = campaigns.find(c => String(c.id) === String(selectedCampaignId));
      if (match) {
        setSelectedCampaign(match);
      }
    }
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    if (state?.openCampaignId && campaigns.length > 0) {
      const match = campaigns.find(c => String(c.id) === String(state.openCampaignId));
      if (match) {
        setSelectedCampaign(match);
        setSelectedCampaignId(String(match.id));
        setView('campaign-details');
        saveDepartmentNavigation('marketing', '/marketing', {
          dashboardView: 'campaign-details',
          selectedCampaignId: String(match.id)
        });
      }
    }
  }, [state?.openCampaignId, campaigns]);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('marketingSidebarCollapsed') === 'true';
  });

  const handleDownloadCampaignPickList = async (targetCampaign: Campaign) => {
    try {
      toast.loading(`Fetching pick list data for "${targetCampaign.campaign_name}"...`, { id: 'picklist-loader' });
      
      const { data: infoList, error: infoErr } = await supabase
        .from(SUPABASE_TABLES.influencersInfo)
        .select('*')
        .eq('campaign_id', targetCampaign.id);

      if (infoErr) throw infoErr;

      const activeInfos = (infoList || []).filter(inf => isActiveStatus(inf.is_archived));
      
      if (activeInfos.length === 0) {
        toast.dismiss('picklist-loader');
        toast.error('No active influencers found in this campaign.');
        return;
      }

      const influencerIds = activeInfos.map(inf => inf.id);

      const [
        { data: pricingData },
        { data: productsData }
      ] = await Promise.all([
        supabase.from(SUPABASE_TABLES.influencerPricing).select('*').in('influencer_id', influencerIds),
        supabase.from(SUPABASE_TABLES.influencerProduct).select('*').in('influencer_id', influencerIds)
      ]);

      const fullInfluencers = activeInfos.map(inf => {
        const infPricing = (pricingData || []).find(p => String(p.influencer_id) === String(inf.id));
        const infProducts = (productsData || []).filter(p => String(p.influencer_id) === String(inf.id));
        return {
          ...inf,
          pricing: infPricing || inf.pricing || null,
          products: infProducts.length > 0 ? infProducts : (inf.products || [])
        } as any;
      });

      const records = buildPickListRecords(fullInfluencers);
      generatePickListPDF(targetCampaign.campaign_name, records);

      toast.dismiss('picklist-loader');
      toast.success(`Pick list downloaded for "${targetCampaign.campaign_name}"!`);
    } catch (err: any) {
      toast.dismiss('picklist-loader');
      console.error('Error generating Pick List PDF:', err);
      toast.error(err?.message || 'Failed to generate Pick List PDF.');
    }
  };

  const handleArchiveCampaign = async (targetCampaign: Campaign) => {
    if (!window.confirm(`Are you sure you want to archive "${targetCampaign.campaign_name}"? All campaign data will be preserved.`)) {
      return;
    }
    try {
      await updateCampaign(targetCampaign.id, { status: 'archived' });
      refreshCampaigns();
      toast.success(`Campaign "${targetCampaign.campaign_name}" archived successfully!`);
    } catch (err: any) {
      console.error('Error archiving campaign:', err);
      toast.error(err?.message || 'Failed to archive campaign.');
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('marketingSidebarCollapsed', String(newState));
      return newState;
    });
  };

  const handleCreateNew = () => {
    setSelectedCampaign(null);
    setSelectedCampaignId(null);
    setView('create-campaign');
    setIsMobileSidebarOpen(false);
    saveDepartmentNavigation('marketing', '/marketing', {
      dashboardView: 'create-campaign',
      selectedCampaignId: undefined
    });
  };

  const handleSelectCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setSelectedCampaignId(String(campaign.id));
    setView('campaign-details');
    setIsMobileSidebarOpen(false);
    saveDepartmentNavigation('marketing', '/marketing', {
      dashboardView: 'campaign-details',
      selectedCampaignId: String(campaign.id)
    });
  };

  return (
    <div className="flex h-full bg-slate-900 overflow-hidden text-slate-200 relative w-full">
      {/* Mobile Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="md:hidden absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-20"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`absolute md:relative z-30 shrink-0 bg-slate-800 md:bg-slate-800/50 border-r border-slate-700 flex flex-col h-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${isCollapsed ? 'w-[68px]' : 'w-64'}`}>
        <div className="p-4 border-b border-slate-700 flex flex-col gap-4">
          <div className="flex justify-between items-center h-7">
            <button 
              onClick={onBack}
              title={isCollapsed ? "Back" : undefined}
              className={`flex items-center gap-2 text-slate-400 hover:text-white transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
            >
              <ArrowLeft size={16} className="shrink-0" /> <span className={`whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>Back</span>
            </button>
            <div className="flex items-center gap-2">
              <button 
                className="md:hidden text-slate-400 hover:text-white"
                onClick={() => setIsMobileSidebarOpen(false)}
              >
                <X size={20} />
              </button>
              <button 
                onClick={toggleCollapse}
                className="hidden md:flex p-1.5 text-slate-400 hover:text-white bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors shrink-0"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>
          </div>
          <button 
            onClick={handleCreateNew}
            title={isCollapsed ? "Create Campaign" : undefined}
            className={`w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all ${isCollapsed ? 'p-2' : 'gap-2 px-4 py-2'}`}
          >
            <Plus size={16} className="shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100 block'}`}>Create Campaign</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar overflow-x-hidden">
          <h3 className={`text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider transition-opacity duration-300 whitespace-nowrap ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>Created Campaigns</h3>
          {isLoading ? (
            <div className="text-slate-500 text-sm flex items-center justify-center py-4">
              <RefreshCcw size={16} className={`animate-spin ${isCollapsed ? '' : 'mr-2'}`} />
              <span className={`transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>Loading...</span>
            </div>
          ) : error ? (
            <div className={`text-red-400 text-sm bg-red-400/10 rounded-lg border border-red-400/20 transition-all ${isCollapsed ? 'p-2 text-center' : 'p-3'}`}>
              {isCollapsed ? '!' : error.message || 'Error loading campaigns'}
            </div>
          ) : campaigns.length === 0 ? (
            <div className={`text-slate-500 text-sm italic transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>No campaigns found</div>
          ) : (
            <ul className="space-y-2">
              {campaigns.filter(c => c.status?.toLowerCase() !== 'archived').map(campaign => {
                const shortName = campaign.campaign_name.charAt(0).toUpperCase();
                const isSelected = selectedCampaign?.id === campaign.id;
                const isMenuOpen = activeMenuCampaignId === campaign.id;

                return (
                  <li key={campaign.id} className="relative group">
                    <div
                      onClick={() => handleSelectCampaign(campaign)}
                      title={isCollapsed ? campaign.campaign_name : undefined}
                      className={`w-full flex items-center justify-between rounded-lg transition-all text-sm cursor-pointer ${
                        isSelected 
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                          : 'text-slate-300 hover:bg-slate-700/50'
                      } ${isCollapsed ? 'h-9 justify-center px-0' : 'px-3 py-2'}`}
                    >
                      {isCollapsed ? (
                        <div className="font-bold">{shortName}</div>
                      ) : (
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-medium truncate w-full">{campaign.campaign_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 capitalize">{campaign.status}</div>
                        </div>
                      )}

                      {!isCollapsed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuCampaignId(isMenuOpen ? null : campaign.id);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                          title="Campaign Options"
                        >
                          <MoreVertical size={16} />
                        </button>
                      )}
                    </div>

                    {/* Campaign Action Dropdown Menu */}
                    {isMenuOpen && !isCollapsed && (
                      <div 
                        className="absolute right-2 top-10 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCampaign(campaign);
                            setActiveMenuCampaignId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                        >
                          <Edit size={14} className="text-purple-400" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuCampaignId(null);
                            handleDownloadCampaignPickList(campaign);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                        >
                          <Download size={14} className="text-emerald-400" /> Download Pick List
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuCampaignId(null);
                            handleArchiveCampaign(campaign);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-amber-400 hover:bg-slate-800 flex items-center gap-2 border-t border-slate-800 mt-1 pt-2"
                        >
                          <Archive size={14} /> Archive
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Right Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full relative">
        {/* Mobile Header Toggle */}
        <div className="md:hidden flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="font-semibold text-slate-200 truncate pr-4">
            {view === 'overview' ? 'Analytics Overview' : view === 'create-campaign' ? 'New Campaign' : selectedCampaign?.campaign_name || 'Campaign Details'}
          </div>
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 shrink-0"
          >
            <Menu size={20} />
          </button>
        </div>

        {view === 'overview' && (
          <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">Marketing Analytics Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 text-purple-400 rounded-lg">
                  <BarChart2 size={24} />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Total Campaigns</div>
                  <div className="text-2xl font-bold text-slate-100">{campaigns.length}</div>
                </div>
              </div>
              
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg">
                  <Users size={24} />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Total Influencers</div>
                  <div className="text-2xl font-bold text-slate-100">0</div>
                </div>
              </div>
              
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <Package size={24} />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Total Dispatched</div>
                  <div className="text-2xl font-bold text-slate-100">0</div>
                </div>
              </div>
              
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-lg">
                  <DollarSign size={24} />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Total Revenue Made</div>
                  <div className="text-2xl font-bold text-slate-100">₹0</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 min-h-[300px] flex items-center justify-center">
                <p className="text-slate-500">Platform Analytics Chart (Coming Soon)</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 min-h-[300px] flex items-center justify-center">
                <p className="text-slate-500">Revenue Flow Chart (Coming Soon)</p>
              </div>
            </div>
          </div>
        )}

        {view === 'create-campaign' && (
          <CampaignForm 
            onSuccess={(campaign) => {
              handleSelectCampaign(campaign);
            }} 
            onCancel={() => setView('overview')} 
          />
        )}

        {view === 'campaign-details' && selectedCampaign && (
          <CampaignDetails 
            campaign={selectedCampaign} 
            onBack={() => {
              setView('overview');
              setSelectedCampaign(null);
              setSelectedCampaignId(null);
              saveDepartmentNavigation('marketing', '/marketing', {
                dashboardView: 'overview',
                selectedCampaignId: undefined,
                campaignView: undefined,
                editingInfluencerId: undefined
              });
            }} 
            onCampaignUpdate={(updatedCampaign) => {
              setSelectedCampaign(updatedCampaign);
              refreshCampaigns();
            }}
          />
        )}

        {editingCampaign && (
          <EditCampaignModal
            campaign={editingCampaign}
            onClose={() => setEditingCampaign(null)}
            onSuccess={(updatedCampaign) => {
              setEditingCampaign(null);
              refreshCampaigns();
              if (selectedCampaign && selectedCampaign.id === updatedCampaign.id) {
                setSelectedCampaign(updatedCampaign);
              }
            }}
          />
        )}
      </main>
    </div>
  );
};
