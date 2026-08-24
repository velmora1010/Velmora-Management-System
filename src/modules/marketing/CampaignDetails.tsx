import React, { useState } from 'react';
import { Users, Package, Settings, LayoutDashboard, BarChart2, Edit, Calendar, Archive, ArchiveRestore } from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { AddCampaignInfluencer } from './AddCampaignInfluencer';
import { CampaignInfluencerList } from './CampaignInfluencerList';
import { CampaignDispatchedList } from './CampaignDispatchedList';
import { CampaignStatusTracking } from './CampaignStatusTracking';
import { CampaignAnalytics } from './CampaignAnalytics';
import { CampaignCalendar } from './CampaignCalendar';
import { CampaignInfoTab } from './CampaignInfoTab';
import { EditCampaignModal } from './EditCampaignModal';
import { DispatchInfluencerModal } from './DispatchInfluencerModal';
import { useCampaignInfluencers } from '../../hooks/marketing/useCampaignInfluencers';
import { useCampaigns } from '../../hooks/marketing/useCampaigns';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import toast from 'react-hot-toast';

interface CampaignDetailsProps {
  campaign: Campaign;
  onBack: () => void;
  onCampaignUpdate?: (campaign: Campaign) => void;
}

type CampaignView = 'overview' | 'add-influencer' | 'influencer-list' | 'dispatched-list' | 'status-tracking' | 'calendar' | 'analytics';

import { isArchived } from '../../utils/marketingUtils';

