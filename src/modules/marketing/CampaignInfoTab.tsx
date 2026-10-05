import React from 'react';
import type { Campaign } from '../../types';
import { DollarSign, Target, Globe, Info, Edit, AlertTriangle, Trash2, ArchiveRestore } from 'lucide-react';

interface CampaignInfoTabProps {
  campaign: Campaign;
  onEditCampaign?: () => void;
  onDeleteCampaign?: () => void;
  onRestoreCampaign?: () => void;
}

export const CampaignInfoTab: React.FC<CampaignInfoTabProps> = ({ 
  campaign, 
  onEditCampaign,
  onDeleteCampaign,
  onRestoreCampaign
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Basic Information */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 space-y-4">
          <div className="flex items-center justify-between mb-6 border-b border-slate-700/50 pb-4">
            <div className="flex items-center gap-2">
              <Info className="text-purple-400" size={20} />
              <h3 className="text-lg font-semibold text-slate-200">Basic Information</h3>
            </div>
            {onEditCampaign && (
              <button
                type="button"
                onClick={onEditCampaign}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors border border-purple-500/50 flex items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer"
                title="Edit Campaign"
              >
                <Edit size={14} />
                Edit Campaign
              </button>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Campaign Name</span>
            <span className="text-slate-200 font-medium">{campaign.campaign_name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Campaign Type</span>
            <span className="text-slate-200 font-medium capitalize">{campaign.campaign_type}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Created Date</span>
            <span className="text-slate-200 font-medium">
              {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>

        {/* Budget & Planning */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 space-y-4">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-700/50 pb-4">
            <DollarSign className="text-emerald-400" size={20} />
            <h3 className="text-lg font-semibold text-slate-200">Budget & Planning</h3>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Total Budget</span>
            <span className="text-slate-200 font-medium">₹{(campaign?.total_budget ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Expected Influencers</span>
            <span className="text-slate-200 font-medium">{campaign?.expected_influencers || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Expected Videos</span>
            <span className="text-slate-200 font-medium">{campaign?.expected_total_videos || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Average Per Video Cost</span>
            <span className="text-slate-200 font-medium">₹{(campaign?.avg_per_video_cost ?? 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Campaign Details */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 space-y-4">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-700/50 pb-4">
            <Target className="text-blue-400" size={20} />
            <h3 className="text-lg font-semibold text-slate-200">Campaign Details</h3>
          </div>
          <div className="space-y-2">
            <span className="text-slate-400 block">Campaign Goal</span>
            <div className="text-slate-200 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 text-sm">
              {campaign.campaign_goal || 'No goal specified'}
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <span className="text-slate-400">Start Date</span>
            <span className="text-slate-200 font-medium">
              {campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">End Date</span>
            <span className="text-slate-200 font-medium">
              {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>

        {/* Target Languages */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 space-y-4">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-700/50 pb-4">
            <Globe className="text-pink-400" size={20} />
            <h3 className="text-lg font-semibold text-slate-200">Target Languages</h3>
          </div>
          <div className="flex flex-wrap gap-2">
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
              return parsed.length > 0 ? parsed.map((lang, idx) => (
                <span key={idx} className="px-3 py-1 bg-slate-700 text-slate-200 rounded-full text-sm">
                  {lang}
                </span>
              )) : (
                <span className="px-3 py-1 bg-slate-700 text-slate-200 rounded-full text-sm">
                  N/A
                </span>
              );
            })()}
          </div>
        </div>

      </div>

      {/* Danger Zone */}
      <div className="bg-[#1e2536] p-6 rounded-xl border border-rose-500/30 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-700/50 pb-3">
          <AlertTriangle className="text-rose-400" size={20} />
          <h3 className="text-lg font-semibold text-rose-400">Danger Zone</h3>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
          <div>
            <h4 className="text-sm font-semibold text-slate-200">
              {campaign.status?.toLowerCase() === 'archived' ? 'Restore Campaign' : 'Delete Campaign'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              {campaign.status?.toLowerCase() === 'archived'
                ? 'Restore this archived campaign back to active status.'
                : 'Deleting this campaign will archive and remove it from active campaigns and workflows.'}
            </p>
          </div>
          {campaign.status?.toLowerCase() === 'archived' ? (
            onRestoreCampaign && (
              <button
                type="button"
                onClick={onRestoreCampaign}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <ArchiveRestore size={14} />
                Restore Campaign
              </button>
            )
          ) : (
            onDeleteCampaign && (
              <button
                type="button"
                onClick={onDeleteCampaign}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <Trash2 size={14} />
                Delete Campaign
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
