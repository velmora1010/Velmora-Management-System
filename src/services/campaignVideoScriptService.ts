import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';

export interface CampaignVideoScriptRecord {
  id?: string;
  campaign_id: string;
  influencer_id: number;
  video_number: number;
  custom_concept?: string | null;
  hooks?: string | null;
  proposed_script?: string | null;
  voice_record_url?: string | null;
  voice_record_file_name?: string | null;
  voice_record_file_size?: string | null;
  voice_record_storage_path?: string | null;
  script_shared_approved?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Fetch campaign video scripts for a given campaign and set of influencer IDs
 */
export async function fetchCampaignVideoScripts(
  campaignId: string | number,
  influencerIds?: (string | number)[]
): Promise<CampaignVideoScriptRecord[]> {
  try {
    const cleanCampaignId = String(campaignId).trim();
    let query = (supabaseAdmin || supabase)
      .from(SUPABASE_TABLES.campaignVideoScripts)
      .select('*')
      .eq('campaign_id', cleanCampaignId);

    if (influencerIds && influencerIds.length > 0) {
      const numIds = influencerIds.map(id => Number(id)).filter(id => !isNaN(id));
      if (numIds.length > 0) {
        query = query.in('influencer_id', numIds);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching campaign video scripts:', error);
      return [];
    }

    return (data || []) as CampaignVideoScriptRecord[];
  } catch (err) {
    console.error('Exception fetching campaign video scripts:', err);
    return [];
  }
}

/**
 * Upsert a campaign video script record based on (campaign_id, influencer_id, video_number)
 */
export async function upsertCampaignVideoScript(
  payload: CampaignVideoScriptRecord
): Promise<{ success: boolean; data?: CampaignVideoScriptRecord; error?: any }> {
  try {
    const client = supabaseAdmin || supabase;
    const cleanPayload = {
      campaign_id: String(payload.campaign_id).trim(),
      influencer_id: Number(payload.influencer_id),
      video_number: Number(payload.video_number),
      custom_concept: payload.custom_concept != null ? payload.custom_concept : null,
      hooks: payload.hooks != null ? payload.hooks : null,
      proposed_script: payload.proposed_script != null ? payload.proposed_script : null,
      voice_record_url: payload.voice_record_url != null ? payload.voice_record_url : null,
      voice_record_file_name: payload.voice_record_file_name != null ? payload.voice_record_file_name : null,
      voice_record_file_size: payload.voice_record_file_size != null ? payload.voice_record_file_size : null,
      voice_record_storage_path: payload.voice_record_storage_path != null ? payload.voice_record_storage_path : null,
      script_shared_approved: payload.script_shared_approved ?? false,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from(SUPABASE_TABLES.campaignVideoScripts)
      .upsert(cleanPayload, {
        onConflict: 'campaign_id,influencer_id,video_number'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting campaign video script:', error);
      return { success: false, error };
    }

    // Dispatch global event for reactive UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('velmora:campaign-video-script-updated', {
          detail: {
            campaignId: cleanPayload.campaign_id,
            influencerId: cleanPayload.influencer_id,
            videoNumber: cleanPayload.video_number,
            record: data
          }
        })
      );
    }

    return { success: true, data: data as CampaignVideoScriptRecord };
  } catch (err) {
    console.error('Exception upserting campaign video script:', err);
    return { success: false, error: err };
  }
}
