import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignScript } from '../types';

export const SCRIPT_PRODUCTS = [
  'Detergent',
  'Dishwash',
  'Fabric Conditioner',
  'Handwash',
  'Car Shampoo',
  'Bike Shampoo',
  'BBC Cleaner',
  'Kitchen Cleaner',
  'Glass Cleaner',
  'Floor Cleaner',
  'Magic Sponge',
  'Bamboo Kitchen Towel'
] as const;

export type ScriptProduct = typeof SCRIPT_PRODUCTS[number];

/**
 * Return public URL for an audio file in script-audio bucket
 */
export function getScriptAudioUrl(filePath: string): string {
  if (!filePath) return '';
  const client = supabaseAdmin || supabase;
  const { data } = client.storage.from('script-audio').getPublicUrl(filePath);
  return data?.publicUrl || '';
}

/**
 * Return public URL for a video file in script-video bucket
 */
export function getScriptVideoUrl(filePath: string): string {
  if (!filePath) return '';
  const client = supabaseAdmin || supabase;
  const { data } = client.storage.from('script-video').getPublicUrl(filePath);
  return data?.publicUrl || '';
}

/**
 * Upload an audio file to script-audio bucket
 */
export async function uploadScriptAudio(
  campaignId: string | number,
  scriptId: string,
  file: File
): Promise<{ path: string; error?: any }> {
  try {
    const client = supabaseAdmin || supabase;
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${campaignId}/${scriptId}/${Date.now()}_${sanitizedName}`;
    const { error } = await client.storage
      .from('script-audio')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'audio/mpeg'
      });

    if (error) {
      console.error('Error uploading script audio:', error);
      return { path: '', error };
    }
    return { path };
  } catch (err) {
    console.error('Exception uploading script audio:', err);
    return { path: '', error: err };
  }
}

/**
 * Upload a video file to script-video bucket
 */
export async function uploadScriptVideo(
  campaignId: string | number,
  scriptId: string,
  file: File
): Promise<{ path: string; error?: any }> {
  try {
    const client = supabaseAdmin || supabase;
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${campaignId}/${scriptId}/${Date.now()}_${sanitizedName}`;
    const { error } = await client.storage
      .from('script-video')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'video/mp4'
      });

    if (error) {
      console.error('Error uploading script video:', error);
      return { path: '', error };
    }
    return { path };
  } catch (err) {
    console.error('Exception uploading script video:', err);
    return { path: '', error: err };
  }
}

/**
 * Delete an audio file from script-audio bucket
 */
export async function deleteScriptAudioFile(filePath: string): Promise<void> {
  if (!filePath) return;
  try {
    const client = supabaseAdmin || supabase;
    await client.storage.from('script-audio').remove([filePath]);
  } catch (err) {
    console.warn('Failed to delete script audio file from storage:', filePath, err);
  }
}

/**
 * Delete a video file from script-video bucket
 */
export async function deleteScriptVideoFile(filePath: string): Promise<void> {
  if (!filePath) return;
  try {
    const client = supabaseAdmin || supabase;
    await client.storage.from('script-video').remove([filePath]);
  } catch (err) {
    console.warn('Failed to delete script video file from storage:', filePath, err);
  }
}

/**
 * Fetch all scripts for a specific campaign
 */
export async function fetchCampaignScripts(
  campaignId: string | number
): Promise<CampaignScript[]> {
  try {
    const client = supabaseAdmin || supabase;
    const cleanId = String(campaignId).trim();
    const { data, error } = await client
      .from(SUPABASE_TABLES.campaignScripts)
      .select('*')
      .eq('campaign_id', cleanId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaign scripts:', error);
      throw error;
    }

    return (data || []) as CampaignScript[];
  } catch (err) {
    console.error('Exception in fetchCampaignScripts:', err);
    throw err;
  }
}

export interface CreateScriptParams {
  campaign_id: string;
  product: string;
  language: string;
  model_script: string;
  key_points: string;
  reference_audio_url?: string | null;
  reference_video_url?: string | null;
  audioFile?: File | null;
  videoFile?: File | null;
}

/**
 * Create a new script in Supabase and upload any attached audio/video files
 */
