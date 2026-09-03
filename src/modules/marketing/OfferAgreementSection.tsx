import React, { useState, useEffect, useMemo } from 'react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { Search, FileText, Copy, Edit2, Download, Eye, CheckCircle2, AlertCircle, RefreshCcw, CheckSquare, Sparkles, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { naturalSortCompare } from '../../config/skuMapping';
import { generateSingleOfferAgreementPDF, generateCombinedOfferAgreementPDF } from '../../utils/generateOfferAgreementPDF';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { formatDisplayDate } from './AddCampaignInfluencer';
import { isActiveStatus } from '../../utils/marketingUtils';

export interface StoredAgreement {
  id?: string | number;
  campaign_id: string | number;
  influencer_id: string | number;
  influencer_code: string;
  username: string;
  price_per_video: number;
  agreement_text: string;
  generated_at: string;
  updated_at: string;
}

interface OfferAgreementSectionProps {
  campaign: Campaign;
  influencers: CampaignInfluencer[];
  onBackToList: () => void;
}

export const buildAgreementText = (
  influencer: CampaignInfluencer,
  campaignName: string
): string => {
  const rawUser = (influencer.influencer_name || (influencer as any).username || influencer.name || '').trim();
  const cleanUsername = rawUser ? rawUser.replace(/^@+/, '') : '';

  // Extract per-video price from pricing info
  const pricing = (influencer.pricing as any) || {};
  let videoPrice = 0;

  if (Array.isArray(pricing.product_pricing?.videos) && pricing.product_pricing.videos.length > 0) {
    for (const v of pricing.product_pricing.videos) {
      const amt = (v && typeof v === 'object') ? (v.amount !== undefined && v.amount !== null ? Number(v.amount) : 0) : (Number(v) || 0);
      if (!isNaN(amt) && amt > 0) {
        videoPrice = amt;
        break;
      }
    }
  }

  if (videoPrice === 0) {
    if (pricing.video1_price) {
      const v1 = Number(pricing.video1_price);
      if (!isNaN(v1) && v1 > 0) videoPrice = v1;
    } else if (pricing.video2_price) {
      const v2 = Number(pricing.video2_price);
      if (!isNaN(v2) && v2 > 0) videoPrice = v2;
    }
  }

  if (videoPrice === 0 && pricing.final_price) {
    const totalV = Number(pricing.total_videos) || 6;
    const calc = Math.round(Number(pricing.final_price) / (totalV > 0 ? totalV : 6));
    if (!isNaN(calc) && calc > 0) videoPrice = calc;
  }

  const formattedPrice = videoPrice > 0 ? `₹${videoPrice.toLocaleString('en-IN')} ` : '';

  // Extract assigned products per video
  const explicitProducts = Array.isArray(influencer.products) ? influencer.products : [];
  let video1Prod = 'Kitchen Cleaner';
  let video2Prod = 'Brass, Bronze & Copper Cleaner (BBC Cleaner)';
  let video3Prod = 'Detergent + Dishwash';

  if (explicitProducts.length > 0) {
    const v1 = explicitProducts.filter((p: any) => p.video_number === 1).map((p: any) => p.product_name || p.name).filter(Boolean);
    const v2 = explicitProducts.filter((p: any) => p.video_number === 2).map((p: any) => p.product_name || p.name).filter(Boolean);
    const v3 = explicitProducts.filter((p: any) => p.video_number === 3).map((p: any) => p.product_name || p.name).filter(Boolean);
    if (v1.length > 0) video1Prod = v1.join(' + ');
    if (v2.length > 0) video2Prod = v2.join(' + ');
    if (v3.length > 0) video3Prod = v3.join(' + ');
  }

  // Extract assigned post dates
  const postDates = Array.isArray(influencer.postDates) ? influencer.postDates : [];
  const getDateStr = (vNum: number) => {
    const found = postDates.find((pd: any) => pd.video_number === vNum);
    if (found && found.post_date && typeof found.post_date === 'string' && found.post_date.trim()) {
      return formatDisplayDate(found.post_date);
    }
    return '';
  };

  const greetingLine = cleanUsername ? `Hi ${cleanUsername},` : 'Hi,';

  return `${greetingLine}

Greetings from Justmixx!

We're happy to confirm your collaboration with us for a total of 6 videos as part of our 3-month Influencer Campaign.

PRODUCT PLAN

Video 1: ${video1Prod}
Video 2: ${video2Prod}
Video 3: ${video3Prod}
Videos 4–6: Products will be updated later.

Products for Videos 1–3 will be dispatched now. Products for Videos 4–6 will be confirmed and dispatched separately.

YOUR ASSIGNED PUBLISHING DATES

Video 1: ${getDateStr(1)}
Video 2: ${getDateStr(2)}
Video 3: ${getDateStr(3)}
Video 4: ${getDateStr(4)}
Video 5: ${getDateStr(5)}
Video 6: ${getDateStr(6)}

These are your assigned Publishing Dates. Please plan the content accordingly.

DRAFT & APPROVAL

• Draft must be shared 3 days before each Publishing Date.
• Our team will review the Draft and share corrections, if required.
• Once approved, the Video must be published on the assigned date.

PAYMENT & COMMERCIAL TERMS

• Video 1: Payment will be made in advance after product delivery.
• Videos 2–6: Payment for each Video will be made after the respective Draft is approved.
• The commercial amount already agreed ${formattedPrice}will remain the same for all 6 videos and cannot be increased during the collaboration period.

The Publishing Dates are planned in advance for our overall campaign. If there is any unavoidable issue, please inform our team in advance.

By proceeding with the collaboration and accepting the products, you confirm your acceptance of the 6-video schedule, payment terms and agreed commercials.

Looking forward to a smooth and successful collaboration!

Regards,

Team Justmixx

Velmora Consumer Products LLP`;
};

