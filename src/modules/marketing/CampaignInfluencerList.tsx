import React, { useState, useMemo } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { Search, UserCheck, Archive, RefreshCcw, ArchiveRestore, Edit, Copy, ExternalLink, Trash2, Filter, SlidersHorizontal } from 'lucide-react';
import { useCampaignInfluencers } from '../../hooks/marketing/useCampaignInfluencers';
import { InfluencerActionMenu } from '../../components/marketing/InfluencerActionMenu';
import { isArchived } from '../../utils/marketingUtils';
import toast from 'react-hot-toast';
import { AddCampaignInfluencer, calculateInstagramViewCode, calculateFacebookViewCode, calculateYoutubeViewCode } from './AddCampaignInfluencer';
import { logActivity } from '../../services/activityService';

interface InfluencerFilterState {
  missingPhone: boolean;
  missingAltPhone: boolean;
  missingUpi: boolean;
  missingCity: boolean;
  missingState: boolean;
  missingAddress: boolean;
  missingInfluencerName: boolean;
  missingUserName: boolean;
  missingLanguage: boolean;
  missingProfileImage: boolean;
  platformCombo: 'all' | 'instagram' | 'youtube' | 'facebook' | 'instagram_youtube' | 'instagram_facebook' | 'youtube_facebook' | 'instagram_youtube_facebook' | 'none';
}

const initialFilterState: InfluencerFilterState = {
  missingPhone: false,
  missingAltPhone: false,
  missingUpi: false,
  missingCity: false,
  missingState: false,
  missingAddress: false,
  missingInfluencerName: false,
  missingUserName: false,
  missingLanguage: false,
  missingProfileImage: false,
  platformCombo: 'all'
};

const resolvePerformanceCode = (
  influencer: CampaignInfluencer,
  platformName: string,
  videoViews: number[]
): { code: string; mode: 'auto' | 'manual' } => {
  let mode: 'auto' | 'manual' = 'auto';
  let manualCode: string | null = null;
  
  const platformLower = platformName.toLowerCase();
  if (platformLower === 'instagram') {
    mode = (influencer as any).instagram_view_code_mode || 'auto';
    manualCode = influencer.instagram_view_code || null;
  } else if (platformLower === 'facebook') {
    mode = (influencer as any).facebook_view_code_mode || 'auto';
    manualCode = influencer.facebook_view_code || null;
  } else if (platformLower === 'youtube') {
    mode = (influencer as any).youtube_view_code_mode || 'auto';
    manualCode = influencer.youtube_view_code || null;
  }

  // Calculate auto code
  let autoCode = 'Not Eligible';
  if (platformLower === 'instagram') autoCode = calculateInstagramViewCode(videoViews || []).code;
  else if (platformLower === 'facebook') autoCode = calculateFacebookViewCode(videoViews || []).code;
  else if (platformLower === 'youtube') autoCode = calculateYoutubeViewCode(videoViews || []).code;

  if (mode === 'manual' && manualCode) {
    return { code: manualCode, mode: 'manual' };
  }
  return { code: autoCode === 'Not Eligible' ? '' : autoCode, mode: 'auto' };
};

