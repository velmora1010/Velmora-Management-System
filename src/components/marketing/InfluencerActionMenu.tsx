import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Truck, Edit, Copy, Archive, ArchiveRestore } from 'lucide-react';

interface InfluencerActionMenuProps {
  isDispatched: boolean;
  isArchived: boolean;
  onDispatch?: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onToggleArchive: () => void;
}

export const InfluencerActionMenu: React.FC<InfluencerActionMenuProps> = ({
  isDispatched,
  isArchived,
  onDispatch,
  onEdit,
  onCopy,
  onToggleArchive
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
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-slate-200 focus:outline-none transition-colors rounded-full hover:bg-slate-800"
        aria-label="More options"
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl bg-slate-900 border border-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.5)] ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden">
          <div className="py-1">
            {onDispatch && (
              <button
                disabled={isDispatched}
                onClick={() => handleAction(onDispatch)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                  isDispatched 
                    ? 'text-green-500/50 cursor-not-allowed bg-green-500/5' 
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Truck size={16} />
                {isDispatched ? 'Dispatched' : 'Dispatch'}
              </button>
            )}
            
            <button
              onClick={() => handleAction(onEdit)}
              className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Edit size={16} />
              Edit
            </button>
            
            <button
              onClick={() => handleAction(onCopy)}
              className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Copy size={16} />
              Copy
            </button>
            
            <button
              onClick={() => handleAction(onToggleArchive)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors border-t border-slate-800 ${
                isArchived
                  ? 'text-green-400 hover:bg-slate-800 hover:text-green-300'
                  : 'text-red-400 hover:bg-slate-800 hover:text-red-300'
              }`}
            >
              {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              {isArchived ? 'Restore' : 'Archive'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
