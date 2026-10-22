import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignScript } from '../types';

export interface ScriptProductItem {
  id: string;
  name: string;
  aliases: string[];
}

/**
 * Standard 12 products with verified IDs, display names, and matching aliases.
 * The catalog array defines the stable, deterministic ordering.
 */
export const SCRIPT_PRODUCTS_CATALOG: ScriptProductItem[] = [
  { id: 'diy-detergent-liquid', name: 'DIY Detergent Liquid', aliases: ['diy detergent liquid', 'detergent', 'diy detergent'] },
  { id: 'diy-dishwash-liquid', name: 'DIY Dishwash Liquid', aliases: ['diy dishwash liquid', 'dishwash', 'diy dishwash'] },
  { id: 'diy-fabric-conditioner', name: 'DIY Fabric Conditioner', aliases: ['diy fabric conditioner', 'fabric conditioner', 'conditioner'] },
  { id: 'kitchen-cleaner', name: 'Kitchen Cleaner', aliases: ['kitchen cleaner', 'kitchen'] },
  { id: 'bbc-cleaner', name: 'BBC Cleaner — Brass, Bronze & Copper Cleaner', aliases: ['bbc cleaner', 'brass, bronze & copper cleaner', 'bbc cleaner — brass, bronze & copper cleaner', 'diy bbc cleaner'] },
  { id: 'handwash', name: 'Handwash', aliases: ['handwash', 'hand wash'] },
  { id: 'floor-cleaner', name: 'Floor Cleaner', aliases: ['floor cleaner', 'floor'] },
  { id: 'glass-cleaner', name: 'Glass Cleaner', aliases: ['glass cleaner', 'glass'] },
  { id: 'bike-shampoo', name: 'Bike Shampoo', aliases: ['bike shampoo', 'bike wash'] },
  { id: 'car-shampoo', name: 'Car Shampoo', aliases: ['car shampoo', 'car wash'] },
  { id: 'bamboo-kitchen-towel', name: 'Bamboo Kitchen Towel', aliases: ['bamboo kitchen towel', 'bamboo towel', 'kitchen towel'] },
  { id: 'snow-foam-sprayer', name: 'Snow Foam Sprayer', aliases: ['snow foam sprayer', 'snow foam sprayer — new product', 'foam sprayer'] }
];

export const SCRIPT_PRODUCTS = SCRIPT_PRODUCTS_CATALOG.map(p => p.name);

export const COMBO_PRODUCTS = [
  'DIY Home Care Combo',
  'DIY Laundry Care Combo',
  'DIY Kitchen & Pooja Care Combo',
  'DIY Kitchen Care Combo',
  'DIY Surface Care Combo',
  'DIY Daily Essentials Combo',
  'Kitchen Cleaning Combo',
  'Car Care Combo',
  'Bike Care Combo'
] as const;

export const ALL_CAMPAIGN_PRODUCTS = [
  ...SCRIPT_PRODUCTS,
  ...COMBO_PRODUCTS
] as const;

export type ScriptProduct = typeof SCRIPT_PRODUCTS[number];
export type ComboProduct = typeof COMBO_PRODUCTS[number];
export type CampaignProduct = typeof ALL_CAMPAIGN_PRODUCTS[number];

export function isComboProduct(productName?: string | null): boolean {
  if (!productName || typeof productName !== 'string') return false;
  const clean = productName.trim().toLowerCase();
  return (
    COMBO_PRODUCTS.some(c => c.toLowerCase() === clean) ||
    clean.includes('combo')
  );
}

/**
 * Resolves any product name or alias to its standard catalog item
 */
export function resolveCatalogProduct(ident?: string | null): ScriptProductItem | undefined {
  if (!ident || typeof ident !== 'string') return undefined;
  const clean = ident.trim().toLowerCase();
  return SCRIPT_PRODUCTS_CATALOG.find(
    p => p.id === clean || p.name.toLowerCase() === clean || p.aliases.some(a => a.toLowerCase() === clean)
  );
}

