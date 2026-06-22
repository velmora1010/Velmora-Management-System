import React, { useState } from 'react';
import { useCampaigns } from '../../hooks/marketing/useCampaigns';
import type { Campaign } from '../../types';
import toast from 'react-hot-toast';

interface CampaignFormProps {
  onSuccess: (campaign: Campaign) => void;
  onCancel: () => void;
}

const LANGUAGES = [
  "Tamil", "English", "Hindi", "Telugu", "Kannada", 
  "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Other"
];

export const CampaignForm: React.FC<CampaignFormProps> = ({ onSuccess, onCancel }) => {
  const { addCampaign } = useCampaigns();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    campaign_name: '',
    campaign_type: '',
    total_budget: '',
    expected_influencers: '',
    expected_videos: '',
    avg_video_cost: '',
    target_languages: [] as string[],
    campaign_goal: '',
    start_date: '',
    end_date: ''
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
        status: 'active'
      };

      const result = await addCampaign(payload);
      
      if (result) {
        onSuccess(result as Campaign);
      } else {
        // Fallback if data is null/empty but no error was thrown
        onCancel(); // or onSuccess with a dummy if needed, but going back to overview is safer
      }
    } catch (err) {
      console.error('Failed to create campaign:', err);
      // Removed toast.error() which blocks the UI thread and can cause deadlocks
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
        <h2 className="text-xl font-semibold text-slate-200">Create Influencer Campaign</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Section 1: Basic Information */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
          <h3 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-800">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Campaign Name *</label>
              <input type="text" name="campaign_name" value={formData.campaign_name} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="Enter campaign name" required />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Campaign Type *</label>
              <select name="campaign_type" value={formData.campaign_type} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" required>
                <option value="">Select Type</option>
                <option value="Product Launch">Product Launch</option>
                <option value="Brand Awareness">Brand Awareness</option>
                <option value="Conversion">Conversion</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Budget & Planning */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
          <h3 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-800">Budget & Planning</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Total Budget</label>
              <input type="number" name="total_budget" value={formData.total_budget} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="₹0.00" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Expected No. of Influencers</label>
              <input type="number" name="expected_influencers" value={formData.expected_influencers} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Expected Total Videos</label>
              <input type="number" name="expected_videos" value={formData.expected_videos} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Avg Per Video Cost</label>
              <input type="number" name="avg_video_cost" value={formData.avg_video_cost} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="₹0.00" />
            </div>
          </div>
        </div>

        {/* Section 3: Target Language */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
          <h3 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-800">Target Language *</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {LANGUAGES.map(lang => (
              <label key={lang} className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.target_languages.includes(lang)}
                  onChange={() => handleLanguageChange(lang)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500 focus:ring-offset-slate-900" 
                />
                <span className="text-sm text-slate-300">{lang}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Section 4: Campaign Details */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
          <h3 className="text-lg font-medium text-slate-300 mb-4 pb-2 border-b border-slate-800">Campaign Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Start Date *</label>
              <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">End Date *</label>
              <input type="date" name="end_date" value={formData.end_date} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" required />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Campaign Goal / Brief</label>
            <textarea name="campaign_goal" value={formData.campaign_goal} onChange={handleChange} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="Describe the campaign objectives..." />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onCancel} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50">
            {isSubmitting ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
};
