import React, { useState, useRef, useEffect } from 'react';
import { 
  Link2, 
  ExternalLink, 
  Copy, 
  Check, 
  Edit3, 
  Trash2, 
  User, 
  AlertTriangle, 
  MoreVertical, 
  Calendar,
  Globe,
  ShoppingBag,
  Video,
  MousePointerClick
} from 'lucide-react';
import type { InfluencerTrackingLink } from '../../types';
import { TRACKING_PLATFORMS } from '../../services/influencerTrackingLinkService';

interface CampaignTrackingLinkCardProps {
  link: InfluencerTrackingLink;
  clicks?: number;
  isClicksConfigured?: boolean;
  isLoadingClicks?: boolean;
  onEdit: (link: InfluencerTrackingLink) => void;
  onDelete: (link: InfluencerTrackingLink) => void;
}

export const CampaignTrackingLinkCard: React.FC<CampaignTrackingLinkCardProps> = ({
  link,
  clicks = 0,
  isClicksConfigured = true,
  isLoadingClicks = false,
  onEdit,
  onDelete
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    const textToCopy = link.tracking_url || '';
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
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (err) {
      console.error('Failed to copy tracking link:', err);
    }
  };

  const handleOpen = () => {
    if (!link.tracking_url) return;
    let url = link.tracking_url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formattedDate = link.created_at
    ? new Date(link.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '';

  const matchedPlatform = TRACKING_PLATFORMS.find(
    p => p.name.toLowerCase() === (link.platform || '').toLowerCase() ||
         p.utmSource.toLowerCase() === (link.utm_source || '').toLowerCase()
  );

  const platformName = link.platform || matchedPlatform?.name || 'Instagram';
  const platformColor = matchedPlatform?.brandColor || '#A855F7';
  const isMarketplace = link.platform_category === 'MARKETPLACE' || matchedPlatform?.category === 'MARKETPLACE';
  const videoName = link.video_number || 'Video 1';

  return (
    <div className="bg-[#0b1329] border border-slate-800 hover:border-purple-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 shadow-md hover:shadow-purple-950/20 group relative">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
              <Link2 size={16} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider leading-tight truncate">
                {link.product}
              </h4>
              {formattedDate && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                  <Calendar size={12} className="text-slate-500" />
                  <span>{formattedDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Menu */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-colors cursor-pointer"
              title="Options"
            >
              <MoreVertical size={14} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-8 w-32 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(link);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <Edit3 size={13} className="text-purple-400" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer border-t border-slate-800"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Influencer & Code Banner */}
        <div className="flex items-center justify-between gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
              <User size={12} />
            </div>
            <span className="text-xs font-semibold text-slate-200 truncate">
              {link.influencer_name || 'Assigned Influencer'}
            </span>
          </div>
          {link.influencer_code && (
            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-bold shrink-0 border border-purple-500/30">
              {link.influencer_code}
            </span>
          )}
        </div>

        {/* Platform, Video & Clicks Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px]">
          {/* Destination Type Badge (if Amazon) */}
          {link.destination_type === 'amazon' && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
              <ShoppingBag size={11} className="text-amber-400" />
              <span>Amazon</span>
            </div>
          )}

          {/* Platform Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 font-semibold text-slate-300">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: platformColor }}
            />
            <span>{platformName}</span>
            <span className="text-[10px] text-slate-500 font-normal">
              ({isMarketplace ? 'Marketplace' : 'Website'})
            </span>
          </div>

          {/* Video Badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-950/30 border border-purple-500/30 text-purple-300 font-bold">
            <Video size={12} className="text-purple-400" />
            <span>{videoName}</span>
          </div>

          {/* Clicks Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono font-bold text-[11px] ${
              !isClicksConfigured
                ? 'bg-slate-900/80 border-slate-800 text-slate-500'
                : clicks > 0
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900/90 border-slate-800 text-slate-400'
            }`}
            title={!isClicksConfigured ? 'Redis click tracking not configured' : `${clicks} clicks recorded`}
          >
            <MousePointerClick
              size={12}
              className={!isClicksConfigured ? 'text-slate-500' : clicks > 0 ? 'text-amber-400' : 'text-slate-500'}
            />
            <span>{isLoadingClicks ? '...' : !isClicksConfigured ? 'Clicks: N/A' : `${clicks} clicks`}</span>
          </div>
        </div>

        {/* Tracking URL Box */}
        <div className="bg-[#070c18] border border-slate-800/80 rounded-xl p-3 my-2 space-y-1">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Tracking Link</span>
            {link.destination_type === 'amazon' ? (
              <span className="text-amber-400 font-mono text-[10px]">
                302 Redirect Tracking
              </span>
            ) : (
              <span className="text-purple-400/80 lowercase font-mono text-[10px]">
                utm_campaign={link.creator_code || (link.influencer_code || '').replace(/^#+/, '').toLowerCase()}
              </span>
            )}
          </div>
          <p
            className="text-xs text-purple-300 font-mono break-all select-all leading-relaxed bg-purple-950/20 p-2 rounded-lg border border-purple-500/20"
            title={link.tracking_url}
          >
            {link.tracking_url}
          </p>
          {link.notes && (
            <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/60 truncate">
              Note: {link.notes}
            </p>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border-purple-500/30'
            }`}
            title="Copy Tracking Link"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            title="Open in new tab"
          >
            <ExternalLink size={13} />
            <span>Open</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(link)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer"
            title="Edit"
          >
            <Edit3 size={13} className="text-purple-400" />
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Delete this tracking link?</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to delete the tracking link for{' '}
                <strong className="text-purple-300">{link.influencer_name || link.influencer_code}</strong> ({link.product})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete(link);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
              >
                Delete Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