/**
 * Deterministically formats product names with " + " in standard catalog order.
 * If 1 product: returns its standard display name.
 * If 2 products: "DIY Detergent Liquid + DIY Dishwash Liquid"
 * If 3 products: "DIY Detergent Liquid + DIY Dishwash Liquid + DIY Fabric Conditioner"
 */
export function formatCombinedProductTitle(productIdentifiers: string[]): string {
  if (!Array.isArray(productIdentifiers) || productIdentifiers.length === 0) return '';

  const matched: ScriptProductItem[] = [];
  const unmatched: string[] = [];

  productIdentifiers.forEach(ident => {
    if (!ident || typeof ident !== 'string') return;
    const item = resolveCatalogProduct(ident);
    if (item) {
      if (!matched.some(m => m.id === item.id)) {
        matched.push(item);
      }
    } else {
      const clean = ident.trim();
      if (clean && !unmatched.includes(clean)) {
        unmatched.push(clean);
      }
    }
  });

  // Sort matched in stable catalog order
  matched.sort((a, b) => {
    const idxA = SCRIPT_PRODUCTS_CATALOG.findIndex(p => p.id === a.id);
    const idxB = SCRIPT_PRODUCTS_CATALOG.findIndex(p => p.id === b.id);
    return idxA - idxB;
  });

  const allNames = [...matched.map(m => m.name), ...unmatched];
  return allNames.join(' + ');
}

export interface MultiProductScriptPayload {
  __multiProduct: true;
  product_ids: string[];
  products: Record<string, {
    product_id: string;
    product_name: string;
    model_script: string;
    key_points: string;
  }>;
}

export interface ParsedScriptData {
  isMultiProduct: boolean;
  productIds: string[];
  productTitles: string[];
  combinedTitle: string;
  productScripts: Record<string, {
    product_id: string;
    product_name: string;
    model_script: string;
    key_points: string;
  }>;
}

/**
 * Parses script content into structured multi-product data or backward-compatible single product.
 */
export function parseScriptContent(script: CampaignScript): ParsedScriptData {
  // 1. Check if model_script contains multi-product JSON envelope
  if (script.model_script && typeof script.model_script === 'string' && script.model_script.startsWith('{"__multiProduct":')) {
    try {
      const parsed = JSON.parse(script.model_script) as MultiProductScriptPayload;
      if (parsed.__multiProduct && Array.isArray(parsed.product_ids) && parsed.products) {
        const productTitles = parsed.product_ids.map(id => parsed.products[id]?.product_name || id);
        return {
          isMultiProduct: parsed.product_ids.length > 1,
          productIds: parsed.product_ids,
          productTitles,
          combinedTitle: formatCombinedProductTitle(parsed.product_ids) || script.product,
          productScripts: parsed.products
        };
      }
    } catch {
      // Fallback to text parsing
    }
  }

  // 2. Check if product title contains " + "
  if (script.product && script.product.includes(' + ')) {
    const parts = script.product.split(' + ').map(p => p.trim()).filter(Boolean);
    const productIds: string[] = [];
    const productScripts: Record<string, {
      product_id: string;
      product_name: string;
      model_script: string;
      key_points: string;
    }> = {};

    parts.forEach(part => {
      const cat = resolveCatalogProduct(part);
      const pid = cat?.id || part.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      productIds.push(pid);
      productScripts[pid] = {
        product_id: pid,
        product_name: cat?.name || part,
        model_script: script.model_script || '',
        key_points: script.key_points || ''
      };
    });

    return {
      isMultiProduct: productIds.length > 1,
      productIds,
      productTitles: parts,
      combinedTitle: script.product,
      productScripts
    };
  }

  // 3. Single product script (historical or standard single)
  const cat = resolveCatalogProduct(script.product);
  const pid = cat?.id || script.product.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return {
    isMultiProduct: false,
    productIds: [pid],
    productTitles: [script.product],
    combinedTitle: script.product,
    productScripts: {
      [pid]: {
        product_id: pid,
        product_name: script.product,
        model_script: script.model_script || '',
        key_points: script.key_points || ''
      }
    }
  };
}

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
 * Hydrates script record with parsed multi-product data
 */
