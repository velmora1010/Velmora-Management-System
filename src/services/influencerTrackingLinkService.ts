import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { InfluencerTrackingLink } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'velmora_influencer_tracking_links_';

function getLocalTrackingLinks(campaignId: string | number): InfluencerTrackingLink[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${campaignId}`);
    return raw ? JSON.parse(raw) : [];
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

/**
 * Fetch all influencer tracking links for a campaign
 */
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
      saveLocalTrackingLinks(cleanId, data as InfluencerTrackingLink[]);
      return data as InfluencerTrackingLink[];
    }

    const local = getLocalTrackingLinks(cleanId);
    return local;
  } catch (err) {
    console.warn('Exception in fetchInfluencerTrackingLinks, using local fallback:', err);
    return getLocalTrackingLinks(cleanId);
  }
}

export interface CreateTrackingLinkParams {
  campaign_id: string | number;
  influencer_id: string | number;
  influencer_name?: string;
  influencer_code?: string;
  product: string;
  tracking_url: string;
  notes?: string;
}

/**
 * Create a new influencer tracking link
 */
export async function createInfluencerTrackingLink(
  params: CreateTrackingLinkParams
): Promise<InfluencerTrackingLink> {
  const cleanCampaignId = String(params.campaign_id).trim();
  const client = supabaseAdmin || supabase;

  const newRecord: InfluencerTrackingLink = {
    id: crypto.randomUUID ? crypto.randomUUID() : `link_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    campaign_id: cleanCampaignId,
    influencer_id: String(params.influencer_id).trim(),
    influencer_name: params.influencer_name?.trim() || '',
    influencer_code: params.influencer_code?.trim() || '',
    product: params.product.trim(),
    tracking_url: params.tracking_url.trim(),
    notes: params.notes?.trim() || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.influencerTrackingLinks)
      .insert([newRecord])
      .select()
      .single();

    if (error) {
      console.warn('Supabase create tracking link failed, persisting locally:', error.message);
      const local = getLocalTrackingLinks(cleanCampaignId);
      const updated = [newRecord, ...local];
      saveLocalTrackingLinks(cleanCampaignId, updated);
      return newRecord;
    }

    const saved = (data as InfluencerTrackingLink) || newRecord;
    const local = getLocalTrackingLinks(cleanCampaignId);
    saveLocalTrackingLinks(cleanCampaignId, [saved, ...local.filter(l => l.id !== saved.id)]);
    return saved;
  } catch (err) {
    console.warn('Exception creating tracking link, persisting locally:', err);
    const local = getLocalTrackingLinks(cleanCampaignId);
    const updated = [newRecord, ...local];
    saveLocalTrackingLinks(cleanCampaignId, updated);
    return newRecord;
  }
}

export interface UpdateTrackingLinkParams {
  influencer_id: string | number;
  influencer_name?: string;
  influencer_code?: string;
  product: string;
  tracking_url: string;
  notes?: string;
}

/**
 * Update an existing tracking link
 */
export async function updateInfluencerTrackingLink(
  id: string,
  campaignId: string | number,
  params: UpdateTrackingLinkParams
): Promise<InfluencerTrackingLink> {
  const cleanCampaignId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;
  const now = new Date().toISOString();

  const updates = {
    influencer_id: String(params.influencer_id).trim(),
    influencer_name: params.influencer_name?.trim() || '',
    influencer_code: params.influencer_code?.trim() || '',
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
      const local = getLocalTrackingLinks(cleanCampaignId);
      const updated = local.map(l => l.id === id ? { ...l, ...updates } : l);
      saveLocalTrackingLinks(cleanCampaignId, updated);
      const found = updated.find(l => l.id === id);
      if (!found) throw new Error('Tracking link not found');
      return found;
    }

    const saved = data as InfluencerTrackingLink;
    const local = getLocalTrackingLinks(cleanCampaignId);
    const updated = local.map(l => l.id === id ? saved : l);
    saveLocalTrackingLinks(cleanCampaignId, updated);
    return saved;
  } catch (err) {
    console.warn('Exception updating tracking link, updating locally:', err);
    const local = getLocalTrackingLinks(cleanCampaignId);
    const updated = local.map(l => l.id === id ? { ...l, ...updates } : l);
    saveLocalTrackingLinks(cleanCampaignId, updated);
    const found = updated.find(l => l.id === id);
    if (!found) throw new Error('Tracking link not found');
    return found;
  }
}

/**
 * Delete a tracking link
 */
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
