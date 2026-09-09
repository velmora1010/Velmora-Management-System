import React, { useEffect } from 'react';
import { 
  X, 
  User, 
  Phone, 
  PhoneCall, 
  MapPin, 
  Languages as LanguagesIcon, 
  CreditCard, 
  Video, 
  Package, 
  CheckCircle, 
  Layers, 
  Mail,
  Share2
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { 
  formatDisplayProductName, 
  isVideoLabel, 
  getInfluencerResolvedVideoProducts 
} from './AddCampaignInfluencer';
import { normalizeStateName } from './CampaignDispatchedList';

export interface InfluencerQuickViewModalProps {
  influencer: CampaignInfluencer;
  campaign: Campaign;
  status: 'Active' | 'Preparing' | 'Dispatched';
  dispatchRecord?: any;
  onClose: () => void;
}

export const InfluencerQuickViewModal: React.FC<InfluencerQuickViewModalProps> = ({
  influencer,
  campaign,
  status,
  dispatchRecord,
  onClose,
}) => {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Clean Instagram / Platform username
  const username = (() => {
    const platformUser = influencer.platforms?.find(p => p.username && p.username.trim())?.username?.trim();
    const raw = platformUser || influencer.influencer_name?.trim() || (influencer as any).username?.trim() || influencer.name?.trim() || '';
    if (!raw) return '—';
    const clean = raw.replace(/^@+/, '');
    return `@${clean}`;
  })();

  // Display Name
  const displayName = influencer.influencer_name?.trim() || influencer.name?.trim() || username;

  // Platform(s)
  const platforms = (() => {
    const list = (influencer.platforms || [])
      .map(p => p.platform?.trim())
      .filter((p): p is string => Boolean(p));
    return list.length > 0 ? Array.from(new Set(list)) : ['Instagram'];
  })();

  // Video count
  const videoCount = (() => {
    if (influencer.pricing?.total_videos && Number(influencer.pricing.total_videos) > 0) {
      return influencer.pricing.total_videos;
    }
    if (Array.isArray(influencer.pricing?.product_pricing?.videos) && influencer.pricing!.product_pricing!.videos.length > 0) {
      return influencer.pricing!.product_pricing!.videos.length;
    }
    if (Array.isArray(influencer.products) && influencer.products.length > 0) {
      const maxV = Math.max(...influencer.products.map((p: any) => Number(p.video_number) || 1));
      if (maxV > 0) return maxV;
    }
    return '—';
  })();

  // Agreed Pricing
  const agreedPricing = (() => {
    if (influencer.pricing?.final_price !== undefined && influencer.pricing?.final_price !== null) {
      const num = Number(influencer.pricing.final_price);
      return isNaN(num) ? String(influencer.pricing.final_price) : `₹${num.toLocaleString('en-IN')}`;
    }
    const rawTotal = (influencer.pricing as any)?.total_price;
    if (rawTotal !== undefined && rawTotal !== null && rawTotal !== '') {
      const num = Number(rawTotal);
      return isNaN(num) ? String(rawTotal) : `₹${num.toLocaleString('en-IN')}`;
    }
    return '—';
  })();

  // Assigned Products (strictly resolved to actual names, filtering out "Video 1", "Video 2", "unmapped")
  const assignedProducts = (() => {
    const result: { name: string; qty?: number }[] = [];
    const seen = new Set<string>();

    const addProduct = (rawName?: string | null, qty?: number) => {
      if (!rawName || typeof rawName !== 'string') return;
      const trimmed = rawName.trim();
      if (!trimmed || isVideoLabel(trimmed) || trimmed.toLowerCase() === 'product not assigned') return;
      const formatted = formatDisplayProductName(trimmed);
      const key = formatted.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ name: formatted, qty: qty || 1 });
      }
    };

    // 1. Check dispatch record (if already prepared or dispatched)
    if (dispatchRecord?.selected_products && Array.isArray(dispatchRecord.selected_products)) {
      dispatchRecord.selected_products.forEach((p: any) => {
        addProduct(p.product_name || p.name, p.qty || p.quantity);
      });
    } else if (dispatchRecord?.product_name && typeof dispatchRecord.product_name === 'string') {
      dispatchRecord.product_name.split(',').forEach((part: string) => addProduct(part));
    }

    // 2. Check canonical resolved video products (from Pricing Info)
    try {
      const resolvedVideos = getInfluencerResolvedVideoProducts(influencer);
      resolvedVideos.forEach(v => {
        (v.products || []).forEach(p => {
          if (p && p.name) {
            addProduct(p.name, p.qty);
          }
        });
      });
    } catch {
      // ignore
    }

    // 3. Fallback to influencer.products
    if (result.length === 0 && Array.isArray(influencer.products)) {
      influencer.products.forEach((p: any) => {
        addProduct(p.product_name || p.name, p.qty);
      });
    }

    return result;
  })();

  // Contact info
  const phoneNumber = influencer.phone_number || (influencer as any).phone || '—';
  const altPhone = influencer.alternative_number || (influencer as any).alt_phone || dispatchRecord?.alternative_phone_number || '—';
  const email = influencer.email || (influencer as any).email_id || '—';
  const upiId = influencer.upi_number || (influencer as any).upi_id || (influencer as any).upi || '—';

  // Address info
  const completeAddress = influencer.complete_address || (influencer as any).address || dispatchRecord?.address || '—';
  const city = influencer.city || dispatchRecord?.city || '—';
  const rawState = influencer.state || dispatchRecord?.state;
  const state = rawState ? (normalizeStateName(rawState) || rawState) : '—';
  const pincode = influencer.pincode || (influencer as any).pin_code || dispatchRecord?.pincode || '—';

  // Languages
  const languagesStr = (() => {
    const raw = influencer.languages as unknown;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter(Boolean).join(', ');
    }
    if (typeof raw === 'string' && (raw as string).trim()) {
      return (raw as string).trim();
    }
    return '—';
  })();

  const renderPlatformIcon = (platformName: string) => {
    const p = platformName.toLowerCase();
    if (p.includes('instagram')) {
      return (
        <svg className="w-3.5 h-3.5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
        </svg>
      );
    }
    if (p.includes('youtube')) {
      return (
        <svg className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
          <path d="m10 15 5-3-5-3z"/>
        </svg>
      );
    }
    return <Share2 size={13} className="text-purple-400" />;
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b1220] border border-slate-800/90 rounded-2xl w-full max-w-2xl shadow-2xl shadow-purple-950/20 flex flex-col max-h-[90vh] my-auto animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800/80 bg-[#0c1527] shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg border-2 border-purple-500/40 shrink-0 shadow-md shadow-purple-900/20">
              {influencer.profile_file_url ? (
                <img 
                  src={influencer.profile_file_url} 
                  alt={displayName} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.fallback-avatar');
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
              ) : null}
              <span className={`fallback-avatar ${influencer.profile_file_url ? 'hidden' : ''}`}>
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Name + Username + Code */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                  {displayName}
                </h2>
                {influencer.code && (
                  <span className="px-2 py-0.5 bg-purple-950/80 border border-purple-800/50 text-purple-300 text-xs font-mono font-bold rounded-lg shadow-sm">
                    {influencer.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-purple-300 font-medium truncate mt-0.5">
                {username}
              </p>
            </div>
          </div>

          {/* Top-Right: Logistics Status Pill + Close Button */}
          <div className="flex items-center gap-2.5 shrink-0 ml-3">
            {status === 'Dispatched' ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center gap-1.5 shadow-sm">
                <CheckCircle size={13} className="text-emerald-400" />
                <span>Dispatched</span>
              </span>
            ) : status === 'Preparing' ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-950/80 text-purple-300 border border-purple-800/50 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span>Preparing</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-950/80 text-blue-300 border border-blue-800/50 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Active</span>
              </span>
            )}

            <button 
              type="button"
              onClick={onClose} 
              aria-label="Close modal"
              title="Close"
              className="text-slate-400 hover:text-white transition-colors p-2 bg-slate-900/80 hover:bg-slate-800 rounded-xl border border-slate-700/80 cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1 [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600">
          
          {/* Section 1: Campaign & Commercials Summary */}
          <div className="bg-[#0e172a]/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
              <Layers size={15} className="text-purple-400" />
              <span>Campaign & Commercials</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Campaign */}
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400 mb-1">Campaign</div>
                <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate" title={campaign.campaign_name}>
                  {campaign.campaign_name || '—'}
                </div>
              </div>

              {/* Platform */}
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400 mb-1">Platform</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {platforms.map(p => (
                    <span key={p} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-200">
                      {renderPlatformIcon(p)}
                      <span>{p}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Videos */}
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400 mb-1">Total Videos</div>
                <div className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <Video size={14} className="text-purple-400" />
                  <span>{videoCount} {typeof videoCount === 'number' ? (videoCount === 1 ? 'Video' : 'Videos') : ''}</span>
                </div>
              </div>

              {/* Agreed Pricing */}
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400 mb-1">Agreed Pricing</div>
                <div className="text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-1">
                  <span>{agreedPricing}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Assigned Products */}
          <div className="bg-[#0e172a]/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
                <Package size={15} className="text-purple-400" />
                <span>Assigned Products</span>
              </div>
              {assignedProducts.length > 0 && (
                <span className="text-[11px] font-medium text-slate-400">
                  {assignedProducts.length} {assignedProducts.length === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>

            {assignedProducts.length === 0 ? (
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3.5 text-center text-xs sm:text-sm text-slate-400 italic">
                Product not assigned
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignedProducts.map((prod, idx) => (
                  <span 
                    key={idx} 
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-950/40 text-purple-200 border border-purple-800/40 shadow-sm"
                  >
                    <Package size={13} className="text-purple-400" />
                    <span>{prod.name}</span>
                    {prod.qty && prod.qty > 1 ? (
                      <span className="text-purple-400 font-mono text-[11px] font-bold">×{prod.qty}</span>
                    ) : null}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Contact & Financial Information */}
          <div className="bg-[#0e172a]/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
              <Phone size={15} className="text-purple-400" />
              <span>Contact & Payment</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Phone Number */}
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400 border border-purple-800/30 shrink-0">
                  <Phone size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-400">Phone Number</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate select-all">
                    {phoneNumber}
                  </div>
                </div>
              </div>

              {/* Alternate Phone */}
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400 border border-purple-800/30 shrink-0">
                  <PhoneCall size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-400">Alternate Phone</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate select-all">
                    {altPhone}
                  </div>
                </div>
              </div>

              {/* UPI ID */}
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400 border border-purple-800/30 shrink-0">
                  <CreditCard size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-400">UPI ID</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate select-all">
                    {upiId}
                  </div>
                </div>
              </div>

              {/* Languages */}
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400 border border-purple-800/30 shrink-0">
                  <LanguagesIcon size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-400">Languages</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                    {languagesStr}
                  </div>
                </div>
              </div>
            </div>

            {/* Email (if available) */}
            {email !== '—' && (
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400 border border-purple-800/30 shrink-0">
                  <Mail size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-400">Email Address</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate select-all">
                    {email}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Shipping Address */}
          <div className="bg-[#0e172a]/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
              <MapPin size={15} className="text-purple-400" />
              <span>Shipping & Address</span>
            </div>

            {/* Complete Address */}
            <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3.5">
              <div className="text-[11px] font-medium text-slate-400 mb-1">Complete Address</div>
              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap select-all">
                {completeAddress}
              </div>
            </div>

            {/* City / State / Pincode */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400 mb-1">City</div>
                <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                  {city}
                </div>
              </div>

              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400 mb-1">State</div>
                <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                  {state}
                </div>
              </div>

              <div className="bg-[#0b101c] border border-slate-800/60 rounded-xl p-3">
                <div className="text-[11px] font-medium text-slate-400 mb-1">Pincode</div>
                <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                  {pincode}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex justify-end items-center px-5 sm:px-6 py-3.5 border-t border-slate-800/80 bg-[#0c1527] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
