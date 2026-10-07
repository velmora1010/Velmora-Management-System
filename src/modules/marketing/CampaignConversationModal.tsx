import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Loader2, Save } from 'lucide-react';
import type { InfluencerConversation } from '../../types';
import { 
  createInfluencerConversation, 
  updateInfluencerConversation 
} from '../../services/influencerConversationService';
import toast from 'react-hot-toast';

interface CampaignConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string | number;
  conversationToEdit?: InfluencerConversation | null;
  onSuccess: (savedConversation: InfluencerConversation) => void;
}

export const CampaignConversationModal: React.FC<CampaignConversationModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  conversationToEdit,
  onSuccess
}) => {
  const [conversationText, setConversationText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (conversationToEdit) {
        setConversationText(conversationToEdit.conversation || '');
      } else {
        setConversationText('');
      }
    }
  }, [isOpen, conversationToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = conversationText.trim();
    if (!trimmed) {
      toast.error('Please enter conversation text.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (conversationToEdit?.id) {
        const updated = await updateInfluencerConversation(
          conversationToEdit.id,
          trimmed,
          campaignId
        );
        toast.success('Conversation updated successfully');
        onSuccess(updated);
      } else {
        const created = await createInfluencerConversation({
          campaign_id: campaignId,
          conversation: trimmed
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-[#0b1329] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#070c18]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-xs">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {conversationToEdit ? 'Edit Conversation' : 'Create Conversation'}
              </h3>
              <p className="text-xs text-slate-400">
                Store conversation notes and chat history with influencers
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Influencer Conversation <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={10}
              value={conversationText}
              onChange={(e) => setConversationText(e.target.value)}
              placeholder="Paste influencer conversation here..."
              disabled={isSubmitting}
              autoFocus
              className="w-full bg-[#070c18] border border-slate-700/80 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-xl p-4 text-sm text-slate-100 placeholder:text-slate-500 transition-all outline-none resize-y min-h-[200px] leading-relaxed custom-scrollbar font-sans"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80 mt-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !conversationText.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/40 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