export const OfferAgreementSection: React.FC<OfferAgreementSectionProps> = ({
  campaign,
  influencers,
  onBackToList
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [agreementsMap, setAgreementsMap] = useState<Record<string, StoredAgreement>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [textModalItem, setTextModalItem] = useState<{ influencer: CampaignInfluencer; agreement: StoredAgreement } | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isEditingMode, setIsEditingMode] = useState(false);

  // Filter ALL Active Influencers using isActiveStatus helper
  const activeInfluencers = useMemo(() => {
    const list = influencers.filter(inf => isActiveStatus(inf.is_archived));
    return list.sort((a, b) => naturalSortCompare(a.code || (a as any).influencer_code || '', b.code || (b as any).influencer_code || ''));
  }, [influencers]);

  // Load Persisted Agreements (Supabase + localStorage fallback)
  useEffect(() => {
    const loadAgreements = async () => {
      setIsLoading(true);
      const localKey = `velmora_offer_agreements_${campaign.id}`;
      let map: Record<string, StoredAgreement> = {};

      // Try local storage first
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
          map = JSON.parse(stored);
        }
      } catch (err) {
        console.error('Failed reading local storage agreements:', err);
      }

      // Try Supabase fetch
      try {
        const { data, error } = await supabase
          .from(SUPABASE_TABLES.offerAgreements)
          .select('*')
          .eq('campaign_id', campaign.id);

        if (!error && Array.isArray(data)) {
          data.forEach((row: any) => {
            const infId = String(row.influencer_id);
            map[infId] = {
              id: row.id,
              campaign_id: row.campaign_id,
              influencer_id: row.influencer_id,
              influencer_code: row.influencer_code,
              username: row.username,
              price_per_video: row.price_per_video,
              agreement_text: row.agreement_text,
              generated_at: row.generated_at,
              updated_at: row.updated_at
            };
          });
        }
      } catch (err) {
        // Supabase table may not exist yet, fallback to localStorage map cleanly
      }

      setAgreementsMap(map);
      setIsLoading(false);
    };

    loadAgreements();
  }, [campaign.id]);

  // Save Agreement Helper
  const persistAgreement = async (agreement: StoredAgreement) => {
    const infId = String(agreement.influencer_id);
    const localKey = `velmora_offer_agreements_${campaign.id}`;

    // Update local state & localStorage immediately
    setAgreementsMap(prev => {
      const next = { ...prev, [infId]: agreement };
      try {
        localStorage.setItem(localKey, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // Try Supabase upsert
    try {
      await supabase
        .from(SUPABASE_TABLES.offerAgreements)
        .upsert([{
          campaign_id: agreement.campaign_id,
          influencer_id: agreement.influencer_id,
          influencer_code: agreement.influencer_code,
          username: agreement.username,
          price_per_video: agreement.price_per_video,
          agreement_text: agreement.agreement_text,
          generated_at: agreement.generated_at,
          updated_at: agreement.updated_at
        }], { onConflict: 'campaign_id,influencer_id' });
    } catch (e) {}
  };

  // Helper to extract video price
  const getVideoPrice = (inf: CampaignInfluencer): number => {
    const pricing = (inf.pricing as any) || {};
    if (Array.isArray(pricing.product_pricing?.videos)) {
      for (const v of pricing.product_pricing.videos) {
        const amt = (v && typeof v === 'object') ? (v.amount !== undefined && v.amount !== null ? Number(v.amount) : 0) : (Number(v) || 0);
        if (!isNaN(amt) && amt > 0) return amt;
      }
    }
    if (pricing.video1_price) return Number(pricing.video1_price) || 0;
    if (pricing.video2_price) return Number(pricing.video2_price) || 0;
    if (pricing.final_price) return Math.round(Number(pricing.final_price) / (Number(pricing.total_videos) || 6));
    return 0;
  };

  // Generate Agreement for a set of influencers (NEVER BLOCKS ON MISSING FIELDS)
  const handleGenerateAgreements = async (targetList: CampaignInfluencer[]) => {
    if (targetList.length === 0) {
      toast.error('No active influencers selected.');
      return;
    }

    const nowIso = new Date().toISOString();
    let count = 0;

    for (const inf of targetList) {
      const infId = String(inf.id);
      const code = inf.code || (inf as any).influencer_code || '';
      const user = inf.influencer_name || (inf as any).username || inf.name || '';
      const price = getVideoPrice(inf);
      const text = buildAgreementText(inf, campaign.campaign_name);

      const record: StoredAgreement = {
        campaign_id: campaign.id,
        influencer_id: inf.id,
        influencer_code: code,
        username: user,
        price_per_video: price,
        agreement_text: text,
        generated_at: agreementsMap[infId]?.generated_at || nowIso,
        updated_at: nowIso
      };

      await persistAgreement(record);
      count++;
    }

    toast.success(`Offer Agreement generated for ${count} influencer(s)!`);
  };

  // Filtered influencers by search term
  const filteredInfluencers = useMemo(() => {
    if (!searchTerm.trim()) return activeInfluencers;
    const term = searchTerm.trim().toLowerCase();
    return activeInfluencers.filter(inf => {
      const code = (inf.code || (inf as any).influencer_code || '').toLowerCase();
      const name = (inf.name || '').toLowerCase();
      const username = (inf.influencer_name || (inf as any).username || '').toLowerCase();
      return code.includes(term) || username.includes(term) || name.includes(term);
    });
  }, [activeInfluencers, searchTerm]);

  // Bulk Selection Handlers
  const handleToggleSelect = (id: string | number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredInfluencers.length) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<string | number>();
      filteredInfluencers.forEach(inf => next.add(inf.id));
      setSelectedIds(next);
    }
  };

  // Combined PDF download
  const handleDownloadCombinedPDF = () => {
    const selectedList = activeInfluencers.filter(inf => selectedIds.has(inf.id) || selectedIds.size === 0);
    const pdfItems = selectedList
      .filter(inf => agreementsMap[String(inf.id)])
      .map(inf => {
        const ag = agreementsMap[String(inf.id)];
        return {
          influencerCode: ag.influencer_code,
          username: ag.username,
          pricePerVideo: ag.price_per_video,
          agreementText: ag.agreement_text
        };
      });

    if (pdfItems.length === 0) {
      toast.error('No generated agreements found for the selected influencers. Click "Generate Agreement" first.');
      return;
    }

    generateCombinedOfferAgreementPDF(campaign.campaign_name, pdfItems);
    toast.success(`Combined PDF downloaded for ${pdfItems.length} influencer(s)!`);
  };

  // Open Text Viewer/Editor Modal
  const handleOpenTextModal = (inf: CampaignInfluencer) => {
    const infId = String(inf.id);
    let ag = agreementsMap[infId];
    if (!ag) {
      const price = getVideoPrice(inf);
      const text = buildAgreementText(inf, campaign.campaign_name);
      ag = {
        campaign_id: campaign.id,
        influencer_id: inf.id,
        influencer_code: inf.code || (inf as any).influencer_code || '',
        username: inf.influencer_name || (inf as any).username || inf.name || '',
        price_per_video: price,
        agreement_text: text,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    setTextModalItem({ influencer: inf, agreement: ag });
    setEditingText(ag.agreement_text);
    setIsEditingMode(false);
  };

  const handleSaveTextModal = async () => {
    if (!textModalItem) return;
    const updated: StoredAgreement = {
      ...textModalItem.agreement,
      agreement_text: editingText,
      updated_at: new Date().toISOString()
    };
    await persistAgreement(updated);
    setTextModalItem(prev => prev ? { ...prev, agreement: updated } : null);
    setIsEditingMode(false);
    toast.success('Agreement text updated and saved!');
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Agreement text copied to clipboard!');
  };

  const handleSinglePDFDownload = (inf: CampaignInfluencer) => {
    const infId = String(inf.id);
    let ag = agreementsMap[infId];
    if (!ag) {
      const price = getVideoPrice(inf);
      const text = buildAgreementText(inf, campaign.campaign_name);
      ag = {
        campaign_id: campaign.id,
        influencer_id: inf.id,
        influencer_code: inf.code || (inf as any).influencer_code || '',
        username: inf.influencer_name || (inf as any).username || inf.name || '',
        price_per_video: price,
        agreement_text: text,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    generateSingleOfferAgreementPDF(campaign.campaign_name, {
      influencerCode: ag.influencer_code,
      username: ag.username,
      pricePerVideo: ag.price_per_video,
      agreementText: ag.agreement_text
    });
    toast.success(`PDF downloaded for ${ag.influencer_code || ag.username || 'influencer'}!`);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      {/* Top Header & Search Bar */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToList}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-700"
          >
            ← Back to List
          </button>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <FileText size={20} className="text-purple-400" />
            Offer Agreement
          </h3>
          <span className="px-2.5 py-0.5 bg-purple-950/60 border border-purple-800/40 rounded-full text-purple-300 text-xs font-semibold">
            {activeInfluencers.length} Active Influencers
          </span>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <button
              onClick={() => {
                const targetList = activeInfluencers.filter(inf => selectedIds.has(inf.id));
                handleGenerateAgreements(targetList);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Sparkles size={14} /> Generate for Selected ({selectedIds.size})
            </button>
          )}

          <button
            onClick={handleDownloadCombinedPDF}
            className="px-3 py-1.5 bg-purple-900/50 hover:bg-purple-800/60 text-purple-200 border border-purple-700/50 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Download Combined PDF in Numeric Code Order"
          >
            <Download size={14} /> Download Combined PDF
          </button>
        </div>
      </div>

      {/* Search & Selection Bar */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by username or influencer code..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300 select-none">
            <input
              type="checkbox"
              checked={filteredInfluencers.length > 0 && selectedIds.size === filteredInfluencers.length}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded bg-slate-950 border-purple-500 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <span>Select All ({filteredInfluencers.length})</span>
          </label>

          {selectedIds.size > 0 && (
            <span className="text-xs text-purple-400 font-bold">
              {selectedIds.size} Selected
            </span>
          )}
        </div>
      </div>

      {/* Main Influencers Agreement Table */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {filteredInfluencers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 italic">
            No active influencers found matching "{searchTerm}".
          </div>
        ) : (
          <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-300 text-xs font-bold border-b border-slate-700 uppercase tracking-wider">
                  <th className="p-3 w-10 text-center">Select</th>
                  <th className="p-3 w-28">Code</th>
                  <th className="p-3">Username</th>
                  <th className="p-3 w-32">Price / Video</th>
                  <th className="p-3 w-32 text-center">Status</th>
                  <th className="p-3 w-44 text-center">Text Format</th>
                  <th className="p-3 w-44 text-center">PDF Format</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-xs">
                {filteredInfluencers.map((inf) => {
                  const infId = String(inf.id);
                  const code = inf.code || (inf as any).influencer_code || '';
                  const user = inf.influencer_name || (inf as any).username || inf.name || '';
                  const cleanUser = user ? (user.startsWith('@') ? user : `@${user}`) : '';
                  const price = getVideoPrice(inf);
                  const isGen = !!agreementsMap[infId];
                  const isChecked = selectedIds.has(inf.id);

                  return (
                    <tr
                      key={inf.id}
                      className={`hover:bg-slate-700/40 transition-colors ${isChecked ? 'bg-purple-950/20' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(inf.id)}
                          className="w-4 h-4 rounded bg-slate-950 border-purple-500 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>

                      <td className="p-3 font-bold text-purple-300">
                        {code || <span className="text-slate-500 font-normal italic">—</span>}
                      </td>

                      <td className="p-3 font-semibold text-slate-200">
                        {cleanUser || <span className="text-slate-500 font-normal italic">—</span>}
                      </td>

                      <td className="p-3 font-bold text-slate-100">
                        {price > 0 ? `₹${price.toLocaleString('en-IN')}` : <span className="text-slate-500 font-normal italic">—</span>}
                      </td>

                      <td className="p-3 text-center">
                        {isGen ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[11px] font-bold rounded-full">
                            <CheckCircle2 size={12} /> Generated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-700/60 text-slate-400 text-[11px] font-medium rounded-full">
                            <AlertCircle size={12} /> Not Generated
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleOpenTextModal(inf)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-purple-600 text-slate-200 hover:text-white rounded-lg transition-colors font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer border border-slate-600"
                        >
                          <Eye size={13} /> View / Copy / Edit
                        </button>
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleSinglePDFDownload(inf)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Download size={13} /> Download PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Text Format Viewer / Editor Modal */}
      {textModalItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/80 rounded-t-xl">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-purple-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  Offer Agreement Text {textModalItem.agreement.influencer_code ? `— ${textModalItem.agreement.influencer_code}` : ''} {textModalItem.agreement.username ? `(${textModalItem.agreement.username})` : ''}
                </h4>
              </div>
              <button
                onClick={() => setTextModalItem(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Actions Bar */}
            <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyText(isEditingMode ? editingText : textModalItem.agreement.agreement_text)}
                  className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy size={13} /> Copy Text
                </button>

                {!isEditingMode ? (
                  <button
                    onClick={() => setIsEditingMode(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 size={13} /> Edit Agreement Text
                  </button>
                ) : (
                  <button
                    onClick={handleSaveTextModal}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save size={13} /> Save Changes
                  </button>
                )}
              </div>

              {isEditingMode && (
                <span className="text-[11px] text-amber-400 italic">
                  Editing agreement text for this influencer record
                </span>
              )}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-950/40">
              {!isEditingMode ? (
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-200 leading-relaxed bg-slate-900 p-4 rounded-lg border border-slate-800 select-text">
                  {textModalItem.agreement.agreement_text}
                </pre>
              ) : (
                <textarea
                  value={editingText}
                  onChange={e => setEditingText(e.target.value)}
                  className="w-full h-96 bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs font-sans text-slate-100 focus:outline-none focus:border-purple-500 leading-relaxed"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/80 rounded-b-xl">
              <button
                onClick={() => setTextModalItem(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
