import React, { useState, useEffect, useRef } from 'react';
import type { Campaign, CampaignInfluencer, InfluencerPlatformDetail, InfluencerPricing, InfluencerProduct, InfluencerBrandPerformance, InfluencerPostDate } from '../../types';
import { Save, X, Plus } from 'lucide-react';
import { useCampaignInfluencers, notifyInfluencerChange } from '../../hooks/marketing/useCampaignInfluencers';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { getDepartmentNavigation, saveDepartmentNavigation } from '../../utils/navigationPersistence';

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

export interface VideoProductDetail {
  product_name: string;
  qty: number;
}

export interface VideoPricingDetail {
  combination: string;
  amount: number;
  products: VideoProductDetail[];
}

export const COMBINATION_PRODUCTS_MAP: Record<string, string[]> = {
  'Detergent': ['DIY Detergent Liquid'],
  'Detergent & Dishwash': ['DIY Detergent Liquid', 'DIY Dishwash Liquid'],
  'Detergent & Comfort': ['DIY Detergent Liquid', 'DIY Fabric Conditioner'],
  'Dishwash, Detergent & Comfort': ['DIY Dishwash Liquid', 'DIY Detergent Liquid', 'DIY Fabric Conditioner'],
  'Kitchen Cleaner & Bamboo Towel': ['Kitchen Cleaner', 'Bamboo Towel'],
  'Bamboo Towel': ['Bamboo Towel'],
  'Kitchen Cleaner + Dishwash + Bamboo Towel': ['Kitchen Cleaner', 'DIY Dishwash Liquid', 'Bamboo Towel'],
  'Sponge': ['Magic Sponge'],
  'Bike Wash': ['Bike Wash'],
  'Car Wash': ['Car Wash'],
  'BBC': ['BBC'],
  'Hand Wash & Floor Cleaner': ['Hand Wash', 'Floor Cleaner'],
  'Glass Cleaner': ['Glass Cleaner'],
  'Kitchen Cleaner': ['Kitchen Cleaner'],
  '5-6 Products': []
};

export const COMBINATIONS = [
  'Detergent',
  'Detergent & Dishwash',
  'Detergent & Comfort',
  'Dishwash, Detergent & Comfort',
  'Kitchen Cleaner & Bamboo Towel',
  'Bamboo Towel',
  'Kitchen Cleaner + Dishwash + Bamboo Towel',
  'Sponge',
  'Bike Wash',
  'Car Wash',
  'BBC',
  'Hand Wash & Floor Cleaner',
  'Glass Cleaner',
  'Kitchen Cleaner',
  '5-6 Products'
];

