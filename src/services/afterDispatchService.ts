import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignInfluencer } from '../types';
import { getInfluencerResolvedVideoProducts, isVideoLabel } from '../modules/marketing/AddCampaignInfluencer';
import { isInfluencerDispatched } from '../utils/marketingUtils';
import { InfluencerDispatchedShipment, getCourierTrackingUrl } from './influencerTrackingService';
import { matchShipmentToInfluencer } from './influencerStatusHandoffService';

export interface DispatchedProductItem {
  videoNumber: number;
  productName: string;
  amount?: number | null;
}

export interface StoredAfterDispatchMessage {
  id?: string;
  campaign_id: string;
  influencer_id: string;
  influencer_code: string;
  username: string;
  creator_name: string;
  dispatch_status: string;
  courier: string;
  tracking_id: string;
  tracking_url: string;
  payment_amount?: number | null;
  payment_text: string;
  dispatched_products: DispatchedProductItem[];
  message_text: string;
  pdf_path?: string | null;
  pdf_url?: string | null;
  generated_at: string;
  updated_at: string;
}

export const getOrdinalSuffix = (num: number): string => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return `${num}st`;
  if (j === 2 && k !== 12) return `${num}nd`;
  if (j === 3 && k !== 13) return `${num}rd`;
  return `${num}th`;
};

export const resolveInfluencerName = (influencer: CampaignInfluencer): string => {
  const raw = (influencer.influencer_name || influencer.name || (influencer as any).username || '').trim();
  return raw ? raw.replace(/^@+/, '').trim() : '';
};

export const resolveDispatchedProducts = (
  influencer: CampaignInfluencer,
  dispatchRecords: any[] = []
): DispatchedProductItem[] => {
  const resolvedVideos = getInfluencerResolvedVideoProducts(influencer);
  if (!resolvedVideos || resolvedVideos.length === 0) return [];

  const dispatch = influencer.dispatchDetails || (dispatchRecords && dispatchRecords.find(d => String(d.influencer_id) === String(influencer.id)));
  const selectedProducts = Array.isArray(dispatch?.selected_products) ? dispatch.selected_products : [];

  const dispatchedVideoNumbers = new Set<number>();
  selectedProducts.forEach((sp: any) => {
    const vNum = Number(sp.video_number);
    if (!isNaN(vNum) && vNum > 0) {
      dispatchedVideoNumbers.add(vNum);
    }
  });

  const items: DispatchedProductItem[] = [];

  resolvedVideos.forEach(rv => {
    const vNum = rv.videoNumber;
    
    // If selected_products explicitly specified dispatched videos, only include those
    if (dispatchedVideoNumbers.size > 0 && !dispatchedVideoNumbers.has(vNum)) {
      return;
    }

    let prodName = '';
    if (rv.products && rv.products.length > 0) {
      const validP = rv.products.filter(p => p.name && !isVideoLabel(p.name));
      if (validP.length > 0) {
        prodName = validP.map(p => p.name).join(' + ');
      }
    }
    if (!prodName && rv.combination && !isVideoLabel(rv.combination)) {
      prodName = rv.combination.trim();
    }

    if (prodName) {
      items.push({
        videoNumber: vNum,
        productName: prodName,
        amount: rv.amount || null
      });
    }
  });

  if (items.length === 0 && resolvedVideos.length > 0) {
    const firstV = resolvedVideos[0];
    items.push({
      videoNumber: firstV.videoNumber || 1,
      productName: 'Product not assigned',
      amount: firstV.amount || null
    });
  }

  return items;
};

