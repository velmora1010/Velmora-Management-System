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
 * Fetch all conversations for a campaign (sorted newest first)
 */
export async function fetchInfluencerConversations(
  campaignId: string | number
): Promise<InfluencerConversation[]> {
  const cleanId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.influencerConversations)
      .select('*')
      .eq('campaign_id', cleanId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchInfluencerConversations error, using local fallback:', error.message);
      return getLocalConversations(cleanId);
    }

    if (data) {
      saveLocalConversations(cleanId, data as InfluencerConversation[]);
      return data as InfluencerConversation[];
    }

    return getLocalConversations(cleanId);
  } catch (err) {
    console.warn('Exception in fetchInfluencerConversations, using local fallback:', err);
    return getLocalConversations(cleanId);
  }
}

export interface CreateConversationParams {
  campaign_id: string | number;
  conversation: string;
}

/**
 * Create and save a new influencer conversation
 */
export async function createInfluencerConversation(
  params: CreateConversationParams
): Promise<InfluencerConversation> {
  const cleanCampaignId = String(params.campaign_id).trim();
  const client = supabaseAdmin || supabase;

  const newRecord: InfluencerConversation = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    campaign_id: cleanCampaignId,
    conversation: params.conversation.trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.influencerConversations)
      .insert([newRecord])
      .select()
      .single();

    if (error) {
      console.warn('Supabase create conversation failed, persisting locally:', error.message);
      const local = getLocalConversations(cleanCampaignId);
      const updated = [newRecord, ...local];
      saveLocalConversations(cleanCampaignId, updated);
      return newRecord;
    }

    const saved = (data as InfluencerConversation) || newRecord;
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

/**
 * Update an existing influencer conversation
 */
export async function updateInfluencerConversation(
  id: string,
  conversation: string,
  campaignId: string | number
): Promise<InfluencerConversation> {
  const cleanCampaignId = String(campaignId).trim();
  const client = supabaseAdmin || supabase;
  const nowIso = new Date().toISOString();

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLES.influencerConversations)
      .update({
        conversation: conversation.trim(),
        updated_at: nowIso
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update conversation failed, updating locally:', error.message);
      const local = getLocalConversations(cleanCampaignId);
      const updated = local.map(c => 
        c.id === id ? { ...c, conversation: conversation.trim(), updated_at: nowIso } : c
      );
      saveLocalConversations(cleanCampaignId, updated);
      return { id, campaign_id: cleanCampaignId, conversation: conversation.trim(), updated_at: nowIso };
    }

    const saved = data as InfluencerConversation;
    const local = getLocalConversations(cleanCampaignId);
    const updated = local.map(c => (c.id === id ? saved : c));
    saveLocalConversations(cleanCampaignId, updated);
    return saved;
  } catch (err) {
    console.warn('Exception updating conversation, updating locally:', err);
    const local = getLocalConversations(cleanCampaignId);
    const updated = local.map(c => 
      c.id === id ? { ...c, conversation: conversation.trim(), updated_at: nowIso } : c
    );
    saveLocalConversations(cleanCampaignId, updated);
    return { id, campaign_id: cleanCampaignId, conversation: conversation.trim(), updated_at: nowIso };
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
