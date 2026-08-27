import React, { useState, useEffect } from 'react';
import { X, Package, Truck, UploadCloud, Image as ImageIcon } from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { useDispatch } from '../../hooks/marketing/useDispatch';
import toast from 'react-hot-toast';
import { calculateInstagramViewCode, calculateFacebookViewCode, calculateYoutubeViewCode } from './AddCampaignInfluencer';

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

interface DispatchInfluencerModalProps {
  influencer: CampaignInfluencer;
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}

export const DispatchInfluencerModal: React.FC<DispatchInfluencerModalProps> = ({ influencer, campaign, onClose, onSuccess }) => {
  const { dispatchInfluencer, isSubmitting } = useDispatch();
  
  // Form State
  const [phone, setPhone] = useState(influencer.phone_number || '');
  const [altPhone, setAltPhone] = useState(influencer.alternative_number || '');
  const [address, setAddress] = useState(influencer.complete_address || '');
  const [state, setState] = useState(influencer.state || '');
  const [productName, setProductName] = useState('');
  
  // Products State
  const initialProducts = (influencer.products || [])
    .filter((p: any) => p.selected && p.qty && p.qty > 0)
    .map((p: any) => ({ ...p, quantity: p.qty })); // Map legacy qty to quantity for consistency
    
  const [selectedProducts] = useState(initialProducts);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalValue, setTotalValue] = useState('0');
  const [totalWeight, setTotalWeight] = useState('');
  
  // Dispatch Details
  const [courierPartner, setCourierPartner] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  
  // Photos
  const [productPhotoFile, setProductPhotoFile] = useState<File | null>(null);
  const [productPhotoPreview, setProductPhotoPreview] = useState<string | null>(null);
  const [dispatchPhotoFile, setDispatchPhotoFile] = useState<File | null>(null);
  const [dispatchPhotoPreview, setDispatchPhotoPreview] = useState<string | null>(null);

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
    if (!influencer.influencer_name || !dispatchDate) {
      toast.error('Please fill in Creator Name and Dispatch Date.');
      return;
    }
    
    if (selectedProducts.length === 0) {
      toast.error('No selected products found for this influencer.');
      return;
    }

    const payload = {
      influencer_id: influencer.id,
      campaign_id: campaign.id,
      creator_name: influencer.influencer_name,
      phone_number: phone,
      alternative_phone_number: altPhone,
      address,
      state,
      campaign_name: campaign.campaign_name,
      product_name: productName,
      selected_products: selectedProducts,
      total_products: totalProducts,
      total_product_value: totalValue ? parseFloat(totalValue) : null,
      total_weight: totalWeight,
      product_photo_url: null,
      courier_partner: courierPartner,
      dispatch_photo_url: null,
      tracking_id: trackingId,
      dispatch_date: dispatchDate,
      expected_delivery_date: expectedDeliveryDate || null,
      dispatch_status: 'Dispatched',
      influencer_code: influencer.code || null
    };

    const success = await dispatchInfluencer(payload, productPhotoFile, dispatchPhotoFile);
    if (success) {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 animate-fade-in">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="text-emerald-400" /> Dispatch Influencer: {influencer.influencer_name}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800 rounded-lg border border-slate-600 hover:border-slate-500">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column */}
            <div className="space-y-6">
              
              {/* Campaign & Influencer Info */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><Truck size={16} className="text-blue-400"/> Campaign & Influencer</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Creator Name</label>
                      <input type="text" value={influencer.influencer_name || ''} readOnly className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Influencer Code</label>
                      <input 
                        type="text" 
                        value={influencer.code || ''} 
                        readOnly 
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-purple-450 font-mono font-bold cursor-not-allowed select-all" 
                      />
                      <span className="text-[9px] text-slate-500 mt-1 block leading-none">Assigned influencer code</span>
                    </div>
                  </div>

                  {(() => {
                    const getDisplayViewCode = (platformName: string): string => {
                      if (platformName === 'Instagram') {
                        return influencer.instagram_view_code || '—';
                      }
                      if (platformName === 'Facebook') {
                        return influencer.facebook_view_code || '—';
                      }
                      if (platformName === 'Youtube') {
                        return influencer.youtube_view_code || '—';
                      }
                      return '—';
                    };

                    const displayInsta = getDisplayViewCode('Instagram');
                    const displayFb = getDisplayViewCode('Facebook');
                    const displayYt = getDisplayViewCode('Youtube');

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/30 p-2.5 rounded-lg border border-slate-800 mb-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Instagram</label>
                          <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border inline-block w-full text-center ${
                            displayInsta !== '—'
                              ? 'bg-purple-900/30 text-purple-400 border-purple-800/30'
                              : 'bg-slate-900/40 text-slate-500 border-slate-800/30'
                          }`}>
                            {displayInsta}
                          </span>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Facebook</label>
                          <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border inline-block w-full text-center ${
                            displayFb !== '—'
                              ? 'bg-purple-900/30 text-purple-400 border-purple-800/30'
                              : 'bg-slate-900/40 text-slate-500 border-slate-800/30'
                          }`}>
                            {displayFb}
                          </span>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">YouTube</label>
                          <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border inline-block w-full text-center ${
                            displayYt !== '—'
                              ? 'bg-purple-900/30 text-purple-400 border-purple-800/30'
                              : 'bg-slate-900/40 text-slate-500 border-slate-800/30'
                          }`}>
                            {displayYt}
                          </span>
                        </div>
                        <div className="col-span-1 sm:col-span-3 text-center">
                          <span className="text-[9px] text-slate-500 block leading-tight">Automatically calculated from platform views</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Row 2: Phone Number | Alt Phone */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                      <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Alt Phone</label>
                      <input type="text" value={altPhone} onChange={e => setAltPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                    </div>
                  </div>

                  {/* Row 3: Address (full width) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Address</label>
                    <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"></textarea>
                  </div>

                  {/* Row 4: State | Campaign Name */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">State</label>
                      <input type="text" value={state} onChange={e => setState(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Campaign Name</label>
                      <input type="text" value={campaign.campaign_name || ''} readOnly className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
                    </div>
                  </div>

                  {/* Row 5: Product Name (General) (full width) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Product Name (General)</label>
                    <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Skin Care Kit" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </div>

              {/* Campaign Products */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><Package size={16} className="text-purple-400"/> Campaign Products</h3>
                <div className="space-y-4">
                  <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 min-h-[100px] max-h-[200px] overflow-y-auto">
                    {selectedProducts.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedProducts.map((p: any, idx: number) => {
                          const unitPrice = getProductPrice(p.product_name);
                          return (
                            <li key={idx} className="flex justify-between items-center text-sm border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                              <div className="flex flex-col">
                                <span className="text-slate-300 font-medium">{p.product_name}</span>
                                <span className="text-[10px] text-slate-500">₹{unitPrice.toLocaleString('en-IN')} / unit</span>
                              </div>
                              <span className="bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-mono border border-slate-700/50 text-xs">Qty: {p.quantity}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-slate-500 text-sm text-center italic py-4">No products selected for this influencer.</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Total Products</label>
                      <input type="number" value={totalProducts} readOnly className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-450 cursor-not-allowed font-medium" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Total Value (₹)</label>
                      <input 
                        type="text" 
                        value={totalValue ? `₹${Number(totalValue).toLocaleString('en-IN')}` : '₹0'} 
                        readOnly 
                        className="w-full bg-slate-900 border border-slate-705 rounded-lg px-3 py-2 text-sm text-slate-450 cursor-not-allowed font-semibold" 
                      />
                      <span className="text-[9px] text-slate-500 mt-1 block leading-tight">Auto calculated from campaign products</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Total Weight</label>
                      <input type="text" value={totalWeight} onChange={e => setTotalWeight(e.target.value)} placeholder="e.g. 500g" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column */}
            <div className="space-y-6">
              
              {/* Product Shipment (Photos) */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                 <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><ImageIcon size={16} className="text-yellow-400"/> Photos</h3>
                 <div className="grid grid-cols-2 gap-4">
                    {/* Pack Photo */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Product Photo</label>
                      <div className="border-2 border-dashed border-slate-600 rounded-lg p-2 text-center relative hover:border-emerald-500 transition-colors bg-slate-900">
                        {productPhotoPreview ? (
                          <div className="relative aspect-video">
                            <img src={productPhotoPreview} alt="Product" className="w-full h-full object-contain rounded" />
                          </div>
                        ) : (
                          <div className="py-6 flex flex-col items-center">
                            <UploadCloud className="text-slate-500 mb-2" size={24} />
                            <span className="text-xs text-slate-400">Click to upload</span>
                          </div>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'product')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </div>
                    </div>
                    
                    {/* Final Photo */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Dispatch Photo</label>
                      <div className="border-2 border-dashed border-slate-600 rounded-lg p-2 text-center relative hover:border-emerald-500 transition-colors bg-slate-900">
                        {dispatchPhotoPreview ? (
                          <div className="relative aspect-video">
                            <img src={dispatchPhotoPreview} alt="Dispatch" className="w-full h-full object-contain rounded" />
                          </div>
                        ) : (
                          <div className="py-6 flex flex-col items-center">
                            <UploadCloud className="text-slate-500 mb-2" size={24} />
                            <span className="text-xs text-slate-400">Click to upload</span>
                          </div>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'dispatch')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </div>
                    </div>
                 </div>
              </div>

              {/* Dispatch Details */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><Truck size={16} className="text-emerald-400"/> Dispatch Logistics</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Courier Partner</label>
                      <select value={courierPartner} onChange={e => setCourierPartner(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                        <option value="">Select Partner</option>
                        <option value="ST Courier">ST Courier</option>
                        <option value="India Post">India Post</option>
                        <option value="Delhivery">Delhivery</option>
                        <option value="Blue Dart">Blue Dart</option>
                        <option value="DTDC">DTDC</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Tracking ID</label>
                      <input type="text" value={trackingId} onChange={e => setTrackingId(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Dispatch Date</label>
                      <input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Expected Delivery</label>
                      <input type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 [color-scheme:dark]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-6 py-2 bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || selectedProducts.length === 0} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-colors disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? (
                 <>Saving...</>
              ) : (
                 <>Confirm Dispatch <Truck size={18} /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
