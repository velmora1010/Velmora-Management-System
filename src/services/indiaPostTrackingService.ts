import { supabaseAdmin } from '../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import { 
  resolveDelhiveryCategory, 
  InfluencerDispatchedShipment, 
  getCourierTrackingUrl 
} from './influencerTrackingService';
import type { CampaignInfluencer } from '../types';

export interface IndiaPostTrackingRecord {
  id: string;
  campaign_id: string;
  order_id: string;
  awb_number: string;
  courier: string;
  status: string;
  status_category?: string | null;
  dispatch_date: string;
  estimated_delivery_date?: string | null;
  delivered_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function fetchIndiaPostRecords(
  campaignId: string | number
): Promise<IndiaPostTrackingRecord[]> {
  const cleanCampaignId = String(campaignId).trim();
  if (!cleanCampaignId) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.indiaPostTracking)
      .select('*')
      .eq('campaign_id', cleanCampaignId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch india_post_tracking records:', error);
      return [];
    }
    return (data || []) as IndiaPostTrackingRecord[];
  } catch (err) {
    console.error('Error in fetchIndiaPostRecords:', err);
    return [];
  }
}

export async function createIndiaPostRecord(payload: {
  campaign_id: string | number;
  order_id: string;
  awb_number: string;
  courier?: string;
  status: string;
  dispatch_date: string;
  estimated_delivery_date?: string | null;
  delivered_date?: string | null;
}): Promise<{ success: boolean; data?: IndiaPostTrackingRecord; error?: string }> {
  try {
    const nowIso = new Date().toISOString();
    const cleanCampaignId = String(payload.campaign_id).trim();
    const cleanOrderId = (payload.order_id || '').trim();
    const cleanAwb = (payload.awb_number || '').trim();
    const cleanCourier = (payload.courier || '').trim() || 'India Post';
    const cleanStatus = (payload.status || '').trim();
    const cleanDispatchDate = (payload.dispatch_date || '').trim();
    const cleanEdd = payload.estimated_delivery_date ? String(payload.estimated_delivery_date).trim() : null;
    const cleanDel = payload.delivered_date ? String(payload.delivered_date).trim() : null;

    if (!cleanCampaignId || !cleanOrderId || !cleanAwb || !cleanStatus || !cleanDispatchDate) {
      return { success: false, error: 'Missing required fields for India Post tracking entry.' };
    }

    const category = resolveDelhiveryCategory(cleanStatus, cleanStatus);

    const rowToInsert = {
      campaign_id: cleanCampaignId,
      order_id: cleanOrderId,
      awb_number: cleanAwb,
      courier: cleanCourier,
      status: cleanStatus,
      status_category: category,
      dispatch_date: cleanDispatchDate,
      estimated_delivery_date: cleanEdd,
      delivered_date: cleanDel,
      created_at: nowIso,
      updated_at: nowIso
    };

    const { data, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.indiaPostTracking)
      .insert(rowToInsert)
      .select()
      .single();

    if (error) {
      console.error('Failed to insert into india_post_tracking:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as IndiaPostTrackingRecord };
  } catch (err: any) {
    console.error('Error in createIndiaPostRecord:', err);
    return { success: false, error: err?.message || 'Unknown error occurred while creating India Post record.' };
  }
}

export async function deleteIndiaPostRecord(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'ID is required' };

  try {
    const { error } = await supabaseAdmin
      .from(SUPABASE_TABLES.indiaPostTracking)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete india_post_tracking record:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error in deleteIndiaPostRecord:', err);
    return { success: false, error: err?.message || 'Unknown error occurred while deleting India Post record.' };
  }
}

export function mapIndiaPostRecordToShipment(
  record: IndiaPostTrackingRecord,
  candidateInfluencers: CampaignInfluencer[] = []
): InfluencerDispatchedShipment {
  const rawOrd = (record.order_id || '').trim();
  const rawAwb = (record.awb_number || '').trim();
  const courierCompany = (record.courier || '').trim() || 'India Post';
  const orderStatus = (record.status || '').trim() || 'Pending';
  const dispatchDate = (record.dispatch_date || '').trim();
  const estDate = (record.estimated_delivery_date || '').trim();
  const delDate = (record.delivered_date || '').trim();

  let matchedInf: CampaignInfluencer | undefined;
  if (candidateInfluencers.length > 0 && rawOrd) {
    const cleanRef = rawOrd.replace(/^#+/, '').trim().toUpperCase();
    matchedInf = candidateInfluencers.find(inf => {
      const infCode = (inf.code || '').replace(/^#+/, '').trim().toUpperCase();
      return infCode && infCode === cleanRef;
    });
  }

  const statusCategory = resolveDelhiveryCategory(orderStatus, orderStatus);

  return {
    id: record.id || `ip_${rawOrd}_${rawAwb}`,
    influencerId: matchedInf?.id ? String(matchedInf.id) : undefined,
    creatorName: matchedInf?.influencer_name || matchedInf?.name || '—',
    username: matchedInf?.platforms?.find(p => p.username)?.username || '—',
    influencerCode: matchedInf?.code || rawOrd || '—',
    orderId: rawOrd,
    rawOrderId: rawOrd,
    baseOrderId: rawOrd,
    awbNumber: rawAwb,
    batchCode: '—',
    courier: courierCompany,
    dispatchDate: dispatchDate,
    dispatchedDate: dispatchDate,
    expectedDeliveryDate: estDate,
    estimatedDeliveryDate: estDate,
    deliveredDate: delDate || (statusCategory === 'Delivered' ? dispatchDate : undefined),
    status: orderStatus,
    statusCategory,
    rawStatus: orderStatus,
    remarks: '',
    pendingRemarks: undefined,
    currentStatus: orderStatus,
    statusSource: 'India Post Manual Entry',
    sourceType: 'UPLOADED_FILE',
    profilePhoto: matchedInf?.profile_file_url || '',
    phoneNumber: matchedInf?.phone_number || '',
    altPhoneNumber: matchedInf?.alternative_number || '',
    state: matchedInf?.state || '',
    city: matchedInf?.city || '',
    pincode: matchedInf?.pincode || '',
    lastSyncedAt: record.updated_at || record.created_at || '',
    trackingUrl: getCourierTrackingUrl(courierCompany, rawAwb),
    isIndiaPost: true,
    courierSource: 'india_post'
  } as InfluencerDispatchedShipment & { isIndiaPost: boolean; courierSource: string };
}
