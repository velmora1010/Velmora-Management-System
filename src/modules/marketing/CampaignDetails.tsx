import React, { useState } from 'react';
import { Users, Package, Settings, LayoutDashboard, BarChart2, Edit } from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { AddCampaignInfluencer } from './AddCampaignInfluencer';
import { CampaignInfluencerList } from './CampaignInfluencerList';
import { CampaignDispatchedList } from './CampaignDispatchedList';
import { CampaignStatusTracking } from './CampaignStatusTracking';
import { CampaignAnalytics } from './CampaignAnalytics';
import { CampaignInfoTab } from './CampaignInfoTab';
import { EditCampaignModal } from './EditCampaignModal';
import { DispatchInfluencerModal } from './DispatchInfluencerModal';
import { useCampaignInfluencers } from '../../hooks/marketing/useCampaignInfluencers';

interface CampaignDetailsProps {
  campaign: Campaign;
  onBack: () => void;
  onCampaignUpdate?: (campaign: Campaign) => void;
}

type CampaignView = 'overview' | 'add-influencer' | 'influencer-list' | 'dispatched-list' | 'status-tracking' | 'analytics';

export const CampaignDetails: React.FC<CampaignDetailsProps> = ({ campaign, onBack, onCampaignUpdate }) => {
  const [currentView, setCurrentView] = useState<CampaignView>('overview');
  const [editingInfluencer, setEditingInfluencer] = useState<CampaignInfluencer | null>(null);
  const [dispatchingInfluencer, setDispatchingInfluencer] = useState<CampaignInfluencer | null>(null);
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const { influencers, refresh } = useCampaignInfluencers(campaign.id);

  const activeInfluencers = influencers.filter(inf => !inf.is_archived);
  const budgetUsed = activeInfluencers.reduce((sum, inf) => sum + (inf.pricing?.final_price || 0), 0);
  const videosLive = activeInfluencers.reduce((sum, inf) => sum + (inf.pricing?.total_videos || 0), 0);

  const renderContent = () => {
    switch (currentView) {
      case 'add-influencer':
        return <AddCampaignInfluencer 
                 campaign={campaign} 
                 initialData={editingInfluencer || undefined}
                 onBack={() => {
                   setEditingInfluencer(null);
                   setCurrentView('overview');
                 }} 
               />;
      case 'influencer-list':
        return <CampaignInfluencerList 
                 campaign={campaign} 
                 onBack={() => setCurrentView('overview')} 
                 onEdit={(inf) => {
                   setEditingInfluencer(inf);
                   setCurrentView('add-influencer');
                 }}
                 onDispatch={(inf) => {
                   setDispatchingInfluencer(inf);
                 }}
               />;
      case 'dispatched-list':
        return <CampaignDispatchedList 
                 campaign={campaign} 
                 onBack={() => setCurrentView('overview')} 
                 onMoveToStatus={() => setCurrentView('status-tracking')} 
               />;
      case 'status-tracking':
        return <CampaignStatusTracking campaign={campaign} onBack={() => setCurrentView('overview')} />;
      case 'analytics':
        return <CampaignAnalytics campaign={campaign} influencers={influencers} onBack={() => setCurrentView('overview')} />;
      case 'overview':
      default:
        return <CampaignInfoTab campaign={campaign} />;
    }
  };

  return (
    <div className="animate-fade-in text-slate-200">
      {/* Dashboard Header Menu */}
      <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="text-slate-400 hover:text-slate-200 transition-colors mr-2 text-sm"
          >
            &larr; Back
          </button>
          <h2 className="text-xl font-bold text-slate-100">{campaign.campaign_name}</h2>
          <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400 capitalize border border-green-500/30">
            {campaign.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setCurrentView('overview')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${currentView === 'overview' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <LayoutDashboard size={14} /> Campaign Details
          </button>
          <button 
            onClick={() => setIsEditingCampaign(true)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white`}
          >
            <Edit size={14} /> Edit Campaign
          </button>
          <button 
            onClick={() => {
              setEditingInfluencer(null);
              setCurrentView('add-influencer');
            }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${currentView === 'add-influencer' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <Users size={14} /> + Add Influencer
          </button>
          <button 
            onClick={() => setCurrentView('influencer-list')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${currentView === 'influencer-list' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <Users size={14} /> Influencer List
          </button>
          <button 
            onClick={() => setCurrentView('dispatched-list')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${currentView === 'dispatched-list' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <Package size={14} /> Dispatched List
          </button>
          <button 
            onClick={() => setCurrentView('status-tracking')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${currentView === 'status-tracking' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <Settings size={14} /> Status Tracking
          </button>
          <button 
            onClick={() => setCurrentView('analytics')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${currentView === 'analytics' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <BarChart2 size={14} /> Analytics
          </button>
        </div>
      </div>

      {/* Analytics Widgets Specific to Campaign */}
      {currentView !== 'analytics' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Budget Used</div>
          <div className="text-xl font-semibold text-slate-200">₹{budgetUsed.toLocaleString()} / ₹{campaign.total_budget.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Influencers Onboarded</div>
          <div className="text-xl font-semibold text-slate-200">{activeInfluencers.length} / {campaign.expected_influencers}</div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Videos Live</div>
          <div className="text-xl font-semibold text-slate-200">{videosLive} / {campaign.expected_total_videos}</div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Target Languages</div>
          <div className="text-sm font-semibold text-slate-200 truncate">
            {Array.isArray(campaign.target_languages) 
              ? campaign.target_languages.join(', ') 
              : campaign.target_languages}
          </div>
        </div>
      </div>
      )}

      {renderContent()}

      {dispatchingInfluencer && (
        <DispatchInfluencerModal 
          influencer={dispatchingInfluencer} 
          campaign={campaign} 
          onClose={() => setDispatchingInfluencer(null)} 
          onSuccess={() => {
            setDispatchingInfluencer(null);
            refresh();
            setCurrentView('dispatched-list');
          }} 
        />
      )}
      {/* Edit Campaign Modal */}
      {isEditingCampaign && (
        <EditCampaignModal 
          campaign={campaign}
          onClose={() => setIsEditingCampaign(false)}
          onSuccess={(updatedCampaign) => {
            setIsEditingCampaign(false);
            if (onCampaignUpdate) {
              onCampaignUpdate(updatedCampaign);
            }
          }}
        />
      )}
    </div>
  );
};
