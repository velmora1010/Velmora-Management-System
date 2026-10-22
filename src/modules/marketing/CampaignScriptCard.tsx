import React, { useState, useMemo } from 'react';
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
  Play, 
  Pause, 
  Volume2, 
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
  getScriptVideoUrl, 
  parseScriptContent 
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

  // Parse multi-product structured data
  const parsed = useMemo(() => parseScriptContent(script), [script]);
  const [activeProductId, setActiveProductId] = useState<string>(parsed.productIds[0] || '');

  // Keep activeProductId valid if script changes
  React.useEffect(() => {
    if (!parsed.productIds.includes(activeProductId)) {
      setActiveProductId(parsed.productIds[0] || '');
    }
  }, [parsed, activeProductId]);

  const activeContent = useMemo(() => {
    if (parsed.isMultiProduct && activeProductId && parsed.productScripts[activeProductId]) {
      return parsed.productScripts[activeProductId];
    }
    return {
      product_id: parsed.productIds[0] || '',
      product_name: script.product,
      model_script: script.model_script || '',
      key_points: script.key_points || ''
    };
  }, [parsed, activeProductId, script]);

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
    const textToCopy = activeContent.model_script || '';
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
    const textToCopy = activeContent.key_points || '';
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

  const currentScriptText = activeContent.model_script || '';
  const currentKeyPointsText = activeContent.key_points || '';
  const isScriptLong = currentScriptText.length > 220;
  const isKeyPointsLong = currentKeyPointsText.length > 180;

  return (
    <>
      <div className="bg-[#0b1329] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md relative group">
        <div>
          {/* Header Row: Product Title, Language, Actions Menu */}
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

          {/* Multi-Product Selector Pills (if script has multiple products) */}
          {parsed.isMultiProduct && (
            <div className="mb-3.5 p-2 rounded-xl bg-[#070c18] border border-slate-800/80">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
                <Layers size={11} className="text-purple-400" />
                <span>Product Scripts ({parsed.productIds.length}):</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {parsed.productIds.map(pid => {
                  const isCurrent = activeProductId === pid;
                  const name = parsed.productScripts[pid]?.product_name || pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => {
                        setActiveProductId(pid);
                        setIsExpandedScript(false);
                        setIsExpandedKeyPoints(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                        isCurrent
                          ? 'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-900/30'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Model Script Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={12} className="text-purple-400" />
                <span>Model Script {parsed.isMultiProduct ? `(${activeContent.product_name})` : ''}</span>
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
                {currentScriptText || <span className="text-slate-600 italic">No model script provided</span>}
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
                <span>Key Points {parsed.isMultiProduct ? `(${activeContent.product_name})` : ''}</span>
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
            <div className="bg-[#070c18] border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 leading-relaxed relative">
              <p className={!isExpandedKeyPoints && isKeyPointsLong ? 'line-clamp-3 whitespace-pre-line' : 'whitespace-pre-line'}>
                {currentKeyPointsText || <span className="text-slate-600 italic">No key points provided</span>}
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

        {/* Reference Media Row */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Audio Reference */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px] flex items-center gap-1">
              <Music size={12} />
              <span>Reference Audio:</span>
            </span>
            {hasAudioFile && audioStorageUrl ? (
              <button
                type="button"
                onClick={() => setActiveMediaModal({
                  type: 'audio',
                  url: audioStorageUrl,
                  title: `${script.product} - Reference Audio`
                })}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-medium transition-colors cursor-pointer"
              >
                <Play size={10} />
                <span>Play Audio</span>
              </button>
            ) : hasAudioLink ? (
              <a
                href={script.reference_audio_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
              >
                <ExternalLink size={10} />
                <span>Audio Link</span>
              </a>
            ) : (
              <span className="text-slate-600 italic text-[11px]">No reference audio</span>
            )}
          </div>

          {/* Video Reference */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px] flex items-center gap-1">
              <Video size={12} />
              <span>Reference Video:</span>
            </span>
            {hasVideoFile && videoStorageUrl ? (
              <button
                type="button"
                onClick={() => setActiveMediaModal({
                  type: 'video',
                  url: videoStorageUrl,
                  title: `${script.product} - Reference Video`
                })}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium transition-colors cursor-pointer"
              >
                <Eye size={10} />
                <span>Watch Video</span>
              </button>
            ) : hasVideoLink ? (
              <a
                href={script.reference_video_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
              >
                <ExternalLink size={10} />
                <span>Video Link</span>
              </a>
            ) : (
              <span className="text-slate-600 italic text-[11px]">No reference video</span>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Delete Script?</h4>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete the script for <span className="text-white font-semibold">{script.product}</span> ({script.language})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete(script);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer shadow-md shadow-red-950/40"
              >
                Delete Script
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Player Modal */}
      {activeMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {activeMediaModal.type === 'audio' ? (
                  <Volume2 size={16} className="text-purple-400" />
                ) : (
                  <Video size={16} className="text-purple-400" />
                )}
                <h4 className="text-sm font-bold text-white truncate max-w-[340px]">
                  {activeMediaModal.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveMediaModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex justify-center p-2">
              {activeMediaModal.type === 'audio' ? (
                <audio controls autoPlay className="w-full">
                  <source src={activeMediaModal.url} />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <video controls autoPlay className="w-full max-h-80 rounded-xl bg-black">
                  <source src={activeMediaModal.url} />
                  Your browser does not support the video element.
                </video>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
