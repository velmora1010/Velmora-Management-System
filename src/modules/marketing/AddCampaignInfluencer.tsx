import React, { useState, useEffect } from 'react';
import type { Campaign, CampaignInfluencer, InfluencerPlatformDetail, InfluencerPricing, InfluencerProduct, InfluencerBrandPerformance } from '../../types';
import { Save, X } from 'lucide-react';
import { useCampaignInfluencers } from '../../hooks/marketing/useCampaignInfluencers';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export const PRODUCT_LIST = [
  'DIY Dishwash Liquid',
  'DIY Fabric Conditioner',
  'DIY Detergent Liquid',
  'Magic Sponge',
  'Kitchen Cleaner',
  'Car Wash',
  'Bike Wash',
  'BBC',
  'Hand Wash',
  'Glass Cleaner',
  'Bamboo Towel',
  'Floor Cleaner'
];

export interface VideoPricingDetail {
  combination: string;
  amount: number;
}

export const COMBINATIONS = [
  'Detergent',
  'Detergent & Dishwash',
  'Detergent & Comfort',
  'Dishwash, Detergent & Comfort',
  'Kitchen Cleaner & Bamboo Towel',
  'Sponge',
  'Bike Wash',
  'Car Wash',
  'BBC',
  'Hand Wash & Floor Cleaner',
  'Glass Cleaner',
  'Kitchen Cleaner',
  '5-6 Products'
];

interface AddCampaignInfluencerProps {
  campaign: Campaign;
  initialData?: CampaignInfluencer;
  onBack: () => void;
}

type TabKey = 'basic' | 'platform' | 'pricing' | 'products' | 'performance';