export const formatDateDMY = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const parseViewCount = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  let str = String(val).trim().toUpperCase();
  str = str.replace(/,/g, '');
  if (str.endsWith('M')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : Math.round(num * 1000000);
  }
  if (str.endsWith('K')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : Math.round(num * 1000);
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

interface ViewLevel {
  code: string;
  label: string;
  min: number;
  max: number;
}

const INSTAGRAM_LEVELS: ViewLevel[] = [
  { code: 'C1L1', label: '1M+', min: 1000000, max: Infinity },
  { code: 'C1L2', label: '500K–999,999', min: 500000, max: 999999 },
  { code: 'C2L1', label: '250K–499,999', min: 250000, max: 499999 },
  { code: 'C2L2', label: '100K–249,999', min: 100000, max: 249999 },
  { code: 'C3L1', label: '50K–99,999', min: 50000, max: 99999 },
  { code: 'C3L2', label: '25K–49,999', min: 25000, max: 49999 },
  { code: 'C4L1', label: '10K–24,999', min: 10000, max: 24999 },
  { code: 'C4L2', label: 'Below 10K', min: 0, max: 9999 }
];

const FACEBOOK_LEVELS: ViewLevel[] = [
  { code: 'C1L1', label: '1M+', min: 1000000, max: Infinity },
  { code: 'C1L2', label: '500K–999,999', min: 500000, max: 999999 },
  { code: 'C2L1', label: '250K–499,999', min: 250000, max: 499999 },
  { code: 'C2L2', label: '100K–249,999', min: 100000, max: 249999 },
  { code: 'C3L1', label: '50K–99,999', min: 50000, max: 99999 },
  { code: 'C3L2', label: '25K–49,999', min: 25000, max: 49999 },
  { code: 'C4L1', label: '10K–24,999', min: 10000, max: 24999 },
  { code: 'C4L2', label: 'Below 10K', min: 0, max: 9999 }
];

const YOUTUBE_LEVELS: ViewLevel[] = [
  { code: 'C1L1', label: '1M+', min: 1000000, max: Infinity },
  { code: 'C1L2', label: '500K–999,999', min: 500000, max: 999999 },
  { code: 'C2L1', label: '250K–499,999', min: 250000, max: 499999 },
  { code: 'C2L2', label: '100K–249,999', min: 100000, max: 249999 },
  { code: 'C3L1', label: '50K–99,999', min: 50000, max: 99999 },
  { code: 'C3L2', label: '25K–49,999', min: 25000, max: 49999 },
  { code: 'C4L1', label: '10K–24,999', min: 10000, max: 24999 },
  { code: 'C4L2', label: 'Below 10K', min: 0, max: 9999 }
];

export const calculateViewCode = (views: any[]): { code: string; qualifiedCount: number } => {
  const cleanViews = (views || []).map(v => parseViewCount(v));
  const hasViews = cleanViews.some(v => v > 0);
  if (!hasViews) {
    return { code: 'Not Eligible', qualifiedCount: 0 };
  }
  
  const levels = [
    { code: 'C1L1', min: 1000000 },
    { code: 'C1L2', min: 500000 },
    { code: 'C2L1', min: 250000 },
    { code: 'C2L2', min: 100000 },
    { code: 'C3L1', min: 50000 },
    { code: 'C3L2', min: 25000 },
    { code: 'C4L1', min: 10000 },
    { code: 'C4L2', min: 0 }
  ];

  for (const lvl of levels) {
    const count = cleanViews.filter(v => v >= lvl.min).length;
    if (count >= 7) {
      return { code: lvl.code, qualifiedCount: count };
    }
  }

  return { code: 'Not Eligible', qualifiedCount: 0 };
};

export const calculateInstagramViewCode = (views: any[]): { code: string; qualifiedCount: number } => calculateViewCode(views);
export const calculateFacebookViewCode = (views: any[]): { code: string; qualifiedCount: number } => calculateViewCode(views);
export const calculateYoutubeViewCode = (views: any[]): { code: string; qualifiedCount: number } => calculateViewCode(views);

export const getInstagramViewCode = (platforms: InfluencerPlatformDetail[]): string | null => {
  const insta = platforms.find(p => p.platform === 'Instagram');
  if (!insta || !insta.video_views || !insta.video_views.some(v => v !== 0 && String(v) !== '')) return null;
  const calc = calculateInstagramViewCode(insta.video_views);
  return calc.code;
};

export const getFacebookViewCode = (platforms: InfluencerPlatformDetail[]): string | null => {
  const fb = platforms.find(p => p.platform === 'Facebook');
  if (!fb || !fb.video_views || !fb.video_views.some(v => v !== 0 && String(v) !== '')) return null;
  const calc = calculateFacebookViewCode(fb.video_views);
  return calc.code;
};

export const getYoutubeViewCode = (platforms: InfluencerPlatformDetail[]): string | null => {
  const yt = platforms.find(p => p.platform === 'Youtube');
  if (!yt || !yt.video_views || !yt.video_views.some(v => v !== 0 && String(v) !== '')) return null;
  const calc = calculateYoutubeViewCode(yt.video_views);
  return calc.code;
};

export const calculateDraftDate = (postDateStr: string | null | undefined): string => {
  if (!postDateStr || !postDateStr.trim()) return '';
  try {
    const parts = postDateStr.trim().split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return '';

    d.setDate(d.getDate() - 3);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) {
    return '';
  }
};

export const formatDisplayDate = (dateStr: string | null | undefined): string => {
  if (!dateStr || !dateStr.trim()) return '—';
  try {
    const parts = dateStr.trim().split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[month - 1] || '';
    const dd = String(day).padStart(2, '0');
    return `${dd} ${monthName} ${year}`;
  } catch (e) {
    return dateStr;
  }
};

interface AddCampaignInfluencerProps {
  campaign: Campaign;
  initialData?: CampaignInfluencer;
  onBack: () => void;
}

type TabKey = 'basic' | 'platform' | 'pricing' | 'products' | 'performance' | 'postdate';

export const AddCampaignInfluencer: React.FC<AddCampaignInfluencerProps> = ({ campaign, initialData, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const nav = getDepartmentNavigation('marketing');
    return (nav?.activeTab as TabKey) || 'basic';
  });

  const handleTabChange = (tabId: TabKey) => {
    setActiveTab(tabId);
    saveDepartmentNavigation('marketing', '/marketing', { activeTab: tabId });
  };

  const { influencers, addInfluencer, updateInfluencer, isSaving } = useCampaignInfluencers(campaign.id);

  // Form State Storage Helpers
  const getFormStorageKey = () => {
    if (initialData?.id) {
      return `influencer_form_${initialData.id}`;
    }
    return `influencer_form_new_${campaign.id}`;
  };

  const getSavedForm = () => {
    try {
      const key = getFormStorageKey();
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('[FORM PERSISTENCE] Loading:', parsed);
        return parsed;
      }
    } catch (e) {
      console.error('[FORM PERSISTENCE] Error parsing saved form:', e);
    }
    return null;
  };

  const savedForm = getSavedForm();

  // Consolidation of separate states into a single persistent formState object
  interface FormState {
    basicInfo: Partial<CampaignInfluencer>;
    platformAvailability: string;
    platformAgreed: string;
    platforms: InfluencerPlatformDetail[];
    videos: VideoPricingDetail[];
    pricing: InfluencerPricing;
    products: InfluencerProduct[];
    performance: InfluencerBrandPerformance[];
    postDates: InfluencerPostDate[];
  }

  const [formState, setFormState] = useState<FormState>(() => {
    if (savedForm && !initialData) {
      return savedForm;
    }

    if (initialData) {
      const pNames = initialData.platforms?.map(p => p.platform.toLowerCase()) || [];
      const hasInsta = pNames.includes('instagram');
      const hasYoutube = pNames.includes('youtube');
      const hasFb = pNames.includes('facebook');

      let initialPlatformAvailability = 'All';
      if (hasInsta && hasYoutube && hasFb) initialPlatformAvailability = 'All';
      else if (hasInsta && hasYoutube) initialPlatformAvailability = 'Instagram and Youtube';
      else if (hasInsta && hasFb) initialPlatformAvailability = 'Instagram and Facebook';
      else if (hasYoutube && hasFb) initialPlatformAvailability = 'Youtube and Facebook';
      else if (hasInsta) initialPlatformAvailability = 'Instagram';
      else if (hasYoutube) initialPlatformAvailability = 'Youtube';
      else if (hasFb) initialPlatformAvailability = 'Facebook';

      const defaultPlatforms = [
        { platform: 'Instagram', username: '', profile_link: '', followers_count: 0, video_views: Array(15).fill('') as unknown as number[], video_views_dates: Array(15).fill(''), performance_code: '' },
        { platform: 'Youtube', username: '', profile_link: '', followers_count: 0, video_views: Array(15).fill('') as unknown as number[], video_views_dates: Array(15).fill(''), performance_code: '' },
        { platform: 'Facebook', username: '', profile_link: '', followers_count: 0, video_views: Array(15).fill('') as unknown as number[], video_views_dates: Array(15).fill(''), performance_code: '' }
      ];

      const mappedPlatforms = defaultPlatforms.map(p => {
        const match = initialData.platforms?.find(x => x.platform.toLowerCase() === p.platform.toLowerCase());
        
        if (match) {
          const views = Array.isArray(match.video_views) ? match.video_views : [];
          const paddedViews = Array.from({ length: 15 }, (_, i) => {
            const v = views[i];
            if (v === undefined || v === null || String(v).trim() === '') return '';
            return String(v);
          });
          
          const dates = Array.isArray((match as any).video_views_dates) ? (match as any).video_views_dates : [];
          const paddedDates = [...dates, ...Array(15).fill('')].slice(0, 15);
          
          return { 
            ...p, 
            ...match, 
            platform: p.platform, 
            video_views: paddedViews as unknown as number[],
            video_views_dates: paddedDates,
            performance_code: (match as any).performance_code || ''
          };
        }
        return p;
      });

      const initialVideos: VideoPricingDetail[] = [];
      if (initialData.pricing) {
        const v1c = Number(initialData.pricing.video1_count) || 0;
        const v1p = Number(initialData.pricing.video1_price) || 0;
        const v2c = Number(initialData.pricing.video2_count) || 0;
        const v2p = Number(initialData.pricing.video2_price) || 0;
        const prodPricing = (initialData.pricing as any).product_pricing || {};

        if (Array.isArray(prodPricing?.videos)) {
          prodPricing.videos.forEach((v: any, index: number) => {
            const videoNum = index + 1;
            let videoProds: VideoProductDetail[] = [];
            if (Array.isArray(v.products)) {
              videoProds = v.products.map((p: any) => ({
                product_name: p.product_name || '',
                qty: Number(p.qty) || 1
              }));
            } else {
              const matchingProds = (initialData.products || []).filter(p => p.video_number === videoNum);
              videoProds = matchingProds.map(p => ({
                product_name: p.product_name,
                qty: p.qty
              }));
            }
            initialVideos.push({
              combination: v.combination || '',
              amount: Number(v.amount) || 0,
              products: videoProds
            });
          });
        } else {
          // Fallback to legacy fields
          if (v1c > 0) {
            for (let i = 0; i < v1c; i++) {
              const videoNum = i + 1;
              const matchingProds = (initialData.products || []).filter(p => p.video_number === videoNum);
              initialVideos.push({
                combination: v1c === 1 && v2c === 0 ? 'Detergent' : '',
                amount: v1p,
                products: matchingProds.map(p => ({ product_name: p.product_name, qty: p.qty }))
              });
            }
          }
          if (v2c > 0) {
            for (let i = 0; i < v2c; i++) {
              const videoNum = v1c + i + 1;
              const matchingProds = (initialData.products || []).filter(p => p.video_number === videoNum);
              initialVideos.push({
                combination: '',
                amount: v2p,
                products: matchingProds.map(p => ({ product_name: p.product_name, qty: p.qty }))
              });
            }
          }
        }
      }

      if (initialVideos.length === 0) {
        initialVideos.push({ combination: '', amount: 0, products: [] });
      }

      const v1c = Number(initialData.pricing?.video1_count) || 0;
      const v1p = Number(initialData.pricing?.video1_price) || 0;
      const v2c = Number(initialData.pricing?.video2_count) || 0;
      const v2p = Number(initialData.pricing?.video2_price) || 0;
      const prodPricing = (initialData.pricing as any)?.product_pricing || {};

      let totalVideosCount = initialVideos.length;
      let finalPriceCalc = initialVideos.reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const bHistory = (initialData.pricing as any)?.bargainHistory || [];
      const cleanBHistory = bHistory.length > 0 ? bHistory : [{ creator_request: 0, brand_request: 0 }];

      return {
        basicInfo: {
          name: initialData.name || '',
          influencer_name: initialData.influencer_name || '',
          phone_number: initialData.phone_number || '',
          alternative_number: initialData.alternative_number || '',
          upi_number: initialData.upi_number || '',
          city: initialData.city || '',
          complete_address: initialData.complete_address || (initialData as any).address || '',
          state: (function(input?: string | null) {
            if (!input || !input.trim()) return '';
            const allStates = [
              "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
              "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
              "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
              "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
              "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
              "Andaman and Nicobar Islands", "Chandigarh",
              "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
              "Ladakh", "Lakshadweep", "Puducherry"
            ];
            const clean = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const found = allStates.find(s => s.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
            return found || input.trim();
          })(initialData.state),
          languages: (function(rawLangs?: any) {
            if (!rawLangs) return [];
            if (Array.isArray(rawLangs)) {
              return rawLangs.filter(l => typeof l === 'string' && !l.startsWith('views_data:'));
            }
            if (typeof rawLangs === 'string') {
              return rawLangs.split(/[,/]+/).map(s => s.trim()).filter(Boolean);
            }
            return [];
          })(initialData.languages),
          profile_file_url: initialData.profile_file_url || '',
          auto_dm: initialData.auto_dm || false,
          code: initialData.code || '',
          instagram_view_code: initialData.instagram_view_code || getInstagramViewCode(mappedPlatforms) || '',
          facebook_view_code: initialData.facebook_view_code || getFacebookViewCode(mappedPlatforms) || '',
          youtube_view_code: initialData.youtube_view_code || getYoutubeViewCode(mappedPlatforms) || '',
          instagram_view_code_mode: (initialData as any).instagram_view_code_mode || (initialData.instagram_view_code ? 'manual' : 'auto'),
          facebook_view_code_mode: (initialData as any).facebook_view_code_mode || (initialData.facebook_view_code ? 'manual' : 'auto'),
          youtube_view_code_mode: (initialData as any).youtube_view_code_mode || (initialData.youtube_view_code ? 'manual' : 'auto')
        },
        platformAvailability: initialPlatformAvailability,
        platformAgreed: initialPlatformAvailability,
        platforms: mappedPlatforms,
        videos: initialVideos,
        pricing: {
          video1_count: v1c,
          video1_price: v1p,
          video2_count: v2c,
          video2_price: v2p,
          total_videos: totalVideosCount,
          final_price: finalPriceCalc,
          bargainHistory: cleanBHistory,
          product_pricing: prodPricing
        },
        products: initialData.products?.map(p => ({ ...p, selected: true })) || [],
        performance: initialData.brandPerformance || initialData.performance || [],
        postDates: (initialData.postDates && initialData.postDates.length > 0)
          ? initialData.postDates.map(pd => ({
              ...pd,
              post_date: pd.post_date || '',
              draft_date: pd.draft_date || calculateDraftDate(pd.post_date)
            }))
          : [{ video_number: 1, post_date: '', draft_date: '' }]
      };
    }

    return {
      basicInfo: {
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
        auto_dm: false,
        code: '',
        instagram_view_code: '',
        facebook_view_code: '',
        youtube_view_code: '',
        instagram_view_code_mode: 'auto',
        facebook_view_code_mode: 'auto',
        youtube_view_code_mode: 'auto'
      },
      platformAvailability: 'All',
      platformAgreed: 'All',
      platforms: [
        { platform: 'Instagram', username: '', profile_link: '', followers_count: 0, video_views: Array(15).fill('') as unknown as number[], video_views_dates: Array(15).fill(''), performance_code: '' },
        { platform: 'Youtube', username: '', profile_link: '', followers_count: 0, video_views: Array(15).fill('') as unknown as number[], video_views_dates: Array(15).fill(''), performance_code: '' },
        { platform: 'Facebook', username: '', profile_link: '', followers_count: 0, video_views: Array(15).fill('') as unknown as number[], video_views_dates: Array(15).fill(''), performance_code: '' }
      ],
      videos: [
        { video_number: 1, amount: 0, combination: '', platforms: [], products: [] }
      ],
      pricing: {
        instagram_per_video: 0,
        youtube_per_video: 0,
        facebook_per_video: 0,
        total_videos: 1,
        total_amount: 0
      },
      products: [],
      performance: [],
      postDates: [{ video_number: 1, post_date: '', draft_date: '' }]
    };
  });

  const {
    basicInfo,
    platformAvailability,
    platformAgreed,
    platforms,
    videos,
    pricing,
    products,
    performance
  } = formState;

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState(() => {
    const pUrl = savedForm?.basicInfo?.profile_file_url || initialData?.profile_file_url;
    if (pUrl) {
      return pUrl.split('/').pop() || 'Existing File';
    }
    return '';
  });

  const [editingPlatformCode, setEditingPlatformCode] = useState<Record<string, boolean>>({});

  // Auto-Save Effect
  useEffect(() => {
    const key = getFormStorageKey();
    console.log('[FORM PERSISTENCE] Saving:', formState);
    sessionStorage.setItem(key, JSON.stringify(formState));
  }, [formState]);

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

      setFormState(prev => ({
        ...prev,
        basicInfo: { ...prev.basicInfo, profile_file_url: publicData.publicUrl }
      }));
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
      setFormState(prev => ({
        ...prev,
        basicInfo: { ...prev.basicInfo, [name]: checked }
      }));
    } else {
      setFormState(prev => ({
        ...prev,
        basicInfo: { ...prev.basicInfo, [name]: value }
      }));
    }
  };

  const handleLanguageToggle = (lang: string) => {
    setFormState(prev => {
      const langs = prev.basicInfo.languages || [];
      const cleanTarget = lang.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const isPresent = langs.some(l => typeof l === 'string' && l.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget);
      const nextLangs = isPresent
        ? langs.filter(l => typeof l === 'string' && l.trim().toLowerCase().replace(/[^a-z0-9]/g, '') !== cleanTarget)
        : [...langs, lang];
      return {
        ...prev,
        basicInfo: { ...prev.basicInfo, languages: nextLangs }
      };
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
    setFormState(prev => {
      const updated = [...prev.platforms];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, platforms: updated };
    });
  };

  const updatePlatformFields = (idx: number, fields: Partial<InfluencerPlatformDetail>) => {
    setFormState(prev => {
      const updated = [...prev.platforms];
      updated[idx] = { ...updated[idx], ...fields };
      return { ...prev, platforms: updated };
    });
  };

  const getUpdatedPricing = (prevPricing: InfluencerPricing, nextVideos: VideoPricingDetail[]): InfluencerPricing => {
    const total = nextVideos.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
    const updated = {
      ...prevPricing,
      total_videos: nextVideos.length,
      final_price: total,
      product_pricing: {
        ...prevPricing.product_pricing,
        videos: nextVideos
      }
    };

    // Synchronize with legacy fields
    updated.video1_count = nextVideos.length > 0 ? 1 : 0;
    updated.video1_price = nextVideos.length > 0 ? (Number(nextVideos[0].amount) || 0) : 0;
    if (nextVideos.length > 1) {
      updated.video2_count = nextVideos.length - 1;
      const remainingSum = nextVideos.slice(1).reduce((a, b) => a + (Number(b.amount) || 0), 0);
      updated.video2_price = Math.round(remainingSum / (nextVideos.length - 1));
    } else {
      updated.video2_count = 0;
      updated.video2_price = 0;
    }

    return updated;
  };

  const handleCombinationChange = (videoIndex: number, comb: string) => {
    setFormState(prev => {
      const nextVideos = [...prev.videos];
      
      let nextProds: VideoProductDetail[] = [];
      if (comb && comb !== '5-6 Products') {
        const prodNames = COMBINATION_PRODUCTS_MAP[comb] || [];
        nextProds = prodNames.map(name => ({ product_name: name, qty: 1 }));
      }
      
      nextVideos[videoIndex] = {
        ...nextVideos[videoIndex],
        combination: comb,
        products: nextProds
      };

      const flatProducts: InfluencerProduct[] = [];
      nextVideos.forEach((v, idx) => {
        const videoNum = idx + 1;
        (v.products || []).forEach(p => {
          if (p.qty > 0) {
            flatProducts.push({
              video_number: videoNum,
              product_name: p.product_name,
              qty: p.qty,
              selected: true
            });
          }
        });
      });

      const updatedPricing = getUpdatedPricing(prev.pricing, nextVideos);

      return {
        ...prev,
        videos: nextVideos,
        products: flatProducts,
        pricing: updatedPricing
      };
    });
  };

  const handleUpdateProductQty = (videoIndex: number, productIndex: number, nextQty: number) => {
    if (nextQty < 1) return;
    setFormState(prev => {
      const nextVideos = [...prev.videos];
      const productsList = [...(nextVideos[videoIndex].products || [])];
      productsList[productIndex] = { ...productsList[productIndex], qty: nextQty };
      nextVideos[videoIndex] = {
        ...nextVideos[videoIndex],
        products: productsList
      };

      const flatProducts: InfluencerProduct[] = [];
      nextVideos.forEach((v, idx) => {
        const videoNum = idx + 1;
        (v.products || []).forEach(p => {
          if (p.qty > 0) {
            flatProducts.push({
              video_number: videoNum,
              product_name: p.product_name,
              qty: p.qty,
              selected: true
            });
          }
        });
      });

      const updatedPricing = getUpdatedPricing(prev.pricing, nextVideos);

      return {
        ...prev,
        videos: nextVideos,
        products: flatProducts,
        pricing: updatedPricing
      };
    });
  };

  const handleToggleSpecialProduct = (videoIndex: number, productName: string) => {
    setFormState(prev => {
      const nextVideos = [...prev.videos];
      const currentProds = nextVideos[videoIndex].products || [];
      const existingIdx = currentProds.findIndex(p => p.product_name === productName);
      
      let updatedProds = [...currentProds];
      if (existingIdx !== -1) {
        updatedProds = currentProds.filter((_, i) => i !== existingIdx);
      } else {
        updatedProds = [...currentProds, { product_name: productName, qty: 1 }];
      }

      nextVideos[videoIndex] = {
        ...nextVideos[videoIndex],
        products: updatedProds
      };

      const flatProducts: InfluencerProduct[] = [];
      nextVideos.forEach((v, idx) => {
        const videoNum = idx + 1;
        (v.products || []).forEach(p => {
          if (p.qty > 0) {
            flatProducts.push({
              video_number: videoNum,
              product_name: p.product_name,
              qty: p.qty,
              selected: true
            });
          }
        });
      });

      const updatedPricing = getUpdatedPricing(prev.pricing, nextVideos);

      return {
        ...prev,
        videos: nextVideos,
        products: flatProducts,
        pricing: updatedPricing
      };
    });
  };

  const handleVideoAmountChange = (videoIndex: number, amountVal: string) => {
    const amount = parseFloat(amountVal) || 0;
    setFormState(prev => {
      const nextVideos = [...prev.videos];
      nextVideos[videoIndex] = {
        ...nextVideos[videoIndex],
        amount
      };

      const updatedPricing = getUpdatedPricing(prev.pricing, nextVideos);

      return {
        ...prev,
        videos: nextVideos,
        pricing: updatedPricing
      };
    });
  };

  const handleAddVideo = () => {
    setFormState(prev => {
      const nextVideos = [...prev.videos, { combination: '', amount: 0, products: [] }];
      
      const flatProducts: InfluencerProduct[] = [];
      nextVideos.forEach((v, idx) => {
        const videoNum = idx + 1;
        (v.products || []).forEach(p => {
          if (p.qty > 0) {
            flatProducts.push({
              video_number: videoNum,
              product_name: p.product_name,
              qty: p.qty,
              selected: true
            });
          }
        });
      });

      const updatedPricing = getUpdatedPricing(prev.pricing, nextVideos);

      return {
        ...prev,
        videos: nextVideos,
        products: flatProducts,
        pricing: updatedPricing
      };
    });
  };

  const handleDeleteVideo = (videoIndex: number) => {
    setFormState(prev => {
      const nextVideos = prev.videos.filter((_, i) => i !== videoIndex);
      const finalVideos = nextVideos.length > 0 ? nextVideos : [{ combination: '', amount: 0, products: [] }];
      
      const flatProducts: InfluencerProduct[] = [];
      finalVideos.forEach((v, idx) => {
        const videoNum = idx + 1;
        (v.products || []).forEach(p => {
          if (p.qty > 0) {
            flatProducts.push({
              video_number: videoNum,
              product_name: p.product_name,
              qty: p.qty,
              selected: true
            });
          }
        });
      });

      const updatedPricing = getUpdatedPricing(prev.pricing, finalVideos);

      return {
        ...prev,
        videos: finalVideos,
        products: flatProducts,
        pricing: updatedPricing
      };
    });
  };

  const addPerformance = () => {
    setFormState(prev => ({
      ...prev,
      performance: [...prev.performance, { brand_name: '', product_name: '', views: '', uploaded_platforms: 'All' }]
    }));
  };

  const updatePerformance = <K extends keyof InfluencerBrandPerformance>(idx: number, field: K, value: InfluencerBrandPerformance[K]) => {
    setFormState(prev => {
      const updated = [...prev.performance];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, performance: updated };
    });
  };

  const handleCancel = () => {
    const key = getFormStorageKey();
    sessionStorage.removeItem(key);
    onBack();
  };

  const handleSave = async () => {
    try {
      if (!basicInfo.code || !basicInfo.code.trim()) {
        toast.error('Influencer Code is required.');
        return;
      }

      const cleanCode = basicInfo.code.trim().toLowerCase();
      const duplicateCodeInf = (influencers || []).find(inf => 
        inf.code && 
        inf.code.trim().toLowerCase() === cleanCode && 
        String(inf.id) !== String(initialData?.id || '')
      );

      if (duplicateCodeInf) {
        toast.error(`Influencer Code ${basicInfo.code.trim()} already exists. Please use a unique Influencer Code.`);
        return;
      }

      if (!basicInfo.languages || basicInfo.languages.length === 0) {
        toast.error('Please select at least one language.');
        return;
      }

      const visiblePlats = getVisiblePlatforms();
      const cleanedPlatforms = platforms
        .filter(p => (
          visiblePlats.includes(p.platform) ||
          (p.username && p.username.trim() !== '') ||
          (p.followers_count && p.followers_count > 0) ||
          (Array.isArray(p.video_views) && p.video_views.some(v => Number(v) > 0))
        ))
        .map(p => ({
          ...p,
          video_views: Array.isArray(p.video_views) 
            ? p.video_views.map(v => (v === undefined || v === null || String(v).trim() === '') ? 0 : parseViewCount(v)) as any
            : Array(15).fill(0)
        }));

      const cleanedProducts = products.filter(p => p.selected && p.video_number && p.video_number <= (pricing.total_videos || 0));

      const instagramViews = cleanedPlatforms.find(p => p.platform === 'Instagram')?.video_views || [];
      const facebookViews = cleanedPlatforms.find(p => p.platform === 'Facebook')?.video_views || [];
      const youtubeViews = cleanedPlatforms.find(p => p.platform === 'Youtube')?.video_views || [];

      console.log("Saving Instagram Views:", instagramViews);
      console.log("Saving Facebook Views:", facebookViews);
      console.log("Saving YouTube Views:", youtubeViews);

      const payload = {
        ...basicInfo,
        platforms: cleanedPlatforms,
        pricing,
        products: cleanedProducts,
        performance,
        postDates: formState.postDates || []
      };

      const success = initialData?.id 
        ? await updateInfluencer(initialData.id, payload)
        : await addInfluencer(payload);
        
      if (success) {
        const key = getFormStorageKey();
        sessionStorage.removeItem(key);
        if (initialData?.id) {
          sessionStorage.removeItem(`influencer_edit_draft_${campaign.id}_${initialData.id}`);
        }
        toast.success(initialData?.id ? 'Influencer updated successfully!' : 'Influencer saved successfully!');
        notifyInfluencerChange(campaign.id);
        await onBack();
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
            onClick={handleCancel}
            className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} /> {isSaving ? (initialData?.id ? 'Updating...' : 'Saving...') : (initialData?.id ? 'Update Influencer' : 'Save Influencer')}
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-700 overflow-x-auto hide-scrollbar">
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
            onClick={() => handleTabChange(tab.id as TabKey)}
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
        <div className={activeTab === 'basic' ? '' : 'hidden'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Influencer Code</label>
                <input 
                  type="text" 
                  name="code" 
                  value={basicInfo.code || ''} 
                  onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono" 
                  placeholder="Enter influencer code (e.g. HI-SC-2)"
                />
              </div>

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
                <label className="block text-sm text-slate-400 mb-1">Email ID</label>
                <input 
                  type="email" name="email" value={basicInfo.email || ''} onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                  placeholder="Enter email ID"
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
                <label className="block text-sm text-slate-400 mb-1">Pincode</label>
                <input 
                  type="text" name="pincode" value={basicInfo.pincode || ''} onChange={handleBasicChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                  placeholder="Enter pincode"
                  maxLength={6}
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
                  {['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Magahi', 'Odia', 'Rajasthani', 'Haryanvi', 'Bhojpuri', 'Other'].map(lang => (
                    <label key={lang} className="flex items-center gap-2 text-sm text-slate-300">
                      <input 
                        type="checkbox" 
                        checked={(basicInfo.languages || []).some(l => typeof l === 'string' && l.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === lang.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))}
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
        </div>

        <div className={activeTab === 'platform' ? '' : 'hidden'}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Platform Availability</label>
                <select 
                  value={platformAvailability}
                  onChange={e => setFormState(prev => ({ ...prev, platformAvailability: e.target.value }))}
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
                  onChange={e => setFormState(prev => ({ ...prev, platformAgreed: e.target.value }))}
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
                        <div key={vIdx} className="form-group flex flex-col justify-between">
                          <label className="block text-[11px] text-slate-500 mb-1 font-medium text-center">Video {vIdx + 1}</label>
                          <input 
                            type="text" 
                            value={(() => {
                              const val = p.video_views[vIdx];
                              if (val === null || val === undefined || (val as any) === '') return '';
                              return String(val);
                            })()} 
                            onChange={e => {
                              const rawVal = e.target.value;
                              const newViews = Array.isArray(p.video_views) ? [...p.video_views] : Array(15).fill('');
                              const newDates = Array.isArray(p.video_views_dates) ? [...p.video_views_dates] : Array(15).fill('');
                              
                              if (rawVal === '') {
                                newViews[vIdx] = '';
                                newDates[vIdx] = '';
                              } else {
                                const val = parseViewCount(rawVal);
                                newViews[vIdx] = val;
                                if (!newDates[vIdx] || newDates[vIdx] === '—' || newDates[vIdx] === '') {
                                  newDates[vIdx] = formatDateDMY(new Date());
                                }
                              }
                              
                              updatePlatformFields(idx, {
                                video_views: newViews as unknown as number[],
                                video_views_dates: newDates
                              });
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-slate-200 text-xs text-center focus:outline-none focus:border-purple-500" 
                            placeholder="Views"
                          />
                          <span className="block text-[9px] text-slate-500 text-center mt-1 select-none font-medium truncate" title={p.video_views_dates?.[vIdx] ? `Entered: ${p.video_views_dates[vIdx]}` : ''}>
                            {p.video_views_dates?.[vIdx] ? p.video_views_dates[vIdx] : '—'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {(p.platform === 'Instagram' || p.platform === 'Facebook' || p.platform === 'Youtube') && (() => {
                      let value = '';
                      let onChangeHandler = (val: string) => {};
                      
                      if (p.platform === 'Instagram') {
                        const autoCalc = getInstagramViewCode(platforms) || '';
                        value = basicInfo.instagram_view_code !== undefined && basicInfo.instagram_view_code !== null && basicInfo.instagram_view_code !== '' 
                          ? basicInfo.instagram_view_code 
                          : autoCalc;
                        onChangeHandler = (val) => setFormState(prev => ({ 
                          ...prev, 
                          basicInfo: { 
                            ...prev.basicInfo, 
                            instagram_view_code: val,
                            instagram_view_code_mode: 'manual'
                          } 
                        }));
                      } else if (p.platform === 'Facebook') {
                        const autoCalc = getFacebookViewCode(platforms) || '';
                        value = basicInfo.facebook_view_code !== undefined && basicInfo.facebook_view_code !== null && basicInfo.facebook_view_code !== '' 
                          ? basicInfo.facebook_view_code 
                          : autoCalc;
                        onChangeHandler = (val) => setFormState(prev => ({ 
                          ...prev, 
                          basicInfo: { 
                            ...prev.basicInfo, 
                            facebook_view_code: val,
                            facebook_view_code_mode: 'manual'
                          } 
                        }));
                      } else if (p.platform === 'Youtube') {
                        const autoCalc = getYoutubeViewCode(platforms) || '';
                        value = basicInfo.youtube_view_code !== undefined && basicInfo.youtube_view_code !== null && basicInfo.youtube_view_code !== '' 
                          ? basicInfo.youtube_view_code 
                          : autoCalc;
                        onChangeHandler = (val) => setFormState(prev => ({ 
                          ...prev, 
                          basicInfo: { 
                            ...prev.basicInfo, 
                            youtube_view_code: val,
                            youtube_view_code_mode: 'manual'
                          } 
                        }));
                      }
                      
                      return (
                        <div className="mt-4 flex flex-col gap-1.5 max-w-xs">
                          <label className="block text-xs font-semibold text-slate-400">Creator Category</label>
                          <input 
                            type="text" 
                            value={value}
                            onChange={e => onChangeHandler(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-purple-500 font-mono"
                            placeholder="Enter Creator Category (e.g. C4L2)"
                          />
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={activeTab === 'pricing' ? '' : 'hidden'}>
          <div className="space-y-8 animate-fade-in text-slate-200">
            {/* VIDEO PRICING SECTION */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Video Pricing</h3>
                  <p className="text-xs text-slate-500 mt-1">Add videos, select combinations, set quantities and amount for each video.</p>
                </div>
              </div>

              {/* Video Pricing Rows */}
              <div className="space-y-4">
                {videos.map((v, idx) => {
                  const videoNum = idx + 1;
                  return (
                    <div key={idx} className="flex flex-col lg:flex-row lg:items-center gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all min-w-0">
                      {/* Video Badge */}
                      <div className="shrink-0 flex flex-col items-center justify-center bg-purple-950/30 border border-purple-800/20 w-14 h-14 rounded-xl">
                        <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider select-none">Video</span>
                        <span className="text-xl font-extrabold text-purple-300 leading-none mt-0.5">{videoNum}</span>
                      </div>

                      {/* Combination Dropdown */}
                      <div className="shrink-0 w-full lg:w-[220px]">
                        <label className="block text-[11px] text-slate-500 mb-1.5 font-medium tracking-wide">Combination</label>
                        <select 
                          value={v.combination}
                          onChange={e => handleCombinationChange(idx, e.target.value)}
                          className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">Select Combination</option>
                          {COMBINATIONS.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Products & Quantity */}
                      <div className="flex-1 min-w-0">
                        <label className="block text-[11px] text-slate-500 mb-1.5 font-medium tracking-wide">Products & Quantity</label>
                        <div className="flex items-center gap-2 flex-wrap min-h-[40px]">
                          {v.combination ? (
                            <>
                              {/* Special Select list for 5-6 products */}
                              {v.combination === '5-6 Products' && (
                                <div className="flex items-center gap-1.5 flex-wrap shrink-0 border-r border-slate-800 pr-2 mr-1">
                                  {PRODUCT_LIST.map(prodName => {
                                    const isSelected = (v.products || []).some(p => p.product_name === prodName);
                                    return (
                                      <button
                                        type="button"
                                        key={prodName}
                                        onClick={() => handleToggleSpecialProduct(idx, prodName)}
                                        className={`px-2 py-1 rounded text-[10px] border transition-colors shrink-0 font-medium ${
                                          isSelected
                                            ? 'bg-purple-900/30 border-purple-500/80 text-purple-200 shadow-sm shadow-purple-500/10'
                                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900'
                                        }`}
                                        title={prodName}
                                      >
                                        {isSelected ? '✓ ' : ''}{prodName}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Selected constituent products with steppers */}
                              {v.products && v.products.length > 0 ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {v.products.map((prod, pIdx) => (
                                    <div key={prod.product_name} className="flex items-center gap-3 bg-slate-900 border border-slate-800/80 px-3 h-10 rounded-lg shadow-sm">
                                      <span className="text-[11px] text-slate-300 font-semibold select-none truncate max-w-[120px]" title={prod.product_name}>
                                        {prod.product_name}
                                      </span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateProductQty(idx, pIdx, prod.qty - 1)}
                                          className="stepper-btn w-5 h-5 rounded flex items-center justify-center text-xs font-bold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                                        >
                                          &minus;
                                        </button>
                                        <span className="w-4 text-center text-xs font-bold text-slate-100 select-none">
                                          {prod.qty}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateProductQty(idx, pIdx, prod.qty + 1)}
                                          className="stepper-btn w-5 h-5 rounded flex items-center justify-center text-xs font-bold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                                        >
                                          &#43;
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500 italic select-none">Select at least one product</span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-slate-600 italic select-none">Select combination first</span>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="shrink-0 w-full lg:w-[130px]">
                        <label className="block text-[11px] text-slate-500 mb-1.5 font-medium tracking-wide">Amount</label>
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3 h-10 focus-within:border-purple-500">
                          <span className="text-slate-500 text-sm font-semibold select-none">₹</span>
                          <input 
                            type="number" 
                            value={v.amount === 0 ? '' : v.amount} 
                            onChange={e => handleVideoAmountChange(idx, e.target.value)}
                            className="w-full bg-transparent border-0 p-0 text-slate-200 text-sm focus:ring-0 focus:outline-none font-semibold" 
                            placeholder="Amount" min="0"
                          />
                        </div>
                      </div>

                      {/* Delete button */}
                      <div className="shrink-0 self-end pb-1">
                        <button 
                          type="button"
                          onClick={() => handleDeleteVideo(idx)}
                          className="text-slate-500 hover:text-rose-450 transition-colors p-2 rounded-lg hover:bg-rose-950/20"
                          title="Remove Video"
                        >
                          <X size={18} />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
              <div className="flex justify-start mt-4">
                <button 
                  type="button"
                  onClick={handleAddVideo}
                  className="h-10 px-4 text-xs font-semibold rounded-lg border border-purple-500/30 text-purple-300 hover:bg-purple-950/20 hover:border-purple-500 bg-slate-900/60 shadow-sm flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add Video
                </button>
              </div>
            </div>

            {/* Total negotiated summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/80 pt-6">
              <div className="bg-slate-900/40 p-[18px] h-[110px] rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Videos</span>
                <div className="text-[26px] font-bold text-purple-400 leading-none">
                  {pricing.total_videos}
                </div>
                <span className="text-xs text-slate-500 block">Videos added</span>
              </div>
              <div className="bg-slate-900/40 p-[18px] h-[110px] rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Final Price</span>
                <div className="text-[26px] font-bold text-purple-400 leading-none">
                  ₹ {(pricing?.final_price ?? 0).toLocaleString('en-IN')}
                </div>
                <span className="text-xs text-slate-500 block">Total negotiated amount</span>
              </div>
            </div>

            {/* Negotiation Bargain History */}
            <div className="pt-8 mt-6 border-t border-slate-800/80">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Negotiation / Bargain History</h3>
                  <p className="text-xs text-slate-500 mt-1">Record history of creator and brand offer rounds.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setFormState(prev => ({
                      ...prev,
                      pricing: {
                        ...prev.pricing,
                        bargainHistory: [...(prev.pricing.bargainHistory || []), { creator_request: 0, brand_request: 0 }]
                      }
                    }));
                  }}
                  className="h-10 px-4 text-xs font-semibold rounded-lg bg-slate-900 border border-purple-500/30 text-purple-300 hover:bg-purple-950/20 hover:border-purple-500 transition-colors flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add Set
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(pricing.bargainHistory || []).map((bargain, idx) => (
                  <div key={idx} className="bg-slate-900/40 p-4.5 rounded-xl border border-slate-800 hover:border-slate-750 transition-all shadow-sm relative group">
                    <div className="flex justify-between items-center mb-3.5 pb-2 border-b border-slate-850">
                      <span className="text-xs font-bold text-purple-400 bg-purple-950/40 px-3 py-1 rounded border border-purple-800/20">Set {idx + 1}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const newHistory = (pricing.bargainHistory || []).filter((_, i) => i !== idx);
                          const finalHistory = newHistory.length > 0 ? newHistory : [{ creator_request: 0, brand_request: 0 }];
                          setFormState(prev => ({
                            ...prev,
                            pricing: { ...prev.pricing, bargainHistory: finalHistory }
                          }));
                        }}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                        title="Remove Negotiation Set"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Creator Request</label>
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3 h-10 focus-within:border-purple-500">
                          <span className="text-slate-500 text-sm select-none">₹</span>
                          <input 
                            type="number" 
                            value={bargain.creator_request === 0 ? '' : bargain.creator_request} 
                            onChange={e => {
                              const newHistory = [...(pricing.bargainHistory || [])];
                              newHistory[idx] = { ...newHistory[idx], creator_request: parseFloat(e.target.value) || 0 };
                              setFormState(prev => ({
                                ...prev,
                                pricing: { ...prev.pricing, bargainHistory: newHistory }
                              }));
                            }}
                            className="w-full bg-transparent border-0 p-0 text-slate-200 text-sm focus:ring-0 focus:outline-none font-semibold" 
                            placeholder="Amount"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Brand Request</label>
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3 h-10 focus-within:border-purple-500">
                          <span className="text-slate-500 text-sm select-none">₹</span>
                          <input 
                            type="number" 
                            value={bargain.brand_request === 0 ? '' : bargain.brand_request} 
                            onChange={e => {
                              const newHistory = [...(pricing.bargainHistory || [])];
                              newHistory[idx] = { ...newHistory[idx], brand_request: parseFloat(e.target.value) || 0 };
                              setFormState(prev => ({
                                ...prev,
                                pricing: { ...prev.pricing, bargainHistory: newHistory }
                              }));
                            }}
                            className="w-full bg-transparent border-0 p-0 text-slate-200 text-sm focus:ring-0 focus:outline-none font-semibold" 
                            placeholder="Amount"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Informational footer message */}
              <div className="mt-6 p-4 rounded-xl bg-slate-900/20 border border-slate-850 text-xs text-slate-500 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full border border-slate-700 animate-pulse bg-slate-500/20" />
                You can add more videos and negotiation sets as needed.
              </div>

            </div>
          </div>
        </div>
        <div className={activeTab === 'products' ? '' : 'hidden'}>
          <div className="space-y-6 animate-fade-in text-slate-200">
            {!pricing.total_videos || pricing.total_videos <= 0 ? (
              <div className="text-slate-500 text-center py-10 italic">No products selected yet. Fill in Pricing Info first.</div>
            ) : (
              videos.map((v, idx) => {
                const videoNum = idx + 1;
                const activeProds = v.products || [];
                return (
                  <div key={videoNum} className="mb-6 bg-slate-900/30 p-5 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
                      <h4 className="text-base font-bold text-purple-400">Video {videoNum}</h4>
                      {v.combination && (
                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700/50">
                          {v.combination}
                        </span>
                      )}
                    </div>
                    {activeProds.length === 0 ? (
                      <div className="text-slate-500 text-xs italic">No combination or products selected for this video.</div>
                    ) : (
                      <div className="space-y-2 max-w-md">
                        {activeProds.map(prod => (
                          <div key={prod.product_name} className="flex justify-between items-center py-1.5 border-b border-slate-800/50">
                            <span className="text-sm text-slate-300">{prod.product_name}</span>
                            <span className="text-xs bg-slate-800 px-2.5 py-0.5 rounded text-purple-300 font-semibold border border-purple-800/20">
                              Qty: {prod.qty}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={activeTab === 'performance' ? '' : 'hidden'}>
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
                      onClick={() => setFormState(prev => ({ ...prev, performance: prev.performance.filter((_, i) => i !== idx) }))}
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
        </div>

        {/* Post Date Tab */}
        <div className={activeTab === 'postdate' ? '' : 'hidden'}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-slate-200">POST DATE SCHEDULE</h3>
                <p className="text-sm text-slate-400">Schedule the post and automatically calculate draft date.</p>
              </div>
            </div>

            <div className="space-y-4">
              {(formState.postDates || []).map((item, idx) => (
                <div key={item.video_number || idx} className="bg-slate-900 border border-slate-700 rounded-xl p-5 relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-bold rounded-lg uppercase tracking-wider">
                        VIDEO {item.video_number}
                      </span>
                    </div>
                    {formState.postDates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (item.id) {
                            if (!window.confirm(`Are you sure you want to remove Video ${item.video_number} post date schedule?`)) {
                              return;
                            }
                          }
                          setFormState(prev => ({
                            ...prev,
                            postDates: prev.postDates.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        title="Remove video schedule"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Post Date
                      </label>
                      <input
                        type="date"
                        value={item.post_date || ''}
                        onChange={e => {
                          const newPostDate = e.target.value;
                          const newDraftDate = calculateDraftDate(newPostDate);
                          setFormState(prev => {
                            const updated = [...(prev.postDates || [])];
                            updated[idx] = {
                              ...updated[idx],
                              post_date: newPostDate,
                              draft_date: newDraftDate
                            };
                            return { ...prev, postDates: updated };
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-purple-500 font-mono"
                      />
                      {item.post_date && (
                        <span className="block text-[11px] text-slate-500 mt-1">
                          Formatted: {formatDisplayDate(item.post_date)}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Draft Date</span>
                        <span className="text-[10px] text-purple-400 font-normal lowercase">Automatically calculated • 3 days before</span>
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          readOnly
                          value={item.draft_date || ''}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 text-sm cursor-not-allowed select-none font-mono"
                        />
                        {item.draft_date && (
                          <span className="block text-[11px] text-purple-300 font-medium mt-1">
                            Formatted: {formatDisplayDate(item.draft_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setFormState(prev => {
                  const currentList = prev.postDates || [];
                  const nextVideoNumber = currentList.length > 0
                    ? Math.max(...currentList.map(v => v.video_number)) + 1
                    : 1;
                  return {
                    ...prev,
                    postDates: [
                      ...currentList,
                      { video_number: nextVideoNumber, post_date: '', draft_date: '' }
                    ]
                  };
                });
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-slate-700"
            >
              <Plus size={16} /> Add Video
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
