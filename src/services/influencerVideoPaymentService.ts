import { supabaseAdmin } from '../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../config/supabaseTables';

export type PaymentType = 'advance' | 'final';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
export type PaymentMethod = 'UPI' | 'ACCOUNT_DETAILS' | string;

export interface InfluencerVideoPayment {
  id: string;
  campaign_id: string;
  influencer_id: number;
  video_number: number;
  payment_type: PaymentType;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  agreed_amount: number | null;
  paid_amount: number | null;
  transaction_reference: string | null;
  payment_date: string | null;
  payment_proof_url: string | null;
  notes: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InfluencerVideoPaymentTransaction {
  id: string;
  payment_row_id?: string | null;
  campaign_id: string;
  influencer_id: number;
  video_number: number;
  payment_type: PaymentType;
  amount: number;
  payment_method?: string | null;
  payment_status: PaymentStatus | string;
  transaction_reference?: string | null;
  payment_date: string;
  payment_proof_url?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface SaveVideoPaymentParams {
  campaignId: string | number;
  influencerId: number | string;
  videoNumber: number;
  paymentType: PaymentType;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  agreedAmount?: number | null;
  paidAmount?: number | null;
  transactionReference?: string | null;
  paymentProofUrl?: string | null;
  paymentDate?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

/**
 * Fetch current per-video payment records for an influencer in a campaign
 */
export async function fetchVideoPayments(
  campaignId: string | number,
  influencerId: number | string
): Promise<InfluencerVideoPayment[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencerVideoPayment)
      .select('*')
      .eq('campaign_id', String(campaignId).trim())
      .eq('influencer_id', Number(influencerId))
      .order('video_number', { ascending: true });

    if (error) {
      console.error('Error fetching video payments:', error);
      return [];
    }
    return (data || []) as InfluencerVideoPayment[];
  } catch (err) {
    console.error('Error in fetchVideoPayments:', err);
    return [];
  }
}

/**
 * Fetch permanent payment transaction history for an influencer and optional video number
 */
export async function fetchVideoPaymentTransactions(
  campaignId: string | number,
  influencerId: number | string,
  videoNumber?: number
): Promise<InfluencerVideoPaymentTransaction[]> {
  try {
    let query = supabaseAdmin
      .from(SUPABASE_TABLES.influencerVideoPaymentTransactions)
      .select('*')
      .eq('campaign_id', String(campaignId).trim())
      .eq('influencer_id', Number(influencerId));

    if (videoNumber !== undefined && videoNumber !== null) {
      query = query.eq('video_number', Number(videoNumber));
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment transactions:', error);
      return [];
    }
    return (data || []) as InfluencerVideoPaymentTransaction[];
  } catch (err) {
    console.error('Error in fetchVideoPaymentTransactions:', err);
    return [];
  }
}

/**
 * Save / update payment for a specific video and append to permanent transaction history
 */
export async function saveVideoPayment(
  params: SaveVideoPaymentParams
): Promise<{ payment: InfluencerVideoPayment | null; transaction?: InfluencerVideoPaymentTransaction | null; error?: any }> {
  try {
    const cleanCampId = String(params.campaignId).trim();
    const numInfId = Number(params.influencerId);
    const vNum = Number(params.videoNumber);
    const pType = params.paymentType;
    const pStatus = params.paymentStatus || 'paid';
    const nowIso = params.paymentDate || new Date().toISOString();

    const paymentPayload: any = {
      campaign_id: cleanCampId,
      influencer_id: numInfId,
      video_number: vNum,
      payment_type: pType,
      payment_status: pStatus,
      payment_method: params.paymentMethod || null,
      agreed_amount: params.agreedAmount !== undefined && params.agreedAmount !== null ? Number(params.agreedAmount) : null,
      paid_amount: params.paidAmount !== undefined && params.paidAmount !== null ? Number(params.paidAmount) : 0,
      transaction_reference: params.transactionReference ? String(params.transactionReference).trim() : null,
      payment_proof_url: params.paymentProofUrl ? String(params.paymentProofUrl).trim() : null,
      payment_date: nowIso,
      notes: params.notes || null,
      updated_by: params.createdBy || 'User'
    };

    // Upsert payment row with unique conflict on (campaign_id, influencer_id, video_number, payment_type)
    const { data: upsertData, error: upsertErr } = await supabaseAdmin
      .from(SUPABASE_TABLES.influencerVideoPayment)
      .upsert(paymentPayload, {
        onConflict: 'campaign_id,influencer_id,video_number,payment_type'
      })
      .select()
      .single();

    if (upsertErr) {
      console.error('Error upserting influencer_video_payment_rows:', upsertErr);
      return { payment: null, error: upsertErr };
    }

    const savedPayment = upsertData as InfluencerVideoPayment;
    let savedTransaction: InfluencerVideoPaymentTransaction | null = null;

    // Append to permanent transaction log if payment was marked paid or has paid amount
    if (pStatus === 'paid' || (params.paidAmount && Number(params.paidAmount) > 0)) {
      const txPayload = {
        payment_row_id: savedPayment.id,
        campaign_id: cleanCampId,
        influencer_id: numInfId,
        video_number: vNum,
        payment_type: pType,
        amount: Number(params.paidAmount) || 0,
        payment_method: params.paymentMethod || null,
        payment_status: pStatus,
        transaction_reference: params.transactionReference ? String(params.transactionReference).trim() : null,
        payment_proof_url: params.paymentProofUrl ? String(params.paymentProofUrl).trim() : null,
        payment_date: nowIso,
        notes: params.notes || null,
        created_by: params.createdBy || 'User'
      };

      const { data: txData, error: txErr } = await supabaseAdmin
        .from(SUPABASE_TABLES.influencerVideoPaymentTransactions)
        .insert(txPayload)
        .select()
        .single();

      if (txErr) {
        console.warn('Warning: Failed to insert payment transaction audit record:', txErr);
      } else {
        savedTransaction = txData as InfluencerVideoPaymentTransaction;
      }
    }

    // Broadcast synchronization events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('velmora:video-payment-updated', {
          detail: {
            campaignId: cleanCampId,
            influencerId: numInfId,
            videoNumber: vNum,
            paymentType: pType,
            payment: savedPayment
          }
        })
      );
      window.dispatchEvent(
        new CustomEvent('velmora:influencer-updated', {
          detail: { influencerId: numInfId }
        })
      );
    }

    return { payment: savedPayment, transaction: savedTransaction };
  } catch (err) {
    console.error('Error in saveVideoPayment:', err);
    return { payment: null, error: err };
  }
}