export const CampaignDetails: React.FC<CampaignDetailsProps> = ({ campaign, onBack, onCampaignUpdate }) => {
  const [currentView, setCurrentView] = useState<CampaignView>('overview');
  const [editingInfluencer, setEditingInfluencer] = useState<CampaignInfluencer | null>(null);
  const [dispatchingInfluencer, setDispatchingInfluencer] = useState<CampaignInfluencer | null>(null);
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const { influencers, refresh } = useCampaignInfluencers(campaign.id);

  const { updateCampaign } = useCampaigns();

  const handleArchiveCampaign = async () => {
    try {
      const updated = await updateCampaign(campaign.id, { status: 'archived' });
      if (updated && updated.length > 0) {
        toast.success("Campaign archived successfully.");
        if (onCampaignUpdate) {
          onCampaignUpdate(updated[0] as Campaign);
        }
        onBack();
      }
    } catch (err) {
      console.error("Failed to archive campaign:", err);
      toast.error("Failed to archive campaign.");
    }
  };

  const handleRestoreCampaign = async () => {
    try {
      const updated = await updateCampaign(campaign.id, { status: 'active' });
      if (updated && updated.length > 0) {
        toast.success("Campaign restored successfully.");
        if (onCampaignUpdate) {
          onCampaignUpdate(updated[0] as Campaign);
        }
        onBack();
      }
    } catch (err) {
      console.error("Failed to restore campaign:", err);
      toast.error("Failed to restore campaign.");
    }
  };

  const activeInfluencers = influencers.filter(inf => !isArchived(inf.is_archived));
  const budgetUsed = activeInfluencers.reduce((sum, inf) => sum + (inf.pricing?.final_price || 0), 0);
  const videosLive = activeInfluencers.reduce((sum, inf) => sum + (inf.pricing?.total_videos || 0), 0);

  const handleMoveToStatus = async (record: any) => {
    const cleanBigInt = (val: any) => {
      if (
        val === undefined ||
        val === null ||
        val === "" ||
        val === "null" ||
        (typeof val === "number" && isNaN(val))
      ) {
        return null;
      }
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    try {
      const cleanedDispatchId = cleanBigInt(record.id);

      // Guard: dispatch record MUST have a valid numeric id
      if (cleanedDispatchId === null) {
        console.error("Move To Status failed: dispatch record has null id", record);
        toast.error("This dispatch record has no valid ID. Please re-dispatch this influencer.");
        return;
      }

      // 1. Check if tracking record already exists (use admin to bypass RLS)
      const { data: existing, error: findError } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .select('*')
        .eq('dispatch_id', cleanedDispatchId);

      if (findError) {
        console.error("Find existing error:", findError);
        toast.error(findError.message || JSON.stringify(findError));
        return;
      }

      if (existing && existing.length > 0) {
        // Already exists, redirect
        setCurrentView('status-tracking');
        return;
      }

      // 2. Query max ID (use admin to bypass RLS)
      const { data: maxData, error: maxError } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .select('id')
        .not('id', 'is', null)
        .order('id', { ascending: false })
        .limit(1);

      if (maxError) {
        console.error("Max ID error:", maxError);
        toast.error(`Failed to get next ID: ${maxError.message}`);
        return;
      }

      const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
      const nextId = isNaN(maxId) ? 1 : maxId + 1;

      // 3. Prepare payload
      const trackingPayload = {
        id: cleanBigInt(nextId),
        dispatch_id: cleanedDispatchId,
        influencer_id: cleanBigInt(record.influencer_id),
        campaign_id: cleanBigInt(record.campaign_id) || cleanBigInt(campaign.id),
        current_step: 0,
        delivered_confirmed: false,
        pay_advance_completed: false,
        reference_video_received: false,
        expected_delivery_completed: false,
        draft_received: false,
        payment_remaining_completed: false,
        final_post_completed: false,
        status: 'Active'
      };

      console.log("Move To Status Payload:", trackingPayload);

      // Use admin client to bypass RLS (table has no INSERT policy)
      const { error: insertError } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerStatus)
        .insert([trackingPayload]);

      if (insertError) {
        console.error("Insert error:", insertError);
        toast.error(`Failed inserting into ${SUPABASE_TABLES.influencerStatus}: ${insertError.message}`);
        return;
      }

      // Update dispatch record's status to Tracking
      const { error: updateError } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerDispatch)
        .update({ dispatch_status: 'Tracking' })
        .eq('id', cleanedDispatchId);

      if (updateError) {
        console.error("Update dispatch status error:", updateError);
      }

      toast.success('Moved to Status Tracking successfully!');
      setCurrentView('status-tracking');
    } catch (err: any) {
      console.error("Move To Status exception:", err);
      toast.error(err?.message || JSON.stringify(err));
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'add-influencer':
        return <AddCampaignInfluencer 
                 campaign={campaign} 
                 initialData={editingInfluencer || undefined}
                 onBack={() => {
                   setEditingInfluencer(null);
                   setCurrentView('overview');
                   refresh();
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
                 onMoveToStatus={handleMoveToStatus} 
               />;
      case 'status-tracking':
        return <CampaignStatusTracking campaign={campaign} onBack={() => setCurrentView('overview')} />;
      case 'calendar':
        return <CampaignCalendar campaign={campaign} onBack={() => setCurrentView('overview')} onNavigateToStatusTracking={() => setCurrentView('status-tracking')} />;
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
          {campaign.status?.toLowerCase() === 'archived' ? (
            <button 
              onClick={handleRestoreCampaign}
              className="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 bg-emerald-600/80 hover:bg-emerald-600 text-white animate-fade-in"
            >
              <ArchiveRestore size={14} /> Restore Campaign
            </button>
          ) : (
            <button 
              onClick={handleArchiveCampaign}
              className="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 bg-rose-600/80 hover:bg-rose-600 text-white animate-fade-in"
            >
              <Archive size={14} /> Archive Campaign
            </button>
          )}
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
            onClick={() => setCurrentView('calendar')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${currentView === 'calendar' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <Calendar size={14} /> Calendar
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
      {currentView !== 'analytics' && currentView !== 'calendar' && (
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
            {(() => {
              let parsed: string[] = [];
              try {
                if (typeof campaign.target_languages === 'string') {
                  const p = JSON.parse(campaign.target_languages);
                  parsed = Array.isArray(p) ? p : [campaign.target_languages];
                } else if (Array.isArray(campaign.target_languages)) {
                  parsed = campaign.target_languages;
                }
              } catch (e) {
                if (typeof campaign.target_languages === 'string') {
                  parsed = [campaign.target_languages];
                }
              }
              return parsed.length > 0 ? parsed.join(', ') : 'N/A';
            })()}
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
