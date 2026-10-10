import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignInfluencer, InfluencerTrackingLink } from '../types';
import { isActiveStatus } from '../utils/marketingUtils';

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
// 2. CREATOR CODE NUMERICAL SORT UTILITIES
// ==========================================

/**
 * Extracts the numeric portion of a Creator Code (e.g. "HIS2" -> 2, "#HIS186" -> 186)
 */
export function extractCodeNumber(code?: string | null): number {
  if (!code) return 0;
  const str = String(code).trim();
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Extracts the alphabetic prefix of a Creator Code (e.g. "HIS2" -> "HIS", "#WBS214" -> "WBS")
 */
export function extractCodePrefix(code?: string | null): string {
  if (!code) return '';
  const clean = String(code).replace(/^#+/, '').trim();
  const match = clean.match(/^[A-Za-z]+/);
  return match ? match[0].toUpperCase() : '';
}

/**
 * Compares two tracking links by Creator Code in ascending numerical order:
 * e.g. HIS1, HIS2, HIS9, HIS10, HIS99, HIS100, HIS186
 */
export function compareTrackingLinksByCodeAsc(
  a: { influencer_code?: string; creator_code?: string; id?: any },
  b: { influencer_code?: string; creator_code?: string; id?: any }
): number {
  const codeA = (a.influencer_code || a.creator_code || '').trim();
  const codeB = (b.influencer_code || b.creator_code || '').trim();

  const numA = extractCodeNumber(codeA);
  const numB = extractCodeNumber(codeB);

  // 1. Numerical ascending comparison
  if (numA !== numB) {
    return numA - numB;
  }

  // 2. If numbers are identical, compare prefix alphabetically
  const prefixA = extractCodePrefix(codeA);
  const prefixB = extractCodePrefix(codeB);
  if (prefixA !== prefixB) {
    return prefixA.localeCompare(prefixB);
  }

  // 3. Fallback comparison
  return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
}

// ==========================================
// 3. URL UTILITIES
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

export const ALLOWED_AMAZON_DOMAINS = [
  'amazon.in',
  'amazon.com',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.es',
  'amazon.it',
  'amazon.ca',
  'amazon.com.au',
  'amazon.co.jp',
  'amzn.to',
  'amzn.in',
  'amzn.eu'
];

/**
 * Validates whether a URL is a legitimate Amazon marketplace URL
 */
export function isValidAmazonUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const clean = urlStr.trim();
    const test = clean.startsWith('http://') || clean.startsWith('https://') ? clean : `https://${clean}`;
    const parsed = new URL(test);
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_AMAZON_DOMAINS.some(domain => host === domain || host.endsWith('.' + domain));
  } catch {
    return false;
  }
}

export const BRANDED_TRACKING_DOMAIN = 'https://velmora-management-system.vercel.app/r';

/**
 * Builds the canonical short code/slug from creator code and video number.
 * Examples: 'his1-v1', 'his1-v2', 'his2-v1'
 */
export function buildTrackingSlug(
  creatorCode?: string, 
  videoNumber?: string, 
  utmContent?: string,
  suffix?: string
): string {
  const cleanCode = (creatorCode || '').replace(/^#+/, '').trim().toLowerCase();
  const cleanVideo = (utmContent || '').replace(/^v/i, '') || 
                     (videoNumber || '').replace(/[^0-9]/g, '') || '1';
  let slug = `${cleanCode || 'inf'}-v${cleanVideo}`;
  if (suffix) {
    const cleanSuffix = suffix.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanSuffix) slug += `-${cleanSuffix}`;
  }
  return slug;
}

/**
 * Builds the reliable Vercel-hosted tracking URL: https://velmora-management-system.vercel.app/r/${slug}
 */
export function buildBrandedTrackingUrl(slug: string): string {
  const cleanSlug = encodeURIComponent(String(slug || '').trim().replace(/^\/+|\/+$/g, ''));
  return `${BRANDED_TRACKING_DOMAIN}/${cleanSlug}`;
}

/**
 * Generates an abbreviated product suffix if a base slug collides with an existing link
 */
