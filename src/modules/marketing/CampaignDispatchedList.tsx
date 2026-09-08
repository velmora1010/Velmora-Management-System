import React, { useState, useMemo } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { 
  Search, 
  Package, 
  ExternalLink, 
  RefreshCcw, 
  ChevronRight, 
  ArrowLeft, 
  Phone, 
  MapPin, 
  Truck, 
  Calendar, 
  Clock, 
  Hash, 
  User,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useCampaignDispatch } from '../../hooks/marketing/useCampaignDispatch';
import { useCampaignInfluencers, compareInfluencerCodesAsc } from '../../hooks/marketing/useCampaignInfluencers';
import { isActiveStatus } from '../../utils/marketingUtils';

interface CampaignDispatchedListProps {
  campaign: Campaign;
  influencers?: CampaignInfluencer[];
  onBack: () => void;
  onDispatch?: (influencer: CampaignInfluencer) => void;
  onMoveToStatus: (record: any) => void;
}

const KNOWN_COURIERS = [
  'ST Courier',
  'India Post',
  'Delhivery',
  'DTDC',
  'IThink Ekart',
  'IThink Amazon',
  'IThink Delhivery'
];

const COURIER_FILTER_OPTIONS = [
  'all',
  'Not Dispatched',
  ...KNOWN_COURIERS,
  'Other'
];

