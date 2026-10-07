import React, { useState } from 'react';
import { MessageSquare, Edit2, Trash2, Clock, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { InfluencerConversation } from '../../types';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const text = conversation.conversation || '';
  const isLong = text.length > 350 || text.split('\n').length > 6;

  // Format saved date time: e.g. "07 Oct 2026, 11:30 AM"
  const formattedDate = (() => {
    try {
      const d = new Date(conversation.created_at || conversation.updated_at || Date.now());
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Recently';
    }
  })();

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success('Conversation copied to clipboard');
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="group relative bg-[#0b1329] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all duration-200 shadow-sm flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <MessageSquare size={15} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-200 tracking-tight">
              Influencer Conversation
            </h4>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Copy conversation"
          >
            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={() => onEdit(conversation)}
            className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 rounded-lg transition-colors cursor-pointer"
            title="Edit conversation"
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(conversation)}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
            title="Delete conversation"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Main Conversation Body */}
      <div className="relative my-1">
        <div 
          className={`text-slate-300 text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words font-sans transition-all ${
            !isExpanded && isLong ? 'max-h-[160px] overflow-hidden' : ''
          }`}
        >
          {text}
        </div>

        {/* Fading gradient when collapsed */}
        {!isExpanded && isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-[#0b1329] to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand / Collapse toggle */}
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="self-start text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-1 mb-2 transition-colors cursor-pointer"
        >
          {isExpanded ? (
            <>
              <span>Collapse</span>
              <ChevronUp size={12} />
            </>
          ) : (
            <>
              <span>Expand conversation</span>
              <ChevronDown size={12} />
            </>
          )}
        </button>
      )}

      {/* Footer Timestamp */}
      <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Clock size={12} />
          <span>Saved: {formattedDate}</span>
        </div>
      </div>
    </div>
  );
};
