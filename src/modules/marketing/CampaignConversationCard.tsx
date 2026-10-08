import React, { useState } from 'react';
import { Edit2, Trash2, Copy, Check } from 'lucide-react';
import type { InfluencerConversation } from '../../types';
import { copyConversationText } from '../../services/influencerConversationService';
import toast from 'react-hot-toast';

interface CampaignConversationCardProps {
  conversation: InfluencerConversation;
  onEdit: (conversation: InfluencerConversation) => void;
  onDelete: (conversation: InfluencerConversation) => void;
}

export const CampaignConversationCard: React.FC<CampaignConversationCardProps> = ({
  conversation,
  onEdit,
  onDelete
}) => {
  const [copiedType, setCopiedType] = useState<'english' | 'regional' | 'translit' | null>(null);

  const title = conversation.conversation_name || conversation.title || 'Untitled Conversation';
  const regLang = conversation.regional_language || 'Regional';
  const engText = conversation.english_text || conversation.conversation_text || conversation.conversation || '';
  const regText = conversation.regional_text || '';
  const translitText = conversation.regional_transliteration || '';

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
    <div className="bg-[#070c18] border border-slate-800/90 hover:border-slate-700 rounded-xl p-4 sm:p-5 transition-all shadow-sm flex flex-col justify-between space-y-4">
      {/* Top Header: Title, Language Tag, Edit, Delete */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight">
            {title}
          </h4>
          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60 uppercase tracking-wide">
            {regLang}
          </span>
        </div>

        {/* Edit and Delete Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(conversation)}
            className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 rounded-lg transition-colors border border-transparent hover:border-purple-800/60 cursor-pointer"
            title="Edit conversation"
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(conversation)}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors border border-transparent hover:border-rose-800/60 cursor-pointer"
            title="Delete conversation"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Three Language Texts (Responsive 3 Columns or Stack) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Column 1: English */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-lg p-3 flex flex-col justify-between space-y-2">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              English
            </span>
            <p className="text-xs text-slate-200 whitespace-pre-wrap break-words font-sans leading-relaxed line-clamp-6">
              {engText || <span className="text-slate-500 italic">No English text</span>}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex justify-end">
            <button
              type="button"
              onClick={() => handleCopy('english', engText, 'English')}
              disabled={!engText}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition-all cursor-pointer disabled:opacity-40 ${
                copiedType === 'english'
                  ? 'bg-emerald-950/90 border-emerald-600 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {copiedType === 'english' ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span>Copied ✓</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy English</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Column 2: Regional Language */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-lg p-3 flex flex-col justify-between space-y-2">
          <div>
            <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block mb-1">
              {regLang}
            </span>
            <p className="text-xs text-slate-200 whitespace-pre-wrap break-words font-sans leading-relaxed line-clamp-6">
              {regText || <span className="text-slate-500 italic">No {regLang} text</span>}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex justify-end">
            <button
              type="button"
              onClick={() => handleCopy('regional', regText, regLang)}
              disabled={!regText}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition-all cursor-pointer disabled:opacity-40 ${
                copiedType === 'regional'
                  ? 'bg-emerald-950/90 border-emerald-600 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {copiedType === 'regional' ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span>Copied ✓</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy {regLang}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Column 3: Regional Transliteration */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-lg p-3 flex flex-col justify-between space-y-2">
          <div>
            <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block mb-1">
              {regLang} (Transliteration)
            </span>
            <p className="text-xs text-slate-200 whitespace-pre-wrap break-words font-sans leading-relaxed line-clamp-6">
              {translitText || <span className="text-slate-500 italic">No transliteration text</span>}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex justify-end">
            <button
              type="button"
              onClick={() => handleCopy('translit', translitText, `${regLang} Transliteration`)}
              disabled={!translitText}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition-all cursor-pointer disabled:opacity-40 ${
                copiedType === 'translit'
                  ? 'bg-emerald-950/90 border-emerald-600 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {copiedType === 'translit' ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span>Copied ✓</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy Transliteration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
