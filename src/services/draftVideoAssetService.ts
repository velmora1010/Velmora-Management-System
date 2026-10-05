import { supabaseAdmin } from '../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../config/supabaseTables';

export type DraftAssetType = 'original' | 'tamil_translation';

export interface DraftVideoAsset {
  id?: string;
  campaign_id: string;
  influencer_id: number;
  video_number: number;
  draft_attempt_id: number;
  asset_type: DraftAssetType;
  file_url: string;
  file_name?: string | null;
  file_size?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SaveDraftVideoAssetParams {
  campaignId: string | number;
  influencerId: string | number;
  videoNumber: number;
  draftAttemptId: number;
  assetType: DraftAssetType;
  fileUrl: string;
  fileName?: string | null;
  fileSize?: string | null;
}

/**
 * Fetch all draft video assets for an influencer in a campaign, optionally filtered by video and attempt
 */
export async function fetchDraftVideoAssets(
  campaignId: string | number,
  influencerId: string | number,
  videoNumber?: number,
  draftAttemptId?: number
): Promise<DraftVideoAsset[]> {
  try {
    let query = supabaseAdmin
      .from(SUPABASE_TABLES.draftVideoAssets)
      .select('*')
      .eq('campaign_id', String(campaignId).trim())
      .eq('influencer_id', Number(influencerId));

    if (videoNumber !== undefined) {
      query = query.eq('video_number', Number(videoNumber));
    }
    if (draftAttemptId !== undefined) {
      query = query.eq('draft_attempt_id', Number(draftAttemptId));
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching draft_video_assets (non-fatal):', error.message);
      return [];
    }
    return (data || []) as DraftVideoAsset[];
  } catch (err: any) {
    console.warn('Exception in fetchDraftVideoAssets (non-fatal):', err?.message);
    return [];
  }
}

/**
 * Upsert a draft video asset (original or tamil_translation)
 */
export async function upsertDraftVideoAsset(
  params: SaveDraftVideoAssetParams
): Promise<DraftVideoAsset | null> {
  try {
    const payload = {
      campaign_id: String(params.campaignId).trim(),
      influencer_id: Number(params.influencerId),
      video_number: Number(params.videoNumber),
      draft_attempt_id: Number(params.draftAttemptId),
      asset_type: params.assetType,
      file_url: params.fileUrl,
      file_name: params.fileName || null,
      file_size: params.fileSize || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.draftVideoAssets)
      .upsert(payload, {
        onConflict: 'campaign_id,influencer_id,video_number,draft_attempt_id,asset_type'
      })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Error upserting draft_video_assets (non-fatal):', error.message);
      return null;
    }
    return data as DraftVideoAsset;
  } catch (err: any) {
    console.warn('Exception in upsertDraftVideoAsset (non-fatal):', err?.message);
    return null;
  }
}

/**
 * Delete draft video assets for a specific attempt (used when deleting an attempt)
 */
export async function deleteDraftVideoAssetsForAttempt(
  campaignId: string | number,
  influencerId: string | number,
  videoNumber: number,
  draftAttemptId: number
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from(SUPABASE_TABLES.draftVideoAssets)
      .delete()
      .eq('campaign_id', String(campaignId).trim())
      .eq('influencer_id', Number(influencerId))
      .eq('video_number', Number(videoNumber))
      .eq('draft_attempt_id', Number(draftAttemptId));

    if (error) {
      console.warn('Error deleting draft_video_assets (non-fatal):', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('Exception in deleteDraftVideoAssetsForAttempt (non-fatal):', err?.message);
    return false;
  }
}
