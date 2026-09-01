import React, { useState, useEffect, useMemo } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { Search, UserCheck, Archive, RefreshCcw, ArchiveRestore, Edit, Copy, ExternalLink, Trash2, Filter, SlidersHorizontal, Upload, Users, BarChart2 } from 'lucide-react';
import { useCampaignInfluencers, compareInfluencerCodesAsc, notifyInfluencerChange } from '../../hooks/marketing/useCampaignInfluencers';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { UploadPlatformDetailsModal } from '../../components/marketing/UploadPlatformDetailsModal';
import { ImportPricingInfoModal } from '../../components/marketing/ImportPricingInfoModal';
import { ImportPostDateModal } from '../../components/marketing/ImportPostDateModal';
import { InfluencerActionMenu } from '../../components/marketing/InfluencerActionMenu';
import { isArchived, isOtherStatus, isActiveStatus, InfluencerStatusType } from '../../utils/marketingUtils';
import toast from 'react-hot-toast';
import { AddCampaignInfluencer, calculateInstagramViewCode, calculateFacebookViewCode, calculateYoutubeViewCode, formatDisplayDate, parseProductsFromCombination, formatDisplayProductName, formatDisplayCombination } from './AddCampaignInfluencer';
import { logActivity } from '../../services/activityService';
import { BulkInfluencerImportModal } from '../../components/marketing/BulkInfluencerImportModal';
import { InfluencerFilterDrawer, InfluencerFilterState, initialFilterState, FOLLOWER_RANGES, normalizeStateName } from '../../components/marketing/InfluencerFilterDrawer';
import { CampaignInfluencerAnalytics } from './CampaignInfluencerAnalytics';
import { CampaignInfluencerAnalyticsFilterDrawer, CampaignAnalyticsFilterState, initialAnalyticsFilterState } from '../../components/marketing/CampaignInfluencerAnalyticsFilterDrawer';

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
  activeTab: parentActiveTab = 'basic',
  currentSection = 'active',
  onTabChange,
  onEdit, 
  onMoveStatus,
  onToggleArchive,
  onDispatch,
  onDelete,
  onDeletePlatformViews,
  onUploadPlatformDetails
}: { 
  influencer: CampaignInfluencer, 
  activeTab?: 'basic' | 'platform' | 'pricing' | 'products' | 'performance' | 'postdate',
  currentSection?: 'active' | 'other' | 'recycle_bin',
  onTabChange?: (tab: 'basic' | 'platform' | 'pricing' | 'products' | 'performance' | 'postdate') => void,
  onEdit?: (inf: CampaignInfluencer) => void,
  onMoveStatus?: (targetStatus: 'active' | 'other' | 'recycle_bin') => void,
  onToggleArchive?: (id: string, isArchived: boolean) => void,
  onDispatch?: (inf: CampaignInfluencer) => void,
  onDelete?: (id: string, name: string) => void,
  onDeletePlatformViews?: (inf: CampaignInfluencer, platformName: string) => void,
  onUploadPlatformDetails?: (code?: string) => void
}) => {
  const [localActiveTab, setLocalActiveTab] = useState<'basic' | 'platform' | 'pricing' | 'products' | 'performance' | 'postdate'>(parentActiveTab);

  useEffect(() => {
    if (parentActiveTab) {
      setLocalActiveTab(parentActiveTab);
    }
  }, [parentActiveTab]);

  const activeTab = localActiveTab || parentActiveTab || 'basic';
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

  const archived = isArchived(influencer.is_archived);

  return (
     <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl hover:border-slate-600 transition-colors relative mb-6">
        {/* Header Layout */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/60 min-w-0">
          {/* Left Profile Section */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center text-white font-bold text-base border-2 border-purple-500/30 shrink-0 shadow-sm">
              {influencer.profile_file_url ? (
                <img src={influencer.profile_file_url} alt={influencer.name} className="w-full h-full object-cover" />
              ) : (
                (influencer.influencer_name || influencer.name || 'A').charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
              <h3 
                className="font-bold text-slate-100 text-sm sm:text-base truncate max-w-[150px] sm:max-w-[200px] md:max-w-[240px] hover:text-purple-300 transition-colors"
                title={`@${influencer.name || influencer.influencer_name}`}
              >
                @{influencer.name || influencer.influencer_name}
              </h3>
              {influencer.code && (
                <span className="px-2 py-0.5 bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-bold font-mono rounded shrink-0 shadow-sm">
                  {influencer.code}
                </span>
              )}
              {currentSection === 'active' && (
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 inline-block ml-0.5" title="Active"></span>
              )}
              {currentSection === 'other' && (
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shrink-0 inline-block ml-0.5" title="Other"></span>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {onDispatch && (
              influencer.dispatchDetails ? (
                <span 
                  className="px-2.5 py-1 text-xs font-semibold rounded-md pointer-events-none shrink-0 bg-emerald-950/50 text-emerald-400 border border-emerald-800/40"
                >
                  Dispatched
                </span>
              ) : (
                <button 
                  type="button"
                  onClick={() => onDispatch(influencer)} 
                  className="px-3 py-1 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors shrink-0 shadow-sm cursor-pointer"
                >
                  Dispatch
                </button>
              )
            )}
            
            <InfluencerActionMenu
              currentSection={currentSection}
              onEdit={() => onEdit?.(influencer)}
              onMoveStatus={onMoveStatus}
              onDelete={currentSection === 'recycle_bin' && onDelete ? () => onDelete(influencer.id, influencer.influencer_name || influencer.name || '') : undefined}
            />
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-800 pb-2">
          {[
            { id: 'basic', label: 'Basic Info' },
            { id: 'platform', label: 'Platform Details' },
            { id: 'pricing', label: 'Pricing Info' },
            { id: 'products', label: 'Products' },
            { id: 'performance', label: 'Brand Performance' },
            { id: 'postdate', label: 'Post Date' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLocalActiveTab(tab.id as any);
                if (onTabChange) {
                  onTabChange(tab.id as any);
                }
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
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
                      <div className="flex items-center gap-2">
                        {p.profile_link && (
                          <a href={p.profile_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-200 transition-colors">
                            View Profile <ExternalLink size={12} />
                          </a>
                        )}
                        {onDeletePlatformViews && (
                          <button
                            type="button"
                            onClick={() => onDeletePlatformViews(influencer, p.platform)}
                            className="p-1.5 bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-slate-700 hover:border-red-800/40 cursor-pointer"
                            title={`Delete ${p.platform} Views & Details`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div><span className="text-slate-500 block text-xs">Username</span><span className="text-slate-200">{p.username || influencer.influencer_name || influencer.name || '-'}</span></div>
                      <div><span className="text-slate-500 block text-xs">Followers</span><span className="text-slate-200">{p.followers_count ? Number(p.followers_count).toLocaleString() : '-'}</span></div>
                      {(['instagram', 'facebook', 'youtube'].includes((p.platform || '').toLowerCase())) && (
                        <div>
                          <span className="text-slate-500 block text-xs">Creator Category</span>
                          <span className="inline-block bg-purple-950/40 text-purple-300 font-bold border border-purple-800/20 px-2 py-0.5 rounded text-xs font-mono select-all mt-0.5">
                            {p.performance_code || resolvePerformanceCode(influencer, p.platform, p.video_views).code || '—'}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500 block text-xs">Average</span>
                        <span className="text-slate-200 font-semibold">
                          {(p as any).average !== undefined && (p as any).average !== null && (p as any).average !== ''
                            ? (isNaN(Number((p as any).average)) ? (p as any).average : Number((p as any).average).toLocaleString())
                            : '—'}
                        </span>
                      </div>
                    </div>
                    {p.video_views && p.video_views.length > 0 ? (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-xs text-slate-400 font-semibold">Previous 15 Videos Views</span>
                           {p.video_views.length > 3 && (
                             <button onClick={() => togglePlatformExpanded(p.platform)} className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                               {expandedPlatforms[p.platform] ? 'View Less' : 'View More'}
                             </button>
                           )}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {p.video_views.slice(0, expandedPlatforms[p.platform] ? p.video_views.length : 3).map((v, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-700 rounded p-2 text-center flex flex-col justify-between">
                              <div>
                                <div className="text-[10px] text-slate-500">Video {idx + 1}</div>
                                <div className="text-xs font-semibold text-slate-200">
                                  {v !== null && v !== undefined && (v as any) !== '' ? (isNaN(Number(v)) ? String(v) : Number(v).toLocaleString()) : '0'}
                                </div>
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
                          const rawComb = (v && typeof v === 'object') ? v.combination : '';
                          const comb = formatDisplayCombination(rawComb);
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

          {activeTab === 'products' && (() => {
            const explicitProducts = Array.isArray(influencer.products) ? influencer.products : [];
            const pricingVideos = Array.isArray(influencer.pricing?.product_pricing?.videos) 
              ? influencer.pricing.product_pricing.videos.filter((v: any) => v && (v.combination || v.name))
              : [];

            if (explicitProducts.length > 0) {
              return (
                <div className="space-y-4">
                  {Object.entries(explicitProducts.reduce((acc, curr) => {
                    const vNum = curr.video_number || 1;
                    if (!acc[vNum]) acc[vNum] = [];
                    acc[vNum].push(curr);
                    return acc;
                  }, {} as Record<number, any[]>)).map(([vNum, prods]) => (
                    <div key={vNum} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                      <h5 className="text-xs font-semibold text-purple-300 mb-2 border-b border-slate-700 pb-1">Video {vNum} Products</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(prods || []).map((p: any, idx: number) => (
                           <div key={idx} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-700">
                             <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${p.selected ? 'bg-emerald-400' : 'bg-slate-600'}`}></div>
                               <span className={`text-xs ${p.selected ? 'text-slate-200' : 'text-slate-500 line-through'}`}>{formatDisplayProductName(p.product_name)}</span>
                             </div>
                             <span className="text-xs text-slate-400">Qty: {p.qty}</span>
                           </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            if (pricingVideos.length > 0) {
              return (
                <div className="space-y-4">
                  {pricingVideos.map((v: any, idx: number) => {
                    const rawCombName = v.combination || v.name || `Video ${idx + 1}`;
                    const combName = formatDisplayCombination(rawCombName);
                    const explicitProds = Array.isArray(v.products) && v.products.length > 0 ? v.products : [];
                    const parsedProdNames = parseProductsFromCombination(rawCombName);
                    const amt = v.amount !== undefined && v.amount !== null ? Number(v.amount) : 0;

                    const displayProducts = explicitProds.length > 0 
                      ? explicitProds.map((p: any) => ({ name: formatDisplayProductName(p.product_name || p.name), qty: p.qty || 1 }))
                      : parsedProdNames.map(pName => ({ name: formatDisplayProductName(pName), qty: 1 }));

                    return (
                      <div key={idx} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                        <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-1">
                          <h5 className="text-xs font-semibold text-purple-300">
                            Video {idx + 1} ({combName})
                          </h5>
                          {amt > 0 && (
                            <span className="text-xs font-mono font-bold text-purple-300">
                              ₹{amt.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {displayProducts.map((p: any, pIdx: number) => (
                            <div key={pIdx} className="flex justify-between items-center bg-slate-900 p-2.5 rounded border border-slate-700">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                <span className="text-xs text-slate-200 font-medium">{formatDisplayProductName(p.name)}</span>
                              </div>
                              <span className="text-xs text-slate-400">Qty: {p.qty}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            return <div className="text-slate-500 italic">No products selected.</div>;
          })()}

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

          {activeTab === 'postdate' && (() => {
            const dates = (influencer.postDates || []).slice().sort((a, b) => (a.video_number || 0) - (b.video_number || 0));
            if (dates.length === 0) {
              return (
                <div className="text-slate-400 py-3 text-sm italic">
                  No post dates scheduled.
                </div>
              );
            }

            return (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">POST DATE SCHEDULE</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {dates.map((d, i) => (
                    <div key={d.id || d.video_number || i} className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 bg-purple-950/60 border border-purple-800/40 text-purple-300 text-[11px] font-bold rounded">
                          VIDEO {d.video_number}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Post Date:</span>
                          <span className="text-slate-200 font-medium font-mono">{formatDisplayDate(d.post_date)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Draft Date:</span>
                          <span className="text-purple-300 font-medium font-mono">{formatDisplayDate(d.draft_date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
     </div>
  );
};

export const getSingleVideoPrices = (influencer: CampaignInfluencer): number[] => {
  const prices: number[] = [];
  const p = influencer.pricing;
  if (!p) return [];

  // 1. Check videos array in product_pricing
  if (Array.isArray(p.product_pricing?.videos) && p.product_pricing.videos.length > 0) {
    p.product_pricing.videos.forEach((v: any) => {
      const amt = (v && typeof v === 'object') ? (v.amount !== undefined && v.amount !== null ? Number(v.amount) : 0) : (Number(v) || 0);
      if (!isNaN(amt) && amt > 0) {
        prices.push(amt);
      }
    });
  }

  // 2. Check legacy video1_price & video2_price & product_pricing map
  if (prices.length === 0) {
    if (p.video1_price) {
      const v1 = Number(p.video1_price);
      if (!isNaN(v1) && v1 > 0) prices.push(v1);
    }
    if (p.video2_price) {
      const v2 = Number(p.video2_price);
      if (!isNaN(v2) && v2 > 0) prices.push(v2);
    }
    if (p.product_pricing && typeof p.product_pricing === 'object') {
      Object.entries(p.product_pricing).forEach(([key, val]: [string, any]) => {
        if (key !== 'videos' && val && typeof val === 'object' && val.price) {
          const amt = Number(val.price);
          if (!isNaN(amt) && amt > 0) prices.push(amt);
        }
      }
      );
    }
  }

  // 3. Fallback: if no individual video breakdown exists, fallback to final_price / commercial_quote
  if (prices.length === 0) {
    const finalP = Number(p.final_price || (p as any)?.commercial_quote || 0);
    if (!isNaN(finalP) && finalP > 0) {
      prices.push(finalP);
    }
  }

  return prices;
};

interface CampaignInfluencerListProps {
  campaign: Campaign;
  onBack: () => void;
  onEdit: (inf: CampaignInfluencer) => void;
  onDispatch?: (inf: CampaignInfluencer) => void;
  onAddInfluencer?: () => void;
  editingInfluencerId?: string | null;
  onCancelEdit?: () => void;
}

export const CampaignInfluencerList: React.FC<CampaignInfluencerListProps> = ({ 
  campaign, 
  onBack, 
  onEdit, 
  onDispatch,
  onAddInfluencer,
  editingInfluencerId,
  onCancelEdit
}) => {
  const { influencers, isLoading, refresh, updateInfluencerStatus, toggleArchiveStatus, deleteInfluencer } = useCampaignInfluencers(campaign.id);

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

  const handleDeletePlatformViews = async (influencer: CampaignInfluencer, platformName: string) => {
    const confirmMsg = `Are you sure you want to delete ${platformName} video views and details for influencer "${influencer.influencer_name || influencer.name}"? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const numericId = typeof influencer.id === 'number' ? influencer.id : parseInt(String(influencer.id), 10);

      if (!isNaN(numericId)) {
        await supabase
          .from(SUPABASE_TABLES.influencerPlatform)
          .delete()
          .eq('influencer_id', numericId)
          .ilike('platform', platformName);

        const { data: freshInf } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .select('languages')
          .eq('id', numericId)
          .maybeSingle();

        if (freshInf) {
          const currentLangs = Array.isArray(freshInf.languages) ? freshInf.languages : [];
          let viewsDataObj: any = { platform_views: {}, post_dates: [] };
          const existingViewsData = currentLangs.find((l: any) => typeof l === 'string' && l.startsWith('views_data:'));
          if (existingViewsData) {
            try {
              viewsDataObj = JSON.parse(existingViewsData.substring('views_data:'.length));
            } catch (e) {}
          }
          if (viewsDataObj.platform_views) {
            const matchingKey = Object.keys(viewsDataObj.platform_views).find(
              k => k.toLowerCase() === platformName.toLowerCase()
            );
            if (matchingKey) {
              delete viewsDataObj.platform_views[matchingKey];
            }
          }

          const updatedLangs = currentLangs.filter((l: any) => typeof l !== 'string' || !l.startsWith('views_data:'));
          updatedLangs.push(`views_data:${JSON.stringify(viewsDataObj)}`);

          await supabase
            .from(SUPABASE_TABLES.influencersInfo)
            .update({ languages: updatedLangs })
            .eq('id', numericId);
        }
      }

      toast.success(`${platformName} views deleted successfully.`);
      notifyInfluencerChange(campaign.id);
      refresh();
    } catch (err: any) {
      console.error(`Failed to delete ${platformName} views:`, err);
      toast.error(`Failed to delete ${platformName} views: ${err?.message || String(err)}`);
    }
  };

  const [cardActiveTabs, setCardActiveTabs] = useState<Record<string, 'basic' | 'platform' | 'pricing' | 'products' | 'performance' | 'postdate'>>({});

  const handleCardTabChange = (
    influencer: CampaignInfluencer, 
    newTab: 'basic' | 'platform' | 'pricing' | 'products' | 'performance' | 'postdate'
  ) => {
    const codeKey = (influencer.code || (influencer as any).influencer_code || '').trim().toUpperCase();
    const idKey = String(influencer.id || '').trim();
    const nameKey = (influencer.influencer_name || influencer.name || '').trim().toUpperCase();

    setCardActiveTabs(prev => {
      const next = { ...prev };
      if (codeKey) next[codeKey] = newTab;
      if (idKey) next[idKey] = newTab;
      if (nameKey) next[nameKey] = newTab;
      return next;
    });
  };

  const [mainViewMode, setMainViewMode] = useState<'list' | 'analytics'>('list');
  const [analyticsFilterState, setAnalyticsFilterState] = useState<CampaignAnalyticsFilterState>(initialAnalyticsFilterState);
  const [isAnalyticsFilterOpen, setIsAnalyticsFilterOpen] = useState(false);

  const [filter, setFilter] = useState<InfluencerStatusType>('active');

  const activeCount = useMemo(() => influencers.filter(inf => isActiveStatus(inf.is_archived)).length, [influencers]);
  const otherCount = useMemo(() => influencers.filter(inf => isOtherStatus(inf.is_archived)).length, [influencers]);
  const recycleBinCount = useMemo(() => influencers.filter(inf => isArchived(inf.is_archived)).length, [influencers]);

  const [confirmMoveModal, setConfirmMoveModal] = useState<{
    isOpen: boolean;
    influencer: CampaignInfluencer | null;
    targetStatus: InfluencerStatusType;
  }>({
    isOpen: false,
    influencer: null,
    targetStatus: 'active'
  });

  const handleConfirmMoveStatus = async () => {
    if (!confirmMoveModal.influencer) return;
    const infId = String(confirmMoveModal.influencer.id);
    const targetStatus = confirmMoveModal.targetStatus;
    setConfirmMoveModal({ isOpen: false, influencer: null, targetStatus: 'active' });
    await updateInfluencerStatus(infId, targetStatus);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState<InfluencerFilterState>(initialFilterState);
  const [tempFilterState, setTempFilterState] = useState<InfluencerFilterState>(initialFilterState);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isUploadPlatformModalOpen, setIsUploadPlatformModalOpen] = useState(false);
  const [isImportPricingModalOpen, setIsImportPricingModalOpen] = useState(false);
  const [isImportPostDateModalOpen, setIsImportPostDateModalOpen] = useState(false);
  const [targetUploadCode, setTargetUploadCode] = useState<string | undefined>();
  const [activeEditInfluencer, setActiveEditInfluencer] = useState<CampaignInfluencer | null>(null);

  const handleEditInfluencerClick = (inf: CampaignInfluencer) => {
    setActiveEditInfluencer(inf);
    onEdit(inf);
  };

  const isEmptyValue = (val: any): boolean => {
    if (val === undefined || val === null) return true;
    if (typeof val === 'string') return val.trim() === '';
    if (Array.isArray(val)) return val.length === 0;
    return false;
  };

  const matchesFilters = (influencer: CampaignInfluencer): boolean => {
    // 1. Missing Detail Checklist Filters
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

    // 2. State Filter
    if (filterState.state) {
      const infStateNorm = normalizeStateName(influencer.state);
      const filterStateNorm = normalizeStateName(filterState.state);
      if (infStateNorm.toLowerCase() !== filterStateNorm.toLowerCase()) {
        return false;
      }
    }

    // 3. City Filter
    if (filterState.city && (influencer.city || '').trim().toLowerCase() !== filterState.city.trim().toLowerCase()) {
      return false;
    }

    // 4. Creator Category Filter
    if (filterState.creatorCategory) {
      const targetCat = filterState.creatorCategory.toLowerCase();
      const codes = [
        influencer.instagram_view_code,
        influencer.facebook_view_code,
        influencer.youtube_view_code
      ].map(c => (c || '').toLowerCase());

      const platCodes = (influencer.platforms || []).map(p => 
        (resolvePerformanceCode(influencer, p.platform, p.video_views).code || '').toLowerCase()
      );

      const allCodes = [...codes, ...platCodes];
      if (!allCodes.some(c => c === targetCat || c.includes(targetCat))) {
        return false;
      }
    }

    // 5. Followers Range Filter
    if (filterState.followerRange) {
      const maxFollowers = Math.max(
        0,
        ...(influencer.platforms || []).map(p => {
          const num = Number(String(p.followers_count || 0).replace(/[^0-9.]/g, ''));
          return isNaN(num) ? 0 : num;
        })
      );

      switch (filterState.followerRange) {
        case 'below_10k':
          if (maxFollowers >= 10000) return false;
          break;
        case '10k_25k':
          if (maxFollowers < 10000 || maxFollowers > 25000) return false;
          break;
        case '25k_50k':
          if (maxFollowers < 25000 || maxFollowers > 50000) return false;
          break;
        case '50k_100k':
          if (maxFollowers < 50000 || maxFollowers > 100000) return false;
          break;
        case '100k_200k':
          if (maxFollowers < 100000 || maxFollowers > 200000) return false;
          break;
        case '200k_300k':
          if (maxFollowers < 200000 || maxFollowers > 300000) return false;
          break;
        case '300k_400k':
          if (maxFollowers < 300000 || maxFollowers > 400000) return false;
          break;
        case '400k_500k':
          if (maxFollowers < 400000 || maxFollowers > 500000) return false;
          break;
        case 'above_500k':
          if (maxFollowers <= 500000) return false;
          break;
      }
    }

    // 6. Languages Filter (Multi-select)
    if (filterState.languages && filterState.languages.length > 0) {
      const infLangs = Array.isArray(influencer.languages) 
        ? influencer.languages.map(l => String(l).trim().toLowerCase())
        : (typeof influencer.languages === 'string' ? (influencer.languages as string).split(',').map(s => s.trim().toLowerCase()) : []);

      const hasMatch = filterState.languages.some(lang => infLangs.includes(lang.toLowerCase()));
      if (!hasMatch) return false;
    }

    // 7. Platform Combination Filter
    const influencerPlatforms = (influencer.platforms || []).map(p => p.platform.toLowerCase());
    const hasInstagram = influencerPlatforms.includes('instagram');
    const hasFacebook = influencerPlatforms.includes('facebook');
    const hasYoutube = influencerPlatforms.includes('youtube');

    if (filterState.platformCombo && filterState.platformCombo !== 'all') {
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
      }
    }

    // 8. Product Filter
    if (filterState.product) {
      const targetProd = filterState.product.toLowerCase();
      const prods = (influencer.products || []).map((p: any) => (p.product_name || p.name || '').toLowerCase());
      if (!prods.some(p => p.includes(targetProd))) {
        return false;
      }
    }
    // 9. Single Video Price Filter (Checks if AT LEAST ONE individual video price falls in range)
    const singleVideoPrices = getSingleVideoPrices(influencer);

    if (filterState.priceRange) {
      let rangeMin = 0;
      let rangeMax = Infinity;

      switch (filterState.priceRange) {
        case 'below_1000':
          rangeMin = 0;
          rangeMax = 1000;
          break;
        case '1000_2000':
          rangeMin = 1000;
          rangeMax = 2000;
          break;
        case '2000_3000':
          rangeMin = 2000;
          rangeMax = 3000;
          break;
        case '3000_4000':
          rangeMin = 3000;
          rangeMax = 4000;
          break;
        case '4000_5000':
          rangeMin = 4000;
          rangeMax = 5000;
          break;
        case '5000_6000':
          rangeMin = 5000;
          rangeMax = 6000;
          break;
        case '6000_7000':
          rangeMin = 6000;
          rangeMax = 7000;
          break;
        case '7000_8000':
          rangeMin = 7000;
          rangeMax = 8000;
          break;
        case '8000_9000':
          rangeMin = 8000;
          rangeMax = 9000;
          break;
        case '9000_10000':
          rangeMin = 9000;
          rangeMax = 10000;
          break;
        case 'above_10000':
          rangeMin = 10000;
          rangeMax = Infinity;
          break;
      }

      if (singleVideoPrices.length === 0) return false;
      const hasMatchingVideo = singleVideoPrices.some(price => {
        if (filterState.priceRange === 'below_1000') return price < 1000;
        if (filterState.priceRange === 'above_10000') return price > 10000;
        return price >= rangeMin && price <= rangeMax;
      });

      if (!hasMatchingVideo) return false;
    }

    if (filterState.minPrice) {
      const minP = Number(filterState.minPrice);
      if (!isNaN(minP)) {
        if (singleVideoPrices.length === 0) return false;
        const hasMatchingVideo = singleVideoPrices.some(price => price >= minP);
        if (!hasMatchingVideo) return false;
      }
    }

    if (filterState.maxPrice) {
      const maxP = Number(filterState.maxPrice);
      if (!isNaN(maxP)) {
        if (singleVideoPrices.length === 0) return false;
        const hasMatchingVideo = singleVideoPrices.some(price => price <= maxP);
        if (!hasMatchingVideo) return false;
      }
    }

    return true;
  };

  const handleOpenFilter = () => {
    setIsFilterOpen(true);
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

    if (filterState.state) count++;
    if (filterState.city) count++;
    if (filterState.creatorCategory) count++;
    if (filterState.followerRange) count++;
    if (filterState.languages.length > 0) count += filterState.languages.length;
    if (filterState.platformCombo && filterState.platformCombo !== 'all') count++;
    if (filterState.product) count++;
    if (filterState.priceRange) count++;
    if (filterState.minPrice || filterState.maxPrice) count++;
    return count;
  }, [filterState]);

  const analyticsActiveFilterCount = useMemo(() => {
    let count = 0;
    if (analyticsFilterState.searchTerm) count++;
    if (analyticsFilterState.states.length > 0) count += analyticsFilterState.states.length;
    if (analyticsFilterState.cities.length > 0) count += analyticsFilterState.cities.length;
    if (analyticsFilterState.creatorCategories.length > 0) count += analyticsFilterState.creatorCategories.length;
    if (analyticsFilterState.languages.length > 0) count += analyticsFilterState.languages.length;
    if (analyticsFilterState.followerRange) count++;
    if (analyticsFilterState.platformCombo) count++;
    if (analyticsFilterState.priceRange) count++;
    if (analyticsFilterState.products.length > 0) count += analyticsFilterState.products.length;
    return count;
  }, [analyticsFilterState]);

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
      if (filter === 'other') return isOtherStatus(inf.is_archived);
      if (filter === 'recycle_bin') return isArchived(inf.is_archived);
      return isActiveStatus(inf.is_archived);
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

    return list.filter(matchesFilters).sort(compareInfluencerCodesAsc);
  }, [influencers, searchTerm, filter, filterState]);

  return (
    <div className={`bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden flex flex-col ${mainViewMode === 'analytics' ? 'h-auto min-h-0' : 'h-[700px]'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50 gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <UserCheck size={20} className="text-purple-400" />
            Campaign Influencer: {campaign.campaign_name}
          </h3>

          {/* View Mode Toggle Switcher */}
          <div className="inline-flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner backdrop-blur-md shrink-0">
            <button 
              type="button"
              onClick={() => setMainViewMode('list')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 outline-none focus:outline-none border-0 cursor-pointer ${
                mainViewMode === 'list' 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/50 font-bold' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <UserCheck size={14} className={mainViewMode === 'list' ? 'text-purple-200' : 'text-slate-500'} />
              <span>List View</span>
            </button>
            <button 
              type="button"
              onClick={() => setMainViewMode('analytics')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 outline-none focus:outline-none border-0 cursor-pointer ${
                mainViewMode === 'analytics' 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/50 font-bold' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <BarChart2 size={14} className={mainViewMode === 'analytics' ? 'text-purple-200' : 'text-slate-500'} />
              <span>Analytics</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={refresh}
            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCcw size={16} />
          </button>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2 shrink-0 shadow-sm cursor-pointer"
            title="Upload Influencers"
          >
            <Upload size={14} /> Upload Influencers
          </button>
          <button 
            onClick={() => {
              setTargetUploadCode(undefined);
              setIsUploadPlatformModalOpen(true);
            }}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
            title="Import Platform Details"
          >
            <Upload size={14} /> Platform Details
          </button>
          <button 
            onClick={() => setIsImportPricingModalOpen(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
            title="Import Pricing Info"
          >
            <Upload size={14} /> Pricing Info
          </button>
          <button 
            onClick={() => setIsImportPostDateModalOpen(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
            title="Import Post Date"
          >
            <Upload size={14} /> Post Date
          </button>
          <button 
            onClick={onBack}
            className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm"
          >
            Back to Overview
          </button>
        </div>
      </div>

      {mainViewMode === 'analytics' ? (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <CampaignInfluencerAnalytics 
            campaign={campaign}
            influencers={influencers.filter(inf => isActiveStatus(inf.is_archived))}
            filterState={analyticsFilterState}
            onOpenFilter={() => setIsAnalyticsFilterOpen(true)}
            activeFilterCount={analyticsActiveFilterCount}
            onResetFilters={() => setAnalyticsFilterState(initialAnalyticsFilterState)}
          />
        </div>
      ) : (
        <>
          {/* Toolbar */}
      <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
            <button 
              onClick={() => setFilter('active')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${filter === 'active' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Active ({activeCount})
            </button>
            <button 
              onClick={() => setFilter('other')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${filter === 'other' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Eliminate ({otherCount})
            </button>
            <button 
              onClick={() => setFilter('recycle_bin')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${filter === 'recycle_bin' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Recycle Bin ({recycleBinCount})
            </button>
          </div>
          {!isFilterApplied && !searchTerm.trim() && (
            <span className="px-3 py-1 bg-purple-950/40 border border-purple-800/30 rounded-lg text-purple-300 font-semibold text-xs shrink-0">
              {filteredInfluencers.length === 1 ? '1 Influencer' : `${filteredInfluencers.length} Influencers`}
            </span>
          )}
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
          {onAddInfluencer && (
            <button
              onClick={onAddInfluencer}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer shrink-0"
            >
              <Users size={16} />
              <span>+ Add Influencer</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filters Bar */}
      {(isFilterApplied || searchTerm.trim()) && (
        <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Active Filters:</span>
            {searchTerm.trim() && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Search: "{searchTerm.trim()}"
                <button onClick={() => setSearchTerm('')} className="hover:text-white text-slate-400">&times;</button>
              </span>
            )}
            {filterState.state && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                State: {filterState.state}
                <button onClick={() => setFilterState(prev => ({ ...prev, state: '' }))} className="hover:text-white text-slate-400">&times;</button>
              </span>
            )}
            {filterState.city && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                City: {filterState.city}
                <button onClick={() => setFilterState(prev => ({ ...prev, city: '' }))} className="hover:text-white text-slate-400">&times;</button>
              </span>
            )}
            {filterState.creatorCategory && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Category: {filterState.creatorCategory}
                <button onClick={() => setFilterState(prev => ({ ...prev, creatorCategory: '' }))} className="hover:text-white text-slate-400">&times;</button>
              </span>
            )}
            {filterState.followerRange && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Followers: {FOLLOWER_RANGES.find(r => r.id === filterState.followerRange)?.label || filterState.followerRange}
                <button onClick={() => setFilterState(prev => ({ ...prev, followerRange: '' }))} className="hover:text-white text-slate-400">&times;</button>
              </span>
            )}
            {filterState.languages.map(lang => (
              <span key={lang} className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Lang: {lang}
                <button onClick={() => setFilterState(prev => ({ ...prev, languages: prev.languages.filter(l => l !== lang) }))} className="hover:text-white text-slate-400">&times;</button>
              </span>
            ))}
            {filterState.platformCombo && filterState.platformCombo !== 'all' && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Platform: {filterState.platformCombo}
                <button onClick={() => setFilterState(prev => ({ ...prev, platformCombo: 'all' }))} className="hover:text-white text-slate-400">&times;</button>
              </span>
            )}
            {filterState.product && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Product: {filterState.product}
                <button onClick={() => setFilterState(prev => ({ ...prev, product: '' }))} className="hover:text-white text-slate-400">&times;</button>
              </span>
            )}
            {(filterState.minPrice || filterState.maxPrice) && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                Price: ₹{filterState.minPrice || 0} - ₹{filterState.maxPrice || '∞'}
                <button onClick={() => setFilterState(prev => ({ ...prev, minPrice: '', maxPrice: '' }))} className="hover:text-white text-slate-400">&times;</button>
              </span>
            )}
            {(isFilterApplied || searchTerm.trim()) && (
              <button 
                onClick={() => {
                  setFilterState(initialFilterState);
                  setSearchTerm('');
                }} 
                className="text-purple-400 hover:text-purple-300 underline font-semibold ml-2 text-xs"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="px-3 py-1 bg-purple-950/60 border border-purple-800/40 rounded-lg text-purple-300 font-semibold text-xs shrink-0 shadow-sm ml-auto">
            {filteredInfluencers.length === 0 
              ? 'No Influencers Found' 
              : filteredInfluencers.length === 1 
                ? '1 Influencer Found' 
                : `${filteredInfluencers.length} Influencers Found`}
          </div>
        </div>
      )}

      {/* Side Filter Drawer */}
      <InfluencerFilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        influencers={influencers}
        filterState={filterState}
        onApplyFilter={(newState) => {
          setFilterState(newState);
          setIsFilterOpen(false);
          logActivity('Marketing', 'Influencer Filter Updated', 'Updated the Influencer List filter options.');
        }}
        onResetFilter={() => {
          setFilterState(initialFilterState);
        }}
      />

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
            {filteredInfluencers.map(inf => {
              const codeKey = (inf.code || (inf as any).influencer_code || '').trim().toUpperCase();
              const idKey = String(inf.id || '').trim();
              const nameKey = (inf.influencer_name || inf.name || '').trim().toUpperCase();

              const activeTabForInf = 
                (codeKey && cardActiveTabs[codeKey]) || 
                (idKey && cardActiveTabs[idKey]) || 
                (nameKey && cardActiveTabs[nameKey]) || 
                'basic';

              const stableKey = codeKey ? `card-${codeKey}` : `card-${idKey}`;

              return (
                <InfluencerCard 
                  key={stableKey} 
                  influencer={inf} 
                  activeTab={activeTabForInf}
                  currentSection={filter}
                  onTabChange={(newTab) => handleCardTabChange(inf, newTab)}
                  onEdit={handleEditInfluencerClick} 
                  onMoveStatus={(targetStatus) => setConfirmMoveModal({ isOpen: true, influencer: inf, targetStatus })}
                  onToggleArchive={toggleArchiveStatus} 
                  onDispatch={onDispatch}
                  onDelete={handleDelete}
                  onDeletePlatformViews={handleDeletePlatformViews}
                  onUploadPlatformDetails={(code) => {
                    setTargetUploadCode(code);
                    setIsUploadPlatformModalOpen(true);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {(activeEditInfluencer || editingInfluencerId) && (() => {
        const targetInfluencer = activeEditInfluencer || influencers.find(inf => String(inf.id) === String(editingInfluencerId));
        if (!targetInfluencer) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <AddCampaignInfluencer 
                  campaign={campaign} 
                  initialData={targetInfluencer} 
                  onBack={async () => {
                    setActiveEditInfluencer(null);
                    await refresh();
                    if (onCancelEdit) {
                      onCancelEdit();
                    }
                  }} 
                />
              </div>
            </div>
          </div>
        );
      })()}

      {isImportModalOpen && (
        <BulkInfluencerImportModal
          campaign={campaign}
          existingInfluencers={influencers}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={async () => {
            setIsImportModalOpen(false);
            await refresh();
          }}
        />
      )}

      {isUploadPlatformModalOpen && (
        <UploadPlatformDetailsModal
          campaign={campaign}
          existingInfluencers={influencers}
          initialInfluencerCode={targetUploadCode}
          onClose={() => setIsUploadPlatformModalOpen(false)}
          onSuccess={async () => {
            setIsUploadPlatformModalOpen(false);
            await refresh();
          }}
        />
      )}

      {isImportPricingModalOpen && (
        <ImportPricingInfoModal
          campaign={campaign}
          existingInfluencers={influencers}
          onClose={() => setIsImportPricingModalOpen(false)}
          onSuccess={async () => {
            setIsImportPricingModalOpen(false);
            await refresh();
          }}
        />
      )}

      {isImportPostDateModalOpen && (
        <ImportPostDateModal
          campaign={campaign}
          existingInfluencers={influencers}
          onClose={() => setIsImportPostDateModalOpen(false)}
          onSuccess={async () => {
            setIsImportPostDateModalOpen(false);
            await refresh();
          }}
        />
      )}

      <CampaignInfluencerAnalyticsFilterDrawer
        isOpen={isAnalyticsFilterOpen}
        onClose={() => setIsAnalyticsFilterOpen(false)}
        influencers={influencers}
        filterState={analyticsFilterState}
        onApplyFilter={(newState) => setAnalyticsFilterState(newState)}
      />

      {/* Move Status Confirmation Modal */}
      {confirmMoveModal.isOpen && confirmMoveModal.influencer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-purple-950/60 border border-purple-800/40 rounded-xl text-purple-400">
                <Users size={20} />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-100">
                  {confirmMoveModal.targetStatus === 'other' 
                    ? 'Eliminate Influencer?' 
                    : (confirmMoveModal.targetStatus === 'recycle_bin' ? 'Move to Recycle Bin?' : 'Move to Active?')}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">Confirm status update</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {confirmMoveModal.targetStatus === 'other' ? (
                <>Are you sure you want to move <span className="font-bold text-slate-100">{confirmMoveModal.influencer.influencer_name || confirmMoveModal.influencer.name || 'this influencer'}</span> to <span className="font-bold text-purple-400">Eliminate</span>?</>
              ) : confirmMoveModal.targetStatus === 'recycle_bin' ? (
                <>Are you sure you want to move <span className="font-bold text-slate-100">{confirmMoveModal.influencer.influencer_name || confirmMoveModal.influencer.name || 'this influencer'}</span> to <span className="font-bold text-red-400">Recycle Bin</span>?</>
              ) : (
                <>Are you sure you want to move <span className="font-bold text-slate-100">{confirmMoveModal.influencer.influencer_name || confirmMoveModal.influencer.name || 'this influencer'}</span> to <span className="font-bold text-emerald-400">Active</span>?</>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setConfirmMoveModal({ isOpen: false, influencer: null, targetStatus: 'active' })}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMoveStatus}
                className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer ${
                  confirmMoveModal.targetStatus === 'other' 
                    ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/30' 
                    : confirmMoveModal.targetStatus === 'recycle_bin'
                      ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                }`}
              >
                {confirmMoveModal.targetStatus === 'other' 
                  ? 'Eliminate' 
                  : (confirmMoveModal.targetStatus === 'recycle_bin' ? 'Move to Recycle Bin' : 'Move to Active')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
