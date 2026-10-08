import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  MessageSquare, 
  ArrowLeft, 
  Plus, 
  Loader2
} from 'lucide-react';
import type { Campaign, InfluencerConversation } from '../../types';
import { 
  fetchInfluencerConversations, 
  deleteInfluencerConversation 
} from '../../services/influencerConversationService';
import { INFLUENCER_WORKFLOW_STEPS } from '../../utils/workflowStatusUtils';
import { CampaignConversationModal } from './CampaignConversationModal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

interface CampaignConversationSectionProps {
  campaign: Campaign;
  onBack: () => void;
}

export const CampaignConversationSection: React.FC<CampaignConversationSectionProps> = ({
  campaign,
  onBack
}) => {
  const [conversations, setConversations] = useState<InfluencerConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeStepKey, setActiveStepKey] = useState<string>('offer_agreement');
  const [activeStepLabel, setActiveStepLabel] = useState<string>('Offer Agreement');
  const [conversationToEdit, setConversationToEdit] = useState<InfluencerConversation | null>(null);

  // Delete state
  const [conversationToDelete, setConversationToDelete] = useState<InfluencerConversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load conversations
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchInfluencerConversations(campaign.id);
      setConversations(data);
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Open Add modal for a specific step
  const handleOpenAdd = (stepKey: string, stepLabel: string) => {
    setActiveStepKey(stepKey);
    setActiveStepLabel(stepLabel);
    setConversationToEdit(null);
    setIsModalOpen(true);
  };

  // Handle successful create / update
  const handleModalSuccess = (saved: InfluencerConversation) => {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!conversationToDelete) return;
    setIsDeleting(true);
    try {
      await deleteInfluencerConversation(conversationToDelete.id, campaign.id);
      toast.success('Conversation deleted successfully');
      setConversations(prev => prev.filter(c => c.id !== conversationToDelete.id));
      setConversationToDelete(null);
    } catch (err: any) {
      console.error('Error deleting conversation:', err);
      toast.error(err?.message || 'Failed to delete conversation');
    } finally {
      setIsDeleting(false);
    }
  };

  // Group conversations by workflow step for the modal
  const groupedConversations = useMemo(() => {
    const map = new Map<string, InfluencerConversation[]>();
    INFLUENCER_WORKFLOW_STEPS.forEach(s => map.set(s.key, []));

    conversations.forEach(c => {
      const key = (c.step_key || 'delivered').toLowerCase();
      const list = map.get(key) || [];
      list.push(c);
      map.set(key, list);
    });

    return map;
  }, [conversations]);

  return (
    <div className="w-full space-y-6 animate-fade-in text-slate-200">
      {/* 1. Clean Top Header Bar */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-[#070c18] hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            <ArrowLeft size={16} />
            <span>Back to Campaign</span>
          </button>
          <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <MessageSquare size={20} className="text-purple-400" />
              Influencer Conversation
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {campaign.campaign_name} • Step-specific reusable message library
            </p>
          </div>
        </div>
      </div>

      {/* 2. Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-[#0b1329] border border-slate-800 rounded-2xl">
          <Loader2 size={32} className="animate-spin text-purple-400 mb-3" />
          <p className="text-xs text-slate-400">Loading workflow step conversations...</p>
        </div>
      ) : (
        /* 3. Compact 4-Card Grid for All 10 Workflow Steps */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {INFLUENCER_WORKFLOW_STEPS.map((step) => (
            <div 
              key={step.key}
              className="bg-[#0b1329] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-[115px] sm:min-h-[125px] shadow-sm transition-all w-full"
            >
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {step.label}
              </h3>

              <div className="pt-3 flex items-center justify-start">
                <button
                  type="button"
                  onClick={() => handleOpenAdd(step.key, step.label)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/40 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Conversation</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Conversation Modal with Step-locked 3 Languages & Saved List */}
      <CampaignConversationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaignId={campaign.id}
        stepKey={activeStepKey}
        stepLabel={activeStepLabel}
        targetLanguages={campaign.target_languages}
        conversationToEdit={conversationToEdit}
        stepConversations={groupedConversations.get(activeStepKey) || []}
        onSuccess={handleModalSuccess}
        onDeleteConversation={(c) => setConversationToDelete(c)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(conversationToDelete)}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConversationToDelete(null)}
      />
    </div>
  );
};
