import React from 'react';
import { FileText, ArrowLeft, Clock, Sparkles } from 'lucide-react';
import type { Campaign } from '../../types';

interface CampaignScriptSectionProps {
  campaign: Campaign;
  onBack: () => void;
}

export const CampaignScriptSection: React.FC<CampaignScriptSectionProps> = ({ campaign, onBack }) => {
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
              <p className="text-xs text-slate-400 mt-0.5">{campaign.campaign_name}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
            <Sparkles size={13} className="text-purple-400" />
            <span>Script Section Ready</span>
          </span>
        </div>
      </div>

      {/* Main Content Area / Placeholder */}
      <div className="bg-[#0b1329]/60 border border-slate-800/90 rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 shadow-inner">
          <FileText size={32} />
        </div>
        <h4 className="text-lg sm:text-xl font-bold text-white mb-2">Campaign Script Workspace</h4>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          Dedicated section for managing creator concepts, hook variations, model scripts, reference videos, and voice records for <span className="text-purple-300 font-semibold">{campaign.campaign_name}</span>.
        </p>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#070c18] border border-slate-800 text-xs text-slate-400">
          <Clock size={14} className="text-slate-500" />
          <span>Route & Navigation established • Feature development ready</span>
        </div>
      </div>
    </div>
  );
};
