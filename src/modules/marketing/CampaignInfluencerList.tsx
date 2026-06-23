import React, { useState, useMemo } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { Search, UserCheck, Archive, RefreshCcw, ArchiveRestore, Edit, Copy, ExternalLink } from 'lucide-react';
import { useCampaignInfluencers } from '../../hooks/marketing/useCampaignInfluencers';
import { InfluencerActionMenu } from '../../components/marketing/InfluencerActionMenu';
import { isArchived } from '../../utils/marketingUtils';
import toast from 'react-hot-toast';

const InfluencerCard = ({ 
  influencer, 
  onEdit, 
  onToggleArchive,
  onDispatch 
}: { 
  influencer: CampaignInfluencer, 
  onEdit: (inf: CampaignInfluencer) => void,
  onToggleArchive: (id: string, isArchived: boolean) => void,
  onDispatch?: (inf: CampaignInfluencer) => void
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'platform' | 'pricing' | 'products' | 'performance'>('basic');
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});

  const togglePlatformExpanded = (platformName: string) => {
    setExpandedPlatforms(prev => ({ ...prev, [platformName]: !prev[platformName] }));
  };

  const handleCopy = () => {
    const details = `Name: ${influencer.name}
Influencer: ${influencer.influencer_name}
Phone: ${influencer.phone_number}
City: ${influencer.city}`;
    navigator.clipboard.writeText(details);
    toast.success('Influencer details copied to clipboard!');
  };

  return (
     <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl hover:border-slate-600 transition-colors relative mb-6">
        {/* Header Actions - Desktop */}
        <div className="absolute top-4 right-4 hidden md:flex gap-2">
            {onDispatch && (
              influencer.dispatchDetails ? (
                <button 
                  disabled
                  className="px-4 py-1.5 text-[13px] rounded-md pointer-events-none"
                  style={{ backgroundColor: 'rgba(40, 167, 69, 0.1)', color: '#28a745', border: '1px solid rgba(40, 167, 69, 0.3)' }}
                >
                  Dispatched
                </button>
              ) : (
                <button 
                  onClick={() => onDispatch(influencer)} 
                  className="px-4 py-1.5 text-[13px] rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                >
                  Dispatch
                </button>
              )
            )}
            <button onClick={() => onEdit(influencer)} className="p-1.5 bg-slate-800 border border-slate-600 rounded text-slate-400 hover:text-blue-400 transition-colors" title="Edit"><Edit size={14} /></button>
            <button onClick={handleCopy} className="p-1.5 bg-slate-800 border border-slate-600 rounded text-slate-400 hover:text-slate-200 transition-colors" title="Copy"><Copy size={14} /></button>
            {isArchived(influencer.is_archived) ? (
                <button onClick={() => onToggleArchive(influencer.id, false)} className="p-1.5 bg-slate-800 border border-slate-600 rounded text-slate-400 hover:text-green-400 transition-colors" title="Restore"><ArchiveRestore size={14} /></button>
            ) : (
                <button onClick={() => onToggleArchive(influencer.id, true)} className="p-1.5 bg-slate-800 border border-slate-600 rounded text-slate-400 hover:text-red-400 transition-colors" title="Archive"><Archive size={14} /></button>
            )}
        </div>

        {/* Header Actions - Mobile (<768px) */}
        <div className="absolute top-2 right-2 md:hidden">
            <InfluencerActionMenu
              isDispatched={!!influencer.dispatchDetails}
              isArchived={isArchived(influencer.is_archived)}
              onDispatch={onDispatch ? () => onDispatch(influencer) : undefined}
              onEdit={() => onEdit(influencer)}
              onCopy={handleCopy}
              onToggleArchive={() => onToggleArchive(influencer.id, !isArchived(influencer.is_archived))}
            />
        </div>

        {/* Profile Info */}
        <div className="flex items-center gap-4 mb-4 mt-2 sm:mt-0">
          <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-full flex items-center justify-center font-bold text-lg border border-purple-500/20 overflow-hidden shrink-0">
            {influencer.profile_file_url ? (
              <img src={influencer.profile_file_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              influencer.name?.charAt(0)?.toUpperCase() || '?'
            )}
          </div>
          <div>
            <h4 className="text-slate-100 font-semibold">{influencer.influencer_name}</h4>
            <p className="text-slate-400 text-xs">@{influencer.name} &bull; {influencer.code}</p>
          </div>
          <div className="ml-4 hidden sm:block">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isArchived(influencer.is_archived) ? 'bg-slate-700 text-slate-300' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
              {isArchived(influencer.is_archived) ? 'Archived' : 'Active'}
            </span>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-800 pb-2">
          {[
            { id: 'basic', label: 'Basic Info' },
            { id: 'platform', label: 'Platform Details' },
            { id: 'pricing', label: 'Pricing Info' },
            { id: 'products', label: 'Products' },
            { id: 'performance', label: 'Brand Performance' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab.id 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="text-sm">
          {activeTab === 'basic' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div><span className="text-slate-500 block text-xs">User Name</span><span className="text-slate-200">{influencer.name || '-'}</span></div>
               <div><span className="text-slate-500 block text-xs">Influencer Name</span><span className="text-slate-200">{influencer.influencer_name || '-'}</span></div>
               <div><span className="text-slate-500 block text-xs">Phone</span><span className="text-slate-200">{influencer.phone_number || '-'}</span></div>
               <div><span className="text-slate-500 block text-xs">Alt Phone</span><span className="text-slate-200">{influencer.alternative_number || '-'}</span></div>
               <div><span className="text-slate-500 block text-xs">UPI</span><span className="text-slate-200">{influencer.upi_number || '-'}</span></div>
               <div><span className="text-slate-500 block text-xs">City</span><span className="text-slate-200">{influencer.city || '-'}</span></div>
               <div><span className="text-slate-500 block text-xs">State</span><span className="text-slate-200">{influencer.state || '-'}</span></div>
               <div><span className="text-slate-500 block text-xs">Auto DM Tool</span><span className="text-slate-200">{influencer.auto_dm ? 'Yes' : 'No'}</span></div>
               <div className="col-span-2 md:col-span-4"><span className="text-slate-500 block text-xs">Languages</span><span className="text-slate-200">{Array.isArray(influencer.languages) ? influencer.languages.join(', ') : '-'}</span></div>
               <div className="col-span-2 md:col-span-4"><span className="text-slate-500 block text-xs">Address</span><span className="text-slate-200">{influencer.complete_address || '-'}</span></div>
            </div>
          )}

          {activeTab === 'platform' && (
            <div className="space-y-4">
              {influencer.platforms && influencer.platforms.length > 0 ? (
                influencer.platforms.map((p, i) => (
                  <div key={i} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-purple-300">{p.platform}</span>
                      {p.profile_link && (
                        <a href={p.profile_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-200 transition-colors">
                          View Profile <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div><span className="text-slate-500 block text-xs">Username</span><span className="text-slate-200">{p.username || '-'}</span></div>
                      <div><span className="text-slate-500 block text-xs">Followers</span><span className="text-slate-200">{p.followers_count || '-'}</span></div>
                    </div>
                    {p.video_views && p.video_views.length > 0 ? (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-xs text-slate-400 font-semibold">Previous 15 Videos Views</span>
                           {p.video_views.length > 3 && (
                             <button onClick={() => togglePlatformExpanded(p.platform)} className="text-xs text-blue-400 hover:text-blue-300">
                               {expandedPlatforms[p.platform] ? 'View Less' : 'View More'}
                             </button>
                           )}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {p.video_views.slice(0, expandedPlatforms[p.platform] ? p.video_views.length : 3).map((v, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-700 rounded p-2 text-center">
                               <div className="text-[10px] text-slate-500">Video {idx + 1}</div>
                               <div className="text-xs font-semibold text-slate-200">{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">No video views recorded.</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic">No platform details added.</div>
              )}
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-4">
               {influencer.pricing ? (
                 <>
                   <div className="grid grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                     <div><span className="text-slate-500 block text-xs">Video 1 (DIY)</span><span className="text-slate-200">{influencer.pricing.video1_count || 0}</span></div>
                     <div><span className="text-slate-500 block text-xs">Price</span><span className="text-slate-200">₹{influencer.pricing.video1_price || 0}</span></div>
                     <div><span className="text-slate-500 block text-xs">Video 2 (Sponge)</span><span className="text-slate-200">{influencer.pricing.video2_count || 0}</span></div>
                     <div><span className="text-slate-500 block text-xs">Price</span><span className="text-slate-200">₹{influencer.pricing.video2_price || 0}</span></div>
                     <div className="col-span-2 border-t border-slate-700 mt-2 pt-2 grid grid-cols-2">
                        <div><span className="text-slate-400 block text-xs">Total Videos</span><span className="text-slate-100 font-bold">{influencer.pricing.total_videos || 0}</span></div>
                        <div><span className="text-slate-400 block text-xs">Final Price</span><span className="text-slate-100 font-bold">₹{influencer.pricing.final_price || 0}</span></div>
                     </div>
                   </div>

                   {influencer.pricing.bargainHistory && influencer.pricing.bargainHistory.length > 0 && (
                     <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                       <h5 className="text-xs font-semibold text-slate-400 mb-2">Bargain History</h5>
                       <div className="space-y-2">
                         {influencer.pricing.bargainHistory.map((b, idx) => (
                           <div key={idx} className="flex justify-between items-center text-xs bg-slate-900 p-2 rounded border border-slate-700">
                             <div><span className="text-slate-500">Creator:</span> <span className="text-amber-400">₹{b.creator_request}</span></div>
                             <div><span className="text-slate-500">Brand:</span> <span className="text-emerald-400">₹{b.brand_request}</span></div>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                 </>
               ) : (
                 <div className="text-slate-500 italic">No pricing info added.</div>
               )}
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-4">
              {influencer.products && influencer.products.length > 0 ? (
                // Group by video_number
                Object.entries(influencer.products.reduce((acc, curr) => {
                  if (!acc[curr.video_number]) acc[curr.video_number] = [];
                  acc[curr.video_number].push(curr);
                  return acc;
                }, {} as Record<number, typeof influencer.products>)).map(([vNum, prods]) => (
                  <div key={vNum} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                    <h5 className="text-xs font-semibold text-purple-300 mb-2 border-b border-slate-700 pb-1">Video {vNum} Products</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {prods.map((p, idx) => (
                         <div key={idx} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-700">
                           <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${p.selected ? 'bg-emerald-400' : 'bg-slate-600'}`}></div>
                             <span className={`text-xs ${p.selected ? 'text-slate-200' : 'text-slate-500 line-through'}`}>{p.product_name}</span>
                           </div>
                           <span className="text-xs text-slate-400">Qty: {p.qty}</span>
                         </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic">No products selected.</div>
              )}
            </div>
          )}

          {activeTab === 'performance' && (
             <div className="space-y-4">
               {influencer.performance && influencer.performance.length > 0 ? (
                 influencer.performance.map((perf, idx) => (
                   <div key={idx} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                      <div className="grid grid-cols-2 gap-4 mb-2">
                         <div><span className="text-slate-500 block text-xs">Brand</span><span className="text-slate-200">{perf.brand_name || '-'}</span></div>
                         <div><span className="text-slate-500 block text-xs">Product</span><span className="text-slate-200">{perf.product_name || '-'}</span></div>
                         <div><span className="text-slate-500 block text-xs">Views</span><span className="text-slate-200">{perf.views || '-'}</span></div>
                         <div><span className="text-slate-500 block text-xs">Platforms</span><span className="text-slate-200">{Array.isArray(perf.uploaded_platforms) ? perf.uploaded_platforms.join(', ') : '-'}</span></div>
                      </div>
                      {(perf.instagram_link || perf.youtube_link || perf.facebook_link) && (
                        <div className="pt-2 border-t border-slate-700 mt-2 space-y-1">
                          {perf.instagram_link && <a href={perf.instagram_link} target="_blank" rel="noreferrer" className="block text-xs text-blue-400 hover:underline">Instagram: {perf.instagram_link}</a>}
                          {perf.youtube_link && <a href={perf.youtube_link} target="_blank" rel="noreferrer" className="block text-xs text-red-400 hover:underline">YouTube: {perf.youtube_link}</a>}
                          {perf.facebook_link && <a href={perf.facebook_link} target="_blank" rel="noreferrer" className="block text-xs text-blue-500 hover:underline">Facebook: {perf.facebook_link}</a>}
                        </div>
                      )}
                   </div>
                 ))
               ) : (
                 <div className="text-slate-500 italic">No brand performance records.</div>
               )}
             </div>
          )}
        </div>
     </div>
  );
};

interface CampaignInfluencerListProps {
  campaign: Campaign;
  onBack: () => void;
  onEdit: (influencer: CampaignInfluencer) => void;
  onDispatch?: (influencer: CampaignInfluencer) => void;
}

export const CampaignInfluencerList: React.FC<CampaignInfluencerListProps> = ({ campaign, onBack, onEdit, onDispatch }) => {
  const { influencers, isLoading, refresh, toggleArchiveStatus } = useCampaignInfluencers(campaign.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'active' | 'archived'>('active');

  const filteredInfluencers = useMemo(() => {
    return influencers.filter(inf => {
      const matchStatus = filter === 'active' ? !isArchived(inf.is_archived) : isArchived(inf.is_archived);
      const term = searchTerm.toLowerCase();
      const matchSearch = ((inf.name || '').toLowerCase().includes(term)) ||
                          ((inf.influencer_name || '').toLowerCase().includes(term)) ||
                          ((inf.code || '').toLowerCase().includes(term)) ||
                          ((inf.city || '').toLowerCase().includes(term));
      return matchStatus && matchSearch;
    });
  }, [influencers, searchTerm, filter]);

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-[700px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50 gap-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <UserCheck size={20} className="text-purple-400" />
          Influencer List: {campaign.campaign_name}
        </h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={refresh}
            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCcw size={16} />
          </button>
          <button 
            onClick={onBack}
            className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm"
          >
            Back to Overview
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          <button 
            onClick={() => setFilter('active')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${filter === 'active' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Active
          </button>
          <button 
            onClick={() => setFilter('archived')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${filter === 'archived' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Archived
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <input 
            type="text" 
            placeholder="Search influencers..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-slate-500">
            <RefreshCcw size={24} className="animate-spin mr-2" /> Loading influencers...
          </div>
        ) : filteredInfluencers.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-slate-500 italic">
            <UserCheck size={48} className="mb-4 opacity-50" />
            <p>No influencers found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInfluencers.map(inf => (
              <InfluencerCard 
                key={inf.id} 
                influencer={inf} 
                onEdit={onEdit} 
                onToggleArchive={toggleArchiveStatus} 
                onDispatch={onDispatch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
