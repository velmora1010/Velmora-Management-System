import React, { useState } from 'react';
import { useCampaigns } from '../../hooks/marketing/useCampaigns';
import type { Campaign } from '../../types';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditCampaignModalProps {
  campaign: Campaign;
  onSuccess: (campaign: Campaign) => void;
  onClose: () => void;
}

const LANGUAGES = [
  "Tamil", "English", "Hindi", "Telugu", "Kannada", 
  "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Other"
];

export const EditCampaignModal: React.FC<EditCampaignModalProps> = ({ campaign, onSuccess, onClose }) => {
  const { updateCampaign } = useCampaigns();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Parse target_languages correctly
  let parsedLanguages: string[] = [];
  try {
    if (typeof campaign.target_languages === 'string') {
      const parsed = JSON.parse(campaign.target_languages);
      if (Array.isArray(parsed)) {
        parsedLanguages = parsed;
      } else {
        parsedLanguages = [campaign.target_languages];
      }
    } else if (Array.isArray(campaign.target_languages)) {
      parsedLanguages = campaign.target_languages;
    }
  } catch (e) {
    if (typeof campaign.target_languages === 'string') {
      parsedLanguages = [campaign.target_languages];
    }
  }

  const [formData, setFormData] = useState({
    campaign_name: campaign.campaign_name || '',
    campaign_type: campaign.campaign_type || '',
    total_budget: campaign.total_budget?.toString() || '',
    expected_influencers: campaign.expected_influencers?.toString() || '',
    expected_videos: campaign.expected_total_videos?.toString() || '',
    avg_video_cost: campaign.avg_per_video_cost?.toString() || '',
    target_languages: parsedLanguages,
    campaign_goal: campaign.campaign_goal || '',
    start_date: campaign.start_date || '',
    end_date: campaign.end_date || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLanguageChange = (lang: string) => {
    setFormData(prev => ({
      ...prev,
      target_languages: prev.target_languages.includes(lang)
        ? prev.target_languages.filter(l => l !== lang)
        : [...prev.target_languages, lang]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.campaign_name || !formData.campaign_type || !formData.start_date || !formData.end_date) {
      toast.error("Please fill all required fields.");
      return;
    }
    
    if (formData.target_languages.length === 0) {
      toast.error("Please select at least one target language.");
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      toast.error("End Date cannot be before Start Date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        campaign_name: formData.campaign_name,
        campaign_type: formData.campaign_type,
        total_budget: parseFloat(formData.total_budget) || 0,
        expected_influencers: parseInt(formData.expected_influencers) || 0,
        expected_total_videos: parseInt(formData.expected_videos) || 0,
        avg_per_video_cost: parseFloat(formData.avg_video_cost) || 0,
        target_languages: JSON.stringify(formData.target_languages),
        campaign_goal: formData.campaign_goal,
        start_date: formData.start_date,
        end_date: formData.end_date,
      };

      const result = await updateCampaign(campaign.id, payload);
      
      if (result && result.length > 0) {
        onSuccess(result[0] as Campaign);
      } else {
        onClose(); 
      }
    } catch (err) {
      console.error('Failed to update campaign:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#1e2536] rounded-xl border border-slate-700 shadow-2xl w-full max-w-4xl my-auto animate-fade-in relative">
        <div className="sticky top-0 bg-[#1e2536] z-10 flex items-center justify-between p-6 border-b border-slate-700/50 rounded-t-xl">
          <h2 className="text-xl font-bold text-slate-100">Edit Campaign</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          
          {/* Section 1: Basic Information */}
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/30">
            <h3 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-700/30">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Campaign Name *</label>
                <input type="text" name="campaign_name" value={formData.campaign_name} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Campaign Type *</label>
                <select name="campaign_type" value={formData.campaign_type} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" required>
                  <option value="">Select Type</option>
                  <option value="Product Launch">Product Launch</option>
                  <option value="Brand Awareness">Brand Awareness</option>
                  <option value="Conversion">Conversion</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Budget & Planning */}
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/30">
            <h3 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-700/30">Budget & Planning</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Total Budget</label>
                <input type="number" min="0" step="any" name="total_budget" value={formData.total_budget} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Expected No. of Influencers</label>
                <input type="number" min="0" name="expected_influencers" value={formData.expected_influencers} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Expected Total Videos</label>
                <input type="number" min="0" name="expected_videos" value={formData.expected_videos} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Avg Per Video Cost</label>
                <input type="number" min="0" step="any" name="avg_video_cost" value={formData.avg_video_cost} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Section 3: Target Language */}
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/30">
            <h3 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-700/30">Target Language *</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {LANGUAGES.map(lang => (
                <label key={lang} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.target_languages.includes(lang)}
                    onChange={() => handleLanguageChange(lang)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500 focus:ring-offset-slate-900" 
                  />
                  <span className="text-sm text-slate-300">{lang}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 4: Campaign Details */}
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/30">
            <h3 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-700/30">Campaign Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Start Date *</label>
                <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">End Date *</label>
                <input type="date" name="end_date" value={formData.end_date} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" required />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Campaign Goal / Brief</label>
              <textarea name="campaign_goal" value={formData.campaign_goal} onChange={handleChange} rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 pb-2 sticky bottom-0 bg-[#1e2536] border-t border-slate-700/50 mt-8 pt-4 z-10">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
