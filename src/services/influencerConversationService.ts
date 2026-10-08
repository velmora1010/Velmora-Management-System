import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { InfluencerConversation } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'velmora_influencer_conversations_';

function getLocalConversations(campaignId: string | number): InfluencerConversation[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${campaignId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalConversations(campaignId: string | number, items: InfluencerConversation[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${campaignId}`, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed saving conversations to localStorage:', err);
  }
}

/**
 * Normalizes a database or cache record to have consistent fields for three languages
 */
export function normalizeConversation(raw: any, campaignId: string): InfluencerConversation {
  const convName = (raw.conversation_name || raw.title || '').trim();
  const regLang = (raw.regional_language || 'Hindi').trim();
  const engText = (raw.english_text || raw.conversation_text || raw.conversation || '').toString();
  const regText = (raw.regional_text || '').toString();
  const regTranslit = (raw.regional_transliteration || '').toString();

  return {
    id: String(raw.id || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
    campaign_id: String(raw.campaign_id || campaignId),
    step_key: String(raw.step_key || 'delivered').toLowerCase(),
    conversation_name: convName,
    title: convName,
    regional_language: regLang,
    english_text: engText,
    regional_text: regText,
    regional_transliteration: regTranslit,
    // legacy backward compatibility:
    conversation_text: engText,
    conversation: engText,
    display_order: typeof raw.display_order === 'number' ? raw.display_order : 0,
    is_active: raw.is_active !== false,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString()
  };
}

/**
 * Fetch all conversations for a campaign, optionally filtered by step_key
 */
export async function fetchInfluencerConversations(
  campaignId: string | number,
  stepKey?: string
): Promise<InfluencerConversation[]> {
  const cleanId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;

  try {
    let query = client
      .from(SUPABASE_TABLES.influencerConversations)
      .select('*')
      .eq('campaign_id', cleanId);

    if (stepKey && stepKey !== 'all') {
      query = query.eq('step_key', stepKey.toLowerCase().trim());
    }

    query = query
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.warn('Supabase fetchInfluencerConversations error, using local fallback:', error.message);
      const local = getLocalConversations(cleanId).map(c => normalizeConversation(c, cleanId));
      if (stepKey && stepKey !== 'all') {
        return local.filter(c => c.step_key === stepKey.toLowerCase().trim());
      }
      return local;
    }

    if (data && Array.isArray(data)) {
      const normalized = data.map(item => normalizeConversation(item, cleanId));
      
      // Update local cache
      const cached = getLocalConversations(cleanId);
      const mergedMap = new Map<string, InfluencerConversation>();
      cached.forEach(c => mergedMap.set(c.id, normalizeConversation(c, cleanId)));
      normalized.forEach(c => mergedMap.set(c.id, c));
      saveLocalConversations(cleanId, Array.from(mergedMap.values()));

      return normalized;
    }

    const local = getLocalConversations(cleanId).map(c => normalizeConversation(c, cleanId));
    if (stepKey && stepKey !== 'all') {
      return local.filter(c => c.step_key === stepKey.toLowerCase().trim());
    }
    return local;
  } catch (err) {
    console.warn('Exception in fetchInfluencerConversations, using local fallback:', err);
    const local = getLocalConversations(cleanId).map(c => normalizeConversation(c, cleanId));
    if (stepKey && stepKey !== 'all') {
      return local.filter(c => c.step_key === stepKey.toLowerCase().trim());
    }
    return local;
  }
}

/**
 * Convenience function to get conversations strictly for a specific workflow step
 */
export async function getInfluencerConversations(
  campaignId: string | number,
  stepKey: string
): Promise<InfluencerConversation[]> {
  return fetchInfluencerConversations(campaignId, stepKey);
}

export interface CreateConversationParams {
  campaign_id: string | number;
  step_key: string;
  conversation_name?: string;
  regional_language?: string;
  english_text: string;
  regional_text?: string;
  regional_transliteration?: string;
  display_order?: number;
  is_active?: boolean;
}

/**
 * Create and save a new influencer conversation with all three language fields
 */
export async function createInfluencerConversation(
  params: CreateConversationParams
): Promise<InfluencerConversation> {
  const cleanCampaignId = String(params.campaign_id).trim();
  const client = supabaseAdmin || supabase;
  const stepKey = (params.step_key || 'delivered').toLowerCase().trim();
  const convName = (params.conversation_name || '').trim();
  const regLang = (params.regional_language || 'Hindi').trim();
  const engText = (params.english_text || '').trim();
  const regText = (params.regional_text || '').trim();
  const regTranslit = (params.regional_transliteration || '').trim();
  const nowIso = new Date().toISOString();

  const newRecord: InfluencerConversation = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    campaign_id: cleanCampaignId,
    step_key: stepKey,
    conversation_name: convName,
    title: convName,
    regional_language: regLang,
    english_text: engText,
    regional_text: regText,
    regional_transliteration: regTranslit,
    conversation_text: engText,
    conversation: engText,
    display_order: typeof params.display_order === 'number' ? params.display_order : 0,
    is_active: params.is_active !== false,
    created_at: nowIso,
    updated_at: nowIso
  };

  try {
    const payload = {
      id: newRecord.id,
      campaign_id: newRecord.campaign_id,
      step_key: newRecord.step_key,
      conversation_name: newRecord.conversation_name,
      title: newRecord.conversation_name,
      regional_language: newRecord.regional_language,
      english_text: newRecord.english_text,
      regional_text: newRecord.regional_text,
      regional_transliteration: newRecord.regional_transliteration,
      conversation_text: newRecord.english_text,
      conversation: newRecord.english_text,
      display_order: newRecord.display_order,
      is_active: newRecord.is_active,
      created_at: nowIso,
      updated_at: nowIso
    };

    const { data, error } = await client
      .from(SUPABASE_TABLES.influencerConversations)
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase create conversation failed, persisting locally:', error.message);
      const local = getLocalConversations(cleanCampaignId);
      const updated = [newRecord, ...local];
      saveLocalConversations(cleanCampaignId, updated);
      return newRecord;
    }

    const saved = normalizeConversation(data || newRecord, cleanCampaignId);
    const local = getLocalConversations(cleanCampaignId);
    const updated = [saved, ...local.filter(c => c.id !== saved.id)];
    saveLocalConversations(cleanCampaignId, updated);
    return saved;
  } catch (err) {
    console.warn('Exception creating conversation, persisting locally:', err);
    const local = getLocalConversations(cleanCampaignId);
    const updated = [newRecord, ...local];
    saveLocalConversations(cleanCampaignId, updated);
    return newRecord;
  }
}

export interface UpdateConversationParams {
  step_key?: string;
  conversation_name?: string;
  regional_language?: string;
  english_text: string;
  regional_text?: string;
  regional_transliteration?: string;
  display_order?: number;
  is_active?: boolean;
}

/**
 * Update an existing influencer conversation across all three language fields
 */
export async function updateInfluencerConversation(
  id: string,
  params: UpdateConversationParams,
  campaignId: string | number
): Promise<InfluencerConversation> {
  const cleanCampaignId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;
  const nowIso = new Date().toISOString();
  const engText = (params.english_text || '').trim();
  const regText = (params.regional_text || '').trim();
  const regTranslit = (params.regional_transliteration || '').trim();

  const updatePayload: Record<string, any> = {
    english_text: engText,
    regional_text: regText,
    regional_transliteration: regTranslit,
    conversation_text: engText,
    conversation: engText,
    updated_at: nowIso
  };

  if (params.step_key) {
    updatePayload.step_key = params.step_key.toLowerCase().trim();
  }
  if (params.conversation_name !== undefined) {
    updatePayload.conversation_name = params.conversation_name.trim();
    updatePayload.title = params.conversation_name.trim();
  }
  if (params.regional_language !== undefined) {
    updatePayload.regional_language = params.regional_language.trim();
  }
  if (typeof params.display_order === 'number') {
    updatePayload.display_order = params.display_order;
  }
  if (params.is_active !== undefined) {
    updatePayload.is_active = params.is_active;
  }

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.influencerConversations)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update conversation failed, updating locally:', error.message);
      const local = getLocalConversations(cleanCampaignId);
      const updated = local.map(c => 
        c.id === id ? normalizeConversation({ ...c, ...updatePayload }, cleanCampaignId) : c
      );
      saveLocalConversations(cleanCampaignId, updated);
      return normalizeConversation({ id, campaign_id: cleanCampaignId, ...updatePayload }, cleanCampaignId);
    }

    const saved = normalizeConversation(data, cleanCampaignId);
    const local = getLocalConversations(cleanCampaignId);
    const updated = local.map(c => (c.id === id ? saved : c));
    saveLocalConversations(cleanCampaignId, updated);
    return saved;
  } catch (err) {
    console.warn('Exception updating conversation, updating locally:', err);
    const local = getLocalConversations(cleanCampaignId);
    const updated = local.map(c => 
      c.id === id ? normalizeConversation({ ...c, ...updatePayload }, cleanCampaignId) : c
    );
    saveLocalConversations(cleanCampaignId, updated);
    return normalizeConversation({ id, campaign_id: cleanCampaignId, ...updatePayload }, cleanCampaignId);
  }
}

/**
 * Delete an influencer conversation
 */
export async function deleteInfluencerConversation(
  id: string,
  campaignId: string | number
): Promise<boolean> {
  const cleanCampaignId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;

  try {
    const { error } = await client
      .from(SUPABASE_TABLES.influencerConversations)
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase delete conversation error, removing locally:', error.message);
    }
  } catch (err) {
    console.warn('Exception deleting conversation from Supabase, removing locally:', err);
  }

  // Remove from local cache
  const local = getLocalConversations(cleanCampaignId);
  const updated = local.filter(c => c.id !== id);
  saveLocalConversations(cleanCampaignId, updated);
  return true;
}

/**
 * Reusable helper to safely copy conversation text preserving line breaks, emojis, and formatting
 */
export async function copyConversationText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy conversation text:', err);
    return false;
  }
}
