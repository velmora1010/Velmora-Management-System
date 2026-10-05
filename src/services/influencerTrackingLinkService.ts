import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignInfluencer, InfluencerTrackingLink } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'velmora_influencer_tracking_links_';

// ==========================================
// 1. PLATFORM & VIDEO CONFIGURATIONS
// ==========================================

export type PlatformCategory = 'WEBSITE' | 'MARKETPLACE';

export interface TrackingPlatformConfig {
  id: string;
  name: string;
  category: PlatformCategory;
  utmSource: string;
  brandColor: string;
}

export const TRACKING_PLATFORMS: TrackingPlatformConfig[] = [
  // CATEGORY 1: WEBSITE
  { id: 'instagram', name: 'Instagram', category: 'WEBSITE', utmSource: 'instagram', brandColor: '#E1306C' },
  { id: 'youtube', name: 'YouTube', category: 'WEBSITE', utmSource: 'youtube', brandColor: '#FF0000' },
  { id: 'facebook', name: 'Facebook', category: 'WEBSITE', utmSource: 'facebook', brandColor: '#1877F2' },

  // CATEGORY 2: MARKETPLACE
  { id: 'flipkart', name: 'Flipkart', category: 'MARKETPLACE', utmSource: 'flipkart', brandColor: '#2874F0' },
  { id: 'amazon', name: 'Amazon', category: 'MARKETPLACE', utmSource: 'amazon', brandColor: '#FF9900' },
  { id: 'meesho', name: 'Meesho', category: 'MARKETPLACE', utmSource: 'meesho', brandColor: '#F43397' },
];

export interface TrackingVideoConfig {
  id: string;
  name: string;
  number: number;
  utmContent: string;
}

export const TRACKING_VIDEOS: TrackingVideoConfig[] = [
  { id: 'Video 1', name: 'Video 1', number: 1, utmContent: 'v1' },
  { id: 'Video 2', name: 'Video 2', number: 2, utmContent: 'v2' },
  { id: 'Video 3', name: 'Video 3', number: 3, utmContent: 'v3' },
  { id: 'Video 4', name: 'Video 4', number: 4, utmContent: 'v4' },
  { id: 'Video 5', name: 'Video 5', number: 5, utmContent: 'v5' },
  { id: 'Video 6', name: 'Video 6', number: 6, utmContent: 'v6' },
];

// ==========================================
// 2. URL UTILITIES
// ==========================================

/**
 * Strips UTM parameters to extract the clean base URL path
 */
export function extractBaseProductUrl(inputUrl: string): string {
  let clean = (inputUrl || '').trim();
  if (!clean) return '';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  try {
    const urlObj = new URL(clean);
    urlObj.searchParams.delete('utm_source');
    urlObj.searchParams.delete('utm_medium');
    urlObj.searchParams.delete('utm_content');
    urlObj.searchParams.delete('utm_campaign');
    return urlObj.toString();
  } catch {
    return clean;
  }
}

/**
 * Builds the unique tracking URL for an influencer
 * - Strips any previous UTM params
 * - Sets utm_source, utm_medium=influencer, utm_content, utm_campaign
 * - Ensures utm_campaign uses the lowercase creator code
 */
