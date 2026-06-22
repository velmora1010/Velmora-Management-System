import React, { useState } from 'react';
import { ArrowLeft, Plus, RefreshCcw, BarChart2, Users, Package, DollarSign, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCampaigns } from '../../hooks/marketing/useCampaigns';
import type { Campaign } from '../../types';
import { CampaignForm } from './CampaignForm';
import { CampaignDetails } from './CampaignDetails';

interface InfluencerDashboardProps {
  onBack: () => void;
}

type DashboardView = 'overview' | 'create-campaign' | 'campaign-details';

export const InfluencerDashboard: React.FC<InfluencerDashboardProps> = ({ onBack }) => {
  const { campaigns, isLoading, error, refreshCampaigns } = useCampaigns();
  const [view, setView] = useState<DashboardView>('overview');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('marketingSidebarCollapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('marketingSidebarCollapsed', String(newState));
      return newState;
    });
  };

  const handleCreateNew = () => {
    setSelectedCampaign(null);
    setView('create-campaign');
    setIsMobileSidebarOpen(false);
  };

  const handleSelectCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setView('campaign-details');
    setIsMobileSidebarOpen(false);
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
              {campaigns.map(campaign => {
                // Determine a short placeholder for collapsed mode (e.g. first letter)
                const shortName = campaign.campaign_name.charAt(0).toUpperCase();
                return (
                  <li key={campaign.id}>
                    <button
                      onClick={() => handleSelectCampaign(campaign)}
                      title={isCollapsed ? campaign.campaign_name : undefined}
                      className={`w-full flex flex-col justify-center rounded-lg transition-all text-sm ${
                        selectedCampaign?.id === campaign.id 
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                          : 'text-slate-300 hover:bg-slate-700/50'
                      } ${isCollapsed ? 'h-9 items-center px-0' : 'text-left px-3 py-2'}`}
                    >
                      {isCollapsed ? (
                        <div className="font-bold">{shortName}</div>
                      ) : (
                        <>
                          <div className="font-medium truncate w-full">{campaign.campaign_name}</div>
                          <div className="text-xs text-slate-500 mt-1 capitalize">{campaign.status}</div>
                        </>
                      )}
                    </button>
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
            onBack={() => setView('overview')} 
            onCampaignUpdate={(updatedCampaign) => {
              setSelectedCampaign(updatedCampaign);
              refreshCampaigns();
            }}
          />
        )}
      </main>
    </div>
  );
};
