import React, { useState, useMemo } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { 
  Search, 
  Package, 
  RefreshCcw, 
  ArrowLeft, 
  ChevronDown 
} from 'lucide-react';
import { useCampaignDispatch } from '../../hooks/marketing/useCampaignDispatch';
import { useCampaignInfluencers, compareInfluencerCodesAsc } from '../../hooks/marketing/useCampaignInfluencers';
import { isActiveStatus } from '../../utils/marketingUtils';

interface CampaignDispatchedListProps {
  campaign: Campaign;
  influencers?: CampaignInfluencer[];
  onBack: () => void;
  onDispatch?: (influencer: CampaignInfluencer) => void;
  onMoveToStatus?: (record: any) => void;
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
  onMoveToStatus: _onMoveToStatus 
}) => {
  const { influencers: hookInfluencers, isLoading: isInfluencersLoading, refresh: refreshInfluencers } = useCampaignInfluencers(campaign.id);
  const { dispatchRecords, isLoading: isDispatchLoading, refresh: refreshDispatch } = useCampaignDispatch(campaign.id);

  const [searchTerm, setSearchTerm] = useState('');
  const [courierFilter, setCourierFilter] = useState<string>('all');

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
    const clean = raw.replace(/^@+/, '');
    return `@${clean}`;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredInfluencers.map((inf) => {
            const username = getInfluencerUsername(inf);

            return (
              <div 
                key={inf.id}
                className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center text-white font-bold text-sm sm:text-base border-2 border-purple-500/30 shrink-0 shadow-sm">
                    {inf.profile_file_url ? (
                      <img 
                        src={inf.profile_file_url} 
                        alt={inf.name || 'Influencer'} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('.fallback-initial');
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <span className={`fallback-initial ${inf.profile_file_url ? 'hidden' : ''}`}>
                      {(inf.influencer_name || inf.name || 'A').charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <h3 
                      className="font-bold text-slate-100 text-sm sm:text-base truncate hover:text-purple-300 transition-colors"
                      title={username}
                    >
                      {username}
                    </h3>
                    {inf.code && (
                      <span className="px-2 py-0.5 bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-bold font-mono rounded shrink-0 shadow-sm">
                        {inf.code}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <button 
                    type="button"
                    onClick={() => onDispatch?.(inf)} 
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors shrink-0 shadow-sm cursor-pointer"
                  >
                    Dispatch
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