export const AddCampaignInfluencer: React.FC<AddCampaignInfluencerProps> = ({ campaign, initialData, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const { addInfluencer, updateInfluencer, isSaving } = useCampaignInfluencers(campaign.id);

  // Form State
  const [basicInfo, setBasicInfo] = useState<Partial<CampaignInfluencer>>({
    name: '',
    influencer_name: '',
    phone_number: '',
    alternative_number: '',
    upi_number: '',
    city: '',
    complete_address: '',
    state: '',
    languages: [],
    profile_file_url: '',
    auto_dm: false
  });

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  const [platformAvailability, setPlatformAvailability] = useState<string>('All');
  const [platformAgreed, setPlatformAgreed] = useState<string>('All');

  const [platforms, setPlatforms] = useState<InfluencerPlatformDetail[]>([
    { platform: 'Instagram', username: '', profile_link: '', followers_count: 0, video_views: Array(15).fill('') as unknown as number[] },
    { platform: 'Youtube', username: '', profile_link: '', followers_count: 0, video_views: Array(15).fill('') as unknown as number[] },
    { platform: 'Facebook', username: '', profile_link: '', followers_count: 0, video_views: Array(15).fill('') as unknown as number[] }
  ]);
  
  const [videos, setVideos] = useState<VideoPricingDetail[]>([
    { combination: '', amount: 0 }
  ]);

  const [pricing, setPricing] = useState<InfluencerPricing>({
    video1_count: 1,
    video1_price: 0,
    video2_count: 0,
    video2_price: 0,
    total_videos: 1,
    final_price: 0,
    bargainHistory: [{ creator_request: 0, brand_request: 0 }],
    product_pricing: { videos: [{ combination: '', amount: 0 }] }
  });

  const [products, setProducts] = useState<InfluencerProduct[]>([]);
  const [performance, setPerformance] = useState<InfluencerBrandPerformance[]>([]);

  useEffect(() => {
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBasicInfo({
        name: initialData.name || '',
        influencer_name: initialData.influencer_name || '',
        phone_number: initialData.phone_number || '',
        alternative_number: initialData.alternative_number || '',
        upi_number: initialData.upi_number || '',
        city: initialData.city || '',
        complete_address: initialData.complete_address || '',
        state: initialData.state || '',
        languages: initialData.languages || [],
        profile_file_url: initialData.profile_file_url || '',
        auto_dm: initialData.auto_dm || false
      });
      if (initialData.profile_file_url) {
        setUploadedFileName(initialData.profile_file_url.split('/').pop() || 'Existing File');
      }

      // Platforms mapping
      let pAvail = 'All';
      if (initialData.platforms && initialData.platforms.length > 0) {
        const pNames = initialData.platforms.map(p => p.platform.toLowerCase());
        const hasInsta = pNames.includes('instagram');
        const hasYoutube = pNames.includes('youtube');
        const hasFb = pNames.includes('facebook');

        if (hasInsta && hasYoutube && hasFb) pAvail = 'All';
        else if (hasInsta && hasYoutube) pAvail = 'Instagram and Youtube';
        else if (hasInsta && hasFb) pAvail = 'Instagram and Facebook';
        else if (hasYoutube && hasFb) pAvail = 'Youtube and Facebook';
        else if (hasInsta) pAvail = 'Instagram';
        else if (hasYoutube) pAvail = 'Youtube';
        else if (hasFb) pAvail = 'Facebook';
        setPlatformAvailability(pAvail);
        
        setPlatforms(prev => prev.map(p => {
          const match = initialData.platforms?.find(x => x.platform.toLowerCase() === p.platform.toLowerCase());
          if (match) {
             const views = Array.isArray(match.video_views) ? match.video_views : [];
             const paddedViews = [...views, ...Array(15).fill('')].slice(0, 15);
             return { ...p, ...match, platform: p.platform, video_views: paddedViews as unknown as number[] };
          }
          return p;
        }));
      }

      if (initialData.pricing) {
        const v1c = Number(initialData.pricing.video1_count) || 0;
        const v1p = Number(initialData.pricing.video1_price) || 0;
        const v2c = Number(initialData.pricing.video2_count) || 0;
        const v2p = Number(initialData.pricing.video2_price) || 0;
        const prodPricing = (initialData.pricing as any).product_pricing || {};

        let loadedVideos: VideoPricingDetail[] = [];
        if (Array.isArray(prodPricing?.videos)) {
          loadedVideos = prodPricing.videos.map((v: any) => {
            if (v && typeof v === 'object' && 'combination' in v) {
              return {
                combination: v.combination || '',
                amount: Number(v.amount) || 0
              };
            } else if (typeof v === 'number' || typeof v === 'string') {
              return {
                combination: '',
                amount: Number(v) || 0
              };
            }
            return { combination: '', amount: 0 };
          });
        } else {
          // Fallback to legacy count & price fields
          if (v1c > 0) {
            for (let i = 0; i < v1c; i++) {
              loadedVideos.push({ combination: '', amount: v1p });
            }
          }
          if (v2c > 0) {
            for (let i = 0; i < v2c; i++) {
              loadedVideos.push({ combination: '', amount: v2p });
            }
          }
        }

        if (loadedVideos.length === 0) {
          loadedVideos = [{ combination: '', amount: 0 }];
        }

        setVideos(loadedVideos);

        const bHistory = (initialData.pricing as any).bargainHistory || [];
        const cleanBHistory = bHistory.length > 0 ? bHistory : [{ creator_request: 0, brand_request: 0 }];

        setPricing({
          video1_count: v1c,
          video1_price: v1p,
          video2_count: v2c,
          video2_price: v2p,
          total_videos: loadedVideos.length,
          final_price: loadedVideos.reduce((a, b) => a + b.amount, 0),
          bargainHistory: cleanBHistory,
          product_pricing: prodPricing
        });
      }

      if (initialData.products) {
        setProducts(initialData.products.map(p => ({ ...p, selected: true })));
      }

      const perfData = initialData.brandPerformance || initialData.performance;
      if (perfData) {
        setPerformance(perfData);
      }
    }
  }, [initialData]);

  // Helpers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setUploadError('');
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('influencer-profiles')
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage
        .from('influencer-profiles')
        .getPublicUrl(filePath);

      setBasicInfo(prev => ({ ...prev, profile_file_url: publicData.publicUrl }));
      setUploadedFileName(file.name);
    } catch (err: unknown) {
      console.error("Upload error:", err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleBasicChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setBasicInfo(prev => ({ ...prev, [name]: checked }));
    } else {
      setBasicInfo(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLanguageToggle = (lang: string) => {
    setBasicInfo(prev => {
      const langs = prev.languages || [];
      if (langs.includes(lang)) {
        return { ...prev, languages: langs.filter(l => l !== lang) };
      }
      return { ...prev, languages: [...langs, lang] };
    });
  };

  const getVisiblePlatforms = () => {
    const map: Record<string, string[]> = {
      'Instagram': ['Instagram'],
      'Youtube': ['Youtube'],
      'Facebook': ['Facebook'],
      'Instagram and Youtube': ['Instagram', 'Youtube'],
      'Instagram and Facebook': ['Instagram', 'Facebook'],
      'Youtube and Facebook': ['Youtube', 'Facebook'],
      'All': ['Instagram', 'Youtube', 'Facebook']
    };
    return map[platformAvailability] || [];
  };

  const updatePlatform = <K extends keyof InfluencerPlatformDetail>(idx: number, field: K, value: InfluencerPlatformDetail[K]) => {
    const updated = [...platforms];
    updated[idx] = { ...updated[idx], [field]: value };
    setPlatforms(updated);
  };

  const handleVideoFieldChange = (index: number, field: keyof VideoPricingDetail, value: any) => {
    const nextVideos = [...videos];
    nextVideos[index] = {
      ...nextVideos[index],
      [field]: field === 'amount' ? (parseFloat(value) || 0) : value
    };
    setVideos(nextVideos);

    const total = nextVideos.reduce((sum, v) => sum + v.amount, 0);
    setPricing(prev => {
      const updated = {
        ...prev,
        total_videos: nextVideos.length,
        final_price: total,
        product_pricing: {
          ...prev.product_pricing,
          videos: nextVideos
        }
      };

      // Synchronize with legacy fields for database and analytics compatibility
      updated.video1_count = nextVideos.length > 0 ? 1 : 0;
      updated.video1_price = nextVideos.length > 0 ? nextVideos[0].amount : 0;
      if (nextVideos.length > 1) {
        updated.video2_count = nextVideos.length - 1;
        const remainingSum = nextVideos.slice(1).reduce((a, b) => a + b.amount, 0);
        updated.video2_price = Math.round(remainingSum / (nextVideos.length - 1));
      } else {
        updated.video2_count = 0;
        updated.video2_price = 0;
      }

      return updated;
    });
  };

  const handleAddVideo = () => {
    const lastVideo = videos[videos.length - 1];
    if (!lastVideo || !lastVideo.combination || !lastVideo.amount || lastVideo.amount <= 0) {
      toast.error(`Please select a combination and enter the amount for Video ${videos.length}.`);
      return;
    }

    const nextVideos = [...videos, { combination: '', amount: 0 }];
    setVideos(nextVideos);

    const total = nextVideos.reduce((sum, v) => sum + v.amount, 0);
    setPricing(prev => {
      const updated = {
        ...prev,
        total_videos: nextVideos.length,
        final_price: total,
        product_pricing: {
          ...prev.product_pricing,
          videos: nextVideos
        }
      };

      // Synchronize with legacy fields
      updated.video1_count = nextVideos.length > 0 ? 1 : 0;
      updated.video1_price = nextVideos.length > 0 ? nextVideos[0].amount : 0;
      if (nextVideos.length > 1) {
        updated.video2_count = nextVideos.length - 1;
        const remainingSum = nextVideos.slice(1).reduce((a, b) => a + b.amount, 0);
        updated.video2_price = Math.round(remainingSum / (nextVideos.length - 1));
      } else {
        updated.video2_count = 0;
        updated.video2_price = 0;
      }

      return updated;
    });
  };

  const handleDeleteVideo = (index: number) => {
    const nextVideos = videos.filter((_, i) => i !== index);
    const finalVideos = nextVideos.length > 0 ? nextVideos : [{ combination: '', amount: 0 }];
    setVideos(finalVideos);

    const total = finalVideos.reduce((sum, v) => sum + v.amount, 0);
    setPricing(prev => {
      const updated = {
        ...prev,
        total_videos: finalVideos.length,
        final_price: total,
        product_pricing: {
          ...prev.product_pricing,
          videos: finalVideos
        }
      };

      // Synchronize with legacy fields
      updated.video1_count = finalVideos.length > 0 ? 1 : 0;
      updated.video1_price = finalVideos.length > 0 ? finalVideos[0].amount : 0;
      if (finalVideos.length > 1) {
        updated.video2_count = finalVideos.length - 1;
        const remainingSum = finalVideos.slice(1).reduce((a, b) => a + b.amount, 0);
        updated.video2_price = Math.round(remainingSum / (finalVideos.length - 1));
      } else {
        updated.video2_count = 0;
        updated.video2_price = 0;
      }

      return updated;
    });
  };

  const handleProductChange = (videoNum: number, productName: string, field: 'selected' | 'qty', value: boolean | number) => {
    setProducts(prev => {
      const existingIdx = prev.findIndex(p => p.video_number === videoNum && p.product_name === productName);
      if (existingIdx !== -1) {
        const next = [...prev];
        if (field === 'selected') {
          const isSelected = value as boolean;
          next[existingIdx] = {
            ...next[existingIdx],
            selected: isSelected,
            qty: isSelected ? (next[existingIdx].qty || 1) : 0
          };
        } else {
          next[existingIdx] = {
            ...next[existingIdx],
            qty: value as number
          };
        }
        return next;
      } else {
        const newProd: InfluencerProduct = {
          video_number: videoNum,
          product_name: productName,
          selected: field === 'selected' ? (value as boolean) : false,
          qty: field === 'selected' ? (value ? 1 : 0) : (value as number)
        };
        if (field === 'qty' && (value as number) > 0) {
          newProd.selected = true;
        }
        return [...prev, newProd];
      }
    });
  };

  const addPerformance = () => {
    setPerformance([...performance, { brand_name: '', product_name: '', views: '', uploaded_platforms: 'All' }]);
  };

  const updatePerformance = <K extends keyof InfluencerBrandPerformance>(idx: number, field: K, value: InfluencerBrandPerformance[K]) => {
    const updated = [...performance];
    updated[idx] = { ...updated[idx], [field]: value };
    setPerformance(updated);
  };

  const handleSave = async () => {
    try {
      const visiblePlats = getVisiblePlatforms();
      const cleanedPlatforms = platforms
        .filter(p => visiblePlats.includes(p.platform))
        .filter(p => p.username || p.profile_link)
        .map(p => ({
          ...p,
          video_views: Array.isArray(p.video_views) 
            ? p.video_views.map(v => parseInt(v as unknown as string) || 0)
            : []
        }));

      const cleanedProducts = products.filter(p => p.selected && p.video_number && p.video_number <= (pricing.total_videos || 0));

      const payload = {
        ...basicInfo,
        platforms: cleanedPlatforms,
        pricing,
        products: cleanedProducts,
        performance
      };

      const success = initialData?.id 
        ? await updateInfluencer(initialData.id, payload)
        : await addInfluencer(payload);
        
      if (success) {
        toast.success(initialData?.id ? 'Influencer updated successfully!' : 'Influencer saved successfully!');
        onBack();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message ??
        err?.details ??
        JSON.stringify(err, null, 2)
      );
    }
  };

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50 gap-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          {initialData?.id ? 'Edit Influencer in' : 'Add Influencer to'} {campaign.campaign_name}
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={onBack}
            className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} /> {isSaving ? 'Saving...' : (initialData?.id ? 'Update Influencer' : 'Save Influencer')}
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-700 overflow-x-auto hide-scrollbar">
        {[
          { id: 'basic', label: 'Basic Info' },
          { id: 'platform', label: 'Platform Details' },
          { id: 'pricing', label: 'Pricing Info' },
          { id: 'products', label: 'Products' },
          { id: 'performance', label: 'Brand Performance' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabKey)}
            className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id 
                ? 'border-purple-500 text-purple-400 bg-purple-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 h-[500px] overflow-y-auto">
        {activeTab === 'basic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">User Name</label>
                <input 
                  type="text" name="name" value={basicInfo.name} onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                  placeholder="Enter user name"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Influencer Name</label>
                <input 
                  type="text" name="influencer_name" value={basicInfo.influencer_name} onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                  placeholder="Enter influencer name"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
                <input 
                  type="tel" name="phone_number" value={basicInfo.phone_number} onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Alternative Number</label>
                <input 
                  type="tel" name="alternative_number" value={basicInfo.alternative_number} onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                  placeholder="Enter alt number"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">UPI Number</label>
                <input 
                  type="text" name="upi_number" value={basicInfo.upi_number} onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                  placeholder="Enter UPI"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">City</label>
                <input 
                  type="text" name="city" value={basicInfo.city} onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                  placeholder="Enter city"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Complete Address</label>
                <input 
                  type="text" name="complete_address" value={basicInfo.complete_address} onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                  placeholder="Enter address"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">State</label>
                <select 
                  name="state" value={basicInfo.state} onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                >
                  <option value="">Select State</option>
                  <option value="Andhra Pradesh">Andhra Pradesh</option>
                  <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                  <option value="Assam">Assam</option>
                  <option value="Bihar">Bihar</option>
                  <option value="Chhattisgarh">Chhattisgarh</option>
                  <option value="Goa">Goa</option>
                  <option value="Gujarat">Gujarat</option>
                  <option value="Haryana">Haryana</option>
                  <option value="Himachal Pradesh">Himachal Pradesh</option>
                  <option value="Jharkhand">Jharkhand</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Kerala">Kerala</option>
                  <option value="Madhya Pradesh">Madhya Pradesh</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Manipur">Manipur</option>
                  <option value="Meghalaya">Meghalaya</option>
                  <option value="Mizoram">Mizoram</option>
                  <option value="Nagaland">Nagaland</option>
                  <option value="Odisha">Odisha</option>
                  <option value="Punjab">Punjab</option>
                  <option value="Rajasthan">Rajasthan</option>
                  <option value="Sikkim">Sikkim</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Telangana">Telangana</option>
                  <option value="Tripura">Tripura</option>
                  <option value="Uttar Pradesh">Uttar Pradesh</option>
                  <option value="Uttarakhand">Uttarakhand</option>
                  <option value="West Bengal">West Bengal</option>
                  <option value="Andaman and Nicobar Islands">Andaman and Nicobar Islands</option>
                  <option value="Chandigarh">Chandigarh</option>
                  <option value="Dadra and Nagar Haveli and Daman and Diu">Dadra and Nagar Haveli and Daman and Diu</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Jammu and Kashmir">Jammu and Kashmir</option>
                  <option value="Ladakh">Ladakh</option>
                  <option value="Lakshadweep">Lakshadweep</option>
                  <option value="Puducherry">Puducherry</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Languages</label>
                <div className="flex flex-wrap gap-2">
                  {['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Magahi', 'Other'].map(lang => (
                    <label key={lang} className="flex items-center gap-2 text-sm text-slate-300">
                      <input 
                        type="checkbox" 
                        checked={(basicInfo.languages || []).includes(lang)}
                        onChange={() => handleLanguageToggle(lang)}
                        className="rounded border-slate-600 bg-slate-900 text-purple-600 focus:ring-purple-500"
                      />
                      {lang}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
                <span className="text-sm text-slate-300">Auto DM Tool</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="auto_dm" checked={basicInfo.auto_dm} onChange={handleBasicChange} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Influencer Profile Image</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
                    {isUploadingImage ? 'Uploading...' : 'Choose File'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                      disabled={isUploadingImage}
                    />
                  </label>
                  {uploadedFileName && (
                    <span className="text-sm text-emerald-400 truncate max-w-[150px]" title={uploadedFileName}>
                      {uploadedFileName}
                    </span>
                  )}
                  {uploadError && (
                    <span className="text-sm text-red-400 truncate max-w-[150px]" title={uploadError}>
                      {uploadError}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'platform' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Platform Availability</label>
                <select 
                  value={platformAvailability}
                  onChange={e => setPlatformAvailability(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-sm"
                >
                  <option value="All">All</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Youtube">Youtube</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram and Youtube">Instagram and Youtube</option>
                  <option value="Instagram and Facebook">Instagram and Facebook</option>
                  <option value="Youtube and Facebook">Youtube and Facebook</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Platform Agreed</label>
                <select 
                  value={platformAgreed}
                  onChange={e => setPlatformAgreed(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-sm"
                >
                  <option value="All">All</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Youtube">Youtube</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram and Youtube">Instagram and Youtube</option>
                  <option value="Instagram and Facebook">Instagram and Facebook</option>
                  <option value="Youtube and Facebook">Youtube and Facebook</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-4">
              {platforms.map((p, idx) => {
                if (!getVisiblePlatforms().includes(p.platform)) return null;

                return (
                  <div key={p.platform} className="bg-slate-900 p-4 rounded-xl border border-slate-700 relative">
                    <h4 className="text-md font-semibold text-purple-400 mb-4">{p.platform} Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Username</label>
                        <input 
                          type="text" value={p.username} onChange={e => updatePlatform(idx, 'username', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm" 
                          placeholder="@username"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Profile Link</label>
                        <input 
                          type="text" value={p.profile_link} onChange={e => updatePlatform(idx, 'profile_link', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm" 
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Followers Count</label>
                        <input 
                          type="number" value={p.followers_count || ''} onChange={e => updatePlatform(idx, 'followers_count', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm" 
                          placeholder="e.g. 100000"
                        />
                      </div>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-400 mb-3 mt-5">Previous 15 Videos Views</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-5 gap-3">
                      {Array.from({ length: 15 }).map((_, vIdx) => (
                        <div key={vIdx} className="form-group">
                          <label className="block text-[11px] text-slate-500 mb-1 font-medium">Video {vIdx + 1}</label>
                          <input 
                            type="number" 
                            value={Array.isArray(p.video_views) && p.video_views[vIdx] === 0 && !p.video_views.some(v=>v!==0 && String(v)!=='') ? '' : (Array.isArray(p.video_views) ? p.video_views[vIdx] : '')} 
                            onChange={e => {
                              const newViews = Array.isArray(p.video_views) ? [...p.video_views] : Array(15).fill('');
                              newViews[vIdx] = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                              updatePlatform(idx, 'video_views', newViews as unknown as number[]);
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-slate-200 text-xs text-center" 
                            placeholder="Views"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="space-y-8 animate-fade-in">
            {/* Video Pricing Table */}
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-12 gap-3 border-b border-slate-700 pb-2 text-sm font-semibold text-slate-400">
                <div className="col-span-2">Video</div>
                <div className="col-span-6">Combination</div>
                <div className="col-span-3">Amount</div>
                <div className="col-span-1"></div>
              </div>
              
              {videos.map((v, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-slate-900/40 p-2 rounded-lg border border-slate-700/50">
                  <div className="col-span-2 text-sm text-slate-200 font-medium">Video {idx + 1}</div>
                  <div className="col-span-6">
                    <select 
                      value={v.combination}
                      onChange={e => handleVideoFieldChange(idx, 'combination', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Select Combination</option>
                      {COMBINATIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input 
                      type="number" 
                      value={v.amount === 0 ? '' : v.amount} 
                      onChange={e => handleVideoFieldChange(idx, 'amount', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm focus:border-purple-500 focus:outline-none" 
                      placeholder="₹ Amount" min="0"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button 
                      type="button"
                      onClick={() => handleDeleteVideo(idx)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="Remove Video"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {(() => {
                const lastVideo = videos[videos.length - 1];
                const isAddVideoDisabled = !lastVideo || !lastVideo.combination || !lastVideo.amount || lastVideo.amount <= 0;
                return (
                  <button 
                    type="button"
                    onClick={handleAddVideo}
                    disabled={isAddVideoDisabled}
                    className={`mt-2 px-3 py-1.5 text-sm rounded-lg transition-colors border flex items-center gap-1.5 ${isAddVideoDisabled ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white border-slate-600'}`}
                  >
                    + Add Video
                  </button>
                );
              })()}
            </div>

            {/* Total calculations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-700 pt-6">
              <div>
                <label className="block text-sm text-slate-400 mb-1 font-medium">Total Videos</label>
                <input 
                  type="number" 
                  value={pricing.total_videos === 0 ? '' : pricing.total_videos} 
                  readOnly
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-400 cursor-not-allowed text-sm" 
                  placeholder="Auto Calculated"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1 font-medium">Final Price</label>
                <input 
                  type="number" 
                  value={pricing.final_price === 0 ? '' : pricing.final_price} 
                  readOnly
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-400 cursor-not-allowed text-sm font-semibold" 
                  placeholder="Auto Calculated"
                />
              </div>
            </div>

            {/* Bargain History CSS Grid */}
            <div className="pt-8 mt-4 border-t border-slate-700">
              <h3 className="text-lg font-semibold text-purple-400 mb-6 pb-2 border-b border-slate-700">Bargain History</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(pricing.bargainHistory || []).map((bargain, idx) => (
                  <div key={idx} className="bg-slate-900 p-4 rounded-xl border border-slate-700 relative">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
                      <span className="text-sm font-bold text-slate-400">{idx + 1}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const newHistory = (pricing.bargainHistory || []).filter((_, i) => i !== idx);
                          const finalHistory = newHistory.length > 0 ? newHistory : [{ creator_request: 0, brand_request: 0 }];
                          setPricing(prev => ({ ...prev, bargainHistory: finalHistory }));
                        }}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                        title="Remove Bargain Set"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1 font-medium">Creator Request</label>
                        <input 
                          type="number" 
                          value={bargain.creator_request === 0 ? '' : bargain.creator_request} 
                          onChange={e => {
                            const newHistory = [...(pricing.bargainHistory || [])];
                            newHistory[idx] = { ...newHistory[idx], creator_request: parseFloat(e.target.value) || 0 };
                            setPricing(prev => ({ ...prev, bargainHistory: newHistory }));
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm" 
                          placeholder="Amount"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1 font-medium">Brand Request</label>
                        <input 
                          type="number" 
                          value={bargain.brand_request === 0 ? '' : bargain.brand_request} 
                          onChange={e => {
                            const newHistory = [...(pricing.bargainHistory || [])];
                            newHistory[idx] = { ...newHistory[idx], brand_request: parseFloat(e.target.value) || 0 };
                            setPricing(prev => ({ ...prev, bargainHistory: newHistory }));
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm" 
                          placeholder="Amount"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                type="button"
                onClick={() => {
                  setPricing(prev => ({
                    ...prev, 
                    bargainHistory: [...(prev.bargainHistory || []), { creator_request: 0, brand_request: 0 }]
                  }));
                }}
                className="mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors border border-slate-600"
              >
                + Add Set
              </button>
            </div>
          </div>
        )}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fade-in">
            {!pricing.total_videos || pricing.total_videos <= 0 ? (
              <div className="text-slate-500 text-center py-10 italic">Fill in Pricing Info first to generate product sections.</div>
            ) : (
              Array.from({ length: pricing.total_videos }).map((_, idx) => {
                const videoNum = idx + 1;
                const selectedCount = PRODUCT_LIST.filter(productName => 
                  products.find(p => p.video_number === videoNum && p.product_name === productName)?.selected
                ).length;
                return (
                  <div key={videoNum} className="mb-8 bg-slate-900/10 p-4 rounded-xl border border-slate-800/40">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                      <h4 className="text-base font-semibold text-purple-400">Video {videoNum}</h4>
                      <span className="text-xs bg-purple-950/60 text-purple-300 px-3 py-1 rounded-full border border-purple-800/40 font-medium">
                        {selectedCount} {selectedCount === 1 ? 'Product' : 'Products'} Selected
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {PRODUCT_LIST.map(productName => {
                        const prod = products.find(p => p.video_number === videoNum && p.product_name === productName) || { selected: false, qty: 0 };
                        return (
                          <div 
                            key={productName} 
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('.stepper-btn') || (e.target as HTMLElement).tagName === 'INPUT') return;
                              handleProductChange(videoNum, productName, 'selected', !prod.selected);
                            }}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between h-[110px] cursor-pointer select-none ${
                              prod.selected 
                                ? 'bg-purple-950/20 border-purple-500/80 text-purple-100 shadow-sm shadow-purple-500/10' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-850/50'
                            }`}
                          >
                            {/* Card Header: Checkbox + Name */}
                            <div className="flex items-start gap-2.5 min-w-0">
                              <input 
                                type="checkbox" 
                                checked={prod.selected}
                                onChange={e => handleProductChange(videoNum, productName, 'selected', e.target.checked)}
                                className="mt-0.5 rounded border-slate-600 bg-slate-950 text-purple-650 focus:ring-purple-500 shrink-0"
                              />
                              <span className={`text-xs font-semibold leading-tight select-none truncate ${prod.selected ? 'text-slate-100' : 'text-slate-300'}`} title={productName}>
                                {productName}
                              </span>
                            </div>

                            {/* Card Footer: Quantity Stepper */}
                            <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 mt-2">
                              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider select-none">Quantity</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!prod.selected}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentQty = prod.qty || 1;
                                    if (currentQty > 1) {
                                      handleProductChange(videoNum, productName, 'qty', currentQty - 1);
                                    }
                                  }}
                                  className={`stepper-btn w-6 h-6 rounded flex items-center justify-center text-sm font-bold border transition-colors ${
                                    prod.selected
                                      ? 'bg-slate-850 border-purple-500/40 text-purple-300 hover:bg-purple-900/30 hover:border-purple-500'
                                      : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                  }`}
                                >
                                  &minus;
                                </button>
                                <span className={`w-6 text-center text-xs font-semibold select-none ${prod.selected ? 'text-slate-100' : 'text-slate-550'}`}>
                                  {prod.selected ? (prod.qty || 1) : 0}
                                </span>
                                <button
                                  type="button"
                                  disabled={!prod.selected}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentQty = prod.qty || 1;
                                    handleProductChange(videoNum, productName, 'qty', currentQty + 1);
                                  }}
                                  className={`stepper-btn w-6 h-6 rounded flex items-center justify-center text-sm font-bold border transition-colors ${
                                    prod.selected
                                      ? 'bg-slate-850 border-purple-500/40 text-purple-300 hover:bg-purple-900/30 hover:border-purple-500'
                                      : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                  }`}
                                >
                                  &#43;
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {performance.map((p, idx) => {
                const getVisibleLinks = (val: string) => {
                  const map: Record<string, string[]> = {
                    'Instagram': ['ig'],
                    'Youtube': ['yt'],
                    'Facebook': ['fb'],
                    'Instagram and Youtube': ['ig', 'yt'],
                    'Instagram and Facebook': ['ig', 'fb'],
                    'Youtube and Facebook': ['yt', 'fb'],
                    'All': ['ig', 'yt', 'fb']
                  };
                  return map[val] || [];
                };
                
                const visibleLinks = getVisibleLinks(p.uploaded_platforms || 'All');

                return (
                  <div key={idx} className="bg-slate-900 p-5 rounded-xl border border-slate-700 relative shadow-sm">
                    <button 
                      onClick={() => setPerformance(performance.filter((_, i) => i !== idx))}
                      className="absolute top-4 right-4 px-2 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 rounded text-xs font-medium transition-colors"
                    >
                      Remove Set
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pr-20">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1 font-medium">Which Brand</label>
                        <input 
                          type="text" value={p.brand_name} onChange={e => updatePerformance(idx, 'brand_name', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm"
                          placeholder="Enter brand name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1 font-medium">Which Product</label>
                        <input 
                          type="text" value={p.product_name} onChange={e => updatePerformance(idx, 'product_name', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm"
                          placeholder="Enter product name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1 font-medium">Views</label>
                        <input 
                          type="number" value={p.views || ''} onChange={e => updatePerformance(idx, 'views', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm"
                          placeholder="Enter total views"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1 font-medium">Uploaded Platforms</label>
                        <select 
                          value={p.uploaded_platforms || 'All'} 
                          onChange={e => updatePerformance(idx, 'uploaded_platforms', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm"
                        >
                          <option value="All">All</option>
                          <option value="Instagram">Instagram</option>
                          <option value="Youtube">Youtube</option>
                          <option value="Facebook">Facebook</option>
                          <option value="Instagram and Youtube">Instagram and Youtube</option>
                          <option value="Instagram and Facebook">Instagram and Facebook</option>
                          <option value="Youtube and Facebook">Youtube and Facebook</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-5 border-t border-slate-800">
                      <h4 className="text-xs font-semibold text-slate-400 mb-4">Platform Links</h4>
                      <div className="space-y-3">
                        {visibleLinks.includes('ig') && (
                          <div>
                            <label className="block text-xs text-slate-400 mb-1 font-medium">Instagram Link</label>
                            <input 
                              type="url" value={p.instagram_link || ''} onChange={e => updatePerformance(idx, 'instagram_link', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm"
                              placeholder="https://instagram.com/..."
                            />
                          </div>
                        )}
                        {visibleLinks.includes('yt') && (
                          <div>
                            <label className="block text-xs text-slate-400 mb-1 font-medium">Youtube Link</label>
                            <input 
                              type="url" value={p.youtube_link || ''} onChange={e => updatePerformance(idx, 'youtube_link', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm"
                              placeholder="https://youtube.com/..."
                            />
                          </div>
                        )}
                        {visibleLinks.includes('fb') && (
                          <div>
                            <label className="block text-xs text-slate-400 mb-1 font-medium">Facebook Link</label>
                            <input 
                              type="url" value={p.facebook_link || ''} onChange={e => updatePerformance(idx, 'facebook_link', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm"
                              placeholder="https://facebook.com/..."
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button 
              onClick={addPerformance}
              className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors border border-slate-600"
            >
              + Add Performance
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