export async function createCampaignScript(
  params: CreateScriptParams
): Promise<CampaignScript> {
  const client = supabaseAdmin || supabase;
  const tempScriptId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

  let uploadedAudioPath: string | null = null;
  let uploadedVideoPath: string | null = null;

  try {
    // 1. Upload audio file if present
    if (params.audioFile) {
      const { path, error } = await uploadScriptAudio(params.campaign_id, tempScriptId, params.audioFile);
      if (error) {
        throw new Error(`Failed to upload audio file: ${error.message || 'Storage error'}`);
      }
      uploadedAudioPath = path;
    }

    // 2. Upload video file if present
    if (params.videoFile) {
      const { path, error } = await uploadScriptVideo(params.campaign_id, tempScriptId, params.videoFile);
      if (error) {
        // Rollback uploaded audio if video fails
        if (uploadedAudioPath) await deleteScriptAudioFile(uploadedAudioPath);
        throw new Error(`Failed to upload video file: ${error.message || 'Storage error'}`);
      }
      uploadedVideoPath = path;
    }

    // 3. Insert record into database
    const payload = {
      campaign_id: String(params.campaign_id).trim(),
      product: params.product.trim(),
      language: params.language.trim(),
      model_script: params.model_script.trim(),
      key_points: params.key_points.trim(),
      reference_audio_url: params.reference_audio_url?.trim() || null,
      reference_audio_file_path: uploadedAudioPath,
      reference_video_url: params.reference_video_url?.trim() || null,
      reference_video_file_path: uploadedVideoPath
    };

    const { data, error } = await client
      .from(SUPABASE_TABLES.campaignScripts)
      .insert(payload)
      .select()
      .single();

    if (error) {
      // Rollback uploaded files if DB insert fails
      if (uploadedAudioPath) await deleteScriptAudioFile(uploadedAudioPath);
      if (uploadedVideoPath) await deleteScriptVideoFile(uploadedVideoPath);
      throw error;
    }

    return data as CampaignScript;
  } catch (err) {
    console.error('Exception in createCampaignScript:', err);
    throw err;
  }
}

export interface UpdateScriptParams {
  id: string;
  campaign_id: string;
  product: string;
  language: string;
  model_script: string;
  key_points: string;
  reference_audio_url?: string | null;
  reference_video_url?: string | null;
  audioFile?: File | null;
  videoFile?: File | null;
  existingAudioFilePath?: string | null;
  existingVideoFilePath?: string | null;
  removeAudioFile?: boolean;
  removeVideoFile?: boolean;
}

/**
 * Update an existing script in Supabase, managing storage replacements/cleanups
 */
export async function updateCampaignScript(
  params: UpdateScriptParams
): Promise<CampaignScript> {
  const client = supabaseAdmin || supabase;
  let finalAudioPath = params.existingAudioFilePath || null;
  let finalVideoPath = params.existingVideoFilePath || null;

  try {
    // Audio removal or replacement
    if (params.removeAudioFile && finalAudioPath) {
      await deleteScriptAudioFile(finalAudioPath);
      finalAudioPath = null;
    }

    if (params.audioFile) {
      const { path, error } = await uploadScriptAudio(params.campaign_id, params.id, params.audioFile);
      if (error) {
        throw new Error(`Failed to upload replacement audio: ${error.message || 'Storage error'}`);
      }
      // If previous file existed and is different, remove it
      if (finalAudioPath && finalAudioPath !== path) {
        await deleteScriptAudioFile(finalAudioPath);
      }
      finalAudioPath = path;
    }

    // Video removal or replacement
    if (params.removeVideoFile && finalVideoPath) {
      await deleteScriptVideoFile(finalVideoPath);
      finalVideoPath = null;
    }

    if (params.videoFile) {
      const { path, error } = await uploadScriptVideo(params.campaign_id, params.id, params.videoFile);
      if (error) {
        throw new Error(`Failed to upload replacement video: ${error.message || 'Storage error'}`);
      }
      if (finalVideoPath && finalVideoPath !== path) {
        await deleteScriptVideoFile(finalVideoPath);
      }
      finalVideoPath = path;
    }

    const payload = {
      product: params.product.trim(),
      language: params.language.trim(),
      model_script: params.model_script.trim(),
      key_points: params.key_points.trim(),
      reference_audio_url: params.reference_audio_url?.trim() || null,
      reference_audio_file_path: finalAudioPath,
      reference_video_url: params.reference_video_url?.trim() || null,
      reference_video_file_path: finalVideoPath,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from(SUPABASE_TABLES.campaignScripts)
      .update(payload)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as CampaignScript;
  } catch (err) {
    console.error('Exception in updateCampaignScript:', err);
    throw err;
  }
}

/**
 * Delete a script and clean up any uploaded files from storage
 */
export async function deleteCampaignScript(script: CampaignScript): Promise<boolean> {
  const client = supabaseAdmin || supabase;
  try {
    // 1. Delete DB record first
    const { error } = await client
      .from(SUPABASE_TABLES.campaignScripts)
      .delete()
      .eq('id', script.id);

    if (error) {
      console.error('Error deleting script record:', error);
      throw error;
    }

    // 2. Delete storage files if any exist
    if (script.reference_audio_file_path) {
      await deleteScriptAudioFile(script.reference_audio_file_path);
    }
    if (script.reference_video_file_path) {
      await deleteScriptVideoFile(script.reference_video_file_path);
    }

    return true;
  } catch (err) {
    console.error('Exception in deleteCampaignScript:', err);
    throw err;
  }
}
