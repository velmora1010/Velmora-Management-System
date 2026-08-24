import React from 'react';
import { useCampaigns } from '../hooks/marketing/useCampaigns';
import { useNavigate } from 'react-router-dom';
import { Megaphone, ArchiveRestore, ExternalLink, Archive } from 'lucide-react';
import toast from 'react-hot-toast';

export const ArchivePage: React.FC = () => {
  const { campaigns, isLoading, refreshCampaigns, updateCampaign } = useCampaigns();
  const navigate = useNavigate();

  const archivedCampaigns = campaigns.filter(
    (c) => c.status?.toLowerCase() === 'archived'
  );

  const handleRestore = async (id: string, name: string) => {
    try {
      await updateCampaign(id, { status: 'active' });
      toast.success(`Campaign "${name}" restored successfully.`);
      refreshCampaigns();
    } catch (err) {
      console.error('Failed to restore campaign:', err);
      toast.error('Failed to restore campaign.');
    }
  };

  return (
    <div className="animate-in fade-in duration-300 max-w-5xl mx-auto py-6 space-y-8">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
          <Archive size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Global Archive</h1>
          <p className="text-slate-400 text-sm">View and restore archived items from all departments</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Marketing Department Section */}
        <div className="bg-[#1e2536] border border-slate-700/50 rounded-xl overflow-hidden shadow-xl">
          <div className="p-5 bg-slate-800/40 border-b border-slate-700/50 flex items-center gap-3">
            <Megaphone className="text-pink-400" size={20} />
            <h2 className="text-lg font-semibold text-slate-200">Marketing</h2>
            <span className="ml-auto px-2.5 py-0.5 bg-slate-700 text-slate-300 text-xs font-semibold rounded-full">
              {archivedCampaigns.length} {archivedCampaigns.length === 1 ? 'campaign' : 'campaigns'}
            </span>
          </div>

          <div className="p-5">
            {isLoading ? (
              <div className="text-slate-500 text-sm py-4 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Loading archived campaigns...
              </div>
            ) : archivedCampaigns.length === 0 ? (
              <p className="text-slate-500 text-sm italic py-2">No archived Marketing campaigns found.</p>
            ) : (
              <div className="divide-y divide-slate-700/40">
                {archivedCampaigns.map((campaign) => (
                  <div key={campaign.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 group">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-200 truncate group-hover:text-purple-400 transition-colors">
                        {campaign.campaign_name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Type: {campaign.campaign_type || 'N/A'} • Budget: ₹{campaign.total_budget?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => navigate('/marketing', { state: { openCampaignId: campaign.id } })}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all"
                        title="View details"
                      >
                        <ExternalLink size={13} /> View
                      </button>
                      <button
                        onClick={() => handleRestore(campaign.id, campaign.campaign_name)}
                        className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all"
                        title="Restore campaign"
                      >
                        <ArchiveRestore size={13} /> Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
