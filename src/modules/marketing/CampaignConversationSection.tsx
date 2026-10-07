import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  ArrowLeft, 
  Plus, 
  Loader2, 
  Search, 
  RefreshCw,
  AlertCircle 
} from 'lucide-react';
import type { Campaign, InfluencerConversation } from '../../types';
import { 
  fetchInfluencerConversations, 
  deleteInfluencerConversation 
} from '../../services/influencerConversationService';
import { CampaignConversationModal } from './CampaignConversationModal';
import { CampaignConversationCard } from './CampaignConversationCard';
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
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [conversationToEdit, setConversationToEdit] = useState<InfluencerConversation | null>(null);

  // Delete modal state
  const [conversationToDelete, setConversationToDelete] = useState<InfluencerConversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch conversations
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchInfluencerConversations(campaign.id);
      setConversations(data);
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      toast.error('Failed to load conversations.');
    } finally {
      setIsLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setConversationToEdit(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (conv: InfluencerConversation) => {
    setConversationToEdit(conv);
    setIsModalOpen(true);
  };

  // Success handler for create / edit
  const handleModalSuccess = (saved: InfluencerConversation) => {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
  };

  // Delete action
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

  // Filter conversations by search if user types
  const filteredConversations = conversations.filter(c => {
    if (!searchQuery.trim()) return true;
    return (c.conversation || '').toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  return (
    <div className="w-full space-y-5 animate-fade-in text-slate-200">
      {/* Top Header Bar */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
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
              {campaign.campaign_name}
            </p>
          </div>
        </div>

        {/* Right Action: Create Conversation */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadConversations}
            disabled={isLoading}
            className="p-2 bg-[#070c18] border border-slate-700/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            title="Refresh conversations"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-950/40 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Conversation</span>
          </button>
        </div>
      </div>

      {/* Search Bar (if conversations exist) */}
      {conversations.length > 0 && (
        <div className="flex items-center justify-between gap-4 bg-[#0b1329] border border-slate-800 p-3 rounded-2xl shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversation text..."
              className="w-full bg-[#070c18] border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="text-xs font-semibold text-slate-400 px-2 whitespace-nowrap">
            {filteredConversations.length} {filteredConversations.length === 1 ? 'conversation' : 'conversations'}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-[#0b1329] border border-slate-800 rounded-2xl">
          <Loader2 size={32} className="animate-spin text-purple-400 mb-3" />
          <p className="text-xs text-slate-400">Loading influencer conversations...</p>
        </div>
      ) : conversations.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 px-4 bg-[#0b1329] border border-dashed border-slate-800 rounded-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 shadow-sm">
            <MessageSquare size={28} />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1">
            No conversations yet
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            Start by saving your first influencer conversation. Paste notes, emails, WhatsApp or chat messages here.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold transition-all shadow-md shadow-purple-950/40 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Conversation</span>
          </button>
        </div>
      ) : filteredConversations.length === 0 ? (
        /* No Search Matches */
        <div className="flex flex-col items-center justify-center py-16 bg-[#0b1329] border border-slate-800 rounded-2xl text-center">
          <AlertCircle size={28} className="text-slate-500 mb-2" />
          <p className="text-sm font-semibold text-slate-300">No conversations match your search</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search terms</p>
        </div>
      ) : (
        /* Cards Grid (Newest First) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredConversations.map((conv) => (
            <CampaignConversationCard
              key={conv.id}
              conversation={conv}
              onEdit={handleOpenEdit}
              onDelete={(c) => setConversationToDelete(c)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <CampaignConversationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaignId={campaign.id}
        conversationToEdit={conversationToEdit}
        onSuccess={handleModalSuccess}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(conversationToDelete)}
        title="Delete Conversation"
        message="Are you sure you want to delete this influencer conversation? This action cannot be undone."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConversationToDelete(null)}
      />
    </div>
  );
};
