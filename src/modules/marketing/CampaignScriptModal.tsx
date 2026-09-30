import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Music, Video, Link, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import type { Campaign, CampaignScript } from '../../types';
import { 
  SCRIPT_PRODUCTS, 
  createCampaignScript, 
  updateCampaignScript 
} from '../../services/campaignScriptService';
import toast from 'react-hot-toast';

interface CampaignScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  scriptToEdit?: CampaignScript | null;
  onSuccess: (savedScript: CampaignScript) => void;
}

const DEFAULT_LANGUAGES = [
  "Tamil", "English", "Hindi", "Telugu", "Kannada", 
  "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Magahi", "Other"
];

export const CampaignScriptModal: React.FC<CampaignScriptModalProps> = ({
  isOpen,
  onClose,
  campaign,
  scriptToEdit,
  onSuccess
}) => {
  // Form state
  const [product, setProduct] = useState('');
  const [language, setLanguage] = useState('');
  const [modelScript, setModelScript] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // File states
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [removeExistingAudio, setRemoveExistingAudio] = useState(false);
  const [removeExistingVideo, setRemoveExistingVideo] = useState(false);

  // Validation & UI states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Available languages: merge campaign target_languages with default languages
  const availableLanguages = React.useMemo(() => {
    let campaignLangs: string[] = [];
    if (typeof campaign.target_languages === 'string') {
      try {
        const parsed = JSON.parse(campaign.target_languages);
        campaignLangs = Array.isArray(parsed) ? parsed : [campaign.target_languages];
      } catch {
        campaignLangs = [campaign.target_languages];
      }
    } else if (Array.isArray(campaign.target_languages)) {
      campaignLangs = campaign.target_languages;
    }

    const set = new Set<string>();
    campaignLangs.filter(Boolean).forEach(l => set.add(l.trim()));
    DEFAULT_LANGUAGES.forEach(l => set.add(l.trim()));
    return Array.from(set);
  }, [campaign.target_languages]);

  // Reset or populate form on open / scriptToEdit change
  useEffect(() => {
    if (!isOpen) return;

    if (scriptToEdit) {
      setProduct(scriptToEdit.product || '');
      setLanguage(scriptToEdit.language || '');
      setModelScript(scriptToEdit.model_script || '');
      setKeyPoints(scriptToEdit.key_points || '');
      setAudioUrl(scriptToEdit.reference_audio_url || '');
      setVideoUrl(scriptToEdit.reference_video_url || '');
    } else {
      setProduct('');
      // Default to first target language of campaign if available
      setLanguage(availableLanguages[0] || '');
      setModelScript('');
      setKeyPoints('');
      setAudioUrl('');
      setVideoUrl('');
    }

    setAudioFile(null);
    setVideoFile(null);
    setRemoveExistingAudio(false);
    setRemoveExistingVideo(false);
    setErrors({});
    setSubmitError(null);
  }, [isOpen, scriptToEdit, availableLanguages]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!product.trim()) {
      newErrors.product = 'Title (Product) is required';
    }
    if (!language.trim()) {
      newErrors.language = 'Language is required';
    }
    if (!modelScript.trim()) {
      newErrors.modelScript = 'Model Script is required';
    }
    if (!keyPoints.trim()) {
      newErrors.keyPoints = 'Key Points are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (scriptToEdit) {
        // Edit existing script
        const updated = await updateCampaignScript({
          id: scriptToEdit.id,
          campaign_id: String(campaign.id),
          product,
          language,
          model_script: modelScript,
          key_points: keyPoints,
          reference_audio_url: audioUrl,
          reference_video_url: videoUrl,
          audioFile,
          videoFile,
          existingAudioFilePath: scriptToEdit.reference_audio_file_path,
          existingVideoFilePath: scriptToEdit.reference_video_file_path,
          removeAudioFile: removeExistingAudio,
          removeVideoFile: removeExistingVideo
        });
        toast.success('Script updated successfully');
        onSuccess(updated);
        onClose();
      } else {
        // Create new script
        const created = await createCampaignScript({
          campaign_id: String(campaign.id),
          product,
          language,
          model_script: modelScript,
          key_points: keyPoints,
          reference_audio_url: audioUrl,
          reference_video_url: videoUrl,
          audioFile,
          videoFile
        });
        toast.success('Script created successfully');
        onSuccess(created);
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to save script:', err);
      const msg = err?.message || 'Failed to save script. Please try again.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasExistingAudio = !!scriptToEdit?.reference_audio_file_path && !removeExistingAudio;
  const hasExistingVideo = !!scriptToEdit?.reference_video_file_path && !removeExistingVideo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#0b1329] rounded-t-2xl">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {scriptToEdit ? 'Edit Script' : 'Create Script'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Campaign: <span className="text-purple-300 font-medium">{campaign.campaign_name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-slate-200">
          {submitError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300 text-xs">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Row 1: Product & Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title (Product) Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Title (Product) <span className="text-purple-400">*</span>
              </label>
              <select
                value={product}
                onChange={(e) => {
                  setProduct(e.target.value);
                  if (errors.product) setErrors(prev => ({ ...prev, product: '' }));
                }}
                className={`w-full bg-slate-900 border ${
                  errors.product ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors`}
              >
                <option value="" disabled>Select Product</option>
                {SCRIPT_PRODUCTS.map((prod) => (
                  <option key={prod} value={prod}>
                    {prod}
                  </option>
                ))}
              </select>
              {errors.product && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.product}
                </p>
              )}
            </div>

            {/* Language Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Language <span className="text-purple-400">*</span>
              </label>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  if (errors.language) setErrors(prev => ({ ...prev, language: '' }));
                }}
                className={`w-full bg-slate-900 border ${
                  errors.language ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors`}
              >
                <option value="" disabled>Select Language</option>
                {availableLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              {errors.language && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.language}
                </p>
              )}
            </div>
          </div>

          {/* Model Script (Large Textarea) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Model Script <span className="text-purple-400">*</span>
            </label>
            <textarea
              rows={4}
              value={modelScript}
              onChange={(e) => {
                setModelScript(e.target.value);
                if (errors.modelScript) setErrors(prev => ({ ...prev, modelScript: '' }));
              }}
              placeholder="Enter the full dialogue, creator script lines, hook, and call to action..."
              className={`w-full bg-slate-900 border ${
                errors.modelScript ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              } rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors`}
            />
            {errors.modelScript && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.modelScript}
              </p>
            )}
          </div>

          {/* Key Points (Large Textarea) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Key Points <span className="text-purple-400">*</span>
            </label>
            <textarea
              rows={3}
              value={keyPoints}
              onChange={(e) => {
                setKeyPoints(e.target.value);
                if (errors.keyPoints) setErrors(prev => ({ ...prev, keyPoints: '' }));
              }}
              placeholder="• Mention natural foam&#10;• Highlight non-toxic ingredients&#10;• Include 20% discount code at end..."
              className={`w-full bg-slate-900 border ${
                errors.keyPoints ? 'border-red-500' : 'border-slate-700/80 focus:border-purple-500'
              } rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors`}
            />
            {errors.keyPoints && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.keyPoints}
              </p>
            )}
          </div>

          {/* Reference Audio / Link (OPTIONAL) */}
          <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music size={16} className="text-purple-400" />
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Reference Audio / Link <span className="text-slate-500 text-[10px] font-normal lowercase">(optional)</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Upload Audio */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Upload Audio
                </label>
                <input
                  type="file"
                  ref={audioInputRef}
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setAudioFile(file);
                    if (file) setRemoveExistingAudio(false);
                  }}
                  className="hidden"
                />

                {audioFile ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-purple-500/40 text-xs">
                    <span className="text-purple-300 font-medium truncate max-w-[180px]">
                      {audioFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAudioFile(null);
                        if (audioInputRef.current) audioInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-red-400 p-1"
                      title="Remove file"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : hasExistingAudio ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs">
                    <span className="text-slate-300 font-medium truncate max-w-[180px]">
                      Current Audio File
                    </span>
                    <button
                      type="button"
                      onClick={() => setRemoveExistingAudio(true)}
                      className="text-slate-400 hover:text-red-400 p-1"
                      title="Remove existing file"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-700 hover:border-purple-500/80 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-purple-300 text-xs transition-colors cursor-pointer"
                  >
                    <Upload size={14} />
                    <span>Upload Audio</span>
                  </button>
                )}
              </div>

              {/* Audio Link */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Audio Link
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Link size={13} />
                  </div>
                  <input
                    type="url"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full bg-slate-900 border border-slate-700/80 focus:border-purple-500 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Reference Video / Link (OPTIONAL) */}
          <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video size={16} className="text-purple-400" />
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Reference Video / Link <span className="text-slate-500 text-[10px] font-normal lowercase">(optional)</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Upload Video */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Upload Video
                </label>
                <input
                  type="file"
                  ref={videoInputRef}
                  accept="video/*,.mp4,.mov,.webm"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setVideoFile(file);
                    if (file) setRemoveExistingVideo(false);
                  }}
                  className="hidden"
                />

                {videoFile ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-purple-500/40 text-xs">
                    <span className="text-purple-300 font-medium truncate max-w-[180px]">
                      {videoFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setVideoFile(null);
                        if (videoInputRef.current) videoInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-red-400 p-1"
                      title="Remove file"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : hasExistingVideo ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs">
                    <span className="text-slate-300 font-medium truncate max-w-[180px]">
                      Current Video File
                    </span>
                    <button
                      type="button"
                      onClick={() => setRemoveExistingVideo(true)}
                      className="text-slate-400 hover:text-red-400 p-1"
                      title="Remove existing file"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-700 hover:border-purple-500/80 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-purple-300 text-xs transition-colors cursor-pointer"
                  >
                    <Upload size={14} />
                    <span>Upload Video</span>
                  </button>
                )}
              </div>

              {/* Video Link */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Video Link
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Link size={13} />
                  </div>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/... or Instagram link"
                    className="w-full bg-slate-900 border border-slate-700/80 focus:border-purple-500 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 transition-all shadow-md shadow-purple-900/20 flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{scriptToEdit ? 'Updating Script...' : 'Creating Script...'}</span>
                </>
              ) : (
                <span>{scriptToEdit ? 'Update Script' : 'Create Script'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