export function getDisambiguatedSlug(
  baseSlug: string,
  linkId: string,
  existingLinks: InfluencerTrackingLink[],
  product?: string
): string {
  const cleanBase = baseSlug.trim().toLowerCase();
  const collision = existingLinks.find(
    l => String(l.id) !== String(linkId) && 
         ((l.custom_slug && l.custom_slug.toLowerCase() === cleanBase) ||
          (l.tracking_url && l.tracking_url.toLowerCase().endsWith(`/${cleanBase}`)))
  );

  if (!collision) return cleanBase;

  let prodSuffix = '';
  if (product) {
    const words = product.trim().split(/\s+/);
    if (words.length > 1) {
      prodSuffix = words.map(w => w[0]).join('').toLowerCase();
    } else {
      prodSuffix = product.slice(0, 3).toLowerCase();
    }
  }

  let candidate = prodSuffix ? `${cleanBase}-${prodSuffix}` : `${cleanBase}-2`;
  let counter = 2;
  while (existingLinks.some(l => String(l.id) !== String(linkId) && 
    ((l.custom_slug && l.custom_slug.toLowerCase() === candidate) ||
     (l.tracking_url && l.tracking_url.toLowerCase().endsWith(`/${candidate}`))))) {
    candidate = `${cleanBase}-${prodSuffix ? `${prodSuffix}-` : ''}${counter}`;
    counter++;
  }

  return candidate;
}

/**
 * Persists a slug to linkId mapping to Redis via /api/clicks
 */
export async function persistSlugMapping(slug: string, linkId: string): Promise<boolean> {
  if (!slug || !linkId) return false;
  try {
    const cleanSlug = slug.trim().toLowerCase();
    const cleanId = String(linkId).trim();
    const res = await fetch('/api/clicks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_slug', slug: cleanSlug, link_id: cleanId })
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to persist slug mapping:', err);
    return false;
  }
}

/**
 * Builds the unique redirect tracking URL for Amazon destination
 * Formats: https://go.justmixx.com/${slug} (with fallback to ${origin}/r/${linkId})
 */
export function buildAmazonRedirectTrackingUrl(linkId: string, slug?: string, origin?: string): string {
  if (slug) {
    return buildBrandedTrackingUrl(slug);
  }
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const cleanId = encodeURIComponent(String(linkId || '').trim());
  return base ? `${base}/r/${cleanId}` : `/r/${cleanId}`;
}

export interface FetchClicksResult {
  configured: boolean;
  clicks: Record<string, number>;
  error?: string;
  isError?: boolean;
}

const CLICKS_BATCH_SIZE = 50;

/**
 * Fetches server-side persistent click counts from /api/clicks in bounded POST batches.
 * Deduplicates link IDs and omits ambient cookies to prevent HTTP 431 header overflow.
 */
export async function fetchTrackingLinkClicks(linkIds: string[]): Promise<FetchClicksResult> {
  if (!Array.isArray(linkIds) || linkIds.length === 0) {
    return { configured: true, clicks: {} };
  }

  // Deduplicate and filter non-empty IDs
  const cleanIds = Array.from(new Set(linkIds.map(id => String(id).trim()).filter(Boolean)));
  if (cleanIds.length === 0) {
    return { configured: true, clicks: {} };
  }

  // Split into bounded batches of 50 IDs each
  const batches: string[][] = [];
  for (let i = 0; i < cleanIds.length; i += CLICKS_BATCH_SIZE) {
    batches.push(cleanIds.slice(i, i + CLICKS_BATCH_SIZE));
  }

  const mergedClicks: Record<string, number> = {};
  let isConfigured = true;
  let hasBatchError = false;
  let errorMsg: string | undefined;

  try {
    const results = await Promise.all(
      batches.map(async (batch) => {
        try {
          const res = await fetch('/api/clicks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'omit',
            body: JSON.stringify({ ids: batch })
          });

          if (!res.ok) {
            let msg = `Click count API returned HTTP ${res.status}`;
            try {
              const errBody = await res.json();
              if (errBody?.error) msg = errBody.error;
              if (errBody?.configured === false) {
                return { configured: false, clicks: {}, error: msg, isError: false };
              }
            } catch {
              // Ignore JSON parse failure on non-200 responses
            }
            return { configured: true, clicks: {}, error: msg, isError: true };
          }

          const data = await res.json();
          return {
            configured: data.configured !== false,
            clicks: data.clicks || {},
            error: data.error,
            isError: false
          };
        } catch (fetchErr: any) {
          return {
            configured: true,
            clicks: {},
            error: fetchErr?.message || 'Network error fetching clicks',
            isError: true
          };
        }
      })
    );

    for (const res of results) {
      if (res.configured === false) {
        isConfigured = false;
        errorMsg = res.error || 'Redis tracking storage not configured';
      }
      if (res.isError) {
        hasBatchError = true;
        if (!errorMsg) errorMsg = res.error;
      }
      if (res.clicks) {
        Object.assign(mergedClicks, res.clicks);
      }
    }

    return {
      configured: isConfigured,
      clicks: mergedClicks,
      error: !isConfigured ? errorMsg : (hasBatchError ? errorMsg : undefined),
      isError: hasBatchError
    };
  } catch (err: any) {
    console.warn('Failed to fetch tracking clicks from API:', err);
    return {
      configured: true,
      clicks: {},
      error: err?.message || 'Failed to fetch clicks',
      isError: true
    };
  }
}

