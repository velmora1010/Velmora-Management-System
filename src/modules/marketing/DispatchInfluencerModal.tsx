import React, { useState, useEffect } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { 
  X, 
  Package, 
  Truck, 
  UploadCloud, 
  Image as ImageIcon,
  User,
  Hash,
  Phone,
  MapPin,
  Building,
  Map as MapIcon,
  LayoutGrid,
  Languages,
  Folder,
  Calendar,
  Coins,
  Weight
} from 'lucide-react';
import { useDispatch, type DispatchPayload } from '../../hooks/marketing/useDispatch';
import toast from 'react-hot-toast';
import { getInfluencerResolvedVideoProducts } from './AddCampaignInfluencer';

// Central Price Config Rules
export const PRODUCT_PRICES: Record<string, number> = {
  sponge: 299,
  'kitchen towel': 299,
  detergent: 399,
  dishwash: 399,
};
export const DEFAULT_PRODUCT_PRICE = 499;

export const getProductPrice = (name: string): number => {
  const cleanName = (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (cleanName.includes('sponge')) {
    return PRODUCT_PRICES.sponge;
  }
  if (cleanName.includes('kitchen towel') || cleanName.includes('bamboo towel')) {
    return PRODUCT_PRICES['kitchen towel'];
  }
  if (cleanName.includes('detergent')) {
    return PRODUCT_PRICES.detergent;
  }
  if (cleanName.includes('dishwash')) {
    return PRODUCT_PRICES.dishwash;
  }
  return DEFAULT_PRODUCT_PRICE;
};

// Helper to extract language string from canonical influencer data
const getInitialLanguage = (inf: CampaignInfluencer): string => {
  const raw: any = inf.languages;
  if (!raw) return '';
  if (Array.isArray(raw)) {
    return raw.filter(l => typeof l === 'string' && !l.startsWith('views_data:')).join(', ');
  }
  if (typeof raw === 'string') {
    return raw.trim();
  }
  return '';
};

interface DispatchInfluencerModalProps {
  influencer: CampaignInfluencer;
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}

export const DispatchInfluencerModal: React.FC<DispatchInfluencerModalProps> = ({ influencer, campaign, onClose, onSuccess }) => {
  const { dispatchInfluencer, isSubmitting } = useDispatch();
  
  const dispatchDetails = influencer.dispatchDetails;

  // Form State
  const [phone, setPhone] = useState(influencer.phone_number || dispatchDetails?.phone_number || '');
  const [altPhone, setAltPhone] = useState(influencer.alternative_number || dispatchDetails?.alternative_phone_number || '');
  const [address, setAddress] = useState(influencer.complete_address || (influencer as any).address || dispatchDetails?.address || '');
  const [city, setCity] = useState(influencer.city || '');
  const [state, setState] = useState(influencer.state || dispatchDetails?.state || '');
  const [pincode, setPincode] = useState(influencer.pincode || '');
  const [language, setLanguage] = useState(getInitialLanguage(influencer));
  
  // Products State - resolve from canonical Pricing Info source of truth first
  const initialProducts = (() => {
    const resolvedVideos = getInfluencerResolvedVideoProducts(influencer);
    const prodMap = new Map<string, { product_name: string; quantity: number }>();

    resolvedVideos.forEach(v => {
      (v.products || []).forEach(p => {
        if (p && p.selected !== false && p.qty > 0) {
          const key = p.name.trim();
          if (prodMap.has(key)) {
            prodMap.get(key)!.quantity += p.qty;
          } else {
            prodMap.set(key, { product_name: key, quantity: p.qty });
          }
        }
      });
    });

    if (prodMap.size > 0) {
      return Array.from(prodMap.values());
    }

    return (influencer.products || [])
      .filter((p: any) => p.selected && p.qty && p.qty > 0)
      .map((p: any) => ({ ...p, quantity: p.qty }));
  })();
    
  const [selectedProducts] = useState(initialProducts);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalValue, setTotalValue] = useState('0');
  const [totalWeight, setTotalWeight] = useState(dispatchDetails?.total_weight || '');
  
  // Dispatch Details
  const [courierPartner, setCourierPartner] = useState(dispatchDetails?.courier_partner || '');
  const [trackingId, setTrackingId] = useState(dispatchDetails?.tracking_id || '');
  const [dispatchDate, setDispatchDate] = useState(dispatchDetails?.dispatch_date || new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(dispatchDetails?.expected_delivery_date || '');
  
  // Photos
  const [productPhotoFile, setProductPhotoFile] = useState<File | null>(null);
  const [productPhotoPreview, setProductPhotoPreview] = useState<string | null>(dispatchDetails?.product_photo_url || null);
  const [dispatchPhotoFile, setDispatchPhotoFile] = useState<File | null>(null);
  const [dispatchPhotoPreview, setDispatchPhotoPreview] = useState<string | null>(dispatchDetails?.dispatch_photo_url || null);

  // Sync state if influencer prop changes (prevents stale data across different influencers)
  useEffect(() => {
    const d = influencer.dispatchDetails;
    setPhone(influencer.phone_number || d?.phone_number || '');
    setAltPhone(influencer.alternative_number || d?.alternative_phone_number || '');
    setAddress(influencer.complete_address || (influencer as any).address || d?.address || '');
    setCity(influencer.city || '');
    setState(influencer.state || d?.state || '');
    setPincode(influencer.pincode || '');
    setLanguage(getInitialLanguage(influencer));

    if (d) {
      if (d.courier_partner) setCourierPartner(d.courier_partner);
      if (d.tracking_id) setTrackingId(d.tracking_id);
      if (d.dispatch_date) setDispatchDate(d.dispatch_date);
      if (d.expected_delivery_date) setExpectedDeliveryDate(d.expected_delivery_date);
      if (d.total_weight) setTotalWeight(d.total_weight);
      if (d.product_photo_url) setProductPhotoPreview(d.product_photo_url);
      if (d.dispatch_photo_url) setDispatchPhotoPreview(d.dispatch_photo_url);
    }
  }, [influencer]);

  // Recalculate total products and total value automatically when selectedProducts changes
  useEffect(() => {
    const totalQty = selectedProducts.reduce((sum: number, p: any) => sum + (parseInt(p.quantity, 10) || 0), 0);
    setTotalProducts(totalQty);

    const calculatedVal = selectedProducts.reduce((sum: number, p: any) => {
      const qty = parseInt(p.quantity, 10) || 0;
      const unitPrice = getProductPrice(p.product_name);
      return sum + (qty * unitPrice);
    }, 0);
    setTotalValue(calculatedVal.toString());
  }, [selectedProducts]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'dispatch') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      if (type === 'product') {
        setProductPhotoFile(file);
        setProductPhotoPreview(preview);
      } else {
        setDispatchPhotoFile(file);
        setDispatchPhotoPreview(preview);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const creatorName = influencer.influencer_name || influencer.name;
    if (!creatorName || !dispatchDate) {
      toast.error('Please fill in Creator Name and Dispatch Date.');
      return;
    }
    
    if (selectedProducts.length === 0) {
      toast.error('No selected products found for this influencer.');
      return;
    }

    const payload: DispatchPayload = {
      influencer_id: String(influencer.id),
      campaign_id: String(campaign.id),
      creator_name: creatorName,
      phone_number: phone || null,
      alternative_phone_number: altPhone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      languages: language || null,
      campaign_name: campaign.campaign_name,
      product_name: selectedProducts.map((p: any) => p.product_name).join(', ') || null,
      selected_products: selectedProducts,
      total_products: totalProducts,
      total_product_value: totalValue ? parseFloat(totalValue) : null,
      total_weight: totalWeight || null,
      product_photo_url: productPhotoPreview?.startsWith('http') ? productPhotoPreview : null,
      courier_partner: courierPartner || null,
      dispatch_photo_url: dispatchPhotoPreview?.startsWith('http') ? dispatchPhotoPreview : null,
      tracking_id: trackingId || null,
      dispatch_date: dispatchDate,
      expected_delivery_date: expectedDeliveryDate || null,
      dispatch_status: 'Dispatched',
      influencer_code: influencer.code || null
    };

    const success = await dispatchInfluencer(payload, productPhotoFile, dispatchPhotoFile);
    if (success) {
      toast.success('Influencer dispatch recorded successfully!');
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#0b101b] border border-slate-800/90 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] my-auto animate-fade-in overflow-hidden">
        
        {/* Header - Fixed/Sticky at top, X close button always visible and interactive */}
        <div className="flex justify-between items-center px-6 py-4 sm:py-5 border-b border-slate-800/80 bg-[#0c121e] shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Package size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Dispatch Influencer: {influencer.influencer_name || influencer.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage product dispatch, shipment tracking and logistics details for this influencer.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            aria-label="Close"
            className="text-slate-400 hover:text-white transition-colors p-2 bg-[#151c2c] hover:bg-[#1c263a] rounded-xl border border-slate-700/80 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 flex-1 [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            
            {/* Left Column */}
            <div className="space-y-5 sm:space-y-6 flex flex-col">
              
              {/* Influencer Basic Info */}
              <div className="bg-[#0e1626]/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="text-purple-400 mt-0.5">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Influencer Basic Info</h3>
                    <p className="text-xs text-slate-400">Basic details of the influencer for dispatch.</p>
                  </div>
                </div>
                
                <div className="space-y-3.5">
                  {/* Row 1: Creator Name | Influencer Code */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <User size={13} className="text-slate-400 shrink-0" />
                        <span>Creator Name</span>
                      </label>
                      <input 
                        type="text" 
                        value={influencer.influencer_name || influencer.name || ''} 
                        readOnly 
                        className="w-full bg-[#0b101b] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 font-medium cursor-not-allowed" 
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <Hash size={13} className="text-slate-400 shrink-0" />
                        <span>Influencer Code</span>
                      </label>
                      <input 
                        type="text" 
                        value={influencer.code || ''} 
                        readOnly 
                        className="w-full bg-[#0b101b] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 font-medium cursor-not-allowed select-all" 
                      />
                    </div>
                  </div>

                  {/* Row 2: Phone Number | Alt Phone */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        <span>Phone Number</span>
                      </label>
                      <input 
                        type="text" 
                        value={phone} 
                        onChange={e => setPhone(e.target.value)} 
                        placeholder="Phone Number"
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        <span>Alt Phone</span>
                      </label>
                      <input 
                        type="text" 
                        value={altPhone} 
                        onChange={e => setAltPhone(e.target.value)} 
                        placeholder="Alt Phone"
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" 
                      />
                    </div>
                  </div>

                  {/* Row 3: Address (Complete address / street / locality) */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span>Address</span>
                    </label>
                    <textarea 
                      value={address} 
                      onChange={e => setAddress(e.target.value)} 
                      rows={2} 
                      placeholder="Complete address / street / locality"
                      className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed"
                    />
                  </div>

                  {/* Row 4: City | State */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <Building size={13} className="text-slate-400 shrink-0" />
                        <span>City</span>
                      </label>
                      <input 
                        type="text" 
                        value={city} 
                        onChange={e => setCity(e.target.value)} 
                        placeholder="City"
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <MapIcon size={13} className="text-slate-400 shrink-0" />
                        <span>State</span>
                      </label>
                      <input 
                        type="text" 
                        value={state} 
                        onChange={e => setState(e.target.value)} 
                        placeholder="State"
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" 
                      />
                    </div>
                  </div>

                  {/* Row 5: Pincode | Language */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <LayoutGrid size={13} className="text-slate-400 shrink-0" />
                        <span>Pincode</span>
                      </label>
                      <input 
                        type="text" 
                        value={pincode} 
                        onChange={e => setPincode(e.target.value)} 
                        placeholder="Pincode"
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <Languages size={13} className="text-slate-400 shrink-0" />
                        <span>Language</span>
                      </label>
                      <input 
                        type="text" 
                        value={language} 
                        onChange={e => setLanguage(e.target.value)} 
                        placeholder="e.g. Hindi, Tamil"
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" 
                      />
                    </div>
                  </div>

                  {/* Row 6: Campaign Name */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                      <Folder size={13} className="text-slate-400 shrink-0" />
                      <span>Campaign Name</span>
                    </label>
                    <input 
                      type="text" 
                      value={campaign.campaign_name || ''} 
                      readOnly 
                      className="w-full bg-[#0b101b] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 font-medium cursor-not-allowed" 
                    />
                  </div>
                </div>
              </div>

              {/* Campaign Products */}
              <div className="bg-[#0e1626]/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm flex flex-col">
                {/* Fixed Card Header */}
                <div className="flex items-start gap-3 mb-4 shrink-0">
                  <div className="text-purple-400 mt-0.5">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Campaign Products</h3>
                    <p className="text-xs text-slate-400">Products assigned to this influencer.</p>
                  </div>
                </div>

                <div className="space-y-3.5 flex-1 flex flex-col min-h-0">
                  {/* Dedicated Scrollable Container ONLY around individual product rows */}
                  <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1.5 [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-900/40 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600 transition-colors">
                    {selectedProducts.length > 0 ? (
                      selectedProducts.map((p: any, idx: number) => {
                        const unitPrice = getProductPrice(p.product_name);
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#0b101b]/60 border border-slate-800/80">
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <Package size={16} className="text-slate-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-200 leading-tight truncate">{p.product_name}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">₹{(unitPrice ?? 0).toLocaleString('en-IN')} / unit</div>
                              </div>
                            </div>
                            <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 px-2.5 py-1 rounded-lg text-xs font-mono font-medium shrink-0">
                              Qty: {p.quantity}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-slate-500 text-xs text-center italic py-4">No products selected for this influencer.</p>
                    )}
                  </div>
                  
                  {/* Fixed Summary Boxes at bottom of card */}
                  <div className="grid grid-cols-3 gap-3 pt-1 shrink-0 mt-auto">
                    <div className="bg-[#0b101b]/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                        <Package size={14} />
                        <span className="text-[11px] font-medium text-slate-400">Total Products</span>
                      </div>
                      <div className="text-base font-bold text-white">{totalProducts}</div>
                    </div>

                    <div className="bg-[#0b101b]/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                        <Coins size={14} />
                        <span className="text-[11px] font-medium text-slate-400">Total Value (₹)</span>
                      </div>
                      <div>
                        <div className="text-base font-bold text-white">
                          {totalValue ? `₹${(Number(totalValue) || 0).toLocaleString('en-IN')}` : '₹0'}
                        </div>
                        <span className="text-[9px] text-slate-500 leading-tight block mt-0.5">Auto calculated from campaign products</span>
                      </div>
                    </div>

                    <div className="bg-[#0b101b]/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                        <Weight size={14} />
                        <span className="text-[11px] font-medium text-slate-400">Total Weight</span>
                      </div>
                      <input 
                        type="text" 
                        value={totalWeight} 
                        onChange={e => setTotalWeight(e.target.value)} 
                        placeholder="e.g. 500g" 
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-lg px-2.5 py-1 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" 
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column */}
            <div className="space-y-5 sm:space-y-6 flex flex-col">
              
              {/* Product Shipment (Photos) */}
              <div className="bg-[#0e1626]/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="text-purple-400 mt-0.5">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Photos</h3>
                    <p className="text-xs text-slate-400">Upload product and dispatch photos.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  {/* Pack Photo */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-purple-400 mb-2">
                      <ImageIcon size={13} />
                      <span className="text-slate-300 font-medium">Product Photo</span>
                    </div>
                    <div className="border border-dashed border-slate-700/80 hover:border-purple-500/70 bg-[#0b101b]/60 rounded-xl p-3 text-center relative transition-colors group cursor-pointer min-h-[140px] flex items-center justify-center">
                      {productPhotoPreview ? (
                        <div className="relative w-full h-28">
                          <img src={productPhotoPreview} alt="Product" className="w-full h-full object-contain rounded-lg" />
                        </div>
                      ) : (
                        <div className="py-3 flex flex-col items-center justify-center">
                          <UploadCloud className="text-purple-400/80 mb-2 group-hover:text-purple-300 transition-colors" size={26} />
                          <span className="text-xs font-semibold text-slate-300">Click to upload</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, WEBP (Max 5MB)</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'product')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                  
                  {/* Final Photo */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-purple-400 mb-2">
                      <ImageIcon size={13} />
                      <span className="text-slate-300 font-medium">Dispatch Photo</span>
                    </div>
                    <div className="border border-dashed border-slate-700/80 hover:border-purple-500/70 bg-[#0b101b]/60 rounded-xl p-3 text-center relative transition-colors group cursor-pointer min-h-[140px] flex items-center justify-center">
                      {dispatchPhotoPreview ? (
                        <div className="relative w-full h-28">
                          <img src={dispatchPhotoPreview} alt="Dispatch" className="w-full h-full object-contain rounded-lg" />
                        </div>
                      ) : (
                        <div className="py-3 flex flex-col items-center justify-center">
                          <UploadCloud className="text-purple-400/80 mb-2 group-hover:text-purple-300 transition-colors" size={26} />
                          <span className="text-xs font-semibold text-slate-300">Click to upload</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, WEBP (Max 5MB)</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'dispatch')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispatch Logistics */}
              <div className="bg-[#0e1626]/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="text-purple-400 mt-0.5">
                    <Truck size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Dispatch Logistics</h3>
                    <p className="text-xs text-slate-400">Add courier and tracking details.</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <Truck size={13} className="text-slate-400 shrink-0" />
                        <span>Courier Partner</span>
                      </label>
                      <select 
                        value={courierPartner} 
                        onChange={e => setCourierPartner(e.target.value)} 
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
                      >
                        <option value="">Select Partner</option>
                        <option value="ST Courier">ST Courier</option>
                        <option value="India Post">India Post</option>
                        <option value="Delhivery">Delhivery</option>
                        <option value="DTDC">DTDC</option>
                        <option value="IThink Ekart">IThink Ekart</option>
                        <option value="IThink Amazon">IThink Amazon</option>
                        <option value="IThink Delhivery">IThink Delhivery</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <Hash size={13} className="text-slate-400 shrink-0" />
                        <span>Tracking ID</span>
                      </label>
                      <input 
                        type="text" 
                        value={trackingId} 
                        onChange={e => setTrackingId(e.target.value)} 
                        placeholder="Tracking ID"
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        <span>Dispatch Date</span>
                      </label>
                      <input 
                        type="date" 
                        value={dispatchDate} 
                        onChange={e => setDispatchDate(e.target.value)} 
                        required 
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500 [color-scheme:dark] transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        <span>Expected Delivery</span>
                      </label>
                      <input 
                        type="date" 
                        value={expectedDeliveryDate} 
                        onChange={e => setExpectedDeliveryDate(e.target.value)} 
                        className="w-full bg-[#0b101b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500 [color-scheme:dark] transition-colors" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex justify-end items-center gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isSubmitting} 
              className="px-5 py-2.5 bg-[#151c2c] hover:bg-[#1e273d] text-slate-300 hover:text-white border border-slate-700/80 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || selectedProducts.length === 0} 
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>Saving...</>
              ) : (
                <>
                  <Truck size={16} />
                  Dispatch
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