export function buildInfluencerTrackingUrl(
  inputUrl: string,
  platformUtmSource: string,
  videoUtmContent: string,
  creatorCode: string
): string {
  let cleanInput = (inputUrl || '').trim();
  if (!cleanInput) return '';

  if (!cleanInput.startsWith('http://') && !cleanInput.startsWith('https://')) {
    cleanInput = `https://${cleanInput}`;
  }

  try {
    const urlObj = new URL(cleanInput);

    // Remove existing UTM params
    urlObj.searchParams.delete('utm_source');
    urlObj.searchParams.delete('utm_medium');
    urlObj.searchParams.delete('utm_content');
    urlObj.searchParams.delete('utm_campaign');

    // Clean creator code: strip '#' prefix and convert to lowercase
    const cleanCode = (creatorCode || '').replace(/^#+/, '').trim().toLowerCase();

    // Set standard UTM parameters
    urlObj.searchParams.set('utm_source', platformUtmSource.trim().toLowerCase());
    urlObj.searchParams.set('utm_medium', 'influencer');
    urlObj.searchParams.set('utm_content', videoUtmContent.trim().toLowerCase());
    urlObj.searchParams.set('utm_campaign', cleanCode);

    return urlObj.toString();
  } catch {
    return inputUrl;
  }
}

// ==========================================
// 3. RECORD NORMALIZATION & LOCAL CACHING
// ==========================================

export function normalizeTrackingLink(raw: any): InfluencerTrackingLink {
  let extra: any = {};
  if (raw.notes && typeof raw.notes === 'string' && raw.notes.startsWith('{')) {
    try {
      extra = JSON.parse(raw.notes);
    } catch {
      // ignore
    }
  }

  let urlSource = '';
  let urlContent = '';
  let urlCampaign = '';
  let urlBase = '';
  if (raw.tracking_url) {
    try {
      const u = new URL(raw.tracking_url.startsWith('http') ? raw.tracking_url : `https://${raw.tracking_url}`);
      urlSource = u.searchParams.get('utm_source') || '';
      urlContent = u.searchParams.get('utm_content') || '';
      urlCampaign = u.searchParams.get('utm_campaign') || '';

      const copyU = new URL(u.toString());
      copyU.searchParams.delete('utm_source');
      copyU.searchParams.delete('utm_medium');
      copyU.searchParams.delete('utm_content');
      copyU.searchParams.delete('utm_campaign');
      urlBase = copyU.toString();
    } catch {}
  }

  const utm_source = (raw.utm_source || extra.utm_source || urlSource || 'instagram').toLowerCase();
  const utm_content = (raw.utm_content || extra.utm_content || urlContent || 'v1').toLowerCase();
  const utm_medium = raw.utm_medium || extra.utm_medium || 'influencer';

  // Find platform config
  const matchedPlat = TRACKING_PLATFORMS.find(
    p => p.utmSource.toLowerCase() === utm_source.toLowerCase() || p.name.toLowerCase() === (raw.platform || '').toLowerCase()
  );
  const platform = raw.platform || extra.platform || (matchedPlat ? matchedPlat.name : (utm_source ? utm_source.charAt(0).toUpperCase() + utm_source.slice(1) : 'Instagram'));
  const platform_category = raw.platform_category || extra.platform_category || (matchedPlat ? matchedPlat.category : 'WEBSITE');

  let video_number = raw.video_number || extra.video_number || '';
  if (!video_number && utm_content) {
    const vMatch = utm_content.match(/^v(\d+)$/i);
    if (vMatch) {
      video_number = `Video ${vMatch[1]}`;
    }
  }
  if (!video_number) video_number = 'Video 1';

  const rawCode = raw.influencer_code || raw.creator_code || extra.creator_code || urlCampaign || '';
  const cleanCode = String(rawCode).replace(/^#+/, '').trim();
  const displayCode = cleanCode ? `#${cleanCode.toUpperCase()}` : '';
  const creator_code = cleanCode ? cleanCode.toLowerCase() : '';

  const base_product_url = raw.base_product_url || extra.base_product_url || urlBase || '';

  const cleanNotes = extra.userNotes !== undefined
    ? extra.userNotes
    : (typeof raw.notes === 'string' && !raw.notes.startsWith('{') ? raw.notes : '');

  return {
    id: String(raw.id || `link_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`),
    campaign_id: String(raw.campaign_id),
    influencer_id: String(raw.influencer_id),
    influencer_name: raw.influencer_name || '',
    influencer_code: displayCode,
    creator_code,
    product: raw.product || '',
    platform,
    platform_category,
    video_number,
    utm_source,
    utm_medium,
    utm_content,
    base_product_url,
    tracking_url: raw.tracking_url || '',
    notes: cleanNotes,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString()
  };
}

function getLocalTrackingLinks(campaignId: string | number): InfluencerTrackingLink[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${campaignId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeTrackingLink) : [];
  } catch {
    return [];
  }
}

function saveLocalTrackingLinks(campaignId: string | number, items: InfluencerTrackingLink[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${campaignId}`, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed saving tracking links to localStorage:', err);
  }
}

// ==========================================
// 4. FETCH TRACKING LINKS
// ==========================================

export async function fetchInfluencerTrackingLinks(
  campaignId: string | number
): Promise<InfluencerTrackingLink[]> {
  const cleanId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.influencerTrackingLinks)
      .select('*')
      .eq('campaign_id', cleanId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchInfluencerTrackingLinks error, checking local fallback:', error.message);
      return getLocalTrackingLinks(cleanId);
    }

    if (data && data.length > 0) {
      const normalized = (data as any[]).map(normalizeTrackingLink);
      saveLocalTrackingLinks(cleanId, normalized);
      return normalized;
    }

    return getLocalTrackingLinks(cleanId);
  } catch (err) {
    console.warn('Exception in fetchInfluencerTrackingLinks, using local fallback:', err);
    return getLocalTrackingLinks(cleanId);
  }
}

// ==========================================
// 5. BATCH GENERATE TRACKING LINKS
// ==========================================

export interface BatchGenerateParams {
  campaign_id: string | number;
  product: string;
  base_product_url: string;
  platform: string; // 'Instagram', 'YouTube', etc.
  platform_category: PlatformCategory;
  utm_source: string; // 'instagram', 'youtube', etc.
  video_number: string; // 'Video 1', 'Video 2', etc.
  utm_content: string; // 'v1', 'v2', etc.
  influencers: CampaignInfluencer[];
  onProgress?: (current: number, total: number, percentage: number) => void;
}

export interface BatchGenerateResult {
  total: number;
  successCount: number;
  failedCount: number;
  links: InfluencerTrackingLink[];
  failedInfluencerIds: (string | number)[];
  errors: string[];
}

export async function batchGenerateInfluencerTrackingLinks(
  params: BatchGenerateParams
): Promise<BatchGenerateResult> {
  const cleanCampaignId = String(params.campaign_id).trim();
  const client = supabaseAdmin || supabase;
  const influencers = params.influencers || [];
  const total = influencers.length;

  if (total === 0) {
    return {
      total: 0,
      successCount: 0,
      failedCount: 0,
      links: [],
      failedInfluencerIds: [],
      errors: ['No influencers provided in campaign to generate tracking links.']
    };
  }

  // Load existing links for deduplication
  const existingLinks = await fetchInfluencerTrackingLinks(cleanCampaignId);
  const now = new Date().toISOString();
  const cleanBaseUrl = extractBaseProductUrl(params.base_product_url);

  // Prepare link records for each influencer
  const recordsToUpsert: InfluencerTrackingLink[] = influencers.map((inf) => {
    // Priority: inf.code -> inf.influencer_name / fallback
    const rawCode = inf.code || (inf as any).influencer_code || `HIS${inf.id}`;
    const cleanCode = String(rawCode).replace(/^#+/, '').trim().toLowerCase();
    const displayCode = `#${cleanCode.toUpperCase()}`;

    // Build unique tracking URL
    const trackingUrl = buildInfluencerTrackingUrl(
      params.base_product_url,
      params.utm_source,
      params.utm_content,
      cleanCode
    );

    // Deduplication check: Match (campaign_id, influencer_id, product, platform, video_number)
    const existing = existingLinks.find(
      (l) =>
        String(l.campaign_id) === cleanCampaignId &&
        String(l.influencer_id) === String(inf.id) &&
        l.product.trim().toLowerCase() === params.product.trim().toLowerCase() &&
        (l.platform || '').trim().toLowerCase() === params.platform.trim().toLowerCase() &&
        (l.video_number || '').trim().toLowerCase() === params.video_number.trim().toLowerCase()
    );

    if (existing) {
      // Update existing record
      return {
        ...existing,
        influencer_name: inf.influencer_name || inf.name || existing.influencer_name || '',
        influencer_code: displayCode,
        creator_code: cleanCode,
        product: params.product.trim(),
        platform: params.platform,
        platform_category: params.platform_category,
        video_number: params.video_number,
        utm_source: params.utm_source.toLowerCase(),
        utm_medium: 'influencer',
        utm_content: params.utm_content.toLowerCase(),
        base_product_url: cleanBaseUrl,
        tracking_url: trackingUrl,
        updated_at: now
      };
    }

    // Create fresh record
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `link_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      id: newId,
      campaign_id: cleanCampaignId,
      influencer_id: String(inf.id).trim(),
      influencer_name: inf.influencer_name || inf.name || '',
      influencer_code: displayCode,
      creator_code: cleanCode,
      product: params.product.trim(),
      platform: params.platform,
      platform_category: params.platform_category,
      video_number: params.video_number,
      utm_source: params.utm_source.toLowerCase(),
      utm_medium: 'influencer',
      utm_content: params.utm_content.toLowerCase(),
      base_product_url: cleanBaseUrl,
      tracking_url: trackingUrl,
      notes: '',
      created_at: now,
      updated_at: now
    };
  });

  // Batch insert/upsert in chunks to Supabase
  const CHUNK_SIZE = 50;
  const successfulLinks: InfluencerTrackingLink[] = [];
  const failedInfluencerIds: (string | number)[] = [];
  const errors: string[] = [];

  for (let i = 0; i < recordsToUpsert.length; i += CHUNK_SIZE) {
    const chunk = recordsToUpsert.slice(i, i + CHUNK_SIZE);

    try {
      // First attempt: upsert with full payload
      const { error: upsertErr } = await client
        .from(SUPABASE_TABLES.influencerTrackingLinks)
        .upsert(chunk, { onConflict: 'id' });

      if (upsertErr) {
        // If error is missing column (e.g., schema cache PGRST204), fallback to base schema with JSON metadata in notes
        if (upsertErr.message?.includes('column') || upsertErr.code === 'PGRST204') {
          console.warn('Detected missing column on remote Supabase, falling back to base schema with notes metadata:', upsertErr.message);
          
          const fallbackChunk = chunk.map((c) => ({
            id: c.id,
            campaign_id: c.campaign_id,
            influencer_id: c.influencer_id,
            influencer_name: c.influencer_name,
            influencer_code: c.influencer_code,
            product: c.product,
            tracking_url: c.tracking_url,
            notes: JSON.stringify({
              platform: c.platform,
              platform_category: c.platform_category,
              video_number: c.video_number,
              utm_source: c.utm_source,
              utm_medium: c.utm_medium,
              utm_content: c.utm_content,
              creator_code: c.creator_code,
              base_product_url: c.base_product_url,
              userNotes: c.notes || ''
            }),
            created_at: c.created_at,
            updated_at: c.updated_at
          }));

          const { error: fallbackErr } = await client
            .from(SUPABASE_TABLES.influencerTrackingLinks)
            .upsert(fallbackChunk, { onConflict: 'id' });

          if (fallbackErr) {
            console.error('Fallback upsert failed:', fallbackErr);
            errors.push(fallbackErr.message);
            chunk.forEach(item => failedInfluencerIds.push(item.influencer_id));
          } else {
            successfulLinks.push(...chunk);
          }
        } else {
          console.error('Supabase upsert chunk error:', upsertErr);
          errors.push(upsertErr.message);
          chunk.forEach(item => failedInfluencerIds.push(item.influencer_id));
        }
      } else {
        successfulLinks.push(...chunk);
      }
    } catch (err: any) {
      console.warn('Exception during batch chunk insert, saving locally:', err);
      // In case of network error, treat chunk as succeeded in local cache
      successfulLinks.push(...chunk);
    }

    const currentCount = Math.min(i + CHUNK_SIZE, total);
    const percentage = Math.round((currentCount / total) * 100);
    if (params.onProgress) {
      params.onProgress(currentCount, total, percentage);
    }
  }

  // Update local storage cache
  const mergedMap = new Map<string, InfluencerTrackingLink>();
  existingLinks.forEach(l => mergedMap.set(l.id, l));
  successfulLinks.forEach(l => mergedMap.set(l.id, l));
  const finalLocalLinks = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
  saveLocalTrackingLinks(cleanCampaignId, finalLocalLinks);

  return {
    total,
    successCount: successfulLinks.length,
    failedCount: failedInfluencerIds.length,
    links: successfulLinks,
    failedInfluencerIds,
    errors
  };
}

// ==========================================
// 6. SINGLE CREATE / UPDATE / DELETE
// ==========================================

export interface CreateTrackingLinkParams {
  campaign_id: string | number;
  influencer_id: string | number;
  influencer_name?: string;
  influencer_code?: string;
  product: string;
  platform?: string;
  platform_category?: PlatformCategory;
  video_number?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_content?: string;
  creator_code?: string;
  base_product_url?: string;
  tracking_url: string;
  notes?: string;
}

export async function createInfluencerTrackingLink(
  params: CreateTrackingLinkParams
): Promise<InfluencerTrackingLink> {
  const cleanCampaignId = String(params.campaign_id).trim();
  const client = supabaseAdmin || supabase;
  const now = new Date().toISOString();

  const rawCode = params.influencer_code || params.creator_code || '';
  const cleanCode = rawCode.replace(/^#+/, '').trim().toLowerCase();
  const displayCode = cleanCode ? `#${cleanCode.toUpperCase()}` : '';

  const newRecord: InfluencerTrackingLink = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `link_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    campaign_id: cleanCampaignId,
    influencer_id: String(params.influencer_id).trim(),
    influencer_name: params.influencer_name?.trim() || '',
    influencer_code: displayCode,
    creator_code: cleanCode,
    product: params.product.trim(),
    platform: params.platform || 'Instagram',
    platform_category: params.platform_category || 'WEBSITE',
    video_number: params.video_number || 'Video 1',
    utm_source: (params.utm_source || 'instagram').toLowerCase(),
    utm_medium: 'influencer',
    utm_content: (params.utm_content || 'v1').toLowerCase(),
    base_product_url: params.base_product_url || '',
    tracking_url: params.tracking_url.trim(),
    notes: params.notes?.trim() || '',
    created_at: now,
    updated_at: now
  };

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.influencerTrackingLinks)
      .insert([newRecord])
      .select()
      .single();

    if (error) {
      if (error.message?.includes('column') || error.code === 'PGRST204') {
        const fallbackRecord = {
          id: newRecord.id,
          campaign_id: newRecord.campaign_id,
          influencer_id: newRecord.influencer_id,
          influencer_name: newRecord.influencer_name,
          influencer_code: newRecord.influencer_code,
          product: newRecord.product,
          tracking_url: newRecord.tracking_url,
          notes: JSON.stringify({
            platform: newRecord.platform,
            platform_category: newRecord.platform_category,
            video_number: newRecord.video_number,
            utm_source: newRecord.utm_source,
            utm_medium: newRecord.utm_medium,
            utm_content: newRecord.utm_content,
            creator_code: newRecord.creator_code,
            base_product_url: newRecord.base_product_url,
            userNotes: newRecord.notes
          }),
          created_at: newRecord.created_at,
          updated_at: newRecord.updated_at
        };
        await client.from(SUPABASE_TABLES.influencerTrackingLinks).insert([fallbackRecord]);
      } else {
        console.warn('Supabase create tracking link failed, persisting locally:', error.message);
      }
    }

    const saved = data ? normalizeTrackingLink(data) : newRecord;
    const local = getLocalTrackingLinks(cleanCampaignId);
    saveLocalTrackingLinks(cleanCampaignId, [saved, ...local.filter(l => l.id !== saved.id)]);
    return saved;
  } catch (err) {
    console.warn('Exception creating tracking link, persisting locally:', err);
    const local = getLocalTrackingLinks(cleanCampaignId);
    saveLocalTrackingLinks(cleanCampaignId, [newRecord, ...local.filter(l => l.id !== newRecord.id)]);
    return newRecord;
  }
}

export interface UpdateTrackingLinkParams {
  influencer_id: string | number;
  influencer_name?: string;
  influencer_code?: string;
  product: string;
  platform?: string;
  platform_category?: PlatformCategory;
  video_number?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_content?: string;
  creator_code?: string;
  base_product_url?: string;
  tracking_url: string;
  notes?: string;
}

export async function updateInfluencerTrackingLink(
  id: string,
  campaignId: string | number,
  params: UpdateTrackingLinkParams
): Promise<InfluencerTrackingLink> {
  const cleanCampaignId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;
  const now = new Date().toISOString();

  const rawCode = params.influencer_code || params.creator_code || '';
  const cleanCode = rawCode.replace(/^#+/, '').trim().toLowerCase();
  const displayCode = cleanCode ? `#${cleanCode.toUpperCase()}` : '';

  const updates = {
    influencer_id: String(params.influencer_id).trim(),
    influencer_name: params.influencer_name?.trim() || '',
    influencer_code: displayCode,
    product: params.product.trim(),
    tracking_url: params.tracking_url.trim(),
    notes: params.notes?.trim() || '',
    updated_at: now
  };

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.influencerTrackingLinks)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update tracking link failed, updating locally:', error.message);
    }

    const saved = data ? normalizeTrackingLink(data) : { ...updates, id, campaign_id: cleanCampaignId } as InfluencerTrackingLink;
    const local = getLocalTrackingLinks(cleanCampaignId);
    const updatedList = local.map(l => l.id === id ? { ...l, ...saved } : l);
    saveLocalTrackingLinks(cleanCampaignId, updatedList);
    return saved;
  } catch (err) {
    console.warn('Exception updating tracking link, updating locally:', err);
    const local = getLocalTrackingLinks(cleanCampaignId);
    const found = local.find(l => l.id === id);
    if (!found) throw new Error('Tracking link not found');
    const updated = { ...found, ...updates };
    saveLocalTrackingLinks(cleanCampaignId, local.map(l => l.id === id ? updated : l));
    return updated;
  }
}

export async function deleteInfluencerTrackingLink(
  id: string,
  campaignId: string | number
): Promise<void> {
  const cleanCampaignId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;

  try {
    const { error } = await client
      .from(SUPABASE_TABLES.influencerTrackingLinks)
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase delete tracking link failed, deleting locally:', error.message);
    }
  } catch (err) {
    console.warn('Exception deleting tracking link from Supabase:', err);
  } finally {
    const local = getLocalTrackingLinks(cleanCampaignId);
    const updated = local.filter(l => l.id !== id);
    saveLocalTrackingLinks(cleanCampaignId, updated);
  }
}