// ==========================================
// 4. RECORD NORMALIZATION & LOCAL CACHING
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

  // Determine destination type (Shopify or Amazon)
  const isAmazon = 
    raw.destination_type === 'amazon' || 
    extra.destination_type === 'amazon' ||
    isValidAmazonUrl(base_product_url) ||
    (raw.tracking_url && (raw.tracking_url.includes('/r/') || raw.tracking_url.includes('/api/r')));
  const destination_type: 'shopify' | 'amazon' = isAmazon ? 'amazon' : 'shopify';
  const original_destination_url = raw.original_destination_url || extra.original_amazon_url || extra.original_destination_url || (isAmazon ? base_product_url : undefined);

  const cleanNotes = extra.userNotes !== undefined
    ? extra.userNotes
    : (typeof raw.notes === 'string' && !raw.notes.startsWith('{') ? raw.notes : '');

  const clicks = typeof raw.clicks === 'number' ? raw.clicks : (typeof extra.clicks === 'number' ? extra.clicks : undefined);

  // Compute branded short code / slug for Amazon links
  const recordId = String(raw.id || `link_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const custom_slug = extra.custom_slug || 
                      raw.custom_slug || 
                      (isAmazon && creator_code ? buildTrackingSlug(creator_code, video_number, utm_content) : undefined);
  const branded_url = custom_slug ? buildBrandedTrackingUrl(custom_slug) : undefined;

  let tracking_url = raw.tracking_url || '';
  if (isAmazon) {
    if (branded_url) {
      tracking_url = branded_url;
    } else if (!tracking_url) {
      tracking_url = buildAmazonRedirectTrackingUrl(recordId);
    }
  }

  return {
    id: recordId,
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
    tracking_url,
    destination_type,
    original_destination_url,
    custom_slug,
    branded_url,
    clicks,
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
    const list = Array.isArray(parsed) ? parsed.map(normalizeTrackingLink) : [];
    return list.sort(compareTrackingLinksByCodeAsc);
  } catch {
    return [];
  }
}

function saveLocalTrackingLinks(campaignId: string | number, items: InfluencerTrackingLink[]): void {
  try {
    const sorted = [...items].sort(compareTrackingLinksByCodeAsc);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${campaignId}`, JSON.stringify(sorted));
  } catch (err) {
    console.warn('Failed saving tracking links to localStorage:', err);
  }
}

// ==========================================
// 5. FETCH TRACKING LINKS (SORTED ASCENDING)
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
      .eq('campaign_id', cleanId);

    if (error) {
      console.warn('Supabase fetchInfluencerTrackingLinks error, checking local fallback:', error.message);
      return getLocalTrackingLinks(cleanId);
    }

    if (data && data.length > 0) {
      const normalized = (data as any[]).map(normalizeTrackingLink).sort(compareTrackingLinksByCodeAsc);
      saveLocalTrackingLinks(cleanId, normalized);

      // Asynchronously register any Amazon custom slugs to Redis so redirects resolve instantly
      normalized.forEach(l => {
        if (l.destination_type === 'amazon' && l.custom_slug) {
          persistSlugMapping(l.custom_slug, l.id).catch(() => {});
        }
      });

      return normalized;
    }

    return getLocalTrackingLinks(cleanId);
  } catch (err) {
    console.warn('Exception in fetchInfluencerTrackingLinks, using local fallback:', err);
    return getLocalTrackingLinks(cleanId);
  }
}

