import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignInfluencer } from '../types';
import { getInfluencerResolvedVideoProducts } from '../modules/marketing/AddCampaignInfluencer';
import { InfluencerDispatchedShipment, getCourierTrackingUrl } from './influencerTrackingService';
import { ShipmentAttempt } from './shipmentAttemptService';

export interface DispatchedProductItem {
  videoNumber: number;
  productName: string;
  amount?: number | null;
}

export interface StoredReDispatchMessage {
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
  attempt_number: number;
  payment_amount?: number | null;
  payment_text?: string;
  issue_type?: string | null;
  issue_remarks?: string | null;
  dispatched_products: DispatchedProductItem[];
  message_text: string;
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

export const resolveReDispatchProducts = (
  influencer: CampaignInfluencer,
  dispatchRecords: any[] = []
): DispatchedProductItem[] => {
  const resolvedVideos = getInfluencerResolvedVideoProducts(influencer);
  if (!resolvedVideos || resolvedVideos.length === 0) return [];

  const dispatch = influencer.dispatchDetails || (dispatchRecords && dispatchRecords.find(d => String(d.influencer_id) === String(influencer.id)));
  const selectedProducts = Array.isArray(dispatch?.selected_products) ? dispatch.selected_products : [];

  const dispatchedVideoNumbers = new Set<number>();
  selectedProducts.forEach((sp: any) => {
    if (typeof sp === 'number') {
      dispatchedVideoNumbers.add(sp);
    } else if (typeof sp === 'string' && /^\d+$/.test(sp.trim())) {
      dispatchedVideoNumbers.add(parseInt(sp.trim(), 10));
    }
  });

  const items: DispatchedProductItem[] = [];
  resolvedVideos.forEach((v) => {
    const isSelected = dispatchedVideoNumbers.size === 0 || dispatchedVideoNumbers.has(v.videoNumber);
    if (!isSelected) return;

    const names = (v.products || [])
      .filter((p: any) => p.selected !== false)
      .map((p: any) => (p.name || '').trim())
      .filter(Boolean);

    if (names.length > 0) {
      items.push({
        videoNumber: v.videoNumber,
        productName: names.join(' + '),
        amount: v.amount ?? null
      });
    }
  });

  if (items.length === 0 && resolvedVideos.length > 0) {
    resolvedVideos.forEach((v) => {
      const names = (v.products || [])
        .map((p: any) => (p.name || '').trim())
        .filter(Boolean);
      if (names.length > 0) {
        items.push({
          videoNumber: v.videoNumber,
          productName: names.join(' + '),
          amount: v.amount ?? null
        });
      }
    });
  }

  return items;
};

import { extractInfluencerCodeFromOrderId } from './shipmentAttemptService';

export const isGenuineReDispatchInfluencer = (
  influencer: CampaignInfluencer,
  dispatchRecords: any[] = [],
  shipmentAttempts: ShipmentAttempt[] = [],
  shipments: InfluencerDispatchedShipment[] = []
): boolean => {
  const infId = String(influencer.id).trim();
  const rawCode = (influencer.code || (influencer as any).influencer_code || '').trim();
  const code = rawCode.replace(/^#+/, '').trim().toLowerCase();

  // 1. Explicit Re-Dispatch status in dispatch details or influencer info
  const disp = influencer.dispatchDetails || (dispatchRecords && dispatchRecords.find(d => String(d.influencer_id) === infId));
  const dispStatus = (disp?.dispatch_status || (influencer as any).dispatch_status || '').trim().toLowerCase();
  if (dispStatus === 're_dispatch' || dispStatus === 're-dispatch' || dispStatus === 'redispatch') {
    return true;
  }
  if (
    (influencer as any).is_redispatched === true || 
    (influencer as any).shipment_workflow_status === 'redispatch' || 
    (influencer as any).re_dispatch_required === true
  ) {
    return true;
  }

  // 2. Dispatch details remarks indicates issue reported
  const dispRemarks = (disp?.remarks || '').trim().toLowerCase();
  if (dispRemarks.startsWith('issue reported')) {
    return true;
  }

  // 3. Shipment attempts matching EXACTLY this influencer (strictly by id or exact normalized code)
  const matchingAttempts = shipmentAttempts.filter(a => {
    if (a.influencer_id && String(a.influencer_id) === infId) return true;
    if (a.order_id && code) {
      const aCode = extractInfluencerCodeFromOrderId(a.order_id).toLowerCase();
      if (aCode === code) return true;
    }
    return false;
  });

  const hasReAttempt = matchingAttempts.some(a => 
    a.shipment_type === 'RE_DISPATCH' || 
    (a.attempt_number && a.attempt_number > 1)
  );
  if (hasReAttempt) return true;

  const hasIssueAttempt = matchingAttempts.some(a => a.issue_reported === true);
  if (hasIssueAttempt) return true;

  // 4. Tracking shipments matching EXACTLY this influencer with confirmed replacement shipment
  const matchingShipments = shipments.filter(s => {
    if (s.influencerId && String(s.influencerId) === infId) return true;
    if (s.influencerCode && code) {
      const sCode = s.influencerCode.replace(/^#+/, '').trim().toLowerCase();
      if (sCode === code) return true;
    }
    if (s.orderId && code) {
      const oCode = extractInfluencerCodeFromOrderId(s.orderId).toLowerCase();
      if (oCode === code) return true;
    }
    return false;
  });

  const hasReShipment = matchingShipments.some(s => {
    const rawOrd = (s.rawOrderId || s.orderId || '').trim();
    if (/^R\s+[A-Za-z0-9]/i.test(rawOrd)) return true;
    return Boolean(s.isResend && s.attemptNumber && s.attemptNumber > 1);
  });
  if (hasReShipment) return true;

  return false;
};

export const resolveReDispatchShipmentInfo = (
  influencer: CampaignInfluencer,
  shipments: InfluencerDispatchedShipment[] = [],
  shipmentAttempts: ShipmentAttempt[] = [],
  dispatchRecords: any[] = []
): {
  trackingId: string;
  courier: string;
  trackingUrl: string;
  attemptNumber: number;
  issueType: string;
  issueRemarks: string;
  dispatchStatus: string;
} => {
  const infId = String(influencer.id).trim();
  const rawCode = (influencer.code || (influencer as any).influencer_code || '').trim();
  const code = rawCode.replace(/^#+/, '').trim().toLowerCase();

  // 1. Look for attempts in shipmentAttempts matching this influencer EXACTLY (no substring matches)
  const matchingAttempts = shipmentAttempts
    .filter(a => {
      if (a.influencer_id && String(a.influencer_id) === infId) return true;
      if (a.order_id && code) {
        const aCode = extractInfluencerCodeFromOrderId(a.order_id).toLowerCase();
        if (aCode === code) return true;
      }
      return false;
    })
    .sort((a, b) => (b.attempt_number || 1) - (a.attempt_number || 1));

  const reDispatchAttempt = matchingAttempts.find(a => (a.attempt_number && a.attempt_number > 1) || a.shipment_type === 'RE_DISPATCH');
  const issueAttempt = matchingAttempts.find(a => a.issue_reported);

  // 2. Look for shipments in tracking shipments matching this influencer EXACTLY
  const matchingShipments = shipments
    .filter(s => {
      if (s.influencerId && String(s.influencerId) === infId) return true;
      if (s.influencerCode && code) {
        const sCode = s.influencerCode.replace(/^#+/, '').trim().toLowerCase();
        if (sCode === code) return true;
      }
      if (s.orderId && code) {
        const oCode = extractInfluencerCodeFromOrderId(s.orderId).toLowerCase();
        if (oCode === code) return true;
      }
      return false;
    })
    .sort((a, b) => (b.attemptNumber || 1) - (a.attemptNumber || 1));

  const reDispatchShipment = matchingShipments.find(s => {
    if (s.isResend && s.attemptNumber && s.attemptNumber > 1) return true;
    if (s.statusCategory === 'Re-Dispatch') return true;
    const rawOrd = (s.rawOrderId || s.orderId || '').trim();
    if (/^R\s+[A-Za-z0-9]/i.test(rawOrd)) return true;
    return false;
  });

  // 3. Fallback to dispatch records
  const disp = influencer.dispatchDetails || (dispatchRecords && dispatchRecords.find(d => String(d.influencer_id) === infId));

  const courier = (
    reDispatchShipment?.courier ||
    reDispatchAttempt?.courier ||
    issueAttempt?.courier ||
    disp?.courier_partner ||
    disp?.courier_name ||
    disp?.courier ||
    (influencer as any).courier ||
    (influencer as any).courier_name ||
    'Delhivery'
  ).trim();

  // Tracking ID: prefer the replacement shipment AWB; then replacement attempt AWB; then issue attempt AWB; then dispatch tracking ID
  const trackingId = (
    reDispatchShipment?.awbNumber ||
    reDispatchAttempt?.awb_number ||
    issueAttempt?.awb_number ||
    disp?.tracking_id ||
    disp?.awb_number ||
    (influencer as any).tracking_id ||
    (influencer as any).awb_number ||
    ''
  ).trim();

  const trackingUrl = (
    courier.toLowerCase().includes('delhivery')
      ? 'https://www.delhivery.com/tracking'
      : (reDispatchShipment?.trackingUrl || (trackingId ? getCourierTrackingUrl(courier, trackingId) : '') || 'https://www.delhivery.com/tracking')
  ).trim();

  const attemptNumber = Math.max(
    2,
    reDispatchAttempt?.attempt_number || reDispatchShipment?.attemptNumber || 2
  );

  const issueType = issueAttempt?.issue_type || reDispatchAttempt?.issue_type || (issueAttempt?.issue_reported ? 'Issue Reported' : '') || '';
  const issueRemarks = issueAttempt?.issue_remarks || reDispatchAttempt?.issue_remarks || disp?.remarks || '';

  // Status: if replacement shipment is tracked, use its status; else if replacement attempt exists, use its status; else 'Issue Reported'
  let dispatchStatus = 'Re-Dispatch';
  if (reDispatchShipment?.status) {
    dispatchStatus = reDispatchShipment.status;
  } else if (reDispatchAttempt?.shipment_status && reDispatchAttempt.shipment_status !== 'Pending') {
    dispatchStatus = reDispatchAttempt.shipment_status;
  } else if (
    issueAttempt?.issue_reported || 
    issueAttempt?.shipment_status === 'Issue Reported' || 
    (disp?.remarks && disp.remarks.toLowerCase().startsWith('issue reported'))
  ) {
    dispatchStatus = 'Issue Reported';
  } else if (disp?.dispatch_status) {
    dispatchStatus = disp.dispatch_status;
  }

  return {
    trackingId,
    courier,
    trackingUrl,
    attemptNumber,
    issueType,
    issueRemarks,
    dispatchStatus
  };
};

export function buildReDispatchMessage(
  influencer: CampaignInfluencer,
  shipmentInfoOrVideos: any,
  maybeShipmentInfo?: any,
  _maybeCampaignName?: any
): string {
  // Support both (influencer, shipmentInfo) and (influencer, dispatchedVideos, shipmentInfo, campaignName)
  let shipmentInfo = shipmentInfoOrVideos;
  if (Array.isArray(shipmentInfoOrVideos) && maybeShipmentInfo) {
    shipmentInfo = maybeShipmentInfo;
  }

  const code = (
    influencer.code ||
    (influencer as any).influencer_code ||
    (influencer as any).influencerCode ||
    resolveInfluencerName(influencer) ||
    'there'
  ).trim();

  const courier = (shipmentInfo?.courier || 'Delhivery').trim();
  const trackingId = (shipmentInfo?.trackingId || '').trim();
  const trackingUrl = (
    courier.toLowerCase().includes('delhivery')
      ? 'https://www.delhivery.com/tracking'
      : (shipmentInfo?.trackingUrl || (trackingId ? getCourierTrackingUrl(courier, trackingId) : '') || 'https://www.delhivery.com/tracking')
  ).trim();

  const displayTrackingId = trackingId || 'To be updated';
  const displayTrackingLink = trackingUrl || 'https://www.delhivery.com/tracking';

  return `Hi ${code},

Sorry about the damaged product you received.

We have redispatched the replacement through ${courier}. Kindly use the tracking details below to check the shipment status.

Tracking ID: ${displayTrackingId}
Tracking Link: ${displayTrackingLink}

Once you receive the replacement, please let us know.

Sorry again for the inconvenience, and thank you for your understanding!`;
}

export const reDispatchFormatService = {
  getLocalKey(campaignId: string | number): string {
    return `velmora_redispatch_format_messages_${campaignId}`;
  },

  async getMessages(campaignId: string | number): Promise<Record<string, StoredReDispatchMessage>> {
    const cleanId = String(campaignId);
    let map: Record<string, StoredReDispatchMessage> = {};

    // Read dedicated local cache and filter out any stale delay/old-format messages
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.getLocalKey(cleanId));
        if (stored) {
          const parsed = JSON.parse(stored);
          let cleaned = false;
          Object.entries(parsed).forEach(([k, v]: [string, any]) => {
            const txt = (v?.message_text || '').toLowerCase();
            const isStale =
              txt.includes('sorry for the delay') ||
              txt.includes('replacement dispatch') ||
              txt.includes('collaboration videos in');

            if (!isStale) {
              map[k] = v;
            } else {
              cleaned = true;
            }
          });
          if (cleaned) {
            localStorage.setItem(this.getLocalKey(cleanId), JSON.stringify(map));
          }
        }
      } catch (e) {}
    }

    return map;
  },

  async persistSingleMessage(
    campaignId: string | number,
    message: StoredReDispatchMessage
  ): Promise<void> {
    const cleanId = String(campaignId);
    const infId = String(message.influencer_id);

    // Update dedicated local cache
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.getLocalKey(cleanId));
        const parsed = raw ? JSON.parse(raw) : {};
        parsed[infId] = message;
        localStorage.setItem(this.getLocalKey(cleanId), JSON.stringify(parsed));
      } catch (e) {}
    }
  },

  async batchPersistMessages(
    campaignId: string | number,
    messages: StoredReDispatchMessage[]
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
  },

  async deleteMessage(
    campaignId: string | number,
    influencerId: string | number
  ): Promise<void> {
    const cleanId = String(campaignId);
    const infId = String(influencerId);

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
  },

  async batchDeleteMessages(
    campaignId: string | number,
    influencerIds: (string | number)[]
  ): Promise<void> {
    const cleanId = String(campaignId);
    if (!influencerIds || influencerIds.length === 0) return;

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.getLocalKey(cleanId));
        if (raw) {
          const parsed = JSON.parse(raw);
          influencerIds.forEach(id => {
            delete parsed[String(id)];
          });
          localStorage.setItem(this.getLocalKey(cleanId), JSON.stringify(parsed));
        }
      } catch (e) {}
    }
  }
};