function hydrateScript(raw: any): CampaignScript {
  const script = raw as CampaignScript;
  const parsed = parseScriptContent(script);
  return {
    ...script,
    product_ids: parsed.productIds,
    product_scripts: parsed.productScripts
  };
}

/**
 * Fetch all scripts across all campaigns
 */
export async function fetchAllCampaignScripts(): Promise<CampaignScript[]> {
  try {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from(SUPABASE_TABLES.campaignScripts)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all campaign scripts:', error);
      throw error;
    }

    return (data || []).map(hydrateScript);
  } catch (err) {
    console.error('Exception in fetchAllCampaignScripts:', err);
    throw err;
  }
}

/**
 * Fetch all scripts for a specific campaign.
 * STRICT CAMPAIGN ISOLATION: Queries strictly by campaign_id.
 * Scripts from Campaign A never leak into Campaign B.
 */
export async function fetchCampaignScripts(
  campaignId: string | number
): Promise<CampaignScript[]> {
  if (!campaignId || campaignId === 'all') {
    return fetchAllCampaignScripts();
  }

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

    return (data || []).map(hydrateScript);
  } catch (err) {
    console.error('Exception in fetchCampaignScripts:', err);
    throw err;
  }
}

export interface CreateScriptParams {
  campaign_id: string;
  product: string;          // Combined title or single product name
  product_ids?: string[];   // Specific selected product IDs
  product_scripts?: Record<string, { model_script: string; key_points: string }>;
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
        if (uploadedAudioPath) await deleteScriptAudioFile(uploadedAudioPath);
        throw new Error(`Failed to upload video file: ${error.message || 'Storage error'}`);
      }
      uploadedVideoPath = path;
    }

    // 3. Determine if multi-product
    const isMultiProduct = Array.isArray(params.product_ids) && params.product_ids.length > 1;
    let finalModelScript = params.model_script.trim();
    let finalKeyPoints = params.key_points.trim();
    let finalProductTitle = params.product.trim();

    if (isMultiProduct && params.product_ids && params.product_scripts) {
      // Deterministically sort product IDs according to catalog order
      const sortedProductIds = [...params.product_ids].sort((a, b) => {
        const idxA = SCRIPT_PRODUCTS_CATALOG.findIndex(p => p.id === a);
        const idxB = SCRIPT_PRODUCTS_CATALOG.findIndex(p => p.id === b);
        return idxA - idxB;
      });

      finalProductTitle = formatCombinedProductTitle(sortedProductIds);

      const multiProductsObj: Record<string, { product_id: string; product_name: string; model_script: string; key_points: string }> = {};
      sortedProductIds.forEach(pid => {
        const cat = resolveCatalogProduct(pid);
        const entry = params.product_scripts?.[pid];
        multiProductsObj[pid] = {
          product_id: pid,
          product_name: cat?.name || pid,
          model_script: entry?.model_script?.trim() || '',
          key_points: entry?.key_points?.trim() || ''
        };
      });

      const multiPayload: MultiProductScriptPayload = {
        __multiProduct: true,
        product_ids: sortedProductIds,
        products: multiProductsObj
      };

      finalModelScript = JSON.stringify(multiPayload);
      
      // Store human-readable key points summary in key_points column
      const keyPointsSummary = sortedProductIds
        .map(pid => `[${multiProductsObj[pid].product_name}]\n${multiProductsObj[pid].key_points}`)
        .join('\n\n');
      finalKeyPoints = keyPointsSummary || params.key_points.trim();
    }

    // 4. Insert record into database
    const payload = {
      campaign_id: String(params.campaign_id).trim(),
      product: finalProductTitle,
      language: params.language.trim(),
      model_script: finalModelScript,
      key_points: finalKeyPoints,
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
      if (uploadedAudioPath) await deleteScriptAudioFile(uploadedAudioPath);
      if (uploadedVideoPath) await deleteScriptVideoFile(uploadedVideoPath);
      throw error;
    }

    return hydrateScript(data);
  } catch (err) {
    console.error('Exception in createCampaignScript:', err);
    throw err;
  }
}