// ==========================================
// 6. BATCH GENERATE TRACKING LINKS
// ==========================================

export interface BatchGenerateParams {
  campaign_id: string | number;
  product: string;
  base_product_url: string;
  destination_type?: 'shopify' | 'amazon';
  original_amazon_url?: string;
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

  // 1. FILTER: Strictly exclude eliminated influencers
  const eligibleInfluencers = (params.influencers || []).filter(inf => isActiveStatus(inf.is_archived));

  // 2. SORT: Order eligible influencers in numerical ascending Creator Code order before generation
  const sortedInfluencers = [...eligibleInfluencers].sort((a, b) => {
    const numA = extractCodeNumber(a.code || (a as any).influencer_code);
    const numB = extractCodeNumber(b.code || (b as any).influencer_code);
    if (numA !== numB) return numA - numB;
    const prefA = extractCodePrefix(a.code || (a as any).influencer_code);
    const prefB = extractCodePrefix(b.code || (b as any).influencer_code);
    if (prefA !== prefB) return prefA.localeCompare(prefB);
    return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true });
  });

  const total = sortedInfluencers.length;

  if (total === 0) {
    return {
      total: 0,
      successCount: 0,
      failedCount: 0,
      links: [],
      failedInfluencerIds: [],
      errors: ['No eligible influencers found in campaign to generate tracking links.']
    };
  }

  // Load existing links for deduplication
  const existingLinks = await fetchInfluencerTrackingLinks(cleanCampaignId);
  const now = new Date().toISOString();
  const cleanBaseUrl = extractBaseProductUrl(params.base_product_url);
  const isAmazon = params.destination_type === 'amazon' || isValidAmazonUrl(params.base_product_url);
  const destination_type: 'shopify' | 'amazon' = isAmazon ? 'amazon' : 'shopify';
  const original_destination_url = isAmazon ? (params.original_amazon_url || params.base_product_url).trim() : undefined;

  // Prepare link records for each eligible influencer in ascending order
  const recordsToUpsert: InfluencerTrackingLink[] = sortedInfluencers.map((inf) => {
    // Priority: inf.code -> inf.influencer_name / fallback
    const rawCode = inf.code || (inf as any).influencer_code || `HIS${inf.id}`;
    const cleanCode = String(rawCode).replace(/^#+/, '').trim().toLowerCase();
    const displayCode = `#${cleanCode.toUpperCase()}`;

    // Deduplication check: Match (campaign_id, influencer_id, product, platform, video_number)
    const existing = existingLinks.find(
      (l) =>
        String(l.campaign_id) === cleanCampaignId &&
        String(l.influencer_id) === String(inf.id) &&
        l.product.trim().toLowerCase() === params.product.trim().toLowerCase() &&
        (l.platform || '').trim().toLowerCase() === params.platform.trim().toLowerCase() &&
        (l.video_number || '').trim().toLowerCase() === params.video_number.trim().toLowerCase()
    );

    const recordId = existing?.id || (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `link_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    );

    // Derive unique branded slug for Amazon links
    const baseSlug = isAmazon ? buildTrackingSlug(cleanCode, params.video_number, params.utm_content) : '';
    const custom_slug = isAmazon ? getDisambiguatedSlug(baseSlug, recordId, existingLinks, params.product) : undefined;
    const branded_url = custom_slug ? buildBrandedTrackingUrl(custom_slug) : undefined;

    // Build unique tracking URL (prefer branded domain)
    const trackingUrl = isAmazon
      ? (branded_url || buildAmazonRedirectTrackingUrl(recordId))
      : buildInfluencerTrackingUrl(
          params.base_product_url,
          params.utm_source,
          params.utm_content,
          cleanCode
        );

    const notesPayload = JSON.stringify({
      destination_type,
      original_amazon_url: original_destination_url,
      custom_slug,
      platform: params.platform,
      platform_category: params.platform_category,
      video_number: params.video_number,
      utm_source: params.utm_source,
      utm_medium: 'influencer',
      utm_content: params.utm_content,
      creator_code: cleanCode,
      base_product_url: isAmazon ? (original_destination_url || cleanBaseUrl) : cleanBaseUrl,
      userNotes: existing?.notes || ''
    });

    return {
      id: recordId,
      campaign_id: cleanCampaignId,
      influencer_id: String(inf.id).trim(),
      influencer_name: inf.influencer_name || inf.name || existing?.influencer_name || '',
      influencer_code: displayCode,
      creator_code: cleanCode,
      product: params.product.trim(),
      platform: params.platform,
      platform_category: params.platform_category,
      video_number: params.video_number,
      utm_source: params.utm_source.toLowerCase(),
      utm_medium: 'influencer',
      utm_content: params.utm_content.toLowerCase(),
      base_product_url: isAmazon ? (original_destination_url || cleanBaseUrl) : cleanBaseUrl,
      tracking_url: trackingUrl,
      destination_type,
      original_destination_url,
      custom_slug,
      branded_url,
      clicks: existing?.clicks || 0,
      notes: notesPayload,
      created_at: existing?.created_at || now,
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
            notes: typeof c.notes === 'string' && c.notes.startsWith('{')
              ? c.notes
              : JSON.stringify({
                  platform: c.platform,
                  platform_category: c.platform_category,
                  video_number: c.video_number,
                  utm_source: c.utm_source,
                  utm_medium: c.utm_medium,
                  utm_content: c.utm_content,
                  creator_code: c.creator_code,
                  base_product_url: c.base_product_url,
                  destination_type: c.destination_type,
                  original_destination_url: c.original_destination_url,
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

  // Update local storage cache in numerical ascending order
  const mergedMap = new Map<string, InfluencerTrackingLink>();
  existingLinks.forEach(l => mergedMap.set(l.id, l));
  successfulLinks.forEach(l => mergedMap.set(l.id, l));
  const finalLocalLinks = Array.from(mergedMap.values()).sort(compareTrackingLinksByCodeAsc);
  saveLocalTrackingLinks(cleanCampaignId, finalLocalLinks);

  // Asynchronously register any Amazon custom slugs to Redis
  if (isAmazon) {
    successfulLinks.forEach(link => {
      if (link.custom_slug) {
        persistSlugMapping(link.custom_slug, link.id).catch(() => {});
      }
    });
  }

  return {
    total,
    successCount: successfulLinks.length,
    failedCount: failedInfluencerIds.length,
    links: successfulLinks.sort(compareTrackingLinksByCodeAsc),
    failedInfluencerIds,
    errors
  };
}

// ==========================================
// 7. SINGLE CREATE / UPDATE / DELETE
// ==========================================

export interface CreateTrackingLinkParams {
  campaign_id: string | number;
  influencer_id: string | number;
  influencer_name?: string;
  influencer_code?: string;
  product: string;
  destination_type?: 'shopify' | 'amazon';
  original_destination_url?: string;
  custom_slug?: string;
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

  const isAmazon = params.destination_type === 'amazon' || isValidAmazonUrl(params.base_product_url || '');
  const destination_type: 'shopify' | 'amazon' = isAmazon ? 'amazon' : 'shopify';
  const original_destination_url = params.original_destination_url || (isAmazon ? params.base_product_url : undefined);

  const custom_slug = isAmazon 
    ? (params.custom_slug?.trim().toLowerCase() || buildTrackingSlug(cleanCode, params.video_number, params.utm_content))
    : undefined;
  const branded_url = custom_slug ? buildBrandedTrackingUrl(custom_slug) : undefined;
  const finalTrackingUrl = isAmazon 
    ? (branded_url || params.tracking_url.trim())
    : params.tracking_url.trim();

  const notesPayload = JSON.stringify({
    destination_type,
    original_amazon_url: original_destination_url,
    custom_slug,
    platform: params.platform || 'Instagram',
    platform_category: params.platform_category || 'WEBSITE',
    video_number: params.video_number || 'Video 1',
    utm_source: (params.utm_source || 'instagram').toLowerCase(),
    utm_medium: 'influencer',
    utm_content: (params.utm_content || 'v1').toLowerCase(),
    creator_code: cleanCode,
    base_product_url: params.base_product_url || '',
    userNotes: params.notes?.trim() || ''
  });

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
    base_product_url: isAmazon ? (original_destination_url || params.base_product_url || '') : (params.base_product_url || ''),
    tracking_url: finalTrackingUrl,
    destination_type,
    original_destination_url,
    custom_slug,
    branded_url,
    clicks: 0,
    notes: notesPayload,
    created_at: now,
    updated_at: now
  };

  if (destination_type === 'amazon' && custom_slug) {
    persistSlugMapping(custom_slug, newRecord.id).catch(() => {});
  }

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
          notes: notesPayload,
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
  destination_type?: 'shopify' | 'amazon';
  original_destination_url?: string;
  platform?: string;
  platform_category?: PlatformCategory;
  video_number?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_content?: string;
  creator_code?: string;
  base_product_url?: string;
  tracking_url: string;
  custom_slug?: string;
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

  const isAmazon = params.destination_type === 'amazon' || isValidAmazonUrl(params.base_product_url || '');
  const destination_type: 'shopify' | 'amazon' = isAmazon ? 'amazon' : 'shopify';
  const original_destination_url = params.original_destination_url || (isAmazon ? params.base_product_url : undefined);

  const custom_slug = isAmazon 
    ? (params.custom_slug?.trim().toLowerCase() || buildTrackingSlug(cleanCode, params.video_number, params.utm_content))
    : undefined;
  const branded_url = custom_slug ? buildBrandedTrackingUrl(custom_slug) : undefined;
  const finalTrackingUrl = isAmazon 
    ? (branded_url || params.tracking_url.trim())
    : params.tracking_url.trim();

  const notesPayload = JSON.stringify({
    destination_type,
    original_amazon_url: original_destination_url,
    custom_slug,
    platform: params.platform,
    platform_category: params.platform_category,
    video_number: params.video_number,
    utm_source: params.utm_source,
    utm_medium: params.utm_medium,
    utm_content: params.utm_content,
    creator_code: cleanCode,
    base_product_url: params.base_product_url,
    userNotes: params.notes?.trim() || ''
  });

  const updates = {
    influencer_id: String(params.influencer_id).trim(),
    influencer_name: params.influencer_name?.trim() || '',
    influencer_code: displayCode,
    product: params.product.trim(),
    tracking_url: finalTrackingUrl,
    notes: notesPayload,
    updated_at: now
  };

  if (destination_type === 'amazon' && custom_slug) {
    persistSlugMapping(custom_slug, id).catch(() => {});
  }

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

    const saved = data ? normalizeTrackingLink(data) : { ...updates, id, campaign_id: cleanCampaignId, destination_type, original_destination_url } as InfluencerTrackingLink;
    const local = getLocalTrackingLinks(cleanCampaignId);
    const updatedList = local.map(l => l.id === id ? { ...l, ...saved } : l);
    saveLocalTrackingLinks(cleanCampaignId, updatedList);
    return saved;
  } catch (err) {
    console.warn('Exception updating tracking link, updating locally:', err);
    const local = getLocalTrackingLinks(cleanCampaignId);
    const found = local.find(l => l.id === id);
    if (!found) throw new Error('Tracking link not found');
    const updated = { ...found, ...updates, destination_type, original_destination_url };
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

/**
 * Bulk delete multiple tracking links by ID for a specific campaign
 */
export async function bulkDeleteInfluencerTrackingLinks(
  ids: string[],
  campaignId: string | number
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  if (!ids || ids.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  const cleanCampaignId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;
  const idSet = new Set(ids);

  try {
    // Delete in batches of 100 to avoid query length limits
    const BATCH_SIZE = 100;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await client
        .from(SUPABASE_TABLES.influencerTrackingLinks)
        .delete()
        .in('id', batch)
        .eq('campaign_id', cleanCampaignId);

      if (error) {
        console.warn('Supabase batch delete error:', error.message);
        throw new Error(error.message);
      }
    }

    return { success: true, deletedCount: ids.length };
  } catch (err: any) {
    console.error('Error in bulkDeleteInfluencerTrackingLinks:', err);
    return { success: false, deletedCount: 0, error: err?.message || 'Failed to delete selected tracking links' };
  } finally {
    const local = getLocalTrackingLinks(cleanCampaignId);
    const updated = local.filter(l => !idSet.has(l.id));
    saveLocalTrackingLinks(cleanCampaignId, updated);
  }
}

