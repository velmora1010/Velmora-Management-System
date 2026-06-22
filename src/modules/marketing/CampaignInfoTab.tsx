import React from 'react';
import type { Campaign } from '../../types';
import { DollarSign, Target, Globe, Info } from 'lucide-react';

interface CampaignInfoTabProps {
  campaign: Campaign;
}

export const CampaignInfoTab: React.FC<CampaignInfoTabProps> = ({ campaign }) => {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Basic Information */}
        <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700/50 space-y-4">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-700/50 pb-4">
            <Info className="text-purple-400" size={20} />
            <h3 className="text-lg font-semibold text-slate-200">Basic Information</h3>
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
            <span className="text-slate-200 font-medium">₹{campaign.total_budget?.toLocaleString() || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Expected Influencers</span>
            <span className="text-slate-200 font-medium">{campaign.expected_influencers || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Expected Videos</span>
            <span className="text-slate-200 font-medium">{campaign.expected_total_videos || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Average Per Video Cost</span>
            <span className="text-slate-200 font-medium">₹{campaign.avg_per_video_cost?.toLocaleString() || 0}</span>
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
            {Array.isArray(campaign.target_languages) 
              ? campaign.target_languages.map((lang, idx) => (
                  <span key={idx} className="px-3 py-1 bg-slate-700 text-slate-200 rounded-full text-sm">
                    {lang}
                  </span>
                ))
              : (
                  <span className="px-3 py-1 bg-slate-700 text-slate-200 rounded-full text-sm">
                    {campaign.target_languages || 'N/A'}
                  </span>
              )
            }
          </div>
        </div>

      </div>
    </div>
  );
};
