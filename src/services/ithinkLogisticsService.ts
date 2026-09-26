import { supabaseAdmin } from '../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import { resolveDelhiveryCategory, InfluencerDispatchedShipment, getCourierTrackingUrl } from './influencerTrackingService';
import type { CampaignInfluencer } from '../types';

export interface IThinkLogisticsRecord {
  id: string;
  order_number: string;
  awb_no: string;
  courier_company: string | null;
  order_status: string | null;
  order_pickup_date: string | null;
  campaign_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function fetchIThinkLogisticsRecords(): Promise<IThinkLogisticsRecord[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.ithinkLogistics)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch ithink_logistics records:', error);
      return [];
    }
    return (data || []) as IThinkLogisticsRecord[];
  } catch (err) {
    console.error('Error in fetchIThinkLogisticsRecords:', err);
    return [];
  }
}

export async function upsertIThinkLogisticsRecords(
  records: Array<{
    order_number: string;
    awb_no: string;
    courier_company?: string | null;
    order_status?: string | null;
    order_pickup_date?: string | null;
    campaign_id?: string | null;
  }>
): Promise<{ success: boolean; inserted: number; updated: number; error?: string }> {
  if (!records || records.length === 0) {
    return { success: true, inserted: 0, updated: 0 };
  }

  try {
    // 1. Fetch existing records to count new vs updated
    const { data: existing } = await supabaseAdmin
      .from(SUPABASE_TABLES.ithinkLogistics)
      .select('order_number, awb_no');

    const existingKeySet = new Set<string>();
    (existing || []).forEach((r: any) => {
      const key = `${(r.order_number || '').trim().toLowerCase()}_${(r.awb_no || '').trim().toLowerCase()}`;
      existingKeySet.add(key);
    });

    let newCount = 0;
    let updateCount = 0;

    const nowIso = new Date().toISOString();
    const rowsToUpsert = records.map(r => {
      const key = `${(r.order_number || '').trim().toLowerCase()}_${(r.awb_no || '').trim().toLowerCase()}`;
      if (existingKeySet.has(key)) {
        updateCount++;
      } else {
        newCount++;
      }

      return {
        order_number: (r.order_number || '').trim(),
        awb_no: (r.awb_no || '').trim(),
        courier_company: (r.courier_company || '').trim() || null,
        order_status: (r.order_status || '').trim() || null,
        order_pickup_date: (r.order_pickup_date || '').trim() || null,
        campaign_id: r.campaign_id ? String(r.campaign_id).trim() : null,
        updated_at: nowIso
      };
    });

    // Chunk upserts in batches of 100
    const chunkSize = 100;
    for (let i = 0; i < rowsToUpsert.length; i += chunkSize) {
      const chunk = rowsToUpsert.slice(i, i + chunkSize);
      const { error } = await supabaseAdmin
        .from(SUPABASE_TABLES.ithinkLogistics)
        .upsert(chunk, { onConflict: 'order_number,awb_no' });

      if (error) {
        console.error('Failed to upsert chunk to ithink_logistics:', error);
        return { success: false, inserted: 0, updated: 0, error: error.message };
      }
    }

    return {
      success: true,
      inserted: newCount,
      updated: updateCount
    };
  } catch (err: any) {
    console.error('Error in upsertIThinkLogisticsRecords:', err);
    return { success: false, inserted: 0, updated: 0, error: err.message || 'Unknown error' };
  }
}

export function mapIThinkRecordToShipment(
  record: IThinkLogisticsRecord,
  candidateInfluencers: CampaignInfluencer[] = []
): InfluencerDispatchedShipment {
  const rawOrd = (record.order_number || '').trim();
  const rawAwb = (record.awb_no || '').trim();
  const courierCompany = (record.courier_company || '').trim() || 'Amazon';
  const orderStatus = (record.order_status || '').trim() || 'Pending';
  const pickupDate = (record.order_pickup_date || '').trim();

  // Try to match influencer code
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
    id: record.id || `ithink_${rawOrd}_${rawAwb}`,
    influencerId: matchedInf?.id ? String(matchedInf.id) : undefined,
    creatorName: matchedInf?.influencer_name || matchedInf?.name || '',
    username: matchedInf?.platforms?.find(p => p.username)?.username || '',
    influencerCode: matchedInf?.code || rawOrd || '',
    orderId: rawOrd,
    rawOrderId: rawOrd,
    baseOrderId: rawOrd,
    awbNumber: rawAwb,
    batchCode: '—',
    courier: courierCompany,
    dispatchDate: pickupDate,
    dispatchedDate: pickupDate,
    expectedDeliveryDate: '',
    estimatedDeliveryDate: '',
    deliveredDate: statusCategory === 'Delivered' ? pickupDate : undefined,
    status: orderStatus,
    statusCategory,
    rawStatus: orderStatus,
    remarks: '',
    pendingRemarks: undefined,
    currentStatus: orderStatus,
    statusSource: 'Amazon',
    sourceType: 'UPLOADED_FILE',
    profilePhoto: matchedInf?.profile_file_url || '',
    phoneNumber: matchedInf?.phone_number || '',
    altPhoneNumber: matchedInf?.alternative_number || '',
    state: matchedInf?.state || '',
    city: matchedInf?.city || '',
    pincode: matchedInf?.pincode || '',
    lastSyncedAt: record.updated_at || record.created_at || '',
    trackingUrl: getCourierTrackingUrl(courierCompany, rawAwb),
    isIThink: true,
    courierSource: 'ithink_logistics'
  } as InfluencerDispatchedShipment & { courierSource: string; isIThink: boolean };
}
