import React, { useState, useEffect } from 'react';
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
import { getDepartmentNavigation, saveDepartmentNavigation, DepartmentNavigation } from '../../utils/navigationPersistence';
import { logActivity } from '../../services/activityService';

interface CampaignDetailsProps {
  campaign: Campaign;
  onBack: () => void;
  onCampaignUpdate?: (campaign: Campaign) => void;
}

type CampaignView = 'overview' | 'add-influencer' | 'influencer-list' | 'dispatched-list' | 'status-tracking' | 'calendar' | 'analytics';

import { isArchived, isActiveStatus } from '../../utils/marketingUtils';

export const CampaignDetails: React.FC<CampaignDetailsProps> = ({ campaign, onBack, onCampaignUpdate }) => {
  const [currentView, setCurrentView] = useState<CampaignView>(() => {
    const nav = getDepartmentNavigation('marketing');
    return nav?.campaignView || 'overview';
  });

  const [editingInfluencerId, setEditingInfluencerId] = useState<string | null>(() => {
    const nav = getDepartmentNavigation('marketing');
    return nav?.editingInfluencerId || null;
  });

  const [editingInfluencer, setEditingInfluencer] = useState<CampaignInfluencer | null>(null);
  const [dispatchingInfluencer, setDispatchingInfluencer] = useState<CampaignInfluencer | null>(null);
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const { influencers, refresh } = useCampaignInfluencers(campaign.id);

  const handleViewChange = (newView: CampaignView, edits: Partial<DepartmentNavigation> = {}) => {
    setCurrentView(newView);
    saveDepartmentNavigation('marketing', '/marketing', {
      campaignView: newView,
      ...edits
    });
  };

  // Resolve Influencer ID against loaded influencers list
  useEffect(() => {
    if (editingInfluencerId && influencers.length > 0) {
      const match = influencers.find(inf => String(inf.id) === String(editingInfluencerId));
      if (match) {
        setEditingInfluencer(match);
      }
    }
  }, [influencers, editingInfluencerId]);

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

  const activeInfluencers = React.useMemo(() => {
    return influencers.filter(inf => isActiveStatus(inf.is_archived));
  }, [influencers]);

  const budgetUsed = React.useMemo(() => {
    return activeInfluencers.reduce((sum, inf) => {
      const p = inf.pricing as any;
      const price = Number(p?.final_price) || Number(p?.total_price) || Number(p?.price) || 0;
      return sum + price;
    }, 0);
  }, [activeInfluencers]);

  const videosLive = React.useMemo(() => {
    return activeInfluencers.reduce((sum, inf) => {
      const p = inf.pricing as any;
      const v = Number(p?.total_videos) || Number(p?.video_count) || 0;
      return sum + v;
    }, 0);
  }, [activeInfluencers]);

  const activeLanguages = React.useMemo(() => {
    const languageSet = new Set<string>();
    
    if (activeInfluencers.length > 0) {
      activeInfluencers.forEach(inf => {
        const rawLangs: any = inf.languages;
        let list: string[] = [];
        if (Array.isArray(rawLangs)) {
          list = rawLangs;
        } else if (typeof rawLangs === 'string' && (rawLangs as string).trim()) {
          list = (rawLangs as string).split(/[,/]+/).map((s: string) => s.trim()).filter(Boolean);
        }
        list.forEach((lang: any) => {
          if (typeof lang === 'string' && lang.trim() && !lang.startsWith('views_data:')) {
            languageSet.add(lang.trim());
          }
        });
      });
    }

    if (languageSet.size > 0) {
      return Array.from(languageSet).join(', ');
    }

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
  }, [activeInfluencers, campaign.target_languages]);

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

      // Non-blocking activity logging
      const influencerName = record.influencer_name || record.creator_name || `ID ${record.influencer_id || 'Unknown'}`;
      logActivity(
        'Logistics',
        'Tracking Information Added',
        `Influencer "${influencerName}" dispatch moved to status tracking.`
      );

      toast.success('Moved to Status Tracking successfully!');
      handleViewChange('status-tracking');
    } catch (err: any) {
      console.error("Move To Status exception:", err);
      toast.error(err?.message || JSON.stringify(err));
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'add-influencer':
        if (editingInfluencerId && !editingInfluencer) {
          return (
            <div className="flex h-64 items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          );
        }
        return <AddCampaignInfluencer 
                 key={editingInfluencer?.id ? `edit_${editingInfluencer.id}` : 'add'}
                 campaign={campaign} 
                 initialData={editingInfluencer || undefined}
                 onBack={() => {
                   setEditingInfluencer(null);
                   setEditingInfluencerId(null);
                   handleViewChange('influencer-list', { editingInfluencerId: undefined, activeTab: undefined });
                   refresh();
                 }} 
               />;
      case 'influencer-list':
        return <CampaignInfluencerList 
                 campaign={campaign} 
                 onBack={() => handleViewChange('overview')} 
                 onAddInfluencer={() => {
                   setEditingInfluencer(null);
                   setEditingInfluencerId(null);
                   handleViewChange('add-influencer', { editingInfluencerId: undefined, activeTab: undefined });
                 }}
                 editingInfluencerId={editingInfluencerId}
                 onEdit={(inf) => {
                   sessionStorage.removeItem(`influencer_edit_draft_${campaign.id}_${inf.id}`);
                   setEditingInfluencer(inf);
                   setEditingInfluencerId(String(inf.id));
                   saveDepartmentNavigation('marketing', '/marketing', {
                     campaignView: 'influencer-list',
                     editingInfluencerId: String(inf.id)
                   });
                 }}
                  onCancelEdit={async () => {
                    setEditingInfluencer(null);
                    setEditingInfluencerId(null);
                    saveDepartmentNavigation('marketing', '/marketing', {
                      campaignView: 'influencer-list',
                      editingInfluencerId: undefined
                    });
                    await refresh();
                  }}
                 onDispatch={(inf) => {
                   setDispatchingInfluencer(inf);
                 }}
               />;
      case 'dispatched-list':
        return <CampaignDispatchedList 
                 campaign={campaign} 
                 onBack={() => handleViewChange('overview')} 
                 onMoveToStatus={handleMoveToStatus} 
               />;
      case 'status-tracking':
        return <CampaignStatusTracking campaign={campaign} onBack={() => handleViewChange('overview')} />;
      case 'calendar':
        return <CampaignCalendar campaign={campaign} onBack={() => handleViewChange('overview')} onNavigateToStatusTracking={() => handleViewChange('status-tracking')} />;
      case 'analytics':
        return <CampaignAnalytics campaign={campaign} influencers={influencers} onBack={() => handleViewChange('overview')} />;
      case 'overview':
      default:
        return <CampaignInfoTab campaign={campaign} onEditCampaign={() => setIsEditingCampaign(true)} />;
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
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto max-w-full pb-1 scrollbar-thin scrollbar-thumb-slate-700">
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); handleViewChange('overview'); }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 shrink-0 ${currentView === 'overview' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <LayoutDashboard size={14} /> Campaign Details
          </button>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); handleViewChange('influencer-list'); }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 shrink-0 ${currentView === 'influencer-list' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <Users size={14} /> Campaign Influencer
          </button>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); handleViewChange('dispatched-list'); }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 shrink-0 ${currentView === 'dispatched-list' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <Package size={14} /> Influencer Logistics
          </button>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); handleViewChange('status-tracking'); }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 shrink-0 ${currentView === 'status-tracking' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <Settings size={14} /> Status Tracking
          </button>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); handleViewChange('calendar'); }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 shrink-0 ${currentView === 'calendar' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            <Calendar size={14} /> Calendar
          </button>
          {campaign.status?.toLowerCase() === 'archived' ? (
            <button 
              onClick={handleRestoreCampaign}
              title="Restore Campaign"
              className="p-2 text-sm rounded-lg transition-colors flex items-center justify-center bg-emerald-600/80 hover:bg-emerald-600 text-white animate-fade-in shrink-0 aspect-square h-[32px] w-[32px]"
            >
              <ArchiveRestore size={16} />
            </button>
          ) : (
            <button 
              onClick={handleArchiveCampaign}
              title="Archive Campaign"
              className="p-2 text-sm rounded-lg transition-colors flex items-center justify-center bg-rose-600/80 hover:bg-rose-600 text-white animate-fade-in shrink-0 aspect-square h-[32px] w-[32px]"
            >
              <Archive size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Analytics Widgets Specific to Campaign */}
      {currentView !== 'analytics' && currentView !== 'calendar' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Budget Used</div>
          <div className="text-xl font-semibold text-slate-200">₹{(budgetUsed ?? 0).toLocaleString()} / ₹{(campaign?.total_budget ?? 0).toLocaleString()}</div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Influencers Onboarded</div>
          <div className="text-xl font-semibold text-slate-200">{activeInfluencers.length} / {campaign.expected_influencers}</div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Total Video</div>
          <div className="text-xl font-semibold text-slate-200">{videosLive} / {campaign.expected_total_videos}</div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Target Languages</div>
          <div className="text-sm font-semibold text-slate-200 truncate" title={activeLanguages}>
            {activeLanguages}
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