const InfluencerCard = ({ 
  influencer, 
  onEdit, 
  onToggleArchive,
  onDispatch,
  onDelete
}: { 
  influencer: CampaignInfluencer, 
  onEdit: (inf: CampaignInfluencer) => void,
  onToggleArchive: (id: string, isArchived: boolean) => void,
  onDispatch?: (inf: CampaignInfluencer) => void,
  onDelete: (id: string, name: string) => void
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
            <button onClick={() => onDelete(influencer.id, influencer.influencer_name || influencer.name || '')} className="p-1.5 bg-slate-800 border border-slate-600 rounded text-slate-400 hover:text-red-550 transition-colors" title="Delete Permanently"><Trash2 size={14} /></button>
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
              onDelete={() => onDelete(influencer.id, influencer.influencer_name || influencer.name || '')}
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
            <p className="text-slate-400 text-xs flex flex-wrap items-center gap-1.5 mt-0.5">
              @{influencer.name} &bull; 
              <span className="bg-purple-950/40 text-purple-300 font-bold border border-purple-800/20 px-1.5 py-0.5 rounded text-[10px] font-mono select-none" title="Influencer Code">
                {influencer.code || 'No Code'}
              </span>
            </p>
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
          {activeTab === 'basic' && (() => {
            const getDisplayViewCode = (platformName: string): string => {
              const plat = (influencer.platforms || []).find(
                p => p.platform.toLowerCase() === platformName.toLowerCase()
              );
              const resolved = resolvePerformanceCode(
                influencer, 
                platformName, 
                plat?.video_views || []
              );
              return resolved.code || '—';
            };

            const displayInsta = getDisplayViewCode('Instagram');
            const displayFb = getDisplayViewCode('Facebook');
            const displayYt = getDisplayViewCode('Youtube');
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm text-slate-200">
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">Influencer Name</span>
                  <span className="text-slate-200 font-medium break-words">{influencer.influencer_name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">Influencer Code</span>
                  <span className="text-purple-400 font-bold font-mono break-all">{influencer.code || '—'}</span>
                </div>
                <div className="col-span-1 sm:col-span-2 md:col-span-2"></div>

                {/* View Codes Row */}
                <div className="col-span-1 sm:col-span-2 md:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 my-1">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">Instagram</span>
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border inline-block ${
                      displayInsta && displayInsta !== '—'
                        ? 'bg-purple-900/30 text-purple-400 border-purple-800/30'
                        : 'bg-slate-900/40 text-slate-500 border-slate-800/30'
                    }`}>
                      {displayInsta}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">Facebook</span>
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border inline-block ${
                      displayFb && displayFb !== '—'
                        ? 'bg-purple-900/30 text-purple-400 border-purple-800/30'
                        : 'bg-slate-900/40 text-slate-500 border-slate-800/30'
                    }`}>
                      {displayFb}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">YouTube</span>
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border inline-block ${
                      displayYt && displayYt !== '—'
                        ? 'bg-purple-900/30 text-purple-400 border-purple-800/30'
                        : 'bg-slate-900/40 text-slate-500 border-slate-800/30'
                    }`}>
                      {displayYt}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">Phone</span>
                  <span className="text-slate-200 font-medium break-all">{influencer.phone_number || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">Alt Phone</span>
                  <span className="text-slate-200 font-medium break-all">{influencer.alternative_number || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">UPI</span>
                  <span className="text-slate-200 font-medium break-all">{influencer.upi_number || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">User Name</span>
                  <span className="text-slate-200 font-medium break-words">{influencer.name || '—'}</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">City</span>
                  <span className="text-slate-200 font-medium break-words">{influencer.city || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">State</span>
                  <span className="text-slate-200 font-medium break-words">{influencer.state || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">Auto DM Tool</span>
                  <span className="text-slate-200 font-medium">{influencer.auto_dm ? 'Yes' : 'No'}</span>
                </div>
                <div></div>

                <div className="col-span-1 sm:col-span-2 md:col-span-4">
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">Languages</span>
                  <span className="text-slate-200 font-medium break-words">
                    {Array.isArray(influencer.languages) && influencer.languages.length > 0 
                      ? influencer.languages.join(', ') 
                      : '—'}
                  </span>
                </div>
                
                <div className="col-span-1 sm:col-span-2 md:col-span-4">
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-0.5">Address</span>
                  <span className="text-slate-200 font-medium break-words">{influencer.complete_address || '—'}</span>
                </div>
              </div>
            );
          })()}

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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div><span className="text-slate-500 block text-xs">Username</span><span className="text-slate-200">{p.username || '-'}</span></div>
                      <div><span className="text-slate-500 block text-xs">Followers</span><span className="text-slate-200">{p.followers_count || '-'}</span></div>
                      {(p.platform === 'Instagram' || p.platform === 'Facebook' || p.platform === 'Youtube') && (
                        <div>
                          <span className="text-slate-500 block text-xs">Performance Code</span>
                          <span className="inline-block bg-purple-950/40 text-purple-300 font-bold border border-purple-800/20 px-2 py-0.5 rounded text-xs font-mono select-all mt-0.5">
                            {resolvePerformanceCode(influencer, p.platform, p.video_views).code || '—'}
                          </span>
                        </div>
                      )}
                    </div>
                    {p.video_views && p.video_views.some(v => v !== null && v !== undefined && (v as any) !== '') ? (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-xs text-slate-400 font-semibold">Previous 15 Videos Views</span>
                           {p.video_views && p.video_views.slice(3).some(v => v !== null && v !== undefined && (v as any) !== '') && (
                             <button onClick={() => togglePlatformExpanded(p.platform)} className="text-xs text-blue-400 hover:text-blue-300">
                               {expandedPlatforms[p.platform] ? 'View Less' : 'View More'}
                             </button>
                           )}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {p.video_views.slice(0, expandedPlatforms[p.platform] ? p.video_views.length : 3).map((v, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-700 rounded p-2 text-center flex flex-col justify-between">
                              <div>
                                <div className="text-[10px] text-slate-500">Video {idx + 1}</div>
                                <div className="text-xs font-semibold text-slate-200">{v !== null && v !== undefined && (v as any) !== '' ? v : '—'}</div>
                              </div>
                              {p.platform === 'Instagram' && p.video_views_dates?.[idx] && (
                                <div className="text-[9px] text-slate-500 mt-1 select-none font-medium truncate" title={p.video_views_dates[idx]}>
                                  {p.video_views_dates[idx]}
                                </div>
                              )}
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
                      {Array.isArray(influencer.pricing.product_pricing?.videos) ? (
                        influencer.pricing.product_pricing.videos.map((v: any, idx: number) => {
                          const comb = (v && typeof v === 'object') ? v.combination : '';
                          const amount = (v && typeof v === 'object') ? (v.amount || 0) : (Number(v) || 0);
                          return (
                            <React.Fragment key={idx}>
                              <div className="col-span-2">
                                <span className="text-slate-500 block text-xs">Video {idx + 1}</span>
                                <span className="text-slate-200">
                                  {comb ? `${comb} — ` : ''}₹{(amount ?? 0).toLocaleString()}
                                </span>
                              </div>
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <>
                          <div><span className="text-slate-500 block text-xs">Video 1 (DIY)</span><span className="text-slate-200">{influencer?.pricing?.video1_count || 0}</span></div>
                          <div><span className="text-slate-500 block text-xs">Price</span><span className="text-slate-200">₹{(Number(influencer?.pricing?.video1_price) || 0).toLocaleString()}</span></div>
                          <div><span className="text-slate-500 block text-xs">Video 2 (Sponge)</span><span className="text-slate-200">{influencer?.pricing?.video2_count || 0}</span></div>
                          <div><span className="text-slate-500 block text-xs">Price</span><span className="text-slate-200">₹{(Number(influencer?.pricing?.video2_price) || 0).toLocaleString()}</span></div>
                          {influencer?.pricing?.product_pricing && Object.entries(influencer.pricing.product_pricing).map(([prodName, pVal]: [string, any]) => (
                            pVal && pVal.qty > 0 && prodName !== 'videos' ? (
                              <React.Fragment key={prodName}>
                                <div><span className="text-slate-500 block text-xs">{prodName}</span><span className="text-slate-200">{pVal.qty || 0}</span></div>
                                <div><span className="text-slate-500 block text-xs">Price</span><span className="text-slate-200">₹{(pVal.price || 0).toLocaleString()}</span></div>
                              </React.Fragment>
                            ) : null
                          ))}
                        </>
                      )}
                     <div className="col-span-2 border-t border-slate-700 mt-2 pt-2 grid grid-cols-2">
                        <div><span className="text-slate-400 block text-xs">Total Videos</span><span className="text-slate-100 font-bold">{influencer?.pricing?.total_videos || 0}</span></div>
                        <div><span className="text-slate-400 block text-xs">Final Price</span><span className="text-slate-100 font-bold">₹{(influencer?.pricing?.final_price || 0).toLocaleString()}</span></div>
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
               {(() => {
                 const bp = influencer.brandPerformance || influencer.performance;
                 return bp && bp.length > 0 ? (
                   bp.map((perf: any, idx: number) => (
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
                );
               })()}
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
  editingInfluencerId?: string | null;
  onCancelEdit?: () => void;
}

export const CampaignInfluencerList: React.FC<CampaignInfluencerListProps> = ({ 
  campaign, 
  onBack, 
  onEdit, 
  onDispatch,
  editingInfluencerId,
  onCancelEdit
}) => {
  const { influencers, isLoading, refresh, toggleArchiveStatus, deleteInfluencer } = useCampaignInfluencers(campaign.id);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete influencer "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteInfluencer(id);
      toast.success(`Influencer "${name}" deleted permanently.`);
    } catch (err) {
      console.error('Failed to delete influencer:', err);
      toast.error('Failed to delete influencer.');
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'active' | 'archived'>('active');
  const [filterState, setFilterState] = useState<InfluencerFilterState>(initialFilterState);
  const [tempFilterState, setTempFilterState] = useState<InfluencerFilterState>(initialFilterState);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const isEmptyValue = (val: any): boolean => {
    if (val === undefined || val === null) return true;
    if (typeof val === 'string') return val.trim() === '';
    if (Array.isArray(val)) return val.length === 0;
    return false;
  };

  const matchesFilters = (influencer: CampaignInfluencer): boolean => {
    if (filterState.missingPhone && !isEmptyValue(influencer.phone_number)) return false;
    if (filterState.missingAltPhone && !isEmptyValue(influencer.alternative_number)) return false;
    if (filterState.missingUpi && !isEmptyValue(influencer.upi_number)) return false;
    if (filterState.missingCity && !isEmptyValue(influencer.city)) return false;
    if (filterState.missingState && !isEmptyValue(influencer.state)) return false;
    if (filterState.missingAddress && !isEmptyValue(influencer.complete_address)) return false;
    if (filterState.missingInfluencerName && !isEmptyValue(influencer.name)) return false;
    if (filterState.missingUserName && !isEmptyValue(influencer.influencer_name)) return false;
    if (filterState.missingLanguage && !isEmptyValue(influencer.languages)) return false;
    if (filterState.missingProfileImage && !isEmptyValue(influencer.profile_file_url)) return false;

    const influencerPlatforms = (influencer.platforms || []).map(p => p.platform.toLowerCase());
    const hasInstagram = influencerPlatforms.includes('instagram');
    const hasFacebook = influencerPlatforms.includes('facebook');
    const hasYoutube = influencerPlatforms.includes('youtube');

    if (filterState.platformCombo !== 'all') {
      switch (filterState.platformCombo) {
        case 'instagram':
          if (!(hasInstagram && !hasFacebook && !hasYoutube)) return false;
          break;
        case 'youtube':
          if (!(hasYoutube && !hasInstagram && !hasFacebook)) return false;
          break;
        case 'facebook':
          if (!(hasFacebook && !hasInstagram && !hasYoutube)) return false;
          break;
        case 'instagram_youtube':
          if (!(hasInstagram && hasYoutube && !hasFacebook)) return false;
          break;
        case 'instagram_facebook':
          if (!(hasInstagram && hasFacebook && !hasYoutube)) return false;
          break;
        case 'youtube_facebook':
          if (!(hasYoutube && hasFacebook && !hasInstagram)) return false;
          break;
        case 'instagram_youtube_facebook':
          if (!(hasInstagram && hasYoutube && hasFacebook)) return false;
          break;
        case 'none':
          if (hasInstagram || hasFacebook || hasYoutube) return false;
          break;
        default:
          break;
      }
    }

    return true;
  };

  const handleOpenFilter = () => {
    setTempFilterState(filterState);
    setIsFilterOpen(!isFilterOpen);
  };

  const handleApplyFilter = () => {
    setFilterState(tempFilterState);
    setIsFilterOpen(false);
    logActivity('Marketing', 'Influencer Filter Updated', 'Updated the Influencer List filter options.');
  };

  const handleClearFilter = () => {
    setFilterState(initialFilterState);
    setTempFilterState(initialFilterState);
    setIsFilterOpen(false);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterState.missingPhone) count++;
    if (filterState.missingAltPhone) count++;
    if (filterState.missingUpi) count++;
    if (filterState.missingCity) count++;
    if (filterState.missingState) count++;
    if (filterState.missingAddress) count++;
    if (filterState.missingInfluencerName) count++;
    if (filterState.missingUserName) count++;
    if (filterState.missingLanguage) count++;
    if (filterState.missingProfileImage) count++;
    if (filterState.platformCombo !== 'all') count++;
    return count;
  }, [filterState]);

  const isFilterApplied = activeFilterCount > 0;

  const editingInfluencer = useMemo(() => {
    if (!editingInfluencerId) return null;
    return influencers.find(inf => String(inf.id) === String(editingInfluencerId)) || null;
  }, [influencers, editingInfluencerId]);

  React.useEffect(() => {
    if (editingInfluencerId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [editingInfluencerId]);

  const filteredInfluencers = useMemo(() => {
    let list = influencers.filter(inf => {
      const matchStatus = filter === 'active' ? !isArchived(inf.is_archived) : isArchived(inf.is_archived);
      return matchStatus;
    });

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(inf => 
        (inf.name || '').toLowerCase().includes(term) ||
        (inf.influencer_name || '').toLowerCase().includes(term) ||
        (inf.code || '').toLowerCase().includes(term) ||
        (inf.phone_number || '').toLowerCase().includes(term) ||
        (inf.city || '').toLowerCase().includes(term) ||
        (inf.state || '').toLowerCase().includes(term)
      );
    }

    return list.filter(matchesFilters);
  }, [influencers, searchTerm, filter, filterState]);

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

        <div className="flex gap-2 w-full sm:w-auto">
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
          <button
            onClick={handleOpenFilter}
            className={`flex items-center gap-1.5 px-3 py-2 bg-slate-900 border ${isFilterApplied ? 'border-purple-500 text-purple-400 font-medium' : 'border-slate-700 text-slate-300'} hover:bg-slate-800 rounded-lg text-sm transition-colors focus:outline-none`}
          >
            <span>{isFilterApplied ? 'Filter' : '🔽 Filter'}</span>
            {activeFilterCount > 0 && (
              <span className="bg-purple-600 text-slate-100 text-[10px] font-bold rounded-full px-1.5 py-0.5 flex items-center justify-center select-none font-sans">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {isFilterOpen && (
        <div className="p-5 bg-slate-900/95 border-b border-slate-700 shadow-xl animate-fade-in relative z-20">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal size={18} className="text-purple-400" />
                <div>
                  <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Filter Influencers</h4>
                  <p className="text-[11px] text-slate-500">Refine your influencer list</p>
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearFilter}
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors focus:outline-none"
                >
                  <span>{activeFilterCount} Active</span>
                  <span className="text-lg leading-none font-light">&times;</span>
                </button>
              )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Basic Information */}
              <div>
                <div className="mb-3">
                  <span className="block text-xs font-semibold text-purple-300 uppercase tracking-wider">Basic Information</span>
                  <span className="block text-[10px] text-slate-500">Find influencers with missing details</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const basicInfoFields = [
                      { key: 'missingPhone', label: 'Phone Number' },
                      { key: 'missingAddress', label: 'Address' },
                      { key: 'missingCity', label: 'City' },
                      { key: 'missingState', label: 'State' },
                      { key: 'missingUpi', label: 'UPI' },
                      { key: 'missingLanguage', label: 'Language' },
                      { key: 'missingInfluencerName', label: 'Influencer Name' },
                      { key: 'missingUserName', label: 'User Name' },
                      { key: 'missingProfileImage', label: 'Profile Image' },
                    ] as const;

                    return basicInfoFields.map((f, idx) => {
                      const isChecked = tempFilterState[f.key];
                      const isLast = idx === basicInfoFields.length - 1;
                      return (
                        <label
                          key={f.key}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all select-none ${isLast ? 'col-span-2' : ''} ${
                            isChecked
                              ? 'bg-purple-950/20 border-purple-500 text-slate-100 shadow-[0_0_12px_rgba(147,51,234,0.08)]'
                              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => setTempFilterState(prev => ({ ...prev, [f.key]: e.target.checked }))}
                            className="rounded border-slate-700 bg-slate-950 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 w-3.5 h-3.5"
                          />
                          <span className="text-[11px] font-medium truncate">{f.label}</span>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Right Column: Platform Combination */}
              <div>
                <div className="mb-3">
                  <span className="block text-xs font-semibold text-purple-300 uppercase tracking-wider">Platform Combination</span>
                  <span className="block text-[10px] text-slate-500">Choose creator platform setup</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(() => {
                    const platformOptions = [
                      { value: 'all', label: 'All Platforms', icons: [] },
                      { value: 'instagram', label: 'Instagram Only', icons: [<svg key="ig" className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>] },
                      { value: 'youtube', label: 'YouTube Only', icons: [<svg key="yt" className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>] },
                      { value: 'facebook', label: 'Facebook Only', icons: [<svg key="fb" className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>] },
                      { value: 'instagram_youtube', label: 'Instagram + YouTube', icons: [<svg key="ig" className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>, <svg key="yt" className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>] },
                      { value: 'instagram_facebook', label: 'Instagram + Facebook', icons: [<svg key="ig" className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>, <svg key="fb" className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>] },
                      { value: 'youtube_facebook', label: 'YouTube + Facebook', icons: [<svg key="yt" className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>, <svg key="fb" className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>] },
                      { value: 'instagram_youtube_facebook', label: 'Instagram + YouTube + FB', icons: [<svg key="ig" className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>, <svg key="yt" className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>, <svg key="fb" className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>] },
                      { value: 'none', label: 'No Platform', icons: [] }
                    ] as const;

                    return platformOptions.map((opt, idx) => {
                      const isSelected = tempFilterState.platformCombo === opt.value;
                      const isLast = idx === platformOptions.length - 1;
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all select-none ${isLast ? 'sm:col-span-2' : ''} ${
                            isSelected
                              ? 'bg-purple-950/20 border-purple-500 text-slate-100 shadow-[0_0_12px_rgba(147,51,234,0.08)]'
                              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="platformCombo"
                              value={opt.value}
                              checked={isSelected}
                              onChange={() => setTempFilterState(prev => ({ ...prev, platformCombo: opt.value }))}
                              className="border-slate-700 bg-slate-950 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 w-3.5 h-3.5"
                            />
                            <span className="text-[11px] font-medium">{opt.label}</span>
                          </div>
                          {opt.icons.length > 0 && (
                            <div className="flex items-center gap-1.5 opacity-80 select-none">
                              {opt.icons}
                            </div>
                          )}
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Active Filters Summary Strip */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 my-4">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2 select-none">Active Filters</span>
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const summaryChips: string[] = [];
                  if (tempFilterState.missingPhone) summaryChips.push('Missing Phone');
                  if (tempFilterState.missingAddress) summaryChips.push('Missing Address');
                  if (tempFilterState.missingCity) summaryChips.push('Missing City');
                  if (tempFilterState.missingState) summaryChips.push('Missing State');
                  if (tempFilterState.missingUpi) summaryChips.push('Missing UPI');
                  if (tempFilterState.missingLanguage) summaryChips.push('Missing Language');
                  if (tempFilterState.missingInfluencerName) summaryChips.push('Missing Name');
                  if (tempFilterState.missingUserName) summaryChips.push('Missing Username');
                  if (tempFilterState.missingProfileImage) summaryChips.push('Missing Profile Image');
                  
                  if (tempFilterState.platformCombo !== 'all') {
                    const labelMap: Record<string, string> = {
                      instagram: 'Instagram Only',
                      youtube: 'YouTube Only',
                      facebook: 'Facebook Only',
                      instagram_youtube: 'Instagram + YouTube',
                      instagram_facebook: 'Instagram + Facebook',
                      youtube_facebook: 'YouTube + Facebook',
                      instagram_youtube_facebook: 'Instagram + YouTube + FB',
                      none: 'No Platform'
                    };
                    summaryChips.push(labelMap[tempFilterState.platformCombo] || tempFilterState.platformCombo);
                  }

                  if (summaryChips.length === 0) {
                    return <span className="text-xs text-slate-500 italic select-none">No filters selected</span>;
                  }

                  return summaryChips.map((chip, idx) => (
                    <span key={idx} className="inline-flex items-center bg-purple-950/40 text-purple-300 border border-purple-800/30 px-2 py-0.5 rounded text-[10px] font-medium font-mono select-none">
                      {chip}
                    </span>
                  ));
                })()}
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleClearFilter}
                className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
              >
                Clear all
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-700/60 text-slate-300 text-xs font-semibold rounded-lg transition-colors focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilter}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-slate-100 text-xs font-semibold rounded-lg transition-colors focus:outline-none shadow-md"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {editingInfluencer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-hidden">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <AddCampaignInfluencer 
                campaign={campaign} 
                initialData={editingInfluencer} 
                onBack={async () => {
                  await refresh();
                  if (onCancelEdit) {
                    onCancelEdit();
                  }
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
