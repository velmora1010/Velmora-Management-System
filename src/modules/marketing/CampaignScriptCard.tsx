import React, { useState } from 'react';
import { 
  FileText, 
  Music, 
  Video, 
  ExternalLink, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  X, 
  AlertTriangle, 
  Copy, 
  Check, 
  Layers 
} from 'lucide-react';
import type { CampaignScript } from '../../types';
import { 
  getScriptAudioUrl, 
  getScriptVideoUrl 
} from '../../services/campaignScriptService';

interface CampaignScriptCardProps {
  script: CampaignScript;
  campaignName?: string;
  onEdit: (script: CampaignScript) => void;
  onDelete: (script: CampaignScript) => void;
}

export const CampaignScriptCard: React.FC<CampaignScriptCardProps> = ({
  script,
  campaignName,
  onEdit,
  onDelete
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isExpandedScript, setIsExpandedScript] = useState(false);
  const [isExpandedKeyPoints, setIsExpandedKeyPoints] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Copy to clipboard states
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedKeyPoints, setCopiedKeyPoints] = useState(false);
  const scriptTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const keyPointsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (scriptTimeoutRef.current) clearTimeout(scriptTimeoutRef.current);
      if (keyPointsTimeoutRef.current) clearTimeout(keyPointsTimeoutRef.current);
    };
  }, []);

  const handleCopyScript = async () => {
    const textToCopy = script.model_script || '';
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedScript(true);
      if (scriptTimeoutRef.current) clearTimeout(scriptTimeoutRef.current);
      scriptTimeoutRef.current = setTimeout(() => {
        setCopiedScript(false);
      }, 1800);
    } catch (err) {
      console.error('Failed to copy model script to clipboard:', err);
    }
  };

  const handleCopyKeyPoints = async () => {
    const textToCopy = script.key_points || '';
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKeyPoints(true);
      if (keyPointsTimeoutRef.current) clearTimeout(keyPointsTimeoutRef.current);
      keyPointsTimeoutRef.current = setTimeout(() => {
        setCopiedKeyPoints(false);
      }, 1800);
    } catch (err) {
      console.error('Failed to copy key points to clipboard:', err);
    }
  };

  // Media preview modal states
  const [activeMediaModal, setActiveMediaModal] = useState<{
    type: 'audio' | 'video';
    url: string;
    title: string;
  } | null>(null);

  const audioStorageUrl = script.reference_audio_file_path 
    ? getScriptAudioUrl(script.reference_audio_file_path)
    : null;

  const videoStorageUrl = script.reference_video_file_path 
    ? getScriptVideoUrl(script.reference_video_file_path)
    : null;

  const hasAudioFile = !!script.reference_audio_file_path;
  const hasAudioLink = !!script.reference_audio_url;
  const hasVideoFile = !!script.reference_video_file_path;
  const hasVideoLink = !!script.reference_video_url;

  const scriptText = script.model_script || '';
  const keyPointsText = script.key_points || '';
  const isScriptLong = scriptText.length > 220;
  const isKeyPointsLong = keyPointsText.length > 180;

  return (
    <>
      <div className="bg-[#0b1329] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md relative group">
        <div>
          {/* Header Row: Combined Product Title, Language, Campaign Badge, Actions Menu */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span 
                className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 tracking-wide break-words max-w-full"
                title={script.product}
              >
                {script.product}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                {script.language}
              </span>
              {campaignName && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 shrink-0" title={`Campaign: ${campaignName}`}>
                  <Layers size={11} className="text-indigo-400 shrink-0" />
                  <span className="truncate max-w-[130px]">{campaignName}</span>
                </span>
              )}
            </div>

            {/* Actions Menu */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowMenu(prev => !prev)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Options"
              >
                <MoreVertical size={16} />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-8 z-30 w-36 bg-[#0f172a] border border-slate-700 rounded-xl shadow-xl py-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onEdit(script);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-200 hover:bg-slate-800 hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <Edit3 size={14} className="text-purple-400" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-red-400 hover:bg-red-500/10 text-left transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Model Script Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={12} className="text-purple-400" />
                <span>Model Script</span>
              </div>
              <button
                type="button"
                onClick={handleCopyScript}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all duration-150 cursor-pointer ${
                  copiedScript
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={copiedScript ? 'Copied to clipboard' : 'Copy Model Script'}
              >
                {copiedScript ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span className="text-[10px]">Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-[#070c18] border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 leading-relaxed relative">
              <p className={!isExpandedScript && isScriptLong ? 'line-clamp-4 whitespace-pre-line' : 'whitespace-pre-line'}>
                {scriptText || <span className="text-slate-600 italic">No model script provided</span>}
              </p>
              {isScriptLong && (
                <button
                  type="button"
                  onClick={() => setIsExpandedScript(!isExpandedScript)}
                  className="mt-2 text-purple-400 hover:text-purple-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{isExpandedScript ? 'View Less' : 'View More'}</span>
                  {isExpandedScript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </div>
          </div>

          {/* Key Points Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={12} className="text-purple-400" />
                <span>Key Points</span>
              </div>
              <button
                type="button"
                onClick={handleCopyKeyPoints}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all duration-150 cursor-pointer ${
                  copiedKeyPoints
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={copiedKeyPoints ? 'Copied to clipboard' : 'Copy Key Points'}
              >
                {copiedKeyPoints ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span className="text-[10px]">Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-[#070c18] border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 leading-relaxed">
              <p className={!isExpandedKeyPoints && isKeyPointsLong ? 'line-clamp-3 whitespace-pre-line' : 'whitespace-pre-line'}>
                {keyPointsText || <span className="text-slate-600 italic">No key points provided</span>}
              </p>
              {isKeyPointsLong && (
                <button
                  type="button"
                  onClick={() => setIsExpandedKeyPoints(!isExpandedKeyPoints)}
                  className="mt-2 text-purple-400 hover:text-purple-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{isExpandedKeyPoints ? 'View Less' : 'View More'}</span>
                  {isExpandedKeyPoints ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer: Reference Media Actions */}
        {(hasAudioFile || hasAudioLink || hasVideoFile || hasVideoLink) && (
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
            {/* Audio: Storage File Preview */}
            {hasAudioFile && audioStorageUrl && (
              <button
                type="button"
                onClick={() => setActiveMediaModal({
                  type: 'audio',
                  url: audioStorageUrl,
                  title: `${script.product} - Reference Audio`
                })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 transition-colors cursor-pointer"
              >
                <Music size={13} />
                <span>Play Audio</span>
              </button>
            )}

            {/* Audio: External Link */}
            {hasAudioLink && script.reference_audio_url && (
              <a
                href={script.reference_audio_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              >
                <ExternalLink size={12} />
                <span>Audio Link</span>
              </a>
            )}

            {/* Video: Storage File Preview */}
            {hasVideoFile && videoStorageUrl && (
              <button
                type="button"
                onClick={() => setActiveMediaModal({
                  type: 'video',
                  url: videoStorageUrl,
                  title: `${script.product} - Reference Video`
                })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors cursor-pointer"
              >
                <Video size={13} />
                <span>Watch Video</span>
              </button>
            )}

            {/* Video: External Link */}
            {hasVideoLink && script.reference_video_url && (
              <a
                href={script.reference_video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              >
                <ExternalLink size={12} />
                <span>Video Link</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete Script?</h4>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 mb-4 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              Are you sure you want to delete the script for <span className="font-semibold text-white">{script.product}</span> ({script.language})?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete(script);
                }}
                className="px-3.5 py-2 text-xs font-bold rounded-xl text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
              >
                Delete Script
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Player Modal */}
      {activeMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-[#0b1329]">
              <div className="flex items-center gap-2">
                {activeMediaModal.type === 'audio' ? (
                  <Music size={16} className="text-purple-400" />
                ) : (
                  <Video size={16} className="text-purple-400" />
                )}
                <span className="text-xs font-bold text-white truncate max-w-[300px]">
                  {activeMediaModal.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveMediaModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 bg-[#070c18] flex items-center justify-center">
              {activeMediaModal.type === 'audio' ? (
                <audio
                  controls
                  autoPlay
                  src={activeMediaModal.url}
                  className="w-full"
                >
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <video
                  controls
                  autoPlay
                  src={activeMediaModal.url}
                  className="w-full max-h-[60vh] rounded-lg"
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
