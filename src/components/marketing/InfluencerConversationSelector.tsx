import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Copy, Check, Loader2 } from 'lucide-react';
import type { InfluencerConversation } from '../../types';
import { 
  getInfluencerConversations, 
  copyConversationText 
} from '../../services/influencerConversationService';
import { getWorkflowStepLabel } from '../../utils/workflowStatusUtils';
import toast from 'react-hot-toast';

export interface InfluencerConversationSelectorProps {
  campaignId: string | number;
  stepKey: string;
  stepLabel?: string;
  targetLanguages?: string[] | string;
  className?: string;
}

export const InfluencerConversationSelector: React.FC<InfluencerConversationSelectorProps> = ({
  campaignId,
  stepKey,
  stepLabel,
  className = ''
}) => {
  const [conversations, setConversations] = useState<InfluencerConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedType, setCopiedType] = useState<'english' | 'regional' | 'translit' | null>(null);

  // Editable local texts (auto-filled from selected template, but editable per influencer without mutating DB)
  const [textEnglish, setTextEnglish] = useState<string>('');
  const [textRegional, setTextRegional] = useState<string>('');
  const [textRegionalEnglish, setTextRegionalEnglish] = useState<string>('');
  const [regionalLangName, setRegionalLangName] = useState<string>('');

  const cleanStepKey = (stepKey || 'delivered').toLowerCase().trim();
  const effectiveStepLabel = stepLabel || getWorkflowStepLabel(cleanStepKey);

  // Load conversations strictly for this step
  const loadConversations = useCallback(async () => {
    if (!campaignId) return;
    setIsLoading(true);
    try {
      const data = await getInfluencerConversations(campaignId, cleanStepKey);
      setConversations(data);
      if (data.length > 0) {
        // Auto-select first template
        const first = data[0];
        setSelectedId(first.id);
        setTextEnglish(first.english_text || first.conversation_text || first.conversation || '');
        setTextRegional(first.regional_text || '');
        setTextRegionalEnglish(first.regional_transliteration || '');
        setRegionalLangName(first.regional_language || '');
      } else {
        setSelectedId('');
        setTextEnglish('');
        setTextRegional('');
        setTextRegionalEnglish('');
        setRegionalLangName('');
      }
    } catch (err) {
      console.error(`Error loading conversations for step ${cleanStepKey}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, cleanStepKey]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Handle dropdown selection change
  const handleSelectChange = (id: string) => {
    setSelectedId(id);
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setTextEnglish(conv.english_text || conv.conversation_text || conv.conversation || '');
      setTextRegional(conv.regional_text || '');
      setTextRegionalEnglish(conv.regional_transliteration || '');
      setRegionalLangName(conv.regional_language || '');
    } else {
      setTextEnglish('');
      setTextRegional('');
      setTextRegionalEnglish('');
      setRegionalLangName('');
    }
  };

  // Copy handler
  const handleCopy = async (type: 'english' | 'regional' | 'translit', text: string, label: string) => {
    if (!text.trim()) {
      toast.error(`No ${label} text to copy`);
      return;
    }
    const success = await copyConversationText(text);
    if (success) {
      setCopiedType(type);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedType(null), 2000);
    } else {
      toast.error(`Failed to copy ${label}`);
    }
  };

  return (
    <div className={`bg-[#070c18] border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 ${className}`}>
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <MessageSquare size={14} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              INFLUENCER CONVERSATION
            </span>
            <span className="text-[11px] text-purple-400 font-medium">
              {effectiveStepLabel} Message Templates
            </span>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <Loader2 size={13} className="animate-spin text-purple-400" />
            <span className="text-[11px]">Loading...</span>
          </div>
        )}
      </div>

      {/* 2. Dropdown Select */}
      <div className="space-y-1.5">
        <div className="relative">
          <select
            value={selectedId}
            onChange={(e) => handleSelectChange(e.target.value)}
            disabled={conversations.length === 0}
            className="w-full bg-[#0b1329] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 outline-none focus:border-purple-500 transition-colors cursor-pointer appearance-none pr-9 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {conversations.length === 0 ? (
              <option value="">No conversation available ▼</option>
            ) : (
              <>
                <option value="">Select {effectiveStepLabel} Conversation ▼</option>
                {conversations.map((c) => {
                  const label = c.conversation_name
                    ? `${c.conversation_name}${c.regional_language ? ` (${c.regional_language})` : ''} — ${(c.english_text || c.conversation_text || '').slice(0, 50)}`
                    : (c.english_text || c.conversation_text || 'Conversation').slice(0, 70);
                  return (
                    <option key={c.id} value={c.id} className="bg-[#0b1329] text-white py-1">
                      {label}
                    </option>
                  );
                })}
              </>
            )}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
            ▼
          </div>
        </div>
      </div>

      {/* 3. Three Language Cards (Always shown, equal width, aligned in one row on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* Card 1: English */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-2 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                English
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {textEnglish.length} chars
              </span>
            </div>
            <textarea
              value={textEnglish}
              onChange={(e) => setTextEnglish(e.target.value)}
              placeholder="English conversation text..."
              rows={6}
              className="w-full flex-1 bg-[#070c18] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-colors font-sans resize-y min-h-[130px] leading-relaxed"
            />
          </div>
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => handleCopy('english', textEnglish, 'English')}
              disabled={!textEnglish.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all cursor-pointer disabled:opacity-40"
            >
              {copiedType === 'english' ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied ✓</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy English</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Regional Language */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-2 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                Regional Language{regionalLangName ? ` (${regionalLangName})` : ''}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {textRegional.length} chars
              </span>
            </div>
            <textarea
              value={textRegional}
              onChange={(e) => setTextRegional(e.target.value)}
              placeholder="Regional language conversation text..."
              rows={6}
              className="w-full flex-1 bg-[#070c18] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-colors font-sans resize-y min-h-[130px] leading-relaxed"
            />
          </div>
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => handleCopy('regional', textRegional, 'Regional Language')}
              disabled={!textRegional.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all cursor-pointer disabled:opacity-40"
            >
              {copiedType === 'regional' ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied ✓</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy Regional</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 3: Regional Language (English) */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-2 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                Regional Language (English)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {textRegionalEnglish.length} chars
              </span>
            </div>
            <textarea
              value={textRegionalEnglish}
              onChange={(e) => setTextRegionalEnglish(e.target.value)}
              placeholder="Regional language written in English/Latin text..."
              rows={6}
              className="w-full flex-1 bg-[#070c18] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-colors font-sans resize-y min-h-[130px] leading-relaxed"
            />
          </div>
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => handleCopy('translit', textRegionalEnglish, 'Regional Language (English)')}
              disabled={!textRegionalEnglish.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all cursor-pointer disabled:opacity-40"
            >
              {copiedType === 'translit' ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied ✓</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy Regional (English)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
