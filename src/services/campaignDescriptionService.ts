import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { CampaignDescription } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'velmora_campaign_descriptions_';

function getLocalDescriptions(campaignId: string | number): CampaignDescription[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${campaignId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalDescriptions(campaignId: string | number, items: CampaignDescription[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${campaignId}`, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed saving descriptions to localStorage:', err);
  }
}

/**
 * Fetch all descriptions for a campaign
 */
export async function fetchCampaignDescriptions(
  campaignId: string | number
): Promise<CampaignDescription[]> {
  const cleanId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.campaignDescriptions)
      .select('*')
      .eq('campaign_id', cleanId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchCampaignDescriptions error, checking local fallback:', error.message);
      return getLocalDescriptions(cleanId);
    }

    if (data && data.length > 0) {
      saveLocalDescriptions(cleanId, data as CampaignDescription[]);
      return data as CampaignDescription[];
    }

    // Check if we have local cached records
    const local = getLocalDescriptions(cleanId);
    return local;
  } catch (err) {
    console.warn('Exception in fetchCampaignDescriptions, using local fallback:', err);
    return getLocalDescriptions(cleanId);
  }
}

export interface CreateDescriptionParams {
  campaign_id: string | number;
  product: string;
  description: string;
}

/**
 * Create or save a new description
 */
export async function createCampaignDescription(
  params: CreateDescriptionParams
): Promise<CampaignDescription> {
  const cleanCampaignId = String(params.campaign_id).trim();
  const client = supabaseAdmin || supabase;

  const newRecord: CampaignDescription = {
    id: crypto.randomUUID ? crypto.randomUUID() : `desc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    campaign_id: cleanCampaignId,
    product: params.product.trim(),
    description: params.description.trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.campaignDescriptions)
      .insert([newRecord])
      .select()
      .single();

    if (error) {
      console.warn('Supabase create description failed, persisting locally:', error.message);
      const local = getLocalDescriptions(cleanCampaignId);
      const updated = [newRecord, ...local];
      saveLocalDescriptions(cleanCampaignId, updated);
      return newRecord;
    }

    const saved = (data as CampaignDescription) || newRecord;
    const local = getLocalDescriptions(cleanCampaignId);
    saveLocalDescriptions(cleanCampaignId, [saved, ...local.filter(d => d.id !== saved.id)]);
    return saved;
  } catch (err) {
    console.warn('Exception creating description, persisting locally:', err);
    const local = getLocalDescriptions(cleanCampaignId);
    const updated = [newRecord, ...local];
    saveLocalDescriptions(cleanCampaignId, updated);
    return newRecord;
  }
}

export interface UpdateDescriptionParams {
  product: string;
  description: string;
}

/**
 * Update an existing description
 */
export async function updateCampaignDescription(
  id: string,
  campaignId: string | number,
  params: UpdateDescriptionParams
): Promise<CampaignDescription> {
  const cleanCampaignId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;
  const now = new Date().toISOString();

  const updates = {
    product: params.product.trim(),
    description: params.description.trim(),
    updated_at: now
  };

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.campaignDescriptions)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update description failed, updating locally:', error.message);
      const local = getLocalDescriptions(cleanCampaignId);
      const updated = local.map(d => d.id === id ? { ...d, ...updates } : d);
      saveLocalDescriptions(cleanCampaignId, updated);
      const found = updated.find(d => d.id === id);
      if (!found) throw new Error('Description not found');
      return found;
    }

    const saved = data as CampaignDescription;
    const local = getLocalDescriptions(cleanCampaignId);
    const updated = local.map(d => d.id === id ? saved : d);
    saveLocalDescriptions(cleanCampaignId, updated);
    return saved;
  } catch (err) {
    console.warn('Exception updating description, updating locally:', err);
    const local = getLocalDescriptions(cleanCampaignId);
    const updated = local.map(d => d.id === id ? { ...d, ...updates } : d);
    saveLocalDescriptions(cleanCampaignId, updated);
    const found = updated.find(d => d.id === id);
    if (!found) throw new Error('Description not found');
    return found;
  }
}

/**
 * Delete a description
 */
export async function deleteCampaignDescription(
  id: string,
  campaignId: string | number
): Promise<void> {
  const cleanCampaignId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;

  try {
    const { error } = await client
      .from(SUPABASE_TABLES.campaignDescriptions)
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase delete description failed, deleting locally:', error.message);
    }
  } catch (err) {
    console.warn('Exception deleting description from Supabase:', err);
  } finally {
    const local = getLocalDescriptions(cleanCampaignId);
    const updated = local.filter(d => d.id !== id);
    saveLocalDescriptions(cleanCampaignId, updated);
  }
}