export const resolvePaymentDetails = (
  influencer: CampaignInfluencer,
  dispatchedVideos: DispatchedProductItem[]
): { amount: number | null; paymentText: string } => {
  const pricing = (influencer.pricing as any) || {};
  const numDispatched = dispatchedVideos.length;

  const videoPrices: { videoNumber: number; amount: number }[] = [];

  dispatchedVideos.forEach(dv => {
    let amt = dv.amount;
    const vNum = dv.videoNumber;

    if (amt === undefined || amt === null || isNaN(amt) || amt <= 0) {
      if (vNum === 1 && pricing.video1_price) amt = Number(pricing.video1_price) || 0;
      else if (vNum === 2 && pricing.video2_price) amt = Number(pricing.video2_price) || 0;
      else if (Array.isArray(pricing.product_pricing?.videos) && pricing.product_pricing.videos[vNum - 1]?.amount) {
        amt = Number(pricing.product_pricing.videos[vNum - 1].amount) || 0;
      }
    }

    if (amt !== undefined && amt !== null && !isNaN(amt) && amt > 0) {
      videoPrices.push({ videoNumber: vNum, amount: amt });
    }
  });

  if (videoPrices.length === 0) {
    const v1 = Number(pricing.video1_price) || 0;
    if (v1 > 0) {
      return {
        amount: v1,
        paymentText: numDispatched <= 1 
          ? `₹${v1.toLocaleString('en-IN')} for the video`
          : `₹${v1.toLocaleString('en-IN')} for each video`
      };
    }
    if (pricing.final_price && Number(pricing.final_price) > 0) {
      const avg = Math.round(Number(pricing.final_price) / (Number(pricing.total_videos) || numDispatched || 1));
      if (avg > 0) {
        return {
          amount: avg,
          paymentText: numDispatched <= 1
            ? `₹${avg.toLocaleString('en-IN')} for the video`
            : `₹${avg.toLocaleString('en-IN')} for each video`
        };
      }
    }
    // Missing payment: do NOT display ₹0
    return {
      amount: null,
      paymentText: ''
    };
  }

  const firstAmt = videoPrices[0].amount;
  const allSame = videoPrices.length === numDispatched && videoPrices.every(vp => vp.amount === firstAmt);

  if (allSame) {
    return {
      amount: firstAmt,
      paymentText: numDispatched <= 1
        ? `₹${firstAmt.toLocaleString('en-IN')} for the video`
        : `₹${firstAmt.toLocaleString('en-IN')} for each video`
    };
  }

  // Varying prices: per-video breakdown
  const lines = videoPrices.map(vp => `• ${getOrdinalSuffix(vp.videoNumber)} Video: ₹${vp.amount.toLocaleString('en-IN')}`);
  return {
    amount: firstAmt,
    paymentText: `\n${lines.join('\n')}`
  };
};

