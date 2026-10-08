import React, { useState, useEffect, useMemo } from 'react';
import { X, MessageSquare, Loader2, Save, Plus } from 'lucide-react';
import type { InfluencerConversation } from '../../types';
import { 
  createInfluencerConversation, 
  updateInfluencerConversation 
} from '../../services/influencerConversationService';
import { getWorkflowStepLabel } from '../../utils/workflowStatusUtils';
import { CampaignConversationCard } from './CampaignConversationCard';
import toast from 'react-hot-toast';

const DEFAULT_REGIONAL_LANGUAGES = [
  'Hindi',
  'Tamil',
  'Malayalam',
  'Telugu',
  'Marathi',
  'Kannada',
  'Bengali',
  'Gujarati',
  'Punjabi',
  'Odia',
  'Urdu',
  'Assamese'
];

interface CampaignConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string | number;
  stepKey: string;
  stepLabel?: string;
  targetLanguages?: string[] | string;
  conversationToEdit?: InfluencerConversation | null;
  stepConversations?: InfluencerConversation[];
  onSuccess: (savedConversation: InfluencerConversation) => void;
  onDeleteConversation?: (conversation: InfluencerConversation) => void;
}

export const CampaignConversationModal: React.FC<CampaignConversationModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  stepKey,
  stepLabel,
  targetLanguages,
  conversationToEdit,
  stepConversations = [],
  onSuccess,
  onDeleteConversation
}) => {
  const effectiveStepLabel = stepLabel || getWorkflowStepLabel(stepKey);

  // Parse available languages
  const availableLanguages = useMemo(() => {
    let campaignLangs: string[] = [];
    if (typeof targetLanguages === 'string') {
      try {
        const parsed = JSON.parse(targetLanguages);
        campaignLangs = Array.isArray(parsed) ? parsed : [targetLanguages];
      } catch {
        campaignLangs = [targetLanguages];
      }
    } else if (Array.isArray(targetLanguages)) {
      campaignLangs = targetLanguages;
    }

    const set = new Set<string>();
    campaignLangs.filter(Boolean).forEach(l => set.add(l.trim()));
    DEFAULT_REGIONAL_LANGUAGES.forEach(l => set.add(l));
    return Array.from(set);
  }, [targetLanguages]);

  const [conversationName, setConversationName] = useState('');
  const [regionalLanguage, setRegionalLanguage] = useState('Hindi');
  const [englishText, setEnglishText] = useState('');
  const [regionalText, setRegionalText] = useState('');
  const [regionalTransliteration, setRegionalTransliteration] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'saved'>('form');
  const [currentEditTarget, setCurrentEditTarget] = useState<InfluencerConversation | null>(null);

  // Helper to load conversation into form
  const populateForm = (target: InfluencerConversation | null) => {
    if (target) {
      setConversationName(target.conversation_name || target.title || '');
      setRegionalLanguage(target.regional_language || availableLanguages[0] || 'Hindi');
      setEnglishText(target.english_text || target.conversation_text || target.conversation || '');
      setRegionalText(target.regional_text || '');
      setRegionalTransliteration(target.regional_transliteration || '');
    } else {
      setConversationName('');
      setRegionalLanguage(availableLanguages[0] || 'Hindi');
      setEnglishText('');
      setRegionalText('');
      setRegionalTransliteration('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      const target = conversationToEdit || null;
      setCurrentEditTarget(target);
      setActiveTab('form');
      populateForm(target);
    }
  }, [isOpen, conversationToEdit, availableLanguages]);

  if (!isOpen) return null;

  const handleStartEditFromList = (conv: InfluencerConversation) => {
    setCurrentEditTarget(conv);
    populateForm(conv);
    setActiveTab('form');
  };

  const handleCancelEdit = () => {
    setCurrentEditTarget(null);
    populateForm(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEnglish = englishText.trim();
    if (!trimmedEnglish) {
      toast.error('Please enter English conversation text.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (currentEditTarget?.id) {
        const updated = await updateInfluencerConversation(
          currentEditTarget.id,
          {
            step_key: stepKey,
            conversation_name: conversationName.trim(),
            regional_language: regionalLanguage,
            english_text: trimmedEnglish,
            regional_text: regionalText.trim(),
            regional_transliteration: regionalTransliteration.trim()
          },
          campaignId
        );
        toast.success('Conversation updated successfully');
        onSuccess(updated);
        setCurrentEditTarget(null);
      } else {
        const created = await createInfluencerConversation({
          campaign_id: campaignId,
          step_key: stepKey,
          conversation_name: conversationName.trim(),
          regional_language: regionalLanguage,
          english_text: trimmedEnglish,
          regional_text: regionalText.trim(),
          regional_transliteration: regionalTransliteration.trim()
        });
        toast.success('Conversation saved successfully');
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving conversation:', err);
      toast.error(err?.message || 'Failed to save conversation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-4xl bg-[#0b1329] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#070c18]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-xs">
              <MessageSquare size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {currentEditTarget ? 'Edit Conversation' : 'Add Conversation'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60 uppercase tracking-wide">
                  {effectiveStepLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure three-language message templates for {effectiveStepLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Optional Tabs when step has existing saved conversations */}
        {stepConversations.length > 0 && (
          <div className="flex items-center gap-4 px-6 pt-2.5 border-b border-slate-800 bg-[#070c18]">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'form'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {currentEditTarget ? 'Edit Conversation' : 'Add New Conversation'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'saved'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Saved Conversations ({stepConversations.length})
            </button>
          </div>
        )}

        {/* View 1: Saved Conversations List inside Modal */}
        {activeTab === 'saved' && stepConversations.length > 0 ? (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <p className="text-xs text-slate-400">
                {stepConversations.length} saved {stepConversations.length === 1 ? 'message' : 'messages'} for <span className="font-semibold text-slate-200">{effectiveStepLabel}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  handleCancelEdit();
                  setActiveTab('form');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/40 cursor-pointer"
              >
                <Plus size={13} />
                <span>Add New Conversation</span>
              </button>
            </div>
            <div className="space-y-3">
              {stepConversations.map((conv) => (
                <CampaignConversationCard
                  key={conv.id}
                  conversation={conv}
                  onEdit={handleStartEditFromList}
                  onDelete={(c) => onDeleteConversation?.(c)}
                />
              ))}
            </div>
          </div>
        ) : (
          /* View 2: Add / Edit 3-Language Form */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Top Row: Conversation Name + Regional Language Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Conversation Name (Optional) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Conversation Name
              </label>
              <input
                type="text"
                value={conversationName}
                onChange={(e) => setConversationName(e.target.value)}
                placeholder="e.g. Delivery Confirmation, Package Received, Follow-up..."
                className="w-full bg-[#070c18] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Regional Language Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Regional Language
              </label>
              <select
                value={regionalLanguage}
                onChange={(e) => setRegionalLanguage(e.target.value)}
                className="w-full bg-[#070c18] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 outline-none focus:border-purple-500 transition-colors cursor-pointer"
              >
                {availableLanguages.map((lang) => (
                  <option key={lang} value={lang} className="bg-[#0b1329] text-white">
                    {lang}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Three Language Columns Layout (Large Textareas) */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Conversation Messages
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Column 1: English */}
              <div className="space-y-1.5 flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-purple-300">
                    English
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {englishText.length} chars
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={englishText}
                  onChange={(e) => setEnglishText(e.target.value)}
                  placeholder="Hi, your product has been delivered. Please confirm once you receive it..."
                  className="w-full flex-1 bg-[#070c18] border border-slate-700/80 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-purple-500 transition-colors font-sans resize-y min-h-[170px] leading-relaxed"
                />
              </div>

              {/* Column 2: Regional Language */}
              <div className="space-y-1.5 flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-purple-300">
                    {regionalLanguage}
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {regionalText.length} chars
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={regionalText}
                  onChange={(e) => setRegionalText(e.target.value)}
                  placeholder={`नमस्ते, आपका प्रोडक्ट डिलीवर हो गया है। कृपया प्राप्त होने की पुष्टि करें...`}
                  className="w-full flex-1 bg-[#070c18] border border-slate-700/80 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-purple-500 transition-colors font-sans resize-y min-h-[170px] leading-relaxed"
                />
              </div>

              {/* Column 3: Regional Transliteration (Regional Language in English) */}
              <div className="space-y-1.5 flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-purple-300">
                    {regionalLanguage} (Transliteration)
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {regionalTransliteration.length} chars
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={regionalTransliteration}
                  onChange={(e) => setRegionalTransliteration(e.target.value)}
                  placeholder={`Namaste, aapka product deliver ho gaya hai. Kripya receive hone ki pushti karein...`}
                  className="w-full flex-1 bg-[#070c18] border border-slate-700/80 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-purple-500 transition-colors font-sans resize-y min-h-[170px] leading-relaxed"
                />
              </div>

            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !englishText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-950/40 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Conversation</span>
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
