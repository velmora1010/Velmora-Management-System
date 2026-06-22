import React, { useState, useMemo } from 'react';
import type { Campaign } from '../../types';
import { Search, Package, Image as ImageIcon, ExternalLink, RefreshCcw, ChevronRight } from 'lucide-react';
import { useCampaignDispatch } from '../../hooks/marketing/useCampaignDispatch';

interface CampaignDispatchedListProps {
  campaign: Campaign;
  onBack: () => void;
  onMoveToStatus: () => void;
}

export const CampaignDispatchedList: React.FC<CampaignDispatchedListProps> = ({ campaign, onBack, onMoveToStatus }) => {
  const { dispatchRecords, isLoading, refresh } = useCampaignDispatch(campaign.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const filteredRecords = useMemo(() => {
    return dispatchRecords.filter(record => {
      // 1. Search Logic (mimicking original: creator_name, campaign_name, phone_number, state)
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        (record.creator_name?.toLowerCase().includes(term)) ||
        (record.campaign_name?.toLowerCase().includes(term)) ||
        (record.phone_number?.toLowerCase().includes(term)) ||
        (record.state?.toLowerCase().includes(term));

      // 2. Courier Filter Logic
      let matchCourier = true;
      if (courierFilter !== 'all') {
        if (courierFilter === 'Other') {
          matchCourier = record.courier_partner !== 'ST Courier' && record.courier_partner !== 'India Post';
        } else {
          matchCourier = record.courier_partner === courierFilter;
        }
      }

      return matchSearch && matchCourier;
    });
  }, [dispatchRecords, searchTerm, courierFilter]);

  const safeVal = (val: any) => val || '-';

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-[700px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50 gap-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Package size={20} className="text-emerald-400" />
          Dispatched List: {campaign.campaign_name}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors" title="Refresh Data">
            <RefreshCcw size={16} />
          </button>
          <button onClick={onBack} className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm">
            Back to Overview
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <input 
            type="text" 
            placeholder="Search by name, phone, state..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
        </div>

        <div className="relative">
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg text-sm flex items-center gap-2 hover:border-slate-600 transition-colors"
          >
            Filter: {courierFilter === 'all' ? 'All Couriers' : courierFilter}
          </button>
          
          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 overflow-hidden">
              {['all', 'ST Courier', 'India Post', 'Other'].map(opt => (
                <button
                  key={opt}
                  onClick={() => {
                    setCourierFilter(opt);
                    setIsFilterOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    courierFilter === opt 
                      ? 'bg-emerald-600 text-white' 
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {opt === 'all' ? 'All Couriers' : opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-900/50">
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-slate-500">
            <RefreshCcw size={24} className="animate-spin mr-2" /> Loading dispatch records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-slate-500 italic">
            <div className="text-4xl mb-4 opacity-50">📦</div>
            <h3 className="text-slate-300 text-lg mb-2 font-semibold">No dispatched influencers found.</h3>
            <p className="text-sm">Dispatched influencers for this campaign will appear here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredRecords.map(record => {
               const avatarUrl = record.influencer?.profile_file_url;
               const dispatchId = record.influencer?.code || record.id;
               
               return (
                 <div key={record.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                    {/* Full Card Header */}
                    <div className="bg-slate-800/80 p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-slate-600 bg-slate-900 flex items-center justify-center">
                           {avatarUrl ? (
                             <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                           ) : (
                             <span className="text-slate-500 font-bold">{record.creator_name?.charAt(0) || '?'}</span>
                           )}
                        </div>
                        <div>
                          <h3 className="text-slate-100 font-bold text-lg leading-tight">{record.creator_name}</h3>
                          <span className="text-slate-400 text-xs font-mono">Dispatch ID: {dispatchId}</span>
                        </div>
                      </div>
                      <button 
                        onClick={onMoveToStatus}
                        className="flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Move To Status <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Full Card Body */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                      
                      {/* Grid Data Items */}
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Phone</span><span className="text-slate-200 font-medium text-sm">{safeVal(record.phone_number)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Alt Phone</span><span className="text-slate-200 font-medium text-sm">{safeVal(record.alternative_phone_number)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Address</span><span className="text-slate-200 font-medium text-sm break-words">{safeVal(record.address)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">State</span><span className="text-slate-200 font-medium text-sm">{safeVal(record.state)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Dispatch Date</span><span className="text-slate-200 font-medium text-sm">{safeVal(record.dispatch_date)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Exp. Delivery Date</span><span className="text-slate-200 font-medium text-sm">{safeVal(record.expected_delivery_date)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Campaign Name</span><span className="text-slate-200 font-medium text-sm">{safeVal(record.campaign_name)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Product Name</span><span className="text-slate-200 font-medium text-sm">{safeVal(record.product_name)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Courier Partner</span><span className="text-slate-200 font-medium text-sm">{safeVal(record.courier_partner)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Track ID</span><span className="text-slate-200 font-medium text-sm font-mono">{safeVal(record.tracking_id)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Total Value</span><span className="text-slate-200 font-medium text-sm">₹{safeVal(record.total_product_value)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Total Weight</span><span className="text-slate-200 font-medium text-sm">{safeVal(record.total_weight)}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs">Total Products</span><span className="text-slate-200 font-medium text-sm">{safeVal(record.total_products)}</span></div>

                      {/* Products Sent List */}
                      <div className="lg:col-span-3 mt-2 border-t border-slate-700 pt-4">
                        <h4 className="text-sm text-slate-100 font-semibold mb-3">Products Sent</h4>
                        <div className="bg-slate-900 rounded-lg border border-slate-700 p-3">
                          {record.selected_products && record.selected_products.length > 0 ? (
                            <ul className="space-y-2">
                              {record.selected_products.map((p, idx) => (
                                <li key={idx} className="flex justify-between items-center text-sm">
                                  <span className="text-slate-300 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    {p.product_name}
                                  </span>
                                  <span className="font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded">Qty: {p.quantity}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-slate-500 italic text-sm">No products selected</div>
                          )}
                        </div>
                      </div>

                      {/* Dispatch Photos */}
                      <div className="lg:col-span-3 mt-2">
                        <h4 className="text-sm text-slate-100 font-semibold mb-3">Dispatch Photos</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          
                          {/* Product Photo */}
                          <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                            <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Product Photo</span>
                            <div className="aspect-video bg-slate-800 rounded flex items-center justify-center overflow-hidden border border-slate-700/50">
                              {record.product_photo_url ? (
                                <img src={record.product_photo_url} alt="Product" className="w-full h-full object-contain" />
                              ) : (
                                <div className="flex flex-col items-center text-slate-600">
                                  <ImageIcon size={24} className="mb-1 opacity-50" />
                                  <span className="text-xs">No Image</span>
                                </div>
                              )}
                            </div>
                            {record.product_photo_url && (
                              <a href={record.product_photo_url} target="_blank" rel="noreferrer" className="mt-2 text-xs text-emerald-400 hover:underline flex items-center gap-1 justify-center">
                                View Full <ExternalLink size={12} />
                              </a>
                            )}
                          </div>

                          {/* Dispatch Photo */}
                          <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                            <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Dispatch Photo</span>
                            <div className="aspect-video bg-slate-800 rounded flex items-center justify-center overflow-hidden border border-slate-700/50">
                              {record.dispatch_photo_url ? (
                                <img src={record.dispatch_photo_url} alt="Dispatch" className="w-full h-full object-contain" />
                              ) : (
                                <div className="flex flex-col items-center text-slate-600">
                                  <ImageIcon size={24} className="mb-1 opacity-50" />
                                  <span className="text-xs">No Image</span>
                                </div>
                              )}
                            </div>
                            {record.dispatch_photo_url && (
                              <a href={record.dispatch_photo_url} target="_blank" rel="noreferrer" className="mt-2 text-xs text-emerald-400 hover:underline flex items-center gap-1 justify-center">
                                View Full <ExternalLink size={12} />
                              </a>
                            )}
                          </div>

                        </div>
                      </div>

                    </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