export const CampaignDispatchedList: React.FC<CampaignDispatchedListProps> = ({ 
  campaign, 
  influencers,
  onBack, 
  onDispatch,
  onMoveToStatus 
}) => {
  const { influencers: hookInfluencers, isLoading: isInfluencersLoading, refresh: refreshInfluencers } = useCampaignInfluencers(campaign.id);
  const { dispatchRecords, isLoading: isDispatchLoading, refresh: refreshDispatch } = useCampaignDispatch(campaign.id);

  const [searchTerm, setSearchTerm] = useState('');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleCardExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const baseInfluencers = useMemo(() => {
    if (influencers && influencers.length > 0) return influencers;
    return hookInfluencers || [];
  }, [influencers, hookInfluencers]);

  const activeOnly = useMemo(() => {
    return baseInfluencers.filter(inf => isActiveStatus(inf.is_archived));
  }, [baseInfluencers]);

  const getDispatchData = (inf: CampaignInfluencer) => {
    return inf.dispatchDetails || dispatchRecords.find(d => String(d.influencer_id) === String(inf.id));
  };

  const getInfluencerUsername = (inf: CampaignInfluencer): string => {
    const platformUser = inf.platforms?.find(p => p.username && p.username.trim())?.username?.trim();
    const raw = platformUser || inf.influencer_name?.trim() || (inf as any).username?.trim() || inf.name?.trim() || '';
    if (!raw) return '—';
    return raw.startsWith('@') ? raw : `@${raw}`;
  };

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr || dateStr === '—' || dateStr === '-') return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const safeVal = (val: any): string => {
    if (val === undefined || val === null || val === '') return '—';
    return String(val);
  };

  const filteredInfluencers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return activeOnly.filter(inf => {
      const dispatch = getDispatchData(inf);
      const username = getInfluencerUsername(inf).toLowerCase();
      const code = (inf.code || '').toLowerCase();
      const name = (inf.name || inf.influencer_name || '').toLowerCase();
      const phone = (inf.phone_number || dispatch?.phone_number || '').toLowerCase();
      const state = (inf.state || dispatch?.state || '').toLowerCase();
      const courierPartner = (dispatch?.courier_partner || '').trim();

      const matchesSearch = !term || 
        code.includes(term) ||
        username.includes(term) ||
        name.includes(term) ||
        phone.includes(term) ||
        state.includes(term) ||
        courierPartner.toLowerCase().includes(term);

      let matchesCourier = true;
      if (courierFilter !== 'all') {
        if (courierFilter === 'Not Dispatched') {
          matchesCourier = !dispatch;
        } else if (courierFilter === 'Other') {
          matchesCourier = Boolean(dispatch && !KNOWN_COURIERS.includes(courierPartner));
        } else {
          matchesCourier = courierPartner.toLowerCase() === courierFilter.toLowerCase();
        }
      }

      return matchesSearch && matchesCourier;
    }).sort(compareInfluencerCodesAsc);
  }, [activeOnly, searchTerm, courierFilter, dispatchRecords]);

  const handleRefresh = async () => {
    await Promise.all([refreshDispatch(), refreshInfluencers()]);
  };

  const isLoading = (isInfluencersLoading || isDispatchLoading) && baseInfluencers.length === 0;

  return (
    <div className="space-y-6 animate-fade-in text-slate-200">
      <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Back to Overview"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Influencer Logistics
              <span className="text-sm font-normal text-slate-400">
                ({activeOnly.length} Active Influencers)
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage dispatch, shipment tracking, and logistics for active influencers in {campaign.campaign_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search code, user, phone..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="relative">
            <select
              value={courierFilter}
              onChange={(e) => setCourierFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer"
            >
              <option value="all">All Couriers</option>
              <option value="Not Dispatched">Not Dispatched</option>
              {KNOWN_COURIERS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="Other">Other</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          <button
            onClick={handleRefresh}
            className="p-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-600/50 flex items-center gap-1.5 text-sm"
            title="Refresh logistics"
          >
            <RefreshCcw size={16} className={(isDispatchLoading || isInfluencersLoading) ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center text-slate-400">
          <RefreshCcw className="animate-spin mx-auto mb-3 text-purple-400" size={32} />
          <p>Loading influencer logistics...</p>
        </div>
      ) : filteredInfluencers.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center text-slate-400">
          <Package className="mx-auto mb-3 text-slate-600" size={40} />
          <h3 className="text-base font-semibold text-slate-300 mb-1">No Influencers Found</h3>
          <p className="text-sm text-slate-500">
            {searchTerm || courierFilter !== 'all'
              ? 'No active influencers matched your filter criteria.'
              : 'No active influencers available in this campaign.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredInfluencers.map((inf) => {
            const dispatch = getDispatchData(inf);
            const isDispatched = Boolean(dispatch);
            const username = getInfluencerUsername(inf);

            return (
              <div 
                key={inf.id}
                className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm"
              >
                <div>
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="relative flex-shrink-0">
                      {inf.profile_file_url ? (
                        <img
                          src={inf.profile_file_url}
                          alt={inf.name || 'Influencer'}
                          className="w-13 h-13 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-slate-700 bg-slate-900"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            e.currentTarget.parentElement?.querySelector('.fallback-avatar')?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`fallback-avatar w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-purple-900/60 to-indigo-950/80 border-2 border-purple-600/30 flex items-center justify-center text-purple-300 font-bold text-sm ${inf.profile_file_url ? 'hidden' : ''}`}>
                        {inf.name ? inf.name.substring(0, 2).toUpperCase() : <User size={20} />}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-purple-900/40 text-purple-300 border border-purple-700/40">
                          {safeVal(inf.code)}
                        </span>
                        {isDispatched ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-700/50">
                            {dispatch?.dispatch_status || 'Dispatched'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-700/60 text-slate-400 border border-slate-600/50">
                            Not Dispatched
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-semibold text-slate-100 truncate" title={username}>
                        {username}
                      </h3>
                      <p className="text-xs text-slate-400 truncate" title={inf.name || inf.influencer_name || '—'}>
                        {inf.name || inf.influencer_name || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 bg-slate-900/50 rounded-lg p-3 border border-slate-800/80 mb-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 flex items-center gap-1.5 flex-shrink-0">
                        <Phone size={13} className="text-slate-500" /> Phone:
                      </span>
                      <span className="font-medium text-slate-200 truncate" title={inf.phone_number || dispatch?.phone_number || ''}>
                        {safeVal(inf.phone_number || dispatch?.phone_number)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 flex items-center gap-1.5 flex-shrink-0">
                        <MapPin size={13} className="text-slate-500" /> State:
                      </span>
                      <span className="font-medium text-slate-200 truncate" title={inf.state || dispatch?.state || ''}>
                        {safeVal(inf.state || dispatch?.state)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 flex items-center gap-1.5 flex-shrink-0">
                        <Truck size={13} className="text-slate-500" /> Courier:
                      </span>
                      <span className="font-medium text-slate-200 truncate" title={dispatch?.courier_partner || ''}>
                        {safeVal(dispatch?.courier_partner)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 flex items-center gap-1.5 flex-shrink-0">
                        <Calendar size={13} className="text-slate-500" /> Dispatch Date:
                      </span>
                      <span className="font-medium text-slate-200 truncate">
                        {formatDate(dispatch?.dispatch_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 flex items-center gap-1.5 flex-shrink-0">
                        <Clock size={13} className="text-slate-500" /> Expected Delivery:
                      </span>
                      <span className="font-medium text-slate-200 truncate">
                        {formatDate(dispatch?.expected_delivery_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 flex items-center gap-1.5 flex-shrink-0">
                        <Hash size={13} className="text-slate-500" /> Tracking ID:
                      </span>
                      <span className="font-medium text-purple-300 font-mono text-[11px] truncate" title={dispatch?.tracking_id || ''}>
                        {safeVal(dispatch?.tracking_id)}
                      </span>
                    </div>
                  </div>

                  {Boolean(dispatch && (dispatch.selected_products?.length > 0 || dispatch.product_photo_url || dispatch.dispatch_photo_url)) && (
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => toggleCardExpand(inf.id)}
                        className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors"
                      >
                        <span>{expandedCards[inf.id] ? 'Hide Dispatch Items & Media' : 'View Dispatch Items & Media'}</span>
                        {expandedCards[inf.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {expandedCards[inf.id] && (
                        <div className="mt-2 pt-2 border-t border-slate-700/60 space-y-3">
                          {dispatch.selected_products && dispatch.selected_products.length > 0 && (
                            <div>
                              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Products</span>
                              <div className="flex flex-wrap gap-1.5">
                                {dispatch.selected_products.map((p: any, i: number) => (
                                  <span key={i} className="text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-300">
                                    {p.product_name} {p.quantity ? `(x${p.quantity})` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {(dispatch.product_photo_url || dispatch.dispatch_photo_url) && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              {dispatch.product_photo_url && (
                                <div className="bg-slate-900 border border-slate-700 rounded p-1.5 text-center">
                                  <span className="text-[10px] text-slate-400 block mb-1">Product</span>
                                  <img src={dispatch.product_photo_url} alt="Product" className="w-full h-16 object-cover rounded mb-1" />
                                  <a href={dispatch.product_photo_url} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-400 hover:underline flex items-center justify-center gap-1">
                                    View <ExternalLink size={10} />
                                  </a>
                                </div>
                              )}
                              {dispatch.dispatch_photo_url && (
                                <div className="bg-slate-900 border border-slate-700 rounded p-1.5 text-center">
                                  <span className="text-[10px] text-slate-400 block mb-1">Dispatch</span>
                                  <img src={dispatch.dispatch_photo_url} alt="Dispatch" className="w-full h-16 object-cover rounded mb-1" />
                                  <a href={dispatch.dispatch_photo_url} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-400 hover:underline flex items-center justify-center gap-1">
                                    View <ExternalLink size={10} />
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-2">
                  {isDispatched ? (
                    <button
                      type="button"
                      onClick={() => onMoveToStatus(dispatch)}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <span>Move To Status</span>
                      <ChevronRight size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDispatch?.(inf)}
                      className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Package size={15} />
                      <span>Dispatch</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