export const resolveInfluencerShipment = (
  influencer: CampaignInfluencer,
  campaignShipments: InfluencerDispatchedShipment[],
  dispatchRecords: any[] = []
): {
  trackingId: string;
  courier: string;
  trackingUrl: string;
  dispatchStatus: string;
} => {
  const infIdStr = String(influencer.id).trim();
  const infCode = (influencer.code || '').replace(/^#+/, '').trim().toLowerCase();

  // 1. Direct match by influencerId or influencerCode in campaignShipments
  let matched: InfluencerDispatchedShipment | undefined = campaignShipments.find(s => {
    if (s.influencerId && String(s.influencerId).trim() === infIdStr) return true;
    const sCode = (s.influencerCode || '').replace(/^#+/, '').trim().toLowerCase();
    if (sCode && sCode === infCode) return true;
    const oCode = (s.orderId || '').replace(/^#+/, '').trim().toLowerCase();
    if (oCode && (oCode === infCode || oCode === infIdStr)) return true;
    return false;
  });

  // 2. Canonical matchShipmentToInfluencer helper
  if (!matched && campaignShipments.length > 0) {
    for (const s of campaignShipments) {
      const matchRes = matchShipmentToInfluencer(s, [influencer], dispatchRecords);
      if (matchRes.matchedInfluencer && String(matchRes.matchedInfluencer.id) === infIdStr) {
        matched = s;
        break;
      }
    }
  }

  // 3. Fallback to influencer.dispatchDetails
  const dispatch = influencer.dispatchDetails || dispatchRecords.find(d => String(d.influencer_id) === infIdStr);

  const rawAwb = (matched?.awbNumber || dispatch?.tracking_id || '').trim();
  const trackingId = (rawAwb && rawAwb !== '—' && rawAwb !== '-' && rawAwb.toLowerCase() !== 'null' && rawAwb.toLowerCase() !== 'n/a') ? rawAwb : '';

  const courier = (matched?.courier || dispatch?.courier_partner || 'Delhivery').trim();
  
  let trackingUrl = matched?.trackingUrl || '';
  if (!trackingUrl && trackingId) {
    trackingUrl = getCourierTrackingUrl(courier, trackingId) || `https://www.delhivery.com/track/package/${encodeURIComponent(trackingId)}`;
  }
  if (!trackingUrl && trackingId) {
    trackingUrl = 'https://www.delhivery.com/tracking';
  }

  const dispatchStatus = matched?.status || dispatch?.dispatch_status || (isInfluencerDispatched(influencer, dispatchRecords) ? 'Dispatched' : 'Pending');

  return {
    trackingId,
    courier: courier || 'Delhivery',
    trackingUrl: trackingId ? trackingUrl : '',
    dispatchStatus
  };
};

export const buildAfterDispatchMessage = (
  influencer: CampaignInfluencer,
  dispatchedVideos: DispatchedProductItem[],
  shipmentInfo: { trackingId: string; courier: string; trackingUrl: string },
  paymentDetails: { amount: number | null; paymentText: string }
): string => {
  const name = resolveInfluencerName(influencer) || 'there';
  const numV = dispatchedVideos.length;
  
  const videoCountPhrase = numV <= 1 
    ? '1st video' 
    : `first ${numV} videos`;

  const productLines = dispatchedVideos.map(
    (pv, idx) => `${idx + 1}. ${getOrdinalSuffix(pv.videoNumber)} Video – ${pv.productName}`
  );

  const paymentLine = paymentDetails.paymentText
    ? `Payment: ${paymentDetails.paymentText}`
    : 'Payment: ';

  const trackingIdLine = `Tracking ID: ${shipmentInfo.trackingId || ''}`;
  const trackingLinkLine = shipmentInfo.trackingId && shipmentInfo.trackingUrl
    ? `Tracking Link: ${shipmentInfo.trackingUrl}`
    : 'Tracking Link: ';

  return `Hi ${name},

Sorry for the delay. We have dispatched the products for your ${videoCountPhrase} through ${shipmentInfo.courier || 'Delhivery'}.

${productLines.join('\n')}

There is a slight change in the video dates due to the delay from our side. I’ve attached the updated agreement. Kindly check the revised dates.

${trackingIdLine}
${trackingLinkLine}

${paymentLine}

Once received, please let us know. Thank you!`;
};

// -------------------------------------------------------------
// Database Persistence Service
// -------------------------------------------------------------
export const afterDispatchService = {
  getLocalKey(campaignId: string | number): string {
    return `velmora_after_dispatch_messages_${campaignId}`;
  },

  async getMessages(campaignId: string | number): Promise<Record<string, StoredAfterDispatchMessage>> {
    const cleanId = String(campaignId);
    let map: Record<string, StoredAfterDispatchMessage> = {};

    // 1. Read secondary local cache first for instant rendering
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.getLocalKey(cleanId));
        if (stored) {
          map = JSON.parse(stored);
        }
      } catch (e) {}
    }

    // 2. Query Supabase database as canonical source
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.afterDispatchMessages)
        .select('*')
        .eq('campaign_id', cleanId);

      if (!error && Array.isArray(data)) {
        const dbMap: Record<string, StoredAfterDispatchMessage> = {};
        data.forEach((row: any) => {
          const infId = String(row.influencer_id);
          dbMap[infId] = {
            id: row.id,
            campaign_id: row.campaign_id,
            influencer_id: row.influencer_id,
            influencer_code: row.influencer_code || '',
            username: row.username || '',
            creator_name: row.creator_name || '',
            dispatch_status: row.dispatch_status || 'Dispatched',
            courier: row.courier || '',
            tracking_id: row.tracking_id || '',
            tracking_url: row.tracking_url || '',
            payment_amount: row.payment_amount !== null && row.payment_amount !== undefined ? Number(row.payment_amount) : null,
            payment_text: row.payment_text || '',
            dispatched_products: Array.isArray(row.dispatched_products) ? row.dispatched_products : [],
            message_text: row.message_text,
            pdf_path: row.pdf_path || null,
            pdf_url: row.pdf_url || null,
            generated_at: row.generated_at,
            updated_at: row.updated_at
          };
        });

        // Database is authoritative
        map = dbMap;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(this.getLocalKey(cleanId), JSON.stringify(dbMap));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('after_dispatch_messages db fetch fallback to cache:', err);
    }

    return map;
  },

  async persistSingleMessage(
    campaignId: string | number,
    message: StoredAfterDispatchMessage
  ): Promise<void> {
    const cleanId = String(campaignId);
    const infId = String(message.influencer_id);

    // 1. Update local cache
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.getLocalKey(cleanId));
        const parsed = raw ? JSON.parse(raw) : {};
        parsed[infId] = message;
        localStorage.setItem(this.getLocalKey(cleanId), JSON.stringify(parsed));
      } catch (e) {}
    }

    // 2. Canonical DB upsert
    const payload = {
      campaign_id: cleanId,
      influencer_id: infId,
      influencer_code: message.influencer_code,
      username: message.username,
      creator_name: message.creator_name,
      dispatch_status: message.dispatch_status,
      courier: message.courier,
      tracking_id: message.tracking_id || null,
      tracking_url: message.tracking_url || null,
      payment_amount: message.payment_amount ?? null,
      payment_text: message.payment_text,
      dispatched_products: message.dispatched_products || [],
      message_text: message.message_text,
      pdf_path: message.pdf_path || null,
      pdf_url: message.pdf_url || null,
      generated_at: message.generated_at,
      updated_at: message.updated_at || new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.afterDispatchMessages)
        .upsert([payload], { onConflict: 'campaign_id,influencer_id' });

      if (error) {
        console.warn('after_dispatch_messages upsert error:', error.message);
      }
    } catch (e) {
      console.warn('after_dispatch_messages upsert exception:', e);
    }
  },

  async batchPersistMessages(
    campaignId: string | number,
    messages: StoredAfterDispatchMessage[]
  ): Promise<void> {
    const cleanId = String(campaignId);
    if (!messages || messages.length === 0) return;

    // 1. Update local cache
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.getLocalKey(cleanId));
        const parsed = raw ? JSON.parse(raw) : {};
        messages.forEach(m => {
          parsed[String(m.influencer_id)] = m;
        });
        localStorage.setItem(this.getLocalKey(cleanId), JSON.stringify(parsed));
      } catch (e) {}
    }

    // 2. Batch DB upsert in chunks of 50
    const CHUNK_SIZE = 50;
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);
      const payloads = chunk.map(m => ({
        campaign_id: cleanId,
        influencer_id: String(m.influencer_id),
        influencer_code: m.influencer_code,
        username: m.username,
        creator_name: m.creator_name,
        dispatch_status: m.dispatch_status,
        courier: m.courier,
        tracking_id: m.tracking_id || null,
        tracking_url: m.tracking_url || null,
        payment_amount: m.payment_amount ?? null,
        payment_text: m.payment_text,
        dispatched_products: m.dispatched_products || [],
        message_text: m.message_text,
        pdf_path: m.pdf_path || null,
        pdf_url: m.pdf_url || null,
        generated_at: m.generated_at,
        updated_at: m.updated_at || new Date().toISOString()
      }));

      try {
        const { error } = await supabase
          .from(SUPABASE_TABLES.afterDispatchMessages)
          .upsert(payloads, { onConflict: 'campaign_id,influencer_id' });

        if (error) {
          console.warn('after_dispatch_messages batch upsert error:', error.message);
        }
      } catch (e) {
        console.warn('after_dispatch_messages batch upsert exception:', e);
      }
    }
  },

  async deleteMessage(
    campaignId: string | number,
    influencerId: string | number
  ): Promise<void> {
    const cleanId = String(campaignId);
    const infId = String(influencerId);

    // 1. Remove from local cache
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.getLocalKey(cleanId));
        if (raw) {
          const parsed = JSON.parse(raw);
          delete parsed[infId];
          localStorage.setItem(this.getLocalKey(cleanId), JSON.stringify(parsed));
        }
      } catch (e) {}
    }

    // 2. Remove from Supabase
    try {
      await supabase
        .from(SUPABASE_TABLES.afterDispatchMessages)
        .delete()
        .eq('campaign_id', cleanId)
        .eq('influencer_id', infId);
    } catch (e) {}
  },

  async batchDeleteMessages(
    campaignId: string | number,
    influencerIds: (string | number)[]
  ): Promise<void> {
    const cleanId = String(campaignId);
    if (!influencerIds || influencerIds.length === 0) return;

    const idStrs = influencerIds.map(id => String(id));

    // 1. Remove from local cache
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.getLocalKey(cleanId));
        if (raw) {
          const parsed = JSON.parse(raw);
          idStrs.forEach(id => {
            delete parsed[id];
          });
          localStorage.setItem(this.getLocalKey(cleanId), JSON.stringify(parsed));
        }
      } catch (e) {}
    }

    // 2. Remove from Supabase
    try {
      await supabase
        .from(SUPABASE_TABLES.afterDispatchMessages)
        .delete()
        .eq('campaign_id', cleanId)
        .in('influencer_id', idStrs);
    } catch (e) {}
  }
};