export interface UpdateScriptParams {
  id: string;
  campaign_id?: string;
  product: string;
  product_ids?: string[];
  product_scripts?: Record<string, { model_script: string; key_points: string }>;
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
    if (params.removeAudioFile && finalAudioPath) {
      await deleteScriptAudioFile(finalAudioPath);
      finalAudioPath = null;
    }

    if (params.audioFile) {
      const { path, error } = await uploadScriptAudio(params.campaign_id || 'script', params.id, params.audioFile);
      if (error) {
        throw new Error(`Failed to upload replacement audio: ${error.message || 'Storage error'}`);
      }
      if (finalAudioPath && finalAudioPath !== path) {
        await deleteScriptAudioFile(finalAudioPath);
      }
      finalAudioPath = path;
    }

    if (params.removeVideoFile && finalVideoPath) {
      await deleteScriptVideoFile(finalVideoPath);
      finalVideoPath = null;
    }

    if (params.videoFile) {
      const { path, error } = await uploadScriptVideo(params.campaign_id || 'script', params.id, params.videoFile);
      if (error) {
        throw new Error(`Failed to upload replacement video: ${error.message || 'Storage error'}`);
      }
      if (finalVideoPath && finalVideoPath !== path) {
        await deleteScriptVideoFile(finalVideoPath);
      }
      finalVideoPath = path;
    }

    const isMultiProduct = Array.isArray(params.product_ids) && params.product_ids.length > 1;
    let finalModelScript = params.model_script.trim();
    let finalKeyPoints = params.key_points.trim();
    let finalProductTitle = params.product.trim();

    if (isMultiProduct && params.product_ids && params.product_scripts) {
      const sortedProductIds = [...params.product_ids].sort((a, b) => {
        const idxA = SCRIPT_PRODUCTS_CATALOG.findIndex(p => p.id === a);
        const idxB = SCRIPT_PRODUCTS_CATALOG.findIndex(p => p.id === b);
        return idxA - idxB;
      });

      finalProductTitle = formatCombinedProductTitle(sortedProductIds);

      const multiProductsObj: Record<string, { product_id: string; product_name: string; model_script: string; key_points: string }> = {};
      sortedProductIds.forEach(pid => {
        const cat = resolveCatalogProduct(pid);
        const entry = params.product_scripts?.[pid];
        multiProductsObj[pid] = {
          product_id: pid,
          product_name: cat?.name || pid,
          model_script: entry?.model_script?.trim() || '',
          key_points: entry?.key_points?.trim() || ''
        };
      });

      const multiPayload: MultiProductScriptPayload = {
        __multiProduct: true,
        product_ids: sortedProductIds,
        products: multiProductsObj
      };

      finalModelScript = JSON.stringify(multiPayload);

      const keyPointsSummary = sortedProductIds
        .map(pid => `[${multiProductsObj[pid].product_name}]\n${multiProductsObj[pid].key_points}`)
        .join('\n\n');
      finalKeyPoints = keyPointsSummary || params.key_points.trim();
    }

    const payload: any = {
      product: finalProductTitle,
      language: params.language.trim(),
      model_script: finalModelScript,
      key_points: finalKeyPoints,
      reference_audio_url: params.reference_audio_url?.trim() || null,
      reference_audio_file_path: finalAudioPath,
      reference_video_url: params.reference_video_url?.trim() || null,
      reference_video_file_path: finalVideoPath,
      updated_at: new Date().toISOString()
    };
    if (params.campaign_id !== undefined) {
      payload.campaign_id = String(params.campaign_id).trim();
    }

    const { data, error } = await client
      .from(SUPABASE_TABLES.campaignScripts)
      .update(payload)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return hydrateScript(data);
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
    const { error } = await client
      .from(SUPABASE_TABLES.campaignScripts)
      .delete()
      .eq('id', script.id);

    if (error) {
      console.error('Error deleting script record:', error);
      throw error;
    }

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
