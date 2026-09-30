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
  Play, 
  Pause, 
  Volume2, 
  Eye,
  X,
  AlertTriangle
} from 'lucide-react';
import type { CampaignScript } from '../../types';
import { getScriptAudioUrl, getScriptVideoUrl } from '../../services/campaignScriptService';

interface CampaignScriptCardProps {
  script: CampaignScript;
  onEdit: (script: CampaignScript) => void;
  onDelete: (script: CampaignScript) => void;
}

export const CampaignScriptCard: React.FC<CampaignScriptCardProps> = ({
  script,
  onEdit,
  onDelete
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isExpandedScript, setIsExpandedScript] = useState(false);
  const [isExpandedKeyPoints, setIsExpandedKeyPoints] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const isScriptLong = script.model_script.length > 220;
  const isKeyPointsLong = script.key_points.length > 180;

  return (
    <>
      <div className="bg-[#0b1329] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md relative group">
        <div>
          {/* Header Row: Product, Language, Actions Menu */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 tracking-wide">
                {script.product}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {script.language}
              </span>
            </div>

            {/* Actions Menu */}
            <div className="relative">
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
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText size={12} className="text-purple-400" />
              <span>Model Script</span>
            </div>
            <div className="bg-[#070c18] border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 leading-relaxed relative">
              <p className={!isExpandedScript && isScriptLong ? 'line-clamp-4 whitespace-pre-line' : 'whitespace-pre-line'}>
                {script.model_script}
              </p>
              {isScriptLong && (
                <button
                  type="button"
                  onClick={() => setIsExpandedScript(prev => !prev)}
                  className="mt-2 text-purple-400 hover:text-purple-300 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {isExpandedScript ? (
                    <>
                      <span>Show Less</span>
                      <ChevronUp size={12} />
                    </>
                  ) : (
                    <>
                      <span>View More</span>
                      <ChevronDown size={12} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Key Points Section */}
          <div className="mb-4">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Key Points
            </div>
            <div className="bg-[#070c18] border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 leading-relaxed relative">
              <p className={!isExpandedKeyPoints && isKeyPointsLong ? 'line-clamp-3 whitespace-pre-line' : 'whitespace-pre-line'}>
                {script.key_points}
              </p>
              {isKeyPointsLong && (
                <button
                  type="button"
                  onClick={() => setIsExpandedKeyPoints(prev => !prev)}
                  className="mt-2 text-purple-400 hover:text-purple-300 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {isExpandedKeyPoints ? (
                    <>
                      <span>Show Less</span>
                      <ChevronUp size={12} />
                    </>
                  ) : (
                    <>
                      <span>View More</span>
                      <ChevronDown size={12} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* References Section */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
          {/* Reference Audio */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
              <Music size={13} className="text-purple-400" />
              <span>Reference Audio:</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {hasAudioFile && audioStorageUrl && (
                <button
                  type="button"
                  onClick={() => setActiveMediaModal({
                    type: 'audio',
                    url: audioStorageUrl,
                    title: `${script.product} - ${script.language} Audio`
                  })}
                  className="px-2 py-0.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Play audio file"
                >
                  <Volume2 size={11} />
                  <span>Audio File</span>
                </button>
              )}

              {hasAudioLink && script.reference_audio_url && (
                <a
                  href={script.reference_audio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
                  title={script.reference_audio_url}
                >
                  <ExternalLink size={11} />
                  <span>Audio Link</span>
                </a>
              )}

              {!hasAudioFile && !hasAudioLink && (
                <span className="text-[11px] text-slate-500 italic">No reference audio</span>
              )}
            </div>
          </div>

          {/* Reference Video */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
              <Video size={13} className="text-purple-400" />
              <span>Reference Video:</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {hasVideoFile && videoStorageUrl && (
                <button
                  type="button"
                  onClick={() => setActiveMediaModal({
                    type: 'video',
                    url: videoStorageUrl,
                    title: `${script.product} - ${script.language} Video`
                  })}
                  className="px-2 py-0.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Watch video file"
                >
                  <Eye size={11} />
                  <span>Video File</span>
                </button>
              )}

              {hasVideoLink && script.reference_video_url && (
                <a
                  href={script.reference_video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
                  title={script.reference_video_url}
                >
                  <ExternalLink size={11} />
                  <span>Video Link</span>
                </a>
              )}

              {!hasVideoFile && !hasVideoLink && (
                <span className="text-[11px] text-slate-500 italic">No reference video</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Delete Script</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to delete the <span className="text-purple-300 font-semibold">{script.product} ({script.language})</span> script? Associated uploaded audio/video files will also be permanently removed.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete(script);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
              >
                Delete Script
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Preview Modal */}
      {activeMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white truncate max-w-[80%]">
                {activeMediaModal.title}
              </h4>
              <button
                type="button"
                onClick={() => setActiveMediaModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center justify-center py-2">
              {activeMediaModal.type === 'audio' ? (
                <div className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <audio controls autoPlay className="w-full" src={activeMediaModal.url}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              ) : (
                <div className="w-full bg-black rounded-xl overflow-hidden border border-slate-800 max-h-[60vh] flex items-center justify-center">
                  <video controls autoPlay className="w-full max-h-[60vh]" src={activeMediaModal.url}>
                    Your browser does not support video playback.
                  </video>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <a
                href={activeMediaModal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <ExternalLink size={12} />
                <span>Open in new tab</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveMediaModal(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
