import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit, Copy, Archive, ArchiveRestore, Trash2, Ban, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import type { InfluencerStatusType } from '../../utils/marketingUtils';

interface InfluencerActionMenuProps {
  currentSection?: InfluencerStatusType;
  onEdit: () => void;
  onCopy?: () => void;
  onMoveStatus?: (targetStatus: InfluencerStatusType) => void;
  onToggleArchive?: () => void;
  onDelete?: () => void;
}

export const InfluencerActionMenu: React.FC<InfluencerActionMenuProps> = ({
  currentSection = 'active',
  onEdit,
  onCopy,
  onMoveStatus,
  onToggleArchive,
  onDelete
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-slate-200 focus:outline-none transition-colors rounded-full hover:bg-slate-800 cursor-pointer"
        aria-label="More options"
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 origin-top-right rounded-xl bg-slate-900 border border-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.5)] ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden animate-fade-in">
          <div className="py-1">
            
            {/* 1. Edit */}
            <button
              type="button"
              onClick={() => handleAction(onEdit)}
              className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <Edit size={15} />
              Edit
            </button>

            {onCopy && (
              <button
                type="button"
                onClick={() => handleAction(onCopy)}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <Copy size={15} />
                Duplicate
              </button>
            )}

            {/* ACTIVE SECTION ACTIONS */}
            {currentSection === 'active' && (
              <>
                {/* 2. Move to Recycle Bin */}
                {onMoveStatus && (
                  <button
                    type="button"
                    onClick={() => handleAction(() => onMoveStatus('recycle_bin'))}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border-t border-slate-800 cursor-pointer"
                  >
                    <ArrowLeftRight size={15} />
                    Move to Recycle Bin
                  </button>
                )}

                {/* 3. Archive */}
                {onToggleArchive && (
                  <button
                    type="button"
                    onClick={() => handleAction(onToggleArchive)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border-t border-slate-800 cursor-pointer"
                  >
                    <Archive size={15} />
                    Archive
                  </button>
                )}

                {/* 4. Eliminate (Move to Others) */}
                {onMoveStatus && (
                  <button
                    type="button"
                    onClick={() => handleAction(() => onMoveStatus('other'))}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors border-t border-slate-800 cursor-pointer"
                  >
                    <Ban size={15} />
                    Eliminate
                  </button>
                )}
              </>
            )}

            {/* OTHERS SECTION ACTIONS */}
            {currentSection === 'other' && onMoveStatus && (
              <>
                <button
                  type="button"
                  onClick={() => handleAction(() => onMoveStatus('active'))}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/30 hover:text-emerald-300 transition-colors border-t border-slate-800 cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  Move to Active
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(() => onMoveStatus('recycle_bin'))}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border-t border-slate-800 cursor-pointer"
                >
                  <ArrowLeftRight size={15} />
                  Move to Recycle Bin
                </button>
              </>
            )}

            {/* RECYCLE BIN SECTION ACTIONS */}
            {currentSection === 'recycle_bin' && (
              <>
                {onMoveStatus && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAction(() => onMoveStatus('active'))}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-emerald-400 hover:bg-emerald-950/30 hover:text-emerald-300 transition-colors border-t border-slate-800 cursor-pointer"
                    >
                      <ArchiveRestore size={15} />
                      Restore to Active
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(() => onMoveStatus('other'))}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-purple-300 hover:bg-purple-950/40 hover:text-purple-200 transition-colors border-t border-slate-800 cursor-pointer"
                    >
                      <Ban size={15} />
                      Move to Others
                    </button>
                  </>
                )}

                {onDelete && (
                  <button
                    type="button"
                    onClick={() => handleAction(onDelete)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-bold text-red-400 hover:bg-red-950/50 hover:text-red-200 transition-colors border-t border-slate-800 cursor-pointer"
                  >
                    <Trash2 size={15} />
                    Delete Permanently
                  </button>
                )}
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
