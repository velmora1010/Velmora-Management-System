-- Migration: Add three-language columns and conversation_name to influencer_conversations

ALTER TABLE public.influencer_conversations 
  ADD COLUMN IF NOT EXISTS conversation_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS regional_language text DEFAULT 'Hindi',
  ADD COLUMN IF NOT EXISTS english_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS regional_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS regional_transliteration text DEFAULT '';

-- Populate english_text from legacy conversation_text/conversation if empty
UPDATE public.influencer_conversations
SET english_text = COALESCE(NULLIF(conversation_text, ''), NULLIF(conversation, ''), '')
WHERE english_text IS NULL OR english_text = '';

UPDATE public.influencer_conversations
SET conversation_name = COALESCE(NULLIF(title, ''), 'Conversation')
WHERE conversation_name IS NULL OR conversation_name = '';

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_influencer_conversations_reg_lang ON public.influencer_conversations(regional_language);
CREATE INDEX IF NOT EXISTS idx_influencer_conversations_camp_step ON public.influencer_conversations(campaign_id, step_key);
